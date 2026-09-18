import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { InvestorModule } from './modules/investor/investor.module';
import { KycModule } from './modules/kyc/kyc.module';
import { ComplianceModule } from './modules/compliance/compliance.module';

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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}