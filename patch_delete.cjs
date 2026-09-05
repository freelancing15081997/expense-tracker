const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

code = code.replace(/const handleDeleteExpense = async \(id: string, description: string\) => {[\s\S]*?};/, `const handleDeleteExpense = async (id: string, description: string) => {
    if (!canWrite) return;
    if (confirm('Delete this entry permanently?')) {
      try {
        await deleteDoc(doc(db, \`books/\${bookId}/expenses\`, id));
        await notifyTeamMembers('Deleted an Entry', \`Removed expense for \${description}\`);
        setToastMessage('Entry deleted successfully!');
        setTimeout(() => setToastMessage(''), 4000);
      } catch (err: any) {
        console.error("Delete failed:", err);
        alert("Delete failed: " + err.message);
      }
    }
  };`);

fs.writeFileSync('src/pages/BookView.tsx', code);
