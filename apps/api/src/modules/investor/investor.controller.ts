import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { InvestorService } from './investor.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';

@Controller('investors')
@UseGuards(FirebaseAuthGuard)
export class InvestorController {
  constructor(private readonly investorService: InvestorService) {}

  @Post('onboard')
  async onboard(@Body() body: any, @Req() req: any) {
    const { uid, email } = req.user;
    return this.investorService.onboardInvestor(
      uid,
      email,
      body.fullName,
      body.entityType,
      body.countryIso,
      body.walletAddressEvm,
      body.walletType
    );
  }
}