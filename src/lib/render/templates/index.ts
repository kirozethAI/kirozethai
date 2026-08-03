import type { TemplateDefinition } from "@/lib/render/templates/types";
import { renderClassico } from "@/lib/render/templates/classico";
import { renderConstelacao } from "@/lib/render/templates/constelacao";
import { renderEstatistica } from "@/lib/render/templates/estatistica";
import { renderCartao } from "@/lib/render/templates/cartao";

export type { TemplateParams, TemplateDefinition } from "@/lib/render/templates/types";

// Registro de todos os templates de imagem disponíveis (Fase 10). Adicionar
// um template novo é só implementar a função (mesma assinatura de
// TemplateRenderFn) e incluir aqui — pickRandomTemplate() e
// generate-post-image.ts não precisam de nenhuma outra mudança.
export const TEMPLATES: TemplateDefinition[] = [
  { id: "classico", nome: "Clássico", render: renderClassico },
  { id: "constelacao", nome: "Constelação", render: renderConstelacao },
  { id: "estatistica", nome: "Estatística", render: renderEstatistica },
  { id: "cartao", nome: "Cartão", render: renderCartao },
];

// Escolhe um template aleatoriamente a cada chamada — cada geração de imagem
// pode sair com um layout visual diferente, em vez de repetir sempre o
// mesmo (ver Decisões Tomadas da Fase 10 sobre não persistir qual template
// foi usado).
export function pickRandomTemplate(): TemplateDefinition {
  const indice = Math.floor(Math.random() * TEMPLATES.length);
  return TEMPLATES[indice];
}
