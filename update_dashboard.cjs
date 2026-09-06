const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Terminology
content = content.replace(/Ledgers/g, 'Expense Trackers');
content = content.replace(/Ledger/g, 'Expense Tracker');
content = content.replace(/SET Books/g, 'SET');
content = content.replace(/Manage your financial workspaces./g, 'Manage your expense trackers.');
content = content.replace(/Create a new ledger/g, 'Create a new tracker');

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Dashboard.tsx updated!");
