// apps/api/src/modules/settlement/webhook.controller.ts
import {
  Controller,
  Post,
  HttpCode,
  Req,
  Headers,
  RawBodyRequest,
} from "@nestjs/common";
import { Request } from "express";
import { WebhookService } from "./webhook.service";

@Controller("webhook")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(200)
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>, // <-- Use the native NestJS RawBodyRequest interface
    // Removed @Res() res: Response
    @Headers("x-paystack-signature") signature: string,
  ) {
    const rawBody = req.rawBody; // This will now successfully populate because we set rawBody: true in main.ts

    if (!rawBody) {
      throw new Error("Raw body is missing for webhook validation");
    }

    await (this.webhookService as any).processWebhook(rawBody, signature);

    // NestJS will automatically send this with a 200 OK because we removed @Res()
    return { status: "success" };
  }
}
