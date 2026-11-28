import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

/** Shown for unknown addresses: a bare page (no site header) with one way back. */
export default function NotFound() {
  return (
    <main data-bare className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-[19rem]">
        <h1 className="text-xl leading-tight font-[590] tracking-[-0.02em] text-fg">Page not found</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-3">
          This page doesn&rsquo;t exist or has moved. Check the address, or head back to the promos.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-fg px-5 text-sm font-[590] text-canvas hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Back to promos
        </Link>
      </div>
    </main>
  );
}
