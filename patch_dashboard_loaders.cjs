const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(/<button type="submit" disabled=\{creating\} className="w-full py-2 bg-slate-900 text-white rounded-md text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50">[\s\n]*Create Ledger[\s\n]*<\/button>/g,
`<button type="submit" disabled={creating} className="w-full py-2 bg-slate-900 text-white rounded-md text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
  Create Ledger
</button>`);

// Accept invite loader
code = code.replace(/const handleAcceptInvite = async \(invite: InviteItem\) => \{[\s\n]*if \(!currentUser \|\| !userProfile\) return;/g, 
`const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const handleAcceptInvite = async (invite: InviteItem) => {
    if (!currentUser || !userProfile) return;
    setAcceptingId(invite.id);`);

code = code.replace(/catch \(err: any\) \{ [\s\n]*console.error\("Dashboard error:", err\);[\s\n]*addToast\("Error: " \+ err.message, 'error'\);[\s\n]*\}/g,
`catch (err: any) { 
      console.error("Dashboard error:", err);
      addToast("Error: " + err.message, 'error');
    } finally { setAcceptingId(null); }`);

code = code.replace(/<button onClick=\{\(\) => handleAcceptInvite\(invite\)\} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-md hover:bg-orange-600 transition">[\s\n]*<Check className="w-3.5 h-3.5" \/> Accept[\s\n]*<\/button>/g,
`<button onClick={() => handleAcceptInvite(invite)} disabled={acceptingId === invite.id} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-md hover:bg-orange-600 transition disabled:opacity-50">
  {acceptingId === invite.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
</button>`);

// Make sure Loader2 is imported in Dashboard
if (!code.includes('Loader2')) {
  code = code.replace(/import \{ /, 'import { Loader2, ');
}

fs.writeFileSync('src/pages/Dashboard.tsx', code);
