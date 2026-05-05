import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



// Browserless v2 base URL
const BROWSERLESS_BASE_URL = "https://production-sfo.browserless.io";
const STALE_SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// User-Agent pool for rotation (Brazilian desktop users)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/121.0.0.0 Safari/537.36',
];

// Get random user agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Random delay helper for human-like behavior
function randomDelay(baseMs: number, varianceMs: number): number {
  return baseMs + Math.floor(Math.random() * varianceMs);
}

// Build Browserless URL with anti-blocking options
function buildBrowserlessUrl(
  token: string,
  useStealthMode: boolean = true,
  useResidentialProxy: boolean = false
): string {
  const params = new URLSearchParams({ token });
  
  // ALWAYS use /function endpoint for REST API (única opção para execução de código Puppeteer)
  // O endpoint /chromium é apenas para conexões WebSocket (puppeteer.connect)
  // O modo stealth é implementado via User-Agent rotation, delays e proxy residencial
  const endpoint = "/function";
  
  if (useResidentialProxy) {
    params.append("proxy", "residential");
    params.append("proxyCountry", "br");
    params.append("proxySticky", "true");
    params.append("proxyLocaleMatch", "1");
  }
  
  return `${BROWSERLESS_BASE_URL}${endpoint}?${params.toString()}`;
}

// Phone extraction patterns
const PHONE_PATTERNS = [
  /\+55\s?\(?\d{2}\)?[ \s.-]?\d{4,5}[ \s.-]?\d{4}/gi,
  /\(?\d{2}\)?[ \s.-]?\d{4,5}[ \s.-]?\d{4}/gi,
  /\d{2}\s+9\s+\d{4}[ \s.-]?\d{4}/gi,
];

