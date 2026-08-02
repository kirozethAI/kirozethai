const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

// Normaliza texto pra comparação tolerante a maiúsculas/acentos (ex.: "Imobiliário" == "imobiliario").
export function normalize(texto: string): string {
  return texto.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase().trim();
}
