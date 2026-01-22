/**
 * Marketplace Types - Two-Sided Platform Model
 *
 * Writers (Creators) and Readers (Industry) with sharing dynamics
 */

// =============================================================================
// User Types
// =============================================================================

export type UserType = 'writer' | 'reader' | 'enterprise';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  user_type: UserType;
  writer_code: string;  // Unique shareable code for writers
  reader_code: string;  // Unique code for readers to give to writers
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Subscription Types
// =============================================================================

export type SubscriptionPlan = 'writer_basic' | 'writer_pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;

  // Stripe
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;

  // Billing period
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;

  // Usage limits
  generations_used: number;
  generations_limit: number;
  downloads_used: number;
  downloads_limit: number;

  created_at: string;
  updated_at: string;
}

export interface SubscriptionLimits {
  generations_remaining: number;
  generations_limit: number;
  downloads_remaining: number;
  downloads_limit: number;
  period_ends: string | null;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, { generations: number; downloads: number; price_monthly: number }> = {
  writer_basic: { generations: 5, downloads: 1, price_monthly: 1000 },  // $10
  writer_pro: { generations: 15, downloads: 5, price_monthly: 2000 },   // $20
  enterprise: { generations: 100, downloads: 50, price_monthly: 50000 }, // $500
};

// =============================================================================
// Sharing Types
// =============================================================================

export type AccessLevel = 'stream' | 'download';

export interface ScriptShare {
  id: string;
  project_id: string;
  shared_by: string;
  shared_with: string | null;  // Null for link-based shares
  share_token: string;
  access_level: AccessLevel;
  via_reader_code: string | null;  // Which reader code was used
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

export interface ShareLink {
  url: string;
  token: string;
  qr_code_url?: string;
  expires_at?: string;
}

export interface CreateShareRequest {
  project_id: string;
  access_level?: AccessLevel;
  expires_in_hours?: number;
  recipient_email?: string;  // Optional direct share
}

// =============================================================================
// Reader Library Types
// =============================================================================

export type LibrarySource = 'received' | 'uploaded' | 'purchased';
export type LibraryStatus = 'active' | 'archived' | 'removed';

export interface ReaderLibraryEntry {
  id: string;
  reader_id: string;
  project_id: string;
  source: LibrarySource;
  share_id: string | null;
  status: LibraryStatus;
  is_favorited: boolean;
  notes: string | null;
  tags: string[] | null;
  last_played_at: string | null;
  play_position_seconds: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

// Extended with project/writer info
export interface ReaderLibraryEntryDetailed extends ReaderLibraryEntry {
  script_name: string;
  page_count: number;
  writer_name: string;
  writer_code: string;
  writer_subscribed: boolean;  // If false, content is archived
  audio_url?: string;
  duration_seconds?: number;
}

// =============================================================================
// Purchase Types
// =============================================================================

export type PurchaseType =
  | 'processing'      // Reader upload processing ($5)
  | 'ocr_processing'  // Reader OCR processing ($8)
  | 'unlock'          // Unlock archived script ($5)
  | 'download'        // Royalty-free download ($25)
  | 'subscription'    // Subscription payment
  | 'generation';     // Pay-per-generation (if over limit)

export interface Purchase {
  id: string;
  user_id: string;
  project_id: string | null;
  purchase_type: PurchaseType;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: string;
}

export const PURCHASE_PRICES: Record<PurchaseType, number> = {
  processing: 500,      // $5
  ocr_processing: 800,  // $8
  unlock: 500,          // $5
  download: 2500,       // $25
  subscription: 0,      // Varies
  generation: 300,      // $3 per extra generation
};

// =============================================================================
// Content Access Types
// =============================================================================

export type AccessType = 'stream_start' | 'stream_end' | 'download' | 'share_create' | 'share_click';

export interface ContentAccessLog {
  id: string;
  user_id: string | null;
  project_id: string;
  share_id: string | null;
  access_type: AccessType;
  start_position_seconds: number | null;
  end_position_seconds: number | null;
  duration_seconds: number | null;
  device_type: 'mobile' | 'tablet' | 'desktop' | null;
  created_at: string;
}

// =============================================================================
// Writer Dashboard Types
// =============================================================================

export interface WriterScriptSummary {
  project_id: string;
  name: string;
  status: string;
  page_count: number;
  created_at: string;
  share_count: number;
  reader_count: number;
  total_views: number;
  audio_generated: boolean;
  audio_url?: string;
}

export interface WriterDashboard {
  subscription: Subscription | null;
  limits: SubscriptionLimits;
  scripts: WriterScriptSummary[];
  total_scripts: number;
  total_shares: number;
  total_readers: number;
  total_views: number;
}

// =============================================================================
// Reader Dashboard Types
// =============================================================================

export interface ReaderDashboard {
  received_scripts: ReaderLibraryEntryDetailed[];
  uploaded_scripts: ReaderLibraryEntryDetailed[];
  purchased_downloads: Purchase[];
  reader_code: string;
  storage_cost_monthly_cents: number;  // $0.50 per stored script
}

// =============================================================================
// Protected Player Types
// =============================================================================

export interface PlayerSession {
  session_id: string;
  project_id: string;
  user_id: string;
  access_level: AccessLevel;
  expires_at: string;
  watermark_id: string;  // For audio watermarking/tracking
}

export interface PlayerState {
  current_time: number;
  duration: number;
  playing: boolean;
  playback_rate: number;
  volume: number;
  current_scene?: string;
  current_character?: string;
}

export interface PlayerConfig {
  allow_download: boolean;
  allow_speed_control: boolean;
  allow_offline: boolean;
  show_script_sync: boolean;
  watermark_visible: boolean;
  session_timeout_hours: number;
  max_devices: number;
}

// =============================================================================
// QR Code / Temporary Access Types
// =============================================================================

export interface TemporaryAccess {
  id: string;
  project_id: string;
  created_by: string;
  token: string;
  qr_code_data: string;
  max_plays: number;
  plays_used: number;
  expires_at: string;
  created_at: string;
}

export interface CreateTemporaryAccessRequest {
  project_id: string;
  expires_in_hours?: number;  // Default 24
  max_plays?: number;  // Default 1
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface ScriptAnalytics {
  project_id: string;
  period_start: string;
  period_end: string;

  // Engagement
  total_views: number;
  unique_viewers: number;
  total_play_time_seconds: number;
  average_completion_rate: number;

  // Conversion
  shares_created: number;
  downloads_purchased: number;

  // Timeline
  daily_views: Array<{ date: string; views: number }>;
  viewer_sources: Array<{ source: string; count: number }>;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ShareResponse {
  success: boolean;
  share: ScriptShare;
  link: ShareLink;
}

export interface PurchaseResponse {
  success: boolean;
  purchase: Purchase;
  stripe_client_secret?: string;  // For payment confirmation
}

export interface UploadResponse {
  success: boolean;
  project_id: string;
  processing_required: boolean;
  cost_cents?: number;
  stripe_client_secret?: string;
}
