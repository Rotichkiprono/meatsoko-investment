import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Crucial: Instructs NestJS to store the raw request body buffer on the request object
    rawBody: true, 
  });
  
  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT || 8080);
}
bootstrap();