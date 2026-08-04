"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createLeadAction } from "@/app/crm-actions";

type EstagioInfo = { id: string; nome: string };

export function NewLeadForm({ estagios }: { estagios: EstagioInfo[] }) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [segmento, setSegmento] = useState("");
  const [origem, setOrigem] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [pipelineStageId, setPipelineStageId] = useState(estagios[0]?.id ?? "");
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function criar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    startTransition(async () => {
      try {
        await createLeadAction({
          nome,
          empresa,
          telefone,
          email,
          segmento,
          origem,
          valorEstimado,
          pipelineStageId,
        });
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao criar lead.");
      }
    });
  }

  return (
    <form onSubmit={criar} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="nomeLead">
          Nome *
        </label>
        <input
          id="nomeLead"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="empresaLead">
          Empresa
        </label>
        <input
          id="empresaLead"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="telefoneLead">
            Telefone
          </label>
          <input
            id="telefoneLead"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="emailLead">
            E-mail
          </label>
          <input
            id="emailLead"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="segmentoLead">
            Segmento
          </label>
          <input
            id="segmentoLead"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="origemLead">
            Origem
          </label>
          <input
            id="origemLead"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            placeholder="Ex.: indicação, site, evento"
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="valorEstimadoLead">
            Valor estimado
          </label>
          <input
            id="valorEstimadoLead"
            type="number"
            min="0"
            step="0.01"
            value={valorEstimado}
            onChange={(e) => setValorEstimado(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="estagioLead">
            Estágio inicial
          </label>
          <select
            id="estagioLead"
            value={pipelineStageId}
            onChange={(e) => setPipelineStageId(e.target.value)}
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          >
            {estagios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Criando..." : "Cadastrar lead"}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </form>
  );
}
