import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  FileText, 
  CreditCard, 
  PieChart,
  LayoutDashboard,
  BookOpen,
  Briefcase
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';

// Sub-pages
import ERPDashboard from './erp/ERPDashboard';
import JournalEntries from './erp/JournalEntries';
import ChartOfAccounts from './erp/ChartOfAccounts';
import FinancialReports from './erp/FinancialReports';
import Invoices from './erp/Invoices';
import Bills from './erp/Bills';
import Clients from './erp/Clients';

export default function Bookkeeping() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md"> 
               <Briefcase className="w-5 h-5 text-white" />
            </div>
            LedgerPro ERP
          </h1>
          <p className="text-slate-500 mt-2 text-sm">Professional double-entry accounting and financial management suite.</p>
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex overflow-x-auto no-scrollbar border-b border-slate-200 mb-8 pb-px gap-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'journal', label: 'Journal Entries', icon: BookOpen },
            { id: 'coa', label: 'Chart of Accounts', icon: PieChart },
            { id: 'reports', label: 'Financial Reports', icon: FileText },
            { id: 'invoices', label: 'Invoices (A/R)', icon: FileText },
            { id: 'bills', label: 'Bills (A/P)', icon: CreditCard },
            { id: 'clients', label: 'Directory', icon: Building2 },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className={`pb-3 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 transition-all
                data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 
                data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-500 hover:text-slate-700`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="mt-4">
          <Tabs.Content value="dashboard" className="outline-none"><ERPDashboard /></Tabs.Content>
          <Tabs.Content value="journal" className="outline-none"><JournalEntries /></Tabs.Content>
          <Tabs.Content value="coa" className="outline-none"><ChartOfAccounts /></Tabs.Content>
          <Tabs.Content value="reports" className="outline-none"><FinancialReports /></Tabs.Content>
          <Tabs.Content value="invoices" className="outline-none"><Invoices /></Tabs.Content>
          <Tabs.Content value="bills" className="outline-none"><Bills /></Tabs.Content>
          <Tabs.Content value="clients" className="outline-none"><Clients /></Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
