const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Replace the sendEmailNotification logic with a fetch to our new backend route
const newSendEmailNotification = `
  const sendEmailNotification = async (toEmail: string, subject: string, message: string) => {
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to: toEmail, subject, message })
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to send email via backend:', err);
      return false;
    }
  };
`;

code = code.replace(/const sendEmailNotification = async \([\s\S]*?catch \([^)]+\) {\s*console\.error\('Failed to send email:', err\);\s*return false;\s*}\s*};/m, newSendEmailNotification.trim());

// Revert notifyTeamMembers to its simpler form since backend does it reliably
const notifyTeamMembersFind = /const notifyTeamMembers = async \([\s\S]*?const subject = `Ledger Update: \${book.name}`;[\s\S]*?catch\(console\.error\);\s*\}\s*\}\s*\};/m;

const newNotifyTeamMembers = `
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

    // 2. Email notifications (Now sent reliably via our Node backend)
    const emails = Object.values(book.roles)
      .map((r: any) => r.email)
      .filter((email: string) => email !== (userProfile?.email || currentUser?.email));
    
    if (emails.length > 0) {
      const subject = \`Ledger Update: \${book.name}\`;
      const message = \`<p>Hello,</p><p>A ledger you are a member of has been updated by <b>\${userProfile?.displayName || currentUser?.email}</b>.</p><p><b>Action:</b> \${action}</p><p><b>Details:</b> \${detail}</p>\`;
      
      for (const email of emails) {
        // This hits our reliable Express backend which doesn't lose credentials
        sendEmailNotification(email, subject, message).catch(console.error);
      }
    }
  };
`;

code = code.replace(notifyTeamMembersFind, newNotifyTeamMembers.trim());

// Also remove the banner and the handleManualEmailNotify since it's no longer needed
const manualNotifyFind = /const handleManualEmailNotify = async \([\s\S]*?setUnsentEmailChange\(null\);\s*\}\s*\} catch \(err\) \{[\s\S]*?\}\s*};\s*/m;
code = code.replace(manualNotifyFind, '');

const unsentStateFind = "const [unsentEmailChange, setUnsentEmailChange] = useState<{action: string, detail: string} | null>(null);\n";
code = code.replace(unsentStateFind, '');

// Removing the banner from the render output
const bannerFind = /\{unsentEmailChange && \([\s\S]*?<\/[b]utton>\s*<\/div>\s*<\/div>\s*\)\}\s*/m;
code = code.replace(bannerFind, '');

fs.writeFileSync('src/pages/BookView.tsx', code);
