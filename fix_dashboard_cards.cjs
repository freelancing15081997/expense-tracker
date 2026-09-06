const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
content = content.replace(/hover:border-blue-300/g, 'hover:border-indigo-300');
fs.writeFileSync('src/pages/Dashboard.tsx', content);
