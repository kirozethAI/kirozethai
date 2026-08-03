import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditForm } from "@/components/template-edit-form";

export default async function EditarModeloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("document_templates")
    .select("id, tipo, nome, conteudo_html")
    .eq("id", id)
    .single();

  if (!template) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-6">
      <Link href="/juridico" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar
      </Link>

      <h1 className="mb-1 text-lg font-semibold">Editar modelo</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        Tipo: {template.tipo}. Use <code className="rounded bg-black/5 px-1 dark:bg-white/10">{"{{chave}}"}</code>{" "}
        pra marcar um trecho preenchido automaticamente na geração (ex.:{" "}
        <code className="rounded bg-black/5 px-1 dark:bg-white/10">{"{{nome_cliente}}"}</code>).
      </p>

      <TemplateEditForm template={template} />
    </main>
  );
}
