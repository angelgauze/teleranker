import { ImageResponse } from "next/og";

/** Home-screen icon (iPhone and iPad): the logo's four bars on a dark square. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BARS = [
  { height: 34, color: "#52525b" },
  { height: 58, color: "#71717a" },
  { height: 82, color: "#a1a1aa" },
  { height: 106, color: "#ffb400" },
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 10,
          paddingBottom: 37,
          background: "#09090b",
        }}
      >
        {BARS.map((bar) => (
          <div
            key={bar.color}
            style={{
              width: 24,
              height: bar.height,
              borderRadius: 5,
              background: bar.color,
              transform: "skewX(-12deg)",
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
