const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// 1. Add useNavigate and deleteField import
code = code.replace(
  "import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';",
  "import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, deleteDoc, serverTimestamp, where, getDocs, deleteField } from 'firebase/firestore';"
);
if (!code.includes('useNavigate')) {
  code = code.replace("import { useParams, Link } from 'react-router-dom';", "import { useParams, Link, useNavigate } from 'react-router-dom';");
}

// 2. Add handleRemoveMember
const hooksSection = `  const [inviting, setInviting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');`;
  
const handleRemoveMemberCode = `  const navigate = useNavigate();

  const handleRemoveMember = async (uidToRemove: string, isSelf: boolean) => {
    if (!currentUser || !book) return;
    
    // Prevent removing the last owner
    if (book.roles[uidToRemove]?.role === 'owner') {
      const ownerCount = Object.values(book.roles).filter((r: any) => r.role === 'owner').length;
      if (ownerCount <= 1) {
        alert('You cannot remove the last owner of the ledger.');
        return;
      }
    }

    if (confirm(isSelf ? 'Are you sure you want to leave this ledger?' : 'Are you sure you want to remove this member?')) {
      try {
        const bookRef = doc(db, 'books', book.id);
        await updateDoc(bookRef, {
          [\`roles.\${uidToRemove}\`]: deleteField()
        });
        
        setToastMessage(isSelf ? 'You have left the ledger.' : 'Member removed.');
        setTimeout(() => setToastMessage(''), 4000);
        
        if (isSelf) {
          navigate('/');
        } else {
          // If we removed someone else, notify remaining team members
          await notifyTeamMembers('Member Removed', \`\${book.roles[uidToRemove]?.email} was removed from the ledger.\`);
        }
      } catch (err) {
        console.error(err);
        alert('Failed to remove member.');
      }
    }
  };`;

if (!code.includes('handleRemoveMember')) {
  code = code.replace(hooksSection, hooksSection + '\\n' + handleRemoveMemberCode);
}

// 3. Update UI in team members map
const memberItemFind = `<div key={uid} className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-white">`;
const memberItemReplace = `<div key={uid} className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors">`;

code = code.replace(memberItemFind, memberItemReplace);

// I need to find where the role badge is rendered and add a remove button next to it.
const roleBadgeFind = `                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
                      data.role === 'owner' ? "bg-slate-900 text-white border-transparent" :
                      data.role === 'admin' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      data.role === 'contributor' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      data.role === 'auditor' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-slate-50 text-slate-700 border-slate-200"
                    )}>
                      {data.role}
                    </span>
                  </div>`;

const roleBadgeReplace = `                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
                        data.role === 'owner' ? "bg-slate-900 text-white border-transparent" :
                        data.role === 'admin' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        data.role === 'contributor' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        data.role === 'auditor' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-slate-50 text-slate-700 border-slate-200"
                      )}>
                        {data.role}
                      </span>
                      
                      {(canManageUsers || uid === currentUser?.uid) && (
                        <button
                          onClick={() => handleRemoveMember(uid, uid === currentUser?.uid)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={uid === currentUser?.uid ? "Leave Ledger" : "Remove Member"}
                        >
                          {uid === currentUser?.uid ? (
                            <LogOut className="w-4 h-4" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>`;

code = code.replace(roleBadgeFind, roleBadgeReplace);

// Make sure to add UserMinus, LogOut to lucide-react imports
if (!code.includes('UserMinus')) {
  code = code.replace("import { Receipt, Search, Plus, Users, X, MoreVertical, Pencil, Trash, FileText, Upload, UserPlus } from 'lucide-react';", 
                      "import { Receipt, Search, Plus, Users, X, MoreVertical, Pencil, Trash, FileText, Upload, UserPlus, UserMinus, LogOut } from 'lucide-react';");
}

fs.writeFileSync('src/pages/BookView.tsx', code);
