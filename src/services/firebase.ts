import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  type Unsubscribe,
  query,
  limitToFirst,
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

// ── Path Resolution Strategy ──
//
// For a CRM app that was originally a web app, data is typically stored at:
//   ROOT level: /produtos, /clientes, /pedidos, /configLoja
//
// Some apps use user-scoped paths:
//   /users/{uid}/produtos, /users/{uid}/clientes, etc.
//
// We detect which one has data and cache the result per session.
// The detection tries ROOT FIRST because that's the most common pattern
// for existing CRM web apps.

// Cache for resolved paths so we don't re-detect every time
const pathCache = new Map<string, string>();

export function resolvePath(basePath: string, uid?: string | null): string {
  const cacheKey = `${basePath}:${uid || "anon"}`;
  const cached = pathCache.get(cacheKey);
  if (cached) return cached;

  // Default to root-level path (most common for CRM apps migrated from web)
  const resolved = basePath;
  pathCache.set(cacheKey, resolved);
  return resolved;
}

// Detect where data actually lives — tries root first, then user-scoped
export async function detectDataPath(
  basePath: string,
  uid?: string | null
): Promise<string> {
  const cacheKey = `${basePath}:${uid || "anon"}`;
  const cached = pathCache.get(cacheKey);
  if (cached) return cached;

  // Strategy 1: Try root-level path first (most common for existing CRM apps)
  try {
    const rootSnapshot = await get(query(ref(db, basePath), limitToFirst(1)));
    if (rootSnapshot.exists()) {
      console.log(`[Firebase] Detected ROOT path for "${basePath}"`);
      pathCache.set(cacheKey, basePath);
      return basePath;
    }
  } catch (err: any) {
    // If permission denied at root, it might mean data is user-scoped
    const isPermissionDenied =
      err?.code === "PERMISSION_DENIED" ||
      err?.message?.includes("Permission denied");
    if (!isPermissionDenied) {
      console.warn(`[Firebase] Unexpected error reading root "${basePath}":`, err);
    }
  }

  // Strategy 2: Try user-scoped path
  if (uid) {
    const userPath = `users/${uid}/${basePath}`;
    try {
      const userSnapshot = await get(query(ref(db, userPath), limitToFirst(1)));
      if (userSnapshot.exists()) {
        console.log(`[Firebase] Detected USER-SCOPED path for "${basePath}": ${userPath}`);
        pathCache.set(cacheKey, userPath);
        return userPath;
      }
    } catch (err: any) {
      const isPermissionDenied =
        err?.code === "PERMISSION_DENIED" ||
        err?.message?.includes("Permission denied");
      if (!isPermissionDenied) {
        console.warn(`[Firebase] Unexpected error reading user path "${userPath}":`, err);
      }
    }
  }

  // Strategy 3: If both paths returned no data but no permission errors,
  // default to root-level path (user will create new data there)
  // If root was permission-denied, also default to root — the onValue
  // subscription will handle the error gracefully
  console.log(`[Firebase] No existing data found for "${basePath}", using ROOT path`);
  pathCache.set(cacheKey, basePath);
  return basePath;
}

// Clear path cache (useful on logout)
export function clearPathCache(): void {
  pathCache.clear();
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
