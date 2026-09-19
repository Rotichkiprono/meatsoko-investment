import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
import { KycService } from "./kyc.service";
import { FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { GenerateUploadUrlDto, SubmitKycDto } from "./dto/kyc-upload.dto";

@Controller("kyc")
@UseGuards(FirebaseAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post("upload-url")
  async generateUploadUrl(@Body() dto: GenerateUploadUrlDto, @Req() req: any) {
    const userId = req.user.uid;
    return this.kycService.generateSignedUploadUrl(
      userId,
      dto.documentType,
      dto.fileExtension,
    );
  }

  @Post("submit")
  async submitKyc(@Body() dto: SubmitKycDto, @Req() req: any) {
    return this.kycService.submitKyc(
      req.user.uid,
      dto.documentType,
      dto.storagePath,
    );
  }
}
