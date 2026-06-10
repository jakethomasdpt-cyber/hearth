"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents, formatCentsCompact } from "@/lib/format";

export function NetWorthChart({
  data,
}: {
  data: { date: string; netWorthCents: number }[];
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-ink-faint">
        Net worth history will appear here as balances change over time.
      </div>
    );
  }

  const points = data.map((d) => ({
    date: d.date,
    value: d.netWorthCents,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const rising = points[points.length - 1].value >= points[0].value;
  const stroke = rising ? "#00c805" : "#ff5340";

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: "#5a635e", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            tickFormatter={(v: number) => formatCentsCompact(v)}
            tick={{ fill: "#5a635e", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "#141a17",
              border: "1px solid #2c3830",
              borderRadius: 12,
              fontSize: 13,
            }}
            labelStyle={{ color: "#8b958f" }}
            formatter={(value) => [formatCents(Number(value)), "Net worth"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#nwFill)"
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
