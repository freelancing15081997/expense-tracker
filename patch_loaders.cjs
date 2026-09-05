const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Add isSaving state
code = code.replace(/const \[isExpenseModalOpen, setIsExpenseModalOpen\] = useState\(false\);/, "const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);\n  const [isSaving, setIsSaving] = useState(false);\n  const [isDeleting, setIsDeleting] = useState<string | null>(null);");

// Update handleSaveExpense
code = code.replace(/const handleSaveExpense = async \(e: React.FormEvent\) => \{[\s\S]*?e\.preventDefault\(\);\n    if \(!canWrite\) return;/g, 
`const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setIsSaving(true);`);

code = code.replace(/setIsExpenseModalOpen\(false\);\n    \} catch \(err\) \{/g, "setIsExpenseModalOpen(false);\n    } catch (err) {");

code = code.replace(/addToast\('Error saving expense', 'error'\);\n    \}/g, "addToast('Error saving expense', 'error');\n    } finally { setIsSaving(false); }");

// Update handleDeleteExpense
code = code.replace(/const handleDeleteExpense = async \(id: string, description: string\) => \{[\s\n]*if \(!canWrite\) return;[\s\n]*if \(confirm\('Delete this entry permanently\?'\)\) \{/g, 
`const handleDeleteExpense = async (id: string, description: string) => {
    if (!canWrite) return;
    if (confirm('Delete this entry permanently?')) {
      setIsDeleting(id);`);

code = code.replace(/addToast\("Delete failed: " \+ err.message, 'error'\);\n      \}/g, "addToast(\"Delete failed: \" + err.message, 'error');\n      } finally { setIsDeleting(null); }");

// Update JSX buttons for save
code = code.replace(/<button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md text-sm font-semibold hover:bg-slate-800 transition">[\s\n]*\{editingExpense \? 'Update Expense' : 'Save Expense'\}[\s\n]*<\/button>/g, 
`<button type="submit" disabled={isSaving} className="w-full py-2 bg-slate-900 text-white rounded-md text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
  {editingExpense ? 'Update Expense' : 'Save Expense'}
</button>`);

// Update JSX button for delete (add loader instead of trash if deleting)
code = code.replace(/<button onClick=\{\(\) => handleDeleteExpense\(exp.id, exp.description\)\} className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors" title="Delete">[\s\n]*<Trash2 className="w-3.5 h-3.5" \/>[\s\n]*<\/button>/g,
`<button onClick={() => handleDeleteExpense(exp.id, exp.description)} disabled={isDeleting === exp.id} className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors disabled:opacity-50" title="Delete">
  {isDeleting === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
</button>`);

fs.writeFileSync('src/pages/BookView.tsx', code);
