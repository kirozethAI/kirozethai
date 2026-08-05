import { abrirBrowser } from "@/lib/render/browser";

// Tira um screenshot de uma URL pública REAL (landing page) — diferente
// de renderHtmlToPngBuffer (Fase 3/12), que injeta HTML próprio via
// page.setContent(); aqui a página é carregada de verdade via page.goto(),
// reaproveitando o MESMO abrirBrowser() (detecção Vercel/local, extraído
// na Fase 15) sem duplicar essa lógica. `validarUrlPublica` (chamado por
// quem invoca esta função) já barrou endereços internos/privados antes de
// chegar aqui.
export async function screenshotUrlToPngBuffer(url: string): Promise<Buffer> {
  const browser = await abrirBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const screenshot = await page.screenshot({ type: "png" });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}
