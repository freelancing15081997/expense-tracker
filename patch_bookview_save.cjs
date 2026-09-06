const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Fix updateDoc
content = content.replace(
  /await updateDoc\(doc\(db, `books\/\$\{bookId\}\/expenses`, editingExpense\.id\), \{([\s\S]*?)\}\);/,
  `await updateDoc(doc(db, \`books/\$\{bookId\}/expenses\`, editingExpense.id), {
          amount: Number(amount),
          description,
          category: finalCategory,
          type: entryType
        });`
);

// Fix addDoc
content = content.replace(
  /await addDoc\(collection\(db, `books\/\$\{bookId\}\/expenses`\), \{([\s\S]*?)createdAt: serverTimestamp\(\)\s*\}\);/,
  `await addDoc(collection(db, \`books/\$\{bookId\}/expenses\`), {
          amount: Number(amount),
          description,
          category: finalCategory,
          type: entryType,
          date: new Date().toISOString().split('T')[0],
          createdBy: userProfile?.displayName || currentUser?.email,
          createdAt: serverTimestamp()
        });`
);

fs.writeFileSync('src/pages/BookView.tsx', content);
console.log("Patched BookView saving entry type!");
