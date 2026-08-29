import type { Metadata } from "next";
import "./globals.css";
import { TenantProvider } from "@/components/layout/TenantProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const metadata: Metadata = {
  title: "COVE - Construction Operations Value Engine",
  description: "Progress-to-Cash and Cash-at-Risk Control System for Construction Contractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <LanguageProvider>
          <TenantProvider>{children}</TenantProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
