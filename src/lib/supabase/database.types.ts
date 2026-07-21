export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          role: "super_adm" | "organizador" | "recepcao" | "expositor";
          status: "active" | "inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "super_adm" | "organizador" | "recepcao" | "expositor";
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "super_adm" | "organizador" | "recepcao" | "expositor";
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          name: string;
          location: string;
          details: string | null;
          status: "rascunho" | "ativo" | "encerrado" | "arquivado";
          archived_at: string | null;
          archived_by: string | null;
          event_logo_path: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          details?: string | null;
          status?: "rascunho" | "ativo" | "encerrado" | "arquivado";
          archived_at?: string | null;
          archived_by?: string | null;
          event_logo_path?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string;
          details?: string | null;
          status?: "rascunho" | "ativo" | "encerrado" | "arquivado";
          archived_at?: string | null;
          archived_by?: string | null;
          event_logo_path?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_certificate_settings: {
        Row: {
          event_id: string;
          background_path: string | null;
          sponsor_image_path: string | null;
          layout: Json;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          background_path?: string | null;
          sponsor_image_path?: string | null;
          layout?: Json;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          background_path?: string | null;
          sponsor_image_path?: string | null;
          layout?: Json;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_days: {
        Row: {
          id: string;
          event_id: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          date?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_days_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      participants: {
        Row: {
          id: string;
          participant_number: number;
          full_name: string;
          document_type: string;
          document_number: string;
          email: string;
          phone: string;
          state: string;
          city: string;
          profession: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          participant_number?: number;
          full_name: string;
          document_type: string;
          document_number: string;
          email: string;
          phone: string;
          state: string;
          city: string;
          profession: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          document_type?: string;
          document_number?: string;
          email?: string;
          phone?: string;
          state?: string;
          city?: string;
          profession?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_registrations: {
        Row: {
          id: string;
          participant_id: string;
          event_day_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          event_day_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          event_day_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      entry_checkins: {
        Row: {
          id: string;
          participant_id: string;
          event_day_id: string;
          operator_user_id: string;
          origin: string;
          checked_in_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          participant_id: string;
          event_day_id: string;
          operator_user_id: string;
          origin?: string;
          checked_in_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Update: {
          id?: string;
          participant_id?: string;
          event_day_id?: string;
          operator_user_id?: string;
          origin?: string;
          checked_in_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Relationships: [];
      };
      exhibitor_companies: {
        Row: {
          id: string;
          name: string;
          trade_name: string | null;
          legal_name: string | null;
          cnpj: string | null;
          phone: string | null;
          email: string | null;
          contact_name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          trade_name?: string | null;
          legal_name?: string | null;
          cnpj?: string | null;
          phone?: string | null;
          email?: string | null;
          contact_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          trade_name?: string | null;
          legal_name?: string | null;
          cnpj?: string | null;
          phone?: string | null;
          email?: string | null;
          contact_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_exhibitors: {
        Row: {
          id: string;
          event_id: string;
          exhibitor_company_id: string;
          stand_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          exhibitor_company_id: string;
          stand_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          exhibitor_company_id?: string;
          stand_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exhibitor_users: {
        Row: {
          id: string;
          user_id: string;
          exhibitor_company_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exhibitor_company_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exhibitor_company_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      stand_checkins: {
        Row: {
          id: string;
          participant_id: string;
          event_day_id: string;
          event_exhibitor_id: string;
          operator_user_id: string;
          checked_in_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          participant_id: string;
          event_day_id: string;
          event_exhibitor_id: string;
          operator_user_id: string;
          checked_in_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Update: {
          id?: string;
          participant_id?: string;
          event_day_id?: string;
          event_exhibitor_id?: string;
          operator_user_id?: string;
          checked_in_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Relationships: [];
      };
      raffles: {
        Row: {
          id: string;
          event_day_id: string;
          prize_description: string;
          winners_count: number;
          executed_at: string | null;
          executed_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_day_id: string;
          prize_description: string;
          winners_count?: number;
          executed_at?: string | null;
          executed_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_day_id?: string;
          prize_description?: string;
          winners_count?: number;
          executed_at?: string | null;
          executed_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      raffle_winners: {
        Row: {
          id: string;
          raffle_id: string;
          participant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          raffle_id: string;
          participant_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          raffle_id?: string;
          participant_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      badges: {
        Row: {
          id: string;
          participant_id: string;
          event_id: string;
          qr_slug: string;
          pdf_url: string | null;
          generated_by: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          event_id: string;
          qr_slug: string;
          pdf_url?: string | null;
          generated_by: string;
          generated_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          event_id?: string;
          qr_slug?: string;
          pdf_url?: string | null;
          generated_by?: string;
          generated_at?: string;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          id: string;
          participant_id: string;
          event_day_id: string;
          issued_by: string | null;
          pdf_url: string | null;
          issued_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          event_day_id: string;
          issued_by?: string | null;
          pdf_url?: string | null;
          issued_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          event_day_id?: string;
          issued_by?: string | null;
          pdf_url?: string | null;
          issued_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          context: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          context?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          context?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_public_registration_rate_limit: {
        Args: {
          p_event_id: string;
          p_fingerprint_hash: string;
          p_limit?: number;
          p_window_seconds?: number;
        };
        Returns: boolean;
      };
      list_global_participants: {
        Args: {
          p_search?: string;
          p_event_id?: string;
          p_city?: string;
          p_profession?: string;
          p_last_checkin_from?: string;
          p_last_checkin_to?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          participant_id: string;
          participant_number: number;
          full_name: string;
          document_type: string;
          document_number: string;
          email: string;
          phone: string;
          state: string;
          city: string;
          profession: string;
          event_count: number;
          entry_checkin_count: number;
          last_checkin_at: string | null;
          total_count: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
