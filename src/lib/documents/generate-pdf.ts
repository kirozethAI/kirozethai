import { abrirBrowser } from "@/lib/render/browser";
import { montarDocumentoHtml } from "@/lib/documents/document-layout";

// Renderiza o HTML final de um documento (contrato, termos, política —
// Fase 15) em PDF A4, reaproveitando o mesmo motor Puppeteer da geração de
// imagem (src/lib/render/browser.ts, Fase 3/9) — só troca
// `page.screenshot()` por `page.pdf()`. Margens generosas (2.5cm/2cm),
// adequadas pra um documento de texto corrido, bem diferentes do viewport
// quadrado fixo usado nos posts.
export async function renderHtmlToPdfBuffer(conteudoFinal: string): Promise<Buffer> {
  const browser = await abrirBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(montarDocumentoHtml(conteudoFinal), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "2cm", bottom: "2cm", left: "2.5cm", right: "2.5cm" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
