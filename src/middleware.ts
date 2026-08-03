import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // api/cron excluído (Fase 9): essa rota é chamada pelo agendador da
    // Vercel (ou manualmente, via curl) sem sessão de usuário — ela tem sua
    // própria proteção via header Authorization + CRON_SECRET (ver
    // src/app/api/cron/daily/route.ts). Sem essa exclusão, o middleware
    // redireciona a chamada pra /login (307) antes de chegar no código da
    // rota, e o cron nunca roda de verdade em produção.
    // api/webhooks excluído (Fase 17), mesmo motivo: o Asaas chama
    // src/app/api/webhooks/asaas/route.ts sem sessão de usuário — a rota
    // tem sua própria proteção via header asaas-access-token comparado a
    // ASAAS_WEBHOOK_TOKEN.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
