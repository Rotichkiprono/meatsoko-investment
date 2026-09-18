import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Traverse up to read the monorepo root environment
dotenv.config({ path: '../../.env' });

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hederaTestnet: {
      url: process.env.HEDERA_JSON_RPC_URL || "https://testnet.hashio.io/api",
      accounts: process.env.HEDERA_OPERATOR_PRIVATE_KEY 
        ? [process.env.HEDERA_OPERATOR_PRIVATE_KEY] 
        : [],
    }
  }
};

export default config;