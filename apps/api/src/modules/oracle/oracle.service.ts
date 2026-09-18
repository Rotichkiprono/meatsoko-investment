import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

export interface OracleValuationPayload {
  timestamp: number;
  baseCurrency: string;
  netAssetValue: number;
  assetPoolTotal: number;
  activeInvoiceCount: number;
  dataChecksum?: string;
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

      // Base payload required by the Chainlink Functions consumer contract
      const payload: OracleValuationPayload = {
        timestamp: Math.floor(Date.now() / 1000),
        baseCurrency: 'USD',
        netAssetValue: Number(product.target_valuation_cents),
        assetPoolTotal: Number(product.target_valuation_cents), // Simplified for Phase 4 scaffold
        activeInvoiceCount: 14, // Fixed scaffold value as per spec
      };

      // Generate deterministic SHA-256 checksum of the exact payload string
      const payloadString = JSON.stringify({
        timestamp: payload.timestamp,
        baseCurrency: payload.baseCurrency,
        netAssetValue: payload.netAssetValue,
        assetPoolTotal: payload.assetPoolTotal,
        activeInvoiceCount: payload.activeInvoiceCount,
      });

      payload.dataChecksum = crypto
        .createHash('sha256')
        .update(payloadString)
        .digest('hex');

      return payload;
    } catch (error: any) {
      this.logger.error(`Oracle valuation generation failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate oracle payload');
    }
  }
}