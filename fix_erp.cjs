const fs = require('fs');

const files = [
  'src/pages/erp/ERPDashboard.tsx',
  'src/pages/erp/JournalEntries.tsx',
  'src/pages/erp/FinancialReports.tsx',
  'src/pages/erp/Invoices.tsx',
  'src/pages/erp/Bills.tsx',
  'src/pages/erp/ChartOfAccounts.tsx',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('getCurrencySymbol')) {
    content = content.replace("import { useAuth } from '../../context/AuthContext';", "import { useAuth } from '../../context/AuthContext';\nimport { getCurrencySymbol } from '../../lib/currency';");
  }
  
  // replace const { currentUser } = useAuth(); with const { currentUser, userProfile } = useAuth(); if needed
  if (content.includes('const { currentUser } = useAuth();')) {
    content = content.replace('const { currentUser } = useAuth();', 'const { currentUser, userProfile } = useAuth();');
  }

  // replace all \$ with {getCurrencySymbol(userProfile?.defaultCurrency)}
  content = content.replace(/\$/g, "{getCurrencySymbol(userProfile?.defaultCurrency)}");
  
  // Special case for tickFormatter in charts where it's a string template:
  // tickFormatter={(value) => `$${value}`}
  content = content.replace(/tickFormatter={\(value\) => `\{getCurrencySymbol\(userProfile\?\.defaultCurrency\)\}\$\{value\}`}/g, "tickFormatter={(value) => `${getCurrencySymbol(userProfile?.defaultCurrency)}${value}`}");

  fs.writeFileSync(file, content);
}
console.log("ERP files updated!");
