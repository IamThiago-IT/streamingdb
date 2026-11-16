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

  type ChartEntry = { date: string } & Record<string, number | string>;
  const grouped = data.reduce<Record<string, ChartEntry>>(
    (acc, point) => {
      const date = new Date(point.recordedAt).toLocaleDateString("pt-BR");
      if (!acc[date]) {
        acc[date] = { date };
      }
      acc[date][point.planName] = point.price;
      return acc;
    },
    {}
  );

  const chartData = Object.values(grouped).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const planNames = [...new Set(data.map((d) => d.planName))];
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
  ];

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={{ stroke: "var(--line)" }}
            tickMargin={8}
          />
          <YAxis
            width={52}
            tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={{ stroke: "var(--line)" }}
            tickMargin={6}
            tickFormatter={(v: number) => `R$${v}`}
          />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "var(--font-plex-mono)",
            }}
            labelStyle={{ color: "var(--ink-muted)" }}
            itemStyle={{ color: "var(--ink)" }}
            formatter={(value, name) => [`R$ ${Number(value).toFixed(2)}`, name]}
          />
          {planNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={planColors?.[name] ?? colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 3.5 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {planNames.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3">
          {planNames.map((name, i) => (
            <span key={name} className="flex items-center gap-2 text-xs text-ink-muted">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: planColors?.[name] ?? colors[i % colors.length] }}
              />
              <span className="font-mono text-[11px]">{name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
