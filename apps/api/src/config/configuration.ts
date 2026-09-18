import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export default async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const runtimeConfig: Record<string, string | undefined> = {};

  if (isProduction) {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GCP_PROJECT_ID;

    const fetchSecret = async (secretId: string) => {
      try {
        const [version] = await client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${secretId}/versions/latest`,
        });
        return version.payload?.data?.toString() || '';
      } catch (error) {
        console.error(`Failed to fetch secret: ${secretId}`);
        throw error;
      }
    };

    // Dynamically pull highly privileged keys for execution
    runtimeConfig.PAYSTACK_SECRET_KEY = await fetchSecret('PAYSTACK_SECRET_KEY');
    runtimeConfig.HEDERA_OPERATOR_PRIVATE_KEY = await fetchSecret('HEDERA_OPERATOR_PRIVATE_KEY');
    runtimeConfig.SUPABASE_SERVICE_ROLE_KEY = await fetchSecret('SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    port: parseInt(process.env.PORT || '8080', 10),
    environment: process.env.NODE_ENV || 'development',
    gcp: {
      projectId: process.env.GCP_PROJECT_ID,
      storageBucket: process.env.GCP_STORAGE_KYC_BUCKET,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    secrets: {
      paystack: runtimeConfig.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY,
      hedera: runtimeConfig.HEDERA_OPERATOR_PRIVATE_KEY || process.env.HEDERA_OPERATOR_PRIVATE_KEY,
      supabase: runtimeConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  };
};