import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';

export default function ChartOfAccounts() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Asset');
  const [balance, setBalance] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, `erp_workspaces/${currentUser.uid}/accounts`));
    const unsub = onSnapshot(q, snap => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setAccounts(data.sort((a, b) => a.code.localeCompare(b.code)));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `erp_workspaces/${currentUser.uid}/accounts`), {
        code,
        name,
        type,
        balance: parseFloat(balance) || 0,
        createdAt: serverTimestamp(),
      });
      setIsFormOpen(false);
      setCode(''); setName(''); setType('Asset'); setBalance('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this account?')) {
      await deleteDoc(doc(db, `erp_workspaces/${currentUser!.uid}/accounts`, id));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Chart of Accounts</h2>
          <p className="text-sm text-slate-500">Manage your general ledger accounts</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Account</span>
          </button>
        </div>
      </div>
      
      {isFormOpen && (
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Account Code</label>
                <input required type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. 1000" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Account Name</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cash in Bank" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Account Type</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                  <option>Asset</option>
                  <option>Liability</option>
                  <option>Equity</option>
                  <option>Revenue</option>
                  <option>Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Initial Balance</label>
                <input required type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm text-right" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Account'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-6 py-4">Account Code</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4 text-right">Balance</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No accounts configured yet.</td></tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-900">{acc.code}</td>
                  <td className="px-6 py-4 text-slate-700">{acc.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      acc.type === 'Asset' ? 'bg-emerald-100 text-emerald-800' :
                      acc.type === 'Liability' ? 'bg-rose-100 text-rose-800' :
                      acc.type === 'Equity' ? 'bg-purple-100 text-purple-800' :
                      acc.type === 'Revenue' ? 'bg-blue-100 text-blue-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {acc.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">${(acc.balance || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(acc.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
