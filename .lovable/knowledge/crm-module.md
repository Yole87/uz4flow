# CRM Module Architecture

## 1. UI Integration

- **Entry Point:** A new button in the Main Sidebar named "CRM" (icon: MessageSquare or Users).
- **Layout:** When accessed, the main content area switches to the "WhatsApp Web Clone" layout (3 Panes: Contacts | Chat | Inspector).
- **Theme:** The CRM internal area uses specific Dark Mode (Zinc-900) to resemble WhatsApp, even if the main SaaS uses a different theme.

## 2. Hybrid Connectivity (Backend)

- **Table `instances`:** Stores connection data. Must have `provider` column (ENUM: 'evolution_api', 'meta_official').
- **Logic:** Support multiple instances per Organization.

## 3. Database Schema Extension

The following tables are required for the CRM module, all linked to `organizations`:

### Core Tables

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `instances` | WhatsApp connection instances | organization_id, provider (evolution_api/meta_official) |
| `contacts` | Leads/contacts management | organization_id, instance_id, ai_analysis (JSONB) |
| `conversations` | Chat threads | contact_id, instance_id |
| `messages` | Individual messages | conversation_id, direction (inbound/outbound) |
| `pipelines` | Sales pipelines | organization_id |
| `stages` | Kanban stages within pipelines | pipeline_id, order_index |

### Table Details

#### instances
- id, organization_id, name, provider, api_url, api_key_encrypted, phone_number, status, qr_code, created_at, updated_at

#### contacts
- id, organization_id, instance_id, phone, name, email, avatar_url, tags, metadata, pipeline_stage_id, ai_analysis (JSONB), created_at, updated_at

#### conversations
- id, contact_id, instance_id, status (active/archived), last_message_at, unread_count, created_at, updated_at

#### messages
- id, conversation_id, message_id_external, direction (inbound/outbound), content_type (text/image/audio/video/document), content, media_url, status (sent/delivered/read/failed), timestamp, created_at

#### pipelines
- id, organization_id, name, is_default, created_at, updated_at

#### stages
- id, pipeline_id, name, color, order_index, created_at, updated_at

## 4. Component Structure

```
src/
├── pages/
│   ├── CRM.tsx                    # Main CRM page with 3-pane layout
│   └── Kanban.tsx                 # Pipeline Kanban board view
├── components/
│   └── crm/
│       ├── CRMLayout.tsx          # 3-pane container with dark theme
│       ├── ContactsPane.tsx       # Left pane - contact list
│       ├── ChatPane.tsx           # Center pane - conversation
│       ├── InspectorPane.tsx      # Right pane - contact details
│       ├── MessageBubble.tsx      # Individual message component
│       ├── ContactListItem.tsx    # Contact in list
│       ├── InstanceSelector.tsx   # Switch between WhatsApp instances
│       ├── AddInstanceDialog.tsx  # Modal to create new WhatsApp connections
│       ├── CRMEmptyState.tsx      # Shown when no instances configured
│       ├── MockDataGenerator.tsx  # Dev tool to seed demo data
│       ├── ChatHeaderMenu.tsx     # Three-dots menu in chat header
│       ├── AIInsightsCard.tsx     # AI analysis display card
│       ├── KanbanBoard.tsx        # Main Kanban board component
│       ├── KanbanColumn.tsx       # Individual stage column
│       └── KanbanCard.tsx         # Draggable contact card
└── hooks/
    └── useUserOrganization.ts     # Get current user's organization
```

## 5. Routes

- `/crm` - Main CRM interface (Chat view)
- `/kanban` - Pipeline Kanban board with drag-and-drop
- `/prospection` - AI-powered lead prospecting module
- `/crm/settings` - CRM settings and instance management

## 6. Edge Functions

### analyze-conversation
- **Purpose:** AI-powered conversation analysis using Lovable AI (Gemini)
- **Input:** `contact_id`
- **Output:** JSON with summary, sentiment, suggested_reply, next_action, interest_level
- **Storage:** Saves analysis to `contacts.ai_analysis` JSONB column

### manage-prospect-provider
- **Purpose:** Manage prospecting provider credentials (Google CSE, Firecrawl)
- **Actions:** get, save, set-active, test-google, test-firecrawl
- **Storage:** Encrypted credentials in `prospect_providers` table

### prospect-leads
- **Purpose:** Search for leads using selected provider + AI enrichment
- **Providers:** Google Custom Search (free tier), Firecrawl (premium)
- **AI:** Uses Lovable AI (Gemini 2.5 Flash) for data extraction and scoring
- **Output:** Leads with phone, email, social URLs, WhatsApp flag, AI score (0-100)

## 7. Features

### Chat Interface
- Real-time messaging with optimistic UI
- Auto-reply simulation for testing
- Message persistence to Supabase
- Header menu with actions (toggle inspector, change stage, clear conversation, block)

### Inspector Panel
- Contact details and info
- Editable tags with add/remove
- Editable notes persisted to metadata
- AI Insights card with conversation analysis

### Kanban Board
- Visual pipeline with drag-and-drop (@dnd-kit)
- Contact cards with avatar, last message, time in stage
- Priority badges based on tags
- Real-time stage updates on drop

## 8. RLS Policies

All CRM tables have RLS policies based on `organization_id` membership, similar to existing tables.

## 9. Dual-API Payload Formats (OpenBot Inbound)

The system accepts two payload formats from OpenBot, handled transparently:

### API Baileys (WhatsApp Web)
- `messageType` uses Baileys names: `conversation`, `audioMessage`, `imageMessage`, `videoMessage`, `documentMessage`
- Media is delivered via **URL** inside nested message objects (e.g. `message.audioMessage.url`)
- Audio includes `waveform`, `ptt`, `seconds`, `fileSha256`

### API Oficial (WhatsApp Business)
- `messageType` uses standard names: `text`, `audio`, `image`, `video`, `document`
- Media is delivered via **Base64** in a top-level `media` object (`media.data`, `media.mimetype`, `media.size`)
- No nested media objects inside `message`

### Common Fields (both APIs)
Both formats share: `instanceId`, `chatId`, `fromMe`, `timestamp`, `pushName`, `fluxo` (flow metadata), `key` (message ID + remoteJid).

### Detection Logic
The backend differentiates by checking `messageType`:
- Baileys types (`conversation`, `audioMessage`, etc.) → extract media from `message.[type]`
- Official types (`text`, `audio`, etc.) → extract media from `payload.media`

Types defined in: `supabase/functions/mcp-gateway/openbot.types.ts`
