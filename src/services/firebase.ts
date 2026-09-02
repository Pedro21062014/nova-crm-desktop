import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc as fsAddDoc,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
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
import {
  ref as rtdbRef,
  get as rtdbGet,
  set as rtdbSetRaw,
  update as rtdbUpdateRaw,
  push as rtdbPush,
  remove as rtdbRemoveRaw,
  onValue,
  off,
  onChildAdded,
  onChildChanged,
  orderByChild,
  serverTimestamp as rtdbServerTimestamp,
  limitToLast,
  query as rtdbQuery,
  type Unsubscribe as RtdbUnsubscribe,
} from "firebase/database";
import { trackWrite } from "@/lib/syncTracker";
import { db, rtdb } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

// ── Wrappers de escrita (sync tracker) ──
// Toda escrita passa pelo trackWrite: fica "em voo" até o ack do servidor.
// Quando o app volta da offline, esses contadores alimentam a porcentagem
// real do banner "Sincronizando..." no topo do app.
const rtdbSet: typeof rtdbSetRaw = (ref, value) => trackWrite(rtdbSetRaw(ref, value));
const rtdbUpdate: typeof rtdbUpdateRaw = (ref, value) => trackWrite(rtdbUpdateRaw(ref, value));
const rtdbRemove: typeof rtdbRemoveRaw = (ref) => trackWrite(rtdbRemoveRaw(ref));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- assinatura genérica do Firestore
const setDoc = ((reference: any, data: any, options?: any) =>
  options === undefined
    ? trackWrite(fsSetDoc(reference, data))
    : trackWrite(fsSetDoc(reference, data, options))) as typeof fsSetDoc;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- aceita os 3 formatos (data | field+value | mais campos)
const updateDoc = ((...args: any[]) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackWrite((fsUpdateDoc as any)(...args))) as typeof fsUpdateDoc;
const addDoc: typeof fsAddDoc = (...args) => trackWrite(fsAddDoc(...args));
const deleteDoc: typeof fsDeleteDoc = (...args) => trackWrite(fsDeleteDoc(...args));

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

/**
 * Tipo do cliente.
 * - `common`     → Consumidor Final (B2C, pessoa física).
 * - `commercial` → Ponto Comercial (B2B, revenda / estabelecimento).
 *
 * Mantemos os mesmos valores usados pelo CRM web (repositório CRM)
 * para garantir compatibilidade com a base Firestore compartilhada.
 */
export type ClientType = "common" | "commercial";

export interface Client {
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  cpfCnpj?: string;
  observacoes?: string;
  /** Tipo do cliente. Default: `common` (Consumidor Final). */
  clientType?: ClientType;
  // ── Campos específicos para Pontos Comerciais (B2B) ──
  /** Responsável pela compra no estabelecimento. */
  contactPerson?: string;
  /** Potencial de compra mensal estimado (R$). */
  purchasePotential?: number;
  /** Melhor dia da semana para visita/compra (ex.: "Segunda", "Sexta"). */
  bestBuyDay?: string;
  /** Data da última visita (ISO YYYY-MM-DD). */
  lastVisit?: string;
  /** Data da próxima visita programada (ISO YYYY-MM-DD). */
  nextVisit?: string;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export interface Order {
  // CRM fields (primary)
  merchantId?: string;
  customerName?: string;      // CRM: customer name
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    zip?: string;
    complement?: string;
  };
  items?: OrderItem[];
  total: number;
  subtotal?: number;
  discount?: number;
  couponCode?: string;
  deliveryMethod?: 'delivery' | 'pickup';
  status: string;            // CRM: pending_payment | new | processing | completed | cancelled
  paymentMethod?: string;    // CRM: PIX | CREDIT_CARD | etc.
  paymentId?: string;        // CRM: Asaas payment ID (static_ prefix = manual PIX)
  paymentStatus?: 'pending' | 'paid' | 'failed';
  rating?: number;
  review?: string;
  date?: string;             // CRM: date string for filtering
  isNew?: boolean;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;

