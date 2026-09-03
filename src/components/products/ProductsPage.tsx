import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Package,
  Edit2,
  Trash2,
  X,
  Upload,
  Camera,
  Scale,
  CakeSlice,
  PlusCircle,
  Layers,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useProducts } from "@/hooks/useFirebaseData";
import { type Product } from "@/services/firebase";
import { formatCurrency, cn } from "@/lib/utils";
import { productToCrmFormat, productNeedsCrmSync } from "@/lib/dataFormat";
import { convertFileToBase64 } from "@/lib/chatAttachment";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ── Tipos dos escopos de opção de venda (formato canônico do CRM web) ──────
interface WeightOption {
  weight: string;
  price: number;
  imageUrl?: string;
}
interface NamePriceOption {
  name: string;
  price: number;
  imageUrl?: string;
}
interface OptionGroupOption extends NamePriceOption {
  id: string;
}
interface OptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minQuantity: number;
  maxQuantity: number;
  options: OptionGroupOption[];
}

const emptyProduct: Omit<Product, "createdAt" | "updatedAt"> = {
  nome: "",
  preco: 0,
  categoria: "",
  descricao: "",
  imagem: "",
  estoque: 0,
  ativo: true,
  // Escopos de criação de produto (paridade com o CRM web)
  secondaryImageUrl: "",
  expirationDate: "",
  hasWeightOptions: false,
  weightOptions: [],
  hasFlavorOptions: false,
  flavorOptions: [],
  hasAdditionalOptions: false,
  additionalOptions: [],
  optionGroups: [],
};

// Helper to get product name (compatible with both "nome" and "name" fields)
function pName(p: any): string { return p.nome || p.name || ""; }
function pPrice(p: any): number { return p.preco || p.price || 0; }
function pCategory(p: any): string { return p.categoria || p.category || ""; }
function pDesc(p: any): string { return p.descricao || p.description || ""; }
function pImage(p: any): string { return p.imagem || p.image || p.imageUrl || ""; }
function pStock(p: any): number { return p.estoque || p.stock || p.quantity || 0; }
function pActive(p: any): boolean { return p.ativo !== false && p.active !== false; }

// Gera id único simples para grupos/opções (mesmo padrão do CRM web)
function genId(prefix: string): string {
  return prefix + Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

// ── Subcomponentes do formulário ────────────────────────────────────────────

/** Linha "switch" (título + descrição + toggle) no padrão do CRM web. */
function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-muted-foreground/25"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

/** Botão de foto da variação (miniatura ou câmera) + input oculto próprio. */
function VariationImageBtn({
  imageUrl,
  label,
  onImage,
  uploading,
}: {
  imageUrl?: string;
  label: string;
  onImage: (dataUrl: string) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await convertFileToBase64(file, {
        maxWidth: 640,
        maxHeight: 640,
        quality: 0.82,
      });
      onImage(dataUrl);
    } catch (err) {
      console.error("Erro ao carregar foto da opção:", err);
    }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        title={label}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-colors",
          imageUrl
            ? "border-border bg-muted"
            : "border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        {uploading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground" />
        ) : imageUrl ? (
          <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </button>
    </>
  );
}

// Input local p/ linhas de opção (raw, para funcionar com flex-1 na linha)
const optInputBase =
  "rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all";

function OptInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(optInputBase, "h-9", className)} />;
}

