import { escapeHtml } from "@/lib/render/templates/shared";
import { formatarDataPtBr } from "@/lib/calendar/format";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type InvoiceTemplateInput = {
  numeroFatura: string;
  nomeCliente: string;
  descricao: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  status: string;
  dataPagamento: string | null; // ISO timestamp ou null
};

// Template de fatura (Fase 16) — código, não editável via UI como os
// modelos jurídicos da Fase 15 (ver Decisões Tomadas: uma fatura é um
// documento estruturado/computado, não texto livre que faz sentido editar
// campo a campo). Devolve só o HTML de conteúdo (h1/p/hr) — quem chama
// (a rota de PDF) passa pra renderHtmlToPdfBuffer (Fase 15), que já
// embrulha com o mesmo CSS de documento A4 usado pra contratos/termos.
export function renderInvoiceHtml(input: InvoiceTemplateInput): string {
  const dataPagamentoLinha = input.dataPagamento
    ? `<p><strong>Pago em:</strong> ${formatarDataPtBr(input.dataPagamento.slice(0, 10))}</p>`
    : "";

  return `<h1>Fatura</h1>
<p><strong>Número:</strong> ${escapeHtml(input.numeroFatura)}</p>
<p><strong>Cliente:</strong> ${escapeHtml(input.nomeCliente)}</p>
<p><strong>Descrição:</strong> ${escapeHtml(input.descricao)}</p>
<p><strong>Valor:</strong> ${escapeHtml(formatarMoeda(input.valor))}</p>
<p><strong>Vencimento:</strong> ${escapeHtml(formatarDataPtBr(input.dataVencimento))}</p>
<p><strong>Status:</strong> ${escapeHtml(STATUS_LABEL[input.status] ?? input.status)}</p>
${dataPagamentoLinha}
<hr/>
<p>Pagamento: entre em contato para combinar a forma de pagamento (PIX, transferência ou outro método). Nenhuma cobrança automática é feita a partir desta fatura.</p>`;
}
