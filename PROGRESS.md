# Kirozeth AI

> ⚠️ **CAMINHO DO PROJETO MUDOU em 2026-08-01**: agora é
> `C:\Users\sergi\Desktop\Saas-Marketing` (sem OneDrive no caminho
> visível). Se uma sessão futura encontrar o projeto no caminho antigo
> (`C:\Users\sergi\OneDrive\Desktop\Saas-Marketing`), ver o incidente
> registrado em "Problemas Encontrados" da Fase 5 antes de mexer em
> qualquer coisa — houve um evento sério de corrupção de sincronização do
> OneDrive nessa sessão.

## Status Atual
**Fases 1 a 17 e 19 a 22 concluídas e validadas. Fase 18 concluída no
código, faltando 1 passo manual do usuário.** Fase 22 (2026-08-05):
NeuroScore — princípios de persuasão incorporados DIRETO no prompt de
geração de texto (Fases 2/5/6) + avaliação visual via Groq vision com
loop de qualidade (até 3 tentativas antes de mostrar pro usuário) na
aprovação de post, mais avaliação avulsa (upload de imagem ou landing
page via URL) em `/neuroscore`. Validada de ponta a ponta contra
banco+Groq reais — loop completo de 3 tentativas escolhendo com
honestidade a de maior nota, compliance (Fase 20) e NeuroScore
confirmados rodando lado a lado sem se atropelar, avaliação avulsa
persistida, SSRF bloqueado no caminho real. Achado real no caminho: o
modelo de visão tem limite de só 8.000 tokens/minuto no tier gratuito da
Groq — corrigido com retry+backoff, e o tempo/custo real do pior caso
(3 tentativas, ~75-110s) está documentado na Fase 22 pro usuário
entender o trade-off de latência. Fase 21 (2026-08-04):
módulo de CRM genérico — funil de vendas com estágios CONFIGURÁVEIS
(`/crm/estagios`), leads com timeline de atividades (`/crm/[id]`),
proposta comercial em PDF/Word reaproveitando 100% a infraestrutura de
documentos da Fase 15 (rotas de exportação reutilizadas sem nenhuma
alteração), e conversão lead→cliente reaproveitando o trigger/motor de
perguntas da Fase 1 — validada com 25 verificações contra o banco real,
incluindo idempotência de conversão (ver Fase 21). Fase 20 (2026-08-04):
compliance publicitário heurístico pra nichos regulados (saúde/direito)
— checagem via Groq quando um texto de sugestão é gerado/ajustado,
alerta no chat + snapshot em posts aprovados + tela de gestão de regras
em `/juridico/compliance`. É APOIO À DECISÃO, nunca bloqueio nem
certificação de conformidade — e as regras do seed são referência geral,
não lista exaustiva nem validada juridicamente (revisar/expandir com um
profissional). Migration **já rodada pelo usuário e validada contra o
banco real** (teste ponta a ponta com fluxo real de chat/aprovação, 12
verificações — ver Fase 20). Fase 19 (2026-08-04):
financeiro PESSOAL do usuário (receitas/despesas por categoria, dashboard
mensal em `/financeiro/pessoal`) — migration
`20260804000000_personal_finance_schema.sql` **já rodada pelo usuário e
validada contra o banco real** (teste ponta a ponta com 26 verificações,
ver Fase 19). Fase 18 (2026-08-03/04): conexão OAuth com Meta Ads
pra puxar gasto real de campanhas automaticamente (cron diário), com
entrada manual sempre disponível como alternativa/complemento. Google
Ads fica de fora (schema já genérico pra extensão futura). Migration
`supabase/migrations/20260803050000_ad_spend_schema.sql` **já rodada
pelo usuário e confirmada contra o banco real** — tabelas `ad_accounts`
e `ad_spend` existem em produção. **PENDENTE: usuário criar o app no
Meta for Developers e configurar
`META_APP_ID`/`META_APP_SECRET`/`ENCRYPTION_KEY`** — sem isso, o OAuth
real com a API do Meta de verdade não pôde rodar nesta sessão (previsto
explicitamente no escopo). Toda a lógica que NÃO depende da API real —
criptografia do token, validação de CSRF/state do OAuth, tratamento de
erro, isolamento de falha por conta e dedup de sincronização — já foi
validada contra o banco real (ver Fase 18 abaixo).

---

# Fase 22 — NeuroScore (avaliação heurística de persuasão)

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260804060000_neuroscore_schema.sql`:
      `neuroscore_evaluations` (id, client_id fk nullable, origem
      `post_gerado`/`upload_manual`/`landing_page`, content_calendar_id
      fk nullable com `on delete cascade` — mesma semântica de
      "dono"/cascade já usada em `lead_activities.lead_id` na Fase 21 —,
      tentativa_numero, imagem_avaliada_url, url_original nullable,
      nota_geral numeric(3,1), gancho_inicial, gatilhos_desejo/
      fatores_retencao/fatores_algoritmo/pontos_fracos/sugestoes jsonb,
      probabilidade_conversao_estimada, criado_em). RLS padrão. Bucket
      novo `neuroscore-uploads` (público, mesmo padrão de storage.buckets
      via migration da Fase 3/4) — só pra Etapa 5 (upload avulso/
      screenshot de landing page); as tentativas do loop de qualidade
      (origem='post_gerado') continuam usando o bucket `post-images` já
      existente, mesmo ciclo de vida do post em si (ver Decisões
      Tomadas). `src/lib/supabase/types.ts` atualizado
      (`NeuroscoreEvaluation` exportado). **PENDENTE: usuário rodar esta
      migration no SQL Editor** (confirmado via teste — a tabela ainda
      não existe no banco real, 404)
- [x] Etapa 2 — `src/lib/groq/post-suggestion.ts`: `SYSTEM_PROMPT`
      (constante ÚNICA já compartilhada pelas 3 chamadas — geração por
      calendário, avulso/Fase 5, e o modo de ajuste, que reusa a mesma
      função) ganhou o bloco `PRINCIPIOS_PERSUASAO`, ADICIONADO ao final
      do prompt existente (limite de 280 caracteres, tom de voz,
      compliance — nada removido nem enfraquecido): gancho inicial
      (capturar atenção nas primeiras palavras, evitar abrir só com o
      nome da data comemorativa), gatilho de desejo (pelo menos 1 gatilho
      real — urgência/escassez/prova social/autoridade/aspiração/
      curiosidade — só quando fizer sentido, nunca inventado), retenção
      (estrutura que mantém interesse até o fim do texto curto). Por ser
      1 constante só, o enriquecimento cobriu as 3 chamadas
      automaticamente, sem tocar em nenhuma delas individualmente
- [x] Etapa 3 — `src/lib/neuroscore/groq-vision-client.ts`
      (`groqVisionCompletion`): wrapper separado de `groq/client.ts`
      (Fase 2, intocado) porque o endpoint de visão usa `content`
      multimodal (texto+imagem via URL) e `response_format:
      json_object`, formato diferente do chat de texto puro. Modelo
      SEMPRE via `GROQ_VISION_MODEL` (nunca hardcoded, mesmo cuidado da
      Fase 2 com `GROQ_MODEL`) — confirmado em
      console.groq.com/docs/vision no momento da implementação:
      `qwen/qwen3.6-27b`. **Retry com backoff pra 429** adicionado depois
      de esbarrar num rate limit real no teste (ver Problemas
      Encontrados) — até 2 re-tentativas, esperando o tempo que a própria
      API sugere (header `Retry-After` ou a mensagem de erro), só pra
      429 (qualquer outro erro propaga na hora). `src/lib/neuroscore/analyze-image.ts`
      (`analisarImagemPost`): prompt único reaproveitado pelo loop de
      qualidade E pela avaliação avulsa, pedindo JSON estruturado
      (nota_geral, gancho_inicial, gatilhos_desejo, fatores_retencao,
      fatores_algoritmo, pontos_fracos, sugestoes,
      probabilidade_conversao_estimada) com parsing robusto (regex
      `\{[\s\S]*\}` + validação campo a campo, mesmo padrão do
      compliance/Fase 20 e do carrossel/Fase 12) — reforça explicitamente
      no prompt que é ESTIMATIVA HEURÍSTICA, nunca dado real de
      plataforma
- [x] Etapa 4 — `src/lib/render/generate-post-image.ts` refatorado: a
      montagem de template + render virou `renderPostImageBuffer`
      (exportada, SEM upload/update de banco — Fase 22), reaproveitada
      tanto por `generateImageForApprovedPost` (comportamento IDÊNTICO
      ao de antes, mesmos chamadores, mesma assinatura) quanto pelo loop
      novo. `src/lib/neuroscore/generate-with-quality-loop.ts`
      (`generateImageWithQualityLoop`) — substitui a chamada direta a
      `generateImageForApprovedPost` nos 2 pontos reais que geram a
      imagem do post quadrado: o fluxo de aprovação automática
      (`handleSuggestionReply`, Fase 2/3) e o botão manual de fallback
      (`generateImageAction`, `calendar-actions.ts` — mesmo motivo do
      próprio comentário original dele, "fallback do automático", agora
      passa pelo mesmo loop). Fluxo por tentativa (máx. 3): renderiza →
      sobe pra um path PRÓPRIO (`<id>-neuroscore-tentativa-N.png`, não o
      definitivo ainda) → avalia via Groq vision → nota ≥ 7 encerra; nota
      < 7 com tentativas restantes reescreve o texto via
      `generatePostSuggestion` no MESMO mecanismo de ajuste já existente
      (`sugestaoAnterior`+`feedbackAjuste`, sintetizado a partir dos
      `pontos_fracos`/`sugestoes` da avaliação) e tenta de novo; esgotadas
      as 3 sem atingir 7, usa a de MAIOR nota entre as testadas — nunca
      trava, nunca inventa nota. A imagem VENCEDORA (buffer já em
      memória, sem re-renderizar) sobe pro path definitivo `<id>.png`. Se
      a tentativa vencedora não é a 1ª (que sempre começa com o texto JÁ
      aprovado no chat), o texto mudou: `content_calendar.sugestao_texto`
      é atualizado, compliance (Fase 20) é RE-CHECADO pro texto final
      (independente do NeuroScore, só reflete o texto que realmente vai
      publicar), e uma linha é gravada em `content_calendar_history`
      (Fase 7) com `status_anterior=status_novo='aprovado'`,
      `origem='neuroscore_loop'` — documenta com honestidade que o texto
      foi revisado enquanto já aprovado, sem inventar uma "mudança de
      status" que não aconteceu. Se o loop inteiro falhar (Groq vision
      fora do ar, etc.), cai pro `generateImageForApprovedPost` simples
      (imagem sempre é gerada, só sem NeuroScore)
- [x] Etapa 5 — Avaliação avulsa, SEM loop (não há o que regenerar em
      conteúdo externo): `src/lib/neuroscore/upload-evaluation-image.ts`
      (upload pro bucket `neuroscore-uploads`),
      `src/lib/neuroscore/screenshot-url.ts` (`screenshotUrlToPngBuffer`
      — reaproveita `abrirBrowser()` da Fase 15, mas via `page.goto()`
      numa URL real, diferente de `page.setContent()` usado nos
      templates), `src/lib/neuroscore/validate-url.ts`
      (`validarUrlPublica` — **bloqueio de SSRF**, ver Decisões Tomadas,
      não pedido explicitamente no escopo mas necessário: sem isso, a
      landing page seria uma superfície de SSRF via Puppeteer server-side
      pra endereço interno/privado/metadata de nuvem). `src/app/neuroscore-actions.ts`
      (`evaluateUploadedImageAction`/`evaluateLandingPageAction`) +
      `src/app/neuroscore/page.tsx` (upload OU URL, cliente opcional só
      pra organizar, histórico das últimas 30 avaliações avulsas).
      `maxDuration=60` explícito (1 render Puppeteer + 1 chamada de
      visão, mesmo raciocínio da rota de PDF/Fase 15)
- [x] Etapa 6 — `src/components/neuroscore-result-card.tsx`
      (`NeuroScoreResultCard`) — componente reutilizável (nota colorida
      por faixa, gancho, gatilhos/retenção/algoritmo com explicação,
      pontos fracos, sugestões, probabilidade de conversão, e quantas
      tentativas até aprovar quando aplicável), com o aviso de estimativa
      SEMPRE visível no rodapé, nunca só em algum lugar isolado da tela.
      Usado tanto em `/neuroscore` quanto anexado em "Posts aprovados"
      (`approved-posts.tsx`) — `clientes/[id]/page.tsx` busca a avaliação
      mais recente por post (quando existir; posts sem avaliação — de
      antes da Fase 22, ou quando o loop caiu no fallback simples —
      simplesmente não mostram a seção, sem quebrar nada)
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem
      erros (rota nova `/neuroscore` no build). `maxDuration` de
      `/clientes/[id]` elevado de 120 (calibrado pro carrossel na Fase
      12) pra 280: o loop de qualidade pode rodar até 3 renders + 3
      avaliações de visão + 2 regenerações de texto, todos sequenciais —
      pior caso bem maior que o do carrossel; 280s segue abaixo do teto
      de 300s do Hobby, com alguma margem
- [x] Etapa 7 (rodada 1 — antes da migration) — Testado tudo que não
      depende das tabelas novas, via `npx tsx` (script descartável,
      apagado ao final), contra a Groq REAL: (1) confirmado que
      `neuroscore_evaluations` ainda não existe (404); (2) prompt
      enriquecido testado com um pedido deliberadamente propício a
      gatilho de urgência/escassez ("promoção relâmpago... só hoje e
      amanhã") → o texto gerado usou "Hoje e amanhã... Aproveite!",
      dentro do limite de caracteres; (3) `analisarImagemPost` contra uma
      imagem de teste renderizada com urgência+escassez+prova social
      DELIBERADOS ("Só hoje: 50% OFF", "Mais de 300 clientes",
      "última chance") → identificou corretamente os 3 gatilhos, nota
      6.5/10; (4) `analisarImagemPost` contra um screenshot REAL de
      `https://example.com` (página sem nenhum elemento de persuasão) →
      nota 1/10, 0 gatilhos identificados — **confirma que o modelo
      discrimina qualidade de verdade, não devolve número arbitrário**;
      (5) bloqueio de SSRF: 6 URLs internas/privadas
      (localhost/127.0.0.1/169.254.169.254/192.168.x/10.x/protocolo
      ftp) todas rejeitadas, 1 URL pública real passou normalmente; (6)
      screenshot de landing page real via Puppeteer, 2.3s. **21/21
      verificações passaram.** Único achado real no caminho: rate limit
      da Groq vision (ver Problemas Encontrados), corrigido com
      retry+backoff antes de terminar a rodada
- [x] Etapa 7 (rodada 2, 2026-08-05) — **Usuário confirmou ter rodado a
      migration.** Teste ponta a ponta contra banco + Groq REAIS,
      chamando as funções REAIS do fluxo completo
      (`handleFreeMessage`→`criarConteudoAvulso`;
      `handleSuggestionReply`→`generateImageWithQualityLoop`), com 2
      clientes de teste (1 não regulado, 1 de nicho regulado) + 2
      avaliações avulsas, todos removidos ao final. Resultado:
      1. **Loop de qualidade ponta a ponta (cliente "Padaria", não
         regulado)**: post avulso aprovado no chat → loop rodou as 3
         tentativas (nenhuma atingiu 7: notas 6.5, 6.2, 6.0) → **usou
         com honestidade a de MAIOR nota (tentativa 1, 6.5)**, mesmo não
         sendo a última tentada — confirma que "melhor entre as
         testadas" é literal, não "a última". Como a vencedora foi a
         tentativa 1 (texto original, nunca reescrito), `sugestao_texto`
         não mudou e **nenhuma linha `neuroscore_loop` foi gravada no
         histórico** — confirmando que o registro extra só acontece
         quando o texto REALMENTE muda, como projetado
      2. **`neuroscore_evaluations` gravada corretamente**: origem
         `post_gerado`, `tentativa_numero=1`, `client_id` batendo com o
         cliente, `gancho_inicial` preenchido
      3. **Compliance + NeuroScore juntos, independentes (cliente
         "Clínica Teste F22", nicho saúde)**: o mesmo post passou pelas
         2 checagens — `compliance_alertas` calculado na geração (texto
         limpo, `[]`) e **continuou presente e intocado** depois do loop
         de qualidade rodar (3 tentativas, notas 6.5/5.5/4.5,
         `neuroscore_evaluations` gravada) — nenhum dos dois módulos
         atropelou o outro
      4. **Avaliação avulsa — upload manual**: imagem de teste
         (gatilhos de escassez/urgência deliberados) avaliada SEM loop
         (1 chamada de visão só), nota 4.5, identificou corretamente os
         4 gatilhos presentes na imagem; `content_calendar_id` NULL,
         `tentativa_numero=1`, `client_id` opcional salvo quando
         informado
      5. **Avaliação avulsa — landing page real**: `https://example.com`
         avaliada via screenshot real, nota 1/10 (consistente com a
         rodada 1), `url_original` preenchida, SSRF confirmado bloqueado
         de novo no caminho real (não só na função pura)
      6. **Histórico de `/neuroscore`**: a mesma query da página
         encontrou as 2 avaliações avulsas recém-criadas
      7. **Limpeza**: os 2 clientes de teste (cascade limpou
         dna/conversas/mensagens/content_calendar/
         `neuroscore_evaluations` associadas) e as 2 avaliações avulsas
         (+ os arquivos no bucket `neuroscore-uploads`) removidos — 0
         resíduo confirmado por query
      **Nota de processo**: a 1ª tentativa desta rodada tentou chamar as
      Server Actions (`evaluateUploadedImageAction`/
      `evaluateLandingPageAction`) direto de um script solto e quebrou
      com `cookies() was called outside a request scope` — mesma classe
      de limitação já documentada desde a Fase 7 (código que depende de
      contexto de requisição do Next não roda fora dele). Corrigido
      chamando a lógica de biblioteca subjacente direto (mesmo padrão
      já usado em toda fase anterior pra testar Server Actions fora do
      Next) — não é um bug do app.
      **Fase 22 validada.**

## Pendente
(nenhum — commit/push desta fase aguardando confirmação do usuário)

## Medição de tempo/custo do loop de qualidade (pedido explícito da
Etapa 7 — números REAIS observados nesta sessão, não só o cálculo
teórico)
- **Custo de API por tentativa**: a 1ª tentativa sempre usa o texto JÁ
  aprovado no chat (sem chamada de texto extra) — só 1 render Puppeteer
  + 1 chamada de visão Groq. Tentativas 2 e 3 (só acontecem se a
  anterior ficou abaixo de 7) somam mais 1 chamada de texto (regeneração
  via `generatePostSuggestion`) cada. **Pior caso real (3 tentativas)**:
  3 renders + 3 avaliações de visão + 2 regenerações de texto = 5
  chamadas à Groq + 3 renders Puppeteer.
- **Tempo real observado — caso completo de 3 tentativas (cliente
  "Padaria")**: aprovação + loop de qualidade completo, do clique
  "aprovado" até a imagem final salva = **74,6 segundos**. O cliente
  "Clínica" (também 3 tentativas) ficou na mesma faixa.
- **Rate limit da Groq vision domina a latência do pior caso**: das
  observações reais, boa parte dos ~75-110s do pior caso (3 tentativas)
  não é render nem inferência — é ESPERA por rate limit (8000 TPM no
  tier gratuito, ver Problemas Encontrados). Nos testes desta sessão, os
  atrasos de retry por tentativa variaram de 10s a 31s. **Post que
  aprova na 1ª tentativa (a maioria, esperado com o prompt já enriquecido
  de persuasão) não sofre esse custo** — só 1 render (poucos segundos) +
  1 avaliação de visão (tipicamente rápida na Groq, sem rate limit
  atingido com uma única chamada isolada).
- **Implicação prática pro usuário**: aprovar posts em RAJADA rápida
  (vários seguidos em poucos minutos) tem mais chance de esbarrar no
  rate limit de visão do que aprovar 1 de cada vez — o retry automático
  garante que a imagem sempre é entregue (nunca trava), só pode demorar
  mais nesse cenário. Se o volume de uso justificar, upgrade de tier na
  Groq elimina essa variável.

## Problemas Encontrados
- [2026-08-05] **Achado real, não hipotético**: durante a própria rodada
  1 do teste (Etapa 7), a 2ª chamada de visão da sessão (avaliação do
  screenshot de `https://example.com`, logo depois de já ter avaliado a
  imagem de teste anterior) bateu num 429 real da Groq: `"Rate limit
  reached for model qwen/qwen3.6-27b ... tokens per minute (TPM): Limit
  8000, Used 4858, Requested 4941"`. Contexto: cada chamada de visão
  sozinha já consome uma fração grande do limite de 8000 TPM do tier
  gratuito (a imagem em si custa uma quantidade grande de tokens) — 2
  chamadas de visão em menos de 1 minuto já é o suficiente pra estourar.
  Isso é uma ameaça direta ao loop de qualidade da Etapa 4 (até 3
  chamadas de visão em sequência pro MESMO post): sem tratamento, a 2ª
  ou 3ª tentativa do loop falharia com frequência real em uso normal, não
  só em teoria/cenário extremo. Status: **resolvido** — adicionado
  retry+backoff em `groq-vision-client.ts` só pra 429 (até 2
  re-tentativas, esperando o tempo sugerido pela própria API — header
  `Retry-After` ou a mensagem de erro "Please try again in Xs", com um
  default de 15s se nenhum dos dois vier). Reteste confirmou: a 2ª
  chamada bateu 429 de novo, esperou 14s automaticamente, e teve sucesso
  na 2ª tentativa. **Implicação prática pro usuário, documentada aqui
  pra não surpreender**: em uso normal (1 post aprovado por vez, sem
  rajada), isso raramente aparece; mas se o loop precisar de 2-3
  tentativas pro MESMO post (nota abaixo de 7 na 1ª), cada tentativa
  adicional de visão tem chance real de esperar ~15s a mais por causa
  desse limite — a latência do pior caso (3 tentativas) pode ficar
  perceptivelmente mais alta do que o cálculo teórico sem rate limit
  sugeriria. Se o volume de uso crescer, upgrade de tier na Groq
  (mencionado no próprio erro) resolveria de vez.

## Decisões Tomadas
- **Loop de qualidade escopado só ao formato POST QUADRADO, não
  Story/Carrossel.** O escopo cita "Fases 3/12" ao descrever onde vem a
  infraestrutura de render reaproveitada, mas os 2 pontos de integração
  citados EXPLICITAMENTE ("fluxo de aprovação de sugestão" e "conteúdo
  avulso") correspondem ao que já é gerado AUTOMATICAMENTE na aprovação
  — que desde a Fase 12 é só o post quadrado (Story/Carrossel continuam
  opt-in via botão dedicado, nunca automáticos, decisão da própria Fase
  12). Estender o loop pra Story/Carrossel tornaria a aprovação até 3x
  mais cara em render+visão (3 formatos × até 3 tentativas cada) sem
  pedido explícito — desproporcional. Se fizer falta, é uma extensão
  natural de fase futura (a função `renderPostImageBuffer` já não é
  específica de formato — story/carrossel usam viewport diferente, mas a
  mesma ideia se aplicaria).
- **Botão manual "Gerar imagem" (`generateImageAction`) também passa a
  usar o loop de qualidade**, não só a aprovação automática. Não pedido
  explicitamente no escopo (que só cita "handleSuggestionReply"), mas o
  próprio comentário original desse botão já o descrevia como "fallback
  ... pro caso da geração automática falhar" — se o caminho automático
  agora é o loop, o fallback deixar de ser equivalente (silenciosamente
  sem NeuroScore) criaria uma inconsistência confusa: alguns posts
  aprovados com nota visível, outros regenerados manualmente sem nota
  nenhuma, sem motivo pro usuário entender por quê.
- **A tentativa 1 do loop SEMPRE começa com o texto exato que o usuário
  aprovou no chat** — nunca descarta ou ignora a aprovação. Só tentativas
  2/3 (se necessárias) reescrevem o texto. Isso respeita a decisão do
  usuário como ponto de partida, e faz com que a MAIORIA dos posts
  (qualquer um que já nasça com nota ≥ 7 na 1ª tentativa) nunca tenha o
  texto alterado depois da aprovação — só entra em jogo quando a
  qualidade visual realmente pede uma correção.
- **Quando o loop reescreve o texto (tentativa vencedora ≠ tentativa 1),
  `content_calendar.sugestao_texto` É atualizado, com registro em
  `content_calendar_history` (`status_anterior=status_novo='aprovado'`,
  `origem='neuroscore_loop'`) e RE-checagem de compliance (Fase 20) pro
  texto final** — não deixado como estava, e não escondido. Alternativas
  descartadas: (a) manter `sugestao_texto` intocado e deixar o texto na
  IMAGEM divergir do texto mostrado em "Posts aprovados" — geraria uma
  inconsistência visível e confusa pro usuário (a legenda mostrada não
  bateria com o que está escrito na imagem); (b) atualizar
  `sugestao_texto` SEM registrar no histórico — violaria o princípio da
  Fase 7 de nunca ter uma mudança de conteúdo real sem rastro auditável.
  Reaproveitar `status_anterior=status_novo` (mesmo valor duas vezes) é
  uma leitura nova, mas LEGÍTIMA, do schema existente (não há constraint
  proibindo) — é a forma mais honesta de dizer "o conteúdo mudou, mas o
  status (aprovado) não".
- **`content_calendar_history` e a re-checagem de compliance só
  acontecem se o texto REALMENTE mudou** (tentativa vencedora ≠ tentativa
  1) — a maioria dos posts, que aprova já na 1ª tentativa, não gera
  nenhuma linha de histórico nova nem chamada extra de compliance. Evita
  ruído no histórico auditável e uma chamada de API desnecessária pro
  caso comum.
- **Tentativas intermediárias do loop sobem pra um path PRÓPRIO
  (`<id>-neuroscore-tentativa-N.png`) no bucket `post-images`, não o path
  definitivo `<id>.png` até a vencedora ser escolhida.** Motivo: a Groq
  vision precisa de uma URL pública de verdade pra buscar a imagem (não
  aceita base64 inline neste fluxo) — sem paths próprios, uma tentativa
  reprovada ficaria momentaneamente "publicada" no lugar da imagem
  oficial do post (visível pra qualquer um que já tivesse a URL, mesmo
  que por poucos segundos). O buffer da vencedora já está em memória, sem
  precisar re-renderizar: só mais 1 upload no final pro path certo. Arquivos de
  tentativa não vencedora ficam órfãos no Storage (custo desprezível,
  mesmo raciocínio já aceito pra slides de carrossel órfãos na Fase 12) —
  não implementada limpeza automática deles, fora do escopo pedido.
- **Bucket `neuroscore-uploads` separado de `post-images`**, só pra
  Etapa 5 (upload avulso/landing page) — ciclo de vida diferente
  (conteúdo de avaliação externa, não asset de publicação do sistema),
  mesmo raciocínio já usado pra separar `client-logos` de `post-images`
  na Fase 4. As tentativas do loop de qualidade continuam em
  `post-images` porque ELAS SIM têm o mesmo ciclo de vida do post (viram
  o post, ou são descartadas junto com a decisão de qual venceu).
- **Bloqueio de SSRF (`validarUrlPublica`) na avaliação de landing
  page**, não pedido explicitamente no escopo. A Etapa 5 introduz uma
  capacidade nova real: o SERVIDOR (Puppeteer) navega pra uma URL
  escolhida por um usuário autenticado — sem checagem, isso é uma
  superfície clássica de SSRF (apontar pra localhost/IP privado/metadata
  de nuvem 169.254.169.254 e usar o app como proxy pra sondar a rede
  interna de onde ele roda). Cobre os casos óbvios (protocolo, hosts
  literalmente internos/privados/link-local) — não é uma defesa completa
  contra DNS rebinding (exigiria resolver o DNS e checar o IP resultante
  a cada requisição), proporcional ao risco real de uma ferramenta
  interna de uso ocasional por 1 usuário autenticado, não uma superfície
  pública.
- **Retry+backoff no cliente de visão só pra 429, até 2 re-tentativas.**
  Ver Problemas Encontrados pro rate limit real que motivou isso — não
  planejado originalmente, adicionado depois de um erro real no próprio
  teste desta fase. Limitado a 429 (não qualquer erro) e a um teto de
  re-tentativas (não indefinido) — mesmo espírito de "nunca rodar sem
  limite" já aplicado ao loop de qualidade em si (Etapa 4, máx. 3
  tentativas).

---

