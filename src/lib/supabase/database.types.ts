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
          status: "rascunho" | "ativo" | "encerrado";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          details?: string | null;
          status?: "rascunho" | "ativo" | "encerrado";
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string;
          details?: string | null;
          status?: "rascunho" | "ativo" | "encerrado";
          created_by?: string;
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
        Relationships: [];
      };
      participants: {
        Row: {
          id: string;
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
          issued_by: string;
          pdf_url: string | null;
          issued_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          event_day_id: string;
          issued_by: string;
          pdf_url?: string | null;
          issued_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          event_day_id?: string;
          issued_by?: string;
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
