import { formatarDataPtBr } from "@/lib/calendar/format";
import type { TemplateParams } from "@/lib/render/templates/types";
import {
  POST_IMAGE_SIZE,
  escapeHtml,
  escapeAttr,
  pickFontSize,
  resolveAccentColor,
} from "@/lib/render/templates/shared";

// Extrai o primeiro número (com opcional %, decimais com vírgula ou ponto)
// do texto, se houver, pra virar o destaque grande deste template. Sem
// tentar remover/reescrever o texto original — o texto completo continua
// aparecendo por baixo do número, o número é só um resumo visual.
function extrairNumeroDestaque(texto: string): string | null {
  const match = texto.match(/\d+(?:[.,]\d+)?%?/);
  return match ? match[0] : null;
}

// Tamanho do número gigante varia com o tamanho do próprio número — "3" cabe
// bem maior que "585" ou "37%" no mesmo espaço.
function pickStatFontSize(stat: string): number {
  if (stat.length <= 2) return 220;
  if (stat.length <= 4) return 170;
  return 130;
}

// Template "estatística" (Fase 10): tag pequena no topo, um número em
// destaque gigante quando o texto do post contém algum número (ex.: "585
// clientes", "37%"), com o texto completo do post logo abaixo, menor. Sem
// nenhum número no texto, cai pro layout normal (texto centralizado, sem o
// bloco de número) — mesmo espírito de "sem quebrar" dos outros templates.
export function renderEstatistica({
  texto,
  nomeMarca,
  dataEvento,
  corPrimaria,
  corSecundaria,
  logoUrl,
}: TemplateParams): string {
  const stat = extrairNumeroDestaque(texto);
  const corDestaque = resolveAccentColor(corPrimaria, corSecundaria, "#22d3ee");
  const fontSizeTexto = stat ? Math.min(pickFontSize(texto), 34) : pickFontSize(texto);

  const logoBlock = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="" class="logo" onerror="this.style.display='none'" />`
    : "";

  const blocoDestaque = stat
    ? `<div class="stat" style="font-size:${pickStatFontSize(stat)}px">${escapeHtml(stat)}</div>`
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
    background: radial-gradient(circle at 50% 30%, #10141f, #05070d 70%);
    overflow: hidden;
  }
  .conteudo {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 110px 100px 220px;
  }
  .tag {
    font-family: "Courier New", monospace;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-size: 22px;
    color: ${corDestaque};
    margin-bottom: 8px;
  }
  .stat {
    font-weight: 800;
    line-height: 1;
    background: linear-gradient(135deg, ${corDestaque}, #ffffff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 12px 0 28px;
  }
  .texto {
    color: #e5e7eb;
    font-size: ${fontSizeTexto}px;
    line-height: 1.4;
    font-weight: 600;
    max-width: 820px;
    max-height: 520px;
    overflow: hidden;
  }
  .rodape {
    position: absolute;
    bottom: 64px;
    left: 0;
    right: 0;
    text-align: center;
    color: #ffffffcc;
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
  <div class="conteudo">
    <div class="tag">// ${escapeHtml(nomeMarca.toUpperCase())}</div>
    ${blocoDestaque}
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
