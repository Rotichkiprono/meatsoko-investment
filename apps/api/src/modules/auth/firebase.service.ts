import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  isInitialized(): boolean {
    return this.initialized;
  }

  onModuleInit() {
    if (getApps().length > 0) {
      this.initialized = true;
      return;
    }

    const projectId =
      this.configService.get<string>("FIREBASE_PROJECT_ID") ||
      this.configService.get<string>("gcp.projectId");
    const clientEmail = this.configService.get<string>("FIREBASE_CLIENT_EMAIL");
    let privateKey = this.configService.get<string>("FIREBASE_PRIVATE_KEY");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Firebase Admin SDK credentials are missing from the configuration.",
      );
    }

    // CRITICAL: Restore actual newlines from Secret Manager escaped strings
    privateKey = privateKey.replace(/\\n/g, "\n");

    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      this.initialized = true;
      this.logger.log("Firebase Admin SDK initialized successfully");
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize Firebase Admin SDK: ${error.message}`,
      );
      throw error;
    }
  }
}
