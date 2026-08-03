import { formatarDataPtBr } from "@/lib/calendar/format";
import type { TemplateParams } from "@/lib/render/templates/types";
import {
  STORY_IMAGE_WIDTH,
  STORY_IMAGE_HEIGHT,
  escapeHtml,
  escapeAttr,
  pickFontSize,
  resolveBackground,
} from "@/lib/render/templates/shared";

// Template do formato Story (Fase 12): 1080x1920, vertical — mesma base
// visual do template "clássico" (resolveBackground respeita a cor de marca
// do cliente, mesmo fallback genérico), só que com bem mais espaço vertical
// disponível pro texto e uma tag no topo pra diferenciar visualmente do post
// quadrado (inspirado nas referências "PERGUNTA DO DIA" anexadas — sem
// tentar reproduzir sticker de enquete nativo do Instagram, que é recurso da
// própria plataforma aplicado depois de postar, não algo que dá pra desenhar
// dentro de uma imagem estática gerada via Puppeteer).
export function renderStory({
  texto,
  nomeMarca,
  dataEvento,
  corPrimaria,
  corSecundaria,
  logoUrl,
}: TemplateParams): string {
  // +6px em relação ao post quadrado: pickFontSize é calibrado pro texto
  // caber numa área de ~880x680 (Fase 3/6); o card do Story tem bem mais
  // altura disponível (ver .texto max-height abaixo), então dá pra usar uma
  // fonte um pouco maior sem risco de overflow.
  const fontSize = pickFontSize(texto) + 6;
  const { background, textColor } = resolveBackground(corPrimaria, corSecundaria);
  const textoSecundarioColor = textColor === "#ffffff" ? "#ffffffb3" : "#111827b3";
  const tagBackground = textColor === "#ffffff" ? "#ffffff26" : "#00000014";

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
    width: ${STORY_IMAGE_WIDTH}px;
    height: ${STORY_IMAGE_HEIGHT}px;
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  body {
    position: relative;
    background: ${background};
    overflow: hidden;
  }
  .tag {
    position: absolute;
    top: 120px;
    left: 0;
    right: 0;
    text-align: center;
  }
  .tag span {
    display: inline-block;
    padding: 10px 28px;
    border-radius: 999px;
    background: ${tagBackground};
    color: ${textColor};
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 260px 92px 220px;
    text-align: center;
  }
  .texto {
    color: ${textColor};
    font-size: ${fontSize}px;
    line-height: 1.4;
    font-weight: 600;
    max-width: 900px;
    max-height: 1340px;
    overflow: hidden;
  }
  .rodape {
    position: absolute;
    bottom: 96px;
    left: 0;
    right: 0;
    text-align: center;
    color: ${textColor};
  }
  .logo {
    display: block;
    width: 84px;
    height: 84px;
    margin: 0 auto 14px;
    border-radius: 50%;
    object-fit: cover;
    background: #ffffff;
    padding: 6px;
  }
  .marca {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .data {
    margin-top: 8px;
    font-size: 24px;
    color: ${textoSecundarioColor};
  }
</style>
</head>
<body>
  <div class="tag"><span>// ${escapeHtml(nomeMarca.toUpperCase())}</span></div>
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
