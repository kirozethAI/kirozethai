"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadClientLogo } from "@/lib/render/upload-logo";
import type { Database } from "@/lib/supabase/types";

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB

const LOGO_EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};

type ClientDnaUpdate = Database["public"]["Tables"]["client_dna"]["Update"];

function normalizeHex(valor: FormDataEntryValue | null): string | null {
  const str = (valor ?? "").toString().trim();
  return /^#[0-9a-fA-F]{6}$/.test(str) ? str : null;
}

// Salva a identidade visual do cliente (cores + logo), chamada pelo form em
// src/components/visual-dna-form.tsx. O logo só é substituído se um
// arquivo novo for enviado — resubmeter só as cores não apaga o logo já
// salvo.
export async function updateVisualDnaAction(formData: FormData) {
  const clientId = (formData.get("clientId") ?? "").toString();
  if (!clientId) {
    throw new Error("clientId ausente.");
  }

  const supabase = await createSupabaseServerClient();

  const update: ClientDnaUpdate = {
    cor_primaria: normalizeHex(formData.get("corPrimaria")),
    cor_secundaria: normalizeHex(formData.get("corSecundaria")),
  };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > LOGO_MAX_BYTES) {
      throw new Error("O logo é muito grande — o limite é 2MB.");
    }

    const extensao = LOGO_EXTENSAO_POR_TIPO[logo.type];
    if (!extensao) {
      throw new Error("Formato de logo não suportado — envie PNG, JPG ou SVG.");
    }

    const buffer = Buffer.from(await logo.arrayBuffer());
    const path = `${clientId}.${extensao}`;
    await uploadClientLogo(supabase, path, buffer, logo.type);
    update.logo_url = path;
  }

  const { error } = await supabase.from("client_dna").update(update).eq("client_id", clientId);

  if (error) {
    throw new Error(`Não foi possível salvar a identidade visual: ${error.message}`);
  }

  revalidatePath(`/clientes/${clientId}/marca`);
  revalidatePath(`/clientes/${clientId}`);
}
