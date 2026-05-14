import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Store, Save, Globe, Phone, Mail, Clock, Camera, Globe2, MessageCircle, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { Card, Button, Input, Skeleton } from "@/components/ui";
import { useStoreConfig } from "@/hooks/useStoreConfig";
import { type StoreConfig } from "@/services/firebase";

// Helper: safely convert any value to a string for form inputs.
// Handles address objects like {street, number, neighborhood, city, zip, coordinates}
function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    // For address objects
    const parts = [val.street, val.number, val.neighborhood, val.city, val.zip, val.state, val.complement]
      .filter((p: any) => p && typeof p !== "object");
    if (parts.length > 0) return parts.join(", ");
    // Fallback: join all non-object string/number values
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
  nomeLoja: "",
  slogan: "",
  logo: "",
  telefone: "",
  email: "",
  endereco: "",
  cnpj: "",
  horarioFuncionamento: "",
  redesSociais: {
    instagram: "",
    facebook: "",
    whatsapp: "",
  },
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
        nomeLoja: safeStr(config.nomeLoja || config.name || form.nomeLoja),
        slogan: safeStr(config.slogan || form.slogan),
        logo: safeStr(config.logo || form.logo),
        telefone: safeStr(config.telefone || config.phone || form.telefone),
        email: safeStr(config.email || form.email),
        endereco: safeStr(config.endereco || config.address || form.endereco),
        cnpj: safeStr(config.cnpj || form.cnpj),
        horarioFuncionamento: safeStr(config.horarioFuncionamento || form.horarioFuncionamento),
        redesSociais: {
          instagram: safeStr(config.redesSociais?.instagram || form.redesSociais?.instagram),
          facebook: safeStr(config.redesSociais?.facebook || form.redesSociais?.facebook),
          whatsapp: safeStr(config.redesSociais?.whatsapp || form.redesSociais?.whatsapp),
        },
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
            Configurações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informações da sua loja
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
                  value={form.nomeLoja}
                  onChange={(e) => setForm({ ...form, nomeLoja: e.target.value })}
                  placeholder="Minha Loja"
                />
                <Input
                  label="Slogan"
                  value={form.slogan}
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                  placeholder="Uma frase que representa seu negócio"
                />
                <Input
                  label="URL do Logo"
                  value={form.logo}
                  onChange={(e) => setForm({ ...form, logo: e.target.value })}
                  placeholder="https://..."
                />
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
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Telefone"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  icon={<Phone className="h-4 w-4" />}
                />
                <Input
                  label="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@minhaloja.com"
                  icon={<Mail className="h-4 w-4" />}
                />
              </div>
              <div className="mt-4">
                <Input
                  label="CNPJ"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </Card>
          </motion.div>

          {/* Location & Hours */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <Globe className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">
                  Localização e Horário
                </h2>
              </div>
              <div className="space-y-4">
                <Input
                  label="Endereço"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
                <Input
                  label="Horário de Funcionamento"
                  value={form.horarioFuncionamento}
                  onChange={(e) =>
                    setForm({ ...form, horarioFuncionamento: e.target.value })
                  }
                  placeholder="Seg-Sex: 9h-18h / Sáb: 9h-13h"
                  icon={<Clock className="h-4 w-4" />}
                />
              </div>
            </Card>
          </motion.div>

          {/* Social Media */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <Camera className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">
                  Redes Sociais
                </h2>
              </div>
              <div className="space-y-4">
                <Input
                  label="Instagram"
                  value={form.redesSociais?.instagram || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      redesSociais: {
                        ...form.redesSociais,
                        instagram: e.target.value,
                      },
                    })
                  }
                  placeholder="@minhaloja"
                  icon={<Camera className="h-4 w-4" />}
                />
                <Input
                  label="Facebook"
                  value={form.redesSociais?.facebook || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      redesSociais: {
                        ...form.redesSociais,
                        facebook: e.target.value,
                      },
                    })
                  }
                  placeholder="facebook.com/minhaloja"
                  icon={<Globe2 className="h-4 w-4" />}
                />
                <Input
                  label="WhatsApp"
                  value={form.redesSociais?.whatsapp || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      redesSociais: {
                        ...form.redesSociais,
                        whatsapp: e.target.value,
                      },
                    })
                  }
                  placeholder="5500000000000"
                  icon={<MessageCircle className="h-4 w-4" />}
                />
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
