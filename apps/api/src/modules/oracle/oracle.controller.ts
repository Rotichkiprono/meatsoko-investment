import { Controller, Get, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { OracleService, OracleValuationPayload } from './oracle.service';
import { Request } from 'express';

@Controller('oracle')
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Get('valuation')
  async getValuation(@Req() req: Request): Promise<OracleValuationPayload> {
    // Basic API Key validation for Chainlink DON requests
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.ORACLE_API_KEY; 

    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      throw new UnauthorizedException('Invalid Oracle API Key');
    }

    return this.oracleService.generateValuationPayload();
  }
}