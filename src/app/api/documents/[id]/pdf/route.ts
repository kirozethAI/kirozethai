import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderHtmlToPdfBuffer } from "@/lib/documents/generate-pdf";

// Roda Puppeteer (1 render só, não em loop como o carrossel — Fase 12), 60s
// é suficiente com folga mesmo com a desaceleração de serverless (mesmo
// raciocínio da Fase 9). Protegida pelo middleware de autenticação padrão
// (não está na lista de exceções, diferente de api/cron — Fase 9).
export const maxDuration = 60;

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

  const pdf = await renderHtmlToPdfBuffer(documento.conteudo_final);
  const nomeArquivo = documento.titulo.replace(/[^\w\- ]/g, "").trim() || "documento";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}.pdf"`,
    },
  });
}
