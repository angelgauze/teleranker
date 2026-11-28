import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BackToTop } from "./_components/back-to-top";
import { SiteHeader } from "./_components/site-header";
import "./globals.css";

// Variable font: every weight from one file (docs/DESIGN.md, Type).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Every tab reads "{page heading} · TeleRanker"; pages set their own heading as the title.
  title: {
    default: "TeleRanker",
    template: "%s · TeleRanker",
  },
  description:
    "Compare Globe, Smart and DITO mobile promos by price, data allowance, validity and 4G/5G compatibility.",
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  /** The Compare pop-up when it is opened from within the site (src/app/@modal). */
  modal: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark h-full ${inter.variable}`}>
      <body className="flex min-h-full flex-col bg-canvas text-fg">
        <SiteHeader />
        {children}
        {modal}
        <BackToTop />
      </body>
    </html>
  );
}
