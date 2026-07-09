// ── Clients Excel Import/Export ──
//
// Helpers para exportar e importar clientes via planilha .xlsx.
//
// Estrutura da planilha (compatível com o modelo usado pelo CRM web):
//   Colunas: Nome | Email | Telefone | Endereço | CPF/CNPJ | Tipo | Observações |
//            Responsável | Potencial (R$) | Melhor Dia | Última Visita |
//            Próxima Visita | Criado em
//
// Como usar:
//   - exportClientsToExcel(clients)        -> baixa um arquivo .xlsx
//   - importClientsFromExcel(file)         -> retorna Client[] prontos para salvar
//   - downloadClientTemplate()             -> baixa uma planilha modelo vazia
//
// A função de importação é tolerante a variações de cabeçalho:
// aceita "Nome" / "nome" / "Name", "Telefone" / "phone", etc.

import * as XLSX from "xlsx";
import type { Client, ClientType } from "@/services/firebase";

// ── Rótulos legíveis para o tipo de cliente ──
const TYPE_LABEL: Record<ClientType, string> = {
  common: "Consumidor",
  commercial: "Ponto Comercial",
};

function parseClientType(raw: unknown): ClientType {
  if (typeof raw !== "string") return "common";
  const v = raw.trim().toLowerCase();
  if (v === "commercial" || v === "comercial" || v === "ponto comercial" ||
      v === "ponto" || v === "b2b" || v === "revenda") {
    return "commercial";
  }
  return "common";
}

// ── Helpers para endereço (igual ao ClientsPage) ──
function safeStr(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object") {
    const v = val as Record<string, unknown>;
    const parts = [v.street, v.number, v.neighborhood, v.city, v.zip, v.state, v.complement]
      .filter((p) => p && typeof p !== "object")
      .map(String);
    if (parts.length > 0) return parts.join(", ");
    const allParts = Object.values(v)
      .filter((p) => typeof p === "string" || typeof p === "number")
      .map(String);
    return allParts.join(", ");
  }
  return String(val);
}

function toMs(ts: unknown): number | null {
  if (ts == null) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const n = Number(ts);
    if (!isNaN(n)) return n;
    const d = Date.parse(ts);
    return isNaN(d) ? null : d;
  }
  // Firestore Timestamp
  if (typeof ts === "object") {
    const t = ts as { seconds?: number; nanoseconds?: number; toMillis?: () => number };
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  }
  return null;
}

