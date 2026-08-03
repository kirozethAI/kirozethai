import type { DesignConfig } from "@/lib/render/templates/shared";

// Tipo comum que todo template de imagem recebe (Fase 10) — garante que
// qualquer template do registro (src/lib/render/templates/index.ts) é
// intercambiável: generate-post-image.ts monta um TemplateParams uma vez e
// passa pro template escolhido aleatoriamente, sem precisar saber qual é.
export type TemplateParams = {
  texto: string;
  nomeMarca: string;
  dataEvento: string; // YYYY-MM-DD
  corPrimaria?: string | null;
  corSecundaria?: string | null;
  logoUrl?: string | null;
  // Configuração de design (Fase 14) — se omitido, cada helper de shared.ts
  // usa DEFAULT_DESIGN_CONFIG (os valores validados na Fase 13). Quem gera a
  // imagem de verdade (generate-post-image.ts etc.) busca a config real via
  // getDesignConfig() e passa aqui; a prévia ao vivo de visual-dna-form.tsx
  // continua usando o default (ver Decisões Tomadas da Fase 14).
  designConfig?: DesignConfig;
};

// Todo template recebe TemplateParams e devolve o HTML completo (documento
// autocontido, sem recursos externos — mesma técnica da Fase 3) pronto pra
// virar screenshot via Puppeteer.
export type TemplateRenderFn = (params: TemplateParams) => string;

export type TemplateDefinition = {
  id: string;
  nome: string;
  render: TemplateRenderFn;
};
