import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/security/encryption";

const META_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function extrairMensagemErro(json: unknown, fallback: string): string {
  const erro = (json as { error?: { message?: string } })?.error?.message;
  return erro ?? fallback;
}

// Callback do OAuth do Meta (Fase 18) — recebe o `code`, confere o
// `state` contra o nonce salvo em cookie (ver ../connect/route.ts), troca
// o code por um access_token de curta duração, troca ESSE por um token de
// longa duração (~60 dias — é assim que o Meta faz "refresh": não existe
// refresh_token separado como no Google, o token de longa duração
// precisa ser reconectado manualmente quando expirar), busca as ad
// accounts disponíveis nesse login, e salva a 1ª encontrada em
// `ad_accounts` (criptografando o access_token — ver
// src/lib/security/encryption.ts). Qualquer falha no meio do caminho
// marca a conta como "erro" (se já existia) e redireciona de volta pra
// tela do cliente com o motivo na query string, sem derrubar a
// requisição com uma página de erro genérica do Next.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erroOAuth = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const [nonceState, clientId] = (state ?? "").split(".");
  const nonceCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("meta_oauth_nonce="))
    ?.split("=")[1];

  // Sem clientId no state não dá nem pra saber pra onde redirecionar com
  // o erro — único caso que cai na home em vez da tela do cliente.
  if (!clientId) {
    return NextResponse.redirect(new URL("/?meta_erro=state_invalido", url.origin));
  }

  const paginaCliente = new URL(`/clientes/${clientId}`, url.origin);

  if (erroOAuth) {
    paginaCliente.searchParams.set("meta_erro", erroOAuth);
    return NextResponse.redirect(paginaCliente);
  }

  if (!code || !nonceCookie || nonceCookie !== nonceState) {
    paginaCliente.searchParams.set("meta_erro", "state_ou_nonce_invalido");
    const response = NextResponse.redirect(paginaCliente);
    response.cookies.delete("meta_oauth_nonce");
    return response;
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    paginaCliente.searchParams.set("meta_erro", "credenciais_ausentes");
    return NextResponse.redirect(paginaCliente);
  }

  const redirectUri = new URL("/api/oauth/meta/callback", url.origin).toString();

  try {
    // 1) code -> access_token de curta duração
    const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(extrairMensagemErro(tokenJson, "Falha ao trocar o código por um access_token."));
    }

    // 2) token curto -> token de longa duração (~60 dias)
    const longLivedUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedJson = await longLivedRes.json();
    if (!longLivedRes.ok || !longLivedJson.access_token) {
      throw new Error(extrairMensagemErro(longLivedJson, "Falha ao gerar o token de longa duração."));
    }

    const accessToken = longLivedJson.access_token as string;
    const expiresInSegundos = (longLivedJson.expires_in as number | undefined) ?? 60 * 24 * 60 * 60;
    const tokenExpiraEm = new Date(Date.now() + expiresInSegundos * 1000).toISOString();

    // 3) busca as ad accounts disponíveis nesse login
    const adAccountsUrl = new URL(`${GRAPH_BASE}/me/adaccounts`);
    adAccountsUrl.searchParams.set("fields", "id,name");
    adAccountsUrl.searchParams.set("access_token", accessToken);

    const adAccountsRes = await fetch(adAccountsUrl.toString());
    const adAccountsJson = await adAccountsRes.json();
    if (!adAccountsRes.ok) {
      throw new Error(extrairMensagemErro(adAccountsJson, "Falha ao buscar contas de anúncio."));
    }

    const contas = (adAccountsJson.data ?? []) as { id: string; name?: string }[];
    const primeiraConta = contas[0];
    if (!primeiraConta) {
      throw new Error("Nenhuma conta de anúncio encontrada nesse login do Meta.");
    }
    if (contas.length > 1) {
      // Simplificação deliberada (ver Decisões Tomadas, PROGRESS.md): sem
      // um seletor de conta na UI, pegamos a 1ª — só avisamos no log, não
      // quebra a conexão.
      console.warn(
        `[meta-oauth] Cliente ${clientId} tem ${contas.length} contas de anúncio — conectando a 1ª (${primeiraConta.id}).`
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("ad_accounts").upsert(
      {
        client_id: clientId,
        plataforma: "meta",
        meta_ad_account_id: primeiraConta.id,
        access_token: encrypt(accessToken),
        token_expira_em: tokenExpiraEm,
        conectado_em: new Date().toISOString(),
        status: "conectado",
        ultimo_erro: null,
      },
      { onConflict: "client_id,plataforma" }
    );

    if (error) {
      throw new Error(`Conta conectada no Meta, mas falhou salvar no banco: ${error.message}`);
    }

    paginaCliente.searchParams.set("meta_conectado", "1");
    const response = NextResponse.redirect(paginaCliente);
    response.cookies.delete("meta_oauth_nonce");
    return response;
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido ao conectar.";
    console.error(`[meta-oauth-callback] Falha ao conectar cliente ${clientId}:`, mensagem);
    paginaCliente.searchParams.set("meta_erro", mensagem);
    const response = NextResponse.redirect(paginaCliente);
    response.cookies.delete("meta_oauth_nonce");
    return response;
  }
}
