import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { PubSub } from '@google-cloud/pubsub';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KycService {
  private storage: Storage;
  private bucketName: string;
  private pubsub: PubSub;
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.storage = new Storage({ projectId: this.configService.get<string>('gcp.projectId') });
    this.bucketName = this.configService.get<string>('gcp.storageBucket');
    this.pubsub = new PubSub({ projectId: this.configService.get<string>('gcp.projectId') });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      this.configService.get<string>('secrets.supabase')
    );
  }

  async generateUploadUrl(investorId: string, fileType: string, documentType: string) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    
    if (!allowedTypes.includes(fileType)) {
      throw new BadRequestException('Invalid file type. Only PDF, JPEG, and PNG are permitted.');
    }

    // Determine extension for secure storage path
    const fileExtension = fileType.split('/')[1];
    const objectPath = `investors/${investorId}/${documentType}_${uuidv4()}.${fileExtension}`;
    
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectPath);

    // Generate a PUT URL expiring in 15 minutes
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, 
      contentType: fileType,
    });

    return {
      uploadUrl: signedUrl,
      storagePath: objectPath, 
    };
  }

  async submitKyc(firebaseUid: string, documentType: string, storagePath: string) {
    // 1. Resolve PostgreSQL UUID from Firebase UID
    const { data: investor, error: lookupError } = await this.supabase
      .from('investors')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (lookupError || !investor) {
      throw new NotFoundException('Investor profile not found. Please onboard first.');
    }

    // 2. Insert KYC Record
    const { error: insertError } = await this.supabase
      .from('kyc_verifications')
      .insert({
        investor_id: investor.id,
        document_type: documentType,
        document_storage_path: storagePath,
        verification_status: 'PENDING',
      });

    if (insertError) throw new BadRequestException(insertError.message);

    // 3. Update Investor Status
    await this.supabase
      .from('investors')
      .update({ accreditation_status: 'PENDING' })
      .eq('id', investor.id);

    // 4. Emit Pub/Sub Event
    const topic = this.pubsub.topic('investor.kyc_submitted');
    await topic.publishMessage({
      data: Buffer.from(JSON.stringify({
        investorId: investor.id,
        documentType,
        timestamp: Math.floor(Date.now() / 1000)
      })),
    });

    return { message: 'KYC documents submitted for review.' };
  }
}