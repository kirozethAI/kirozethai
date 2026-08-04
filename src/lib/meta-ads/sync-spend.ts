import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { decrypt } from "@/lib/security/encryption";
import { hojeBrasiliaISO } from "@/lib/format/timezone";

const META_API_VERSION = "v21.0";

// Dia anterior a uma data ISO (YYYY-MM-DD), em UTC explícito — mesmo
// cuidado de fuso horário da Fase 10/16 (evita o bug de "dia errado" já
// corrigido em outros módulos). O gasto do Meta Ads pra um dia só fica
// "fechado"/definitivo depois que o dia termina, por isso sincronizamos
// o dia ANTERIOR, não o dia corrente (que ainda está em andamento).
function ontemISO(hojeISO: string): string {
  const [ano, mes, dia] = hojeISO.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

export type ResultadoSincronizacaoMeta = {
  contasProcessadas: number;
  gastosRegistrados: number;
  falhas: number;
};

// Sincroniza o gasto do dia anterior de cada ad_account "conectado" (Meta,
// Fase 18) — chamado pelo cron diário (daily-job.ts) e disponível como
// disparo manual pra teste (ver ad-spend-actions.ts). REGRA CRÍTICA
// (pedida explicitamente no escopo): erro de UMA conta (token expirado,
// API fora, etc.) marca só aquela ad_account como "erro" — nunca lança
// uma exceção que interrompa o loop e derrube a sincronização dos outros
// clientes.
export async function syncMetaAdSpend(
  supabase: SupabaseClient<Database>
): Promise<ResultadoSincronizacaoMeta> {
  const dataAlvo = ontemISO(hojeBrasiliaISO());

  const { data: contas, error } = await supabase
    .from("ad_accounts")
    .select("id, client_id, meta_ad_account_id, access_token")
    .eq("plataforma", "meta")
    .eq("status", "conectado");

  if (error) {
    throw new Error(`Não foi possível carregar as contas de anúncio conectadas: ${error.message}`);
  }

  let gastosRegistrados = 0;
  let falhas = 0;

  for (const conta of contas ?? []) {
    try {
      if (!conta.meta_ad_account_id || !conta.access_token) continue;

      // Dedup por client_id + data, dentro da origem "api" (Etapa 3) — se
      // já sincronizamos esse dia (ex.: o cron rodou 2x, ou foi disparado
      // manualmente depois do automático), não duplica.
      const { data: existente } = await supabase
        .from("ad_spend")
        .select("id")
        .eq("client_id", conta.client_id)
        .eq("data", dataAlvo)
        .eq("origem", "api")
        .maybeSingle();

      if (existente) continue;

      const accessToken = decrypt(conta.access_token);
      const insightsUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/${conta.meta_ad_account_id}/insights`);
      insightsUrl.searchParams.set("fields", "spend");
      insightsUrl.searchParams.set("time_range", JSON.stringify({ since: dataAlvo, until: dataAlvo }));
      insightsUrl.searchParams.set("access_token", accessToken);

      const res = await fetch(insightsUrl.toString());
      const json = await res.json();

      if (!res.ok) {
        const mensagem = (json as { error?: { message?: string } })?.error?.message ?? `Meta respondeu ${res.status}`;
        // Código 190 é o padrão da Graph API pra token expirado/inválido,
        // mas tratamos QUALQUER falha da API do mesmo jeito (marca erro,
        // segue pros outros) — não só esse código específico, pra cobrir
        // também rate limit, conta desativada etc.
        await supabase
          .from("ad_accounts")
          .update({ status: "erro", ultimo_erro: mensagem })
          .eq("id", conta.id);
        throw new Error(mensagem);
      }

      const spend = Number(json.data?.[0]?.spend ?? 0);

      const { error: insertError } = await supabase.from("ad_spend").insert({
        client_id: conta.client_id,
        ad_account_id: conta.id,
        data: dataAlvo,
        valor: spend,
        origem: "api",
      });

      if (insertError) throw new Error(insertError.message);
      gastosRegistrados++;
    } catch (err) {
      console.error(`[meta-ads] Falha ao sincronizar gasto da conta ${conta.id} (cliente ${conta.client_id}):`, err);
      falhas++;
    }
  }

  return { contasProcessadas: contas?.length ?? 0, gastosRegistrados, falhas };
}
