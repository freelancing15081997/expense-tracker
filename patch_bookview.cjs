const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

const stateHookStr = "const [toastMessage, setToastMessage] = useState('');";
const newStateHook = "const [toastMessage, setToastMessage] = useState('');\n  const [unsentEmailChange, setUnsentEmailChange] = useState<{action: string, detail: string} | null>(null);";
code = code.replace(stateHookStr, newStateHook);

const manualEmailNotifyFn = `
  const handleManualEmailNotify = async () => {
    try {
      const { signInWithGoogle, getAccessToken } = await import('../lib/firebase');
      let token = getAccessToken();
      if (!token) {
        await signInWithGoogle();
        token = getAccessToken();
      }
      
      if (!token || !unsentEmailChange) return;

      const emails = Object.values(book.roles)
        .map((r: any) => r.email)
        .filter((email: string) => email !== (userProfile?.email || currentUser?.email));
      
      if (emails.length > 0) {
        const subject = \`Ledger Update: \${book.name}\`;
        const message = \`<p>Hello,</p><p>A ledger you are a member of has been updated by <b>\${userProfile?.displayName || currentUser?.email}</b>.</p><p><b>Action:</b> \${unsentEmailChange.action}</p><p><b>Details:</b> \${unsentEmailChange.detail}</p>\`;
        
        let allSent = true;
        for (const email of emails) {
          const ok = await sendEmailNotification(email, subject, message);
          if (!ok) allSent = false;
        }
        
        if (allSent) {
          setToastMessage('Emails sent successfully!');
          setUnsentEmailChange(null);
        } else {
          setToastMessage('Some emails failed to send.');
        }
      } else {
        setUnsentEmailChange(null);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send emails. Please check popup blockers.');
    }
  };
`;

code = code.replace("const handleSaveExpense = async", manualEmailNotifyFn + "\n  const handleSaveExpense = async");

const notifyTeamMembersFind = `
  const notifyTeamMembers = async (action: string, detail: string) => {
    // 1. In-app notifications
    const uidsToNotify = Object.keys(book.roles).filter(uid => uid !== currentUser?.uid);
    for (const uid of uidsToNotify) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: uid,
          bookId,
          bookName: book.name,
          action,
          detail,
          senderName: userProfile?.displayName || currentUser?.email,
          createdAt: serverTimestamp(),
          read: false
        });
      } catch (err) {
        console.error("Failed to add notification:", err);
      }
    }

    // 2. Email notifications (Best Effort)
    const emails = Object.values(book.roles)
      .map((r: any) => r.email)
      .filter((email: string) => email !== (userProfile?.email || currentUser?.email));
    
    if (emails.length > 0) {
      const subject = \`Ledger Update: \${book.name}\`;
      const message = \`<p>Hello,</p><p>A ledger you are a member of has been updated by <b>\${userProfile?.displayName || currentUser?.email}</b>.</p><p><b>Action:</b> \${action}</p><p><b>Details:</b> \${detail}</p>\`;
      
      for (const email of emails) {
        // We don't await this so it doesn't block if token is missing
        sendEmailNotification(email, subject, message).catch(console.error);
      }
    }
  };
`;

const notifyTeamMembersReplace = `
  const notifyTeamMembers = async (action: string, detail: string) => {
    setUnsentEmailChange(null);
    // 1. In-app notifications
    const uidsToNotify = Object.keys(book.roles).filter(uid => uid !== currentUser?.uid);
    for (const uid of uidsToNotify) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: uid,
          bookId,
          bookName: book.name,
          action,
          detail,
          senderName: userProfile?.displayName || currentUser?.email,
          createdAt: serverTimestamp(),
          read: false
        });
      } catch (err) {
        console.error("Failed to add notification:", err);
      }
    }

    // 2. Email notifications (Best Effort)
    const emails = Object.values(book.roles)
      .map((r: any) => r.email)
      .filter((email: string) => email !== (userProfile?.email || currentUser?.email));
    
    if (emails.length > 0) {
      const { getAccessToken } = await import('../lib/firebase');
      const token = getAccessToken();
      if (!token) {
        // Token is missing! Save to state so user can explicitly send it
        setUnsentEmailChange({ action, detail });
        return;
      }

      const subject = \`Ledger Update: \${book.name}\`;
      const message = \`<p>Hello,</p><p>A ledger you are a member of has been updated by <b>\${userProfile?.displayName || currentUser?.email}</b>.</p><p><b>Action:</b> \${action}</p><p><b>Details:</b> \${detail}</p>\`;
      
      for (const email of emails) {
        // We don't await this so it doesn't block if token is missing
        sendEmailNotification(email, subject, message).catch(console.error);
      }
    }
  };
`;

if (code.includes('const notifyTeamMembers = async (action: string, detail: string) => {')) {
  // It's tricky to string match exactly since spaces can vary. Let's use Regex.
  const regex = /const notifyTeamMembers = async \([\s\S]*?catch\(console\.error\);\s*\}\s*\}\s*\};/;
  code = code.replace(regex, notifyTeamMembersReplace.trim());
}


const renderHeaderStr = `<div className="flex items-center gap-3">\n          <Link to="/" className="text-slate-400 hover:text-slate-600 transition-colors">\n            <ArrowLeft className="w-5 h-5" />\n          </Link>\n          <div>\n            <h1 className="text-lg font-bold text-slate-900 leading-tight">{book.name}</h1>\n            <p className="text-xs text-slate-500 font-medium">Ledger Dashboard &bull; {book.currency}</p>\n          </div>\n        </div>`;

const renderBannerStr = `
      {unsentEmailChange && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Team members were notified in-app.</span>
            <span className="text-xs opacity-90 mt-0.5">Would you also like to send them an email alert?</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button 
              onClick={handleManualEmailNotify}
              className="whitespace-nowrap px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
            >
              Send Emails
            </button>
            <button 
              onClick={() => setUnsentEmailChange(null)}
              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors flex-shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
`;

// Insert the banner right after the header ends. The header is <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm"> ... </div>
// Let's just insert it after the header div.
const headerEndIdx = code.indexOf('</header>');
if (headerEndIdx === -1) {
  // if there's no header tag, it's a div. Let's find the first `</div>` after the title.
  // Actually, I can just replace `      {/* Stats Summary */}` with the banner.
  code = code.replace("      {/* Stats Summary */}", renderBannerStr + "\n      {/* Stats Summary */}");
}

fs.writeFileSync('src/pages/BookView.tsx', code);
