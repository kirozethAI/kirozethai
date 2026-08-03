import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `puppeteer-core` e `@sparticuz/chromium` (Fase 9) já vêm na lista padrão
  // de pacotes externos do próprio Next.js 15 (ver
  // server-external-packages.jsonc do Next) — não precisam ser declarados
  // aqui manualmente. `puppeteer` (pacote completo, usado até a Fase 8) foi
  // removido do projeto nesta fase, então essa opção não é mais necessária.

  // O rastreamento automático de arquivos do Next ("output file tracing")
  // não inclui sozinho o binário do Chromium empacotado pelo
  // @sparticuz/chromium (fica em node_modules/@sparticuz/chromium/bin) no
  // bundle de nenhuma function — é um gotcha conhecido e documentado da
  // comunidade Next.js/Vercel com esse pacote específico (ver Problemas
  // Encontrados da Fase 9: erro 500 em produção, "bin directory missing",
  // só descoberto testando geração de imagem de verdade no deploy). `/*`
  // cobre qualquer rota que acabe chamando renderHtmlToPngBuffer (hoje:
  // Server Actions de src/app/clientes/[id]/page.tsx), sem precisar
  // escapar o nome de rotas dinâmicas com colchetes.
  outputFileTracingIncludes: {
    "/*": ["node_modules/@sparticuz/chromium/bin/**/*"],
  },
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
