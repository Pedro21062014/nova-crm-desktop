// ── Clients Excel Import/Export ──
//
// Helpers para exportar e importar clientes via planilha .xlsx.
//
// Estrutura da planilha (compatível com o modelo usado pelo CRM web):
//   Colunas: Nome | Email | Telefone | Endereço | CPF/CNPJ | Observações | Criado em
//
// Como usar:
//   - exportClientsToExcel(clients)        -> baixa um arquivo .xlsx
//   - importClientsFromExcel(file)         -> retorna Client[] prontos para salvar
//   - downloadClientTemplate()             -> baixa uma planilha modelo vazia
//
// A função de importação é tolerante a variações de cabeçalho:
// aceita "Nome" / "nome" / "Name", "Telefone" / "phone", etc.

import * as XLSX from "xlsx";
import type { Client } from "@/services/firebase";

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
  { key: "nome",        header: "Nome" },
  { key: "email",       header: "Email" },
  { key: "telefone",    header: "Telefone" },
  { key: "endereco",    header: "Endereço" },
  { key: "cpfCnpj",     header: "CPF/CNPJ" },
  { key: "observacoes", header: "Observações" },
  { key: "createdAt",   header: "Criado em" },
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
  // observacoes
  observacoes: "observacoes", obs: "observacoes", notes: "observacoes", "observação": "observacoes", "observaçãoes": "observacoes",
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
    { wch: 40 }, // Observações
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
    ["João da Silva", "joao@exemplo.com", "(11) 99999-9999", "Rua das Flores, 123 - São Paulo/SP", "123.456.789-00", "Cliente VIP", ""],
  ]);
  ws["!cols"] = [
    { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 40 }, { wch: 18 },
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

    clients.push({ nome, email, telefone, endereco, cpfCnpj, observacoes });
  });

  return {
    clients,
    total: rows.length,
    imported: clients.length,
    skipped,
    errors,
  };
}
