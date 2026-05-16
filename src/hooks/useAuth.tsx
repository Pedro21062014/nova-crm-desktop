import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { setMerchantId } from "@/services/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const googleProvider = new GoogleAuthProvider();
// Request profile info
googleProvider.addScope("profile");
googleProvider.addScope("email");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("[Auth] State changed:", firebaseUser ? `logged in as ${firebaseUser.email}` : "logged out");
      setUser(firebaseUser);
      // Set the merchant ID for Firestore path resolution
      setMerchantId(firebaseUser?.uid || null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    setMerchantId(credential.user.uid);
    console.log("[Auth] Login successful:", credential.user.email);
  };

  const signup = async (email: string, password: string, displayName?: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    setMerchantId(credential.user.uid);
    if (displayName && credential.user) {
      await updateProfile(credential.user, { displayName });
    }
    console.log("[Auth] Signup successful:", credential.user.email);
  };

  const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleProvider);
    setMerchantId(credential.user.uid);
    console.log("[Auth] Google login successful:", credential.user.email);
  };

  const logout = async () => {
    setMerchantId(null);
    await signOut(auth);
    console.log("[Auth] Logout successful");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
