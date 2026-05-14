import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyABooLzKOpSqcmQ5VjAydDgbgiUvpMEMh8",
  authDomain: "crm-e-vendas.firebaseapp.com",
  databaseURL: "https://crm-e-vendas-default-rtdb.firebaseio.com",
  projectId: "crm-e-vendas",
  storageBucket: "crm-e-vendas.firebasestorage.app",
  messagingSenderId: "786463592188",
  appId: "1:786463592188:web:b9d12600bb856189515179",
  measurementId: "G-6XYM74KMD9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// Set the correct persistence for Electron
async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log("[Firebase Auth] Using browserLocalPersistence");
  } catch (err) {
    console.warn("[Firebase Auth] browserLocalPersistence failed, trying inMemoryPersistence:", err);
    try {
      await setPersistence(auth, inMemoryPersistence);
      console.log("[Firebase Auth] Using inMemoryPersistence (session only)");
    } catch (err2) {
      console.error("[Firebase Auth] All persistence modes failed:", err2);
    }
  }
}

initAuthPersistence();

export default app;
