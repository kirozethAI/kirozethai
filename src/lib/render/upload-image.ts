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
//
// `versao`, se passado, vira um query param (?v=...) — o path do arquivo
// é sempre o mesmo (upsert sobrescreve no mesmo lugar a cada regeneração),
// mas o Storage do Supabase serve os objetos com cache-control de 1h; sem
// um parâmetro que muda junto com o conteúdo (ex.: imagem_gerada_em), o
// navegador do usuário reaproveita a imagem antiga em cache mesmo depois
// de uma regeneração ter subido um arquivo novo no mesmo path. Passe
// `imagem_gerada_em` (que muda a cada geração) como versão.
export function getPublicImageUrl(path: string, versao?: string | null): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  const url = `${base}/storage/v1/object/public/${POST_IMAGES_BUCKET}/${path}`;
  return versao ? `${url}?v=${encodeURIComponent(versao)}` : url;
}
