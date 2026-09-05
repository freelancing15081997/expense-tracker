const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Add useToast import
code = code.replace(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/, "import { useAuth } from '../context/AuthContext';\nimport { useToast } from '../context/ToastContext';");

// Replace setToastMessage hook
code = code.replace(/const \[toastMessage, setToastMessage\] = useState\(''\);/, 'const { addToast } = useToast();');

// Replace setToastMessage('xyz') with addToast('xyz', 'success')
code = code.replace(/setToastMessage\((.*?)\);/g, (match, p1) => {
  if (p1 === "''") return ''; // remove empty string clears
  if (p1.includes('?')) {
     return `addToast(${p1}, 'success');`; // handle ternary
  }
  return `addToast(${p1}, 'success');`;
});

// Remove setTimeout cleared toast
code = code.replace(/setTimeout\(\(\) => addToast\('', 'success'\), 4000\);/g, '');
code = code.replace(/setTimeout\(\(\) => setToastMessage\(''\), 4000\);/g, '');
code = code.replace(/setTimeout\(\(\) => '', 4000\);/g, ''); // the cleanup artifact

// Replace alerts
code = code.replace(/alert\((.*?)\);/g, (match, p1) => `addToast(${p1}, 'error');`);

// Remove toast JSX render
code = code.replace(/\{toastMessage && \([\s\S]*?\}\)/g, '');

fs.writeFileSync('src/pages/BookView.tsx', code);
