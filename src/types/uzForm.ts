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

export interface UzFormField {
  id: string;
  step_id: string;
  field_type: UzFormFieldType;
  label: string;
  key_name: string;
  is_required: boolean;
  options: string[];
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
