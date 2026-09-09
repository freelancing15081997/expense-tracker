import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE",
  authDomain: "gen-lang-client-0616065043.firebaseapp.com",
  projectId: "gen-lang-client-0616065043",
  storageBucket: "gen-lang-client-0616065043.firebasestorage.app",
  messagingSenderId: "450686107760",
  appId: "1:450686107760:web:ee4b53ae0ccd18c90734b5"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
try {
  await getDocs(collection(db, 'erp_users'));
  console.log('Default db works');
} catch (e) {
  console.log('Default db error:', e.message);
}
