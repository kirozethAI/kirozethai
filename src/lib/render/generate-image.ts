import puppeteer, { type Browser } from "puppeteer-core";
import { POST_IMAGE_SIZE } from "@/lib/render/templates/shared";

// `process.env.VERCEL` é definida automaticamente pela Vercel em qualquer
// ambiente de build/runtime dela (nunca aparece rodando local) — usada em vez
// de NODE_ENV porque NODE_ENV também vira "production" rodando local via
// `npm run build && npm run start` (pra testar o build de produção antes de
// deployar), e nesse caso ainda precisamos do Chrome local do Windows, não do
// binário Linux do @sparticuz/chromium (que não roda fora de um ambiente
// serverless tipo AWS Lambda/Vercel).
const RODANDO_NA_VERCEL = process.env.VERCEL === "1";

async function abrirBrowser(): Promise<Browser> {
  if (RODANDO_NA_VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Dev local: usa o Google Chrome já instalado na máquina via `channel`
  // (recurso nativo do puppeteer-core desde a v22 — localiza sozinho um
  // Chrome/Chromium do sistema, sem precisar do pacote `puppeteer` completo
  // nem baixar nada à parte). Se não encontrar, o erro do próprio
  // puppeteer-core já orienta a instalar o Google Chrome.
  return puppeteer.launch({ channel: "chrome", headless: true });
}

// Abre uma página Puppeteer headless, injeta o HTML do template e tira um
// screenshot PNG do viewport recebido (default 1080x1080, o post quadrado
// original — Fase 3). `width`/`height` opcionais (Fase 12) permitem
// reaproveitar o mesmo motor de render pro formato Story (1080x1920, ver
// generate-story-image.ts) sem duplicar essa função nem mudar o
// comportamento de nenhum chamador existente (todos continuam usando o
// default). Em produção (Vercel), usa puppeteer-core + o Chromium
// empacotado do @sparticuz/chromium (o Chromium completo que o pacote
// `puppeteer` baixa sozinho não roda em ambiente serverless — ver Decisões
// Tomadas da Fase 3 e da Fase 9).
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
