"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EventData {
  eventName: string;
  sent: number;
}

interface EventTypeChartProps {
  data: EventData[];
}

export default function EventTypeChart({ data }: EventTypeChartProps) {
  // Format event names for display
  const formattedData = data.map((item) => ({
    ...item,
    displayName: item.eventName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Emails by Event Type
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={formattedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={{ fontSize: 12 }}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="sent" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
