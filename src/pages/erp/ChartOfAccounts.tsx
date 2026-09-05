import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, PieChart, Search, Loader2 } from 'lucide-react';

export default function ChartOfAccounts() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [type, setType] = useState('Asset');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0.00');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, `erp_workspaces/${currentUser.uid}/accounts`));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setAccounts(data.sort((a, b) => a.code.localeCompare(b.code)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `erp_workspaces/${currentUser.uid}/accounts`), {
        type, code, name, balance: parseFloat(balance) || 0,
        createdAt: serverTimestamp(),
      });
      setIsFormOpen(false);
      setCode(''); setName(''); setBalance('0.00');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      await deleteDoc(doc(db, `erp_workspaces/${currentUser!.uid}/accounts`, id));
    }
  };

  const filtered = accounts.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search accounts..." 
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none">
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Code</label>
            <input required type="text" placeholder="e.g. 1000" value={code} onChange={e => setCode(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Name</label>
            <input required type="text" placeholder="e.g. Cash" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Balance</label>
            <input required type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <div className="col-span-full flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Account
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <PieChart className="w-12 h-12 text-slate-300 mb-3" />
            <p>No accounts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Account Name</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Balance</th>
                  <th className="px-5 py-3 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-500">{a.code}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 text-sm">{a.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                        ${a.type === 'Asset' ? 'bg-blue-50 text-blue-700' : 
                          a.type === 'Liability' ? 'bg-red-50 text-red-700' : 
                          a.type === 'Equity' ? 'bg-purple-50 text-purple-700' : 
                          a.type === 'Revenue' ? 'bg-emerald-50 text-emerald-700' : 
                          'bg-orange-50 text-orange-700'}`}>
                        {a.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900 text-sm">
                      ${a.balance?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDelete(a.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
