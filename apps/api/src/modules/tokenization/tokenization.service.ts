import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PubSub, Subscription } from '@google-cloud/pubsub';
import { ethers } from 'ethers';

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
  }
}