import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderHtmlToDocxBuffer } from "@/lib/documents/generate-docx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: documento, error } = await supabase
    .from("client_documents")
    .select("titulo, conteudo_final")
    .eq("id", id)
    .single();

  if (error || !documento) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const docxBuffer = await renderHtmlToDocxBuffer(documento.conteudo_final);
  const nomeArquivo = documento.titulo.replace(/[^\w\- ]/g, "").trim() || "documento";

  return new NextResponse(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nomeArquivo}.docx"`,
    },
  });
}
