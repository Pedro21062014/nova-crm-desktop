// ── StoreSwitcher ──
// Seletor de loja (paridade com o ActiveStoreSwitcher do CRM web):
// - mostra a loja ativa (logo + nome) num botão no topo da sidebar
// - dropdown com "Minhas Lojas" (main + sub-lojas) e "Lojas da Equipe"
// - seleção troca a loja ativa (reassina todos os dados do app)

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  ChevronDown,
  Check,
  Crown,
  Settings,
  ShieldCheck,
  Store,
  Users2,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { MAIN_STORE_ID } from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useActiveStore } from "@/hooks/useActiveStore";
import { cn } from "@/lib/utils";

interface StoreEntry {
  id: string;
  storeName: string;
  category?: string;
  logoUrl?: string;
}

interface TeamStoreEntry {
  merchantId: string;
  storeName: string;
  logoUrl?: string;
  role: string;
  roleTitle: string;
  permissions: Record<string, boolean>;
  invitedBy?: string;
}

interface Props {
  collapsed: boolean;
}

export function StoreSwitcher({ collapsed }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeStoreId,
    isMainStore,
    isTeamStore,
    activeTeamStore,
    selectOwnStore,
    selectTeamStore,
  } = useActiveStore();

  const [stores, setStores] = useState<StoreEntry[]>([]);
  const [teamStores, setTeamStores] = useState<TeamStoreEntry[]>([]);
  const [mainStore, setMainStore] = useState<{ storeName: string; logoUrl?: string }>({
    storeName: "Loja Principal",
  });
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Sub-lojas próprias: merchants/{uid}/stores
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      collection(db, `merchants/${user.uid}/stores`),
      (snap) => {
        const list: StoreEntry[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            storeName: data.storeConfig?.storeName || "Sem nome",
            category: data.storeConfig?.category,
            logoUrl: data.storeConfig?.logoUrl,
          });
        });
        list.sort((a, b) => a.storeName.localeCompare(b.storeName));
        setStores(list);
      },
      () => {}
    );
    return () => unsub();
  }, [user?.uid]);

  // 2. Nome + logo da loja principal
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      doc(db, "merchants", user.uid),
      (snap) => {
        if (snap.exists()) {
          const cfg = (snap.data() as any)?.storeConfig;
          setMainStore({
            storeName: cfg?.storeName || "Loja Principal",
            logoUrl: cfg?.logoUrl,
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [user?.uid]);

  // 3. Lojas de equipe: teamInvites por e-mail (dedup por merchantId + nome ao vivo)
  useEffect(() => {
    if (!user?.email || !user?.uid) return;
    const normalizedEmail = user.email.toLowerCase().trim();
    const q = query(collection(db, "teamInvites"), where("email", "==", normalizedEmail));
    const merchantUnsubs = new Map<string, () => void>();

    const unsubInvites = onSnapshot(
      q,
      (snap) => {
        const rawMap = new Map<string, TeamStoreEntry>();
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data.status !== "revoked" && data.merchantId && data.merchantId !== user.uid) {
            if (!rawMap.has(data.merchantId)) {
              rawMap.set(data.merchantId, {
                merchantId: data.merchantId,
                storeName: data.merchantStoreName || data.storeName || "Loja Compartilhada",
                logoUrl: data.logoUrl,
                role: data.role || "sales",
                roleTitle: data.roleTitle || "Colaborador",
                permissions: data.permissions || {},
                invitedBy: data.invitedBy || "Administrador",
              });
            }
          }
        });

        const ids = Array.from(rawMap.keys());
        for (const [mid, un] of merchantUnsubs.entries()) {
          if (!ids.includes(mid)) {
            un();
            merchantUnsubs.delete(mid);
          }
        }

        setTeamStores(Array.from(rawMap.values()));

        // Nome/logo ao vivo do doc do merchant
        ids.forEach((merchantId) => {
          if (!merchantUnsubs.has(merchantId)) {
            const mUnsub = onSnapshot(
              doc(db, "merchants", merchantId),
              (mSnap) => {
                if (mSnap.exists()) {
                  const cfg = (mSnap.data() as any)?.storeConfig;
                  const liveName = cfg?.storeName || (mSnap.data() as any)?.storeName || (mSnap.data() as any)?.name || "Loja Compartilhada";
                  const liveLogo = cfg?.logoUrl || (mSnap.data() as any)?.logoUrl;
                  setTeamStores((prev) =>
                    prev.map((ts) =>
                      ts.merchantId === merchantId
                        ? { ...ts, storeName: liveName, logoUrl: liveLogo || ts.logoUrl }
                        : ts
                    )
                  );
                }
              },
              () => {}
            );
            merchantUnsubs.set(merchantId, mUnsub);
          }
        });

        // Sem seleção salva e há convite válido → ativa a primeira (igual ao CRM)
        try {
          const savedTeam = localStorage.getItem("novaCrmActiveTeamStore");
          const savedId = localStorage.getItem("novaCrmActiveStoreId");
          const first = Array.from(rawMap.values())[0];
          if (!savedTeam && (!savedId || savedId === MAIN_STORE_ID) && first) {
            selectTeamStore({
              merchantId: first.merchantId,
              storeName: first.storeName,
              logoUrl: first.logoUrl,
              role: first.role,
              roleTitle: first.roleTitle,
              permissions: first.permissions as any,
              invitedBy: first.invitedBy,
            });
          }
        } catch { /* ignore */ }
      },
      () => {}
    );

    return () => {
      unsubInvites();
      merchantUnsubs.forEach((un) => un());
      merchantUnsubs.clear();
    };
  }, [user?.email, user?.uid, selectTeamStore]);

  // Click fora fecha
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Loja ativa para exibir no botão
  const activeDisplay =
    isTeamStore && activeTeamStore ? (
      (() => {
        const live = teamStores.find((ts) => ts.merchantId === activeTeamStore.merchantId);
        return {
          name: live?.storeName || activeTeamStore.storeName || "Loja da Equipe",
          logo: live?.logoUrl || activeTeamStore.logoUrl,
          subtitle: live?.roleTitle || activeTeamStore.roleTitle || "Colaborador",
          isTeam: true,
        };
      })()
    ) : isMainStore ? (
      {
        name: mainStore.storeName,
        logo: mainStore.logoUrl,
        subtitle: "Principal",
        isTeam: false,
      }
    ) : (
      (() => {
        const s = stores.find((x) => x.id === activeStoreId);
        return {
          name: s?.storeName || "Loja",
          logo: s?.logoUrl,
          subtitle: s?.category || "Loja",
          isTeam: false,
        };
      })()
    );

  const renderLogo = (logoUrl?: string, size: number = 30, team: boolean = false) =>
    logoUrl ? (
      <img src={logoUrl} alt="" className="rounded-lg object-cover shrink-0" style={{ width: size, height: size }} />
    ) : (
      <div
        className={cn(
          "rounded-lg flex items-center justify-center text-white shrink-0",
          team ? "bg-emerald-600" : "bg-indigo-600"
        )}
        style={{ width: size, height: size }}
      >
        {team ? <Users2 size={size * 0.52} /> : <Store size={size * 0.52} />}
      </div>
    );

  const handleSelectOwn = (id: string) => {
    selectOwnStore(id);
    setIsOpen(false);
  };

  const handleSelectTeam = (info: TeamStoreEntry) => {
    selectTeamStore({
      merchantId: info.merchantId,
      storeName: info.storeName,
      logoUrl: info.logoUrl,
      role: info.role,
      roleTitle: info.roleTitle,
      permissions: info.permissions as any,
      invitedBy: info.invitedBy,
    });
    setIsOpen(false);
  };

  const dropdownContent = (
    <div className="p-2 space-y-2">
      {/* MINHAS LOJAS */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5 flex items-center gap-1.5">
          <Crown size={11} className="text-amber-500" /> Minhas Lojas
        </p>
        <button
          onClick={() => handleSelectOwn(MAIN_STORE_ID)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
            isMainStore
              ? "bg-accent text-accent-foreground font-medium"
              : "text-foreground hover:bg-muted"
          )}
        >
          {renderLogo(mainStore.logoUrl, 28, false)}
          <div className="flex-1 min-w-0 text-left">
            <p className="truncate font-medium text-xs">{mainStore.storeName}</p>
            <p className="text-[10px] text-amber-600 flex items-center gap-1">
              <Crown size={9} /> Principal
            </p>
          </div>
          {isMainStore && <Check size={14} className="shrink-0 text-accent" />}
        </button>
        {stores.map((s) => {
          const selected = !isTeamStore && activeStoreId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleSelectOwn(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                selected ? "bg-accent text-accent-foreground font-medium" : "text-foreground hover:bg-muted"
              )}
            >
              {renderLogo(s.logoUrl, 28, false)}
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate font-medium text-xs">{s.storeName}</p>
                {s.category && <p className="text-[10px] text-muted-foreground truncate">{s.category}</p>}
              </div>
              {selected && <Check size={14} className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>

      {/* LOJAS DA EQUIPE */}
      {teamStores.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5 flex items-center gap-1.5">
            <Users2 size={11} className="text-emerald-500" /> Lojas da Equipe
          </p>
          {teamStores.map((ts) => {
            const selected = isTeamStore && activeTeamStore?.merchantId === ts.merchantId;
            return (
              <button
                key={ts.merchantId}
                onClick={() => handleSelectTeam(ts)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                  selected ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium" : "text-foreground hover:bg-muted"
                )}
              >
                {renderLogo(ts.logoUrl, 28, true)}
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate font-medium text-xs">{ts.storeName}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck size={9} /> {ts.roleTitle}
                  </p>
                </div>
                {selected && <Check size={14} className="shrink-0 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      )}

      {/* AÇÕES */}
      <div className="border-t border-border pt-2 flex flex-col gap-0.5">
        <button
          onClick={() => {
            setIsOpen(false);
            navigate("/equipe");
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Users2 size={13} className="text-indigo-500" /> Minha Equipe
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            navigate("/minha-loja");
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Settings size={13} /> Gerenciar Loja
        </button>
      </div>
    </div>
  );

  // ── COLLAPSED: só o logo, dropdown fixo à direita ──
  if (collapsed) {
    return (
      <div className="flex justify-center pt-2">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="relative rounded-xl overflow-hidden ring-2 ring-transparent hover:ring-accent/50 transition-all cursor-pointer"
          title={`${activeDisplay.name} (${activeDisplay.subtitle})`}
        >
          {renderLogo(activeDisplay.logo, 40, activeDisplay.isTeam)}
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-sidebar flex items-center justify-center",
              activeDisplay.isTeam ? "bg-emerald-600" : "bg-indigo-600"
            )}
          >
            <ChevronDown size={9} className="text-white" />
          </div>
        </button>
        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, x: -10, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="fixed top-24 left-20 w-72 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden z-50"
              >
                {dropdownContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── EXPANDED: logo + nome + chevron, dropdown abaixo ──
  return (
    <div className="relative px-3 pt-3">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all text-left cursor-pointer border",
          activeDisplay.isTeam
            ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
            : "bg-muted/60 border-border hover:bg-muted"
        )}
      >
        {renderLogo(activeDisplay.logo, 30, activeDisplay.isTeam)}
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-bold text-foreground">{activeDisplay.name}</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            {activeDisplay.isTeam ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck size={9} /> {activeDisplay.subtitle}
              </span>
            ) : isMainStore ? (
              <span className="flex items-center gap-1">
                <Crown size={9} className="text-amber-500" /> Loja Principal
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Store size={9} /> {activeDisplay.subtitle}
              </span>
            )}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={cn("shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-3 right-3 top-full mt-1.5 bg-card text-card-foreground rounded-2xl shadow-xl border border-border overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
            >
              {dropdownContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
