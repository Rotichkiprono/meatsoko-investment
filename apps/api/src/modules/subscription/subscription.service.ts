import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import axios from "axios";
import { TokenizationService } from "../tokenization/tokenization.service";

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private tokenizationService: TokenizationService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>("supabase.url")!,
      this.configService.get<string>("supabase.serviceRoleKey")!,
    );
  }

  async initializeCheckout(
    firebaseUid: string,
    tokenQuantity: number,
    callbackUrl?: string,
  ) {
    if (
      !Number.isInteger(tokenQuantity) ||
      tokenQuantity < 1 ||
      tokenQuantity > 100000
    ) {
      throw new BadRequestException(
        "tokenQuantity must be an integer between 1 and 100000.",
      );
    }

    const { data: investor, error: investorError } = await this.supabase
      .from("investors")
      .select(
        "id, email, accreditation_status, investor_wallets(id, is_whitelisted)",
      )
      .eq("firebase_uid", firebaseUid)
      .single();

    if (investorError || !investor)
      throw new BadRequestException("Investor record not found.");
    if (investor.accreditation_status !== "VERIFIED")
      throw new BadRequestException("KYC must be VERIFIED to subscribe.");

    const activeWallet = investor.investor_wallets[0];
    if (!activeWallet || !activeWallet.is_whitelisted) {
      throw new BadRequestException(
        "Wallet must be whitelisted on the Hedera ledger before investing.",
      );
    }

    const { data: product, error: productError } = await this.supabase
      .from("investment_products")
      .select("id, nominal_token_price_cents")
      .eq("status", "OPEN")
      .eq("asset_symbol", "MEAT")
      .single();

    if (productError || !product)
      throw new BadRequestException(
        "No active $MEAT investment product available.",
      );

    const fiatAmountCents = tokenQuantity * product.nominal_token_price_cents;

    // Persist pending subscription to generate the UUID mapped to the Paystack metadata
    const { data: subscription, error: subError } = await this.supabase
      .from("subscriptions")
      .insert({
        investor_id: investor.id,
        product_id: product.id,
        wallet_id: activeWallet.id,
        fiat_amount_cents: fiatAmountCents,
        currency: "KES",
        token_quantity_allocated: tokenQuantity,
        payment_method: "PAYSTACK",
        status: "SUBMITTED",
      })
      .select("id")
      .single();

    if (subError)
      throw new InternalServerErrorException(
        `Failed to persist subscription: ${subError.message}`,
      );

    try {
      const paystackPayload: any = {
        email: investor.email,
        amount: fiatAmountCents,
        currency: "KES",
        channels: ["card", "mobile_money", "bank_transfer"],
        metadata: {
          subscriptionId: subscription.id,
          investorId: investor.id,
          walletId: activeWallet.id,
        },
      };

      if (callbackUrl) {
        paystackPayload.callback_url = callbackUrl;
      }

      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        paystackPayload,
        {
          headers: {
            Authorization: `Bearer ${this.configService.get<string>(
              "paystack.secretKey",
            )}`,
            "Content-Type": "application/json",
          },
        },
      );

      const paymentReference = response.data.data.reference;
      const authorizationUrl = response.data.data.authorization_url;

      await this.supabase
        .from("subscriptions")
        .update({ payment_reference: paymentReference })
        .eq("id", subscription.id);

      return {
        checkoutUrl: authorizationUrl,
        reference: paymentReference,
        subscriptionId: subscription.id,
      };
    } catch (error: any) {
      // Rollback on Paystack failure to prevent orphaned deadlocks
      await this.supabase
        .from("subscriptions")
        .delete()
        .eq("id", subscription.id);
      throw new InternalServerErrorException(
        `Checkout initialization failed: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  }

  async getMySubscriptions(firebaseUid: string) {
    const { data: investor, error: invErr } = await this.supabase
      .from("investors")
      .select("id, investor_wallets(wallet_address_evm, hedera_account_id)")
      .eq("firebase_uid", firebaseUid)
      .single();

    if (invErr || !investor) {
      return {
        subscriptions: [],
        totalTokens: 0,
        walletAddress: null,
        hederaAccountId: null,
      };
    }

    const { data: subscriptions, error: subErr } = await this.supabase
      .from("subscriptions")
      .select(
        `
        id,
        fiat_amount_cents,
        currency,
        token_quantity_allocated,
        payment_method,
        payment_reference,
        status,
        created_at,
        token_allocations (
          transaction_hash,
          block_number,
          execution_status
        )
      `,
      )
      .eq("investor_id", investor.id)
      .order("created_at", { ascending: false });

    if (subErr || !subscriptions) {
      return {
        subscriptions: [],
        totalTokens: 0,
        walletAddress: null,
        hederaAccountId: null,
      };
    }

    const wallet = investor.investor_wallets?.[0];
    const totalTokens = subscriptions
      .filter((s: any) => s.status === "ALLOCATED")
      .reduce(
        (sum: number, s: any) => sum + Number(s.token_quantity_allocated),
        0,
      );

    return {
      walletAddress: wallet?.wallet_address_evm || null,
      hederaAccountId: wallet?.hedera_account_id || null,
      totalTokens,
      subscriptions,
    };
  }

  async verifyAndSettlePayment(reference: string, firebaseUid: string) {
    if (!reference) {
      throw new BadRequestException("Reference is required.");
    }

    // 1. Verify transaction with Paystack API
    const paystackSecret = this.configService.get<string>("paystack.secretKey");
    let paystackData: any;
    try {
      const res = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
          },
        },
      );
      paystackData = res.data?.data;
    } catch (err: any) {
      throw new BadRequestException(
        `Paystack verification failed: ${
          err.response?.data?.message || err.message
        }`,
      );
    }

    if (paystackData?.status !== "success") {
      throw new BadRequestException(
        `Payment is not successful. Status: ${paystackData?.status}`,
      );
    }

    // 2. Find subscription
    const { data: subscription, error: subErr } = await this.supabase
      .from("subscriptions")
      .select("id, status, token_quantity_allocated, investor_id")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (subErr || !subscription) {
      throw new NotFoundException(
        `Subscription not found for reference ${reference}.`,
      );
    }

    // 3. If already allocated, return success
    if (subscription.status === "ALLOCATED") {
      const { data: allocation } = await this.supabase
        .from("token_allocations")
        .select("transaction_hash, block_number, execution_status")
        .eq("subscription_id", subscription.id)
        .maybeSingle();

      return {
        status: "ALLOCATED",
        message: "Tokens already allocated.",
        subscriptionId: subscription.id,
        transactionHash: allocation?.transaction_hash || null,
      };
    }

    // 4. Update status to FUNDS_RECEIVED
    await this.supabase
      .from("subscriptions")
      .update({
        status: "FUNDS_RECEIVED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    // 5. Trigger token dispatch from treasury
    try {
      const txHash = await this.tokenizationService.handleTokenDispatch(
        subscription.id,
      );
      return {
        status: "ALLOCATED",
        message: "Payment verified and tokens successfully transferred!",
        subscriptionId: subscription.id,
        transactionHash: txHash,
      };
    } catch (dispatchErr: any) {
      this.logger.warn(
        `Token dispatch failed for ${subscription.id}: ${dispatchErr.message}`,
      );
      return {
        status: "FUNDS_RECEIVED",
        message: `Payment verified! Tokens pending dispatch: ${dispatchErr.message}`,
        subscriptionId: subscription.id,
        transactionHash: null,
      };
    }
  }
}
