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
  if (!_merchantId) {
    const currentUser = auth.currentUser;
    if (currentUser) {
      _merchantId = currentUser.uid;
    } else {
      throw new Error("Usuário não autenticado. Faça login novamente.");
    }
  }
  return `merchants/${_merchantId}`;
}

// Ensure merchantPath is available - fallback to auth.currentUser
function ensureMerchantPath(): string {
  try {
    return merchantPath();
  } catch {
    const currentUser = auth.currentUser;
    if (currentUser) {
      _merchantId = currentUser.uid;
      return `merchants/${_merchantId}`;
    }
    throw new Error("Usuário não autenticado. Faça login novamente.");
  }
}

// ── Generic CRUD helpers (Firestore) ──

export async function getAll<T>(subcollection: string): Promise<Record<string, T> | null> {
  const colRef = collection(db, ensureMerchantPath(), subcollection);
  const snapshot = await getDocs(colRef);
  if (snapshot.empty) return null;
  const result: Record<string, T> = {};
  snapshot.forEach((doc) => {
    result[doc.id] = doc.data() as T;
  });
  return result;
}

export async function getById<T>(subcollection: string, id: string): Promise<T | null> {
  const docRef = doc(db, ensureMerchantPath(), subcollection, id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

export async function create<T extends Record<string, unknown>>(
  subcollection: string,
  data: T
): Promise<string> {
  try {
    const path = ensureMerchantPath();
    console.log(`[Firestore] Creating doc in ${path}/${subcollection}`);
    const colRef = collection(db, path, subcollection);
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`[Firestore] Document created with ID: ${docRef.id}`);
    return docRef.id;
  } catch (err: any) {
    console.error(`[Firestore] Error creating document in ${subcollection}:`, err);
    if (err.code === "permission-denied") {
      throw new Error("Permissão negada. Verifique as regras do Firestore.");
    }
    throw new Error(`Erro ao criar documento: ${err.message || err}`);
  }
}

export async function createWithId<T extends Record<string, unknown>>(
  collectionPath: string,
  id: string,
  data: T
): Promise<void> {
  const docRef = doc(db, collectionPath, id);
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    // Merge: update existing document, don't overwrite createdAt
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    } as Record<string, unknown>);
  } else {
    await setDoc(docRef, {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
}

export async function updateItem<T extends Record<string, unknown>>(
  subcollection: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  try {
    const path = ensureMerchantPath();
    console.log(`[Firestore] Updating doc ${path}/${subcollection}/${id}`, data);
    const docRef = doc(db, path, subcollection, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    } as Record<string, unknown>);
    console.log(`[Firestore] Document updated successfully: ${id}`);
  } catch (err: any) {
    console.error(`[Firestore] Error updating document ${subcollection}/${id}:`, err);
    if (err.code === "permission-denied") {
      throw new Error("Permissão negada ao atualizar. Verifique as regras do Firestore.");
    }
    if (err.code === "not-found") {
      throw new Error("Documento não encontrado. Pode ter sido removido.");
    }
    throw new Error(`Erro ao atualizar: ${err.message || err}`);
  }
}

export async function removeItem(subcollection: string, id: string): Promise<void> {
  try {
    const path = ensureMerchantPath();
    console.log(`[Firestore] Deleting doc ${path}/${subcollection}/${id}`);
    const docRef = doc(db, path, subcollection, id);
    await deleteDoc(docRef);
    console.log(`[Firestore] Document deleted successfully: ${id}`);
  } catch (err: any) {
    console.error(`[Firestore] Error deleting document ${subcollection}/${id}:`, err);
    if (err.code === "permission-denied") {
      throw new Error("Permissão negada ao excluir. Verifique as regras do Firestore.");
    }
    throw new Error(`Erro ao excluir: ${err.message || err}`);
  }
}

export function subscribe<T>(
  subcollection: string,
  callback: (data: Record<string, T> | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const path = ensureMerchantPath();
    console.log(`[Firestore] Subscribing to ${path}/${subcollection}`);
    const colRef = collection(db, path, subcollection);
    // No orderBy — avoids missing docs that don't have createdAt field yet
    // Sorting is done client-side
    const q = query(colRef);

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
  } catch (err) {
    console.error(`[Firestore] Error setting up subscription for ${subcollection}:`, err);
    if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    // Return a no-op unsubscribe
    return () => {};
  }
}

// Subscribe to a single document
export function subscribeDoc<T>(
  subcollection: string,
  docId: string,
  callback: (data: T | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, ensureMerchantPath(), subcollection, docId);

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
  if (!_merchantId) return null;
  const docRef = doc(db, `merchants/${_merchantId}`);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

export async function updateMerchantData<T>(data: Partial<T>): Promise<void> {
  if (!_merchantId) throw new Error("Usuário não autenticado");
  const docRef = doc(db, `merchants/${_merchantId}`);
  try {
    // Use set with merge to create or update
    await setDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    } as Record<string, unknown>, { merge: true });
    console.log(`[Firestore] Merchant data updated successfully`);
  } catch (err: any) {
    console.error(`[Firestore] Error updating merchant data:`, err);
    if (err.code === "permission-denied") {
      throw new Error("Permissão negada ao salvar configurações.");
    }
    throw new Error(`Erro ao salvar: ${err.message || err}`);
  }
}

export function subscribeMerchant<T>(
  callback: (data: T | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!_merchantId) {
    console.warn("[Firestore] Cannot subscribe to merchant: no merchant ID");
    if (onError) onError(new Error("Usuário não autenticado"));
    return () => {};
  }

  const docRef = doc(db, `merchants/${_merchantId}`);

  return onSnapshot(
    docRef,
    (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        callback({ ...snapshot.data() } as T);
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
  isNew?: boolean;
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
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

// ── Collection names ──

export const COLLECTIONS = {
  PRODUCTS: "products",
  CLIENTS: "clients",
  ORDERS: "orders",
  COUPONS: "coupons",
  NOTIFICATIONS: "notifications",
  SCHEDULED_MESSAGES: "scheduledMessages",
} as const;

// ── Scheduled Message (WhatsApp integration) ──

export interface Coupon {
  codigo: string;
  descricao: string;
  tipoDesconto: "porcentagem" | "valor_fixo";
  valorDesconto: number;
  valorMinimo?: number;
  usoMaximo?: number;
  usosAtuais?: number;
  validoAte?: number; // ms timestamp
  ativo?: boolean;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export interface ScheduledMessage {
  titulo: string;
  mensagem: string;
  destinatario: string;
  dataHora: number;          // ms timestamp for when to send
  recorrencia: "unica" | "diario" | "semanal" | "mensal";
  status: "agendada" | "enviada" | "falhou";
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

// Helper to convert Firestore Timestamp to milliseconds
export function toMs(ts: Timestamp | number | undefined): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts instanceof Timestamp) return ts.toMillis();
  // Handle plain objects that look like Timestamps (from Firestore snapshots)
  if (typeof ts === "object" && "seconds" in ts && "nanoseconds" in ts) {
    return (ts as any).seconds * 1000 + (ts as any).nanoseconds / 1000000;
  }
  return 0;
}
