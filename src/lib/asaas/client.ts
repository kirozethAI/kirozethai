import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// ⚠️ SEMPRE Sandbox nesta fase (Fase 17) — o default é literalmente a URL
// de Sandbox do Asaas. `ASAAS_API_URL` só existe como variável de ambiente
// pra documentar o caminho de migração pra produção no FUTURO
// (https://api.asaas.com/v3) — não deve ser setada nesta fase do projeto,
// mesmo que uma chave de produção já esteja disponível (regra explícita do
// escopo). Nunca commitar nenhuma chave — `ASAAS_API_KEY` só existe como
// env var (.env.local local, variável de ambiente na Vercel em produção).
const ASAAS_API_URL = process.env.ASAAS_API_URL ?? "https://sandbox.asaas.com/api/v3";

type AsaasErrorBody = { errors?: { code: string; description: string }[] };

// Wrapper genérico pra qualquer chamada à API do Asaas — autenticação via
// header `access_token` (não é Bearer/OAuth, é assim mesmo que a API v3 do
// Asaas funciona). Lança um erro com a mensagem que o Asaas devolveu
// (`errors[].description`) quando a resposta não é 2xx, em vez de um erro
// HTTP genérico — mais útil pra debugar (ex.: "value é obrigatório").
async function asaasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ASAAS_API_KEY não configurada — cadastre a chave Sandbox em .env.local antes de gerar cobranças reais (ver PROGRESS.md, Fase 17)."
    );
  }

  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...options.headers,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    const erro = json as AsaasErrorBody;
    const mensagem = erro.errors?.map((e) => e.description).join("; ") || `Asaas respondeu ${res.status}`;
    throw new Error(`Erro na API do Asaas (Sandbox): ${mensagem}`);
  }

  return json as T;
}

export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string | null;
};

async function createAsaasCustomer(input: { name: string; email?: string }): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Garante que o cliente já tem um customer cadastrado no Asaas — cria 1x
// (POST /customers) e salva o ID em clients.asaas_customer_id; chamadas
// seguintes pro mesmo cliente reaproveitam o ID já salvo, sem recriar. A
// tabela `clients` deste projeto não tem campo de e-mail (Fase 1) — o
// customer é criado só com `name` (empresa, com fallback pro nome da
// pessoa de contato), o que é aceito pela API do Asaas (só `name` é
// obrigatório).
export async function ensureAsaasCustomer(
  supabase: SupabaseClient<Database>,
  client: { id: string; nome: string; empresa: string | null; asaas_customer_id: string | null }
): Promise<string> {
  if (client.asaas_customer_id) {
    return client.asaas_customer_id;
  }

  const customer = await createAsaasCustomer({ name: client.empresa ?? client.nome });

  const { error } = await supabase
    .from("clients")
    .update({ asaas_customer_id: customer.id })
    .eq("id", client.id);

  if (error) {
    throw new Error(`Cliente criado no Asaas (${customer.id}), mas falhou salvar no banco: ${error.message}`);
  }

  return customer.id;
}

export type AsaasBillingType = "BOLETO" | "PIX" | "UNDEFINED";

export type AsaasPayment = {
  id: string;
  status: string;
  invoiceUrl: string;
  bankSlipUrl?: string | null;
  value: number;
  dueDate: string;
  billingType: string;
};

// POST /payments — cria a cobrança de verdade no Asaas (Sandbox). Não
// salva nada no banco (isso é responsabilidade de quem chama, ver
// src/lib/asaas/create-payment.ts) — só fala com a API.
export async function createAsaasPaymentRaw(input: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
}): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
