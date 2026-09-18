import { Controller, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { KycService } from './kyc.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';

@Controller('kyc')
@UseGuards(FirebaseAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('upload-url')
  async getSignedUrl(
    @Body() body: { fileType: string; documentType: string },
    @Req() req: any 
  ) {
    // req.user is guaranteed to exist and be verified by the Guard
    const investorId = req.user.uid; 

    if (!body.fileType || !body.documentType) {
      throw new BadRequestException('fileType and documentType are required');
    }

    return this.kycService.generateUploadUrl(investorId, body.fileType, body.documentType);
  }
}