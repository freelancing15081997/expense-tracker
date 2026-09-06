const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace("import AllExpenses from './pages/AllExpenses';", "import AllExpenses from './pages/AllExpenses';\nimport Invoicing from './pages/Invoicing';\nimport Reports from './pages/Reports';");

content = content.replace('<Route path="expenses" element={<AllExpenses />} />', `<Route path="expenses" element={<AllExpenses />} />
              <Route path="invoicing" element={<Invoicing />} />
              <Route path="reports" element={<Reports />} />`);

fs.writeFileSync('src/App.tsx', content);
