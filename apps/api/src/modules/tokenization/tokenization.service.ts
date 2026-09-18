import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PubSub, Subscription } from '@google-cloud/pubsub';
import { ethers } from 'ethers';

// Minimal ABI for ERC-3643 IdentityRegistry interaction
const IDENTITY_REGISTRY_ABI = [
  "function registerIdentity(address userAddress, address identity, uint16 country) external",
  "function isVerified(address userAddress) external view returns (bool)"
];

@Injectable()
export class TokenizationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenizationService.name);
  private supabase: SupabaseClient;
  private pubsub: PubSub;
  private subscription: Subscription;
  private provider: ethers.JsonRpcProvider;
  private operatorWallet: ethers.Wallet;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      this.configService.get<string>('secrets.supabase')
    );
    this.pubsub = new PubSub({ projectId: this.configService.get<string>('gcp.projectId') });
  }

  async onModuleInit() {
    // 1. Initialize Hedera RPC Provider (Testnet)
    const rpcUrl = this.configService.get<string>('HEDERA_JSON_RPC_URL') || 'https://testnet.hashio.io/api';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // 2. Hydrate Operator Wallet from Secret Manager
    const privateKey = this.configService.get<string>('secrets.hedera');
    this.operatorWallet = new ethers.Wallet(privateKey, this.provider);
    
    this.logger.log(`Hedera Operator initialized: ${this.operatorWallet.address}`);

    // 3. Start Pub/Sub Listener
    this.startKycApprovalListener();
  }

  private startKycApprovalListener() {
    const subscriptionName = 'investment.kyc.approved-sub';
    this.subscription = this.pubsub.subscription(subscriptionName);

    this.subscription.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.data.toString());
        await this.handleKycApproval(payload.investorId);
        message.ack();
      } catch (error) {
        this.logger.error(`Error processing KYC approval event: ${error.message}`);
        message.nack();
      }
    });

    this.subscription.on('error', (error) => {
      this.logger.error(`PubSub Subscription Error: ${error.message}`);
    });

    this.logger.log(`Listening for events on subscription: ${subscriptionName}`);
  }

  private async handleKycApproval(investorId: string) {
    this.logger.log(`Initiating on-chain whitelisting for investor: ${investorId}`);

    // 1. Fetch Investor & Wallet Details
    const { data: walletData, error: walletError } = await this.supabase
      .from('investor_wallets')
      .select('wallet_address_evm, investors(country_iso)')
      .eq('investor_id', investorId)
      .single();

    if (walletError || !walletData) {
      throw new Error(`Wallet not found for investor: ${investorId}`);
    }

    const userAddress = walletData.wallet_address_evm;
    
    // In ERC-3643, country codes are often ISO-3166-1 numeric. 
    // You would map the 'country_iso' (e.g., 'US', 'KE') to its numeric equivalent here.
    const numericCountryCode = 404; // e.g., Kenya = 404

    // 2. Connect to Identity Registry Contract
    const registryAddress = this.configService.get<string>('ERC3643_KYC_WHITELIST_ADDRESS');
    const identityRegistry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, this.operatorWallet);

    try {
      // Note: In a full production implementation, you first deploy an ONCHAINID contract 
      // for the user. For this bridge, we assume the ONCHAINID address is generated or standard.
      const simulatedOnchainIdentityAddress = userAddress; 

      // 3. Execute the whitelist transaction
      const tx = await identityRegistry.registerIdentity(userAddress, simulatedOnchainIdentityAddress, numericCountryCode);
      this.logger.log(`Transaction submitted to Hedera: ${tx.hash}`);

      // 4. Wait for finality
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        // 5. Reconcile State in Supabase
        await this.supabase
          .from('investor_wallets')
          .update({ 
            is_whitelisted: true, 
            whitelisted_at: new Date().toISOString() 
          })
          .eq('wallet_address_evm', userAddress);
          
        this.logger.log(`Investor ${userAddress} successfully whitelisted on-chain.`);
      } else {
        throw new Error('Transaction reverted on-chain.');
      }
    } catch (error) {
      this.logger.error(`Whitelisting failed for ${userAddress}: ${error.message}`);
      throw error;
    }
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.close();
    }
  }
}