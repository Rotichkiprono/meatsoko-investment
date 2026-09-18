import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class InvestorService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      this.configService.get<string>('secrets.supabase')
    );
  }

  async onboardInvestor(
    firebaseUid: string,
    email: string,
    fullName: string,
    entityType: string,
    countryIso: string,
    walletAddressEvm: string,
    walletType: string = 'EMBEDDED'
  ) {
    // 1. Create the Investor record
    const { data: investor, error: investorError } = await this.supabase
      .from('investors')
      .insert({
        firebase_uid: firebaseUid,
        email,
        full_name: fullName,
        entity_type: entityType,
        country_iso: countryIso,
        accreditation_status: 'UNVERIFIED',
      })
      .select('id')
      .single();

    if (investorError) {
      if (investorError.code === '23505') throw new ConflictException('Investor already exists.');
      throw new InternalServerErrorException(investorError.message);
    }

    // 2. Bind the EVM Wallet
    const { error: walletError } = await this.supabase
      .from('investor_wallets')
      .insert({
        investor_id: investor.id,
        wallet_address_evm: walletAddressEvm,
        wallet_type: walletType,
      });

    if (walletError) throw new InternalServerErrorException(walletError.message);

    return { message: 'Investor successfully onboarded', investorId: investor.id };
  }
}