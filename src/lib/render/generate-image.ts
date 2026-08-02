import puppeteer from "puppeteer";
import { POST_IMAGE_SIZE } from "@/lib/render/post-template";

// Abre uma página Puppeteer headless, injeta o HTML do template e tira um
// screenshot PNG do viewport 1080x1080. Roda LOCAL nesta fase — `puppeteer`
// (não `puppeteer-core`) baixa o Chromium sozinho, o que é suficiente aqui
// mas não é o setup certo pra deploy serverless (ver Decisões Tomadas).
export async function renderHtmlToPngBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: POST_IMAGE_SIZE, height: POST_IMAGE_SIZE });
    await page.setContent(html, { waitUntil: "load" });
    const screenshot = await page.screenshot({ type: "png" });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}
