"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { BrowserProvider } from "ethers";
import { Web3AuthContext } from "../components/Web3AuthProvider";

export default function HomePage() {
  const { provider, login, logout, idToken } = useContext(Web3AuthContext);
  const [address, setAddress] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("");

  useEffect(() => {
    const syncWalletWithBackend = async () => {
      if (provider && idToken) {
        try {
          setSyncStatus("Fetching wallet configuration...");
          const ethersProvider = new BrowserProvider(provider);
          const signer = await ethersProvider.getSigner();
          const userAddress = await signer.getAddress();
          setAddress(userAddress);

          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          if (apiUrl) {
            setSyncStatus("Synchronizing identity with NestJS API...");
            const response = await fetch(`${apiUrl}/investors/onboard`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                fullName: "Kali Admin",
                entityType: "INDIVIDUAL",
                countryIso: "KE",
                walletAddressEvm: userAddress,
                walletType: "EMBEDDED",
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              // If investor already exists, treat as successfully synced
              if (response.status === 409) {
                setSyncStatus("Profile synchronized (already registered).");
                return;
              }
              console.error(
                "Backend Rejection Data:",
                response.status,
                errorText,
              );
              setSyncStatus(`API Error: ${response.status} - ${errorText}`);
              throw new Error(
                `API Sync Failed: ${response.status} - ${errorText}`,
              );
            }

            setSyncStatus("Profile synchronized securely.");
          } else {
            setSyncStatus(
              "Wallet connected. Backend sync is not configured yet.",
            );
          }
        } catch (error: any) {
          console.error("Backend Sync Error:", error);
          setSyncStatus(
            error?.message || "Failed to sync wallet with backend.",
          );
        }
      } else {
        setAddress(null);
        setSyncStatus("");
      }
    };

    syncWalletWithBackend();
  }, [provider, idToken]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
        <h1 className="text-3xl font-bold mb-2 text-slate-800">MeatSoko</h1>
        <p className="text-slate-500 mb-8">
          Tokenized Agricultural Assets on Hedera
        </p>

        {!provider ? (
          <button
            onClick={login}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition shadow-sm"
          >
            Sign In with Google
          </button>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">
              Web3 Wallet Successfully Connected
            </div>

            <div className="text-left">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Your EVM Address
              </label>
              <div className="mt-1 bg-slate-100 p-3 rounded-lg text-sm text-slate-700 font-mono break-all">
                {address || "Deriving address..."}
              </div>
            </div>

            <div className="text-left">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </label>
              <div className="mt-1 text-sm font-medium text-slate-600">
                {syncStatus}
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Link href="/kyc" className="w-full inline-block">
                <button className="w-full bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl hover:bg-slate-900 transition shadow-sm">
                  Proceed to KYC
                </button>
              </Link>
              <button
                onClick={logout}
                className="w-full bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
