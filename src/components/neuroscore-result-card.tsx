export type FatorEntry = { fator: string; avaliacao: string };

export type NeuroScoreResult = {
  notaGeral: number;
  ganchoInicial: string | null;
  gatilhosDesejo: FatorEntry[];
  fatoresRetencao: FatorEntry[];
  fatoresAlgoritmo: FatorEntry[];
  pontosFracos: string[];
  sugestoes: string[];
  probabilidadeConversaoEstimada: string | null;
  tentativaNumero?: number;
  atingiuMinimo?: boolean;
};

function corDaNota(nota: number): string {
  if (nota >= 7) return "text-green-600 dark:text-green-400";
  if (nota >= 5) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function ListaFatores({ titulo, itens }: { titulo: string; itens: FatorEntry[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        {titulo}
      </p>
      <ul className="mt-1 space-y-1">
        {itens.map((item, i) => (
          <li key={i} className="text-xs text-black/70 dark:text-white/70">
            <span className="font-medium">{item.fator}:</span> {item.avaliacao}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Exibição reutilizável de um resultado NeuroScore (Fase 22, Etapa 6) —
// usado tanto na seção "Posts aprovados" (avaliação gerada pelo loop de
// qualidade) quanto na tela /neuroscore (avaliação avulsa de upload/
// landing page). Sempre com o aviso de estimativa visível — nunca só uma
// vez em algum lugar isolado da tela.
export function NeuroScoreResultCard({ resultado }: { resultado: NeuroScoreResult }) {
  return (
    <div className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">NeuroScore</p>
        <p className={`text-2xl font-bold ${corDaNota(resultado.notaGeral)}`}>
          {resultado.notaGeral.toFixed(1)}
          <span className="text-sm font-normal text-black/40 dark:text-white/40">/10</span>
        </p>
      </div>

      {resultado.tentativaNumero !== undefined && (
        <p className="text-xs text-black/50 dark:text-white/50">
          {resultado.tentativaNumero > 1
            ? `Aprovado na tentativa ${resultado.tentativaNumero} do loop de qualidade.`
            : "Aprovado já na 1ª tentativa."}
          {resultado.atingiuMinimo === false &&
            " Não atingiu a nota mínima (7) nas tentativas disponíveis — esta é a melhor versão obtida."}
        </p>
      )}

      {resultado.ganchoInicial && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Gancho inicial
          </p>
          <p className="text-xs text-black/70 dark:text-white/70">{resultado.ganchoInicial}</p>
        </div>
      )}

      <ListaFatores titulo="Gatilhos de desejo" itens={resultado.gatilhosDesejo} />
      <ListaFatores titulo="Fatores de retenção" itens={resultado.fatoresRetencao} />
      <ListaFatores titulo="Fatores de algoritmo" itens={resultado.fatoresAlgoritmo} />

      {resultado.pontosFracos.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Pontos fracos
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {resultado.pontosFracos.map((p, i) => (
              <li key={i} className="text-xs text-black/70 dark:text-white/70">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado.sugestoes.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Sugestões
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {resultado.sugestoes.map((s, i) => (
              <li key={i} className="text-xs text-black/70 dark:text-white/70">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado.probabilidadeConversaoEstimada && (
        <p className="text-xs text-black/60 dark:text-white/60">
          Probabilidade de conversão estimada:{" "}
          <span className="font-medium">{resultado.probabilidadeConversaoEstimada}</span>
        </p>
      )}

      <p className="border-t border-black/10 pt-2 text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        Estimativa gerada por IA — não é medição real de atenção nem dado
        estatístico de nenhuma plataforma. Use como apoio à decisão, não
        como verdade absoluta.
      </p>
    </div>
  );
}
