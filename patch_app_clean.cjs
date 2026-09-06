const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace("import Invoicing from './pages/Invoicing';\nimport Reports from './pages/Reports';", "");
content = content.replace("<Route path=\"invoicing\" element={<Invoicing />} />\n              <Route path=\"reports\" element={<Reports />} />", "");

fs.writeFileSync('src/App.tsx', content);
