"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  date: string;
  displayDate: string;
  sent: number;
  delivered: number;
  opened: number;
}

interface EmailVolumeChartProps {
  data: ChartData[];
}

export default function EmailVolumeChart({ data }: EmailVolumeChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Email Volume (30 Days)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="sent"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            name="Sent"
          />
          <Line
            type="monotone"
            dataKey="delivered"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="Delivered"
          />
          <Line
            type="monotone"
            dataKey="opened"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            name="Opened"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
