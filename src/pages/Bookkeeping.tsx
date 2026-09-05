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

        <Tabs.Content value="invoices" className="outline-none space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search invoices by # or client..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20">
                <Plus className="w-4 h-4" /> Create Invoice
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex items-center justify-center">
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-100 shadow-inner">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight">No Invoices Found</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                You haven't generated any professional invoices yet. Once created, they will be securely stored and isolated within this workspace.
              </p>
              <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
                <Plus className="w-4 h-4" /> Generate First Invoice
              </button>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="bills" className="outline-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
             <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-100 shadow-inner">
               <CreditCard className="w-10 h-10 text-slate-300" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 tracking-tight">Accounts Payable</h3>
             <p className="text-slate-500 text-sm mt-2 max-w-sm">Track and manage vendor bills, recurring payments, and supplier credits here.</p>
          </div>
        </Tabs.Content>

        <Tabs.Content value="reports" className="outline-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
             <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-100 shadow-inner">
               <PieChart className="w-10 h-10 text-slate-300" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 tracking-tight">Chart of Accounts</h3>
             <p className="text-slate-500 text-sm mt-2 max-w-sm">Manage standard accounting codes, ledgers, and structural hierarchies for CA review.</p>
          </div>
        </Tabs.Content>

        <Tabs.Content value="clients" className="outline-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
             <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-100 shadow-inner">
               <Building2 className="w-10 h-10 text-slate-300" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 tracking-tight">Clients & Vendors Database</h3>
             <p className="text-slate-500 text-sm mt-2 max-w-sm">Manage strictly isolated contacts, terms, and tax IDs for this professional workspace.</p>
          </div>
        </Tabs.Content>

      </Tabs.Root>
    </div>
  );
}