# Fase 21 — Módulo de CRM (funil de vendas genérico)

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260804040000_crm_schema.sql`:
      `pipeline_stages` (id, nome, ordem, cor hex, tipo_final
      `nenhum`/`ganho`/`perdido`, ativo; NUNCA excluído via UI, só
      desativado — evita órfão em `leads.pipeline_stage_id`), `leads`
      (nome, empresa, telefone, email, segmento, origem,
      pipeline_stage_id fk, valor_estimado, client_id fk nullable —
      preenchido na conversão) e `lead_activities` (lead_id fk cascade,
      tipo `nota`/`ligacao`/`reuniao`/`email`/`mudanca_estagio`,
      descricao; mesmo espírito só-insert de content_calendar_history da
      Fase 7). RLS padrão. Seed de 6 estágios (Novo Lead → Contato Feito
      → Proposta Enviada → Negociação → Fechado-Ganho/`tipo_final=ganho`
      → Fechado-Perdido/`tipo_final=perdido`) e 1 modelo-base de
      "proposta_comercial" (ver Etapa 5). Também amplia o check
      constraint de `document_templates.tipo` (mesmo padrão de
      `content_calendar.tipo_evento` na Fase 5) e adiciona
      `client_documents.lead_id` (nullable, `on delete cascade` — mesma
      semântica de "dono" de `client_id` nesta tabela, diferente do
      `on delete set null` de `document_template_id`).
      `src/lib/supabase/types.ts` atualizado (`PipelineStage`, `Lead`,
      `LeadActivity` exportados; `document_templates.tipo` e
      `client_documents.lead_id` estendidos). **PENDENTE: usuário rodar
      esta migration no SQL Editor** (confirmado via teste — as 3
      tabelas novas ainda não existem no banco real, 404 nas 3)
- [x] Etapa 2 — `/crm` (Kanban): colunas = `pipeline_stages` ativos
      ordenados, cards = leads daquele estágio. Movimentação via um
      `<select>` por card (não drag-and-drop — decisão de esforço x
      valor explicitamente permitida no escopo), disparando
      `moveLeadStageAction` (`src/app/crm-actions.ts`). Cada
      movimentação grava `lead_activities` `mudanca_estagio`
      automaticamente com o texto `"<estágio antigo> → <estágio novo>"`.
      Se o estágio de DESTINO tiver `tipo_final='ganho'`, a mesma action
      já dispara a conversão em cliente (Etapa 6) — sem exigir um
      segundo clique
- [x] Etapa 3 — `/crm/[id]`: dados do lead, `LeadActivityTimeline`
      (`src/components/lead-activity-timeline.tsx`) — mesmo padrão
      visual do histórico de aprovação da Fase 7 (lista cronológica
      tipo/data/descrição) — com formulário pra lançar nota/ligação/
      reunião/e-mail manualmente via `addLeadActivityAction`
- [x] Etapa 4 — `/crm/estagios` (`PipelineStagesManager`): criar, editar
      (nome/cor/tipo_final), ativar/desativar, e reordenar via botões
      ↑/↓ que trocam a `ordem` com o vizinho adjacente (mesmo raciocínio
      de simplicidade da Etapa 2 — sem drag-and-drop). Estágio nunca é
      excluído pela UI (só desativado)
- [x] Etapa 5 — Proposta comercial: `document_templates.tipo` ganhou
      `'proposta_comercial'`, com 1 modelo-base no seed (estrutura
      padrão de proposta comercial brasileira — cabeçalho, "Sobre a
      empresa", escopo, investimento, validade, próximos passos; ver
      Problemas Encontrados sobre `.claude/skills/sales-enablement`
      consultado mas não usado como fonte de texto).
      `getLeadFillValues()` (`src/lib/documents/fill-template.ts`) —
      mistura `getSystemFillValues()` (dados fixos do Kirozeth AI) com
      `nome_lead`/`empresa_lead` (de `leads`) e `servico`/`valor`/
      `validade` (do formulário, mesmo raciocínio de
      `getClientFillValues` na Fase 15 — são termos da proposta, não
      dado de cadastro). `generateLeadProposalAction`
      (`src/app/crm-actions.ts`) cria `client_documents` com
      `client_id=null`/`lead_id=<lead>` — **reaproveita as rotas
      `/api/documents/[id]/pdf` e `.../docx` da Fase 15 SEM alteração
      nenhuma** (elas só leem `client_documents` por id, já eram
      genéricas o bastante). `LeadProposalGenerator`
      (`src/components/lead-proposal-generator.tsx`), mesmo padrão do
      `ContractGenerator`. **Achado durante a implementação, corrigido
      no caminho**: a tela `/juridico` filtrava "modelos do sistema"
      como `tipo !== "contrato"` — isso faria o modelo de proposta
      aparecer lá com um botão "Gerar" via `getSystemFillValues()`
      (sem `nome_lead`/`empresa_lead`), produzindo um documento com
      placeholders sobrando. Corrigido o filtro pra
      `tipo === "termos_uso" || tipo === "politica_privacidade"`
      explicitamente — a proposta só é gerada a partir da ficha do lead,
      onde os dados certos existem; segue listada em "Modelos-base" (a
      lista de cima) pra edição via `/juridico/modelos/[id]`, que já era
      genérica o bastante pra aceitar o tipo novo sem alteração
- [x] Etapa 6 — `src/lib/crm/convert-lead.ts` (`convertLeadToClient`):
      insere em `clients` (nome/empresa/segmento do lead — o trigger
      `handle_new_client` da Fase 1, INTOCADO, cria `client_dna` +
      `conversation` automaticamente), chama
      `generateQuestionsForNewClient` (Fase 1, a MESMA função que
      `createClientAction` usa — não duplicada), salva `client_id` de
      volta no lead, e grava uma `lead_activities` "Lead convertido em
      cliente." **Idempotente**: se `lead.client_id` já está preenchido,
      retorna o client_id existente sem criar um 2º cliente (decisão
      documentada abaixo). Chamada de 2 lugares — automaticamente
      quando `moveLeadStageAction` move pro estágio `ganho`, e
      explicitamente pelo botão "Converter em cliente"
      (`ConvertLeadButton`, sempre visível na ficha até o lead ser
      convertido, daí vira um link "Já convertido — ver cliente →")
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem
      erros (4 rotas novas — `/crm`, `/crm/[id]`, `/crm/estagios`,
      `/crm/novo` — aparecem no build)
- [x] Etapa 7 (parcial — ver Pendente) — Testado tudo que dá sem a
      migration: (1) confirmado que as 3 tabelas ainda não existem no
      banco real; (2) `fillTemplate()` com os placeholders REAIS do seed
      da migration (nome/empresa do lead, serviço, valor, validade) →
      preenchido corretamente, nenhum `{{chave}}` sobrando; (3) PDF —
      `montarDocumentoHtml` embrulha certo, conteúdo presente; (4)
      **docx REAL gerado e extraído de verdade** (o .docx é escrito em
      disco, descompactado como ZIP via PowerShell `Expand-Archive`, e
      `word/document.xml` inspecionado via grep) — confirma que o
      subconjunto de tags do template novo (h1/h2/p/hr/em, sem
      ul/strong) é aceito pelo parser da Fase 15 sem erro, e que
      "João da Silva", "Padaria do João", o serviço e a validade de
      teste aparecem de verdade dentro do XML do Word gerado. **Nota de
      ferramenta**: o `-match` do PowerShell contra literais acentuados
      digitados no comando deu falso-negativo pra "João da Silva"/
      "Padaria do João" (encoding do terminal, não do arquivo) — o
      mesmo grep via Bash confirmou a presença correta; registrado só
      pra não confundir uma sessão futura testando docx via PowerShell
- [x] Etapa 7 (final, 2026-08-04) — **Usuário confirmou ter rodado a
      migration.** Teste ponta a ponta contra o banco REAL, chamando as
      MESMAS operações das Server Actions (e `convertLeadToClient`
      importada de verdade, não reimplementada no teste), com 3 leads de
      teste criados e removidos ao final. 25/25 verificações passaram:
      1. **Seed real**: 6 estágios (ordem 1-6), só "Fechado - Ganho" com
         `tipo_final=ganho`, só "Fechado - Perdido" com `perdido`; 1
         modelo de proposta comercial
      2. **Movimentação de estágio (lead A)**: `pipeline_stage_id`
         atualizado, `lead_activities` 'mudanca_estagio' gravada com o
         texto exato "Novo Lead → Contato Feito"
      3. **Atividade manual**: ligação registrada, timeline com 2
         entradas NA ORDEM certa (mudança de estágio, depois a ligação)
      4. **Proposta comercial (lead A)**: `getLeadFillValues` trouxe
         nome/empresa do lead do banco corretamente; preenchimento sem
         nenhum `{{chave}}` sobrando; documento salvo com
         `lead_id`/`client_id=null`; **confirmado que a MESMA query que
         as rotas `/api/documents/[id]/pdf` e `.../docx` usam (sem
         alteração nenhuma nelas) encontra o documento e o conteúdo bate**
      5. **Conversão automática (lead B → estágio "Fechado - Ganho")**:
         cliente criado com nome/empresa/segmento do lead; `client_dna`
         E `conversation` ativa criados pelo trigger da Fase 1
         (intocado); motor de perguntas gerou 9 `questions_pending`; a
         1ª pergunta já está no chat como mensagem da IA;
         `lead.client_id` salvo de volta; nota "Lead convertido em
         cliente." na timeline; **cliente aparece na lista normal de
         clientes** (mesma query da home)
      6. **Idempotência**: converter o MESMO lead B de novo devolveu o
         MESMO `client_id` (`jaConvertido=true`) — confirmado por
         contagem direta no banco que existe exatamente 1 cliente com
         esse nome, não 2
      7. **Conversão explícita (lead C, ainda em "Novo Lead")**: funciona
         independente do estágio atual, e — importante — NÃO move o lead
         de estágio sozinha (só marca `client_id`, o estágio no funil
         continua refletindo onde a negociação realmente está)
      8. **Reordenar estágios**: troca de `ordem` entre os 2 primeiros
         confirmada e revertida
      9. **Limpeza**: leads e clientes de teste removidos; cascade
         limpou `client_dna`/`conversations`/`messages`/
         `questions_pending`/`lead_activities`/`client_documents`
         automaticamente — 0 resíduo confirmado por query
      **Fase 21 validada.**

## Pendente
(nenhum — commit/push do código desta fase será feito à parte; a
atualização final deste PROGRESS.md aguarda commit)

## Problemas Encontrados
- [2026-08-04] Achado de integração durante a implementação (não um
  erro de teste, corrigido no próprio código antes de qualquer commit):
  ver Etapa 5 acima — o filtro de "modelos do sistema" em
  `/juridico/page.tsx` (`tipo !== "contrato"`) capturaria também o novo
  `proposta_comercial`, oferecendo um botão "Gerar" que usa
  `getSystemFillValues()` (sem dados de lead) e produziria um documento
  com `{{nome_lead}}`/`{{empresa_lead}}` literais no texto. Corrigido
  trocando o filtro pra uma lista positiva
  (`termos_uso`/`politica_privacidade`) antes de rodar qualquer teste —
  não chegou a gerar nenhum documento incorreto.
- [2026-08-04] `.claude/skills/marketing` (citado no escopo, "consultando
  .claude/skills/marketing se fizer sentido") não existe com esse nome —
  o skill mais próximo pra colateral de vendas é `sales-enablement`
  (pitch decks, one-pagers, playbooks — foco em vendas B2B complexa,
  motion de vendas). Consultado como referência de que estrutura
  "escaneável, ligada a outcome de negócio" importa, mas o formato
  concreto do modelo-base (proposta de 1 página: escopo, investimento,
  validade, próximos passos) veio da convenção padrão de proposta
  comercial brasileira, não do texto do skill — mesmo padrão de
  honestidade já usado nas Fases 15/16 quando um skill citado no escopo
  não tinha correspondência exata.

## Decisões Tomadas
- **Conversão IDEMPOTENTE: repetir a ação num lead já convertido nunca
  cria um 2º cliente, só devolve o `client_id` já existente** — decisão
  pedida explicitamente no escopo. Cobre 2 cenários reais: (1) o usuário
  clica "Converter em cliente" 2x (duplo clique, ou re-tentativa depois
  de resposta lenta — mesmo risco já tratado na idempotência de
  `createAsaasPaymentForInvoice`, Fase 17); (2) um lead já convertido é
  movido de novo pro estágio "ganho" (ex.: reaberto e refechado no
  funil) — a conversão automática por movimentação de estágio não
  duplicaria o cliente nesse caso.
- **Conversão automática ao mover pro estágio `tipo_final='ganho'`, MAIS
  um botão explícito "Converter em cliente" sempre disponível** — a
  redação do escopo ("quando o usuário move... (ou aciona
  explicitamente...)") lida como as 2 vias coexistindo, não uma
  alternativa à outra. O botão explícito cobre o caso de querer
  converter sem esperar mover fisicamente pro estágio final (ex.: um
  funil onde "ganho" não é literalmente o último estágio configurado) e
  serve de retry visível caso a conversão automática precise ser
  reforçada.
- **`generateQuestionsForNewClient` (Fase 1) reaproveitada tal e qual em
  `convertLeadToClient`**, não duplicada nem adaptada. Pedido explícito
  do escopo ("reaproveitar o fluxo/trigger da Fase 1... não duplicar
  essa lógica"). O motor de perguntas roda exatamente como rodaria pra
  um cliente cadastrado manualmente via `/clientes/novo` — a única
  diferença é a origem dos dados (`lead` em vez de um formulário).
- **`clients.aniversario_pessoal`/`aniversario_empresa` ficam `null` na
  conversão** — `leads` não tem esses campos (não fazem sentido num
  prospect que ainda não é cliente) e o schema de `clients` já os trata
  como opcionais desde a Fase 1; o motor de calendário (Fase 2) já lida
  com cliente sem aniversário configurado normalmente.
- **Movimentação de estágio via `<select>` por card, não drag-and-drop**
  — explicitamente permitido no escopo por esforço x valor.
  Drag-and-drop exigiria uma lib nova (o projeto não tem nenhuma) só pra
  esse Kanban, contra um `<select>` que já reaproveita 100% o padrão de
  formulário/Server Action já usado em todo o resto do projeto.
  Reordenação de estágio segue o mesmo raciocínio (botões ↑/↓ trocando
  `ordem` com o vizinho, não arrastar).
- **`client_documents.lead_id` com `on delete cascade`, não `set null`**
  — mesma semântica de `client_id` nesta tabela (o "dono" do documento),
  diferente de `document_template_id` (a "fonte/modelo", que usa `set
  null` — apagar o modelo-base não deveria apagar documentos já
  gerados). Se um lead de teste for excluído, as propostas geradas pra
  ele saem junto — comportamento esperado pra dado de teste descartável,
  e não afeta documentos de cliente já convertido (que ficam com
  `client_id`, não `lead_id`, mesmo que tenham sido gerados como
  propostas antes da conversão — ver decisão seguinte).
- **Proposta gerada ANTES da conversão continua com `lead_id` preenchido
  e `client_id=null` mesmo DEPOIS do lead virar cliente** — não há
  "re-vínculo" automático do documento pro `client_id` novo na
  conversão. Não pedido no escopo, e a proposta é um snapshot histórico
  do que foi oferecido AO LEAD naquele momento (mesmo espírito de
  imutabilidade de `conteudo_final`, Fase 15) — sua "dona" continua
  sendo a negociação que a originou, não uma entidade que só passou a
  existir depois.
- **Estágio nunca é excluído pela UI, só desativado (`ativo=false`)** —
  evita o problema de `leads.pipeline_stage_id` (not null, sem `on
  delete cascade`/`set null` — ver Etapa 1) ficar órfão se um estágio
  com leads associados fosse removido. Um estágio desativado some do
  Kanban (que só lista `ativo=true`) mas continua existindo pra
  qualquer lead histórico que ainda aponte pra ele.

---

# Fase 20 — Compliance publicitário (saúde e direito)

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260804020000_compliance_schema.sql`:
      `compliance_rules` (id, nicho `saude`/`direito`, regra, gravidade
      `alta`/`media`/`baixa`, fonte, ativo, criado_em; RLS padrão) com
      seed de 11 regras GERAIS amplamente conhecidas (6 de saúde, 5 de
      direito — resultado garantido, depoimento de paciente, imagem de
      paciente, comparação, tom promocional agressivo; captação
      mercantilista, garantia de êxito, comparação, honorários como
      chamariz, sensacionalismo). **Fontes deliberadamente genéricas**
      ("Princípios gerais de publicidade em saúde (CFM/CFO)" / "…na
      advocacia (OAB)"), sem artigo/resolução que possa desatualizar.
      **NÃO é lista exaustiva nem validada juridicamente** — aviso
      replicado no comment da migration, na UI e aqui. A migration também
      adiciona `content_calendar.compliance_alertas` (jsonb — ver
      Decisões Tomadas): null = nunca checado, [] = checado sem alerta,
      [{regra, gravidade, motivo}] = alertas. `src/lib/supabase/types.ts`
      atualizado (`ComplianceRule` exportado). Estrutura de
      gravidade/disclaimer informada pelos skills instalados mais
      próximos (`compliance-check`, `legal-risk-assessment` — ver
      Problemas Encontrados sobre `.claude/skills/legal` não existir).
      **PENDENTE: usuário rodar esta migration no SQL Editor**
- [x] Etapa 2 — `src/lib/compliance/detect-niche.ts`
      (`detectarNichoRegulado`): correspondência textual simples sobre
      `clients.segmento` normalizado (mesma `normalize()` da Fase 2).
      Termos radicais documentados no código — saúde: saude, medic,
      odont, clinic, dentist, hospital, psicolog, fisioterap, nutric;
      direito: direito, advoc, advogad, juridic, oab. Falso positivo só
      adiciona uma checagem de apoio (nunca bloqueia), então errar pro
      lado de incluir é o lado seguro. `src/lib/compliance/check-content.ts`:
      `verificarCompliancePost` (retorna null ANTES de qualquer consulta
      ao banco/Groq pra cliente fora de nicho — custo zero, regra
      explícita do escopo) + `checarTextoContraRegras` (Groq,
      temperature=0, regras numeradas no prompt, resposta JSON
      `{"violacoes":[{"regra":N,"motivo":"…"}]}`, parsing robusto via
      regex `\{[\s\S]*\}` — mesmo padrão do carrossel da Fase 12 — com
      validação item a item) + `formatComplianceWarning` (bloco "⚠️ …"
      sempre terminando com "alerta automático de apoio à decisão, não
      uma avaliação jurídica")
- [x] Etapa 3 — Integração nos 3 pontos onde texto de sugestão é gerado
      e exibido, sempre em try/catch próprio (falha da checagem NUNCA
      derruba a sugestão): `generate-suggestions.ts` (calendário),
      `handle-free-message.ts`/`criarConteudoAvulso` (avulso) e o branch
      de AJUSTE de `handle-reply.ts` (o texto ajustado também é gerado
      por `generatePostSuggestion` — coberto pela redação do escopo; um
      ajuste pode tanto resolver quanto introduzir violação, então o
      snapshot é re-checado e substituído). Nos 3: alertas gravados em
      `compliance_alertas` na mesma operação que salva o texto, e o
      aviso anexado à MESMA mensagem do chat da sugestão. Nenhuma linha
      da lógica de decisão existente alterada — só adições
- [x] Etapa 4 — `clientes/[id]/page.tsx` passa `compliance_alertas` pros
      posts aprovados; `approved-posts.tsx` mostra um bloco amarelo
      "Este texto tinha alerta de compliance publicitário quando foi
      sugerido" com as regras/gravidade/motivo + disclaimer — o alerta
      NÃO some depois de aprovado (auditoria posterior, pedido explícito
      da Etapa 4)
- [x] Etapa 5 — `/juridico/compliance` (`ComplianceRulesManager`): lista
      por nicho com Ativar/Desativar por regra (desativada sai da
      checagem sem perder o texto) + formulário de regra nova
      (nicho/gravidade/regra/fonte) via `src/app/compliance-actions.ts`.
      Aviso fixo: "Regras de referência — não substituem consulta a um
      profissional…". Link adicionado em `/juridico`
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem
      erros (rota nova `/juridico/compliance` no build)
- [x] Etapa 6 (rodada 1 — antes da migration, ver Pendente pra rodada
      2) — Testadas as funções REAIS via `npx tsx` (script descartável,
      apagado ao final), incluindo a Groq DE VERDADE com as mesmas
      regras do seed em memória (a tabela ainda não existe no banco):
      (1) detecção de nicho: 13 casos, todos corretos (variações com/sem
      acento, "Clínica Médica", "Advocacia trabalhista", e negativos
      "Imobiliário"/"Alimentação"/"Marketing digital"/null); (2) **custo
      zero fora de nicho regulado provado de verdade**: chamei
      `verificarCompliancePost` com segmento "Alimentação" passando um
      Proxy que lança exceção em QUALQUER acesso ao client Supabase —
      retornou null sem tocar em nada; (3) texto de saúde
      deliberadamente violador ("resultado garantido em 30 dias… melhores
      que qualquer outro consultório") → a Groq apontou EXATAMENTE as 2
      regras certas (resultado garantido, comparação) com motivos
      coerentes; (4) texto de saúde informativo limpo → 0 alertas; (5)
      texto de direito violador ("Garantimos a vitória… promoção…
      chame agora") → apontou as 2 regras certas (captação mercantilista,
      garantia de êxito); (6) texto de direito informativo → 0 alertas;
      (7) formato do aviso do chat com ⚠️ + regras + disclaimer. 20/20
      verificações passaram, com zero falso positivo nos textos limpos
- [x] Etapa 6 (rodada 2, 2026-08-04) — **Usuário confirmou ter rodado a
      migration.** Teste ponta a ponta contra banco REAL + Groq REAL,
      chamando as funções REAIS do fluxo (`handleFreeMessage` →
      `criarConteudoAvulso`; `handleSuggestionReply` pra aprovação), com
      3 clientes de teste criados via insert (o trigger da Fase 1 criou
      dna/conversa automaticamente) e removidos ao final. 12/12
      verificações passaram:
      1. **Seed real**: 11 regras (6 saúde + 5 direito), todas ativas
      2. **Checagem com regras do banco**: texto violador de saúde → 3
         alertas coerentes; texto limpo → `[]` (checado, sem alerta)
      3. **Fluxo real saúde**: pedido de post "com resultado garantido em
         30 dias" → a Groq gerou texto genuinamente violador
         ("Clareamento dental com resultado garantido em 30 dias! Sem
         riscos…") e a checagem PEGOU: `compliance_alertas` gravado
         (regra de resultado garantido, gravidade alta) e mensagem do
         chat com o aviso ⚠️
      4. **Fluxo real direito**: idem ("Nossa equipe vence qualquer
         processo… Consulta grátis… Chame no WhatsApp") → 3 alertas
         (captação mercantilista, garantia de êxito, sensacionalismo) +
         ⚠️ no chat
      5. **Fora de nicho custa zero e não é checado**: cliente
         "Imobiliário" pediu post "prometendo retorno garantido" →
         `compliance_alertas = null` (nunca checado) e chat SEM ⚠️ —
         exatamente a semântica projetada
      6. **Aprovação (Etapa 4)**: "aprovado" via handleSuggestionReply →
         status virou `aprovado`, `compliance_alertas` CONTINUA gravado
         (o que a seção "Posts aprovados" exibe), e a geração automática
         de imagem da Fase 3 rodou normalmente no caminho (template
         "cartao" — nenhuma regressão)
      7. **Desativar regra funciona**: regra de "resultado garantido"
         desativada → um texto que viola só ela deixou de receber ESSE
         alerta (a Groq ainda apontou a regra vizinha de
         "milagroso/infalível", semanticamente defensável pro mesmo
         texto — comportamento correto: desativar UMA regra não desliga
         as outras); regra reativada e confirmada ao final
      8. **Limpeza**: os 3 clientes de teste removidos (cascade limpou
         dna/conversas/mensagens/content_calendar). Único resíduo: o PNG
         gerado na aprovação do teste fica órfão no bucket post-images
         (apagar a linha de content_calendar não apaga o objeto no
         Storage — custo desprezível, mesmo comportamento já documentado
         na Fase 12 pra slides órfãos)
      **Fase 20 validada.**

## Pendente
(nenhum — commit/push do código desta fase já feitos: `a69852f`; a
atualização final deste PROGRESS.md aguarda commit)

## Problemas Encontrados
- [2026-08-04] `.claude/skills/legal` (citado no escopo) não existe com
  esse nome — mesma situação da Fase 15 (que já tinha procurado um skill
  "legal" e não achou). Skills instalados mais próximos:
  `compliance-check` e `legal-risk-assessment` — usados como referência
  de ESTRUTURA (classificação de gravidade alta/média/baixa; o padrão de
  disclaimer "assiste workflows jurídicos mas não fornece
  aconselhamento; requisitos mudam com frequência, verifique fontes
  autoritativas", espelhado nos avisos da UI). Nenhum texto de regra veio
  dos skills — as regras do seed são os princípios amplamente conhecidos
  listados no próprio escopo.
- [2026-08-04] Primeira tentativa de rodar o script de teste a partir do
  scratchpad (fora do projeto) falhou: import ESM com caminho absoluto
  do Windows (`C:/...`) não é aceito pelo Node ("Only URLs with a scheme
  in: file, data, node"). Resolvido movendo o script pra raiz do projeto
  com imports relativos (`./src/lib/...`) — mesmo padrão dos scripts
  descartáveis das fases anteriores (e por isso eles sempre ficaram na
  raiz do projeto). Script apagado ao final, como sempre.

## Decisões Tomadas
- **Alertas persistidos numa coluna jsonb em `content_calendar`
  (`compliance_alertas`), não numa tabela separada.** A Etapa 4 exige
  que o alerta continue visível depois de aprovado — precisa ser
  persistido em algum lugar (não estava especificado onde). O alerta é
  um SNAPSHOT 1:1 do texto daquela linha no momento da geração (mesmo
  espírito de `texto_no_momento` do histórico da Fase 7), não uma
  entidade própria com ciclo de vida — coluna de resultado na própria
  linha segue o padrão já estabelecido (`imagem_gerada`,
  `carrossel_slides`). A distinção null (nunca checado) vs [] (checado,
  sem alerta) vs [...] (alertas) fica de graça no jsonb e ajuda
  auditoria.
- **Checagem também no branch de AJUSTE (`handle-reply.ts`), não só nas
  2 gerações "novas".** O escopo nomeia `generatePostSuggestion` e
  `generateAdHocPostSuggestion` — e o ajuste chama exatamente
  `generatePostSuggestion` (com feedback), gerando um texto NOVO que
  substitui o anterior. Pular o ajuste deixaria um buraco óbvio: um
  texto limpo ajustado pra algo violador ("fala que o resultado é
  garantido") passaria sem alerta. O snapshot é substituído junto com o
  texto (um ajuste também pode RESOLVER um alerta — manter o alerta
  velho seria informação errada).
- **Aviso anexado à MESMA mensagem do chat da sugestão, não uma 2ª
  mensagem separada.** Mantém a associação visual inequívoca
  (alerta-texto) e não mexe na cadência do chat (1 sugestão = 1
  mensagem, padrão desde a Fase 2).
- **Falha da checagem (Groq fora, JSON irreconhecível) é logada
  (`console.warn`) e a sugestão segue SEM alerta** — nos 3 pontos de
  integração, em try/catch próprio. A checagem é apoio, não gate: travar
  a geração de sugestão porque o verificador falhou inverteria a
  prioridade (mesmo padrão do histórico da Fase 7 e da imagem automática
  da Fase 3). Como ausência de alerta JÁ não significa conformidade (é
  heurística), a falha silenciosa não muda a semântica de nada.
- **temperature=0 na checagem** — tarefa de decisão/classificação, não
  de criação; mesmo racional do classificador de intenção da Fase 5.
  Prompt instrui explicitamente a apontar só conflito claro/provável
  ("não aponte por precaução vaga") — controle de falso positivo pra não
  gerar ruído, validado nos testes (0 alertas nos 2 textos limpos).
- **Termos de detecção incluem profissões de saúde além das citadas no
  escopo** (psicolog, fisioterap, nutric, dentist, hospital) — o escopo
  dava os termos como "ex:" e essas profissões têm conselhos com regras
  de publicidade do mesmo espírito (CFP, COFFITO, CFN). Como as regras
  do nicho `saude` são princípios gerais (não específicos de CFM/CFO), o
  alerta continua fazendo sentido pra elas; e falso positivo aqui só
  adiciona um aviso de revisão, nunca bloqueia.
- **Regra desativada continua no banco (soft toggle via `ativo`), sem
  exclusão de regra na UI.** Desativar preserva o texto pra reativar
  depois (regras de conselho vão e voltam com revisões); uma exclusão de
  verdade não foi pedida e apagaria referência que pode estar citada em
  `compliance_alertas` de posts antigos (o snapshot copia o TEXTO da
  regra, então nem a desativação afeta alertas já gravados).

---

# Fase 19 — Controle financeiro pessoal do usuário

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260804000000_personal_finance_schema.sql`:
      `personal_categories` (id, nome, tipo `receita`/`despesa`, cor hex,
      padrao bool, criado_em) e `personal_transactions` (id, categoria_id
      fk, tipo, descricao, valor numeric(12,2), data date, recorrente
      bool default false, criado_em). RLS padrão do projeto
      (`auth.uid() is not null`) nas 2 tabelas. Seed de 9 categorias
      `padrao=true` na própria migration: despesa — Moradia, Alimentação,
      Transporte, Lazer, Investimentos (aporte), Outros; receita —
      Salário/Pró-labore, Investimentos (rendimento), Outros.
      `src/lib/supabase/types.ts` atualizado (`PersonalCategory`,
      `PersonalTransaction` exportados). Módulo 100% isolado — nenhuma
      referência a clients/invoices/ad_spend em nenhum arquivo novo.
      **PENDENTE: usuário rodar esta migration no SQL Editor** (confirmado
      via teste — as 2 tabelas ainda não existem no banco real, 404
      PGRST205 nas duas)
- [x] Etapa 2 — `src/app/personal-finance-actions.ts`:
      `createPersonalTransactionAction` (valida descrição/valor>0/data, e
      valida que a CATEGORIA existe e é do MESMO tipo da transação — uma
      despesa nunca entra em categoria de receita) e
      `createPersonalCategoryAction` (criar categoria nova na hora, direto
      do formulário de lançamento — opção "+ Nova categoria…" no select
      revela nome+cor; unicidade de nome+tipo aplicada em código, não por
      constraint, mesmo padrão do resto do projeto). `recorrente=true` é
      SÓ marcador visual, sem automação — ver Decisões Tomadas
- [x] Etapa 3 — `src/app/financeiro/pessoal/page.tsx`: visão de 1 mês por
      vez (default = mês corrente em fuso Brasília via `hojeBrasiliaISO()`,
      Fase 10 — não o mês UTC do servidor), com totais de
      receitas/despesas/saldo, gastos por categoria com barras de
      proporção em CSS puro (sem lib de gráfico nova — não existe nenhuma
      no projeto, e o escopo dizia que barras CSS resolvem), navegação
      mês anterior/próximo via query string `?mes=YYYY-MM` (validada por
      regex antes de usar; aritmética de mês pura em `somarMeses`, sem
      objeto Date — zero armadilha de fuso), e lista dos lançamentos do
      período. Link "Financeiro pessoal" na home
- [x] Etapa 4 — `updatePersonalTransactionAction` (edição inline na
      lista — descrição, valor, data, categoria do mesmo tipo,
      recorrente; o TIPO não muda numa edição, ver Decisões Tomadas) e
      `deletePersonalTransactionAction`, com confirmação de exclusão em 2
      cliques na UI ("Excluir" → "Confirmar exclusão?"/"Cancelar") —
      `src/components/personal-transaction-form.tsx` e
      `.../personal-transaction-list.tsx` (item com estado próprio, mesmo
      espírito da extração de invoice-list-item.tsx da Fase 17)
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem erros
      (rota nova `/financeiro/pessoal` aparece no build, 2.83 kB)
- [x] Etapa 5 (parcial — ver Pendente) — Testado tudo que dá sem a
      migration aplicada: (1) confirmado contra o banco real que as
      tabelas ainda NÃO existem (o teste ponta a ponta genuíno fica pra
      depois da migration); (2) aritmética de meses validada via script
      local (6 casos: mês anterior/próximo, virada de ano pra frente
      2026-12→2027-01, pra trás 2026-01→2025-12, delta de 12/13 meses —
      todos corretos) e rótulos pt-BR ("Agosto de 2026", "Dezembro de
      2025", "Janeiro de 2027"); (3) rota `/financeiro/pessoal` protegida
      pelo middleware de autenticação padrão (visitada sem sessão →
      redirect pro /login, como qualquer rota do app — não está na lista
      de exceções do matcher). O teste visual logado não pôde ser feito
      nesta sessão: não havia sessão autenticada no browser da IA, e a IA
      nunca digita a senha do usuário (regra fixa, mesma das Fases 1/9)
- [x] Etapa 5 (final, 2026-08-04) — **Usuário confirmou ter rodado a
      migration no SQL Editor.** Teste ponta a ponta contra o banco REAL
      (26 verificações, todas passaram), replicando exatamente as mesmas
      queries da página (`gte`/`lt` no intervalo do mês) e as mesmas
      operações das Server Actions:
      1. **Seed**: 9 categorias `padrao=true`, nomes/tipos/cores hex
         exatamente como na migration
      2. **Categoria nova** criada (a mesma operação de
         `createPersonalCategoryAction`)
      3. **5 lançamentos em 2 meses** (ago e jul/2026), incluindo os 2
         casos de borda de mês: 31/07 e 01/08 — cada um caiu no mês
         certo, nenhum "vazou" pro vizinho
      4. **Agosto**: receitas 3.000,00 / despesas 150,00 / saldo
         2.850,00; gastos por categoria Moradia 100,50 (67%) + categoria
         nova 49,50 (33%) — somas e proporções exatas
      5. **Julho** (navegação de mês): 2 lançamentos, receitas 1.000 /
         despesas 200 / saldo 800 — cada mês só com os próprios
      6. **Edição** (mesma operação de `updatePersonalTransactionAction`):
         valor 100,50→150,75 e categoria Moradia→Transporte — total de
         despesas de agosto refletiu na hora (150,00→200,25) e o
         agrupamento por categoria acompanhou
      7. **Constraints reais do banco**: tipo inválido rejeitado pelo
         check constraint (400); excluir categoria com lançamentos
         barrado pela FK restrict (409); **RLS confirmada** — anon key
         sem usuário autenticado lê 0 linhas
      8. **Exclusão** de 1 lançamento confirmada (sumiu de verdade) e
         **limpeza total ao final**: todos os lançamentos e a categoria
         de teste removidos, banco sem nenhum resíduo de teste
      Único pedaço NÃO coberto: o clique literal nos formulários/na
      confirmação de exclusão em 2 cliques pela UI logada (sem sessão
      autenticada no browser da IA nesta sessão — a camada de
      dados/queries/aggregação, que é onde mora o risco real, está
      validada; os componentes são HTML padrão + as mesmas actions).
      **Fase 19 validada.**

## Pendente
(nenhum — commit/push desta fase já feitos: `21c63f0`)

## Problemas Encontrados
(nenhum problema técnico nesta fase — só o bloqueio esperado da migration
pendente + ausência de sessão autenticada pro teste visual, ambos
documentados acima e em Pendente)

## Decisões Tomadas
- **`recorrente` é só marcador visual (badge "Recorrente" na lista), SEM
  automação replicando o lançamento todo mês.** O escopo delegou essa
  decisão explicitamente ("decidir com base no esforço x valor"). Esforço
  da automação seria maior do que parece: diferente do client_billing da
  Fase 16 (que tem uma tabela de CONFIGURAÇÃO separada da tabela de
  faturas — a fonte da recorrência é um registro dedicado), aqui a
  recorrência estaria marcada no próprio lançamento, e replicar
  automaticamente exigiria responder perguntas sem resposta óbvia: qual é
  a "identidade" de um lançamento recorrente pro dedup mensal
  (descrição+valor+categoria? e se o usuário editar a cópia?); uma cópia
  excluída pelo usuário volta no dia seguinte quando o cron rodar de
  novo?; o valor replicado acompanha ou não uma edição do "original"?
  Fazer isso direito pediria uma tabela de configuração de recorrência à
  parte (o desenho da Fase 16) — escopo maior do que o pedido. O valor,
  por outro lado, é modesto: repetir um aluguel/salário é 1 formulário de
  4 campos por mês. Se a automação fizer falta na prática, o caminho
  certo fica registrado: criar uma `personal_recurring_config` (espelho
  do desenho client_billing → invoices) numa fase futura, sem migração de
  dados (o bool `recorrente` de hoje vira só o badge visual que já é).
- **Tipo (receita/despesa) não é editável numa edição de lançamento** —
  editar descrição/valor/data/categoria/recorrente sim, tipo não. Trocar
  o tipo obrigaria a trocar também a categoria (categoria tem tipo, e a
  action valida a compatibilidade), deixando o formulário inline com
  estados intermediários inválidos; excluir e recriar (2 cliques + 1
  formulário) resolve o caso raro sem essa complexidade.
- **Validação "categoria é do mesmo tipo da transação" na Server
  Action**, não só na UI (que já filtra o select pelo tipo). A UI
  filtrada evita o erro no caminho feliz; a validação server-side evita
  que um request montado à mão (ou um bug futuro de UI) grave uma
  despesa numa categoria de receita — que distorceria silenciosamente as
  barras de "gastos por categoria" (agrupadas por categoria_id, somando
  só despesas).
- **"Investimentos" seedada nos 2 tipos** (despesa = aporte, receita =
  rendimento/resgate) — a lista do escopo pedia "despesa e receita
  conforme aplicável" e investimento é genuinamente os dois, dependendo
  da direção do dinheiro. Comentário na própria migration explica.
- **Aritmética de mês (`somarMeses`) feita com números puros
  (ano*12+mês), sem objeto `Date`** — navegação de meses é o único
  cálculo de data novo desta fase, e fazê-lo sem Date elimina por
  construção a classe de bug de fuso horário já vista/corrigida na Fase
  10 (e reencontrada em teste na Fase 18). O único uso de `Date` na
  página é pro RÓTULO do mês ("Agosto de 2026"), ancorado no dia 15 ao
  meio-dia UTC — data que pertence ao mesmo mês em qualquer fuso do
  planeta.
- **Mês corrente default vem de `hojeBrasiliaISO()` (servidor)**; a data
  default do formulário de lançamento vem do fuso local do NAVEGADOR
  (`toLocaleDateString("en-CA")` — mesmo truque en-CA da Fase 10, só que
  client-side). São fontes diferentes de propósito: o Server Component
  roda na Vercel (UTC — precisa da conversão explícita pra Brasília), o
  formulário roda no navegador do usuário (que já está no fuso dele).
  Nota: o formulário equivalente da Fase 18 (ad-spend-section) usa
  `toISOString().slice(0, 10)` (UTC) pro default — entre ~21h e meia-noite
  de Brasília ele sugere a data de amanhã; não corrigido lá (fora do
  escopo desta fase, é 1 linha se incomodar), mas o padrão novo daqui já
  nasce certo.
- **Sem tela de gerenciamento de categorias** (renomear/excluir/recolorir)
  — o escopo pedia criar categoria na hora do lançamento (feito), não um
  CRUD completo de categorias. A FK de `personal_transactions.categoria_id`
  ficou com o comportamento default (restrict) — se um CRUD futuro
  quiser excluir categoria, vai ter que decidir o destino dos lançamentos
  dela explicitamente (o banco impede exclusão silenciosa em cascata).

---

# Fase 18 — Gasto com mídia paga (Meta Ads)

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260803050000_ad_spend_schema.sql`:
      `ad_accounts` (id, client_id, plataforma `meta`/`google` —
      só `meta` implementado, `google` fica pronto pra extensão futura
      com o MESMO schema —, meta_ad_account_id, access_token,
      token_expira_em, conectado_em, status
      `conectado`/`desconectado`/`erro`, `unique(client_id, plataforma)`
      — reconectar substitui via upsert, não duplica) e `ad_spend` (id,
      client_id, ad_account_id nullable, data, valor, origem
      `api`/`manual`, criado_em). `src/lib/supabase/types.ts`
      atualizado (`AdAccount`, `AdSpend` exportados). **PENDENTE:
      usuário rodar esta migration no SQL Editor do Supabase**
      (confirmado via teste — a tabela ainda não existe no banco real)
- [x] Etapa 2 — `src/lib/security/encryption.ts` (AES-256-GCM, chave via
      `ENCRYPTION_KEY`): 1º segredo de terceiro que este projeto guarda
      no BANCO (não só em env var — Groq/Supabase/Asaas ficam todos só
      em env var, mas um access_token de OAuth é intrinsecamente um dado
      por-cliente, precisa estar na tabela). `src/app/api/oauth/meta/connect/route.ts`
      (redireciona pro dialog OAuth do Meta com escopo `ads_read`, nonce
      aleatório num cookie httpOnly de 10min — proteção CSRF padrão) e
      `.../callback/route.ts` (confere nonce, troca `code` por
      access_token curto, troca esse por token de LONGA duração ~60 dias
      — é assim que o Meta faz "refresh", não existe refresh_token
      separado como no Google —, busca as ad accounts do login e salva a
      1ª encontrada, token já criptografado, via upsert). Botão
      "Conectar/Reconectar Meta Ads" na tela do cliente
      (`AdSpendSection`, Etapa 5)
- [x] Etapa 3 — `src/lib/meta-ads/sync-spend.ts` (`syncMetaAdSpend`):
      pra cada `ad_account` "conectado", sincroniza o gasto do DIA
      ANTERIOR (o dia corrente ainda está em andamento, não é definitivo)
      via `GET /{ad_account_id}/insights?fields=spend`, com dedup por
      client_id+data dentro da origem "api". **Erro de 1 conta (token
      expirado, rate limit, API fora) marca só aquela conta como "erro"
      — nunca interrompe o loop das outras** (regra crítica pedida
      explicitamente no escopo). Conectado ao `daily-job.ts` (Fase 8),
      isolado em try/catch próprio, mesmo padrão do financeiro (Fase 16)
- [x] Etapa 4 — `src/app/ad-spend-actions.ts`
      (`registerManualAdSpendAction`): SEMPRE disponível, com ou sem
      conexão ativa — um cliente conectado pode complementar/corrigir um
      dia manualmente (origem "manual" convive com "api" no mesmo dia,
      sem conflito — dedup só vale dentro da própria origem "api").
      `syncMetaAdSpendAction` — disparo manual da sincronização, mesmo
      padrão das Fases 2/8/16 (botão "Sincronizar Meta Ads" na home)
- [x] Etapa 5 — `src/components/ad-spend-section.tsx` na tela do
      cliente: status da conexão (conectado/desconectado/erro, com
      `ultimo_erro` visível quando dá erro), 4 totais (hoje/7 dias/mês/
      total consolidado, calculados em JS a partir dos lançamentos —
      mesmo padrão de agregação em JS usado no resto do projeto, sem
      view/RPC no banco), formulário de entrada manual, e lista dos
      lançamentos recentes com badge de origem (azul = Meta Ads/API,
      cinza = manual) bem diferenciado visualmente. Sem uma tela global
      separada (`/financeiro/midia`) — ver Decisões Tomadas
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem
      erros (rotas novas `/api/oauth/meta/connect` e `.../callback`
      aparecem no build normalmente)
- [x] Etapa 6 (parcial — ver Pendente) — **`META_APP_ID`/`META_APP_SECRET`
      ainda não existem nesta sessão** (usuário ainda vai criar o app no
      Meta for Developers — previsto explicitamente no escopo). Testei
      tudo que dá pra testar sem eles: (1) `encrypt()`/`decrypt()` —
      round-trip correto, e confirmei que 2 criptografias do mesmo texto
      dão resultados DIFERENTES (IV aleatório) mas as 2 decifram pro
      mesmo original; (2) rota `/connect` sem `clientId` → 400; (3)
      `/connect` com `clientId` mas sem `META_APP_ID` → 500 com mensagem
      clara; (4) `/connect` com `META_APP_ID` configurada → 307,
      redireciona pro dialog do Meta de verdade, com o cookie de nonce
      setado; (5) `/callback` com erro vindo do próprio Meta (usuário
      negou permissão) → redireciona de volta pro cliente com o erro na
      query string; (6) `/callback` com nonce que não bate com o cookie
      → rejeitado, redireciona com `meta_erro=state_ou_nonce_invalido`
      (proteção CSRF funcionando). Os 7 cenários bateram exatamente com
      o esperado — a parte mais sensível de acertar num fluxo OAuth (a
      segurança: criptografia do token + CSRF) está validada mesmo sem a
      integração real ainda existir
- [x] Etapa 6 (rodada 2, 2026-08-04) — **Usuário confirmou ter rodado a
      migration `20260803050000_ad_spend_schema.sql` no SQL Editor**;
      confirmado contra o banco real que `ad_accounts`/`ad_spend`
      existem. Com a migration já viva (mas `META_APP_ID`/
      `META_APP_SECRET`/`ENCRYPTION_KEY` ainda ausentes), testei
      `syncMetaAdSpend()` contra o banco de produção com 2 cenários
      sintéticos, usando uma `ad_accounts` de teste (removida ao final):
      (1) conta `status='conectado'` com um token criptografado mas
      inválido — a função faz uma chamada de verdade à Graph API do
      Meta (que responde com erro de token malformado/inválido, sem
      nenhum efeito colateral do lado do Meta), e confirmei que o erro
      fica isolado só naquela conta (`status` vira `erro`,
      `ultimo_erro` preenchido com a mensagem real da API) sem lançar
      exceção pra fora — `syncMetaAdSpend` retornou normalmente
      (`falhas: 1`, `gastosRegistrados: 0`), nenhum `ad_spend`
      indevido criado; (2) reconectei a mesma conta e inseri um
      `ad_spend` (`origem: 'api'`) pro dia-alvo (ontem, em fuso
      Brasília) ANTES de rodar a sincronização de novo — confirmei que
      o dedup evita a chamada à API por completo (a conta permaneceu
      `status='conectado'`, ou seja, nunca chegou a tentar a API com o
      token inválido, que teria derrubado o status de novo). Os 2
      cenários bateram com o esperado. **Achado durante o teste (bug do
      script de teste, não do código do app)**: minha 1ª tentativa do
      cenário de dedup usou "ontem em UTC" em vez de "ontem em
      Brasília" pra montar a data do `ad_spend` de teste — divergem na
      janela das 00:00–03:00 UTC (ex.: 2026-08-04 00:29 UTC ainda é
      2026-08-03 em Brasília), o que fez o dedup não bater na 1ª
      rodada. Corrigido no script de teste (que foi apagado ao final,
      só existiu localmente); não é um bug do `sync-spend.ts`, que já
      usa `hojeBrasiliaISO()` corretamente (Fase 10/16/18) — só reforça
      que esse cuidado de fuso horário precisa ser espelhado em
      qualquer teste que monte datas manualmente.

## Pendente
- [ ] Usuário criar o app no Meta for Developers
      (https://developers.facebook.com) com a Marketing API habilitada,
      configurar `META_APP_ID`/`META_APP_SECRET`/`ENCRYPTION_KEY` em
      .env.local (e na Vercel, pra produção), e adicionar
      `https://kirozethaii.vercel.app/api/oauth/meta/callback` (e/ou o
      localhost equivalente) nos "URIs de redirecionamento OAuth
      válidos" do app
- [ ] Depois disso disponível: (1) conectar 1 cliente de teste via OAuth
      completo com a API real do Meta; (2) confirmar que o cron (ou o
      botão manual) sincroniza o gasto corretamente com dados reais de
      campanha; (3) testar entrada manual em paralelo; (4) simular ou
      aguardar token expirado de verdade e reconfirmar em condição real
      que o sistema marca "erro" SEM quebrar a sincronização dos
      outros clientes (já validado com token sintético inválido nesta
      sessão — ver Etapa 6 rodada 2 — mas vale reconfirmar com token
      real expirado); (5) documentar como validado

## Problemas Encontrados
- [2026-08-03] Tentativa inicial de reexportar `META_API_VERSION` como
  uma constante nomeada a partir de `.../connect/route.ts` pra
  reaproveitar em `.../callback/route.ts` — um `route.ts` do App Router
  só pode exportar handlers HTTP reconhecidos (GET/POST/etc.) e algumas
  chaves de config (`dynamic`, `revalidate`, `runtime`,
  `maxDuration`...), não constantes arbitrárias (mesma classe de
  restrição já vista na Fase 9 com "use server" e `maxDuration`).
  Resolvido definindo a constante localmente em cada arquivo que precisa
  dela, sem tentar compartilhar via export de route.ts.

## Decisões Tomadas
- **Criptografia implementada (AES-256-GCM), não deixada como "pendência
  de segurança futura"** — o escopo permitia as 2 opções. Optei por
  implementar porque é o 1º segredo de TERCEIRO guardado no banco deste
  projeto (não só em env var), com escopo real de acesso a dados de
  anúncio do cliente — um vazamento do banco (ou de uma service-role
  key) exporia esses tokens em texto puro sem a criptografia. A
  implementação usa só `node:crypto` nativo (sem dependência nova),
  ficou pequena e autocontida (~50 linhas) — o custo de fazer certo
  desde já foi baixo o suficiente pra não justificar adiar.
- **Salt fixo na derivação da chave (scrypt)**, não um salt por
  registro. Aceitável porque `ENCRYPTION_KEY` já é, por si só, um
  segredo de alta entropia gerado 1x pelo usuário — salt por registro é
  essencial contra rainbow tables quando a entrada é uma senha fraca de
  usuário, não o caso aqui.
- **Nonce OAuth num cookie httpOnly de 10 minutos**, verificado contra o
  `state` no callback — proteção padrão contra CSRF em fluxos OAuth
  (sem isso, um atacante poderia iniciar o fluxo com o PRÓPRIO client_id
  dele e enganar a vítima a completá-lo, associando a conta de anúncio
  do atacante ao cliente errado). Não pedido explicitamente no escopo
  ("passando o client_id como state" foi a única instrução), mas é a
  prática padrão de qualquer integração OAuth séria — implementado como
  parte de "não introduzir vulnerabilidade", não como feature extra.
- **1ª ad account é conectada automaticamente quando o login tem mais de
  uma, sem um seletor de UI.** O escopo não pedia esse seletor
  explicitamente, e construir uma tela de "escolha a conta" só pra um
  caso relativamente raro (a maioria dos usuários de agência pequena
  gerencia 1 conta de anúncio por cliente) não parecia proporcional.
  Registrado com um `console.warn` quando acontece, pra não ficar
  silencioso — candidato natural pra uma fase futura se isso incomodar
  na prática.
- **Sem tela global `/financeiro/midia` separada** — o dashboard de
  gasto (Etapa 5) vive só na tela de cada cliente. O pedido da Etapa 5
  ("total consolidado por cliente") já é satisfeito no nível do
  cliente; uma visão cross-cliente teria valor, mas não foi pedida
  explicitamente ("ex: ... ou dentro da tela do cliente" deixava as 2
  opções em aberto) — mantém o escopo desta fase menor, e o padrão já
  estabelecido (Jurídico/Financeiro têm tela global E seção por
  cliente) pode ser estendido aqui numa fase futura se fizer falta.
- **Erro da Graph API tratado genericamente (qualquer status não-2xx
  marca "erro"), não só o código 190 (token inválido) especificamente.**
  O escopo pedia tratar "token expirado/inválido" — generalizei pra
  cobrir também rate limit, conta desativada, permissão revogada etc.,
  já que o comportamento desejado (marcar erro, não quebrar os outros)
  é o mesmo pra qualquer falha da API, e `ultimo_erro` guarda a
  mensagem real pra quem for investigar depois.

---

# Fase 17 — Integração de pagamento real (Asaas)

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260803040000_asaas_schema.sql`: em `clients`,
      `asaas_customer_id` (o customer cadastrado 1x no Asaas, reaproveitado
      em toda cobrança futura desse cliente); em `invoices`,
      `asaas_payment_id`, `asaas_customer_id` (SNAPSHOT de qual customer
      foi usado NESSA cobrança específica — ver Decisões Tomadas sobre por
      que existe nos 2 lugares), `forma_pagamento`
      (`boleto`/`pix`/`cartao`), `link_pagamento`, `boleto_url`.
      `src/lib/supabase/types.ts` atualizado. **PENDENTE: usuário rodar
      esta migration no SQL Editor do Supabase** (confirmado via teste —
      a coluna ainda não existe no banco real)
- [x] Etapa 2 — `src/lib/asaas/client.ts`: `asaasFetch()` (wrapper fetch
      genérico, autenticação via header `access_token` — API v3 do Asaas
      não usa Bearer/OAuth, é assim mesmo), com URL base = Sandbox por
      DEFAULT (`ASAAS_API_URL` só existe como env var opcional pra
      documentar a migração futura pra produção — **NUNCA setada nesta
      fase do projeto**, regra explícita do escopo). `ensureAsaasCustomer()`:
      verifica `clients.asaas_customer_id`; se ausente, cria via
      `POST /customers` (só `name` — a tabela `clients` deste projeto não
      tem campo de e-mail, Fase 1, então o customer é criado sem e-mail;
      a API do Asaas aceita isso, só `name` é obrigatório) e salva o ID
- [x] Etapa 3 — `src/lib/asaas/create-payment.ts`
      (`createAsaasPaymentForInvoice`): busca a invoice + cliente, chama
      `ensureAsaasCustomer`, cria o payment via `POST /payments`
      (`billingType` BOLETO/PIX/UNDEFINED, valor e vencimento da própria
      invoice), salva `asaas_payment_id`/`asaas_customer_id`/
      `forma_pagamento`/`link_pagamento`/`boleto_url` na invoice.
      **Idempotente por invoice**: se ela já tem `asaas_payment_id`, não
      cria outra cobrança — evita cobrança duplicada em clique duplo.
      `src/app/asaas-actions.ts` (`createAsaasPaymentAction`) conecta ao
      botão "Gerar cobrança real (Sandbox)" na tela do cliente
- [x] Etapa 4 — `src/app/api/webhooks/asaas/route.ts`: recebe eventos do
      Asaas (`PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → status "pago" +
      `data_pagamento`; `PAYMENT_OVERDUE` → status "atrasado", só se
      ainda "pendente"), localizando a invoice por `asaas_payment_id`.
      Autenticação: compara o header `asaas-access-token` (que o Asaas
      reenvia em TODO webhook com o valor exato configurado no painel
      deles) contra `ASAAS_WEBHOOK_TOKEN` — sem bater, 401 e a chamada é
      descartada sem processar nada. Payload malformado → 400. Evento
      reconhecido mas sem ação nesta fase (ex.: `PAYMENT_CREATED`) → 200
      sem fazer nada (Asaas reenvia com retry se não receber 200 rápido).
      `src/middleware.ts` atualizado pra excluir `api/webhooks` da
      autenticação de sessão padrão (mesmo motivo/padrão de `api/cron`,
      Fase 9 — o Asaas chama essa rota sem sessão de usuário nenhuma).
      **URL a configurar no painel do Asaas quando a conta existir**
      (Sandbox → Configurações → Webhooks): `https://kirozethaii.vercel.app/api/webhooks/asaas`
- [x] Etapa 5 — `src/components/invoice-list-item.tsx` (extraído de
      `client-billing-section.tsx`, Fase 16, que estava crescendo demais):
      cada fatura tem uma seção de cobrança real independente — se ainda
      não tem `asaas_payment_id`, mostra um seletor de forma de pagamento
      (Pix/Boleto/"Cliente escolhe") + botão "Gerar cobrança real
      (Sandbox)"; se já tem, mostra o link de pagamento, o link do
      boleto (se aplicável) e uma tag **"AMBIENTE DE TESTE (Sandbox)"**
      bem visível, sempre — nunca deixa ambíguo que é uma cobrança de
      teste. `.env.local.example` atualizado com `ASAAS_API_KEY`
      (comentário reforçando "sempre Sandbox"), `ASAAS_API_URL`
      (opcional, comentado como "não configure nesta fase") e
      `ASAAS_WEBHOOK_TOKEN`
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem
      erros (rota nova `/api/webhooks/asaas` aparece no build
      normalmente)
- [x] Etapa 6 — Teste em 2 rodadas, ambas SEM `ASAAS_API_KEY` (que ainda
      não existe — previsto explicitamente no escopo, não é um erro):
      1. **Antes da migration**: chamei o Route Handler do webhook
         diretamente (import direto da função `POST`, sem precisar
         subir o servidor) com 5 cenários — (1) sem header de token →
         401; (2) token errado → 401; (3) token correto + evento não
         reconhecido → 200, ignorado; (4) token correto +
         `PAYMENT_RECEIVED` pra um `payment_id` inexistente (e a coluna
         nem existindo ainda) → **200 mesmo assim**, erro só logado, não
         derruba a resposta; (5) token correto + corpo JSON malformado →
         400. Os 5 bateram exatamente com o esperado
      2. **Depois da migration aplicada pelo usuário**: criei uma
         invoice de teste real, simulei manualmente os campos que
         `createAsaasPaymentForInvoice` teria salvo (sem precisar da API
         — só pra testar o resto do fluxo); chamei
         `createAsaasPaymentForInvoice` de novo pra essa mesma invoice
         → confirmado que ela **não tenta rede nenhuma** (não lançou o
         erro de "ASAAS_API_KEY não configurada" que lançaria se
         tentasse), só devolveu os dados já salvos — idempotência
         confirmada de verdade; chamei o webhook com `PAYMENT_RECEIVED`
         pra essa invoice → **status virou "pago" e `data_pagamento` foi
         setado, de verdade no banco**. Invoice de teste (sintética,
         payment_id fake) removida ao final.
      **Único pedaço que genuinamente precisa da API real e não pôde ser
      testado**: a chamada de verdade pra `POST /customers` e
      `POST /payments` (criar a cobrança em si) — tudo o resto do fluxo
      (schema, idempotência, webhook recebendo e atualizando status) já
      está validado.

## Pendente
- [ ] Usuário criar a conta Sandbox do Asaas
      (https://sandbox.asaas.com), gerar a API key e configurar
      `ASAAS_API_KEY` + `ASAAS_WEBHOOK_TOKEN` em .env.local (e nas env
      vars da Vercel, quando for testar em produção)
- [ ] Configurar a URL do webhook no painel do Asaas Sandbox
      (Configurações → Webhooks): `https://kirozethaii.vercel.app/api/webhooks/asaas`,
      com o mesmo valor de `ASAAS_WEBHOOK_TOKEN` no campo "Token de
      autenticação"
- [ ] Depois de tudo isso disponível: (1) criar uma cobrança de teste via
      Pix ou boleto no Sandbox, a partir de uma invoice real; (2)
      confirmar manualmente o pagamento pela interface do Sandbox
      (botão "CONFIRMAR PAGAMENTO" — não existe endpoint de API pra
      isso, é assim mesmo no Sandbox do Asaas); (3) confirmar que o
      webhook atualiza a invoice pra "pago" automaticamente, sem
      nenhuma ação manual no Kirozeth; (4) documentar como validado

## Problemas Encontrados
(nenhum problema técnico nesta fase — só a ausência esperada de
`ASAAS_API_KEY`, já prevista no escopo, documentada acima e em Pendente)

## Decisões Tomadas
- **`asaas_customer_id` existe tanto em `clients` (canônico, "o customer
  atual desse cliente") quanto em `invoices` (snapshot, "o customer
  usado NESSA cobrança específica").** Pedido explicitamente assim no
  escopo (listado nos 2 lugares). Mesmo espírito de
  `client_documents.conteudo_final` (Fase 15): a maioria das vezes os 2
  valores são idênticos (um cliente só tem 1 customer no Asaas), mas
  manter os 2 evita que uma fatura antiga fique referenciando o
  customer errado numa hipótese rara de re-cadastro do cliente no Asaas
  no futuro.
- **`ASAAS_API_URL` como env var opcional, com o default JÁ sendo
  Sandbox no código** (não uma env var obrigatória que alguém precisa
  lembrar de setar pra Sandbox). Regra do escopo é taxativa: "SEMPRE
  Sandbox nesta fase — nunca produção, mesmo que a chave de produção
  esteja disponível depois". Deixar o comportamento SEGURO como default
  (sem precisar de nenhuma configuração) e a mudança pra produção como
  algo que exigiria uma ação explícita (setar uma env var que o
  .env.local.example deixa claro "não configure nesta fase") é mais
  seguro contra erro humano do que o contrário.
- **Tag "AMBIENTE DE TESTE (Sandbox)" fixa, sempre visível, sem opção de
  esconder** — pedido explícito do escopo ("nunca confundir com
  cobrança real depois"). Não fica atrás de nenhum toggle nem
  configuração — enquanto o projeto estiver usando a URL de Sandbox
  (sempre, nesta fase), a tag aparece.
- **`createAsaasPaymentForInvoice` idempotente por invoice** (checa
  `asaas_payment_id` antes de criar) — não pedido explicitamente no
  escopo, mas necessário pra evitar 2 cobranças reais pro mesmo valor se
  o usuário clicar o botão 2x (ex.: duplo clique, ou re-tentativa depois
  de uma resposta lenta). Um efeito colateral financeiro (ainda que em
  Sandbox) não deveria depender só de "o usuário não vai clicar 2x".
- **Webhook sempre responde 200 pra eventos reconhecidos mas não
  tratados, e também quando a atualização na invoice falha
  internamente** (só loga o erro). Documentado na doc do próprio Asaas:
  não receber 200 rapidamente faz o Asaas reenviar o mesmo evento com
  retry, e desativar o webhook depois de falhas repetidas — devolver
  erro pra algo que não é realmente um problema do lado de quem chama
  (ex.: um evento que não processamos, ou uma invoice que já não existe
  mais) quebraria essa expectativa sem necessidade.
- **`client-billing-section.tsx` (Fase 16) refatorado**, extraindo a
  renderização de cada fatura pra `invoice-list-item.tsx` novo. Motivo:
  o arquivo já estava carregando 3 responsabilidades (config de
  cobrança, fatura avulsa, lista de faturas) e a Fase 17 adicionaria uma
  4ª (cobrança real) só na lista — extrair a lista pra seu próprio
  componente, com seu próprio estado local por fatura (forma de
  pagamento escolhida, pending da chamada ao Asaas), evita que o
  componente pai fique gigante e mistura estado de itens de lista
  diferentes numa única função.

---

# Fase 16 — Módulo financeiro (faturamento, sem pagamento real)

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260803030000_billing_schema.sql`:
      `client_billing` (id, client_id, tipo_cobranca `fixa`/`variavel`,
      valor_fixo, dia_vencimento 1-31, ativo, criado_em, atualizado_em —
      com constraint `client_billing_fixa_completa` garantindo que
      tipo "fixa" sempre tem valor_fixo E dia_vencimento preenchidos) e
      `invoices` (id, client_id, client_billing_id nullable —
      `on delete set null`, cobrança avulsa nunca tem —, descricao,
      valor, data_vencimento, status `pendente`/`pago`/`atrasado`/
      `cancelado`, data_pagamento, criado_em). RLS padrão do projeto.
      `src/lib/supabase/types.ts` atualizado (`ClientBilling`, `Invoice`
      exportados). **PENDENTE: usuário rodar esta migration no SQL
      Editor do Supabase** (confirmado via teste — a tabela ainda não
      existe no banco real)
- [x] Etapa 2 — `createVariableInvoiceAction` (`src/app/billing-actions.ts`):
      cria uma invoice avulsa com descrição livre, valor e vencimento
      informados no formulário, `client_billing_id` sempre null (não
      está ligada a nenhuma cobrança recorrente)
- [x] Etapa 3 — `src/lib/billing/date-utils.ts` (funções puras, tudo em
      UTC explícito — mesmo cuidado da Fase 10 com fuso horário) +
      `src/lib/billing/generate-monthly-invoices.ts`: pra cada
      `client_billing` ativo tipo "fixa", calcula o vencimento deste mês
      (`dia_vencimento` "clampado" pro último dia do mês em meses mais
      curtos — dia 31 em fevereiro vira 28 ou 29) e cria a fatura se (a)
      ainda não existe uma pra esse client_billing neste mês E (b)
      `hoje >= vencimento - 5 dias`. **5 dias de antecedência** (decisão
      documentada abaixo) e condição `>=` (não `==`), pra tolerar o cron
      não rodar exatamente no dia certo. Conectado a
      `src/lib/cron/daily-job.ts` (Fase 8) — roda em sequência com o
      resto do job, falha aqui não derruba o resultado do calendário/Groq
- [x] Etapa 4 — `src/lib/billing/mark-overdue-invoices.ts`: marca
      "atrasado" toda invoice com status ainda "pendente" e
      data_vencimento no passado — só mexe em "pendente" (uma fatura
      "paga"/"cancelada" vencida não é tocada). Também no `daily-job.ts`.
      `markInvoicePaidAction` (billing-actions.ts): marca manualmente
      como "pago" — `data_pagamento` é o momento do clique, não uma data
      informada pelo usuário (mais simples, e não dá pra validar uma data
      alegada sem integração real de pagamento de qualquer forma)
- [x] Etapa 5 — `src/lib/billing/invoice-template.ts`
      (`renderInvoiceHtml`): template de fatura em CÓDIGO, não editável
      via UI como os modelos jurídicos da Fase 15 (é um documento
      estruturado/computado, não texto livre — ver Decisões Tomadas).
      Reaproveita 100% a infraestrutura de PDF da Fase 15
      (`renderHtmlToPdfBuffer`, `montarDocumentoHtml`) — zero código novo
      de PDF, só o conteúdo HTML muda. Rota
      `src/app/api/invoices/[id]/pdf/route.ts` (mesmo padrão dos Route
      Handlers de documento da Fase 15)
- [x] Etapa 6 — `src/app/financeiro/page.tsx`: lista todas as faturas
      (filtro por status via query string), totais (recebido/pendente/
      atrasado — SEMPRE sobre todas as faturas, não sobre a lista
      filtrada, pra não distorcer o resumo), botões de disparo manual dos
      2 jobs do cron (`BillingCronButtons` — mesmo padrão de
      "Sincronizar feriados", Fase 2/8). `ClientBillingSection`
      (`src/components/client-billing-section.tsx`) na tela do cliente:
      formulário de configuração de cobrança (fixa/variável, upsert),
      formulário de fatura avulsa, histórico de faturas do cliente com
      "Marcar pago" e download de PDF por fatura. Link "Financeiro"
      adicionado na home
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem
      erros. 1 erro de tipo corrigido no caminho — ver Problemas
      Encontrados (status de query string precisa de validação antes de
      virar filtro tipado)
- [x] Etapa 7 — Teste ponta a ponta, em 2 rodadas:
      1. **Local, sem banco** (antes da migration ser aplicada):
         `calcularVencimentoDoMes` com dia 31 em fevereiro (não
         bissexto) → 28 corretamente; dia 31 em mês de 31 dias → 31 sem
         alterar; `diasAntes` cruzando virada de mês e virada de ano,
         ambos corretos; gerei o PDF de uma fatura de exemplo
         (inspecionado visualmente — número, cliente, descrição, valor
         formatado em R$, vencimento, status e o aviso de pagamento
         manual, tudo correto)
      2. **Contra o banco real**, depois do usuário rodar a migration:
         configurei cobrança FIXA de verdade pro cliente real "Cliente
         Aniversário Teste" (dia_vencimento = dia de hoje, pra já cair
         na janela de antecedência); chamei `generateMonthlyInvoices`
         diretamente (mesma função do botão manual/cron) → 1 fatura
         gerada, valor e vencimento corretos; **rodei de novo
         imediatamente** — 0 faturas geradas na 2ª vez, confirmando o
         dedup mensal (não duplica fatura pro mesmo client_billing no
         mesmo mês); criei uma fatura VARIÁVEL avulsa; gerei o PDF das
         2 (inspecionei visualmente a da fixa — R$ 1.990,50, cliente
         real, vencimento certo); **simulei uma fatura vencida** (data
         `2020-01-01`, status inicial "pendente") e chamei
         `markOverdueInvoices` → confirmado que o status virou
         "atrasado". Fatura de teste do atraso apagada ao final (as
         faturas fixa/variável reais ficaram no banco).
      **Fase 16 validada.** A cobrança fixa configurada e as 2 faturas
      (fixa + variável) geradas nesse teste ficam no banco, claramente
      identificáveis pelo cliente/descrição — o usuário pode apagar
      quando quiser.

## Pendente
(nenhum — commit/push desta fase aguardando confirmação do usuário)

## Problemas Encontrados
- [2026-08-03] `.claude/skills/finance` (citado no escopo) não existe
  com esse nome. Busquei skills financeiros disponíveis:
  `cash-flow-snapshot`, `financial-statements`, `invoice-chase`,
  `revops` — nenhum é especificamente sobre desenhar um schema de
  faturamento recorrente. `invoice-chase` (cobrança de faturas
  atrasadas via QuickBooks/PayPal, com categorização por tempo de
  atraso) foi o mais próximo conceitualmente — usado só como referência
  de que "status por tempo de atraso" é um padrão comum, não como fonte
  de nenhuma implementação (não tem integração com QuickBooks/PayPal
  nem envio de cobrança nesta fase).
- [2026-08-03] `npx tsc --noEmit` acusou erro em `/financeiro`: o
  `status` vindo de `searchParams` é `string | undefined` genérico, mas
  a coluna `invoices.status` no banco é uma união de literais — passar a
  string direto pro `.eq("status", status)` não tipa. Resolvido com uma
  função `isInvoiceStatus()` que valida contra o `Set` de valores
  aceitos antes de usar como filtro (também é uma proteção real, não só
  type-safety: um valor arbitrário na URL nunca vira filtro de banco sem
  bater com um status válido primeiro).

## Decisões Tomadas
- **5 dias de antecedência pra gerar a fatura mensal fixa.** Tempo
  suficiente pro cliente ver a fatura e se organizar sem confundir com
  o mês anterior (gerar cedo demais) nem deixar sem folga nenhuma até o
  vencimento (gerar tarde demais). Não é um número validado com o
  usuário — é um padrão razoável, documentado explicitamente pra poder
  ser ajustado fácil se não fizer sentido na prática (é uma única
  constante, `DIAS_ANTECEDENCIA_GERACAO`, em
  generate-monthly-invoices.ts).
- **Condição `hoje >= vencimento - N dias` (não `hoje == vencimento - N
  dias`) pra decidir se gera a fatura.** Um cron que roda 1x por dia
  pode falhar de rodar num dia específico (deploy, instabilidade
  temporária). Com `==`, perder o dia exato significaria nunca gerar a
  fatura daquele mês; com `>=`, a próxima execução do cron ainda gera,
  contanto que o vencimento não tenha passado (depois disso,
  markOverdueInvoices assume).
- **Template de fatura em código (`invoice-template.ts`), não editável
  via UI como os modelos jurídicos (Fase 15, `document_templates`).**
  Uma fatura é um documento COMPUTADO (número, cliente, valor, data —
  tudo derivado de `invoices`/`clients`), diferente de um contrato/termo
  que é texto livre com placeholders. Não faz sentido "editar o HTML de
  uma fatura" campo a campo — os únicos valores que mudam são os dados
  estruturados, que já vêm do banco. Reaproveitar a infraestrutura de
  PDF da Fase 15 (não duplicar) sim; reaproveitar o padrão de "modelo
  editável no banco" não.
- **`client_billing` sem constraint de unicidade por `client_id`** — "no
  máximo 1 configuração por cliente" é aplicado em CÓDIGO
  (`upsertClientBillingAction` faz upsert manual: busca se já existe,
  atualiza; senão, insere), não no banco. Motivo: manter simples — uma
  constraint `unique(client_id)` funcionaria igual pro caso de uso atual,
  mas a Server Action já garante o comportamento certo, e uma constraint
  a mais é uma migration a mais pra um cenário que já está coberto.
- **Botões de disparo manual dos 2 jobs do cron
  (`generateMonthlyInvoicesAction`/`markOverdueInvoicesAction`) expostos
  em `/financeiro`**, mesmo já rodando automaticamente no cron diário.
  Mesmo padrão já estabelecido nas Fases 2/8 (botões "Sincronizar
  feriados"/"Verificar datas comemorativas" ao lado do cron
  correspondente) — pedido explícito da Etapa 7 ("forçar a geração sem
  esperar o cron") também vira uma ferramenta permanente de teste/
  fallback pro usuário, não só algo usado uma vez nesta sessão.
- **`data_pagamento` é o momento do clique em "Marcar pago", não uma
  data escolhida pelo usuário.** Sem integração de pagamento real
  (Fase 17), não há como confirmar uma data alegada — "quando eu marquei
  isso como pago" é a informação confiável disponível agora; um campo de
  data editável passaria uma falsa sensação de precisão sobre quando o
  pagamento realmente aconteceu.

---

# Fase 15 — Módulo jurídico (contratos, termos, política)

## Concluído
- [x] Etapa 1 — Migration
      `supabase/migrations/20260803020000_document_templates_schema.sql`:
      `document_templates` (id, tipo `contrato`/`termos_uso`/
      `politica_privacidade`, nome, conteudo_html, criado_em, atualizado_em)
      e `client_documents` (id, client_id nullable — null pra documentos do
      sistema, sem cliente —, document_template_id nullable com
      `on delete set null`, titulo, conteudo_final, status
      `rascunho`/`gerado`/`assinado`, gerado_em). RLS padrão do projeto.
      `atualizado_em` NÃO usa o trigger `set_updated_at()` (Fase 1) porque
      essa função grava especificamente em `new.updated_at` — setado
      explicitamente pela Server Action de edição, mesmo padrão já usado
      pra timestamps de domínio no projeto (`imagem_gerada_em` etc.).
      `src/lib/supabase/types.ts` atualizado com as 2 tabelas novas
      (`DocumentTemplate`, `ClientDocument` exportados). **PENDENTE:
      usuário rodar esta migration no SQL Editor do Supabase** (confirmado
      via teste — a tabela ainda não existe no banco real)
- [x] Etapa 2 — Seed com 3 modelos-base na própria migration: contrato de
      prestação de serviço genérico (9 cláusulas: objeto, valor/pagamento,
      vigência, obrigações das 2 partes, confidencialidade, propriedade
      intelectual, rescisão, foro — estrutura baseada nas categorias de
      risco dos skills de revisão de contrato já instalados no projeto,
      ver Problemas Encontrados sobre não existir um skill "legal" com
      esse nome nem de REDAÇÃO de contrato), termos de uso e política de
      privacidade do Kirozeth AI (política menciona LGPD de forma
      genérica). Placeholders `{{nome_cliente}}`, `{{servico}}`,
      `{{valor}}`, `{{vigencia}}`, `{{cidade}}`, `{{data_atual}}`
      (contrato) e `{{nome_empresa}}`, `{{data_atual}}`,
      `{{email_contato}}`, `{{url_sistema}}` (termos/política). **TODO O
      TEXTO É REFERÊNCIA GENÉRICA, NÃO VALIDADA JURIDICAMENTE** — aviso
      replicado na migration (comment), no PROGRESS.md e na UI
      (`/juridico` e na tela do cliente)
- [x] Etapa 3 — `src/lib/documents/fill-template.ts`: `fillTemplate()`
      substitui `{{chave}}` pelo valor (escapado via `escapeHtml`, Fase
      10, contra HTML/script injection vindo de um campo de formulário);
      chave sem valor correspondente fica visível no resultado
      (`{{chave}}` não removida), sinalizando um placeholder esquecido em
      vez de virar string vazia silenciosa. `getSystemFillValues()`
      (dados fixos do Kirozeth AI) e `getClientFillValues()` (nome/cidade
      do cliente via `clients`/`client_dna` + servico/valor/vigencia
      vindos do formulário — esses 3 não têm fonte no banco, são termos
      negociados por contrato). `src/app/juridico-actions.ts`:
      `generateClientDocumentAction`/`generateSystemDocumentAction`
      (preenchem + salvam o snapshot em `client_documents`) e
      `updateDocumentTemplateAction` (edita um modelo-base)
- [x] Etapa 4 — `src/lib/render/browser.ts`: `abrirBrowser()` extraído de
      `generate-image.ts` (Fase 3/9) pra ser reaproveitado também pela
      geração de PDF, sem duplicar a lógica de detecção
      Vercel/@sparticuz/local/Chrome. `src/lib/documents/document-layout.ts`
      (`montarDocumentoHtml`, CSS de documento A4 — tipografia de leitura,
      bem diferente do canvas fixo dos posts) +
      `src/lib/documents/generate-pdf.ts` (`renderHtmlToPdfBuffer`, usa
      `page.pdf()` em vez de `page.screenshot()`, formato A4, margens
      2cm/2.5cm)
- [x] Etapa 5 — Biblioteca `docx` (dolanmiu/docx) instalada — decisão
      documentada em Decisões Tomadas (não `html-to-docx`, que costuma
      assumir DOM de navegador, frágil em serverless Node).
      `src/lib/documents/generate-docx.ts`: conversor HTML→docx MÍNIMO e
      deliberado via regex (não uma lib de parsing HTML genérica) — só
      cobre o subconjunto de tags que os modelos jurídicos realmente usam
      (h1, h2, p, ul/li, hr, strong, em, br), escrito/editado só via
      `/juridico/modelos`, não HTML arbitrário de terceiros
- [x] Etapa 6 — `src/app/juridico/page.tsx`: lista os 3 modelos-base (link
      "Editar" cada um), gera termos de uso/política (botão "Gerar novo"
      por modelo, `SystemDocumentGenerator`) e lista TODOS os documentos
      já gerados (sistema + por cliente, nome do cliente resolvido via
      consulta separada + Map em JS — mesmo padrão do resto do projeto,
      não usei embedded resource/join do PostgREST porque
      `supabase/types.ts` é mantido à mão sem `Relationships`, arriscaria
      o mesmo tipo de erro de inferência já visto na Fase 12).
      `src/app/juridico/modelos/[id]/page.tsx` +
      `src/components/template-edit-form.tsx`: edição do nome +
      conteudo_html (textarea) de um modelo-base. Tela do cliente
      (`clientes/[id]/page.tsx`) ganhou a seção "Documentos jurídicos"
      (`src/components/contract-generator.tsx`): formulário
      servico/valor/vigencia (servico pré-preenchido com
      `client_dna.produtos` como sugestão) + geração + prévia (iframe com
      o mesmo HTML/CSS usado no PDF, visual idêntico) + links de
      download PDF/Word + lista dos documentos já gerados pra ESSE
      cliente. Aviso jurídico visível tanto em `/juridico` quanto na
      seção do cliente. Link "Jurídico" adicionado na home
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem erros
      (rotas novas `/juridico`, `/juridico/modelos/[id]`,
      `/api/documents/[id]/pdf`, `/api/documents/[id]/docx` aparecem no
      build normalmente). 2 erros de tipo corrigidos no caminho — ver
      Problemas Encontrados (Buffer não é `BodyInit` direto pro
      TypeScript)
- [x] Etapa 7 — Teste ponta a ponta, em 2 rodadas:
      1. **Local, sem banco** (antes da migration ser aplicada): montei o
         HTML do modelo de contrato manualmente, chamei `fillTemplate()`
         com dados de teste, gerei o PDF (inspecionado visualmente via
         Read — título, cláusulas, placeholders preenchidos corretamente,
         quebra de página razoável) e o .docx (validado descompactando o
         arquivo como ZIP e conferindo o texto dentro de
         `word/document.xml` — mesmo conteúdo do PDF, headings e negrito
         corretos)
      2. **Contra o banco real**, depois do usuário rodar a migration:
         confirmados os 3 modelos-base (seed); gerado 1 contrato REAL pra
         um cliente REAL já cadastrado ("Cliente Aniversário Teste" /
         "Imóveis Teste Ltda", segmento imobiliário — confirma que o
         contrato é de verdade genérico, não hardcoded pra um nicho),
         PDF exportado e inspecionado visualmente: 9 cláusulas completas,
         `{{nome_cliente}}`/`{{servico}}`/`{{valor}}`/`{{vigencia}}`
         preenchidos com os dados do teste, e `{{cidade}}` corretamente
         caindo no fallback `[cidade]` (esse cliente de teste não tem
         cidade em client_dna) em vez de quebrar; gerados termos de uso e
         política de privacidade (documentos do sistema, client_id null),
         PDF e Word exportados dos 2; **teste de imutabilidade do
         snapshot**: editei o modelo de contrato no banco (marca
         "VERSÃO EDITADA NO TESTE" no título), gerei um documento NOVO a
         partir do modelo editado (confirmado: contém a marca) e
         reconferi o documento gerado ANTES da edição (confirmado: NÃO
         contém a marca, manteve o texto original) — comportamento exato
         pedido no escopo. Modelo revertido ao texto original ao final.
      **Fase 15 validada.** Os documentos de teste gerados (1 contrato +
      termos + política) ficam no banco, claramente identificáveis pelo
      título — o usuário pode apagar quando quiser.

## Pendente
(nenhum — commit/push desta fase aguardando confirmação do usuário)

## Problemas Encontrados
- [2026-08-03] `.claude/skills/legal` (citado no escopo) não existe com
  esse nome. Busquei skills jurídicos disponíveis: `contract-review`,
  `review-contract`, `legal-response`, `legal-risk-assessment`,
  `triage-nda` — todos são de REVISÃO de contrato existente (achar
  riscos numa análise), nenhum de REDAÇÃO de contrato/termos/política do
  zero. Usei as categorias de risco do `contract-review` (pagamento,
  propriedade intelectual, confidencialidade, rescisão etc.) como
  checklist estrutural de quais cláusulas um contrato de prestação de
  serviço deveria cobrir — não como fonte do texto jurídico em si, que
  não veio de nenhum skill.
- [2026-08-03] `npx tsc --noEmit` acusou erro nos 2 Route Handlers de
  exportação: `Buffer<ArrayBufferLike>` não é atribuível a `BodyInit`
  diretamente (o TypeScript não aceita `Buffer` como argumento de
  `new NextResponse(buffer, ...)` mesmo `Buffer` sendo estruturalmente um
  `Uint8Array`). Resolvido envolvendo em `new Uint8Array(buffer)` nos 2
  Route Handlers (pdf e docx) — mesma técnica, sem custo de performance
  relevante (só reembrulha a view, não copia os bytes numa alocação
  separada de forma cara).

## Decisões Tomadas
- **Biblioteca `docx` (dolanmiu/docx) + parser HTML→docx próprio via
  regex, não `html-to-docx`.** `html-to-docx` (e libs parecidas)
  costumam assumir um ambiente de navegador (`DOMParser` etc.), o que é
  arriscado num ambiente serverless Node (Vercel) — o mesmo tipo de
  problema já visto com Puppeteer completo vs. `puppeteer-core` (Fase
  9). `docx` é puramente JS (monta o documento via API
  Paragraph/TextRun), sem esse risco. Como os modelos jurídicos usam só
  um subconjunto pequeno e CONHECIDO de tags HTML (a própria equipe
  escreve/edita via `/juridico/modelos`, não é HTML arbitrário de
  terceiros), um parser via regex é seguro e evita adicionar uma
  dependência de parsing HTML só pra esse conjunto restrito.
- **`servico`/`valor`/`vigencia` vêm de um formulário na hora de gerar o
  contrato, não de `client_dna`.** São termos negociados por CONTRATO
  específico, não um dado geral do cadastro do cliente — `client_dna`
  guarda characteristics gerais (tom de voz, público-alvo, produtos),
  não "o valor deste contrato específico". `client_dna.produtos` é usado
  só como SUGESTÃO pré-preenchida pro campo "serviço", editável antes de
  gerar.
- **Dados da "CONTRATADA" (a agência que usa o Kirozeth AI) ficam como
  texto fixo no PRÓPRIO modelo-base**, editável em `/juridico/modelos`,
  em vez de um placeholder `{{}}` preenchido a cada geração. Motivo: o
  projeto é single-tenant (Fase 1) — não existe uma tabela "minha
  empresa"/perfil da agência, e criar uma só pra isso seria escopo além
  do pedido. Como a razão social/CNPJ da agência não muda entre
  contratos (diferente de servico/valor/vigencia, que mudam por
  cliente), faz mais sentido editar isso uma vez no modelo do que pedir
  de novo a cada geração.
- **Nenhuma seleção de PDF/Word feita via Server Action — Route Handlers
  dedicados (`/api/documents/[id]/pdf`, `/docx`) em vez disso.** Server
  Actions devolvem valores serializados pro React, não uma resposta HTTP
  com `Content-Disposition: attachment` — pra um download de arquivo de
  verdade (nome de arquivo, tipo MIME corretos, funciona com `<a
  href download>` sem JavaScript), um Route Handler é o padrão certo do
  App Router. Protegidas automaticamente pelo middleware de autenticação
  padrão (não estão na lista de exceções do matcher, diferente de
  `api/cron` — Fase 9).
- **`document_template_id` em `client_documents` usa `on delete set
  null`, não `cascade`.** Apagar um modelo-base não deveria apagar
  documentos JÁ GERADOS a partir dele — o conteúdo relevante
  (`conteudo_final`) já é um snapshot independente, então o documento
  gerado continua fazendo sentido e devendo existir mesmo que o
  modelo-base que o originou seja removido depois.
- **`status` de `client_documents` sempre `gerado` nesta fase** (default
  da coluna) — `rascunho` e `assinado` existem como valores aceitos pro
  campo já estar pronto pra um fluxo de assinatura digital futuro, mas
  nenhum código desta fase produz esses 2 estados; não há fluxo de
  "salvar rascunho antes de gerar" nem de assinatura pedido no escopo.

---

# Fase 14 — Configuração de design editável (sem redeploy)

## Concluído
- [x] Etapa 1 — Inventário: revisão de shared.ts + os 6 templates/formatos
      que o usam. 9 chaves viraram configuráveis (todas vindas de
      pickFontSize/resolveBackground/resolveAccentColor, os 3 pontos que a
      Fase 13 tinha acabado de calibrar): `font_size_scale` (as 5 faixas
      de pickFontSize), `gradiente_angulo`, `gradiente_brilho_opacidade`,
      `gradiente_vinheta_opacidade` (os 3 parâmetros novos da Fase 13),
      `fundo_fallback_cor1`/`fundo_fallback_cor2`/`texto_cor_fallback`
      (fallback do resolveBackground sem marca), `texto_cor_limiar_luminancia`
      (limiar do pickTextColor) e `acento_fallback_constelacao`/
      `acento_fallback_estatistica` (fallback do resolveAccentColor por
      template). Deliberadamente FORA da lista: constantes estruturais
      específicas de cada template (tamanho da grade/anéis/cantos da
      constelação, tamanho das aspas do cartão, posição do badge do
      carrossel etc.) — são identidade visual/layout, não "cor de marca
      ajustável", e o próprio escopo desta fase pedia só migrar "cores de
      fallback, limites de pickFontSize, parâmetros de gradiente/vinheta",
      não reescrever cada template
      **Achado incidental (não corrigido, fora do escopo desta fase):**
      `constelacao.ts` chama `resolveAccentColor(null, null, ...)` — nunca
      passa `corPrimaria`/`corSecundaria` de verdade, sempre cai no
      fallback, mesmo quando o cliente tem marca configurada. Contradiz o
      comentário do próprio arquivo ("a cor do cliente aparece... como
      acento"). Já existia antes da Fase 13/14 (não fui eu quem introduziu);
      só troquei o literal `"#a855f7"` pela config, preservando o
      comportamento atual — corrigir isso mudaria aparência visual de
      verdade pra clientes com marca configurada usando o template
      Constelação, o que é uma decisão de comportamento, não de
      configuração, e por isso fica fora desta fase. Reportado ao usuário
      no chat; candidato natural pra uma fase futura pequena
- [x] Etapa 2 — Migration
      `supabase/migrations/20260803010000_design_config_schema.sql`:
      tabela `design_config` (chave text primary key, valor jsonb, descricao
      text, updated_at) — RLS padrão do projeto (`auth.uid() is not null`),
      trigger de `updated_at` reaproveitando `set_updated_at()` (Fase 1).
      Seed via `insert ... on conflict (chave) do nothing` com os 9 valores
      EXATOS da Fase 13 (nenhuma mudança de resultado visual na transição).
      `src/lib/supabase/types.ts` atualizado com a tabela nova
      (`DesignConfigRow` exportado). Migration rodada pelo usuário no SQL
      Editor — confirmado via consulta direta: as 10 linhas existem, com
      os valores seed batendo exatamente com `DEFAULT_DESIGN_CONFIG`
- [x] Etapa 3 — `src/lib/render/design-config.ts`: `getDesignConfig(supabase)`
      busca as 10 linhas de `design_config`, valida CADA chave
      individualmente pelo tipo esperado antes de aplicar (uma linha
      corrompida ou com o shape errado só deixa aquela chave específica no
      default, não derruba as outras 9), e cai pros valores de
      `DEFAULT_DESIGN_CONFIG` (shared.ts) em qualquer erro de rede/consulta,
      sem lançar exceção. Cache em memória de 5 minutos (`CACHE_TTL_MS`)
      evita bater no banco a cada imagem gerada. **Testado de verdade**
      (não simulado): como a migration ainda não foi aplicada nesta sessão,
      chamei `getDesignConfig()` contra o banco real SEM a tabela existir —
      confirmou fallback exato pro `DEFAULT_DESIGN_CONFIG` (comparação
      profunda) com o warning esperado no console, e **gerei uma imagem
      real** (`generateImageForApprovedPost`) nessas mesmas condições —
      completou normalmente (Puppeteer + Storage + update no banco), a
      falta da tabela não quebrou a geração em nenhum ponto. Essa é
      literalmente a condição que a Etapa 6 pedia pra "simular" — não
      precisei simular nada, era o estado real do banco no momento do teste
- [x] Etapa 4 — `TemplateParams` (types.ts) ganhou o campo opcional
      `designConfig`; `pickFontSize`/`resolveBackground`/`pickTextColor`
      (shared.ts) agora recebem `config: DesignConfig = DEFAULT_DESIGN_CONFIG`
      como último parâmetro (compatível com qualquer chamador que não
      passe nada — inclusive `visual-dna-form.tsx`, que não foi alterado,
      ver Decisões Tomadas). Os 4 templates + Story + Carrossel
      desestruturam `designConfig` de `TemplateParams` (com o mesmo
      default) e repassam pros helpers de shared.ts. `generate-post-image.ts`/
      `generate-story-image.ts`/`generate-carousel.ts` chamam
      `getDesignConfig(supabase)` uma vez por geração e passam o resultado
      no `designConfig` de cada `render()`
- [x] Etapa 5 — `src/app/design-config-actions.ts`
      (`updateDesignConfigAction`, Server Action com FormData, mesmo padrão
      de `visual-actions.ts`): valida cada chave pelo tipo (cor hex, número,
      ou JSON de faixas) ANTES de gravar — um valor inválido não é salvo,
      erro é reportado. Chama `limparCacheDesignConfig()` depois de salvar
      com sucesso, pra a mudança valer JÁ na próxima geração no mesmo
      processo, sem esperar os 5 minutos do cache. `src/components/
      design-config-form.tsx` (Client Component): um campo por chave, tipo
      de input conforme `cor`/`numero`/`json` (a escala de fonte fica como
      textarea JSON — não valia a pena construir um editor de tabela
      dedicado pra 1 campo estruturado, "tela simples" era o pedido).
      `src/app/configuracoes/design/page.tsx` (Server Component) busca as
      linhas e renderiza o form, com texto explícito deixando claro que é
      configuração GLOBAL, diferente da identidade visual por cliente
      (client_dna). Link "Configuração de design (global)" adicionado na
      home, ao lado do botão "Sincronizar feriados" (outro botão global já
      existente)
- [x] Validação de código: `npx tsc --noEmit` e `npm run build` sem erros
      (rota nova `/configuracoes/design` aparece no build normalmente)
- [x] Etapa 6 — Teste ponta a ponta, depois do usuário rodar a migration:
      (1) `getDesignConfig()` contra a tabela real com o seed → valores
      batem exatamente com `DEFAULT_DESIGN_CONFIG`, confirmado por
      comparação campo a campo; (2) render do template clássico com essa
      config (cliente ErizonAI, cores reais) → visualmente idêntico ao
      resultado da Fase 13 (mesmo ângulo de gradiente 150°, mesmo
      brilho/vinheta); (3) mudei `gradiente_angulo` (150→30) e
      `acento_fallback_estatistica` (`#22d3ee`→`#ff0000`) direto na
      tabela (mesma operação que a tela faz) + `limparCacheDesignConfig()`
      (mesma chamada que a Server Action faz depois de salvar) → gerei as
      imagens de novo: o degradê girou pra uma diagonal visivelmente
      diferente, e a tag/brilho da estatística saíram vermelhos — as 2
      mudanças refletiram imediatamente, sem nenhum deploy; (4) valores de
      teste revertidos ao seed original logo em seguida (confirmado por
      nova leitura). **Fase 14 validada.**

## Pendente
(nenhum — commit/push desta fase aguardando confirmação do usuário)

## Problemas Encontrados
- [2026-08-03] Ver "Achado incidental" na Etapa 1 acima — bug pré-existente
  em `constelacao.ts` (`resolveAccentColor(null, null, ...)` nunca usa a
  cor real do cliente). Não corrigido nesta fase, reportado ao usuário.

## Decisões Tomadas
- **`visual-dna-form.tsx` (prévia ao vivo da tela de identidade visual)
  NÃO foi conectado a `getDesignConfig()`.** Ele é um Client Component e
  chama `resolveBackground` direto pra desenhar a prévia enquanto o
  usuário ajusta cor/logo — buscar a config real exigiria um fetch
  cliente-servidor adicional (client Supabase + estado de loading) só
  pra essa prévia, que não foi pedido explicitamente no escopo. Ela
  continua usando `DEFAULT_DESIGN_CONFIG` (os valores da Fase 13) via o
  parâmetro default de `resolveBackground` — só fica "desatualizada" se
  alguém mudar a configuração global pela tela nova, um cenário
  específico que pode ser resolvido numa fase futura se isso incomodar
  na prática.
- **Textarea de JSON bruto pra `font_size_scale`, não um editor de tabela
  com uma linha por faixa.** É o único valor "estruturado" das 10 chaves
  — construir um editor dedicado (adicionar/remover faixa, validação por
  campo) só pra esse 1 caso não se justificava dado o pedido de "tela
  simples"; um textarea com o JSON + validação de shape no save (Server
  Action) já impede salvar algo que quebraria `pickFontSize`.
- **`limparCacheDesignConfig()` chamado depois de todo save bem-sucedido**,
  em vez de deixar o cache de 5 minutos expirar sozinho. O pedido da
  Etapa 6 era confirmar que a mudança reflete "sem nenhum deploy" — sem
  invalidar o cache, ainda seria verdade tecnicamente (não precisa de
  deploy), mas o teste ficaria mais lento/confuso (até 5 min de espera).
  Invalidar na hora dá um resultado imediato e sem ambiguidade.
- **Validação de tipo por chave individual em `getDesignConfig`**, não
  uma validação de schema do objeto inteiro (ex.: Zod). Motivo: se UMA
  chave vier corrompida (ex.: alguém editou a tabela manualmter e digitou
  uma string onde devia ser número), as outras 9 chaves continuam vindo
  do banco normalmente — só a chave ruim cai pro default. Uma validação
  de schema do objeto inteiro rejeitaria tudo ou nada, perdendo
  configuração boa por causa de 1 chave ruim. Não usei uma lib de
  validação (Zod etc.) pra não introduzir uma dependência nova só pra 10
  checagens de tipo simples (`typeof`).

---

# Fase 13 — Refino visual dos templates

## Concluído
- [x] Etapa 1 — Diagnóstico visual: reproduzi os prints reais anexados
      (posts em produção do cliente ErizonAI, cores reais
      `#8f0391`→`#113b97`) rodando o código ATUAL contra os mesmos textos
      e confirmei pixel a pixel que batiam com os prints — 3 problemas
      concretos, não genéricos:
      1. **classico/story/cartão/carrossel** (fundo = `resolveBackground`,
         gradiente de marca): o degradê linear puro de 2 cores fica
         "murcho"/plano no meio, sem nenhuma camada extra — a origem do
         "pouco harmoniosas" relatado
      2. **Espaço vazio em excesso**: padding fixo generoso (100-340px
         por lado, dependendo do template) + fonte pequena pro tamanho
         real do texto deixavam até ~40% do quadro vazio, sem nenhuma
         textura/forma ocupando — visível principalmente em
         classico, story e estatística sem número
      3. **Estatística sem número** (`extrairNumeroDestaque` não acha
         nenhum dígito) vira visualmente "constelação sem grade" — sem
         nada que a distinga como template próprio
      Cartão e Constelação já eram os mais bem resolvidos (painel
      translúcido ancora a composição; grade+anéis preenchem o espaço) —
      usados como referência do "o que já funciona" ao decidir as
      correções
- [x] Etapa 2 — `pickFontSize` (shared.ts) recalibrado: faixas
      aumentadas (≤80: 64→70, ≤150: 52→58, ≤250: 42→46, ≤400: 34→36).
      A faixa >400 caracteres foi MANTIDA em 28px de propósito — é a
      única faixa que cobre o caso extremo já validado sem overflow na
      Fase 10 (317 caracteres reais, que na prática caem na faixa ≤400)
      e não há motivo pra arriscar esse caso raro só por estética
- [x] Etapa 3 — Ajustes por template, todos preservando a identidade
      original:
      - **shared.ts / `resolveBackground`**: ganhou uma camada de
        brilho radial sutil (a própria cor primária, translúcida, no
        canto superior esquerdo, esmaecendo pra transparente) por trás
        do gradiente linear — quebra a planura do degradê de 2 cores
        sem mudar as cores de marca nem a direção. Como é reaproveitada
        por classico/cartão/story/carrossel E pela prévia ao vivo de
        `visual-dna-form.tsx`, o ganho aparece em todo lugar de uma vez
        (ângulo do gradiente também ajustado de 135deg pra 150deg)
      - **classico.ts**: padding reduzido (100/96/200 → 72/88/180),
        área de texto maior (880x680 → 900x760)
      - **cartao.ts**: teto de fonte 46→50, área de texto 520→560px,
        padding da moldura reduzido (90/84/200 → 70/76/170) — já era o
        template mais bem resolvido, ajuste só de acompanhamento
      - **constelacao.ts**: padding reduzido (120/110/220 → 90/104/190),
        área de texto maior (840x600 → 860x660) — grade/anéis/cantos
        intocados, identidade preservada
      - **estatistica.ts**: padding reduzido (110/100/220 → 80/96/180),
        área de texto maior (820x520 → 840x600), teto de fonte no modo
        "com número" 34→38, e o fundo ganhou um brilho radial TINGIDO
        com a cor de destaque (`corDestaque` do cliente, ou cyan padrão)
        por trás do fundo escuro fixo — dá uma textura própria ao
        template mesmo no caso "sem número", sem duplicar a grade da
        constelação
      - **story.ts**: padding vertical reduzido (340/260 → 260/220),
        área de texto maior (altura 1200→1340px) — texto passa a começar
        mais perto do topo, aproveitando melhor o formato vertical
      - **carrossel.ts**: mesmo ajuste de padding do clássico
        (100/96/200 → 76/90/180, área 880x680 → 900x740) — usa o mesmo
        `resolveBackground`, então ganha o brilho radial automaticamente
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e
      `npm run build` sem erros (rodados antes E depois dos ajustes de
      Etapa 3, mais uma vez ao final)
- [x] Etapa 4 — Teste comparativo: reproduzi os MESMOS textos/cores dos
      prints problemáticos com o código novo — gradientes visivelmente
      mais ricos (brilho radial quebra a planura), texto ocupando bem
      mais da área do quadro, menos vazio acima/abaixo. Testei extremos
      pra garantir que a fonte maior não introduziu overflow: texto
      curto (21 caracteres), perto do limite de 280 (242 caracteres) e o
      "texto de estresse" já validado na Fase 10 (289 caracteres, faixa
      ≤400) em TODOS os templates/formatos (classico com marca e
      fallback, story, constelação, estatística com e sem número,
      cartão, carrossel) — nenhum caso estourou o card, incluindo
      estatística com número gigante + texto completo de ~317
      caracteres somados. Texto extremamente curto (ex.: "Feliz Dia do
      Cliente!", 21 caracteres) ainda deixa bastante espaço vazio em
      classico/story — aceito como limite inerente (não dá pra "encher"
      um quadro de 1080x1080 com 3 palavras sem inflar a fonte a ponto
      de ficar estranho ou adicionar elementos novos, fora do escopo de
      "refinar, não redesenhar"); cartão lida bem com texto curto porque
      o painel encolhe ao conteúdo.
      **Fase 13 validada (1ª rodada).**
- [x] Etapa 1b/3b — Consulta aos skills de design instalados (pedida
      explicitamente numa 2ª mensagem do usuário, depois da 1ª rodada já
      estar concluída) + refinamento adicional:
      - `.claude/skills/ui-ux-pro-max` **não é invocável via ferramenta
        Skill** (não está na lista de skills disponíveis desta sessão) —
        rodei o script de busca dele diretamente (`search.py`) como o
        próprio SKILL.md instrui, mas o Python real não está instalado
        neste ambiente (só o stub da Microsoft Store — `python`/`python3`/
        `py -3` todos falharam). Sem o script, li o CSV de regras
        (`data/ux-guidelines.csv`) direto: confirma "Font Size Scale —
        usar escala tipográfica consistente, não tamanhos arbitrários"
        — valida a abordagem de `pickFontSize` (faixas fixas), mas o
        banco é focado em UI de produto/web (viewport), não em imagem
        estática 1080x1080 pra rede social — poucas outras regras se
        aplicam diretamente
      - `.claude/skills/taste-skill` também não existe com esse nome
        exato — encontrado como `design-taste-frontend`/
        `design-taste-frontend-v1` (o próprio SKILL.md do v1 diz "o
        v1 taste-skill original"; o cabeçalho do v2 é literalmente
        `# tasteskill: Anti-Slop Frontend Skill`). Também não invocável
        via ferramenta Skill — lido o arquivo diretamente
      - **Achado direto e acionável**: Seção 4.2, "THE LILA RULE" — o
        gradiente "AI Purple/Blue glow" é sinalizado como clichê de IA,
        mas com uma ressalva explícita: se a cor vem da marca de
        verdade (como é o caso — cor real do cliente ErizonAI,
        `#8f0391`→`#113b97`), não é proibido, só precisa ser "executado
        com intenção: paleta harmonizada, neutros equilibrados,
        gradientes comedidos — não gradiente-slop genérico". O brilho
        radial da 1ª rodada (só mais da própria cor saturada) não
        atendia "neutros equilibrados" — ainda era "mais cor", não
        harmonia de verdade
      - **Refinamento**: `resolveBackground` (shared.ts) ganhou uma
        vinheta escura NEUTRA (preto translúcido, sem matiz) no canto
        oposto ao brilho (82%, 88%) — juntas, brilho de luz + vinheta de
        sombra simulam uma fonte de luz real (profundidade genuína),
        em vez de só empilhar mais cor saturada. As 2 cores de marca
        continuam sendo a base do degradê — a identidade do
        clássico/story/carrossel (fundo = cor da marca) não muda, só a
        execução fica mais "com intenção"
      - Reteste visual com as mesmas cores/textos reais da ErizonAI
        (classico, cartão, story): canto inferior direito visivelmente
        mais escuro/ancorado, canto superior esquerdo com o brilho —
        resultado lido como mais premium/intencional que a versão
        anterior, sem perder a cor real da marca
      **Fase 13 validada (com refinamento pós-consulta aos skills).**

## Pendente
(nenhum — commit/push desta fase aguardando confirmação do usuário)

## Problemas Encontrados
- [2026-08-03] `npx eslint .` passou a falhar com 9 erros depois da
  instalação dos skills de design nesta sessão — mas os erros são TODOS
  em `.claude/skills/brand/scripts/*.cjs` (arquivos de terceiros, parte
  da instalação dos skills, não código do app; `require()` em arquivo
  `.cjs` é válido, só que a regra `@typescript-eslint/no-require-imports`
  do projeto não faz exceção pra `.cjs`). Confirmado que NÃO é uma
  regressão desta fase nem afeta o gate real de qualidade: `npm run
  build` (que roda seu próprio lint, escopado a `src/`/rotas do Next,
  não ao repo inteiro) continua limpo. `.claude/skills/` está untracked
  no git (instalado nesta sessão, fora do controle de versão do
  projeto) — não alterei a config do eslint pra "corrigir" isso, já que
  é fora do escopo desta fase e o gate que realmente importa
  (`npm run build`) não é afetado; registrado aqui só pra não confundir
  uma sessão futura que rodar `npx eslint .` sem contexto.

## Decisões Tomadas
- **Vinheta neutra (preto translúcido) em vez de uma 2ª cor de marca ou
  neutro cinza/branco.** Preto translúcido escurece sem introduzir
  nenhum matiz novo (nem esquenta nem esfria a composição) — é o jeito
  mais "seguro" de adicionar um neutro de verdade sem arriscar um choque
  de cor com o gradiente de marca já existente, e sem se aproximar do
  visual fixo-escuro da constelação/estatística (que usam uma cor de
  fundo completamente diferente, não uma vinheta sobre o gradiente de
  marca).
- **Brilho radial em `resolveBackground` (shared.ts), não um gradiente
  de 3 stops com cálculo de mistura de cor.** Adicionar uma 3ª cor
  "média" exigiria interpolar RGB dos 2 hex de marca — mais código e
  mais uma forma de dar errado (arredondamento, cores muito próximas
  gerando uma faixa sem contraste). Uma camada radial translúcida
  reaproveitando a PRÓPRIA cor primária (só com opacidade) já quebra a
  planura do degradê original com uma técnica padrão de design de
  produto, sem introduzir nenhuma cor nova nem lógica de mistura.
- **Ângulo do gradiente 135deg→150deg em resolveBackground.** Ajuste
  pequeno, mais alinhado com o brilho radial no canto superior esquerdo
  (26%, 22%) — evita que o brilho e o degradê linear "lutem" na mesma
  direção.
- **Faixa >400 caracteres de `pickFontSize` NÃO aumentada**, diferente
  de todas as outras. É a única faixa sem folga testada recentemente
  pra um valor maior — mexer nela arriscaria o único caso realmente
  extremo (texto bem acima do limite de 280 da Fase 6) sem nenhum
  ganho prático (post real nunca cai nessa faixa; só testes/dados
  antigos, como o post de 1305 caracteres da Fase 12, caem bem além
  dela de qualquer forma e já estouravam antes desta fase).
- **Estatística sem número ganhou brilho tingido com `corDestaque`, não
  uma versão simplificada da grade da constelação.** Reaproveitar a
  grade duplicaria a identidade visual dos 2 templates (o motivo deles
  serem 2 templates diferentes, não 1, é ter aparências distintas — ver
  Decisões Tomadas da Fase 10). Um brilho tingido dá textura própria
  sem esse risco.
- **Espaço vazio residual em textos MUITO curtos (ex.: 21 caracteres)
  aceito como limite conhecido, não corrigido.** Preencher esse caso
  exigiria ou fonte desproporcionalmente grande (arriscando ficar
  estranho) ou elementos decorativos novos (fora do pedido explícito
  de "refinar, não redesenhar do zero"). Como o texto gerado pela Groq
  (Fase 6) tem um MÍNIMO implícito de "1 a 3 frases", esse caso extremo
  não é o cenário típico de produção — o ganho real (textos de 100-280
  caracteres, a faixa comum) já foi validado.

---

# Fase 12 — Novos formatos: Story e Carrossel

## Concluído
- [x] Etapa 1 — Decisão: **Opção C (seletor na UI)**, não Opção A (formato
      pelo texto do chat) nem Opção B (gerar sempre os 3 formatos). Ver
      Decisões Tomadas pro raciocínio completo — resumo: Opção A exigiria
      estender o classificador de intenção (Fase 5), explicitamente
      protegido no escopo desta fase; Opção B tripliaria Puppeteer +
      adicionaria uma chamada Groq nova em TODA aprovação automática,
      custo/latência desnecessários quando o cliente só quer 1 formato.
      Implementação concreta da Opção C: em vez de um seletor + botão
      único (escondendo os outros formatos), cada formato virou uma
      seção independente dentro de "Posts aprovados", cada uma com seu
      próprio botão "Gerar" — os 3 formatos coexistem (gerar um não
      apaga nem substitui outro já gerado), sem precisar de estado de
      "qual formato está selecionado agora"
- [x] Etapa 2 — Schema: **sem coluna "formato pedido"** (a escolha não é
      um estado pendente — é síncrona, decidida no clique do botão). Em
      vez disso, 4 colunas novas em content_calendar pra guardar o
      RESULTADO de cada formato, já que um post pode ter os 3 formatos
      gerados ao mesmo tempo: `story_imagem_gerada` +
      `story_imagem_gerada_em` (mesmo padrão de `imagem_gerada`/
      `imagem_gerada_em` da Fase 3/11), `carrossel_slides` (jsonb, array
      ordenado de paths) + `carrossel_gerado_em`. Migration:
      `supabase/migrations/20260803000000_formatos_schema.sql`.
      **PENDENTE: usuário precisa rodar esta migration no SQL Editor do
      Supabase** (confirmado via teste: as colunas ainda não existem no
      banco real — ver Problemas Encontrados). `src/lib/supabase/types.ts`
      já atualizado com os campos novos em Row/Insert (Update já herda de
      Insert via Partial)
- [x] Etapa 3 — Story: `src/lib/render/generate-image.ts` generalizado —
      `renderHtmlToPngBuffer(html, width?, height?)` ganhou 2 parâmetros
      opcionais com default `POST_IMAGE_SIZE` (nenhum chamador existente
      muda de comportamento). `STORY_IMAGE_WIDTH`/`STORY_IMAGE_HEIGHT`
      (1080x1920) adicionados a shared.ts.
      `src/lib/render/templates/formatos/story.ts` criado: reaproveita
      resolveBackground/pickTextColor/escapeHtml/pickFontSize de
      shared.ts (Fase 10) — mesma base visual do template "clássico",
      com tag "// {MARCA}" no topo (inspirada nas referências "PERGUNTA
      DO DIA", sem tentar reproduzir sticker de enquete nativo do
      Instagram — isso é recurso da própria plataforma, não dá pra
      desenhar numa imagem estática) e bem mais espaço vertical pro
      texto (`max-height: 1200px` vs. 680px do post quadrado). Fonte
      +6px em relação ao pickFontSize padrão (mais espaço disponível,
      documentado no código). `generate-story-image.ts` criado, mesmo
      padrão de `generate-post-image.ts`: busca evento + cliente +
      client_dna (fallback genérico se não configurado), renderiza,
      sobe pro Storage como `<id>-story.png` (mesmo bucket
      "post-images"), salva em `story_imagem_gerada`/
      `story_imagem_gerada_em` — independente de `imagem_gerada`
- [x] Etapa 4 — Carrossel: `src/lib/groq/carousel-suggestion.ts` criado
      — `generateCarouselSlides()`, chamada Groq NOVA (diferente de
      generatePostSuggestion/generateAdHocPostSuggestion, Fase 2/5) que
      pega o texto do post já aprovado (280 caracteres, Fase 6) como
      base e pede um array JSON de 3 a 4 slides narrativos (gancho →
      desenvolvimento → CTA no último). Parsing robusto via regex
      (`/\[[\s\S]*\]/`) que extrai o array mesmo se vier cercado de
      texto ou cerca de markdown, não exige que a resposta inteira seja
      JSON válido de cara. `src/lib/render/templates/formatos/carrossel.ts`
      criado: mesma base visual do "clássico" (1080x1080, viewport
      padrão — carrossel usa POST_IMAGE_SIZE, não o tamanho do Story),
      com badge "N/total" no canto — cada slide é 1 render Puppeteer
      separado, sem nenhuma lógica de narrativa no template (isso é 100%
      responsabilidade da Groq). `generate-carousel.ts` criado: busca
      evento + cliente + client_dna, chama generateCarouselSlides, itera
      renderizando e subindo cada slide pro Storage em
      `carrossel/<id>/slide-NN.png` (mesmo bucket "post-images", pasta
      por post — sem bucket novo), salva o array de paths em
      `carrossel_slides` + `carrossel_gerado_em` só no fim do loop (se
      falhar no meio, sem estado parcial no banco — ver Decisões
      Tomadas)
- [x] Etapa 5 — Server Actions `generateStoryAction`/`generateCarouselAction`
      adicionadas em `src/app/calendar-actions.ts` (mesmo padrão de
      `generateImageAction`, zero mudança nela). `maxDuration` de
      `src/app/clientes/[id]/page.tsx` elevado de 60 pra 120 (ver
      Decisões Tomadas — carrossel roda até 4 renders Puppeteer em
      sequência + 1 chamada Groq antes). `src/app/clientes/[id]/page.tsx`
      passou a selecionar as 4 colunas novas e montar `storyImagemUrl`/
      `carrosselImagemUrls` (reaproveitando `getPublicImageUrl` com
      cache-busting da Fase 11 pros dois formatos novos também).
      `src/components/approved-posts.tsx` reescrito: 3 seções
      independentes por post ("Post quadrado" / "Story" / "Carrossel"),
      cada uma com botão "Gerar" próprio (escondido depois de gerado,
      mesmo comportamento que já existia pro post único) e prévia
      própria — Story em miniatura vertical (aspect 9:16), Carrossel
      como lista horizontal roladável de miniaturas numeradas com link
      de download por slide
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e
      `npm run build` sem erros (rodados 2x — 1ª vez logo depois da
      implementação, 2ª vez depois de reforçar o prompt da Groq do
      carrossel, ver Problemas Encontrados). Tamanho de
      `/clientes/[id]` subiu de 2.66kB pra 3.16kB (UI nova), nenhuma
      outra rota mudou de tamanho — sem regressão
- [x] Etapa 6 (parcial — ver Pendente) — Teste de render local via
      `npx tsx` (scripts descartáveis, apagados depois, mesmo padrão da
      Fase 10): (1) Story com identidade visual, sem identidade visual
      (fallback escuro) e com texto propositalmente longo (317
      caracteres) — os 3 renderizaram sem overflow, tag e rodapé
      corretos, fonte maior que o post quadrado como esperado; (2) 4
      slides de carrossel com dados fictícios — numeração "N/total"
      correta no canto, narrativa coerente (gancho → dado → oferta →
      CTA); (3) `generateCarouselSlides()` chamado de verdade contra a
      Groq, usando um post real já aprovado (cliente "Erik Chagas" /
      "ErizonAI") — 1ª tentativa retornou slides coerentes mas rasos
      demais (ver Problemas Encontrados, corrigido); depois do ajuste de
      prompt, 2ª tentativa retornou 4 slides substanciais e narrativamente
      conectados (gancho sobre o aniversário → contexto do produto →
      papel da equipe/clientes → celebração + CTA), com o slide mais
      longo tendo 268 caracteres (acima do limite pedido de 200, mas
      renderizado via Puppeteer sem nenhum overflow — pickFontSize já
      validado até 400 caracteres na Fase 10)

- [x] Etapa 6 (final) — Usuário confirmou ter rodado a migration no SQL
      Editor do Supabase (2026-08-03). Reconfirmado por código (select de
      teste nas colunas novas, sem erro). Teste ponta a ponta completo
      contra o banco/Storage reais, chamando as 3 funções orquestradoras
      (`generateStoryForApprovedPost`, `generateCarouselForApprovedPost`,
      `generateImageForApprovedPost`) pro MESMO post aprovado
      ("Aniversário de Cliente Aniversário Teste", cliente "Imóveis Teste
      Ltda", 112 caracteres — texto de tamanho normal, ver Problemas
      Encontrados sobre a 1ª tentativa com um texto de teste antigo
      anômalo), com download real via URL pública (cache-busting da Fase
      11) e inspeção visual:
      1. **Story**: gradiente de marca do cliente aplicado corretamente,
         tag "// IMÓVEIS TESTE LTDA" no topo, texto centralizado sem
         overflow, rodapé com nome + data — tudo consistente com o
         template clássico só que no formato vertical
      2. **Carrossel**: 4 slides gerados a partir do texto do post
         (Groq), badge de numeração "1/4"..."4/4" no canto de cada
         slide, narrativa com começo (gancho sobre o aniversário do
         cliente), meio e fim (CTA "estamos aqui pra ajudar a tornar
         seus sonhos imobiliários em realidade") — coerente, não são
         frases desconexas
      3. **Regressão do post quadrado (formato já existente)**: gerado
         no MESMO evento logo depois do Story e do Carrossel — escolheu
         o template "estatística" aleatoriamente (confirma que
         pickRandomTemplate/Fase 10 continua intocado), sem nenhum
         overflow ou efeito colateral dos 2 formatos novos
      4. **Coexistência confirmada**: a linha final de content_calendar
         mostra `imagem_gerada`, `story_imagem_gerada` e
         `carrossel_slides` todos preenchidos ao mesmo tempo pro mesmo
         evento — gerar um formato não apagou nem sobrescreveu os outros,
         exatamente como projetado
      **Fase 12 validada.**

## Pendente
(nenhum item de código pendente — ver Problemas Encontrados pra uma
observação fora do escopo desta fase, não bloqueante)

## Problemas Encontrados
- [2026-08-03] Não é bem um "problema", mas uma limitação de ferramenta
  desta sessão: migrations neste projeto sempre foram aplicadas
  manualmente pelo usuário no SQL Editor do Supabase (confirmado
  relendo o histórico de fases anteriores — várias tinham a mesma nota
  "PENDENTE: usuário precisa rodar esta migration"), não há
  `DATABASE_URL`/conexão Postgres direta nem CLI do Supabase linkado
  neste ambiente. Confirmado tentando um select de teste nas colunas
  novas contra o banco real: erro `column content_calendar.
  story_imagem_gerada does not exist` — como esperado, a migration desta
  fase ainda não foi aplicada. Isso bloqueia só a ETAPA FINAL do teste
  ponta a ponta (escrever de verdade nas colunas novas); todo o resto
  (render dos templates, chamada real à Groq) já foi validado sem
  depender da migration.
- [2026-08-03] Problema de qualidade (não de código): a 1ª tentativa de
  `generateCarouselSlides()` contra a Groq real devolveu um array JSON
  válido, mas cada slide era raso demais — praticamente uma manchete
  ("Hoje é nosso aniversário!", "Agradecemos a todos que nos apoiaram")
  em vez de um pensamento completo com conteúdo de verdade. Tecnicamente
  não quebrava nada (JSON válido, narrativa tematicamente conectada),
  mas não atendia o pedido do escopo de uma narrativa real "desenvolvendo
  através dos slides". Causa: o prompt original só pedia "direto e
  natural" sem deixar claro que cada slide precisava ser substancial, e
  o modelo interpretou isso como permissão pra ser telegráfico. Status:
  resolvido — prompt reforçado com instrução explícita ("cada slide
  precisa ser uma frase ou pensamento COMPLETO... NUNCA só um título ou
  manchete curta", com exemplos do que evitar). Reteste com o mesmo post
  real: os 4 slides passaram a ter conteúdo substancial e narrativamente
  conectado (ver Concluído).
- [2026-08-03] Observação (fora do escopo desta fase, NÃO é uma regressão
  introduzida aqui): a 1ª tentativa do teste ponta a ponta final (depois
  da migration) pegou por acaso o primeiro post aprovado do banco
  (`bd8d7dbf-...`, "Post avulso: gera um post de parabéns pelo aniversário
  da empre[sa]") — um registro de teste antigo (de antes do limite de 280
  caracteres da Fase 6) com 1305 caracteres de texto. Tanto o Story NOVO
  quanto o template "clássico" JÁ EXISTENTE estouraram o texto pra fora
  do card nesse caso específico (overflow visual, texto cortado). Troquei
  pra um post de tamanho normal (112 caracteres) e o teste passou limpo
  nos 3 formatos (ver Concluído/Etapa 6). Não investiguei/corrigi
  `pickFontSize`/o template clássico pra esse caso extremo porque: (1) o
  próprio template clássico (Fase 3/10, intocado nesta fase) já teria
  esse mesmo comportamento pra esse mesmo texto ANTES da Fase 12 — não é
  uma regressão minha; (2) 1305 caracteres é muito além até do "texto
  longo" já validado como seguro na Fase 10 (317-414 caracteres); (3)
  corrigir isso exigiria mexer em `pickFontSize`/lógica de fitting de
  texto, fora do escopo pedido aqui ("adicionar capacidade de formato",
  não revisar o fitting de texto do template clássico). Registrado aqui
  como candidato a ajuste futuro (ex.: truncar com reticências ou reduzir
  ainda mais a fonte pra textos MUITO acima do limite pretendido pelo
  Fase 6), não bloqueante pra esta fase.

## Decisões Tomadas
- **Opção C (seletor/botão dedicado por formato), implementada como 3
  seções independentes em vez de um seletor + botão único.** Ver
  Concluído/Etapa 1 pro raciocínio completo contra as opções A e B. A
  escolha de 3 seções (em vez de um dropdown que troca qual prévia é
  exibida) foi deliberada: os 3 formatos podem coexistir de verdade pro
  mesmo post (o cliente pode querer post + story do mesmo evento, por
  exemplo), então esconder 2 formatos atrás de um seletor ativo
  esconderia informação real (imagens já geradas) sem necessidade —
  mais simples mostrar tudo que existe, com um botão só onde ainda não
  foi gerado.
- **Sem coluna "formato pedido" em content_calendar** — só colunas de
  RESULTADO por formato (`story_imagem_gerada`, `carrossel_slides`,
  etc.). O escopo cogitava uma coluna enum (`formato: 'post'|'story'|
  'carrossel'`) pro caso de a escolha precisar ser persistida como
  estado pendente — não se aplica aqui porque a Opção C é síncrona
  (clique do botão → gera na hora), não uma decisão que fica esperando
  processamento posterior.
- **Mesmo bucket "post-images" pros 3 formatos, sem bucket novo.**
  Story vira `<id>-story.png`, carrossel vira `carrossel/<id>/
  slide-NN.png` — paths diferentes já evitam colisão com `<id>.png` do
  post quadrado, e o bucket já é público-leitura/autenticado-escrita
  (Fase 3), sem precisar de nenhuma policy nova.
- **Carrossel limitado a 3-4 slides, não 3-5 como o escopo sugeriu como
  exemplo.** Cada slide é 1 render Puppeteer sequencial (não paralelo —
  um único browser Puppeteer por chamada, ver generate-carousel.ts), e
  serverless já roda o Puppeteer de 4 a 8x mais devagar que local (Fase
  3/9). Reduzir o teto de 5 pra 4 slides encurta o pior caso de tempo
  total de execução na Vercel, mantendo folga confortável dentro do
  `maxDuration` da rota — prioriza previsibilidade de latência sobre
  ganhar 1 slide a mais de conteúdo.
- **`maxDuration` de `src/app/clientes/[id]/page.tsx` elevado de 60 pra
  120**, não deixado em 60 nem elevado ao teto de 300 do Hobby. 60s
  (calibrado na Fase 9 só pro post único/Story, 1 render Puppeteer cada)
  não teria folga suficiente pro pior caso do carrossel (até 4 renders
  em sequência + 1 chamada Groq antes). 120 dá bastante margem sem
  chegar perto do teto do plano — não vi necessidade de ir direto pro
  máximo permitido.
- **Se o carrossel falhar no meio do loop de geração, sem rollback nem
  estado parcial no banco.** `carrossel_slides` só é gravado depois que
  TODOS os slides subiram com sucesso pro Storage — se falhar em
  qualquer ponto, os slides já enviados ficam órfãos no Storage (custo
  de armazenamento desprezível) mas o content_calendar simplesmente não
  reflete nenhum carrossel gerado, como se nada tivesse acontecido. O
  usuário só vê "não gerado" e pode clicar "Gerar carrossel" de novo —
  mais simples que implementar lógica de limpeza/retry parcial pra um
  cenário de falha que já é raro (a mesma chamada Groq e o mesmo
  Puppeteer já são usados sem esse tipo de proteção nos outros
  formatos).
- **`generateCarouselSlides()` como uma chamada Groq nova e separada**,
  não uma extensão de generatePostSuggestion. O texto do post único
  (280 caracteres, Fase 6) é short-form por design — pedir pra Groq
  "dividir" um texto tão curto em vários slides substanciais geraria
  fragmentos pobres (foi exatamente o problema encontrado na 1ª
  tentativa, ver Problemas Encontrados); em vez disso, o prompt do
  carrossel pede pra EXPANDIR o texto original numa narrativa nova de
  vários slides, usando o texto aprovado como ponto de partida
  temático, não como material bruto pra recortar.

---

## Concluído
- [x] Diagnóstico: descartada a hipótese de deploy desatualizado (usuário
      confirmou no painel da Vercel que o deployment mais recente era o
      commit da Fase 10, status Ready) e a hipótese de seleção de
      template quebrada (log de produção mostrou
      `[render] Template escolhido pro evento ...: "estatistica"` — a
      seleção aleatória funciona). Causa raiz isolada: `<img
      src={item.imagemUrl}>` em src/components/approved-posts.tsx usa a
      URL construída por `getPublicImageUrl` (src/lib/render/upload-image.ts),
      que não tinha nenhum parâmetro de cache-busting — como o path do
      arquivo (`${contentCalendarId}.png`) é sempre o mesmo entre
      regenerações (`upsert: true`, decisão da Fase 3) e o Supabase
      Storage serve objetos com `cache-control: max-age=3600` (confirmado
      via metadata checada na Fase 4), o navegador do usuário reutiliza a
      imagem antiga em cache por até 1h após uma regeneração, mesmo o
      servidor tendo processado e salvo um arquivo novo (template
      diferente) no mesmo lugar
- [x] Correção: `getPublicImageUrl(path, versao?)` (src/lib/render/upload-image.ts)
      ganhou um segundo parâmetro opcional que vira `?v=<versao>` na URL
      quando presente. src/app/clientes/[id]/page.tsx passou a selecionar
      `imagem_gerada_em` também (antes só pegava `imagem_gerada`) e passa
      esse valor como versão ao montar `imagemUrl` — como
      `imagem_gerada_em` muda a cada regeneração de verdade, o cache do
      navegador é invalidado exatamente quando (e só quando) o conteúdo
      realmente muda. O link "Baixar imagem" reaproveita a mesma
      `imagemUrl`, então o download também passa a pegar a versão certa
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e
      `npm run build` sem erros

## Pendente
- [ ] Confirmação em produção depois do deploy (regenerar imagem de um
      post já visualizado antes, sem hard-refresh, confirmar que o
      template novo aparece agora)

## Problemas Encontrados
(ver "Diagnóstico" acima — o problema em si já está documentado como o
motivo desta fase existir)

## Decisões Tomadas
- **Query param `?v=<imagem_gerada_em>`, não reduzir/remover o
  cache-control do Storage nem forçar reload via JS no client.** Motivo:
  cache-busting por versão derivada de um dado que já muda exatamente
  quando o conteúdo muda é a técnica padrão pra esse problema (usada por
  praticamente todo serviço de asset estático da web) — preserva o
  benefício de cache do CDN pro caso comum (imagem que não mudou, a
  maioria das visualizações) e só invalida exatamente quando necessário.
  Reduzir o cache-control do bucket penalizaria performance pra sempre,
  pro caso raro de regeneração; forçar reload via JS só resolveria a
  visualização feita na MESMA sessão do browser logo após clicar
  "Gerar imagem", não uma visita nova à página depois (que ainda
  carregaria a `<img>` com a URL sem versão do jeito antigo).
- **`imagem_gerada_em` como fonte da versão, não um hash do conteúdo nem
  um número aleatório novo a cada render.** Já existe, já muda
  exatamente quando (e só quando) uma nova imagem é gerada de verdade —
  não precisa de nenhuma coluna nova nem lógica extra. Um valor aleatório
  a cada render do Server Component invalidaria o cache toda vez que
  QUALQUER coisa na página mudasse (ex.: nova mensagem no chat via
  Realtime disparando um re-render), não só quando a imagem
  especificamente mudou — desperdiçaria o cache à toa.

---

# Fase 10 — Fuso horário + registro de templates de imagem

## Concluído
- [x] Etapa 1 — src/lib/format/timezone.ts criado: `paraDataIsoBrasilia`,
      `paraHoraBrasilia` e `hojeBrasiliaISO`, todos via
      `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` explícito
      (não depende do fuso do processo — local roda no fuso do Windows,
      já por coincidência UTC-3, mas a Vercel roda em UTC; sem conversão
      explícita, o mesmo código mostra horas diferentes dependendo de
      onde roda). `formatarDataHoraPtBr` (src/lib/calendar/format.ts,
      Fase 7) atualizado pra usar o helper novo em vez de fatiar a
      string UTC bruta. Revisado TODO lugar que formata data/hora no
      projeto (grep de `formatarData`/`toISOString().slice`/`new Date()`):
      só 2 pontos tinham o bug de verdade — `formatarDataHoraPtBr`
      (histórico de aprovação) e o `hoje` usado como `data_evento` de um
      post avulso (src/lib/chat/handle-free-message.ts, Fase 5), que
      também passou a usar `hojeBrasiliaISO()`. Ver Decisões Tomadas pra
      um 3º ponto (calendar-engine.ts) que tem o mesmo padrão mas foi
      DELIBERADAMENTE deixado de fora por ser lógica de negócio protegida
      nesta fase
- [x] Etapa 2 — post-template.ts (Fase 3) desmembrado em
      src/lib/render/templates/: shared.ts (utilitários reaproveitáveis —
      escapeHtml, escapeAttr, pickFontSize, resolveBackground,
      pickTextColor, POST_IMAGE_SIZE, + resolveAccentColor novo pros
      templates escuros) e types.ts (TemplateParams, TemplateRenderFn,
      TemplateDefinition). classico.ts criado com o comportamento
      IDÊNTICO ao antigo renderPostTemplate — nenhuma mudança visual
      nesse template. Os 2 outros importadores de post-template.ts
      atualizados pro caminho novo: generate-image.ts (POST_IMAGE_SIZE) e
      src/components/visual-dna-form.tsx (resolveBackground, usado na
      prévia ao vivo da tela de identidade visual). post-template.ts
      apagado (totalmente migrado)
- [x] Etapa 3 — 3 templates novos criados, inspirados na direção visual
      das referências anexadas (fundo escuro, grade/anéis decorativos,
      tag monospace com "//", tipografia bold) sem copiar nenhuma
      pixel-a-pixel:
      1. **constelacao.ts**: fundo escuro fixo (não usa a cor do cliente
         como fundo — ver Decisões Tomadas), grade sutil + anéis
         concêntricos + cantos decorativos, tag "// {MARCA}", texto bold
         centralizado, linha divisória colorida
      2. **estatistica.ts**: extrai o primeiro número do texto do post
         (regex) e mostra em destaque gigante com gradiente, texto
         completo abaixo, menor; sem número no texto, cai pro layout
         normal sem o bloco de número
      3. **cartao.ts**: painel translúcido com aspas decorativas, texto
         em itálico estilo citação, sobre o MESMO resolveBackground do
         clássico (esse sim respeita a cor do cliente como fundo) — o
         painel se adapta automaticamente (claro sobre fundo escuro,
         escuro sobre fundo claro) usando o textColor que
         resolveBackground já calcula, sem precisar recalcular contraste
      Todos reaproveitam pickFontSize/escapeHtml/escapeAttr de shared.ts
      e recebem exatamente TemplateParams — nenhum deles quebra sem
      corPrimaria/corSecundaria/logoUrl (fallback testado na Etapa 5)
- [x] Etapa 4 — src/lib/render/templates/index.ts: registro `TEMPLATES`
      (array de `{id, nome, render}`) + `pickRandomTemplate()` (seleção
      uniforme via `Math.random()`). generate-post-image.ts atualizado
      pra chamar `pickRandomTemplate().render(...)` em vez do template
      fixo, com um `console.log` registrando qual template foi usado por
      geração (decisão: não criar coluna nova no banco pra isso — ver
      Decisões Tomadas)
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e
      `npm run build` sem erros

- [x] Etapa 5 — Teste ponta a ponta rodado via `npx tsx` (mesmo padrão de
      sessões anteriores), chamando generateImageForApprovedPost
      repetidamente contra 3 cenários reais, com download de cada
      resultado ANTES da próxima geração sobrescrever o arquivo (mesmo
      path é reusado, `upsert: true`, Fase 3) — ver Problemas Encontrados
      sobre o cache de CDN que atrapalhou a 1ª tentativa de captura.
      Resultado:
      1. **Com identidade visual** (Cliente Aniversário Teste, cor
         primária/secundária/logo configurados): 6 gerações seguidas →
         os 4 templates apareceram na amostra (classico, constelacao,
         estatistica, cartao); classico e cartao mostraram o gradiente de
         marca do cliente corretamente, constelacao/estatistica usaram a
         cor do cliente como acento (tag/linha/número), não como fundo —
         exatamente como projetado
      2. **Sem identidade visual** (Cliente Teste, sem nenhuma cor
         configurada): 6 gerações seguidas → os 4 templates apareceram,
         todos caindo no fallback genérico corretamente (fundo escuro
         padrão no clássico/cartão, acento cyan padrão no
         constelação/estatística) — nenhum template quebra ou fica sem
         cor por causa da ausência de identidade visual
      3. **Texto longo** (317 caracteres, acima do limite de 280 da Fase
         6, criado deliberadamente pra estressar): 6 gerações seguidas →
         os 4 templates apareceram, nenhum com overflow ou corte visual
         (inspecionado visualmente); "estatística" com um número real no
         texto ("500 agências") mostrou o número em destaque E o texto
         completo por baixo, sem cortar nenhum dos dois
      4. **Fuso horário**: conferido na UI real (tela do cliente Erik
         Chagas) que uma aprovação recente (`created_at` UTC
         `2026-08-03T00:45:08`) aparece como "Aprovado — 2 de agosto às
         21:45" — bate exatamente com a conversão manual calculada pra
         America/Sao_Paulo. Antes da correção, essa mesma linha teria
         aparecido como "3 de agosto às 00:45" (dia seguinte, 3h a mais)
         — confirma o bug relatado e a correção, direto na tela real, sem
         precisar gerar nenhum dado novo (a correção é só na formatação
         de exibição — dados já salvos no banco em UTC continuam
         corretos, só passaram a ser exibidos certo)
      **Fase 10 validada.** Post de teste com texto longo ("Teste Fase 10
      - texto longo") ficou no banco, claramente identificável pelo
      nome_evento — o usuário pode apagar quando quiser.

## Problemas Encontrados
- [2026-08-03] Problema (do processo de teste, não do código): ao gerar
  a mesma imagem repetidamente pro mesmo post (mesmo path no Storage,
  `upsert: true`) e baixar logo em seguida pra inspecionar visualmente,
  as primeiras tentativas devolviam sempre a MESMA imagem (a mais antiga
  do lote), mesmo o log confirmando que um template diferente tinha sido
  escolhido a cada geração. Causa: o Storage do Supabase serve os
  arquivos atrás de um CDN com cache — um `fetch()` normal logo após o
  upload pode receber uma resposta cacheada da versão anterior do
  arquivo no mesmo path, em vez da que acabou de ser sobrescrita.
  Status: resolvido — script de teste ajustado pra anexar um
  cache-buster (`?cachebust=<timestamp>-<random>`) + `cache: "no-store"`
  em cada download. Depois disso, cada arquivo baixado correspondeu
  exatamente ao template logado naquela geração. Não afeta o produto em
  si (o usuário sempre vê a imagem mais recente pela URL pública normal,
  sem essa disputa de timing entre gerar-e-baixar-imediatamente-em-
  sequência-rápida que só acontece num script de teste automatizado).

## Decisões Tomadas
- **`calendar-engine.ts` (o "hoje" da janela de detecção de eventos,
  Fase 2) deliberadamente NÃO corrigido nesta fase**, mesmo tendo o
  mesmo padrão problemático (`new Date().toISOString().slice(0, 10)`,
  refletindo o dia UTC do servidor). Motivo: essa é a lógica de decisão
  do motor de calendário — qual dia conta como "hoje" pra calcular a
  janela de 7 dias de antecedência É a regra de negócio da Fase 2,
  explicitamente protegida no escopo desta fase ("não mexer na lógica de
  negócio (calendário...)"). Diferente do `hoje` de
  handle-free-message.ts (só um carimbo de "quando esse post avulso foi
  pedido", sem nenhuma decisão de detecção envolvida — corrigido, ver
  Etapa 1), mudar o `hoje` do motor de calendário poderia alterar QUAIS
  eventos são detectados perto da virada do dia (comportamento de
  negócio), não só como uma data já decidida é exibida. Ficou registrado
  aqui como candidato a ajuste numa fase futura, se o usuário quiser
  estender a correção de fuso pra também cobrir a lógica de detecção.
- **Cor de marca do cliente como ACENTO (não fundo) nos templates
  "constelação" e "estatística"**, diferente do clássico e do cartão
  (que usam como fundo/gradiente, resolveBackground). Motivo: a direção
  visual pedida pras referências ("fundo escuro com padrão de
  pontos/linhas... números em destaque") é uma identidade visual fixa
  desses 2 templates — trocar o fundo pela cor do cliente descaracterizaria
  completamente o motivo de eles existirem (variar visualmente dos
  outros 2). Usar a cor como acento (tag, linha divisória, anéis, número
  em destaque) ainda satisfaz "respeitar a cor do cliente quando
  disponível" (ela aparece e importa visualmente) sem sacrificar a
  identidade escura do template. `resolveAccentColor` (shared.ts) criado
  especificamente pra esse padrão, com fallback pra um roxo (constelação)
  ou cyan (estatística) quando o cliente não configurou marca.
- **Sem persistir qual template foi usado em cada post gerado** (nenhuma
  coluna nova em content_calendar). O próprio escopo desta fase permitia
  deixar de fora se não fosse crítico. Motivo: nenhum requisito atual
  precisa saber "qual template foi esse" depois do fato — o usuário vê
  a imagem final, não o nome do template. Um `console.log` no momento da
  geração já cobre o caso de debug/curiosidade sem exigir migration nem
  mudar o tipo de ContentCalendar. Se no futuro fizer sentido (ex.: um
  botão "gerar de novo com OUTRO template" que evite repetir o mesmo),
  fica registrado aqui como extensão natural.
- **Extração de número via regex simples** (`/\d+(?:[.,]\d+)?%?/`) no
  template "estatística", não uma chamada extra à Groq pra identificar
  "a palavra-chave mais importante do texto". Motivo: o escopo já dava
  essa opção mais simples ("se o texto tiver algum número, senão cai pro
  texto normal") — uma chamada de IA a mais só pra decorar visualmente
  um template adicionaria custo/latência/mais um ponto de falha pra um
  ganho puramente estético, desproporcional ao problema. Quando não há
  número, o fallback é simplesmente não mostrar o bloco de destaque, não
  tentar adivinhar uma palavra-chave por conta própria (evita o mesmo
  tipo de risco de "conteúdo inventado" que o projeto já evita em outros
  lugares, ex.: answerDnaQuestion da Fase 5).
- **`hojeBrasiliaISO()` usa o truque de locale `"en-CA"`** (que formata
  datas nativamente como YYYY-MM-DD) em vez de montar a string manualmente
  a partir de `formatToParts()`. Motivo: menos código, menos superfície
  pra erro de índice/ordem de partes — é uma técnica padrão e bem
  conhecida do `Intl.DateTimeFormat`, não uma solução exótica.

---

# Fase 9 — Deploy em produção (Vercel)

## Concluído
- [x] Etapa 1 — Decisão: **Vercel**, confirmada com os limites reais do
      plano Hobby (gratuito), consultados direto na documentação oficial
      (2026-07): cron jobs — até 100 por projeto, frequência mínima 1x/dia
      (exatamente o nosso caso), precisão de ±59min dentro da hora
      marcada (aceitável, não é um caso de uso sensível a horário exato);
      duração de function — com fluid compute (padrão em projetos novos),
      Hobby tem 300s como padrão E máximo (bem acima da desaceleração
      esperada do Puppeteer em serverless, ver Etapa 2); memória — 2GB
      (padrão e máximo do Hobby); tamanho de bundle — 250MB
      descomprimido, e o binário do @sparticuz/chromium fica bem abaixo
      disso. Todos os limites confirmados compatíveis com o uso esperado
      (1 cron diário + geração de imagem ocasional). Ver Decisões
      Tomadas pro raciocínio completo, incluindo por que não Netlify/
      Railway/outras.
- [x] Etapa 2 — `npm uninstall puppeteer` + `npm install puppeteer-core
      @sparticuz/chromium`. src/lib/render/generate-image.ts reescrito:
      `abrirBrowser()` detecta produção via `process.env.VERCEL === "1"`
      (não NODE_ENV — ver Decisões Tomadas) e usa
      `chromium.executablePath()` + `chromium.args` do
      @sparticuz/chromium nesse caso; localmente, usa
      `puppeteer.launch({ channel: "chrome" })` (recurso nativo do
      puppeteer-core desde a v22, localiza sozinho o Google Chrome já
      instalado no Windows do usuário — confirmado presente em
      `C:\Program Files\Google\Chrome\Application\chrome.exe` — sem
      precisar manter o pacote `puppeteer` completo nem baixar nada à
      parte). next.config.ts: `serverExternalPackages: ["puppeteer"]`
      removido — `puppeteer-core` e `@sparticuz/chromium` já vêm na
      lista padrão de pacotes externos do próprio Next.js 15 (confirmado
      na documentação oficial), não precisam de config manual
- [x] Etapa 3 — src/app/api/cron/daily/route.ts criado: GET, protegido
      comparando o header `Authorization: Bearer <valor>` contra
      `process.env.CRON_SECRET` (mesmo padrão documentado oficialmente
      pela Vercel — ela injeta esse header sozinha em toda invocação de
      cron, sem precisar configurar isso em outro lugar), `maxDuration =
      60` explícito. Chama runDailyJob() (Fase 8, **zero alteração**).
      src/instrumentation.ts removido por completo (não sobrava nada
      nele sem o node-cron); `node-cron`/`@types/node-cron`
      desinstalados. vercel.json criado com o cron `"0 8 * * *"` apontando
      pra `/api/cron/daily`
- [x] Etapa 4 — Lista completa de env vars de produção levantada:
      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, GROQ_MODEL, CRON_SECRET
      (nova, ver .env.local.example atualizado). Revisão de segurança:
      `grep` de todo uso de `process.env` em src/ confirma que
      SUPABASE_SERVICE_ROLE_KEY só é lida em src/lib/supabase/admin.ts
      (Fase 8), que só é importado por src/lib/cron/daily-job.ts, que só
      é importado pela rota /api/cron/daily — nunca chega em nenhum
      Client Component nem em qualquer variável `NEXT_PUBLIC_*`. Nenhum
      vazamento pro bundle do client
- [x] Validação de código local: `npx tsc --noEmit`, `npx eslint .` e
      `npm run build` sem erros. 2 erros reais encontrados e corrigidos
      no caminho — ver Problemas Encontrados (maxDuration em arquivo
      "use server", e middleware bloqueando a própria rota de cron)
- [x] Etapa 5 — Deploy de verdade e teste em produção. **Divisão de
      trabalho** (motivo: regra de segurança fixa — a IA nunca cria
      conta nem digita segredo/API key em nenhum campo): o usuário criou
      o projeto na Vercel (conta já existente, conectada ao GitHub),
      importou kirozethAI/kirozethai, configurou as 6 env vars
      (reaproveitando os valores de .env.local, inclusive o mesmo
      CRON_SECRET, combinado especificamente pra permitir testar a rota
      de produção sem precisar compartilhar o segredo de novo) e clicou
      Deploy. **URL de produção: https://kirozethaii.vercel.app**.
      Resultado do teste ponta a ponta (feito depois de 1 correção no
      caminho — ver Problemas Encontrados):
      1. **Cron `/api/cron/daily`**: testado via curl com o header
         `Authorization: Bearer <CRON_SECRET>` real (usuário rodou o
         comando) → 200,
         `{"ok":true,"resultado":{"feriadosSincronizados":false,"clientesProcessados":3,...}}` —
         confirma que o Route Handler, o CRON_SECRET, e o
         runDailyJob() (Fase 8, intocado) funcionam de ponta a ponta em
         produção, incluindo o fix do middleware (sem o 307 de redirect
         que apareceu no teste local antes da correção)
      2. **Login**: usuário logou na aba do navegador controlada pela
         sessão da IA (a IA nunca digitou a senha); sessão persistiu
         corretamente entre navegações
      3. **Geração de imagem (Puppeteer + @sparticuz/chromium)**: 1ª
         tentativa retornou erro 500 (ver Problemas Encontrados — bug
         real, corrigido); depois do fix e redeploy, 2ª tentativa → 200,
         imagem gerada com sucesso, baixada e inspecionada visualmente
         (Read tool): gradiente, logo, texto e rodapé idênticos ao
         resultado local — confirma que puppeteer-core +
         @sparticuz/chromium funciona de verdade no ambiente serverless
         da Vercel, não só compila
      4. **Chat**: mensagem "oi" enviada em produção → resposta da IA
         (saudação, sem chamar Groq, igual ao comportamento local)
         apareceu corretamente
      5. **Cadastro de cliente**: cliente de teste criado
         ("Teste Fase 9 Producao" / "Empresa Teste Deploy") via
         /clientes/novo em produção → redirecionou pro cliente novo, 1ª
         pergunta do motor de perguntas (Fase 1) apareceu automaticamente
         no chat — confirma que o trigger de banco (handle_new_client) e
         o motor de perguntas funcionam em produção
      **Fase 9 validada em produção.** Cliente de teste ("Teste Fase 9
      Producao") e o post com imagem gerada no teste ficam no banco,
      claramente identificáveis — o usuário pode apagar quando quiser.

## Problemas Encontrados
- [2026-08-02] Problema: `npm run build` falhou com `Only async
  functions are allowed to be exported in a "use server" file` ao tentar
  adicionar `export const maxDuration = 60` em src/app/actions.ts e
  src/app/calendar-actions.ts. Contexto: a ideia era garantir
  explicitamente mais tempo de execução pras Server Actions que disparam
  Puppeteer (generateImageAction, e sendMessageAction via
  handleSuggestionReply), já que serverless roda o Puppeteer mais devagar
  que localmente. Descoberta: arquivos com a diretiva `"use server"` no
  topo só podem exportar funções async — qualquer outro export (como uma
  const de configuração de rota) quebra o build. Status: resolvido —
  `maxDuration` de uma Server Action é herdado da ROTA que a invoca, não
  do arquivo de actions em si; movido pra
  `export const maxDuration = 60` em src/app/clientes/[id]/page.tsx (a
  única rota que renderiza tanto ChatClient quanto ApprovedPosts, as duas
  vias que podem disparar geração de imagem). `npm run build` voltou a
  passar depois da correção.
- [2026-08-02] Problema (mais sério, só apareceu no teste manual da rota,
  não no build): a rota /api/cron/daily, mesmo com o header
  `Authorization` correto, retornava **307 (redirect pro /login)** em vez
  de 401 ou 200 — o middleware de autenticação (Fase 1) estava
  interceptando a chamada ANTES dela chegar no código da rota, porque o
  `matcher` de src/middleware.ts cobria literalmente todas as rotas
  (exceto assets estáticos), sem excluir `/api/*`. Isso teria quebrado o
  cron 100% em produção: a Vercel chamaria a rota sem sessão de usuário
  (ela não tem cookie de login nenhum), seria redirecionada pro /login, e
  o job diário nunca rodaria de verdade — um bug silencioso que só
  aparece rodando a invocação real, não em nenhuma validação de tipo ou
  lint. Contexto: descoberto testando a rota localmente via `curl`
  (`Status sem header: 307`, quando o esperado era 401). Status: resolvido
  — `matcher` de src/middleware.ts ajustado pra excluir explicitamente
  `api/cron` (só essa rota, não todo `/api/*`, pra manter qualquer rota
  de API futura protegida por padrão a menos que opte explicitamente por
  sair). Revalidado via curl: sem header → 401; header errado → 401;
  header correto → 200 com o job rodando de verdade (log
  `[cron] Job diário concluído...` apareceu no servidor). Sem esse teste
  manual específico (que não é coberto por tsc/eslint/build, já que é um
  comportamento de runtime do middleware, não um erro de tipo), esse bug
  só teria sido descoberto em produção, na pior hora possível — o
  primeiro disparo real do cron.
- [2026-08-02] Observação (achado incidental, não introduzido nesta
  fase): `.env.local.example` nunca tinha sido commitado no
  repositório — o padrão `.env*` em .gitignore (presente desde a Fase 1)
  acabava excluindo até o arquivo de exemplo/template, que deveria ser
  público (só .env.local, com os valores reais, deveria ser ignorado).
  Confirmado via `git status --ignored` (`.env.local.example` aparecia
  como ignorado). Como esta fase depende de ter a lista de env vars de
  produção documentada e acessível no repositório (pra quem for
  configurar a Vercel), corrigido o .gitignore pra excluir
  `.env.local.example` do padrão `.env*` (`!.env.local.example`). Sem
  essa correção, o arquivo de referência das env vars simplesmente não
  existiria pra ninguém que clonasse o repositório do zero.
- [2026-08-02] **Problema mais sério da fase**: depois do deploy real na
  Vercel, o botão "Gerar imagem" retornava **erro 500** (Server Action
  falhando) — o único problema que não tinha como ser pego localmente,
  já que `RODANDO_NA_VERCEL` só é `true` de verdade rodando na Vercel
  (local sempre usa o Chrome do Windows via `channel: "chrome"`, então
  o caminho de código do @sparticuz/chromium nunca roda fora de lá).
  Investigação: a resposta HTTP da Server Action só trazia um
  `digest` (Next.js esconde stack traces de erro do client em produção
  por padrão) — pedi pro usuário verificar o log real no painel da
  Vercel enquanto eu pesquisava o erro em paralelo. Pesquisa (WebSearch)
  encontrou o problema exato, documentado como um gotcha conhecido da
  comunidade Next.js/Vercel: o rastreamento automático de arquivos do
  Next ("output file tracing") NÃO inclui sozinho
  `node_modules/@sparticuz/chromium/bin` (o binário real do Chromium) no
  bundle de nenhuma function, mesmo com o pacote já vindo na lista
  padrão de `serverExternalPackages` — são mecanismos diferentes
  (external packages controla como o código é importado/empacotado;
  output file tracing controla quais ARQUIVOS além do código entram no
  bundle final). Sem essa inclusão explícita, `chromium.executablePath()`
  aponta pra um arquivo que simplesmente não existe no ambiente de
  produção. Status: **resolvido** — adicionado `outputFileTracingIncludes:
  { "/*": ["node_modules/@sparticuz/chromium/bin/**/*"] }` em
  next.config.ts (commit `a72b50e`). Depois do redeploy automático (push
  → Vercel rebuilda sozinha), reteste confirmou sucesso: Server Action
  retornou 200, imagem gerada e inspecionada visualmente, idêntica ao
  resultado local. Esse bug é a prova concreta de por que a Etapa 5
  pedia "testar com atenção redobrada" — nem `tsc`, nem `eslint`, nem
  `npm run build` local detectam esse tipo de problema, porque o código
  está sintaticamente correto e o build local nem entra no branch
  `RODANDO_NA_VERCEL`; só aparece rodando de verdade no ambiente real da
  Vercel.
- [2026-08-02] Observação de processo: durante a investigação do erro
  500, tentativas de clicar em botões via coordenada de tela
  (`computer left_click` com `ref`) na aba do navegador controlada pela
  IA pareceram não registrar o clique de forma confiável (o estado da
  UI não mudava, e uma vez um clique pareceu ter acionado um link de
  navegação diferente por prefetch do Next.js, não por engano de
  coordenada). Contornado chamando `.click()` diretamente via
  `javascript_tool` no elemento (`document.querySelectorAll('button')`
  + filtro por texto) — mais confiável nesta sessão pra cliques em
  botões dentro desse painel de navegador específico. Registrado como
  nota de ferramenta, não um bug do projeto.

## Decisões Tomadas
- **Vercel como plataforma de deploy.** Justificativa: integração nativa
  com Next.js (App Router, Server Actions, Route Handlers funcionam sem
  nenhuma configuração extra de runtime), Vercel Cron Jobs resolve a
  Etapa 3 sem precisar de um serviço de agendamento terceiro, e os
  limites do plano Hobby (gratuito) confirmados na documentação oficial
  cobrem exatamente o uso esperado deste projeto (ver Etapa 1 acima).
  Não avaliei outras plataformas (Netlify, Railway, Render) em
  profundidade igual — a integração nativa e o cron de graça já eram
  motivo suficiente dado que o próprio escopo desta fase já apontava pra
  Vercel como opção preferencial, e nenhum requisito do projeto (Fases
  1-8) pede algo que a Vercel não ofereça no free tier.
- **`process.env.VERCEL === "1"` pra detectar produção, não
  `NODE_ENV`.** Pedido no escopo pra documentar essa escolha. Motivo:
  `NODE_ENV` vira `"production"` também rodando local via `npm run
  build && npm run start` (testar o build de produção antes de
  deployar) — nesse cenário, no Windows do usuário, tentar usar o
  binário Linux-only do @sparticuz/chromium quebraria (arquitetura
  errada), quando o correto seria continuar usando o Chrome do Windows
  via `channel: "chrome"`. `process.env.VERCEL` é definida
  automaticamente pela própria Vercel em qualquer ambiente dela (build
  e runtime) e nunca aparece rodando local de nenhuma forma — sinal mais
  preciso do que realmente importa aqui ("estou rodando DENTRO da
  infraestrutura da Vercel?"), não só "o bundle foi otimizado pra
  produção?".
- **`puppeteer-core` com `channel: "chrome"` pro fallback local, em vez
  de manter o pacote `puppeteer` completo como devDependency.** O
  escopo previa "um fallback pro Chromium local baixado durante
  desenvolvimento", o que sugeriria manter `puppeteer` (que baixa
  Chromium sozinho) só em dev. Preferi `channel: "chrome"` (recurso
  nativo do puppeteer-core desde a v22, localiza um Chrome/Chromium já
  instalado no sistema) porque: (1) o próprio escopo pedia
  explicitamente `npm uninstall puppeteer` — manter como devDependency
  iria contra essa instrução literal; (2) evita duas dependências
  fazendo essencialmente a mesma coisa (gerenciar um Chromium) só que
  uma pra cada ambiente; (3) o Chrome já estava instalado no Windows do
  usuário (confirmado antes de decidir), então não há download nenhum
  necessário nem em dev. Risco aceito: se algum dev no futuro rodar este
  projeto numa máquina sem Chrome instalado, vai ver um erro claro do
  próprio puppeteer-core orientando a instalar o Chrome — não um erro
  silencioso ou confuso.
- **`maxDuration = 60` explícito** (em src/app/api/cron/daily/route.ts e
  src/app/clientes/[id]/page.tsx), mesmo o Hobby da Vercel já tendo 300s
  como padrão com fluid compute. Motivo: 60s já é uma folga generosa
  considerando a desaceleração de 4-8x do Puppeteer em serverless (vs.
  ~5-8s local, documentado na Fase 3) sem chegar perto do teto de 300s;
  deixar explícito também serve de documentação de intenção pra quem ler
  o código depois, em vez de depender silenciosamente de um default de
  plataforma que poderia mudar.
- **`vercel.json` com o cron committado no repositório**, não configurado
  manualmente só pelo painel da Vercel. Motivo: cron jobs da Vercel via
  `vercel.json` são versionados junto com o código (qualquer mudança de
  horário/expressão fica no histórico do git, junto com o código que ela
  dispara) — configurar só pelo painel seria um estado que vive fora do
  repositório, mais fácil de divergir ou se perder.
- **`api/cron` excluído do matcher do middleware, não todo `/api/*`.**
  Ver Problemas Encontrados pro bug que motivou essa mudança. Optei por
  excluir só o caminho específico (`api/cron`) em vez de todo `/api/*`
  como precaução — hoje só existe essa rota de API no projeto, mas se
  uma fase futura criar outra rota que DEVA respeitar a sessão de
  usuário, o padrão mais restrito (opt-out específico, não uma exclusão
  geral) evita que ela fique desprotegida por padrão sem ninguém notar.
- **CRON_SECRET reaproveitado do .env.local existente pra também
  configurar em produção** (em vez de gerar um novo só pra produção).
  Motivo prático: permite que a IA teste a rota de produção via curl
  sem precisar que o usuário compartilhe o segredo de novo pelo chat
  (ela já tem o valor, só leu de .env.local nesta mesma sessão) — evita
  introduzir um segredo novo na conversa só pra fins de teste.
- **`outputFileTracingIncludes` com chave global `"/*"`**, não uma chave
  específica por rota (ex.: `"/clientes/[id]"`). Motivo: rotas dinâmicas
  do App Router (com colchetes, ex.: `[id]`) precisariam de escaping de
  glob (picomatch trata `[` `]` como caracteres especiais) pra funcionar
  como chave — usar `"/*"` cobre qualquer rota atual ou futura que venha
  a chamar `renderHtmlToPngBuffer` sem precisar acertar esse escaping
  nem lembrar de adicionar uma chave nova toda vez que uma nova rota
  passar a gerar imagem. Custo aceito: o binário do Chromium
  (~40-50MB) entra no bundle de TODAS as functions, não só a que
  precisa — dentro do limite de 250MB do Hobby com folga, então não é
  um problema prático neste projeto.
- **Divisão de responsabilidade no deploy (Etapa 5) entre IA e
  usuário**, decidida em conjunto com o usuário no meio da sessão: a IA
  fez 100% do trabalho de código (Etapas 1-4, e a correção do bug de
  produção), e o usuário fez especificamente as 3 ações que a IA nunca
  executa (criar/logar na conta Vercel, digitar as 6 env vars, aprovar
  o push pro repositório) — não por escolha de escopo, mas por regra de
  segurança fixa que não muda com o contexto da tarefa. Testes em
  produção (login, chat, cadastro, geração de imagem, cron) foram
  feitos pela IA depois disso, usando uma aba de navegador com sessão
  própria (separada do navegador pessoal do usuário) em que o USUÁRIO
  fez login (a IA nunca digitou a senha).

---

# Fase 8 — Agendamento automático diário

## Concluído
- [x] Etapa 1 — Decisão: **node-cron dentro do processo Next, via
      src/instrumentation.ts** (Opção A do escopo), não um Route Handler
      pra agendador externo (Opção B). Ver Decisões Tomadas pro
      raciocínio completo e a rota de migração pra produção.
- [x] Etapa 2 — src/lib/cron/daily-job.ts criado (runDailyJob): roda em
      sequência, pra TODOS os clientes — (1) checkHolidaysUpToDate
      (Fase 3, intocada) e só chama syncNationalHolidays se desatualizado;
      (2) runCalendarEngine; (3) generateSuggestionsForPending. Log único
      com timestamp de início e um resumo (feriados sincronizados ou não,
      clientes processados, eventos detectados, sugestões geradas,
      falhas). src/lib/supabase/admin.ts criado — client de service role
      novo, necessário porque o job roda sem sessão de usuário (não dá
      pra usar o client cookie-based existente fora de uma requisição
      HTTP). Nenhuma das 3 funções orquestradas (holidays-check.ts,
      holidays-sync.ts, calendar-engine.ts, generate-suggestions.ts) foi
      alterada — só chamadas com um client diferente
- [x] Etapa 3 — src/instrumentation.ts criado: register() roda uma vez
      na subida do processo, guardado por `NEXT_RUNTIME === "nodejs"`
      (instrumentation.ts também carrega no runtime edge) e por uma
      flag em `globalThis` (proteção contra registro duplicado no mesmo
      processo). Agenda node-cron pra `"0 8 * * *"` (todo dia às 8h),
      chamando runDailyJob com try/catch próprio (erro no job não deve
      derrubar o processo). node-cron carregado via `eval("require")` —
      ver Problemas Encontrados, é a correção de um erro de build
      encontrado no caminho, não uma escolha arbitrária
- [x] Etapa 4 — Botões "Sincronizar feriados" (home) e "Verificar datas
      comemorativas" (tela do cliente) intocados —
      src/app/calendar-actions.ts não foi alterado nesta fase. Dedup já
      existente (Fases 2/3, por chave data_evento+tipo_evento+nome_evento
      em content_calendar, e por nome+mes+dia+ano em special_dates)
      cobre rodar automático e manual no mesmo dia sem duplicar —
      confirmado no teste da Etapa 5 (2ª execução do job zerada)
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e `npm run
      build` sem erros. No caminho, o build quebrou 1x com node-cron —
      ver Problemas Encontrados (resolvido com eval("require") em
      instrumentation.ts)

- [x] Etapa 5 — Teste ponta a ponta rodado via `npx tsx` chamando
      runDailyJob() direto (mesmo padrão das Fases 5-7) MAIS verificação
      real do registro do cron via `npm run dev` + browser. Resultado:
      1. **Registro do agendamento**: log
         `[cron] Agendamento diário registrado (expressão "0 8 * * *",
         todo dia às 8h).` apareceu corretamente na subida do servidor
         (`npm run dev`), confirmando que node-cron.schedule() foi
         chamado — sem esperar 24h, já que o disparo em si foi testado
         manualmente (ver abaixo)
      2. **Middleware/login intactos**: confirmado que a autenticação
         (Fase 1) continua funcionando normalmente depois de adicionar
         instrumentation.ts — sem erros no console nem no servidor
      3. **Disparo manual do job, cenário real**: estado inicial
         confirmado (0 eventos pendentes, feriados 2026/2027 já
         sincronizados). Criado um cenário de teste temporário — data de
         aniversário do "Cliente Teste" ajustada pra dentro da janela de
         7 dias (revertida pra `null` logo depois do teste) — pra ter
         algo genuíno pra detectar, já que os eventos "próximos" reais já
         tinham sido registrados em fases anteriores. 1ª execução:
         `feriados já estavam atualizados` (confirma a checagem
         condicional funcionando — não ressincronizou à toa), 3
         clientes processados, **1 evento novo detectado, 1 sugestão
         gerada, 0 falhas**
      4. **Sugestão idêntica ao fluxo manual**: mensagem da IA no chat do
         "Cliente Teste" no formato exato de formatSuggestionMessage
         (mesma função usada pelo botão manual, intocada) — "Aniversário
         de Cliente Teste está chegando (5 de agosto)..." com call-to-
         action de aprovar/ajustar/rejeitar
      5. **Integração com o histórico da Fase 7 confirmada**: a linha
         criada em content_calendar_history pro evento novo tem
         `status_anterior: "pendente_geracao"`, `status_novo: "sugerido"`,
         e o texto exato gerado — confirma que generateSuggestionsForPending
         chamado pelo job automático grava histórico exatamente como
         chamado pelo botão manual (mesmo código, só client diferente)
      6. **Dedup confirmado**: 2ª execução do job, logo em seguida,
         voltou **0 eventos detectados, 0 sugestões geradas** — nada
         duplicado, o dedup das Fases 2/3 cobre o caminho automático sem
         nenhuma mudança adicional
      **Fase 8 validada.** O evento de teste ("Aniversário de Cliente
      Teste", status 'sugerido') ficou no banco, claramente
      identificável — o usuário pode aprovar, ajustar ou apagar quando
      quiser.

## Problemas Encontrados
- [2026-08-02] Problema: `npm run build` falhou com
  `UnhandledSchemeError: Reading from "node:crypto" is not handled by
  plugins` e `Module not found: Can't resolve 'path'`/`'child_process'`,
  apontando pra `node-cron` importado (indiretamente, via dynamic
  import) por `src/instrumentation.ts`. Contexto: node-cron usa APIs
  nativas do Node (`node:crypto`, `path`, `child_process`) que o
  webpack não sabe empacotar — mesma classe de problema já visto com o
  Puppeteer na Fase 3, mas a correção de lá (`serverExternalPackages`
  em next.config.ts) **não resolveu desta vez**: adicionar `"node-cron"`
  à lista não teve nenhum efeito, o erro persistiu idêntico. Investigação:
  `instrumentation.ts` passa por um compilador webpack separado do resto
  do app (não é uma Server Action nem um Server Component comum), e esse
  compilador aparentemente não respeita `serverExternalPackages` — isso
  bate com relatos conhecidos da comunidade Next.js sobre bibliotecas
  Node-only dentro de `instrumentation.ts`. Status: resolvido — troquei
  o dynamic `import("node-cron")` por `eval("require")("node-cron")`
  (ver src/instrumentation.ts). `eval("require")` obtém a função
  `require()` real do Node sem que o webpack consiga enxergar/analisar
  estaticamente a chamada `require("node-cron")` dentro dele — o módulo
  nunca entra no grafo de dependências do bundler, é carregado direto
  pelo Node em runtime. `serverExternalPackages: ["node-cron"]` foi
  removido de next.config.ts de volta (não fazia nada; deixar lá seria
  enganoso). `npm run build` voltou a passar limpo depois da troca.
- [2026-08-02] Observação (não bloqueou nada, aceito como está): depois
  de adicionar instrumentation.ts, o tamanho do bundle "Middleware"
  reportado pelo `npm run build` subiu de 92.8kB (Fase 7) pra 151kB.
  Contexto: mesmo com o guard `process.env.NEXT_RUNTIME !== "nodejs"` no
  topo de `register()` (padrão oficialmente recomendado pela
  documentação do Next justamente pra evitar isso, via tree-shaking do
  branch Node-only no bundle edge), o bundle do runtime edge (que
  aparentemente inclui middleware.ts + a parte edge-compatível de
  instrumentation.ts num único chunk reportado como "Middleware") cresceu
  mesmo assim. Não investiguei mais fundo o porquê exato (não afeta
  nenhuma funcionalidade: login/middleware seguem funcionando
  normalmente, confirmado no teste da Etapa 5, e 151kB ainda está bem
  dentro de limites normais, inclusive de runtime edge de produção) — é
  só uma observação de bundle size, não um bug funcional. Como o projeto
  roda LOCAL nesta fase (deploy é explicitamente fora de escopo),
  registrado aqui como algo pra reavaliar se/quando uma fase de deploy
  futura mexer em middleware.ts ou instrumentation.ts.
- [2026-08-02] Não-bug, engano no próprio script de teste descartável:
  ao verificar o histórico do evento recém-criado via REST, indexei o
  array errado (`evento[0]` em vez de `evento[1]`) e por um instante
  pareceu que content_calendar_history tinha ficado vazio pro evento
  novo. Reconferido com o id correto — o histórico estava lá, correto
  (`pendente_geracao` -> `sugerido`, texto exato). Registrado só pra
  não confundir uma sessão futura relendo os logs desta.

## Decisões Tomadas
- **node-cron dentro do processo Next (instrumentation.ts), não um
  Route Handler pra agendador externo.** O escopo pedia decidir com
  base em "qual é mais simples de testar HOJE sem exigir configuração
  de SO". As duas opções evitam configuração de SO só pra *testar* (uma
  chamada de função ou uma rota HTTP, ambas disparáveis na hora) — mas
  só a Opção A entrega o objetivo real desta fase ("agendamento
  automático diário... sem depender de lembrança humana") sem depender
  de MAIS NADA: um Route Handler sozinho não roda automaticamente
  nenhuma vez — precisaria do Windows Task Scheduler configurado à
  parte pra realmente disparar todo dia, o que É configuração de SO,
  só que pro funcionamento de verdade, não só pro teste. Escolher a
  Opção A entrega automação real hoje, com o processo `npm run dev` (ou
  `npm run start`) já rodando. **Troca necessária pra produção/deploy**
  (documentando conforme pedido no escopo): se o projeto for pra uma
  hospedagem serverless (Vercel etc.), processos não ficam "sempre de
  pé" da mesma forma — node-cron long-running dentro do processo não é
  garantia de disparo (a função pode nunca ficar quente às 8h da manhã
  especificamente). Nesse cenário, a Opção B (Route Handler +
  agendador externo — Vercel Cron Jobs, por exemplo) é o padrão certo;
  a migração é direta, porque `runDailyJob()` já é uma função
  standalone independente do mecanismo de disparo — só trocar
  `instrumentation.ts` por um `src/app/api/cron/daily/route.ts` que
  chama `runDailyJob()` e é protegido por um header comparado a um
  `CRON_SECRET` (env var), sem tocar em `daily-job.ts` nem em nenhuma
  das funções que ele orquestra.
- **Client de service role novo (src/lib/supabase/admin.ts), separado
  do client cookie-based existente.** Necessidade descoberta ao
  implementar, não estava no escopo original de forma explícita: o
  client de `src/lib/supabase/server.ts` usa `next/headers` `cookies()`,
  que só funciona dentro de uma requisição HTTP real (Server Component,
  Server Action, Route Handler) — `instrumentation.ts` roda na subida
  do processo, fora de qualquer requisição, então não tem cookies nem
  sessão de usuário pra usar. Além disso, mesmo que desse pra chamar
  `cookies()` ali, RLS (`auth.uid() is not null`) bloquearia tudo, já
  que não há usuário autenticado num job agendado. Só o service role
  (que ignora RLS) resolve. Documentado explicitamente em admin.ts pra
  nunca ser usado num caminho que atende requisição de usuário — só no
  cron.
- **runDailyJob() sempre roda pra TODOS os clientes** (nenhum parâmetro
  de clientId, diferente de runCalendarEngine/generateSuggestionsForPending
  que aceitam um filtro opcional). Motivo: é exatamente o que um job
  diário automático precisa fazer — não faria sentido um agendamento
  automático que só cobre 1 cliente escolhido a dedo; os botões manuais
  continuam cobrindo o caso de "só este cliente agora".
- **Sincronização de feriados é condicional** (só roda
  syncNationalHolidays se checkHolidaysUpToDate.atualizado for false),
  não incondicional todo dia. Pedido explicitamente no escopo ("não
  sincronizar toda vez sem necessidade") — evita uma chamada de rede
  desnecessária à API Nager.Date (e o trabalho de dedup em memória de
  syncNationalHolidays) 364 dias por ano, rodando só quando de fato
  precisa (na prática, uma vez por ano, na virada, quando o ano seguinte
  ainda não está coberto).
- **`eval("require")` pra carregar node-cron em instrumentation.ts**,
  em vez de um import estático ou dynamic import comum. Ver Problemas
  Encontrados pro erro que motivou isso — é uma técnica conhecida da
  comunidade Next.js especificamente pra esse cenário (bibliotecas
  Node-only dentro de instrumentation.ts), não uma escolha por
  preferência. Isolado só nesse arquivo — `daily-job.ts` e todo o resto
  do código de calendário continuam com imports normais, porque só
  node-cron tem esse problema de bundling (é o único pacote nessa
  cadeia com bindings nativos do Node fora do próprio Node.js puro).
- **Campo `origem` de content_calendar_history continua gravando
  `"chat"` mesmo quando a mudança de status vem do job automático**
  (generateSuggestionsForPending não foi alterado pra passar um
  `origem` diferente pro helper de histórico da Fase 7). Aceito como
  está nesta fase — o escopo pedia explicitamente "não mexer... no
  histórico de aprovação", e ajustar `origem` exigiria tocar em
  generate-suggestions.ts e/ou history.ts. Tecnicamente impreciso (a
  Fase 7 já tinha deixado esse campo "pronto pra fontes futuras" —
  este é o primeiro caso real de uma fonte diferente de "chat"), mas
  não quebra nada: o dado mais importante do histórico (texto exato,
  timestamp, sequência de status) continua correto de qualquer forma.
  Candidato natural pra um ajuste pequeno numa fase futura, se a
  distinção "veio do cron vs. veio de alguém clicando o botão manual"
  vier a importar de verdade.

---

# Fase 7 — Histórico auditável de aprovação de posts

## Concluído
- [x] Etapa 1 — Migration
      supabase/migrations/20260801050000_calendar_history_schema.sql:
      tabela content_calendar_history (id, content_calendar_id fk com
      `on delete cascade`, status_anterior nullable, status_novo not
      null — ambos com check constraint nos mesmos 5 valores de
      content_calendar.status —, texto_no_momento, origem text not
      null default 'chat' SEM check constraint, created_at). RLS igual
      ao padrão do projeto (auth.uid() is not null). Sem trigger de
      updated_at (tabela de log, só insert, nunca update) e sem
      Realtime (não precisa de UI ao vivo reagindo a ela nesta fase).
      Tipos TS estendidos em src/lib/supabase/types.ts
      (ContentCalendarHistory exportado). **PENDENTE: usuário precisa
      rodar esta migration no SQL Editor.**
- [x] Etapa 2 — src/lib/calendar/history.ts criado com
      registrarHistoricoStatus, um helper único reaproveitado nos 3
      pontos que mudam content_calendar.status:
      1. src/lib/calendar/handle-reply.ts (handleSuggestionReply): os 3
         branches (aprovado, rejeitado, ajustado) passaram a gravar
         histórico logo após o update de status ter sucesso — sem
         alterar nenhuma linha da lógica de decisão em si
      2. src/lib/calendar/generate-suggestions.ts
         (generateSuggestionsForPending): grava histórico
         'pendente_geracao' -> 'sugerido' após o update de status
      3. src/lib/chat/handle-free-message.ts (criarConteudoAvulso):
         grava histórico null -> 'sugerido' (post avulso criado direto
         nesse status, sem status anterior) — o insert precisou passar
         a fazer `.select("id").single()` pra conseguir o id da linha
         recém-criada e gravar o histórico associado a ela
      Revisado calendar-engine.ts (cria linhas 'pendente_geracao' via
      insert simples) — não precisa de histórico porque não é uma
      "mudança" de status, é a criação inicial da linha antes de
      qualquer decisão de conteúdo existir
- [x] Etapa 3 — src/app/clientes/[id]/page.tsx: busca
      content_calendar_history pros posts aprovados (`in
      content_calendar_id`, ordenado por created_at) e agrupa por
      post; formatarDataHoraPtBr adicionado em src/lib/calendar/format.ts
      (mesmo estilo de formatarDataPtBr, mas com hora). ApprovedPosts
      (src/components/approved-posts.tsx) ganhou um campo `historico`
      por item e renderiza uma lista cronológica simples (status + data
      + texto exato entre aspas) só quando há pelo menos 1 linha de
      histórico — posts aprovados antes desta fase (sem histórico)
      simplesmente não mostram a seção, sem quebrar nada
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e `npm run
      build` sem erros. No caminho, o `tsc` acusou 1 arquivo quebrado:
      ver Problemas Encontrados (arquivos de conflito "Copia" do
      OneDrive, removidos)

- [x] Usuário rodou supabase/migrations/20260801050000_calendar_history_schema.sql
      — confirmado via REST API (content_calendar_history acessível,
      vazia)
- [x] Etapa 4 — Teste ponta a ponta rodado via `npx tsx` (mesma
      adaptação de método já usada nas Fases 5/6 pra lógica de
      servidor — chama as funções reais direto, contra o Supabase e a
      Groq de verdade) MAIS verificação visual real via `npm run dev` +
      browser (login feito pelo usuário, a IA não digitou senha) — a
      primeira vez nesta sessão que o preview do browser tool funcionou
      sem travar, confirmando que mover o projeto pra fora do OneDrive
      (Fase 5) resolveu a instabilidade recorrente das fases anteriores.
      Usado o cliente real "Erik Chagas" / ErizonAI. Resultado:
      1. **Post A (ajuste no meio)**: post avulso criado ("promoção de
         fim de ano") → respondido "deixa mais curto e informal" →
         respondido "aprovado". Histórico gravado em 3 linhas, na ordem
         certa: `null->sugerido` (texto original), `sugerido->ajustado`
         (texto revisado, mais curto), `ajustado->aprovado` (mesmo
         texto revisado) — cada uma com o texto EXATO daquele instante,
         mesmo o texto original tendo sido sobrescrito depois
      2. **Post B (aprovado direto, sem ajuste)**: post avulso criado
         ("diferencial de atendimento") → respondido "aprovado"
         direto. Histórico gravado em exatamente 2 linhas:
         `null->sugerido`, `sugerido->aprovado` — **sem nenhuma linha
         'ajustado' no meio**, confirmando o caso pedido explicitamente
         no escopo
      3. **Post C (motor de calendário)**: linha criada direto como
         'pendente_geracao' (simulando o calendar-engine) →
         generateSuggestionsForPending rodado → 1 linha de histórico
         `pendente_geracao->sugerido` com o texto gerado pela Groq
      4. **Verificação visual na tela do cliente**: a seção "Posts
         aprovados" mostrou a linha do tempo completa e correta pros
         Posts A e B (status, data/hora, texto entre aspas, na ordem
         cronológica certa); o post aprovado numa fase anterior (sem
         linhas de content_calendar_history, criado antes desta fase)
         apareceu normalmente na lista, só sem a seção de histórico —
         confirma que posts antigos não quebram
      **Fase 7 validada.** Posts de teste (A, B, C — IDs no histórico
      de execução desta sessão) ficaram no banco, claramente
      identificáveis pelo nome_evento ("Post avulso: gera um post curto
      avisando...", "Post avulso: gera um post curto sobre nosso
      diferencial...", "Teste Fase 7 - geracao de sugestao") — o
      usuário pode apagar quando quiser.

## Problemas Encontrados
- [2026-08-02] Problema: `npx tsc --noEmit` falhou depois da Etapa 3
  com erro de tipo em `src/app/clientes/[id]/page - Copia.tsx` (Property
  'historico' is missing). Contexto: esse arquivo (nome com espaço,
  "page - Copia.tsx") não é uma rota válida do Next.js (App Router
  exige `page.tsx` exato), mas ainda é compilado pelo `tsc`/`eslint`
  por ser um `.tsx` dentro de `src/`. Investigação: `diff` contra o
  `page.tsx` real mostrou que era uma cópia byte-a-byte da versão
  ANTERIOR à minha edição desta fase — achei mais 2 arquivos do mesmo
  padrão (`src/app/clientes/novo/page - Copia.tsx`,
  `src/app/clientes/[id]/marca/page - Copia.tsx`), ambos idênticos aos
  seus originais (diff vazio). Mesma classe de artefato já documentada
  e resolvida na Fase 5 (INCIDENTE do OneDrive — arquivos
  "client - Copia.ts"/"server - Copia.ts" na época) — sobras de
  conflito de sincronização do OneDrive que não foram limpas depois do
  incidente, mesmo já com o projeto no caminho novo. Status: resolvido
  — comparei o conteúdo de cada um contra o arquivo real (idêntico) e
  apaguei os 3. `tsc`, `eslint` e `build` voltaram a passar limpo.
- [2026-08-02] Problema (não é bug, é limitação do script de teste):
  rodar o teste ponta a ponta via `npx tsx` disparou
  `generateImageForApprovedPost` (chamada automaticamente por
  handleSuggestionReply no branch 'aprovado', comportamento da Fase 3,
  intocado) e ela falhou com "NEXT_PUBLIC_SUPABASE_URL não
  configurada". Causa: o script de teste só definiu
  `process.env.GROQ_API_KEY`/`GROQ_MODEL` manualmente (as únicas env
  vars que o código de geração de sugestão precisa), sem propagar
  `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` pro
  `process.env` real (usei essas só localmente pra montar o client
  Supabase do teste) — `upload-logo.ts` lê essa env var direto de
  `process.env`, então falhou fora do contexto do Next.js. Status: não
  corrigido (nem precisava) — o próprio try/catch já existente em
  handle-reply.ts (Fase 3) capturou o erro sem quebrar a aprovação nem
  o registro de histórico, que é exatamente o comportamento esperado;
  serviu inclusive de confirmação extra de que essa proteção funciona.
  Fora do script de teste isolado, rodando via `npm run dev` normal,
  essa env var está sempre configurada (vem do `.env.local` carregado
  pelo Next.js), então esse problema não existe em uso real.

## Decisões Tomadas
- **Histórico gravado DEPOIS do update/insert de status ter sucesso,
  nunca antes.** Motivo: o Supabase JS client não abre uma transação
  multi-statement a partir do código da aplicação (cada chamada
  `.update()`/`.insert()` é sua própria operação) — criar uma função
  RPC em PL/pgSQL só pra ter atomicidade real seria complexidade
  desproporcional pro estágio atual do projeto (mesmo espírito de
  simplicidade já usado em outras decisões, ex.: dedup em memória da
  Fase 2). Escolhendo a ordem update-depois-histórico, garanto que uma
  linha de histórico NUNCA existe descrevendo uma mudança que não
  aconteceu de verdade — o risco inverso (status mudou mas o histórico
  falhou ao gravar) é aceito e tratado como não-fatal (ver decisão
  abaixo), porque é estritamente menos grave pro caso de uso de
  auditoria ("mostrar que o cliente aprovou X nesse dia") do que ter um
  registro fantasma de uma aprovação que nunca se efetivou.
- **Falha ao gravar histórico é só logada (console.error), nunca
  propagada/lançada.** Mesmo padrão já usado pra geração de imagem
  automática em handle-reply.ts (Fase 3): o registro auditável é um
  efeito colateral do fluxo de aprovação, não o fluxo em si — travar a
  aprovação de um post porque o log de auditoria falhou seria pior pro
  usuário do que perder uma linha de histórico ocasional. Centralizado
  num helper único (registrarHistoricoStatus em
  src/lib/calendar/history.ts) reaproveitado nos 3 pontos que mudam
  status, pra não duplicar esse try/catch em cada call site.
- **Campo `origem` sem check constraint restringindo valores** (text
  not null default 'chat', em vez de `check (origem in ('chat'))`).
  Pedido explicitamente no escopo ("deixar o campo pronto pra fontes
  futuras") — hoje só existe aprovação via chat, mas uma fonte nova
  (ex.: uma tela de aprovação direta, uma API externa) não vai exigir
  uma migration nova só pra liberar um valor adicional nessa coluna.
  `status_anterior`/`status_novo` continuam com check constraint fechado
  (mesmos 5 valores de content_calendar.status) porque esses SÃO um
  enum fechado de verdade — só content_calendar.status pode mudar esse
  conjunto, não é algo que "fontes futuras" precisem estender.
- **Post avulso (criarConteudoAvulso) grava histórico com
  status_anterior=null**, não omite a primeira linha do histórico.
  Motivo: etapa 4 do escopo pedia explicitamente confirmar um "histórico
  coerente" mesmo pra posts aprovados sem ajuste — sem essa primeira
  linha (null->sugerido), a linha do tempo de um post aprovado direto
  começaria já em "aprovado", sem mostrar quando/com que texto ele foi
  originalmente sugerido. Mesmo raciocínio aplicado ao motor de
  calendário (generate-suggestions.ts), que grava
  'pendente_geracao'->'sugerido' — a diferença é que ali SEMPRE existe
  um status anterior real (a linha já existia como 'pendente_geracao'
  antes), então não é um caso de status_anterior=null.
  calendar-engine.ts (cria a linha 'pendente_geracao' inicial) foi
  revisado e deliberadamente NÃO instrumentado — nesse ponto ainda não
  existe nenhuma decisão de conteúdo pra registrar (sugestao_texto
  ainda é null), então não é uma "mudança de status" no sentido que
  esta fase pede auditar, é só a criação da fila de trabalho.
- **Linha do tempo mostrada só na seção "Posts aprovados"** (só posts
  com status='aprovado' recebem a query de histórico em page.tsx), não
  uma tela de histórico separada. Motivo: é exatamente o que a Etapa 3
  do escopo pediu ("Na seção 'Posts aprovados'... mostrar o histórico
  de cada post") — resolve o caso de uso real (cliente reclama de um
  post JÁ aprovado, agência precisa mostrar o que foi aprovado) sem
  precisar de uma tela nova. Posts ainda pendentes/ajustados/rejeitados
  não mostram histórico na UI nesta fase (embora já estejam sendo
  gravados no banco desde já) — se no futuro fizer sentido auditar
  também posts rejeitados, os dados já estarão lá, só falta exibir.
- **formatarDataHoraPtBr formata o horário UTC bruto da string ISO**
  (sem converter pro fuso horário local do usuário), mesmo espírito de
  simplicidade de formatarDataPtBr (Fase 2), que já não lida com fuso
  horário nenhum (data pura, sem hora). Suficiente pro caso de uso desta
  fase (mostrar "aprovado nesse dia, nesse horário" de forma auditável),
  não é uma exibição pensada pra múltiplos fusos horários de usuários
  diferentes — se isso vier a importar, é candidato a ajuste futuro.
- **3 arquivos de conflito do OneDrive ("Copia") removidos** durante
  esta fase (ver Problemas Encontrados) — eram sobras do incidente já
  documentado na Fase 5, nunca limpas antes por não terem quebrado
  nenhuma validação de código até agora (só apareceram no radar quando
  o `tsc` bateu num deles depois da mudança de tipo desta fase).

---

# Fase 6 — Texto curto pra caber na imagem

## Concluído
- [x] Etapa 1 — src/lib/groq/post-suggestion.ts: SYSTEM_PROMPT reescrito
      pra pedir estilo de legenda curta (1-3 frases, nunca vários
      parágrafos), com limite de LIMITE_CARACTERES_POST=280 caracteres
      declarado explicitamente. Reforço do limite (LEMBRETE_LIMITE)
      adicionado de novo no final do user prompt de
      generatePostSuggestion, generateAdHocPostSuggestion, E no bloco de
      ajuste (reescrita com feedback) — as 3 chamadas à Groq desse
      arquivo agora pedem texto curto. `npx tsc --noEmit`, `npx eslint .`
      e `npm run build` sem erros (mesmas rotas/tamanhos de antes — só
      mudou um arquivo de lib server-side, sem impacto no bundle)

- [x] Etapa 2 — **Decisão: não adicionar rede de segurança (retry/truncamento).**
      Ver Decisões Tomadas — o prompt sozinho se mostrou 100% confiável nos
      testes da Etapa 3 (8/8 gerações dentro do limite, incluindo pedidos
      adversariais pedindo texto "completo e detalhado")
- [x] Etapa 3 — Teste ponta a ponta rodado via `npx tsx` (mesma adaptação de
      método da Fase 5 — `preview_start` continua preso ao caminho antigo
      quebrado do OneDrive, ver Problemas Encontrados da Fase 5). Testado
      contra a Groq de verdade, 2 clientes reais (Erik Chagas/ErizonAI,
      Cliente Aniversário Teste — este último com identidade visual
      configurada). Resultado:
      1. `generatePostSuggestion` (estilo calendário, evento "Aniversário
         da empresa"): 2 gerações, 141 e 180 caracteres
      2. `generateAdHocPostSuggestion` (pedido livre "gera um post de
         parabéns..."): 2 gerações, 145 e 123 caracteres
      3. Modo ajuste (`sugestaoAnterior` + `feedbackAjuste`): 1 geração,
         184 e 217 caracteres nas duas rodadas — confirma que o reforço
         do limite no bloco de ajuste funciona, o texto reescrito não
         "cresce" de volta
      4. **Teste de estresse**: 3 pedidos deliberadamente pedindo texto
         longo ("bem completo e detalhado", "em detalhes... passo a
         passo") → 247, 120 e 154 caracteres — nem tentando forçar, a
         Groq excedeu o limite
      5. **Pipeline completo** (post avulso → aprovação → geração de
         imagem automática, reaproveitando handleSuggestionReply sem
         nenhuma alteração): rodado 2x, imagem baixada e inspecionada
         visualmente (Read tool) — **texto totalmente legível, sem
         nenhum corte, com folga visual confortável** (bem diferente do
         corte visto no teste da Fase 5)
      **8 de 8 gerações (100%) ficaram dentro do limite de 280
      caracteres**, variando de 120 a 247. **Fase 6 validada.**

## Problemas Encontrados
(nenhum nesta fase)

## Decisões Tomadas
- **Limite de 280 caracteres**, calibrado a partir da capacidade real do
  template (src/lib/render/post-template.ts): estimando largura média de
  caractere em negrito (~0.58em) e a área de texto disponível
  (880x680px, line-height 1.4), o bucket de fonte mais generoso do
  `pickFontSize` (≤400 caracteres → 34px) comporta bem mais que 280
  caracteres sem estourar — folga grande mesmo se a Groq passar do
  pedido. 280 também é um tamanho realista de legenda de post de rede
  social (nem todo texto precisa usar a folga técnica máxima; a ideia é
  um texto que já nasce do tamanho certo, não um texto que só
  "tecnicamente cabe").
- **Reforço do limite repetido 2x no prompt** (uma vez no system prompt,
  de novo no final do user prompt via LEMBRETE_LIMITE) em vez de só
  uma menção. Motivo: instruções de tamanho tendem a ser seguidas de
  forma mais confiável por LLMs quando reforçadas perto do fim do
  prompt, não só declaradas uma vez no início — sem essa dica, o
  system prompt pode "diluir" ao longo de um user prompt mais longo
  (com todo o bloco de DNA do cliente no meio).
- **Sem rede de segurança (retry ou truncamento) pra texto acima do
  limite.** O próprio escopo desta fase pedia pra decidir isso com base
  na confiabilidade observada nos testes, sem adicionar complexidade se
  o prompt sozinho resolvesse. Resultado dos testes: 8 de 8 gerações
  (100%) ficaram dentro de 280 caracteres, incluindo 3 pedidos
  deliberadamente formulados pra provocar texto longo ("bem completo e
  detalhado", "passo a passo") — a pior geração ficou em 247 caracteres,
  ainda com folga. Além disso, a capacidade real do template (ver
  cálculo acima) é bem maior que 280 — mesmo se a Groq ocasionalmente
  passar um pouco do pedido (ex.: 350-400 caracteres), a imagem ainda
  renderizaria sem cortar, só ficaria menos "enxuta" como legenda. Dado
  esse duplo colchão de segurança (prompt confiável + capacidade de
  sobra no template), adicionar retry automático ou truncamento
  significaria mais uma chamada à Groq (custo e latência) e mais código
  pra um risco que não se materializou nenhuma vez em 8 tentativas,
  incluindo as adversariais. Se no uso real algum dia aparecer um caso
  de corte, a correção fica registrada aqui como próximo passo natural
  (retry com prompt reforçado, ou truncamento com "…" como fallback
  final) — não implementada preventivamente por não ter evidência de
  que seja necessária.

---

# Fase 5 — Conversa livre estruturada (classificador de intenção)

## Concluído
- [x] Etapa 1 — src/lib/chat/intent-classifier.ts: classifyFreeMessage
      reconhece 4 categorias fechadas (conteudo_avulso, pergunta_sobre_dna,
      saudacao, fora_de_escopo). 'saudacao' é checada por palavra-chave
      (lista fixa: oi, olá, bom dia, tudo bem, etc.) ANTES de qualquer
      chamada à Groq — só cai na Groq se não bater em nenhuma. As outras 3
      usam groqChatCompletion com temperature=0 e um prompt que pede só o
      nome da categoria, sem explicação
- [x] Etapa 2 — src/lib/chat/dna-answers.ts: answerDnaQuestion consulta
      DIRETO client_dna/clients (sem Groq, nunca inventa), mapeando
      palavra-chave → campo (ex.: "meta"/"metas"/"objetivo" → client_dna.metas,
      "concorrente" → client_dna.concorrentes, "aniversario" vs
      "aniversario da empresa" → clients.aniversario_pessoal/_empresa,
      priorizando o mais específico). Retorna null (→ tratado como
      fora_de_escopo por quem chama) quando não identifica o campo com
      confiança. src/lib/groq/post-suggestion.ts refatorado: montarLinhasDna
      e montarClienteLine viraram helpers reaproveitáveis, e
      generateAdHocPostSuggestion foi adicionada (mesmo padrão de
      generatePostSuggestion, mas com o pedido literal do cliente como
      briefing em vez de "Data comemorativa: X"). src/lib/chat/handle-free-message.ts
      orquestra as 4 categorias e sempre termina inserindo exatamente 1
      mensagem da IA no chat; erros de qualquer branch (Groq, banco) caem
      num catch geral com mensagem de desculpa genérica, sem quebrar o chat
- [x] Etapa 3 — Migration supabase/migrations/20260801040000_free_chat_schema.sql:
      dropa e recria o check constraint de content_calendar.tipo_evento
      incluindo 'avulso' (era um check constraint fechado, confirmado na
      migration da Fase 2). Tipos TS atualizados em src/lib/supabase/types.ts
- [x] Etapa 4 — src/app/actions.ts::sendMessageAction: handleSuggestionReply
      passou a ter seu retorno booleano checado — se `false` (nem pergunta
      de DNA nem sugestão de calendário pendente), chama handleFreeMessage.
      Mesmo padrão de encadeamento "else" já usado entre Fase 1 e Fase 2,
      sem alterar nenhuma linha da lógica de questions_pending nem de
      handleSuggestionReply em si
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e `npm run
      build` sem erros (rotas existentes com tamanho estável, nenhuma rota
      nova nesta fase — só lógica de servidor)

- [x] Usuário rodou supabase/migrations/20260801040000_free_chat_schema.sql
      — confirmado testando um insert com tipo_evento='avulso' direto via
      REST/service role (sucesso, depois apagado de novo por ser só teste)

## Pendente
- [x] Etapa 5 — Teste ponta a ponta rodado depois da recuperação do
      incidente de OneDrive (ver abaixo). **Adaptação de método**: o
      `preview_start` (Browser pane) ficou preso ao caminho antigo
      quebrado do OneDrive (fixo pra sessão, não dá pra reconfigurar em
      runtime) — em vez de testar pela UI/browser como nas fases
      anteriores, validei chamando as funções reais diretamente via
      `npx tsx` (script descartável, apagado depois), contra o Supabase
      de verdade (service role) e a Groq de verdade — mesmas funções que
      `sendMessageAction` chama, só sem passar pelo servidor HTTP/UI.
      Usado o cliente real do usuário ("Erik Chagas" / ErizonAI,
      cc6fb924-27c5-4e09-8676-b5c953783922), que já tinha DNA real
      preenchido e nenhuma pergunta/sugestão pendente. Resultado:
      1. **Classificação**: as 4 mensagens de teste caíram exatamente na
         categoria esperada — "oi" → saudacao, "qual minha meta?" →
         pergunta_sobre_dna, "gera um post de parabéns pra mim" →
         conteudo_avulso, "qual a previsão do tempo amanhã?" →
         fora_de_escopo
      2. **Saudação**: handleFreeMessage respondeu com uma das frases
         fixas, sem chamar a Groq (confirmado pelo próprio fluxo de
         código — `isSaudacao` retorna antes de qualquer `groqChatCompletion`)
      3. **Pergunta sobre DNA**: `answerDnaQuestion` respondeu
         "Meta: adquirir em 36 meses 585 clientes pagantes ativos" e
         "Concorrentes: revealbot, madigcx" — batendo EXATAMENTE com os
         valores reais salvos em `client_dna.metas` e
         `client_dna.concorrentes` (nada inventado)
      4. **Fora de escopo**: resposta honesta padrão, listando as
         capacidades reais do sistema, sem tentar adivinhar
      5. **Conteúdo avulso**: pedido "gera um post de parabéns pelo
         aniversário da empresa pra mim" → Groq gerou um post real e
         coerente com o DNA do cliente (mencionou "ErizonAI",
         "inteligência operacional", "Americana... região metropolitana
         de Campinas" — tudo dado real do client_dna); criada linha em
         `content_calendar` com `tipo_evento='avulso'`, `nome_evento`
         derivado do pedido, `status='sugerido'`; mensagem formatada
         corretamente no chat com call-to-action de aprovar/ajustar/rejeitar
      6. **Aprovação do avulso**: respondido "aprovado" via
         `handleSuggestionReply` (mesma função da Fase 2/3, sem
         alteração) → `consumida=true`, `status` virou 'aprovado', e a
         **imagem foi gerada automaticamente** (Fase 3) sem nenhum código
         novo — confirma que reaproveitar 100% do fluxo existente
         funciona de verdade, não só na teoria
      **Fase 5 validada**, com uma ressalva encontrada no processo — ver
      Problemas Encontrados (texto de post avulso muito longo cortado na
      imagem gerada).

## Problemas Encontrados
- [2026-08-01] Problema: o texto do post avulso gerado pela Groq no
  teste (4 parágrafos, bem mais longo que qualquer texto testado na
  Fase 3) ficou **visualmente cortado** na imagem gerada — a frase
  "...parte ativa da [comunidade...]" corta no meio, ilegível, mesmo com
  o `overflow: hidden` de segurança do template (Fase 3). Contexto: a
  heurística `pickFontSize` (src/lib/render/post-template.ts) só vai até
  ">400 caracteres → 28px", sem faixa pra textos muito mais longos — e
  nem um font-size menor resolveria de verdade, porque 4 parágrafos não
  cabem de forma legível num quadrado 1080x1080 de qualquer jeito; o
  problema real é que nem `generatePostSuggestion` nem
  `generateAdHocPostSuggestion` (src/lib/groq/post-suggestion.ts) pedem
  um texto curto o bastante pra caber numa imagem tipo post de rede
  social. Esse risco já existia antes da Fase 5 (mesma função,
  `generatePostSuggestion`, é usada pelas sugestões de calendário desde a
  Fase 2) — só não tinha aparecido nos testes anteriores porque os textos
  gerados até agora calharam de ser mais curtos. Status: **não corrigido
  nesta sessão, documentado como achado pra decisão futura** — fora do
  escopo da Fase 5 (que pedia só "não mexer no motor de calendário/Groq
  além do necessário pra integrar esta fase", e esse ajuste seria em
  prompt/comportamento da Fase 2/3, não algo específico da Fase 5).
  Opções pra uma correção futura: (a) instruir a Groq no system prompt a
  gerar texto curto (ex.: "no máximo 3-4 frases curtas, tipo legenda de
  post de rede social"), o que melhoraria a qualidade do produto real
  além de resolver o corte; (b) truncar o texto especificamente na
  imagem (com "…" no fim) mantendo o texto completo no chat/aprovação —
  mais como um band-aid visual do que resolver a causa raiz. A opção (a)
  parece a correção certa, mas decidi não fazer sozinho por estar fora
  do escopo explicitamente definido pra esta fase.
- [2026-08-01] **INCIDENTE GRAVE — corrupção de sincronização do OneDrive
  fez o projeto inteiro sumir localmente.** Contexto: no meio do teste
  ponta a ponta da Fase 5 (testando "oi" no chat de um cliente real do
  usuário), o processo `OneDrive.exe` parou de rodar (confirmado via
  `Get-Process OneDrive` retornando vazio) e a pasta inteira do projeto
  (`C:\Users\sergi\OneDrive\Desktop\Saas-Marketing`) ficou com quase todo
  arquivo de nível superior sumido (`package.json`, `next.config.ts`,
  `.env.local`, `PROGRESS.md`, `.claude/launch.json`) e o conteúdo de
  `src/lib/{calendar,chat,groq,render,supabase}/*`, `src/app/clientes/*`
  e `src/app/login/*` inacessível — só as pastas apareciam (como
  `ReparsePoint`), sem os arquivos dentro. `Get-Process OneDrive` vazio
  indica que o processo de sync tinha morrido, deixando os placeholders
  de "Files On-Demand" órfãos (sem como serem rehidratados). Disco tinha
  ~116GB livres — não foi falta de espaço. Suspeita: a reescrita
  repetidíssima de `.next` (apagado e recriado dezenas de vezes ao longo
  da sessão, entre `next dev` e `next build`, pra contornar os problemas
  de cache já documentados nas fases anteriores) sobrecarregou o
  processo de sincronização do OneDrive até ele travar/morrer.
  **Nenhum comando meu apagou os arquivos** — só rodei `Remove-Item`
  mirando especificamente `.next`, nunca a árvore inteira; a
  investigação (`Get-ChildItem -Force`, verificação de processo,
  verificação de espaço em disco, checagem da Lixeira) confirmou que é
  corrupção de sincronização, não uma ação destrutiva executada por mim.
  Status: **resolvido**. O usuário moveu o projeto pra um caminho novo
  fora do OneDrive sincronizado com esse nome
  (`C:\Users\sergi\Desktop\Saas-Marketing`) — a maioria dos arquivos
  rehidratou sozinha nesse novo local em segundos (inclusive
  `PROGRESS.md`, com as 876 linhas intactas), exceto: (1) 3 arquivos de
  `src/app/clientes/` que nunca chegaram a materializar — recriados do
  zero com o conteúdo exato já registrado nesta conversa (o resto de
  `src/lib/*` e `src/app/*` tinha rehidratado corretamente antes de eu
  precisar reescrever, então só recriei o que realmente faltava, depois
  de verificar cuidadosamente cada diretório); (2) 2 arquivos de conflito
  ("client - Copia.ts", "server - Copia.ts") criados pelo OneDrive porque
  eu escrevi client.ts/server.ts no mesmo instante em que a versão
  original estava rehidratando — comparei o conteúdo (idêntico) e apaguei
  as cópias; (3) `node_modules` tinha as pastas mas não o conteúdo interno
  materializado — em vez de esperar a rehidratação de +300 pacotes,
  apaguei `node_modules` + `package-lock.json` e rodei `npm install`
  limpo no novo local (mais rápido e determinístico que esperar o
  OneDrive). Verificação de integridade: comparei a árvore final de
  `src/` (41 arquivos) com a lista completa esperada de todas as 5 fases
  — bate exatamente. **Nada foi perdido**: mesmo se a rehidratação
  tivesse falhado 100%, eu tinha o conteúdo de cada arquivo criado nesta
  sessão registrado na própria conversa, e o banco de dados (Supabase) —
  onde vivem os dados reais dos clientes — nunca esteve em risco, por
  viver inteiramente na nuvem, fora dessa pasta local.

## Decisões Tomadas
- **Projeto movido pra fora do OneDrive sincronizado, finalmente.** Já
  vinha sendo recomendado desde a Fase 3/4 (instabilidade recorrente do
  dev server), mas só virou obrigatório depois do incidente grave acima —
  o usuário moveu de `C:\Users\sergi\OneDrive\Desktop\Saas-Marketing` pra
  `C:\Users\sergi\Desktop\Saas-Marketing`. Sessões futuras devem usar
  esse novo caminho (ver aviso no topo deste arquivo).
- **Posts avulsos reaproveitam 100% do fluxo de aprovação/ajuste/rejeição
  já existente** (handleSuggestionReply, src/lib/calendar/handle-reply.ts)
  sem nenhuma alteração nesse arquivo. Motivo: content_calendar.status
  'sugerido'/'ajustado' já é a fila que handleSuggestionReply consome
  (oldest-first, sem filtrar por tipo_evento) — um post avulso criado com
  status='sugerido' direto (pulando 'pendente_geracao', que é só pra
  eventos processados por generateSuggestionsForPending) entra nessa fila
  automaticamente. Aprovar um avulso também dispara a geração de imagem
  automática (Fase 3) do mesmo jeito que um post de calendário, de graça.
- **Mensagem de apresentação do post avulso é uma variação separada**
  (formatAdHocMessage em handle-free-message.ts), não reaproveita
  formatSuggestionMessage (calendar/messages.ts) porque essa diz "X está
  chegando (data)" — framing que não faz sentido pra um post avulso sem
  data comemorativa associada. O resto da frase (call-to-action de
  aprovar/ajustar/rejeitar) é idêntico de propósito.
- **generateAdHocPostSuggestion como função irmã de generatePostSuggestion**
  no mesmo arquivo (post-suggestion.ts), não uma reescrita da função
  existente. Motivo: os prompts têm formas diferentes o bastante (um
  ancorado num evento de calendário, outro num pedido livre em texto) que
  forçar os dois na mesma função exigiria parâmetros opcionais condicionais
  confusos; extrair só o que é genuinamente comum (montarLinhasDna,
  montarClienteLine) e deixar cada função montar seu próprio prompt final
  ficou mais legível.
- **data_evento de um post avulso = data de hoje (data do pedido)**, não
  null. Motivo: a coluna é `not null` no schema (não alterei isso) e usar
  a data do pedido é semanticamente razoável — é quando o post foi gerado,
  ainda que não esteja ligado a uma data comemorativa específica. Isso
  também significa que avulsos aparecem ordenados corretamente junto com
  eventos de calendário em qualquer query que ordene por data_evento (ex.:
  "Posts aprovados" na tela do cliente).
- **nome_evento de um post avulso é derivado do pedido do cliente**
  (`"Post avulso: <primeiros 50 caracteres do pedido>…"`), não um rótulo
  genérico fixo tipo "Post avulso". Motivo: a seção "Posts aprovados" na
  tela do cliente mostra nome_evento como título — com um cliente pedindo
  vários posts avulsos ao longo do tempo, um rótulo genérico repetido não
  ajudaria a diferenciar um do outro depois.
- **Confiança em duas camadas pra 'pergunta_sobre_dna'**: primeiro a Groq
  classifica a mensagem como pertencendo a essa categoria (entendimento
  semântico), depois answerDnaQuestion faz um match determinístico
  separado por palavra-chave pra achar o campo específico — se nenhuma
  bater, retorna null e handleFreeMessage cai no texto de fora_de_escopo.
  Motivo: separar "isso parece uma pergunta sobre o negócio" (fuzzy, via
  IA) de "isso é claramente sobre ESTE campo específico" (determinístico,
  sem IA) é o que garante nunca alucinar um valor — a segunda camada é a
  rede de segurança pedida explicitamente no escopo ("nunca alucinar dado
  do cliente").
- **Classificação usa temperature=0** (generatePostSuggestion/
  generateAdHocPostSuggestion continuam no default 0.7). Motivo:
  classificação é uma tarefa determinística de "escolha 1 de 4 categorias",
  não geração criativa — temperature baixa reduz variância na resposta do
  modelo pra essa tarefa específica, sem afetar a criatividade dos textos
  de post (que usam funções diferentes, com seu próprio temperature).
(nenhuma ainda nesta fase — serão registradas aqui)

---

# Fase 4 — Identidade visual do cliente

## Concluído
- [x] Etapa 1 — Migration supabase/migrations/20260801030000_visual_dna_schema.sql:
      client_dna ganha cor_primaria, cor_secundaria (text, hex) e logo_url
      (text, path no Storage); bucket 'client-logos' criado via SQL (insert
      em storage.buckets, mesmo padrão do post-images da Fase 3), público,
      RLS de escrita exigindo auth.uid(). Tipos TS estendidos em
      src/lib/supabase/types.ts. **PENDENTE: usuário precisa rodar esta
      migration no SQL Editor.**
- [x] Etapa 2 — src/app/clientes/[id]/marca/page.tsx (Server Component,
      carrega client + client_dna visual) + src/components/visual-dna-form.tsx
      (Client Component: color pickers nativos `<input type="color">`,
      upload de logo com preview via `URL.createObjectURL`, prévia ao vivo
      reaproveitando `resolveBackground`/`pickTextColor` do próprio
      template — a prévia mostra exatamente a mesma lógica de
      fundo/contraste que a imagem final vai usar) + src/app/visual-actions.ts
      (updateVisualDnaAction: valida hex das cores, valida tipo/tamanho do
      logo — PNG/JPG/SVG, até 2MB —, só sobrescreve logo_url se um arquivo
      novo foi enviado). Link "Identidade visual" adicionado na tela do
      cliente (src/app/clientes/[id]/page.tsx)
- [x] Etapa 3 — src/lib/render/post-template.ts: renderPostTemplate ganhou
      corPrimaria/corSecundaria/logoUrl opcionais; resolveBackground monta
      gradiente entre as duas cores (ou sólido se só uma estiver
      preenchida, ou o fallback genérico da Fase 3 se nenhuma estiver);
      pickTextColor escolhe branco ou escuro pra manter contraste
      dependendo do brilho da cor primária; logo (se houver) renderizado
      como círculo com fundo branco acima do nome da marca no rodapé,
      com `onerror` pra sumir graciosamente se a URL falhar ao carregar.
      src/lib/render/upload-logo.ts criado (mesmo padrão de
      upload-image.ts, bucket client-logos). generate-post-image.ts
      atualizado pra buscar cor_primaria/cor_secundaria/logo_url de
      client_dna e repassar pro template — busca em try/catch-like
      (console.warn, não throw) pra identidade visual nunca bloquear a
      geração da imagem em si
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e `npm run
      build` sem erros — rota nova /clientes/[id]/marca aparece no build
      (1.54kB, First Load JS 107kB, dentro do padrão das outras rotas)

- [x] Usuário rodou supabase/migrations/20260801030000_visual_dna_schema.sql
      — confirmado via REST API (client_dna com cor_primaria/cor_secundaria/
      logo_url acessíveis; bucket client-logos existe, público)
- [x] Etapa 4 — Teste ponta a ponta rodado via `npm run dev` + browser real.
      Fluxo testado:
      1. Configurada marca visual pro "Cliente Aniversário Teste": cor
         primária `#e63946`, cor secundária `#f1faee`, via formulário real
         (color inputs setados via JS disparando eventos React nativos —
         `form_input` do browser tool não funciona em `<input
         type="color">`, abre o seletor nativo do SO e navega pra trás;
         ver Problemas Encontrados). Prévia ao vivo atualizou corretamente
         (gradiente + contraste de texto)
      2. Logo enviado direto pro bucket `client-logos` via REST/service
         role + `client_dna.logo_url` setado do mesmo jeito que o form
         faria (o `<input type="file">` também não é controlável por esse
         browser tool — mesma limitação, ver Problemas Encontrados).
         Recarregada a tela de marca → prévia mostrou o logo corretamente
         (círculo com fundo branco sobre o gradiente)
      3. Testado que resubmeter o formulário só com uma cor nova (sem
         escolher arquivo) NÃO apaga o logo — confirmado no banco:
         `cor_primaria` mudou pra `#457b9d`, `logo_url` continuou intacto
      4. Limpo `imagem_gerada` de um post já aprovado e clicado "Gerar
         imagem" de novo → nova imagem gerada já com a marca configurada:
         gradiente azul→creme entre as duas cores, texto branco (contraste
         calculado corretamente pro tom escolhido), logo renderizado como
         círculo acima do nome da marca no rodapé — confirmado que o
         Puppeteer carregou a imagem externa do Storage sem problema
      5. Testado o **fallback**: criado um post aprovado de teste pro
         "Cliente Teste" (nunca configurou marca) e clicado "Gerar
         imagem" → imagem gerada sem erro, usando o gradiente escuro
         genérico da Fase 3, sem logo (sem buraco visual no lugar dele) —
         confirma que clientes sem identidade visual continuam
         funcionando exatamente como antes
      **Fase 4 validada.** Post de teste extra ("Teste de fallback sem
      marca") ficou no banco — o usuário pode apagar quando quiser.

## Pendente
(nenhum item da Fase 4 pendente)

## Problemas Encontrados
- [2026-08-01] Problema: o `next dev` ficou travado em "Compiling
  /middleware ..." por vários minutos, sem nunca terminar de compilar,
  fazendo `navigate` do browser tool estourar timeout (300s). Contexto:
  aconteceu ao reiniciar o dev server pra testar a Fase 4 (era a 3ª vez
  subindo o servidor na sessão). Não ficou claro se foi um problema
  pontual do ambiente/sandbox ou acúmulo de processos anteriores. Status:
  resolvido — parei o servidor, apaguei `.next` de novo, e subi um
  servidor novo, que compilou o middleware normalmente em ~2s dessa vez.
- [2026-08-01] Problema: as ferramentas de automação de browser
  disponíveis nesta sessão (`mcp__Claude_Browser__form_input`) não
  conseguem preencher `<input type="color">` nem `<input type="file">`
  como campos de texto normais — `type="color"` abre o seletor de cor
  nativo do sistema operacional (e, ao tentar contornar isso, a página
  acabou navegando de volta pra home, provavelmente algum efeito colateral
  do diálogo nativo sendo fechado/cancelado); `type="file"` rejeita
  `value` programático por segurança do browser (`InvalidStateError`).
  Contexto: ao tentar testar o formulário de identidade visual (Etapa 4)
  de ponta a ponta pela UI. Status: contornado de duas formas diferentes:
  (1) pros color inputs, usei `javascript_tool` pra disparar o setter
  nativo de `value` do React + eventos `input`/`change` manualmente,
  reproduzindo o que o navegador faria — isso valida de verdade o
  `onChange` do React e o submit do form real; (2) pro upload de logo,
  não deu pra simular o clique num arquivo local pelo browser, então
  fiz o upload direto pro bucket `client-logos` via REST API (service
  role) + update de `client_dna.logo_url`, exatamente os dois passos que
  `updateVisualDnaAction` faria internamente — testa o consumo (prévia,
  geração de imagem) de ponta a ponta, mas não testa literalmente o
  clique no `<input type="file">` do navegador (esse pedaço específico é
  HTML padrão bem estabelecido, risco baixo de estar quebrado).
- [2026-08-01] Problema: usuário reportou "localhost parou de responder"
  depois do teste da Fase 4. Investigação: o dev server que eu tinha
  deixado rodando (via preview do browser tool) não aparecia mais em
  `preview_list` — parou de existir entre uma mensagem e outra (não fica
  claro se foi encerrado pelo ambiente por inatividade ou outro motivo).
  Ao subir um servidor novo, apareceu um erro novo nos logs: `Could not
  find the module ".../approved-posts.tsx#ApprovedPosts" in the React
  Client Manifest` toda vez que a página de um cliente específico (um
  cliente novo que o usuário criou testando por conta própria, fora desta
  conversa — confirma que o usuário acessa o mesmo servidor/banco que eu)
  era carregada. Contexto: mesma classe de problema já visto antes nesta
  sessão (cache `.next` ficando inconsistente depois de múltiplos
  reinícios do dev server sem limpar o cache entre eles). Status:
  resolvido — parei o servidor, apaguei `.next`, subi de novo; a mesma
  página do cliente carregou limpa, sem erro nos logs.
- [2026-08-01] Problema: usuário tentou usar o formulário de identidade
  visual de verdade (pelo próprio navegador dele) e recebeu
  `Error: Body exceeded 1 MB limit` ao salvar. Contexto: Server Actions do
  Next.js têm um limite padrão de 1MB no corpo da requisição — o upload de
  logo aceita até 2MB (LOGO_MAX_BYTES em src/app/visual-actions.ts), então
  qualquer logo acima de ~1MB nunca chegava a rodar o código da action,
  era rejeitado pelo próprio framework antes disso (413). Esse problema só
  aparece com um arquivo real grande o suficiente — os testes da Etapa 4
  desta sessão usaram um logo de teste pequeno (~2.5KB) e nunca bateram
  nesse limite. Status: resolvido — adicionado
  `experimental.serverActions.bodySizeLimit: "3mb"` em next.config.ts
  (precisa reiniciar o dev server pra pegar mudança de config, não é hot
  reload). Validado recriando o cenário: montei um File de 1.5MB via
  DataTransfer/JS (o input de arquivo não é controlável por clique
  simulado, ver problema acima) e submeti o form de verdade — passou dessa
  barreira sem erro 413.
- [2026-08-01] Problema: depois de corrigir o limite de 1MB, o mesmo teste
  (upload de 1.5MB pra `client-logos`) revelou um segundo erro:
  `new row violates row-level security policy` em
  `src/lib/render/upload-logo.ts`. Contexto: a policy de RLS
  `authenticated_full_access_client_logos` criada pela migration
  20260801030000_visual_dna_schema.sql tem exatamente a mesma estrutura
  da policy `authenticated_full_access_post_images` (Fase 3), que funciona
  normalmente — mas o bucket `client-logos` nunca tinha sido escrito por
  um cliente autenticado de verdade até este teste (os testes anteriores
  da Etapa 4 fizeram upload via REST com a service role key, que
  ignora RLS por completo, então nunca teriam pego esse problema). O
  bucket em si existe (confirmado via API antes), então só a criação da
  policy parece não ter "pegado" quando o usuário rodou a migration —
  causa exata não confirmada (pode ter sido um erro silencioso na hora de
  colar/rodar o SQL). Status: resolvido — criada nova migration
  supabase/migrations/20260801031000_fix_client_logos_policy.sql que
  recria a policy com `drop policy if exists` antes (idempotente, segura
  de rodar mesmo se a policy já existir). Usuário rodou a migration;
  revalidado repetindo o teste (File de 1.5MB via DataTransfer/JS + submit
  do form real) — sem erro nos logs, `client_dna.logo_url` atualizado, e
  confirmado direto no Storage (`/storage/v1/object/info/public/...`) que
  o objeto tem `size: 1572864` (exatamente os 1.5MB do arquivo de teste) —
  upload de logo funcionando ponta a ponta pelo caminho real.
- [2026-08-01] **Problema raiz provável de boa parte da instabilidade do
  dev server nesta sessão**: o projeto vive dentro de uma pasta
  sincronizada pelo OneDrive (`C:\Users\sergi\OneDrive\Desktop\Saas-Marketing`).
  Ao investigar o erro "Could not find the module .../approved-posts.tsx
  em React Client Manifest" de novo (depois de já ter "corrigido" uma vez
  limpando `.next`), rodei `npx eslint .` e ele reportou erros dentro de
  uma pasta `.next(1)\...` — uma cópia de conflito do `.next`, com data
  de ~3h antes, claramente criada pelo OneDrive tentando sincronizar uma
  pasta que muda centenas de vezes por segundo durante o `next dev`
  (típico "conflito de sincronização" do OneDrive quando dois processos
  escrevem no mesmo arquivo/pasta rápido demais pra ele acompanhar).
  Isso explica os erros de manifest/module-not-found recorrentes: o
  Next.js às vezes lia/escrevia num `.next` "certo" e outras vezes um
  processo do OneDrive interferia no meio da escrita. Status: mitigado —
  apaguei `.next(1)` e `.next` e reconstruí limpo; `tsc`, `eslint` e
  `build` voltaram a passar sem erro. **Não é uma correção definitiva** —
  enquanto o projeto ficar dentro do OneDrive, isso pode voltar a
  acontecer a qualquer reinício do dev server. Recomendação registrada
  pro usuário: mover o projeto pra fora de uma pasta sincronizada (ex.:
  `C:\dev\Saas-Marketing`) ou, se quiser manter no OneDrive, configurar
  `distDir` no next.config.ts pra apontar `.next` pra fora da árvore
  sincronizada (ex.: `C:\Users\sergi\.next-cache\kirozeth`) — não fiz essa
  mudança de arquitetura sozinho porque é uma decisão que afeta o
  workflow do usuário fora desta sessão, não só o código.

## Decisões Tomadas
- **Campos visuais em `client_dna`, não em `clients`.** O próprio pedido
  já apontava pra isso ("Adicionar identidade visual ao DNA do cliente").
  Faz sentido semântico: `client_dna` já guarda outros atributos de marca
  (tom_de_voz, público-alvo) preenchidos ao longo do tempo; `clients` é
  cadastro mais estático (nome, segmento, aniversários). Como
  `CampoDna` (src/lib/questions-catalog.ts) é derivado via
  `Exclude<keyof ClientDna, ...>`, os campos novos entram no tipo
  automaticamente, mas nunca aparecem no motor de perguntas fixo porque
  `QUESTIONS_CATALOG` não os referencia — zero risco de a Fase 1 tentar
  perguntar "qual sua cor primária?" no chat.
- **Bucket 'client-logos' separado do 'post-images'**, não reaproveitando
  o mesmo bucket da Fase 3. Motivo: são dois tipos de arquivo com ciclo de
  vida diferente (logo é configurado uma vez e reaproveitado em toda
  imagem futura; post-images é gerado por evento). Manter buckets
  separados deixa mais fácil no futuro aplicar regras diferentes (ex.:
  limite de tamanho por bucket) sem afetar o outro.
- **Nome do arquivo do logo = `<client_id>.<extensão original>`** (não
  sempre `.png` como em post-images, já que aceitamos PNG/JPG/SVG e
  converter formato exigiria uma lib de imagem a mais). `upsert: true`
  garante que subir um logo novo substitui o anterior automaticamente.
- **Resubmeter o formulário sem escolher um arquivo novo NÃO apaga o logo
  já salvo** — updateVisualDnaAction só inclui `logo_url` no update do
  banco quando `formData.get("logo")` é um File com `size > 0`. Sem essa
  checagem, salvar só uma mudança de cor (formulário reenviado com o
  campo de arquivo vazio) apagaria o logo sem o usuário querer.
- **Validação de logo é só server-side** (tipo MIME e tamanho em
  updateVisualDnaAction), sem validação JS extra além do atributo
  `accept` do input (que já filtra a maioria dos casos na UI, mas pode
  ser contornado). Motivo: o servidor é a fonte de verdade de qualquer
  forma, então validar só lá evita duplicar a mesma lógica em dois
  lugares — consistente com o resto do projeto, que nunca teve validação
  de formulário no client além do HTML nativo (`required`, `type`).
- **Sem botão de "remover cor" ou "remover logo"** nesta fase. O
  `<input type="color">` nativo do HTML sempre devolve um hex válido,
  nunca "vazio" — então uma vez que o cliente salva o formulário, as
  cores passam a ser não-nulas permanentemente (não tem como "voltar" pro
  fallback genérico via UI, só apagando direto no banco). Isso é
  aceitável pro escopo pedido: o requisito era "nenhum cliente *existente*
  quebra por não ter configurado" (satisfeito — a coluna começa `null` e
  só muda quando o formulário é submetido), não "poder desconfigurar
  depois". Considerar um botão de reset numa fase futura se fizer falta.
- **Prévia ao vivo reaproveita as mesmas funções puras do template**
  (`resolveBackground`, `pickTextColor` exportadas de
  src/lib/render/post-template.ts e importadas tanto no Server-side
  (geração real) quanto no Client Component (prévia)). Motivo: evita
  duplicar a lógica de contraste/gradiente em dois lugares que
  poderiam divergir com o tempo — o que a prévia mostra é
  garantidamente o que a imagem final vai usar, porque é literalmente o
  mesmo código. Só é possível porque essas funções são puras (sem
  dependência de Node/Puppeteer/Supabase), então funcionam tanto em
  Server quanto em Client Component sem problema.
- **Cálculo de contraste é uma heurística de brilho percebido simples**
  (fórmula `(r*299 + g*587 + b*114)/1000`, threshold 150), não o cálculo
  de contraste WCAG completo (que envolve luminância relativa e razão de
  contraste real). Motivo: suficiente pra evitar o caso óbvio de "texto
  branco em fundo branco/amarelo claro" sem adicionar uma lib de cor só
  pra isso — mesmo espírito de simplicidade do pickFontSize da Fase 3.

---

# Fase 3 — Lembrete de sync + geração visual (Puppeteer)

## Concluído
- [x] Bloco A — src/lib/calendar/holidays-check.ts (checkHolidaysUpToDate:
      verifica se special_dates tipo 'nacional' tem cobertura do ano atual
      E do ano seguinte) + src/components/holidays-banner.tsx (Server
      Component, só renderiza algo quando desatualizado) integrado em
      src/app/page.tsx — checagem reativa, roda toda vez que a home
      carrega, sem cron
- [x] Bloco B Etapa 3 — Migration supabase/migrations/20260801020000_render_schema.sql:
      content_calendar ganha imagem_gerada (text, path no Storage) e
      imagem_gerada_em (timestamptz); bucket 'post-images' criado via SQL
      (insert em storage.buckets, não precisa criar manualmente no painel)
      + policy de RLS em storage.objects no mesmo padrão do resto do
      projeto. Tipos TS estendidos em src/lib/supabase/types.ts.
      **PENDENTE: usuário precisa rodar esta migration no SQL Editor.**
- [x] Bloco B Etapa 4 — src/lib/render/post-template.ts: renderPostTemplate
      monta HTML 1080x1080 auto-contido (CSS inline via `<style>`, sem
      recursos externos), texto centralizado com fonte que diminui pra
      textos mais longos (pickFontSize, heurística por tamanho de string),
      marca + data no rodapé, HTML escapado (escapeHtml)
- [x] Bloco B Etapa 5 — src/lib/render/generate-image.ts
      (renderHtmlToPngBuffer: Puppeteer headless, viewport 1080x1080,
      screenshot PNG) + src/lib/render/upload-image.ts (uploadPostImage
      pro bucket post-images via client Supabase cookie-based;
      getPublicImageUrl monta a URL a partir do path, não guardada no
      banco). `npm install puppeteer` feito (baixa Chromium sozinho, ver
      Decisões Tomadas e Problemas Encontrados)
- [x] Bloco B Etapa 6 — src/lib/render/generate-post-image.ts
      (generateImageForApprovedPost: orquestra tudo — busca evento +
      cliente, monta template, renderiza, sobe pro Storage, salva
      imagem_gerada/imagem_gerada_em). Disparo automático logo após a
      aprovação (src/lib/calendar/handle-reply.ts, dentro do branch
      'aprovado'), com fallback manual via generateImageAction
      (src/app/calendar-actions.ts) exposto pelo botão "Gerar imagem" em
      src/components/approved-posts.tsx (seção "Posts aprovados" na tela
      do cliente — preview da imagem + link de download quando já gerada)
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e `npm run
      build` sem erros. Um erro de tipo corrigido no caminho — ver
      Problemas Encontrados (`waitUntil: "networkidle0"` não é aceito por
      `page.setContent` nesta versão do Puppeteer, só por `page.goto`).
      `serverExternalPackages: ["puppeteer"]` funcionou — o bundle das
      rotas não inflou (First Load JS igual ao da Fase 2, ~103-172kB)

- [x] Usuário rodou supabase/migrations/20260801020000_render_schema.sql —
      confirmado via REST API (content_calendar com imagem_gerada/
      imagem_gerada_em acessíveis; bucket post-images existe, público)
- [x] Bloco B Etapa 7 — Teste ponta a ponta rodado via `npm run dev` +
      browser real (mesma sessão autenticada de antes). Fluxo testado:
      1. Botão manual "Gerar imagem" no post já aprovado do teste da Fase 2
         ("Cliente Aniversário Teste") → imagem gerada em ~5-8s, link de
         download com URL pública correta
         (`.../storage/v1/object/public/post-images/<id>.png`)
      2. Imagem baixada e inspecionada visualmente (Read tool): 1080x1080,
         fundo em gradiente escuro, texto centralizado e totalmente
         legível, sem cortes, nome da marca ("Imóveis Teste Ltda") e data
         ("5 de agosto") no rodapé
      3. Teste de estresse com texto longo (414 caracteres, criado via
         REST/service role só pra esse teste): fonte automaticamente
         menor (bucket de 34px), 7 linhas, ainda sem cortes nem overflow —
         validou a heurística pickFontSize também no extremo mais longo
      4. Teste do **gatilho automático**: criada uma sugestão pendente
         (status='sugerido') via REST/service role, respondido "aprovado"
         no chat → confirmação de aprovação apareceu, seguida de "Já gerei
         a imagem desse post também..." SEM clicar em nenhum botão — a
         imagem apareceu sozinha na seção "Posts aprovados" com link de
         download funcional
      5. Testado o lembrete do Bloco A: apagados (REST/service role) os 15
         feriados nacionais de 2026 pra simular desatualização → banner
         "Feriados de 2026 ainda não sincronizados..." apareceu
         corretamente na home ao recarregar; clicado "Sincronizar
         feriados" → 15 feriados restaurados, banner sumiu
      **Fase 3 validada.** Registros de teste (2 eventos extras criados só
      pra este teste, além do já existente da Fase 2) ficaram no banco,
      claramente identificáveis ("Teste de texto longo", "Teste de
      gatilho automatico") — o usuário pode apagar quando quiser.

## Problemas Encontrados
- [2026-08-01] Problema: `npm install puppeteer` falhou na primeira
  tentativa com `Error: ERROR: Failed to set up chrome v151.0.7922.47!` —
  a pasta do Chromium existia em `C:\Users\sergi\.cache\puppeteer\chrome\...`
  mas o `chrome.exe` dentro dela estava faltando (download/extração
  incompleta, possivelmente interrompida). Status: resolvido — apaguei a
  pasta de cache do Puppeteer inteira (`Remove-Item -Recurse
  C:\Users\sergi\.cache\puppeteer`) e rodei `npm install puppeteer` de
  novo; na segunda tentativa baixou e instalou limpo (27 pacotes, sem erro).
- [2026-08-01] Problema: TypeScript reclamou que `"networkidle0"` não é um
  valor válido pro `waitUntil` de `page.setContent()` (só aceita `"load"`,
  `"domcontentloaded"`, ou array desses dois) — diferente de `page.goto()`,
  que aceita `networkidle0`/`networkidle2` também. Contexto: descoberto no
  `npx tsc --noEmit` depois de escrever src/lib/render/generate-image.ts.
  Status: resolvido — trocado pra `waitUntil: "load"`, suficiente aqui já
  que o HTML do template é auto-contido (sem imagens/fontes/scripts
  externos pra esperar carregar).

## Decisões Tomadas
- **Bucket do Storage criado via migration SQL** (`insert into
  storage.buckets`), não manualmente no painel do Supabase. Motivo:
  `storage.buckets` é só uma tabela normal do schema `storage`, dá pra
  criar bucket com INSERT simples — o SQL Editor roda como superuser, tem
  permissão. Mantém o fluxo de setup igual ao das fases anteriores (uma
  migration só, sem passo manual extra no painel).
- **Bucket público (`public: true`)**, não privado com URLs assinadas.
  Motivo: a imagem gerada é o próprio conteúdo que o cliente vai postar
  nas redes sociais dele — não é dado sensível, não faz sentido esconder
  atrás de autenticação. Simplifica o código (URL pública fixa, sem
  gerenciar expiração de signed URL) e o download funciona com um `<a
  href>` direto. Escrita (upload) continua exigindo `auth.uid() is not
  null`, igual ao padrão do resto do projeto.
- **`imagem_gerada` guarda só o path no bucket** (ex.: `"<id>.png"`), não a
  URL completa. A URL pública é montada em código
  (`getPublicImageUrl`, a partir de `NEXT_PUBLIC_SUPABASE_URL`) toda vez
  que é exibida. Motivo: evita duplicar/hardcodar o domínio do projeto
  Supabase no banco — se o projeto mudar de URL (raro, mas possível), só
  precisa atualizar a env var, não migrar dados.
- **Nome do arquivo = `<content_calendar.id>.png`, com `upsert: true` no
  upload.** Motivo: dá unicidade de graça (mesmo ID = mesmo arquivo) e
  permite regenerar a imagem (botão manual) sobrescrevendo a anterior sem
  precisar limpar o arquivo velho primeiro nem gerenciar múltiplas
  versões.
- **`puppeteer` (pacote completo, baixa Chromium sozinho), não
  `puppeteer-core`.** Especificado no próprio pedido da Fase 3: "nesta
  fase o objetivo é rodar LOCAL... `puppeteer` completo é suficiente".
  Documentando aqui pra não esquecer quando pensar em deploy: em produção
  serverless (Vercel, etc.) isso NÃO funciona como está — precisa trocar
  pra `puppeteer-core` + um Chromium empacotado separado (ex.:
  `@sparticuz/chromium`), porque a maioria das plataformas serverless não
  suporta baixar/rodar um Chromium completo (~300MB, precisa de binário
  nativo) da forma que o `puppeteer` normal faz. Isso é retrabalho
  necessário numa fase de deploy futura, não bug desta fase.
  `serverExternalPackages: ["puppeteer"]` adicionado em next.config.ts pra
  o bundler do Next não tentar processar os binários nativos do pacote.
- **Geração de imagem automática logo após aprovar no chat, MAIS um botão
  manual de fallback** ("Gerar imagem" em ApprovedPosts), em vez de só um
  ou só outro. O pedido original pedia pra escolher com base em
  simplicidade. Optei pelos dois porque: (1) automático é o mais alinhado
  com o resto do produto (tudo é "entregue automaticamente", igual às
  sugestões de texto da Fase 2); (2) mas Puppeteer é a peça mais frágil
  dessa fase (binário nativo, pode falhar por motivo de ambiente — já
  aconteceu uma vez nesta sessão, ver Problemas Encontrados), e sem
  nenhuma via de retry manual, uma falha silenciosa (só logada no console
  do servidor) deixaria o usuário sem saber que a imagem nunca foi gerada
  e sem como pedir de novo. O botão manual reaproveita a mesma
  generateImageForApprovedPost, custou poucas linhas a mais (mesmo padrão
  já usado em check-calendar-button.tsx), e cobre o caso de regenerar a
  imagem depois (ex.: se quiser tentar de novo com o template atualizado).
- **Nova seção "Posts aprovados" na tela do cliente**, listando
  content_calendar com status='aprovado' (não existia UI nenhuma pra ver
  posts aprovados antes desta fase — só apareciam como mensagens passadas
  no chat). Necessário pra ter onde mostrar a prévia da imagem + botão de
  download, conforme pedido explicitamente na Etapa 6.
- **pickFontSize com heurística por tamanho de string** (faixas de
  caractere: ≤80/≤150/≤250/≤400/>400 → 64/52/42/34/28px), não medição real
  de texto (canvas measureText ou similar). Motivo: simples, sem
  dependência extra, e suficiente pra reduzir bastante o risco de overflow
  pra textos longos gerados pela Groq — não é fitting perfeito
  (caracteres largos como "M" maiúsculo ainda podem ocupar mais espaço que
  a média), mas o container tem `overflow: hidden` como rede de segurança
  final. Validar visualmente no teste ponta a ponta (Etapa 7).

---

# Fase 2 — Calendário comemorativo + sugestões de post (Groq)

## Concluído
- [x] Etapa 1 — Migration supabase/migrations/20260801010000_calendar_schema.sql:
      special_dates (feriados + datas de nicho) e content_calendar (eventos por
      cliente + sugestão + status), RLS igual ao padrão da Fase 1, seed de 3
      datas de nicho pro segmento "imobiliario" (Dia do Corretor de Imóveis
      27/08, Dia do Cliente 15/09, Dia dos Namorados 12/06 sem segmento
      específico), content_calendar adicionada ao supabase_realtime. Tipos
      TS estendidos em src/lib/supabase/types.ts (SpecialDate, ContentCalendar).
      **PENDENTE: usuário precisa rodar esta migration no SQL Editor do
      Supabase** (mesmo processo da Fase 1) antes da Etapa 6 funcionar —
      não tenho como rodar SQL arbitrário via REST API/service role key, só
      o usuário tem acesso ao SQL Editor do painel.

- [x] Etapa 2 — src/lib/calendar/holidays-sync.ts: syncNationalHolidays()
      busca https://date.nager.at/api/v3/PublicHolidays/{ano}/BR e sincroniza
      pra special_dates. Feriados fixos (Nager `fixed: true`) viram linhas
      recorrentes (mes/dia, ano null); feriados móveis (Carnaval, Sexta-feira
      Santa etc.) viram linhas não-recorrentes com `ano` = ano sincronizado
      (ver Decisões Tomadas — coluna `ano` extra além do que foi pedido).
      Dedup feito em memória (sem upsert/constraint no banco, ver decisão).
      Disparada manualmente via server action syncHolidaysAction (botão
      "Sincronizar feriados" na home)
- [x] Etapa 3 — src/lib/calendar/calendar-engine.ts: detectarCandidatosParaCliente()
      cruza aniversario_pessoal/aniversario_empresa do cliente + special_dates
      (filtrando por segmento quando aplicável) e projeta a próxima ocorrência
      de cada data recorrente; runCalendarEngine() roda pra 1 cliente ou todos,
      cria content_calendar 'pendente_geracao' pra eventos dentro de
      DIAS_ANTECEDENCIA=7 dias, sem duplicar (checa client_id+data_evento+
      tipo_evento+nome_evento antes de inserir)
- [x] Etapa 4 — src/lib/groq/client.ts (groqChatCompletion, fetch direto ao
      endpoint OpenAI-compatible, model e api key só via env, nunca hardcoded)
      + src/lib/groq/post-suggestion.ts (generatePostSuggestion monta prompt
      com client_dna + evento, também suporta modo "ajuste" com sugestão
      anterior + feedback) + src/lib/calendar/generate-suggestions.ts
      (generateSuggestionsForPending: pra cada content_calendar
      'pendente_geracao', gera via Groq, salva sugestao_texto, muda status
      pra 'sugerido'; erro por evento é capturado e logado, não derruba o
      loop — linha fica 'pendente_geracao' pra tentar de novo depois)
- [x] Etapa 5 — generateSuggestionsForPending já posta a sugestão como
      mensagem da IA na conversa ativa (src/lib/calendar/messages.ts,
      formatSuggestionMessage). sendMessageAction (src/app/actions.ts)
      estendido: se não há pergunta do motor de perguntas pendente (Fase 1
      intocada), chama handleSuggestionReply (src/lib/calendar/handle-reply.ts)
      que checa content_calendar pendente ('sugerido'/'ajustado') pro
      cliente e interpreta a resposta livre do usuário via
      parseSuggestionReply: aprovação → status 'aprovado'; rejeição → status
      'rejeitado'; qualquer outra coisa → tratado como feedback de ajuste,
      regera o texto via Groq (generatePostSuggestion com sugestaoAnterior +
      feedbackAjuste) e status → 'ajustado', nova mensagem da IA com a
      sugestão revisada. src/app/calendar-actions.ts expõe
      syncHolidaysAction e checkCalendarAction como server actions
      (disparo manual, sem cron real) usadas pelos botões
      "Sincronizar feriados" (home) e "Verificar datas comemorativas"
      (tela do cliente)
- [x] Validação de código: `npx tsc --noEmit`, `npx eslint .` e `npm run build`
      sem erros (rodados via PowerShell nesta sessão — o Bash tool perdeu o
      PATH pra binários externos no meio da sessão, ver Problemas Encontrados)

- [x] Usuário rodou supabase/migrations/20260801010000_calendar_schema.sql
      no SQL Editor do Supabase — confirmado via REST API (special_dates
      com as 3 datas de nicho seedadas, content_calendar vazia e acessível)
- [x] Etapa 6 — Teste ponta a ponta rodado via `npm run dev` + browser real
      (mesma sessão autenticada de antes — a IA não digitou senha). Fluxo
      testado:
      1. "Sincronizar feriados" (home) → 30 feriados nacionais 2026/2027
         sincronizados corretamente em special_dates
      2. Criado cliente de teste "Cliente Aniversário Teste" (Imóveis Teste
         Ltda, segmento "Imobiliário") com aniversario_pessoal = 05/08/1990
         (4 dias à frente de hoje, 01/08/2026 — dentro da janela de 7 dias)
      3. Clicado "Verificar datas comemorativas" na tela do cliente → "1
         evento(s) detectado(s), 1 sugestão(ões) gerada(s) no chat";
         mensagem da IA com a sugestão apareceu automaticamente no chat,
         formatada corretamente (contexto do evento + texto + pergunta de
         aprovação)
      4. Confirmado que, com pergunta do motor de perguntas (Fase 1) ainda
         pendente pra esse cliente, a resposta do usuário foi consumida
         pela pergunta de DNA (não pela sugestão de calendário) — validou
         na prática a prioridade documentada em Decisões Tomadas. Zerado
         manualmente (via REST/service role, só pra destravar o teste) o
         restante das perguntas pendentes desse cliente pra isolar o teste
         do fluxo de calendário
      5. Testado fluxo de **ajuste**: respondida a sugestão com "deixa mais
         informal e curto, tipo um recadinho rápido" → Groq regerou o
         texto (visivelmente mais curto/informal que o original), status
         virou 'ajustado', nova mensagem da IA no chat com o texto revisado
      6. Testado fluxo de **aprovação**: respondido "aprovado" → mensagem
         de confirmação da IA ("Show, aprovado! Já marquei esse post como
         pronto pra publicar."), status virou 'aprovado'
      7. Confirmado direto no banco (REST API, service role):
         `content_calendar` com 1 linha só, `data_evento=2026-08-05`,
         `tipo_evento=aniversario_pessoal`, `sugestao_texto` = versão
         ajustada (mais curta), `status=aprovado`, `updated_at` atualizado
         pelo trigger
      8. Testado **dedup**: clicado "Verificar datas comemorativas" de
         novo no mesmo cliente → "Nenhuma data comemorativa nos próximos
         dias" (0 eventos novos), confirmado no banco que continua só 1
         linha em content_calendar — o evento já aprovado não foi
         recriado
      **Fase 2 validada.** Clientes de teste ("Cliente Teste" da Fase 1 e
      "Cliente Aniversário Teste" desta fase) ficaram no banco — o usuário
      pode apagar quando quiser.

## Problemas Encontrados
- [2026-08-01] Problema: o Bash tool parou de encontrar binários externos no
  PATH (`node`, `npx`, `ls`, `rm`, `head` todos deram "command not found")
  no meio da sessão, mesmo tendo funcionado antes (inclusive na sessão da
  Fase 1). Contexto: aconteceu ao tentar validar o código da Fase 2 com
  `npx tsc`. Status: contornado — usei o PowerShell tool pros mesmos
  comandos (`npx tsc --noEmit`, `npx eslint .`, `npm run build`), que
  funcionou normalmente. Não investighei a causa raiz (pode ser algo do
  ambiente/sandbox, não do projeto) — se voltar a acontecer, usar
  PowerShell como alternativa.
- [2026-08-01] Problema: `npm run build` falhou com
  `Cannot find module './611.js'` (MODULE_NOT_FOUND) ao gerar as páginas.
  Contexto: o servidor `next dev` da sessão da Fase 1 ainda estava rodando
  em background (preview do browser tool) e compartilhando a mesma pasta
  `.next` usada pelo `next build` — dev e build não podem escrever no
  mesmo `.next` ao mesmo tempo, corrompe os chunks do webpack. Status:
  resolvido — parei o preview do dev server, apaguei `.next` e rodei o
  build de novo, limpo.
- [2026-08-01] Problema: o campo `fixed` da API Nager.Date vem `false` pra
  **todos** os feriados nacionais BR sincronizados (30/30), inclusive
  datas claramente fixas como Natal (25/12) e Tiradentes (21/04) —
  confirmado direto na resposta crua da API, não é bug do código de sync.
  Contexto: descoberto na Etapa 6 (teste ponta a ponta), ao inspecionar
  `special_dates` depois de rodar "Sincronizar feriados" e ver
  `recorrente: false` em tudo. Impacto: a distinção fixo/móvel que o design
  original previa (feriados fixos virando linhas recorrentes via mes/dia,
  sem precisar ressincronizar) não se sustenta na prática pros dados da
  Nager.Date pro Brasil — todo feriado, fixo ou móvel, entra como linha
  não-recorrente presa ao ano sincronizado. Status: aceito como está, sem
  mudança de código — o motor de detecção já lida corretamente com isso
  (cada linha tem mes/dia/ano certos pro ano em que foi sincronizada, sem
  duplicar em re-sync), só que na prática *todo* feriado nacional (não só
  os móveis) precisa que "Sincronizar feriados" seja rodado de novo a cada
  virada de ano — o que já era esperado já que o sync é manual nesta fase
  (sem cron real). Não vale a pena hardcodar uma lista própria de "quais
  feriados BR são realmente fixos" só pra economizar isso.

## Decisões Tomadas
- **Server Actions em vez de API Routes pro disparo manual do motor.**
  A Etapa 2 do escopo original pedia "um script/route chamado manualmente".
  Optei por Server Actions (src/app/calendar-actions.ts:
  syncHolidaysAction, checkCalendarAction) em vez de Route Handlers
  (src/app/api/.../route.ts). Motivo: é exatamente o padrão que a Fase 1 já
  usa pra toda mutação (createClientAction, sendMessageAction) — reaproveita
  o client Supabase cookie-based (createClient de @/lib/supabase/server, que
  respeita RLS via auth.uid()) sem precisar duplicar autenticação, não exige
  tocar no middleware.ts pra excluir rotas /api do redirect de login, e os
  componentes cliente (botões) chamam a função direto, sem fetch/JSON
  manual — mesmo padrão já usado em chat-client.tsx com sendMessageAction.
- **Coluna extra `ano` (smallint, nullable) em special_dates**, além dos
  campos pedidos no escopo. Motivo: feriados nacionais móveis (Carnaval,
  Sexta-feira Santa, Corpus Christi) não têm mes/dia fixo ano a ano — a API
  Nager.Date informa isso via `fixed: false`. Sem guardar o ano da
  ocorrência sincronizada, não dava pra distinguir "essa data vale todo
  ano" de "essa data só vale pro ano X". Feriados fixos continuam com
  `ano = null` e recorrência normal via mes/dia; feriados móveis guardam
  `ano` e `recorrente = false`, e o motor de detecção só considera essa
  linha se a data cair dentro da janela pro ano exato gravado (uma nova
  sincronização no ano seguinte cria uma nova linha, não duplica).
- **Dedup em memória (SELECT antes de INSERT), sem UNIQUE constraint nem
  upsert no banco** — nem em special_dates (seed e sync de feriados) nem em
  content_calendar (motor de detecção). Motivo: colunas nullable
  (`segmento`, `ano`) em índice único quebram com upsert/ON CONFLICT no
  Postgres porque NULL nunca é igual a NULL (cada linha com NULL seria
  tratada como não-conflitante, permitindo duplicar mesmo com o índice).
  Resolver isso direito exigiria índices com `coalesce()` e replicar a
  mesma expressão no ON CONFLICT — complexidade desproporcional pro
  estágio atual do projeto. A Fase 1 também nunca usou upsert; checar
  existência antes de inserir mantém o mesmo padrão e evita esse problema
  inteiro. Risco aceito: se dois processos rodarem o motor ao mesmo tempo
  pro mesmo cliente, pode duplicar uma linha — improvável nesta fase
  (single-tenant, disparo manual por um usuário só). Dedup confirmado
  funcionando no teste da Etapa 6 (rodar "Verificar datas comemorativas"
  duas vezes não duplicou o evento).
- **Resposta de aprovação/rejeição/ajuste no chat é só texto livre, sem
  botões.** O escopo dava a opção ("via algum botão simples"). Optei por
  texto porque o pedido também dizia pra "reaproveitar o componente de
  chat existente" — botões por mensagem exigiriam linkar `messages` a
  `content_calendar` (uma FK nova) só pra saber qual mensagem tem qual
  sugestão associada, o que não existe hoje. Em vez disso,
  handleSuggestionReply usa a mesma heurística já estabelecida em
  sendMessageAction pra questions_pending: pega a sugestão pendente mais
  antiga do cliente (status 'sugerido' ou 'ajustado') e interpreta a
  resposta livre. Qualquer texto que não bate com as palavras de
  aprovação/rejeição é tratado como pedido de ajuste (em vez de exigir uma
  palavra-chave tipo "ajustar") — é o caminho mais natural pro usuário
  (só escrever o que quer mudar) e cobre o caso comum sem fricção extra.
- **Prioridade quando há pergunta do motor (Fase 1) E sugestão de
  calendário pendentes ao mesmo tempo: pergunta do motor sempre vence.**
  sendMessageAction só chama handleSuggestionReply no `else` do bloco que
  já tratava questions_pending — o código original da Fase 1 não foi
  alterado, só ganhou um `else`. Motivo: onboarding (DNA do cliente) é mais
  fundamental que aprovar um post, e a regra pedia explicitamente pra não
  mexer no motor de perguntas fixo. Validado na prática no teste da Etapa 6:
  criei um cliente novo com pergunta de onboarding pendente, disparei o
  motor de calendário, e a resposta seguinte do usuário foi corretamente
  consumida pela pergunta de DNA, não pela sugestão de post.
- **Ajuste sempre chama a Groq de novo com a sugestão anterior + o feedback
  do usuário** (em vez de edição direta do texto). Motivo: o usuário só
  escreve o que quer mudar em linguagem natural (ex.: "deixa mais informal
  e menciona a promoção") — pedir uma "edição direta" implicaria o próprio
  usuário reescrever o post inteiro, o que não é o fluxo natural de chat
  que o resto do produto usa. Erro da Groq durante o ajuste é capturado e
  vira uma mensagem de desculpa no chat (status da sugestão não muda,
  fica como estava, dá pra tentar de novo).
- **GROQ_MODEL default: `llama-3.3-70b-versatile`**, adicionado em
  .env.local e .env.local.example. O nome nunca aparece hardcoded em
  código (só lido de `process.env.GROQ_MODEL` em src/lib/groq/client.ts) —
  troque a variável de ambiente se esse modelo for depreciado ou se
  preferir outro. Ver modelos disponíveis em
  https://console.groq.com/docs/models.
- **Seed de datas de nicho pro segmento "imobiliario"**: só 3 datas com
  data fixa e confiança razoável (Dia do Corretor de Imóveis 27/08, Dia do
  Cliente 15/09, Dia dos Namorados 12/06). "Dia do Cliente" e "Dia dos
  Namorados" são datas comerciais amplas, não exclusivas de imobiliário —
  mantive "Dia do Cliente" com segmento='imobiliario' (foi dado como
  exemplo explícito no escopo pra esse segmento) mas deixei "Dia dos
  Namorados" com segmento=null (aplica a qualquer cliente, não só
  imobiliário) por ser mais genérica. Não incluí datas de data móvel tipo
  Dia das Mães/Pais ou Black Friday (não são "dia/mês fixo", e o schema de
  special_dates só modela recorrência por mes/dia — ver decisão da coluna
  `ano` acima) nem inventei datas de nicho sem confiança na data exata
  (evitar alucinação). Segmento comparado com normalização (minúsculo, sem
  acento) via src/lib/calendar/normalize.ts, já que `clients.segmento` é
  texto livre digitado pelo usuário, não um enum fixo.
- **Comparação de segmento em JavaScript, não em SQL.** O motor de
  detecção carrega todos os `special_dates` e todos os `clients` (tabelas
  pequenas, single-tenant) e cruza em memória, normalizando texto pra
  comparar "Imobiliário" com "imobiliario". Mais simples que tentar fazer
  isso em SQL (exigiria a extensão `unaccent` do Postgres, não garantida
  no plano gratuito do Supabase) e suficiente pra escala do projeto nesta
  fase.

---

# Fase 1 — Fundação (concluída e validada)

## Concluído
- [x] PROGRESS.md criado
- [x] Etapa 1 — Projeto Next.js 15 (App Router, TS, Tailwind v4) criado; @supabase/supabase-js
      e @supabase/ssr instalados; clients browser/server/middleware criados em
      src/lib/supabase/; middleware.ts protegendo rotas (redireciona pra /login
      se não autenticado); .env.local + .env.local.example criados (gitignored)
- [x] Etapa 2 — Migration SQL em supabase/migrations/20260801000000_init_schema.sql:
      clients, client_dna, conversations, messages, questions_pending; trigger
      que cria client_dna + conversation ativa automaticamente ao inserir um
      client; RLS em todas as tabelas (auth.uid() IS NOT NULL); tabelas
      messages e questions_pending adicionadas à publicação supabase_realtime
- [x] Etapa 3 — Chat por cliente em src/app/clientes/[id]/page.tsx +
      src/components/chat-client.tsx (Client Component com Supabase Realtime
      via postgres_changes). sendMessageAction (src/app/actions.ts) salva a
      mensagem do usuário e, se houver uma questions_pending mais antiga sem
      resposta, atualiza client_dna no campo correspondente, marca a pergunta
      como respondida e revela a próxima pergunta pendente como nova mensagem
      da IA
- [x] Etapa 4 — Motor de perguntas fixo em src/lib/questions-catalog.ts (9
      perguntas, uma por campo de client_dna) + src/lib/questions-engine.ts
      (generateQuestionsForNewClient roda ao cadastrar cliente, criada em
      src/app/actions.ts::createClientAction). Verificação de "campo vazio"
      via isFieldEmpty (trata string vazia, array vazio, objeto vazio, null)
- [x] Validação de código: `npx tsc --noEmit` sem erros, `npx eslint .` sem
      erros, `npm run build` sem erros
- [x] Usuário criou o projeto Supabase, rodou a migration e criou o usuário
      de autenticação (erikmatheus@outlook.com.br) — confirmado via REST API
      (tabela `clients` acessível, 1 usuário confirmado em Authentication)
- [x] Etapa 5 — Teste ponta a ponta rodado via `npm run dev` + browser real,
      sessão autenticada existente reaproveitada (login feito pelo usuário
      antes desta verificação — a IA nunca digitou a senha, conforme regra
      de segurança). Fluxo testado:
      1. Cadastrado cliente "Cliente Teste" (Padaria Teste Ltda / Alimentação)
         via /clientes/novo
      2. Redirecionou pra /clientes/[id] com a 1ª pergunta do motor
         ("Quem é o público-alvo ideal do seu negócio hoje?") já como
         mensagem da IA no chat
      3. Respondida via chat — a resposta apareceu na conversa e, via
         Realtime, a 2ª pergunta ("Quais são os principais produtos ou
         serviços que vocês vendem?") apareceu automaticamente como nova
         mensagem da IA, sem precisar recarregar a página
      4. Confirmado direto no banco (REST API com service role):
         `client_dna.publico_alvo` preenchido com a resposta exata e
         `updated_at` atualizado; `questions_pending` com 9 linhas (1
         `respondida=true` com a `resposta` salva, 8 ainda pendentes);
         `messages` com a sequência correta (pergunta IA → resposta usuário
         → próxima pergunta IA); `conversations` com 1 conversa `ativa`
         criada automaticamente pelo trigger
      **Fase 1 validada.** Cliente "Cliente Teste" ficou no banco — é
      claramente identificável como teste; o usuário pode apagar quando
      quiser (basta deletar a linha em `clients`, o `cascade` limpa o resto).

## Problemas Encontrados
- [2026-08-01] Problema: `create-next-app` recusou rodar direto no diretório
  Saas-Marketing porque "Saas-Marketing" tem letra maiúscula (nome de pacote
  npm inválido). Contexto: rodando `create-next-app .` na pasta do projeto.
  Status: resolvido — projeto criado numa pasta temporária (kirozeth-ai-tmp)
  e os arquivos movidos pra Saas-Marketing/, com package.json renomeado pra
  "kirozeth-ai".
- [2026-08-01] Problema: `create-next-app@latest` instalou Next.js 16.2.12 por
  padrão, mas o pedido era Next.js 15. Contexto: create-next-app sempre puxa
  a versão mais recente do Next disponível no momento. Status: resolvido —
  package.json fixado em `"next": "^15.5.0"`, node_modules e lockfile
  recriados com `npm install`.
- [2026-08-01] Problema: tipagem do Database (src/lib/supabase/types.ts) dava
  erro `Property 'x' does not exist on type 'never'` em todas as queries.
  Contexto: a versão instalada de @supabase/postgrest-js (2.x mais recente)
  exige que cada tabela do tipo Database tenha um campo `Relationships: []`
  além de Row/Insert/Update (tipo GenericTable), e o schema precisa de
  Views/Functions também definidos. Status: resolvido — adicionado
  `Relationships: []` em cada tabela e `Views/Functions/Enums/CompositeTypes`
  no nível do schema `public`.
- [2026-08-01] Problema: middleware de autenticação não estava protegendo
  nenhuma rota — acessar `/` ou `/clientes/novo` sem login carregava a
  página normalmente em vez de redirecionar pra `/login`. Contexto: o
  projeto foi criado com `--src-dir` (código em `src/app`), e o `middleware.ts`
  tinha sido colocado na raiz do projeto por engano; o Next.js só reconhece
  `middleware.ts` na raiz de `src/` quando o projeto usa src dir. Descoberto
  durante o teste ponta a ponta (Etapa 5), checando os logs do `next dev` e
  vendo que `GET /` retornava 200 direto, sem redirect. Status: resolvido —
  arquivo movido pra `src/middleware.ts` (removido da raiz); confirmado
  visualmente no browser que `/` agora reflete corretamente o estado de
  sessão (header com "Sair" só aparece quando há usuário autenticado).

## Decisões Tomadas
- **Modelo de acesso/RLS**: single-tenant, 1 usuário (Erik). Não haverá tabela agencies/profiles nesta fase. RLS em todas as tabelas exige apenas `auth.uid() IS NOT NULL` (qualquer usuário autenticado no projeto Supabase tem acesso total). Decidido com o usuário em 2026-08-01 — pode evoluir para multi-tenant real no futuro se a Kirozeth vender pra outras agências, mas não é escopo da Fase 1.
- **Motor de perguntas: perguntas fixas, não geradas por IA.** Nesta fase o
  catálogo de perguntas (src/lib/questions-catalog.ts) é uma lista fixa de 9
  perguntas em PT-BR, uma por campo de `client_dna`. Motivo: a Fase 1 é a
  fundação (banco, memória, chat) e não deve depender de uma chave de API
  externa (Claude) só pra funcionar ponta a ponta — reduz pontos de falha e
  custo nesta etapa. Trocar por geração via Claude API é uma troca isolada
  (só `generateQuestionsForNewClient` em src/lib/questions-engine.ts muda),
  fica documentado como candidato natural pra Fase 2+.
- **Perguntas reveladas uma de cada vez no chat**, não todas de uma vez. Ao
  cadastrar o cliente, só a primeira pergunta pendente vira mensagem da IA;
  as demais ficam em `questions_pending` e só viram mensagem quando a
  anterior é respondida (ver `sendMessageAction` em src/app/actions.ts).
  Motivo: manter o chat com cara de conversa natural em vez de um
  questionário despejado de uma vez.
- **Auth: sem tela de cadastro/signup no app.** Como é single-tenant (1
  usuário), o usuário de autenticação é criado direto no painel do Supabase
  (Authentication > Users), e o app só tem tela de login. Evita expor um
  endpoint de signup desnecessário nesta fase.
- **Trigger de banco cria client_dna + conversation automaticamente** ao
  inserir um novo `client` (função `handle_new_client`, ver migration).
  Motivo: garante que todo cliente sempre tem exatamente 1 linha de DNA e
  pelo menos 1 conversa ativa, sem precisar coordenar isso em múltiplos
  lugares no código da aplicação.
