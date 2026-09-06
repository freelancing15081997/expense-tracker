import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { Receipt, ArrowUpRight, ArrowDownRight, Loader2, ArrowLeftRight, BookOpen } from 'lucide-react';

export default function AllExpenses() {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchAllExpenses = async () => {
      try {
        const qBooks = query(collection(db, 'books'), where(`roles.${currentUser.uid}.role`, 'in', ['owner', 'admin', 'contributor', 'viewer', 'auditor']));
        const bookSnaps = await getDocs(qBooks);
        
        let allExps: any[] = [];
        
        for (const b of bookSnaps.docs) {
          if (b.data().roles && b.data().roles[currentUser.uid] && ['owner', 'admin', 'contributor', 'viewer', 'auditor'].includes(b.data().roles[currentUser.uid].role)) {
            const expSnap = await getDocs(collection(db, 'books', b.id, 'expenses'));
            expSnap.forEach(doc => {
              allExps.push({
                id: doc.id,
                bookId: b.id,
                bookName: b.data().name,
                currency: b.data().currency,
                ...doc.data()
              });
            });
          }
        }
        
        allExps.sort((a, b) => (b.date || b.createdAt?.toMillis() || 0) - (a.date || a.createdAt?.toMillis() || 0));
        setExpenses(allExps);
      } catch (err) {
        console.error("Failed to fetch all expenses:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllExpenses();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-zinc-700" />
          Books (Auditing)
        </h1>
        <p className="text-sm text-zinc-500">Global bookkeeping view across all ledgers for auditing purposes.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
            <p className="font-medium text-zinc-900">No records found</p>
            <p className="text-sm">Expenses and money inflows will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50/50 text-zinc-500 font-medium border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Added By</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                      {exp.date ? new Date(exp.date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {exp.bookName}
                    </td>
                    <td className="px-4 py-3 text-zinc-900">
                      {exp.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600">
                        {exp.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {exp.paidByName || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-medium">
                        {exp.entryType === 'in' ? (
                          <>
                            <span className="text-emerald-600">+{exp.currency} {exp.amount?.toFixed(2)}</span>
                            <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                          </>
                        ) : exp.entryType === 'transfer' ? (
                          <>
                            <span className="text-blue-600">{exp.currency} {exp.amount?.toFixed(2)}</span>
                            <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                          </>
                        ) : (
                          <>
                            <span className="text-red-600">-{exp.currency} {exp.amount?.toFixed(2)}</span>
                            <ArrowUpRight className="w-4 h-4 text-red-500" />
                          </>
                        )}
                      </div>
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
