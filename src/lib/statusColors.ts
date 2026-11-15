import type { DisplayStatus } from './types';

export const STATUS_COLORS: Record<DisplayStatus, string> = {
  safe: '#16A34A',
  help: '#DC2626',
  pending: '#9CA3AF',
  silent: '#111827',
  dispatched: '#2563EB',
  rescued: '#0D9488',
};
