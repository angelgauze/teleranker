import { CompareDialog } from "../../_components/compare-dialog";

/** Compare opened within the site, as a pop-up; a direct visit renders the full page. */
export default function CompareModalLayout({ children }: { children: React.ReactNode }) {
  return <CompareDialog>{children}</CompareDialog>;
}
