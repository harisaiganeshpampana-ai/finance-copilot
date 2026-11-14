"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCurrency } from "@/components/currency/currency-store";
import { formatMinorUnits } from "@/lib/currency";

export type SpendingPoint = { label: string; minor: number };

export function SpendingChart({ data }: { data: SpendingPoint[] }) {
  const { currency, convert } = useCurrency();

  // Plot in the selected currency's major unit (e.g. rupees), converted from the stored amounts.
  const points = data.map((d) => ({ label: d.label, amount: convert(d.minor) / 100 }));
  const fmt = (major: number, decimals: 0 | 2) => formatMinorUnits(Math.round(major * 100), currency, { decimals });

  return (
    <div className="h-64 w-full" role="img" aria-label={`Area chart of daily spending over the last 7 days, in ${currency}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: 12 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: 12 }}
            tickFormatter={(v: number) => fmt(v, 0)}
            width={currency === "INR" ? 72 : 56}
          />
          <Tooltip
            cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
                  <p className="text-zinc-400">{label}</p>
                  <p className="mt-0.5 font-medium text-white tabular-nums">{fmt(Number(payload[0].value), 2)}</p>
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#818cf8"
            strokeWidth={2}
            fill="url(#spendFill)"
            activeDot={{ r: 4, fill: "#818cf8", stroke: "#09090b", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
