const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
if (!content.includes('getCurrencySymbol')) {
  content = content.replace("import { Link } from 'react-router-dom';", "import { Link } from 'react-router-dom';\nimport { getCurrencySymbol } from '../lib/currency';");
}
content = content.replace(/\{book\.currency\}/g, "{getCurrencySymbol(book.currency)}");
fs.writeFileSync('src/pages/Dashboard.tsx', content);
