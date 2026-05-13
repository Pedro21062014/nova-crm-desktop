import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  where,
  orderBy,
  Timestamp,
  type Unsubscribe,
  type DocumentData,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

// ── Merchant Resolution ──
//
// The Firestore structure uses merchants/{merchantId}/... subcollections.
// The merchantId is the authenticated user's UID.
// We resolve the base path dynamically based on auth state.

let _merchantId: string | null = null;

export function setMerchantId(uid: string | null) {
  _merchantId = uid;
}

export function getMerchantId(): string | null {
  return _merchantId;
}

function merchantPath(): string {
  if (!_merchantId) throw new Error("Usuário não autenticado");
  return `merchants/${_merchantId}`;
}

// ── Generic CRUD helpers (Firestore) ──

export async function getAll<T>(subcollection: string): Promise<Record<string, T> | null> {
  const colRef = collection(db, merchantPath(), subcollection);
  const snapshot = await getDocs(colRef);
  if (snapshot.empty) return null;
  const result: Record<string, T> = {};
  snapshot.forEach((doc) => {
    result[doc.id] = doc.data() as T;
  });
  return result;
}

export async function getById<T>(subcollection: string, id: string): Promise<T | null> {
  const docRef = doc(db, merchantPath(), subcollection, id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

export async function create<T extends Record<string, unknown>>(
  subcollection: string,
  data: T
): Promise<string> {
  const colRef = collection(db, merchantPath(), subcollection);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function createWithId<T extends Record<string, unknown>>(
  subcollection: string,
  id: string,
  data: T
): Promise<void> {
  const docRef = doc(db, merchantPath(), subcollection, id);
  await setDoc(docRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateItem<T extends Record<string, unknown>>(
  subcollection: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  const docRef = doc(db, merchantPath(), subcollection, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function removeItem(subcollection: string, id: string): Promise<void> {
  const docRef = doc(db, merchantPath(), subcollection, id);
  await deleteDoc(docRef);
}

export function subscribe<T>(
  subcollection: string,
  callback: (data: Record<string, T> | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, merchantPath(), subcollection);
  const q = query(colRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const result: Record<string, T> = {};
      snapshot.forEach((doc) => {
        result[doc.id] = doc.data() as T;
      });
      callback(Object.keys(result).length > 0 ? result : null);
    },
    (error) => {
      console.error(`[Firestore] Error subscribing to ${subcollection}:`, error);
      if (onError) onError(error);
    }
  );
}

// Subscribe to a single document
export function subscribeDoc<T>(
  subcollection: string,
  docId: string,
  callback: (data: T | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, merchantPath(), subcollection, docId);

  return onSnapshot(
    docRef,
    (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as T);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`[Firestore] Error subscribing to doc ${subcollection}/${docId}:`, error);
      if (onError) onError(error);
    }
  );
}

// ── Merchant Document Helpers ──

export async function getMerchantData<T>(): Promise<T | null> {
  const docRef = doc(db, `merchants/${_merchantId}`);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

export async function updateMerchantData<T>(data: Partial<T>): Promise<void> {
  const docRef = doc(db, `merchants/${_merchantId}`);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  } as Record<string, unknown>);
}

export function subscribeMerchant<T>(
  callback: (data: T | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, `merchants/${_merchantId}`);

  return onSnapshot(
    docRef,
    (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as T);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`[Firestore] Error subscribing to merchant:`, error);
      if (onError) onError(error);
    }
  );
}

// ── Detect if merchant document exists ──
export async function merchantExists(): Promise<boolean> {
  if (!_merchantId) return false;
  const docRef = doc(db, `merchants/${_merchantId}`);
  const snapshot = await getDoc(docRef);
  return snapshot.exists();
}

// ── Type definitions for Firestore collections ──

export interface Product {
  nome: string;
  preco: number;
  categoria: string;
  descricao?: string;
  imagem?: string;
  estoque?: number;
  ativo?: boolean;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export interface Client {
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  cpfCnpj?: string;
  observacoes?: string;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export interface Order {
  clienteId: string;
  clienteNome: string;
  itens: OrderItem[];
  total: number;
  status: string;
  tipo: string;
  formaPagamento?: string;
  observacoes?: string;
  paymentStatus?: string;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export interface OrderItem {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface StoreConfig {
  nomeLoja?: string;
  name?: string;
  slogan?: string;
  logo?: string;
  telefone?: string;
  phone?: string;
  email?: string;
  endereco?: string;
  address?: string;
  cnpj?: string;
  horarioFuncionamento?: string;
  redesSociais?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
  };
  isSuperuser?: boolean;
  isBlocked?: boolean;
  updatedAt?: Timestamp | number;
}

// ── Collection names ──

export const COLLECTIONS = {
  PRODUCTS: "products",
  CLIENTS: "clients",
  ORDERS: "orders",
  COUPONS: "coupons",
  NOTIFICATIONS: "notifications",
} as const;

// Helper to convert Firestore Timestamp to milliseconds
export function toMs(ts: Timestamp | number | undefined): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts instanceof Timestamp) return ts.toMillis();
  return 0;
}
