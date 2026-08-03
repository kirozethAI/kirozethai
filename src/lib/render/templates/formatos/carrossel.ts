import { formatarDataPtBr } from "@/lib/calendar/format";
import type { TemplateParams } from "@/lib/render/templates/types";
import {
  POST_IMAGE_SIZE,
  escapeHtml,
  escapeAttr,
  pickFontSize,
  resolveBackground,
} from "@/lib/render/templates/shared";

export type CarrosselSlideParams = TemplateParams & {
  indiceSlide: number; // 1-based
  totalSlides: number;
};

// Template de slide de Carrossel (Fase 12): mesma base visual e mesmo
// viewport (1080x1080) do template "clássico" — resolveBackground respeita a
// cor de marca do cliente, mesmo fallback genérico. Cada slide é renderizado
// e enviado ao Puppeteer separadamente (ver generate-carousel.ts): não existe
// "1 template pro carrossel inteiro", só numeração ("N/total") no canto pra
// diferenciar. O texto de cada slide (incluindo a chamada pra ação do
// último) já vem pronto da Groq (ver groq/carousel-suggestion.ts) — este
// template só posiciona e estiliza, sem nenhuma lógica de narrativa.
export function renderCarrosselSlide({
  texto,
  nomeMarca,
  dataEvento,
  corPrimaria,
  corSecundaria,
  logoUrl,
  indiceSlide,
  totalSlides,
}: CarrosselSlideParams): string {
  const fontSize = pickFontSize(texto);
  const { background, textColor } = resolveBackground(corPrimaria, corSecundaria);
  const textoSecundarioColor = textColor === "#ffffff" ? "#ffffffb3" : "#111827b3";
  const badgeBackground = textColor === "#ffffff" ? "#ffffff26" : "#00000014";

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
  .badge {
    position: absolute;
    top: 56px;
    right: 56px;
    padding: 8px 22px;
    border-radius: 999px;
    background: ${badgeBackground};
    color: ${textColor};
    font-size: 26px;
    font-weight: 700;
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
  <div class="badge">${indiceSlide}/${totalSlides}</div>
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
