export const REASON_LABELS_EN: Record<string, string> = {
  'reason.help': 'Asked for help',
  'reason.silent': 'No reply',
  'reason.silentMin': 'No reply {n} min',
  'reason.dispatched': 'Team dispatched',
  'reason.elderly': 'Warga emas',
  'reason.oku': 'OKU',
  'reason.baby': 'Baby',
  'reason.pregnant': 'Pregnant',
  'reason.chronic': 'Chronic illness',
  'reason.riskHigh': 'Zon risiko tinggi',
  'reason.riskMedium': 'Medium-risk zone',
  'reason.triageCritical': 'Critical (triage)',
  'reason.triageHigh': 'High urgency (triage)',
  'reason.largeHousehold': '5+ people',
  'reason.buddyUnreachable': 'Buddy: cannot reach',
  'reason.buddyReport': 'Buddy report',
};

/** Turns a reason key such as 'reason.silentMin:3' into display text. */
export function reasonLabel(reason: string): string {
  const [key, param] = reason.split(':');
  const template = REASON_LABELS_EN[key];
  if (!template) return reason;
  return param !== undefined ? template.replace('{n}', param) : template;
}
