import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import axios from "axios";

@Injectable()
export class SubscriptionService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>("supabase.url")!,
      this.configService.get<string>("supabase.serviceRoleKey")!,
    );
  }

  async initializeCheckout(firebaseUid: string, tokenQuantity: number) {
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
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: investor.email,
          amount: fiatAmountCents,
          currency: "USD",
          channels: ["card", "mobile_money", "bank_transfer"],
          metadata: {
            subscriptionId: subscription.id,
            investorId: investor.id,
            walletId: activeWallet.id,
          },
        },
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
}
