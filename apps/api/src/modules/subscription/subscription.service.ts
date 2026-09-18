import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

@Injectable()
export class SubscriptionService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('supabase.url')!,
      this.configService.get<string>('supabase.serviceRoleKey')!
    );
  }

  async initializeCheckout(firebaseUid: string, tokenQuantity: number) {
    // 1. Strict Identity & Wallet State Validation
    const { data: investor, error: investorError } = await this.supabase
      .from('investors')
      .select('id, email, accreditation_status, investor_wallets(id, is_whitelisted)')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (investorError || !investor) throw new BadRequestException('Investor record not found.');
    if (investor.accreditation_status !== 'VERIFIED') throw new BadRequestException('KYC must be VERIFIED to subscribe.');
    
    const activeWallet = investor.investor_wallets[0];
    if (!activeWallet || !activeWallet.is_whitelisted) {
      throw new BadRequestException('Wallet must be whitelisted on the Hedera ledger before investing.');
    }

    // 2. Fetch Open Investment Product & Compute Settlement
    const { data: product, error: productError } = await this.supabase
      .from('investment_products')
      .select('id, nominal_token_price_cents')
      .eq('status', 'OPEN')
      .eq('asset_symbol', 'MEAT')
      .single();
      
    if (productError || !product) throw new BadRequestException('No active $MEAT investment product available.');

    // Compute fiat amount based on the $1.00 USD nominal base price 
    const fiatAmountCents = tokenQuantity * product.nominal_token_price_cents;
    
    // 3. Initialize Aggregator Settlement Session
    const paystackSecret = this.configService.get<string>('paystack.secretKey');
    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: investor.email,
          amount: fiatAmountCents, // Handled in strictly scaled cents
          currency: 'USD',
          channels: ['card', 'mobile_money', 'bank_transfer'],
          metadata: {
            subscriptionId: null, // We will append this after inserting the DB row
            investorId: investor.id,
            walletId: activeWallet.id,
          }
        },
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          }
        }
      );

      const paymentReference = response.data.data.reference;
      const authorizationUrl = response.data.data.authorization_url;

      // 4. Register the Pending Subscription
      const { data: subscription, error: subError } = await this.supabase
        .from('subscriptions')
        .insert({
          investor_id: investor.id,
          product_id: product.id,
          wallet_id: activeWallet.id,
          fiat_amount_cents: fiatAmountCents,
          token_quantity_allocated: tokenQuantity,
          payment_method: 'PAYSTACK',
          payment_reference: paymentReference,
          status: 'SUBMITTED',
        })
        .select('id')
        .single();

      if (subError) throw new InternalServerErrorException(`Failed to persist subscription: ${subError.message}`);

      return { checkoutUrl: authorizationUrl, reference: paymentReference, subscriptionId: subscription.id };
    } catch (error: any) {
      throw new InternalServerErrorException(`Checkout initialization failed: ${error.response?.data?.message || error.message}`);
    }
  }
}