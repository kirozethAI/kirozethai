"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updateVisualDnaAction } from "@/app/visual-actions";
import { resolveBackground } from "@/lib/render/post-template";

const COR_PRIMARIA_PADRAO = "#1f2937";
const COR_SECUNDARIA_PADRAO = "#111827";

type Props = {
  clientId: string;
  nomeMarca: string;
  corPrimariaInicial: string | null;
  corSecundariaInicial: string | null;
  logoUrlInicial: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
    >
      {pending ? "Salvando..." : "Salvar marca"}
    </button>
  );
}

export function VisualDnaForm({
  clientId,
  nomeMarca,
  corPrimariaInicial,
  corSecundariaInicial,
  logoUrlInicial,
}: Props) {
  const [corPrimaria, setCorPrimaria] = useState(corPrimariaInicial ?? COR_PRIMARIA_PADRAO);
  const [corSecundaria, setCorSecundaria] = useState(corSecundariaInicial ?? COR_SECUNDARIA_PADRAO);
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrlInicial);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLogoPreview(file ? URL.createObjectURL(file) : logoUrlInicial);
  }

  const { background, textColor } = resolveBackground(corPrimaria, corSecundaria);

  return (
    <form action={updateVisualDnaAction} className="space-y-6">
      <input type="hidden" name="clientId" value={clientId} />

      <div>
        <p className="mb-2 text-sm font-medium">Prévia</p>
        <div
          className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-lg p-4 text-center"
          style={{ background }}
        >
          {logoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt=""
              className="h-14 w-14 rounded-full border border-white/40 bg-white object-cover p-1"
            />
          )}
          <span className="text-sm font-bold" style={{ color: textColor }}>
            {nomeMarca}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="corPrimaria">
            Cor primária
          </label>
          <input
            id="corPrimaria"
            name="corPrimaria"
            type="color"
            value={corPrimaria}
            onChange={(e) => setCorPrimaria(e.target.value)}
            className="h-10 w-full rounded border border-black/15 dark:border-white/15"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="corSecundaria">
            Cor secundária
          </label>
          <input
            id="corSecundaria"
            name="corSecundaria"
            type="color"
            value={corSecundaria}
            onChange={(e) => setCorSecundaria(e.target.value)}
            className="h-10 w-full rounded border border-black/15 dark:border-white/15"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="logo">
          Logo (PNG, JPG ou SVG — até 2MB)
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleLogoChange}
          className="block w-full text-sm"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
