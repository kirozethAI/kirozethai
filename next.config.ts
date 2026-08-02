import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `puppeteer-core` e `@sparticuz/chromium` (Fase 9) já vêm na lista padrão
  // de pacotes externos do próprio Next.js 15 (ver
  // server-external-packages.jsonc do Next) — não precisam ser declarados
  // aqui manualmente. `puppeteer` (pacote completo, usado até a Fase 8) foi
  // removido do projeto nesta fase, então essa opção não é mais necessária.
  experimental: {
    serverActions: {
      // Padrão do Next é 1MB — updateVisualDnaAction (Fase 4) recebe upload
      // de logo até 2MB (ver LOGO_MAX_BYTES em src/app/visual-actions.ts),
      // então o limite da própria Server Action precisa ser maior que isso
      // (com folga pro overhead do multipart/form-data), senão o Next
      // rejeita a requisição com 413 antes até de chegar no código da action.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
