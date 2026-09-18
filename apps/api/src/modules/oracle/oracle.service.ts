import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// Optimized minimal payload for Chainlink Functions DON execution
export interface OracleValuationPayload {
  value: number;       // netAssetValue in strictly scaled integer cents
  timestamp: number;   // UNIX epoch
  checksum: string;    // Deterministic SHA-256 hash of the value and timestamp
}

@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('supabase.url')!,
      this.configService.get<string>('supabase.serviceRoleKey')!
    );
  }

  async generateValuationPayload(): Promise<OracleValuationPayload> {
    try {
      // Fetch the base product valuation from the system of record
      const { data: product, error } = await this.supabase
        .from('investment_products')
        .select('target_valuation_cents')
        .eq('asset_symbol', 'MEAT')
        .eq('status', 'OPEN')
        .single();

      if (error || !product) {
        throw new Error(`Failed to fetch base valuation for $MEAT: ${error?.message}`);
      }

      const value = Number(product.target_valuation_cents);
      const timestamp = Math.floor(Date.now() / 1000);

      // Generate deterministic SHA-256 checksum of a minimal concatenated string
      const payloadString = `${value}:${timestamp}`;
      const checksum = crypto
        .createHash('sha256')
        .update(payloadString)
        .digest('hex');

      return {
        value,
        timestamp,
        checksum,
      };
    } catch (error: any) {
      this.logger.error(`Oracle valuation generation failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate oracle payload');
    }
  }
}