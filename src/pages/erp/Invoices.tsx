import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, FileText, Search, Loader2, ArrowRight, UserPlus, X } from 'lucide-react';
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
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('Draft');
  const [lineItems, setLineItems] = useState([{ desc: '', quantity: 1, unitPrice: '', amount: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  
  // New Client Modal State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    
    const qClients = query(collection(db, `erp_workspaces/${currentUser.uid}/contacts`), where('type', '==', 'client'));
    const unsubClients = onSnapshot(qClients, snap => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setClients(data);
    });

    const qInvoices = query(collection(db, `erp_workspaces/${currentUser.uid}/invoices`));
    const unsubInvoices = onSnapshot(qInvoices, snap => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setInvoices(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    });

    return () => { unsubClients(); unsubInvoices(); };
  }, [currentUser]);

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...lineItems];
    (newItems[index] as any)[field] = value;
    
    if (field === 'quantity' || field === 'unitPrice') {
      const q = parseFloat(newItems[index].quantity as any) || 0;
      const p = parseFloat(newItems[index].unitPrice as any) || 0;
      newItems[index].amount = q * p;
    }
    setLineItems(newItems);
  };

  const addLineItem = () => setLineItems([...lineItems, { desc: '', quantity: 1, unitPrice: '', amount: 0 }]);
  const removeLineItem = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));

  const subtotal = lineItems.reduce((acc, curr) => acc + curr.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !clientId) return alert('Please select a client');
    setIsSubmitting(true);
    try {
      const client = clients.find(c => c.id === clientId);
      await addDoc(collection(db, `erp_workspaces/${currentUser.uid}/invoices`), {
        number: invoiceNumber,
        clientId,
        clientName: client?.name || 'Unknown',
        date,
        dueDate,
        status,
        lineItems,
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes,
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
    setInvoiceNumber('');
    setClientId('');
    setDate(new Date().toISOString().substring(0, 10));
    setDueDate('');
    setLineItems([{ desc: '', quantity: 1, unitPrice: '', amount: 0 }]);
    setTaxRate(0);
    setNotes('');
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newClientName) return;
    try {
      const docRef = await addDoc(collection(db, `erp_workspaces/${currentUser.uid}/contacts`), {
        name: newClientName,
        email: newClientEmail,
        type: 'client',
        createdAt: serverTimestamp()
      });
      setClientId(docRef.id);
      setIsClientModalOpen(false);
      setNewClientName('');
      setNewClientEmail('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      await deleteDoc(doc(db, `erp_workspaces/${currentUser!.uid}/invoices`, id));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Invoices (Accounts Receivable)</h2>
          <p className="text-sm text-slate-500">Manage client billing and outstanding revenue</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Invoice</span>
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Invoice Number</label>
                <input required type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm" placeholder="INV-001" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Client</label>
                <select required value={clientId} onChange={e => {
                  if (e.target.value === 'NEW') setIsClientModalOpen(true);
                  else setClientId(e.target.value);
                }} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm">
                  <option value="">Select Client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="NEW" className="font-bold text-blue-600">+ Add New Client</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm">
                  <option>Draft</option>
                  <option>Sent</option>
                  <option>Paid</option>
                  <option>Overdue</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Issue Date</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-100 px-4 py-2 grid grid-cols-12 gap-4 text-xs font-bold text-slate-700 uppercase">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              <div className="p-4 space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6 flex gap-2">
                      <button type="button" onClick={() => removeLineItem(index)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                      <input required type="text" value={item.desc} onChange={e => handleLineItemChange(index, 'desc', e.target.value)} placeholder="Item description" className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-slate-900 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <input required type="number" min="1" value={item.quantity} onChange={e => handleLineItemChange(index, 'quantity', e.target.value)} className="w-full p-2 border border-slate-200 rounded text-right text-sm" />
                    </div>
                    <div className="col-span-2">
                      <input required type="number" step="0.01" value={item.unitPrice} onChange={e => handleLineItemChange(index, 'unitPrice', e.target.value)} placeholder="0.00" className="w-full p-2 border border-slate-200 rounded text-right text-sm" />
                    </div>
                    <div className="col-span-2 text-right font-medium text-slate-900 text-sm">
                      ${item.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-start">
                <button type="button" onClick={addLineItem} className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus className="w-4 h-4"/> Add Line Item</button>
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Subtotal:</span> <span>${subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Tax Rate (%):</span> 
                    <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="w-16 p-1 border border-slate-200 rounded text-right" />
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 text-base"><span>Total:</span> <span>${total.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Notes / Terms</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="Payment terms, thank you note, etc." />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Client Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2"><UserPlus className="w-5 h-5"/> Add New Client</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddClient} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Company / Client Name</label>
                <input required type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email Address</label>
                <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-6 py-4">Invoice No.</th>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Issue Date</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No invoices generated yet.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-900">{inv.number}</td>
                  <td className="px-6 py-4 text-slate-700">{inv.clientName}</td>
                  <td className="px-6 py-4 text-slate-500">{inv.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                      inv.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                      inv.status === 'Overdue' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-900 font-bold">${(inv.total || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(inv.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors">
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
