const fs = require('fs');

const files = [
  'src/pages/Dashboard.tsx',
  'src/pages/BookView.tsx',
  'src/pages/Settings.tsx',
  'src/components/Layout.tsx',
  'src/pages/erp/ERPDashboard.tsx',
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/orange-500/g, "indigo-600");
    content = content.replace(/orange-600/g, "indigo-700");
    content = content.replace(/orange-50/g, "indigo-50");
    content = content.replace(/orange-200/g, "indigo-200");
    fs.writeFileSync(file, content);
  }
}
console.log("Colors updated!");
