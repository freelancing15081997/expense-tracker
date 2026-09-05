const fs = require('fs');
const files = ['src/pages/BookView.tsx', 'src/pages/Dashboard.tsx'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    // We must use absolute URLs or ensure the fetch works correctly when hosted.
    // If the Vite config is set to "base: './'", fetch('/api/email/send') might try to hit the root domain instead of the render service domain if there's a mismatch, but since Render hosts it at the root, it should be fine.
    // Wait, Vite base is './'. When using HashRouter, the URL is https://app.onrender.com/#/book/123.
    // fetch('/api/email/send') from HashRouter on root will go to https://app.onrender.com/api/email/send, which is correct.
    // Let's add better error logging to the frontend fetch catch block to see what's failing.
    code = code.replace(/catch \(err\) {[\s\n]*console.error\(err\);[\s\n]*}/g, 'catch (err) { console.error("Fetch API error:", err); }');
    fs.writeFileSync(file, code);
  }
});
