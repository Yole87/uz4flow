export type UzFormFieldType = 'name' | 'email' | 'phone' | 'short_text' | 'long_text' | 'date' | 'multiple_choice' | 'select_list' | 'file_upload' | 'address' | 'cpf' | 'cnpj';
export type UzFormMediaType = 'none' | 'image' | 'youtube';

export interface UzForm {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  token: string;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UzFormStep {
  id: string;
  form_id: string;
  step_order: number;
  title: string | null;
  description: string | null;
  media_type: UzFormMediaType;
  media_url: string | null;
  created_at: string;
  updated_at: string;
  fields?: UzFormField[];
}

export interface UzFormFieldOption {
  label: string;
  next_step_id?: string; // if set, selecting this option jumps to that step
}

export interface UzFormField {
  id: string;
  step_id: string;
  field_type: UzFormFieldType;
  label: string;
  key_name: string;
  is_required: boolean;
  options: UzFormFieldOption[];
  field_order: number;
  created_at: string;
}

export interface UzFormResponse {
  id: string;
  form_id: string;
  organization_id: string;
  response_data: Record<string, string>;
  submitted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface UzFormWithSteps extends UzForm {
  steps: UzFormStep[];
}

export type UzFormWatermarkMode = 'platform' | 'custom' | 'tenant_choice';

export type UzFormEndingType = 'thank_you' | 'whatsapp' | 'both' | 'purchase' | 'calendar';

export interface UzFormProduct {
  id: string;              // UUID generated on creation
  title: string;
  subtitle?: string;
  image_url?: string;
  cta_text: string;        // button label
  cta_link: string;        // button URL
  price_from?: string;     // "De: R$X"
  price_to?: string;       // "Por: R$Y"
  is_highlighted?: boolean; // badge de destaque
  badge_text?: string;     // text inside the badge
}

/** Keys stored inside `uz_forms.settings` (jsonb). */
export interface UzFormSettings {
  ending_type?: UzFormEndingType;
  ending_message?: string;
  ending_whatsapp_number?: string;
  ending_whatsapp_message?: string;
  /** Only used when the plan watermark mode is 'tenant_choice'. */
  watermark_text?: string;

  // Purchase ending
  purchase_products?: UzFormProduct[];
  purchase_countdown_to?: string;
  purchase_title?: string;
  purchase_subtitle?: string;

  // Calendar booking ending
  calendar_organization_id?: string;
  calendar_availability_start?: string; // "09:00"
  calendar_availability_end?: string;   // "18:00"
  calendar_available_days?: number[];   // [1,2,3,4,5] = Mon-Fri
  calendar_slot_duration?: number;      // minutes
  calendar_advance_hours?: number;      // minimum hours in advance
  calendar_title?: string;
  calendar_pre_fill_name_key?: string;
  calendar_pre_fill_email_key?: string;
  calendar_pre_fill_phone_key?: string;

  // Tracking
  meta_pixel_id?: string;
  meta_pixel_event?: "Lead" | "InitiateCheckout";
  gtag_conversion_id?: string;    // e.g. "AW-123456789"
  gtag_conversion_label?: string; // e.g. "AbCdEfGhIjKlMn"
  gtag_event?: "generate_lead" | "begin_checkout";

  [key: string]: unknown;
}

/** Payload returned by the public `get_public_form` database function. */
export interface PublicUzForm extends UzFormWithSteps {
  /** Watermark mode defined by the organization's plan (super admin controlled). */
  watermark_mode: UzFormWatermarkMode;
  /** Watermark text defined by the organization's plan (used when mode is 'custom'). */
  watermark_text: string;
}

/** Normalizes options from legacy string[] or new UzFormFieldOption[] format */
export function normalizeOptions(raw: unknown[]): UzFormFieldOption[] {
  return raw.map((o) =>
    typeof o === "string" ? { label: o } : (o as UzFormFieldOption)
  );
}
