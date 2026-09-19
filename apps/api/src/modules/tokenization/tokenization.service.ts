import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

// Minimal ERC-20 / ERC-3643 Token Interface
const TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address _to, uint256 _amount) external",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
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
  private readonly wallet: ethers.Wallet | undefined;
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
      this.configService.get<string>("hedera.securityTokenAddress") ||
      process.env.MEAT_SECURITY_TOKEN_ADDRESS ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials missing in TokenizationService");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (privateKey && ethers.isHexString(privateKey, 32)) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    } else {
      this.logger.warn(
        "HEDERA_OPERATOR_PRIVATE_KEY is missing or invalid. Read-only mode.",
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
        token_quantity_allocated,
        status,
        investor_id,
        wallet_id,
        investor_wallets (
          wallet_address_evm,
          hedera_account_id,
          is_whitelisted
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

    const wallet = subData.investor_wallets as unknown as {
      wallet_address_evm: string;
      hedera_account_id: string | null;
      is_whitelisted: boolean;
    } | null;

    if (!wallet || !wallet.wallet_address_evm) {
      throw new BadRequestException(
        `No wallet registered for investor ${subData.investor_id}`,
      );
    }

    const recipientAddress = wallet.wallet_address_evm;

    if (!ethers.isAddress(recipientAddress)) {
      throw new BadRequestException(
        `Invalid destination EVM address: ${recipientAddress}`,
      );
    }

    const tokenQuantity = Number(subData.token_quantity_allocated);
    if (isNaN(tokenQuantity) || tokenQuantity <= 0) {
      throw new BadRequestException(
        `Invalid token quantity: ${subData.token_quantity_allocated}`,
      );
    }

    this.logger.log(
      `Dispatching ${tokenQuantity} MEAT tokens to ${recipientAddress} for subscription ${subscriptionId}...`,
    );

    // 2. Connect to Token Contract
    const tokenContract = new ethers.Contract(
      this.tokenAddress,
      TOKEN_ABI,
      this.wallet,
    );

    // 3. Check Decimals (Contract has 4 decimals)
    let decimals = 4;
    try {
      decimals = Number(await tokenContract.decimals());
    } catch {
      this.logger.debug("Falling back to 4 decimals for MEAT token.");
    }

    const amountInUnits = ethers.parseUnits(tokenQuantity.toString(), decimals);

    // 4. Send Transfer from Treasury (fallback to Mint if transfer reverts)
    let tx: ethers.ContractTransactionResponse;
    try {
      this.logger.log(
        `Attempting transfer of ${amountInUnits} from treasury (${this.wallet.address}) to ${recipientAddress}...`,
      );
      tx = await tokenContract.transfer(recipientAddress, amountInUnits);
    } catch (transferErr: any) {
      this.logger.warn(
        `Transfer failed (${transferErr.message}), attempting mint fallback...`,
      );
      tx = await tokenContract.mint(recipientAddress, amountInUnits);
    }

    this.logger.log(
      `Transaction submitted: ${tx.hash}. Waiting for confirmation...`,
    );

    const receipt = await tx.wait(1);
    if (!receipt) {
      throw new InternalServerErrorException(
        "Transaction receipt was null after confirmation.",
      );
    }

    this.logger.log(
      `Token transfer confirmed in block ${receipt.blockNumber} (Hash: ${tx.hash})`,
    );

    // 5. Finalize Database State
    const { error: updateErr } = await this.supabase
      .from("subscriptions")
      .update({
        status: "ALLOCATED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (updateErr) {
      this.logger.error(
        `Critical: Token transfer succeeded (${tx.hash}) but failed to update subscription status: ${updateErr.message}`,
      );
    }

    // 6. Record Token Allocation
    const { error: allocErr } = await this.supabase
      .from("token_allocations")
      .insert({
        subscription_id: subscriptionId,
        recipient_evm_address: recipientAddress,
        tokens_transferred: tokenQuantity,
        transaction_hash: tx.hash,
        block_number: receipt.blockNumber,
        execution_status: "CONFIRMED",
      });

    if (allocErr) {
      this.logger.error(
        `Failed to record token allocation: ${allocErr.message}`,
      );
    }

    return tx.hash;
  }
}
