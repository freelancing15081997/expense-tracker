import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE",
  authDomain: "gen-lang-client-0616065043.firebaseapp.com",
  projectId: "gen-lang-client-0616065043",
  storageBucket: "gen-lang-client-0616065043.firebasestorage.app",
  messagingSenderId: "450686107760",
  appId: "1:450686107760:web:ee4b53ae0ccd18c90734b5"
};
const app = initializeApp(firebaseConfig);
const dbNamed = getFirestore(app, "ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50");
const dbDefault = getFirestore(app);

async function test(name, db) {
  try {
    await getDoc(doc(db, 'erp_workspaces/123'));
    console.log(name, 'works');
  } catch (e) {
    console.log(name, 'error:', e.message);
  }
}

await test('Named DB', dbNamed);
await test('Default DB', dbDefault);
process.exit(0);
