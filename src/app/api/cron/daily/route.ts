import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runDailyJob } from "@/lib/cron/daily-job";

// Duração máxima da function nesta rota (Puppeteer roda mais devagar em
// serverless que localmente — ver Decisões Tomadas da Fase 9). O plano
// Hobby da Vercel já tem 300s como padrão E máximo com fluid compute, mas
// deixamos explícito por clareza.
export const maxDuration = 60;

// Disparada pelo Vercel Cron (ver vercel.json, "0 8 * * *" — todo dia às 8h,
// ±59min de imprecisão no plano Hobby) OU manualmente (curl/Postman) com o
// header correto — substitui o node-cron dentro do processo da Fase 8 (ver
// Decisões Tomadas da Fase 9 sobre a migração). runDailyJob() em si
// (src/lib/cron/daily-job.ts) não foi alterado — só o mecanismo de disparo.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const resultado = await runDailyJob();
    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    console.error("[cron] Falha ao rodar o job diário:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." },
      { status: 500 }
    );
  }
}
