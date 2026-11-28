import { connection } from "next/server";
import { compareMetadata, ComparisonBody, loadComparison } from "../_components/compare-view";
import { RetryButton } from "../_components/retry-button";

/** The page title used across the site: 28px on phones, 56px on desktop. */
const TITLE = "text-[28px] leading-[1.02] font-[560] tracking-[-0.035em] text-fg md:text-[56px]";

// The comparison depends on live database state, so it cannot be prerendered.
export const instant = false;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const generateMetadata = ({ searchParams }: Props) => compareMetadata(searchParams);

/** The full Compare page for direct visits and shared links; in-site it opens as a pop-up. */
export default async function ComparePage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const comparison = await loadComparison(params);

  if (comparison.kind === "notice") {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-16 sm:px-6 md:pt-16">
        <div className="grid gap-x-12 gap-y-2.5 md:grid-cols-2 md:items-start md:gap-y-4">
          <h1 className={TITLE}>{comparison.title}</h1>
          <div className="max-w-[34rem] space-y-4 text-[15px] leading-relaxed text-fg-2 md:pt-2 md:text-xl md:leading-snug">
            {comparison.body}
            {comparison.retry ? <RetryButton /> : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-16 tabular-nums sm:px-6 md:pt-16">
      <h1 className={TITLE}>
        Compare
        <br />
        promos
      </h1>
      {/* The full page width, so the summary and table leave no dead space. */}
      <div className="mt-8 md:mt-14">
        <ComparisonBody comparison={comparison} params={params} inDialog={false} />
      </div>
    </main>
  );
}
