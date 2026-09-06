import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import {
  setMerchantId,
  getMerchantId,
  ensureMerchantPath,
  onStoreChange,
  getStoreVersion,
  type StoreConfig,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";
import { doc, onSnapshot, setDoc as fsSetDoc, Timestamp } from "firebase/firestore";
import { trackWrite } from "@/lib/syncTracker";
import { db } from "@/lib/firebase";

// Helper: safely convert any value to a string for form inputs
function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    const parts = [val.street, val.number, val.neighborhood, val.city, val.zip, val.state, val.complement]
      .filter((p: any) => p && typeof p !== "object");
    if (parts.length > 0) return parts.join(", ");
    const allParts = Object.values(val)
      .filter((v: any) => v && (typeof v === "string" || typeof v === "number"))
      .map(String);
    if (allParts.length > 0) return allParts.join(", ");
    return "";
  }
  return String(val);
}

// Extract storeConfig from a merchant document.
// The CRM stores config in a nested `storeConfig` field.
// Old nova-crm stored config at the top level.
// This function merges both sources, preferring CRM storeConfig fields.
function extractStoreConfig(merchantData: any): StoreConfig {
  const sc = merchantData.storeConfig || {};

  return {
    // CRM storeConfig fields (preferred)
    storeName: sc.storeName || merchantData.nomeLoja || merchantData.name || "",
    description: sc.description || merchantData.slogan || "",
    category: sc.category || "",
    whatsapp: sc.whatsapp || merchantData.redesSociais?.whatsapp || merchantData.telefone || merchantData.phone || "",
    themeColor: sc.themeColor || "",
    logoUrl: sc.logoUrl || merchantData.logo || "",
    bannerUrl: sc.bannerUrl || "",
    fullAddress: sc.fullAddress || safeStr(merchantData.endereco || merchantData.address),
    latitude: sc.latitude,
    longitude: sc.longitude,
    isOpen: sc.isOpen,
    openingHours: sc.openingHours,
    enableNativePayment: sc.enableNativePayment,
    pixKey: sc.pixKey || "",
    document: sc.document || merchantData.cnpj || "",
    isPublished: sc.isPublished ?? merchantData.isPublished,
    allowPickup: sc.allowPickup,
    isOnboarded: sc.isOnboarded,
    deliverySettings: sc.deliverySettings,
    sections: sc.sections,

    // Old nova-crm fields (backward compat)
    nomeLoja: merchantData.nomeLoja || sc.storeName || merchantData.name || "",
    name: merchantData.name || sc.storeName || merchantData.nomeLoja || "",
    slogan: merchantData.slogan || sc.description || "",
    logo: merchantData.logo || sc.logoUrl || "",
    telefone: merchantData.telefone || merchantData.phone || sc.whatsapp || "",
    phone: merchantData.phone || merchantData.telefone || sc.whatsapp || "",
    email: merchantData.email || "",
    endereco: safeStr(merchantData.endereco || merchantData.address || sc.fullAddress),
    address: safeStr(merchantData.address || merchantData.endereco || sc.fullAddress),
    cnpj: merchantData.cnpj || sc.document || "",
    horarioFuncionamento: merchantData.horarioFuncionamento || "",
    redesSociais: merchantData.redesSociais || {},

    // System fields
    isSuperuser: merchantData.isSuperuser,
    isBlocked: merchantData.isBlocked,
    subscription: merchantData.subscription,
  };
}