  // Old nova-crm fields (backward compat)
  clienteId?: string;
  clienteNome?: string;
  itens?: OrderItem[];
  tipo?: string;             // 'entrada' | 'saida'
  formaPagamento?: string;
  observacoes?: string;
}

export interface OrderItem {
  // CRM fields
  productId?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  imageUrl?: string;
  // Old nova-crm fields (backward compat)
  produtoId?: string;
  produtoNome?: string;
  quantidade?: number;
  precoUnitario?: number;
  subtotal?: number;
}

export interface StoreConfig {
  // CRM storeConfig fields (primary)
  storeName?: string;
  description?: string;
  category?: string;
  whatsapp?: string;
  themeColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  sections?: any[];
  ratingSum?: number;
  ratingCount?: number;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  isPublished?: boolean;
  enableNativePayment?: boolean;
  pixKey?: string;
  document?: string;         // CPF/CNPJ
  isOpen?: boolean;
  openingHours?: Record<string, { open: string; close: string; closed: boolean }>;
  deliverySettings?: any;
  allowPickup?: boolean;
  isOnboarded?: boolean;

  // Old nova-crm fields (backward compat)
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

  // System fields
  isSuperuser?: boolean;
  isBlocked?: boolean;
  subscription?: any;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

// ── ADVANCED CRM TYPES (Pipeline, Proposals, Tasks, Automations) ──
//
// Mesmos nomes de campos usados pelo CRM web (repositório CRM) para
// garantir compatibilidade total com a base Firestore compartilhada:
//   merchants/{uid}/opportunities  (Pipeline / Oportunidades)
//   merchants/{uid}/proposals      (Propostas & Orçamentos)
//   merchants/{uid}/tasks          (Tarefas & Agenda)
//   merchants/{uid}/automations    (Automações & Regras)

export type PipelineStage =
  | "lead"
  | "contact"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface OpportunityItem {
  productId?: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Opportunity {
  id?: string;
  title: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  value: number;
  stage: PipelineStage;
  probability: number; // 0 a 100
  expectedCloseDate?: string; // YYYY-MM-DD
  items?: OpportunityItem[];
  lossReason?: string;
  notes?: string;
  priority?: "low" | "medium" | "high";
  assignedTo?: string;
  tags?: string[];
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export interface ProposalItem {
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected";

export interface CommercialProposal {
  id?: string;
  proposalNumber: string;
  title: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientDocument?: string;
  clientAddress?: string;
  items: ProposalItem[];
  subtotal: number;
  discount: number;
  total: number;
  validUntil: string; // YYYY-MM-DD
  paymentTerms: string;
  notes?: string;
  status: ProposalStatus;
  publicToken?: string;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export type CRMTaskType =
  | "call"
  | "meeting"
  | "whatsapp"
  | "email"
  | "followup"
  | "proposal"
  | "other";

export type CRMTaskPriority = "low" | "medium" | "high";
export type CRMTaskStatus = "pending" | "completed" | "cancelled";

export interface CRMTask {
  id?: string;
  title: string;
  description?: string;
  type: CRMTaskType;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: CRMTaskPriority;
  status: CRMTaskStatus;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  opportunityId?: string;
  completedAt?: Timestamp | number | null;
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
}

export type CRMAutomationTrigger =
  | "client_created"
  | "order_created"
  | "order_paid"
  | "proposal_approved"
  | "opportunity_won"
  | "inactive_client_30d";

export type CRMAutomationAction =
  | "create_task"
  | "send_telegram"
  | "update_client_status"
  | "add_notification";

export interface CRMAutomation {
  id?: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: CRMAutomationTrigger;
  conditionField?: string;
  conditionOperator?: "equals" | "greater_than" | "contains";
  conditionValue?: string;
  actionType: CRMAutomationAction;
  actionConfig: Record<string, any>;
  executionsCount: number;
  lastExecutedAt?: Timestamp | number | null;
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
  PIPELINE: "opportunities",
  PROPOSALS: "proposals",
  TASKS: "tasks",
  AUTOMATIONS: "automations",
} as const;

export interface Coupon {
  // CRM fields (primary)
  code?: string;              // 'PROMO10' (always UPPERCASE)
  type?: 'percentage' | 'fixed';
  value?: number;            // discount value
  minPurchase?: number;      // minimum purchase amount
  usageCount?: number;       // how many times used
  active?: boolean;          // toggle on/off

  // Old nova-crm fields (backward compat)
  codigo?: string;
  descricao?: string;
  tipoDesconto?: "porcentagem" | "valor_fixo";
  valorDesconto?: number;
  valorMinimo?: number;
  usoMaximo?: number;
  usosAtuais?: number;
  validoAte?: number; // ms timestamp
  ativo?: boolean;

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

// ── Realtime Database helpers ──

// Get merchant data from RTDB (fallback for Firestore)
export async function getMerchantDataRTDB<T>(): Promise<T | null> {
  if (!_merchantId) return null;
  try {
    const merchantRef = rtdbRef(rtdb, `merchants/${_merchantId}`);
    const snapshot = await rtdbGet(merchantRef);
    if (snapshot.exists()) {
      console.log("[RTDB] Got merchant data:", snapshot.val());
      return snapshot.val() as T;
    }
    console.log("[RTDB] No merchant data found");
    return null;
  } catch (err) {
    console.error("[RTDB] Error getting merchant data:", err);
    return null;
  }
}

// Subscribe to merchant data in RTDB
export function subscribeMerchantRTDB<T>(
  callback: (data: T | null) => void,
  onError?: (error: Error) => void
): RtdbUnsubscribe {
  if (!_merchantId) {
    console.warn("[RTDB] Cannot subscribe to merchant: no merchant ID");
    if (onError) onError(new Error("Usuário não autenticado"));
    return () => {};
  }

  const merchantRef = rtdbRef(rtdb, `merchants/${_merchantId}`);

  const unsubscribe = onValue(
    merchantRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as T);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("[RTDB] Error subscribing to merchant:", error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

// Update merchant data in RTDB
export async function updateMerchantDataRTDB<T>(data: Partial<T>): Promise<void> {
  if (!_merchantId) throw new Error("Usuário não autenticado");
  try {
    const merchantRef = rtdbRef(rtdb, `merchants/${_merchantId}`);
    await rtdbUpdate(merchantRef, {
      ...data,
      updatedAt: Date.now(),
    } as Record<string, unknown>);
    console.log("[RTDB] Merchant data updated successfully");
  } catch (err: any) {
    console.error("[RTDB] Error updating merchant data:", err);
    throw new Error(`Erro ao salvar: ${err.message || err}`);
  }
}

// ── Chat (Hybrid: Firestore for conversations + RTDB for messages) ──
//
// The CRM web app stores chat conversation metadata in Firestore at
// merchants/{uid}/chats (subcollection), and messages in RTDB at
// merchants/{uid}/chats/{chatId}/messages.
// We need to read from BOTH to be compatible with the CRM.

// Message as stored in RTDB by the CRM
// Anexo (imagem ou documento) — MESMO formato do CRM web (repo CRM,
// `components/CustomerChat.tsx`): base64 data URL no campo `data`.
export interface ChatMessageAttachment {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 data URL
  isImage: boolean;
  compressedSize?: number;
  originalSize?: number;
}

export interface ChatMessage {
  id?: string;
  text: string;
  sender: "merchant" | "customer"; // CRM uses simple string, not complex object
  senderId?: string;   // Optional: nova-crm may store this
  senderName?: string; // Optional: nova-crm may store this
  senderRole?: "merchant" | "customer"; // Optional: nova-crm field
  timestamp?: number;  // Optional: nova-crm field
  createdAt?: any;     // RTDB serverTimestamp from CRM
  read?: boolean;
  attachment?: ChatMessageAttachment; // Imagem/documento (compatível com CRM web)
}

// Conversation as stored in Firestore by the CRM
export interface ChatConversation {
  id?: string;
  customerName: string;
  customerId?: string;    // CRM stores this
  customerPhone?: string;
  lastMessage?: string;
  lastMessageSender?: "merchant" | "customer"; // CRM field
  lastMessageTime?: number;  // nova-crm field
  updatedAt?: any;           // Firestore Timestamp from CRM
  unreadCount?: number;
}

// Subscribe to chat conversations list from Firestore
// The CRM stores conversations in Firestore at merchants/{uid}/chats
export function subscribeChatsFirestore(
  callback: (chats: ChatConversation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!_merchantId) {
    if (onError) onError(new Error("Usuário não autenticado"));
    return () => {};
  }

  try {
    const path = ensureMerchantPath();
    console.log(`[Firestore] Subscribing to chats at ${path}/chats`);
    const colRef = collection(db, path, "chats");
    const q = query(colRef, orderBy("updatedAt", "desc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const chatList: ChatConversation[] = [];
        snapshot.forEach((doc) => {
          // Filter out the AI chat doc
          if (doc.id !== "ai") {
            chatList.push({ id: doc.id, ...doc.data() } as ChatConversation);
          }
        });
        callback(chatList);
      },
      (error) => {
        console.error("[Firestore] Error subscribing to chats:", error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error("[Firestore] Error setting up chat subscription:", err);
    if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}

// Subscribe to chat conversations list from RTDB (fallback)
export function subscribeChatsRTDB(
  callback: (chats: Record<string, ChatConversation> | null) => void,
  onError?: (error: Error) => void
): RtdbUnsubscribe {
  if (!_merchantId) {
    if (onError) onError(new Error("Usuário não autenticado"));
    return () => {};
  }

  const chatsRef = rtdbRef(rtdb, `merchants/${_merchantId}/chats`);

  return onValue(
    chatsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as Record<string, ChatConversation>);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("[RTDB] Error subscribing to chats:", error);
      if (onError) onError(error);
    }
  );
}

// Subscribe to messages in a specific chat (RTDB)
export function subscribeChatMessages(
  chatId: string,
  callback: (messages: Record<string, ChatMessage> | null) => void,
  onError?: (error: Error) => void
): RtdbUnsubscribe {
  if (!_merchantId) {
    if (onError) onError(new Error("Usuário não autenticado"));
    return () => {};
  }

  const messagesRef = rtdbRef(rtdb, `merchants/${_merchantId}/chats/${chatId}/messages`);

  return onValue(
    messagesRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as Record<string, ChatMessage>);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("[RTDB] Error subscribing to chat messages:", error);
      if (onError) onError(error);
    }
  );
}

// Send a chat message (compatible with CRM format)
export async function sendChatMessage(
  chatId: string,
  message: Omit<ChatMessage, "id">
): Promise<string> {
  if (!_merchantId) throw new Error("Usuário não autenticado");
  try {
    const messagesRef = rtdbRef(rtdb, `merchants/${_merchantId}/chats/${chatId}/messages`);
    const newMsgRef = rtdbPush(messagesRef);
    const sender = message.sender || message.senderRole || "merchant";

    const msgPayload: Record<string, unknown> = {
      text: message.text,
      sender,
      createdAt: rtdbServerTimestamp(),
    };
    if (message.attachment) {
      // Anexo em base64 (mesmo formato que o CRM web escreve)
      msgPayload.attachment = message.attachment;
    }
    await rtdbSet(newMsgRef, msgPayload);

    // Preview da última mensagem: texto, ou "📷 Imagem" / "📄 nome" (mesma regra do CRM)
    const lastMsgText =
      message.text ||
      (message.attachment
        ? message.attachment.isImage
          ? "📷 Imagem"
          : `📄 ${message.attachment.name || "Documento"}`
        : "");

    // Update Firestore conversation metadata
    const chatDocRef = doc(db, ensureMerchantPath(), "chats", chatId);
    try {
      await updateDoc(chatDocRef, {
        lastMessage: lastMsgText,
        lastMessageSender: sender,
        updatedAt: Timestamp.now(),
      } as Record<string, unknown>);
    } catch (fsErr: any) {
      // Firestore update failed, try RTDB update
      console.warn("[Chat] Firestore update failed, trying RTDB:", fsErr);
      const chatRef = rtdbRef(rtdb, `merchants/${_merchantId}/chats/${chatId}`);
      await rtdbUpdate(chatRef, {
        lastMessage: lastMsgText,
        lastMessageSender: sender,
        lastMessageTime: Date.now(),
      } as Record<string, unknown>);
    }

    return newMsgRef.key || "";
  } catch (err: any) {
    console.error("[RTDB] Error sending message:", err);
    throw new Error(`Erro ao enviar mensagem: ${err.message || err}`);
  }
}

// Create a new chat conversation (Firestore, compatible with CRM)
export async function createChatConversation(
  conversation: Omit<ChatConversation, "id">
): Promise<string> {
  if (!_merchantId) throw new Error("Usuário não autenticado");
  try {
    // Create in Firestore (primary, where CRM stores it)
    const path = ensureMerchantPath();
    const colRef = collection(db, path, "chats");
    const docRef = await addDoc(colRef, {
      customerName: conversation.customerName,
      customerId: conversation.customerId || "",
      customerPhone: conversation.customerPhone || "",
      lastMessage: "",
      lastMessageSender: "merchant" as const,
      updatedAt: Timestamp.now(),
    });
    console.log("[Firestore] Chat conversation created:", docRef.id);
    return docRef.id;
  } catch (fsErr: any) {
    // Firestore failed, try RTDB as fallback
    console.warn("[Chat] Firestore create failed, trying RTDB:", fsErr);
    try {
      const chatsRef = rtdbRef(rtdb, `merchants/${_merchantId}/chats`);
      const newChatRef = rtdbPush(chatsRef);
      await rtdbSet(newChatRef, {
        ...conversation,
        lastMessageTime: Date.now(),
        unreadCount: 0,
      });
      console.log("[RTDB] Chat conversation created:", newChatRef.key);
      return newChatRef.key || "";
    } catch (rtdbErr: any) {
      console.error("[RTDB] Error creating chat:", rtdbErr);
      throw new Error(`Erro ao criar conversa: ${rtdbErr.message || rtdbErr}`);
    }
  }
}

// Mark messages as read
export async function markChatAsRead(chatId: string): Promise<void> {
  if (!_merchantId) throw new Error("Usuário não autenticado");
  // Try Firestore first, then RTDB
  try {
    const chatDocRef = doc(db, ensureMerchantPath(), "chats", chatId);
    await updateDoc(chatDocRef, { unreadCount: 0 } as Record<string, unknown>);
  } catch {
    try {
      const chatRef = rtdbRef(rtdb, `merchants/${_merchantId}/chats/${chatId}`);
      await rtdbUpdate(chatRef, { unreadCount: 0 } as Record<string, unknown>);
    } catch (err: any) {
      console.error("[Chat] Error marking chat as read:", err);
    }
  }
}

// Delete a chat conversation
export async function deleteChatConversation(chatId: string): Promise<void> {
  if (!_merchantId) throw new Error("Usuário não autenticado");
  try {
    // Delete from Firestore
    const chatDocRef = doc(db, ensureMerchantPath(), "chats", chatId);
    await deleteDoc(chatDocRef);
  } catch (fsErr) {
    console.warn("[Chat] Firestore delete failed:", fsErr);
  }
  try {
    // Also delete RTDB messages
    const chatRef = rtdbRef(rtdb, `merchants/${_merchantId}/chats/${chatId}`);
    await rtdbRemove(chatRef);
  } catch (rtdbErr) {
    console.warn("[Chat] RTDB delete failed:", rtdbErr);
  }
}
