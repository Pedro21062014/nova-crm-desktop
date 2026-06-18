import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Save, Phone, Clock, Camera, MessageCircle, AlertCircle, X, CheckCircle2,
  MapPin, CreditCard, Key, Settings, ImageIcon, Search, Loader2,
  LayoutGrid, GripVertical, Eye, Globe2, Palette, Trash2, Copy, Type,
  ShoppingBag, Image, Sparkles, ChevronDown, ChevronUp, Plus, ExternalLink,
  Tag, FileText, PhoneCall, Upload,
  RefreshCw, Download, Package, Monitor, Info,
} from "lucide-react";
import { Card, Button, Input, Skeleton } from "@/components/ui";
import { useStoreConfig } from "@/hooks/useStoreConfig";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { type StoreConfig } from "@/services/firebase";

// ── Helpers ──

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Types ──

type TabKey = "geral" | "horarios" | "pagamento" | "construtor" | "sistema";

interface StoreSection {
  id: string;
  type: "hero" | "products" | "text" | "image";
  title?: string;
  emoji?: string;
  content?: string;
  backgroundColor?: string;
  textColor?: string;
  imageUrl?: string;
  filterCategory?: string;
  layout?: "grid" | "list";
}

// ── Animation Variants ──

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const sectionVariants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: "auto", transition: { duration: 0.25 } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

// ── Default Values ──

const defaultOpeningHours: Record<string, { open: string; close: string; closed: boolean }> = {
  domingo: { open: "08:00", close: "18:00", closed: true },
  segunda: { open: "08:00", close: "18:00", closed: false },
  terca: { open: "08:00", close: "18:00", closed: false },
  quarta: { open: "08:00", close: "18:00", closed: false },
  quinta: { open: "08:00", close: "18:00", closed: false },
  sexta: { open: "08:00", close: "18:00", closed: false },
  sabado: { open: "08:00", close: "14:00", closed: false },
};

const dayLabels: Record<string, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

const categories = [
  { value: "Alimentação", label: "Alimentação" },
  { value: "Beleza", label: "Beleza" },
  { value: "Casa", label: "Casa" },
  { value: "Eletrônicos", label: "Eletrônicos" },
  { value: "Farmácia", label: "Farmácia" },
  { value: "Mercado", label: "Mercado" },
  { value: "Moda", label: "Moda" },
  { value: "Pet Shop", label: "Pet Shop" },
  { value: "Saúde", label: "Saúde" },
  { value: "Serviços", label: "Serviços" },
  { value: "Tecnologia", label: "Tecnologia" },
  { value: "Outros", label: "Outros" },
];

const presetColors = [
  "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0d9488",
  "#0284c7", "#1e293b",
];

const sectionEmojis = ["", "🔥", "⭐", "🎉", "🛒", "🎁", "📍", "💪", "✨", "🏆", "💎", "🚀"];

// ── Toggle Switch Component ──

