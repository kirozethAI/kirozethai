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

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Faixa de tamanho de fonte: até `maxChars` caracteres, usa `size`px.
// `maxChars: null` é a faixa "catch-all" (qualquer texto acima da faixa
// anterior) — toda config precisa terminar com uma entrada dessas.
export type FontSizeBreakpoint = { maxChars: number | null; size: number };

// Configuração de design externalizável (Fase 14) — os valores aqui eram
// hardcoded em pickFontSize/resolveBackground/resolveAccentColor até a
// Fase 13. Agora vêm de design_config (banco), com ESTE objeto servindo de
// fallback hardcoded seguro: se a busca no banco falhar por qualquer motivo
// (ver src/lib/render/design-config.ts), a geração de imagem usa
// exatamente os valores validados na Fase 13, nunca quebra por falta de
// configuração.
export type DesignConfig = {
  fontSizeScale: FontSizeBreakpoint[];
  gradienteAngulo: number;
  gradienteBrilhoOpacidade: number; // 0-100
  gradienteVinhetaOpacidade: number; // 0-100
  fundoFallbackCor1: string;
  fundoFallbackCor2: string;
  textoCorFallback: string;
  textoCorLimiarLuminancia: number; // 0-255
  acentoFallbackConstelacao: string;
  acentoFallbackEstatistica: string;
};

// Valores exatos validados na Fase 13 (diagnóstico visual + skills de
// design) — ver PROGRESS.md. Não mude estes números pra "testar uma ideia
// nova": é o fallback de segurança, mudanças de verdade acontecem via a
// tela de configuração (Fase 14) escrevendo em design_config.
export const DEFAULT_DESIGN_CONFIG: DesignConfig = {
  fontSizeScale: [
    { maxChars: 80, size: 70 },
    { maxChars: 150, size: 58 },
    { maxChars: 250, size: 46 },
    { maxChars: 400, size: 36 },
    { maxChars: null, size: 28 },
  ],
  gradienteAngulo: 150,
  gradienteBrilhoOpacidade: 40,
  gradienteVinhetaOpacidade: 33,
  fundoFallbackCor1: "#1f2937",
  fundoFallbackCor2: "#111827",
  textoCorFallback: "#ffffff",
  textoCorLimiarLuminancia: 150,
  acentoFallbackConstelacao: "#a855f7",
  acentoFallbackEstatistica: "#22d3ee",
};

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

// Converte uma opacidade 0-100 num sufixo hex de 2 dígitos (00-ff) pra
// anexar num hex de cor (`${cor}${opacidadeParaHexAlpha(40)}`). Usado pelas
// camadas de brilho/vinheta de resolveBackground — mantém os valores de
// design_config em uma unidade (%) mais fácil de editar numa tela simples
// do que hex bruto.
function opacidadeParaHexAlpha(pct: number): string {
  const clamped = Math.min(100, Math.max(0, pct));
  const valor = Math.round((clamped / 100) * 255);
  return valor.toString(16).padStart(2, "0");
}

// Escolhe um tamanho de fonte menor pra textos mais longos, pra reduzir o
// risco de o texto estourar o canvas de 1080x1080 (aproximação simples, não
// é fitting pixel-perfect — ver Decisões Tomadas / Problemas Encontrados da
// Fase 3). Reaproveitado por todos os templates que centralizam texto
// grande; um template pode ajustar as faixas se seu layout precisar de
// menos espaço (ex.: cartão com padding maior).
//
// Faixas vêm de `config.fontSizeScale` (Fase 14 — antes eram valores fixos
// no código, recalibrados na Fase 13: 64/52/42/34/28 → 70/58/46/36/28).
// Percorre as faixas em ordem crescente de `maxChars`; a última com
// `maxChars: null` cobre qualquer texto acima da faixa anterior. Se
// `config.fontSizeScale` vier malformado (ex.: sem entrada catch-all), cai
// pro tamanho da ÚLTIMA entrada como rede de segurança final.
export function pickFontSize(texto: string, config: DesignConfig = DEFAULT_DESIGN_CONFIG): number {
  const tamanho = texto.length;
  const faixas = config.fontSizeScale.length > 0 ? config.fontSizeScale : DEFAULT_DESIGN_CONFIG.fontSizeScale;

  for (const faixa of faixas) {
    if (faixa.maxChars === null || tamanho <= faixa.maxChars) {
      return faixa.size;
    }
  }
  return faixas[faixas.length - 1].size;
}

