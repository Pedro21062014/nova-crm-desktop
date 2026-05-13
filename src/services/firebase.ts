import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  off,
  type Unsubscribe,
} from "firebase/database";
import { db } from "@/lib/firebase";

// ── Generic CRUD helpers ──

export async function getAll<T>(path: string): Promise<Record<string, T> | null> {
  const snapshot = await get(ref(db, path));
  return snapshot.val() as Record<string, T> | null;
}

export async function getById<T>(path: string, id: string): Promise<T | null> {
  const snapshot = await get(ref(db, `${path}/${id}`));
  return snapshot.val() as T | null;
}

export async function create<T extends Record<string, unknown>>(
  path: string,
  data: T
): Promise<string> {
  const newRef = push(ref(db, path));
  await set(newRef, { ...data, createdAt: Date.now(), updatedAt: Date.now() });
  return newRef.key!;
}

export async function updateItem<T extends Record<string, unknown>>(
  path: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  await update(ref(db, `${path}/${id}`), {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function removeItem(path: string, id: string): Promise<void> {
  await remove(ref(db, `${path}/${id}`));
}

export function subscribe<T>(
  path: string,
  callback: (data: Record<string, T> | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const dbRef = ref(db, path);
  const unsubscribe = onValue(
    dbRef,
    (snapshot) => {
      callback(snapshot.val() as Record<string, T> | null);
    },
    (error) => {
      console.error(`[Firebase] Error subscribing to ${path}:`, error);
      if (onError) onError(error);
    }
  );
  return unsubscribe;
}

// ── Resolve the correct data path ──
// Tries user-specific path first, then falls back to root-level path

export function resolvePath(basePath: string, uid?: string | null): string {
  if (uid) {
    return `users/${uid}/${basePath}`;
  }
  return basePath;
}

// Try to detect where data lives — user-scoped or root-level
export async function detectDataPath(
  basePath: string,
  uid?: string | null
): Promise<string> {
  if (!uid) return basePath;

  // Try user-scoped path first
  const userPath = `users/${uid}/${basePath}`;
  try {
    const userSnapshot = await get(ref(db, userPath));
    if (userSnapshot.exists()) {
      return userPath;
    }
  } catch {
    // Permission denied or other error — try root path
  }

  // Try root-level path
  try {
    const rootSnapshot = await get(ref(db, basePath));
    if (rootSnapshot.exists()) {
      return basePath;
    }
  } catch {
    // Permission denied or other error
  }

  // Default to user-scoped path (most common for multi-user apps)
  return userPath;
}

// ── Type definitions for Firebase collections ──

export interface Product {
  nome: string;
  preco: number;
  categoria: string;
  descricao?: string;
  imagem?: string;
  estoque?: number;
  ativo?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Client {
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  cpfCnpj?: string;
  observacoes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Order {
  clienteId: string;
  clienteNome: string;
  itens: OrderItem[];
  total: number;
  status: "pago" | "pendente" | "cancelado";
  tipo: "entrada" | "saida";
  formaPagamento?: string;
  observacoes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface OrderItem {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface StoreConfig {
  nomeLoja: string;
  slogan?: string;
  logo?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cnpj?: string;
  horarioFuncionamento?: string;
  redesSociais?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
  };
  updatedAt?: number;
}

// ── Path constants ──

export const PATHS = {
  PRODUCTS: "produtos",
  CLIENTS: "clientes",
  ORDERS: "pedidos",
  STORE_CONFIG: "configLoja",
  USERS: "usuarios",
} as const;
