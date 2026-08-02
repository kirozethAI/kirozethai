import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Bucket criado via migration (supabase/migrations/20260801030000_visual_dna_schema.sql),
// não no painel manualmente. Público (o logo aparece na imagem final do
// post, não precisa de autenticação pra visualizar); escrita exige auth.uid().
export const CLIENT_LOGOS_BUCKET = "client-logos";

export async function uploadClientLogo(
  supabase: SupabaseClient<Database>,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(CLIENT_LOGOS_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`Não foi possível subir o logo pro Storage: ${error.message}`);
  }
}

// Monta a URL pública a partir do path salvo em client_dna.logo_url.
export function getPublicLogoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  return `${base}/storage/v1/object/public/${CLIENT_LOGOS_BUCKET}/${path}`;
}
