"use client";

import { useState, useContext, useEffect, ChangeEvent } from "react";
import { Web3AuthContext } from "../../components/Web3AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function KycPage() {
  const { idToken } = useContext(Web3AuthContext);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("national_id");
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [accreditationStatus, setAccreditationStatus] = useState<string | null>(
    null,
  );
  const [forceReupload, setForceReupload] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!idToken) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${apiUrl}/investors/me`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setAccreditationStatus(data.accreditationStatus);
        }
      } catch (err) {
        console.error("Failed to fetch investor status:", err);
      }
    };

    fetchStatus();
  }, [idToken]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !idToken) return;
    setIsUploading(true);
    setStatus("Requesting secure upload link...");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      // 1. Fetch Signed URL from NestJS backend
      const ext = file.name.split(".").pop() || "jpg";
      const response = await fetch(`${apiUrl}/kyc/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ documentType: docType, fileExtension: ext }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch secure upload URL: ${errorText}`);
      }
      const { uploadUrl, storagePath } = await response.json();

      setStatus("Uploading directly to secure vault...");

      // 2. Upload file directly to GCP Bucket
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream", // Matches backend exact specification
        },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Upload to Cloud Storage failed");

      setStatus("Finalizing compliance verification...");

      // 3. Record KYC submission in backend
      const submitResponse = await fetch(`${apiUrl}/kyc/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          documentType: docType,
          storagePath,
        }),
      });

      if (!submitResponse.ok) {
        const errText = await submitResponse.text();
        throw new Error(`KYC submission record failed: ${errText}`);
      }

      setStatus("Upload successful! Verification pending.");
      setAccreditationStatus("PENDING");

      // Navigate to checkout/invest after a brief delay
      setTimeout(() => router.push("/invest"), 1500);
    } catch (error: any) {
      console.error("Upload Error:", error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // If already verified or pending, show friendly status instead of forcing upload
  const isAlreadySubmitted =
    !forceReupload &&
    (accreditationStatus === "VERIFIED" || accreditationStatus === "PENDING");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <h1 className="text-2xl font-bold mb-2 text-slate-800">
          Identity Verification
        </h1>
        <p className="text-slate-500 mb-6 text-sm">
          Upload your compliance documents to receive your OnchainID.
        </p>

        {isAlreadySubmitted ? (
          <div className="space-y-5">
            {accreditationStatus === "VERIFIED" ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left">
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
                  <span>Identity Already Verified</span>
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  Your KYC is complete and your account is accredited. You do
                  not need to re-upload documents.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
                <div className="flex items-center space-x-2 text-amber-800 font-semibold text-sm">
                  <svg
                    className="w-5 h-5 text-amber-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Verification Under Review</span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  Your documents have been submitted and are currently being
                  reviewed by our compliance team.
                </p>
              </div>
            )}

            <Link href="/invest" className="w-full inline-block">
              <button className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition shadow-sm">
                Proceed to Invest in $MEAT
              </button>
            </Link>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setForceReupload(true)}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Need to submit a different document? Click here
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Document Type
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-3 px-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="national_id">National ID</option>
                <option value="passport">Passport</option>
                <option value="proof_of_address">Proof of Address</option>
                <option value="drivers_license">Driver's License</option>
                <option value="certificate_of_incorporation">
                  Certificate of Incorporation
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Select File
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {status && (
              <div
                className={`p-3 rounded-xl text-sm font-medium ${
                  status.includes("Error")
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {status}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 mt-4"
            >
              {isUploading ? "Uploading..." : "Submit Document"}
            </button>

            {forceReupload && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setForceReupload(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel and return to status
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
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
