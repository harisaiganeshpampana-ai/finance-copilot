import type { Metadata } from "next";

// Site-wide branding and metadata for CalmOwe (live at calmowe.com).

export const SITE_URL = "https://calmowe.com";
export const SITE_NAME = "CalmOwe";
export const SITE_TITLE = "CalmOwe | AI Financial Copilot";
export const SITE_DESCRIPTION =
  "Take absolute control of your cash flow with CalmOwe. Your AI-powered personal finance copilot.";

export const siteMetadata: Metadata = {
  // Makes share-preview images and canonical links absolute URLs on the live domain.
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};
