import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, FileText, Search, Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function Invoices() {
  const { currentUser } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [status, setStatus] = useState('Draft');
  const [lineItems, setLineItems] = useState([{ desc: '', amount: '' }]);
  
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch Clients
    const qClients = query(collection(db, `erp_workspaces/${currentUser.uid}/contacts`), where('type', '==', 'client'));
    const unsubClients = onSnapshot(qClients, snap => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setClients(data);
    });

    // Fetch Invoices
    const qInvoices = query(collection(db, `erp_workspaces/${currentUser.uid}/invoices`));
    const unsubInvoices = onSnapshot(qInvoices, snap => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setInvoices(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    });

    return () => { unsubClients(); unsubInvoices(); };
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const total = lineItems.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
      const client = clients.find(c => c.id === clientId);
      
      await addDoc(collection(db, `erp_workspaces/${currentUser.uid}/invoices`), {
        number: invoiceNumber,
        clientId,
        clientName: client?.name || 'Unknown',
        date,
        status,
        lineItems: lineItems.map(li => ({ desc: li.desc, amount: parseFloat(li.amount) || 0 })),
        total,
        createdAt: serverTimestamp(),
      });
      setIsFormOpen(false);
      setInvoiceNumber(''); setClientId(''); setLineItems([{ desc: '', amount: '' }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      await deleteDoc(doc(db, `erp_workspaces/${currentUser!.uid}/invoices`, id));
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await updateDoc(doc(db, `erp_workspaces/${currentUser!.uid}/invoices`, id), { status: newStatus });
  };

  const filtered = invoices.filter(i => 
    i.number.toLowerCase().includes(search.toLowerCase()) || 
    i.clientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search invoices..." 
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20">
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number</label>
              <input required type="text" placeholder="INV-001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client</label>
              <select required value={clientId} onChange={e => setClientId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none">
                <option value="">Select a Client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none">
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Line Items</h4>
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex gap-3 mb-2">
                <input required type="text" placeholder="Description" value={item.desc} onChange={e => {
                  const newItems = [...lineItems]; newItems[idx].desc = e.target.value; setLineItems(newItems);
                }} className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
                <input required type="number" step="0.01" placeholder="Amount" value={item.amount} onChange={e => {
                  const newItems = [...lineItems]; newItems[idx].amount = e.target.value; setLineItems(newItems);
                }} className="w-32 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setLineItems([...lineItems, {desc: '', amount: ''}])} className="text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 mt-2">
              <Plus className="w-3 h-3"/> Add Item
            </button>
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <div className="text-lg font-bold text-slate-900">
              Total: ${lineItems.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0).toFixed(2)}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Invoice
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p>No invoices found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Total</th>
                  <th className="px-5 py-3 w-24 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-3 font-semibold text-slate-900 text-sm">{i.number}</td>
                    <td className="px-5 py-3 font-medium text-slate-700 text-sm">{i.clientName}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{i.date}</td>
                    <td className="px-5 py-3">
                      <select 
                        value={i.status}
                        onChange={(e) => updateStatus(i.id, e.target.value)}
                        className={`text-xs font-bold px-2 py-1 rounded-md outline-none cursor-pointer border
                          ${i.status === 'Draft' ? 'bg-slate-100 text-slate-700 border-slate-200' : 
                            i.status === 'Sent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                            'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900 text-sm">
                      ${i.total?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDelete(i.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100">
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
