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
//
// Faixas aumentadas na Fase 13 (diagnóstico visual: com os valores originais
// — 64/52/42/34/28 —, o texto ocupava uma fatia pequena do quadro 1080x1080,
// deixando muito espaço vazio acima/abaixo mesmo depois de reduzir o padding
// fixo dos templates). A faixa >400 caracteres foi MANTIDA em 28px de
// propósito — é a única faixa que cobre o caso extremo já validado sem
// overflow na Fase 10 (317-414 caracteres, que caem na faixa ≤400); textos
// muito acima disso (ex.: o post de teste de 1305 caracteres encontrado na
// Fase 12) já estouravam o card mesmo antes desta fase e continuam fora do
// escopo aqui (ver Problemas Encontrados da Fase 12/13).
export function pickFontSize(texto: string): number {
  const tamanho = texto.length;
  if (tamanho <= 80) return 70;
  if (tamanho <= 150) return 58;
  if (tamanho <= 250) return 46;
  if (tamanho <= 400) return 36;
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
//
// Camadas de brilho + vinheta adicionadas na Fase 13, refinadas depois de
// consultar os skills de design instalados (design-taste-frontend,
// "tasteskill" — Seção 4.2, "THE LILA RULE": gradiente roxo/azul de marca
// não é proibido quando é a cor real do cliente, mas precisa ser executado
// "com intenção: paleta harmonizada, neutros equilibrados, gradientes
// comedidos — não graduate-slop genérico"). A 1ª tentativa (só um brilho
// translúcido da própria cor principal) ainda deixava o resultado como
// "mais da mesma cor saturada", sem nenhum neutro real — não atendia
// "neutros equilibrados". Correção: um brilho de luz (cor principal,
// translúcida) num canto MAIS uma vinheta escura NEUTRA (preto translúcido,
// sem matiz) no canto oposto — juntos simulam uma fonte de luz real (claro
// de um lado, sombra do outro), o que dá profundidade genuína em vez de só
// empilhar mais cor saturada. As 2 cores de marca continuam sendo a base
// do degradê (identidade do clássico/story/carrossel preservada) — a
// vinheta só ancora a composição, não substitui nem desatura as cores do
// cliente. Como resolveBackground é reaproveitado por
// classico/cartao/story/carrossel E pela prévia ao vivo de
// visual-dna-form.tsx, a melhoria aparece em todos os lugares de uma vez só,
// sem duplicar a lógica em cada template.
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
  const base =
    principal === secundaria ? principal : `linear-gradient(150deg, ${principal}, ${secundaria})`;
  const brilho = `radial-gradient(circle at 22% 18%, ${principal}66, transparent 50%)`;
  const vinheta = `radial-gradient(circle at 82% 88%, #00000055, transparent 60%)`;
  const background = principal === secundaria ? base : `${brilho}, ${vinheta}, ${base}`;

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
