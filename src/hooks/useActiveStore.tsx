// ── useActiveStore ──
// Contexto que gerencia qual loja está ativa no app (paridade com o
// ActiveStoreContext do CRM web):
// - main: merchants/{uid} (loja legada)
// - sub-loja: merchants/{uid}/stores/{storeId}
// - loja de equipe: merchants/{ownerUid} (usuário é colaborador)
// O activeStoreId/loja de equipe persistem em localStorage (mesmas chaves do CRM web).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, db } from "@/lib/firebase";
import {
  onSnapshot,
  doc,
} from "firebase/firestore";
import {
  MAIN_STORE_ID,
  setMerchantId,
  setActiveStore,
} from "@/services/firebase";
import type {
  ActiveTeamStoreInfo,
  TeamPermissions,
} from "@/lib/teamRoles";

const STORAGE_KEY = "novaCrmActiveStoreId";
const TEAM_STORE_STORAGE_KEY = "novaCrmActiveTeamStore";

interface ActiveStoreContextValue {
  /** ID da loja ativa ('main' ou id da sub-loja). */
  activeStoreId: string;
  /** True se a loja ativa for a main do próprio usuário. */
  isMainStore: boolean;
  /** True se estiver operando numa loja de equipe (colaborador). */
  isTeamStore: boolean;
  /** Dados do vínculo de equipe ativo (null se loja própria). */
  activeTeamStore: ActiveTeamStoreInfo | null;
  /** UID efetivo do merchant da loja ativa (próprio ou do dono da equipe). */
  effectiveMerchantId: (currentUserId: string) => string;
  /** Seleciona uma loja própria (reseta o modo equipe). */
  selectOwnStore: (storeId?: string) => void;
  /** Seleciona uma loja de equipe. */
  selectTeamStore: (info: ActiveTeamStoreInfo) => void;
  /** Permissão autorizada na loja ativa (dono tem todas). */
  hasPermission: (key: keyof TeamPermissions) => boolean;
}

const ActiveStoreContext = createContext<ActiveStoreContextValue | undefined>(undefined);

function readTeamStore(): ActiveTeamStoreInfo | null {
  try {
    const saved = localStorage.getItem(TEAM_STORE_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as ActiveTeamStoreInfo) : null;
  } catch {
    return null;
  }
}

function readStoreId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || MAIN_STORE_ID;
  } catch {
    return MAIN_STORE_ID;
  }
}

export const ActiveStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userUid, setUserUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [activeStoreId, setActiveStoreIdState] = useState<string>(readStoreId);
  const [activeTeamStore, setActiveTeamStoreState] = useState<ActiveTeamStoreInfo | null>(readTeamStore);

  // Trackia estado de auth + propaga merchantId/store ativo para a camada de dados
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUserUid(u?.uid ?? null);
      setMerchantId(u?.uid ?? null);
      if (u) {
        setActiveStore(activeStoreId, activeTeamStore?.merchantId ?? null);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando a loja ativa muda, atualiza a camada de dados (re-assina todos os listeners)
  useEffect(() => {
    if (!userUid) return;
    setActiveStore(activeStoreId, activeTeamStore?.merchantId ?? null);
  }, [userUid, activeStoreId, activeTeamStore]);

  // Segurança: se o vínculo de equipe foi revogado (docs de membro somem),
  // volta para a loja principal. Escuta por UID e por e-mail (igual ao CRM).
  useEffect(() => {
    if (!activeTeamStore?.merchantId || !userUid) return;
    const merchantId = activeTeamStore.merchantId;
    const email = auth.currentUser?.email?.toLowerCase().trim();
    const refs = [doc(db, "merchants", merchantId, "team", userUid)];
    if (email) refs.push(doc(db, "merchants", merchantId, "team", email));
    const states: (boolean | null)[] = refs.map(() => null);
    const unsubs = refs.map((ref, i) =>
      onSnapshot(
        ref,
        (snap) => {
          states[i] = snap.exists();
          // Só reseta quando TODOS responderam e nenhum existe (revogado)
          if (states.every((s) => s === false)) {
            setActiveTeamStoreState(null);
          }
        },
        () => {}
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [activeTeamStore?.merchantId, userUid]);

  const selectOwnStore = useCallback((storeId: string = MAIN_STORE_ID) => {
    setActiveTeamStoreState(null);
    setActiveStoreIdState(storeId);
    try {
      localStorage.removeItem(TEAM_STORE_STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, storeId);
    } catch { /* ignore */ }
  }, []);

  const selectTeamStore = useCallback((info: ActiveTeamStoreInfo) => {
    setActiveTeamStoreState(info);
    setActiveStoreIdState(MAIN_STORE_ID);
    try {
      localStorage.setItem(TEAM_STORE_STORAGE_KEY, JSON.stringify(info));
      localStorage.setItem(STORAGE_KEY, MAIN_STORE_ID);
    } catch { /* ignore */ }
  }, []);

  const effectiveMerchantId = useCallback(
    (currentUserId: string) => {
      if (activeTeamStore?.merchantId) return activeTeamStore.merchantId;
      return currentUserId;
    },
    [activeTeamStore]
  );

  const hasPermission = useCallback(
    (permissionKey: keyof TeamPermissions): boolean => {
      if (!activeTeamStore) return true; // dono da loja tem todas
      if (!activeTeamStore.permissions) return false;
      return !!activeTeamStore.permissions[permissionKey];
    },
    [activeTeamStore]
  );

  const isTeamStore = activeTeamStore !== null;
  const isMainStore = !isTeamStore && activeStoreId === MAIN_STORE_ID;

  return (
    <ActiveStoreContext.Provider
      value={{
        activeStoreId,
        isMainStore,
        isTeamStore,
        activeTeamStore,
        effectiveMerchantId,
        selectOwnStore,
        selectTeamStore,
        hasPermission,
      }}
    >
      {children}
    </ActiveStoreContext.Provider>
  );
};

export function useActiveStore() {
  const ctx = useContext(ActiveStoreContext);
  if (!ctx) {
    throw new Error("useActiveStore deve ser usado dentro de <ActiveStoreProvider>");
  }
  return ctx;
}
