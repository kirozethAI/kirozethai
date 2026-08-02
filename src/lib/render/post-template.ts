import { formatarDataPtBr } from "@/lib/calendar/format";

export const POST_IMAGE_SIZE = 1080;

const FALLBACK_BACKGROUND = "linear-gradient(135deg, #1f2937, #111827)";
const FALLBACK_TEXT_COLOR = "#ffffff";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type TemplateInput = {
  texto: string;
  nomeMarca: string;
  dataEvento: string; // YYYY-MM-DD
  corPrimaria?: string | null;
  corSecundaria?: string | null;
  logoUrl?: string | null;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Escolhe um tamanho de fonte menor pra textos mais longos, pra reduzir o
// risco de o texto estourar o canvas de 1080x1080 (aproximação simples, não
// é fitting pixel-perfect — ver Decisões Tomadas / Problemas Encontrados).
function pickFontSize(texto: string): number {
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

// Gera o HTML completo (com <style> embutido) de uma imagem de post
// 1080x1080: texto do post centralizado, marca/data no rodapé, logo (se
// houver) acima do nome da marca. Fundo usa a cor de marca do cliente
// quando configurada (client_dna.cor_primaria/cor_secundaria), senão cai
// no gradiente escuro genérico.
export function renderPostTemplate({
  texto,
  nomeMarca,
  dataEvento,
  corPrimaria,
  corSecundaria,
  logoUrl,
}: TemplateInput): string {
  const fontSize = pickFontSize(texto);
  const { background, textColor } = resolveBackground(corPrimaria, corSecundaria);
  const textoSecundarioColor = textColor === "#ffffff" ? "#ffffffb3" : "#111827b3";

  const logoBlock = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="" class="logo" onerror="this.style.display='none'" />`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${POST_IMAGE_SIZE}px;
    height: ${POST_IMAGE_SIZE}px;
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  body {
    position: relative;
    background: ${background};
    overflow: hidden;
  }
  .card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 100px 96px 200px;
    text-align: center;
  }
  .texto {
    color: ${textColor};
    font-size: ${fontSize}px;
    line-height: 1.4;
    font-weight: 600;
    max-width: 880px;
    max-height: 680px;
    overflow: hidden;
  }
  .rodape {
    position: absolute;
    bottom: 64px;
    left: 0;
    right: 0;
    text-align: center;
    color: ${textColor};
  }
  .logo {
    display: block;
    width: 72px;
    height: 72px;
    margin: 0 auto 12px;
    border-radius: 50%;
    object-fit: cover;
    background: #ffffff;
    padding: 6px;
  }
  .marca {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .data {
    margin-top: 8px;
    font-size: 22px;
    color: ${textoSecundarioColor};
  }
</style>
</head>
<body>
  <div class="card">
    <div class="texto">${escapeHtml(texto)}</div>
  </div>
  <div class="rodape">
    ${logoBlock}
    <div class="marca">${escapeHtml(nomeMarca)}</div>
    <div class="data">${formatarDataPtBr(dataEvento)}</div>
  </div>
</body>
</html>`;
}
