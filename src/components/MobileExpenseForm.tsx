import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  CreditCard, 
  Tag, 
  Calendar, 
  DollarSign, 
  User, 
  FileText, 
  Check, 
  Sparkles 
} from 'lucide-react';
import { Expense, Category, PaymentMode, ConfiguredEmail } from '../types';
import { sampleReceipts } from '../data/initialData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expenseData: Omit<Expense, 'id' | 'rowNumber' | 'createdAt' | 'updatedAt' | 'lastEditedBy'>, isEditing?: boolean) => void;
  initialData?: Expense | null;
  configuredEmails: ConfiguredEmail[];
  currentSpenderName: string;
}

const CATEGORIES: Category[] = [
  'Food & Dining',
  'Groceries',
  'Rent & Housing',
  'Utilities',
  'Transportation',
  'Shopping',
  'Travel',
  'Entertainment',
  'Healthcare',
  'Work & Office',
  'Miscellaneous',
];

const PAYMENT_MODES: PaymentMode[] = [
  'UPI / GPay',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Apple Pay',
  'Net Banking',
  'Bank Transfer',
  'Other',
];

export const MobileExpenseForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  configuredEmails,
  currentSpenderName,
}) => {
  const isEditMode = !!initialData;

  const [amount, setAmount] = useState<string>(initialData ? String(initialData.amount) : '');
  const [currency, setCurrency] = useState<string>(initialData ? initialData.currency : '$');
  const [description, setDescription] = useState<string>(initialData?.description || '');
  const [category, setCategory] = useState<string>(initialData?.category || '');
  const [paymentMode, setPaymentMode] = useState<string>(initialData?.paymentMode || '');
  const [spenderName, setSpenderName] = useState<string>(initialData?.spenderName || currentSpenderName);
  const [spenderEmail, setSpenderEmail] = useState<string>(initialData?.spenderEmail || '');
  const [date, setDate] = useState<string>(
    initialData?.date || new Date().toISOString().split('T')[0]
  );
  const [receiptImage, setReceiptImage] = useState<string | undefined>(initialData?.receiptImage);
  const [notes, setNotes] = useState<string>(initialData?.notes || '');
  const [validationError, setValidationError] = useState<string>('');

  // Sync state whenever initialData or isOpen changes
  useEffect(() => {
    if (initialData) {
      setAmount(String(initialData.amount));
      setCurrency(initialData.currency || '$');
      setDescription(initialData.description || '');
      setCategory(initialData.category || '');
      setPaymentMode(initialData.paymentMode || '');
      setSpenderName(initialData.spenderName || currentSpenderName);
      setSpenderEmail(initialData.spenderEmail || '');
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setReceiptImage(initialData.receiptImage);
      setNotes(initialData.notes || '');
    } else {
      setAmount('');
      setCurrency('$');
      setDescription('');
      setCategory('');
      setPaymentMode('');
      setSpenderName(currentSpenderName);
      setSpenderEmail('');
      setDate(new Date().toISOString().split('T')[0]);
      setReceiptImage(undefined);
      setNotes('');
    }
    setValidationError('');
  }, [initialData, currentSpenderName, isOpen]);

  // Auto-sync email when spender changes
  useEffect(() => {
    const matched = configuredEmails.find((c) => c.name === spenderName);
    if (matched) {
      setSpenderEmail(matched.email);
    } else if (!spenderEmail) {
      setSpenderEmail('pujaribadrinath@gmail.com');
    }
  }, [spenderName, configuredEmails, spenderEmail]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Image must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
      setValidationError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Please enter a valid positive expense amount.');
      return;
    }

    setValidationError('');
    onSubmit(
      {
        date: date || new Date().toISOString().split('T')[0],
        spenderName: spenderName.trim() || 'Pujari Badrinath',
        spenderEmail: spenderEmail.trim() || 'pujaribadrinath@gmail.com',
        amount: Math.round(parsedAmount * 100) / 100,
        currency,
        description: description.trim(),
        category: category.trim(),
        paymentMode: paymentMode.trim(),
        receiptImage,
        notes: notes.trim(),
      },
      isEditMode
    );
  };

  return (
    <div
      id="mobile-expense-form-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="mobile-expense-form-card"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg">
                {isEditMode ? `Edit Expense #${initialData.rowNumber}` : 'Record New Expense'}
              </h2>
              <p className="text-xs text-slate-400">
                Syncs with shared spreadsheet & alerts all members
              </p>
            </div>
          </div>
          <button
            id="btn-close-form"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold">
              {validationError}
            </div>
          )}

          {/* Amount & Currency */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Expense Amount <span className="text-rose-500">*</span>
            </label>
            <div className="flex rounded-xl shadow-xs border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 overflow-hidden">
              <select
                id="form-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-slate-50 px-3 py-2.5 font-bold text-slate-700 border-r border-slate-300 focus:outline-hidden text-sm"
              >
                <option value="$">$ USD</option>
                <option value="₹">₹ INR</option>
                <option value="€">€ EUR</option>
                <option value="£">£ GBP</option>
              </select>
              <input
                id="form-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 text-xl font-extrabold text-slate-900 focus:outline-hidden"
                autoFocus={!isEditMode}
                required
              />
            </div>
          </div>

          {/* Spender / Who paid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                <User className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                Spender / Paid By
              </label>
              <select
                id="form-spender"
                value={spenderName}
                onChange={(e) => setSpenderName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800"
              >
                {configuredEmails.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                Expense Date
              </label>
              <input
                id="form-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* What money was spent on (Description) - Optional */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                For What Money Spent (Description)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Optional</span>
            </div>
            <input
              id="form-description"
              type="text"
              placeholder="e.g., Team lunch, WiFi bill, Project supplies..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800"
            />
          </div>

          {/* Category & Payment Mode (Both Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Category
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Optional</span>
              </div>
              <select
                id="form-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
              >
                <option value="">-- Select Category --</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <CreditCard className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Payment Mode
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Optional</span>
              </div>
              <select
                id="form-payment-mode"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
              >
                <option value="">-- Select Payment Mode --</option>
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Proof of Image (Optional) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                Proof of Image / Receipt
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Optional</span>
            </div>

            {receiptImage ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <img
                  src={receiptImage}
                  alt="Receipt Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-emerald-300 shadow-xs bg-white"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Receipt Image Attached
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Proof ready to attach to spreadsheet</p>
                </div>
                <button
                  id="btn-remove-receipt"
                  type="button"
                  onClick={() => setReceiptImage(undefined)}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove Receipt"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50/50 hover:bg-emerald-50/20 cursor-pointer transition-colors group">
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 mb-1 transition-colors" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-800">
                    Upload receipt photo or invoice
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, SVG up to 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* Quick preset receipt buttons for instantaneous testing */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Quick samples:
                  </span>
                  <button
                    type="button"
                    onClick={() => setReceiptImage(sampleReceipts.grocery)}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    Grocery Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptImage(sampleReceipts.dinner)}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    Bistro Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptImage(sampleReceipts.internet)}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    Fiber Bill
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notes (Optional) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Notes & Additional Details
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Optional</span>
            </div>
            <textarea
              id="form-notes"
              rows={2}
              placeholder="Add any specific context, split information, or tag..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* In-Sheet Confirmation Note */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
            <span>🛡️</span>
            <span>
              <strong>Confirmation Guard:</strong> Clicking submit will prompt an in-sheet confirmation popup before broadcasting changes.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              id="btn-form-cancel"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-form-submit"
              type="submit"
              className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all transform active:scale-95 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isEditMode ? 'Request Update & Confirm' : 'Submit for Confirmation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