// Luminância percebida (fórmula simples, não é o cálculo WCAG completo) —
// só o suficiente pra decidir se o texto deve ser branco ou escuro em cima
// da cor de fundo escolhida pelo cliente, evitando texto ilegível se ele
// escolher uma cor primária clara. Limiar vem de
// `config.textoCorLimiarLuminancia` (Fase 14).
export function pickTextColor(
  hex: string,
  config: DesignConfig = DEFAULT_DESIGN_CONFIG
): string {
  if (!HEX_RE.test(hex)) return config.textoCorFallback;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brilho = (r * 299 + g * 587 + b * 114) / 1000;
  return brilho > config.textoCorLimiarLuminancia ? "#111827" : "#ffffff";
}

// Resolve o fundo do post a partir das cores de marca do cliente. Sem
// nenhuma cor configurada, usa o gradiente de fallback de
// `config.fundoFallbackCor1/2` (Fase 3, valores default preservados na
// Fase 14) — nenhum cliente existente quebra por não ter identidade visual.
//
// Camadas de brilho + vinheta adicionadas na Fase 13, refinadas depois de
// consultar os skills de design instalados (design-taste-frontend,
// "tasteskill" — Seção 4.2, "THE LILA RULE": gradiente roxo/azul de marca
// não é proibido quando é a cor real do cliente, mas precisa ser executado
// "com intenção: paleta harmonizada, neutros equilibrados, gradientes
// comedidos — não graduate-slop genérico"). Um brilho de luz (cor
// principal, translúcida) num canto MAIS uma vinheta escura NEUTRA (preto
// translúcido, sem matiz) no canto oposto — juntos simulam uma fonte de luz
// real (claro de um lado, sombra do outro), o que dá profundidade genuína
// em vez de só empilhar mais cor saturada. Ângulo do gradiente e as 2
// opacidades vêm de `config` desde a Fase 14 (antes eram fixos no código).
// Como resolveBackground é reaproveitado por classico/cartao/story/
// carrossel E pela prévia ao vivo de visual-dna-form.tsx, a melhoria
// aparece em todos os lugares de uma vez só, sem duplicar a lógica em cada
// template.
export function resolveBackground(
  corPrimaria?: string | null,
  corSecundaria?: string | null,
  config: DesignConfig = DEFAULT_DESIGN_CONFIG
): { background: string; textColor: string } {
  const a = corPrimaria && HEX_RE.test(corPrimaria) ? corPrimaria : null;
  const b = corSecundaria && HEX_RE.test(corSecundaria) ? corSecundaria : null;
  const principal = a ?? b;

  if (!principal) {
    const fallbackBackground =
      config.fundoFallbackCor1 === config.fundoFallbackCor2
        ? config.fundoFallbackCor1
        : `linear-gradient(135deg, ${config.fundoFallbackCor1}, ${config.fundoFallbackCor2})`;
    return { background: fallbackBackground, textColor: config.textoCorFallback };
  }

  const secundaria = b ?? a ?? principal;
  const base =
    principal === secundaria
      ? principal
      : `linear-gradient(${config.gradienteAngulo}deg, ${principal}, ${secundaria})`;
  const brilhoAlpha = opacidadeParaHexAlpha(config.gradienteBrilhoOpacidade);
  const vinhetaAlpha = opacidadeParaHexAlpha(config.gradienteVinhetaOpacidade);
  const brilho = `radial-gradient(circle at 22% 18%, ${principal}${brilhoAlpha}, transparent 50%)`;
  const vinheta = `radial-gradient(circle at 82% 88%, #000000${vinhetaAlpha}, transparent 60%)`;
  const background = principal === secundaria ? base : `${brilho}, ${vinheta}, ${base}`;

  return { background, textColor: pickTextColor(principal, config) };
}

// Variante escura fixa (não depende da cor de marca) pra templates cujo
// visual é deliberadamente sempre escuro (ex.: "constelação"), só usando a
// cor de marca como cor de DESTAQUE, não como fundo. `fallback` cai pro
// roxo/magenta ou cyan padrão do próprio template quando o cliente não
// configurou identidade visual (vem de `config.acentoFallbackConstelacao`/
// `acentoFallbackEstatistica` desde a Fase 14) — mesma filosofia de
// fallback do resolveBackground.
export function resolveAccentColor(
  corPrimaria?: string | null,
  corSecundaria?: string | null,
  fallback: string = DEFAULT_DESIGN_CONFIG.acentoFallbackConstelacao
): string {
  const a = corPrimaria && HEX_RE.test(corPrimaria) ? corPrimaria : null;
  const b = corSecundaria && HEX_RE.test(corSecundaria) ? corSecundaria : null;
  return a ?? b ?? fallback;
}

export { HEX_RE };
