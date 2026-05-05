import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data } = await supabase
      .from("saas_settings")
      .select("key, value")
      .in("key", ["branding", "general"]);

    let appName = "OpenFlow";
    let themeColor = "#0a0a0a";
    let icon192 = "/pwa-192x192.png";
    let icon512 = "/pwa-512x512.png";

    data?.forEach((row: any) => {
      if (row.key === "general" && row.value?.app_name) {
        appName = row.value.app_name;
      }
      if (row.key === "branding") {
        const b = row.value || {};
        if (b.theme_color) themeColor = b.theme_color;
        if (b.pwa_icon_192_url) icon192 = b.pwa_icon_192_url;
        if (b.pwa_icon_512_url) icon512 = b.pwa_icon_512_url;
      }
    });

    const manifest = {
      name: appName,
      short_name: appName,
      start_url: "/",
      display: "standalone",
      theme_color: themeColor,
      background_color: themeColor,
      icons: [
        { src: icon192, sizes: "192x192", type: "image/png" },
        { src: icon512, sizes: "512x512", type: "image/png" },
      ],
    };

    return new Response(JSON.stringify(manifest), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("pwa-manifest error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate manifest" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
