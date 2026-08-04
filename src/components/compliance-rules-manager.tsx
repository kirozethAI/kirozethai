"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createComplianceRuleAction,
  toggleComplianceRuleAction,
} from "@/app/compliance-actions";

type RegraInfo = {
  id: string;
  nicho: "saude" | "direito";
  regra: string;
  gravidade: "alta" | "media" | "baixa";
  fonte: string;
  ativo: boolean;
};

const NICHO_LABEL: Record<RegraInfo["nicho"], string> = {
  saude: "Saúde",
  direito: "Direito",
};

const GRAVIDADE_LABEL: Record<RegraInfo["gravidade"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Gestão das regras de compliance (Fase 20, Etapa 5) — lista por nicho
// com ativar/desativar por regra e formulário de regra nova. Pensada pra
// ser mantida pelo usuário (ou um advogado) sem precisar de código.
export function ComplianceRulesManager({ regras }: { regras: RegraInfo[] }) {
  const [erro, setErro] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function alternar(regra: RegraInfo) {
    setErro("");
    setPendingId(regra.id);
    startTransition(async () => {
      try {
        await toggleComplianceRuleAction({ id: regra.id, ativo: !regra.ativo });
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao atualizar regra.");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      {(["saude", "direito"] as const).map((nicho) => (
        <section key={nicho}>
          <h2 className="mb-3 text-sm font-semibold text-black/60 dark:text-white/60">
            {NICHO_LABEL[nicho]}
          </h2>
          <ul className="space-y-2">
            {regras
              .filter((r) => r.nicho === nicho)
              .map((r) => (
                <li
                  key={r.id}
                  className={`rounded border border-black/10 p-3 dark:border-white/10 ${
                    r.ativo ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm">{r.regra}</p>
                      <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                        Gravidade {GRAVIDADE_LABEL[r.gravidade].toLowerCase()} · {r.fonte}
                        {!r.ativo && " · desativada"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => alternar(r)}
                      disabled={pendingId === r.id}
                      className="shrink-0 rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
                    >
                      {pendingId === r.id ? "..." : r.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </li>
              ))}
            {regras.filter((r) => r.nicho === nicho).length === 0 && (
              <p className="text-sm text-black/60 dark:text-white/60">
                Nenhuma regra cadastrada pra este nicho.
              </p>
            )}
          </ul>
        </section>
      ))}

      <NewRuleForm />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}

function NewRuleForm() {
  const [nicho, setNicho] = useState("saude");
  const [regra, setRegra] = useState("");
  const [gravidade, setGravidade] = useState("media");
  const [fonte, setFonte] = useState("");
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  function criar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);
    startTransition(async () => {
      try {
        await createComplianceRuleAction({ nicho, regra, gravidade, fonte });
        setRegra("");
        setFonte("");
        setSalvo(true);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao criar regra.");
      }
    });
  }

  return (
    <form
      onSubmit={criar}
      className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10"
    >
      <p className="text-sm font-medium">Adicionar regra nova</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="nichoRegra">
            Nicho
          </label>
          <select
            id="nichoRegra"
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          >
            <option value="saude">Saúde</option>
            <option value="direito">Direito</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="gravidadeRegra">
            Gravidade
          </label>
          <select
            id="gravidadeRegra"
            value={gravidade}
            onChange={(e) => setGravidade(e.target.value)}
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          >
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="textoRegra">
          Regra (linguagem simples)
        </label>
        <input
          id="textoRegra"
          type="text"
          value={regra}
          onChange={(e) => setRegra(e.target.value)}
          required
          placeholder='Ex.: "Não prometer resultado ou cura garantida"'
          className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="fonteRegra">
          Fonte (referência genérica, opcional)
        </label>
        <input
          id="fonteRegra"
          type="text"
          value={fonte}
          onChange={(e) => setFonte(e.target.value)}
          placeholder='Ex.: "Código de Ética Médica"'
          className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
      >
        {pending ? "Salvando..." : "Adicionar regra"}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {salvo && !erro && <p className="text-sm text-green-600">Regra adicionada.</p>}
    </form>
  );
}
