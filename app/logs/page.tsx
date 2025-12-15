"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import EmailLogsTable from "@/components/EmailLogsTable";

export default function LogsPage() {
  const [eventFilter, setEventFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const eventNames = useQuery(api.dashboard.getDistinctEventNames);
  const logs = useQuery(api.dashboard.getRecentEmailLogs, {
    limit: 100,
    eventName: eventFilter || undefined,
    status: statusFilter || undefined,
  });

  const statuses = ["sent", "delivered", "opened", "clicked", "bounced", "failed"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Logs</h1>
        <p className="text-gray-500 mt-1">View all sent emails and their status</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Events</option>
          {eventNames?.map((name: string) => (
            <option key={name} value={name}>
              {name.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {!logs ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No email logs found</p>
        </div>
      ) : (
        <EmailLogsTable logs={logs} />
      )}
    </div>
  );
}
