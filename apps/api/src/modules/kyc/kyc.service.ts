import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KycService {
  private storage: Storage;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.storage = new Storage({
      projectId: this.configService.get<string>('gcp.projectId'),
    });
    // Target the private KYC bucket defined in the architecture
    this.bucketName = this.configService.get<string>('gcp.storageBucket'); 
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
}