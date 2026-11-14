"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, Check, Loader2, Moon, SlidersHorizontal, Trash2, TriangleAlert, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/components/currency/currency-store";
import { Switch } from "@/components/ui/Switch";
import { mockUser } from "@/data/mockUser";
import { CURRENCY_CODES, CURRENCY_INFO } from "@/lib/currency";
import { EMAIL_MAX, FULL_NAME_MAX, type SettingsField, type SettingsInput } from "@/lib/validation/settings";
import { saveSettings } from "./actions";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const initialSettings: SettingsInput = {
  fullName: mockUser.fullName,
  email: mockUser.email,
  darkMode: true,
  notifications: { weeklySummary: true, largeTransactionAlerts: true, copilotTips: false },
};

const notificationRows: { key: keyof SettingsInput["notifications"]; title: string; body: string }[] = [
  { key: "weeklySummary", title: "Weekly Summary", body: "A Monday email with last week's income, spending and balance." },
  {
    key: "largeTransactionAlerts",
    title: "Large Transaction Alerts",
    body: "Get notified when a single transaction is unusually large.",
  },
  { key: "copilotTips", title: "AI Copilot Tips", body: "Occasional suggestions for improving cash flow and paying down debt." },
];

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

function Section({
  icon: Icon,
  title,
  description,
  children,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <section
      aria-labelledby={`${title}-heading`}
      className="grid gap-4 border-t border-zinc-800/80 py-8 first:border-t-0 first:pt-0 lg:grid-cols-[260px_1fr] lg:gap-10"
    >
      <div>
        <h3
          id={`${title}-heading`}
          className={`flex items-center gap-2 text-sm font-medium ${danger ? "text-rose-400" : "text-white"}`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </h3>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div
        className={`rounded-xl border ${
          danger ? "border-rose-500/25 bg-rose-500/[0.03]" : "border-zinc-800 bg-zinc-900/40"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-zinc-300">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = (invalid: boolean) =>
  `block w-full rounded-md border bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 transition-colors focus:outline-none focus:ring-2 ${
    invalid
      ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20"
      : "border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 focus:ring-zinc-500/20"
  }`;

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsInput>(initialSettings);
  const [saved, setSaved] = useState<SettingsInput>(initialSettings);
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const { currency, setCurrency } = useCurrency();

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  // Free the local preview image when it changes or the page closes.
  useEffect(() => () => void (avatarUrl && URL.revokeObjectURL(avatarUrl)), [avatarUrl]);

  const update = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onAvatarChosen = (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) return setAvatarError("Use a PNG, JPG, GIF or WebP image.");
    if (file.size > MAX_AVATAR_BYTES) return setAvatarError("Image must be 2 MB or smaller.");
    setAvatarError(null);
    setAvatarUrl(URL.createObjectURL(file));
  };

  const onSave = () => {
    startSaving(async () => {
      try {
        const result = await saveSettings(settings);
        if (result.ok) {
          setSettings(result.data);
          setSaved(result.data);
          setErrors({});
          toast.success("Settings saved", { description: "Your changes have been updated." });
        } else {
          setErrors(result.errors);
          toast.error("Couldn't save settings", { description: "Check the highlighted fields and try again." });
        }
      } catch {
        toast.error("Couldn't save settings", { description: "Something went wrong. Please try again." });
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {/* Profile */}
      <Section icon={UserRound} title="Profile" description="How you appear in CalmOwe.">
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-700 bg-gradient-to-br from-zinc-700 to-zinc-800 text-lg font-semibold text-white">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview from a blob URL
                <img src={avatarUrl} alt="Profile picture preview" className="size-full object-cover" />
              ) : (
                <span aria-label="Profile picture placeholder">{initials(settings.fullName)}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Profile Picture</p>
              <p className="text-xs text-zinc-500">PNG, JPG, GIF or WebP. Max 2 MB.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-700"
                >
                  <Upload className="size-3.5" aria-hidden="true" />
                  Upload
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="rounded-md px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={AVATAR_TYPES.join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose profile picture"
                onChange={(e) => {
                  onAvatarChosen(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {avatarError && <p className="mt-1.5 text-xs text-rose-400">{avatarError}</p>}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="fullName" label="Full Name" error={errors.fullName}>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                maxLength={FULL_NAME_MAX}
                value={settings.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
                className={inputClass(!!errors.fullName)}
              />
            </Field>
            <Field id="email" label="Email Address" error={errors.email}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                maxLength={EMAIL_MAX}
                value={settings.email}
                onChange={(e) => update("email", e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={inputClass(!!errors.email)}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* Preferences */}
      <Section icon={SlidersHorizontal} title="Preferences" description="Display options for your dashboard.">
        <div className="divide-y divide-zinc-800">
          <div className="p-5 sm:p-6">
            <p id="currency-label" className="text-sm font-medium text-white">
              Base Currency
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Applies instantly everywhere, including the selector in the top bar.
            </p>
            <div role="radiogroup" aria-labelledby="currency-label" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CURRENCY_CODES.map((code) => {
                const selected = code === currency;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCurrency(code)}
                    className={`relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "border-indigo-400/60 bg-indigo-500/10 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span className="grid size-7 place-items-center rounded-md border border-zinc-700 bg-zinc-900 text-sm">
                      {CURRENCY_INFO[code].symbol}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{code}</span>
                      <span className="block truncate text-[11px] text-zinc-500">{CURRENCY_INFO[code].name}</span>
                    </span>
                    {selected && <Check className="absolute right-2 top-2 size-3.5 text-indigo-300" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400">
                <Moon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">Dark Mode</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {settings.darkMode ? "Use the dark theme across CalmOwe." : "Light theme is coming soon."}
                </p>
              </div>
            </div>
            <Switch checked={settings.darkMode} onChange={(v) => update("darkMode", v)} label="Dark Mode" />
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notifications" description="Choose what CalmOwe tells you about.">
        <ul className="divide-y divide-zinc-800">
          {notificationRows.map(({ key, title, body }) => (
            <li key={key} className="flex items-center justify-between gap-4 p-5 sm:px-6">
              <div>
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{body}</p>
              </div>
              <Switch
                checked={settings.notifications[key]}
                onChange={(v) => update("notifications", { ...settings.notifications, [key]: v })}
                label={title}
              />
            </li>
          ))}
        </ul>
        {errors.notifications && <p className="px-6 pb-4 text-xs text-rose-400">{errors.notifications}</p>}
      </Section>

      {/* Danger zone */}
      <Section
        icon={TriangleAlert}
        title="Danger Zone"
        description="Irreversible actions for your account."
        tone="danger"
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-medium text-white">Delete Account</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Permanently remove your account and all associated data. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              toast.error("Account deletion isn't available yet", {
                description: "This is demo mode. No account or data exists to delete.",
              })
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 transition-colors hover:border-rose-500/70 hover:bg-rose-500/20 hover:text-rose-300"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete Account
          </button>
        </div>
      </Section>

      {/* Fixed save bar */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-zinc-800/80 bg-zinc-950/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-xs text-zinc-500" aria-live="polite">
            {dirty ? (
              <>
                <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                You have unsaved changes
              </>
            ) : (
              "All changes saved"
            )}
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-70"
          >
            {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