function ToggleSwitch({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-success" : "bg-muted"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
        checked ? "translate-x-6" : "translate-x-1"
      }`} />
    </button>
  );
}

// ── Section Card (collapsible) ──

function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {badge}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="pt-4 mt-4 border-t border-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── Main Component ──

export function SettingsPage() {
  const { config, loading, error, saveConfig, clearError } = useStoreConfig();
  const update = useAutoUpdate();
  const [form, setForm] = useState<StoreConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("geral");

  // Image upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const [editingHeroId, setEditingHeroId] = useState<string | null>(null);

  // Address search states
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Construtor states
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  // ── Merge config into form ──
  useEffect(() => {
    if (config) {
      setForm({
        storeName: safeStr(config.storeName || config.nomeLoja || config.name),
        description: safeStr(config.description || config.slogan),
        whatsapp: safeStr(config.whatsapp || config.telefone || config.phone),
        logoUrl: safeStr(config.logoUrl || config.logo),
        bannerUrl: safeStr(config.bannerUrl),
        fullAddress: safeStr(config.fullAddress || config.endereco || config.address),
        document: safeStr(config.document || config.cnpj),
        pixKey: safeStr(config.pixKey),
        enableNativePayment: config.enableNativePayment ?? false,
        isOpen: config.isOpen ?? true,
        category: config.category || "",
        themeColor: config.themeColor || "#4f46e5",
        email: safeStr(config.email),
        latitude: config.latitude,
        longitude: config.longitude,
        isPublished: config.isPublished ?? false,
        openingHours: config.openingHours || defaultOpeningHours,
        sections: config.sections || [],
        allowPickup: config.allowPickup ?? true,
      });
    }
  }, [config]);

  // ── Save handler ──
  const handleSave = async () => {
    if (form.enableNativePayment && (!form.pixKey || !form.document)) {
      setLocalError("Voce habilitou o Pagamento Nativo (PIX), mas nao configurou sua Chave PIX ou CPF/CNPJ. Preencha os dados antes de salvar.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setLocalError(null);
    try {
      await saveConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar configuracoes:", err);
      setLocalError(err.message || "Erro ao salvar configuracoes.");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle publish ──
  const togglePublish = async () => {
    if (!form.isPublished && form.enableNativePayment && (!form.pixKey || !form.document)) {
      setLocalError("Configure sua Chave PIX e CPF/CNPJ antes de publicar a loja.");
      return;
    }
    const newStatus = !form.isPublished;
    setForm(prev => ({ ...prev, isPublished: newStatus }));
    setSaving(true);
    try {
      // Only save isPublished field — avoids sending the entire form (which may
      // contain large base64 images in sections/logo that could exceed Firestore
      // document size limits or cause silent write failures).
      await saveConfig({ isPublished: newStatus });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      // Revert on error so the UI reflects the real state
      setForm(prev => ({ ...prev, isPublished: !newStatus }));
      setLocalError(err.message || "Erro ao alterar status de publicacao.");
    } finally {
      setSaving(false);
    }
  };

  // ── Image upload ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLocalError("Selecione uma imagem valida."); return; }
    if (file.size > 2 * 1024 * 1024) { setLocalError("A imagem deve ter no maximo 2MB."); return; }
    setUploadingLogo(true);
    try {
      const base64 = await fileToBase64(file);
      setForm({ ...form, logoUrl: base64 });
    } catch { setLocalError("Erro ao carregar a imagem."); }
    finally { setUploadingLogo(false); }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLocalError("Selecione uma imagem valida."); return; }
    if (file.size > 2 * 1024 * 1024) { setLocalError("A imagem deve ter no maximo 2MB."); return; }
    setUploadingBanner(true);
    try {
      const base64 = await fileToBase64(file);
      setForm({ ...form, bannerUrl: base64 });
    } catch { setLocalError("Erro ao carregar a imagem."); }
    finally { setUploadingBanner(false); }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLocalError("Selecione uma imagem valida."); return; }
    if (file.size > 5 * 1024 * 1024) { setLocalError("A imagem deve ter no maximo 5MB."); return; }
    setUploadingHeroImage(true);
    try {
      const base64 = await fileToBase64(file);
      updateSection(sectionId, { imageUrl: base64 });
    } catch { setLocalError("Erro ao carregar a imagem."); }
    finally { setUploadingHeroImage(false); }
  };

  // ── Address search (Photon API) ──
  const searchAddress = async () => {
    if (!addressQuery.trim()) return;
    setSearchingAddress(true);
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(addressQuery)}&limit=5`);
      const data = await response.json();
      const results = data.features.map((f: any) => {
        const props = f.properties;
        const parts = [];
        if (props.name) parts.push(props.name);
        if (props.street) parts.push(props.street);
        if (props.housenumber) parts.push(props.housenumber);
        if (props.district) parts.push(props.district);
        if (props.city) parts.push(props.city);
        if (props.state) parts.push(props.state);
        return { display_name: parts.join(", "), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
      });
      setAddressResults(results);
    } catch { setLocalError("Erro ao buscar endereco."); }
    finally { setSearchingAddress(false); }
  };

  const selectAddress = (result: any) => {
    setForm({ ...form, latitude: parseFloat(result.lat), longitude: parseFloat(result.lon), fullAddress: result.display_name });
    setAddressResults([]);
    setAddressQuery("");
  };

  const getMyLocation = () => {
    if (!navigator.geolocation) { setLocalError("Geolocalizacao nao suportada."); return; }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
          const response = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`);
          const data = await response.json();
          let displayName = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
          if (data?.features?.length > 0) {
            const props = data.features[0].properties;
            const parts = [];
            if (props.name) parts.push(props.name);
            if (props.street) parts.push(props.street);
            if (props.housenumber) parts.push(props.housenumber);
            if (props.district) parts.push(props.district);
            if (props.city) parts.push(props.city);
            if (props.state) parts.push(props.state);
            displayName = parts.join(", ");
          }
          setForm({ ...form, latitude: lat, longitude: lon, fullAddress: displayName });
        } catch {
          setForm({ ...form, latitude: lat, longitude: lon, fullAddress: `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}` });
        } finally { setLoadingLocation(false); }
      },
      () => { setLocalError("Erro ao obter localizacao."); setLoadingLocation(false); },
      { enableHighAccuracy: true }
    );
  };

  // ── Construtor helpers ──
  const sections = (form.sections || []) as StoreSection[];

  const addSection = (type: StoreSection["type"]) => {
    const newSection: StoreSection = {
      id: Date.now().toString(),
      type,
      title: type === "hero" ? "Novo Banner" : type === "products" ? "Nossos Produtos" : type === "image" ? "Galeria" : "Nova Secao de Texto",
      content: type === "text" ? "Clique para editar este texto..." : type === "hero" ? "Subtitulo do banner" : "",
      backgroundColor: type === "hero" ? "" : "#ffffff",
      textColor: type === "hero" ? "#ffffff" : "#000000",
      layout: type === "products" ? "grid" : undefined,
    };
    setForm({ ...form, sections: [...sections, newSection] });
    setActiveSectionId(newSection.id);
  };

  const updateSection = (id: string, updates: Partial<StoreSection>) => {
    setForm({ ...form, sections: sections.map(s => s.id === id ? { ...s, ...updates } : s) });
  };

  const removeSection = (id: string) => {
    setForm({ ...form, sections: sections.filter(s => s.id !== id) });
    if (activeSectionId === id) setActiveSectionId(null);
  };

  const duplicateSection = (id: string) => {
    const section = sections.find(s => s.id === id);
    if (!section) return;
    const newSection = { ...section, id: Date.now().toString(), title: `${section.title || "Secao"} (copia)` };
    const idx = sections.findIndex(s => s.id === id);
    const newSections = [...sections];
    newSections.splice(idx + 1, 0, newSection);
    setForm({ ...form, sections: newSections });
    setActiveSectionId(newSection.id);
  };

  const handleDragStart = (index: number) => setDraggedItem(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null) return;
    const newSections = [...sections];
    const item = newSections[draggedItem];
    newSections.splice(draggedItem, 1);
    newSections.splice(index, 0, item);
    setForm({ ...form, sections: newSections });
    setDraggedItem(null);
  };

  // ── Derive display values ──
  const storeName = form.storeName || "Minha Loja";
  const logoUrl = form.logoUrl || "";
  const bannerUrl = form.bannerUrl || "";
  const themeColor = form.themeColor || "#4f46e5";

  // ── Tab definitions ──
  const tabs: { key: TabKey; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: "geral", label: "Geral", icon: <Settings className="h-3.5 w-3.5" />, desc: "Identidade e informacoes" },
    { key: "horarios", label: "Horarios", icon: <Clock className="h-3.5 w-3.5" />, desc: "Funcionamento" },
    { key: "pagamento", label: "Pagamento", icon: <CreditCard className="h-3.5 w-3.5" />, desc: "PIX e recebimentos" },
    { key: "construtor", label: "Construtor", icon: <LayoutGrid className="h-3.5 w-3.5" />, desc: "Monte sua loja" },
    { key: "sistema", label: "Sistema", icon: <Monitor className="h-3.5 w-3.5" />, desc: "Atualizacoes e versao" },
  ];

  const sectionTypeIcon = (type: StoreSection["type"]) => {
    switch (type) {
      case "hero": return <Camera className="h-4 w-4 text-accent shrink-0" />;
      case "products": return <ShoppingBag className="h-4 w-4 text-success shrink-0" />;
      case "text": return <Type className="h-4 w-4 text-warning shrink-0" />;
      case "image": return <Image className="h-4 w-4 text-blue-500 shrink-0" />;
      default: return <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const sectionTypeLabel = (type: StoreSection["type"]) => {
    switch (type) {
      case "hero": return "Banner";
      case "products": return "Produtos";
      case "text": return "Texto";
      case "image": return "Imagem";
      default: return type;
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-6 space-y-6 max-w-5xl"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden shrink-0" style={{ backgroundColor: logoUrl ? "transparent" : themeColor + "20" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Store className="h-7 w-7" style={{ color: themeColor }} />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{storeName}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Configuracoes da sua loja</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Publish toggle */}
          <button
            onClick={togglePublish}
            disabled={saving}
            className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors shadow-xs ${
              form.isPublished
                ? "bg-success-light text-success hover:bg-success-light/80"
                : "bg-muted text-muted-foreground hover:bg-border"
            }`}
          >
            <Globe2 className="h-4 w-4 inline mr-1.5" />
            {saving ? "Aguarde..." : form.isPublished ? "Publicada (Ocultar)" : "Publicar Loja"}
          </button>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1 text-sm text-success"
            >
              <CheckCircle2 className="h-4 w-4" /> Salvo!
            </motion.span>
          )}
          <Button icon={<Save className="h-4 w-4" />} onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </div>
      </motion.div>

      {/* ── Status Cards ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${form.isPublished ? "bg-success-light" : "bg-muted"}`}>
            <Globe2 className={`h-4 w-4 ${form.isPublished ? "text-success" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className={`text-sm font-semibold ${form.isPublished ? "text-success" : "text-muted-foreground"}`}>
              {form.isPublished ? "Publicada" : "Oculta"}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${form.isOpen ? "bg-success-light" : "bg-muted"}`}>
            <Store className={`h-4 w-4 ${form.isOpen ? "text-success" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Loja</p>
            <p className={`text-sm font-semibold ${form.isOpen ? "text-success" : "text-muted-foreground"}`}>
              {form.isOpen ? "Aberta" : "Fechada"}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${form.enableNativePayment ? "bg-success-light" : "bg-muted"}`}>
            <CreditCard className={`h-4 w-4 ${form.enableNativePayment ? "text-success" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pagamento</p>
            <p className={`text-sm font-semibold ${form.enableNativePayment ? "text-success" : "text-muted-foreground"}`}>
              {form.enableNativePayment ? "Ativo" : "Inativo"}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: themeColor + "20" }}>
            <LayoutGrid className="h-4 w-4" style={{ color: themeColor }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Secoes</p>
            <p className="text-sm font-semibold text-foreground">{sections.length}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Error Banner ── */}
      <AnimatePresence>
        {(localError || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
          >
            <AlertCircle className="h-4 w-4 text-danger shrink-0" />
            <p className="text-sm text-danger flex-1">{localError || error}</p>
            <button onClick={() => { setLocalError(null); clearError(); }} className="text-danger/60 hover:text-danger">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ── */}
      <motion.div variants={itemVariants}>
        <div className="flex bg-muted p-1 rounded-xl gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-card text-accent shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={tab.desc}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Tab Content ── */}
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><div className="space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></Card>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* ──── GERAL TAB ──── */}
          {activeTab === "geral" && (
            <motion.div key="geral" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Identidade da Loja */}
              <SectionCard
                title="Identidade da Loja"
                icon={<Store className="h-5 w-5 text-accent" />}
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <Input label="Nome da Loja" value={form.storeName || ""} onChange={e => setForm({ ...form, storeName: e.target.value })} placeholder="Minha Loja" />
                  <Input label="Descricao / Slogan" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Uma frase que representa seu negocio" />

                  {/* Categoria */}
                  <div>
                    <label className="text-sm font-medium text-foreground/80">Categoria Principal</label>
                    <select
                      value={form.category || ""}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
                    >
                      <option value="">Selecione uma categoria...</option>
                      {categories.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </SectionCard>

              {/* Midia (Logo + Banner) */}
              <SectionCard
                title="Midia"
                icon={<Camera className="h-5 w-5 text-accent" />}
                defaultOpen={true}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground/80">Logo da Loja</label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors relative overflow-hidden mt-1.5 group">
                      {logoUrl ? (
                        <>
                          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="h-5 w-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          {uploadingLogo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                          <span className="text-[10px] mt-1 font-medium">{uploadingLogo ? "Enviando..." : "Upload Logo"}</span>
                          <span className="text-[9px] text-muted-foreground/60 mt-0.5">Max 2MB</span>
                        </div>
                      )}
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                    {logoUrl && (
                      <button onClick={() => setForm({ ...form, logoUrl: "" })} className="text-[10px] text-danger font-bold mt-1 hover:underline w-full text-center">Remover Logo</button>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground/80">Capa (Banner)</label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors relative overflow-hidden mt-1.5 group">
                      {bannerUrl ? (
                        <>
                          <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          {uploadingBanner ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                          <span className="text-[10px] mt-1 font-medium">{uploadingBanner ? "Enviando..." : "Upload Capa"}</span>
                          <span className="text-[9px] text-muted-foreground/60 mt-0.5">Max 2MB</span>
                        </div>
                      )}
                      <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                    </label>
                    {bannerUrl && (
                      <button onClick={() => setForm({ ...form, bannerUrl: "" })} className="text-[10px] text-danger font-bold mt-1 hover:underline w-full text-center">Remover Capa</button>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Contato */}
              <SectionCard
                title="Contato"
                icon={<Phone className="h-5 w-5 text-accent" />}
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <Input
                    label="WhatsApp"
                    value={form.whatsapp || ""}
                    onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="5511999999999"
                    icon={<MessageCircle className="h-4 w-4" />}
                  />
                  <p className="text-xs text-muted-foreground -mt-2">Numero para atendimento e pedidos via WhatsApp. Inclua o codigo do pais.</p>
                </div>
              </SectionCard>

              {/* Localizacao */}
              <SectionCard
                title="Localizacao"
                icon={<MapPin className="h-5 w-5 text-accent" />}
                defaultOpen={true}
              >
                {form.fullAddress ? (
                  <div className="bg-muted p-4 rounded-xl border text-sm">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{form.fullAddress}</p>
                        {form.latitude != null && form.longitude != null && (
                          <p className="text-muted-foreground text-xs mt-1">Lat: {form.latitude.toFixed(5)}, Lon: {form.longitude.toFixed(5)}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setForm({ ...form, fullAddress: "", latitude: undefined, longitude: undefined })} className="text-danger text-xs font-bold mt-3 hover:underline flex items-center gap-1">
                      <X className="h-3 w-3" /> Alterar Endereco
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                        placeholder="Digite o endereco (Rua, Cidade...)"
                        value={addressQuery}
                        onChange={e => setAddressQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && searchAddress()}
                      />
                      <button onClick={searchAddress} disabled={searchingAddress} className="h-10 px-3 bg-foreground text-background rounded-xl hover:bg-foreground/90 disabled:opacity-50 flex items-center justify-center">
                        {searchingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </button>
                    </div>
                    {addressResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-border rounded-xl bg-card shadow-sm">
                        {addressResults.map((result, idx) => (
                          <div key={idx} onClick={() => selectAddress(result)} className="p-2.5 text-sm border-b border-border last:border-0 hover:bg-accent-light cursor-pointer transition-colors">
                            {result.display_name}
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={getMyLocation} disabled={loadingLocation} className="w-full h-10 bg-muted text-foreground font-medium text-sm rounded-xl hover:bg-border flex items-center justify-center gap-2 disabled:opacity-50">
                      {loadingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                      {loadingLocation ? "Buscando..." : "Usar Localizacao Atual (GPS)"}
                    </button>
                  </div>
                )}
              </SectionCard>

              {/* Aparencia */}
              <SectionCard
                title="Aparencia"
                icon={<Palette className="h-5 w-5 text-accent" />}
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground/80">Cor do Tema</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {presetColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setForm({ ...form, themeColor: color })}
                          className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                            themeColor === color ? "border-foreground scale-110 shadow-md" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          className="w-8 h-8 rounded-lg cursor-pointer border-2 border-dashed border-border"
                          value={themeColor}
                          onChange={e => setForm({ ...form, themeColor: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Escolha a cor principal da sua loja. Ela sera usada nos botoes, destaques e cabecalho.</p>
                  </div>
                  {/* Theme preview */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: themeColor }}>
                      Aa
                    </div>
                    <div className="flex-1">
                      <div className="h-3 rounded-full w-24 mb-1.5" style={{ backgroundColor: themeColor }} />
                      <div className="h-2 rounded-full w-32 bg-muted" />
                    </div>
                    <div className="h-8 px-3 rounded-lg text-white text-xs font-bold flex items-center" style={{ backgroundColor: themeColor }}>
                      Botao
                    </div>
                  </div>
                </div>
              </SectionCard>
            </motion.div>
          )}

          {/* ──── HORARIOS TAB ──── */}
          {activeTab === "horarios" && (
            <motion.div key="horarios" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="h-5 w-5 text-accent" />
                  <h2 className="text-base font-semibold text-foreground">Horarios de Funcionamento</h2>
                </div>

                {/* Toggle open/closed */}
                <div className="bg-muted p-4 rounded-xl border mb-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${form.isOpen ? "bg-success-light" : "bg-border"}`}>
                        <Store className={`h-5 w-5 ${form.isOpen ? "text-success" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground block">Loja Aberta Agora?</span>
                        <span className="text-xs text-muted-foreground">Controle manual de abertura/fechamento</span>
                      </div>
                    </div>
                    <ToggleSwitch checked={!!form.isOpen} onChange={() => setForm({ ...form, isOpen: !form.isOpen })} />
                  </div>
                  <div className={`text-sm font-medium mt-2 ${form.isOpen ? "text-success" : "text-muted-foreground"}`}>
                    {form.isOpen ? "Aberta - Clientes podem fazer pedidos" : "Fechada - Pedidos temporariamente pausados"}
                  </div>
                </div>

                {/* Weekly schedule */}
                <div className="space-y-2">
                  {Object.entries(dayLabels).map(([dayKey, dayLabel]) => {
                    const dayConfig = (form.openingHours as any)?.[dayKey] || defaultOpeningHours[dayKey] || { open: "08:00", close: "18:00", closed: false };
                    const isToday = new Date().toLocaleDateString("pt-BR", { weekday: "long" }).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().startsWith(dayKey.slice(0, 3));
                    return (
                      <div
                        key={dayKey}
                        className={`flex items-center justify-between gap-3 text-sm p-2.5 rounded-lg transition-colors ${
                          isToday ? "bg-accent-light border border-accent/20" : dayConfig.closed ? "bg-muted/30" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="w-28 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!dayConfig.closed}
                            onChange={e => {
                              const newHours = { ...(form.openingHours as any) };
                              newHours[dayKey] = { ...dayConfig, closed: !e.target.checked };
                              setForm({ ...form, openingHours: newHours });
                            }}
                            className="rounded text-accent focus:ring-accent/30"
                          />
                          <span className={`font-medium ${dayConfig.closed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {dayLabel}
                            {isToday && <span className="ml-1 text-[9px] text-accent font-bold uppercase">(Hoje)</span>}
                          </span>
                        </div>
                        {!dayConfig.closed ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={dayConfig.open}
                              onChange={e => {
                                const newHours = { ...(form.openingHours as any) };
                                newHours[dayKey] = { ...dayConfig, open: e.target.value };
                                setForm({ ...form, openingHours: newHours });
                              }}
                              className="h-9 px-2 border border-border rounded-lg text-foreground text-center flex-1 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                            />
                            <span className="text-muted-foreground text-xs">ate</span>
                            <input
                              type="time"
                              value={dayConfig.close}
                              onChange={e => {
                                const newHours = { ...(form.openingHours as any) };
                                newHours[dayKey] = { ...dayConfig, close: e.target.value };
                                setForm({ ...form, openingHours: newHours });
                              }}
                              className="h-9 px-2 border border-border rounded-lg text-foreground text-center flex-1 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                            />
                          </div>
                        ) : (
                          <div className="flex-1 text-center text-muted-foreground text-xs py-2 bg-muted rounded-lg border border-border">Fechado</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ──── PAGAMENTO TAB ──── */}
          {activeTab === "pagamento" && (
            <motion.div key="pagamento" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <CreditCard className="h-5 w-5 text-accent" />
                  <h2 className="text-base font-semibold text-foreground">Pagamento e Recebimento</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <Input
                      label="Chave PIX (Para Recebimentos)"
                      value={form.pixKey || ""}
                      onChange={e => setForm({ ...form, pixKey: e.target.value })}
                      placeholder="CPF, CNPJ, E-mail, Telefone ou Aleatoria"
                      icon={<Key className="h-4 w-4" />}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Obrigatorio para habilitar o pagamento nativo via PIX.</p>
                  </div>

                  <div className="border-t pt-4">
                    <Input
                      label="CPF/CNPJ da Loja"
                      value={form.document || ""}
                      onChange={e => setForm({ ...form, document: e.target.value })}
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Obrigatorio para processar pagamentos nativos.</p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="bg-muted p-4 rounded-xl border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${form.enableNativePayment ? "bg-success-light" : "bg-border"}`}>
                            <CreditCard className={`h-5 w-5 ${form.enableNativePayment ? "text-success" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-foreground block">Pagamento Nativo (PIX/Cartao)</span>
                            <span className="text-xs text-muted-foreground">Permitir que clientes paguem direto na loja</span>
                          </div>
                        </div>
                        <ToggleSwitch
                          checked={!!form.enableNativePayment}
                          onChange={() => {
                            if (!form.enableNativePayment && !form.pixKey) {
                              setLocalError("Configure sua Chave PIX antes de habilitar o pagamento nativo.");
                              return;
                            }
                            setForm({ ...form, enableNativePayment: !form.enableNativePayment });
                          }}
                        />
                      </div>
                      {form.enableNativePayment && form.pixKey && (
                        <div className="mt-3 flex items-center gap-2 text-success text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pagamento ativo — Chave PIX configurada
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ──── CONSTRUTOR TAB ──── */}
          {activeTab === "construtor" && (
            <motion.div key="construtor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Add section buttons */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-accent" />
                    <h2 className="text-base font-semibold text-foreground">Elementos da Loja</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Adicione secoes para montar a pagina da sua loja. Arraste para reordenar.</p>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => addSection("hero")}
                    className="flex flex-col items-center gap-2 p-3 bg-muted hover:bg-border rounded-xl text-foreground text-xs font-medium transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="h-5 w-5 text-accent" />
                    </div>
                    Banner
                  </button>
                  <button
                    onClick={() => addSection("products")}
                    className="flex flex-col items-center gap-2 p-3 bg-muted hover:bg-border rounded-xl text-foreground text-xs font-medium transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-success-light flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShoppingBag className="h-5 w-5 text-success" />
                    </div>
                    Produtos
                  </button>
                  <button
                    onClick={() => addSection("text")}
                    className="flex flex-col items-center gap-2 p-3 bg-muted hover:bg-border rounded-xl text-foreground text-xs font-medium transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-warning-light flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Type className="h-5 w-5 text-warning" />
                    </div>
                    Texto
                  </button>
                  <button
                    onClick={() => addSection("image")}
                    className="flex flex-col items-center gap-2 p-3 bg-muted hover:bg-border rounded-xl text-foreground text-xs font-medium transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Image className="h-5 w-5 text-blue-500" />
                    </div>
                    Imagem
                  </button>
                </div>
              </Card>

              {/* Active section editor */}
              {activeSectionId && (() => {
                const section = sections.find(s => s.id === activeSectionId);
                if (!section) return null;
                return (
                  <Card className="border-accent/30 bg-accent-light/30">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        {sectionTypeIcon(section.type)}
                        <span className="text-xs font-bold uppercase text-accent">
                          Editando: {sectionTypeLabel(section.type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => duplicateSection(section.id)}
                          className="h-7 px-2 bg-muted hover:bg-border rounded-lg text-foreground text-xs font-medium flex items-center gap-1 transition-colors"
                          title="Duplicar secao"
                        >
                          <Copy className="h-3 w-3" /> Duplicar
                        </button>
                        <button onClick={() => setActiveSectionId(null)} className="text-accent/60 hover:text-accent">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {/* Title for all sections */}
                      <div>
                        <label className="text-xs font-medium text-foreground/80">Titulo da Secao</label>
                        <div className="flex gap-2 mt-1">
                          <select
                            value={section.emoji || ""}
                            onChange={e => updateSection(section.id, { emoji: e.target.value })}
                            className="h-9 w-12 border border-border rounded-lg bg-background text-center text-sm"
                          >
                            {sectionEmojis.map(em => (
                              <option key={em} value={em}>{em || "—"}</option>
                            ))}
                          </select>
                          <input
                            className="flex h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs"
                            value={section.title || ""}
                            onChange={e => updateSection(section.id, { title: e.target.value })}
                            placeholder="Titulo da secao"
                          />
                        </div>
                      </div>

                      {/* Content / Subtitle for hero and text */}
                      {(section.type === "hero" || section.type === "text") && (
                        <div>
                          <label className="text-xs font-medium text-foreground/80">
                            {section.type === "hero" ? "Subtitulo" : "Conteudo"}
                          </label>
                          <textarea
                            className="mt-1 flex w-full rounded-lg border border-border bg-background px-3 py-2 text-xs resize-none min-h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                            value={section.content || ""}
                            onChange={e => updateSection(section.id, { content: e.target.value })}
                            placeholder={section.type === "hero" ? "Subtitulo do banner..." : "Escreva seu texto aqui..."}
                          />
                        </div>
                      )}

                      {/* Hero image - upload or URL */}
                      {section.type === "hero" && (
                        <div>
                          <label className="text-xs font-medium text-foreground/80">Imagem de Fundo</label>
                          {section.imageUrl ? (
                            <div className="mt-1 relative group rounded-lg overflow-hidden">
                              <img src={section.imageUrl} alt="Hero" className="w-full h-32 object-cover rounded-lg" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setEditingHeroId(section.id)}
                                  className="h-8 px-3 bg-white/20 text-white text-xs font-medium rounded-lg backdrop-blur-sm hover:bg-white/30"
                                >
                                  <input
                                    ref={editingHeroId === section.id ? heroImageInputRef : null}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => handleHeroImageUpload(e, section.id)}
                                    disabled={uploadingHeroImage}
                                  />
                                  Trocar
                                </button>
                                <button
                                  onClick={() => updateSection(section.id, { imageUrl: "" })}
                                  className="h-8 px-3 bg-danger/80 text-white text-xs font-medium rounded-lg hover:bg-danger"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 space-y-2">
                              <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex flex-col items-center text-muted-foreground">
                                  {uploadingHeroImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                  <span className="text-[10px] mt-1 font-medium">{uploadingHeroImage ? "Enviando..." : "Upload de Imagem"}</span>
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => handleHeroImageUpload(e, section.id)}
                                  disabled={uploadingHeroImage}
                                />
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-[10px] text-muted-foreground">ou</span>
                                <div className="h-px flex-1 bg-border" />
                              </div>
                              <input
                                className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
                                value={section.imageUrl || ""}
                                onChange={e => updateSection(section.id, { imageUrl: e.target.value })}
                                placeholder="Cole uma URL de imagem..."
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Image section - upload */}
                      {section.type === "image" && (
                        <div>
                          <label className="text-xs font-medium text-foreground/80">Imagem</label>
                          {section.imageUrl ? (
                            <div className="mt-1 relative group rounded-lg overflow-hidden">
                              <img src={section.imageUrl} alt="Section" className="w-full h-32 object-cover rounded-lg" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() => updateSection(section.id, { imageUrl: "" })}
                                  className="h-8 px-3 bg-danger/80 text-white text-xs font-medium rounded-lg hover:bg-danger"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 space-y-2">
                              <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex flex-col items-center text-muted-foreground">
                                  {uploadingHeroImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                  <span className="text-[10px] mt-1 font-medium">Upload de Imagem</span>
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => handleHeroImageUpload(e, section.id)}
                                  disabled={uploadingHeroImage}
                                />
                              </label>
                              <input
                                className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
                                value={section.imageUrl || ""}
                                onChange={e => updateSection(section.id, { imageUrl: e.target.value })}
                                placeholder="Ou cole uma URL de imagem..."
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Products section - filter & layout */}
                      {section.type === "products" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-foreground/80">Filtrar por Categoria</label>
                            <input
                              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
                              value={section.filterCategory || ""}
                              onChange={e => updateSection(section.id, { filterCategory: e.target.value })}
                              placeholder="Todas as categorias"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para mostrar todos os produtos.</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-foreground/80">Layout</label>
                            <div className="flex gap-2 mt-1">
                              <button
                                onClick={() => updateSection(section.id, { layout: "grid" })}
                                className={`flex-1 h-9 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                                  (section.layout || "grid") === "grid"
                                    ? "border-accent bg-accent-light text-accent"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                <LayoutGrid className="h-3.5 w-3.5" /> Grid
                              </button>
                              <button
                                onClick={() => updateSection(section.id, { layout: "list" })}
                                className={`flex-1 h-9 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                                  section.layout === "list"
                                    ? "border-accent bg-accent-light text-accent"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                <FileText className="h-3.5 w-3.5" /> Lista
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Colors */}
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-medium text-foreground/80">Cor de Fundo</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              className="w-8 h-8 border-none bg-transparent cursor-pointer"
                              value={section.backgroundColor || (section.type === "hero" ? themeColor : "#ffffff")}
                              onChange={e => updateSection(section.id, { backgroundColor: e.target.value })}
                            />
                            <span className="text-xs text-muted-foreground">{section.backgroundColor || (section.type === "hero" ? "Tema" : "Branco")}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-foreground/80">Cor do Texto</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              className="w-8 h-8 border-none bg-transparent cursor-pointer"
                              value={section.textColor || (section.type === "hero" ? "#ffffff" : "#000000")}
                              onChange={e => updateSection(section.id, { textColor: e.target.value })}
                            />
                            <span className="text-xs text-muted-foreground">{section.textColor || (section.type === "hero" ? "Branco" : "Preto")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Remove section */}
                      <button
                        onClick={() => removeSection(section.id)}
                        className="w-full h-9 bg-danger-light border border-danger/20 text-danger text-xs font-bold rounded-lg hover:bg-danger-light/80 flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover Secao
                      </button>
                    </div>
                  </Card>
                );
              })()}

              {/* Section list with drag & drop */}
              {sections.length === 0 ? (
                <Card>
                  <div className="text-center py-10">
                    <div className="h-16 w-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                      <LayoutGrid className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhuma secao adicionada</p>
                    <p className="text-xs text-muted-foreground mt-1">Use os botoes acima para comecar a montar sua loja.</p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="space-y-1.5">
                    {sections.map((section, index) => (
                      <div
                        key={section.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, index)}
                        onClick={() => setActiveSectionId(section.id === activeSectionId ? null : section.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-move transition-all ${
                          activeSectionId === section.id
                            ? "border-accent/30 bg-accent-light/50"
                            : "border-border bg-background hover:bg-muted/50"
                        } ${draggedItem === index ? "opacity-40 scale-95" : "opacity-100"}`}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {sectionTypeIcon(section.type)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {section.emoji && <span className="text-sm">{section.emoji}</span>}
                              <p className="text-sm font-medium text-foreground truncate">{section.title || "Sem titulo"}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{sectionTypeLabel(section.type)}{section.type === "products" && section.filterCategory ? ` — ${section.filterCategory}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {section.type === "products" && (
                            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">
                              {section.layout || "grid"}
                            </span>
                          )}
                          <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: section.backgroundColor || (section.type === "hero" ? themeColor : "#ffffff") }} />
                          <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: section.textColor || "#000000" }} />
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }}
                            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Duplicar"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    <span className="font-semibold">Dica:</span> Arraste para reordenar. Clique para editar. Use o botao de duplicar para copiar secoes.
                  </p>
                </Card>
              )}

              {/* Store Preview */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-accent" />
                    <h2 className="text-base font-semibold text-foreground">Preview da Loja</h2>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-lg">Visualizacao aproximada</span>
                </div>
                <div className="rounded-2xl border-[6px] border-foreground/80 overflow-hidden max-w-[360px] mx-auto shadow-lg">
                  {/* Phone top bar */}
                  <div className="bg-foreground/80 flex justify-center py-1">
                    <div className="w-20 h-4 bg-foreground rounded-b-lg" />
                  </div>
                  {/* Store preview content */}
                  <div className="bg-background overflow-y-auto max-h-[460px]">
                    {/* Banner */}
                    <div className="h-24 w-full bg-cover bg-center relative" style={{
                      backgroundImage: bannerUrl ? `url(${bannerUrl})` : `linear-gradient(to right, ${themeColor}, ${themeColor}dd)`,
                    }}>
                      {form.isPublished && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-success text-white text-[8px] font-bold rounded uppercase">Ao Vivo</span>
                      )}
                    </div>
                    {/* Logo + Name */}
                    <div className="px-4 -mt-8 flex flex-col items-center gap-2 relative z-10 text-center pb-4">
                      <div className="w-14 h-14 rounded-full border-2 border-card bg-card shadow overflow-hidden">
                        {logoUrl ? (
                          <img src={logoUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ color: themeColor }}>
                            <Store className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h1 className="font-bold text-foreground text-sm leading-tight">{storeName}</h1>
                        <p className="text-muted-foreground text-[10px] mt-0.5">{form.description || ""}</p>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          {form.category && (
                            <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[8px] font-bold rounded uppercase tracking-wider">
                              {form.category}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase ${form.isOpen ? "bg-success-light text-success" : "bg-muted text-muted-foreground"}`}>
                            {form.isOpen ? "Aberta" : "Fechada"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Sections preview */}
                    {sections.map(section => (
                      <div key={section.id} className="border-t border-border">
                        {section.type === "hero" && (
                          <div
                            className="w-full py-8 px-4 text-center flex flex-col items-center justify-center min-h-[120px]"
                            style={{
                              backgroundColor: section.backgroundColor || themeColor,
                              backgroundImage: section.imageUrl ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${section.imageUrl})` : "none",
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              color: section.textColor || "#ffffff",
                            }}
                          >
                            {section.emoji && <span className="text-2xl mb-1">{section.emoji}</span>}
                            <h2 className="text-base font-bold leading-tight">{section.title || "Banner"}</h2>
                            <p className="text-[10px] opacity-80 mt-1 max-w-[200px]">{section.content || ""}</p>
                          </div>
                        )}
                        {section.type === "products" && (
                          <div className="py-3 px-4" style={{ backgroundColor: section.backgroundColor || "#ffffff" }}>
                            {section.title && (
                              <h3 className="text-xs font-bold text-center mb-2" style={{ color: section.textColor || "#0a0a0a" }}>
                                {section.emoji && <span className="mr-1">{section.emoji}</span>}
                                {section.title}
                              </h3>
                            )}
                            {(section.layout || "grid") === "grid" ? (
                              <div className="grid grid-cols-2 gap-2">
                                {[1, 2, 3, 4].map(i => (
                                  <div key={i} className="bg-muted rounded-lg h-14 flex items-center justify-center">
                                    <ShoppingBag className="h-4 w-4 text-muted-foreground/30" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className="flex items-center gap-2 bg-muted rounded-lg p-2">
                                    <div className="w-10 h-10 bg-border rounded-lg shrink-0" />
                                    <div className="flex-1">
                                      <div className="h-2 w-20 bg-border rounded" />
                                      <div className="h-1.5 w-12 bg-border rounded mt-1" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {section.type === "text" && (
                          <div className="py-5 px-4 text-center" style={{ backgroundColor: section.backgroundColor || "#ffffff", color: section.textColor || "#0a0a0a" }}>
                            {section.emoji && <span className="text-lg block mb-1">{section.emoji}</span>}
                            {section.title && <h3 className="text-xs font-bold mb-1">{section.title}</h3>}
                            <p className="text-[10px] opacity-80 leading-relaxed max-w-[250px] mx-auto">{section.content || ""}</p>
                          </div>
                        )}
                        {section.type === "image" && (
                          <div style={{ backgroundColor: section.backgroundColor || "#ffffff" }}>
                            {section.imageUrl ? (
                              <img src={section.imageUrl} alt="Section" className="w-full h-32 object-cover" />
                            ) : (
                              <div className="h-32 flex items-center justify-center bg-muted">
                                <Image className="h-8 w-8 text-muted-foreground/20" />
                              </div>
                            )}
                            {section.title && (
                              <p className="text-[10px] text-center py-2 opacity-60" style={{ color: section.textColor || "#000000" }}>
                                {section.emoji && <span className="mr-1">{section.emoji}</span>}
                                {section.title}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {sections.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground">
                        <p className="text-[10px]">Adicione secoes no construtor</p>
                      </div>
                    )}
                  </div>
                  {/* Phone bottom bar */}
                  <div className="h-8 bg-card border-t flex justify-around items-center px-4">
                    <div className="w-5 h-5 rounded-full bg-muted" />
                    <div className="w-5 h-5 rounded-full bg-muted" />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ──── SISTEMA TAB ──── */}
          {activeTab === "sistema" && (
            <motion.div key="sistema" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Atualizações do App */}
              <SectionCard
                title="Atualizações do Aplicativo"
                icon={<RefreshCw className="h-5 w-5 text-accent" />}
                defaultOpen={true}
              >
                <div className="space-y-4">

                  {/* Status atual */}
                  <div className="flex items-center gap-4 rounded-xl bg-muted p-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      update.status === "available" || update.status === "downloaded"
                        ? "bg-warning-light"
                        : update.status === "error"
                        ? "bg-danger-light"
                        : "bg-success-light"
                    }`}>
                      <Package className={`h-6 w-6 ${
                        update.status === "available" || update.status === "downloaded"
                          ? "text-warning"
                          : update.status === "error"
                          ? "text-danger"
                          : "text-success"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Versão instalada</p>
                      <p className="text-base font-semibold text-foreground">
                        v{update.currentVersion || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className={`text-sm font-semibold ${
                        update.status === "available" ? "text-warning"
                        : update.status === "downloaded" ? "text-success"
                        : update.status === "downloading" ? "text-accent"
                        : update.status === "error" ? "text-danger"
                        : update.status === "checking" ? "text-accent"
                        : update.status === "dev" ? "text-muted-foreground"
                        : "text-muted-foreground"
                      }`}>
                        {update.status === "idle" && "Aguardando verificação"}
                        {update.status === "checking" && "Verificando..."}
                        {update.status === "available" && `v${update.updateInfo?.version} disponível`}
                        {update.status === "not-available" && "Atualizado"}
                        {update.status === "downloading" && "Baixando..."}
                        {update.status === "downloaded" && "Pronto para instalar"}
                        {update.status === "installing" && "Instalando..."}
                        {update.status === "error" && "Erro"}
                        {update.status === "dev" && "Modo desenvolvimento"}
                      </p>
                    </div>
                  </div>

                  {/* Mensagem de erro */}
                  {update.error && (
                    <div className="flex items-start gap-2 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Falha ao verificar atualizações</p>
                        <p className="text-xs mt-0.5 opacity-90">{update.error}</p>
                      </div>
                    </div>
                      )}

                  {/* Release notes quando há atualização */}
                  {update.updateInfo && (update.status === "available" || update.status === "downloaded") && (
                    <div className="rounded-xl border border-warning/30 bg-warning-light/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-warning" />
                        <p className="text-sm font-semibold text-foreground">
                          Novidades da v{update.updateInfo.version}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {typeof update.updateInfo.releaseNotes === "string"
                          ? update.updateInfo.releaseNotes
                          : Array.isArray(update.updateInfo.releaseNotes)
                          ? update.updateInfo.releaseNotes.map((n, i) => `• ${n.note || n.version}`).join("\n")
                          : "Veja os detalhes no GitHub."}
                      </div>
                    </div>
                  )}

                  {/* Progresso de download */}
                  {update.status === "downloading" && update.downloadProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Baixando atualização...</span>
                        <span>{update.downloadProgress.percent}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${update.downloadProgress.percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(update.downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB / {(update.downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex flex-wrap gap-2">
                    {/* Verificar atualizações */}
                    <Button
                      variant="secondary"
                      size="md"
                      icon={update.status === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      onClick={update.checkForUpdates}
                      disabled={update.status === "checking" || update.status === "downloading" || update.status === "installing" || !update.isElectron}
                    >
                      Verificar atualizações
                    </Button>

                    {/* Baixar */}
                    {update.status === "available" && (
                      <Button
                        variant="primary"
                        size="md"
                        icon={<Download className="h-4 w-4" />}
                        onClick={update.downloadUpdate}
                      >
                        Baixar atualização
                      </Button>
                    )}

                    {/* Instalar */}
                    {update.status === "downloaded" && (
                      <Button
                        variant="primary"
                        size="md"
                        icon={<Package className="h-4 w-4" />}
                        onClick={update.installUpdate}
                      >
                        Instalar e reiniciar
                      </Button>
                    )}
                  </div>

                  {!update.isElectron && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      As atualizações automáticas funcionam apenas na versão instalada do app (não em desenvolvimento).
                    </p>
                  )}
                </div>
              </SectionCard>

              {/* Informações do Sistema */}
              <SectionCard
                title="Informações do Sistema"
                icon={<Monitor className="h-5 w-5 text-muted-foreground" />}
                defaultOpen={false}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Aplicativo</p>
                      <p className="font-medium text-foreground">Nova CRM Desktop</p>
                    </div>
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Versão</p>
                      <p className="font-medium text-foreground">v{update.currentVersion || "—"}</p>
                    </div>
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Plataforma</p>
                      <p className="font-medium text-foreground capitalize">
                        {update.isElectron ? (window.electronAPI?.platform || "—") : "Navegador"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Repositório</p>
                      <a
                        href="https://github.com/Pedro21062014/nova-crm-desktop/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent hover:underline inline-flex items-center gap-1"
                      >
                        Ver releases <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </SectionCard>

            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}
