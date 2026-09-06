const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

if (!content.includes('BookOpen')) {
  content = content.replace("Receipt,", "Receipt, BookOpen,");
} else {
  if (content.indexOf('BookOpen') === content.lastIndexOf('BookOpen')) {
    // only one occurrence (in the navigation array)
    content = content.replace("Receipt,", "Receipt, BookOpen,");
  }
}
fs.writeFileSync('src/components/Layout.tsx', content);
console.log("Patched Layout icon!");
