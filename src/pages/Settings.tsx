import React, { useState } from 'react';
import { useAuth, UserProfile } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Save, Plus, X, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { userProfile } = useAuth();
  
  // Profile State
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [currency, setCurrency] = useState(userProfile?.defaultCurrency || 'INR');
  
  // Categories State
  const [categories, setCategories] = useState<string[]>(userProfile?.customCategories || []);
  const [newCategory, setNewCategory] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setLoading(true);
    setMessage('');
    setError('');
    
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        displayName,
        defaultCurrency: currency,
        customCategories: categories
      });
      setMessage('Settings updated successfully.');
    } catch (err: any) {
      console.error(err);
      setError('Failed to update settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = newCategory.trim();
    if (cat && !categories.includes(cat)) {
      setCategories([...categories, cat]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Application Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your profile, defaults, and custom fields.</p>
      </div>

      {message && (
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-md text-sm font-medium border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {message}
        </div>
      )}
      
      {error && (
        <div className="bg-rose-50 text-rose-800 p-3 rounded-md text-sm font-medium border border-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: General Settings */}
        <div className="lg:col-span-2 space-y-6">
          <form id="settings-form" onSubmit={handleSave} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-semibold text-slate-900">General Information</h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={userProfile?.email || ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Base Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full md:w-1/2 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="SGD">SGD (S$)</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500">This currency will be selected by default when creating new ledgers.</p>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Custom Categories */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-semibold text-slate-900">Custom Expense Categories</h2>
              <p className="text-xs text-slate-500 mt-1">Manage tags available when recording entries.</p>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="New category..."
                  className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button type="submit" disabled={!newCategory.trim()} className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                  <Plus className="w-4 h-4" />
                </button>
              </form>
              
              <div className="flex-1 min-h-[200px] border border-slate-200 rounded-md bg-slate-50 p-3 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No custom categories.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-700">
                        {cat}
                        <button type="button" onClick={() => handleRemoveCategory(cat)} className="text-slate-400 hover:text-rose-500 focus:outline-none">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button 
          type="submit" 
          form="settings-form"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm shadow-sm"
        >
          <Save className="w-4 h-4" />
          Save All Settings
        </button>
      </div>
    </div>
  );
}
