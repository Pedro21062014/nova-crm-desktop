// ── TeamPage (Aba Equipe) ──
// Paridade com o TeamManager do CRM web:
// - lista membros (Admin Principal no topo + colaboradores) com presença real-time
// - convidar por e-mail com cargo (presets) + permissões granulares por módulo
// - editar cargo/permissões, remover/revogar, copiar link de convite
// - convites recebidos de outras lojas com "Acessar Loja"
// - writes idênticos ao CRM: team/{id-sanitized} + team/{email} + teamInvites global

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Crown,
  Mail,
  Package,
  Pencil,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  TicketPercent,
  Trash2,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Users2,
  Wallet,
  Zap,
  MessageSquare,
  FileText,
  Calendar,
  Award,
  ShieldCheck,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useActiveStore } from "@/hooks/useActiveStore";
import { useTeamPresence } from "@/hooks/useTeamPresence";
import { useToast } from "@/hooks/useToast";
import {
  ROLE_PRESETS,
  PERMISSION_METADATA,
  CATEGORY_LABELS,
  sanitizeDocId,
  type TeamMember,
  type TeamRole,
  type TeamPermissions,
  type ActiveTeamStoreInfo,
} from "@/lib/teamRoles";
import { cn } from "@/lib/utils";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatLastSeen(lastSeen: unknown): string {
  if (!lastSeen) return "Offline";
  const ls = lastSeen as any;
  let ms: number | null = null;
  if (typeof ls === "number") ms = ls;
  else if (typeof ls?.toMillis === "function") ms = ls.toMillis();
  else if (typeof ls?.seconds === "number") ms = ls.seconds * 1000;
  if (ms === null) return "Offline";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Visto agora";
  if (diff < 3_600_000) return `Visto há ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Visto há ${Math.floor(diff / 3_600_000)} h`;
  return `Visto há ${Math.floor(diff / 86_400_000)} d`;
}

const ROLE_ICONS: Record<string, any> = {
  orders: ShoppingCart,
  clients: Users,
  pipeline: TrendingUp,
  proposals: FileText,
  tasks: Calendar,
  automations: Zap,
  products: Package,
  store: Store,
  coupons: TicketPercent,
  loyalty: Award,
  deliveries: Truck,
  wallet: Wallet,
  ai_chat: MessageSquare,
  team: Users2,
};

function RoleBadge({ role }: { role: TeamRole }) {
  if (role === "admin")
    return (
      <Badge variant="default" className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30">
        <Crown size={10} className="mr-1" /> Admin
      </Badge>
    );
  if (role === "manager")
    return (
      <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30">
        <ShieldCheck size={10} className="mr-1" /> Gerente
      </Badge>
    );
  if (role === "custom")
    return <Badge variant="default">Personalizado</Badge>;
  const preset = ROLE_PRESETS.find((p) => p.role === role);
  return <Badge variant="default">{preset?.title || role}</Badge>;
}

// ── Página ──────────────────────────────────────────────────────────────────

