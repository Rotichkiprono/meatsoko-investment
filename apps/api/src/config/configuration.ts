export default () => ({
  port: parseInt(process.env.PORT || '8080', 10),
  environment: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
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
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  },
  hedera: {
    network: process.env.HEDERA_NETWORK || 'testnet',
    rpcUrl: process.env.HEDERA_JSON_RPC_URL || 'https://testnet.hashio.io/api',
    operatorAccountId: process.env.HEDERA_OPERATOR_ACCOUNT_ID,
    operatorEvmAddress: process.env.HEDERA_OPERATOR_EVM_ADDRESS,
    operatorPrivateKey: process.env.HEDERA_OPERATOR_PRIVATE_KEY,
    securityTokenAddress: process.env.MEAT_SECURITY_TOKEN_ADDRESS,
    kycWhitelistAddress: process.env.ERC3643_KYC_WHITELIST_ADDRESS,
  },
  oracle: {
    apiKey: process.env.ORACLE_API_KEY || 'development_key',
  },
});