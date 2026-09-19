import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  // 1. Enable rawBody parsing natively in the Express adapter
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // 2. Enable CORS so the Next.js frontend can communicate with the API
  app.enableCors({
    origin: "*", // In production, replace with your exact Next.js domain (e.g. 'https://meatsoko.com')
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  // 3. Enforce strict DTO validation globally across all controllers
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 4. Set the global prefix for all API routes
  const port = process.env.PORT || configService.get<number>("port") || 8080;

  app.setGlobalPrefix("api/v1");
  await app.listen(port, "0.0.0.0");
}
bootstrap();
