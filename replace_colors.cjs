const fs = require('fs');

function replaceColors(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/indigo/g, 'zinc');
  fs.writeFileSync(file, content);
}

replaceColors('src/pages/Dashboard.tsx');
replaceColors('src/pages/BookView.tsx');
replaceColors('src/pages/Settings.tsx');
replaceColors('src/pages/Login.tsx');
replaceColors('src/pages/Register.tsx');
replaceColors('index.html');
console.log("Colors replaced!");
