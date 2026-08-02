import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Bucket criado via migration (supabase/migrations/20260801020000_render_schema.sql),
// não no painel manualmente. Público pra leitura (a imagem é conteúdo pra
// postar nas redes do cliente, não é sensível); escrita exige auth.uid().
export const POST_IMAGES_BUCKET = "post-images";

export async function uploadPostImage(
  supabase: SupabaseClient<Database>,
  path: string,
  buffer: Buffer
): Promise<void> {
  const { error } = await supabase.storage
    .from(POST_IMAGES_BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: true });

  if (error) {
    throw new Error(`Não foi possível subir a imagem pro Storage: ${error.message}`);
  }
}

// Monta a URL pública a partir do path salvo em content_calendar.imagem_gerada.
// Não guardamos a URL completa no banco pra não depender do domínio do
// projeto Supabase (NEXT_PUBLIC_SUPABASE_URL) ficar sempre o mesmo.
export function getPublicImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  return `${base}/storage/v1/object/public/${POST_IMAGES_BUCKET}/${path}`;
}
