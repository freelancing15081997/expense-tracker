const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/onSnapshot\(([^,]+),\s*\(\s*snap\s*\)\s*=>\s*\{/g, 'onSnapshot($1, (snap) => {');
  content = content.replace(/onSnapshot\(([^,]+),\s*\(\s*snapshot\s*\)\s*=>\s*\{/g, 'onSnapshot($1, (snapshot) => {');
  
  content = content.replace(
    /onSnapshot\(([^,]+),\s*\((snap|snapshot)\)\s*=>\s*\{([\s\S]*?)\}\);/g, 
    `onSnapshot($1, ($2) => {$3}, (err) => { console.error("Snapshot error on", $1, err); });`
  );
  fs.writeFileSync(file, content);
}

patchFile('src/components/Layout.tsx');
patchFile('src/pages/BookView.tsx');
console.log("Patched!");
