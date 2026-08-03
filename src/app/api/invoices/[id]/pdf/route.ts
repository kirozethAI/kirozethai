import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderInvoiceHtml } from "@/lib/billing/invoice-template";
import { renderHtmlToPdfBuffer } from "@/lib/documents/generate-pdf";

// Reaproveita a infraestrutura de PDF da Fase 15 (mesmo motor Puppeteer,
// mesmo CSS de documento A4) — só o conteúdo HTML muda (fatura em vez de
// contrato/termos). Protegida pelo middleware de autenticação padrão.
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, client_id, descricao, valor, data_vencimento, status, data_pagamento")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("nome, empresa")
    .eq("id", invoice.client_id)
    .single();

  const html = renderInvoiceHtml({
    numeroFatura: invoice.id.slice(0, 8).toUpperCase(),
    nomeCliente: client?.empresa ?? client?.nome ?? "Cliente",
    descricao: invoice.descricao,
    valor: invoice.valor,
    dataVencimento: invoice.data_vencimento,
    status: invoice.status,
    dataPagamento: invoice.data_pagamento,
  });

  const pdf = await renderHtmlToPdfBuffer(html);
  const nomeArquivo = `fatura-${invoice.id.slice(0, 8)}`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}.pdf"`,
    },
  });
}
