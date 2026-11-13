import type { Metadata } from "next";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mb-8 border-b border-zinc-800/80 pb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Settings</h2>
          <p className="mt-1 text-sm text-zinc-500">Manage your profile, preferences and notifications.</p>
        </div>
        <SettingsForm />
      </div>
    </main>
  );
}
