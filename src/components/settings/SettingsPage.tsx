import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Store, Save, Globe, Phone, Mail, Clock, Camera, Globe2, MessageCircle } from "lucide-react";
import { Card, Button, Input, Skeleton } from "@/components/ui";
import { useStoreConfig } from "@/hooks/useFirebaseData";
import { updateItem, create, PATHS, type StoreConfig } from "@/services/firebase";

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
  const { items: configItems, loading } = useStoreConfig();
  const [form, setForm] = useState<StoreConfig>(emptyConfig);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (configItems.length > 0) {
      const config = configItems[0];
      setConfigId(config.id);
      setForm({
        nomeLoja: config.nomeLoja || "",
        slogan: config.slogan || "",
        logo: config.logo || "",
        telefone: config.telefone || "",
        email: config.email || "",
        endereco: config.endereco || "",
        cnpj: config.cnpj || "",
        horarioFuncionamento: config.horarioFuncionamento || "",
        redesSociais: config.redesSociais || emptyConfig.redesSociais,
      });
    }
  }, [configItems]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (configId) {
        await updateItem(PATHS.STORE_CONFIG, configId, form as unknown as Partial<StoreConfig>);
      } else {
        const id = await create(
          PATHS.STORE_CONFIG,
          form as unknown as Record<string, unknown>
        );
        setConfigId(id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
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
        <Button
          icon={<Save className="h-4 w-4" />}
          onClick={handleSave}
          loading={saving}
        >
          {saved ? "Salvo!" : "Salvar"}
        </Button>
      </motion.div>

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
