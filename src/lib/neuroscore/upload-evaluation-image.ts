import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Bucket criado via migration (20260804060000_neuroscore_schema.sql) —
// mesmo padrão de post-images/client-logos (Fase 3/4), separado por ter
// ciclo de vida diferente (avaliação avulsa: upload manual ou screenshot
// de landing page de terceiro, não conteúdo gerado pelo sistema).
export const NEUROSCORE_UPLOADS_BUCKET = "neuroscore-uploads";

export async function uploadEvaluationImage(
  supabase: SupabaseClient<Database>,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(NEUROSCORE_UPLOADS_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`Não foi possível subir a imagem pro Storage: ${error.message}`);
  }
}

export function getPublicEvaluationImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  return `${base}/storage/v1/object/public/${NEUROSCORE_UPLOADS_BUCKET}/${path}`;
}
