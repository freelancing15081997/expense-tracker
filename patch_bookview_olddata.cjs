const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// For setEntryType
content = content.replace(
  /setEntryType\(exp\.type \|\| 'out'\);/g,
  `setEntryType(exp.type || exp.entryType || 'out');`
);

// For desktop amount
content = content.replace(
  /exp\.type === 'in'/g,
  `(exp.type === 'in' || exp.entryType === 'in')`
);

// For totalIn, totalOut, chartData
content = content.replace(
  /expenses\.filter\(e => e\.type === 'in'\)/g,
  `expenses.filter(e => e.type === 'in' || e.entryType === 'in')`
);

content = content.replace(
  /expenses\.filter\(e => e\.type !== 'in'\)/g,
  `expenses.filter(e => e.type !== 'in' && e.entryType !== 'in')`
);

fs.writeFileSync('src/pages/BookView.tsx', content);
