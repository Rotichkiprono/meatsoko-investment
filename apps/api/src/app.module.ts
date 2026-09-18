import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '../../.env', // Point to the monorepo root environment file
    }),
    // Future imports: AuthModule, TokenizationModule, WebhookModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}