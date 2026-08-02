// Catálogo fixo de perguntas do motor de perguntas (Fase 1).
//
// Decisão (ver PROGRESS.md): nesta fase as perguntas são fixas em vez de
// geradas pela Claude API. Motivo: a Fase 1 é a fundação do sistema (banco,
// memória, chat) e não deve depender de uma chave de API externa para
// funcionar ponta a ponta. Trocar por geração via IA é direto — basta
// substituir `buildQuestionsForClient` por uma chamada à Claude API — mas
// fica para uma fase futura.

import type { ClientDna } from "@/lib/supabase/types";

export type CampoDna = Exclude<keyof ClientDna, "client_id" | "updated_at">;

export type CatalogEntry = {
  campo: CampoDna;
  pergunta: string;
  contexto: string;
};

export const QUESTIONS_CATALOG: CatalogEntry[] = [
  {
    campo: "publico_alvo",
    pergunta: "Quem é o público-alvo ideal do seu negócio hoje?",
    contexto: "Define pra quem as campanhas e conteúdos devem falar.",
  },
  {
    campo: "produtos",
    pergunta: "Quais são os principais produtos ou serviços que vocês vendem?",
    contexto: "Base para saber o que promover e como posicionar as ofertas.",
  },
  {
    campo: "tom_de_voz",
    pergunta:
      "Como você descreveria o tom de voz da marca? (ex.: formal, descontraído, técnico, divertido)",
    contexto: "Guia a linguagem usada em qualquer texto ou peça criada pra marca.",
  },
  {
    campo: "ticket_medio",
    pergunta: "Qual é o ticket médio das vendas hoje, em reais?",
    contexto: "Ajuda a dimensionar metas e calcular retorno de campanhas.",
  },
  {
    campo: "margem",
    pergunta: "Qual a margem de lucro média sobre esse ticket, em porcentagem?",
    contexto: "Necessário pra calcular o quanto vale a pena investir em aquisição.",
  },
  {
    campo: "cidade",
    pergunta: "Em qual cidade ou região vocês atuam principalmente?",
    contexto: "Define segmentação geográfica de campanhas.",
  },
  {
    campo: "concorrentes",
    pergunta: "Quem são os 2 ou 3 principais concorrentes que você observa?",
    contexto: "Referência pra benchmarking e diferenciação.",
  },
  {
    campo: "metas",
    pergunta: "Qual é a principal meta de negócio pros próximos meses?",
    contexto: "Orienta as prioridades de qualquer ação de marketing.",
  },
  {
    campo: "sazonalidade",
    pergunta:
      "Existe alguma sazonalidade forte no seu negócio? (datas, meses de pico ou de baixa)",
    contexto: "Ajuda a planejar o calendário de campanhas com antecedência.",
  },
];

const JSONB_FIELDS = new Set<CampoDna>(["concorrentes", "sazonalidade"]);

export function isJsonbField(campo: CampoDna): boolean {
  return JSONB_FIELDS.has(campo);
}

export function isFieldEmpty(dna: ClientDna, campo: CampoDna): boolean {
  const valor = dna[campo];

  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim().length === 0;
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === "object") return Object.keys(valor as object).length === 0;

  return false;
}
