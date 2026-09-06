const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Replace duplicate "type: entryType,"
content = content.replace(/type: entryType,\s*type: entryType,/g, 'type: entryType,');
fs.writeFileSync('src/pages/BookView.tsx', content);
