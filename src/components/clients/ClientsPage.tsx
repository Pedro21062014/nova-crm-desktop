import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  User,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  FileText,
  AlertCircle,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useClients } from "@/hooks/useFirebaseData";
import { type Client } from "@/services/firebase";
import { formatDate, cn } from "@/lib/utils";
import {
  exportClientsToExcel,
  importClientsFromExcel,
  downloadClientTemplate,
} from "@/lib/clientsExcel";

// Helpers for field name compatibility
// Also handles cases where the value is an object (e.g. endereco = {street, city, ...})
function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    // For address objects like {street, number, neighborhood, city, zip, coordinates}
    const parts = [val.street, val.number, val.neighborhood, val.city, val.zip, val.state, val.complement]
      .filter((p: any) => p && typeof p !== "object");
    if (parts.length > 0) return parts.join(", ");
    // Fallback: join all non-object string values
    const allParts = Object.values(val)
      .filter((v: any) => v && typeof v === "string" || typeof v === "number")
      .map(String);
    if (allParts.length > 0) return allParts.join(", ");
    return JSON.stringify(val);
  }
  return String(val);
}

function cName(c: any): string { return safeStr(c.nome || c.name); }
function cEmail(c: any): string { return safeStr(c.email); }
function cPhone(c: any): string { return safeStr(c.telefone || c.phone); }
function cAddr(c: any): string { return safeStr(c.endereco || c.address); }
function cDoc(c: any): string { return safeStr(c.cpfCnpj || c.document); }
function cNotes(c: any): string { return safeStr(c.observacoes || c.notes); }

const emptyClient: Omit<Client, "createdAt" | "updatedAt"> = {
  nome: "",
  email: "",
  telefone: "",
  endereco: "",
  cpfCnpj: "",
  observacoes: "",
};

