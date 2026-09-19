import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";
import { TokenizationModule } from "../tokenization/tokenization.module";

@Module({
  imports: [TokenizationModule],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class SettlementModule {}
