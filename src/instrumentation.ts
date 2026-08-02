// Convenção do Next 15 (mesma regra de src/middleware.ts — precisa estar
// dentro de src/ porque o projeto usa --src-dir, ver Problemas Encontrados
// da Fase 1). register() roda uma vez quando o processo do servidor Next
// sobe. Usado aqui pra agendar o job diário da Fase 8 (ver
// src/lib/cron/daily-job.ts) via node-cron, rodando dentro do próprio
// processo — ver Decisões Tomadas da Fase 8 sobre essa escolha vs. um Route
// Handler disparado por um agendador externo.
declare global {
  var __kirozethCronRegistrado: boolean | undefined;
}

// Todo dia às 8h da manhã (horário do processo Node).
const EXPRESSAO_CRON_DIARIO = "0 8 * * *";

export async function register() {
  // instrumentation.ts também é carregado no runtime edge (ex.: middleware);
  // node-cron só funciona em Node.js real, então só registra no runtime certo.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Proteção contra registro duplicado no mesmo processo — register() é
  // documentado como single-shot por processo, mas alguns cenários de dev
  // (Fast Refresh, múltiplas instâncias) já foram reportados na comunidade
  // Next.js causando reentrância; sem essa guarda, um bug desses agendaria
  // o job 2x, rodando tudo em dobro todo dia às 8h.
  if (globalThis.__kirozethCronRegistrado) return;
  globalThis.__kirozethCronRegistrado = true;

  // eval("require") em vez de um import estático ou dinâmico normal: o
  // compilador webpack que processa instrumentation.ts tenta empacotar
  // qualquer módulo referenciado (mesmo atrás de `await import(...)`
  // condicional), e node-cron usa APIs nativas do Node (node:crypto, path,
  // child_process) que esse bundler não sabe resolver —
  // `serverExternalPackages` não tem efeito aqui (ver next.config.ts).
  // eval("require") esconde a chamada de require() da análise estática do
  // webpack, então o módulo nunca entra no grafo do bundler: é carregado
  // direto pelo Node em runtime, exatamente como um require() comum faria
  // fora de um projeto com bundler.
  const nodeRequire = eval("require") as NodeRequire;
  const cron = nodeRequire("node-cron") as typeof import("node-cron");
  const { runDailyJob } = await import("@/lib/cron/daily-job");

  cron.schedule(EXPRESSAO_CRON_DIARIO, async () => {
    try {
      await runDailyJob();
    } catch (err) {
      console.error("[cron] Falha ao rodar o job diário:", err);
    }
  });

  console.log(
    `[cron] Agendamento diário registrado (expressão "${EXPRESSAO_CRON_DIARIO}", todo dia às 8h).`
  );
}
