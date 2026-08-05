const HOSTS_BLOQUEADOS = new Set(["localhost", "0.0.0.0", "[::1]", "::1"]);

// Bloqueio básico de SSRF (Fase 22) — a landing page é uma URL escolhida
// pelo próprio usuário autenticado, mas quem efetivamente navega até lá é
// o SERVIDOR (Puppeteer, via screenshotUrlToPngBuffer); sem essa
// checagem, alguém poderia apontar pra um endereço interno (localhost,
// IP privado, metadata de nuvem) e usar o app como proxy pra sondar a
// rede interna de onde ele roda. Cobre os casos óbvios (protocolo, hosts
// literalmente internos/privados/link-local) — não é uma defesa completa
// contra DNS rebinding (exigiria resolver o DNS e checar o IP resultante
// a cada requisição), proporcional ao risco real de uma ferramenta
// interna de uso ocasional por 1 usuário autenticado, não uma superfície
// pública.
export function validarUrlPublica(urlBruta: string): URL {
  let url: URL;
  try {
    url = new URL(urlBruta);
  } catch {
    throw new Error("URL inválida.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Use uma URL http:// ou https://.");
  }

  const host = url.hostname.toLowerCase();
  const ehPrivado =
    HOSTS_BLOQUEADOS.has(host) ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") || // link-local, inclui metadata de nuvem (169.254.169.254)
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (ehPrivado) {
    throw new Error("Essa URL aponta pra um endereço interno/privado — não permitido.");
  }

  return url;
}
