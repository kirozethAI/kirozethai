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
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
