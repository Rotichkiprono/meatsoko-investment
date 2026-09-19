import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class InvestorService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>("supabase.url");
    const supabaseKey = this.configService.get<string>(
      "supabase.serviceRoleKey",
    );

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabase credentials are not configured in ConfigService.",
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async onboardInvestor(
    firebaseUid: string,
    email: string,
    fullName: string,
    entityType: string,
    countryIso: string,
    walletAddressEvm: string,
    walletType: string = "EMBEDDED",
  ) {
    // 1. Create the Investor record
    const { data: investor, error: investorError } = await this.supabase
      .from("investors")
      .insert({
        firebase_uid: firebaseUid,
        email,
        full_name: fullName,
        entity_type: entityType,
        country_iso: countryIso,
        accreditation_status: "UNVERIFIED",
      })
      .select("id")
      .single();

    if (investorError) {
      if (investorError.code === "23505")
        throw new ConflictException("Investor already exists.");
      throw new InternalServerErrorException(investorError.message);
    }

    // 2. Bind the EVM Wallet
    const { error: walletError } = await this.supabase
      .from("investor_wallets")
      .insert({
        investor_id: investor.id,
        wallet_address_evm: walletAddressEvm,
        wallet_type: walletType,
      });

    if (walletError)
      throw new InternalServerErrorException(walletError.message);

    return {
      message: "Investor successfully onboarded",
      investorId: investor.id,
    };
  }

  async getInvestorProfile(firebaseUid: string) {
    const { data: investor, error } = await this.supabase
      .from("investors")
      .select(
        "id, email, full_name, entity_type, country_iso, accreditation_status, investor_wallets(id, wallet_address_evm, is_whitelisted)",
      )
      .eq("firebase_uid", firebaseUid)
      .single();

    if (error || !investor) {
      return null;
    }

    const wallet = investor.investor_wallets?.[0];

    return {
      id: investor.id,
      email: investor.email,
      fullName: investor.full_name,
      entityType: investor.entity_type,
      countryIso: investor.country_iso,
      accreditationStatus: investor.accreditation_status,
      walletAddress: wallet?.wallet_address_evm || null,
      isWhitelisted: wallet?.is_whitelisted || false,
    };
  }
}
