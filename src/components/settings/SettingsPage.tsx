import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Package,
  Monitor,
  Info,
  Settings,
  Sparkles,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, Button, Skeleton } from "@/components/ui";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";

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
  const update = useAutoUpdate();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-6 space-y-6 max-w-5xl"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light shrink-0">
          <Settings className="h-7 w-7 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Sistema, versão e atualizações do aplicativo</p>
        </div>
      </motion.div>

      {/* ── Info Banner ── */}
      <motion.div variants={itemVariants}>
        <div className="flex items-start gap-3 rounded-xl bg-accent-light border border-accent/20 px-4 py-3">
          <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80">
            As configurações da sua loja (identidade, horários, pagamento, construtor) agora ficam na aba
            <span className="font-semibold text-foreground"> "Minha Loja"</span> no menu lateral.
          </p>
        </div>
      </motion.div>

      {/* ── Content ── */}
      <motion.div variants={itemVariants} className="space-y-4">

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
    </motion.div>
  );
}
