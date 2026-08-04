import { normalize } from "@/lib/calendar/normalize";

// Fase 20 — decide se um cliente está num nicho regulado a partir de
// clients.segmento (texto livre digitado no cadastro, Fase 1), por
// correspondência textual simples sobre o texto normalizado (minúsculo,
// sem acento — mesma normalize() usada pro segmento desde a Fase 2).
//
// Termos deliberadamente RADICAIS (prefixos), pra cobrir variações:
// "medic" pega médico/medicina/biomedicina; "advoc"/"advogad" pegam
// advocacia/advogado(a); etc. Falso positivo aqui só adiciona uma
// checagem de apoio a mais (nunca bloqueia nada), então errar pro lado
// de INCLUIR é o lado seguro.

export type NichoRegulado = "saude" | "direito";

const TERMOS_SAUDE = [
  "saude",
  "medic",
  "odont",
  "clinic",
  "dentist",
  "hospital",
  "psicolog",
  "fisioterap",
  "nutric",
];

const TERMOS_DIREITO = ["direito", "advoc", "advogad", "juridic", "oab"];

export const NICHO_LABEL: Record<NichoRegulado, string> = {
  saude: "saúde",
  direito: "direito",
};

export function detectarNichoRegulado(segmento: string | null): NichoRegulado | null {
  if (!segmento) return null;
  const normalizado = normalize(segmento);
  if (TERMOS_SAUDE.some((t) => normalizado.includes(t))) return "saude";
  if (TERMOS_DIREITO.some((t) => normalizado.includes(t))) return "direito";
  return null;
}
