import type { Metadata } from "next";
import { CopilotChat } from "@/components/copilot/CopilotChat";

export const metadata: Metadata = {
  title: "AI Copilot",
};

export default function CopilotPage() {
  return <CopilotChat />;
}
