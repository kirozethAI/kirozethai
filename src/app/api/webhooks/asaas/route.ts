import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Eventos que confirmam pagamento — PAYMENT_CONFIRMED (cartão, confirmado
// mas ainda não liquidado) e PAYMENT_RECEIVED (dinheiro já recebido) são
// tratados igual aqui: os dois significam "o cliente pagou", que é tudo
// que o Kirozeth precisa saber nesta fase (sem conciliação financeira
// fina entre "confirmado" e "recebido").
const EVENTOS_PAGO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const EVENTOS_ATRASADO = new Set(["PAYMENT_OVERDUE"]);

// Webhook do Asaas (Fase 17) — recebe eventos de pagamento e atualiza o
// status da invoice correspondente automaticamente (busca por
// asaas_payment_id). Chamado pelos SERVIDORES do Asaas, sem sessão de
// usuário — por isso está excluído do middleware de autenticação padrão
// (ver src/middleware.ts) e tem sua PRÓPRIA autenticação: o Asaas envia de
// volta, em todo webhook, o token exato configurado no painel deles
// (Configurações → Webhooks → "Token de autenticação") no header
// `asaas-access-token`. Sem esse token batendo com ASAAS_WEBHOOK_TOKEN, a
// chamada é rejeitada — nenhum request não autenticado atualiza status de
// fatura.
//
// URL a configurar no painel do Asaas quando a conta existir:
// https://kirozethaii.vercel.app/api/webhooks/asaas
// (Sandbox: painel em https://sandbox.asaas.com — Configurações → Webhooks)
export async function POST(request: Request) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  const tokenRecebido = request.headers.get("asaas-access-token");

  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    console.warn("[asaas-webhook] Token de autenticação ausente ou incorreto — chamada rejeitada.");
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const evento = (body as { event?: string })?.event;
  const paymentId = (body as { payment?: { id?: string } })?.payment?.id;

  if (!evento || !paymentId) {
    // Payload sem o formato esperado — respondemos 200 mesmo assim (não é
    // um erro nosso reprocessável, e o Asaas reenviaria em loop se
    // devolvêssemos erro pra algo que não vamos conseguir tratar de
    // qualquer forma).
    return NextResponse.json({ ok: true, ignorado: "payload sem event/payment.id" });
  }

  const supabase = createAdminClient();

  if (EVENTOS_PAGO.has(evento)) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "pago", data_pagamento: new Date().toISOString() })
      .eq("asaas_payment_id", paymentId);

    if (error) {
      console.error(`[asaas-webhook] Falha ao marcar fatura (payment ${paymentId}) como paga:`, error.message);
    } else {
      console.log(`[asaas-webhook] Fatura do payment ${paymentId} marcada como paga (evento ${evento}).`);
    }
  } else if (EVENTOS_ATRASADO.has(evento)) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "atrasado" })
      .eq("asaas_payment_id", paymentId)
      .eq("status", "pendente");

    if (error) {
      console.error(`[asaas-webhook] Falha ao marcar fatura (payment ${paymentId}) como atrasada:`, error.message);
    }
  }
  // Outros eventos (PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_DELETED
  // etc.) são reconhecidos mas não exigem nenhuma ação nesta fase —
  // ignorados silenciosamente.

  // Sempre 200 — o Asaas reenvia com retry (e eventualmente desativa o
  // webhook) se não receber 200 rapidamente, mesmo pra eventos que não
  // tratamos aqui.
  return NextResponse.json({ ok: true });
}
