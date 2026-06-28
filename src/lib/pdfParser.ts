import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ParadaInfo {
  numeroParada: number;
  codigo: string;
  endereco: string;
  grupoIndex: number;  // position within same-building group
  grupoTotal: number;  // total packages at same building
  outrosPrediosNaRua: number[]; // stop numbers of OTHER buildings on the same street
}

export type TabelaRota = Record<string, ParadaInfo>;
export type ListaParadas = ParadaRaw[];

export interface ParadaRaw {
  numeroParada: number;
  codigo: string;
  endereco: string;
}

// ── Extensible abbreviation table ────────────────────────────────────────────
const LOGRADOURO_PREFIXES = [
  'rua', 'r',
  'avenida', 'av',
  'travessa', 'tv',
  'alameda', 'al',
  'praça', 'praca', 'pc', 'pç',
  'estrada', 'estr',
  'rodovia', 'rod',
  'largo',
  'viela',
  'conjunto', 'cj',
  'quadra', 'qd',
  'jardim', 'jd',
  'parque', 'pq',
];

const PREFIX_RE = new RegExp(
  `^(${LOGRADOURO_PREFIXES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\.?\\s+`,
  'i'
);

function removerAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarRua(endereco: string): string {
  return removerAcentos(
    endereco.split(',')[0].trim().replace(PREFIX_RE, '').toLowerCase()
  ).trim();
}

function extrairNumeroPredio(endereco: string): string {
  const partes = endereco.split(',');
  return (partes[1] || '').trim().toLowerCase();
}

function chavePredio(endereco: string): string {
  return `${normalizarRua(endereco)}|${extrairNumeroPredio(endereco)}`;
}

// ── Text extraction ───────────────────────────────────────────────────────────
async function extrairTextoCompleto(arquivo: File): Promise<string> {
  const arrayBuffer = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let texto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((item: any) => item.str).join(' ') + ' ';
  }
  return texto;
}

// ── Parsing ───────────────────────────────────────────────────────────────────
function parseRota(texto: string): ParadaRaw[] {
  const regex = /(BR[0-9A-Z]{13})\s*;\s*([^;]+);/g;
  const paradas: ParadaRaw[] = [];
  let match: RegExpExecArray | null;
  let n = 1;
  while ((match = regex.exec(texto)) !== null) {
    paradas.push({
      numeroParada: n++,
      codigo: match[1].trim(),
      endereco: match[2].trim().replace(/\s+/g, ' '),
    });
  }
  return paradas;
}

// ── Grouping: by building (rua + número) ─────────────────────────────────────
function construirTabela(paradas: ParadaRaw[]): TabelaRota {
  // Group by building key
  const gruposPredio: Record<string, ParadaRaw[]> = {};
  paradas.forEach((p) => {
    const chave = chavePredio(p.endereco);
    (gruposPredio[chave] ||= []).push(p);
  });

  // Group by street key (for "outras paradas nesta rua" hint)
  const gruposRua: Record<string, ParadaRaw[]> = {};
  paradas.forEach((p) => {
    const rua = normalizarRua(p.endereco);
    (gruposRua[rua] ||= []).push(p);
  });

  const tabela: TabelaRota = {};

  Object.values(gruposPredio).forEach((grupo) => {
    const minhaPredioChave = chavePredio(grupo[0].endereco);
    const minhaRua = normalizarRua(grupo[0].endereco);

    // Other buildings on the same street (different building key)
    const outrosPredios = (gruposRua[minhaRua] ?? [])
      .filter((p) => chavePredio(p.endereco) !== minhaPredioChave);

    // Deduplicate: one stop number per building group
    const numerosOutrosPredios = [
      ...new Set(outrosPredios.map((p) => p.numeroParada)),
    ].sort((a, b) => a - b);

    grupo.forEach((p, idx) => {
      tabela[p.codigo] = {
        numeroParada: p.numeroParada,
        codigo: p.codigo,
        endereco: p.endereco,
        grupoIndex: idx + 1,
        grupoTotal: grupo.length,
        outrosPrediosNaRua: numerosOutrosPredios,
      };
    });
  });

  return tabela;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function processarPDF(
  arquivo: File
): Promise<{ tabela: TabelaRota; paradas: ParadaRaw[]; totalParadas: number }> {
  const texto = await extrairTextoCompleto(arquivo);
  const paradas = parseRota(texto);
  if (paradas.length === 0) {
    throw new Error(
      'Nenhuma parada encontrada no PDF. Verifique se o arquivo é um roteiro válido do Spoke/Circuit.'
    );
  }
  const tabela = construirTabela(paradas);
  return { tabela, paradas, totalParadas: paradas.length };
}

export function buscarCodigo(tabela: TabelaRota, texto: string): ParadaInfo | null {
  const normalizado = texto.trim().replace(/\s+/g, '').toUpperCase();
  if (!normalizado) return null;

  if (tabela[normalizado]) return tabela[normalizado];

  if (!normalizado.startsWith('BR')) {
    const comPrefixo = 'BR' + normalizado;
    if (tabela[comPrefixo]) return tabela[comPrefixo];
  }

  const codigos = Object.keys(tabela);
  for (const codigo of codigos) {
    if (codigo.includes(normalizado) || normalizado.includes(codigo)) {
      return tabela[codigo];
    }
  }

  return null;
}

export function buscarEndereco(
  paradas: ParadaRaw[],
  tabela: TabelaRota,
  termo: string
): ParadaInfo[] {
  const t = removerAcentos(termo.toLowerCase().trim());
  if (!t) return [];
  const vistos = new Set<string>();
  const resultado: ParadaInfo[] = [];
  paradas.forEach((p) => {
    const info = tabela[p.codigo];
    if (!info) return;
    if (vistos.has(p.codigo)) return;
    if (removerAcentos(p.endereco.toLowerCase()).includes(t)) {
      vistos.add(p.codigo);
      resultado.push(info);
    }
  });
  return resultado;
}

export function extrairCodigoDoQR(textoQR: string): string | null {
  const match = textoQR.match(/BR[0-9A-Z]{13}/);
  return match ? match[0] : null;
}

// ── localStorage persistence ──────────────────────────────────────────────────
const LS_KEY = 'leitor_circuit_rota_v2';

export interface RotaSalva {
  tabela: TabelaRota;
  paradas: ParadaRaw[];
  totalParadas: number;
  savedAt: number;
}

export function salvarRota(data: Omit<RotaSalva, 'savedAt'>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // storage quota exceeded — ignore silently
  }
}

export function carregarRota(): RotaSalva | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RotaSalva;
  } catch {
    return null;
  }
}

export function limparRota(): void {
  localStorage.removeItem(LS_KEY);
}
