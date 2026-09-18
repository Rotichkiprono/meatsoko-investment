import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { OracleService, OracleValuationPayload } from './oracle.service';

@Controller('oracle')
export class OracleController {
  constructor(
    private readonly oracleService: OracleService,
    private readonly configService: ConfigService
  ) {}

  @Get('valuation')
  async getValuation(@Req() req: Request): Promise<OracleValuationPayload> {
    const authHeader = req.headers.authorization;
    const expectedKey = this.configService.get<string>('oracle.apiKey');

    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      throw new UnauthorizedException('Invalid Oracle API Key');
    }
    
    return this.oracleService.generateValuationPayload();
  }
}