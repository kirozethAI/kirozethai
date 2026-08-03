import { formatarDataPtBr } from "@/lib/calendar/format";
import type { TemplateParams } from "@/lib/render/templates/types";
import {
  POST_IMAGE_SIZE,
  escapeHtml,
  escapeAttr,
  pickFontSize,
  resolveAccentColor,
} from "@/lib/render/templates/shared";

// Template "constelação" (Fase 10) — fundo escuro fixo com grade sutil, anéis
// concêntricos e cantos decorativos (direção visual das referências
// anexadas: "AI Marketing OS"). Diferente do clássico, a cor de marca do
// cliente não vira o FUNDO aqui (o visual escuro é a identidade deste
// template) — ela entra como cor de DESTAQUE (tag, linha divisória, anéis),
// com fallback pra um roxo genérico quando o cliente não configurou
// identidade visual. Isso ainda satisfaz "respeitar as cores quando
// disponíveis": a cor do cliente aparece e importa, só que como acento em
// vez de background — ver Decisões Tomadas da Fase 10.
export function renderConstelacao({
  texto,
  nomeMarca,
  dataEvento,
  logoUrl,
}: TemplateParams): string {
  const fontSize = pickFontSize(texto);
  const corDestaque = resolveAccentColor(null, null, "#a855f7");
  const tag = `// ${nomeMarca.toUpperCase()}`;

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
    background:
      radial-gradient(circle at 50% 42%, ${corDestaque}33, transparent 60%),
      #0b0710;
    overflow: hidden;
  }
  .grade {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(${corDestaque}14 1px, transparent 1px),
      linear-gradient(90deg, ${corDestaque}14 1px, transparent 1px);
    background-size: 54px 54px;
  }
  .anel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border: 1px solid ${corDestaque}40;
    border-radius: 50%;
  }
  .anel.a { width: 620px; height: 620px; }
  .anel.b { width: 860px; height: 860px; border-color: ${corDestaque}22; }
  .canto {
    position: absolute;
    width: 46px;
    height: 46px;
    border: 2px solid ${corDestaque}99;
  }
  .canto.tl { top: 56px; left: 56px; border-right: none; border-bottom: none; }
  .canto.tr { top: 56px; right: 56px; border-left: none; border-bottom: none; }
  .canto.bl { bottom: 56px; left: 56px; border-right: none; border-top: none; }
  .canto.br { bottom: 56px; right: 56px; border-left: none; border-top: none; }
  .conteudo {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 90px 104px 190px;
  }
  .tag {
    font-family: "Courier New", monospace;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-size: 22px;
    color: ${corDestaque};
    margin-bottom: 28px;
  }
  .texto {
    color: #f5f3f7;
    font-size: ${fontSize}px;
    line-height: 1.3;
    font-weight: 800;
    max-width: 860px;
    max-height: 660px;
    overflow: hidden;
  }
  .linha {
    width: 90px;
    height: 3px;
    background: ${corDestaque};
    margin-top: 34px;
    border-radius: 2px;
  }
  .rodape {
    position: absolute;
    bottom: 64px;
    left: 0;
    right: 0;
    text-align: center;
    color: #ffffffcc;
    z-index: 1;
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
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffffff;
  }
  .data {
    margin-top: 8px;
    font-size: 20px;
    color: #ffffff80;
  }
</style>
</head>
<body>
  <div class="grade"></div>
  <div class="anel a"></div>
  <div class="anel b"></div>
  <div class="canto tl"></div>
  <div class="canto tr"></div>
  <div class="canto bl"></div>
  <div class="canto br"></div>
  <div class="conteudo">
    <div class="tag">${escapeHtml(tag)}</div>
    <div class="texto">${escapeHtml(texto)}</div>
    <div class="linha"></div>
  </div>
  <div class="rodape">
    ${logoBlock}
    <div class="marca">${escapeHtml(nomeMarca)}</div>
    <div class="data">${formatarDataPtBr(dataEvento)}</div>
  </div>
</body>
</html>`;
}
