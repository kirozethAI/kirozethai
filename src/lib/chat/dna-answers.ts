import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientDna, Database } from "@/lib/supabase/types";
import { normalize } from "@/lib/calendar/normalize";
import { formatarDataPtBr } from "@/lib/calendar/format";

type Resolver = (client: Client, dna: ClientDna) => string | null;

type CampoConsultavel = {
  chaves: string[];
  rotulo: string;
  resolver: Resolver;
};

function formatarConcorrentes(valor: unknown): string | null {
  if (Array.isArray(valor) && valor.length > 0) {
    const texto = valor.map(String).join(", ").trim();
    return texto.length > 0 ? texto : null;
  }
  return null;
}

function formatarSazonalidade(valor: unknown): string | null {
  if (valor && typeof valor === "object" && "observacao" in valor) {
    const observacao = (valor as { observacao?: unknown }).observacao;
    return typeof observacao === "string" && observacao.trim().length > 0 ? observacao : null;
  }
  return null;
}

// Ordem importa: entradas mais específicas (ex.: "aniversário da empresa")
// vêm antes de genéricas (ex.: "aniversário") que também bateriam nelas.
const CAMPOS_CONSULTAVEIS: CampoConsultavel[] = [
  {
    chaves: [
      "aniversario da empresa",
      "aniversario do negocio",
      "aniversario empresarial",
    ],
    rotulo: "Aniversário da empresa",
    resolver: (client) => (client.aniversario_empresa ? formatarDataPtBr(client.aniversario_empresa) : null),
  },
  {
    chaves: ["aniversario"],
    rotulo: "Aniversário",
    resolver: (client) => (client.aniversario_pessoal ? formatarDataPtBr(client.aniversario_pessoal) : null),
  },
  {
    chaves: ["meta", "metas", "objetivo"],
    rotulo: "Meta",
    resolver: (_client, dna) => dna.metas,
  },
  {
    chaves: ["concorrente", "concorrentes", "concorrencia"],
    rotulo: "Concorrentes",
    resolver: (_client, dna) => formatarConcorrentes(dna.concorrentes),
  },
  {
    chaves: ["publico alvo", "publico-alvo", "audiencia"],
    rotulo: "Público-alvo",
    resolver: (_client, dna) => dna.publico_alvo,
  },
  {
    chaves: ["produto", "produtos", "servico", "servicos"],
    rotulo: "Produtos/serviços",
    resolver: (_client, dna) => dna.produtos,
  },
  {
    chaves: ["tom de voz"],
    rotulo: "Tom de voz",
    resolver: (_client, dna) => dna.tom_de_voz,
  },
  {
    chaves: ["ticket medio"],
    rotulo: "Ticket médio",
    resolver: (_client, dna) => (dna.ticket_medio != null ? `R$ ${dna.ticket_medio}` : null),
  },
  {
    chaves: ["margem"],
    rotulo: "Margem",
    resolver: (_client, dna) => (dna.margem != null ? `${dna.margem}%` : null),
  },
  {
    chaves: ["cidade", "regiao"],
    rotulo: "Cidade/região",
    resolver: (_client, dna) => dna.cidade,
  },
  {
    chaves: ["sazonalidade"],
    rotulo: "Sazonalidade",
    resolver: (_client, dna) => formatarSazonalidade(dna.sazonalidade),
  },
  {
    chaves: ["segmento", "ramo de atuacao"],
    rotulo: "Segmento",
    resolver: (client) => client.segmento,
  },
];

function contemPalavra(textoNormalizado: string, chave: string): boolean {
  const chaveNormalizada = normalize(chave);
  if (chaveNormalizada.includes(" ")) {
    return textoNormalizado.includes(chaveNormalizada);
  }
  const escapado = chaveNormalizada.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapado}\\b`).test(textoNormalizado);
}

// Responde uma pergunta sobre client_dna/clients consultando DIRETO o banco
// (sem Groq) — nunca inventa valor. Retorna null quando não consegue
// identificar com confiança qual campo a pergunta está pedindo; quem chama
// deve tratar isso como 'fora_de_escopo'.
export async function answerDnaQuestion(
  supabase: SupabaseClient<Database>,
  clientId: string,
  pergunta: string
): Promise<string | null> {
  const textoNormalizado = normalize(pergunta);

  const campo = CAMPOS_CONSULTAVEIS.find((c) =>
    c.chaves.some((chave) => contemPalavra(textoNormalizado, chave))
  );
  if (!campo) return null;

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message ?? "cliente não encontrado");
  }

  const { data: dna, error: dnaError } = await supabase
    .from("client_dna")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (dnaError || !dna) {
    throw new Error(dnaError?.message ?? "client_dna não encontrado");
  }

  const valor = campo.resolver(client, dna);

  if (!valor) {
    return `Ainda não tenho "${campo.rotulo}" registrado no seu perfil.`;
  }

  return `${campo.rotulo}: ${valor}`;
}
