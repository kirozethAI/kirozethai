import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DesignConfigForm } from "@/components/design-config-form";

// Tela de configuração GLOBAL de design (Fase 14) — diferente da
// identidade visual por cliente (client_dna, Fase 4, editada em
// /clientes/[id]/marca). Os valores aqui valem como base/fallback pra
// TODOS os clientes; mudar algo aqui não precisa de novo deploy — a
// próxima imagem gerada já lê o valor novo (ver
// src/lib/render/design-config.ts).
export default async function DesignConfigPage() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("design_config")
    .select("chave, valor, descricao")
    .order("chave", { ascending: true });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar
      </Link>

      <h1 className="mb-1 text-lg font-semibold">Configuração de design</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        Configuração <strong>global</strong> — vale como base pra todos os
        clientes, diferente da identidade visual (cor/logo) de cada
        cliente, que fica em &quot;Identidade visual&quot; na tela do
        cliente. Salvar aqui já reflete na próxima imagem gerada, sem
        precisar de novo deploy.
      </p>

      {error && (
        <p className="text-sm text-red-600">
          Não foi possível carregar a configuração: {error.message}
        </p>
      )}

      {rows && rows.length > 0 && <DesignConfigForm items={rows} />}
    </main>
  );
}
