import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Save, Phone, Clock, Camera, MessageCircle, AlertCircle, X, CheckCircle2,
  MapPin, CreditCard, Key, Upload, Settings, ImageIcon, Search, Loader2,
  LayoutGrid, GripVertical, Eye, Globe2, Palette, Trash2,
} from "lucide-react";
import { Card, Button, Input, Skeleton } from "@/components/ui";
import { useStoreConfig } from "@/hooks/useStoreConfig";
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

type TabKey = "geral" | "horarios" | "pagamento" | "construtor";

interface StoreSection {
  id: string;
  type: "hero" | "products" | "text";
  title?: string;
  content?: string;
  backgroundColor?: string;
  textColor?: string;
  imageUrl?: string;
  filterCategory?: string;
}

// ── Animation Variants ──

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
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

// ── Main Component ──

export function SettingsPage() {
  const { config, loading, error, saveConfig, clearError } = useStoreConfig();
  const [form, setForm] = useState<StoreConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("geral");

  // Image upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
      });
    }
  }, [config]);

  // ── Save handler ──
  const handleSave = async () => {
    if (form.enableNativePayment && (!form.pixKey || !form.document)) {
      setLocalError("Você habilitou o Pagamento Nativo (PIX), mas não configurou sua Chave PIX ou CPF/CNPJ. Preencha os dados antes de salvar.");
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
      console.error("Erro ao salvar configurações:", err);
      setLocalError(err.message || "Erro ao salvar configurações.");
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
    setForm({ ...form, isPublished: newStatus });
    setSaving(true);
    try {
      await saveConfig({ ...form, isPublished: newStatus });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setLocalError(err.message || "Erro ao alterar status de publicação.");
    } finally {
      setSaving(false);
    }
  };

  // ── Image upload ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLocalError("Selecione uma imagem válida."); return; }
    if (file.size > 2 * 1024 * 1024) { setLocalError("A imagem deve ter no máximo 2MB."); return; }
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
    if (!file.type.startsWith("image/")) { setLocalError("Selecione uma imagem válida."); return; }
    if (file.size > 2 * 1024 * 1024) { setLocalError("A imagem deve ter no máximo 2MB."); return; }
    setUploadingBanner(true);
    try {
      const base64 = await fileToBase64(file);
      setForm({ ...form, bannerUrl: base64 });
    } catch { setLocalError("Erro ao carregar a imagem."); }
    finally { setUploadingBanner(false); }
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
    } catch { setLocalError("Erro ao buscar endereço."); }
    finally { setSearchingAddress(false); }
  };

  const selectAddress = (result: any) => {
    setForm({ ...form, latitude: parseFloat(result.lat), longitude: parseFloat(result.lon), fullAddress: result.display_name });
    setAddressResults([]);
    setAddressQuery("");
  };

  const getMyLocation = () => {
    if (!navigator.geolocation) { setLocalError("Geolocalização não suportada."); return; }
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
      () => { setLocalError("Erro ao obter localização."); setLoadingLocation(false); },
      { enableHighAccuracy: true }
    );
  };

  // ── Construtor helpers ──
  const sections = (form.sections || []) as StoreSection[];

  const addSection = (type: "hero" | "products" | "text") => {
    const newSection: StoreSection = {
      id: Date.now().toString(),
      type,
      title: type === "hero" ? "Novo Banner" : type === "products" ? "Nossos Produtos" : "Nova Seção de Texto",
      content: type === "text" ? "Clique para editar este texto..." : "Subtítulo do banner",
      backgroundColor: "#ffffff",
      textColor: "#000000",
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
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "geral", label: "Geral", icon: <Settings className="h-3.5 w-3.5" /> },
    { key: "horarios", label: "Horários", icon: <Clock className="h-3.5 w-3.5" /> },
    { key: "pagamento", label: "Pagamento", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "construtor", label: "Construtor", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  ];

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
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Store className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{storeName}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Configurações da sua loja</p>
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
            {form.isPublished ? "Publicada" : "Não publicada"}
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
            <motion.div key="geral" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              {/* Informações Básicas */}
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Store className="h-5 w-5 text-accent" />
                  <h2 className="text-base font-semibold text-foreground">Informações Básicas</h2>
                </div>
                <div className="space-y-4">
                  <Input label="Nome da Loja" value={form.storeName || ""} onChange={e => setForm({ ...form, storeName: e.target.value })} placeholder="Minha Loja" />
                  <Input label="Descrição / Slogan" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Uma frase que representa seu negócio" />

                  {/* Logo + Banner side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground/80">Logo da Loja</label>
                      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors relative overflow-hidden mt-1.5">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            {uploadingLogo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                            <span className="text-[10px] mt-1 font-medium">{uploadingLogo ? "Enviando..." : "Upload Logo"}</span>
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
                      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors relative overflow-hidden mt-1.5">
                        {bannerUrl ? (
                          <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            {uploadingBanner ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                            <span className="text-[10px] mt-1 font-medium">{uploadingBanner ? "Enviando..." : "Upload Capa"}</span>
                          </div>
                        )}
                        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                      </label>
                      {bannerUrl && (
                        <button onClick={() => setForm({ ...form, bannerUrl: "" })} className="text-[10px] text-danger font-bold mt-1 hover:underline w-full text-center">Remover Capa</button>
                      )}
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="text-sm font-medium text-foreground/80">Categoria Principal</label>
                    <select
                      value={form.category || ""}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
                    >
                      <option value="">Selecione uma categoria...</option>
                      <option value="Eletrônicos">Eletrônicos</option>
                      <option value="Moda">Moda</option>
                      <option value="Casa">Casa</option>
                      <option value="Beleza">Beleza</option>
                      <option value="Serviços">Serviços</option>
                      <option value="Alimentação">Alimentação</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  {/* WhatsApp */}
                  <Input
                    label="WhatsApp"
                    value={form.whatsapp || ""}
                    onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="5511999999999"
                    icon={<MessageCircle className="h-4 w-4" />}
                  />

                  {/* Localização */}
                  <div className="border-t pt-4 mt-2">
                    <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Localização da Loja
                    </label>
                    {form.fullAddress ? (
                      <div className="bg-muted p-3 rounded-xl border text-sm mt-2">
                        <p className="font-semibold text-foreground">{form.fullAddress}</p>
                        {form.latitude != null && form.longitude != null && (
                          <p className="text-muted-foreground text-xs mt-1">Lat: {form.latitude.toFixed(5)}, Lon: {form.longitude.toFixed(5)}</p>
                        )}
                        <button onClick={() => setForm({ ...form, fullAddress: "", latitude: undefined, longitude: undefined })} className="text-danger text-xs font-bold mt-2 hover:underline">
                          Alterar Endereço
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        <div className="flex gap-2">
                          <input
                            className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                            placeholder="Digite o endereço (Rua, Cidade...)"
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
                          {loadingLocation ? "Buscando..." : "Usar Localização Atual (GPS)"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cor do Tema */}
                  <div className="border-t pt-4 mt-2">
                    <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5" /> Cor do Tema
                    </label>
                    <div className="flex gap-3 mt-2">
                      <input
                        type="color"
                        className="w-10 h-10 border border-border rounded-lg cursor-pointer"
                        value={themeColor}
                        onChange={e => setForm({ ...form, themeColor: e.target.value })}
                      />
                      <div className="flex-1 flex items-center text-sm text-muted-foreground">Cor principal da sua loja</div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ──── HORÁRIOS TAB ──── */}
          {activeTab === "horarios" && (
            <motion.div key="horarios" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="h-5 w-5 text-accent" />
                  <h2 className="text-base font-semibold text-foreground">Horários de Funcionamento</h2>
                </div>

                {/* Toggle open/closed */}
                <div className="border-b pb-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-foreground block">Loja Aberta Agora?</span>
                      <span className="text-xs text-muted-foreground">Controle manual de abertura/fechamento</span>
                    </div>
                    <button
                      onClick={() => setForm({ ...form, isOpen: !form.isOpen })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isOpen ? "bg-success" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.isOpen ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <span className={`text-sm font-medium mt-1 inline-block ${form.isOpen ? "text-success" : "text-muted-foreground"}`}>
                    {form.isOpen ? "Aberta" : "Fechada"}
                  </span>
                </div>

                {/* Weekly schedule */}
                <div className="space-y-3">
                  {Object.entries(dayLabels).map(([dayKey, dayLabel]) => {
                    const dayConfig = (form.openingHours as any)?.[dayKey] || defaultOpeningHours[dayKey] || { open: "08:00", close: "18:00", closed: false };
                    return (
                      <div key={dayKey} className="flex items-center justify-between gap-3 text-sm">
                        <div className="w-28">
                          <label className="flex items-center gap-2 cursor-pointer">
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
                            <span className={dayConfig.closed ? "text-muted-foreground line-through" : "text-foreground font-medium"}>{dayLabel}</span>
                          </label>
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
                            <span className="text-muted-foreground">às</span>
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
            <motion.div key="pagamento" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <CreditCard className="h-5 w-5 text-accent" />
                  <h2 className="text-base font-semibold text-foreground">Pagamento e Recebimento</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Chave PIX (Para Recebimentos)"
                      value={form.pixKey || ""}
                      onChange={e => setForm({ ...form, pixKey: e.target.value })}
                      placeholder="CPF, CNPJ, E-mail, Telefone ou Aleatória"
                      icon={<Key className="h-4 w-4" />}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Obrigatório para habilitar o pagamento nativo via PIX.</p>
                  </div>

                  <div className="border-t pt-4">
                    <Input
                      label="CPF/CNPJ da Loja"
                      value={form.document || ""}
                      onChange={e => setForm({ ...form, document: e.target.value })}
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Obrigatório para processar pagamentos nativos.</p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-foreground block">Pagamento Nativo (PIX/Cartão)</span>
                        <span className="text-xs text-muted-foreground">Permitir que clientes paguem direto na loja</span>
                      </div>
                      <button
                        onClick={() => {
                          if (!form.enableNativePayment && !form.pixKey) {
                            setLocalError("Configure sua Chave PIX antes de habilitar o pagamento nativo.");
                            return;
                          }
                          setForm({ ...form, enableNativePayment: !form.enableNativePayment });
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enableNativePayment ? "bg-success" : "bg-muted"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.enableNativePayment ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ──── CONSTRUTOR TAB ──── */}
          {activeTab === "construtor" && (
            <motion.div key="construtor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              <Card>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-accent" />
                    <h2 className="text-base font-semibold text-foreground">Elementos da Loja</h2>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => addSection("hero")} className="h-8 px-3 bg-muted hover:bg-border rounded-lg text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors">
                      <Camera className="h-3.5 w-3.5" /> Banner
                    </button>
                    <button onClick={() => addSection("products")} className="h-8 px-3 bg-muted hover:bg-border rounded-lg text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors">
                      <Store className="h-3.5 w-3.5" /> Produtos
                    </button>
                    <button onClick={() => addSection("text")} className="h-8 px-3 bg-muted hover:bg-border rounded-lg text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors">
                      <Eye className="h-3.5 w-3.5" /> Texto
                    </button>
                  </div>
                </div>

                {/* Active section editor */}
                {activeSectionId && (() => {
                  const section = sections.find(s => s.id === activeSectionId);
                  if (!section) return null;
                  return (
                    <div className="bg-accent-light border border-accent/20 rounded-xl p-4 mb-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold uppercase text-accent">Editando Seção</span>
                        <button onClick={() => setActiveSectionId(null)} className="text-accent/60 hover:text-accent">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {section.type === "products" && (
                          <div>
                            <label className="text-xs font-medium text-foreground/80">Filtrar por Categoria</label>
                            <input
                              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
                              value={section.filterCategory || ""}
                              onChange={e => updateSection(section.id, { filterCategory: e.target.value })}
                              placeholder="Todas as categorias"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para mostrar tudo.</p>
                          </div>
                        )}
                        {(section.type === "hero" || section.type === "text") && (
                          <div>
                            <label className="text-xs font-medium text-foreground/80">Texto do Título</label>
                            <input
                              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
                              value={section.title || ""}
                              onChange={e => updateSection(section.id, { title: e.target.value })}
                            />
                          </div>
                        )}
                        {(section.type === "hero" || section.type === "text") && (
                          <div>
                            <label className="text-xs font-medium text-foreground/80">Subtítulo / Conteúdo</label>
                            <textarea
                              className="mt-1 flex w-full rounded-lg border border-border bg-background px-3 py-2 text-xs resize-none min-h-[60px]"
                              value={section.content || ""}
                              onChange={e => updateSection(section.id, { content: e.target.value })}
                            />
                          </div>
                        )}
                        {(section.type === "hero") && (
                          <div>
                            <label className="text-xs font-medium text-foreground/80">Imagem de Fundo (URL)</label>
                            <input
                              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
                              value={section.imageUrl || ""}
                              onChange={e => updateSection(section.id, { imageUrl: e.target.value })}
                              placeholder="https://..."
                            />
                          </div>
                        )}
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="text-xs font-medium text-foreground/80">Fundo</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                className="w-8 h-8 border-none bg-transparent cursor-pointer"
                                value={section.backgroundColor || "#ffffff"}
                                onChange={e => updateSection(section.id, { backgroundColor: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs font-medium text-foreground/80">Texto</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                className="w-8 h-8 border-none bg-transparent cursor-pointer"
                                value={section.textColor || "#000000"}
                                onChange={e => updateSection(section.id, { textColor: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeSection(section.id)}
                          className="w-full h-9 bg-danger-light border border-danger/20 text-danger text-xs font-bold rounded-lg hover:bg-danger-light/80 flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover Seção
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Section list with drag & drop */}
                {sections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Adicione seções usando os botões acima.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sections.map((section, index) => (
                      <div
                        key={section.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, index)}
                        onClick={() => setActiveSectionId(section.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-move transition-all ${
                          activeSectionId === section.id
                            ? "border-accent/30 bg-accent-light"
                            : "border-border bg-background hover:bg-muted/50"
                        } ${draggedItem === index ? "opacity-50" : "opacity-100"}`}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {section.type === "hero" && <Camera className="h-4 w-4 text-accent shrink-0" />}
                          {section.type === "products" && <Store className="h-4 w-4 text-success shrink-0" />}
                          {section.type === "text" && <Eye className="h-4 w-4 text-warning shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{section.title || "Sem título"}</p>
                            <p className="text-xs text-muted-foreground capitalize">{section.type === "hero" ? "Banner" : section.type === "products" ? "Produtos" : "Texto"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: section.backgroundColor || "#ffffff" }} />
                          <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: section.textColor || "#000000" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-4">
                  <span className="font-semibold">Dica:</span> Arraste os elementos para reordenar. Clique neles para editar.
                </p>
              </Card>

              {/* Store Preview */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-5 w-5 text-accent" />
                  <h2 className="text-base font-semibold text-foreground">Preview da Loja</h2>
                </div>
                <div className="rounded-xl border-[6px] border-foreground/80 overflow-hidden max-w-[360px] mx-auto">
                  {/* Phone top bar */}
                  <div className="bg-foreground/80 flex justify-center">
                    <div className="w-20 h-4 bg-foreground rounded-b-lg" />
                  </div>
                  {/* Store preview content */}
                  <div className="bg-background overflow-y-auto max-h-[400px]">
                    {/* Banner */}
                    <div className="h-20 w-full bg-cover bg-center" style={{
                      backgroundImage: bannerUrl ? `url(${bannerUrl})` : `linear-gradient(to right, ${themeColor}, ${themeColor}dd)`,
                    }} />
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
                        {form.category && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-muted text-muted-foreground text-[9px] font-bold rounded uppercase tracking-wider">
                            {form.category}
                          </span>
                        )}
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
                            <h2 className="text-lg font-bold leading-tight">{section.title || "Banner"}</h2>
                            <p className="text-xs opacity-80 mt-1">{section.content || ""}</p>
                          </div>
                        )}
                        {section.type === "products" && (
                          <div className="py-4 px-4" style={{ backgroundColor: section.backgroundColor || "#ffffff" }}>
                            {section.title && <h3 className="text-sm font-bold text-center mb-2" style={{ color: section.textColor || "#0a0a0a" }}>{section.title}</h3>}
                            <div className="grid grid-cols-2 gap-2">
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-muted rounded-lg h-16 flex items-center justify-center">
                                  <Store className="h-4 w-4 text-muted-foreground/40" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {section.type === "text" && (
                          <div className="py-6 px-4 text-center" style={{ backgroundColor: section.backgroundColor || "#ffffff", color: section.textColor || "#0a0a0a" }}>
                            {section.title && <h3 className="text-sm font-bold mb-1">{section.title}</h3>}
                            <p className="text-xs opacity-80 leading-relaxed">{section.content || ""}</p>
                          </div>
                        )}
                      </div>
                    ))}
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
        </AnimatePresence>
      )}
    </motion.div>
  );
}
