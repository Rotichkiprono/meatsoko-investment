import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

@Injectable()
export class InvestorService {
  private readonly logger = new Logger(InvestorService.name);
  private supabase: SupabaseClient;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly operatorWallet: ethers.Wallet | undefined;

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

    const rpcUrl =
      this.configService.get<string>("hedera.rpcUrl") ||
      "https://testnet.hashio.io/api";
    const privateKey = this.configService.get<string>(
      "hedera.operatorPrivateKey",
    );

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    if (privateKey && ethers.isHexString(privateKey, 32)) {
      this.operatorWallet = new ethers.Wallet(privateKey, this.provider);
    }
  }

  async activateHederaAccount(
    walletAddressEvm: string,
    walletId: string,
  ): Promise<string | null> {
    try {
      // 1. Check if account already exists on mirror node
      const mirrorRes = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${walletAddressEvm}`,
      );

      if (mirrorRes.ok) {
        const mirrorData = await mirrorRes.json();
        if (mirrorData?.account) {
          const accountId = mirrorData.account;
          await this.supabase
            .from("investor_wallets")
            .update({ hedera_account_id: accountId })
            .eq("id", walletId);
          return accountId;
        }
      }

      // 2. If not found and operator wallet is configured, activate with 1 HBAR
      if (this.operatorWallet && ethers.isAddress(walletAddressEvm)) {
        this.logger.log(
          `Activating hollow Hedera account ${walletAddressEvm} with 1 HBAR...`,
        );
        const tx = await this.operatorWallet.sendTransaction({
          to: walletAddressEvm,
          value: ethers.parseEther("1.0"),
        });
        await tx.wait(1);

        // 3. Poll mirror node for newly assigned Hedera Account ID
        for (let attempt = 1; attempt <= 4; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const pollRes = await fetch(
              `https://testnet.mirrornode.hedera.com/api/v1/accounts/${walletAddressEvm}`,
            );
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              if (pollData?.account) {
                const accountId = pollData.account;
                this.logger.log(
                  `Discovered Hedera Account ID ${accountId} for ${walletAddressEvm}`,
                );
                await this.supabase
                  .from("investor_wallets")
                  .update({ hedera_account_id: accountId })
                  .eq("id", walletId);
                return accountId;
              }
            }
          } catch {
            // continue polling
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Hedera account activation deferred for ${walletAddressEvm}: ${err.message}`,
      );
    }
    return null;
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
    let investorId: string;

    // 1. Find or create the Investor record
    const { data: existingInvestor, error: lookupErr } = await this.supabase
      .from("investors")
      .select("id, full_name")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (lookupErr) {
      throw new InternalServerErrorException(lookupErr.message);
    }

    if (existingInvestor) {
      investorId = existingInvestor.id;
      // Update name if changed from generic default
      if (
        fullName &&
        fullName !== "Kali Admin" &&
        existingInvestor.full_name === "Kali Admin"
      ) {
        await this.supabase
          .from("investors")
          .update({ full_name: fullName })
          .eq("id", investorId);
      }
    } else {
      const { data: newInvestor, error: insertError } = await this.supabase
        .from("investors")
        .insert({
          firebase_uid: firebaseUid,
          email,
          full_name: fullName || email.split("@")[0],
          entity_type: entityType || "INDIVIDUAL",
          country_iso: countryIso || "KE",
          accreditation_status: "UNVERIFIED",
        })
        .select("id")
        .single();

      if (insertError) {
        throw new InternalServerErrorException(insertError.message);
      }
      investorId = newInvestor.id;
    }

    // 2. Bind or Upsert the EVM Wallet
    let walletId: string | null = null;
    if (walletAddressEvm) {
      const { data: existingWallet } = await this.supabase
        .from("investor_wallets")
        .select("id, wallet_address_evm, hedera_account_id")
        .eq("investor_id", investorId)
        .maybeSingle();

      if (!existingWallet) {
        const { data: newWallet, error: walletError } = await this.supabase
          .from("investor_wallets")
          .insert({
            investor_id: investorId,
            wallet_address_evm: walletAddressEvm,
            wallet_type: walletType,
          })
          .select("id")
          .single();

        if (walletError) {
          throw new InternalServerErrorException(walletError.message);
        }
        walletId = newWallet.id;
      } else {
        walletId = existingWallet.id;
        if (
          existingWallet.wallet_address_evm.toLowerCase() !==
          walletAddressEvm.toLowerCase()
        ) {
          await this.supabase
            .from("investor_wallets")
            .update({
              wallet_address_evm: walletAddressEvm,
              wallet_type: walletType,
              hedera_account_id: null,
            })
            .eq("id", existingWallet.id);
        }
      }

      // 3. Trigger account activation in the background
      if (walletId) {
        this.activateHederaAccount(walletAddressEvm, walletId).catch((err) =>
          this.logger.debug(`Background activation error: ${err.message}`),
        );
      }
    }

    return {
      message: "Investor successfully onboarded",
      investorId,
      walletId,
    };
  }

  async getInvestorProfile(firebaseUid: string) {
    const { data: investor, error } = await this.supabase
      .from("investors")
      .select(
        "id, email, full_name, entity_type, country_iso, accreditation_status, investor_wallets(id, wallet_address_evm, hedera_account_id, is_whitelisted)",
      )
      .eq("firebase_uid", firebaseUid)
      .single();

    if (error || !investor) {
      return null;
    }

    const wallet = investor.investor_wallets?.[0];
    let hederaAccountId = wallet?.hedera_account_id || null;

    if (!hederaAccountId && wallet?.wallet_address_evm) {
      try {
        const mirrorRes = await fetch(
          `https://testnet.mirrornode.hedera.com/api/v1/accounts/${wallet.wallet_address_evm}`,
        );
        if (mirrorRes.ok) {
          const mirrorData = await mirrorRes.json();
          if (mirrorData?.account) {
            hederaAccountId = mirrorData.account;
            await this.supabase
              .from("investor_wallets")
              .update({ hedera_account_id: hederaAccountId })
              .eq("id", wallet.id);
          }
        }
      } catch {
        // Hollow account not activated yet
      }
    }

    return {
      id: investor.id,
      email: investor.email,
      fullName: investor.full_name,
      entityType: investor.entity_type,
      countryIso: investor.country_iso,
      accreditationStatus: investor.accreditation_status,
      walletAddress: wallet?.wallet_address_evm || null,
      hederaAccountId,
      isWhitelisted: wallet?.is_whitelisted || false,
    };
  }
}
