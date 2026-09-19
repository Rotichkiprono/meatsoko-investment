import { Controller, Post, Get, Body, Req, UseGuards } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { CheckoutDto } from "./dto/checkout.dto";

@Controller(["subscriptions", "subscription"])
@UseGuards(FirebaseAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post("checkout")
  async initiateCheckout(@Body() dto: CheckoutDto, @Req() req: any) {
    return this.subscriptionService.initializeCheckout(
      req.user.uid,
      dto.tokenQuantity,
      dto.callbackUrl,
    );
  }

  @Get("my")
  async getMySubscriptions(@Req() req: any) {
    return this.subscriptionService.getMySubscriptions(req.user.uid);
  }

  @Post("verify-payment")
  async verifyPayment(@Body("reference") reference: string, @Req() req: any) {
    return this.subscriptionService.verifyAndSettlePayment(
      reference,
      req.user.uid,
    );
  }
}
