const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Add useToast import
code = code.replace(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/, "import { useAuth } from '../context/AuthContext';\nimport { useToast } from '../context/ToastContext';");

// Inside component
code = code.replace(/const \{ currentUser, userProfile \} = useAuth\(\);/, 'const { currentUser, userProfile } = useAuth();\n  const { addToast } = useToast();');

// Replace alerts
code = code.replace(/alert\((.*?)\);/g, (match, p1) => `addToast(${p1}, 'error');`);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
