export type Tag = 'elderly' | 'oku' | 'baby' | 'pregnant' | 'chronic';
export type RiskZone = 'high' | 'medium' | 'low';

/** Value stored in the households.status column. */
export type StoredStatus = 'pending' | 'safe' | 'help' | 'dispatched' | 'rescued';

/** Status shown to users. 'silent' is computed, never stored. */
export type DisplayStatus = StoredStatus | 'silent';

export type TriageUrgency = 'critical' | 'high' | 'medium' | 'low';
export type TriageNeed = 'rescue' | 'medical' | 'water' | 'food' | 'shelter' | 'other';

export interface Triage {
  urgency: TriageUrgency;
  need: TriageNeed;
  people: number | null;
  summary_en: string;
  source: 'ai' | 'rules';
}

/** Row of the households table. */
export interface Household {
  id: string;
  code: string;
  label: string;
  kampung: string;
  head_name: string;
  members: number;
  tags: Tag[];
  risk_zone: RiskZone;
  phone_masked: string | null;
  lat: number;
  lng: number;
  status: StoredStatus;
  message: string | null;
  triage: Triage | null;
  replied_at: string | null;
  source: 'self' | 'buddy';
  buddy_note: string | null;
  scheduled_reply_at: string | null;
  scheduled_status: 'safe' | 'help' | null;
  scheduled_message: string | null;
  is_demo: boolean;
  updated_at: string;
}

/** Row of the roll_calls table. */
export interface RollCall {
  id: string;
  area: string;
  started_at: string;
  deadline_minutes: number;
  ended_at: string | null;
}

export interface HouseholdView extends Household {
  displayStatus: DisplayStatus;
  score: number;
  /** i18n keys, for example 'reason.elderly'. */
  reasons: string[];
}

export interface Stats {
  safe: number;
  help: number;
  silent: number;
  pending: number;
  rescued: number;
  dispatched: number;
}

/** Response of GET /api/state. */
export interface StateResponse {
  rollCall: RollCall | null;
  now: string;
  households: HouseholdView[];
  stats: Stats;
}
