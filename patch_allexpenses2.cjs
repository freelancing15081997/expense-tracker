const fs = require('fs');
let content = fs.readFileSync('src/pages/AllExpenses.tsx', 'utf8');

content = content.replace(/exp\.type/g, '(exp.type || exp.entryType)');
content = content.replace(/exp\.createdBy/g, '(exp.createdBy || exp.paidByName)');

fs.writeFileSync('src/pages/AllExpenses.tsx', content);
