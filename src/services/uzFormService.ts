/**
 * Uz Form Service
 *
 * Data-access layer for the Uz Forms module.
 * Covers: uz_forms, uz_form_steps, uz_form_fields, uz_form_responses.
 *
 * Conventions followed:
 *  - Import supabase from "@/integrations/supabase/client"
 *  - Cast untyped tables with `as any` (tables not yet in generated types)
 *  - Re-throw Supabase errors directly (callers handle UI feedback)
 *  - No UI logic, no toasts — this is a pure data layer
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  UzForm,
  UzFormStep,
  UzFormField,
  UzFormResponse,
  UzFormWithSteps,
} from "@/types/uzForm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a URL-safe, unique slug from a name:
 * Lowercase, normalize accents/special chars, replace spaces with hyphens, and append 4 random digits.
 */
function slugify(name: string): string {
  let base = name
    .toLowerCase()
    .normalize("NFD") // split accents from letters
    .replace(/[\u0300-\u036f]/g, "") // remove accent marks
    .replace(/[^a-z0-9\s-]/g, "") // remove special chars
    .trim()
    .replace(/\s+/g, "-") // replace spaces with hyphens
    .replace(/-+/g, "-"); // merge multiple hyphens

  if (!base) {
    base = "form";
  }

  const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4 random digits
  return `${base}-${randomDigits}`;
}

// ─── Forms CRUD ──────────────────────────────────────────────────────────────

/**
 * List all active forms for an organization, newest first.
 */
export async function getForms(organizationId: string): Promise<UzForm[]> {
  const { data, error } = await supabase
    .from("uz_forms" as any)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as UzForm[];
}

/**
 * List soft-deleted forms for an organization, ordered by deletion date.
 */
export async function getDeletedForms(organizationId: string): Promise<UzForm[]> {
  const { data, error } = await supabase
    .from("uz_forms" as any)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_deleted", true)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as UzForm[];
}

/**
 * Create a new form with auto-generated slug.
 */
