"use client";

import { Suspense, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { Web3AuthContext } from "../../components/Web3AuthProvider";
import Link from "next/link";

function PortfolioContent() {
  const { userAddress } = useContext(Web3AuthContext);
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
      {reference ? (
        <>
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Payment Received!
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            Your transaction has been processed by Paystack. The MeatSoko
            settlement engine is finalizing your token allocation on the Hedera
            network.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200 text-left space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Payment Reference</span>
              <span className="font-mono text-slate-700 font-semibold truncate max-w-[180px]">
                {reference}
              </span>
            </div>
            {userAddress && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Receiving Wallet</span>
                <span className="font-mono text-slate-700 font-semibold truncate max-w-[180px]">
                  {userAddress}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Network</span>
              <span className="font-medium text-emerald-600">
                Hedera EVM (Testnet)
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Investor Portfolio
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            Manage your tokenized livestock assets and track returns.
          </p>

          <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200 text-center">
            <div className="text-3xl font-bold text-slate-800 mb-1">0 MEAT</div>
            <div className="text-xs text-slate-400">Total Holdings</div>
          </div>
        </>
      )}

      <div className="space-y-3">
        <Link href="/invest" className="block">
          <button className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition">
            Invest More
          </button>
        </Link>
        <Link href="/" className="block">
          <button className="w-full bg-slate-100 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-200 transition">
            Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
      <Suspense
        fallback={<div className="text-slate-500">Loading portfolio...</div>}
      >
        <PortfolioContent />
      </Suspense>
    </main>
  );
}
