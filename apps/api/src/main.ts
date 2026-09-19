import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  // Add the rawBody configuration here
  const app = await NestFactory.create(AppModule, { rawBody: true });
  
  const configService = app.get(ConfigService);
  const port = process.env.PORT || configService.get<number>('port') || 8080;
  
  app.setGlobalPrefix('api/v1');
  await app.listen(port, '0.0.0.0');
}
bootstrap();