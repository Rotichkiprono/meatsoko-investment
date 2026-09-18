import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from '@google-cloud/pubsub';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private redis: Redis;
  private pubsub: PubSub;
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
    });

    this.pubsub = new PubSub({
      projectId: this.configService.get<string>('gcp.projectId'),
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      this.configService.get<string>('secrets.supabase')
    );
  }

  async processSuccessfulCharge(data: any): Promise<void> {
    const paymentReference = data.reference;
    const { subscriptionId, investorId } = data.metadata;
    const amountCents = data.amount;

    // 1. Acquire Distributed Lock
    const lockKey = `lock:paystack:${paymentReference}`;
    const acquired = await this.redis.set(lockKey, 'locked', 'EX', 60, 'NX');
    
    if (!acquired) {
      this.logger.warn(`Duplicate webhook detected for reference: ${paymentReference}. Ignoring.`);
      return;
    }

    try {
      // 2. Update Supabase System of Record
      const { error } = await this.supabase
        .from('subscriptions')
        .update({ status: 'FUNDS_RECEIVED', updated_at: new Date().toISOString() })
        .eq('id', subscriptionId)
        .eq('status', 'SUBMITTED');

      if (error) throw new Error(`Supabase update failed: ${error.message}`);

      // 3. Emit Async Event for Token Dispatch
      const topic = this.pubsub.topic('investment.funding.completed');
      const payload = JSON.stringify({
        subscriptionId,
        investorId,
        amountCents,
        timestamp: Math.floor(Date.now() / 1000),
      });

      await topic.publishMessage({ data: Buffer.from(payload) });
      this.logger.log(`Funding event published for subscription: ${subscriptionId}`);

    } catch (error) {
      // Release lock on failure so subsequent retries can process
      await this.redis.del(lockKey);
      this.logger.error(`Failed to process charge ${paymentReference}: ${error.message}`);
      throw error;
    }
  }
}