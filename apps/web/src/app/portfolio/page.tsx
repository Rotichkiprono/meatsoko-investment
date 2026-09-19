"use client";

import { Suspense, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Web3AuthContext } from "../../components/Web3AuthProvider";
import Link from "next/link";
import { JsonRpcProvider, Contract, formatUnits } from "ethers";

interface SubscriptionItem {
  id: string;
  fiat_amount_cents: number;
  currency: string;
  token_quantity_allocated: string;
  payment_method: string;
  payment_reference: string;
  status: string;
  created_at: string;
  token_allocations?: Array<{
    transaction_hash: string;
    block_number: number;
    execution_status: string;
  }>;
}

interface PortfolioData {
  walletAddress: string | null;
  hederaAccountId: string | null;
  totalTokens: number;
  subscriptions: SubscriptionItem[];
}

const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_MEAT_SECURITY_TOKEN_ADDRESS ||
  "0x563a16534dd5e1a70e362583b6c05468e6656693";

function PortfolioContent() {
  const { idToken, userAddress } = useContext(Web3AuthContext);
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");

  const [data, setData] = useState<PortfolioData | null>(null);
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<string>("");
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedEvm, setCopiedEvm] = useState(false);
  const [addedToken, setAddedToken] = useState(false);

  // 1. Fetch live on-chain balance from Hedera JSON-RPC
  const fetchOnChainBalance = async (address: string) => {
    try {
      const rpcUrl =
        process.env.NEXT_PUBLIC_HEDERA_RPC_URL ||
        "https://testnet.hashio.io/api";
      const provider = new JsonRpcProvider(rpcUrl);
      const tokenContract = new Contract(
        TOKEN_ADDRESS,
        [
          "function balanceOf(address account) view returns (uint256)",
          "function decimals() view returns (uint8)",
        ],
        provider,
      );

      const [rawBal, decimals] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.decimals().catch(() => 4),
      ]);

      const formatted = formatUnits(rawBal, decimals);
      setOnChainBalance(formatted);
    } catch (err) {
      console.error("Failed to read on-chain MEAT balance:", err);
    }
  };

  // 2. Fetch portfolio data and verify payment if reference exists
  useEffect(() => {
    const loadPortfolio = async () => {
      if (!idToken) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // If returning with Paystack payment reference, verify payment synchronously
      if (reference) {
        setVerificationStatus("Verifying payment with Paystack...");
        try {
          const verifyRes = await fetch(
            `${apiUrl}/subscriptions/verify-payment`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ reference }),
            },
          );

          if (verifyRes.ok) {
            const verifyResult = await verifyRes.json();
            setVerificationStatus(
              verifyResult.status === "ALLOCATED"
                ? "Payment verified! Tokens successfully allocated to your wallet."
                : `Payment confirmed! (${verifyResult.message})`,
            );
          } else {
            const err = await verifyRes.json().catch(() => ({}));
            setVerificationStatus(
              `Verification notice: ${err.message || "Payment recorded."}`,
            );
          }
        } catch (e: any) {
          console.error("Verification error:", e);
          setVerificationStatus("Payment recorded.");
        }
      }

      // Fetch user's subscriptions & wallet info
      try {
        const res = await fetch(`${apiUrl}/subscriptions/my`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (res.ok) {
          const result = await res.json();
          setData(result);

          const targetAddress = result.walletAddress || userAddress;
          if (targetAddress) {
            fetchOnChainBalance(targetAddress);
          }
        }
      } catch (err) {
        console.error("Failed to fetch portfolio:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPortfolio();
  }, [idToken, reference, userAddress]);

  const handleCopyAccount = () => {
    if (data?.hederaAccountId) {
      navigator.clipboard.writeText(data.hederaAccountId);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const handleCopyEvm = () => {
    const addr = data?.walletAddress || userAddress;
    if (addr) {
      navigator.clipboard.writeText(addr);
      setCopiedEvm(true);
      setTimeout(() => setCopiedEvm(false), 2000);
    }
  };

  // Add $MEAT token to MetaMask / Wallet automatically with 1 click
  const handleAddTokenToMetaMask = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const wasAdded = await (window as any).ethereum.request({
          method: "wallet_watchAsset",
          params: {
            type: "ERC20",
            options: {
              address: TOKEN_ADDRESS,
              symbol: "MEAT",
              decimals: 4,
              image: "https://cryptologos.cc/logos/hedera-hbar-logo.png",
            },
          },
        });

        if (wasAdded) {
          setAddedToken(true);
          setTimeout(() => setAddedToken(false), 3000);
        }
      } catch (err) {
        console.error("Failed to add token to MetaMask:", err);
      }
    } else {
      alert(
        "MetaMask is not detected. If you use MetaMask, open it in your browser extension to import the MEAT token.",
      );
    }
  };

  const activeAccountId = data?.hederaAccountId || null;
  const activeEvmAddress = data?.walletAddress || userAddress;
  const displayBalance =
    onChainBalance !== null
      ? Number(onChainBalance).toLocaleString()
      : (data?.totalTokens ?? 0).toLocaleString();

  return (
    <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
      {/* Payment Confirmation Alert */}
      {verificationStatus && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left">
          <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-sm">
            <svg
              className="w-5 h-5 text-emerald-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Payment Status</span>
          </div>
          <p className="text-xs text-emerald-700 mt-1">{verificationStatus}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Investor Portfolio
          </h1>
          <p className="text-slate-500 text-xs">
            MeatSoko Tokenized Agricultural Assets
          </p>
        </div>
        <Link href="/invest">
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm">
            + Invest More
          </button>
        </Link>
      </div>

      {/* Holdings & Account Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Token Balance */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                MEAT Token Balance
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                On-Chain
              </span>
            </div>
            <div className="text-3xl font-extrabold text-blue-900 mt-2">
              {displayBalance}{" "}
              <span className="text-base font-semibold">MEAT</span>
            </div>
            <div className="text-xs text-blue-500 mt-1">
              ≈{" "}
              {(
                Number(displayBalance.replace(/,/g, "")) * 5000
              ).toLocaleString()}{" "}
              KES
            </div>
          </div>

          {/* 1-Click Add to MetaMask */}
          <button
            onClick={handleAddTokenToMetaMask}
            className="mt-4 text-xs bg-white hover:bg-blue-50 text-blue-700 font-semibold py-1.5 px-3 rounded-lg border border-blue-200 transition flex items-center justify-center space-x-1 shadow-2xs"
          >
            <span>🦊</span>
            <span>
              {addedToken ? "Token Added to MetaMask!" : "Add MEAT to MetaMask"}
            </span>
          </button>
        </div>

        {/* Hedera Account ID */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Hedera Account ID
              </span>
              {activeAccountId ? (
                <button
                  onClick={handleCopyAccount}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {copiedAccount ? "Copied!" : "Copy"}
                </button>
              ) : (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                  Activating
                </span>
              )}
            </div>
            {activeAccountId ? (
              <div className="text-xl font-bold font-mono text-slate-800 mt-2">
                {activeAccountId}
              </div>
            ) : (
              <div className="text-sm font-semibold text-amber-600 mt-2 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>Pending Activation</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            {activeAccountId
              ? "Active Hedera account. Use this ID in Tokenization Studio allowed list."
              : "Account will be activated with on-chain token association automatically."}
          </p>
        </div>
      </div>

      {/* Wallet Details Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-semibold uppercase">
            Hedera EVM Address
          </span>
          <button
            onClick={handleCopyEvm}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {copiedEvm ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="bg-white p-2.5 rounded-lg text-xs font-mono text-slate-700 break-all border border-slate-200">
          {activeEvmAddress || "Connecting..."}
        </div>
        <div className="text-right pt-1">
          {activeAccountId ? (
            <a
              href={`https://hashscan.io/testnet/account/${activeAccountId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline inline-flex items-center"
            >
              View Account {activeAccountId} on HashScan ↗
            </a>
          ) : activeEvmAddress ? (
            <a
              href={`https://hashscan.io/testnet/account/${activeEvmAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline inline-flex items-center"
            >
              View EVM Address on HashScan ↗
            </a>
          ) : null}
        </div>
      </div>

      {/* Recent Subscriptions & Transactions */}
      <div className="text-left mb-6">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
          Transaction History
        </h2>

        {loading ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Loading transaction history...
          </div>
        ) : !data?.subscriptions || data.subscriptions.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-sm">
            No investment subscriptions found.
          </div>
        ) : (
          <div className="space-y-3">
            {data.subscriptions.map((sub) => {
              const allocation = sub.token_allocations?.[0];
              const isAllocated = sub.status === "ALLOCATED";

              return (
                <div
                  key={sub.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-sm">
                        {sub.token_quantity_allocated} MEAT
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        ({(sub.fiat_amount_cents / 100).toLocaleString()}{" "}
                        {sub.currency})
                      </span>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        isAllocated
                          ? "bg-emerald-100 text-emerald-800"
                          : sub.status === "FUNDS_RECEIVED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isAllocated
                        ? "Tokens Allocated"
                        : sub.status === "FUNDS_RECEIVED"
                        ? "Settling"
                        : "Payment Pending"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
                    <span className="font-mono">
                      Ref: {sub.payment_reference}
                    </span>
                    <span>{new Date(sub.created_at).toLocaleDateString()}</span>
                  </div>

                  {allocation?.transaction_hash && (
                    <div className="text-xs pt-1">
                      {allocation.transaction_hash.startsWith("0x_manual_") ? (
                        <span className="text-slate-400 font-mono text-[11px]">
                          Allocated via Treasury Studio
                        </span>
                      ) : (
                        <a
                          href={`https://hashscan.io/testnet/transaction/${allocation.transaction_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-mono truncate block"
                        >
                          Hedera Tx: {allocation.transaction_hash.slice(0, 18)}
                          ... ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-center pt-2">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-600 transition"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
      <Suspense
        fallback={
          <div className="text-slate-500 text-sm">Loading portfolio...</div>
        }
      >
        <PortfolioContent />
      </Suspense>
    </main>
  );
}
