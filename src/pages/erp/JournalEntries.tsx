import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Search, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export default function JournalEntries() {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([{ account: '', desc: '', debit: '', credit: '' }, { account: '', desc: '', debit: '', credit: '' }]);
  
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, `erp_workspaces/${currentUser.uid}/journal_entries`));
    const unsub = onSnapshot(q, snap => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setEntries(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const totalDebit = lines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!isBalanced) return alert('Debits and Credits must be equal!');
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `erp_workspaces/${currentUser.uid}/journal_entries`), {
        date,
        reference,
        description,
        lines: lines.map(l => ({
          account: l.account,
          desc: l.desc,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0
        })),
        totalAmount: totalDebit,
        status: 'Posted',
        createdAt: serverTimestamp(),
      });
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().substring(0, 10));
    setReference('');
    setDescription('');
    setLines([{ account: '', desc: '', debit: '', credit: '' }, { account: '', desc: '', debit: '', credit: '' }]);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this journal entry?')) {
      await deleteDoc(doc(db, `erp_workspaces/${currentUser!.uid}/journal_entries`, id));
    }
  };

  const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage));
  const paginatedEntries = entries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">General Journal</h2>
          <p className="text-sm text-slate-500">Manage double-entry bookkeeping records</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Entry</span>
          </button>
        </div>
      </div>
      
      {isFormOpen && (
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reference</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. INV-001" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Memo / Description</label>
                <input required type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Journal entry description" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-100 px-4 py-2 grid grid-cols-12 gap-4 text-xs font-bold text-slate-700 uppercase">
                <div className="col-span-4">Account</div>
                <div className="col-span-4">Line Description</div>
                <div className="col-span-2 text-right">Debit</div>
                <div className="col-span-2 text-right">Credit</div>
              </div>
              <div className="p-4 space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4 flex gap-2">
                      <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                      <input required type="text" value={line.account} onChange={e => { const n = [...lines]; n[i].account = e.target.value; setLines(n); }} placeholder="Account Code/Name" className="w-full p-2 border border-slate-200 rounded text-sm" />
                    </div>
                    <div className="col-span-4">
                      <input type="text" value={line.desc} onChange={e => { const n = [...lines]; n[i].desc = e.target.value; setLines(n); }} placeholder="Description (optional)" className="w-full p-2 border border-slate-200 rounded text-sm" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" step="0.01" value={line.debit} onChange={e => { const n = [...lines]; n[i].debit = e.target.value; n[i].credit = ''; setLines(n); }} placeholder="0.00" className="w-full p-2 border border-slate-200 rounded text-right text-sm" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" step="0.01" value={line.credit} onChange={e => { const n = [...lines]; n[i].credit = e.target.value; n[i].debit = ''; setLines(n); }} placeholder="0.00" className="w-full p-2 border border-slate-200 rounded text-right text-sm" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start gap-4">
                <button type="button" onClick={() => setLines([...lines, { account: '', desc: '', debit: '', credit: '' }])} className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus className="w-4 h-4"/> Add Row</button>
                <div className="w-full md:w-64 space-y-2 text-sm font-medium">
                  <div className="flex justify-between text-slate-600"><span>Total Debit:</span> <span>${totalDebit.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Total Credit:</span> <span>${totalCredit.toFixed(2)}</span></div>
                  <div className={`flex justify-between pt-2 border-t text-base ${isBalanced ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}`}>
                    <span>Difference:</span> <span>${Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={isSubmitting || !isBalanced} className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Ref</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No journal entries found.</td></tr>
            ) : (
              paginatedEntries.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-900">{e.date}</td>
                  <td className="px-6 py-4 text-slate-500">{e.reference || '-'}</td>
                  <td className="px-6 py-4 text-slate-700">{e.description}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">${(e.totalAmount || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(e.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {entries.length > 0 && (
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl text-sm">
          <span className="text-slate-500">
            Showing <span className="font-medium text-slate-900">{entries.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium text-slate-900">{Math.min(currentPage * itemsPerPage, entries.length)}</span> of <span className="font-medium text-slate-900">{entries.length}</span> entries
          </span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
