import type { Metadata } from "next";
import { SiteHeader } from "./_components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TeleRanker — Telecom promo comparison (Philippines)",
    template: "%s · TeleRanker",
  },
  description:
    "Compare Globe, Smart and DITO mobile promos by price, data allowance, validity and 4G/5G compatibility.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
