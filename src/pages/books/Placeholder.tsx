import React from 'react';
import { Construction } from 'lucide-react';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <div className="p-4 bg-orange-100 rounded-full text-orange-600">
        <Construction className="w-12 h-12" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <p className="text-slate-500 max-w-sm text-center">This feature is currently under development as part of the professional Books suite for Chartered Accountants.</p>
    </div>
  );
}
