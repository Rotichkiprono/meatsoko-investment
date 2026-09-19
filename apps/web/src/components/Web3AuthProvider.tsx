"use client";

import { useEffect, useState, createContext, ReactNode } from "react";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, type IProvider } from "@web3auth/base";
import { WALLET_CONNECTORS, AUTH_CONNECTION } from "@web3auth/no-modal";
import { signInWithPopup, type UserCredential, signOut } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

export const Web3AuthContext = createContext<{
  provider: IProvider | null;
  web3auth: Web3Auth | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  idToken: string | null;
}>({
  provider: null,
  web3auth: null,
  login: async () => {},
  logout: async () => {},
  idToken: null,
});

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x128",
  rpcTarget: process.env.NEXT_PUBLIC_HEDERA_RPC_URL!,
  displayName: "Hedera Testnet",
  blockExplorerUrl: "https://hashscan.io/testnet",
  ticker: "HBAR",
  tickerName: "Hedera",
  logo: "https://cryptologos.cc/logos/hedera-hbar-logo.png",
};

export default function Web3AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const web3authInstance = new Web3Auth({
          clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
          web3AuthNetwork: "sapphire_devnet",
          chains: [chainConfig],
          uiConfig: {
            uxMode: "popup",
          },
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

    try {
      const userCredential: UserCredential = await signInWithPopup(
        auth,
        googleProvider,
      );
      const firebaseIdToken = await userCredential.user.getIdToken(true);
      setIdToken(firebaseIdToken);

      const connection = await web3auth.connectTo(WALLET_CONNECTORS.AUTH, {
        authConnection: AUTH_CONNECTION.CUSTOM,
        authConnectionId: "meatsoko-firebase",
        idToken: firebaseIdToken,
        extraLoginOptions: {
          verifierIdField: "sub",
        },
      });

      setProvider(connection?.ethereumProvider ?? null);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    if (!web3auth) return;
    await web3auth.logout();
    await signOut(auth);
    setProvider(null);
    setIdToken(null);
  };

  return (
    <Web3AuthContext.Provider
      value={{ provider, web3auth, login, logout, idToken }}
    >
      {children}
    </Web3AuthContext.Provider>
  );
}
