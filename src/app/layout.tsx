import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Astro-Bot Dashboard",
  description: "Slope Around Medium — BTC/USDT trading on Hyperliquid",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-56 min-h-screen flex flex-col">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
