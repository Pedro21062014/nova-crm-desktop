import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Store, Save, Phone, Mail, Clock, Camera, Globe2, MessageCircle, AlertCircle, X, CheckCircle2, MapPin, CreditCard, Key } from "lucide-react";
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

  // Derive display values (prefer CRM field names, fallback to old)
  const storeName = form.storeName || config?.nomeLoja || config?.name || "";
  const description = form.description || config?.slogan || "";
  const whatsapp = form.whatsapp || config?.telefone || config?.phone || "";
  const logoUrl = form.logoUrl || config?.logo || "";
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
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Minha Loja
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informações e configurações da sua loja
          </p>
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
                <Input
                  label="URL do Logo"
                  value={logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  placeholder="https://... ou base64"
                />
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
