export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          ip_address: unknown | null;
          new_values: Json | null;
          old_values: Json | null;
          organization_id: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          ip_address?: unknown | null;
          new_values?: Json | null;
          old_values?: Json | null;
          organization_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          ip_address?: unknown | null;
          new_values?: Json | null;
          old_values?: Json | null;
          organization_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      content_items: {
        Row: {
          content: Json;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          generated_at: string | null;
          generated_by: string | null;
          id: string;
          language: string;
          project_id: string | null;
          published_at: string | null;
          published_by: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          taxonomy_node_id: string | null;
          title: string;
          type: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          content: Json;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          generated_at?: string | null;
          generated_by?: string | null;
          id?: string;
          language?: string;
          project_id?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          taxonomy_node_id?: string | null;
          title: string;
          type: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          content?: Json;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          generated_at?: string | null;
          generated_by?: string | null;
          id?: string;
          language?: string;
          project_id?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          taxonomy_node_id?: string | null;
          title?: string;
          type?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'content_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_items_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_items_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_items_taxonomy_node_id_fkey';
            columns: ['taxonomy_node_id'];
            isOneToOne: false;
            referencedRelation: 'taxonomy_nodes';
            referencedColumns: ['id'];
          },
        ];
      };
      generation_queue: {
        Row: {
          batch_id: string | null;
          completed_at: string | null;
          config: Json;
          created_at: string;
          error_message: string | null;
          id: string;
          priority: number;
          project_id: string | null;
          result: Json | null;
          retry_count: number;
          started_at: string | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          batch_id?: string | null;
          completed_at?: string | null;
          config: Json;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          priority?: number;
          project_id?: string | null;
          result?: Json | null;
          retry_count?: number;
          started_at?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          batch_id?: string | null;
          completed_at?: string | null;
          config?: Json;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          priority?: number;
          project_id?: string | null;
          result?: Json | null;
          retry_count?: number;
          started_at?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'generation_queue_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'generation_queue_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          settings: Json;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          settings?: Json;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          settings?: Json;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          domain: string;
          id: string;
          name: string;
          organization_id: string | null;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          domain: string;
          id?: string;
          name: string;
          organization_id?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          domain?: string;
          id?: string;
          name?: string;
          organization_id?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      scraped_content: {
        Row: {
          content_type: string | null;
          created_at: string;
          error_message: string | null;
          extracted_data: Json | null;
          extracted_text: string | null;
          id: string;
          project_id: string | null;
          raw_html: string | null;
          scraped_at: string;
          status: string;
          url: string;
        };
        Insert: {
          content_type?: string | null;
          created_at?: string;
          error_message?: string | null;
          extracted_data?: Json | null;
          extracted_text?: string | null;
          id?: string;
          project_id?: string | null;
          raw_html?: string | null;
          scraped_at?: string;
          status?: string;
          url: string;
        };
        Update: {
          content_type?: string | null;
          created_at?: string;
          error_message?: string | null;
          extracted_data?: Json | null;
          extracted_text?: string | null;
          id?: string;
          project_id?: string | null;
          raw_html?: string | null;
          scraped_at?: string;
          status?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scraped_content_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      taxonomy_nodes: {
        Row: {
          content_status: string;
          created_at: string;
          deleted_at: string | null;
          depth: number;
          id: string;
          meta_description: string | null;
          meta_title: string | null;
          metadata: Json;
          parent_id: string | null;
          path: string;
          position: number;
          project_id: string | null;
          scraped_at: string | null;
          sku_count: number;
          title: string | null;
          updated_at: string;
          url: string;
        };
        Insert: {
          content_status?: string;
          created_at?: string;
          deleted_at?: string | null;
          depth?: number;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          metadata?: Json;
          parent_id?: string | null;
          path: string;
          position?: number;
          project_id?: string | null;
          scraped_at?: string | null;
          sku_count?: number;
          title?: string | null;
          updated_at?: string;
          url: string;
        };
        Update: {
          content_status?: string;
          created_at?: string;
          deleted_at?: string | null;
          depth?: number;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          metadata?: Json;
          parent_id?: string | null;
          path?: string;
          position?: number;
          project_id?: string | null;
          scraped_at?: string | null;
          sku_count?: number;
          title?: string | null;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'taxonomy_nodes_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'taxonomy_nodes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'taxonomy_nodes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string | null;
          template_content: string;
          type: string;
          updated_at: string;
          variables: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          organization_id?: string | null;
          template_content: string;
          type: string;
          updated_at?: string;
          variables?: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string | null;
          template_content?: string;
          type?: string;
          updated_at?: string;
          variables?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'templates_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          organization_id: string | null;
          role: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          organization_id?: string | null;
          role?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          organization_id?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      update_updated_at_column: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
