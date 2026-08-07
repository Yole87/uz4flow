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
      admin_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_notification_config: {
        Row: {
          id: string
          is_configured: boolean
          openbot_api_key_encrypted: string | null
          openbot_base_url: string | null
          openbot_instance_id: string | null
          openbot_token_encrypted: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          is_configured?: boolean
          openbot_api_key_encrypted?: string | null
          openbot_base_url?: string | null
          openbot_instance_id?: string | null
          openbot_token_encrypted?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          is_configured?: boolean
          openbot_api_key_encrypted?: string | null
          openbot_base_url?: string | null
          openbot_instance_id?: string | null
          openbot_token_encrypted?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_notification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: Database["public"]["Enums"]["admin_notif_event"]
          id: string
          payload: Json | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string
          rendered_body: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: Database["public"]["Enums"]["admin_notif_event"]
          id?: string
          payload?: Json | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          rendered_body?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["admin_notif_event"]
          id?: string
          payload?: Json | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          rendered_body?: string | null
          status?: string
        }
        Relationships: []
      }
      admin_notification_recipients: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      admin_notification_rules: {
        Row: {
          enabled: boolean
          event_type: Database["public"]["Enums"]["admin_notif_event"]
          id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          event_type: Database["public"]["Enums"]["admin_notif_event"]
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          event_type?: Database["public"]["Enums"]["admin_notif_event"]
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "admin_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_templates: {
        Row: {
          body: string
          created_at: string
          event_type: Database["public"]["Enums"]["admin_notif_event"]
          id: string
          is_active: boolean
          name: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string
          event_type: Database["public"]["Enums"]["admin_notif_event"]
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["admin_notif_event"]
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string | null
          code: string
          country: string | null
          created_at: string
          id: string
          ip_hash: string | null
          landing_page: string | null
          referer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_id?: string | null
          code: string
          country?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_id?: string | null
          code?: string
          country?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          cancelled_reason: string | null
          commission_amount: number
          commission_percent: number
          created_at: string
          gross_amount: number
          id: string
          paid_at: string | null
          payment_date: string
          payment_id: string | null
          payout_id: string | null
          referral_id: string
          status: Database["public"]["Enums"]["commission_status"]
          subscription_id: string | null
          unlocks_at: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          cancelled_reason?: string | null
          commission_amount: number
          commission_percent: number
          created_at?: string
          gross_amount: number
          id?: string
          paid_at?: string | null
          payment_date?: string
          payment_id?: string | null
          payout_id?: string | null
          referral_id: string
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id?: string | null
          unlocks_at: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          cancelled_reason?: string | null
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          gross_amount?: number
          id?: string
          paid_at?: string | null
          payment_date?: string
          payment_id?: string | null
          payout_id?: string | null
          referral_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id?: string | null
          unlocks_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          admin_notes: string | null
          affiliate_id: string
          bank_holder_document: string | null
          bank_holder_name: string | null
          created_at: string
          id: string
          net_amount: number
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          processed_at: string | null
          proof_url: string | null
          rejection_reason: string | null
          requested_amount: number
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          tax_amount: number
          tax_percent: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          affiliate_id: string
          bank_holder_document?: string | null
          bank_holder_name?: string | null
          created_at?: string
          id?: string
          net_amount: number
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          requested_amount: number
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          tax_amount: number
          tax_percent?: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          affiliate_id?: string
          bank_holder_document?: string | null
          bank_holder_name?: string | null
          created_at?: string
          id?: string
          net_amount?: number
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          requested_amount?: number
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          tax_amount?: number
          tax_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          attribution_expires_at: string
          click_id: string | null
          created_at: string
          current_status: Database["public"]["Enums"]["referral_status"]
          first_payment_at: string | null
          id: string
          plan_id: string | null
          ref_code: string
          referred_org_id: string | null
          referred_user_id: string
          signup_at: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          attribution_expires_at: string
          click_id?: string | null
          created_at?: string
          current_status?: Database["public"]["Enums"]["referral_status"]
          first_payment_at?: string | null
          id?: string
          plan_id?: string | null
          ref_code: string
          referred_org_id?: string | null
          referred_user_id: string
          signup_at?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          attribution_expires_at?: string
          click_id?: string | null
          created_at?: string
          current_status?: Database["public"]["Enums"]["referral_status"]
          first_payment_at?: string | null
          id?: string
          plan_id?: string | null
          ref_code?: string
          referred_org_id?: string | null
          referred_user_id?: string
          signup_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_org_id_fkey"
            columns: ["referred_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_settings: {
        Row: {
          allow_paid_traffic_on_brand: boolean
          allow_self_referral: boolean
          approval_sla_hours: number
          attribution_window_days: number
          commission_type: string
          created_at: string
          current_terms_version: number
          default_commission_percent: number
          grace_period_days: number
          id: string
          kit_url: string | null
          min_payout: number
          payout_day_of_month: number
          payout_processing_hours: number
          program_enabled: boolean
          tax_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_paid_traffic_on_brand?: boolean
          allow_self_referral?: boolean
          approval_sla_hours?: number
          attribution_window_days?: number
          commission_type?: string
          created_at?: string
          current_terms_version?: number
          default_commission_percent?: number
          grace_period_days?: number
          id?: string
          kit_url?: string | null
          min_payout?: number
          payout_day_of_month?: number
          payout_processing_hours?: number
          program_enabled?: boolean
          tax_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_paid_traffic_on_brand?: boolean
          allow_self_referral?: boolean
          approval_sla_hours?: number
          attribution_window_days?: number
          commission_type?: string
          created_at?: string
          current_terms_version?: number
          default_commission_percent?: number
          grace_period_days?: number
          id?: string
          kit_url?: string | null
          min_payout?: number
          payout_day_of_month?: number
          payout_processing_hours?: number
          program_enabled?: boolean
          tax_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      affiliate_settings_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changes: Json
          id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changes: Json
          id?: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          snapshot?: Json
        }
        Relationships: []
      }
      affiliate_terms_versions: {
        Row: {
          body_md: string
          created_by: string | null
          id: string
          published_at: string
          version: number
        }
        Insert: {
          body_md: string
          created_by?: string | null
          id?: string
          published_at?: string
          version: number
        }
        Update: {
          body_md?: string
          created_by?: string | null
          id?: string
          published_at?: string
          version?: number
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_holder_document: string | null
          bank_holder_name: string | null
          bank_name: string | null
          code: string
          commission_percent: number | null
          created_at: string
          id: string
          min_payout: number | null
          organization_id: string | null
          pix_key: string | null
          pix_key_type: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          terms_accepted_at: string | null
          terms_version: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_holder_document?: string | null
          bank_holder_name?: string | null
          bank_name?: string | null
          code: string
          commission_percent?: number | null
          created_at?: string
          id?: string
          min_payout?: number | null
          organization_id?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          terms_accepted_at?: string | null
          terms_version?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_holder_document?: string | null
          bank_holder_name?: string | null
          bank_name?: string | null
          code?: string
          commission_percent?: number | null
          created_at?: string
          id?: string
          min_payout?: number | null
          organization_id?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          terms_accepted_at?: string | null
          terms_version?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_reminders: {
        Row: {
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          description: string
          id: string
          notified_at: string | null
          organization_id: string
          remind_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          description: string
          id?: string
          notified_at?: string | null
          organization_id: string
          remind_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string
          id?: string
          notified_at?: string | null
          organization_id?: string
          remind_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reminders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_reengagement_config: {
        Row: {
          created_at: string
          custom_message: string | null
          delay_minutes: number
          flow_id: string
          id: string
          is_enabled: boolean
          max_attempts: number
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_message?: string | null
          delay_minutes?: number
          flow_id: string
          id?: string
          is_enabled?: boolean
          max_attempts?: number
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_message?: string | null
          delay_minutes?: number
          flow_id?: string
          id?: string
          is_enabled?: boolean
          max_attempts?: number
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reengagement_config_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: true
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reengagement_config_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_reengagement_queue: {
        Row: {
          attempt_count: number
          config_id: string
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          scheduled_for: string
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          config_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          scheduled_for: string
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          config_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          scheduled_for?: string
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reengagement_queue_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "auto_reengagement_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reengagement_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "flow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_message_templates: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          is_active: boolean | null
          label: string
          message_template: string
          send_via_whatsapp: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          label: string
          message_template: string
          send_via_whatsapp?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          label?: string
          message_template?: string
          send_via_whatsapp?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      billing_notifications_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          message_sent: string
          metadata: Json | null
          organization_id: string | null
          phone: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          message_sent: string
          metadata?: Json | null
          organization_id?: string | null
          phone: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          message_sent?: string
          metadata?: Json | null
          organization_id?: string | null
          phone?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_notifications_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_events: {
        Row: {
          connector_id: string | null
          created_at: string
          error_message: string | null
          generated_message: string | null
          id: string
          interaction_results: Json | null
          openbot_response: Json | null
          received_payload: Json
          status: string
          transformed_payload: Json | null
          user_id: string
        }
        Insert: {
          connector_id?: string | null
          created_at?: string
          error_message?: string | null
          generated_message?: string | null
          id?: string
          interaction_results?: Json | null
          openbot_response?: Json | null
          received_payload: Json
          status?: string
          transformed_payload?: Json | null
          user_id: string
        }
        Update: {
          connector_id?: string | null
          created_at?: string
          error_message?: string | null
          generated_message?: string | null
          id?: string
          interaction_results?: Json | null
          openbot_response?: Json | null
          received_payload?: Json
          status?: string
          transformed_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_events_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "webhook_connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_attachments: {
        Row: {
          contact_id: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          organization_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          organization_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          organization_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_attachments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_folder_members: {
        Row: {
          added_at: string
          added_by: string | null
          contact_id: string
          folder_id: string
          id: string
          organization_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          contact_id: string
          folder_id: string
          id?: string
          organization_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          contact_id?: string
          folder_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_folder_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_folder_members_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "contact_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_folder_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_folders: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          icon: string
          id: string
          name: string
          order_index: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          name: string
          order_index?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          name?: string
          order_index?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_import_history: {
        Row: {
          config_jsonb: Json
          created_at: string
          created_count: number
          error_count: number
          errors_jsonb: Json
          file_name: string
          file_size_bytes: number
          finished_at: string | null
          id: string
          mapping_jsonb: Json
          organization_id: string | null
          skipped_count: number
          started_at: string
          status: string
          total_rows: number
          updated_at: string
          updated_count: number
          user_id: string
        }
        Insert: {
          config_jsonb?: Json
          created_at?: string
          created_count?: number
          error_count?: number
          errors_jsonb?: Json
          file_name: string
          file_size_bytes?: number
          finished_at?: string | null
          id?: string
          mapping_jsonb?: Json
          organization_id?: string | null
          skipped_count?: number
          started_at?: string
          status?: string
          total_rows?: number
          updated_at?: string
          updated_count?: number
          user_id: string
        }
        Update: {
          config_jsonb?: Json
          created_at?: string
          created_count?: number
          error_count?: number
          errors_jsonb?: Json
          file_name?: string
          file_size_bytes?: number
          finished_at?: string | null
          id?: string
          mapping_jsonb?: Json
          organization_id?: string | null
          skipped_count?: number
          started_at?: string
          status?: string
          total_rows?: number
          updated_at?: string
          updated_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_import_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          author_user_id: string
          contact_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          note_type: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          contact_id: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          note_type?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          contact_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          note_type?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          ai_analysis: Json | null
          assigned_to_member_id: string | null
          avatar_url: string | null
          channel: string
          created_at: string
          email: string | null
          id: string
          ig_user_scoped_id: string | null
          instance_id: string | null
          is_archived: boolean
          is_blocked: boolean
          last_interaction_at: string | null
          metadata: Json | null
          name: string | null
          organization_id: string
          phone: string | null
          pipeline_stage_id: string | null
          smart_label_keys: string[]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          assigned_to_member_id?: string | null
          avatar_url?: string | null
          channel?: string
          created_at?: string
          email?: string | null
          id?: string
          ig_user_scoped_id?: string | null
          instance_id?: string | null
          is_archived?: boolean
          is_blocked?: boolean
          last_interaction_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id: string
          phone?: string | null
          pipeline_stage_id?: string | null
          smart_label_keys?: string[]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          assigned_to_member_id?: string | null
          avatar_url?: string | null
          channel?: string
          created_at?: string
          email?: string | null
          id?: string
          ig_user_scoped_id?: string | null
          instance_id?: string | null
          is_archived?: boolean
          is_blocked?: boolean
          last_interaction_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id?: string
          phone?: string | null
          pipeline_stage_id?: string | null
          smart_label_keys?: string[]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_member_id_fkey"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "attendance_queue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contacts_assigned_to_member_id_fkey"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_evaluation_configs: {
        Row: {
          created_at: string | null
          custom_prompt: string | null
          eval_frequency: string
          id: string
          instance_id: string | null
          is_enabled: boolean | null
          max_tokens: number | null
          organization_id: string
          silence_minutes: number | null
          updated_at: string | null
          variables: Json | null
          webhook_headers: Json | null
          webhook_method: string | null
          webhook_payload_template: string | null
          webhook_url: string | null
          whatsapp_counter: number
          whatsapp_distribution: string
          whatsapp_enabled: boolean
          whatsapp_phones: string[] | null
        }
        Insert: {
          created_at?: string | null
          custom_prompt?: string | null
          eval_frequency?: string
          id?: string
          instance_id?: string | null
          is_enabled?: boolean | null
          max_tokens?: number | null
          organization_id: string
          silence_minutes?: number | null
          updated_at?: string | null
          variables?: Json | null
          webhook_headers?: Json | null
          webhook_method?: string | null
          webhook_payload_template?: string | null
          webhook_url?: string | null
          whatsapp_counter?: number
          whatsapp_distribution?: string
          whatsapp_enabled?: boolean
          whatsapp_phones?: string[] | null
        }
        Update: {
          created_at?: string | null
          custom_prompt?: string | null
          eval_frequency?: string
          id?: string
          instance_id?: string | null
          is_enabled?: boolean | null
          max_tokens?: number | null
          organization_id?: string
          silence_minutes?: number | null
          updated_at?: string | null
          variables?: Json | null
          webhook_headers?: Json | null
          webhook_method?: string | null
          webhook_payload_template?: string | null
          webhook_url?: string | null
          whatsapp_counter?: number
          whatsapp_distribution?: string
          whatsapp_enabled?: boolean
          whatsapp_phones?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_evaluation_configs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_evaluation_configs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_evaluation_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_evaluations: {
        Row: {
          ai_summary: string | null
          contact_id: string | null
          conversation_id: string
          evaluated_at: string | null
          extracted_data: Json | null
          id: string
          last_message_at_snapshot: string | null
          organization_id: string
          webhook_response: Json | null
          webhook_status: string | null
        }
        Insert: {
          ai_summary?: string | null
          contact_id?: string | null
          conversation_id: string
          evaluated_at?: string | null
          extracted_data?: Json | null
          id?: string
          last_message_at_snapshot?: string | null
          organization_id: string
          webhook_response?: Json | null
          webhook_status?: string | null
        }
        Update: {
          ai_summary?: string | null
          contact_id?: string | null
          conversation_id?: string
          evaluated_at?: string | null
          extracted_data?: Json | null
          id?: string
          last_message_at_snapshot?: string | null
          organization_id?: string
          webhook_response?: Json | null
          webhook_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_evaluations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_evaluations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          contact_id: string
          created_at: string
          dm_window_expires_at: string | null
          id: string
          instance_id: string | null
          last_evaluated_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_sender_type:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          organization_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          contact_id: string
          created_at?: string
          dm_window_expires_at?: string | null
          id?: string
          instance_id?: string | null
          last_evaluated_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          organization_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          contact_id?: string
          created_at?: string
          dm_window_expires_at?: string | null
          id?: string
          instance_id?: string | null
          last_evaluated_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          organization_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_applied: number
          final_price: number
          id: string
          organization_id: string
          original_price: number
          redeemed_at: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_applied: number
          final_price: number
          id?: string
          organization_id: string
          original_price: number
          redeemed_at?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_applied?: number
          final_price?: number
          id?: string
          organization_id?: string
          original_price?: number
          redeemed_at?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_plan_ids: string[] | null
          applies_to: Database["public"]["Enums"]["applies_to"]
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          is_first_purchase: boolean
          max_uses_per_user: number | null
          max_uses_total: number | null
          min_plan_price: number | null
          name: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          applicable_plan_ids?: string[] | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_first_purchase?: boolean
          max_uses_per_user?: number | null
          max_uses_total?: number | null
          min_plan_price?: number | null
          name: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          applicable_plan_ids?: string[] | null
          applies_to?: Database["public"]["Enums"]["applies_to"]
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_first_purchase?: boolean
          max_uses_per_user?: number | null
          max_uses_total?: number | null
          min_plan_price?: number | null
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_openbot_config: {
        Row: {
          created_at: string | null
          id: string
          openbot_api_key_encrypted: string | null
          openbot_send_url: string
          organization_id: string
          updated_at: string | null
          vapi_api_key_encrypted: string | null
          vapi_default_voice: string | null
          vapi_phone_number_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          openbot_api_key_encrypted?: string | null
          openbot_send_url?: string
          organization_id: string
          updated_at?: string | null
          vapi_api_key_encrypted?: string | null
          vapi_default_voice?: string | null
          vapi_phone_number_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          openbot_api_key_encrypted?: string | null
          openbot_send_url?: string
          organization_id?: string
          updated_at?: string | null
          vapi_api_key_encrypted?: string | null
          vapi_default_voice?: string | null
          vapi_phone_number_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_openbot_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          instance_id: string | null
          organization_id: string
          payload: Json
          phone: string | null
          processing_time_ms: number | null
          response: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          instance_id?: string | null
          organization_id: string
          payload?: Json
          phone?: string | null
          processing_time_ms?: number | null
          response?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          instance_id?: string | null
          organization_id?: string
          payload?: Json
          phone?: string | null
          processing_time_ms?: number | null
          response?: Json | null
          status?: string
        }
        Relationships: []
      }
      cron_secrets: {
        Row: {
          id: string
          secret: string
          updated_at: string
        }
        Insert: {
          id: string
          secret: string
          updated_at?: string
        }
        Update: {
          id?: string
          secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_actions: {
        Row: {
          attempt_count: number
          created_at: string
          error_message: string | null
          event_id: string
          id: string
          latency_ms: number | null
          sent_at: string | null
          sent_payload_json: Json | null
          status: string
          step_id: string | null
          step_order: number
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          event_id: string
          id?: string
          latency_ms?: number | null
          sent_at?: string | null
          sent_payload_json?: Json | null
          status?: string
          step_id?: string | null
          step_order: number
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          event_id?: string
          id?: string
          latency_ms?: number | null
          sent_at?: string | null
          sent_payload_json?: Json | null
          status?: string
          step_id?: string | null
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_actions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_actions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          chat_id: string
          chosen_flow_id: string | null
          chosen_rule_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          instance_id: string
          message_id: string
          message_text: string | null
          push_name: string | null
          received_payload_json: Json
          retry_count: number
          status: string
          user_id: string | null
        }
        Insert: {
          chat_id: string
          chosen_flow_id?: string | null
          chosen_rule_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id: string
          message_id: string
          message_text?: string | null
          push_name?: string | null
          received_payload_json: Json
          retry_count?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          chat_id?: string
          chosen_flow_id?: string | null
          chosen_rule_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string
          message_id?: string
          message_text?: string | null
          push_name?: string | null
          received_payload_json?: Json
          retry_count?: number
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_chosen_flow_id_fkey"
            columns: ["chosen_flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_chosen_rule_id_fkey"
            columns: ["chosen_rule_id"]
            isOneToOne: false
            referencedRelation: "routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          organization_id: string | null
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          organization_id?: string | null
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          organization_id?: string | null
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_connections: {
        Row: {
          condition_operator: string | null
          condition_type: string | null
          condition_value: string | null
          condition_variable: string | null
          created_at: string
          flow_id: string
          id: string
          label: string | null
          source_handle: string
          source_step_id: string
          target_step_id: string
        }
        Insert: {
          condition_operator?: string | null
          condition_type?: string | null
          condition_value?: string | null
          condition_variable?: string | null
          created_at?: string
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string
          source_step_id: string
          target_step_id: string
        }
        Update: {
          condition_operator?: string | null
          condition_type?: string | null
          condition_value?: string | null
          condition_variable?: string | null
          created_at?: string
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string
          source_step_id?: string
          target_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_connections_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_connections_source_step_id_fkey"
            columns: ["source_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_connections_target_step_id_fkey"
            columns: ["target_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_sessions: {
        Row: {
          chat_id: string
          collected_data: Json
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          current_step_index: number
          flow_id: string
          id: string
          instance_id: string
          last_activity_at: string
          push_name: string | null
          started_at: string
          status: string
          timeout_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          collected_data?: Json
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          current_step_index?: number
          flow_id: string
          id?: string
          instance_id: string
          last_activity_at?: string
          push_name?: string | null
          started_at?: string
          status?: string
          timeout_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          collected_data?: Json
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          current_step_index?: number
          flow_id?: string
          id?: string
          instance_id?: string
          last_activity_at?: string
          push_name?: string | null
          started_at?: string
          status?: string
          timeout_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_sessions_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_steps: {
        Row: {
          accept_file_response: boolean
          active_message_config: Json | null
          block_contents: Json | null
          condition_config: Json | null
          created_at: string
          delay_config: Json | null
          delay_ms: number
          end_config: Json | null
          file_id: string | null
          flow_id: string
          id: string
          invalid_response_message: string | null
          lane_config: Json | null
          menu_config: Json | null
          order_index: number
          position_x: number | null
          position_y: number | null
          random_config: Json | null
          requires_response: boolean
          step_timeout_minutes: number | null
          step_type: string
          tag_config: Json | null
          text_content: string | null
          updated_at: string
          validation_type: string
          variable_name: string | null
          voice_config: Json | null
        }
        Insert: {
          accept_file_response?: boolean
          active_message_config?: Json | null
          block_contents?: Json | null
          condition_config?: Json | null
          created_at?: string
          delay_config?: Json | null
          delay_ms?: number
          end_config?: Json | null
          file_id?: string | null
          flow_id: string
          id?: string
          invalid_response_message?: string | null
          lane_config?: Json | null
          menu_config?: Json | null
          order_index: number
          position_x?: number | null
          position_y?: number | null
          random_config?: Json | null
          requires_response?: boolean
          step_timeout_minutes?: number | null
          step_type: string
          tag_config?: Json | null
          text_content?: string | null
          updated_at?: string
          validation_type?: string
          variable_name?: string | null
          voice_config?: Json | null
        }
        Update: {
          accept_file_response?: boolean
          active_message_config?: Json | null
          block_contents?: Json | null
          condition_config?: Json | null
          created_at?: string
          delay_config?: Json | null
          delay_ms?: number
          end_config?: Json | null
          file_id?: string | null
          flow_id?: string
          id?: string
          invalid_response_message?: string | null
          lane_config?: Json | null
          menu_config?: Json | null
          order_index?: number
          position_x?: number | null
          position_y?: number | null
          random_config?: Json | null
          requires_response?: boolean
          step_timeout_minutes?: number | null
          step_type?: string
          tag_config?: Json | null
          text_content?: string | null
          updated_at?: string
          validation_type?: string
          variable_name?: string | null
          voice_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_steps_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_voice_pending: {
        Row: {
          attempt_number: number
          completed_at: string | null
          config: Json
          contact_id: string | null
          created_at: string
          dispatched_at: string | null
          flow_session_id: string
          flow_step_id: string
          id: string
          last_error: string | null
          organization_id: string
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          completed_at?: string | null
          config?: Json
          contact_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          flow_session_id: string
          flow_step_id: string
          id?: string
          last_error?: string | null
          organization_id: string
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          config?: Json
          contact_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          flow_session_id?: string
          flow_step_id?: string
          id?: string
          last_error?: string | null
          organization_id?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_voice_pending_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_voice_pending_flow_session_id_fkey"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_voice_pending_flow_step_id_fkey"
            columns: ["flow_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_voice_pending_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_webhooks: {
        Row: {
          created_at: string | null
          description: string | null
          flow_id: string
          headers: Json | null
          http_method: string | null
          id: string
          is_enabled: boolean | null
          payload_template: string
          updated_at: string | null
          user_id: string
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          flow_id: string
          headers?: Json | null
          http_method?: string | null
          id?: string
          is_enabled?: boolean | null
          payload_template?: string
          updated_at?: string | null
          user_id: string
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          flow_id?: string
          headers?: Json | null
          http_method?: string | null
          id?: string
          is_enabled?: boolean | null
          payload_template?: string
          updated_at?: string | null
          user_id?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_webhooks_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: true
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_interactive: boolean
          name: string
          schedule_config: Json | null
          schedule_enabled: boolean
          schedule_type: string | null
          session_timeout_minutes: number
          timeout_action: string
          timeout_message: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_interactive?: boolean
          name: string
          schedule_config?: Json | null
          schedule_enabled?: boolean
          schedule_type?: string | null
          session_timeout_minutes?: number
          timeout_action?: string
          timeout_message?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_interactive?: boolean
          name?: string
          schedule_config?: Json | null
          schedule_enabled?: boolean
          schedule_type?: string | null
          session_timeout_minutes?: number
          timeout_action?: string
          timeout_message?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      followup_templates: {
        Row: {
          call_reason: string | null
          created_at: string
          flow_id: string | null
          id: string
          instance_id: string | null
          name: string
          organization_id: string
          script_content: string | null
          updated_at: string
          webhook_enabled: boolean
          whatsapp_followup_enabled: boolean
          whatsapp_followup_text: string | null
        }
        Insert: {
          call_reason?: string | null
          created_at?: string
          flow_id?: string | null
          id?: string
          instance_id?: string | null
          name: string
          organization_id: string
          script_content?: string | null
          updated_at?: string
          webhook_enabled?: boolean
          whatsapp_followup_enabled?: boolean
          whatsapp_followup_text?: string | null
        }
        Update: {
          call_reason?: string | null
          created_at?: string
          flow_id?: string | null
          id?: string
          instance_id?: string | null
          name?: string
          organization_id?: string
          script_content?: string | null
          updated_at?: string
          webhook_enabled?: boolean
          whatsapp_followup_enabled?: boolean
          whatsapp_followup_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_templates_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_account_instances: {
        Row: {
          account_id: string
          created_at: string
          id: string
          instance_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          instance_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_account_instances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_account_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_account_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          access_token_encrypted: string
          created_at: string
          id: string
          ig_user_id: string
          organization_id: string
          page_id: string
          profile_picture_url: string | null
          scopes: string | null
          token_expires_at: string | null
          token_status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          id?: string
          ig_user_id: string
          organization_id: string
          page_id: string
          profile_picture_url?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          token_status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          id?: string
          ig_user_id?: string
          organization_id?: string
          page_id?: string
          profile_picture_url?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          token_status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_action_logs: {
        Row: {
          action_index: number | null
          action_type: string
          automation_id: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          human_summary: string | null
          id: string
          latency_ms: number | null
          organization_id: string | null
          request_json: Json | null
          response_json: Json | null
          session_id: string | null
          status: string
        }
        Insert: {
          action_index?: number | null
          action_type: string
          automation_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          human_summary?: string | null
          id?: string
          latency_ms?: number | null
          organization_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          session_id?: string | null
          status?: string
        }
        Update: {
          action_index?: number | null
          action_type?: string
          automation_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          human_summary?: string | null
          id?: string
          latency_ms?: number | null
          organization_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_action_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "instagram_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_action_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "instagram_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_action_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_action_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "instagram_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_app_config: {
        Row: {
          app_id: string | null
          app_secret_encrypted: string | null
          app_secret_masked: string | null
          created_at: string
          embedded_login_url: string | null
          id: string
          is_configured: boolean
          organization_id: string
          redirect_uri: string | null
          updated_at: string
          webhook_verify_token: string | null
        }
        Insert: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          app_secret_masked?: string | null
          created_at?: string
          embedded_login_url?: string | null
          id?: string
          is_configured?: boolean
          organization_id: string
          redirect_uri?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Update: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          app_secret_masked?: string | null
          created_at?: string
          embedded_login_url?: string | null
          id?: string
          is_configured?: boolean
          organization_id?: string
          redirect_uri?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_app_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_automations: {
        Row: {
          account_id: string | null
          created_at: string
          definition_json: Json
          description: string | null
          execution_count: number
          id: string
          is_enabled: boolean
          last_executed_at: string | null
          name: string
          organization_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          definition_json?: Json
          description?: string | null
          execution_count?: number
          id?: string
          is_enabled?: boolean
          last_executed_at?: string | null
          name: string
          organization_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          definition_json?: Json
          description?: string | null
          execution_count?: number
          id?: string
          is_enabled?: boolean
          last_executed_at?: string | null
          name?: string
          organization_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_automations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_events: {
        Row: {
          account_id: string | null
          error_message: string | null
          event_hash: string | null
          event_type: string
          id: string
          organization_id: string | null
          payload_json: Json
          processed_at: string | null
          received_at: string
          status: string
        }
        Insert: {
          account_id?: string | null
          error_message?: string | null
          event_hash?: string | null
          event_type: string
          id?: string
          organization_id?: string | null
          payload_json?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          account_id?: string | null
          error_message?: string | null
          event_hash?: string | null
          event_type?: string
          id?: string
          organization_id?: string | null
          payload_json?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          organization_id: string
          payload_json: Json | null
          reference_id: string | null
          run_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number
          organization_id: string
          payload_json?: Json | null
          reference_id?: string | null
          run_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number
          organization_id?: string
          payload_json?: Json | null
          reference_id?: string | null
          run_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_leads: {
        Row: {
          automation_id: string | null
          created_at: string
          email: string | null
          id: string
          ig_handle: string | null
          ig_name: string | null
          ig_user_scoped_id: string
          metadata: Json
          organization_id: string
          origin: string | null
          phone_normalized: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ig_handle?: string | null
          ig_name?: string | null
          ig_user_scoped_id: string
          metadata?: Json
          organization_id: string
          origin?: string | null
          phone_normalized?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ig_handle?: string | null
          ig_name?: string | null
          ig_user_scoped_id?: string
          metadata?: Json
          organization_id?: string
          origin?: string | null
          phone_normalized?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_leads_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "instagram_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_sessions: {
        Row: {
          account_id: string | null
          automation_id: string | null
          context_json: Json
          created_at: string
          current_step_index: number
          expires_at: string
          id: string
          ig_user_scoped_id: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          automation_id?: string | null
          context_json?: Json
          created_at?: string
          current_step_index?: number
          expires_at: string
          id?: string
          ig_user_scoped_id: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          automation_id?: string | null
          context_json?: Json
          created_at?: string
          current_step_index?: number
          expires_at?: string
          id?: string
          ig_user_scoped_id?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_sessions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "instagram_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          api_key_encrypted: string | null
          api_url: string | null
          channel: string
          created_at: string
          id: string
          instagram_account_id: string | null
          meta_phone_number_id: string | null
          name: string
          openbot_api_key_encrypted: string | null
          openbot_instance_id: string | null
          organization_id: string
          phone_number: string | null
          provider: Database["public"]["Enums"]["whatsapp_provider"]
          qr_code: string | null
          status: Database["public"]["Enums"]["instance_status"]
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_url?: string | null
          channel?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          meta_phone_number_id?: string | null
          name: string
          openbot_api_key_encrypted?: string | null
          openbot_instance_id?: string | null
          organization_id: string
          phone_number?: string | null
          provider?: Database["public"]["Enums"]["whatsapp_provider"]
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"]
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_url?: string | null
          channel?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          meta_phone_number_id?: string | null
          name?: string
          openbot_api_key_encrypted?: string | null
          openbot_instance_id?: string | null
          organization_id?: string
          phone_number?: string | null
          provider?: Database["public"]["Enums"]["whatsapp_provider"]
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"]
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instances_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          openbot_api_key_encrypted: string | null
          openbot_api_key_masked: string | null
          openbot_inbound_url: string | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          openbot_api_key_encrypted?: string | null
          openbot_api_key_masked?: string | null
          openbot_inbound_url?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          openbot_api_key_encrypted?: string | null
          openbot_api_key_masked?: string | null
          openbot_inbound_url?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      lead_rotation_config: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          is_random: boolean
          keyword_filter: string | null
          last_assigned_member_id: string | null
          organization_id: string
          target_pipeline_id: string | null
          team_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_random?: boolean
          keyword_filter?: string | null
          last_assigned_member_id?: string | null
          organization_id: string
          target_pipeline_id?: string | null
          team_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_random?: boolean
          keyword_filter?: string | null
          last_assigned_member_id?: string | null
          organization_id?: string
          target_pipeline_id?: string | null
          team_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_rotation_config_last_assigned_member_id_fkey"
            columns: ["last_assigned_member_id"]
            isOneToOne: false
            referencedRelation: "attendance_queue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "lead_rotation_config_last_assigned_member_id_fkey"
            columns: ["last_assigned_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rotation_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rotation_config_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rotation_config_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_connections: {
        Row: {
          access_token: string | null
          access_token_encrypted: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          organization_id: string
          provider: string
          refresh_token: string | null
          refresh_token_encrypted: string | null
          scopes: string | null
          token_expiry: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_encrypted?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          provider: string
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string | null
          token_expiry?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_encrypted?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          provider?: string
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string | null
          token_expiry?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_configs: {
        Row: {
          auth_token: string | null
          auth_type: string
          created_at: string
          custom_headers: Json | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          server_url: string
          tool_name: string
          updated_at: string
        }
        Insert: {
          auth_token?: string | null
          auth_type?: string
          created_at?: string
          custom_headers?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          server_url: string
          tool_name: string
          updated_at?: string
        }
        Update: {
          auth_token?: string | null
          auth_type?: string
          created_at?: string
          custom_headers?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          server_url?: string
          tool_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          content_type: Database["public"]["Enums"]["message_content_type"]
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          media_mime_type: string | null
          media_url: string | null
          message_id_external: string | null
          metadata: Json | null
          openbot_message_id: string | null
          organization_id: string | null
          sender_name: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"] | null
          status: Database["public"]["Enums"]["message_status"]
          timestamp: string
        }
        Insert: {
          content?: string | null
          content_type?: Database["public"]["Enums"]["message_content_type"]
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_id_external?: string | null
          metadata?: Json | null
          openbot_message_id?: string | null
          organization_id?: string | null
          sender_name?: string | null
          sender_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          status?: Database["public"]["Enums"]["message_status"]
          timestamp?: string
        }
        Update: {
          content?: string | null
          content_type?: Database["public"]["Enums"]["message_content_type"]
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_id_external?: string | null
          metadata?: Json | null
          openbot_message_id?: string | null
          organization_id?: string | null
          sender_name?: string | null
          sender_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          status?: Database["public"]["Enums"]["message_status"]
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_conversation_windows: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          is_from_campaign: boolean
          last_customer_message_at: string
          window_expires_at: string
          window_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          is_from_campaign?: boolean
          last_customer_message_at: string
          window_expires_at: string
          window_type?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_from_campaign?: boolean
          last_customer_message_at?: string
          window_expires_at?: string
          window_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_conversation_windows_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_templates: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string
          template_language: string
          template_message: string | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id: string
          template_language?: string
          template_message?: string | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string
          template_language?: string
          template_message?: string | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_ai_configs: {
        Row: {
          created_at: string
          default_model: string
          gemini_api_key_encrypted: string | null
          id: string
          is_active: boolean
          openai_api_key_encrypted: string | null
          organization_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_model?: string
          gemini_api_key_encrypted?: string | null
          id?: string
          is_active?: boolean
          openai_api_key_encrypted?: string | null
          organization_id: string
          provider?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_model?: string
          gemini_api_key_encrypted?: string | null
          id?: string
          is_active?: boolean
          openai_api_key_encrypted?: string | null
          organization_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_ai_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_storage_usage: {
        Row: {
          created_at: string
          file_count: number
          id: string
          last_calculated_at: string | null
          organization_id: string
          updated_at: string
          used_bytes: number
        }
        Insert: {
          created_at?: string
          file_count?: number
          id?: string
          last_calculated_at?: string | null
          organization_id: string
          updated_at?: string
          used_bytes?: number
        }
        Update: {
          created_at?: string
          file_count?: number
          id?: string
          last_calculated_at?: string | null
          organization_id?: string
          updated_at?: string
          used_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_storage_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          block_reason: string | null
          blocked_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          message_signature_enabled: boolean
          name: string
          notes: string | null
          owner_user_id: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          block_reason?: string | null
          blocked_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          message_signature_enabled?: boolean
          name: string
          notes?: string | null
          owner_user_id: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          block_reason?: string | null
          blocked_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          message_signature_enabled?: boolean
          name?: string
          notes?: string | null
          owner_user_id?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_webhook_logs: {
        Row: {
          amount: number | null
          created_at: string
          error_message: string | null
          event_action: string | null
          event_type: string
          id: string
          mp_id: string | null
          organization_id: string | null
          organization_name: string | null
          payer_email: string | null
          processed: boolean
          raw_payload: Json | null
          status: string | null
          status_detail: string | null
          status_detail_description: string | null
          subscription_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          error_message?: string | null
          event_action?: string | null
          event_type: string
          id?: string
          mp_id?: string | null
          organization_id?: string | null
          organization_name?: string | null
          payer_email?: string | null
          processed?: boolean
          raw_payload?: Json | null
          status?: string | null
          status_detail?: string | null
          status_detail_description?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          error_message?: string | null
          event_action?: string | null
          event_type?: string
          id?: string
          mp_id?: string | null
          organization_id?: string | null
          organization_name?: string | null
          payer_email?: string | null
          processed?: boolean
          raw_payload?: Json | null
          status?: string | null
          status_detail?: string | null
          status_detail_description?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_keyword_rules: {
        Row: {
          apply_on: string
          created_at: string
          id: string
          instance_id: string | null
          is_active: boolean
          keyword: string
          match_mode: string
          organization_id: string
          priority: number
          target_pipeline_id: string
          target_stage_id: string
          updated_at: string
        }
        Insert: {
          apply_on?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean
          keyword: string
          match_mode?: string
          organization_id: string
          priority?: number
          target_pipeline_id: string
          target_stage_id: string
          updated_at?: string
        }
        Update: {
          apply_on?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean
          keyword?: string
          match_mode?: string
          organization_id?: string
          priority?: number
          target_pipeline_id?: string
          target_stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_keyword_rules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_keyword_rules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_keyword_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_keyword_rules_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_keyword_rules_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_change_log: {
        Row: {
          change_source: string
          changed_by_user_id: string | null
          created_at: string
          from_billing_cycle: string | null
          from_plan_id: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          reason: string | null
          to_billing_cycle: string | null
          to_plan_id: string | null
        }
        Insert: {
          change_source?: string
          changed_by_user_id?: string | null
          created_at?: string
          from_billing_cycle?: string | null
          from_plan_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          reason?: string | null
          to_billing_cycle?: string | null
          to_plan_id?: string | null
        }
        Update: {
          change_source?: string
          changed_by_user_id?: string | null
          created_at?: string
          from_billing_cycle?: string | null
          from_plan_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          reason?: string | null
          to_billing_cycle?: string | null
          to_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_log_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_log_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          force_password_change: boolean | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          force_password_change?: boolean | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          force_password_change?: boolean | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prospect_columns: {
        Row: {
          col_order: number
          col_type: string
          created_at: string
          id: string
          key_name: string
          label: string
          select_options: Json
          source_id: string
        }
        Insert: {
          col_order?: number
          col_type?: string
          created_at?: string
          id?: string
          key_name: string
          label: string
          select_options?: Json
          source_id: string
        }
        Update: {
          col_order?: number
          col_type?: string
          created_at?: string
          id?: string
          key_name?: string
          label?: string
          select_options?: Json
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_columns_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "prospect_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_leads: {
        Row: {
          crm_contact_id: string | null
          field_data: Json
          id: string
          organization_id: string
          raw_data: Json
          received_at: string
          source_id: string
          updated_at: string
        }
        Insert: {
          crm_contact_id?: string | null
          field_data?: Json
          id?: string
          organization_id: string
          raw_data?: Json
          received_at?: string
          source_id: string
          updated_at?: string
        }
        Update: {
          crm_contact_id?: string | null
          field_data?: Json
          id?: string
          organization_id?: string
          raw_data?: Json
          received_at?: string
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "prospect_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_providers: {
        Row: {
          active_provider: string | null
          block_count: number | null
          browserless_api_key_encrypted: string | null
          browserless_api_key_masked: string | null
          browserless_configured: boolean | null
          browserless_last_test_at: string | null
          created_at: string
          firecrawl_api_key_encrypted: string | null
          firecrawl_api_key_masked: string | null
          firecrawl_configured: boolean | null
          firecrawl_last_test_at: string | null
          google_api_key_encrypted: string | null
          google_api_key_masked: string | null
          google_configured: boolean | null
          google_cse_id_encrypted: string | null
          google_cse_id_masked: string | null
          google_last_test_at: string | null
          google_places_api_key_encrypted: string | null
          google_places_api_key_masked: string | null
          google_places_configured: boolean | null
          google_places_last_test_at: string | null
          id: string
          last_block_detected_at: string | null
          organization_id: string
          preferred_provider: string | null
          updated_at: string
          use_residential_proxy: boolean | null
          use_stealth_mode: boolean | null
        }
        Insert: {
          active_provider?: string | null
          block_count?: number | null
          browserless_api_key_encrypted?: string | null
          browserless_api_key_masked?: string | null
          browserless_configured?: boolean | null
          browserless_last_test_at?: string | null
          created_at?: string
          firecrawl_api_key_encrypted?: string | null
          firecrawl_api_key_masked?: string | null
          firecrawl_configured?: boolean | null
          firecrawl_last_test_at?: string | null
          google_api_key_encrypted?: string | null
          google_api_key_masked?: string | null
          google_configured?: boolean | null
          google_cse_id_encrypted?: string | null
          google_cse_id_masked?: string | null
          google_last_test_at?: string | null
          google_places_api_key_encrypted?: string | null
          google_places_api_key_masked?: string | null
          google_places_configured?: boolean | null
          google_places_last_test_at?: string | null
          id?: string
          last_block_detected_at?: string | null
          organization_id: string
          preferred_provider?: string | null
          updated_at?: string
          use_residential_proxy?: boolean | null
          use_stealth_mode?: boolean | null
        }
        Update: {
          active_provider?: string | null
          block_count?: number | null
          browserless_api_key_encrypted?: string | null
          browserless_api_key_masked?: string | null
          browserless_configured?: boolean | null
          browserless_last_test_at?: string | null
          created_at?: string
          firecrawl_api_key_encrypted?: string | null
          firecrawl_api_key_masked?: string | null
          firecrawl_configured?: boolean | null
          firecrawl_last_test_at?: string | null
          google_api_key_encrypted?: string | null
          google_api_key_masked?: string | null
          google_configured?: boolean | null
          google_cse_id_encrypted?: string | null
          google_cse_id_masked?: string | null
          google_last_test_at?: string | null
          google_places_api_key_encrypted?: string | null
          google_places_api_key_masked?: string | null
          google_places_configured?: boolean | null
          google_places_last_test_at?: string | null
          id?: string
          last_block_detected_at?: string | null
          organization_id?: string
          preferred_provider?: string | null
          updated_at?: string
          use_residential_proxy?: boolean | null
          use_stealth_mode?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_results: {
        Row: {
          address: string | null
          ai_analysis: Json | null
          ai_score: number | null
          business_name: string | null
          created_at: string
          email: string | null
          has_whatsapp: boolean | null
          id: string
          imported_at: string | null
          imported_to_contact_id: string | null
          organization_id: string
          phone: string | null
          provider_place_id: string | null
          raw_data: Json | null
          search_id: string
          social_urls: Json | null
          source_url: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_analysis?: Json | null
          ai_score?: number | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          has_whatsapp?: boolean | null
          id?: string
          imported_at?: string | null
          imported_to_contact_id?: string | null
          organization_id: string
          phone?: string | null
          provider_place_id?: string | null
          raw_data?: Json | null
          search_id: string
          social_urls?: Json | null
          source_url?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_analysis?: Json | null
          ai_score?: number | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          has_whatsapp?: boolean | null
          id?: string
          imported_at?: string | null
          imported_to_contact_id?: string | null
          organization_id?: string
          phone?: string | null
          provider_place_id?: string | null
          raw_data?: Json | null
          search_id?: string
          social_urls?: Json | null
          source_url?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_results_imported_to_contact_id_fkey"
            columns: ["imported_to_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "prospect_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_searches: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          instance_id: string | null
          keyword: string
          location: string | null
          organization_id: string
          provider_used: string
          social_networks: string[] | null
          status: string | null
          total_results: number | null
          whatsapp_only: boolean | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string | null
          keyword: string
          location?: string | null
          organization_id: string
          provider_used: string
          social_networks?: string[] | null
          status?: string | null
          total_results?: number | null
          whatsapp_only?: boolean | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string | null
          keyword?: string
          location?: string | null
          organization_id?: string
          provider_used?: string
          social_networks?: string[] | null
          status?: string | null
          total_results?: number | null
          whatsapp_only?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_searches_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_searches_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          applies_to_all_instances: boolean
          category: string | null
          content: string | null
          created_at: string
          created_by: string
          file_name: string | null
          file_size: number | null
          id: string
          media_type: string
          media_url: string | null
          mime_type: string | null
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          applies_to_all_instances?: boolean
          category?: string | null
          content?: string | null
          created_at?: string
          created_by: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          media_type?: string
          media_url?: string | null
          mime_type?: string | null
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          applies_to_all_instances?: boolean
          category?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          media_type?: string
          media_url?: string | null
          mime_type?: string | null
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_reply_instances: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          quick_reply_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          quick_reply_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          quick_reply_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_reply_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_instances_quick_reply_id_fkey"
            columns: ["quick_reply_id"]
            isOneToOne: false
            referencedRelation: "quick_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      routing_rules: {
        Row: {
          created_at: string
          flow_id: string
          id: string
          instance_id: string | null
          is_active: boolean
          match_type: string
          match_value: string | null
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flow_id: string
          id?: string
          instance_id?: string | null
          is_active?: boolean
          match_type: string
          match_value?: string | null
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flow_id?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean
          match_type?: string
          match_value?: string | null
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          contact_id: string
          content: string | null
          conversation_id: string
          created_at: string
          created_by: string
          error_message: string | null
          file_name: string | null
          id: string
          instance_id: string | null
          media_type: string | null
          media_url: string | null
          mime_type: string | null
          organization_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          content?: string | null
          conversation_id: string
          created_at?: string
          created_by: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          instance_id?: string | null
          media_type?: string | null
          media_url?: string | null
          mime_type?: string | null
          organization_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          content?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          instance_id?: string | null
          media_type?: string | null
          media_url?: string | null
          mime_type?: string | null
          organization_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_responses: {
        Row: {
          created_at: string
          file_id: string | null
          id: string
          is_valid: boolean
          received_at: string
          response_text: string | null
          response_type: string
          session_id: string
          step_id: string | null
          step_index: number
          validation_error: string | null
          variable_name: string
        }
        Insert: {
          created_at?: string
          file_id?: string | null
          id?: string
          is_valid?: boolean
          received_at?: string
          response_text?: string | null
          response_type?: string
          session_id: string
          step_id?: string | null
          step_index: number
          validation_error?: string | null
          variable_name: string
        }
        Update: {
          created_at?: string
          file_id?: string | null
          id?: string
          is_valid?: boolean
          received_at?: string
          response_text?: string | null
          response_type?: string
          session_id?: string
          step_id?: string | null
          step_index?: number
          validation_error?: string | null
          variable_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_responses_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_responses_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_labels: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          order_index: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          order_index?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          order_index?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          pipeline_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          pipeline_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          pipeline_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          mp_payment_id: string | null
          mp_payment_method: string | null
          mp_payment_type: string | null
          organization_id: string
          paid_at: string | null
          refunded_amount: number
          status: string | null
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_payment_method?: string | null
          mp_payment_type?: string | null
          organization_id: string
          paid_at?: string | null
          refunded_amount?: number
          status?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_payment_method?: string | null
          mp_payment_type?: string | null
          organization_id?: string
          paid_at?: string | null
          refunded_amount?: number
          status?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_cycle: string | null
          created_at: string | null
          description: string | null
          highlight_label: string | null
          id: string
          is_active: boolean | null
          is_free: boolean | null
          is_popular: boolean | null
          is_public: boolean | null
          limits: Json | null
          mp_plan_id: string | null
          name: string
          price: number
          price_quarterly: number | null
          price_semiannual: number | null
          price_yearly: number | null
          sort_order: number | null
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          highlight_label?: string | null
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          is_popular?: boolean | null
          is_public?: boolean | null
          limits?: Json | null
          mp_plan_id?: string | null
          name: string
          price?: number
          price_quarterly?: number | null
          price_semiannual?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          highlight_label?: string | null
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          is_popular?: boolean | null
          is_public?: boolean | null
          limits?: Json | null
          mp_plan_id?: string | null
          name?: string
          price?: number
          price_quarterly?: number | null
          price_semiannual?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string | null
          cancelled_at: string | null
          chargeback_count: number
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          expiration_warning_sent: boolean | null
          id: string
          mp_payer_id: string | null
          mp_subscription_id: string | null
          organization_id: string
          overdue_since: string | null
          payment_warning_sent: boolean | null
          plan_id: string
          status: string | null
          total_refunded: number
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          chargeback_count?: number
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          expiration_warning_sent?: boolean | null
          id?: string
          mp_payer_id?: string | null
          mp_subscription_id?: string | null
          organization_id: string
          overdue_since?: string | null
          payment_warning_sent?: boolean | null
          plan_id: string
          status?: string | null
          total_refunded?: number
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          chargeback_count?: number
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          expiration_warning_sent?: boolean | null
          id?: string
          mp_payer_id?: string | null
          mp_subscription_id?: string | null
          organization_id?: string
          overdue_since?: string | null
          payment_warning_sent?: boolean | null
          plan_id?: string
          status?: string | null
          total_refunded?: number
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_instances: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_instances_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "attendance_queue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_member_instances_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          deactivation_reason: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          last_seen_at: string | null
          organization_id: string
          reactivation_date: string | null
          signature_format: string
          silent_mode: boolean
          team_profile_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deactivation_reason?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name?: string
          last_seen_at?: string | null
          organization_id: string
          reactivation_date?: string | null
          signature_format?: string
          silent_mode?: boolean
          team_profile_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deactivation_reason?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          last_seen_at?: string | null
          organization_id?: string
          reactivation_date?: string | null
          signature_format?: string
          silent_mode?: boolean
          team_profile_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_profiles: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          permissions: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          permissions?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          permissions?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_records: {
        Row: {
          activated_at: string
          created_at: string
          email: string
          id: string
          ip_address: string | null
          organization_id: string
          plan_id: string
          trial_end_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          organization_id: string
          plan_id: string
          trial_end_at: string
          user_id: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          plan_id?: string
          trial_end_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_records_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
          slug: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          slug?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          slug?: string | null
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          difficulty: string
          doc_link: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean
          module_slug: string | null
          order_index: number
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          youtube_video_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          doc_link?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          module_slug?: string | null
          order_index?: number
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          youtube_video_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          doc_link?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          module_slug?: string | null
          order_index?: number
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tutorial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          quantity: number | null
          resource_type: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          quantity?: number | null
          resource_type: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          quantity?: number | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_summary: {
        Row: {
          connectors_count: number | null
          created_at: string | null
          events_count: number | null
          flows_count: number | null
          id: string
          organization_id: string
          period_end: string
          period_start: string
          rules_count: number | null
          storage_used_mb: number | null
          templates_count: number | null
          updated_at: string | null
        }
        Insert: {
          connectors_count?: number | null
          created_at?: string | null
          events_count?: number | null
          flows_count?: number | null
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          rules_count?: number | null
          storage_used_mb?: number | null
          templates_count?: number | null
          updated_at?: string | null
        }
        Update: {
          connectors_count?: number | null
          created_at?: string | null
          events_count?: number | null
          flows_count?: number | null
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          rules_count?: number | null
          storage_used_mb?: number | null
          templates_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_summary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          completed_at: string | null
          created_at: string | null
          dismissed_checklist: boolean
          id: string
          skipped_at: string | null
          started_at: string
          steps: Json
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          dismissed_checklist?: boolean
          id?: string
          skipped_at?: string | null
          started_at?: string
          steps?: Json
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          dismissed_checklist?: boolean
          id?: string
          skipped_at?: string | null
          started_at?: string
          steps?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visual_scrape_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_phase: string | null
          current_screenshot: string | null
          current_url: string | null
          error_message: string | null
          id: string
          keyword: string
          last_activity_at: string
          location: string | null
          max_results: number | null
          metrics: Json | null
          organization_id: string
          progress_percent: number | null
          status: string
          total_found: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_phase?: string | null
          current_screenshot?: string | null
          current_url?: string | null
          error_message?: string | null
          id?: string
          keyword: string
          last_activity_at?: string
          location?: string | null
          max_results?: number | null
          metrics?: Json | null
          organization_id: string
          progress_percent?: number | null
          status?: string
          total_found?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_phase?: string | null
          current_screenshot?: string | null
          current_url?: string | null
          error_message?: string | null
          id?: string
          keyword?: string
          last_activity_at?: string
          location?: string | null
          max_results?: number | null
          metrics?: Json | null
          organization_id?: string
          progress_percent?: number | null
          status?: string
          total_found?: number
        }
        Relationships: [
          {
            foreignKeyName: "visual_scrape_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_calls: {
        Row: {
          assistant_config: Json | null
          call_reason: string | null
          call_type: string
          campaign_id: string | null
          contact_id: string
          conversation_id: string | null
          cost_cents: number | null
          created_at: string
          customer_action: string | null
          duration_seconds: number | null
          ended_reason: string | null
          flow_attempt_number: number | null
          flow_outcome: string | null
          flow_session_id: string | null
          flow_step_id: string | null
          id: string
          next_attempt_at: string | null
          organization_id: string
          recording_url: string | null
          script_content: string | null
          status: string
          summary: string | null
          transcript: string | null
          updated_at: string
          vapi_call_id: string | null
          webhook_url: string | null
          whatsapp_followup_enabled: boolean | null
          whatsapp_followup_file_url: string | null
          whatsapp_followup_sent: boolean | null
          whatsapp_followup_text: string | null
        }
        Insert: {
          assistant_config?: Json | null
          call_reason?: string | null
          call_type?: string
          campaign_id?: string | null
          contact_id: string
          conversation_id?: string | null
          cost_cents?: number | null
          created_at?: string
          customer_action?: string | null
          duration_seconds?: number | null
          ended_reason?: string | null
          flow_attempt_number?: number | null
          flow_outcome?: string | null
          flow_session_id?: string | null
          flow_step_id?: string | null
          id?: string
          next_attempt_at?: string | null
          organization_id: string
          recording_url?: string | null
          script_content?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
          vapi_call_id?: string | null
          webhook_url?: string | null
          whatsapp_followup_enabled?: boolean | null
          whatsapp_followup_file_url?: string | null
          whatsapp_followup_sent?: boolean | null
          whatsapp_followup_text?: string | null
        }
        Update: {
          assistant_config?: Json | null
          call_reason?: string | null
          call_type?: string
          campaign_id?: string | null
          contact_id?: string
          conversation_id?: string | null
          cost_cents?: number | null
          created_at?: string
          customer_action?: string | null
          duration_seconds?: number | null
          ended_reason?: string | null
          flow_attempt_number?: number | null
          flow_outcome?: string | null
          flow_session_id?: string | null
          flow_step_id?: string | null
          id?: string
          next_attempt_at?: string | null
          organization_id?: string
          recording_url?: string | null
          script_content?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
          vapi_call_id?: string | null
          webhook_url?: string | null
          whatsapp_followup_enabled?: boolean | null
          whatsapp_followup_file_url?: string | null
          whatsapp_followup_sent?: boolean | null
          whatsapp_followup_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_flow_session_id_fkey"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_flow_step_id_fkey"
            columns: ["flow_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_campaign_contacts: {
        Row: {
          attempted_at: string | null
          campaign_id: string
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          name: string | null
          phone: string | null
          scheduled_for: string | null
          status: string
          voice_call_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          scheduled_for?: string | null
          status?: string
          voice_call_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          scheduled_for?: string | null
          status?: string
          voice_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_campaign_contacts_voice_call_id_fkey"
            columns: ["voice_call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_campaigns: {
        Row: {
          assistant_config: Json | null
          batch_size: number
          call_mode: string
          call_reason: string | null
          call_type: string
          calling_mode: string
          completed_calls: number
          created_at: string
          failed_calls: number
          flow_id: string | null
          id: string
          instance_id: string | null
          name: string
          organization_id: string
          scheduled_at: string | null
          script_content: string | null
          status: string
          template_id: string | null
          total_contacts: number
          updated_at: string
          webhook_enabled: boolean
          webhook_url: string | null
          whatsapp_followup_enabled: boolean
          whatsapp_followup_file_name: string | null
          whatsapp_followup_file_size: number | null
          whatsapp_followup_file_url: string | null
          whatsapp_followup_text: string | null
        }
        Insert: {
          assistant_config?: Json | null
          batch_size?: number
          call_mode?: string
          call_reason?: string | null
          call_type?: string
          calling_mode?: string
          completed_calls?: number
          created_at?: string
          failed_calls?: number
          flow_id?: string | null
          id?: string
          instance_id?: string | null
          name: string
          organization_id: string
          scheduled_at?: string | null
          script_content?: string | null
          status?: string
          template_id?: string | null
          total_contacts?: number
          updated_at?: string
          webhook_enabled?: boolean
          webhook_url?: string | null
          whatsapp_followup_enabled?: boolean
          whatsapp_followup_file_name?: string | null
          whatsapp_followup_file_size?: number | null
          whatsapp_followup_file_url?: string | null
          whatsapp_followup_text?: string | null
        }
        Update: {
          assistant_config?: Json | null
          batch_size?: number
          call_mode?: string
          call_reason?: string | null
          call_type?: string
          calling_mode?: string
          completed_calls?: number
          created_at?: string
          failed_calls?: number
          flow_id?: string | null
          id?: string
          instance_id?: string | null
          name?: string
          organization_id?: string
          scheduled_at?: string | null
          script_content?: string | null
          status?: string
          template_id?: string | null
          total_contacts?: number
          updated_at?: string
          webhook_enabled?: boolean
          webhook_url?: string | null
          whatsapp_followup_enabled?: boolean
          whatsapp_followup_file_name?: string | null
          whatsapp_followup_file_size?: number | null
          whatsapp_followup_file_url?: string | null
          whatsapp_followup_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_campaigns_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_connectors: {
        Row: {
          created_at: string
          description: string | null
          field_mappings: Json | null
          id: string
          interactions: Json | null
          is_active: boolean
          message_config: Json | null
          name: string
          sample_payload: Json | null
          source_type: string
          target_phone_field: string | null
          updated_at: string
          user_id: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_mappings?: Json | null
          id?: string
          interactions?: Json | null
          is_active?: boolean
          message_config?: Json | null
          name: string
          sample_payload?: Json | null
          source_type?: string
          target_phone_field?: string | null
          updated_at?: string
          user_id: string
          webhook_token: string
        }
        Update: {
          created_at?: string
          description?: string | null
          field_mappings?: Json | null
          id?: string
          interactions?: Json | null
          is_active?: boolean
          message_config?: Json | null
          name?: string
          sample_payload?: Json | null
          source_type?: string
          target_phone_field?: string | null
          updated_at?: string
          user_id?: string
          webhook_token?: string
        }
        Relationships: []
      }
    }
    Views: {
      attendance_queue_view: {
        Row: {
          active_conversations: number | null
          avg_wait_minutes: number | null
          department: string | null
          is_active: boolean | null
          last_activity_at: string | null
          last_seen_at: string | null
          member_id: string | null
          member_name: string | null
          organization_id: string | null
          pending_response: number | null
          role_title: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instances_safe: {
        Row: {
          api_url: string | null
          channel: string | null
          created_at: string | null
          has_api_key: boolean | null
          has_openbot_api_key: boolean | null
          id: string | null
          meta_phone_number_id: string | null
          name: string | null
          openbot_instance_id: string | null
          organization_id: string | null
          phone_number: string | null
          provider: Database["public"]["Enums"]["whatsapp_provider"] | null
          qr_code: string | null
          status: Database["public"]["Enums"]["instance_status"] | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_url?: string | null
          channel?: string | null
          created_at?: string | null
          has_api_key?: never
          has_openbot_api_key?: never
          id?: string | null
          meta_phone_number_id?: string | null
          name?: string | null
          openbot_instance_id?: string | null
          organization_id?: string | null
          phone_number?: string | null
          provider?: Database["public"]["Enums"]["whatsapp_provider"] | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"] | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_url?: string | null
          channel?: string | null
          created_at?: string | null
          has_api_key?: never
          has_openbot_api_key?: never
          id?: string | null
          meta_phone_number_id?: string | null
          name?: string | null
          openbot_instance_id?: string | null
          organization_id?: string | null
          phone_number?: string | null
          provider?: Database["public"]["Enums"]["whatsapp_provider"] | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"] | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_connections_safe: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          organization_id: string | null
          provider: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          organization_id?: string | null
          provider?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          organization_id?: string | null
          provider?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_dashboard_messages_agg: {
        Args: { p_end: string; p_org_id?: string; p_start: string }
        Returns: {
          conversation_count: number
          day: string
          msg_count: number
          organization_id: string
        }[]
      }
      cleanup_expired_messages: { Args: never; Returns: Json }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      generate_affiliate_code: { Args: never; Returns: string }
      get_cron_secret: { Args: never; Returns: string }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_organization_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_master: { Args: never; Returns: boolean }
      is_affiliate: { Args: { _user_id: string }; Returns: boolean }
      is_organization_active: { Args: { _org_id: string }; Returns: boolean }
      is_organization_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      notify_admin_async: {
        Args: { p_event_type: string; p_variables: Json }
        Returns: undefined
      }
      notify_trial_expirations: { Args: never; Returns: Json }
      process_affiliate_payment: {
        Args: {
          p_gross_amount: number
          p_payment_id: string
          p_payment_status: string
          p_subscription_id: string
          p_user_id: string
        }
        Returns: Json
      }
      process_webhook_init: {
        Args: {
          p_chat_id: string
          p_instance_id: string
          p_message_id: string
          p_message_text: string
          p_payload: Json
          p_push_name: string
          p_user_id: string
        }
        Returns: Json
      }
      recalculate_org_storage: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      release_grace_commissions: { Args: never; Returns: Json }
      seed_default_smart_labels: {
        Args: { _org_id: string }
        Returns: undefined
      }
      update_member_last_seen: {
        Args: { _member_id: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_notif_event:
        | "signup_free"
        | "free_plan_expiring"
        | "upgrade_free_to_paid"
        | "plan_change"
        | "payment_received"
        | "cancel_refund"
        | "cancel_unpaid"
        | "affiliate_signup_request"
        | "affiliate_new_referral"
        | "affiliate_payout_request"
        | "delivery_callback"
      affiliate_status: "pending" | "approved" | "rejected" | "suspended"
      app_role: "admin_master" | "admin" | "user"
      applies_to: "all_plans" | "specific_plans"
      commission_status: "pending_grace" | "available" | "paid" | "cancelled"
      conversation_status: "active" | "archived" | "closed"
      discount_type: "percentage" | "fixed_amount"
      instance_status: "disconnected" | "connecting" | "connected" | "qr_code"
      message_content_type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "sticker"
        | "location"
        | "voice_call"
      message_direction: "inbound" | "outbound"
      message_sender_type: "customer" | "ia" | "attendant"
      message_status: "pending" | "sent" | "delivered" | "read" | "failed"
      payout_status: "requested" | "processing" | "paid" | "rejected"
      referral_status:
        | "signup"
        | "trial"
        | "active"
        | "cancelled"
        | "expired_window"
      whatsapp_provider: "baileys" | "meta_official" | "instagram_dm"
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
      admin_notif_event: [
        "signup_free",
        "free_plan_expiring",
        "upgrade_free_to_paid",
        "plan_change",
        "payment_received",
        "cancel_refund",
        "cancel_unpaid",
        "affiliate_signup_request",
        "affiliate_new_referral",
        "affiliate_payout_request",
        "delivery_callback",
      ],
      affiliate_status: ["pending", "approved", "rejected", "suspended"],
      app_role: ["admin_master", "admin", "user"],
      applies_to: ["all_plans", "specific_plans"],
      commission_status: ["pending_grace", "available", "paid", "cancelled"],
      conversation_status: ["active", "archived", "closed"],
      discount_type: ["percentage", "fixed_amount"],
      instance_status: ["disconnected", "connecting", "connected", "qr_code"],
      message_content_type: [
        "text",
        "image",
        "audio",
        "video",
        "document",
        "sticker",
        "location",
        "voice_call",
      ],
      message_direction: ["inbound", "outbound"],
      message_sender_type: ["customer", "ia", "attendant"],
      message_status: ["pending", "sent", "delivered", "read", "failed"],
      payout_status: ["requested", "processing", "paid", "rejected"],
      referral_status: [
        "signup",
        "trial",
        "active",
        "cancelled",
        "expired_window",
      ],
      whatsapp_provider: ["baileys", "meta_official", "instagram_dm"],
    },
  },
} as const
