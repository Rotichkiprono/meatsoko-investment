import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PubSub } from "@google-cloud/pubsub";

@Injectable()
export class ComplianceService {
  private storage: Storage;
  private bucketName: string;
  private supabase: SupabaseClient;
  private pubsub: PubSub;

  constructor(private configService: ConfigService) {
    this.storage = new Storage({
      projectId: this.configService.get<string>("gcp.projectId"),
    });
    this.bucketName = (
      this.configService.get<string>("gcp.storageBucket") || ""
    ).replace(/^gs:\/\//, "");

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

    this.supabase = createClient(supabaseUrl, supabaseKey);

    this.pubsub = new PubSub({
      projectId: this.configService.get<string>("gcp.projectId"),
    });
  }

  async getPendingKycApplications() {
    const { data: verifications, error } = await this.supabase
      .from("kyc_verifications")
      .select("*, investors(full_name, email, entity_type)")
      .eq("verification_status", "PENDING");

    if (error) throw new BadRequestException(error.message);

    // Generate read-only signed URLs for each document to display in the admin UI
    const enrichedVerifications = await Promise.all(
      verifications.map(async (record) => {
        const file = this.storage
          .bucket(this.bucketName)
          .file(record.document_storage_path);

        const [signedUrl] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + 15 * 60 * 1000, // 15-minute expiration
        });

        return {
          ...record,
          document_view_url: signedUrl,
        };
      }),
    );

    return enrichedVerifications;
  }

  async approveKyc(kycId: string, adminUid: string) {
    // 1. Update verification status
    const { data: kycRecord, error: kycError } = await this.supabase
      .from("kyc_verifications")
      .update({
        verification_status: "APPROVED",
        reviewed_by_user_id: adminUid,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", kycId)
      .select()
      .single();

    if (kycError || !kycRecord)
      throw new NotFoundException("KYC record not found");

    // 2. Update investor accreditation status
    await this.supabase
      .from("investors")
      .update({ accreditation_status: "VERIFIED" })
      .eq("id", kycRecord.investor_id);

    // 3. Trigger Phase 2: On-Chain Whitelisting via Pub/Sub
    const topic = this.pubsub.topic("investment.kyc.approved");
    await topic.publishMessage({
      data: Buffer.from(JSON.stringify({ investorId: kycRecord.investor_id })),
    });

    return { message: "KYC approved. Whitelisting initialized." };
  }
  async rejectKyc(kycId: string, adminUid: string, rejectionReason: string) {
    // 1. Update verification status to REJECTED with reason
    const { data: kycRecord, error: kycError } = await this.supabase
      .from("kyc_verifications")
      .update({
        verification_status: "REJECTED",
        rejection_reason: rejectionReason,
        reviewed_by_user_id: adminUid, // Now safely accepts the 28-char Firebase UID
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", kycId)
      .select()
      .single();

    if (kycError || !kycRecord)
      throw new NotFoundException("KYC record not found");

    // 2. Cascade rejection to the investor's profile
    await this.supabase
      .from("investors")
      .update({ accreditation_status: "REJECTED" })
      .eq("id", kycRecord.investor_id);

    // 3. Emit Pub/Sub Event
    const topic = this.pubsub.topic("investor.kyc_rejected");
    await topic.publishMessage({
      data: Buffer.from(
        JSON.stringify({
          investorId: kycRecord.investor_id,
          kycId,
          rejectionReason,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ),
    });

    return { message: "KYC application rejected." };
  }
}
