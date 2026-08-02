import type { HolidaysCheckResult } from "@/lib/calendar/holidays-check";

// Banner reativo (Server Component) — só aparece quando checkHolidaysUpToDate
// detecta que falta sincronizar o ano atual e/ou o seguinte.
export function HolidaysBanner({ check }: { check: HolidaysCheckResult }) {
  if (check.atualizado) return null;

  const anosFaltando = [
    !check.anoAtualPresente && check.anoAtual,
    !check.anoSeguintePresente && check.anoSeguinte,
  ].filter((ano): ano is number => Boolean(ano));

  return (
    <div className="mb-4 rounded border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
      Feriados de {anosFaltando.join(" e ")} ainda não sincronizados — clique
      em &quot;Sincronizar feriados&quot; abaixo pra atualizar.
    </div>
  );
}
