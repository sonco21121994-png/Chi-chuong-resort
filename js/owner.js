// Permanent club passes for island owners. Nick match is case-insensitive (same rule as accounts).
import { nickKey } from './filter.js';

export const DEFAULT_OWNERS = ['SonCo5G'];

export function ownerSetFrom(list) {
  const names = Array.isArray(list) && list.length ? list : DEFAULT_OWNERS;
  return new Set(names.map((n) => nickKey(n)));
}

export function isOwnerNick(set, ...names) {
  return names.some((n) => n && set.has(nickKey(n)));
}
