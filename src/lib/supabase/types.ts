// Tipos gerados manualmente a partir de supabase/migrations/20260801000000_init_schema.sql
// Fase 1 não usa `supabase gen types` (sem projeto linkado ainda). Se o schema mudar,
// atualize este arquivo junto com a migration.

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          nome: string;
          empresa: string | null;
          segmento: string | null;
          aniversario_pessoal: string | null;
          aniversario_empresa: string | null;
          created_at: string;
          asaas_customer_id: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          empresa?: string | null;
          segmento?: string | null;
          aniversario_pessoal?: string | null;
          aniversario_empresa?: string | null;
          created_at?: string;
          asaas_customer_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_dna: {
        Row: {
          client_id: string;
          tom_de_voz: string | null;
          publico_alvo: string | null;
          produtos: string | null;
          ticket_medio: number | null;
          margem: number | null;
          cidade: string | null;
          concorrentes: unknown;
          metas: string | null;
          sazonalidade: unknown;
          cor_primaria: string | null;
          cor_secundaria: string | null;
          logo_url: string | null;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          tom_de_voz?: string | null;
          publico_alvo?: string | null;
          produtos?: string | null;
          ticket_medio?: number | null;
          margem?: number | null;
          cidade?: string | null;
          concorrentes?: unknown;
          metas?: string | null;
          sazonalidade?: unknown;
          cor_primaria?: string | null;
          cor_secundaria?: string | null;
          logo_url?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_dna"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          client_id: string;
          status: "ativa" | "arquivada";
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          status?: "ativa" | "arquivada";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          remetente: "ia" | "usuario";
          conteudo: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          remetente: "ia" | "usuario";
          conteudo: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      questions_pending: {
        Row: {
          id: string;
          client_id: string;
          pergunta: string;
          contexto: string | null;
          campo_relacionado: string | null;
          respondida: boolean;
          resposta: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          pergunta: string;
          contexto?: string | null;
          campo_relacionado?: string | null;
          respondida?: boolean;
          resposta?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions_pending"]["Insert"]>;
        Relationships: [];
      };
      special_dates: {
        Row: {
          id: string;
          nome: string;
          tipo: "nacional" | "nicho";
          mes: number;
          dia: number;
          segmento: string | null;
          recorrente: boolean;
          ano: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          tipo: "nacional" | "nicho";
          mes: number;
          dia: number;
          segmento?: string | null;
          recorrente?: boolean;
          ano?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["special_dates"]["Insert"]>;
        Relationships: [];
      };
      content_calendar: {
        Row: {
          id: string;
          client_id: string;
          data_evento: string;
          tipo_evento:
            | "feriado_nacional"
            | "aniversario_pessoal"
            | "aniversario_empresa"
            | "data_nicho"
            | "avulso";
          nome_evento: string;
          sugestao_texto: string | null;
          status: "pendente_geracao" | "sugerido" | "aprovado" | "rejeitado" | "ajustado";
          imagem_gerada: string | null;
          imagem_gerada_em: string | null;
          story_imagem_gerada: string | null;
          story_imagem_gerada_em: string | null;
          carrossel_slides: unknown;
          carrossel_gerado_em: string | null;
          compliance_alertas: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          data_evento: string;
          tipo_evento:
            | "feriado_nacional"
            | "aniversario_pessoal"
            | "aniversario_empresa"
            | "data_nicho"
            | "avulso";
          nome_evento: string;
          sugestao_texto?: string | null;
          status?: "pendente_geracao" | "sugerido" | "aprovado" | "rejeitado" | "ajustado";
          imagem_gerada?: string | null;
          imagem_gerada_em?: string | null;
          story_imagem_gerada?: string | null;
          story_imagem_gerada_em?: string | null;
          carrossel_slides?: unknown;
          carrossel_gerado_em?: string | null;
          compliance_alertas?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_calendar"]["Insert"]>;
        Relationships: [];
      };
      content_calendar_history: {
        Row: {
          id: string;
          content_calendar_id: string;
          status_anterior:
            | "pendente_geracao"
            | "sugerido"
            | "aprovado"
            | "rejeitado"
            | "ajustado"
            | null;
          status_novo: "pendente_geracao" | "sugerido" | "aprovado" | "rejeitado" | "ajustado";
          texto_no_momento: string | null;
          origem: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_calendar_id: string;
          status_anterior?:
            | "pendente_geracao"
            | "sugerido"
            | "aprovado"
            | "rejeitado"
            | "ajustado"
            | null;
          status_novo: "pendente_geracao" | "sugerido" | "aprovado" | "rejeitado" | "ajustado";
          texto_no_momento?: string | null;
          origem?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_calendar_history"]["Insert"]>;
        Relationships: [];
      };
      design_config: {
        Row: {
          chave: string;
          valor: unknown;
          descricao: string;
          updated_at: string;
        };
        Insert: {
          chave: string;
          valor: unknown;
          descricao: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["design_config"]["Insert"]>;
        Relationships: [];
      };
      document_templates: {
        Row: {
          id: string;
          tipo: "contrato" | "termos_uso" | "politica_privacidade" | "proposta_comercial";
          nome: string;
          conteudo_html: string;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          tipo: "contrato" | "termos_uso" | "politica_privacidade" | "proposta_comercial";
          nome: string;
          conteudo_html: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_templates"]["Insert"]>;
        Relationships: [];
      };
      client_documents: {
        Row: {
          id: string;
          client_id: string | null;
          document_template_id: string | null;
          lead_id: string | null;
          titulo: string;
          conteudo_final: string;
          status: "rascunho" | "gerado" | "assinado";
          gerado_em: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          document_template_id?: string | null;
          lead_id?: string | null;
          titulo: string;
          conteudo_final: string;
          status?: "rascunho" | "gerado" | "assinado";
          gerado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_documents"]["Insert"]>;
        Relationships: [];
      };
      client_billing: {
        Row: {
          id: string;
          client_id: string;
          tipo_cobranca: "fixa" | "variavel";
          valor_fixo: number | null;
          dia_vencimento: number | null;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          tipo_cobranca: "fixa" | "variavel";
          valor_fixo?: number | null;
          dia_vencimento?: number | null;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_billing"]["Insert"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          client_id: string;
          client_billing_id: string | null;
          descricao: string;
          valor: number;
          data_vencimento: string;
          status: "pendente" | "pago" | "atrasado" | "cancelado";
          data_pagamento: string | null;
          criado_em: string;
          asaas_payment_id: string | null;
          asaas_customer_id: string | null;
          forma_pagamento: "boleto" | "pix" | "cartao" | null;
          link_pagamento: string | null;
          boleto_url: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          client_billing_id?: string | null;
          descricao: string;
          valor: number;
          data_vencimento: string;
          status?: "pendente" | "pago" | "atrasado" | "cancelado";
          data_pagamento?: string | null;
          criado_em?: string;
          asaas_payment_id?: string | null;
          asaas_customer_id?: string | null;
          forma_pagamento?: "boleto" | "pix" | "cartao" | null;
          link_pagamento?: string | null;
          boleto_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
      ad_accounts: {
        Row: {
          id: string;
          client_id: string;
          plataforma: "meta" | "google";
          meta_ad_account_id: string | null;
          access_token: string | null;
          token_expira_em: string | null;
          conectado_em: string | null;
          status: "conectado" | "desconectado" | "erro";
          ultimo_erro: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          plataforma: "meta" | "google";
          meta_ad_account_id?: string | null;
          access_token?: string | null;
          token_expira_em?: string | null;
          conectado_em?: string | null;
          status?: "conectado" | "desconectado" | "erro";
          ultimo_erro?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ad_accounts"]["Insert"]>;
        Relationships: [];
      };
      ad_spend: {
        Row: {
          id: string;
          client_id: string;
          ad_account_id: string | null;
          data: string;
          valor: number;
          origem: "api" | "manual";
          criado_em: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          ad_account_id?: string | null;
          data: string;
          valor: number;
          origem: "api" | "manual";
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_spend"]["Insert"]>;
        Relationships: [];
      };
      personal_categories: {
        Row: {
          id: string;
          nome: string;
          tipo: "receita" | "despesa";
          cor: string;
          padrao: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          tipo: "receita" | "despesa";
          cor: string;
          padrao?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["personal_categories"]["Insert"]>;
        Relationships: [];
      };
      compliance_rules: {
        Row: {
          id: string;
          nicho: "saude" | "direito";
          regra: string;
          gravidade: "alta" | "media" | "baixa";
          fonte: string;
          ativo: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nicho: "saude" | "direito";
          regra: string;
          gravidade: "alta" | "media" | "baixa";
          fonte: string;
          ativo?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["compliance_rules"]["Insert"]>;
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          nome: string;
          ordem: number;
          cor: string;
          tipo_final: "nenhum" | "ganho" | "perdido";
          ativo: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          ordem: number;
          cor: string;
          tipo_final?: "nenhum" | "ganho" | "perdido";
          ativo?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipeline_stages"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          nome: string;
          empresa: string | null;
          telefone: string | null;
          email: string | null;
          segmento: string | null;
          origem: string | null;
          pipeline_stage_id: string;
          valor_estimado: number | null;
          client_id: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          empresa?: string | null;
          telefone?: string | null;
          email?: string | null;
          segmento?: string | null;
          origem?: string | null;
          pipeline_stage_id: string;
          valor_estimado?: number | null;
          client_id?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          tipo: "nota" | "ligacao" | "reuniao" | "email" | "mudanca_estagio";
          descricao: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          tipo: "nota" | "ligacao" | "reuniao" | "email" | "mudanca_estagio";
          descricao: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lead_activities"]["Insert"]>;
        Relationships: [];
      };
      personal_transactions: {
        Row: {
          id: string;
          categoria_id: string;
          tipo: "receita" | "despesa";
          descricao: string;
          valor: number;
          data: string;
          recorrente: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          categoria_id: string;
          tipo: "receita" | "despesa";
          descricao: string;
          valor: number;
          data: string;
          recorrente?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["personal_transactions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientDna = Database["public"]["Tables"]["client_dna"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type QuestionPending = Database["public"]["Tables"]["questions_pending"]["Row"];
export type SpecialDate = Database["public"]["Tables"]["special_dates"]["Row"];
export type ContentCalendar = Database["public"]["Tables"]["content_calendar"]["Row"];
export type ContentCalendarHistory = Database["public"]["Tables"]["content_calendar_history"]["Row"];
export type DesignConfigRow = Database["public"]["Tables"]["design_config"]["Row"];
export type DocumentTemplate = Database["public"]["Tables"]["document_templates"]["Row"];
export type ClientDocument = Database["public"]["Tables"]["client_documents"]["Row"];
export type ClientBilling = Database["public"]["Tables"]["client_billing"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type AdAccount = Database["public"]["Tables"]["ad_accounts"]["Row"];
export type AdSpend = Database["public"]["Tables"]["ad_spend"]["Row"];
export type PersonalCategory = Database["public"]["Tables"]["personal_categories"]["Row"];
export type PersonalTransaction = Database["public"]["Tables"]["personal_transactions"]["Row"];
export type ComplianceRule = Database["public"]["Tables"]["compliance_rules"]["Row"];
export type PipelineStage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type LeadActivity = Database["public"]["Tables"]["lead_activities"]["Row"];
