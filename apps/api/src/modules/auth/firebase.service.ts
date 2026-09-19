import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private configService: ConfigService) {}

  isInitialized(): boolean {
    return this.initialized;
  }

  onModuleInit() {
    if (getApps().length > 0) {
      this.initialized = true;
      return;
    }

    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n",
      );

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
          "Missing Firebase configuration: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are required.",
        );
      }

      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      this.initialized = true;
      this.logger.log("Firebase Admin SDK initialized successfully");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown Firebase initialization error";
      this.logger.error("Failed to initialize Firebase Admin SDK", message);
    }
  }
}
