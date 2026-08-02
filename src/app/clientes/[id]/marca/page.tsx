import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VisualDnaForm } from "@/components/visual-dna-form";
import { getPublicLogoUrl } from "@/lib/render/upload-logo";

export default async function MarcaVisualPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nome, empresa")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const { data: dna } = await supabase
    .from("client_dna")
    .select("cor_primaria, cor_secundaria, logo_url")
    .eq("client_id", id)
    .single();

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-6">
      <Link
        href={`/clientes/${id}`}
        className="text-sm text-black/60 underline underline-offset-2 dark:text-white/60"
      >
        ← Voltar
      </Link>

      <h1 className="mb-6 mt-2 text-lg font-semibold">
        Identidade visual — {client.nome}
      </h1>

      <VisualDnaForm
        clientId={client.id}
        nomeMarca={client.empresa ?? client.nome}
        corPrimariaInicial={dna?.cor_primaria ?? null}
        corSecundariaInicial={dna?.cor_secundaria ?? null}
        logoUrlInicial={dna?.logo_url ? getPublicLogoUrl(dna.logo_url) : null}
      />
    </main>
  );
}
