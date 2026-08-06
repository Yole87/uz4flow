/**
 * Prospect / Formulários — domain types
 *
 * These types mirror the tables created in:
 *   supabase/migrations/20260806194600_create_base_formularios.sql
 *
 * They are intentionally kept separate from the auto-generated
 * src/integrations/supabase/types.ts so that they survive
 * type-generation runs without being overwritten.
 */

export interface ProspectSource {
  id: string;
  organization_id: string;
  name: string;
  webhook_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProspectColumn {
  id: string;
  source_id: string;
  /** Must match the Elementor field ID exactly */
  key_name: string;
  /** Display name shown to the tenant */
  label: string;
  col_type: 'text' | 'select';
  select_options: string[];
  col_order: number;
  created_at: string;
}

export interface ProspectLead {
  id: string;
  source_id: string;
  organization_id: string;
  /** Full raw body as received from the webhook */
  raw_data: Record<string, unknown>;
  /** Flat key→value map extracted from raw_data */
  field_data: Record<string, string>;
  /** Set when this lead has been promoted to a CRM contact */
  crm_contact_id: string | null;
  received_at: string;
  updated_at: string;
}
