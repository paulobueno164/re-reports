export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      anexos: {
        Row: {
          created_at: string
          hash_comprovante: string | null
          id: string
          lancamento_id: string
          nome_arquivo: string
          storage_path: string
          tamanho: number
          tipo_arquivo: string
        }
        Insert: {
          created_at?: string
          hash_comprovante?: string | null
          id?: string
          lancamento_id: string
          nome_arquivo: string
          storage_path: string
          tamanho: number
          tipo_arquivo: string
        }
        Update: {
          created_at?: string
          hash_comprovante?: string | null
          id?: string
          lancamento_id?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho?: number
          tipo_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_description: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      calendario_periodos: {
        Row: {
          abre_lancamento: string
          created_at: string
          data_final: string
          data_inicio: string
          fecha_lancamento: string
          id: string
          periodo: string
          status: Database["public"]["Enums"]["period_status"]
        }
        Insert: {
          abre_lancamento: string
          created_at?: string
          data_final: string
          data_inicio: string
          fecha_lancamento: string
          id?: string
          periodo: string
          status?: Database["public"]["Enums"]["period_status"]
        }
        Update: {
          abre_lancamento?: string
          created_at?: string
          data_final?: string
          data_inicio?: string
          fecha_lancamento?: string
          id?: string
          periodo?: string
          status?: Database["public"]["Enums"]["period_status"]
        }
        Relationships: []
      }
      colaboradores_elegiveis: {
        Row: {
          ajuda_custo: number
          ativo: boolean
          cesta_beneficios_teto: number
          created_at: string
          departamento: string
          email: string
          id: string
          matricula: string
          mobilidade: number
          nome: string
          pida_teto: number
          salario_base: number
          tem_pida: boolean
          transporte: number
          updated_at: string
          user_id: string | null
          vale_alimentacao: number
          vale_refeicao: number
        }
        Insert: {
          ajuda_custo?: number
          ativo?: boolean
          cesta_beneficios_teto?: number
          created_at?: string
          departamento: string
          email: string
          id?: string
          matricula: string
          mobilidade?: number
          nome: string
          pida_teto?: number
          salario_base?: number
          tem_pida?: boolean
          transporte?: number
          updated_at?: string
          user_id?: string | null
          vale_alimentacao?: number
          vale_refeicao?: number
        }
        Update: {
          ajuda_custo?: number
          ativo?: boolean
          cesta_beneficios_teto?: number
          created_at?: string
          departamento?: string
          email?: string
          id?: string
          matricula?: string
          mobilidade?: number
          nome?: string
          pida_teto?: number
          salario_base?: number
          tem_pida?: boolean
          transporte?: number
          updated_at?: string
          user_id?: string | null
          vale_alimentacao?: number
          vale_refeicao?: number
        }
        Relationships: []
      }
      eventos_pida: {
        Row: {
          colaborador_id: string
          created_at: string
          fechamento_id: string
          id: string
          periodo_id: string
          valor_base_pida: number
          valor_diferenca_cesta: number
          valor_total_pida: number
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          fechamento_id: string
          id?: string
          periodo_id: string
          valor_base_pida?: number
          valor_diferenca_cesta?: number
          valor_total_pida?: number
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          fechamento_id?: string
          id?: string
          periodo_id?: string
          valor_base_pida?: number
          valor_diferenca_cesta?: number
          valor_total_pida?: number
        }
        Relationships: [
          {
            foreignKeyName: "eventos_pida_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores_elegiveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_pida_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_pida_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "calendario_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      exportacoes: {
        Row: {
          created_at: string
          data_exportacao: string
          fechamento_id: string | null
          id: string
          nome_arquivo: string
          periodo_id: string
          qtd_registros: number
          usuario_id: string
        }
        Insert: {
          created_at?: string
          data_exportacao?: string
          fechamento_id?: string | null
          id?: string
          nome_arquivo: string
          periodo_id: string
          qtd_registros?: number
          usuario_id: string
        }
        Update: {
          created_at?: string
          data_exportacao?: string
          fechamento_id?: string | null
          id?: string
          nome_arquivo?: string
          periodo_id?: string
          qtd_registros?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exportacoes_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exportacoes_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "calendario_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos: {
        Row: {
          created_at: string
          data_processamento: string
          detalhes_erro: string | null
          id: string
          periodo_id: string
          status: string
          total_colaboradores: number
          total_eventos: number
          usuario_id: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          data_processamento?: string
          detalhes_erro?: string | null
          id?: string
          periodo_id: string
          status?: string
          total_colaboradores?: number
          total_eventos?: number
          usuario_id: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          data_processamento?: string
          detalhes_erro?: string | null
          id?: string
          periodo_id?: string
          status?: string
          total_colaboradores?: number
          total_eventos?: number
          usuario_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "calendario_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          colaborador_id: string
          created_at: string
          descricao_fato_gerador: string
          id: string
          motivo_invalidacao: string | null
          origem: Database["public"]["Enums"]["expense_origin"]
          periodo_id: string
          status: Database["public"]["Enums"]["expense_status"]
          tipo_despesa_id: string
          updated_at: string
          validado_em: string | null
          validado_por: string | null
          valor_considerado: number
          valor_lancado: number
          valor_nao_considerado: number
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          descricao_fato_gerador: string
          id?: string
          motivo_invalidacao?: string | null
          origem?: Database["public"]["Enums"]["expense_origin"]
          periodo_id: string
          status?: Database["public"]["Enums"]["expense_status"]
          tipo_despesa_id: string
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          valor_considerado: number
          valor_lancado: number
          valor_nao_considerado?: number
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          descricao_fato_gerador?: string
          id?: string
          motivo_invalidacao?: string | null
          origem?: Database["public"]["Enums"]["expense_origin"]
          periodo_id?: string
          status?: Database["public"]["Enums"]["expense_status"]
          tipo_despesa_id?: string
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          valor_considerado?: number
          valor_lancado?: number
          valor_nao_considerado?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores_elegiveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "calendario_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tipo_despesa_id_fkey"
            columns: ["tipo_despesa_id"]
            isOneToOne: false
            referencedRelation: "tipos_despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      tipos_despesas: {
        Row: {
          ativo: boolean
          classificacao: Database["public"]["Enums"]["expense_classification"]
          created_at: string
          grupo: string
          id: string
          nome: string
          origem_permitida: Database["public"]["Enums"]["expense_origin"][]
          valor_padrao_teto: number
        }
        Insert: {
          ativo?: boolean
          classificacao?: Database["public"]["Enums"]["expense_classification"]
          created_at?: string
          grupo: string
          id?: string
          nome: string
          origem_permitida?: Database["public"]["Enums"]["expense_origin"][]
          valor_padrao_teto?: number
        }
        Update: {
          ativo?: boolean
          classificacao?: Database["public"]["Enums"]["expense_classification"]
          created_at?: string
          grupo?: string
          id?: string
          nome?: string
          origem_permitida?: Database["public"]["Enums"]["expense_origin"][]
          valor_padrao_teto?: number
        }
        Relationships: []
      }
      tipos_despesas_eventos: {
        Row: {
          codigo_evento: string
          created_at: string
          descricao_evento: string
          id: string
          tipo_despesa_id: string
        }
        Insert: {
          codigo_evento: string
          created_at?: string
          descricao_evento: string
          id?: string
          tipo_despesa_id: string
        }
        Update: {
          codigo_evento?: string
          created_at?: string
          descricao_evento?: string
          id?: string
          tipo_despesa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_despesas_eventos_tipo_despesa_id_fkey"
            columns: ["tipo_despesa_id"]
            isOneToOne: true
            referencedRelation: "tipos_despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_colaborador_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "FINANCEIRO" | "COLABORADOR" | "RH"
      expense_classification: "fixo" | "variavel"
      expense_origin: "proprio" | "conjuge" | "filhos"
      expense_status:
        | "rascunho"
        | "enviado"
        | "em_analise"
        | "valido"
        | "invalido"
      period_status: "aberto" | "fechado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["FINANCEIRO", "COLABORADOR", "RH"],
      expense_classification: ["fixo", "variavel"],
      expense_origin: ["proprio", "conjuge", "filhos"],
      expense_status: [
        "rascunho",
        "enviado",
        "em_analise",
        "valido",
        "invalido",
      ],
      period_status: ["aberto", "fechado"],
    },
  },
} as const
