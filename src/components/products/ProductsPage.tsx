import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Package, Edit2, Trash2, X, Upload, Camera } from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useProducts } from "@/hooks/useFirebaseData";
import { type Product } from "@/services/firebase";
import { formatCurrency, cn } from "@/lib/utils";
import { productToCrmFormat, productNeedsCrmSync } from "@/lib/dataFormat";

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

// Helper to get product name (compatible with both "nome" and "name" fields)
function pName(p: any): string { return p.nome || p.name || ""; }
function pPrice(p: any): number { return p.preco || p.price || 0; }
function pCategory(p: any): string { return p.categoria || p.category || ""; }
function pDesc(p: any): string { return p.descricao || p.description || ""; }
function pImage(p: any): string { return p.imagem || p.image || p.imageUrl || ""; }
function pStock(p: any): number { return p.estoque || p.stock || p.quantity || 0; }
function pActive(p: any): boolean { return p.ativo !== false && p.active !== false; }

// Convert File to base64 data URI (matching CRM storage format)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProductsPage() {
  const { items: products, loading, addItem, editItem, deleteItem } = useProducts();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const crmMigratedRef = useRef(false);

  // Migração única: produtos criados no formato legado PT (sem os campos
  // canônicos EN do CRM web) recebem os campos EN ao carregar a aba —
  // assim o catálogo existente também aparece completo no CRM web.
  useEffect(() => {
    if (crmMigratedRef.current || loading) return;
    const stale = products.filter((p) => productNeedsCrmSync(p as any));
    if (stale.length === 0) return;
    crmMigratedRef.current = true;
    console.log(`[Products] Normalizando ${stale.length} produto(s) para o formato do CRM web`);
    stale.slice(0, 50).forEach((p) => {
      editItem(p.id, productToCrmFormat(p as any) as Partial<Record<string, unknown>>)
        .then(() => console.log(`[Products] Produto ${p.id} normalizado`))
        .catch((err) => console.warn(`[Products] Falha ao normalizar ${p.id}:`, err));
    });
  }, [products, loading, editItem]);

  const categories = ["Todos", ...Array.from(new Set(products.map((p) => pCategory(p)).filter(Boolean)))];

  const filtered = products.filter((p) => {
    const name = pName(p);
    const cat = pCategory(p);
    const matchesSearch = name?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "Todos" || cat === categoryFilter;
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
      nome: pName(product),
      preco: pPrice(product),
      categoria: pCategory(product),
      descricao: pDesc(product),
      imagem: pImage(product),
      estoque: pStock(product),
      ativo: pActive(product),
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    setUploadingImage(true);
    try {
      const base64 = await fileToBase64(file);
      setForm({ ...form, imagem: base64 });
    } catch (err) {
      console.error("Erro ao carregar imagem:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setForm({ ...form, imagem: "" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Grava nos DOIS formatos: PT (legado do desktop) + EN canônico do CRM
      // web — assim o produto aparece completo nos dois apps. A imagem vai
      // só em imageUrl (sem duplicar o base64 no campo "imagem").
      const crm = productToCrmFormat({ ...form });
      const payload: Record<string, unknown> = {
        nome: form.nome,
        preco: form.preco,
        categoria: form.categoria,
        descricao: form.descricao,
        estoque: form.estoque,
        ativo: form.ativo,
        ...crm,
        orderIndex: products.length,
      };
      if (editingId) {
        await editItem(editingId, payload as Partial<Record<string, unknown>>);
      } else {
        await addItem(payload);
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
      await deleteItem(id);
    }
  };

  const formImage = form.imagem;

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
          {filtered.map((product) => {
            const name = pName(product);
            const price = pPrice(product);
            const cat = pCategory(product);
            const image = pImage(product);
            const stock = pStock(product);
            return (
              <motion.div key={product.id} variants={itemVariants}>
                <Card hover className="group relative overflow-hidden">
                  {/* Product Image */}
                  <div className="mb-4 h-36 rounded-xl bg-muted overflow-hidden">
                    {image ? (
                      <img
                        src={image}
                        alt={name}
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
                        {name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-accent">
                        {formatCurrency(price)}
                      </span>
                      {cat && (
                        <Badge variant="info">{cat}</Badge>
                      )}
                    </div>
                    {stock !== undefined && stock !== 0 && (
                      <p className="text-xs text-muted-foreground">
                        Estoque: {stock} unidades
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
            );
          })}
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
          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium text-foreground/80">Imagem do Produto</label>
            <div className="mt-2 flex items-start gap-4">
              {/* Image preview */}
              <div className="relative group shrink-0">
                <div className="h-28 w-28 rounded-2xl bg-muted border-2 border-dashed border-border overflow-hidden flex items-center justify-center">
                  {formImage ? (
                    <img
                      src={formImage}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Camera className="h-8 w-8 text-muted-foreground/40" />
                      <span className="text-[10px] text-muted-foreground/60">Sem imagem</span>
                    </div>
                  )}
                </div>
                {formImage && (
                  <button
                    onClick={removeImage}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm hover:bg-danger/80 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {/* Upload controls */}
              <div className="flex-1 pt-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  icon={<Upload className="h-4 w-4" />}
                  onClick={() => imageInputRef.current?.click()}
                  loading={uploadingImage}
                >
                  {formImage ? "Trocar Imagem" : "Enviar Imagem"}
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  PNG, JPG ou WEBP. Máximo 2MB. A imagem será salva junto com o produto.
                </p>
              </div>
            </div>
          </div>

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
