export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
export type { Firestore } from 'firebase/firestore';
export { db } from './firebase';
