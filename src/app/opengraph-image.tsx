import { ImageResponse } from "next/og";
import { MARK_ARC, MARK_BAR, MARK_STROKE, MARK_VIEWBOX } from "@/components/LogoMark";

// The preview image shown when a CalmOwe link is shared (iMessage, WhatsApp, Slack, X, LinkedIn).
export const alt = "CalmOwe: take absolute control of your cash flow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#09090b",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 22,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="64"
              height="64"
              viewBox={MARK_VIEWBOX}
              fill="none"
              stroke="#09090b"
              strokeWidth={MARK_STROKE}
              strokeLinecap="round"
            >
              <path d={MARK_ARC} />
              <path d={MARK_BAR} />
            </svg>
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>CalmOwe</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, maxWidth: 960 }}>
            Take absolute control of your cash flow.
          </div>
          <div style={{ fontSize: 32, color: "#a1a1aa" }}>
            See what&apos;s coming in, what&apos;s going out, and which debt to pay down first.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