export function TeamPage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    activeStoreId,
    isMainStore,
    isTeamStore,
    activeTeamStore,
    effectiveMerchantId,
    hasPermission,
    selectTeamStore,
  } = useActiveStore();

  const effectiveUid = user ? effectiveMerchantId(user.uid) : "";
  const canManageTeam = !isTeamStore || hasPermission("team");

  // Dados da loja (owner, nome, logo)
  const [storeOwner, setStoreOwner] = useState<{
    name: string;
    email: string;
    storeName: string;
    logoUrl?: string;
    ownerUid: string;
  } | null>(null);

  // Membros
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Convites recebidos de outras lojas
  const [receivedInvites, setReceivedInvites] = useState<any[]>([]);

  // UI
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "online" | "pending" | "admins">("all");

  // Modais
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  // Form de convite/edição
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [selectedRole, setSelectedRole] = useState<TeamRole>("sales");
  const [permissions, setPermissions] = useState<TeamPermissions>(
    ROLE_PRESETS.find((p) => p.role === "sales")!.permissions
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Presença real-time
  const { getMemberPresence } = useTeamPresence(effectiveUid, user ? {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  } : undefined);

  // 1. Dados do dono da loja ativa
  useEffect(() => {
    if (!effectiveUid) return;
    const unsub = onSnapshot(
      doc(db, "merchants", effectiveUid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const cfg = data.storeConfig || {};
          setStoreOwner({
            name: cfg.ownerName || data.ownerName || data.name || data.email?.split("@")[0] || "Administrador Principal",
            email: data.email || "",
            storeName: cfg.storeName || data.storeName || data.name || "Minha Loja",
            logoUrl: cfg.logoUrl || data.logoUrl,
            ownerUid: effectiveUid,
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [effectiveUid]);

  // 2. Membros da equipe (dedup por e-mail, pula o dono)
  useEffect(() => {
    if (!effectiveUid) return;
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, "merchants", effectiveUid, "team"),
      (snap) => {
        const map = new Map<string, TeamMember>();
        snap.forEach((d) => {
          const data = d.data() as any;
          const email = (data.email || "").toLowerCase().trim();
          const key = email || data.userId || d.id;
          if (!key) return;
          if (data.userId === effectiveUid || key === effectiveUid) return;
          const existing = map.get(key);
          if (!existing || (existing.status === "pending" && data.status === "active")) {
            map.set(key, {
              id: d.id,
              merchantId: effectiveUid,
              userId: data.userId,
              email: data.email || email,
              name: data.name || email.split("@")[0],
              role: data.role || "sales",
              roleTitle: data.roleTitle || "Colaborador",
              permissions: data.permissions || {},
              status: data.status || "active",
              isOwner: false,
              invitedBy: data.invitedBy,
              invitedAt: data.invitedAt,
              joinedAt: data.joinedAt,
              updatedAt: data.updatedAt,
              avatarUrl: data.avatarUrl,
              lastActiveAt: data.lastActiveAt,
            });
          }
        });
        setMembers(Array.from(map.values()));
        setLoading(false);
      },
      (err) => {
        console.error("[Team] onSnapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [effectiveUid]);

  // 3. Convites recebidos (email == meu, pendentes, de outra loja)
  useEffect(() => {
    if (!user?.email) return;
    const email = user.email.toLowerCase().trim();
    const q = query(collection(db, "teamInvites"), where("email", "==", email), where("status", "==", "pending"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data.merchantId && data.merchantId !== user.uid) list.push({ id: d.id, ...data });
        });
        setReceivedInvites(list);
      },
      () => {}
    );
    return () => unsub();
  }, [user?.email, user?.uid]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRoleChange = (role: TeamRole) => {
    setSelectedRole(role);
    const preset = ROLE_PRESETS.find((p) => p.role === role);
    if (preset && role !== "custom") setPermissions(preset.permissions);
  };

  const togglePermission = (key: keyof TeamPermissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    setSelectedRole("custom");
  };

  const toggleCategory = (category: "sales" | "catalog" | "management", on: boolean) => {
    setPermissions((prev) => {
      const updated = { ...prev };
      PERMISSION_METADATA.filter((p) => p.category === category).forEach((p) => {
        updated[p.key] = on;
      });
      return updated;
    });
    setSelectedRole("custom");
  };

  const teamColPath = () => `merchants/${effectiveUid}/team`;

  const inviteKeyBase = () =>
    isMainStore || isTeamStore ? `${effectiveUid}` : `${effectiveUid}_${activeStoreId}`;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam) {
      toast.error("Você não tem permissão para gerenciar a equipe nesta loja.");
      return;
    }
    const emailClean = inviteEmail.toLowerCase().trim();
    if (!emailClean || !emailClean.includes("@")) {
      toast.error("Informe um e-mail válido para o colaborador.");
      return;
    }
    if (storeOwner?.email && emailClean === storeOwner.email.toLowerCase().trim()) {
      toast.error("Este e-mail pertence ao Administrador Principal da loja.");
      return;
    }

    setIsSubmitting(true);
    try {
      const rolePreset = ROLE_PRESETS.find((p) => p.role === selectedRole);
      const roleTitle = rolePreset?.title || "Colaborador";
      const memberDocId = sanitizeDocId(emailClean);
      const memberPayload = {
        email: emailClean,
        name: inviteName.trim() || emailClean.split("@")[0],
        role: selectedRole,
        roleTitle,
        permissions,
        status: "pending",
        invitedAt: serverTimestamp(),
        invitedBy: user?.email || "Proprietário",
      };

      // 1. Subcollection team (doc sanitizado + doc por e-mail, igual ao CRM)
      await Promise.all([
        setDoc(doc(db, teamColPath(), memberDocId), memberPayload, { merge: true }),
        setDoc(doc(db, teamColPath(), emailClean), memberPayload, { merge: true }),
      ]);

      // 2. Coleção global teamInvites (para o switcher/convites recebidos)
      const storeName = storeOwner?.storeName || "Minha Loja";
      const invitePayload = {
        merchantId: effectiveUid,
        storeId: isMainStore || isTeamStore ? null : activeStoreId,
        merchantStoreName: storeName,
        email: emailClean,
        name: inviteName.trim() || emailClean.split("@")[0],
        role: selectedRole,
        roleTitle,
        permissions,
        status: "pending",
        invitedAt: serverTimestamp(),
        invitedBy: user?.email || "Proprietário",
      };
      await Promise.all([
        setDoc(doc(db, "teamInvites", `${inviteKeyBase()}_${memberDocId}`), invitePayload, { merge: true }),
        setDoc(doc(db, "teamInvites", `${inviteKeyBase()}_${emailClean}`), invitePayload, { merge: true }),
      ]);

      toast.success(`Convite enviado para ${emailClean}!`);
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteName("");
      setSelectedRole("sales");
      setPermissions(ROLE_PRESETS.find((p) => p.role === "sales")!.permissions);
    } catch (err: any) {
      console.error("[Team] invite error:", err);
      toast.error("Erro ao enviar convite: " + (err?.message || "Verifique suas permissões."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || selectedMember.isOwner) return;
    if (!canManageTeam) {
      toast.error("Você não tem permissão para editar membros.");
      return;
    }
    setIsSubmitting(true);
    try {
      const rolePreset = ROLE_PRESETS.find((p) => p.role === selectedRole);
      const roleTitle = rolePreset?.title || "Colaborador";
      const updateData = {
        role: selectedRole,
        roleTitle,
        permissions,
        name: inviteName.trim() || selectedMember.name,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, teamColPath(), selectedMember.id), updateData);

      // Espelha nos docs de e-mail + teamInvites global
      const promises: Promise<any>[] = [
        setDoc(doc(db, "teamInvites", `${inviteKeyBase()}_${selectedMember.id}`), updateData, { merge: true }).catch(() => {}),
      ];
      if (selectedMember.email) {
        const rawEmail = selectedMember.email.toLowerCase().trim();
        promises.push(
          setDoc(doc(db, teamColPath(), rawEmail), updateData, { merge: true }).catch(() => {}),
          setDoc(doc(db, "teamInvites", `${inviteKeyBase()}_${rawEmail}`), updateData, { merge: true }).catch(() => {})
        );
      }
      await Promise.all(promises);

      toast.success("Permissões do membro atualizadas!");
      setIsEditModalOpen(false);
      setSelectedMember(null);
    } catch (err: any) {
      console.error("[Team] update error:", err);
      toast.error("Erro ao atualizar membro: " + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || memberToDelete.isOwner) return;
    if (!canManageTeam) {
      toast.error("Você não tem permissão para remover membros.");
      return;
    }
    try {
      const m = memberToDelete;
      const promises = [
        deleteDoc(doc(db, teamColPath(), m.id)),
        deleteDoc(doc(db, "teamInvites", `${inviteKeyBase()}_${m.id}`)).catch(() => {}),
      ];
      if (m.email) {
        const rawEmail = m.email.toLowerCase().trim();
        promises.push(
          deleteDoc(doc(db, teamColPath(), rawEmail)).catch(() => {}),
          deleteDoc(doc(db, "teamInvites", `${inviteKeyBase()}_${rawEmail}`)).catch(() => {})
        );
      }
      if (m.userId) {
        promises.push(deleteDoc(doc(db, teamColPath(), m.userId)).catch(() => {}));
      }
      await Promise.all(promises);
      toast.success(`Membro ${m.email} removido da equipe.`);
      setMemberToDelete(null);
    } catch (err: any) {
      console.error("[Team] delete error:", err);
      toast.error("Erro ao remover membro: " + (err?.message || err));
    }
  };

  const handleCopyInviteLink = (member: TeamMember) => {
    const inviteUrl = `${window.location.origin}/dashboard?team_invite=${effectiveUid}&email=${encodeURIComponent(member.email)}`;
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
    setCopiedId(member.id);
    toast.success("Link de acesso copiado!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const openEditModal = (member: TeamMember) => {
    if (member.isOwner) {
      toast.info("O Administrador Principal tem acesso total permanente.");
      return;
    }
    setSelectedMember(member);
    setInviteName(member.name || "");
    setSelectedRole(member.role || "sales");
    setPermissions(member.permissions || ROLE_PRESETS[5].permissions);
    setIsEditModalOpen(true);
  };

  // ── Lista + métricas ──────────────────────────────────────────────────────

  const allMembers = useMemo(() => {
    const list: TeamMember[] = [];
    if (storeOwner) {
      list.push({
        id: `owner_${effectiveUid}`,
        merchantId: effectiveUid,
        userId: effectiveUid,
        name: storeOwner.name || "Administrador Principal",
        email: storeOwner.email,
        role: "admin",
        roleTitle: "Admin Principal",
        status: "active",
        permissions: {
          orders: true, products: true, clients: true, pipeline: true, proposals: true,
          tasks: true, automations: true, store: true, loyalty: true, ai_chat: true,
          wallet: true, coupons: true, deliveries: true, team: true,
        },
        isOwner: true,
        avatarUrl: storeOwner.logoUrl,
        invitedAt: null,
      });
    }
    const others = members.filter(
      (m) => m.email?.toLowerCase().trim() !== storeOwner?.email?.toLowerCase().trim()
    );
    list.push(...others);
    return list;
  }, [storeOwner, effectiveUid, members]);

  const isOnline = (m: TeamMember) => getMemberPresence(m.userId, m.email, m.id).isOnline;

  const totalMembers = allMembers.length;
  const onlineMembers = allMembers.filter((m) => isOnline(m)).length;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  const filtered = useMemo(() => {
    return allMembers.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matches =
        (m.name?.toLowerCase().includes(q) ?? false) ||
        (m.email?.toLowerCase().includes(q) ?? false) ||
        (m.roleTitle?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
      if (filterTab === "online") return isOnline(m);
      if (filterTab === "pending") return m.status === "pending";
      if (filterTab === "admins") return m.isOwner || m.role === "admin" || m.role === "manager";
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMembers, searchQuery, filterTab, members]);

  // ── Form de permissões (usado nos dois modais) ────────────────────────────

  const permissionsForm = (
    <div className="space-y-3">
      {/* Presets de cargo */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">Cargo</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ROLE_PRESETS.map((preset) => (
            <button
              key={preset.role}
              type="button"
              onClick={() => handleRoleChange(preset.role)}
              title={preset.desc}
              className={cn(
                "px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors cursor-pointer",
                selectedRole === preset.role
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* Permissões por categoria */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">
          Permissões por módulo
        </label>
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {(["sales", "catalog", "management"] as const).map((cat) => {
            const items = PERMISSION_METADATA.filter((p) => p.category === cat);
            const allOn = items.every((p) => permissions[p.key]);
            return (
              <div key={cat} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat, true)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat, false)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {items.map((p) => {
                    const Icon = ROLE_ICONS[p.key] || Check;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePermission(p.key)}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border",
                          permissions[p.key]
                            ? "border-accent/40 bg-accent/10 text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                            permissions[p.key] ? "bg-accent border-accent text-accent-foreground" : "border-border"
                          )}
                        >
                          {permissions[p.key] && <Check size={11} />}
                        </span>
                        <Icon size={13} className="shrink-0" />
                        <span className="truncate">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {isTeamStore ? `Equipe · ${activeTeamStore?.storeName || "Loja da Equipe"}` : "Equipe & Colaboradores"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isTeamStore
              ? `Você está colaborando na loja de ${storeOwner?.name || "Administrador Principal"} como ${activeTeamStore?.roleTitle || "Colaborador"}.`
              : "Gerencie cargos, permissões por módulo e presença em tempo real."}
          </p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus size={15} className="mr-1.5" /> Convidar Membro
          </Button>
        )}
      </div>

      {/* Convites recebidos de outras lojas */}
      {!isTeamStore && receivedInvites.length > 0 && (
        <Card className="p-4 space-y-3 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
            <Sparkles size={16} /> Você foi convidado para colaborar em outra loja!
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {receivedInvites.map((inv) => (
              <div key={inv.id} className="p-3 rounded-xl border border-border bg-background flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{inv.merchantStoreName || "Loja Parceira"}</p>
                  <p className="text-xs text-muted-foreground">
                    Cargo: <span className="font-medium text-emerald-600 dark:text-emerald-400">{inv.roleTitle}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const info: ActiveTeamStoreInfo = {
                      merchantId: inv.merchantId,
                      storeName: inv.merchantStoreName || "Loja da Equipe",
                      logoUrl: inv.logoUrl,
                      role: inv.role,
                      roleTitle: inv.roleTitle,
                      permissions: inv.permissions,
                      invitedBy: inv.invitedBy,
                    };
                    selectTeamStore(info);
                    toast.success(`Agora você está operando na loja ${inv.merchantStoreName || "da equipe"}!`);
                  }}
                >
                  Acessar Loja <ArrowRight size={12} className="ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wide">Total da Equipe</span>
            <Users2 size={15} />
          </div>
          <p className="text-2xl font-bold">{totalMembers}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Nesta loja</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wide">Online Agora</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineMembers}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Presença em tempo real</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wide">Convites Pendentes</span>
            <Mail size={15} />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Aguardando acesso</p>
        </Card>
      </div>

      {/* Busca + filtros */}
      <Card className="p-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {([
              { id: "all", label: "Todos" },
              { id: "online", label: "Online" },
              { id: "pending", label: "Pendentes" },
              { id: "admins", label: "Admins" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                  filterTab === tab.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar membro..."
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 transition-all"
            />
          </div>
        </div>
      </Card>

      {/* Lista de membros */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <Users2 size={32} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Nenhum membro encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Convide colaboradores para trabalharem com você nesta loja.
            </p>
          </Card>
        ) : (
          filtered.map((m) => {
            const presence = getMemberPresence(m.userId, m.email, m.id);
            const online = presence.isOnline;
            return (
              <Card key={m.id} className={cn("p-4 flex items-center gap-3", m.isOwner && "border-amber-500/40")}>
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="h-11 w-11 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground uppercase">
                        {(m.name || m.email || "?").slice(0, 2)}
                      </span>
                    )}
                  </div>
                  {!m.isOwner && (
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background",
                        online ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{m.name || m.email}</p>
                    {m.isOwner ? (
                      <Badge variant="default" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        <Crown size={10} className="mr-1" /> Admin Principal
                      </Badge>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {m.status === "pending" && (
                      <Badge variant="warning">
                        <Clock size={10} className="mr-1" /> Convite pendente
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {m.email}
                    {m.invitedBy && !m.isOwner && <span className="ml-2">· convitado por {m.invitedBy}</span>}
                  </p>
                  {!m.isOwner && (
                    <p className={cn("text-[11px] mt-0.5 flex items-center gap-1", online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", online ? "bg-emerald-500" : "bg-current opacity-40")} />
                      {online ? "Online agora" : formatLastSeen(presence.lastSeen)}
                    </p>
                  )}
                </div>

                {/* Ações */}
                {canManageTeam && !m.isOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopyInviteLink(m)}
                      title="Copiar link de convite"
                      className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      {copiedId === m.id ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                    </button>
                    <button
                      onClick={() => openEditModal(m)}
                      title="Editar cargo/permissões"
                      className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setMemberToDelete(m)}
                      title="Remover da equipe"
                      className="p-2 rounded-lg text-muted-foreground hover:bg-danger-light hover:text-danger transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* ── Modal: Convidar ── */}
      <Modal
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Convidar Membro"
        size="lg"
      >
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="E-mail"
              type="email"
              placeholder="colaborador@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <Input
              label="Nome (opcional)"
              placeholder="Ex: Maria Silva"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>
          {permissionsForm}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Editar membro ── */}
      <Modal
        open={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedMember(null); }}
        title={`Editar Membro — ${selectedMember?.name || selectedMember?.email || ""}`}
        size="lg"
      >
        <form onSubmit={handleUpdateMember} className="space-y-4">
          <Input
            label="Nome"
            placeholder="Nome do colaborador"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
          {permissionsForm}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setIsEditModalOpen(false); setSelectedMember(null); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Confirmar remoção ── */}
      <Modal
        open={memberToDelete !== null}
        onClose={() => setMemberToDelete(null)}
        title="Remover da Equipe"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover{" "}
            <span className="font-semibold text-foreground">{memberToDelete?.email}</span> da equipe?
            {memberToDelete?.status === "pending"
              ? " O convite será revogado."
              : " A pessoa perderá o acesso a esta loja."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMemberToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteMember}>
              <Trash2 size={14} className="mr-1.5" /> Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
