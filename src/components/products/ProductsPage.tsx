import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Package, Edit2, Trash2, X } from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useProducts } from "@/hooks/useFirebaseData";
import { create, updateItem, removeItem, PATHS, type Product } from "@/services/firebase";
import { formatCurrency, cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const emptyProduct: Omit<Product, "createdAt" | "updatedAt"> = {
  nome: "",
  preco: 0,
  categoria: "",
  descricao: "",
  imagem: "",
  estoque: 0,
  ativo: true,
};

export function ProductsPage() {
  const { items: products, loading } = useProducts();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);

  const categories = ["Todos", ...Array.from(new Set(products.map((p) => p.categoria).filter(Boolean)))];

  const filtered = products.filter((p) => {
    const matchesSearch = p.nome?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "Todos" || p.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyProduct);
    setModalOpen(true);
  };

  const openEdit = (product: Product & { id: string }) => {
    setEditingId(product.id);
    setForm({
      nome: product.nome,
      preco: product.preco,
      categoria: product.categoria,
      descricao: product.descricao || "",
      imagem: product.imagem || "",
      estoque: product.estoque || 0,
      ativo: product.ativo !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateItem(PATHS.PRODUCTS, editingId, form);
      } else {
        await create(PATHS.PRODUCTS, form as Record<string, unknown>);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      await removeItem(PATHS.PRODUCTS, id);
    }
  };

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seu catálogo de produtos
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Novo Produto
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                categoryFilter === cat
                  ? "bg-accent text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-56">
              <div className="space-y-3">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center py-20"
        >
          <Package className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
          </p>
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Adicionar primeiro produto
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="grid grid-cols-4 gap-5">
          {filtered.map((product) => (
            <motion.div key={product.id} variants={itemVariants}>
              <Card hover className="group relative overflow-hidden">
                {/* Product Image */}
                <div className="mb-4 h-36 rounded-xl bg-muted overflow-hidden">
                  {product.imagem ? (
                    <img
                      src={product.imagem}
                      alt={product.nome}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                      {product.nome}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-accent">
                      {formatCurrency(product.preco || 0)}
                    </span>
                    {product.categoria && (
                      <Badge variant="info">{product.categoria}</Badge>
                    )}
                  </div>
                  {product.estoque !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Estoque: {product.estoque} unidades
                    </p>
                  )}
                </div>

                {/* Actions overlay */}
                <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(product as Product & { id: string })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm hover:bg-accent hover:text-white transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm hover:bg-danger hover:text-white transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar Produto" : "Novo Produto"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome do Produto"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Camiseta Básica"
            />
            <Input
              label="Preço (R$)"
              type="number"
              value={form.preco || ""}
              onChange={(e) => setForm({ ...form, preco: parseFloat(e.target.value) || 0 })}
              placeholder="0,00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Categoria"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              placeholder="Ex: Vestuário"
            />
            <Input
              label="Estoque"
              type="number"
              value={form.estoque || ""}
              onChange={(e) => setForm({ ...form, estoque: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <Input
            label="URL da Imagem"
            value={form.imagem}
            onChange={(e) => setForm({ ...form, imagem: e.target.value })}
            placeholder="https://..."
          />
          <div>
            <label className="text-sm font-medium text-foreground/80">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descrição do produto (opcional)"
              rows={3}
              className="mt-1.5 flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
