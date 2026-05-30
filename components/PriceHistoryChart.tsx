"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type PricePoint = {
  recordedAt: string;
  price: number;
  planName: string;
};

export default function PriceHistoryChart({
  data,
  planColors,
}: {
  data: PricePoint[];
  planColors?: Record<string, string>;
}) {
  if (data.length === 0) return null;

  const grouped = data.reduce<Record<string, { date: string; [key: string]: number | string }[]>>(
    (acc, point) => {
      const date = new Date(point.recordedAt).toLocaleDateString("pt-BR");
      let entry = acc[date];
      if (!entry) {
        entry = { date };
        acc[date] = entry;
      }
      entry[point.planName] = point.price;
      return acc;
    },
    {}
  );

  const chartData = Object.entries(grouped)
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const planNames = [...new Set(data.map((d) => d.planName))];
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            className="text-zinc-500"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="text-zinc-500"
            tickFormatter={(v: number) => `R$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--tooltip-bg, #fff)",
              border: "1px solid var(--tooltip-border, #e4e4e7)",
              borderRadius: "8px",
              fontSize: "13px",
            }}
            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, ""]}
          />
          {planNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={planColors?.[name] ?? colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
