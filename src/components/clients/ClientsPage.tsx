import { useState } from "react";
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
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useClients } from "@/hooks/useFirebaseData";
import { type Client } from "@/services/firebase";
import { formatDate, cn } from "@/lib/utils";

const emptyClient: Omit<Client, "createdAt" | "updatedAt"> = {
  nome: "",
  email: "",
  telefone: "",
  endereco: "",
  cpfCnpj: "",
  observacoes: "",
};

export function ClientsPage() {
  const { items: clients, loading, addItem, editItem, deleteItem } = useClients();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);

  const filtered = clients.filter((c) =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search)
  );

  const selectedClient = clients.find((c) => c.id === selectedId);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyClient);
    setModalOpen(true);
  };

  const openEdit = (client: Client & { id: string }) => {
    setEditingId(client.id);
    setForm({
      nome: client.nome,
      email: client.email,
      telefone: client.telefone,
      endereco: client.endereco || "",
      cpfCnpj: client.cpfCnpj || "",
      observacoes: client.observacoes || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await editItem(editingId, form as unknown as Partial<Record<string, unknown>>);
      } else {
        await addItem(form as Record<string, unknown>);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar cliente:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      await deleteItem(id);
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full"
    >
      {/* Left Panel - Client List */}
      <div className="w-80 border-r border-border flex flex-col">
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
              {filtered.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedId(client.id)}
                  className={cn(
                    "w-full text-left rounded-xl p-3 transition-colors",
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
                      {client.nome?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {client.nome}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {client.email || client.telefone}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Client Detail */}
      <div className="flex-1 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedClient ? (
            <motion.div
              key={selectedClient.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white text-xl font-semibold">
                    {selectedClient.nome?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {selectedClient.nome}
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
                        {selectedClient.email || "Não informado"}
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
                        {selectedClient.telefone || "Não informado"}
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
                        {selectedClient.endereco || "Não informado"}
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
                        {selectedClient.cpfCnpj || "Não informado"}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Notes */}
              {selectedClient.observacoes && (
                <Card>
                  <h3 className="text-sm font-medium text-foreground mb-2">Observações</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedClient.observacoes}
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
    </motion.div>
  );
}
