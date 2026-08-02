import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Client com a service role key — só pra jobs em background sem sessão de
// usuário (ex.: o cron diário em src/lib/cron/daily-job.ts). Ignora RLS por
// completo. NUNCA usar num caminho que atende requisição de usuário (Server
// Component, Server Action, Route Handler autenticado) — esses continuam
// usando o client cookie-based de src/lib/supabase/server.ts, que respeita
// RLS via auth.uid(). Motivo de precisar de um client separado pro cron: não
// há sessão de usuário/cookies num job agendado (instrumentation.ts roda na
// subida do processo, fora de qualquer requisição HTTP).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas — necessárias pro admin client."
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
