import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/compliance')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('COMPLIANCE_OFFICER') // Enforces strict Role-Based Access Control
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('kyc-verifications')
  async listPendingKyc() {
    return this.complianceService.getPendingKycApplications();
  }

  @Post('kyc-verifications/:id/approve')
  async approveKyc(@Param('id') id: string, @Req() req: any) {
    const adminUid = req.user.uid; 
    return this.complianceService.approveKyc(id, adminUid);
  }
  @Post('kyc-verifications/:id/reject')
  async rejectKyc(
    @Param('id') id: string, 
    @Body() body: { rejectionReason: string }, 
    @Req() req: any
  ) {
    return this.complianceService.rejectKyc(id, req.user.uid, body.rejectionReason);
  }
}