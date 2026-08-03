-- Kirozeth AI — Fase 15 — Módulo jurídico (contratos, termos, política)
-- Não altera nada das fases anteriores. RLS segue o mesmo padrão do
-- resto do projeto: auth.uid() is not null.
--
-- AVISO IMPORTANTE (documentado também no PROGRESS.md e na UI): o
-- conteúdo jurídico populado por esta migration é um TEXTO-BASE DE
-- REFERÊNCIA, não aconselhamento jurídico validado. Precisa de revisão
-- por um profissional qualificado antes de uso com clientes reais.

-- =========================================================
-- document_templates — modelos-base editáveis (contrato, termos, política)
-- =========================================================
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('contrato', 'termos_uso', 'politica_privacidade')),
  nome text not null,
  conteudo_html text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.document_templates is
  'Modelos-base de documentos jurídicos (Fase 15), editáveis via '
  '/juridico/modelos/[id]. conteudo_html usa placeholders {{chave}} '
  '(ex.: {{nome_cliente}}, {{servico}}, {{valor}}, {{vigencia}}) '
  'substituídos na geração — ver src/lib/documents/fill-template.ts. '
  'TEXTO-BASE DE REFERÊNCIA, não aconselhamento jurídico validado.';

-- `atualizado_em` NÃO usa o trigger set_updated_at() (Fase 1) porque essa
-- função grava especificamente em `new.updated_at` (nome de coluna
-- diferente) — mesmo padrão já usado pra timestamps de domínio no projeto
-- (ex.: imagem_gerada_em, carrossel_gerado_em, Fase 3/12): setado
-- explicitamente pela Server Action de edição, não por trigger de banco.

alter table public.document_templates enable row level security;

create policy "authenticated_full_access" on public.document_templates
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- client_documents — documentos gerados (snapshot imutável do HTML final)
-- =========================================================
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  document_template_id uuid references public.document_templates (id) on delete set null,
  titulo text not null,
  conteudo_final text not null,
  status text not null default 'gerado' check (status in ('rascunho', 'gerado', 'assinado')),
  gerado_em timestamptz not null default now()
);

comment on table public.client_documents is
  'Documentos gerados a partir de um document_template (Fase 15). '
  '`client_id` é NULL pra documentos do próprio sistema (termos de uso, '
  'política de privacidade) — só documentos ligados a um cliente '
  '(ex.: contrato) têm client_id preenchido. `conteudo_final` é um '
  'SNAPSHOT do HTML já preenchido no momento da geração — não muda '
  'retroativamente se o modelo-base for editado depois (mesmo padrão de '
  '"preservar o que já foi gerado" usado em imagem_gerada, Fase 3). '
  '`document_template_id` usa `on delete set null` (não cascade): '
  'apagar o modelo-base não deve apagar documentos já gerados a partir '
  'dele, já que o conteúdo relevante está todo em conteudo_final.';

comment on column public.client_documents.status is
  'rascunho/gerado/assinado — só "gerado" é usado de fato nesta fase '
  '(setado automaticamente na geração). Os outros 2 valores existem pro '
  'campo já estar pronto pra um fluxo de assinatura digital futuro, sem '
  'precisar de migration nova quando isso for implementado.';

create index if not exists idx_client_documents_client_id
  on public.client_documents (client_id);

alter table public.client_documents enable row level security;

