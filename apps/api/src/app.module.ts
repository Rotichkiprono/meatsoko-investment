import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '../../.env',
    }),
    AuthModule,
    KycModule,
    // WebhookModule will be added here subsequently
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}