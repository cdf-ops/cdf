export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      brevo_templates: {
        Row: {
          template_id: number;
          name: string;
          subject: string;
          sender_name: string | null;
          sender_email: string | null;
          reply_to: string | null;
          tag: string | null;
          is_active: boolean;
          brevo_created_at: string | null;
          brevo_modified_at: string | null;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          template_id: number;
          name: string;
          subject: string;
          sender_name?: string | null;
          sender_email?: string | null;
          reply_to?: string | null;
          tag?: string | null;
          is_active?: boolean;
          brevo_created_at?: string | null;
          brevo_modified_at?: string | null;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          template_id?: number;
          name?: string;
          subject?: string;
          sender_name?: string | null;
          sender_email?: string | null;
          reply_to?: string | null;
          tag?: string | null;
          is_active?: boolean;
          brevo_created_at?: string | null;
          brevo_modified_at?: string | null;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_delivery_jobs: {
        Row: {
          id: string;
          event_id: string;
          participant_id: string;
          communication_type: "registration_confirmation";
          recipient_email: string;
          template_id: number;
          contact_attributes: Json;
          idempotency_key: string;
          status:
            | "pending"
            | "processing"
            | "accepted"
            | "delivered"
            | "retryable_failed"
            | "permanent_failed"
            | "cancelled";
          attempt_count: number;
          next_attempt_at: string | null;
          locked_at: string | null;
          locked_by: string | null;
          brevo_contact_id: number | null;
          brevo_message_id: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          processing_started_at: string | null;
          accepted_at: string | null;
          delivered_at: string | null;
          failed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          participant_id: string;
          communication_type?: "registration_confirmation";
          recipient_email: string;
          template_id: number;
          contact_attributes?: Json;
          idempotency_key: string;
          status?:
            | "pending"
            | "processing"
            | "accepted"
            | "delivered"
            | "retryable_failed"
            | "permanent_failed"
            | "cancelled";
          attempt_count?: number;
          next_attempt_at?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          brevo_contact_id?: number | null;
          brevo_message_id?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          processing_started_at?: string | null;
          accepted_at?: string | null;
          delivered_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_delivery_jobs"]["Insert"]>;
        Relationships: [];
      };
      email_delivery_events: {
        Row: {
          id: string;
          job_id: string | null;
          brevo_message_id: string;
          event_type: string;
          deduplication_key: string;
          occurred_at: string | null;
          payload: Json;
          received_at: string;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          brevo_message_id: string;
          event_type: string;
          deduplication_key: string;
          occurred_at?: string | null;
          payload: Json;
          received_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_delivery_events"]["Insert"]>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          role: "super_adm" | "organizador" | "recepcao" | "expositor";
          status: "active" | "inactive";
          password_change_required: boolean;
          temporary_password_issued_at: string | null;
          temporary_password_issued_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "super_adm" | "organizador" | "recepcao" | "expositor";
          status?: "active" | "inactive";
          password_change_required?: boolean;
          temporary_password_issued_at?: string | null;
          temporary_password_issued_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "super_adm" | "organizador" | "recepcao" | "expositor";
          status?: "active" | "inactive";
          password_change_required?: boolean;
          temporary_password_issued_at?: string | null;
          temporary_password_issued_by?: string | null;
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
          raffle_sponsor_banner_path: string | null;
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
          raffle_sponsor_banner_path?: string | null;
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
          raffle_sponsor_banner_path?: string | null;
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
      event_brevo_settings: {
        Row: {
          event_id: string;
          registration_confirmation_enabled: boolean;
          registration_template_id: number | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          registration_confirmation_enabled?: boolean;
          registration_template_id?: number | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          registration_confirmation_enabled?: boolean;
          registration_template_id?: number | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_badge_settings: {
        Row: {
          event_id: string;
          city_label: string | null;
          primary_color: string;
          secondary_color: string;
          institutional_text: string | null;
          schedule_text: string | null;
          social_url: string | null;
          facebook_label: string | null;
          instagram_label: string | null;
          youtube_label: string | null;
          certificate_url: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          city_label?: string | null;
          primary_color?: string;
          secondary_color?: string;
          institutional_text?: string | null;
          schedule_text?: string | null;
          social_url?: string | null;
          facebook_label?: string | null;
          instagram_label?: string | null;
          youtube_label?: string | null;
          certificate_url?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          city_label?: string | null;
          primary_color?: string;
          secondary_color?: string;
          institutional_text?: string | null;
          schedule_text?: string | null;
          social_url?: string | null;
          facebook_label?: string | null;
          instagram_label?: string | null;
          youtube_label?: string | null;
          certificate_url?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_exhibitor_badge_settings: {
        Row: {
          event_id: string;
          city_label: string | null;
          primary_color: string;
          secondary_color: string;
          front_label: string;
          social_heading: string;
          company_heading: string;
          institutional_text: string | null;
          schedule_heading: string;
          schedule_text: string | null;
          social_url: string | null;
          facebook_label: string | null;
          instagram_label: string | null;
          youtube_label: string | null;
          show_job_title: boolean;
          show_event_logo: boolean;
          show_social_qr: boolean;
          company_logo_size: "small" | "medium" | "large";
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          city_label?: string | null;
          primary_color?: string;
          secondary_color?: string;
          front_label?: string;
          social_heading?: string;
          company_heading?: string;
          institutional_text?: string | null;
          schedule_heading?: string;
          schedule_text?: string | null;
          social_url?: string | null;
          facebook_label?: string | null;
          instagram_label?: string | null;
          youtube_label?: string | null;
          show_job_title?: boolean;
          show_event_logo?: boolean;
          show_social_qr?: boolean;
          company_logo_size?: "small" | "medium" | "large";
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          city_label?: string | null;
          primary_color?: string;
          secondary_color?: string;
          front_label?: string;
          social_heading?: string;
          company_heading?: string;
          institutional_text?: string | null;
          schedule_heading?: string;
          schedule_text?: string | null;
          social_url?: string | null;
          facebook_label?: string | null;
          instagram_label?: string | null;
          youtube_label?: string | null;
          show_job_title?: boolean;
          show_event_logo?: boolean;
          show_social_qr?: boolean;
          company_logo_size?: "small" | "medium" | "large";
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
      participant_event_consents: {
        Row: {
          event_id: string;
          participant_id: string;
          exhibitor_data_sharing: boolean;
          consent_version: string;
          consent_text: string;
          source: "public_registration" | "legacy_registration" | "admin";
          recorded_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          participant_id: string;
          exhibitor_data_sharing: boolean;
          consent_version: string;
          consent_text: string;
          source: "public_registration" | "legacy_registration" | "admin";
          recorded_at?: string;
          updated_at?: string;
        };
        Update: {
          exhibitor_data_sharing?: boolean;
          consent_version?: string;
          consent_text?: string;
          source?: "public_registration" | "legacy_registration" | "admin";
          recorded_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_exhibitor_data_settings: {
        Row: {
          event_id: string;
          share_email: boolean;
          share_phone: boolean;
          share_profession: boolean;
          share_city: boolean;
          share_state: boolean;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          share_email?: boolean;
          share_phone?: boolean;
          share_profession?: boolean;
          share_city?: boolean;
          share_state?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          share_email?: boolean;
          share_phone?: boolean;
          share_profession?: boolean;
          share_city?: boolean;
          share_state?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
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
          logo_path: string | null;
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
          logo_path?: string | null;
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
          logo_path?: string | null;
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
          status: "active" | "suspended";
          access_validated_at: string;
          access_valid_until: string;
          access_validated_by: string | null;
          emergency_access_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exhibitor_company_id: string;
          status?: "active" | "suspended";
          access_validated_at?: string;
          access_valid_until?: string;
          access_validated_by?: string | null;
          emergency_access_until?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exhibitor_company_id?: string;
          status?: "active" | "suspended";
          access_validated_at?: string;
          access_valid_until?: string;
          access_validated_by?: string | null;
          emergency_access_until?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exhibitor_team_members: {
        Row: {
          id: string;
          exhibitor_company_id: string;
          full_name: string;
          job_title: string | null;
          linked_user_id: string | null;
          status: "active" | "inactive";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exhibitor_company_id: string;
          full_name: string;
          job_title?: string | null;
          linked_user_id?: string | null;
          status?: "active" | "inactive";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exhibitor_company_id?: string;
          full_name?: string;
          job_title?: string | null;
          linked_user_id?: string | null;
          status?: "active" | "inactive";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exhibitor_credentials: {
        Row: {
          id: string;
          event_exhibitor_id: string;
          team_member_id: string;
          category: "expositor" | "organizacao" | "palestrante" | "imprensa" | "convidado";
          status: "active" | "cancelled";
          generated_at: string;
          generated_by: string | null;
          last_printed_at: string | null;
          last_printed_by: string | null;
          print_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_exhibitor_id: string;
          team_member_id: string;
          category?: "expositor" | "organizacao" | "palestrante" | "imprensa" | "convidado";
          status?: "active" | "cancelled";
          generated_at?: string;
          generated_by?: string | null;
          last_printed_at?: string | null;
          last_printed_by?: string | null;
          print_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_exhibitor_id?: string;
          team_member_id?: string;
          category?: "expositor" | "organizacao" | "palestrante" | "imprensa" | "convidado";
          status?: "active" | "cancelled";
          generated_at?: string;
          generated_by?: string | null;
          last_printed_at?: string | null;
          last_printed_by?: string | null;
          print_count?: number;
          created_at?: string;
          updated_at?: string;
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
          generated_by: string | null;
          generated_at: string;
          download_slug: string;
          print_count: number;
          last_printed_at: string | null;
          last_printed_by: string | null;
        };
        Insert: {
          id?: string;
          participant_id: string;
          event_id: string;
          qr_slug: string;
          pdf_url?: string | null;
          generated_by?: string | null;
          generated_at?: string;
          download_slug: string;
          print_count?: number;
          last_printed_at?: string | null;
          last_printed_by?: string | null;
        };
        Update: {
          id?: string;
          participant_id?: string;
          event_id?: string;
          qr_slug?: string;
          pdf_url?: string | null;
          generated_by?: string | null;
          generated_at?: string;
          download_slug?: string;
          print_count?: number;
          last_printed_at?: string | null;
          last_printed_by?: string | null;
        };
        Relationships: [];
      };
      webhook_settings: {
        Row: {
          id: string;
          event_type: "registration.completed" | "credential.generated" | "checkin.completed";
          webhook_url: string;
          enabled: boolean;
          signing_secret: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_type: "registration.completed" | "credential.generated" | "checkin.completed";
          webhook_url: string;
          enabled?: boolean;
          signing_secret?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_type?: "registration.completed" | "credential.generated" | "checkin.completed";
          webhook_url?: string;
          enabled?: boolean;
          signing_secret?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
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
      claim_email_delivery_jobs: {
        Args: {
          p_worker_id: string;
          p_limit?: number;
          p_lock_seconds?: number;
        };
        Returns: {
          job_id: string;
          event_id: string;
          participant_id: string;
          recipient_email: string;
          template_id: number;
          contact_attributes: Json;
          attempt_number: number;
        }[];
      };
      complete_email_delivery_job: {
        Args: {
          p_job_id: string;
          p_worker_id: string;
          p_outcome: string;
          p_n8n_execution_id?: string | null;
          p_brevo_contact_id?: number | null;
          p_brevo_message_id?: string | null;
          p_response_status?: number | null;
          p_error_code?: string | null;
          p_error_message?: string | null;
          p_retry_at?: string | null;
        };
        Returns: string;
      };
      enqueue_registration_confirmation: {
        Args: {
          p_event_id: string;
          p_participant_id: string;
          p_recipient_email: string;
          p_contact_attributes: Json;
        };
        Returns: string | null;
      };
      sync_brevo_templates: {
        Args: {
          p_templates: Json;
          p_deactivate_missing?: boolean;
        };
        Returns: number;
      };
      record_brevo_delivery_event: {
        Args: {
          p_message_id: string;
          p_event_type: string;
          p_deduplication_key: string;
          p_occurred_at: string | null;
          p_payload: Json;
        };
        Returns: string;
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
