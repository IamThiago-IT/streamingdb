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
import { formatMoney } from "@/lib/money";

type PricePoint = {
  recordedAt: string;
  price: number;
  planName: string;
};

export default function PriceHistoryChart({
  data,
  planColors,
  currency,
  locale,
}: {
  data: PricePoint[];
  planColors?: Record<string, string>;
  currency: string;
  locale: string;
}) {
  if (data.length === 0) return null;

  type ChartEntry = { key: string; date: string } & Record<
    string,
    number | string
  >;

  const grouped = data.reduce<Record<string, ChartEntry>>((acc, point) => {
    const key = point.recordedAt.slice(0, 10);
    if (!acc[key]) {
      acc[key] = {
        key,
        date: new Date(point.recordedAt).toLocaleDateString(locale),
      };
    }
    acc[key][point.planName] = point.price;
    return acc;
  }, {});

  const chartData = Object.values(grouped).sort((a, b) =>
    a.key.localeCompare(b.key)
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
            width={72}
            tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={{ stroke: "var(--line)" }}
            tickMargin={6}
            tickFormatter={(v: number) =>
              formatMoney(v, currency, locale, { maximumFractionDigits: 0 })
            }
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
            formatter={(value, name) => [
              formatMoney(Number(value), currency, locale),
              name,
            ]}
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
