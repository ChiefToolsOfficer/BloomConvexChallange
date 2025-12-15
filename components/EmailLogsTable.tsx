"use client";

import { formatDistanceToNow } from "date-fns";

interface EmailLog {
  _id: string;
  eventName: string;
  email: string;
  status: string;
  sentAt: number;
  errorMessage?: string;
}

interface EmailLogsTableProps {
  logs: EmailLog[];
}

export default function EmailLogsTable({ logs }: EmailLogsTableProps) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
      opened: "bg-purple-100 text-purple-800",
      clicked: "bg-indigo-100 text-indigo-800",
      bounced: "bg-red-100 text-red-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const formatEventName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDistanceToNow(new Date(log.sentAt), { addSuffix: true })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800">
                    {formatEventName(log.eventName)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(log.status)}`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                  {log.errorMessage || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
