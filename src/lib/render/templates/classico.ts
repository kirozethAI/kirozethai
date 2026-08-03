import { formatarDataPtBr } from "@/lib/calendar/format";
import type { TemplateParams } from "@/lib/render/templates/types";
import {
  POST_IMAGE_SIZE,
  escapeHtml,
  escapeAttr,
  pickFontSize,
  resolveBackground,
} from "@/lib/render/templates/shared";

// Template "clássico" (Fase 3, extraído pro registro na Fase 10):
// gradiente entre cor primária/secundária do cliente (ou fallback escuro
// genérico), texto centralizado, logo circular + marca/data no rodapé.
// Comportamento idêntico ao antigo renderPostTemplate — só o arquivo mudou
// de lugar, nenhuma mudança visual.
export function renderClassico({
  texto,
  nomeMarca,
  dataEvento,
  corPrimaria,
  corSecundaria,
  logoUrl,
}: TemplateParams): string {
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
    padding: 72px 88px 180px;
    text-align: center;
  }
  .texto {
    color: ${textColor};
    font-size: ${fontSize}px;
    line-height: 1.35;
    font-weight: 600;
    max-width: 900px;
    max-height: 760px;
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
