export interface Database {
  public: {
    Tables: {
      google_integrations: {
        Row: {
          id: string;
          user_id: string;
          google_id: string;
          email: string;
          access_token: string;
          refresh_token: string | null;
          expires_at: string;
          scopes: string;
          profile: {
            name?: string;
            picture?: string;
            given_name?: string;
            family_name?: string;
            locale?: string;
          } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_id: string;
          email: string;
          access_token: string;
          refresh_token?: string | null;
          expires_at: string;
          scopes: string;
          profile?: {
            name?: string;
            picture?: string;
            given_name?: string;
            family_name?: string;
            locale?: string;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          google_id?: string;
          email?: string;
          access_token?: string;
          refresh_token?: string | null;
          expires_at?: string;
          scopes?: string;
          profile?: {
            name?: string;
            picture?: string;
            given_name?: string;
            family_name?: string;
            locale?: string;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          old_values: any | null;
          new_values: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          old_values?: any | null;
          new_values?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          old_values?: any | null;
          new_values?: any | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}