import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

/** Shown for unknown addresses and unknown providers. */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-zinc-700 dark:text-zinc-300">
        This page doesn&rsquo;t exist. Try the{" "}
        <Link href="/" className="underline underline-offset-2">
          promo listing
        </Link>{" "}
        or the{" "}
        <Link href="/providers" className="underline underline-offset-2">
          providers
        </Link>
        .
      </p>
    </main>
  );
}
