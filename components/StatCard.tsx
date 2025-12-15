import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
}: StatCardProps) {
  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-500",
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && trendValue && (
            <p className={`text-sm mt-1 ${trendColors[trend]}`}>
              {trendIcons[trend]} {trendValue}
            </p>
          )}
        </div>
        <div className="p-3 bg-indigo-100 rounded-lg">
          <Icon className="h-6 w-6 text-indigo-600" />
        </div>
      </div>
    </div>
  );
}
