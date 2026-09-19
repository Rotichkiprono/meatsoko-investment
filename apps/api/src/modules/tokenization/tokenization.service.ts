import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

// Minimal ERC-3643 Token Interface for Minting & Verification
const ERC3643_ABI = [
  "function mint(address _to, uint256 _amount) external",
  "function decimals() view returns (uint8)",
  "function identityRegistry() view returns (address)",
];

const IDENTITY_REGISTRY_ABI = [
  "function isVerified(address _userAddress) view returns (bool)",
];

@Injectable()
export class TokenizationService {
  private readonly logger = new Logger(TokenizationService.name);
  private readonly supabase: SupabaseClient;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly wallet: ethers.Wallet;
  private readonly tokenAddress: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>("supabase.url");
    const supabaseKey = this.configService.get<string>(
      "supabase.serviceRoleKey",
    );
    const rpcUrl =
      this.configService.get<string>("hedera.rpcUrl") ||
      "https://testnet.hashio.io/api";
    const privateKey = this.configService.get<string>(
      "hedera.operatorPrivateKey",
    );
    this.tokenAddress =
      this.configService.get<string>("hedera.securityTokenAddress") || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials missing in TokenizationService");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    } else {
      this.logger.warn(
        "HEDERA_OPERATOR_PRIVATE_KEY is not defined. Read-only mode.",
      );
    }
  }

  async handleTokenDispatch(subscriptionId: string): Promise<string> {
    if (!this.wallet) {
      throw new InternalServerErrorException(
        "Hedera operator wallet is not initialized",
      );
    }

    if (!ethers.isAddress(this.tokenAddress)) {
      throw new InternalServerErrorException(
        `Invalid token address configured: ${this.tokenAddress}`,
      );
    }

    // 1. Fetch Subscription and Joined Investor Wallets
    const { data: subData, error: subErr } = await this.supabase
      .from("subscriptions")
      .select(
        `
        id,
        token_quantity,
        status,
        investor_id,
        investor_wallets (
          wallet_address_evm,
          status,
          is_primary
        )
      `,
      )
      .eq("id", subscriptionId)
      .single();

    if (subErr || !subData) {
      this.logger.error(
        `Failed to load subscription ${subscriptionId}: ${subErr?.message}`,
      );
      throw new BadRequestException("Subscription not found");
    }

    // 2. Safe Array & Address Validation
    const wallets = subData.investor_wallets as Array<{
      wallet_address_evm: string;
      status: string;
      is_primary?: boolean;
    }> | null;

    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      throw new BadRequestException(
        `No wallet registered for investor ${subData.investor_id}`,
      );
    }

    // Prefer primary wallet, otherwise default to first available
    const primaryWallet = wallets.find((w) => w.is_primary) || wallets[0];
    const recipientAddress = primaryWallet.wallet_address_evm;

    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      throw new BadRequestException(
        `Invalid destination EVM address: ${recipientAddress}`,
      );
    }

    const tokenQuantity = Number(subData.token_quantity);
    if (isNaN(tokenQuantity) || tokenQuantity <= 0) {
      throw new BadRequestException(
        `Invalid token quantity: ${subData.token_quantity}`,
      );
    }

    this.logger.log(
      `Dispatching ${tokenQuantity} MEAT tokens to ${recipientAddress} for subscription ${subscriptionId}...`,
    );

    // 3. Connect to Token Contract
    const tokenContract = new ethers.Contract(
      this.tokenAddress,
      ERC3643_ABI,
      this.wallet,
    );

    // 4. Optional OnchainID Verification Check
    try {
      const identityRegistryAddress = await tokenContract.identityRegistry();
      if (
        identityRegistryAddress &&
        ethers.isAddress(identityRegistryAddress)
      ) {
        const registryContract = new ethers.Contract(
          identityRegistryAddress,
          IDENTITY_REGISTRY_ABI,
          this.provider,
        );
        const isVerified = await registryContract.isVerified(recipientAddress);
        if (!isVerified) {
          this.logger.warn(
            `Wallet ${recipientAddress} has not passed ERC-3643 OnchainID validation.`,
          );
        }
      }
    } catch (regErr: any) {
      this.logger.debug(
        `Skipping external registry verification check: ${regErr.message}`,
      );
    }

    // 5. Calculate Token Units (Standard 18 decimals)
    let decimals = 18;
    try {
      decimals = await tokenContract.decimals();
    } catch (e) {
      this.logger.debug(
        "Could not query decimals from token contract, falling back to 18.",
      );
    }

    const amountInUnits = ethers.parseUnits(tokenQuantity.toString(), decimals);

    // 6. Sign and Send Mint Transaction on Hedera EVM
    const tx = await tokenContract.mint(recipientAddress, amountInUnits);
    this.logger.log(
      `Mint transaction submitted: ${tx.hash}. Waiting for confirmation...`,
    );

    const receipt = await tx.wait(1);
    this.logger.log(
      `Mint confirmed in block ${receipt.blockNumber} (Hash: ${tx.hash})`,
    );

    // 7. Finalize Database State
    const { error: updateErr } = await this.supabase
      .from("subscriptions")
      .update({
        status: "completed",
        transaction_hash: tx.hash,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (updateErr) {
      this.logger.error(
        `Critical: Mint succeeded (${tx.hash}) but failed to update subscription ${subscriptionId} status: ${updateErr.message}`,
      );
    }

    return tx.hash;
  }
}