export function ClientsPage() {
  const { items: clients, loading, addItem, editItem, deleteItem, error: clientsError, clearError } = useClients();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Import/Export state ──
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedClients, setParsedClients] = useState<Omit<Client, "createdAt" | "updatedAt">[]>([]);
  const [importPreview, setImportPreview] = useState<{ count: number; errors: string[]; skipped: number } | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const filtered = useMemo(() =>
    clients.filter((c) =>
      cName(c)?.toLowerCase().includes(search.toLowerCase()) ||
      cEmail(c)?.toLowerCase().includes(search.toLowerCase()) ||
      cPhone(c)?.includes(search)
    ),
    [clients, search]
  );

  // Memoize selectedClient to prevent unnecessary re-renders/freezes
  const selectedClient = useMemo(() =>
    clients.find((c) => c.id === selectedId) || null,
    [clients, selectedId]
  );

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyClient);
    setActionError(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((client: Client & { id: string }) => {
    setEditingId(client.id);
    setForm({
      nome: cName(client),
      email: cEmail(client),
      telefone: cPhone(client),
      endereco: cAddr(client),
      cpfCnpj: cDoc(client),
      observacoes: cNotes(client),
    });
    setActionError(null);
    setModalOpen(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    try {
      if (editingId) {
        await editItem(editingId, form as unknown as Partial<Record<string, unknown>>);
      } else {
        await addItem(form as Record<string, unknown>);
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar cliente:", err);
      setActionError(err.message || "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      setActionError(null);
      try {
        await deleteItem(id);
        if (selectedId === id) setSelectedId(null);
      } catch (err: any) {
        console.error("Erro ao excluir cliente:", err);
        setActionError(err.message || "Erro ao excluir cliente.");
      }
    }
  };

  const handleSelectClient = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ── Import / Export handlers ──
  const handleExport = useCallback(() => {
    if (clients.length === 0) {
      setActionError("Nenhum cliente para exportar.");
      return;
    }
    try {
      exportClientsToExcel(clients as unknown as Array<Client & { id?: string }>);
    } catch (err: any) {
      setActionError(err.message || "Erro ao exportar planilha.");
    }
  }, [clients]);

  const handleTemplate = useCallback(() => {
    try { downloadClientTemplate(); } catch (err: any) {
      setActionError(err.message || "Erro ao baixar modelo.");
    }
  }, []);

  const openImportModal = useCallback(() => {
    setImportOpen(true);
    setImportPreview(null);
    setParsedClients([]);
    setImportSuccess(null);
    setActionError(null);
    selectedFileRef.current = null;
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedFileRef.current = file;
    setImporting(true);
    setActionError(null);
    setImportPreview(null);
    setParsedClients([]);
    try {
      const result = await importClientsFromExcel(file);
      setParsedClients(result.clients);
      setImportPreview({ count: result.imported, errors: result.errors, skipped: result.skipped });
      if (result.imported === 0) {
        setActionError("Nenhum cliente válido encontrado no arquivo.");
      }
    } catch (err: any) {
      setActionError(err.message || "Erro ao ler planilha. Verifique o formato.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (parsedClients.length === 0) return;
    setImporting(true);
    setActionError(null);
    try {
      let ok = 0;
      let fail = 0;
      for (const c of parsedClients) {
        try {
          await addItem(c as Record<string, unknown>);
          ok++;
        } catch {
          fail++;
        }
      }
      setImportSuccess(`${ok} cliente(s) importado(s)${fail ? `, ${fail} falharam` : ""}.`);
      setParsedClients([]);
      setImportPreview(null);
      selectedFileRef.current = null;
      setTimeout(() => setImportOpen(false), 1500);
    } catch (err: any) {
      setActionError(err.message || "Erro ao importar clientes.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full"
    >
      {/* Left Panel - Client List */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground">Clientes</h1>
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
              Novo
            </Button>
          </div>
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
          {/* Import / Export actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExport}
              disabled={loading || clients.length === 0}
              title="Exportar clientes para planilha Excel (.xlsx)"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
            <button
              onClick={openImportModal}
              title="Importar clientes de planilha Excel (.xlsx)"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-border transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar
            </button>
            <button
              onClick={handleTemplate}
              title="Baixar planilha modelo"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-border transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum cliente encontrado
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((client) => {
                const name = cName(client);
                const email = cEmail(client);
                const phone = cPhone(client);
                return (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client.id)}
                    className={cn(
                      "w-full text-left rounded-xl p-3 transition-all duration-200",
                      selectedId === client.id
                        ? "bg-accent-light border border-accent/20"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                          selectedId === client.id
                            ? "bg-accent text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {email || phone}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Client Detail */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Error Banner */}
        {(actionError || clientsError) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3 mb-6"
          >
            <AlertCircle className="h-4 w-4 text-danger shrink-0" />
            <p className="text-sm text-danger flex-1">{actionError || clientsError}</p>
            <button
              onClick={() => { setActionError(null); clearError(); }}
              className="text-danger/60 hover:text-danger transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {selectedClient ? (
            <motion.div
              key={selectedClient.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white text-xl font-semibold">
                    {cName(selectedClient)?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {cName(selectedClient)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Cliente desde{" "}
                      {selectedClient.createdAt
                        ? formatDate(selectedClient.createdAt)
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit2 className="h-3.5 w-3.5" />}
                    onClick={() => openEdit(selectedClient as Client & { id: string })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => handleDelete(selectedClient.id)}
                  />
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-light">
                      <Mail className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground">
                        {cEmail(selectedClient) || "Não informado"}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-light">
                      <Phone className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium text-foreground">
                        {cPhone(selectedClient) || "Não informado"}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-light">
                      <MapPin className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="text-sm font-medium text-foreground">
                        {cAddr(selectedClient) || "Não informado"}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <FileText className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                      <p className="text-sm font-medium text-foreground">
                        {cDoc(selectedClient) || "Não informado"}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Notes */}
              {cNotes(selectedClient) && (
                <Card>
                  <h3 className="text-sm font-medium text-foreground mb-2">Observações</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cNotes(selectedClient)}
                  </p>
                </Card>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <User className="h-14 w-14 text-muted-foreground/20" />
              <p className="mt-4 text-sm text-muted-foreground">
                Selecione um cliente para ver os detalhes
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar Cliente" : "Novo Cliente"}
        size="lg"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome completo"
            />
            <Input
              label="CPF/CNPJ"
              value={form.cpfCnpj}
              onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <Input
            label="Endereço"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            placeholder="Rua, número, bairro, cidade - UF"
          />
          <div>
            <label className="text-sm font-medium text-foreground/80">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Observações sobre o cliente (opcional)"
              rows={3}
              className="mt-1.5 flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? "Salvar Alterações" : "Criar Cliente"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Clientes"
        size="md"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}

          {importSuccess ? (
            <div className="flex items-center gap-2 rounded-xl bg-success-light px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {importSuccess}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="mt-3 text-sm text-foreground font-medium">
                  Selecione uma planilha Excel (.xlsx, .xls) ou CSV
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Colunas esperadas: Nome, Email, Telefone, Endereço, CPF/CNPJ, Observações
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    icon={<Upload className="h-3.5 w-3.5" />}
                    onClick={() => fileInputRef.current?.click()}
                    loading={importing}
                  >
                    Selecionar arquivo
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                    onClick={handleTemplate}
                  >
                    Baixar modelo
                  </Button>
                </div>
              </div>

              {importPreview && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-xl bg-accent-light px-4 py-3">
                    <FileSpreadsheet className="h-5 w-5 text-accent shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {importPreview.count} cliente(s) pronto(s) para importar
                      </p>
                      {importPreview.skipped > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {importPreview.skipped} linha(s) ignorada(s) por dados insuficientes
                        </p>
                      )}
                    </div>
                  </div>
                  {importPreview.errors.length > 0 && (
                    <div className="rounded-xl bg-muted p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Avisos:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {importPreview.errors.slice(0, 10).map((e, i) => (
                          <li key={i}>• {e}</li>
                        ))}
                        {importPreview.errors.length > 10 && (
                          <li>• ... e mais {importPreview.errors.length - 10} aviso(s)</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!importSuccess && (
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setImportOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                loading={importing}
                disabled={!importPreview || importPreview.count === 0}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                Importar {importPreview?.count || 0} cliente(s)
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </motion.div>
  );
}