// Email pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Social media patterns
const SOCIAL_PATTERNS = {
  instagram: /(?:instagram\.com|instagr\.am)\/([A-Za-z0-9_.]+)/gi,
  facebook: /facebook\.com\/([A-Za-z0-9_.]+)/gi,
  linkedin: /linkedin\.com\/(?:company|in)\/([A-Za-z0-9_-]+)/gi,
  twitter: /(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/gi,
};

interface ScrapedLead {
  business_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  category: string | null;
  social_urls: Record<string, string>;
  has_whatsapp: boolean;
  source_url: string;
}

// Create Supabase admin client
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Update session status
async function updateSession(
  sessionId: string,
  updates: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("visual_scrape_sessions")
    .update({
      ...updates,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}

// Save leads to database
async function saveLeads(
  sessionId: string,
  organizationId: string,
  leads: ScrapedLead[]
) {
  const supabase = getSupabaseAdmin();
  
  console.log(`[saveLeads] Starting for session ${sessionId}, org ${organizationId}, ${leads.length} leads`);
  
  // Get or create a search record first
  const { data: existingSearch, error: searchCheckError } = await supabase
    .from("prospect_searches")
    .select("id")
    .eq("id", sessionId)
    .single();
  
  if (searchCheckError && searchCheckError.code !== 'PGRST116') {
    console.error(`[saveLeads] Error checking existing search:`, searchCheckError);
  }
  
  let searchId = sessionId;
  
  if (!existingSearch) {
    // Create a search record
    const { data: session, error: sessionError } = await supabase
      .from("visual_scrape_sessions")
      .select("keyword, location")
      .eq("id", sessionId)
      .single();
    
    if (sessionError) {
      console.error(`[saveLeads] Error fetching session:`, sessionError);
    }
    
    if (session) {
      console.log(`[saveLeads] Creating prospect_searches record...`);
      const { data: newSearch, error: insertSearchError } = await supabase
        .from("prospect_searches")
        .insert({
          id: sessionId,
          organization_id: organizationId,
          keyword: session.keyword,
          location: session.location || '',
          provider_used: "firecrawl", // Use valid provider from check constraint
          status: "processing",
        })
        .select("id")
        .single();
      
      if (insertSearchError) {
        console.error(`[saveLeads] Error creating search record:`, insertSearchError);
        // Don't fail - use the sessionId anyway
      } else if (newSearch) {
        searchId = newSearch.id;
        console.log(`[saveLeads] Created search record: ${searchId}`);
      }
    }
  } else {
    console.log(`[saveLeads] Using existing search record: ${existingSearch.id}`);
  }
  
  // Insert leads
  const leadsToInsert = leads.map(lead => ({
    organization_id: organizationId,
    search_id: searchId,
    business_name: lead.business_name,
    phone: lead.phone,
    email: lead.email,
    website: lead.website,
    address: lead.address,
    social_urls: lead.social_urls,
    has_whatsapp: lead.has_whatsapp,
    source_url: lead.source_url,
    ai_score: calculateScore(lead),
    ai_analysis: {
      rating: lead.rating,
      review_count: lead.review_count,
      category: lead.category,
    },
  }));
  
  console.log(`[saveLeads] Inserting ${leadsToInsert.length} leads...`);
  const { data: insertedLeads, error: insertError } = await supabase
    .from("prospect_results")
    .insert(leadsToInsert)
    .select("id");
  
  if (insertError) {
    console.error(`[saveLeads] Error inserting leads:`, insertError);
    throw new Error(`Failed to insert leads: ${insertError.message}`);
  }
  
  console.log(`[saveLeads] Successfully inserted ${insertedLeads?.length || 0} leads`);
}

// Calculate lead score
function calculateScore(lead: ScrapedLead): number {
  let score = 50;
  if (lead.phone) score += 20;
  if (lead.email) score += 15;
  if (lead.website) score += 10;
  if (lead.has_whatsapp) score += 15;
  if (lead.rating && lead.rating >= 4) score += 10;
  if (Object.keys(lead.social_urls).length > 0) score += 10;
  return Math.min(score, 100);
}

/**
 * Main scraping function - CONSOLIDATED ARCHITECTURE
 * Uses a SINGLE /function call with internal scroll loop
 * This prevents state loss between separate browser sessions
 */
async function scrapeGoogleMaps(
  sessionId: string,
  organizationId: string,
  keyword: string,
  location: string,
  maxResults: number = 100
) {
  // Fetch the organization's Browserless API key and anti-blocking settings from the database
  const supabase = getSupabaseAdmin();
  const { data: provider, error: providerError } = await supabase
    .from("prospect_providers")
    .select("browserless_api_key_encrypted, browserless_configured, use_stealth_mode, use_residential_proxy")
    .eq("organization_id", organizationId)
    .single();
  
  if (providerError || !provider?.browserless_api_key_encrypted) {
    console.error("[visual-scraper] No Browserless key configured for org:", organizationId);
    await updateSession(sessionId, {
      status: "error",
      error_message: "Configure sua chave Browserless na aba Configurações antes de iniciar a prospecção.",
    });
    throw new Error("Configure sua chave Browserless na aba Configurações");
  }
  
  if (!provider.browserless_configured) {
    await updateSession(sessionId, {
      status: "error",
      error_message: "Sua chave Browserless não está ativa. Verifique a configuração.",
    });
    throw new Error("Chave Browserless não está configurada corretamente");
  }
  
  // Decrypt the API key using AES-256-GCM with fallback
  let browserlessToken: string;
  try {
    browserlessToken = await decrypt(provider.browserless_api_key_encrypted);
  } catch (decryptError) {
    console.error("[visual-scraper] Failed to decrypt API key:", decryptError);
    await updateSession(sessionId, {
      status: "error",
      error_message: "Erro ao validar chave API. Reconfigure sua chave na aba Configurações.",
    });
    throw new Error("DECRYPTION_FAILED");
  }
  
  // Get anti-blocking settings (default to stealth enabled)
  const useStealthMode = provider.use_stealth_mode ?? true;
  const useResidentialProxy = provider.use_residential_proxy ?? false;
  
  // Get random user agent for this session
  const userAgent = getRandomUserAgent();
  
  console.log(`[visual-scraper] Anti-blocking settings: stealth=${useStealthMode}, proxy=${useResidentialProxy}`);
  
  console.log(`[visual-scraper] Starting consolidated scrape for: ${keyword} in ${location}`);
  console.log(`[visual-scraper] Session ID: ${sessionId}, Max Results: ${maxResults}`);
  
  await updateSession(sessionId, {
    status: "running",
    current_phase: "connecting",
    progress_percent: 5,
  });
  
  const query = encodeURIComponent(`${keyword} ${location}`);
  // Use hl=pt-BR to get Portuguese interface and help bypass consent
  const mapsUrl = `https://www.google.com/maps/search/${query}?hl=pt-BR`;
  
  console.log(`[visual-scraper] Maps URL: ${mapsUrl}`);
  
  try {
    await updateSession(sessionId, {
      current_phase: "navigating",
      current_url: mapsUrl,
      progress_percent: 10,
    });
    
    // ============================================
    // CONSOLIDATED APPROACH: Single /function call
    // All logic runs inside one browser session
    // ============================================
    
    // Calculate dynamic limits based on maxResults
    const dynamicMaxScrolls = Math.min(Math.ceil(maxResults / 15), 70);
    const dynamicMaxPhoneExtractions = Math.min(maxResults, 200);
    const dynamicScrollDelay = maxResults > 200 ? 2500 : 2000;
    
    console.log(`[visual-scraper] Dynamic limits: MAX_SCROLLS=${dynamicMaxScrolls}, MAX_PHONE_EXTRACTIONS=${dynamicMaxPhoneExtractions}`);
    
    const puppeteerCode = `
      export default async function({ page }) {
        const MAX_SCROLLS = ${dynamicMaxScrolls};
        const MAX_RESULTS = ${maxResults};
        const MAX_PHONE_EXTRACTIONS = ${dynamicMaxPhoneExtractions};
        const SCROLL_DELAY_BASE = ${dynamicScrollDelay};
        const SCROLL_DELAY_VARIANCE = 1500;
        const LOAD_WAIT = 6000;
        const PANEL_WAIT_BASE = 3000;
        const PANEL_WAIT_VARIANCE = 1000;
        const CLICK_RETRY_COUNT = 2;
        const MAX_CONSECUTIVE_PHONE_FAILURES = 15;
        
        // Helper for random delays (human-like behavior)
        function randomDelay(baseMs, varianceMs) {
          return baseMs + Math.floor(Math.random() * varianceMs);
        }
        
        console.log('[puppeteer] Starting consolidated extraction with anti-blocking features...');
        
        // Set custom User-Agent for this session
        await page.setUserAgent('${userAgent}');
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        });
        
        console.log('[puppeteer] User-Agent set, starting extraction...');
        
        // ============================================
        // PHONE VALIDATION FUNCTION - Brazilian format
        // ============================================
        function validateBrazilianPhone(phone) {
          if (!phone) return null;
          
          // Reject if contains decimal point (likely coordinates)
          if (phone.includes('.') && /\\d+\\.\\d+/.test(phone)) {
            console.log('[puppeteer] Rejected coordinate-like number:', phone);
            return null;
          }
          
          // Remove all non-digit characters
          const cleaned = phone.replace(/[^0-9]/g, '');
          
          // Must have between 10 and 13 digits
          if (cleaned.length < 10 || cleaned.length > 13) {
            console.log('[puppeteer] Rejected invalid length:', cleaned.length, 'digits');
            return null;
          }
          
          // Remove country code 55 if present
          let digits = cleaned;
          if (digits.startsWith('55') && digits.length >= 12) {
            digits = digits.substring(2);
          }
          
          // Validate DDD (must be 11-99)
          const ddd = parseInt(digits.substring(0, 2));
          if (ddd < 11 || ddd > 99) {
            console.log('[puppeteer] Rejected invalid DDD:', ddd);
            return null;
          }
          
          // Get local number (after DDD)
          const localNumber = digits.substring(2);
          
          // Must be 8 or 9 digits
          if (localNumber.length !== 8 && localNumber.length !== 9) {
            console.log('[puppeteer] Rejected invalid local number length:', localNumber.length);
            return null;
          }
          
          // If 9 digits, must start with 9 (mobile)
          if (localNumber.length === 9 && !localNumber.startsWith('9')) {
            console.log('[puppeteer] Rejected 9-digit number not starting with 9');
            return null;
          }
          
          // Reject trivial patterns
          if (/^(\\d)\\1{9,}$/.test(digits)) {
            console.log('[puppeteer] Rejected repeated digits pattern');
            return null;
          }
          
          if (digits.startsWith('1234') || digits.startsWith('0000')) {
            console.log('[puppeteer] Rejected trivial sequence');
            return null;
          }
          
          // Format to Brazilian standard
          if (digits.length === 11) {
            return '(' + digits.substring(0,2) + ') ' + digits.substring(2,7) + '-' + digits.substring(7);
          } else {
            return '(' + digits.substring(0,2) + ') ' + digits.substring(2,6) + '-' + digits.substring(6);
          }
        }
        
        // 1. Set cookies to bypass Google consent
        await page.setCookie(
          { name: 'CONSENT', value: 'YES+cb.20231031-04-p0.pt+FX+410', domain: '.google.com' },
          { name: 'SOCS', value: 'CAESEwgDEgk2ODI1MjY0ODQaAmVuIAEaBgiA_c-yBg', domain: '.google.com' },
          { name: 'AEC', value: 'AQABAKBxgUVW4gIGpq7BPXqKSFCsH-3yNQ3G6oTmOw7lqj8yHCnNNF0RJg', domain: '.google.com' }
        );
        
        // 2. Navigate to Google Maps with longer timeout
        console.log('[puppeteer] Navigating to Maps...');
        await page.goto('${mapsUrl}', { 
          waitUntil: 'networkidle0', 
          timeout: 90000 
        });
        
        console.log('[puppeteer] Page loaded, waiting for feed...');
        
        // 3. Check for CAPTCHA or block detection
        const isBlocked = await page.evaluate(() => {
          const indicators = [
            'unusual traffic',
            'captcha',
            'recaptcha',
            'g-recaptcha',
            'sorry',
            'blocked',
            'denied',
            'robot',
            'não é possível verificar',
            'tráfego incomum'
          ];
          const text = document.body.innerText.toLowerCase();
          return indicators.some(ind => text.includes(ind.toLowerCase()));
        });
        
        if (isBlocked) {
          console.log('[puppeteer] BLOCK/CAPTCHA detected!');
          return { 
            type: 'application/json',
            data: JSON.stringify({ 
              error: 'BLOCK_DETECTED',
              message: 'Acesso bloqueado pelo Google. Tente ativar Proxy Residencial nas configurações.',
              leads: [],
              totalExtracted: 0,
              leadsWithPhone: 0
            })
          };
        }
        
        // 4. Wait for the results feed with fallback selectors
        let feedFound = false;
        
        try {
          await page.waitForSelector('div[role="feed"]', { timeout: 25000 });
          feedFound = true;
          console.log('[puppeteer] Found div[role="feed"]');
        } catch (e) {
          console.log('[puppeteer] Primary feed selector not found, trying alternatives...');
        }
        
        if (!feedFound) {
          try {
            await page.waitForSelector('[role="main"]', { timeout: 15000 });
            console.log('[puppeteer] Found [role="main"] as fallback');
          } catch (e) {
            console.log('[puppeteer] No main container found');
          }
        }
        
        // 4. Wait for business cards to appear
        try {
          await page.waitForSelector('a.hfpxzc', { timeout: 20000 });
          console.log('[puppeteer] Found business cards (a.hfpxzc)');
        } catch (e) {
          console.log('[puppeteer] Business cards not found with primary selector');
        }
        
        // 5. Extra wait for dynamic content to fully render
        console.log('[puppeteer] Waiting extra time for content to render...');
        await new Promise(r => setTimeout(r, LOAD_WAIT));
        
        // 6. Take initial screenshot (compressed)
        console.log('[puppeteer] Taking initial screenshot...');
        const initialScreenshot = await page.screenshot({ 
          encoding: 'base64',
          type: 'jpeg',
          quality: 50
        });
        
        // 7. SCROLL LOOP - Keep scrolling and extracting until we have enough results
        let allLeads = [];
        let previousCount = 0;
        let noNewResultsCount = 0;
        
        for (let scrollIndex = 0; scrollIndex < MAX_SCROLLS; scrollIndex++) {
          console.log('[puppeteer] Scroll iteration:', scrollIndex + 1);
          
          // Scroll the feed container
          await page.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) {
              feed.scrollTop = feed.scrollHeight;
            } else {
              // Fallback: scroll the main scrollable element
              const main = document.querySelector('[role="main"]');
              if (main) {
                main.scrollTop = main.scrollHeight;
              } else {
                window.scrollBy(0, 800);
              }
            }
          });
          
          // Wait for new content to load (randomized delay for human-like behavior)
          await new Promise(r => setTimeout(r, randomDelay(SCROLL_DELAY_BASE, SCROLL_DELAY_VARIANCE)));
          
          // Extract leads from current page state
          const extractedLeads = await page.evaluate(() => {
            const results = [];
            const seenNames = new Set();
            
            // Primary selector: business card links
            const cards = document.querySelectorAll('a.hfpxzc');
            cards.forEach(card => {
              const ariaLabel = card.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.length > 2 && !seenNames.has(ariaLabel)) {
                seenNames.add(ariaLabel);
                results.push({
                  business_name: ariaLabel,
                  href: card.href || null,
                  phone: null
                });
              }
            });
            
            // Fallback: article elements
            if (results.length === 0) {
              const articles = document.querySelectorAll('[role="article"]');
              articles.forEach(article => {
                const nameEl = article.querySelector('h3, .fontHeadlineSmall, .fontBodyMedium');
                if (nameEl && nameEl.textContent) {
                  const name = nameEl.textContent.trim();
                  if (!seenNames.has(name)) {
                    seenNames.add(name);
                    results.push({
                      business_name: name,
                      href: null,
                      phone: null
                    });
                  }
                }
              });
            }
            
            return results;
          });
          
          // Update our lead list (deduplicated)
          const existingNames = new Set(allLeads.map(l => l.business_name));
          const newLeads = extractedLeads.filter(l => !existingNames.has(l.business_name));
          allLeads = [...allLeads, ...newLeads];
          
          console.log('[puppeteer] Total leads so far:', allLeads.length, 'New this scroll:', newLeads.length);
          
          // Check if we've reached our target
          if (allLeads.length >= MAX_RESULTS) {
            console.log('[puppeteer] Reached max results, stopping scroll');
            break;
          }
          
          // Check if we're getting new results
          if (allLeads.length === previousCount) {
            noNewResultsCount++;
            if (noNewResultsCount >= 3) {
              console.log('[puppeteer] No new results for 3 scrolls, stopping');
              break;
            }
          } else {
            noNewResultsCount = 0;
          }
          
          previousCount = allLeads.length;
        }
        
        // 8. IMPROVED PHONE EXTRACTION LOOP with consecutive failure protection
        console.log('[puppeteer] Starting improved phone extraction for up to', MAX_PHONE_EXTRACTIONS, 'leads...');
        
        const leadsToProcess = allLeads.slice(0, Math.min(MAX_PHONE_EXTRACTIONS, allLeads.length));
        let validPhonesFound = 0;
        let invalidPhonesRejected = 0;
        let consecutivePhoneFailures = 0;
        
        for (let i = 0; i < leadsToProcess.length; i++) {
          try {
            console.log('[puppeteer] Extracting phone for lead', i + 1, '/', leadsToProcess.length, ':', leadsToProcess[i].business_name);
            
            // Re-fetch cards (DOM may have changed)
            const cards = await page.$$('a.hfpxzc');
            
            // Find the card that matches this lead by aria-label
            let targetCard = null;
            for (const card of cards) {
              const label = await card.evaluate(el => el.getAttribute('aria-label'));
              if (label === leadsToProcess[i].business_name) {
                targetCard = card;
                break;
              }
            }
            
            if (!targetCard) {
              console.log('[puppeteer] Could not find card for:', leadsToProcess[i].business_name);
              continue;
            }
            
            // IMPROVEMENT: Scroll card into viewport before clicking
            await targetCard.evaluate(el => {
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
            });
            await new Promise(r => setTimeout(r, 500));
            
            // Click on the card to open the details panel
            let panelOpened = false;
            
            for (let attempt = 0; attempt < CLICK_RETRY_COUNT; attempt++) {
              await targetCard.click();
              await new Promise(r => setTimeout(r, randomDelay(PANEL_WAIT_BASE, PANEL_WAIT_VARIANCE)));
              
              // Verify if panel opened by looking for phone button or main content
              panelOpened = await page.evaluate(() => {
                // Look for phone button in the details panel
                const phoneBtn = document.querySelector('button[data-item-id^="phone"]');
                if (phoneBtn) return true;
                
                // Fallback: look for the side panel with business details
                const panel = document.querySelector('[role="main"]');
                if (panel) {
                  const hasDetails = panel.querySelector('[data-item-id], .fontBodyMedium');
                  return !!hasDetails;
                }
                
                return false;
              });
              
              if (panelOpened) {
                console.log('[puppeteer] Panel opened on attempt', attempt + 1);
                break;
              } else {
                console.log('[puppeteer] Panel not opened, retrying...');
              }
            }
            
            if (!panelOpened) {
              console.log('[puppeteer] Could not open panel for:', leadsToProcess[i].business_name);
              try {
                await page.keyboard.press('Escape');
                await new Promise(r => setTimeout(r, 300));
              } catch (e) {}
              continue;
            }
            
            // IMPROVED PHONE EXTRACTION with better selectors
            const phoneData = await page.evaluate(() => {
              let rawPhone = null;
              let hasWhatsApp = false;
              
              // Priority 1: Button with data-item-id starting with "phone:tel"
              const phoneButtons = document.querySelectorAll('button[data-item-id^="phone:tel"], button[data-item-id*="phone"]');
              for (const btn of phoneButtons) {
                const ariaLabel = btn.getAttribute('aria-label');
                if (ariaLabel) {
                  // Extract just the phone from the label
                  rawPhone = ariaLabel;
                  break;
                }
                // Try text content
                const text = btn.textContent;
                if (text && /\\d/.test(text)) {
                  rawPhone = text;
                  break;
                }
              }
              
              // Priority 2: tel: links
              if (!rawPhone) {
                const telLinks = document.querySelectorAll('a[href^="tel:"]');
                for (const link of telLinks) {
                  const href = link.getAttribute('href');
                  if (href) {
                    rawPhone = href.replace('tel:', '');
                    break;
                  }
                }
              }
              
              // Priority 3: Elements with Telefone aria-label
              if (!rawPhone) {
                const phoneElements = document.querySelectorAll('[aria-label*="Telefone"], [aria-label*="Phone"], [aria-label*="Ligar"]');
                for (const el of phoneElements) {
                  const label = el.getAttribute('aria-label');
                  if (label) {
                    rawPhone = label;
                    break;
                  }
                }
              }
              
              // Priority 4: Search in the side panel text with specific patterns
              if (!rawPhone) {
                const sidePanel = document.querySelector('[role="main"]');
                if (sidePanel) {
                  const text = sidePanel.textContent || '';
                  // Brazilian phone patterns (more specific)
                  const patterns = [
                    /\\(\\d{2}\\)\\s*9\\d{4}[\\s-]?\\d{4}/,  // (XX) 9XXXX-XXXX (mobile)
                    /\\(\\d{2}\\)\\s*\\d{4}[\\s-]?\\d{4}/,   // (XX) XXXX-XXXX (landline)
                    /\\d{2}\\s+9\\s*\\d{4}[\\s-]?\\d{4}/     // XX 9 XXXX-XXXX
                  ];
                  for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) {
                      rawPhone = match[0];
                      break;
                    }
                  }
                }
              }
              
              // Check for WhatsApp
              const whatsappLinks = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
              if (whatsappLinks.length > 0) {
                hasWhatsApp = true;
              }
              
              // Also check text for WhatsApp mention
              if (!hasWhatsApp) {
                const pageText = document.body.innerText.toLowerCase();
                if (pageText.includes('whatsapp') || pageText.includes('whats app')) {
                  hasWhatsApp = true;
                }
              }
              
              return { rawPhone, hasWhatsApp };
            });
            
            if (phoneData.rawPhone) {
              // VALIDATE the phone number
              const validatedPhone = validateBrazilianPhone(phoneData.rawPhone);
              
              if (validatedPhone) {
                console.log('[puppeteer] Valid phone for', leadsToProcess[i].business_name, ':', validatedPhone);
                
                // Update the lead in allLeads array
                const leadIndex = allLeads.findIndex(l => l.business_name === leadsToProcess[i].business_name);
                if (leadIndex !== -1) {
                  allLeads[leadIndex].phone = validatedPhone;
                  allLeads[leadIndex].hasWhatsApp = phoneData.hasWhatsApp;
                }
                validPhonesFound++;
              consecutivePhoneFailures = 0; // Reset on success
              } else {
                console.log('[puppeteer] Rejected invalid phone for', leadsToProcess[i].business_name, ':', phoneData.rawPhone);
                invalidPhonesRejected++;
                consecutivePhoneFailures++;
              }
            } else {
              console.log('[puppeteer] No phone found for:', leadsToProcess[i].business_name);
              consecutivePhoneFailures++;
            }
            
            // Protection against infinite loop - stop after too many consecutive failures
            if (consecutivePhoneFailures >= MAX_CONSECUTIVE_PHONE_FAILURES) {
              console.log('[puppeteer] Too many consecutive phone failures (', consecutivePhoneFailures, '), stopping phone extraction');
              break;
            }
            
            // Close the panel by pressing Escape
            await page.keyboard.press('Escape');
            await new Promise(r => setTimeout(r, 800));
            
          } catch (cardError) {
            console.log('[puppeteer] Error extracting phone for lead', i, ':', cardError.message);
            // Try to close any open panel
            try {
              await page.keyboard.press('Escape');
              await new Promise(r => setTimeout(r, 500));
            } catch (e) {}
          }
        }
        
        // 9. Take final screenshot
        console.log('[puppeteer] Taking final screenshot...');
        const finalScreenshot = await page.screenshot({ 
          encoding: 'base64',
          type: 'jpeg',
          quality: 50
        });
        
        // Count leads with phones
        const leadsWithPhone = allLeads.filter(l => l.phone).length;
        console.log('[puppeteer] Extraction complete. Total leads:', allLeads.length, 'Valid phones:', validPhonesFound, 'Rejected:', invalidPhonesRejected);
        
        // 10. Return results
        return { 
          type: 'application/json',
          data: JSON.stringify({ 
            leads: allLeads.slice(0, MAX_RESULTS),
            initialScreenshot,
            finalScreenshot,
            totalExtracted: allLeads.length,
            leadsWithPhone: leadsWithPhone,
            validPhonesFound: validPhonesFound,
            invalidPhonesRejected: invalidPhonesRejected,
            scrollCount: Math.min(allLeads.length > 0 ? 15 : 0, 15)
          })
        };
      }
    `;
    
    console.log(`[visual-scraper] Sending request to Browserless with stealth=${useStealthMode}, proxy=${useResidentialProxy}...`);
    
    // Build the Browserless URL with anti-blocking options
    const browserlessUrl = buildBrowserlessUrl(browserlessToken, useStealthMode, useResidentialProxy);
    console.log(`[visual-scraper] Browserless endpoint: ${browserlessUrl.split('?')[0]}`);
    
    const functionResponse = await fetch(
      browserlessUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: puppeteerCode,
        }),
      }
    );
    
    if (!functionResponse.ok) {
      const errorBody = await functionResponse.text();
      const status = functionResponse.status;
      console.error(`[visual-scraper] Browserless /function error (${status}):`, errorBody);
      
      // Generate specific error message based on HTTP status
      let errorMessage = "";
      
      if (status === 429) {
        errorMessage = "Limite de requisições atingido (429). Aguarde 60 segundos e tente novamente.";
      } else if (status === 408) {
        errorMessage = "Tempo limite excedido (408). Reduza a quantidade de resultados e tente novamente.";
      } else if (status === 401 || status === 403) {
        errorMessage = "Chave Browserless inválida ou sem permissão. Verifique sua configuração.";
      } else if (status === 503) {
        errorMessage = "Serviço Browserless indisponível (503). Aguarde 2-5 minutos e tente novamente.";
      } else if (status === 500) {
        errorMessage = "Erro interno do servidor Browserless (500). Aguarde 1-2 minutos e tente novamente.";
      } else {
        errorMessage = `Erro Browserless: ${status} - ${errorBody.substring(0, 200)}`;
      }
      
      await updateSession(sessionId, {
        status: "failed",
        error_message: errorMessage,
      });
      
      throw new Error(errorMessage);
    }
    
    // Parse the response - Browserless /function returns varied formats
    const responseText = await functionResponse.text();
    console.log(`[visual-scraper] Response received, length: ${responseText.length}`);
    console.log(`[visual-scraper] Response first 300 chars:`, responseText.substring(0, 300));
    
    let functionResult: {
      leads: Array<{ business_name: string; href?: string; phone?: string | null }>;
      initialScreenshot?: string;
      finalScreenshot?: string;
      totalExtracted: number;
      leadsWithPhone?: number;
    };
    
    try {
      // The response from /function can be wrapped in various formats
      let parsed = JSON.parse(responseText);
      
      // Check if it's wrapped in a 'data' field (common Browserless format)
      if (parsed.data && typeof parsed.data === 'string') {
        console.log(`[visual-scraper] Found wrapped data, parsing inner JSON...`);
        parsed = JSON.parse(parsed.data);
      }
      
      // Check if leads are nested
      if (parsed.result && parsed.result.leads) {
        functionResult = parsed.result;
      } else {
        functionResult = parsed;
      }
      
      console.log(`[visual-scraper] Parsed result - leads: ${functionResult.leads?.length || 0}`);
      
      // Log some lead names for debugging
      if (functionResult.leads && functionResult.leads.length > 0) {
        console.log(`[visual-scraper] First 3 leads:`, functionResult.leads.slice(0, 3).map(l => l.business_name));
      }
    } catch (parseError) {
      console.error(`[visual-scraper] Failed to parse response:`, parseError);
      console.log(`[visual-scraper] Raw response (first 1000 chars):`, responseText.substring(0, 1000));
      throw new Error("Failed to parse Browserless response");
    }
    
    // Update session with screenshot
    if (functionResult.finalScreenshot || functionResult.initialScreenshot) {
      await updateSession(sessionId, {
        current_screenshot: functionResult.finalScreenshot || functionResult.initialScreenshot,
        current_phase: "extracting",
        progress_percent: 50,
      });
    }
    
    // Convert to ScrapedLead format
    const leads: ScrapedLead[] = (functionResult.leads || []).map((lead) => ({
      business_name: lead.business_name,
      phone: lead.phone || null,
      email: null,
      website: lead.href || null,
      address: null,
      rating: null,
      review_count: null,
      category: null,
      social_urls: {},
      has_whatsapp: lead.phone ? true : false,
      source_url: mapsUrl,
    }));
    
    console.log(`[visual-scraper] Converted ${leads.length} leads to ScrapedLead format`);
    
    if (leads.length > 0) {
      // SAVE LEADS IN BATCHES - prevent DB timeout for large volumes
      const SAVE_BATCH_SIZE = 100;
      const leadsToSave = leads.slice(0, maxResults);
      
      await updateSession(sessionId, {
        current_phase: "saving",
        progress_percent: 70,
        total_found: leadsToSave.length,
      });
      
      console.log(`[visual-scraper] Saving ${leadsToSave.length} leads in batches of ${SAVE_BATCH_SIZE}...`);
      
      for (let batchStart = 0; batchStart < leadsToSave.length; batchStart += SAVE_BATCH_SIZE) {
        const batch = leadsToSave.slice(batchStart, batchStart + SAVE_BATCH_SIZE);
        
        console.log(`[visual-scraper] Saving batch ${Math.floor(batchStart / SAVE_BATCH_SIZE) + 1}: leads ${batchStart + 1}-${batchStart + batch.length}`);
        await saveLeads(sessionId, organizationId, batch);
        
        // Update progress incrementally
        const saveProgress = 70 + ((batchStart + batch.length) / leadsToSave.length) * 10;
        await updateSession(sessionId, {
          progress_percent: Math.round(saveProgress),
          total_found: batchStart + batch.length,
        });
      }
      
      console.log(`[visual-scraper] All ${leadsToSave.length} leads saved successfully`);
      
      // Enrich only top 5 leads for performance (avoid CPU timeout)
      const leadsToEnrich = leads.slice(0, Math.min(5, maxResults)).filter(l => l.website);
      
      if (leadsToEnrich.length > 0) {
        try {
          await updateSession(sessionId, {
            current_phase: "enriching",
            progress_percent: 80,
          });
          
          const enrichedLeads = await enrichLeadsWithWebsites(
            browserlessToken,
            leadsToEnrich,
            sessionId
          );
          
          await updateEnrichedLeads(sessionId, organizationId, enrichedLeads);
          console.log(`[visual-scraper] Enriched ${enrichedLeads.length} leads`);
        } catch (enrichError) {
          // Enrichment is optional - don't fail the whole process
          console.warn(`[visual-scraper] Enrichment failed:`, enrichError);
        }
      }
    }
    
    await updateSession(sessionId, {
      status: "completed",
      current_phase: "done",
      completed_at: new Date().toISOString(),
      total_found: leads.length,
      progress_percent: 100,
    });
    
    // Update search record status
    const supabase = getSupabaseAdmin();
    await supabase
      .from("prospect_searches")
      .update({ status: "completed", total_results: leads.length, completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    
    console.log(`[visual-scraper] Completed scraping: ${leads.length} leads`);
    
    return { success: true, total: leads.length };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[visual-scraper] Error:`, error);
    await updateSession(sessionId, {
      status: "failed",
      error_message: errorMessage,
      progress_percent: 0,
    });
    
    // Also update prospect_searches to keep in sync
    const supabase = getSupabaseAdmin();
    await supabase
      .from("prospect_searches")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    
    console.log(`[visual-scraper] Failed and synced prospect_searches for session ${sessionId}`);
    throw error;
  }
}

// Enrich leads by scraping their websites
async function enrichLeadsWithWebsites(
  browserlessToken: string,
  leads: ScrapedLead[],
  sessionId: string
): Promise<ScrapedLead[]> {
  const enrichedLeads: ScrapedLead[] = [];
  let processed = 0;
  
  for (const lead of leads) {
    if (!lead.website) {
      enrichedLeads.push(lead);
      continue;
    }
    
    try {
      // Use content API to scrape website
      const response = await fetch(
        `${BROWSERLESS_BASE_URL}/content?token=${browserlessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: lead.website,
            gotoOptions: {
              waitUntil: "domcontentloaded",
              timeout: 15000,
            },
          }),
        }
      );
      
      if (response.ok) {
        const html = await response.text();
        
        // Extract email
        const emails = html.match(EMAIL_PATTERN) || [];
        if (emails.length > 0 && !lead.email) {
          lead.email = emails[0] ?? null;
        }
        
        // Extract phones
        for (const pattern of PHONE_PATTERNS) {
          const phones = html.match(pattern) || [];
          if (phones.length > 0 && !lead.phone) {
            lead.phone = phones[0] ?? null;
            break;
          }
        }
        
        // Check for WhatsApp
        if (html.includes("wa.me") || html.includes("whatsapp") || html.includes("api.whatsapp")) {
          lead.has_whatsapp = true;
          
          // Try to extract WhatsApp number
          const waMatch = html.match(/wa\.me\/(\d{12,13})/);
          if (waMatch && waMatch[1] && !lead.phone) {
            lead.phone = waMatch[1];
            lead.has_whatsapp = true;
          }
        }
        
        // Extract social URLs
        for (const [network, pattern] of Object.entries(SOCIAL_PATTERNS)) {
          const matches = html.match(pattern);
          if (matches && matches.length > 0) {
            lead.social_urls[network] = matches[0];
          }
        }
      }
      
      enrichedLeads.push(lead);
      processed++;
      
      // Update progress
      await updateSession(sessionId, {
        progress_percent: 80 + Math.round((processed / leads.length) * 15),
        current_phase: `enriching (${processed}/${leads.length})`,
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`[visual-scraper] Failed to enrich ${lead.website}:`, error);
      enrichedLeads.push(lead);
    }
  }
  
  return enrichedLeads;
}

