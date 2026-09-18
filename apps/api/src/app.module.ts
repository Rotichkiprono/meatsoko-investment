import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { InvestorModule } from './modules/investor/investor.module';
import { KycModule } from './modules/kyc/kyc.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { TokenizationModule } from './modules/tokenization/tokenization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '../../.env',
    }),
    AuthModule,
    InvestorModule,
    KycModule,
    ComplianceModule,
    TokenizationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}