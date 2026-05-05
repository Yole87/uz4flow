import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// Fallback coordinates for major Brazilian cities (when Geocoding API fails)
const BRAZILIAN_CITIES: Record<string, { lat: number; lng: number; radius: number }> = {
  "são paulo": { lat: -23.5505, lng: -46.6333, radius: 0.4 },
  "sao paulo": { lat: -23.5505, lng: -46.6333, radius: 0.4 },
  "rio de janeiro": { lat: -22.9068, lng: -43.1729, radius: 0.35 },
  "belo horizonte": { lat: -19.9167, lng: -43.9345, radius: 0.25 },
  "brasília": { lat: -15.7942, lng: -47.8822, radius: 0.25 },
  "brasilia": { lat: -15.7942, lng: -47.8822, radius: 0.25 },
  "salvador": { lat: -12.9714, lng: -38.5014, radius: 0.25 },
  "fortaleza": { lat: -3.7172, lng: -38.5433, radius: 0.25 },
  "curitiba": { lat: -25.4284, lng: -49.2733, radius: 0.25 },
  "recife": { lat: -8.0476, lng: -34.8770, radius: 0.2 },
  "porto alegre": { lat: -30.0346, lng: -51.2177, radius: 0.25 },
  "manaus": { lat: -3.1190, lng: -60.0217, radius: 0.25 },
  "goiânia": { lat: -16.6869, lng: -49.2648, radius: 0.2 },
  "goiania": { lat: -16.6869, lng: -49.2648, radius: 0.2 },
  "campinas": { lat: -22.9099, lng: -47.0626, radius: 0.2 },
  "guarulhos": { lat: -23.4538, lng: -46.5333, radius: 0.15 },
  "são bernardo": { lat: -23.6914, lng: -46.5646, radius: 0.15 },
  "santo andré": { lat: -23.6639, lng: -46.5310, radius: 0.15 },
  "osasco": { lat: -23.5324, lng: -46.7917, radius: 0.12 },
};

// Field mask for Enterprise tier (includes phone and website)
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.location",
  "nextPageToken",
].join(",");

// Anti-loop constants
const MAX_CONSECUTIVE_NO_NEW = 5;
const MAX_TILES = 60;
const PAGE_TOKEN_DELAY_MS = 2000;
const STALE_SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface PlaceResult {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  businessStatus?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions: string[] };
  location?: { latitude: number; longitude: number };
}

interface PlacesApiResponse {
  places?: PlaceResult[];
  nextPageToken?: string;
}

interface Tile {
  low: { lat: number; lng: number };
  high: { lat: number; lng: number };
  pageToken?: string;
  pageIndex: number;
  done: boolean;
}

interface SessionMetrics {
  provider: string;
  max_results: number;
  keyword: string;
  location: string | null;
  tiles: Tile[];
  tile_index: number;
  requests_made: number;
  duplicates_removed: number;
  consecutive_no_new: number;
  api_key: string;
  search_record_id: string;
}

function mapPlaceToLead(place: PlaceResult) {
  return {
    business_name: place.displayName?.text || "Sem nome",
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    address: place.formattedAddress || null,
    rating: place.rating || null,
    review_count: place.userRatingCount || null,
    category: place.types?.[0] || null,
    social_urls: {},
    has_whatsapp: false,
    source_url: place.googleMapsUri || "https://maps.google.com",
    business_status: place.businessStatus || null,
    opening_hours: place.regularOpeningHours?.weekdayDescriptions || null,
    raw_data: place,
    provider_place_id: place.id,
  };
}

async function geocodeLocation(apiKey: string, location: string): Promise<{ lat: number; lng: number; bounds?: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } } } | null> {
  console.log(`[places] Geocoding location: "${location}"`);
  
  try {
    const response = await fetch(`${GEOCODING_API_URL}?address=${encodeURIComponent(location)}&key=${apiKey}`);
    
    if (!response.ok) {
      console.error(`[places] Geocoding API HTTP error: ${response.status} ${response.statusText}`);
      return getFallbackCoordinates(location);
    }
    
    const data = await response.json();
    console.log(`[places] Geocoding response status: ${data.status}, results: ${data.results?.length || 0}`);
    
    if (data.status === "REQUEST_DENIED") {
      console.error("[places] Geocoding API request denied - API may not be enabled:", data.error_message);
      return getFallbackCoordinates(location);
    }
    
    if (data.status === "ZERO_RESULTS") {
      console.warn("[places] Geocoding returned zero results for:", location);
      return getFallbackCoordinates(location);
    }
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const loc = result.geometry.location;
      const bounds = result.geometry.viewport || result.geometry.bounds;
      
      console.log(`[places] Geocoding success: lat=${loc.lat}, lng=${loc.lng}, hasBounds=${!!bounds}`);
      
      return {
        lat: loc.lat,
        lng: loc.lng,
        bounds: bounds ? {
          ne: { lat: bounds.northeast.lat, lng: bounds.northeast.lng },
          sw: { lat: bounds.southwest.lat, lng: bounds.southwest.lng }
        } : undefined
      };
    }
  } catch (e) {
    console.error("[places] Geocoding error:", e);
  }
  
  return getFallbackCoordinates(location);
}

