const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

content = content.replace(/exp\.createdBy/g, '(exp.createdBy || exp.paidByName)');

fs.writeFileSync('src/pages/BookView.tsx', content);
