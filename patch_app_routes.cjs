const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const importPlaceholder = `import Placeholder from './pages/books/Placeholder';\nimport AllExpenses from './pages/AllExpenses';`;
app = app.replace(`import AllExpenses from './pages/AllExpenses';`, importPlaceholder);

const oldRoutes = `<Route path="bookkeeping" element={<AllExpenses />} />`;
const newRoutes = `
              <Route path="books" element={<Placeholder title="Books Dashboard" />} />
              <Route path="books/invoicing" element={<Placeholder title="Invoicing" />} />
              <Route path="books/billing" element={<Placeholder title="Billing" />} />
              <Route path="books/expenses" element={<Placeholder title="Expenses (Accounting)" />} />
              <Route path="books/chart-of-accounts" element={<Placeholder title="Chart of Accounts" />} />
              <Route path="books/templates" element={<Placeholder title="Templates" />} />
              <Route path="books/clients" element={<Placeholder title="Clients" />} />
              <Route path="books/vendors" element={<Placeholder title="Vendors" />} />
              <Route path="books/reports" element={<Placeholder title="Reports" />} />
`;
app = app.replace(oldRoutes, newRoutes);
fs.writeFileSync('src/App.tsx', app);
