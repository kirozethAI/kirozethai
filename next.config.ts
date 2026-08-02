import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Puppeteer usa binários nativos (Chromium) — não deve ser processado pelo
  // bundler do Next, só carregado direto pelo Node em runtime (server-only).
  // node-cron (Fase 8, usado só em src/instrumentation.ts) tem o mesmo
  // problema (APIs nativas do Node: node:crypto, path, child_process), mas
  // `serverExternalPackages` NÃO resolve pra instrumentation.ts — esse
  // arquivo passa por um compilador webpack separado do resto do app, que
  // não respeita essa opção (ver Problemas Encontrados da Fase 8). A
  // correção pro node-cron ficou em instrumentation.ts (eval("require")),
  // não aqui.
  serverExternalPackages: ["puppeteer"],
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
