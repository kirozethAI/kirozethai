"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updateDesignConfigAction } from "@/app/design-config-actions";

type Item = { chave: string; valor: unknown; descricao: string };

type Tipo = "cor" | "numero" | "json";

type Campo = { chave: string; label: string; tipo: Tipo };

// Ordem e agrupamento pensados pra leitura na tela — não precisa bater com
// a ordem das chaves no banco.
const CAMPOS: Campo[] = [
  { chave: "font_size_scale", label: "Escala de fonte (JSON)", tipo: "json" },
  { chave: "gradiente_angulo", label: "Ângulo do gradiente (graus)", tipo: "numero" },
  { chave: "gradiente_brilho_opacidade", label: "Opacidade do brilho (0-100)", tipo: "numero" },
  { chave: "gradiente_vinheta_opacidade", label: "Opacidade da vinheta (0-100)", tipo: "numero" },
  { chave: "fundo_fallback_cor1", label: "Fundo de fallback — cor 1", tipo: "cor" },
  { chave: "fundo_fallback_cor2", label: "Fundo de fallback — cor 2", tipo: "cor" },
  { chave: "texto_cor_fallback", label: "Cor do texto de fallback", tipo: "cor" },
  { chave: "texto_cor_limiar_luminancia", label: "Limiar de luminância (0-255)", tipo: "numero" },
  { chave: "acento_fallback_constelacao", label: "Acento — Constelação (sem marca)", tipo: "cor" },
  { chave: "acento_fallback_estatistica", label: "Acento — Estatística (sem marca)", tipo: "cor" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
    >
      {pending ? "Salvando..." : "Salvar configuração"}
    </button>
  );
}

export function DesignConfigForm({ items }: { items: Item[] }) {
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const porChave = new Map(items.map((item) => [item.chave, item]));

  async function action(formData: FormData) {
    setErro("");
    setSalvo(false);
    try {
      await updateDesignConfigAction(formData);
      setSalvo(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar configuração.");
    }
  }

  return (
    <form action={action} className="space-y-5">
      {CAMPOS.map((campo) => {
        const item = porChave.get(campo.chave);
        if (!item) return null;

        return (
          <div key={campo.chave} className="space-y-1">
            <label className="text-sm font-medium" htmlFor={campo.chave}>
              {campo.label}
            </label>
            <p className="text-xs text-black/50 dark:text-white/50">{item.descricao}</p>

            {campo.tipo === "cor" && (
              <input
                id={campo.chave}
                name={campo.chave}
                type="color"
                defaultValue={String(item.valor)}
                className="h-10 w-full rounded border border-black/15 dark:border-white/15"
              />
            )}

            {campo.tipo === "numero" && (
              <input
                id={campo.chave}
                name={campo.chave}
                type="number"
                step="any"
                defaultValue={String(item.valor)}
                className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              />
            )}

            {campo.tipo === "json" && (
              <textarea
                id={campo.chave}
                name={campo.chave}
                defaultValue={JSON.stringify(item.valor)}
                rows={3}
                spellCheck={false}
                className="w-full rounded border border-black/15 bg-transparent px-3 py-2 font-mono text-xs dark:border-white/15"
              />
            )}
          </div>
        );
      })}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {salvo && !erro && (
        <p className="text-sm text-green-600">
          Configuração salva — a próxima imagem gerada já usa os novos valores.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
