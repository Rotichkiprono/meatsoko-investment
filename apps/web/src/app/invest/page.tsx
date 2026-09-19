"use client";

import { useState, useContext, ChangeEvent } from "react";
import { Web3AuthContext } from "../../components/Web3AuthProvider";
import Link from "next/link";

const TOKEN_PRICE_KES = 5000;

export default function InvestPage() {
  const { idToken, userAddress } = useContext(Web3AuthContext);

  const [tokenQuantity, setTokenQuantity] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) {
      setTokenQuantity(1);
    } else {
      setTokenQuantity(val);
    }
  };

  const totalCostKes = (tokenQuantity * TOKEN_PRICE_KES).toLocaleString();

  const handleCheckout = async () => {
    if (!idToken) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }

    if (tokenQuantity < 1) {
      setErrorMessage("Please select at least 1 MEAT token.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/portfolio`
          : undefined;

      // Call the checkout endpoint
      let response = await fetch(`${apiUrl}/subscriptions/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tokenQuantity: Number(tokenQuantity),
          callbackUrl,
        }),
      });

      // Fallback to singular /subscription/checkout if 404
      if (response.status === 404) {
        response = await fetch(`${apiUrl}/subscription/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            tokenQuantity: Number(tokenQuantity),
            callbackUrl,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          errorData.message || `Checkout failed with status ${response.status}`;
        throw new Error(message);
      }

      const responseData = await response.json();
      const redirectUrl =
        responseData.checkoutUrl ||
        responseData.authorization_url ||
        responseData.data?.authorization_url;

      if (!redirectUrl) {
        throw new Error("No authorization URL returned from checkout service.");
      }

      // Redirect user to the hosted Paystack checkout page
      window.location.href = redirectUrl;
    } catch (error: any) {
      console.error("Checkout Error:", error);
      setErrorMessage(error.message || "An unexpected error occurred.");
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            Offering Open
          </span>
          <span className="text-xs text-slate-400 font-mono">
            ERC-3643 • Hedera
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          Invest in $MEAT
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Tokenized prime agricultural and livestock assets with on-chain yield.
        </p>

        {/* Pricing Card */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Asset</span>
            <span className="font-semibold text-slate-700">
              MEAT Security Token
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Price per Token</span>
            <span className="font-semibold text-slate-800">
              {TOKEN_PRICE_KES.toLocaleString()} KES
            </span>
          </div>
          {userAddress && (
            <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
              <span className="text-slate-400">Recipient Wallet</span>
              <span className="font-mono text-slate-600 truncate max-w-[180px]">
                {userAddress}
              </span>
            </div>
          )}
        </div>

        {/* Quantity Input */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Token Quantity
            </label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() =>
                  setTokenQuantity((prev) => Math.max(1, prev - 1))
                }
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg transition"
                disabled={isProcessing || tokenQuantity <= 1}
              >
                −
              </button>
              <input
                type="number"
                min="1"
                step="1"
                value={tokenQuantity}
                onChange={handleQuantityChange}
                disabled={isProcessing}
                className="flex-1 text-center font-bold text-xl py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setTokenQuantity((prev) => prev + 1)}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg transition"
                disabled={isProcessing}
              >
                +
              </button>
            </div>
          </div>

          {/* Total Cost Display */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">
                Total Amount
              </div>
              <div className="text-xl font-bold text-blue-900">
                {totalCostKes} KES
              </div>
            </div>
            <span className="text-xs text-blue-500 font-medium">
              ≈ ${(tokenQuantity * (TOKEN_PRICE_KES / 130)).toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
            {errorMessage}
          </div>
        )}

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={isProcessing || !idToken}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 shadow-md flex items-center justify-center space-x-2"
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                ></path>
              </svg>
              <span>Connecting to Paystack...</span>
            </>
          ) : (
            <span>Invest Now (M-Pesa / Card)</span>
          )}
        </button>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
