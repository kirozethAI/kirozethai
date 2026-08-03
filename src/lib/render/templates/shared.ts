// Utilitários compartilhados por todos os templates de imagem (Fase 10) —
// extraídos do antigo post-template.ts (Fase 3) pra serem reaproveitados por
// qualquer template do registro, não só o "clássico". Continuam funções
// puras (sem dependência de Node/Puppeteer/Supabase), então funcionam tanto
// em Server-side (geração real) quanto em Client Component (prévia da
// identidade visual, src/components/visual-dna-form.tsx).

export const POST_IMAGE_SIZE = 1080;

// Dimensões do formato Story (Fase 12) — vertical 9:16, mesma largura do
// post quadrado (1080) pra reaproveitar a mesma base de estilo, só que com
// bem mais altura disponível pro texto.
export const STORY_IMAGE_WIDTH = 1080;
export const STORY_IMAGE_HEIGHT = 1920;

const FALLBACK_BACKGROUND = "linear-gradient(135deg, #1f2937, #111827)";
const FALLBACK_TEXT_COLOR = "#ffffff";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}

export function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Escolhe um tamanho de fonte menor pra textos mais longos, pra reduzir o
// risco de o texto estourar o canvas de 1080x1080 (aproximação simples, não
// é fitting pixel-perfect — ver Decisões Tomadas / Problemas Encontrados da
// Fase 3). Reaproveitado por todos os templates que centralizam texto
// grande; um template pode ajustar as faixas se seu layout precisar de
// menos espaço (ex.: cartão com padding maior).
export function pickFontSize(texto: string): number {
  const tamanho = texto.length;
  if (tamanho <= 80) return 64;
  if (tamanho <= 150) return 52;
  if (tamanho <= 250) return 42;
  if (tamanho <= 400) return 34;
  return 28;
}

// Luminância percebida (fórmula simples, não é o cálculo WCAG completo) —
// só o suficiente pra decidir se o texto deve ser branco ou escuro em cima
// da cor de fundo escolhida pelo cliente, evitando texto ilegível se ele
// escolher uma cor primária clara.
export function pickTextColor(hex: string): string {
  if (!HEX_RE.test(hex)) return FALLBACK_TEXT_COLOR;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brilho = (r * 299 + g * 587 + b * 114) / 1000;
  return brilho > 150 ? "#111827" : "#ffffff";
}

// Resolve o fundo do post a partir das cores de marca do cliente. Sem
// nenhuma cor configurada, mantém o gradiente genérico da Fase 3 (fallback
// — nenhum cliente existente quebra por não ter identidade visual).
export function resolveBackground(
  corPrimaria?: string | null,
  corSecundaria?: string | null
): { background: string; textColor: string } {
  const a = corPrimaria && HEX_RE.test(corPrimaria) ? corPrimaria : null;
  const b = corSecundaria && HEX_RE.test(corSecundaria) ? corSecundaria : null;
  const principal = a ?? b;

  if (!principal) {
    return { background: FALLBACK_BACKGROUND, textColor: FALLBACK_TEXT_COLOR };
  }

  const secundaria = b ?? a ?? principal;
  const background =
    principal === secundaria ? principal : `linear-gradient(135deg, ${principal}, ${secundaria})`;

  return { background, textColor: pickTextColor(principal) };
}

// Variante escura fixa (não depende da cor de marca) pra templates cujo
// visual é deliberadamente sempre escuro (ex.: "constelação"), só usando a
// cor de marca como cor de DESTAQUE, não como fundo. `corDestaque` cai pro
// roxo/magenta padrão do próprio template quando o cliente não configurou
// identidade visual — mesma filosofia de fallback do resolveBackground.
export function resolveAccentColor(
  corPrimaria?: string | null,
  corSecundaria?: string | null,
  fallback = "#a855f7"
): string {
  const a = corPrimaria && HEX_RE.test(corPrimaria) ? corPrimaria : null;
  const b = corSecundaria && HEX_RE.test(corSecundaria) ? corSecundaria : null;
  return a ?? b ?? fallback;
}

export { HEX_RE, FALLBACK_BACKGROUND, FALLBACK_TEXT_COLOR };
