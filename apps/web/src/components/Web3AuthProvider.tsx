"use client";

import { useEffect, useState, createContext, ReactNode } from "react";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { WALLET_CONNECTORS } from "@web3auth/no-modal";

export const Web3AuthContext = createContext<{
  provider: IProvider | null;
  web3auth: Web3Auth | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  provider: null,
  web3auth: null,
  login: async () => {},
  logout: async () => {},
});

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x128",
  rpcTarget: process.env.NEXT_PUBLIC_HEDERA_RPC_URL!,
  displayName: "Hedera Testnet",
  blockExplorerUrl: "https://hashscan.io/testnet",
  ticker: "HBAR",
  tickerName: "Hedera",
};

export default function Web3AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });
        const web3authInstance = new Web3Auth({
          clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
          web3AuthNetwork: "sapphire_devnet",
          privateKeyProvider: privateKeyProvider as unknown as never,
        });

        await web3authInstance.init();
        setProvider(web3authInstance.connection?.ethereumProvider ?? null);
        setWeb3auth(web3authInstance);
      } catch (error) {
        console.error("Web3Auth Initialization Error:", error);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3auth) return;
    const connection = await web3auth.connectTo(WALLET_CONNECTORS.AUTH);
    setProvider(connection?.ethereumProvider ?? null);
  };

  const logout = async () => {
    if (!web3auth) return;
    await web3auth.logout();
    setProvider(null);
  };

  return (
    <Web3AuthContext.Provider value={{ provider, web3auth, login, logout }}>
      {children}
    </Web3AuthContext.Provider>
  );
}
