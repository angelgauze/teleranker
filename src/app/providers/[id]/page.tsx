import { permanentRedirect } from "next/navigation";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

/**
 * Retired: each provider is now a section on `/providers`. Old links and
 * bookmarks land on that section (an unknown id lands at the top of the page).
 */
export default async function ProviderPage({ params }: Props) {
  const { id } = await params;
  permanentRedirect(`/providers#${encodeURIComponent(id)}`);
}
