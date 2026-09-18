import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // MUST dynamically bind to the PORT environment variable provided by Cloud Run
  const port = process.env.PORT || configService.get<number>('port') || 8080;
  
  app.setGlobalPrefix('api/v1');
  await app.listen(port, '0.0.0.0'); // MUST bind to 0.0.0.0 in Cloud Run, not localhost
}
bootstrap();