// ── Página ─────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { items: products, loading, addItem, editItem, deleteItem } = useProducts();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Product, "createdAt" | "updatedAt">>(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const secondaryImageInputRef = useRef<HTMLInputElement>(null);
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
      secondaryImageUrl: product.secondaryImageUrl || (product.images?.[1] || ""),
      expirationDate: product.expirationDate || "",
      hasWeightOptions: !!product.hasWeightOptions,
      weightOptions: Array.isArray(product.weightOptions) ? product.weightOptions : [],
      hasFlavorOptions: !!product.hasFlavorOptions,
      flavorOptions: Array.isArray(product.flavorOptions) ? product.flavorOptions : [],
      hasAdditionalOptions: !!product.hasAdditionalOptions,
      additionalOptions: Array.isArray(product.additionalOptions)
        ? product.additionalOptions
        : [],
      optionGroups: Array.isArray(product.optionGroups) ? product.optionGroups : [],
    });
    setModalOpen(true);
  };

  // Imagem principal (comprimida, como o CRM web: 640px / q0.82)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Imagem muito grande (máximo 2MB).");
      return;
    }
    setUploadingImage(true);
    try {
      const base64 = await convertFileToBase64(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.82,
      });
      setForm((f) => ({ ...f, imagem: base64 }));
    } catch (err) {
      console.error("Erro ao carregar imagem:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  // 2ª foto (opcional): arquivo ou URL (campo secondaryImageUrl do CRM)
  const handleSecondaryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingImage(true);
    try {
      const base64 = await convertFileToBase64(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.82,
      });
      setForm((f) => ({ ...f, secondaryImageUrl: base64 }));
    } catch (err) {
      console.error("Erro ao carregar foto 2:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const img1 = (form.imagem || "").trim();
      const img2 = (form.secondaryImageUrl || "").trim();

      // Payload nos DOIS formatos: PT (legado do desktop) + EN canônico do
      // CRM web — com todos os escopos de opção de venda. Imagem principal
      // só em imageUrl (sem duplicar o base64 no campo "imagem").
      const crm = productToCrmFormat({
        ...form,
        imageUrl: img1,
        secondaryImageUrl: img2,
        images: [img1, img2].filter(Boolean),
        expirationDate: form.expirationDate || "",
      });

      // orderIndex: mesmo cálculo do CRM (máximo existente + 1)
      const existing = editingId ? products.find((p) => p.id === editingId) : undefined;
      const nextOrderIndex = existing
        ? (existing.orderIndex ?? products.length)
        : products.length
          ? Math.max(...products.map((p) => (p.orderIndex ?? 0))) + 1
          : 0;

      const payload: Record<string, unknown> = {
        nome: form.nome,
        preco: form.preco,
        categoria: form.categoria,
        descricao: form.descricao,
        estoque: form.estoque,
        ativo: form.ativo,
        ...crm,
        hasWeightOptions: form.hasWeightOptions,
        weightOptions: form.hasWeightOptions ? form.weightOptions : [],
        hasFlavorOptions: form.hasFlavorOptions,
        flavorOptions: form.hasFlavorOptions ? form.flavorOptions : [],
        hasAdditionalOptions: form.hasAdditionalOptions,
        additionalOptions: form.hasAdditionalOptions ? form.additionalOptions : [],
        optionGroups: form.optionGroups || [],
        orderIndex: nextOrderIndex,
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

  // ── Handlers das opções de venda ──────────────────────────────────────────
  const setWeightOption = (idx: number, patch: Partial<WeightOption>) => {
    setForm((f) => {
      const opts = [...(f.weightOptions || [])];
      opts[idx] = { ...opts[idx], ...patch };
      return { ...f, weightOptions: opts };
    });
  };
  const setFlavorOption = (idx: number, patch: Partial<NamePriceOption>) => {
    setForm((f) => {
      const opts = [...(f.flavorOptions || [])];
      opts[idx] = { ...opts[idx], ...patch };
      return { ...f, flavorOptions: opts };
    });
  };
  const setAdditionalOption = (idx: number, patch: Partial<NamePriceOption>) => {
    setForm((f) => {
      const opts = [...(f.additionalOptions || [])];
      opts[idx] = { ...opts[idx], ...patch };
      return { ...f, additionalOptions: opts };
    });
  };
  const setGroup = (groupIdx: number, patch: Partial<OptionGroup>) => {
    setForm((f) => {
      const groups = [...(f.optionGroups || [])];
      groups[groupIdx] = { ...groups[groupIdx], ...patch };
      return { ...f, optionGroups: groups };
    });
  };
  const setGroupOption = (groupIdx: number, optIdx: number, patch: Partial<OptionGroupOption>) => {
    setForm((f) => {
      const groups = [...(f.optionGroups || [])];
      const opts = [...groups[groupIdx].options];
      opts[optIdx] = { ...opts[optIdx], ...patch };
      groups[groupIdx] = { ...groups[groupIdx], options: opts };
      return { ...f, optionGroups: groups };
    });
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
            const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
            const optionBadges: { label: string; icon: React.ReactNode }[] = [];
            if (product.hasWeightOptions) optionBadges.push({ label: "Peso", icon: <Scale className="h-3 w-3" /> });
            if (product.hasFlavorOptions) optionBadges.push({ label: "Sabor", icon: <CakeSlice className="h-3 w-3" /> });
            if (product.hasAdditionalOptions) optionBadges.push({ label: "Adicionais", icon: <PlusCircle className="h-3 w-3" /> });
            if (groups.length > 0) optionBadges.push({ label: "Grupos", icon: <Layers className="h-3 w-3" /> });
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
                    {optionBadges.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {optionBadges.map((b) => (
                          <span
                            key={b.label}
                            className="inline-flex items-center gap-1 rounded-md bg-accent-light px-1.5 py-0.5 text-[10px] font-medium text-accent"
                          >
                            {b.icon}
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}
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
            <label className="text-sm font-medium text-foreground/80">Imagens do Produto</label>
            <div className="mt-2 flex items-start gap-4">
              {/* Imagem principal */}
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
                    onClick={() => setForm((f) => ({ ...f, imagem: "" }))}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm hover:bg-danger/80 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {/* 2ª foto (opcional) — paridade com o CRM web */}
              <div className="relative shrink-0">
                <div className="h-16 w-16 rounded-xl bg-muted border-2 border-dashed border-border overflow-hidden flex items-center justify-center">
                  {form.secondaryImageUrl ? (
                    <img
                      src={form.secondaryImageUrl}
                      alt="Preview 2"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <Camera className="h-5 w-5 text-muted-foreground/40" />
                      <span className="text-[9px] text-muted-foreground/60">Foto 2</span>
                    </div>
                  )}
                </div>
                {form.secondaryImageUrl && (
                  <button
                    onClick={() => setForm((f) => ({ ...f, secondaryImageUrl: "" }))}
                    className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white shadow-sm hover:bg-danger/80 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
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
                <input
                  ref={secondaryImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSecondaryImageUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    icon={<Upload className="h-4 w-4" />}
                    onClick={() => imageInputRef.current?.click()}
                    loading={uploadingImage}
                  >
                    {formImage ? "Trocar Imagem" : "Enviar Imagem"}
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Upload className="h-4 w-4" />}
                    onClick={() => secondaryImageInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {form.secondaryImageUrl ? "Trocar Foto 2" : "Foto 2 (opcional)"}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  PNG, JPG ou WEBP. A foto 2 é opcional (aparece no carrossel do produto).
                </p>
                <input
                  type="text"
                  value={(form.secondaryImageUrl || "").startsWith("data:") ? "" : (form.secondaryImageUrl || "")}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryImageUrl: e.target.value }))}
                  onBlur={(e) => {
                    if (e.target.value && !e.target.value.startsWith("data:") && !/^https?:\/\//i.test(e.target.value)) {
                      // deixa como está; URLs relativas ficam para o CRM resolver
                    }
                  }}
                  placeholder="…ou cole a URL da foto 2"
                  className="mt-2 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome do Produto"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Bolo de aniversário"
            />
            <Input
              label={form.hasWeightOptions ? "Preço (definido pelo peso)" : "Preço (R$)"}
              type="number"
              disabled={form.hasWeightOptions}
              value={form.hasWeightOptions ? "" : (form.preco || "")}
              onChange={(e) => setForm({ ...form, preco: parseFloat(e.target.value) || 0 })}
              placeholder={form.hasWeightOptions ? "—" : "0,00"}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
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
            <Input
              label="Validade (opcional)"
              type="date"
              value={form.expirationDate || ""}
              onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
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

          {/* ── Opções de venda (escopos do CRM web) ── */}
          <section className="space-y-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Opções de venda</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ative variações de peso, sabor, adicionais ou grupos de escolha.
              </p>
            </div>

            <div className="rounded-xl border border-border divide-y divide-border/70 overflow-hidden">
              {/* Peso / Tamanho */}
              <div className="p-4 space-y-3">
                <SwitchRow
                  title="Vender por Peso / Tamanho"
                  description="Cada variação tem preço próprio; o preço principal é desativado."
                  checked={!!form.hasWeightOptions}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, hasWeightOptions: v, preco: v ? 0 : f.preco }))
                  }
                />
                {form.hasWeightOptions && (
                  <div className="space-y-2 pt-1">
                    {(form.weightOptions || []).map((opt, idx) => (
                      <div key={idx} className="flex flex-wrap gap-2 items-center">
                        <VariationImageBtn
                          imageUrl={opt.imageUrl}
                          label="Foto da opção de peso/tamanho"
                          uploading={uploadingImage}
                          onImage={(url) => setWeightOption(idx, { imageUrl: url })}
                        />
                        <OptInput
                          placeholder="Ex: 500g, 1kg"
                          className="h-9 flex-1 min-w-[110px]"
                          value={opt.weight}
                          onChange={(e) => setWeightOption(idx, { weight: e.target.value })}
                        />
                        <OptInput
                          type="number"
                          step="0.01"
                          placeholder="Preço R$"
                          className="h-9 w-24 min-w-0"
                          value={opt.price || ""}
                          onChange={(e) => setWeightOption(idx, { price: parseFloat(e.target.value) || 0 })}
                        />
                        <button
                          type="button"
                          title="Remover opção"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              weightOptions: (f.weightOptions || []).filter((_, i) => i !== idx),
                            }))
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          weightOptions: [...(f.weightOptions || []), { weight: "", price: 0 }],
                        }))
                      }
                    >
                      Adicionar Opção
                    </Button>
                  </div>
                )}
              </div>

              {/* Sabor */}
              <div className="p-4 space-y-3">
                <SwitchRow
                  title="Vender por Sabor"
                  description="O cliente escolhe um sabor; valor adicional opcional."
                  checked={!!form.hasFlavorOptions}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, hasFlavorOptions: v }))}
                />
                {form.hasFlavorOptions && (
                  <div className="space-y-2 pt-1">
                    {(form.flavorOptions || []).map((opt, idx) => (
                      <div key={idx} className="flex flex-wrap gap-2 items-center">
                        <VariationImageBtn
                          imageUrl={opt.imageUrl}
                          label="Foto do sabor"
                          uploading={uploadingImage}
                          onImage={(url) => setFlavorOption(idx, { imageUrl: url })}
                        />
                        <OptInput
                          placeholder="Ex: Chocolate"
                          className="h-9 flex-1 min-w-[110px]"
                          value={opt.name}
                          onChange={(e) => setFlavorOption(idx, { name: e.target.value })}
                        />
                        <OptInput
                          type="number"
                          step="0.01"
                          placeholder="Adicional (R$)"
                          className="h-9 w-28 min-w-0"
                          value={opt.price || ""}
                          onChange={(e) => setFlavorOption(idx, { price: parseFloat(e.target.value) || 0 })}
                        />
                        <button
                          type="button"
                          title="Remover sabor"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              flavorOptions: (f.flavorOptions || []).filter((_, i) => i !== idx),
                            }))
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          flavorOptions: [...(f.flavorOptions || []), { name: "", price: 0 }],
                        }))
                      }
                    >
                      Adicionar Sabor
                    </Button>
                  </div>
                )}
              </div>

              {/* Adicionais */}
              <div className="p-4 space-y-3">
                <SwitchRow
                  title="Adicionais"
                  description="Itens extras pagos, como bordas ou coberturas."
                  checked={!!form.hasAdditionalOptions}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, hasAdditionalOptions: v }))}
                />
                {form.hasAdditionalOptions && (
                  <div className="space-y-2 pt-1">
                    {(form.additionalOptions || []).map((opt, idx) => (
                      <div key={idx} className="flex flex-wrap gap-2 items-center">
                        <VariationImageBtn
                          imageUrl={opt.imageUrl}
                          label="Foto do adicional"
                          uploading={uploadingImage}
                          onImage={(url) => setAdditionalOption(idx, { imageUrl: url })}
                        />
                        <OptInput
                          placeholder="Ex: Chantilly"
                          className="h-9 flex-1 min-w-[110px]"
                          value={opt.name}
                          onChange={(e) => setAdditionalOption(idx, { name: e.target.value })}
                        />
                        <OptInput
                          type="number"
                          step="0.01"
                          placeholder="Preço (R$)"
                          className="h-9 w-24 min-w-0"
                          value={opt.price || ""}
                          onChange={(e) => setAdditionalOption(idx, { price: parseFloat(e.target.value) || 0 })}
                        />
                        <button
                          type="button"
                          title="Remover adicional"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              additionalOptions: (f.additionalOptions || []).filter((_, i) => i !== idx),
                            }))
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          additionalOptions: [...(f.additionalOptions || []), { name: "", price: 0 }],
                        }))
                      }
                    >
                      Adicionar Adicional
                    </Button>
                  </div>
                )}
              </div>

              {/* Grupos de Opções Extras */}
              <div className="p-4 space-y-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">
                    Grupos de Opções Extras (Ex: Escolha seu pão)
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
                    Monte combos de escolha com regras de seleção mínima e máxima.
                  </p>
                </div>
                <div className="space-y-3">
                  {(form.optionGroups || []).map((group, groupIdx) => (
                    <div
                      key={group.id}
                      className="p-3.5 border border-border/70 rounded-xl bg-muted/40 space-y-3 relative"
                    >
                      <button
                        type="button"
                        title="Remover grupo"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            optionGroups: (f.optionGroups || []).filter((_, i) => i !== groupIdx),
                          }))
                        }
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <OptInput
                        placeholder="Nome do grupo (ex: Escolha o Pão)"
                        className="h-9 w-full sm:w-2/3 font-semibold"
                        value={group.name}
                        onChange={(e) => setGroup(groupIdx, { name: e.target.value })}
                      />
                      <div className="flex flex-wrap gap-x-5 gap-y-3 items-center">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={group.isRequired}
                            onClick={() =>
                              setGroup(groupIdx, {
                                isRequired: !group.isRequired,
                                minQuantity: !group.isRequired && group.minQuantity === 0 ? 1 : group.minQuantity,
                              })
                            }
                            className={cn(
                              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                              group.isRequired ? "bg-accent" : "bg-muted-foreground/25"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                                group.isRequired ? "left-[18px]" : "left-0.5"
                              )}
                            />
                          </button>
                          <span className="text-xs text-muted-foreground">Obrigatório</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Seleção Mín.</span>
                          <OptInput
                            type="number"
                            min={0}
                            className="h-8 w-16 px-2"
                            value={group.minQuantity}
                            onChange={(e) => setGroup(groupIdx, { minQuantity: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Seleção Máx.</span>
                          <OptInput
                            type="number"
                            min={1}
                            className="h-8 w-16 px-2"
                            value={group.maxQuantity}
                            onChange={(e) => setGroup(groupIdx, { maxQuantity: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        O preço informado é um valor{" "}
                        <strong className="text-accent">ADICIONAL</strong> somado ao valor
                        principal do produto (deixe 0 se for grátis).
                      </p>
                      <div className="space-y-2">
                        {(group.options || []).map((opt, optIdx) => (
                          <div
                            key={opt.id}
                            className="flex flex-wrap gap-2 items-center pl-3 border-l-2 border-accent/25"
                          >
                            <VariationImageBtn
                              imageUrl={opt.imageUrl}
                              label="Foto da opção"
                              uploading={uploadingImage}
                              onImage={(url) => setGroupOption(groupIdx, optIdx, { imageUrl: url })}
                            />
                            <OptInput
                              placeholder="Nome da opção"
                              className="h-9 flex-1 min-w-[110px]"
                              value={opt.name}
                              onChange={(e) => setGroupOption(groupIdx, optIdx, { name: e.target.value })}
                            />
                            <div className="w-28 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                                + R$
                              </span>
                              <OptInput
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                className="h-9 pl-10 font-semibold text-accent"
                                value={opt.price || ""}
                                onChange={(e) =>
                                  setGroupOption(groupIdx, optIdx, { price: parseFloat(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <button
                              type="button"
                              title="Remover opção do grupo"
                              onClick={() =>
                                setGroup(groupIdx, {
                                  options: group.options.filter((_, i) => i !== optIdx),
                                })
                              }
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() =>
                          setGroup(groupIdx, {
                            options: [
                              ...group.options,
                              { id: genId("opt"), name: "", price: 0 },
                            ],
                          })
                        }
                      >
                        Adicionar Opção
                      </Button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        optionGroups: [
                          ...(f.optionGroups || []),
                          {
                            id: genId("grp"),
                            name: "",
                            isRequired: false,
                            minQuantity: 0,
                            maxQuantity: 1,
                            options: [{ id: genId("opt"), name: "", price: 0 }],
                          },
                        ],
                      }))
                    }
                    className="w-full rounded-xl border-2 border-dashed border-accent/30 py-2.5 text-sm font-semibold text-accent hover:bg-accent-light/50 hover:border-accent/50 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Novo Grupo de Opções
                  </button>
                </div>
              </div>
            </div>
          </section>

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
