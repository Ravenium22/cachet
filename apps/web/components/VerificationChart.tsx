"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyCount {
  date: string;
  count: number;
}

export default function VerificationChart({ data }: { data: DailyCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#0A8F54" strokeOpacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#A3A3A3", fontSize: 12, fontFamily: "var(--font-mono)" }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tick={{ fill: "#A3A3A3", fontSize: 12, fontFamily: "var(--font-mono)" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: "#0A0A0A", border: "1px solid #0A8F54", borderRadius: "2px", color: "#FFFFFF" }}
          labelStyle={{ color: "#FFFFFF", fontFamily: "var(--font-mono)" }}
          itemStyle={{ color: "#0A8F54", fontFamily: "var(--font-mono)" }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#0A8F54"
          fill="#0A8F54"
          fillOpacity={0.15}
          name="VERIFICATIONS"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
