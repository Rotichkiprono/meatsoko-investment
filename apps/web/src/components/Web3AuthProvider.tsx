"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

// Connects to the Hedera Testnet via Hashio RPC
const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x128", // Hedera Testnet Chain ID (296)
  rpcTarget: "https://testnet.hashio.io/api",
  displayName: "Hedera Testnet",
  blockExplorerUrl: "https://hashscan.io/testnet",
  ticker: "HBAR",
  tickerName: "Hedera",
};

interface AuthContextType {
  provider: IProvider | null;
  walletAddress: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const Web3AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const privateKeyProvider = new EthereumPrivateKeyProvider({ config: { chainConfig } });
        
        const web3authInstance = new Web3Auth({
          clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
          web3AuthNetwork: "sapphire_devnet",
          privateKeyProvider,
        });

        // Initialize with custom JWT verifier config mapping to Firebase
        await web3authInstance.initModal();
        setWeb3auth(web3authInstance);
        
        if (web3authInstance.provider) {
          setProvider(web3authInstance.provider);
          fetchAddress(web3authInstance.provider);
        }
      } catch (error) {
        console.error("Web3Auth initialization failed:", error);
      }
    };

    init();
  }, []);

  const fetchAddress = async (ethProvider: IProvider) => {
    // Utilize ethers.js or native RPC calls to fetch the embedded 0x address
    const accounts = await ethProvider.request<string[]>({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      setWalletAddress(accounts[0]);
    }
  };

  const login = async () => {
    if (!web3auth) return;
    const web3authProvider = await web3auth.connect();
    if (web3authProvider) {
      setProvider(web3authProvider);
      fetchAddress(web3authProvider);
    }
  };

  const logout = async () => {
    if (!web3auth) return;
    await web3auth.logout();
    setProvider(null);
    setWalletAddress(null);
  };

  return (
    <AuthContext.Provider value={{ provider, walletAddress, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within Web3AuthProvider");
  return context;
};