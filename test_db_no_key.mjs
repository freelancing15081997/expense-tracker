import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: undefined,
  authDomain: "gen-lang-client-0616065043.firebaseapp.com",
  projectId: "gen-lang-client-0616065043",
  storageBucket: "gen-lang-client-0616065043.firebasestorage.app",
  messagingSenderId: "450686107760",
  appId: "1:450686107760:web:ee4b53ae0ccd18c90734b5"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50");
try {
  await getDocs(collection(db, 'erp_users'));
  console.log('No key db works');
} catch (e) {
  console.log('No key db error:', e.message);
}
process.exit(0);
