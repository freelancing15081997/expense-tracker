const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

code = code.replace(/<button type="submit" disabled=\{inviting\} className="px-4 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50">[\s\n]*Invite[\s\n]*<\/button>/g,
`<button type="submit" disabled={inviting} className="px-4 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
  {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
  Invite
</button>`);

fs.writeFileSync('src/pages/BookView.tsx', code);
