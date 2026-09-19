"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { BrowserProvider } from "ethers";
import { Web3AuthContext } from "../components/Web3AuthProvider";

interface InvestorProfile {
  id: string;
  email: string;
  fullName: string;
  accreditationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  walletAddress: string | null;
  isWhitelisted: boolean;
}

export default function HomePage() {
  const { provider, login, logout, idToken, userAddress } =
    useContext(Web3AuthContext);
  const [address, setAddress] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  useEffect(() => {
    const syncWalletWithBackend = async () => {
      if (provider && idToken) {
        try {
          setSyncStatus("Fetching wallet configuration...");
          const ethersProvider = new BrowserProvider(provider);
          const signer = await ethersProvider.getSigner();
          const derivedAddress = await signer.getAddress();
          setAddress(derivedAddress);

          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          if (apiUrl) {
            setSyncStatus("Synchronizing identity with MeatSoko API...");

            // 1. Attempt onboarding if new user
            const onboardRes = await fetch(`${apiUrl}/investors/onboard`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                fullName: "Kali Admin",
                entityType: "INDIVIDUAL",
                countryIso: "KE",
                walletAddressEvm: derivedAddress,
                walletType: "EMBEDDED",
              }),
            });

            // 2. Fetch current investor profile & KYC status
            const profileRes = await fetch(`${apiUrl}/investors/me`, {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            });

            if (profileRes.ok) {
              const profileData = await profileRes.json();
              setProfile(profileData);
              setSyncStatus("Profile synchronized securely.");
            } else if (onboardRes.status === 409) {
              setSyncStatus("Profile synchronized (already registered).");
            } else {
              setSyncStatus("Wallet connected.");
            }
          }
        } catch (error: any) {
          console.error("Backend Sync Error:", error);
          setSyncStatus(
            error?.message || "Failed to sync wallet with backend.",
          );
        }
      } else {
        setAddress(null);
        setProfile(null);
        setSyncStatus("");
        setPrivateKey(null);
        setShowPrivateKey(false);
      }
    };

    syncWalletWithBackend();
  }, [provider, idToken]);

  const handleRevealPrivateKey = async () => {
    if (showPrivateKey) {
      setShowPrivateKey(false);
      return;
    }

    if (!provider) return;

    try {
      // In Web3Auth with Ethereum provider, eth_private_key returns the private key
      const key = (await provider.request({
        method: "eth_private_key",
      })) as string;
      setPrivateKey(key);
      setShowPrivateKey(true);
    } catch (err) {
      console.error("Failed to retrieve private key:", err);
      alert(
        "Unable to export private key directly. Please use Web3Auth recovery.",
      );
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleCopyKey = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const accreditationStatus = profile?.accreditationStatus || "UNVERIFIED";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
        <h1 className="text-3xl font-bold mb-2 text-slate-800">MeatSoko</h1>
        <p className="text-slate-500 mb-6">
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
          <div className="space-y-5">
            {/* Connection & KYC Status Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-left">
                <div className="text-xs text-slate-400 font-semibold uppercase">
                  KYC Status
                </div>
                <div className="text-sm font-bold mt-0.5">
                  {accreditationStatus === "VERIFIED" && (
                    <span className="text-emerald-600">Verified</span>
                  )}
                  {accreditationStatus === "PENDING" && (
                    <span className="text-amber-600">Under Review</span>
                  )}
                  {accreditationStatus === "UNVERIFIED" && (
                    <span className="text-slate-500">Not Submitted</span>
                  )}
                  {accreditationStatus === "REJECTED" && (
                    <span className="text-red-600">Rejected</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Connected
                </span>
              </div>
            </div>

            {/* Wallet Address Section */}
            <div className="text-left bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Hedera EVM Address
                </label>
                <button
                  onClick={handleCopyAddress}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {copiedAddress ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="bg-white p-2.5 rounded-lg text-xs text-slate-700 font-mono break-all border border-slate-200">
                {address || userAddress || "Deriving address..."}
              </div>
              {address && (
                <div className="mt-2 text-right">
                  <a
                    href={`https://hashscan.io/testnet/account/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center"
                  >
                    View on HashScan Explorer ↗
                  </a>
                </div>
              )}
            </div>

            {/* Export Private Key (Wallet Access) */}
            <div className="text-left bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-700">
                    Wallet Credentials
                  </div>
                  <div className="text-xs text-slate-400">
                    Export to MetaMask, Rabby, or HashPack
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRevealPrivateKey}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition"
                >
                  {showPrivateKey ? "Hide Key" : "Reveal Key"}
                </button>
              </div>

              {showPrivateKey && privateKey && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-red-600 font-semibold">
                      Private Key (Never share this!)
                    </span>
                    <button
                      onClick={handleCopyKey}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {copiedKey ? "Copied!" : "Copy Key"}
                    </button>
                  </div>
                  <div className="bg-red-50 p-2 rounded text-xs font-mono text-red-900 break-all border border-red-200">
                    {privateKey}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Import this key into MetaMask or HashPack to manage your
                    wallet directly.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons Based on Status */}
            <div className="pt-2 space-y-3">
              {accreditationStatus === "VERIFIED" && (
                <Link href="/invest" className="w-full inline-block">
                  <button className="w-full bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-emerald-700 transition shadow-sm">
                    Proceed to Invest in $MEAT
                  </button>
                </Link>
              )}

              {accreditationStatus === "PENDING" && (
                <>
                  <Link href="/invest" className="w-full inline-block">
                    <button className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition shadow-sm">
                      View Investment Offering
                    </button>
                  </Link>
                  <p className="text-xs text-amber-600">
                    Your KYC is under review. Token allocation will be finalized
                    upon verification.
                  </p>
                </>
              )}

              {(accreditationStatus === "UNVERIFIED" ||
                accreditationStatus === "REJECTED") && (
                <Link href="/kyc" className="w-full inline-block">
                  <button className="w-full bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl hover:bg-slate-900 transition shadow-sm">
                    {accreditationStatus === "REJECTED"
                      ? "Re-submit KYC Documents"
                      : "Proceed to KYC"}
                  </button>
                </Link>
              )}

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
