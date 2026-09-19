"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { BrowserProvider } from "ethers";
import { Web3AuthContext } from "../components/Web3AuthProvider";
import { auth } from "../lib/firebase";

interface InvestorProfile {
  id: string;
  email: string;
  fullName: string;
  accreditationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  walletAddress: string | null;
  hederaAccountId: string | null;
  isWhitelisted: boolean;
}

export default function HomePage() {
  const { provider, web3auth, login, logout, idToken, userAddress } =
    useContext(Web3AuthContext);
  const [address, setAddress] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
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

            const resolvedName =
              auth.currentUser?.displayName ||
              auth.currentUser?.email?.split("@")[0] ||
              "Investor";

            // 1. Attempt onboarding / wallet binding
            const onboardRes = await fetch(`${apiUrl}/investors/onboard`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                fullName: resolvedName,
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

    try {
      let key: string | null = null;

      // 1. Try web3auth.provider (Web3Auth SDK internal provider)
      if ((web3auth as any)?.provider) {
        try {
          key = (await (web3auth as any).provider.request({
            method: "eth_private_key",
          })) as string;
        } catch {
          try {
            key = (await (web3auth as any).provider.request({
              method: "private_key",
            })) as string;
          } catch {
            // continue
          }
        }
      }

      // 2. Try connected ethereumProvider
      if (!key && provider) {
        try {
          key = (await (provider as any).request({
            method: "private_key",
          })) as string;
        } catch {
          try {
            key = (await (provider as any).request({
              method: "eth_private_key",
            })) as string;
          } catch {
            // continue
          }
        }
      }

      if (key) {
        const formatted = key.startsWith("0x") ? key : `0x${key}`;
        setPrivateKey(formatted);
        setShowPrivateKey(true);
      } else {
        alert(
          "Your wallet is an MPC non-custodial wallet secured by your Google account. To sign into your wallet on another device or browser, simply sign in with the same Google account.",
        );
      }
    } catch (err) {
      console.error("Failed to retrieve private key:", err);
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleCopyAccount = () => {
    const accountId = profile?.hederaAccountId;
    if (accountId) {
      navigator.clipboard.writeText(accountId);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
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
  const hederaId = profile?.hederaAccountId;

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

            {/* Hedera Account ID Section */}
            {hederaId && (
              <div className="text-left bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Hedera Account ID
                  </span>
                  <button
                    onClick={handleCopyAccount}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {copiedAccount ? "Copied!" : "Copy ID"}
                  </button>
                </div>
                <div className="text-lg font-mono font-bold text-blue-950">
                  {hederaId}
                </div>
                <p className="text-[11px] text-blue-600 mt-1">
                  Active Hedera testnet account. Use this ID in Hedera
                  Tokenization Studio.
                </p>
              </div>
            )}

            {/* EVM Address Section */}
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
              {hederaId ? (
                <div className="mt-2 text-right">
                  <a
                    href={`https://hashscan.io/testnet/account/${hederaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center"
                  >
                    View Account {hederaId} on HashScan ↗
                  </a>
                </div>
              ) : address ? (
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
              ) : null}
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
              <Link href="/portfolio" className="w-full inline-block">
                <button className="w-full bg-slate-100 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-200 transition">
                  View Portfolio & Transactions
                </button>
              </Link>

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
