"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  upsertClientBillingAction,
  createVariableInvoiceAction,
  markInvoicePaidAction,
} from "@/app/billing-actions";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataCurta(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

type BillingConfig = {
  tipo_cobranca: "fixa" | "variavel";
  valor_fixo: number | null;
  dia_vencimento: number | null;
} | null;

type InvoiceItem = {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
};

// Seção "Financeiro" na tela do cliente (Fase 16) — configuração de
// cobrança recorrente + fatura avulsa + histórico de faturas desse
// cliente, com marcar-como-pago manual (sem integração de pagamento real
// — Fase 17) e download de PDF por fatura.
export function ClientBillingSection({
  clientId,
  billingConfig,
  invoices,
}: {
  clientId: string;
  billingConfig: BillingConfig;
  invoices: InvoiceItem[];
}) {
  const [tipoCobranca, setTipoCobranca] = useState<"fixa" | "variavel">(
    billingConfig?.tipo_cobranca ?? "variavel"
  );
  const [valorFixo, setValorFixo] = useState(billingConfig?.valor_fixo?.toString() ?? "");
  const [diaVencimento, setDiaVencimento] = useState(
    billingConfig?.dia_vencimento?.toString() ?? "5"
  );
  const [erroConfig, setErroConfig] = useState("");
  const [configSalva, setConfigSalva] = useState(false);
  const [pendingConfig, startConfigTransition] = useTransition();

  const [descricaoAvulsa, setDescricaoAvulsa] = useState("");
  const [valorAvulso, setValorAvulso] = useState("");
  const [vencimentoAvulso, setVencimentoAvulso] = useState("");
  const [erroAvulsa, setErroAvulsa] = useState("");
  const [pendingAvulsa, startAvulsaTransition] = useTransition();

  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [erroPagar, setErroPagar] = useState("");
  const [, startPagarTransition] = useTransition();

  function salvarConfig(e: FormEvent) {
    e.preventDefault();
    setErroConfig("");
    setConfigSalva(false);
    startConfigTransition(async () => {
      try {
        await upsertClientBillingAction({
          clientId,
          tipoCobranca,
          valorFixo: tipoCobranca === "fixa" ? Number(valorFixo) : null,
          diaVencimento: tipoCobranca === "fixa" ? Number(diaVencimento) : null,
        });
        setConfigSalva(true);
      } catch (err) {
        setErroConfig(err instanceof Error ? err.message : "Erro ao salvar cobrança.");
      }
    });
  }

  function criarAvulsa(e: FormEvent) {
    e.preventDefault();
    setErroAvulsa("");
    startAvulsaTransition(async () => {
      try {
        await createVariableInvoiceAction({
          clientId,
          descricao: descricaoAvulsa,
          valor: Number(valorAvulso),
          dataVencimento: vencimentoAvulso,
        });
        setDescricaoAvulsa("");
        setValorAvulso("");
        setVencimentoAvulso("");
      } catch (err) {
        setErroAvulsa(err instanceof Error ? err.message : "Erro ao criar fatura.");
      }
    });
  }

  function marcarPago(invoiceId: string) {
    setErroPagar("");
    setPagandoId(invoiceId);
    startPagarTransition(async () => {
      try {
        await markInvoicePaidAction({ invoiceId, clientId });
      } catch (err) {
        setErroPagar(err instanceof Error ? err.message : "Erro ao marcar como pago.");
      } finally {
        setPagandoId(null);
      }
    });
  }

  return (
    <div className="mb-6 space-y-4">
      <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Financeiro</h2>

      {/* Configuração de cobrança recorrente */}
      <form
        onSubmit={salvarConfig}
        className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10"
      >
        <p className="text-sm font-medium">Tipo de cobrança</p>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="tipoCobranca"
              checked={tipoCobranca === "variavel"}
              onChange={() => setTipoCobranca("variavel")}
            />
            Variável (por fatura avulsa)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="tipoCobranca"
              checked={tipoCobranca === "fixa"}
              onChange={() => setTipoCobranca("fixa")}
            />
            Mensalidade fixa
          </label>
        </div>

        {tipoCobranca === "fixa" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="valorFixo">
                Valor mensal
              </label>
              <input
                id="valorFixo"
                type="number"
                min="0"
                step="0.01"
                value={valorFixo}
                onChange={(e) => setValorFixo(e.target.value)}
                placeholder="2500.00"
                className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="diaVencimento">
                Dia do vencimento
              </label>
              <input
                id="diaVencimento"
                type="number"
                min="1"
                max="31"
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
                className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pendingConfig}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {pendingConfig ? "Salvando..." : "Salvar cobrança"}
        </button>
        {erroConfig && <p className="text-sm text-red-600">{erroConfig}</p>}
        {configSalva && !erroConfig && (
          <p className="text-sm text-green-600">
            Cobrança salva.{" "}
            {tipoCobranca === "fixa" &&
              "A fatura do mês é gerada automaticamente (ou use \"Gerar faturas do mês\" em /financeiro pra testar agora)."}
          </p>
        )}
      </form>

      {/* Fatura avulsa (valor variável) */}
      <form
        onSubmit={criarAvulsa}
        className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10"
      >
        <p className="text-sm font-medium">Nova fatura avulsa</p>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="descricaoAvulsa">
            Descrição
          </label>
          <input
            id="descricaoAvulsa"
            value={descricaoAvulsa}
            onChange={(e) => setDescricaoAvulsa(e.target.value)}
            placeholder="Criativos extras — agosto"
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="valorAvulso">
              Valor
            </label>
            <input
              id="valorAvulso"
              type="number"
              min="0"
              step="0.01"
              value={valorAvulso}
              onChange={(e) => setValorAvulso(e.target.value)}
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="vencimentoAvulso">
              Vencimento
            </label>
            <input
              id="vencimentoAvulso"
              type="date"
              value={vencimentoAvulso}
              onChange={(e) => setVencimentoAvulso(e.target.value)}
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={pendingAvulsa}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {pendingAvulsa ? "Criando..." : "Criar fatura"}
        </button>
        {erroAvulsa && <p className="text-sm text-red-600">{erroAvulsa}</p>}
      </form>

      {/* Histórico de faturas */}
      {invoices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Faturas
          </p>
          {erroPagar && <p className="text-sm text-red-600">{erroPagar}</p>}
          <ul className="space-y-1">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              >
                <div>
                  <p>{inv.descricao}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {formatarMoeda(inv.valor)} · vence {formatarDataCurta(inv.data_vencimento)} ·{" "}
                    {STATUS_LABEL[inv.status]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/api/invoices/${inv.id}/pdf`}
                    className="text-xs underline underline-offset-2"
                  >
                    PDF
                  </a>
                  {(inv.status === "pendente" || inv.status === "atrasado") && (
                    <button
                      onClick={() => marcarPago(inv.id)}
                      disabled={pagandoId === inv.id}
                      className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
                    >
                      {pagandoId === inv.id ? "..." : "Marcar pago"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
