import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const db = getDatabase(app);
export default app;