// Get fallback coordinates for known Brazilian cities
function getFallbackCoordinates(location: string): { lat: number; lng: number; bounds?: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } } } | null {
  const normalized = location.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents for matching
    .replace(/,.*$/, "") // Remove state/country suffix
    .trim();
  
  // Try to find a matching city
  for (const [cityName, coords] of Object.entries(BRAZILIAN_CITIES)) {
    const normalizedCity = cityName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes(normalizedCity) || normalizedCity.includes(normalized)) {
      console.log(`[places] Using fallback coordinates for: ${cityName}`);
      return {
        lat: coords.lat,
        lng: coords.lng,
        bounds: {
          ne: { lat: coords.lat + coords.radius, lng: coords.lng + coords.radius },
          sw: { lat: coords.lat - coords.radius, lng: coords.lng - coords.radius }
        }
      };
    }
  }
  
  console.warn(`[places] No fallback coordinates found for: ${location}`);
  return null;
}

function generateTiles(bounds: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } }, maxResults: number): Tile[] {
  // Calculate grid size based on max results needed
  // We assume ~20 results per tile reliably (pageToken paging can be flaky with some restrictions)
  // This increases coverage and makes it easier to reach higher maxResults.
  const tilesNeeded = Math.min(Math.ceil(maxResults / 20), MAX_TILES);
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(tilesNeeded)));
  
  const latStep = (bounds.ne.lat - bounds.sw.lat) / gridSize;
  const lngStep = (bounds.ne.lng - bounds.sw.lng) / gridSize;
  
  const tiles: Tile[] = [];
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      tiles.push({
        low: {
          lat: bounds.sw.lat + (i * latStep),
          lng: bounds.sw.lng + (j * lngStep)
        },
        high: {
          lat: bounds.sw.lat + ((i + 1) * latStep),
          lng: bounds.sw.lng + ((j + 1) * lngStep)
        },
        pageIndex: 0,
        done: false
      });
    }
  }
  
  // Shuffle tiles to avoid sequential scanning
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  
  return tiles;
}

