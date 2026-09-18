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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      dividend_distributions: {
        Row: {
          created_at: string
          id: string
          onchain_snapshot_id: string | null
          payment_date: string
          product_id: string
          record_date: string
          status: string
          total_distribution_amount_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          onchain_snapshot_id?: string | null
          payment_date: string
          product_id: string
          record_date: string
          status?: string
          total_distribution_amount_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          onchain_snapshot_id?: string | null
          payment_date?: string
          product_id?: string
          record_date?: string
          status?: string
          total_distribution_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "dividend_distributions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dividend_payouts: {
        Row: {
          created_at: string
          distribution_id: string
          entitled_amount_cents: number
          id: string
          investor_id: string
          payout_status: string
          settlement_reference: string | null
          wallet_address_evm: string
        }
        Insert: {
          created_at?: string
          distribution_id: string
          entitled_amount_cents: number
          id?: string
          investor_id: string
          payout_status?: string
          settlement_reference?: string | null
          wallet_address_evm: string
        }
        Update: {
          created_at?: string
          distribution_id?: string
          entitled_amount_cents?: number
          id?: string
          investor_id?: string
          payout_status?: string
          settlement_reference?: string | null
          wallet_address_evm?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividend_payouts_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "dividend_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividend_payouts_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_products: {
        Row: {
          asset_symbol: string
          created_at: string
          decimals: number
          id: string
          nominal_token_price_cents: number
          product_name: string
          smart_contract_address: string
          status: string
          target_valuation_cents: number
          total_token_supply: number
        }
        Insert: {
          asset_symbol?: string
          created_at?: string
          decimals?: number
          id?: string
          nominal_token_price_cents: number
          product_name: string
          smart_contract_address: string
          status?: string
          target_valuation_cents: number
          total_token_supply: number
        }
        Update: {
          asset_symbol?: string
          created_at?: string
          decimals?: number
          id?: string
          nominal_token_price_cents?: number
          product_name?: string
          smart_contract_address?: string
          status?: string
          target_valuation_cents?: number
          total_token_supply?: number
        }
        Relationships: []
      }
      investor_wallets: {
        Row: {
          created_at: string
          hedera_account_id: string | null
          id: string
          investor_id: string
          is_whitelisted: boolean
          wallet_address_evm: string
          wallet_type: string
          whitelisted_at: string | null
        }
        Insert: {
          created_at?: string
          hedera_account_id?: string | null
          id?: string
          investor_id: string
          is_whitelisted?: boolean
          wallet_address_evm: string
          wallet_type?: string
          whitelisted_at?: string | null
        }
        Update: {
          created_at?: string
          hedera_account_id?: string | null
          id?: string
          investor_id?: string
          is_whitelisted?: boolean
          wallet_address_evm?: string
          wallet_type?: string
          whitelisted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_wallets_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          accreditation_status: string
          country_iso: string
          created_at: string
          email: string
          entity_type: string
          firebase_uid: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          accreditation_status?: string
          country_iso: string
          created_at?: string
          email: string
          entity_type: string
          firebase_uid: string
          full_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          accreditation_status?: string
          country_iso?: string
          created_at?: string
          email?: string
          entity_type?: string
          firebase_uid?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      kyc_verifications: {
        Row: {
          created_at: string
          document_storage_path: string
          document_type: string
          id: string
          investor_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          document_storage_path: string
          document_type: string
          id?: string
          investor_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          document_storage_path?: string
          document_type?: string
          id?: string
          investor_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_verifications_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          currency: string
          fiat_amount_cents: number
          id: string
          investor_id: string
          payment_method: string
          payment_reference: string | null
          product_id: string
          status: string
          token_quantity_allocated: number
          updated_at: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          fiat_amount_cents: number
          id?: string
          investor_id: string
          payment_method: string
          payment_reference?: string | null
          product_id: string
          status?: string
          token_quantity_allocated: number
          updated_at?: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          fiat_amount_cents?: number
          id?: string
          investor_id?: string
          payment_method?: string
          payment_reference?: string | null
          product_id?: string
          status?: string
          token_quantity_allocated?: number
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "investor_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      token_allocations: {
        Row: {
          block_number: number | null
          created_at: string
          execution_status: string
          id: string
          recipient_evm_address: string
          subscription_id: string
          tokens_transferred: number
          transaction_hash: string
        }
        Insert: {
          block_number?: number | null
          created_at?: string
          execution_status?: string
          id?: string
          recipient_evm_address: string
          subscription_id: string
          tokens_transferred: number
          transaction_hash: string
        }
        Update: {
          block_number?: number | null
          created_at?: string
          execution_status?: string
          id?: string
          recipient_evm_address?: string
          subscription_id?: string
          tokens_transferred?: number
          transaction_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_allocations_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
