"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Web3AuthProvider from "@/components/Web3AuthProvider";
import "@/app/globals.css";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <QueryClientProvider client={queryClient}>
          <Web3AuthProvider>
            <nav className="border-b bg-white px-6 py-4 flex justify-between items-center">
              <h1 className="font-bold text-xl text-slate-800">
                Meatsoko Investments
              </h1>
            </nav>
            <main className="max-w-7xl mx-auto p-6">{children}</main>
          </Web3AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
