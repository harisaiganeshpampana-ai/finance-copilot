import { ImageResponse } from "next/og";
import { MARK_ARC, MARK_BAR, MARK_STROKE, MARK_VIEWBOX } from "@/components/LogoMark";

// Home-screen icon for iPhone/iPad ("Add to Home Screen"). iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
        }}
      >
        <svg
          width="116"
          height="116"
          viewBox={MARK_VIEWBOX}
          fill="none"
          stroke="#ffffff"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
        >
          <path d={MARK_ARC} />
          <path d={MARK_BAR} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
