import type { Metadata } from "next";
import { connection } from "next/server";
import { CompareNotice, ComparisonBody, loadComparison } from "../../_components/compare-view";

// The comparison depends on live database state, so it cannot be prerendered.
export const instant = false;

// A fixed name for the tab; the full page names the pair ("A vs B").
export const metadata: Metadata = { title: "Compare promos" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CompareModal({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const comparison = await loadComparison(params);

  if (comparison.kind === "notice") {
    return (
      <div className="pb-8">
        <CompareNotice notice={comparison} heading="h2" />
      </div>
    );
  }
  return <ComparisonBody comparison={comparison} params={params} inDialog />;
}