// Update enriched leads in database
async function updateEnrichedLeads(
  sessionId: string,
  _organizationId: string,
  leads: ScrapedLead[]
) {
  const supabase = getSupabaseAdmin();
  
  for (const lead of leads) {
    await supabase
      .from("prospect_results")
      .update({
        phone: lead.phone,
        email: lead.email,
        has_whatsapp: lead.has_whatsapp,
        social_urls: lead.social_urls,
        ai_score: calculateScore(lead),
      })
      .eq("search_id", sessionId)
      .eq("business_name", lead.business_name);
  }
}

// Background processing
async function processInBackground(
  sessionId: string,
  organizationId: string,
  keyword: string,
  location: string,
  maxResults: number
) {
  try {
    await scrapeGoogleMaps(sessionId, organizationId, keyword, location, maxResults);
  } catch (error) {
    console.error("[visual-scraper] Background processing failed:", error);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, keyword, location, maxResults = 100, session_id } = body;

    if (action === "start") {
      if (!keyword) {
        return new Response(
          JSON.stringify({ error: "Keyword is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create session
      const adminClient = getSupabaseAdmin();
      const { data: session, error: sessionError } = await adminClient
        .from("visual_scrape_sessions")
        .insert({
          organization_id: orgMember.organization_id,
          keyword,
          location: location || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (sessionError) {
        throw sessionError;
      }

      console.log(`[visual-scraper] Created session: ${session.id}`);

      // Start background processing using globalThis.EdgeRuntime
      const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (runtime?.waitUntil) {
        runtime.waitUntil(
          processInBackground(
            session.id,
            orgMember.organization_id,
            keyword,
            location || "",
            maxResults
          )
        );
      } else {
        // Fallback: run without waitUntil (may timeout)
        processInBackground(
          session.id,
          orgMember.organization_id,
          keyword,
          location || "",
          maxResults
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          session_id: session.id,
          message: "Scraping started",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "stop" && session_id) {
      const adminClient = getSupabaseAdmin();
      const { error: sessionErr } = await adminClient
        .from("visual_scrape_sessions")
        .update({
          status: "stopped",
          completed_at: new Date().toISOString(),
        })
        .eq("id", session_id)
        .eq("organization_id", orgMember.organization_id);
      
      if (sessionErr) {
        console.error(`[visual-scraper] ERROR updating visual_scrape_sessions: ${sessionErr.message}`, sessionErr);
      }
      
      // Get the total found from the session to update prospect_searches
      const { data: sessionData } = await adminClient
        .from("visual_scrape_sessions")
        .select("total_found")
        .eq("id", session_id)
        .single();
      
      // Also update prospect_searches to keep in sync
      const { error: searchErr } = await adminClient
        .from("prospect_searches")
        .update({
          status: "stopped",
          total_results: sessionData?.total_found || 0,
          error_message: "Busca interrompida pelo usuário",
          completed_at: new Date().toISOString(),
        })
        .eq("id", session_id);
      
      if (searchErr) {
        console.error(`[visual-scraper] ERROR updating prospect_searches: ${searchErr.message}`, searchErr);
      }
      
      console.log(`[visual-scraper] Stopped session ${session_id} with ${sessionData?.total_found || 0} leads and synced prospect_searches`);

      return new Response(
        JSON.stringify({ success: true, message: "Scraping stopped" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "status" && session_id) {
      const { data: session } = await supabase
        .from("visual_scrape_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Check if session is stale and should be auto-terminated
      if (session.status === "running") {
        const lastActivity = new Date(session.updated_at || session.created_at);
        const elapsed = Date.now() - lastActivity.getTime();
        
        if (elapsed > STALE_SESSION_TIMEOUT_MS) {
          console.log(`[visual-scraper] Session ${session_id} is stale (${Math.round(elapsed / 1000)}s inactive), auto-terminating`);
          
          const adminClient = getSupabaseAdmin();
          await adminClient
            .from("visual_scrape_sessions")
            .update({
              status: "failed",
              error_message: "Sessão expirada por inatividade",
              completed_at: new Date().toISOString(),
            })
            .eq("id", session_id);
          
          // Also update prospect_searches
          await adminClient
            .from("prospect_searches")
            .update({
              status: "failed",
              error_message: "Sessão expirada por inatividade",
              completed_at: new Date().toISOString(),
            })
            .eq("id", session_id);
          
          // Fetch updated session
          const { data: updatedSession } = await supabase
            .from("visual_scrape_sessions")
            .select("*")
            .eq("id", session_id)
            .single();
          
          const { data: leads } = await supabase
            .from("prospect_results")
            .select("*")
            .eq("search_id", session_id)
            .order("created_at", { ascending: false });
          
          return new Response(
            JSON.stringify({
              success: true,
              session: updatedSession,
              leads: leads || [],
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Get leads for this session
      const { data: leads } = await supabase
        .from("prospect_results")
        .select("*")
        .eq("search_id", session_id)
        .order("created_at", { ascending: false });

      return new Response(
        JSON.stringify({
          success: true,
          session,
          leads: leads || [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[visual-scraper] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
