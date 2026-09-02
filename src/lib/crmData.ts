// ─────────────────────────────────────────────────────────────────────────────
// Helpers de compatibilidade entre o formato do CRM web (repo CRM) e o
// formato antigo do nova-crm-desktop, além de utilitários compartilhados
// pelas abas de Pipeline, Propostas, Tarefas e Automações.
// ─────────────────────────────────────────────────────────────────────────────

/** Forma solta de cliente/produto para os getters de compatibilidade. */
export type CrmRecord = Record<string, any>;

/**
 * Remove recursivamente propriedades `undefined` antes de gravar no
 * Firestore (mesma lógica de `sanitizeFirestoreData` do repo CRM web).
 * O Firestore rejeita valores `undefined` em objetos aninhados.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      value.constructor === Object
    ) {
      result[key] = sanitizeFirestoreData(value as Record<string, any>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// ── Clientes ── (CRM web: name/phone/address aninhada · desktop antigo: nome/telefone/endereco)

export function getClientName(c: CrmRecord): string {
  return c?.name || c?.nome || "";
}

export function getClientPhone(c: CrmRecord): string {
  return c?.phone || c?.telefone || "";
}

export function getClientEmail(c: CrmRecord): string {
  return c?.email || "";
}

export function getClientAddress(c: CrmRecord): string {
  const a = c?.address;
  if (a && typeof a === "object") {
    return [a.street, a.number, a.neighborhood, a.city]
      .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .join(", ");
  }
  return c?.endereco || "";
}

// ── Produtos ─ (CRM web: name/price/description · desktop antigo: nome/preco/descricao)

export function getProductName(p: CrmRecord): string {
  return p?.name || p?.nome || "";
}

export function getProductPrice(p: CrmRecord): number {
  const v = p?.price ?? p?.preco;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export function getProductDescription(p: CrmRecord): string {
  return p?.description || p?.descricao || "";
}

// ── Datas ──

/** Data local no formato YYYY-MM-DD (compatível com inputs type="date" do CRM). */
export function todayLocalStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Adiciona N dias a uma data YYYY-MM-DD e retorna no mesmo formato. */
export function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayLocalStr(d);
}

// ── Shell ──

/**
 * Abre link externo no navegador padrão (Electron via IPC) ou em nova aba
 * (fallback para execução em browser/dev).
 */
export function openExternalLink(url: string): void {
  if (typeof window !== "undefined" && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
