const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

content = content.replace(
  /{Object\.entries\(globalStats\.userActivity\)\.sort\(\(a,b\)=>b\[1\]-a\[1\]\)\[0\]\?\.\[0\] \|\| 'No entries yet'}/,
  "{Object.entries(globalStats.userActivity).sort((a,b)=> (b[1] as number) - (a[1] as number))[0]?.[0] || 'No entries yet'}"
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Lint fixed!");