export function useStoreConfig() {
  const { user } = useAuth();
  // Reassina quando o usuário troca de loja ativa
  const storeVersion = useSyncExternalStore(onStoreChange, getStoreVersion);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      setConfig(null);
      setLoading(false);
      setError(null);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // Always ensure merchant ID is set from the authenticated user
    setMerchantId(user.uid);

    let cancelled = false;

    const setup = async () => {
      try {
        setLoading(true);
        setError(null);

        if (cancelled) return;

        const uid = user.uid;

        // Clean up previous subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // ── Strategy: Subscribe directly to the merchant document in Firestore ──
        // The CRM stores storeConfig as a nested field on the merchant document.
        // We use onSnapshot on the merchant doc directly.
        console.log(`[useStoreConfig] Subscribing to Firestore merchant doc: ${uid}`);

        // Doc da loja ATIVA (main, sub-loja ou loja de equipe)
        const storePath = ensureMerchantPath();
        const docRef = doc(db, storePath);

        const unsubscribe = onSnapshot(
          docRef,
          (snapshot) => {
            if (!cancelled) {
              if (snapshot.exists()) {
                const merchantData = snapshot.data();
                console.log("[useStoreConfig] Got merchant doc data:", merchantData);
                const storeConf = extractStoreConfig(merchantData);
                setConfig(storeConf);
                setLoading(false);
                setError(null);
              } else {
                console.log("[useStoreConfig] Merchant document does not exist");
                setConfig(null);
                setLoading(false);
              }
            }
          },
          (err) => {
            if (!cancelled) {
              console.error("[useStoreConfig] Firestore subscription error:", err);
              setError("Erro ao carregar dados da loja.");
              setLoading(false);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        if (!cancelled) {
          console.error("[useStoreConfig] Setup error:", err);
          setError(err instanceof Error ? err.message : "Erro ao carregar dados");
          setLoading(false);
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, storeVersion]);

  const saveConfig = useCallback(
    async (data: Partial<StoreConfig>) => {
      if (!user) throw new Error("Usuário não autenticado");

      try {
        setError(null);
        const uid = user.uid;

        // Build the storeConfig nested object matching CRM format
        // Only include fields that are actually set
        const storeConfigUpdate: Record<string, unknown> = {};

        if (data.storeName !== undefined) storeConfigUpdate.storeName = data.storeName;
        if (data.description !== undefined) storeConfigUpdate.description = data.description;
        if (data.category !== undefined) storeConfigUpdate.category = data.category;
        if (data.whatsapp !== undefined) storeConfigUpdate.whatsapp = data.whatsapp;
        if (data.themeColor !== undefined) storeConfigUpdate.themeColor = data.themeColor;
        if (data.logoUrl !== undefined) storeConfigUpdate.logoUrl = data.logoUrl;
        if (data.bannerUrl !== undefined) storeConfigUpdate.bannerUrl = data.bannerUrl;
        if (data.fullAddress !== undefined) storeConfigUpdate.fullAddress = data.fullAddress;
        if (data.latitude !== undefined) storeConfigUpdate.latitude = data.latitude;
        if (data.longitude !== undefined) storeConfigUpdate.longitude = data.longitude;
        if (data.isOpen !== undefined) storeConfigUpdate.isOpen = data.isOpen;
        if (data.openingHours !== undefined) storeConfigUpdate.openingHours = data.openingHours;
        if (data.enableNativePayment !== undefined) storeConfigUpdate.enableNativePayment = data.enableNativePayment;
        if (data.pixKey !== undefined) storeConfigUpdate.pixKey = data.pixKey;
        if (data.document !== undefined) storeConfigUpdate.document = data.document;
        if (data.isPublished !== undefined) {
          storeConfigUpdate.isPublished = data.isPublished;
        }
        if (data.allowPickup !== undefined) storeConfigUpdate.allowPickup = data.allowPickup;
        if (data.deliverySettings !== undefined) storeConfigUpdate.deliverySettings = data.deliverySettings;
        if (data.sections !== undefined) storeConfigUpdate.sections = data.sections;

        // Also handle old field names → map to storeConfig fields
        // If user provides old field names (from the form), convert them
        if (data.nomeLoja !== undefined && !data.storeName) storeConfigUpdate.storeName = data.nomeLoja;
        if (data.slogan !== undefined && !data.description) storeConfigUpdate.description = data.slogan;
        if (data.logo !== undefined && !data.logoUrl) storeConfigUpdate.logoUrl = data.logo;
        if (data.telefone !== undefined && !data.whatsapp) storeConfigUpdate.whatsapp = data.telefone;
        if (data.phone !== undefined && !data.whatsapp) storeConfigUpdate.whatsapp = data.phone;
        if (data.cnpj !== undefined && !data.document) storeConfigUpdate.document = data.cnpj;
        if (data.endereco !== undefined && !data.fullAddress) storeConfigUpdate.fullAddress = data.endereco;
        if (data.address !== undefined && !data.fullAddress) storeConfigUpdate.fullAddress = data.address;
        if (data.email !== undefined) storeConfigUpdate.email = data.email;

        // Save to Firestore as nested storeConfig field on merchant doc
        // Using dot notation for nested updates
        const dotNotationUpdate: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(storeConfigUpdate)) {
          dotNotationUpdate[`storeConfig.${key}`] = value;
        }
        // Also save isPublished at the top level for CRM compatibility
        if (data.isPublished !== undefined) {
          dotNotationUpdate.isPublished = data.isPublished;
        }
        dotNotationUpdate.updatedAt = Timestamp.now();

        console.log("[useStoreConfig] Saving storeConfig:", dotNotationUpdate);

        // Salva no doc da loja ATIVA (main, sub-loja ou loja de equipe)
        const storeDocRef = doc(db, ensureMerchantPath());
        await trackWrite(fsSetDoc(storeDocRef, dotNotationUpdate, { merge: true }));
        console.log("[useStoreConfig] Config saved to Firestore");

      } catch (err: any) {
        console.error("[useStoreConfig] Save error:", err);
        const msg = err.message || "Erro ao salvar configurações";
        setError(msg);
        throw err;
      }
    },
    [user]
  );

  const clearError = useCallback(() => setError(null), []);

  return { config, loading, error, saveConfig, clearError };
}
