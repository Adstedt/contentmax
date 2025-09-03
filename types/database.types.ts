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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      category_products: {
        Row: {
          category_id: string
          created_at: string | null
          position: number | null
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          position?: number | null
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          position?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          content: Json
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          language: string | null
          project_id: string | null
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          taxonomy_node_id: string | null
          title: string
          type: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          language?: string | null
          project_id?: string | null
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          taxonomy_node_id?: string | null
          title: string
          type: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          language?: string | null
          project_id?: string | null
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          taxonomy_node_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_taxonomy_node_id_fkey"
            columns: ["taxonomy_node_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_config: {
        Row: {
          account_id: string | null
          auth_credentials: Json | null
          auto_sync_enabled: boolean | null
          created_at: string | null
          delta_sync_enabled: boolean | null
          feed_name: string
          feed_type: string
          feed_url: string | null
          id: string
          last_sync_at: string | null
          merchant_id: string | null
          metadata: Json | null
          next_sync_at: string | null
          sync_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          auth_credentials?: Json | null
          auto_sync_enabled?: boolean | null
          created_at?: string | null
          delta_sync_enabled?: boolean | null
          feed_name: string
          feed_type: string
          feed_url?: string | null
          id?: string
          last_sync_at?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          next_sync_at?: string | null
          sync_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          auth_credentials?: Json | null
          auto_sync_enabled?: boolean | null
          created_at?: string | null
          delta_sync_enabled?: boolean | null
          feed_name?: string
          feed_type?: string
          feed_url?: string | null
          id?: string
          last_sync_at?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          next_sync_at?: string | null
          sync_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feed_sync_history: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          feed_id: string
          id: string
          merchant_id: string | null
          products_added: number | null
          products_failed: number | null
          products_processed: number | null
          products_removed: number | null
          products_updated: number | null
          started_at: string | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          feed_id: string
          id?: string
          merchant_id?: string | null
          products_added?: number | null
          products_failed?: number | null
          products_processed?: number | null
          products_removed?: number | null
          products_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          feed_id?: string
          id?: string
          merchant_id?: string | null
          products_added?: number | null
          products_failed?: number | null
          products_processed?: number | null
          products_removed?: number | null
          products_updated?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: []
      }
      generation_queue: {
        Row: {
          batch_id: string | null
          completed_at: string | null
          config: Json
          created_at: string | null
          error_message: string | null
          id: string
          priority: number | null
          project_id: string | null
          result: Json | null
          retry_count: number | null
          started_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          completed_at?: string | null
          config: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          project_id?: string | null
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          project_id?: string | null
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_changes: {
        Row: {
          change_type: string
          changed_fields: string[] | null
          detected_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          product_id: string
          sync_id: string | null
        }
        Insert: {
          change_type: string
          changed_fields?: string[] | null
          detected_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          product_id: string
          sync_id?: string | null
        }
        Update: {
          change_type?: string
          changed_fields?: string[] | null
          detected_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          product_id?: string
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_changes_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "feed_sync_history"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          additional_images: Json | null
          availability: string | null
          brand: string | null
          channel: string | null
          condition: string | null
          content_language: string | null
          created_at: string | null
          currency: string | null
          custom_attributes: Json | null
          description: string | null
          google_category: string | null
          gtin: string | null
          id: string
          image_url: string | null
          last_updated: string | null
          mpn: string | null
          price: number | null
          product_type: string[] | null
          sale_price: number | null
          target_country: string | null
          title: string
          url: string
        }
        Insert: {
          additional_images?: Json | null
          availability?: string | null
          brand?: string | null
          channel?: string | null
          condition?: string | null
          content_language?: string | null
          created_at?: string | null
          currency?: string | null
          custom_attributes?: Json | null
          description?: string | null
          google_category?: string | null
          gtin?: string | null
          id: string
          image_url?: string | null
          last_updated?: string | null
          mpn?: string | null
          price?: number | null
          product_type?: string[] | null
          sale_price?: number | null
          target_country?: string | null
          title: string
          url: string
        }
        Update: {
          additional_images?: Json | null
          availability?: string | null
          brand?: string | null
          channel?: string | null
          condition?: string | null
          content_language?: string | null
          created_at?: string | null
          currency?: string | null
          custom_attributes?: Json | null
          description?: string | null
          google_category?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          last_updated?: string | null
          mpn?: string | null
          price?: number | null
          product_type?: string[] | null
          sale_price?: number | null
          target_country?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          domain: string
          id: string
          name: string
          organization_id: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          domain: string
          id?: string
          name: string
          organization_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          domain?: string
          id?: string
          name?: string
          organization_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_content: {
        Row: {
          content_type: string | null
          created_at: string | null
          error_message: string | null
          extracted_data: Json | null
          extracted_text: string | null
          id: string
          project_id: string | null
          raw_html: string | null
          scraped_at: string | null
          status: string | null
          url: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          extracted_text?: string | null
          id?: string
          project_id?: string | null
          raw_html?: string | null
          scraped_at?: string | null
          status?: string | null
          url: string
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          extracted_text?: string | null
          id?: string
          project_id?: string | null
          raw_html?: string | null
          scraped_at?: string | null
          status?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_content_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_nodes: {
        Row: {
          content_status: string | null
          created_at: string | null
          deleted_at: string | null
          depth: number | null
          id: string
          meta_description: string | null
          meta_title: string | null
          metadata: Json | null
          parent_id: string | null
          path: string
          position: number | null
          project_id: string | null
          scraped_at: string | null
          sku_count: number | null
          title: string | null
          updated_at: string | null
          url: string
          // New fields from migration 009
          opportunity_score: number | null
          revenue_potential: number | null
          optimization_status: string | null
          last_scored_at: string | null
          metrics_updated_at: string | null
        }
        Insert: {
          content_status?: string | null
          created_at?: string | null
          deleted_at?: string | null
          depth?: number | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          metadata?: Json | null
          parent_id?: string | null
          path: string
          position?: number | null
          project_id?: string | null
          scraped_at?: string | null
          sku_count?: number | null
          title?: string | null
          updated_at?: string | null
          url: string
          // New fields from migration 009
          opportunity_score?: number | null
          revenue_potential?: number | null
          optimization_status?: string | null
          last_scored_at?: string | null
          metrics_updated_at?: string | null
        }
        Update: {
          content_status?: string | null
          created_at?: string | null
          deleted_at?: string | null
          depth?: number | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          metadata?: Json | null
          parent_id?: string | null
          path?: string
          position?: number | null
          project_id?: string | null
          scraped_at?: string | null
          sku_count?: number | null
          title?: string | null
          updated_at?: string | null
          url?: string
          // New fields from migration 009
          opportunity_score?: number | null
          revenue_potential?: number | null
          optimization_status?: string | null
          last_scored_at?: string | null
          metrics_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          template_content: string
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          template_content: string
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          template_content?: string
          type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      node_metrics: {
        Row: {
          id: string
          node_id: string
          date: string
          source: string
          // GSC Metrics
          impressions: number | null
          clicks: number | null
          ctr: number | null
          position: number | null
          // GA4 Metrics
          sessions: number | null
          revenue: number | null
          transactions: number | null
          conversion_rate: number | null
          avg_session_duration: number | null
          bounce_rate: number | null
          // Shopify Metrics
          product_views: number | null
          add_to_carts: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          node_id: string
          date: string
          source: string
          impressions?: number | null
          clicks?: number | null
          ctr?: number | null
          position?: number | null
          sessions?: number | null
          revenue?: number | null
          transactions?: number | null
          conversion_rate?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          product_views?: number | null
          add_to_carts?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          node_id?: string
          date?: string
          source?: string
          impressions?: number | null
          clicks?: number | null
          ctr?: number | null
          position?: number | null
          sessions?: number | null
          revenue?: number | null
          transactions?: number | null
          conversion_rate?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          product_views?: number | null
          add_to_carts?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "node_metrics_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          id: string
          node_id: string
          score: number
          revenue_potential: number
          priority: number
          factors: Json
          recommendations: Json | null
          computed_at: string | null
          valid_until: string | null
        }
        Insert: {
          id?: string
          node_id: string
          score: number
          revenue_potential: number
          priority: number
          factors?: Json
          recommendations?: Json | null
          computed_at?: string | null
          valid_until?: string | null
        }
        Update: {
          id?: string
          node_id?: string
          score?: number
          revenue_potential?: number
          priority?: number
          factors?: Json
          recommendations?: Json | null
          computed_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mark_stale_products: {
        Args: { active_product_ids: string[]; stale_threshold?: unknown }
        Returns: number
      }
      recalculate_taxonomy_metrics: {
        Args: {
          include_availability?: boolean
          include_revenue?: boolean
          include_sku_counts?: boolean
        }
        Returns: undefined
      }
      update_category_sku_counts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
    Enums: {},
  },
} as const
