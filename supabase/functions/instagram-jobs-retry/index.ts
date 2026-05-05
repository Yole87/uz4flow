/**
 * Instagram Jobs Retry Edge Function
 * 
 * Reprocesses failed actions/jobs with exponential backoff.
 * Receives job_id or action_log_id.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Determine if this is an authenticated user call or internal service call
  const authHeader = req.headers.get("Authorization");
  let isServiceCall = false;

  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    // If the token is the service role key, it's an internal call
    if (token === serviceRoleKey) {
      isServiceCall = true;
    } else {
      // Validate user auth
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // User is authenticated, continue
    }
  } else {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { job_id, action_log_id } = body;

    if (!job_id && !action_log_id) {
      return new Response(JSON.stringify({ error: "job_id or action_log_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let job: Record<string, unknown> | null = null;

    if (job_id) {
      // Fetch existing job
      const { data, error } = await supabase
        .from("instagram_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      job = data;
    } else if (action_log_id) {
      // Create job from action_log
      const { data: actionLog, error: logErr } = await supabase
        .from("instagram_action_logs")
        .select("*")
        .eq("id", action_log_id)
        .single();

      if (logErr || !actionLog) {
        return new Response(JSON.stringify({ error: "Action log not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if a job already exists for this action log
      const { data: existingJob } = await supabase
        .from("instagram_jobs")
        .select("*")
        .eq("reference_id", action_log_id)
        .eq("job_type", "retry_action")
        .maybeSingle();

      if (existingJob) {
        job = existingJob;
      } else {
        const { data: newJob, error: jobErr } = await supabase
          .from("instagram_jobs")
          .insert({
            organization_id: actionLog.organization_id,
            job_type: "retry_action",
            reference_id: action_log_id,
            payload_json: {
              event_id: actionLog.event_id,
              automation_id: actionLog.automation_id,
              action_type: actionLog.action_type,
              action_index: actionLog.action_index,
            },
            status: "pending",
            max_attempts: 3,
          })
          .select()
          .single();

        if (jobErr) throw jobErr;
        job = newJob;
      }
    }

    if (!job) {
      return new Response(JSON.stringify({ error: "Could not resolve job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max attempts
    const attempts = (job.attempts as number) || 0;
    const maxAttempts = (job.max_attempts as number) || 3;

    if (attempts >= maxAttempts) {
      return new Response(JSON.stringify({
        error: "Max retry attempts reached",
        attempts,
        max_attempts: maxAttempts,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exponential backoff check
    if (attempts > 0) {
      const backoffMs = 1000 * Math.pow(2, attempts - 1);
      await sleep(Math.min(backoffMs, 30000)); // Cap at 30s
    }

    // Update job: increment attempts, set status to processing
    await supabase.from("instagram_jobs").update({
      attempts: attempts + 1,
      status: "processing",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    // Call instagram-process-event with the original event
    const payload = job.payload_json as Record<string, unknown>;
    const eventId = payload?.event_id as string;

    if (!eventId) {
      await supabase.from("instagram_jobs").update({
        status: "failed",
        last_error: "No event_id in job payload",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);

      return new Response(JSON.stringify({ error: "No event_id in job payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset event status to 'received' so it can be reprocessed
    await supabase.from("instagram_events").update({
      status: "received",
      error_message: null,
    }).eq("id", eventId);

    // Call process-event
    const processUrl = `${supabaseUrl}/functions/v1/instagram-process-event`;
    const processRes = await fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ event_id: eventId }),
    });

    const processResult = await processRes.json().catch(() => ({}));

    if (processRes.ok && !processResult.error) {
      // Success
      await supabase.from("instagram_jobs").update({
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);

      // Update action log if applicable
      if (action_log_id) {
        await supabase.from("instagram_action_logs").update({
          status: "retried_success",
        }).eq("id", action_log_id);
      }

      return new Response(JSON.stringify({ success: true, attempts: attempts + 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Failed
      const errorMsg = processResult.error || `HTTP ${processRes.status}`;
      await supabase.from("instagram_jobs").update({
        status: attempts + 1 >= maxAttempts ? "failed" : "pending",
        last_error: errorMsg,
        run_at: new Date(Date.now() + 1000 * Math.pow(2, attempts)).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);

      return new Response(JSON.stringify({
        success: false,
        error: errorMsg,
        attempts: attempts + 1,
        max_attempts: maxAttempts,
        will_retry: attempts + 1 < maxAttempts,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[IG-Jobs-Retry] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
