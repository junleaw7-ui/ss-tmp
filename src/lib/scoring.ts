import type { DisplayStatus, Household, RollCall, Tag } from './types';

/** Pure scoring helpers. No I/O. See design.md, "Status logic" and "Priority score". */

type ScoreInput = Pick<
  Household,
  'status' | 'tags' | 'risk_zone' | 'members' | 'triage' | 'buddy_note' | 'source'
>;

export interface ScoreResult {
  score: number;
  /**
   * i18n keys. 'reason.silentMin' carries its minutes as a suffix,
   * for example 'reason.silentMin:3'. Split on ':' to get key and value.
   */
  reasons: string[];
}

export const LISTED_STATUSES: readonly DisplayStatus[] = ['help', 'silent', 'dispatched'];

const STATUS_POINTS: Partial<Record<DisplayStatus, number>> = {
  help: 50,
  silent: 40,
  dispatched: 5,
};

const TAG_POINTS: Record<Tag, number> = {
  elderly: 15,
  oku: 15,
  baby: 10,
  pregnant: 10,
  chronic: 10,
};

const VULNERABILITY_CAP = 30;
const SILENT_MINUTES_CAP = 20;
const RISK_POINTS = { high: 20, medium: 10, low: 0 } as const;
const RISK_REASON = { high: 'reason.riskHigh', medium: 'reason.riskMedium', low: null } as const;

function deadlineMs(rollCall: RollCall): number {
  return new Date(rollCall.started_at).getTime() + rollCall.deadline_minutes * 60_000;
}

export function computeStatus(
  h: Pick<Household, 'status'>,
  rollCall: RollCall | null,
  now: Date,
): DisplayStatus {
  if (h.status !== 'pending') return h.status;
  if (!rollCall || rollCall.ended_at) return 'pending';
  return now.getTime() > deadlineMs(rollCall) ? 'silent' : 'pending';
}

export function scoreHousehold(
  h: ScoreInput,
  rollCall: RollCall | null,
  now: Date,
): ScoreResult {
  const status = computeStatus(h, rollCall, now);
  const base = STATUS_POINTS[status];
  const reasons: string[] = [];
  if (base === undefined) return { score: 0, reasons };

  let score = base;
  reasons.push(`reason.${status}`);

  if (status === 'silent' && rollCall) {
    const minutes = Math.max(0, Math.floor((now.getTime() - deadlineMs(rollCall)) / 60_000));
    score += Math.min(minutes, SILENT_MINUTES_CAP);
    reasons.push(`reason.silentMin:${minutes}`);
  }

  let vulnerability = 0;
  for (const tag of h.tags) {
    const pts = TAG_POINTS[tag];
    if (pts === undefined) continue;
    vulnerability += pts;
    reasons.push(`reason.${tag}`);
  }
  score += Math.min(vulnerability, VULNERABILITY_CAP);

  score += RISK_POINTS[h.risk_zone] ?? 0;
  const riskReason = RISK_REASON[h.risk_zone];
  if (riskReason) reasons.push(riskReason);

  if (h.triage?.urgency === 'critical') {
    score += 15;
    reasons.push('reason.triageCritical');
  } else if (h.triage?.urgency === 'high') {
    score += 8;
    reasons.push('reason.triageHigh');
  }

  if (h.members >= 5) {
    score += 5;
    reasons.push('reason.largeHousehold');
  }

  if (h.buddy_note) {
    score += 10;
    reasons.push('reason.buddyUnreachable');
  }

  // Display only, no points.
  if (h.source === 'buddy') reasons.push('reason.buddyReport');

  return { score, reasons };
}

export interface ListedHousehold<T> {
  household: T;
  displayStatus: DisplayStatus;
  score: number;
  reasons: string[];
}

/** Households with display status help, silent or dispatched, sorted by score descending. */
export function buildListedSet<T extends ScoreInput>(
  households: T[],
  rollCall: RollCall | null,
  now: Date,
): ListedHousehold<T>[] {
  const listed: ListedHousehold<T>[] = [];
  for (const household of households) {
    const displayStatus = computeStatus(household, rollCall, now);
    if (!LISTED_STATUSES.includes(displayStatus)) continue;
    const { score, reasons } = scoreHousehold(household, rollCall, now);
    listed.push({ household, displayStatus, score, reasons });
  }
  return listed.sort((a, b) => b.score - a.score);
}
