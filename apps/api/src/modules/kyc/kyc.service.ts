import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";
import { PubSub } from "@google-cloud/pubsub";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class KycService {
  private storage: Storage;
  private bucketName: string;
  private pubsub: PubSub;
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>("supabase.url") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL;
    const supabaseKey =
      this.configService.get<string>("supabase.serviceRoleKey") ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase URL and service role key must be configured.");
    }

    this.storage = new Storage({
      projectId: this.configService.get<string>("gcp.projectId"),
    });
    this.bucketName = (
      this.configService.get<string>("gcp.storageBucket") || ""
    ).replace(/^gs:\/\//, "");
    this.pubsub = new PubSub({
      projectId: this.configService.get<string>("gcp.projectId"),
    });
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async generateSignedUploadUrl(
    userId: string,
    documentType: string,
    fileExtension: string,
  ) {
    if (!this.bucketName) {
      throw new InternalServerErrorException(
        "GCP Storage bucket not configured.",
      );
    }

    const safeExtension = fileExtension
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    if (!safeExtension) {
      throw new BadRequestException("Invalid file extension.");
    }

    const storagePath = `investors/${userId}/kyc/${documentType}/${uuidv4()}.${safeExtension}`;

    try {
      const [uploadUrl] = await this.storage
        .bucket(this.bucketName)
        .file(storagePath)
        .getSignedUrl({
          version: "v4",
          action: "write",
          expires: Date.now() + 15 * 60 * 1000,
          contentType: "application/octet-stream",
        });

      return {
        uploadUrl,
        storagePath,
      };
    } catch (error: any) {
      console.error("Failed to generate secure upload URL:", error);
      throw new InternalServerErrorException(
        "Failed to generate secure upload URL",
      );
    }
  }

  async submitKyc(
    firebaseUid: string,
    documentType: string,
    storagePath: string,
  ) {
    const expectedPrefix = `investors/${firebaseUid}/kyc/${documentType}/`;

    if (!storagePath.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        "Invalid storage path for the authenticated user.",
      );
    }

    if (
      !/^investors\/[^/]+\/kyc\/[a-z_]+\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(
        storagePath,
      )
    ) {
      throw new BadRequestException("Invalid storage path structure.");
    }

    // 1. Resolve PostgreSQL UUID from Firebase UID
    const { data: investor, error: lookupError } = await this.supabase
      .from("investors")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .single();

    if (lookupError || !investor) {
      throw new NotFoundException(
        "Investor profile not found. Please onboard first.",
      );
    }

    // 2. Insert KYC Record
    const { error: insertError } = await this.supabase
      .from("kyc_verifications")
      .insert({
        investor_id: investor.id,
        document_type: documentType,
        document_storage_path: storagePath,
        verification_status: "PENDING",
      });

    if (insertError) throw new BadRequestException(insertError.message);

    // 3. Update Investor Status
    await this.supabase
      .from("investors")
      .update({ accreditation_status: "PENDING" })
      .eq("id", investor.id);

    // 4. Emit Pub/Sub Event
    const topic = this.pubsub.topic("investor.kyc_submitted");
    await topic.publishMessage({
      data: Buffer.from(
        JSON.stringify({
          investorId: investor.id,
          documentType,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ),
    });

    return { message: "KYC documents submitted for review." };
  }
}
