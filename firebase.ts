import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  deleteDoc,
  serverTimestamp 
} from "firebase/firestore";

const firebaseConfig = {
  projectId: "gen-lang-client-0282338307",
  appId: "1:1057516578998:web:5cf4432a55275183271e17",
  apiKey: "AIzaSyCJXlf5J_yxbvWeVQbSZSrSOAQOXRx_11w",
  authDomain: "gen-lang-client-0282338307.firebaseapp.com",
  storageBucket: "gen-lang-client-0282338307.firebasestorage.app",
  messagingSenderId: "1057516578998"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-telegrambotdeplo-120188ca-9fd8-4554-b995-ab1fd9c97acb");

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp
};
export type { User };
