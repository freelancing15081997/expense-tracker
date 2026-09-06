const fs = require('fs');

// Patch BookView.tsx
let bv = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Replace all usages of exp.type with exp.entryType
bv = bv.replace(/exp\.type/g, 'exp.entryType');
// Replace e.type with e.entryType
bv = bv.replace(/e\.type/g, 'e.entryType');
// Replace exp.createdBy with exp.paidByName
bv = bv.replace(/exp\.createdBy/g, 'exp.paidByName');

// Form state saving
bv = bv.replace(/type: entryType/g, 'entryType: entryType');
bv = bv.replace(/createdBy: /g, 'paidByName: ');

// Fix up expressions that might have been duplicated like (exp.entryType || exp.entryType)
bv = bv.replace(/\(exp\.entryType \|\| exp\.entryType\)/g, 'exp.entryType');
bv = bv.replace(/\(exp\.paidByName \|\| exp\.paidByName\)/g, 'exp.paidByName');
bv = bv.replace(/\(e\.entryType === 'in' \|\| e\.entryType === 'in'\)/g, "e.entryType === 'in'");
bv = bv.replace(/\(e\.entryType !== 'in' && e\.entryType !== 'in'\)/g, "e.entryType !== 'in'");

fs.writeFileSync('src/pages/BookView.tsx', bv);

// Patch AllExpenses.tsx
let ae = fs.readFileSync('src/pages/AllExpenses.tsx', 'utf8');
ae = ae.replace(/\(exp\.type \|\| exp\.entryType\)/g, 'exp.entryType');
ae = ae.replace(/\(exp\.createdBy \|\| exp\.paidByName\)/g, 'exp.paidByName');
ae = ae.replace(/exp\.type/g, 'exp.entryType');
ae = ae.replace(/exp\.createdBy/g, 'exp.paidByName');

fs.writeFileSync('src/pages/AllExpenses.tsx', ae);
