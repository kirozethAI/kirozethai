import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SyncHolidaysButton } from "@/components/sync-holidays-button";
import { HolidaysBanner } from "@/components/holidays-banner";
import { checkHolidaysUpToDate } from "@/lib/calendar/holidays-check";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, nome, empresa, segmento, created_at")
    .order("created_at", { ascending: false });

  const holidaysCheck = await checkHolidaysUpToDate(supabase);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Novo cliente
        </Link>
      </div>

      <HolidaysBanner check={holidaysCheck} />

      <div className="mb-6 flex items-center gap-4">
        <SyncHolidaysButton />
        <Link href="/configuracoes/design" className="text-sm underline underline-offset-2">
          Configuração de design (global)
        </Link>
        <Link href="/juridico" className="text-sm underline underline-offset-2">
          Jurídico
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          Não foi possível carregar os clientes: {error.message}
        </p>
      )}

      {clients && clients.length === 0 && (
        <p className="text-sm text-black/60 dark:text-white/60">
          Nenhum cliente cadastrado ainda.
        </p>
      )}

      <ul className="space-y-2">
        {clients?.map((client) => (
          <li key={client.id}>
            <Link
              href={`/clientes/${client.id}`}
              className="block rounded border border-black/10 p-4 hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.04]"
            >
              <p className="font-medium">{client.nome}</p>
              <p className="text-sm text-black/60 dark:text-white/60">
                {[client.empresa, client.segmento].filter(Boolean).join(" · ") || "—"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
