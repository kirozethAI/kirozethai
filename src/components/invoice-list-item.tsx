"use client";

import { useState, useTransition } from "react";
import { markInvoicePaidAction } from "@/app/billing-actions";
import { createAsaasPaymentAction } from "@/app/asaas-actions";
import type { AsaasBillingType } from "@/lib/asaas/client";

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

export type InvoiceListItemData = {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  asaas_payment_id: string | null;
  link_pagamento: string | null;
  boleto_url: string | null;
};

// 1 fatura na lista, com as 2 ações independentes que ela pode ter (Fase
// 16 + 17): marcar como paga manualmente (sempre disponível, controle
// interno), e gerar uma cobrança REAL no Asaas Sandbox (link de
// pagamento/boleto de verdade — uma vez gerada, essa seção vira só
// exibição, não dá pra gerar de novo pra mesma fatura, ver
// createAsaasPaymentForInvoice, que já é idempotente por invoice).
export function InvoiceListItem({
  clientId,
  invoice,
}: {
  clientId: string;
  invoice: InvoiceListItemData;
}) {
  const [pagando, setPagando] = useState(false);
  const [erroPagar, setErroPagar] = useState("");
  const [, startPagarTransition] = useTransition();

  const [billingType, setBillingType] = useState<AsaasBillingType>("PIX");
  const [erroAsaas, setErroAsaas] = useState("");
  const [linkPagamento, setLinkPagamento] = useState(invoice.link_pagamento);
  const [boletoUrl, setBoletoUrl] = useState(invoice.boleto_url);
  const [temCobrancaReal, setTemCobrancaReal] = useState(Boolean(invoice.asaas_payment_id));
  const [pendingAsaas, startAsaasTransition] = useTransition();

  function marcarPago() {
    setErroPagar("");
    setPagando(true);
    startPagarTransition(async () => {
      try {
        await markInvoicePaidAction({ invoiceId: invoice.id, clientId });
      } catch (err) {
        setErroPagar(err instanceof Error ? err.message : "Erro ao marcar como pago.");
      } finally {
        setPagando(false);
      }
    });
  }

  function gerarCobrancaReal() {
    setErroAsaas("");
    startAsaasTransition(async () => {
      try {
        const resultado = await createAsaasPaymentAction({
          invoiceId: invoice.id,
          clientId,
          billingType,
        });
        setLinkPagamento(resultado.linkPagamento);
        setBoletoUrl(resultado.boletoUrl);
        setTemCobrancaReal(true);
      } catch (err) {
        setErroAsaas(err instanceof Error ? err.message : "Erro ao gerar cobrança real.");
      }
    });
  }

  return (
    <li className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p>{invoice.descricao}</p>
          <p className="text-xs text-black/50 dark:text-white/50">
            {formatarMoeda(invoice.valor)} · vence {formatarDataCurta(invoice.data_vencimento)} ·{" "}
            {STATUS_LABEL[invoice.status]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={`/api/invoices/${invoice.id}/pdf`} className="text-xs underline underline-offset-2">
            PDF
          </a>
          {(invoice.status === "pendente" || invoice.status === "atrasado") && (
            <button
              onClick={marcarPago}
              disabled={pagando}
              className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
            >
              {pagando ? "..." : "Marcar pago"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 border-t border-black/10 pt-2 dark:border-white/10">
        {temCobrancaReal ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
              AMBIENTE DE TESTE (Sandbox)
            </span>
            {linkPagamento && (
              <a
                href={linkPagamento}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Link de pagamento
              </a>
            )}
            {boletoUrl && (
              <a
                href={boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Boleto
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={billingType}
              onChange={(e) => setBillingType(e.target.value as AsaasBillingType)}
              className="rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
            >
              <option value="PIX">Pix</option>
              <option value="BOLETO">Boleto</option>
              <option value="UNDEFINED">Cliente escolhe</option>
            </select>
            <button
              onClick={gerarCobrancaReal}
              disabled={pendingAsaas}
              className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
            >
              {pendingAsaas ? "Gerando..." : "Gerar cobrança real (Sandbox)"}
            </button>
          </div>
        )}
        {erroAsaas && <p className="mt-1 text-xs text-red-600">{erroAsaas}</p>}
      </div>

      {erroPagar && <p className="mt-1 text-xs text-red-600">{erroPagar}</p>}
    </li>
  );
}