async function searchPlacesWithRestriction(
  apiKey: string,
  query: string,
  tile: Tile | null,
  pageToken?: string
): Promise<PlacesApiResponse> {
  const trimmedQuery = (query || "").trim();
  if (!trimmedQuery) {
    throw new Error("EMPTY_TEXT_QUERY");
  }

  const baseBody: Record<string, unknown> = {
    textQuery: trimmedQuery,
    languageCode: "pt-BR",
    regionCode: "BR",
    maxResultCount: 20,
  };

  if (tile) {
    baseBody.locationRestriction = {
      rectangle: {
        low: { latitude: tile.low.lat, longitude: tile.low.lng },
        high: { latitude: tile.high.lat, longitude: tile.high.lng },
      },
    };
  }

  if (pageToken) {
    baseBody.pageToken = pageToken;
  }

  // Helper with retry logic for transient errors (5xx)
  const doRequest = async (body: Record<string, unknown>, retries = 3, delayMs = 1000): Promise<Response> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(PLACES_API_URL, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      
      // If success or client error (4xx), return immediately
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      
      // Server error (5xx) - retry with exponential backoff
      if (response.status >= 500 && attempt < retries) {
        const backoffMs = delayMs * Math.pow(2, attempt - 1);
        console.warn(`[places] API returned ${response.status}, retrying in ${backoffMs}ms (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      return response;
    }
    
    // Should not reach here, but fallback
    throw new Error("RETRY_EXHAUSTED");
  };

  console.log(
    `[places] ${pageToken ? "Paging" : "Search"}: "${trimmedQuery}", tile: ${tile ? "yes" : "no"}, pageToken: ${pageToken ? "yes" : "no"}`,
  );

  let response = await doRequest(baseBody);

  // If paging fails due to parameter mismatch, try one fallback removing locationRestriction.
  // Google error messages are inconsistent across accounts/projects.
  if (!response.ok && response.status === 400 && pageToken && tile) {
    const errorText = await response.text();
    const looksLikePagingMismatch =
      errorText.includes("paging requests must match") ||
      errorText.includes("Request parameters for paging requests") ||
      errorText.includes("INVALID_ARGUMENT");

    console.error(`[places] API error 400 (paging):`, errorText);

    if (looksLikePagingMismatch) {
      console.warn("[places] Paging mismatch detected; retrying without locationRestriction");
      const retryBody = { ...baseBody };
      delete retryBody.locationRestriction;
      response = await doRequest(retryBody);

      if (!response.ok) {
        const retryErrorText = await response.text();
        console.error(`[places] API error 400 (paging retry):`, retryErrorText);
        throw new Error("PAGING_REQUEST_INVALID");
      }

      return await response.json();
    }

    throw new Error(`Erro da API Google Places: ${response.status}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[places] API error ${response.status}:`, errorText);

    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    
    // For 403 errors, detect specific causes
    if (response.status === 403) {
      if (errorText.includes("BILLING_DISABLED") || errorText.includes("billing to be enabled")) {
        throw new Error("BILLING_DISABLED");
      }
      if (errorText.includes("API is not activated") || errorText.includes("API key not valid") || 
          errorText.includes("This API is not enabled")) {
        throw new Error("API_NOT_ENABLED");
      }
      throw new Error("GOOGLE_API_FORBIDDEN");
    }
    
    // For 5xx errors after retries exhausted, provide a clearer message
    if (response.status >= 500) {
      throw new Error("GOOGLE_SERVER_ERROR");
    }

    throw new Error(`Erro da API Google Places: ${response.status}`);
  }

  return await response.json();
}

// deno-lint-ignore no-explicit-any
async function handleStart(
  adminClient: any,
  organizationId: string,
  apiKey: string,
  keyword: string,
  location: string | null,
  maxResults: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log(`[places] Starting search for org ${organizationId}, maxResults: ${maxResults}`);

  // Create search record
  const { data: searchRecord, error: searchError } = await adminClient
    .from("prospect_searches")
    .insert({
      organization_id: organizationId,
      keyword,
      location: location || null,
      provider_used: "google_places",
      status: "processing",
      whatsapp_only: false,
    })
    .select()
    .single();

  if (searchError || !searchRecord) {
    console.error("[places] Failed to create search record:", searchError);
    return new Response(
      JSON.stringify({ success: false, error: "Erro ao criar registro de busca" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate tiles based on location
  let tiles: Tile[] = [];
  const textQuery = location ? `${keyword} em ${location}` : keyword;
  
  // Always try to generate tiles for better coverage, especially when maxResults > 60
  if (location) {
    const geoResult = await geocodeLocation(apiKey, location);
    
    if (geoResult) {
      // Always create bounds - use provided bounds or generate synthetic ones
      const bounds = geoResult.bounds || {
        ne: { lat: geoResult.lat + 0.3, lng: geoResult.lng + 0.3 },
        sw: { lat: geoResult.lat - 0.3, lng: geoResult.lng - 0.3 }
      };
      
      // For maxResults > 60, use grid scanning; otherwise use single area
      if (maxResults > 60) {
        tiles = generateTiles(bounds, maxResults);
        console.log(`[places] Generated ${tiles.length} tiles for grid search (maxResults: ${maxResults})`);
      } else {
        // Single tile for smaller searches
        tiles = [{
          low: bounds.sw,
          high: bounds.ne,
          pageIndex: 0,
          done: false
        }];
        console.log(`[places] Using single tile for search (maxResults: ${maxResults})`);
      }
    } else {
      console.warn(`[places] Could not geocode location: ${location}, using simple pagination`);
    }
  }
  
  // If no valid tiles, use simple pagination (will be limited to 60 results)
  if (tiles.length === 0) {
    console.log(`[places] No tiles generated, using simple pagination (max 60 results)`);
    tiles = [{ low: { lat: 0, lng: 0 }, high: { lat: 0, lng: 0 }, pageIndex: 0, done: false }];
  }

  const metrics: SessionMetrics = {
    provider: "places_api",
    max_results: maxResults,
    keyword: textQuery,
    location,
    tiles,
    tile_index: 0,
    requests_made: 0,
    duplicates_removed: 0,
    consecutive_no_new: 0,
    api_key: apiKey,
    search_record_id: searchRecord.id,
  };

  // Create session in visual_scrape_sessions
  const { data: session, error: sessionError } = await adminClient
    .from("visual_scrape_sessions")
    .insert({
      organization_id: organizationId,
      keyword,
      location: location || null,
      max_results: maxResults,
      status: "running",
      current_phase: "Iniciando busca...",
      progress_percent: 0,
      total_found: 0,
      metrics,
    })
    .select()
    .single();

  if (sessionError || !session) {
    console.error("[places] Failed to create session:", sessionError);
    return new Response(
      JSON.stringify({ success: false, error: "Erro ao criar sessão" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      session_id: session.id,
      search_id: searchRecord.id,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function handleStep(
  adminClient: any,
  sessionId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Get session
  const { data: session, error: sessionError } = await adminClient
    .from("visual_scrape_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ success: false, error: "Sessão não encontrada" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (session.status !== "running") {
    return new Response(
      JSON.stringify({ success: true, done: true, status: session.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const metrics = session.metrics as SessionMetrics;
  const { tiles, api_key: raw_api_key, max_results, keyword, search_record_id } = metrics;
  const api_key = raw_api_key.trim();
  let { tile_index } = metrics;
  
  // Check if we've reached max results
  if (session.total_found >= max_results) {
    await finalizeSession(adminClient, sessionId, search_record_id, "completed", session.total_found);
    return new Response(
      JSON.stringify({ success: true, done: true, status: "completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check anti-loop
  // Only apply consecutive_no_new stop for simple pagination (single tile / no grid).
  // In grid scanning, empty tiles are expected and shouldn't stop the whole job.
  if (tiles.length <= 1 && metrics.consecutive_no_new >= MAX_CONSECUTIVE_NO_NEW) {
    console.log("[places] Stopping: too many consecutive pages with no new results");
    await finalizeSession(adminClient, sessionId, search_record_id, "completed", session.total_found);
    return new Response(
      JSON.stringify({ success: true, done: true, status: "completed", reason: "results_exhausted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Find next tile to process
  let currentTile = tiles[tile_index];
  while (currentTile?.done && tile_index < tiles.length - 1) {
    tile_index++;
    metrics.tile_index = tile_index;
    currentTile = tiles[tile_index];
  }

  if (!currentTile || (currentTile.done && tile_index >= tiles.length - 1)) {
    await finalizeSession(adminClient, sessionId, search_record_id, "completed", session.total_found);
    return new Response(
      JSON.stringify({ success: true, done: true, status: "completed", reason: "all_tiles_processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Wait for page token delay if needed
    if (currentTile.pageToken) {
      await new Promise(resolve => setTimeout(resolve, PAGE_TOKEN_DELAY_MS));
    }

    // Make API request - use location restriction if tiles are valid (not 0,0)
    const hasValidTile = currentTile.low.lat !== 0 || currentTile.low.lng !== 0 || 
                         currentTile.high.lat !== 0 || currentTile.high.lng !== 0;
    const useRestriction = tiles.length > 1 || hasValidTile;
    
    console.log(`[places] Step: tile ${metrics.tile_index + 1}/${tiles.length}, useRestriction=${useRestriction}, hasValidTile=${hasValidTile}`);
    
    const response = await searchPlacesWithRestriction(
      api_key,
      keyword,
      useRestriction ? currentTile : null,
      currentTile.pageToken
    );

    metrics.requests_made++;

    const places = response.places || [];
    let newLeadsCount = 0;

    if (places.length > 0) {
      const leads = places.map(mapPlaceToLead);
      
      // Insert with proper duplicate handling (upsert doesn't work with partial indexes)
      for (const lead of leads) {
        const { data: inserted, error: insertError } = await adminClient
          .from("prospect_results")
          .insert({
            search_id: search_record_id,
            organization_id: session.organization_id,
            business_name: lead.business_name,
            phone: lead.phone,
            website: lead.website,
            address: lead.address,
            has_whatsapp: false,
            source_url: lead.source_url,
            raw_data: lead.raw_data,
            ai_score: lead.rating ? Math.round(lead.rating * 20) : null,
            provider_place_id: lead.provider_place_id,
          })
          .select("id")
          .maybeSingle();

        if (insertError) {
          if (insertError.code === "23505") {
            // Duplicate - count but don't fail
            metrics.duplicates_removed++;
          } else {
            console.error("[places] Insert error:", insertError.message, insertError.code);
          }
        } else if (inserted) {
          newLeadsCount++;
        }
      }
    }

    console.log(`[places] Step complete: ${newLeadsCount} new leads, ${metrics.duplicates_removed} duplicates`);

    // Update tile state
    currentTile.pageIndex++;
    if (response.nextPageToken && currentTile.pageIndex < 3) {
      currentTile.pageToken = response.nextPageToken;
    } else {
      currentTile.done = true;
      currentTile.pageToken = undefined;
      metrics.tile_index++;
    }

    // Update consecutive_no_new counter
    if (newLeadsCount === 0) {
      metrics.consecutive_no_new++;
    } else {
      metrics.consecutive_no_new = 0;
    }

    // Calculate progress
    const processedTiles = tiles.filter(t => t.done).length;
    const progressPercent = Math.min(95, Math.round((processedTiles / tiles.length) * 100));
    const totalFound = session.total_found + newLeadsCount;

    // Update session
    await adminClient
      .from("visual_scrape_sessions")
      .update({
        total_found: totalFound,
        current_phase: `Região ${metrics.tile_index + 1}/${tiles.length} - ${totalFound} leads`,
        progress_percent: progressPercent,
        metrics,
      })
      .eq("id", sessionId);

    const allDone = tiles.every(t => t.done) || totalFound >= max_results;

    if (allDone) {
      await finalizeSession(adminClient, sessionId, search_record_id, "completed", totalFound);
    }

    return new Response(
      JSON.stringify({
        success: true,
        done: allDone,
        new_leads: newLeadsCount,
        total_found: totalFound,
        requests_made: metrics.requests_made,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[places] Step error:", error);
    
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      // Don't fail, just return and let frontend retry
      return new Response(
        JSON.stringify({ success: true, done: false, rate_limited: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (error instanceof Error && error.message === "PAGING_REQUEST_INVALID") {
      // Paging token mismatch shouldn't kill the whole run. Mark tile as done and continue.
      console.warn("[places] Paging token invalid; marking current tile done and continuing");
      currentTile.done = true;
      currentTile.pageToken = undefined;
      metrics.tile_index = Math.min(metrics.tile_index + 1, tiles.length - 1);
      metrics.consecutive_no_new = 0;

      const processedTiles = tiles.filter(t => t.done).length;
      const progressPercent = Math.min(95, Math.round((processedTiles / tiles.length) * 100));

      await adminClient
        .from("visual_scrape_sessions")
        .update({
          current_phase: `Pulando paginação inválida - Região ${metrics.tile_index + 1}/${tiles.length}`,
          progress_percent: progressPercent,
          metrics,
        })
        .eq("id", sessionId);

      return new Response(
        JSON.stringify({ success: true, done: false, skipped_paging: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await finalizeSession(adminClient, sessionId, search_record_id, "failed", session.total_found, error instanceof Error ? error.message : "Erro desconhecido");
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// deno-lint-ignore no-explicit-any
async function handleStatus(
  adminClient: any,
  sessionId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: session, error } = await adminClient
    .from("visual_scrape_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return new Response(
      JSON.stringify({ success: false, error: "Sessão não encontrada" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const metrics = session.metrics as SessionMetrics;

  // Get leads
  const { data: leads } = await adminClient
    .from("prospect_results")
    .select("*")
    .eq("search_id", metrics.search_record_id)
    .order("created_at", { ascending: false });

  return new Response(
    JSON.stringify({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        total_found: session.total_found,
        current_phase: session.current_phase,
        progress_percent: session.progress_percent,
        error_message: session.error_message,
        metrics: {
          requests_made: metrics.requests_made,
          duplicates_removed: metrics.duplicates_removed,
          tiles_total: metrics.tiles.length,
          tiles_processed: metrics.tiles.filter((t: Tile) => t.done).length,
        },
      },
      leads: leads || [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function handleStop(
  adminClient: any,
  sessionId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: session } = await adminClient
    .from("visual_scrape_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return new Response(
      JSON.stringify({ success: false, error: "Sessão não encontrada" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const metrics = session.metrics as SessionMetrics;
  await finalizeSession(adminClient, sessionId, metrics.search_record_id, "stopped", session.total_found);

  return new Response(
    JSON.stringify({ success: true, status: "stopped" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function finalizeSession(
  adminClient: any,
  sessionId: string,
  searchRecordId: string,
  status: string,
  totalFound: number,
  errorMessage?: string
) {
  const { error: sessionUpdateError } = await adminClient
    .from("visual_scrape_sessions")
    .update({
      status,
      progress_percent: status === "completed" ? 100 : undefined,
      current_phase: status === "completed" ? "Concluído" : status === "stopped" ? "Interrompido" : "Erro",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", sessionId);

  if (sessionUpdateError) {
    console.error(`[places] ERROR updating visual_scrape_sessions: ${sessionUpdateError.message}`, sessionUpdateError);
  }

  const { error: searchUpdateError } = await adminClient
    .from("prospect_searches")
    .update({
      status,
      total_results: totalFound,
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", searchRecordId);

  if (searchUpdateError) {
    console.error(`[places] ERROR updating prospect_searches (id=${searchRecordId}): ${searchUpdateError.message}`, searchUpdateError);
  }

  console.log(`[places] finalizeSession: session=${sessionId}, search=${searchRecordId}, status=${status}, found=${totalFound}`);
}

// Check if session is stale and should be auto-terminated
// deno-lint-ignore no-explicit-any
async function checkAndFinalizeStaleSession(
  adminClient: any,
  session: any
): Promise<boolean> {
  if (session.status !== "running") {
    return false;
  }
  
  const lastActivity = new Date(session.updated_at || session.created_at);
  const elapsed = Date.now() - lastActivity.getTime();
  
  if (elapsed > STALE_SESSION_TIMEOUT_MS) {
    console.log(`[places] Session ${session.id} is stale (${Math.round(elapsed / 1000)}s inactive), auto-terminating`);
    
    const metrics = session.metrics as SessionMetrics | null;
    const searchRecordId = metrics?.search_record_id || session.id;
    
    await finalizeSession(
      adminClient,
      session.id,
      searchRecordId,
      "failed",
      session.total_found || 0,
      "Sessão expirada por inatividade"
    );
    
    return true;
  }
  
  return false;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Admin client for database operations
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, session_id, keyword, location, maxResults = 20, impersonate_org_id } = body;

    // Resolve organization: support impersonation for admin_master
    let organizationId: string;
    if (impersonate_org_id) {
      const { data: isAdmin } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin_master")
        .maybeSingle();
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão para impersonar" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      organizationId = impersonate_org_id;
    } else {
      // Use adminClient to bypass RLS
      const { data: orgOwned } = await adminClient
        .from("organizations")
        .select("id")
        .eq("owner_user_id", userId)
        .limit(1)
        .maybeSingle();
      
      if (orgOwned) {
        organizationId = orgOwned.id;
      } else {
        const { data: orgMember } = await adminClient
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (!orgMember) {
          return new Response(
            JSON.stringify({ success: false, error: "Organização não encontrada" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        organizationId = orgMember.organization_id;
      }
    }

    // Route based on action

    // Route based on action
    switch (action) {
      case "start": {
        if (!keyword || typeof keyword !== "string") {
          return new Response(
            JSON.stringify({ success: false, error: "Palavra-chave é obrigatória" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get Google Places API key
        const { data: provider } = await adminClient
          .from("prospect_providers")
          .select("google_places_api_key_encrypted")
          .eq("organization_id", organizationId)
          .single();

        if (!provider?.google_places_api_key_encrypted) {
          return new Response(
            JSON.stringify({ success: false, error: "Chave Google Places API não configurada" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const apiKey = (await decrypt(provider.google_places_api_key_encrypted)).trim();
        return handleStart(adminClient, organizationId, apiKey, keyword, location, maxResults, corsHeaders);
      }

      case "step": {
        if (!session_id) {
          return new Response(
            JSON.stringify({ success: false, error: "session_id é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return handleStep(adminClient, session_id, corsHeaders);
      }

      case "status": {
        if (!session_id) {
          return new Response(
            JSON.stringify({ success: false, error: "session_id é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Before returning status, check if session is stale
        const { data: sessionCheck } = await adminClient
          .from("visual_scrape_sessions")
          .select("id, status, updated_at, created_at, metrics, total_found")
          .eq("id", session_id)
          .single();
          
        if (sessionCheck) {
          const wasStale = await checkAndFinalizeStaleSession(adminClient, sessionCheck);
          if (wasStale) {
            // Return updated status after auto-termination
            return handleStatus(adminClient, session_id, corsHeaders);
          }
        }
        
        return handleStatus(adminClient, session_id, corsHeaders);
      }

      case "stop": {
        if (!session_id) {
          return new Response(
            JSON.stringify({ success: false, error: "session_id é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return handleStop(adminClient, session_id, corsHeaders);
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Ação inválida. Use: start, step, status, stop" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[places] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
