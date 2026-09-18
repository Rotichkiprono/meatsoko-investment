import { Controller, Post, Req, Res, Headers, UnauthorizedException, HttpCode } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

interface RawBodyRequest extends Request {
  rawBody: Buffer;
}

@Controller('webhooks/paystack')
export class WebhookController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  @HttpCode(200)
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // 1. Acknowledge immediately to prevent Paystack timeouts
    res.status(200).send('Webhook received');

    // 2. Extract the raw buffer saved by NestJS
    const rawBody = req.rawBody; 
    if (!rawBody || !signature) {
      throw new UnauthorizedException('Missing payload or signature');
    }

    // 3. Verify HMAC-SHA512 signature against the raw bytes
    const secretKey = this.configService.get<string>('secrets.paystack');
    const expectedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');

    // Use constant-time comparison to prevent timing attacks
    const isVerified = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );

    if (!isVerified) {
      console.error('Paystack webhook signature verification failed');
      return; 
    }

    // 4. Parse the validated body safely
    const payload = JSON.parse(rawBody.toString('utf8'));

    // 5. Process specific events asynchronously
    if (payload.event === 'charge.success') {
      await this.processSuccessfulCharge(payload.data);
    }
  }

  private async processSuccessfulCharge(data: any) {
    const paymentReference = data.reference;
    const amountCents = data.amount;
    const metadata = data.metadata; // Contains subscriptionId and investorId

    // TODO: Acquire Redis lock for idempotency using paymentReference
    // TODO: Update Supabase subscriptions.status = 'FUNDS_RECEIVED'
    // TODO: Publish 'investment.funding.completed' event to GCP Pub/Sub
    
    console.log(`Charge successful for reference: ${paymentReference}`);
  }
}