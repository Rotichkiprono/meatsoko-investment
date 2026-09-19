"use client";

import { useState, useContext, ChangeEvent } from "react";
import { Web3AuthContext } from "../../components/Web3AuthProvider";
import { useRouter } from "next/navigation";

export default function KycPage() {
  const { idToken } = useContext(Web3AuthContext);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("national_id");
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

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

      // Navigate to checkout/invest after a brief delay
      setTimeout(() => router.push("/invest"), 1500);
    } catch (error: any) {
      console.error("Upload Error:", error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <h1 className="text-2xl font-bold mb-2 text-slate-800">
          Identity Verification
        </h1>
        <p className="text-slate-500 mb-6 text-sm">
          Upload your compliance documents to receive your OnchainID.
        </p>

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
        </div>
      </div>
    </main>
  );
}
