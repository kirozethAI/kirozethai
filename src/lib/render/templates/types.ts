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
