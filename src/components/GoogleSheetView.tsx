import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  FileDown, 
  Filter, 
  Sparkles,
  Smartphone,
  Eye,
  Check,
  X,
  ExternalLink,
  HardDrive
} from 'lucide-react';
import { Expense, Category, PaymentMode, ConfiguredEmail } from '../types';
import { formatCurrency } from '../services/notificationEngine';
import { SpreadsheetInfo } from '../services/googleSheetsService';

interface Props {
  expenses: Expense[];
  configuredEmails: ConfiguredEmail[];
  currentSpenderName: string;
  spreadsheetInfo?: SpreadsheetInfo | null;
  onAddDirectlyInSheet: (newExpense: Omit<Expense, 'id' | 'rowNumber' | 'createdAt' | 'updatedAt' | 'lastEditedBy'>) => void;
  onEditCellDirectly: (expenseId: string, field: keyof Expense, oldValue: any, newValue: any, coordinate: string) => void;
  onDeleteExpense: (expense: Expense) => void;
  onOpenMobileForm: (expenseToEdit?: Expense) => void;
  onViewReceipt: (imageUrl: string, title: string) => void;
}

const CATEGORY_OPTIONS: Category[] = [
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

const PAYMENT_OPTIONS: PaymentMode[] = [
  'UPI / GPay',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Apple Pay',
  'Net Banking',
  'Bank Transfer',
  'Other',
];

export const GoogleSheetView: React.FC<Props> = ({
  expenses,
  configuredEmails,
  currentSpenderName,
  spreadsheetInfo,
  onAddDirectlyInSheet,
  onEditCellDirectly,
  onDeleteExpense,
  onOpenMobileForm,
  onViewReceipt,
}) => {
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; field: keyof Expense; coord: string } | null>({
    rowId: expenses[0]?.id || '',
    field: 'amount',
    coord: 'C2',
  });
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof Expense } | null>(null);
  const [tempCellValue, setTempCellValue] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [spenderFilter, setSpenderFilter] = useState<string>('ALL');
  const [sheetName] = useState<string>('Shared Expenses Q3 - Google Sheets');
  
  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Column letters mapping
  // A: Date, B: Spender, C: Amount, D: Description, E: Category, F: Payment Mode, G: Receipt, H: Last Edited
  const getColLetter = (field: keyof Expense): string => {
    switch (field) {
      case 'date': return 'A';
      case 'spenderName': return 'B';
      case 'amount': return 'C';
      case 'description': return 'D';
      case 'category': return 'E';
      case 'paymentMode': return 'F';
      case 'receiptImage': return 'G';
      case 'lastEditedBy': return 'H';
      default: return 'A';
    }
  };

  // Filtered expenses
  const filteredExpenses = expenses.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.spenderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.paymentMode?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesSpender = spenderFilter === 'ALL' || item.spenderName === spenderFilter;

    return matchesSearch && matchesCategory && matchesSpender;
  });

  // Calculate formula totals
  const totalAmount = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const averageAmount = expenses.length > 0 ? totalAmount / expenses.length : 0;

  // Selected cell value for formula bar
  const getSelectedCellValue = (): string => {
    if (!selectedCell) return '';
    const exp = expenses.find((e) => e.id === selectedCell.rowId);
    if (!exp) return '';
    const val = exp[selectedCell.field];
    return val !== undefined ? String(val) : '';
  };

  // Start inline editing
  const handleCellDoubleClick = (rowId: string, field: keyof Expense, coord: string, currentValue: any) => {
    setSelectedCell({ rowId, field, coord });
    setEditingCell({ rowId, field });
    setTempCellValue(currentValue !== undefined ? String(currentValue) : '');
  };

  // Commit inline edit -> triggers confirmation popup via onEditCellDirectly
  const commitInlineEdit = (exp: Expense, field: keyof Expense) => {
    if (!editingCell) return;
    const oldValue = exp[field];
    let newValue: any = tempCellValue.trim();

    if (field === 'amount') {
      const parsed = parseFloat(tempCellValue);
      if (isNaN(parsed) || parsed <= 0) {
        setEditingCell(null);
        return;
      }
      newValue = Math.round(parsed * 100) / 100;
    }

    setEditingCell(null);

    // Only prompt confirmation if value actually changed
    if (String(oldValue) !== String(newValue)) {
      const coord = `${getColLetter(field)}${exp.rowNumber + 1}`;
      onEditCellDirectly(exp.id, field, oldValue, newValue, coord);
    }
  };

  // Add row directly in sheet
  const handleDirectAddRow = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    onAddDirectlyInSheet({
      date: todayStr,
      spenderName: currentSpenderName || 'Pujari Badrinath',
      spenderEmail: 'pujaribadrinath@gmail.com',
      amount: 25.00,
      currency: '$',
      description: 'New direct expense entry',
      category: 'Food & Dining',
      paymentMode: 'UPI / GPay',
      notes: 'Added directly from Google Sheet grid',
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Row #', 'Date', 'Spender Name', 'Amount', 'Currency', 'Description', 'Category', 'Payment Mode', 'Notes', 'Last Edited By'];
    const rows = expenses.map((e) => [
      e.rowNumber,
      `"${e.date}"`,
      `"${e.spenderName}"`,
      e.amount,
      `"${e.currency}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.category || '').replace(/"/g, '""')}"`,
      `"${(e.paymentMode || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.lastEditedBy}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shared_expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="google-sheet-container" className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
      {/* 1. Google Sheets App Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm sm:text-base">
                {spreadsheetInfo ? spreadsheetInfo.title : sheetName}
              </span>
              {spreadsheetInfo ? (
                <a
                  href={spreadsheetInfo.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-full border border-emerald-300 inline-flex items-center gap-1 transition-colors"
                  title="Open live Google Spreadsheet in new tab"
                >
                  <span>Google Sheets Live</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                  Auto-Synced
                </span>
              )}
            </div>
            {/* Replaced standard spreadsheet menu with simpler status */}
            <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium mt-0.5">
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Broadcasts active
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-direct-add-row"
            onClick={handleDirectAddRow}
            className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors transform active:scale-95"
            title="Add row directly in spreadsheet table"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>

          <button
            id="btn-open-form-modal"
            onClick={() => onOpenMobileForm()}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            title="Open standard form for mobile-friendly input"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile Form</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
            title="Export to CSV / Excel"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Sheet Filters & Search */}
      <div className="bg-slate-100/80 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1.5" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-48 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Spender Filter */}
          <select
            id="filter-spender"
            value={spenderFilter}
            onChange={(e) => setSpenderFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="ALL">All Spenders</option>
            {configuredEmails.map((cfg) => (
              <option key={cfg.id} value={cfg.name}>{cfg.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="ALL">All Categories</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search sheet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2 py-1 text-[11px] bg-white border border-slate-300 rounded focus:outline-hidden focus:border-emerald-500 w-32 sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* 3. Formula Bar */}
      <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center gap-2 text-xs">
        <div className="w-12 px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-center text-slate-700">
          {selectedCell ? selectedCell.coord : 'A1'}
        </div>
        <div className="font-bold text-slate-400 font-serif italic">fx</div>
        <div className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono text-xs overflow-x-auto whitespace-nowrap">
          {getSelectedCellValue() || 'Double-click any cell in the table below to edit directly (with confirmation popup)'}
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Double-click cell to edit • Press Enter to confirm
        </span>
      </div>

      {/* 4. Google Sheets Table Grid */}
      <div className="overflow-x-auto max-h-[560px] relative scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs select-none">
          {/* Column Headers with Spreadsheet Letters */}
          <thead className="sticky top-0 bg-slate-100 z-10 text-slate-600 font-bold border-b border-slate-300">
            <tr>
              <th className="w-10 px-2 py-2 text-center border-r border-slate-300 bg-slate-200/80 text-[11px]">#</th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[105px]">
                <div className="text-[10px] text-slate-400 font-mono">A</div>
                Date
              </th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[140px]">
                <div className="text-[10px] text-slate-400 font-mono">B</div>
                Spender
              </th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[110px] text-right">
                <div className="text-[10px] text-slate-400 font-mono">C</div>
                Amount
              </th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[200px]">
                <div className="text-[10px] text-slate-400 font-mono">D</div>
                For What Money Spent
              </th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[130px]">
                <div className="text-[10px] text-slate-400 font-mono">E</div>
                Category
              </th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[125px]">
                <div className="text-[10px] text-slate-400 font-mono">F</div>
                Payment Mode
              </th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[110px] text-center">
                <div className="text-[10px] text-slate-400 font-mono">G</div>
                Proof (Receipt)
              </th>
              <th className="px-3 py-2 border-r border-slate-300 min-w-[130px]">
                <div className="text-[10px] text-slate-400 font-mono">H</div>
                Last Edited By
              </th>
              <th className="px-3 py-2 text-center min-w-[90px] bg-slate-100">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200">
            {filteredExpenses.map((exp, idx) => {
              const rowCoordNum = idx + 2;

              return (
                <tr
                  key={exp.id}
                  className={`hover:bg-emerald-50/30 transition-colors group ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  }`}
                >
                  {/* Row Number */}
                  <td className="px-2 py-2 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-[11px] text-slate-500 font-medium">
                    {idx + 1}
                  </td>

                  {/* A: Date */}
                  <td
                    onClick={() => setSelectedCell({ rowId: exp.id, field: 'date', coord: `A${rowCoordNum}` })}
                    onDoubleClick={() => handleCellDoubleClick(exp.id, 'date', `A${rowCoordNum}`, exp.date)}
                    className={`px-3 py-2 border-r border-slate-200 font-mono text-slate-700 cursor-cell relative ${
                      selectedCell?.rowId === exp.id && selectedCell?.field === 'date'
                        ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    {editingCell?.rowId === exp.id && editingCell?.field === 'date' ? (
                      <input
                        ref={editInputRef as any}
                        type="date"
                        value={tempCellValue}
                        onChange={(e) => setTempCellValue(e.target.value)}
                        onBlur={() => commitInlineEdit(exp, 'date')}
                        onKeyDown={(e) => e.key === 'Enter' && commitInlineEdit(exp, 'date')}
                        className="w-full bg-white border border-emerald-500 rounded px-1 py-0.5 text-xs focus:outline-hidden"
                        autoFocus
                      />
                    ) : (
                      <span>{exp.date}</span>
                    )}
                  </td>

                  {/* B: Spender */}
                  <td
                    onClick={() => setSelectedCell({ rowId: exp.id, field: 'spenderName', coord: `B${rowCoordNum}` })}
                    onDoubleClick={() => handleCellDoubleClick(exp.id, 'spenderName', `B${rowCoordNum}`, exp.spenderName)}
                    className={`px-3 py-2 border-r border-slate-200 font-medium text-slate-900 cursor-cell relative ${
                      selectedCell?.rowId === exp.id && selectedCell?.field === 'spenderName'
                        ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    {editingCell?.rowId === exp.id && editingCell?.field === 'spenderName' ? (
                      <select
                        ref={editInputRef as any}
                        value={tempCellValue}
                        onChange={(e) => setTempCellValue(e.target.value)}
                        onBlur={() => commitInlineEdit(exp, 'spenderName')}
                        className="w-full bg-white border border-emerald-500 rounded px-1 py-0.5 text-xs focus:outline-hidden"
                        autoFocus
                      >
                        {configuredEmails.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                          {exp.spenderName.charAt(0)}
                        </span>
                        <span className="truncate">{exp.spenderName}</span>
                      </div>
                    )}
                  </td>

                  {/* C: Amount */}
                  <td
                    onClick={() => setSelectedCell({ rowId: exp.id, field: 'amount', coord: `C${rowCoordNum}` })}
                    onDoubleClick={() => handleCellDoubleClick(exp.id, 'amount', `C${rowCoordNum}`, exp.amount)}
                    className={`px-3 py-2 border-r border-slate-200 font-mono font-bold text-right cursor-cell relative ${
                      selectedCell?.rowId === exp.id && selectedCell?.field === 'amount'
                        ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    {editingCell?.rowId === exp.id && editingCell?.field === 'amount' ? (
                      <input
                        ref={editInputRef as any}
                        type="number"
                        step="0.01"
                        value={tempCellValue}
                        onChange={(e) => setTempCellValue(e.target.value)}
                        onBlur={() => commitInlineEdit(exp, 'amount')}
                        onKeyDown={(e) => e.key === 'Enter' && commitInlineEdit(exp, 'amount')}
                        className="w-full bg-white border border-emerald-500 rounded px-1 py-0.5 text-xs text-right focus:outline-hidden font-bold"
                        autoFocus
                      />
                    ) : (
                      <span className="text-emerald-700">{formatCurrency(exp.amount, exp.currency)}</span>
                    )}
                  </td>

                  {/* D: For What Money Spent (Description) */}
                  <td
                    onClick={() => setSelectedCell({ rowId: exp.id, field: 'description', coord: `D${rowCoordNum}` })}
                    onDoubleClick={() => handleCellDoubleClick(exp.id, 'description', `D${rowCoordNum}`, exp.description)}
                    className={`px-3 py-2 border-r border-slate-200 text-slate-800 cursor-cell relative ${
                      selectedCell?.rowId === exp.id && selectedCell?.field === 'description'
                        ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    {editingCell?.rowId === exp.id && editingCell?.field === 'description' ? (
                      <input
                        ref={editInputRef as any}
                        type="text"
                        value={tempCellValue}
                        onChange={(e) => setTempCellValue(e.target.value)}
                        onBlur={() => commitInlineEdit(exp, 'description')}
                        onKeyDown={(e) => e.key === 'Enter' && commitInlineEdit(exp, 'description')}
                        className="w-full bg-white border border-emerald-500 rounded px-1.5 py-0.5 text-xs focus:outline-hidden"
                        autoFocus
                      />
                    ) : (
                      <div className="truncate max-w-xs font-normal" title={exp.description || 'No description'}>
                        {exp.description || <span className="text-slate-400 italic">Optional / empty</span>}
                      </div>
                    )}
                  </td>

                  {/* E: Category */}
                  <td
                    onClick={() => setSelectedCell({ rowId: exp.id, field: 'category', coord: `E${rowCoordNum}` })}
                    onDoubleClick={() => handleCellDoubleClick(exp.id, 'category', `E${rowCoordNum}`, exp.category)}
                    className={`px-3 py-2 border-r border-slate-200 cursor-cell relative ${
                      selectedCell?.rowId === exp.id && selectedCell?.field === 'category'
                        ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    {editingCell?.rowId === exp.id && editingCell?.field === 'category' ? (
                      <select
                        ref={editInputRef as any}
                        value={tempCellValue}
                        onChange={(e) => setTempCellValue(e.target.value)}
                        onBlur={() => commitInlineEdit(exp, 'category')}
                        className="w-full bg-white border border-emerald-500 rounded px-1 py-0.5 text-xs focus:outline-hidden"
                        autoFocus
                      >
                        <option value="">None / Other</option>
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate">
                        {exp.category || 'Uncategorized'}
                      </span>
                    )}
                  </td>

                  {/* F: Payment Mode */}
                  <td
                    onClick={() => setSelectedCell({ rowId: exp.id, field: 'paymentMode', coord: `F${rowCoordNum}` })}
                    onDoubleClick={() => handleCellDoubleClick(exp.id, 'paymentMode', `F${rowCoordNum}`, exp.paymentMode)}
                    className={`px-3 py-2 border-r border-slate-200 cursor-cell relative ${
                      selectedCell?.rowId === exp.id && selectedCell?.field === 'paymentMode'
                        ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    {editingCell?.rowId === exp.id && editingCell?.field === 'paymentMode' ? (
                      <select
                        ref={editInputRef as any}
                        value={tempCellValue}
                        onChange={(e) => setTempCellValue(e.target.value)}
                        onBlur={() => commitInlineEdit(exp, 'paymentMode')}
                        className="w-full bg-white border border-emerald-500 rounded px-1 py-0.5 text-xs focus:outline-hidden"
                        autoFocus
                      >
                        <option value="">None / Other</option>
                        {PAYMENT_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-600 font-medium truncate block">
                        {exp.paymentMode || <span className="text-slate-400 italic">Optional</span>}
                      </span>
                    )}
                  </td>

                  {/* G: Proof of Image (Receipt) */}
                  <td className="px-3 py-2 border-r border-slate-200 text-center">
                    {exp.receiptImage ? (
                      <button
                        onClick={() => onViewReceipt(exp.receiptImage!, `${exp.description || 'Receipt'} (${formatCurrency(exp.amount, exp.currency)})`)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[11px] transition-colors group-hover:scale-105 border ${
                          exp.receiptImage.includes('drive.google.com')
                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {exp.receiptImage.includes('drive.google.com') ? (
                          <HardDrive className="w-3 h-3 text-blue-600" />
                        ) : (
                          <Eye className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>{exp.receiptImage.includes('drive.google.com') ? 'Drive Proof' : 'View Proof'}</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">None</span>
                    )}
                  </td>

                  {/* H: Last Edited By */}
                  <td className="px-3 py-2 border-r border-slate-200 text-slate-500 text-[11px] truncate">
                    {exp.lastEditedBy}
                  </td>

                  {/* I: Actions */}
                  <td className="px-2 py-2 text-center bg-slate-50/50">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onOpenMobileForm(exp)}
                        className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-slate-200 transition-colors"
                        title="Edit via Standard Form"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteExpense(exp)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Record (asks in-sheet confirmation)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Direct Add Row Button Inside Sheet Grid */}
            <tr className="bg-slate-50/70 hover:bg-emerald-50/50 transition-colors">
              <td className="px-2 py-2 text-center border-r border-slate-200 font-mono text-[11px] text-slate-400">
                +
              </td>
              <td colSpan={9} className="px-4 py-2">
                <button
                  id="btn-inline-add-row"
                  onClick={handleDirectAddRow}
                  className="flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors py-0.5"
                >
                  <Plus className="w-4 h-4 bg-emerald-100 rounded-full p-0.5" />
                  <span>Click to add new entry directly in sheet (triggers in-sheet confirmation)</span>
                </button>
              </td>
            </tr>

            {/* Formula Summary Row: =SUM(...) */}
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800">
              <td className="px-2 py-2.5 text-center border-r border-slate-300 font-mono text-[11px] text-slate-600">
                ∑
              </td>
              <td className="px-3 py-2.5 border-r border-slate-300 text-[11px] uppercase tracking-wider text-slate-600">
                Total (=SUM)
              </td>
              <td className="px-3 py-2.5 border-r border-slate-300 text-slate-500 font-mono text-[11px]">
                {expenses.length} records
              </td>
              <td className="px-3 py-2.5 border-r border-slate-300 text-right font-mono text-emerald-700 text-sm font-extrabold">
                {formatCurrency(totalAmount, expenses[0]?.currency || '$')}
              </td>
              <td colSpan={6} className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                Average Expense (=AVERAGE): <span className="text-slate-800 font-bold">{formatCurrency(averageAmount, expenses[0]?.currency || '$')}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. Google Sheet Bottom Status & Tips */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">Sheet Tabs:</span>
          <span className="px-2 py-0.5 bg-white border border-slate-300 rounded font-bold text-emerald-800 shadow-2xs">
            📊 Expenses ({filteredExpenses.length})
          </span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="hidden sm:inline">
            Showing {filteredExpenses.length} of {expenses.length} rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-700 font-medium">⚡ In-sheet edit & delete confirmations active</span>
        </div>
      </div>
    </div>
  );
};
