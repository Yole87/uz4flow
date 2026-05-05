/**
 * API Client Layer
 * 
 * Thin wrapper around backend function calls.
 * Contains NO business logic — only typed calls and error handling.
 */

import { supabase } from "@/integrations/supabase/client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Invoke a backend function with typed response.
 * Handles auth token injection and error normalization.
 */
export async function invokeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new ApiError(
      error.message || "Erro na comunicação com o servidor",
      undefined,
      "INVOKE_ERROR"
    );
  }

  if (data?.error) {
    throw new ApiError(
      data.error,
      data.status,
      data.code
    );
  }

  return data as T;
}
