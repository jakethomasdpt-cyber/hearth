"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents, formatCentsCompact } from "@/lib/format";

export function CashFlowChart({
  data,
}: {
  data: { month: string; incomeCents: number; spendingCents: number }[];
}) {
  const points = data.map((d) => ({
    label: new Date(d.month + "-01T00:00:00").toLocaleDateString("en-US", {
      month: "short",
    }),
    Income: d.incomeCents,
    Spending: d.spendingCents,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={4}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#5a635e", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCentsCompact(v)}
            tick={{ fill: "#5a635e", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "#141a17" }}
            contentStyle={{
              background: "#141a17",
              border: "1px solid #2c3830",
              borderRadius: 12,
              fontSize: 13,
            }}
            labelStyle={{ color: "#8b958f" }}
            formatter={(value) => formatCents(Number(value))}
          />
          <Bar dataKey="Income" fill="#00c805" radius={[4, 4, 0, 0]} animationDuration={500} />
          <Bar dataKey="Spending" fill="#3a4640" radius={[4, 4, 0, 0]} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
