import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { FileText, Download } from 'lucide-react';

export default function FinancialReports() {
  const { currentUser } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsubInvoices = onSnapshot(query(collection(db, `erp_workspaces/${currentUser.uid}/invoices`)), snap => {
      const data: any[] = [];
      snap.forEach(d => data.push(d.data()));
      setInvoices(data);
    });
    const unsubBills = onSnapshot(query(collection(db, `erp_workspaces/${currentUser.uid}/bills`)), snap => {
      const data: any[] = [];
      snap.forEach(d => data.push(d.data()));
      setBills(data);
      setLoading(false);
    });
    return () => { unsubInvoices(); unsubBills(); };
  }, [currentUser]);

  const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.subtotal || 0), 0);
  const totalCOGS = bills.filter(b => b.vendorName?.toLowerCase().includes('supplier') || b.vendorName?.toLowerCase().includes('vendor')).reduce((acc, b) => acc + (b.subtotal || 0), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const totalExpenses = bills.filter(b => !b.vendorName?.toLowerCase().includes('supplier') && !b.vendorName?.toLowerCase().includes('vendor')).reduce((acc, b) => acc + (b.subtotal || 0), 0);
  const netIncome = grossProfit - totalExpenses;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Reports</h2>
          <p className="text-slate-500 mt-1">Income statement and balance sheet summaries.</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Income Statement (Profit & Loss)
          </h3>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">For the Year to Date</p>
        </div>
        
        <div className="p-6">
          <table className="w-full text-sm">
            <tbody>
              {/* Revenue */}
              <tr><td className="font-bold text-slate-900 pb-2 text-base" colSpan={2}>Revenue</td></tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-600 pl-4">Sales Revenue</td>
                <td className="py-3 text-right font-medium text-slate-900">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="py-3 font-bold text-slate-900 pl-4">Total Revenue</td>
                <td className="py-3 text-right font-bold text-slate-900">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>

              {/* COGS */}
              <tr><td className="font-bold text-slate-900 pt-6 pb-2 text-base" colSpan={2}>Cost of Goods Sold</td></tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-600 pl-4">Direct Materials & Supplies</td>
                <td className="py-3 text-right font-medium text-slate-900">${totalCOGS.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="py-3 font-bold text-slate-900 pl-4">Total Cost of Goods Sold</td>
                <td className="py-3 text-right font-bold text-slate-900">${totalCOGS.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>

              {/* Gross Profit */}
              <tr className="border-t-2 border-slate-200">
                <td className="py-4 font-black text-slate-900 text-base">Gross Profit</td>
                <td className="py-4 text-right font-black text-slate-900 text-base">${grossProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>

              {/* Operating Expenses */}
              <tr><td className="font-bold text-slate-900 pt-6 pb-2 text-base" colSpan={2}>Operating Expenses</td></tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-600 pl-4">General & Administrative</td>
                <td className="py-3 text-right font-medium text-slate-900">${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="py-3 font-bold text-slate-900 pl-4">Total Operating Expenses</td>
                <td className="py-3 text-right font-bold text-slate-900">${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>

              {/* Net Income */}
              <tr className="border-t-2 border-slate-900 bg-slate-900 text-white">
                <td className="py-4 font-black text-lg px-4 rounded-l-lg">Net Income</td>
                <td className="py-4 text-right font-black text-lg px-4 rounded-r-lg">${netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
