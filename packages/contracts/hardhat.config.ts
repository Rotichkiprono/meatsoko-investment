import { HardhatUserConfig } from "hardhat/config";
/// <reference types="node" />
/// <reference types="@nomicfoundation/hardhat-toolbox" />
import * as dotenv from "dotenv";
import * as path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const privateKey = process.env.HEDERA_OPERATOR_PRIVATE_KEY?.trim();

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  defaultNetwork: "hederaTestnet",
  networks: {
    hardhat: {},
    hederaTestnet: {
      url: process.env.HEDERA_JSON_RPC_URL?.trim() || "https://testnet.hashio.io/api",
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;