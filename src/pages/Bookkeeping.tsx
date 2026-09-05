import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  FileText, 
  CreditCard, 
  PieChart,
  Plus,
  Search,
  Filter,
  Download,
  MoreVertical,
  Calculator,
  Briefcase
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import Invoices from './erp/Invoices';
import Bills from './erp/Bills';
import ChartOfAccounts from './erp/ChartOfAccounts';
import Clients from './erp/Clients';

export default function Bookkeeping() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices');

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
               <Briefcase className="w-4 h-4 text-white" />
            </div>
            Bookkeeping ERP
          </h1>
          <p className="text-slate-500 mt-1">Professional Suite for Chartered Accountants & Auditors</p>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-start gap-3">
        <Calculator className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-sm">Professional Module Initialized</h3>
          <p className="text-xs mt-1 leading-relaxed opacity-90">
            This workspace is strictly isolated. Only users explicitly invited to this Bookkeeping workspace can view invoices, 
            bills, and chart of accounts. This module operates entirely independently from the standard Secure Expense Tracker (SET).
          </p>
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex overflow-x-auto no-scrollbar border-b border-slate-200 mb-6 pb-px gap-2">
          {[
            { id: 'invoices', label: 'Invoices', icon: FileText },
            { id: 'bills', label: 'Accounts Payable', icon: CreditCard },
            { id: 'reports', label: 'Chart of Accounts', icon: PieChart },
            { id: 'clients', label: 'Clients & Vendors', icon: Building2 },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className="px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-500 hover:text-slate-700 transition-all rounded-t-lg hover:bg-slate-50"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="invoices" className="outline-none"><Invoices /></Tabs.Content>

        <Tabs.Content value="bills" className="outline-none"><Bills /></Tabs.Content>

        <Tabs.Content value="reports" className="outline-none"><ChartOfAccounts /></Tabs.Content>

        <Tabs.Content value="clients" className="outline-none"><Clients /></Tabs.Content>

      </Tabs.Root>
    </div>
  );
}