create policy "authenticated_full_access" on public.client_documents
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- Seed: modelos-base iniciais (Fase 15) — texto de referência genérico,
-- estruturado com base nas categorias de risco (pagamento, IP,
-- confidencialidade, rescisão etc.) usadas pelos skills de revisão de
-- contrato já instalados no projeto (.claude/skills/contract-review,
-- review-contract — não havia um skill de "legal" com esse nome exato
-- nem um skill de REDAÇÃO de contrato/política, só de revisão; usados
-- aqui como referência de estrutura/checklist de cláusulas, não como
-- fonte do texto em si). NÃO É ACONSELHAMENTO JURÍDICO VALIDADO.
-- =========================================================
insert into public.document_templates (tipo, nome, conteudo_html) values
(
  'contrato',
  'Contrato de Prestação de Serviço (genérico)',
  $tpl$<h1>Contrato de Prestação de Serviços</h1>
<p><strong>CONTRATANTE:</strong> {{nome_cliente}}</p>
<p><strong>CONTRATADA:</strong> [RAZÃO SOCIAL, CNPJ E ENDEREÇO DA SUA EMPRESA — edite este modelo com os dados reais antes de gerar contratos]</p>
<p>Pelo presente instrumento particular, as partes acima identificadas têm entre si justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes.</p>

<h2>Cláusula 1ª — Do Objeto</h2>
<p>A CONTRATADA prestará à CONTRATANTE os seguintes serviços: {{servico}}.</p>

<h2>Cláusula 2ª — Do Valor e Forma de Pagamento</h2>
<p>Pelos serviços descritos na Cláusula 1ª, a CONTRATANTE pagará à CONTRATADA o valor de {{valor}}, conforme condições acordadas entre as partes.</p>

<h2>Cláusula 3ª — Da Vigência</h2>
<p>O presente contrato vigorará pelo prazo de {{vigencia}}, contado a partir da data de assinatura, podendo ser renovado mediante acordo entre as partes.</p>

<h2>Cláusula 4ª — Das Obrigações da CONTRATADA</h2>
<p>A CONTRATADA se compromete a prestar os serviços contratados com zelo, diligência e em conformidade com os prazos e padrões de qualidade acordados entre as partes.</p>

<h2>Cláusula 5ª — Das Obrigações da CONTRATANTE</h2>
<p>A CONTRATANTE se compromete a fornecer as informações, materiais e acessos necessários à boa execução dos serviços, bem como a efetuar os pagamentos nas datas acordadas.</p>

<h2>Cláusula 6ª — Da Confidencialidade</h2>
<p>As partes se comprometem a manter sigilo sobre quaisquer informações confidenciais trocadas em razão deste contrato, durante sua vigência e após seu término.</p>

<h2>Cláusula 7ª — Da Propriedade Intelectual</h2>
<p>Os materiais e entregáveis produzidos especificamente para a CONTRATANTE no âmbito deste contrato, uma vez pagos integralmente, serão de propriedade da CONTRATANTE, ressalvados metodologias, ferramentas e conhecimentos prévios da CONTRATADA.</p>

<h2>Cláusula 8ª — Da Rescisão</h2>
<p>O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio por escrito, respeitado o pagamento proporcional dos serviços já prestados até a data da rescisão.</p>

<h2>Cláusula 9ª — Do Foro</h2>
<p>Fica eleito o foro da comarca de {{cidade}} para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

<p>E por estarem justas e contratadas, as partes assinam o presente instrumento em {{data_atual}}.</p>

<hr/>
<p>_____________________________<br/>CONTRATANTE: {{nome_cliente}}</p>
<p>_____________________________<br/>CONTRATADA</p>$tpl$
),
(
  'termos_uso',
  'Termos de Uso — Kirozeth AI',
  $tpl$<h1>Termos de Uso — {{nome_empresa}}</h1>
<p>Última atualização: {{data_atual}}</p>
<p>Estes Termos de Uso regulam o acesso e a utilização da plataforma {{nome_empresa}}, disponível em {{url_sistema}}. Ao utilizar a plataforma, o usuário concorda integralmente com os termos aqui descritos.</p>

<h2>1. Do Objeto</h2>
<p>A {{nome_empresa}} é uma plataforma de automação de marketing que auxilia agências e profissionais na geração de conteúdo, sugestões de posts e imagens para redes sociais.</p>

<h2>2. Do Cadastro</h2>
<p>O uso da plataforma pode exigir cadastro prévio, sendo de responsabilidade do usuário manter suas informações de acesso em sigilo e atualizadas.</p>

<h2>3. Do Uso da Plataforma</h2>
<p>O usuário se compromete a utilizar a plataforma de forma lícita, não devendo utilizá-la para fins ilegais, ofensivos, ou que violem direitos de terceiros.</p>

<h2>4. Da Propriedade Intelectual</h2>
<p>Todos os direitos sobre a plataforma, sua marca, layout e funcionalidades pertencem à {{nome_empresa}}, sendo vedada sua reprodução total ou parcial sem autorização.</p>

<h2>5. Das Limitações de Responsabilidade</h2>
<p>A {{nome_empresa}} não se responsabiliza por conteúdos gerados automaticamente que sejam publicados sem revisão do usuário, sendo de responsabilidade exclusiva do usuário a revisão e aprovação de todo conteúdo antes da publicação.</p>

<h2>6. Das Alterações</h2>
<p>Estes Termos de Uso podem ser atualizados a qualquer momento, sendo recomendável a consulta periódica pelo usuário.</p>

<h2>7. Do Contato</h2>
<p>Dúvidas sobre estes Termos de Uso podem ser enviadas para {{email_contato}}.</p>$tpl$
),
(
  'politica_privacidade',
  'Política de Privacidade — Kirozeth AI',
  $tpl$<h1>Política de Privacidade — {{nome_empresa}}</h1>
<p>Última atualização: {{data_atual}}</p>
<p>Esta Política de Privacidade descreve como a {{nome_empresa}} coleta, usa, armazena e protege os dados pessoais dos usuários da plataforma {{url_sistema}}, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>

<h2>1. Dados Coletados</h2>
<p>Podemos coletar dados como nome, e-mail, informações de clientes cadastrados pelo usuário, e conteúdo gerado através da plataforma, na medida necessária para a prestação do serviço.</p>

<h2>2. Finalidade do Tratamento</h2>
<p>Os dados são utilizados exclusivamente para viabilizar o funcionamento da plataforma, incluindo geração de sugestões de conteúdo, comunicação com o usuário e melhoria contínua do serviço.</p>

<h2>3. Compartilhamento de Dados</h2>
<p>Não compartilhamos dados pessoais com terceiros, exceto quando necessário para a operação da plataforma (ex.: provedores de infraestrutura e inteligência artificial) ou por exigência legal.</p>

<h2>4. Armazenamento e Segurança</h2>
<p>Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados armazenados contra acessos não autorizados, perda ou alteração indevida.</p>

<h2>5. Direitos do Titular</h2>
<p>Nos termos da LGPD, o titular dos dados pode solicitar, a qualquer momento, a confirmação da existência de tratamento, acesso, correção, anonimização ou eliminação de seus dados pessoais.</p>

<h2>6. Contato</h2>
<p>Solicitações relacionadas a esta Política podem ser enviadas para {{email_contato}}.</p>$tpl$
);