export async function createForm(organizationId: string, name: string): Promise<UzForm> {
  const slug = slugify(name);
  const { data, error } = await supabase
    .from("uz_forms" as any)
    .insert({
      organization_id: organizationId,
      name,
      slug,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as UzForm;
}

/**
 * Update partial details of a form.
 */
export async function updateForm(
  id: string,
  data: Partial<Pick<UzForm, "name" | "slug" | "is_active" | "settings">>,
): Promise<UzForm> {
  const { data: updatedData, error } = await supabase
    .from("uz_forms" as any)
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return updatedData as unknown as UzForm;
}

/**
 * Soft-delete a form by marking is_deleted = true.
 */
export async function softDeleteForm(id: string): Promise<void> {
  const { error } = await supabase
    .from("uz_forms" as any)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Restore a soft-deleted form, resetting deletion status and making it inactive.
 */
export async function restoreForm(id: string): Promise<void> {
  const { error } = await supabase
    .from("uz_forms" as any)
    .update({
      is_deleted: false,
      deleted_at: null,
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Permanently delete a form from the database.
 */
export async function permanentDeleteForm(id: string): Promise<void> {
  const { error } = await supabase
    .from("uz_forms" as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ─── Steps CRUD ──────────────────────────────────────────────────────────────

/**
 * Fetch all steps for a form, including their fields, sorted by order.
 */
export async function getFormSteps(formId: string): Promise<UzFormStep[]> {
  const { data, error } = await supabase
    .from("uz_form_steps" as any)
    .select("*, fields:uz_form_fields(*)")
    .eq("form_id", formId)
    .order("step_order", { ascending: true });

  if (error) throw error;

  const steps = (data ?? []) as unknown as UzFormStep[];

  // Sort fields by field_order inside each step
  for (const step of steps) {
    if (step.fields) {
      step.fields.sort((a, b) => a.field_order - b.field_order);
    }
  }

  return steps;
}

/**
 * Create a new step for a form.
 */
export async function createStep(formId: string, stepOrder: number): Promise<UzFormStep> {
  const { data, error } = await supabase
    .from("uz_form_steps" as any)
    .insert({
      form_id: formId,
      step_order: stepOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as UzFormStep;
}

/**
 * Update step details.
 */
export async function updateStep(
  id: string,
  data: Partial<Pick<UzFormStep, "title" | "description" | "media_type" | "media_url" | "step_order">>,
): Promise<UzFormStep> {
  const { data: updatedData, error } = await supabase
    .from("uz_form_steps" as any)
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return updatedData as unknown as UzFormStep;
}

/**
 * Delete a step.
 */
export async function deleteStep(id: string): Promise<void> {
  const { error } = await supabase
    .from("uz_form_steps" as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Sequential reordering of steps.
 */
export async function reorderSteps(
  updates: { id: string; step_order: number }[],
): Promise<void> {
  for (const { id, step_order } of updates) {
    const { error } = await supabase
      .from("uz_form_steps" as any)
      .update({
        step_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  }
}

// ─── Fields CRUD ─────────────────────────────────────────────────────────────

/**
 * Create a new field in a step.
 */
export async function createField(
  stepId: string,
  field: Omit<UzFormField, "id" | "created_at">,
): Promise<UzFormField> {
  const { data, error } = await supabase
    .from("uz_form_fields" as any)
    .insert({
      step_id: stepId,
      field_type: field.field_type,
      label: field.label,
      key_name: field.key_name,
      is_required: field.is_required,
      options: field.options,
      field_order: field.field_order,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as UzFormField;
}

/**
 * Update field details.
 */
export async function updateField(
  id: string,
  data: Partial<Omit<UzFormField, "id" | "step_id" | "created_at">>,
): Promise<UzFormField> {
  const { data: updatedData, error } = await supabase
    .from("uz_form_fields" as any)
    .update(data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return updatedData as unknown as UzFormField;
}

/**
 * Delete a field.
 */
export async function deleteField(id: string): Promise<void> {
  const { error } = await supabase
    .from("uz_form_fields" as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Sequential reordering of fields.
 */
export async function reorderFields(
  updates: { id: string; field_order: number }[],
): Promise<void> {
  for (const { id, field_order } of updates) {
    const { error } = await supabase
      .from("uz_form_fields" as any)
      .update({ field_order })
      .eq("id", id);

    if (error) throw error;
  }
}

// ─── Responses ───────────────────────────────────────────────────────────────

/**
 * Fetch a paginated page of responses for a form, ordered newest first.
 */
export async function getFormResponses(
  formId: string,
  page: number,
  pageSize: number,
): Promise<{ data: UzFormResponse[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("uz_form_responses" as any)
    .select("*", { count: "exact" })
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    data: (data ?? []) as unknown as UzFormResponse[],
    count: count ?? 0,
  };
}

// ─── Public Endpoint Methods ──────────────────────────────────────────────────

/**
 * Fetch a public active form with all its steps and fields.
 */
export async function getPublicForm(token: string): Promise<UzFormWithSteps | null> {
  const { data, error } = await supabase
    .from("uz_forms" as any)
    .select("*, steps:uz_form_steps(*, fields:uz_form_fields(*))")
    .eq("token", token)
    .eq("is_active", true)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const form = data as unknown as UzFormWithSteps;

  // Order steps and fields
  if (form.steps) {
    form.steps.sort((a, b) => a.step_order - b.step_order);
    for (const step of form.steps) {
      if (step.fields) {
        step.fields.sort((a, b) => a.field_order - b.field_order);
      }
    }
  }

  return form;
}

/**
 * Submit a form response from the public view.
 */
export async function submitFormResponse(
  formId: string,
  organizationId: string,
  responseData: Record<string, string>,
): Promise<void> {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;

  const { error } = await supabase
    .from("uz_form_responses" as any)
    .insert({
      form_id: formId,
      organization_id: organizationId,
      response_data: responseData,
      user_agent: userAgent,
    });

  if (error) throw error;
}

/**
 * Fetch all responses for a form, ordered newest first.
 */
export async function getAllFormResponses(formId: string): Promise<UzFormResponse[]> {
  const { data, error } = await supabase
    .from("uz_form_responses" as any)
    .select("*")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as UzFormResponse[];
}
