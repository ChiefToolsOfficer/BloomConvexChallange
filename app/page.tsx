"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Mail, TrendingUp, MousePointer, Users } from "lucide-react";
import StatCard from "@/components/StatCard";
import EmailVolumeChart from "@/components/EmailVolumeChart";
import EventTypeChart from "@/components/EventTypeChart";
import LifecycleFunnel from "@/components/LifecycleFunnel";
import PerformanceTable from "@/components/PerformanceTable";

export default function DashboardPage() {
  const summary = useQuery(api.dashboard.getDashboardSummary);
  const chartData = useQuery(api.dashboard.getDailyChartData, { days: 30 });
  const eventStats = useQuery(api.dashboard.getStatsByEventType, { days: 30 });
  const funnelData = useQuery(api.dashboard.getLifecycleFunnel);

  // Loading state
  if (!summary || !chartData || !eventStats || !funnelData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Emails Sent (30d)"
          value={summary.last30Days.sent.toLocaleString()}
          subtitle={`${summary.today.sent} today`}
          icon={Mail}
        />
        <StatCard
          title="Delivery Rate"
          value={`${summary.last30Days.deliveryRate}%`}
          icon={TrendingUp}
          trend={summary.last30Days.deliveryRate >= 95 ? "up" : "down"}
        />
        <StatCard
          title="Open Rate"
          value={`${summary.last30Days.openRate}%`}
          icon={MousePointer}
          trend={summary.last30Days.openRate >= 20 ? "up" : "neutral"}
        />
        <StatCard
          title="Active Users"
          value={summary.users.active.toLocaleString()}
          subtitle={`${summary.users.atRisk} at risk`}
          icon={Users}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EmailVolumeChart data={chartData} />
        <EventTypeChart data={eventStats} />
      </div>

      {/* Lifecycle Funnel */}
      <LifecycleFunnel data={funnelData} />

      {/* Performance Table */}
      <PerformanceTable data={eventStats} />
    </div>
  );
}
