import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import { TokenizationService } from "../tokenization/tokenization.service";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly supabase: SupabaseClient;
  private readonly paystackSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenizationService: TokenizationService,
  ) {
    const supabaseUrl = this.configService.get<string>("supabase.url");
    const supabaseKey = this.configService.get<string>(
      "supabase.serviceRoleKey",
    );
    this.paystackSecret =
      this.configService.get<string>("paystack.secretKey") || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials missing in WebhookService");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async processWebhook(rawBody: Buffer, signature: string): Promise<void> {
    // 1. Cryptographic HMAC-SHA512 Validation
    if (!this.paystackSecret) {
      this.logger.error("PAYSTACK_SECRET_KEY is not configured in environment");
      throw new UnauthorizedException("Payment gateway not configured");
    }

    const hash = crypto
      .createHmac("sha512", this.paystackSecret)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      this.logger.warn(
        `Signature mismatch: expected ${hash}, received ${signature}`,
      );
      throw new UnauthorizedException("Invalid Paystack signature");
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new BadRequestException("Malformed JSON payload");
    }

    const { event, data } = payload;
    this.logger.log(
      `Paystack webhook received: [${event}] Reference: ${data?.reference}`,
    );

    if (event !== "charge.success") {
      this.logger.log(`Ignoring unsupported event type: ${event}`);
      return;
    }

    const reference = data?.reference;
    if (!reference) {
      throw new BadRequestException("Missing transaction reference");
    }

    // 2. Fetch Subscription State using payment_reference
    const { data: subscription, error: fetchErr } = await this.supabase
      .from("subscriptions")
      .select("id, status, token_quantity_allocated, investor_id")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (fetchErr) {
      this.logger.error(
        `Database query failed for reference ${reference}: ${fetchErr.message}`,
      );
      throw new BadRequestException("Database error resolving subscription");
    }

    if (!subscription) {
      this.logger.warn(
        `No subscription found for reference ${reference}. Ignoring.`,
      );
      return;
    }

    // 3. Idempotency Check: Exit cleanly if already allocated or settled
    if (
      subscription.status === "ALLOCATED" ||
      subscription.status === "SETTLED"
    ) {
      this.logger.warn(
        `Subscription ${subscription.id} is already in state '${subscription.status}'. Skipping.`,
      );
      return;
    }

    // 4. Atomic Lock: Transition status from 'SUBMITTED' to 'FUNDS_RECEIVED'
    const { data: updatedSub, error: updateErr } = await this.supabase
      .from("subscriptions")
      .update({
        status: "FUNDS_RECEIVED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .eq("status", "SUBMITTED")
      .select("id")
      .maybeSingle();

    if (updateErr || !updatedSub) {
      this.logger.warn(
        `Race condition detected: Subscription ${subscription.id} was already claimed or updated.`,
      );
      return;
    }

    // 5. Trigger Hedera EVM Token Transfer
    try {
      await this.tokenizationService.handleTokenDispatch(subscription.id);
      this.logger.log(
        `Subscription ${subscription.id} tokens successfully dispatched.`,
      );
    } catch (mintError: any) {
      this.logger.error(
        `Failed to dispatch tokens for subscription ${subscription.id}: ${mintError.message}`,
      );
      // Keep as FUNDS_RECEIVED so it can be retried once account is whitelisted
      await this.supabase
        .from("subscriptions")
        .update({
          status: "FUNDS_RECEIVED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      throw mintError;
    }
  }
}
