const fs = require('fs');
let content = fs.readFileSync('src/pages/AllExpenses.tsx', 'utf8');

content = content.replace(/exp\.entryType/g, 'exp.type');
content = content.replace(/exp\.paidByName/g, 'exp.createdBy');

fs.writeFileSync('src/pages/AllExpenses.tsx', content);
console.log("Patched AllExpenses!");
