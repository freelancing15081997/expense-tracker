import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Building2, User, Phone, Mail, Search, Loader2 } from 'lucide-react';

export default function Clients() {
  const { currentUser } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [type, setType] = useState('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, `erp_workspaces/${currentUser.uid}/contacts`));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setContacts(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `erp_workspaces/${currentUser.uid}/contacts`), {
        type, name, email, phone, company,
        createdAt: serverTimestamp(),
      });
      setIsFormOpen(false);
      setName(''); setEmail(''); setPhone(''); setCompany('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      await deleteDoc(doc(db, `erp_workspaces/${currentUser!.uid}/contacts`, id));
    }
  };

  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search contacts..." 
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="col-span-full">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full sm:w-64 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none">
              <option value="client">Client (Customer)</option>
              <option value="vendor">Vendor (Supplier)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company (Optional)</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (Optional)</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <div className="col-span-full flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Contact
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <User className="w-12 h-12 text-slate-300 mb-3" />
            <p>No contacts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Name / Company</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact Info</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900 text-sm">{c.name}</div>
                      {c.company && <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3"/> {c.company}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-slate-600 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400"/> {c.email}</div>
                      {c.phone && <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><Phone className="w-3.5 h-3.5 text-slate-400"/> {c.phone}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${c.type === 'client' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100">
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
