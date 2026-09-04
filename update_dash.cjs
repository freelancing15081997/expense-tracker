const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const targetStr = `      // Notify team members about the new user joining
      const bookSnap = await getDoc(doc(db, 'books', invite.bookId));
      if (bookSnap.exists()) {
        const bookData = bookSnap.data();
        const emails = Object.values(bookData.roles)
          .map((r: any) => r.email)
          .filter((email: string) => email !== userProfile.email);
        
        if (emails.length > 0) {
          const { getAccessToken } = await import('../lib/firebase');
          const token = getAccessToken();
          if (token) {`;

const replacement = `      // Notify team members about the new user joining
      const bookSnap = await getDoc(doc(db, 'books', invite.bookId));
      if (bookSnap.exists()) {
        const bookData = bookSnap.data();

        // 1. In-app Notifications
        const uidsToNotify = Object.keys(bookData.roles).filter(uid => uid !== currentUser.uid);
        for (const uid of uidsToNotify) {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: uid,
              bookId: invite.bookId,
              bookName: invite.bookName,
              action: 'Joined the Ledger',
              detail: \`\${userProfile.displayName || userProfile.email} has accepted the invitation to join.\`,
              senderName: 'System',
              createdAt: serverTimestamp(),
              read: false
            });
          } catch (err) {
            console.error("Failed to add notification:", err);
          }
        }

        const emails = Object.values(bookData.roles)
          .map((r: any) => r.email)
          .filter((email: string) => email !== userProfile.email);
        
        if (emails.length > 0) {
          const { getAccessToken } = await import('../lib/firebase');
          const token = getAccessToken();
          if (token) {`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
