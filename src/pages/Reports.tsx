import React from 'react';
import { BarChart } from 'lucide-react';

export default function Reports() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <BarChart className="w-6 h-6 text-zinc-700" />
          Reports
        </h1>
        <p className="text-sm text-zinc-500">View detailed analytics and reports for your books.</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
        <BarChart className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
        <p className="font-medium text-zinc-900">Coming Soon</p>
        <p className="text-sm">Advanced reporting and analytics are currently under development.</p>
      </div>
    </div>
  );
}
