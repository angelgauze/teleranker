import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  weight: ["800"],
  style: ["italic"],
  subsets: ["latin"],
  variable: "--font-logo",
  display: "swap",
});

/**
 * Bar colours, shortest to tallest. The light version is used on the white
 * page background and the dark version on the dark one; the tallest bar is
 * amber in both.
 */
const BARS = [
  { x: 6, y: 68, height: 28, fill: "fill-[#A1A1AA] dark:fill-[#52525B]" },
  { x: 34, y: 48, height: 48, fill: "fill-[#71717A] dark:fill-[#71717A]" },
  { x: 62, y: 28, height: 68, fill: "fill-[#3F3F46] dark:fill-[#A1A1AA]" },
  { x: 90, y: 8, height: 88, fill: "fill-[#FFB400] dark:fill-[#FFB400]" },
] as const;

/** Reference artboard measurements in px, at a 92 px wordmark. */
const WORDMARK_PX = 92;
const MARK_WIDTH_PX = 118;
const MARK_HEIGHT_PX = 88;
const GAP_PX = 22;

const em = (px: number) => `${px / WORDMARK_PX}em`;

type LogoProps = {
  /**
   * Wordmark font size: px as a number, or any CSS length such as a clamp()
   * that scales with the screen. The mark and the gap scale with it so the
   * proportions match the reference artboard (92 = full size).
   */
  size?: number | string;
  className?: string;
};

/**
 * TeleRanker logo: four rising signal bars (inline SVG) and the "teleranker"
 * wordmark as live text, so it stays sharp at any size. Colours follow the
 * light/dark page theme.
 */
export function Logo({ size = WORDMARK_PX, className }: LogoProps) {
  return (
    <span
      className={`${montserrat.variable} inline-flex items-center ${className ?? ""}`}
      style={{ fontSize: typeof size === "number" ? `${size}px` : size, gap: em(GAP_PX) }}
    >
      <svg
        role="img"
        aria-label="teleranker mark: four rising signal bars"
        viewBox="0 0 134 100"
        width={em(MARK_WIDTH_PX)}
        height={em(MARK_HEIGHT_PX)}
        className="shrink-0"
      >
        <g transform="translate(0,96) skewX(-12) translate(0,-96)">
          {BARS.map((bar) => (
            <rect
              key={bar.x}
              x={bar.x}
              y={bar.y}
              width={20}
              height={bar.height}
              rx={4}
              className={bar.fill}
            />
          ))}
        </g>
      </svg>
      <span
        className="text-[#09090B] dark:text-[#FAFAFA]"
        style={{
          fontFamily: "var(--font-logo), 'Arial Black', Arial, sans-serif",
          fontWeight: 800,
          fontStyle: "italic",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        teleranker
      </span>
    </span>
  );
}
