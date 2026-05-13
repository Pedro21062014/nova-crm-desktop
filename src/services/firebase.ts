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
  callback: (data: Record<string, T> | null) => void
): Unsubscribe {
  const dbRef = ref(db, path);
  const unsubscribe = onValue(dbRef, (snapshot) => {
    callback(snapshot.val() as Record<string, T> | null);
  });
  return () => off(dbRef);
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
