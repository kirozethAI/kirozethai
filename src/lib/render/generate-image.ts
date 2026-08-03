import { POST_IMAGE_SIZE } from "@/lib/render/templates/shared";
import { abrirBrowser } from "@/lib/render/browser";

// Abre uma página Puppeteer headless, injeta o HTML do template e tira um
// screenshot PNG do viewport recebido (default 1080x1080, o post quadrado
// original — Fase 3). `width`/`height` opcionais (Fase 12) permitem
// reaproveitar o mesmo motor de render pro formato Story (1080x1920, ver
// generate-story-image.ts) sem duplicar essa função nem mudar o
// comportamento de nenhum chamador existente (todos continuam usando o
// default). `abrirBrowser` foi extraído pra src/lib/render/browser.ts na
// Fase 15, pra ser reaproveitado também pela geração de PDF de documentos
// (ver src/lib/documents/generate-pdf.ts) — nenhuma mudança de
// comportamento aqui, só o import.
export async function renderHtmlToPngBuffer(
  html: string,
  width: number = POST_IMAGE_SIZE,
  height: number = POST_IMAGE_SIZE
): Promise<Buffer> {
  const browser = await abrirBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: "load" });
    const screenshot = await page.screenshot({ type: "png" });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}
