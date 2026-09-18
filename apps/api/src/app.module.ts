import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { InvestorModule } from './modules/investor/investor.module';
import { KycModule } from './modules/kyc/kyc.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { TokenizationModule } from './modules/tokenization/tokenization.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env', '../.env'],
    }),
    AuthModule,
    InvestorModule,
    KycModule,
    ComplianceModule,
    TokenizationModule,
    SettlementModule,
    SubscriptionModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
  
})
export class AppModule {}