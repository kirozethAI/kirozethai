import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

// Versão da Graph API do Meta — repetida como constante local em cada
// arquivo da Fase 18 que precisa dela (connect/callback/sync-spend), sem
// um módulo compartilhado: são poucas chamadas, bem isoladas, e um
// route.ts do App Router só pode exportar handlers HTTP/config
// reconhecidos pelo Next (não dá pra reexportar uma constante daqui).
const META_OAUTH_DIALOG_URL = "https://www.facebook.com/v21.0/dialog/oauth";

// Escopo mínimo pra ler gasto de campanhas (Etapa 3) — não pedimos
// permissão de escrita/gerenciamento de campanhas, só leitura.
const ESCOPOS = "ads_read";

// Início do fluxo OAuth do Meta (Fase 18) — chamado pelo botão "Conectar
// Meta Ads" na tela do cliente (`?clientId=<uuid>`). Gera um nonce
// aleatório, guarda num cookie httpOnly de curta duração, e embute no
// `state` do OAuth junto com o client_id do Kirozeth — o callback (ver
// ../callback/route.ts) confere o nonce contra o cookie antes de aceitar
// qualquer coisa, proteção padrão contra CSRF nesse tipo de fluxo.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId é obrigatório." }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json(
      {
        error:
          "META_APP_ID não configurada — configure as credenciais do Meta for Developers antes de conectar (ver PROGRESS.md, Fase 18).",
      },
      { status: 500 }
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = `${nonce}.${clientId}`;
  const redirectUri = new URL("/api/oauth/meta/callback", url.origin).toString();

  const dialogUrl = new URL(META_OAUTH_DIALOG_URL);
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", redirectUri);
  dialogUrl.searchParams.set("state", state);
  dialogUrl.searchParams.set("scope", ESCOPOS);
  dialogUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(dialogUrl.toString());
  response.cookies.set("meta_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.VERCEL === "1",
    sameSite: "lax",
    maxAge: 600, // 10 min — tempo de sobra pro usuário completar o login no Meta
    path: "/",
  });
  return response;
}
