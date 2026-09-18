import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PubSub, Subscription } from '@google-cloud/pubsub';
import { ethers } from 'ethers';

const ERC20_ABI = ["function transfer(address to, uint256 amount) external returns (bool)"];

const IDENTITY_REGISTRY_ABI = [
  "function registerIdentity(address userAddress, address identity, uint16 country) external",
  "function isVerified(address userAddress) external view returns (bool)"
];

@Injectable()
export class TokenizationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenizationService.name);
  private supabase: SupabaseClient;
  private pubsub: PubSub;
  private kycSubscription: Subscription;
  private provider: ethers.JsonRpcProvider;
  private operatorWallet: ethers.Wallet | null = null;
  private fundingSubscription: Subscription;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('supabase.url')!,
      this.configService.get<string>('supabase.serviceRoleKey')!
    );
    this.pubsub = new PubSub({
      projectId: this.configService.get<string>('gcp.projectId'),
    });
  }

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('hedera.rpcUrl')!;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = this.configService.get<string>('hedera.operatorPrivateKey');
    if (privateKey && privateKey.startsWith('0x') && privateKey.length === 66) {
      this.operatorWallet = new ethers.Wallet(privateKey, this.provider);
      this.logger.log(`Hedera Operator initialized: ${this.operatorWallet.address}`);
    } else {
      this.logger.warn('Hedera operator private key not configured or invalid format. On-chain calls disabled.');
    }

    this.startKycApprovalListener();
    this.startFundingCompletedListener();
  }

  private startFundingCompletedListener() {
    const subscriptionName = 'investment.funding.completed-sub';
    try {
      this.fundingSubscription = this.pubsub.subscription(subscriptionName);
      this.fundingSubscription.on('message', async (message) => {
        try {
          const payload = JSON.parse(message.data.toString());
          await this.handleTokenDispatch(payload.subscriptionId);
          message.ack();
        } catch (error: any) {
          this.logger.error(`Error processing token dispatch: ${error.message}`);
          message.nack();
        }
      });
      this.fundingSubscription.on('error', (err: any) => {
        this.logger.warn(`PubSub Funding Subscription offline or inactive: ${err.message}`);
      });
    } catch (e: any) {
      this.logger.warn(`Failed to attach funding Pub/Sub subscriber: ${e.message}`);
    }
  }

  private async handleTokenDispatch(subscriptionId: string) {
    if (!this.operatorWallet) throw new Error('Operator wallet not initialized');

    this.logger.log(`Initiating treasury dispatch for subscription: ${subscriptionId}`);

    const { data: subData, error: subError } = await this.supabase
      .from('subscriptions')
      .select('token_quantity_allocated, investor_wallets(wallet_address_evm)')
      .eq('id', subscriptionId)
      .eq('status', 'FUNDS_RECEIVED')
      .single();

    if (subError || !subData) throw new Error(`Valid funded subscription not found: ${subscriptionId}`);

    const recipientAddress = subData.investor_wallets.wallet_address_evm;
    const tokensToTransfer = subData.token_quantity_allocated;
    const tokenAddress = this.configService.get<string>('hedera.securityTokenAddress');

    if (!tokenAddress) throw new Error('MEAT_SECURITY_TOKEN_ADDRESS not configured');

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.operatorWallet);

    const decimals = 4;
    // Safely cast the dynamic Supabase numeric return to a strict 4-decimal string to prevent precision loss
    const safeTokenQuantity = Number(tokensToTransfer).toFixed(decimals);
    const amountInBaseUnits = ethers.parseUnits(safeTokenQuantity, decimals);

    try {
      const tx = await tokenContract.transfer(recipientAddress, amountInBaseUnits);
      this.logger.log(`ERC-20 transfer submitted to Hedera: ${tx.hash}`);

      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        await this.supabase
          .from('token_allocations')
          .insert({
            subscription_id: subscriptionId,
            recipient_evm_address: recipientAddress,
            tokens_transferred: tokensToTransfer,
            transaction_hash: tx.hash,
            block_number: receipt.blockNumber,
            execution_status: 'CONFIRMED'
          });

        await this.supabase
          .from('subscriptions')
          .update({ status: 'ALLOCATED' })
          .eq('id', subscriptionId);

        this.logger.log(`$MEAT Treasury dispatch confirmed for subscription: ${subscriptionId}`);
      } else {
        throw new Error('On-chain token transfer reverted.');
      }
    } catch (error: any) {
      this.logger.error(`Token dispatch failed for ${recipientAddress}: ${error.message}`);
      throw error;
    }
  }

  private startKycApprovalListener() {
    const subscriptionName = 'investment.kyc.approved-sub';
    try {
      this.kycSubscription = this.pubsub.subscription(subscriptionName);
      this.kycSubscription.on('message', async (message) => {
        try {
          const payload = JSON.parse(message.data.toString());
          await this.handleKycApproval(payload.investorId);
          message.ack();
        } catch (error: any) {
          this.logger.error(`Error processing KYC approval: ${error.message}`);
          message.nack();
        }
      });
      this.kycSubscription.on('error', (err: any) => {
        this.logger.warn(`PubSub KYC Subscription offline or inactive: ${err.message}`);
      });
    } catch (e: any) {
      this.logger.warn(`Failed to attach Pub/Sub subscriber: ${e.message}`);
    }
  }

  private async handleKycApproval(investorId: string) {
    if (!this.operatorWallet) {
      throw new Error('Operator wallet not initialized');
    }

    const { data: walletData, error: walletError } = await this.supabase
      .from('investor_wallets')
      .select('wallet_address_evm, investors(country_iso)')
      .eq('investor_id', investorId)
      .single();

    if (walletError || !walletData) {
      throw new Error(`Wallet not found for investor: ${investorId}`);
    }

    const userAddress = walletData.wallet_address_evm;
    const registryAddress = this.configService.get<string>('hedera.kycWhitelistAddress');

    if (!registryAddress) {
      throw new Error('ERC3643_KYC_WHITELIST_ADDRESS not configured');
    }

    const identityRegistry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, this.operatorWallet);

    const numericCountryCode = 404; // Kenya ISO-3166 numeric
    const tx = await identityRegistry.registerIdentity(userAddress, userAddress, numericCountryCode);
    this.logger.log(`Whitelisting tx submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      await this.supabase
        .from('investor_wallets')
        .update({ is_whitelisted: true, whitelisted_at: new Date().toISOString() })
        .eq('wallet_address_evm', userAddress);
      this.logger.log(`Investor ${userAddress} successfully whitelisted on-chain.`);
    } else {
      throw new Error('On-chain whitelisting transaction reverted.');
    }
  }

  onModuleDestroy() {
    if (this.kycSubscription) {
      this.kycSubscription.close();
    }
    if (this.fundingSubscription) {
      this.fundingSubscription.close();
    }
  }
}