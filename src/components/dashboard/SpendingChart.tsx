"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SpendingPoint = { label: string; dollars: number };

const usd = (n: number, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

export function SpendingChart({ data }: { data: SpendingPoint[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Area chart of daily spending over the last 7 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            tickFormatter={(v: number) => usd(v, 0)}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
                  <p className="text-zinc-400">{label}</p>
                  <p className="mt-0.5 font-medium text-white tabular-nums">{usd(Number(payload[0].value))}</p>
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="dollars"
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
