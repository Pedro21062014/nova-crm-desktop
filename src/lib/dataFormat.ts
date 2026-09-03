// ─────────────────────────────────────────────────────────────────────────────
// Normalização para o formato CANÔNICO do CRM web (repo CRM).
//
// O CRM web grava/lê produtos com campos em INGLÊS
// (name, price, stock, category, description, imageUrl) e clientes com
// (name, phone, email, address{...}). O desktop histórico gravava em
// PORTUGUÊS (nome, preco, estoque, telefone, endereco) — o próprio desktop
// lê os dois formatos (getters duais), mas o CRM web SÓ lê o inglês.
//
// Solução: ao salvar, o desktop grava os DOIS formatos (textual é barato;
// a imagem vai só em imageUrl, sem duplicar o base64). Documentos antigos
// só em PT são normalizados uma vez (migração automática ao carregar a aba).
// ─────────────────────────────────────────────────────────────────────────────

type AnyRecord = Record<string, any>;

// ── Produtos ────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return isNaN(n) ? 0 : n;
}

/** Payload em formato CRM (inglês) a partir de um produto (PT ou EN). */
export function productToCrmFormat(item: AnyRecord): AnyRecord {
  const name = item.name ?? item.nome ?? "";
  const imageUrl = String(item.imageUrl ?? item.image ?? item.imagem ?? "");
  return {
    name: String(name),
    price: num(item.price ?? item.preco),
    stock: num(item.stock ?? item.estoque),
    category: String(item.category ?? item.categoria ?? ""),
    description: String(item.description ?? item.descricao ?? ""),
    imageUrl,
    // 2ª foto (o desktop mantém a 1ª em imageUrl, sem duplicar o base64)
    images: Array.isArray(item.images) ? item.images : imageUrl ? [imageUrl] : [],
    secondaryImageUrl: String(item.secondaryImageUrl ?? ""),
    expirationDate: String(item.expirationDate ?? ""),
    active: item.active !== false && item.ativo !== false,
    orderIndex:
      typeof item.orderIndex === "number" ? item.orderIndex : undefined,
    // Opções de venda do CRM web (peso, sabor, adicionais e grupos de escolha).
    // Documentos legados sem esses campos recebem os padrões (desativados/vazios).
    hasWeightOptions: !!item.hasWeightOptions,
    weightOptions: Array.isArray(item.weightOptions) ? item.weightOptions : [],
    hasFlavorOptions: !!item.hasFlavorOptions,
    flavorOptions: Array.isArray(item.flavorOptions) ? item.flavorOptions : [],
    hasAdditionalOptions: !!item.hasAdditionalOptions,
    additionalOptions: Array.isArray(item.additionalOptions)
      ? item.additionalOptions
      : [],
    optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : [],
  };
}

/** true se o produto está no formato legado PT (sem os campos canônicos EN). */
export function productNeedsCrmSync(item: AnyRecord): boolean {
  return !item.name && (item.nome !== undefined || item.preco !== undefined);
}

// ── Clientes ────────────────────────────────────────────────────────────────

/** Payload em formato CRM (inglês) a partir de um cliente (PT ou EN). */
export function clientToCrmFormat(item: AnyRecord): AnyRecord {
  const address = item.address;
  return {
    name: String(item.name ?? item.nome ?? ""),
    phone: String(item.phone ?? item.telefone ?? ""),
    email: String(item.email ?? ""),
    clientType: item.clientType ?? "common",
    // O CRM usa address como objeto; o desktop histórico usa endereco (string)
    address:
      typeof address === "object" && address !== null
        ? address
        : {
            street: String(item.endereco ?? ""),
            number: "",
            neighborhood: "",
            city: "",
            zip: "",
            complement: "",
          },
  };
}

/** true se o cliente está no formato legado PT (sem os campos canônicos EN). */
export function clientNeedsCrmSync(item: AnyRecord): boolean {
  return !item.name && (item.nome !== undefined || item.telefone !== undefined);
}
