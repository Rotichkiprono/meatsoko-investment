import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export default async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const runtimeConfig: Record<string, string | undefined> = {};

  if (isProduction && process.env.GCP_PROJECT_ID) {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GCP_PROJECT_ID;

    const fetchSecret = async (secretId: string) => {
      try {
        const [version] = await client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${secretId}/versions/latest`,
        });
        return version.payload?.data?.toString() || '';
      } catch (error) {
        console.warn(`Could not fetch secret ${secretId} from GCP Secret Manager, falling back to process.env`);
        return process.env[secretId] || '';
      }
    };

    runtimeConfig.PAYSTACK_SECRET_KEY = await fetchSecret('PAYSTACK_SECRET_KEY');
    runtimeConfig.HEDERA_OPERATOR_PRIVATE_KEY = await fetchSecret('HEDERA_OPERATOR_PRIVATE_KEY');
    runtimeConfig.SUPABASE_SERVICE_ROLE_KEY = await fetchSecret('SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    port: parseInt(process.env.PORT || '8080', 10),
    environment: process.env.NODE_ENV || 'development',
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      serviceRoleKey: runtimeConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    gcp: {
      projectId: process.env.GCP_PROJECT_ID,
      storageBucket: process.env.GCP_STORAGE_KYC_BUCKET,
    },
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    paystack: {
      secretKey: runtimeConfig.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY,
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    },
    hedera: {
      network: process.env.HEDERA_NETWORK || 'testnet',
      rpcUrl: process.env.HEDERA_JSON_RPC_URL || 'https://testnet.hashio.io/api',
      operatorAccountId: process.env.HEDERA_OPERATOR_ACCOUNT_ID,
      operatorEvmAddress: process.env.HEDERA_OPERATOR_EVM_ADDRESS,
      operatorPrivateKey: runtimeConfig.HEDERA_OPERATOR_PRIVATE_KEY || process.env.HEDERA_OPERATOR_PRIVATE_KEY,
      securityTokenAddress: process.env.MEAT_SECURITY_TOKEN_ADDRESS,
      kycWhitelistAddress: process.env.ERC3643_KYC_WHITELIST_ADDRESS,
    },
  };
};