interface EventStats {
  eventName: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

interface PerformanceTableProps {
  data: EventStats[];
}

export default function PerformanceTable({ data }: PerformanceTableProps) {
  const formatEventName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const getRateColor = (rate: number) => {
    if (rate >= 25) return "text-green-600 bg-green-100";
    if (rate >= 15) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Event Performance (30 Days)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delivered
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Opened
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Open Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Click Rate
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((event) => (
              <tr key={event.eventName} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatEventName(event.eventName)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  {event.sent.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  {event.delivered.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  {event.opened.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRateColor(event.openRate)}`}
                  >
                    {event.openRate}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRateColor(event.clickRate)}`}
                  >
                    {event.clickRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
