interface FunnelData {
  total: number;
  new: number;
  onboarding: number;
  active: number;
  atRisk: number;
  churned: number;
}

interface LifecycleFunnelProps {
  data: FunnelData;
}

export default function LifecycleFunnel({ data }: LifecycleFunnelProps) {
  const stages = [
    { key: "total", label: "Total Users", color: "bg-gray-500" },
    { key: "new", label: "New", color: "bg-blue-500" },
    { key: "onboarding", label: "Onboarding", color: "bg-indigo-500" },
    { key: "active", label: "Active", color: "bg-green-500" },
    { key: "atRisk", label: "At Risk", color: "bg-yellow-500" },
    { key: "churned", label: "Churned", color: "bg-red-500" },
  ];

  const maxValue = data.total || 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        User Lifecycle Funnel
      </h3>
      <div className="space-y-3">
        {stages.map((stage) => {
          const value = data[stage.key as keyof FunnelData];
          const percentage = ((value / maxValue) * 100).toFixed(1);
          const barWidth = Math.max((value / maxValue) * 100, 2);

          return (
            <div key={stage.key} className="flex items-center">
              <div className="w-24 text-sm text-gray-600">{stage.label}</div>
              <div className="flex-1 mx-4">
                <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-lg transition-all duration-500`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
              <div className="w-20 text-right">
                <span className="font-semibold text-gray-900">{value}</span>
                <span className="text-sm text-gray-500 ml-1">({percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