function formatDate(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  // dd/MM/yyyy HH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Colunas da planilha ──
const COLUMNS = [
  { key: "nome",               header: "Nome" },
  { key: "email",              header: "Email" },
  { key: "telefone",           header: "Telefone" },
  { key: "endereco",           header: "Endereço" },
  { key: "cpfCnpj",            header: "CPF/CNPJ" },
  { key: "clientType",         header: "Tipo" },
  { key: "observacoes",        header: "Observações" },
  { key: "contactPerson",      header: "Responsável" },
  { key: "purchasePotential",  header: "Potencial (R$)" },
  { key: "bestBuyDay",         header: "Melhor Dia" },
  { key: "lastVisit",          header: "Última Visita" },
  { key: "nextVisit",          header: "Próxima Visita" },
  { key: "createdAt",          header: "Criado em" },
] as const;

// Mapeamento de cabeçalhos alternativos (case-insensitive, sem acento)
const HEADER_ALIASES: Record<string, string> = {
  // nome
  nome: "nome", name: "nome", "nome completo": "nome", cliente: "nome",
  // email
  email: "email", "e-mail": "email", mail: "email",
  // telefone
  telefone: "telefone", phone: "telefone", celular: "telefone", whatsapp: "telefone", "telefone/whatsapp": "telefone",
  // endereco
  endereco: "endereco", address: "endereco", "endereço": "endereco",
  // cpfCnpj
  cpfcnpj: "cpfCnpj", "cpf/cnpj": "cpfCnpj", cpf: "cpfCnpj", cnpj: "cpfCnpj", documento: "cpfCnpj", document: "cpfCnpj",
  // tipo
  tipo: "clientType", "tipo de cliente": "clientType", clienttype: "clientType", type: "clientType",
  // observacoes
  observacoes: "observacoes", obs: "observacoes", notes: "observacoes", "observação": "observacoes", "observaçãoes": "observacoes",
  // contactPerson
  contactperson: "contactPerson", responsavel: "contactPerson", "responsável": "contactPerson", "responsavel pela compra": "contactPerson", contato: "contactPerson",
  // purchasePotential
  purchasepotential: "purchasePotential", potencial: "purchasePotential", "potencial de compra": "purchasePotential", "potencial (r$)": "purchasePotential",
  // bestBuyDay
  bestbuyday: "bestBuyDay", "melhor dia": "bestBuyDay", "melhor dia de compra": "bestBuyDay", "melhor dia da semana": "bestBuyDay",
  // lastVisit
  lastvisit: "lastVisit", "ultima visita": "lastVisit", "última visita": "lastVisit",
  // nextVisit
  nextvisit: "nextVisit", "proxima visita": "nextVisit", "próxima visita": "nextVisit", "proxima": "nextVisit", "próxima": "nextVisit",
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── Export ──

export function exportClientsToExcel(
  clients: Array<Client & { id?: string }>,
  filename?: string
): void {
  const rows = clients.map((c) => {
    const row: Record<string, string> = {};
    for (const col of COLUMNS) {
      if (col.key === "createdAt") {
        row[col.header] = formatDate(toMs((c as any).createdAt));
      } else if (col.key === "clientType") {
        const t = (c as any).clientType === "commercial" ? "commercial" : "common";
        row[col.header] = TYPE_LABEL[t as ClientType];
      } else if (col.key === "purchasePotential") {
        const v = (c as any).purchasePotential;
        row[col.header] = v != null && !isNaN(Number(v)) ? String(Number(v)) : "";
      } else {
        row[col.header] = safeStr((c as any)[col.key]);
      }
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: COLUMNS.map((c) => c.header),
  });

  // Largura aproximada das colunas
  ws["!cols"] = [
    { wch: 30 }, // Nome
    { wch: 30 }, // Email
    { wch: 18 }, // Telefone
    { wch: 40 }, // Endereço
    { wch: 20 }, // CPF/CNPJ
    { wch: 16 }, // Tipo
    { wch: 40 }, // Observações
    { wch: 22 }, // Responsável
    { wch: 14 }, // Potencial (R$)
    { wch: 14 }, // Melhor Dia
    { wch: 14 }, // Última Visita
    { wch: 14 }, // Próxima Visita
    { wch: 18 }, // Criado em
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");

  const stamp = new Date().toISOString().slice(0, 10);
  const name = filename || `clientes-nova-crm-${stamp}.xlsx`;
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
}

// ── Template (planilha modelo vazia) ──

export function downloadClientTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    COLUMNS.map((c) => c.header),
    // linha de exemplo (pode ser apagada pelo usuário)
    [
      "João da Silva",
      "joao@exemplo.com",
      "(11) 99999-9999",
      "Rua das Flores, 123 - São Paulo/SP",
      "123.456.789-00",
      "Consumidor",
      "Cliente VIP",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    // exemplo de Ponto Comercial
    [
      "Mercadinho do Bairro LTDA",
      "compras@mercadinho.com",
      "(11) 3333-4444",
      "Av. Brasil, 500 - São Paulo/SP",
      "12.345.678/0001-99",
      "Ponto Comercial",
      "Compra toda sexta",
      "Sr. Carlos",
      "5000",
      "Sexta",
      "2025-06-30",
      "2025-07-07",
      "",
    ],
  ]);
  ws["!cols"] = [
    { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 40 }, { wch: 20 },
    { wch: 16 }, { wch: 40 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "modelo-clientes.xlsx");
}

// ── Import ──

export interface ImportResult {
  clients: Omit<Client, "createdAt" | "updatedAt">[];
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importClientsFromExcel(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { clients: [], total: 0, imported: 0, skipped: 0, errors: ["Planilha vazia ou sem aba."] };
  }
  const ws = wb.Sheets[firstSheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return { clients: [], total: 0, imported: 0, skipped: 0, errors: ["Nenhuma linha encontrada na planilha."] };
  }

  // Mapeia cabeçalhos reais para nossas chaves
  const firstRow = rows[0];
  const headerMap: Record<string, string> = {};
  for (const rawHeader of Object.keys(firstRow)) {
    const norm = normalizeHeader(rawHeader);
    const mapped = HEADER_ALIASES[norm];
    if (mapped) headerMap[rawHeader] = mapped;
  }

  const errors: string[] = [];
  const clients: Omit<Client, "createdAt" | "updatedAt">[] = [];
  let skipped = 0;

  rows.forEach((row, idx) => {
    const get = (key: string) => {
      const realHeader = Object.keys(headerMap).find((h) => headerMap[h] === key);
      return realHeader ? safeStr(row[realHeader]) : "";
    };

    const nome = get("nome").trim();
    const email = get("email").trim();
    const telefone = get("telefone").trim();
    const endereco = get("endereco").trim();
    const cpfCnpj = get("cpfCnpj").trim();
    const tipoRaw = get("clientType").trim();
    const clientType = parseClientType(tipoRaw);
    const observacoes = get("observacoes").trim();

    if (!nome && !email && !telefone) {
      skipped++;
      return;
    }

    if (!nome) {
      errors.push(`Linha ${idx + 2}: cliente sem nome — pulado.`);
      skipped++;
      return;
    }

    const base: Omit<Client, "createdAt" | "updatedAt"> = {
      nome, email, telefone, endereco, cpfCnpj, observacoes, clientType,
    };

    // Campos extras apenas para Pontos Comerciais
    if (clientType === "commercial") {
      const contactPerson = get("contactPerson").trim();
      const purchaseRaw = get("purchasePotential").trim();
      const purchasePotential = purchaseRaw ? Number(purchaseRaw.replace(/[^0-9,.-]/g, "").replace(",", ".")) : NaN;
      const bestBuyDay = get("bestBuyDay").trim();
      const lastVisit = get("lastVisit").trim();
      const nextVisit = get("nextVisit").trim();
      if (contactPerson) base.contactPerson = contactPerson;
      if (!isNaN(purchasePotential) && purchasePotential > 0) base.purchasePotential = purchasePotential;
      if (bestBuyDay) base.bestBuyDay = bestBuyDay;
      if (lastVisit) base.lastVisit = lastVisit;
      if (nextVisit) base.nextVisit = nextVisit;
    }

    clients.push(base);
  });

  return {
    clients,
    total: rows.length,
    imported: clients.length,
    skipped,
    errors,
  };
}
