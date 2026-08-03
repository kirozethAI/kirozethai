import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarDataPtBr } from "@/lib/calendar/format";
import { BillingCronButtons } from "@/components/billing-cron-buttons";

type InvoiceStatus = "pendente" | "pago" | "atrasado" | "cancelado";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const STATUS_VALIDOS = new Set<string>(Object.keys(STATUS_LABEL));

function isInvoiceStatus(valor: string | undefined): valor is InvoiceStatus {
  return valor !== undefined && STATUS_VALIDOS.has(valor);
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Tela do módulo financeiro (Fase 16) — módulo novo e independente, não
// mexe em nenhuma lógica de negócio existente. Lista todas as faturas,
// filtráveis por status via query string, com totais por status.
export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("id, client_id, descricao, valor, data_vencimento, status")
    .order("data_vencimento", { ascending: false });

  if (isInvoiceStatus(status)) {
    query = query.eq("status", status);
  }

  const { data: invoices } = await query;

  const { data: clients } = await supabase.from("clients").select("id, nome, empresa");
  const nomeClientePorId = new Map((clients ?? []).map((c) => [c.id, c.empresa ?? c.nome]));

  // Totais SEMPRE sobre todas as faturas (não sobre a lista filtrada) —
  // um filtro de status não deveria distorcer o resumo geral.
  const { data: todasInvoices } = await supabase.from("invoices").select("status, valor");
  const totais = { pago: 0, pendente: 0, atrasado: 0 };
  for (const inv of todasInvoices ?? []) {
    if (inv.status === "pago") totais.pago += inv.valor;
    else if (inv.status === "pendente") totais.pendente += inv.valor;
    else if (inv.status === "atrasado") totais.atrasado += inv.valor;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar
      </Link>

      <h1 className="mb-1 text-lg font-semibold">Financeiro</h1>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        Controle de faturamento — sem integração de pagamento real ainda
        (fase futura). Marcar como pago é manual.
      </p>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Recebido</p>
          <p className="text-base font-semibold">{formatarMoeda(totais.pago)}</p>
        </div>
        <div className="rounded border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Pendente</p>
          <p className="text-base font-semibold">{formatarMoeda(totais.pendente)}</p>
        </div>
        <div className="rounded border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Atrasado</p>
          <p className="text-base font-semibold">{formatarMoeda(totais.atrasado)}</p>
        </div>
      </div>

      <BillingCronButtons />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["pendente", "atrasado", "pago", "cancelado"] as const).map((s) => (
          <Link
            key={s}
            href={`/financeiro?status=${s}`}
            className={`rounded border px-3 py-1 text-xs ${
              status === s
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/15 dark:border-white/15"
            }`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
        {status && (
          <Link
            href="/financeiro"
            className="rounded border border-black/15 px-3 py-1 text-xs dark:border-white/15"
          >
            Limpar filtro
          </Link>
        )}
      </div>

      <ul className="space-y-2">
        {(invoices ?? []).map((inv) => (
          <li key={inv.id} className="rounded border border-black/10 p-3 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {nomeClientePorId.get(inv.client_id) ?? "Cliente"}
                </p>
                <p className="text-xs text-black/50 dark:text-white/50">{inv.descricao}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatarMoeda(inv.valor)}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {STATUS_LABEL[inv.status] ?? inv.status} · vence{" "}
                  {formatarDataPtBr(inv.data_vencimento)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex gap-3">
              <a
                href={`/api/invoices/${inv.id}/pdf`}
                className="text-xs underline underline-offset-2"
              >
                Baixar PDF
              </a>
              <Link
                href={`/clientes/${inv.client_id}`}
                className="text-xs underline underline-offset-2"
              >
                Ver cliente
              </Link>
            </div>
          </li>
        ))}
        {(invoices ?? []).length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">Nenhuma fatura encontrada.</p>
        )}
      </ul>
    </main>
  );
}
