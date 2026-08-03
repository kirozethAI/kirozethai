// CSS de documento de texto (A4) — bem diferente do CSS dos templates de
// imagem (Fase 3/10, canvas fixo 1080x1080/1920): aqui é tipografia de
// leitura, folha A4, sem posicionamento absoluto. Reaproveitado tanto pra
// gerar o PDF (Puppeteer, ver generate-pdf.ts) quanto pra prévia no
// navegador (Etapa 6 — mesmo HTML embrulhado, resultado visualmente
// idêntico ao PDF final).
const DOCUMENT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  h1 { font-size: 18pt; margin: 0 0 20pt; text-align: center; }
  h2 { font-size: 13pt; margin: 22pt 0 8pt; }
  p { margin: 0 0 10pt; text-align: justify; }
  hr { border: none; border-top: 1px solid #999; margin: 28pt 0 16pt; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  ul { margin: 0 0 10pt; padding-left: 22pt; }
  li { margin-bottom: 4pt; }
`;

// Embrulha o HTML final (só o conteúdo — h1/h2/p/etc., sem <html>/<body>)
// num documento completo autocontido, pronto pra virar PDF via Puppeteer ou
// ser mostrado numa prévia (iframe/objeto). Mesmo CSS nos dois casos, pra
// prévia e PDF final saírem visualmente iguais.
export function montarDocumentoHtml(conteudoFinal: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>${DOCUMENT_CSS}</style>
</head>
<body>${conteudoFinal}</body>
</html>`;
}
