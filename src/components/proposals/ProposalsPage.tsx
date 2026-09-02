import { useState, useMemo, useCallback, memo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  FileText,
  Download,
  Share2,
  ShoppingBag,
  Edit2,
  Trash2,
  AlertCircle,
  X,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import {
  useProposals,
  useClients,
  useProducts,
  useOrders,
} from "@/hooks/useFirebaseData";
import {
  type CommercialProposal,
  type ProposalItem,
  type ProposalStatus,
} from "@/services/firebase";
import { formatCurrency } from "@/lib/utils";
import {
  sanitizeFirestoreData,
  getClientName,
  getClientPhone,
  getClientEmail,
  getClientAddress,
  getProductName,
  getProductPrice,
  getProductDescription,
  addDaysToYmd,
  todayLocalStr,
  openExternalLink,
} from "@/lib/crmData";
import { useStoreConfig } from "@/hooks/useStoreConfig";
import { useToast } from "@/hooks/useToast";

type ProposalRec = CommercialProposal & {
  id: string;
  createdAt: number;
  updatedAt: number;
};

const STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  viewed: "Visualizada",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

const STATUS_VARIANT: Record<
  ProposalStatus,
  "default" | "info" | "success" | "danger" | "warning"
> = {
  draft: "default",
  sent: "info",
  viewed: "warning",
  approved: "success",
  rejected: "danger",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Grade memozizada: abrir o modal ou digitar no formulário não re-renderiza
// os cards de proposta — apenas mudanças de dados no Firestore.
// ─────────────────────────────────────────────────────────────────────────────
interface ProposalsGridProps {
  propsList: ProposalRec[];
  onGeneratePDF: (prop: ProposalRec) => void;
  onShareWhatsApp: (prop: ProposalRec) => void;
  onConvertToOrder: (prop: ProposalRec) => void;
  onEdit: (prop: ProposalRec) => void;
  onDelete: (prop: ProposalRec) => void;
}

const ProposalsGrid = memo(function ProposalsGrid({
  propsList,
  onGeneratePDF,
  onShareWhatsApp,
  onConvertToOrder,
  onEdit,
  onDelete,
}: ProposalsGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      {propsList.map((prop) => (
        <motion.div key={prop.id} variants={itemVariants}>
          <Card hover className="flex h-full flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-xs font-black text-accent bg-accent-light px-2 py-0.5 rounded-md">
                  {prop.proposalNumber}
                </span>
                <Badge variant={STATUS_VARIANT[prop.status] || "default"}>
                  {STATUS_LABEL[prop.status] || prop.status}
                </Badge>
              </div>

              <h3 className="font-bold text-base text-foreground mt-3 line-clamp-1">
                {prop.title}
              </h3>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                Cliente:{" "}
                <span className="font-bold text-foreground">
                  {prop.clientName}
                </span>
              </p>

              <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{prop.items?.length || 0} item(ns) na proposta</span>
                  <span>Válida até {prop.validUntil || "A combinar"}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    Valor Total:
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {formatCurrency(prop.total || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onGeneratePDF(prop)}
                  title="Baixar PDF"
                  className="p-2 text-muted-foreground hover:text-accent hover:bg-accent-light rounded-lg transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onShareWhatsApp(prop)}
                  title="Enviar WhatsApp"
                  className="p-2 text-muted-foreground hover:text-success hover:bg-success-light rounded-lg transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                {prop.status !== "approved" && (
                  <button
                    onClick={() => onConvertToOrder(prop)}
                    title="Converter em Pedido"
                    className="p-2 text-muted-foreground hover:text-warning hover:bg-warning-light rounded-lg transition-colors"
                  >
                    <ShoppingBag className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(prop)}
                  title="Editar"
                  className="p-2 text-muted-foreground hover:text-accent rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(prop)}
                  title="Excluir"
                  className="p-2 text-muted-foreground hover:text-danger rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export function ProposalsPage() {
  const toast = useToast();
  const {
    items: proposals,
    loading,
    addItem,
    editItem,
    deleteItem,
    error: proposalsError,
    clearError,
  } = useProposals();
  const { items: clients } = useClients();
  const { items: products } = useProducts();
  const { addItem: addOrder } = useOrders();
  const { config } = useStoreConfig();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<ProposalRec | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form
  const [proposalNumber, setProposalNumber] = useState("");
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [discount, setDiscount] = useState<number | string>(0);
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(
    "À vista via Pix ou Boleto 14 dias"
  );
  const [notes, setNotes] = useState(
    "Proposta sujeita à disponibilidade de estoque. Entrega em até 3 dias úteis."
  );
  const [status, setStatus] = useState<ProposalStatus>("draft");

  // ── Ações (estáveis para o React.memo da grade) ──

  const openCreate = () => {
    setEditingProp(null);
    const generatedNumber = `PROP-${new Date().getFullYear()}-${String(
      proposals.length + 1
    ).padStart(3, "0")}`;
    setProposalNumber(generatedNumber);
    setTitle("Proposta Comercial de Fornecimento");
    setSelectedClientId("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientDocument("");
    setClientAddress("");
    setItems([]);
    setDiscount(0);
    setValidUntil(addDaysToYmd(todayLocalStr(), 15));
    setPaymentTerms("À vista via Pix ou Boleto 14 dias");
    setNotes("Proposta sujeita à disponibilidade de estoque. Faturamento direto.");
    setStatus("draft");
    setActionError(null);
    setModalOpen(true);
  };

  const openEdit = useCallback((prop: ProposalRec) => {
    setEditingProp(prop);
    setProposalNumber(prop.proposalNumber);
    setTitle(prop.title);
    setSelectedClientId(prop.clientId || "");
    setClientName(prop.clientName);
    setClientEmail(prop.clientEmail || "");
    setClientPhone(prop.clientPhone || "");
    setClientDocument(prop.clientDocument || "");
    setClientAddress(prop.clientAddress || "");
    setItems(prop.items || []);
    setDiscount(prop.discount || 0);
    setValidUntil(prop.validUntil || "");
    setPaymentTerms(prop.paymentTerms || "À vista via Pix");
    setNotes(prop.notes || "");
    setStatus(prop.status || "draft");
    setActionError(null);
    setModalOpen(true);
  }, []);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = clients.find((c) => c.id === clientId) as any;
    if (!client) return;
    setClientName(getClientName(client));
    setClientEmail(getClientEmail(client));
    setClientPhone(getClientPhone(client));
    const addr = getClientAddress(client);
    if (addr) setClientAddress(addr);
  };

  const handleAddItemFromCatalog = (prodId: string) => {
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId) as any;
    if (!prod) return;
    const price = getProductPrice(prod);
    setItems([
      ...items,
      {
        productId: prod.id,
        name: getProductName(prod),
        description: getProductDescription(prod),
        quantity: 1,
        unitPrice: price,
        total: price,
      },
    ]);
  };

  const handleAddCustomItem = () => {
    setItems([
      ...items,
      {
        name: "Item / Serviço Personalizado",
        description: "",
        quantity: 1,
        unitPrice: 100,
        total: 100,
      },
    ]);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof ProposalItem,
    val: string | number
  ) => {
    const updated = [...items];
    const target = { ...updated[index], [field]: val };
    if (field === "quantity" || field === "unitPrice") {
      target.total =
        Number(target.quantity || 1) * Number(target.unitPrice || 0);
    }
    updated[index] = target;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const numDiscount =
    typeof discount === "string" ? parseFloat(discount) || 0 : discount;
  const grandTotal = Math.max(0, subtotal - numDiscount);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Informe o título da proposta.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item na proposta.");
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const data = sanitizeFirestoreData({
        proposalNumber,
        title: title.trim(),
        clientId: selectedClientId || undefined,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientDocument: clientDocument.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        items,
        subtotal,
        discount: numDiscount,
        total: grandTotal,
        validUntil,
        paymentTerms,
        notes: notes.trim(),
        status,
      });

      if (editingProp) {
        await editItem(editingProp.id, data as Record<string, unknown>);
        toast.success("Proposta atualizada com sucesso!");
      } else {
        await addItem(data as Record<string, unknown>);
        toast.success("Proposta comercial criada com sucesso!");
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar proposta:", err);
      setActionError(err.message || "Erro ao salvar proposta.");
      toast.error("Erro ao salvar proposta.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(
    async (prop: ProposalRec) => {
      if (!confirm("Deseja realmente excluir esta proposta?")) return;
      try {
        await deleteItem(prop.id);
        toast.success("Proposta excluída.");
      } catch (err: any) {
        console.error("Erro ao excluir:", err);
        toast.error("Erro ao excluir.");
      }
    },
    [deleteItem, toast]
  );

  // ── PDF (jsPDF carregado sob demanda, só ao gerar o PDF) ──

  const handleGeneratePDF = useCallback(
    async (prop: ProposalRec) => {
      try {
        const { jsPDF } = await import("jspdf");
        const docPdf = new jsPDF({ unit: "pt", format: "a4" });
        const pageWidth = docPdf.internal.pageSize.getWidth();
        const margin = 40;
        let y = 50;

        const companyName =
          (config as any)?.storeName ||
          (config as any)?.nomeLoja ||
          "Nova CRM";

        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(20);
        docPdf.setTextColor(30, 41, 59);
        docPdf.text(companyName, margin, y);

        docPdf.setFontSize(10);
        docPdf.setFont("helvetica", "normal");
        docPdf.setTextColor(100, 116, 139);
        y += 18;
        docPdf.text("PROPOSTA COMERCIAL & ORÇAMENTO", margin, y);

        docPdf.setFont("helvetica", "bold");
        docPdf.setTextColor(79, 70, 229);
        docPdf.text(prop.proposalNumber, pageWidth - margin, 50, {
          align: "right",
        });
        docPdf.setFont("helvetica", "normal");
        docPdf.setTextColor(100, 116, 139);
        docPdf.text(`Válida até: ${prop.validUntil || "A combinar"}`, pageWidth - margin, 68, {
          align: "right",
        });

        y += 15;
        docPdf.setDrawColor(226, 232, 240);
        docPdf.setLineWidth(1);
        docPdf.line(margin, y, pageWidth - margin, y);
        y += 25;

        // Client info box
        docPdf.setFillColor(248, 250, 252);
        docPdf.roundedRect(margin, y, pageWidth - margin * 2, 85, 6, 6, "F");
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.setTextColor(15, 23, 42);
        docPdf.text("CLIENTE / DESTINATÁRIO:", margin + 15, y + 20);
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(10);
        docPdf.setTextColor(51, 65, 85);
        docPdf.text(`Nome: ${prop.clientName}`, margin + 15, y + 36);
        if (prop.clientDocument)
          docPdf.text(`CPF/CNPJ: ${prop.clientDocument}`, margin + 15, y + 50);
        if (prop.clientEmail || prop.clientPhone) {
          docPdf.text(
            `Contato: ${prop.clientEmail || ""} ${
              prop.clientPhone ? `| ${prop.clientPhone}` : ""
            }`,
            margin + 15,
            y + 64
          );
        }

        y += 110;
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(13);
        docPdf.setTextColor(15, 23, 42);
        docPdf.text(prop.title, margin, y);
        y += 20;

        // Table header
        docPdf.setFillColor(241, 245, 249);
        docPdf.rect(margin, y, pageWidth - margin * 2, 24, "F");
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(9);
        docPdf.setTextColor(71, 85, 105);
        docPdf.text("ITEM / DESCRIÇÃO", margin + 10, y + 15);
        docPdf.text("QTD", pageWidth - margin - 200, y + 15, { align: "center" });
        docPdf.text("UNITÁRIO", pageWidth - margin - 120, y + 15, { align: "right" });
        docPdf.text("TOTAL", pageWidth - margin - 10, y + 15, { align: "right" });
        y += 24;

        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9);
        docPdf.setTextColor(51, 65, 85);
        prop.items.forEach((item, index) => {
          const rowBg = index % 2 === 0 ? 255 : 250;
          docPdf.setFillColor(rowBg, rowBg, rowBg);
          docPdf.rect(margin, y, pageWidth - margin * 2, 22, "F");
          docPdf.text(item.name.substring(0, 45), margin + 10, y + 14);
          docPdf.text(String(item.quantity), pageWidth - margin - 200, y + 14, {
            align: "center",
          });
          docPdf.text(
            (item.unitPrice || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
            pageWidth - margin - 120,
            y + 14,
            { align: "right" }
          );
          docPdf.text(
            (item.total || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
            pageWidth - margin - 10,
            y + 14,
            { align: "right" }
          );
          y += 22;
        });

        // Totals box
        y += 15;
        const totalBoxX = pageWidth - margin - 220;
        docPdf.setFillColor(248, 250, 252);
        docPdf.roundedRect(totalBoxX, y, 220, 70, 6, 6, "F");
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9);
        docPdf.setTextColor(51, 65, 85);
        docPdf.text("Subtotal:", totalBoxX + 15, y + 20);
        docPdf.text(
          (prop.subtotal || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          totalBoxX + 205,
          y + 20,
          { align: "right" }
        );
        if ((prop.discount || 0) > 0) {
          docPdf.setTextColor(225, 29, 72);
          docPdf.text("Desconto Especial:", totalBoxX + 15, y + 36);
          docPdf.text(
            `- ${(prop.discount || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}`,
            totalBoxX + 205,
            y + 36,
            { align: "right" }
          );
          docPdf.setTextColor(51, 65, 85);
        }
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.setTextColor(79, 70, 229);
        docPdf.text("VALOR TOTAL:", totalBoxX + 15, y + 56);
        docPdf.text(
          (prop.total || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          totalBoxX + 205,
          y + 56,
          { align: "right" }
        );
        y += 90;

        // Payment terms & notes
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(10);
        docPdf.setTextColor(15, 23, 42);
        docPdf.text("CONDIÇÕES DE PAGAMENTO & OBSERVAÇÕES", margin, y);
        y += 16;
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9);
        docPdf.setTextColor(71, 85, 105);
        docPdf.text(`Condições: ${prop.paymentTerms}`, margin, y);
        y += 14;
        if (prop.notes) {
          const splitNotes = docPdf.splitTextToSize(
            `Observações: ${prop.notes}`,
            pageWidth - margin * 2
          );
          docPdf.text(splitNotes, margin, y);
          y += splitNotes.length * 12;
        }

        // Signatures
        y += 40;
        docPdf.setDrawColor(203, 213, 225);
        docPdf.line(margin, y, margin + 200, y);
        docPdf.line(pageWidth - margin - 200, y, pageWidth - margin, y);
        y += 14;
        docPdf.setFontSize(8);
        docPdf.text(companyName, margin + 100, y, { align: "center" });
        docPdf.text(prop.clientName, pageWidth - margin - 100, y, {
          align: "center",
        });

        docPdf.save(`${prop.proposalNumber}_${prop.clientName.replace(/\s+/g, "_")}.pdf`);
        toast.success("PDF da Proposta gerado e baixado com sucesso!");
      } catch (err) {
        console.error("Error generating PDF:", err);
        toast.error("Erro ao gerar PDF da proposta.");
      }
    },
    [config, toast]
  );

  // ── WhatsApp share ──

  const handleShareWhatsApp = useCallback(
    (prop: ProposalRec) => {
      if (!prop.clientPhone) {
        toast.error("O cliente não possui telefone cadastrado.");
        return;
      }
      const cleanPhone = prop.clientPhone.replace(/\D/g, "");
      const itemsText = prop.items
        .map((i) => `• ${i.quantity}x ${i.name} - ${formatCurrency(i.total || 0)}`)
        .join("\n");

      const message = `Olá *${prop.clientName}*! Tudo bem?\n\nSegue o resumo da sua Proposta Comercial (*${prop.proposalNumber}*):\n\n*${prop.title}*\n\n${itemsText}\n\n*Subtotal:* ${formatCurrency(
        prop.subtotal || 0
      )}\n${
        (prop.discount || 0) > 0 ? `*Desconto:* -${formatCurrency(prop.discount)}\n` : ""
      }*VALOR TOTAL:* ${formatCurrency(
        prop.total || 0
      )}\n*Validade:* ${
        prop.validUntil || "15 dias"
      }\n*Condições:* ${prop.paymentTerms}\n\nFicamos à disposição para fecharmos o pedido! 🚀`;

      openExternalLink(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`);
    },
    [toast]
  );

  // ── Convert to order (mesmo formato de pedido do CRM) ──

  const handleConvertToOrder = useCallback(
    async (prop: ProposalRec) => {
      if (
        !confirm(
          `Deseja converter a proposta "${prop.proposalNumber}" em um Pedido ativo no CRM?`
        )
      )
        return;
      try {
        await addOrder({
          customerName: prop.clientName,
          customerEmail: prop.clientEmail || "",
          customerPhone: prop.clientPhone || "",
          deliveryAddress: {
            street: prop.clientAddress || "",
            number: "",
            neighborhood: "",
            city: "",
            zip: "",
          },
          items: prop.items.map((i) => ({
            productId: i.productId || "custom-item",
            productName: i.name,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
          subtotal: prop.subtotal,
          discount: prop.discount,
          total: prop.total,
          status: "processing",
          deliveryMethod: "delivery",
          paymentStatus: "paid",
        });
        await editItem(prop.id, { status: "approved" } as Record<string, unknown>);
        toast.success("Proposta convertida em Pedido com sucesso!");
      } catch (err: any) {
        console.error("Erro ao converter proposta em pedido:", err);
        toast.error("Erro ao converter proposta em pedido.");
      }
    },
    [addOrder, editItem, toast]
  );

  const filteredProposals = useMemo(() => {
    const s = search.toLowerCase();
    return (proposals as ProposalRec[])
      .filter((p) => {
        const matchesSearch =
          !s ||
          (p.proposalNumber || "").toLowerCase().includes(s) ||
          (p.title || "").toLowerCase().includes(s) ||
          (p.clientName || "").toLowerCase().includes(s);
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [proposals, search, statusFilter]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-8 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-accent" />
            Propostas & Orçamentos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gere propostas em PDF com design profissional, compartilhe via WhatsApp e
            converta em pedidos
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nova Proposta
        </Button>
      </motion.div>

      {/* Error Banner */}
      {(actionError || proposalsError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-danger flex-1">
            {actionError || proposalsError}
          </p>
          <button
            onClick={() => {
              setActionError(null);
              clearError();
            }}
            className="text-danger/60 hover:text-danger transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <Input
            placeholder="Buscar por número, título ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
        >
          <option value="all">Todos os Status</option>
          <option value="draft">Rascunho</option>
          <option value="sent">Enviada</option>
          <option value="approved">Aprovada</option>
          <option value="rejected">Rejeitada</option>
        </select>
      </motion.div>

      {/* Proposals List */}
      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma proposta encontrada
          </p>
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Criar primeira proposta
          </Button>
        </div>
      ) : (
        <ProposalsGrid
          propsList={filteredProposals}
          onGeneratePDF={handleGeneratePDF}
          onShareWhatsApp={handleShareWhatsApp}
          onConvertToOrder={handleConvertToOrder}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal Criar / Editar Proposta */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingProp ? "Editar Proposta Comercial" : "Nova Proposta Comercial"
        }
        size="lg"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Número da Proposta"
              value={proposalNumber}
              onChange={(e) => setProposalNumber(e.target.value)}
            />
            <div className="col-span-2">
              <Input
                label="Título / Objeto da Proposta *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Fornecimento de Peças e Serviços"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Vincular Cliente
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="">-- Cliente Avulso ou Novo --</option>
                {clients.map((c) => {
                  const cc = c as any;
                  return (
                    <option key={c.id} value={c.id}>
                      {getClientName(cc)} {getClientPhone(cc) ? `(${getClientPhone(cc)})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <Input
              label="Nome do Cliente / Razão Social *"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Telefone / WhatsApp"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
            <Input
              label="E-mail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
            <Input
              label="CPF / CNPJ"
              value={clientDocument}
              onChange={(e) => setClientDocument(e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </div>

          <Input
            label="Endereço do Cliente"
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder="Rua, número - bairro, cidade"
          />

          {/* Items */}
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-foreground/80">
                Itens e Serviços da Proposta
              </label>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="text-xs font-bold text-accent hover:text-accent/70 transition-colors"
              >
                + Item Personalizado
              </button>
            </div>

            <select
              value=""
              onChange={(e) => handleAddItemFromCatalog(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            >
              <option value="">+ Selecionar Produto do Catálogo...</option>
              {products.map((p) => {
                const pp = p as any;
                return (
                  <option key={p.id} value={p.id}>
                    {getProductName(pp)} - R$ {getProductPrice(pp).toFixed(2)}
                  </option>
                );
              })}
            </select>

            {items.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Nenhum item adicionado ainda. Escolha produtos do catálogo ou
                adicione itens manuais.
              </div>
            ) : (
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-center gap-2 rounded-xl border border-border bg-muted/50 p-2.5 text-xs"
                  >
                    <input
                      type="text"
                      placeholder="Nome do Item"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(idx, "name", e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 font-medium text-foreground"
                    />
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qtd"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateItem(idx, "quantity", Number(e.target.value))
                        }
                        className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-center"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Preço Unit."
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleUpdateItem(idx, "unitPrice", Number(e.target.value))
                        }
                        className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right"
                      />
                      <span className="sm:w-24 text-right font-bold text-foreground">
                        {formatCurrency(item.total || 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-danger hover:text-danger/70"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-3 items-center rounded-xl border border-border bg-muted/50 p-4">
            <div>
              <span className="text-xs text-muted-foreground block">Subtotal</span>
              <span className="text-base font-bold text-foreground">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 uppercase">
                Desconto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={discount === "" ? "" : String(discount)}
                onChange={(e) => setDiscount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-accent block uppercase">
                Valor Total
              </span>
              <span className="text-xl font-black text-accent">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Conditions & Status */}
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Validade da Proposta"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
            <Input
              label="Condições de Pagamento"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Status da Proposta
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProposalStatus)}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="draft">Rascunho</option>
                <option value="sent">Enviada</option>
                <option value="approved">Aprovada</option>
                <option value="rejected">Rejeitada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80">
              Observações e Termos
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 flex h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingProp ? "Salvar Alterações" : "Criar Proposta"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
