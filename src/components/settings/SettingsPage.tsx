import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Store, Save, Phone, Mail, Clock, Camera, Globe2, MessageCircle, AlertCircle, X, CheckCircle2, MapPin, CreditCard, Key, Upload } from "lucide-react";
import { Card, Button, Input, Skeleton } from "@/components/ui";
import { useStoreConfig } from "@/hooks/useStoreConfig";
import { type StoreConfig } from "@/services/firebase";

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

// Convert File to base64 data URI (matching CRM storage format)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const emptyConfig: StoreConfig = {
  storeName: "",
  description: "",
  whatsapp: "",
  logoUrl: "",
  fullAddress: "",
  document: "",
  pixKey: "",
  enableNativePayment: false,
  isOpen: true,
};

export function SettingsPage() {
  const { config, loading, error, saveConfig, clearError } = useStoreConfig();
  const [form, setForm] = useState<StoreConfig>(emptyConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Merge config into form whenever it changes
  useEffect(() => {
    if (config) {
      console.log("[SettingsPage] Merging config into form:", config);
      setForm({
        storeName: safeStr(config.storeName || config.nomeLoja || config.name),
        description: safeStr(config.description || config.slogan),
        whatsapp: safeStr(config.whatsapp || config.telefone || config.phone),
        logoUrl: safeStr(config.logoUrl || config.logo),
        fullAddress: safeStr(config.fullAddress || config.endereco || config.address),
        document: safeStr(config.document || config.cnpj),
        pixKey: safeStr(config.pixKey),
        enableNativePayment: config.enableNativePayment ?? false,
        isOpen: config.isOpen ?? true,
        // Preserve other fields
        bannerUrl: safeStr(config.bannerUrl),
        category: config.category || "",
        themeColor: config.themeColor || "",
        email: safeStr(config.email),
      });
    }
  }, [config]);

  const handleSave = async () => {
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setLocalError("Por favor, selecione uma imagem válida.");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setLocalError("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploadingLogo(true);
    try {
      const base64 = await fileToBase64(file);
      setForm({ ...form, logoUrl: base64 });
    } catch (err) {
      setLocalError("Erro ao carregar a imagem.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLocalError("Por favor, selecione uma imagem válida.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLocalError("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploadingBanner(true);
    try {
      const base64 = await fileToBase64(file);
      setForm({ ...form, bannerUrl: base64 });
    } catch (err) {
      setLocalError("Erro ao carregar a imagem.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const removeLogo = () => {
    setForm({ ...form, logoUrl: "" });
  };

  const removeBanner = () => {
    setForm({ ...form, bannerUrl: "" });
  };

  // Derive display values (prefer CRM field names, fallback to old)
  const storeName = form.storeName || config?.nomeLoja || config?.name || "";
  const description = form.description || config?.slogan || "";
  const whatsapp = form.whatsapp || config?.telefone || config?.phone || "";
  const logoUrl = form.logoUrl || config?.logo || "";
  const bannerUrl = form.bannerUrl || "";
  const fullAddress = form.fullAddress || safeStr(config?.endereco || config?.address);
  const document_ = form.document || config?.cnpj || "";
  const pixKey = form.pixKey || "";
  const email = form.email || config?.email || "";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-8 space-y-8 max-w-3xl"
    >
      {/* Header with logo */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Store Logo in header */}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted overflow-hidden shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <Store className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {storeName || "Minha Loja"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Informações e configurações da sua loja
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-sm text-success"
            >
              <CheckCircle2 className="h-4 w-4" />
              Salvo!
            </motion.span>
          )}
          <Button
            icon={<Save className="h-4 w-4" />}
            onClick={handleSave}
            loading={saving}
          >
            Salvar
          </Button>
        </div>
      </motion.div>

      {/* Error Banner */}
      {(localError || error) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-danger flex-1">{localError || error}</p>
          <button
            onClick={() => { setLocalError(null); clearError(); }}
            className="text-danger/60 hover:text-danger transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Basic Info */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <Store className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">
                  Informações Básicas
                </h2>
              </div>
              <div className="space-y-4">
                <Input
                  label="Nome da Loja"
                  value={storeName}
                  onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                  placeholder="Minha Loja"
                />
                <Input
                  label="Descrição / Slogan"
                  value={description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Uma frase que representa seu negócio"
                />

                {/* Logo Upload */}
                <div>
                  <label className="text-sm font-medium text-foreground/80">Logo da Loja</label>
                  <div className="mt-2 flex items-center gap-4">
                    {/* Logo preview */}
                    <div className="relative group">
                      <div className="h-20 w-20 rounded-2xl bg-muted border-2 border-dashed border-border overflow-hidden flex items-center justify-center">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="h-8 w-8 text-muted-foreground/40" />
                        )}
                      </div>
                      {logoUrl && (
                        <button
                          onClick={removeLogo}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm hover:bg-danger/80 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {/* Upload button */}
                    <div className="flex-1">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        variant="secondary"
                        icon={<Upload className="h-4 w-4" />}
                        onClick={() => logoInputRef.current?.click()}
                        loading={uploadingLogo}
                      >
                        {logoUrl ? "Trocar Logo" : "Enviar Logo"}
                      </Button>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        PNG, JPG ou WEBP. Máximo 2MB.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Banner Upload */}
                <div>
                  <label className="text-sm font-medium text-foreground/80">Banner da Loja</label>
                  <div className="mt-2 space-y-3">
                    {/* Banner preview */}
                    <div className="relative group">
                      <div className="h-28 w-full rounded-2xl bg-muted border-2 border-dashed border-border overflow-hidden flex items-center justify-center">
                        {bannerUrl ? (
                          <img
                            src={bannerUrl}
                            alt="Banner"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Camera className="h-8 w-8 text-muted-foreground/40" />
                            <span className="text-xs text-muted-foreground/60">Banner</span>
                          </div>
                        )}
                      </div>
                      {bannerUrl && (
                        <button
                          onClick={removeBanner}
                          className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger/90 text-white shadow-sm hover:bg-danger transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Upload button */}
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      icon={<Upload className="h-4 w-4" />}
                      onClick={() => bannerInputRef.current?.click()}
                      loading={uploadingBanner}
                    >
                      {bannerUrl ? "Trocar Banner" : "Enviar Banner"}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground/80">Categoria</label>
                  <select
                    value={form.category || ""}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
                  >
                    <option value="">Selecione...</option>
                    <option value="Eletrônicos">Eletrônicos</option>
                    <option value="Moda">Moda</option>
                    <option value="Casa">Casa</option>
                    <option value="Beleza">Beleza</option>
                    <option value="Serviços">Serviços</option>
                    <option value="Alimentação">Alimentação</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Contact */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <Phone className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Contato</h2>
              </div>
              <div className="space-y-4">
                <Input
                  label="WhatsApp"
                  value={whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="5500000000000"
                  icon={<MessageCircle className="h-4 w-4" />}
                />
                <Input
                  label="Email"
                  value={email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@minhaloja.com"
                  icon={<Mail className="h-4 w-4" />}
                />
              </div>
            </Card>
          </motion.div>

          {/* Location */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">
                  Localização
                </h2>
              </div>
              <div className="space-y-4">
                <Input
                  label="Endereço Completo"
                  value={fullAddress}
                  onChange={(e) => setForm({ ...form, fullAddress: e.target.value })}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
              </div>
            </Card>
          </motion.div>

          {/* Payment */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <CreditCard className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">
                  Pagamento
                </h2>
              </div>
              <div className="space-y-4">
                <Input
                  label="CPF/CNPJ"
                  value={document_}
                  onChange={(e) => setForm({ ...form, document: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
                <Input
                  label="Chave PIX"
                  value={pixKey}
                  onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
                  placeholder="CPF, CNPJ, email ou telefone"
                  icon={<Key className="h-4 w-4" />}
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground/80">Aceitar pagamento nativo (PIX/Cartão)</label>
                  <button
                    onClick={() => setForm({ ...form, enableNativePayment: !form.enableNativePayment })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enableNativePayment ? "bg-accent" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.enableNativePayment ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Store Status */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <Clock className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">
                  Status da Loja
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground/80">Loja aberta para pedidos?</label>
                <button
                  onClick={() => setForm({ ...form, isOpen: !form.isOpen })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isOpen ? "bg-success" : "bg-muted"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.isOpen ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className={`text-sm font-medium ${form.isOpen ? "text-success" : "text-muted-foreground"}`}>
                  {form.isOpen ? "Aberta" : "Fechada"}
                </span>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
