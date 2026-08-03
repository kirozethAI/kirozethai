import { formatarDataPtBr } from "@/lib/calendar/format";
import type { TemplateParams } from "@/lib/render/templates/types";
import {
  POST_IMAGE_SIZE,
  escapeHtml,
  escapeAttr,
  pickFontSize,
  resolveBackground,
  DEFAULT_DESIGN_CONFIG,
} from "@/lib/render/templates/shared";

// Template "cartão" (Fase 10): estilo citação — painel com aspas decorativas
// gigantes, texto em itálico, sobre o fundo de marca do cliente (mesma
// resolveBackground do clássico, então respeita corPrimaria/corSecundaria
// do mesmo jeito). O painel é uma camada translúcida que se adapta
// automaticamente ao fundo: clara se o fundo for escuro (textColor branco),
// escura se o fundo for claro (textColor escuro) — funciona com qualquer
// combinação de cor de marca sem precisar calcular contraste de novo.
export function renderCartao({
  texto,
  nomeMarca,
  dataEvento,
  corPrimaria,
  corSecundaria,
  logoUrl,
  designConfig = DEFAULT_DESIGN_CONFIG,
}: TemplateParams): string {
  const fontSize = Math.min(pickFontSize(texto, designConfig), 50);
  const { background, textColor } = resolveBackground(corPrimaria, corSecundaria, designConfig);
  const painelClaro = textColor === "#ffffff";
  const painelBg = painelClaro ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const painelBorda = painelClaro ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
  const aspasColor = painelClaro ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.16)";
  const textoSecundarioColor = painelClaro ? "#ffffffb3" : "#111827b3";

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
  .moldura {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 70px 76px 170px;
  }
  .cartao {
    position: relative;
    width: 100%;
    max-width: 860px;
    background: ${painelBg};
    border: 1px solid ${painelBorda};
    border-radius: 28px;
    padding: 96px 72px;
    text-align: center;
  }
  .aspas {
    position: absolute;
    top: 8px;
    left: 40px;
    font-size: 140px;
    font-weight: 800;
    font-family: Georgia, "Times New Roman", serif;
    color: ${aspasColor};
    line-height: 1;
  }
  .texto {
    position: relative;
    color: ${textColor};
    font-size: ${fontSize}px;
    line-height: 1.45;
    font-weight: 600;
    font-style: italic;
    max-height: 560px;
    overflow: hidden;
  }
  .rodape {
    margin-top: 48px;
    text-align: center;
    color: ${textColor};
  }
  .logo {
    display: block;
    width: 64px;
    height: 64px;
    margin: 0 auto 10px;
    border-radius: 50%;
    object-fit: cover;
    background: #ffffff;
    padding: 5px;
  }
  .marca {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .data {
    margin-top: 6px;
    font-size: 18px;
    color: ${textoSecundarioColor};
  }
</style>
</head>
<body>
  <div class="moldura">
    <div class="cartao">
      <div class="aspas">&ldquo;</div>
      <div class="texto">${escapeHtml(texto)}</div>
      <div class="rodape">
        ${logoBlock}
        <div class="marca">${escapeHtml(nomeMarca)}</div>
        <div class="data">${formatarDataPtBr(dataEvento)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
