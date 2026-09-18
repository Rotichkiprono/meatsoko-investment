import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';

@Controller('subscriptions')
@UseGuards(FirebaseAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('checkout')
  async initiateCheckout(@Body() body: { tokenQuantity: number }, @Req() req: any) {
    return this.subscriptionService.initializeCheckout(req.user.uid, body.tokenQuantity);
  }
}