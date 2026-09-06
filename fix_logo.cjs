const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');
content = content.replace(/>SET Books</g, '>SET Books<'); // Dummy replace for now, want to check structure first
fs.writeFileSync('src/components/Layout.tsx', content);
