"use client";

/** Accessible toggle switch (role="switch"), styled to replace a checkbox. */
export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
        checked ? "border-indigo-400/50 bg-indigo-500" : "border-zinc-700 bg-zinc-800"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-[18px] rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}
