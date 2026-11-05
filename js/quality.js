// Graphics quality preset (Thấp / Trung bình / Cao). Chosen before the renderer is created; changing it reloads the page.
const KEY = 'daongoc_gfx';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const urlQ = new URLSearchParams(location.search).get('gfx');
function detect() { const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (isTouch) return cores >= 8 && mem >= 6 && devicePixelRatio <= 3 ? 'med' : 'low'; return cores <= 2 || mem <= 2 ? 'low' : cores >= 6 ? 'high' : 'med'; }
const saved = localStorage.getItem(KEY) || 'auto';
const level = ['low', 'med', 'high'].includes(urlQ) ? urlQ : saved === 'auto' ? detect() : saved;
const P = {
  low: { name: 'Thấp', dpr: 1, shadows: false, shadowMap: 512, post: false, bloomScale: 0, grass: 0, particles: 0.35, npcDist: 30, rounded: false, seg: 0.7, aa: false },
  med: { name: 'Trung bình', dpr: 1.25, shadows: true, shadowMap: 1024, post: true, bloomScale: 0.5, grass: 1800, particles: 0.7, npcDist: 46, rounded: true, seg: 1, aa: false },
  high: { name: 'Cao', dpr: 1.75, shadows: true, shadowMap: 2048, post: true, bloomScale: 0.75, grass: 5000, particles: 1, npcDist: 64, rounded: true, seg: 1.5, aa: true },
};
export const Q = { level, saved, auto: saved === 'auto', isTouch, ...P[level], P,
  set(v) { localStorage.setItem(KEY, v); const u = new URL(location.href); u.searchParams.delete('gfx'); location.href = u.toString(); } };
