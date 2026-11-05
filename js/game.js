import * as THREE from 'three';
import { BEAT, DANCES, createAvatar, animateAvatar, holdProp, textSprite, disposeSprite, setAccessories, SKINS, HAIRS, mat } from './avatar.js';
import { buildWorld, height } from './world.js';
import { Sound } from './audio.js';
import { Q } from './quality.js';
import { NAMES_M, NAMES_F, ACTS, PROFILES, LINES, STAFF, SHOP } from './data.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (s, p) => s.replace(/\{p\}/g, p);

// ---------- persistent state ----------
const SAVE = 'daongoc_v1';
const st = Object.assign({ xu: 120, owned: { dance1: true, quaytay: true }, equip: { hat: null, glasses: false, hawaii: false, swim: false }, lastCheckin: '', name: '', gender: 'm', color: '#ff5a5f', server: 'day' }, JSON.parse(localStorage.getItem(SAVE) || '{}'));
SHOP.dance.forEach(d => { if (!d.price) st.owned[d.id] = true; });
const save = () => { if (!G.noLocalSave) localStorage.setItem(SAVE, JSON.stringify(st)); G.onSave && G.onSave(st); };
const setXu = (d) => { st.xu = Math.max(0, st.xu + d); $('xuVal').textContent = st.xu; save(); };

// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa || (!Q.post && !isTouch), powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
if (Q.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const W = buildWorld(scene, { mobile: isTouch || !Q.shadows, Q });
W.setTime(st.server, renderer);
const sound = new Sound();
// extra bar spots: leaning on the counter, and a crowd ring around the stage (film / selfie / hype)
{ const b = W.venues.bar, DY = W.stage.floorY, sx = W.stage.x, sz = W.stage.z + 1.6;
  for (const lx of [-4.6, -1.8, 0.95]) W.spots.push({ id: 'lean' + lx, kind: 'lean', venue: 'bar', x: b.x + lx, z: b.z - 3.05, y: DY, rot: Math.PI, anim: 'lean', prop: 'beer', occupant: null });
  const ring = [[7.0, -1.6], [7.0, 0.2], [7.0, 2.0], [7.2, 3.6], [0.4, -1.4], [0.4, 0.4], [0.5, 2.2], [1.8, 3.7], [3.2, 3.9], [4.6, 3.9], [6.0, 3.8], [2.4, 5.0], [4.4, 5.1], [6.2, 5.0]];
  for (const [lx, lz] of ring) { const x = b.x + lx, z = b.z + lz; W.spots.push({ id: 'crowd' + lx + lz, kind: 'crowd', venue: 'bar', x, z, y: DY, rot: Math.atan2(sx - x, sz - z), anim: 'film', occupant: null }); } }
const G = { onFrame: [], onChat: null, onEmote: [], onEnter: [] };
const LIVE = { isLive: false, energy: 1 }; // filled in by live show module
const SOLO_DANCES = DANCES.filter(d => !['conga', 'circle', 'couple'].includes(d));
const BAR_KINDS = new Set(['dance', 'crowd', 'barStand', 'lean', 'stool']);

// ---------- start screen ----------
const COLORS = ['#ff5a5f', '#ffb300', '#4caf50', '#2196f3', '#9c27b0', '#00bcd4', '#ffffff', '#212121', '#ff80ab'];
$('colorRow').innerHTML = COLORS.map(c => `<div class="swatch${c === st.color ? ' sel' : ''}" data-c="${c}" style="background:${c}"></div>`).join('');
const selIn = (row, attr, val) => row.querySelectorAll('[data-' + attr + ']').forEach(b => b.classList.toggle('sel', b.dataset[attr] === val));
$('colorRow').onclick = (e) => { const c = e.target.dataset.c; if (c) { st.color = c; selIn($('colorRow'), 'c', c); } };
$('genderRow').onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { st.gender = b.dataset.g; selIn($('genderRow'), 'g', st.gender); } };
$('roomRow').onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) { st.server = b.dataset.r; selIn($('roomRow'), 'r', st.server); W.setTime(st.server, renderer); } };
selIn($('genderRow'), 'g', st.gender); selIn($('roomRow'), 'r', st.server); $('nameInput').value = st.name;
const SERVER_NAMES = { day: '🏝️ Đảo Ngọc 1', sunset: '🌴 Đảo Ngọc 2', night: '🌙 Đảo Ngọc 3' };
const TIME_ICON = { day: '☀️', sunset: '🌅', night: '🌙' };

// ---------- player ----------
const player = { av: null, x: W.spawn.x, z: W.spawn.z, yaw: Math.PI, vx: 0, vz: 0, anim: 'idle', seat: null, target: null, holding: null, emoteT: 0, dance: null, tag: null, bubble: null, bubbleT: 0 };
function playerLook() { if (G.styleLook) return G.styleLook(); return { gender: st.gender, skin: SKINS[1], hair: st.gender === 'f' ? '#2c1b12' : '#1b1210', hairStyle: st.gender === 'f' ? 'long' : 'short', shirt: st.color, pants: st.equip.swim ? st.color : '#263238', swim: st.equip.swim, hawaii: st.equip.hawaii, hat: st.equip.hat, glasses: st.equip.glasses, shortSleeve: true }; }
function buildPlayer() {
  const old = player.av; if (old) scene.remove(old.root);
  player.av = createAvatar(playerLook()); scene.add(player.av.root);
  if (!isTouch) player.av.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  if (player.tag) disposeSprite(player.tag);
  const lg = player.av.tier === 'l'; player.tag = textSprite(G.tagText ? G.tagText() : '⭐ ' + (st.name || 'Bạn'), { color: '#ffe066', size: 30, h: lg ? 0.36 : 0.3, legend: lg });
  if (lg && old && old.tier !== 'l' && G.legendEntrance) G.legendEntrance(player); player.tag.position.y = 2.25; player.av.root.add(player.tag); G.onTag && G.onTag(player);
  if (player.holding) holdProp(player.av, player.holding.prop, player.holding.color);
}

// ---------- NPCs ----------
const npcs = []; W.queueList = [];
const nearestFree = (list) => list.length ? pick(list) : null;
function makeTourist(i) {
  const r = Math.random(); let age = 'adult', profile;
  if (r < 0.12) { age = 'kid'; profile = 'kid'; } else if (r < 0.24) { age = 'elder'; profile = 'elder'; }
  else profile = pick(['beach', 'beach', 'beach', 'party', 'party', 'foodie', 'foodie', 'nature', 'nature']);
  const gender = i % 2 ? 'f' : 'm', f = gender === 'f';
  const swim = (profile === 'beach' && Math.random() < 0.85) || (profile === 'kid' && Math.random() < 0.7) || (profile === 'party' && Math.random() < 0.15);
  const C1 = ['#ff7043', '#29b6f6', '#66bb6a', '#ffee58', '#ab47bc', '#ffffff', '#ec407a', '#26a69a', '#5c6bc0', '#ffa726'], C2 = ['#263238', '#1565c0', '#795548', '#f5f5f5', '#e91e63', '#00897b', '#ffb300', '#3e2723'];
  let top, bottom, shoes;
  if (age === 'kid') { top = swim ? (f ? 'onepiece' : 'none') : 'tee'; bottom = swim ? (f ? 'none' : 'boardshorts') : 'shorts'; shoes = 'sandals'; }
  else if (age === 'elder') { top = f ? pick(['blouse', 'blouse', 'hawaii']) : pick(['shirt', 'polo', 'hawaii']); bottom = 'trousers'; shoes = f ? 'sandals' : pick(['loafers', 'sandals']); }
  else if (swim) { top = f ? pick(['onepiece', 'bikini', 'bikini']) : 'none'; bottom = f ? (top === 'bikini' ? pick(['sarong', 'shorts']) : pick(['none', 'sarong'])) : 'boardshorts'; shoes = 'sandals'; }
  else if (profile === 'party') { top = f ? pick(['party', 'party', 'dress', 'crop']) : pick(['blazer', 'shirt', 'tee', 'hawaii']); bottom = f ? pick(['skirt', 'shorts', 'jeans']) : pick(['trousers', 'jeans']); shoes = f ? pick(['heels', 'heels', 'sneakers']) : pick(['loafers', 'sneakers', 'boots']); }
  else { top = f ? pick(['blouse', 'tee', 'crop', 'tank', 'dress', 'hawaii']) : pick(['tee', 'polo', 'shirt', 'hawaii', 'tank', 'hoodie']); bottom = f ? pick(['skirt', 'shorts', 'jeans', 'sarong']) : pick(['shorts', 'jeans', 'trousers', 'shorts']); shoes = f ? pick(['sandals', 'sneakers', 'sandals']) : pick(['sneakers', 'sandals']); }
  const look = { gender, age, skin: pick(SKINS), hair: age === 'elder' ? pick(['#b8b8b8', '#d0d0d0', '#8a8a8a']) : Math.random() < 0.75 ? pick(HAIRS.slice(0, 8)) : pick(HAIRS), eye: pick(['#3b2416', '#1b1b1b', '#5a3a1a']),
    hairStyle: age === 'elder' && !f ? pick(['bald', 'short', 'sidepart']) : f ? pick(['long', 'bun', 'pony', 'long', 'bob', 'wavy', 'highpony', 'curlylong', 'braid', 'lob', 'bunlow', 'halfup', 'twinbraids', 'pixie', 'afro']) : pick(['short', 'undercut', 'spiky', 'sidepart', 'twoblock', 'buzz', 'quiff', 'curly', 'pompadour', 'manbun', 'mullet', 'afro', 'fauxhawk']),
    beard: !f && age !== 'kid' && Math.random() < 0.3 ? pick(['stubble', 'stubble', 'full']) : null,
    top, topC: pick(C1), bottom, bottomC: pick(C2), shoes, shoesC: pick(['#f2f2f2', '#212121', '#8d6e63', '#e91e63']), lips: f && age !== 'kid' ? pick(['#d2506e', '#c0392b', '#e57373']) : undefined,
    hat: Math.random() < 0.4 ? pick(age === 'elder' ? ['straw', 'sunhat'] : f ? ['sunhat', 'straw', 'flower', 'cap'] : ['straw', 'cap', 'fedora', 'cap']) : null, hatC: pick(['#e53935', '#1e88e5', '#212121', '#fdd835']),
    glasses: Math.random() < 0.35, necklace: f && Math.random() < 0.3 ? pick(['gold', 'pearl']) : null, watch: !f && Math.random() < 0.3 };
  if (age !== 'kid') { look.h = +(0.93 + Math.random() * 0.13).toFixed(3); const br = Math.random(); look.build = br < 0.25 ? 'slim' : br < 0.45 ? (f ? 'curvy' : 'broad') : null; }
  if (swim && age !== 'kid') look.shoes = pick(['sandals', 'flipflops', 'none', 'slides', 'flipflops']);
  else if (age === 'adult' && profile === 'party') look.shoes = f ? pick(['stiletto', 'block', 'strappy', 'platformheels', 'heels', 'chunky']) : pick(['loafers', 'oxford', 'chelsea', 'chunky', 'hightop', 'platform']);
  else if (age === 'adult') look.shoes = f ? pick(['sneakers', 'sandals', 'flats', 'wedges', 'banhmi', 'slides', 'chunky']) : pick(['sneakers', 'sandals', 'slides', 'hightop', 'banhmi', 'guoc']);
  if (age === 'adult' && Math.random() < 0.12) look.bag = pick(['tote', 'cross', 'backpack', f ? 'clutch' : 'cross']);
  if (age === 'kid') { look.beard = null; look.hat = Math.random() < 0.4 ? 'cap' : null; }
  const base = gender === 'm' ? NAMES_M : NAMES_F; const free = base.filter(b => !usedBase.has(b)); let name = pick(free.length ? free : base); usedBase.add(name);
  if (age === 'elder') name = (gender === 'm' ? 'Ông ' : 'Bà ') + name; else if (age === 'kid') name = 'Bé ' + name;
  return { look, name, profile, staff: null };
}
function spawnNPC(def, i) {
  const av = createAvatar(def.look); av.phase = Math.random() * 10; scene.add(av.root);
  const n = { id: i, av, name: def.name, profile: def.profile, staff: def.staff, title: def.title, text: def.text, look: def.look, mode: 'idle', path: [], spot: null, act: null, timer: rnd(0, 3), bubble: null, bubbleT: 0, nextLine: rnd(4, 20), tag: null, x: 0, z: 0, yaw: rnd(0, 6), speed: def.look.age === 'kid' ? 1.9 : def.look.age === 'elder' ? 1.0 : 1.35 + rnd(-0.1, 0.2), tempAnim: null, tempT: 0, gift: null, tableItem: null };
  av.hits.forEach(h => h.userData.npc = n);
  npcs.push(n); return n;
}
const usedNames = new Set(), usedBase = new Set();
function populate() {
  // staff
  for (const s of STAFF) {
    const n = spawnNPC({ look: { skin: pick(SKINS), ...s.look }, name: s.name, staff: s.role, title: s.title, text: s.text, profile: 'staff' }, npcs.length);
    const post = W.spots.find(p => p.kind === 'staff' && p.role === s.role) || (s.role === 'mc' && { x: W.venues.bar.x + 4.2, z: W.venues.bar.z - 3.25, y: W.stage.floorY, rot: 0, anim: 'mc' }) || { x: W.center.x, z: W.center.z, y: 1.4, rot: 0, anim: 'idle' };
    n.post = post; n.x = post.x; n.z = post.z; n.yaw = post.rot; n.mode = 'staff'; n.av.anim = post.anim; n.routeI = 0;
    if (s.role === 'mc') holdProp(n.av, 'mic');
    if (s.role === 'dj' || s.role === 'clubdj') n.av.energyMul = 1.2; if (s.role === 'clubmc') holdProp(n.av, 'mic');
    if (s.role === 'waiter') { holdProp(n.av, 'tray'); n.x = W.routes.waiter[0].x; n.z = W.routes.waiter[0].z; }
  }
  const count = isTouch ? 34 : 46;
  for (let i = 0; i < count; i++) {
    const d = makeTourist(i); let tries = 0; while (usedNames.has(d.name) && tries++ < 10) d.name = d.name + ' ' + (tries + 1); usedNames.add(d.name);
    const n = spawnNPC(d, npcs.length);
    // start near activity directly for a lively first impression
    n.x = W.center.x + rnd(-12, 12); n.z = W.center.z + rnd(-6, 14); startActivity(n, true);
  }
}
function chooseAct(n) {
  const w = PROFILES[n.profile]; const entries = Object.entries(w).map(([k, v]) => {
    let m = v; if (W.night) { if (['dance', 'barStool', 'barStand', 'barLean', 'crowd', 'clubDance', 'clubCrowd', 'clubBar', 'clubStand', 'clubVip', 'clubMaster'].includes(k)) m *= 2.2; if (['swim', 'volley', 'castle', 'lounger'].includes(k)) m *= 0.35; }
    if (W.time === 'sunset' && ['photo', 'view', 'shore'].includes(k)) m *= 1.8; if (LIVE.isLive && n.profile !== 'kid') { if (k === 'clubCrowd' || k === 'clubDance') m = (m + 1) * 6; else if (k === 'crowd' || k === 'dance') m = (m + 1) * 1.5; } if (G.actMul) m *= G.actMul(k, n); if (k === n.lastAct) m *= 0.3; return [k, m]; });
  let tot = entries.reduce((s, e) => s + e[1], 0), r = Math.random() * tot; for (const [k, v] of entries) { r -= v; if (r <= 0) return k; } return entries[0][0];
}
const venueOf = (s) => s && W.venues[s.venue];
function buildPath(n, to) {
  const pts = []; const from = n.spot; const fv = venueOf(from), tv = venueOf(to && to.venue ? to : null);
  if (fv) { if (fv.inner) pts.push({ ...fv.inner }); pts.push({ ...fv.entry }); } const tx = to.x, tz = to.z;
  const sx = fv ? fv.entry.x : n.x, sz = fv ? fv.entry.z : n.z;
  if (Math.hypot(tx - sx, tz - sz) > 26) pts.push({ x: W.center.x + rnd(-4, 4), z: W.center.z + 4 + rnd(-3, 3) });
  if (tv && (!fv || fv !== tv)) { pts.push({ ...tv.entry }); if (tv.inner) pts.push({ ...tv.inner }); }
  if (to.via) pts.push(...to.via.map(p => ({ ...p }))); pts.push({ x: tx, z: tz }); return pts;
}
function freeSpots(a) { return W.spots.filter(s => a.kinds.includes(s.kind) && !s.occupant && !s.vip && !s.reserved && (!a.venue || s.venue === a.venue)); }
function leaveSpot(n) {
  if (n.spot) { n.spot.occupant = null; n.spot = null; }
  if (n.tableItem) { scene.remove(n.tableItem); n.tableItem = null; }
  if (!n.keepProp) holdProp(n.av, null); n.keepProp = false; n.tempAnim = null; n.av.seated = false; n.av.coupleRole = null;
}
function startActivity(n, instant = false) {
  leaveSpot(n);
  for (let tries = 0; tries < 6; tries++) {
    const key = chooseAct(n), a = ACTS[key];
    if (a.need === 'swim' && !n.look.swim) continue;
    if (a.queue) { if (W.queueList.length >= W.queue.length) continue; W.queueList.push(n); n.mode = 'queue'; n.act = key; n.lastAct = key; n.qT = 0; if (instant) { const q = W.queue[W.queueList.length - 1]; n.x = q.x; n.z = q.z + 0.5; } return; }
    if (a.route) { let r = W.routes[a.route].slice(); if (a.route === 'shore') { const s = Math.floor(rnd(0, r.length - 5)); r = r.slice(s, s + 5); if (Math.random() < 0.5) r.reverse(); }
      n.path = buildPath(n, r[0]); n.path.push(...r.slice(1)); n.mode = 'walk'; n.act = key; n.lastAct = key; n.spot = null; n.onArrive = a.then ? () => goSpotKind(n, a.then) : () => startActivity(n); if (instant) teleportAlong(n); return; }
    const list = freeSpots(a); const s = nearestFree(list); if (!s) continue;
    s.occupant = n; n.act = key; n.lastAct = key; n.path = buildPath(n, s); n.target = s; n.mode = 'walk'; n.onArrive = () => enterSpot(n, s);
    if (instant) { enterSpot(n, s); n.timer = rnd(3, 25); } return;
  }
  n.mode = 'walk'; n.act = 'shore'; n.path = [{ x: W.center.x + rnd(-10, 10), z: W.center.z + rnd(-5, 15) }]; n.onArrive = () => { n.mode = 'wait'; n.timer = rnd(2, 6); n.av.anim = 'idle'; };
}
function teleportAlong(n) { const p = n.path[n.path.length > 1 ? 1 : 0]; n.x = p.x; n.z = p.z; n.path = n.path.slice(1); if (!n.path.length) n.onArrive(); }
function goSpotKind(n, key) { const a = ACTS[key]; const s = nearestFree(freeSpots(a)); if (!s) return startActivity(n); s.occupant = n; n.act = key; n.path = [{ x: s.x, z: s.z }]; n.mode = 'walk'; n.onArrive = () => enterSpot(n, s); }
const TAB = new THREE.Group();
function enterSpot(n, s) {
  n.spot = s; n.mode = 'act'; n.x = s.x; n.z = s.z; n.yaw = s.rot; const a = ACTS[n.act] || {}; n.timer = rnd(...(a.dur || [15, 30]));
  let anim = s.anim;
  n.av.seated = !!(s.seat && !s.lie);
  if (s.kind === 'dance') { anim = pick(SOLO_DANCES); n.nextDance = rnd(10, 20); }
  if (s.kind === 'stool' && (s.venue === 'bar' || s.venue === 'club')) { anim = 'stoolSway'; n.barT = rnd(4, 9); }
  if (s.kind === 'crowd') { anim = pick(['film', 'selfie', 'hype', 'quaytay', 'dance1']); if (anim === 'film' || anim === 'selfie') holdProp(n.av, 'phone'); n.nextDance = rnd(8, 16); }
  if (s.kind === 'barStand' || s.kind === 'lean') n.barT = rnd(4, 10);
  if (s.venue === 'cafe') { anim = pick(['sip', 'sip', 'read', 'laptop']); if (anim === 'sip') holdProp(n.av, 'cup', pick(['#8d5524', '#e6cfa7', '#5d4037']));
    if (anim === 'read') holdProp(n.av, 'book', pick(['#c62828', '#1565c0', '#2e7d32']));
    if (anim === 'laptop' && s.table) { const lp = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), mat('#9e9e9e', { metalness: 0.6 })); const sc = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.015), mat('#cfd8dc', { emissive: '#90caf9', emissiveIntensity: 0.6 })); sc.position.set(0, 0.11, -0.12); sc.rotation.x = -0.25; lp.add(b, sc);
      lp.position.set(s.x + Math.sin(s.rot) * 0.42, s.table.y + 0.01, s.z + Math.cos(s.rot) * 0.42); lp.rotation.y = s.rot; scene.add(lp); n.tableItem = lp; } }
  if (s.venue === 'restaurant' && s.table) { const pl = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.03, 12), mat('#ffffff')); pl.add(p); const fc = pick(['#ff7043', '#ffd54f', '#e6b35a']);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(fc)); f.position.set(Math.cos(i * 1.6) * 0.07, 0.04, Math.sin(i * 1.6) * 0.07); pl.add(f); }
    pl.position.set(s.x + Math.sin(s.rot) * 0.45, s.table.y + 0.01, s.z + Math.cos(s.rot) * 0.45); scene.add(pl); n.tableItem = pl; }
  if (s.prop && !n.av.prop) holdProp(n.av, s.prop);
  n.av.anim = anim; n.baseAnim = anim; n.av.animT = 0;
}
function npcY(n) {
  const s = n.spot, sc = n.av.root.scale.y;
  if (n.mode === 'act' && s) {
    if (s.lie) return s.y + s.seatH + 0.12 * sc;
    if (s.seatH !== undefined && s.seat) return s.y + s.seatH - 0.86 * sc;
    if (s.kind === 'castle') return s.y - 0.75 * sc;
    if (s.kind === 'swim') return -0.32;
    return s.y;
  }
  const y = W.walkY(n.x, n.z); return y < -0.45 && n.look.swim ? -0.32 : Math.max(y, -0.75);
}
function bubble(o, text, life = 4.5) {
  if (o.bubble) disposeSprite(o.bubble);
  o.bubble = textSprite(text, { color: '#222', bg: 'rgba(255,255,255,0.92)', size: 28, h: 0.3 }); o.bubble.position.y = 2.65; o.av.root.add(o.bubble); o.bubbleT = life;
  if (o !== player && o.av.root.scale.x < 0.8) o.bubble.position.y = 3.2;
}
function npcLine(n) { const L = (n.staff && LINES[n.staff]) || LINES[(ACTS[n.act] || {}).line] || LINES.walk; return pick(L); }
function updateNPC(n, dt, t, dist) {
  if (n.mode === 'form') { if (n.bubble) { n.bubbleT -= dt; if (n.bubbleT <= 0) { disposeSprite(n.bubble); n.bubble = null; } } return; }
  // bubbles
  if (n.bubble) { n.bubbleT -= dt; if (n.bubbleT <= 0) { disposeSprite(n.bubble); n.bubble = null; } }
  n.nextLine -= dt; if (n.nextLine <= 0) { n.nextLine = rnd(12, 32); if (dist < 28) { const l = npcLine(n); bubble(n, l); if (dist < 16) logChat(n.name, l); } }
  if (n.tempAnim) { n.tempT -= dt; if (n.tempT <= 0) { n.tempAnim = null; n.av.anim = n.baseAnim || 'idle'; } }
  // name tag LOD
  if (dist < 10 && !n.tag) { n.tag = textSprite(n.name + (n.title ? ' · ' + n.title : ''), { size: 26, h: 0.26 }); n.tag.position.y = n.av.root.scale.x < 0.8 ? 2.9 : 2.25; n.av.root.add(n.tag); }
  else if (dist > 12 && n.tag) { disposeSprite(n.tag); n.tag = null; }
  if (n.staff) return updateStaff(n, dt, t);
  if (n.mode === 'walk') {
    const p = n.path[0]; if (!p) { n.mode = 'wait'; n.onArrive && n.onArrive(); return; }
    const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz); const step = n.speed * dt;
    if (d < Math.max(0.08, step)) { n.x = p.x; n.z = p.z; n.path.shift(); if (!n.path.length) { const cb = n.onArrive; n.onArrive = null; cb && cb(); } return; }
    n.x += dx / d * step; n.z += dz / d * step; turn(n, Math.atan2(dx, dz), dt);
    const h = W.walkY(n.x, n.z); n.av.anim = h < -0.45 && n.look.swim ? 'swim' : (n.act === 'hike' && h > 2 ? 'hike' : (n.look.age === 'kid' ? 'run' : 'walk'));
  } else if (n.mode === 'act') {
    n.timer -= dt;
    if (n.spot && (n.spot.venue === 'bar' || n.spot.venue === 'club')) barBehaviour(n, dt);
    if (n.spot && n.spot.kind === 'swim') { n.yaw += dt * 0.25; n.x = n.spot.x + Math.sin(t * 0.25 + n.id) * 1.5; n.z = n.spot.z + Math.cos(t * 0.25 + n.id) * 1.5; n.yaw = t * 0.25 + n.id + Math.PI / 2; }
    if (n.spot && n.spot.kind === 'wade' && Math.random() < dt / 10 && !n.tempAnim) { n.tempAnim = 'wave'; n.tempT = 1.5; n.av.anim = 'wave'; }
    if (n.timer <= 0) startActivity(n);
  } else if (n.mode === 'queue') {
    const i = W.queueList.indexOf(n); const q = W.queue[Math.max(0, i)]; const dx = q.x - n.x, dz = q.z - n.z, d = Math.hypot(dx, dz);
    if (d > 0.1) { const s = Math.min(d, n.speed * dt); n.x += dx / d * s; n.z += dz / d * s; turn(n, Math.atan2(dx, dz), dt); n.av.anim = 'walk'; }
    else { turn(n, Math.PI, dt); n.av.anim = 'queue'; if (i === 0) { n.qT += dt; if (n.qT > 4.5) { // served
      W.queueList.shift(); const drink = pick([['coconut'], ['glass', '#a5d66b'], ['glass', '#ffa726'], ['coconut']]); holdProp(n.av, drink[0], drink[1]); n.keepProp = true;
      if (Math.random() < 0.6) bubble(n, pick(['Cảm ơn cô nha!', 'Dừa mát quá!', 'Ngon ghê 🥥']));
      n.profileBackup = n.profile; const k = pick(['kioskSit', 'lounger', 'shore', 'photo', 'rock']); goSpotKindOrRoute(n, k); } } }
  } else if (n.mode === 'wait') { n.timer -= dt; n.av.anim = n.tempAnim || 'idle'; if (n.timer <= 0) startActivity(n); }
}
function goSpotKindOrRoute(n, key) { const a = ACTS[key]; if (a.route) { const r = W.routes[a.route]; const s = Math.floor(rnd(0, r.length - 4)); n.path = [...r.slice(s, s + 4)]; n.mode = 'walk'; n.act = key; n.onArrive = () => startActivity(n); return; }
  const s = nearestFree(freeSpots(a)); if (!s) { n.mode = 'wait'; n.timer = 3; return; } s.occupant = n; n.act = key; n.path = buildPath(n, s); n.mode = 'walk'; n.onArrive = () => { enterSpot(n, s); n.keepProp = false; }; }
function npcLastLine() { return null; }
// ---- Bar Beer behaviours: dance changes, beer rounds, group clinks, crowd filming ----
function setBase(n, a) { n.baseAnim = a; if (!n.tempAnim) { n.av.anim = a; n.av.animT = 0; } }
function barBehaviour(n, dt) {
  const k = n.spot.kind; const fast = LIVE.isLive ? 0.55 : 1;
  if (k === 'dance') { n.nextDance -= dt; if (n.nextDance <= 0) { n.nextDance = rnd(10, 20) * fast; setBase(n, pick(SOLO_DANCES.filter(d => d !== n.baseAnim))); } return; }
  if (k === 'crowd') { n.nextDance -= dt; if (n.nextDance <= 0) { n.nextDance = rnd(8, 16) * fast; const a = pick(['film', 'selfie', 'hype', 'quaytay', 'dance1', 'vinahouse', 'headbang']); holdProp(n.av, a === 'film' || a === 'selfie' ? 'phone' : null); setBase(n, a); } return; }
  n.barT -= dt; if (n.barT > 0 || n.tempAnim) return; n.barT = rnd(5, 11) * fast;
  const r = Math.random();
  if (k === 'stool') { if (r < 0.35) temp(n, 'drink', 3); else if (r < 0.5) temp(n, 'chug', 2.6, 'Trăm phần trăm! 🍺'); else if (r < 0.8) groupClink(n, 2.2); }
  else if (k === 'lean') { if (r < 0.4) temp(n, 'drink', 3); else if (r < 0.6) groupClink(n, 2.6); }
  else if (k === 'barStand') { if (r < 0.55) groupClink(n, 2.6); else if (r < 0.8) temp(n, 'chug', 2.6, Math.random() < 0.4 ? 'Uống hết nè! 🍺' : null); else temp(n, 'drink', 3); }
}
function temp(n, a, d, line) { n.tempAnim = a; n.tempT = d; n.av.anim = a; n.av.animT = 0; if (line) bubble(n, line, 2.5); }
function groupClink(n, r) { // everyone close by raises their beer together: "Zô!"
  const g = npcs.filter(o => o !== n && o.mode === 'act' && o.spot && o.spot.venue === n.spot.venue && !o.tempAnim && !o.form && Math.hypot(o.x - n.x, o.z - n.z) < r).slice(0, 4);
  if (!g.length) return temp(n, 'drink', 3);
  [n, ...g].forEach((o, i) => { o.tempAnim = 'cheers'; o.tempT = 1.8; o.av.anim = 'cheers'; o.av.animT = -i * 0.08; if (!o.av.prop) { holdProp(o.av, 'beer'); } });
  bubble(n, pick(['Zô! 🍻', 'Zo zo zo!', 'Một hai ba ZÔ!', 'Trăm phần trăm!', 'Dzô dzô!']), 2.5); if (g[0] && Math.random() < 0.5) bubble(g[0], 'Zô!!! 🍺', 2);
}
function cheers(n, silent) { n.tempAnim = 'cheers'; n.tempT = 1.6; n.av.anim = 'cheers'; n.av.animT = 0; if (!silent && Math.random() < 0.6) bubble(n, pick(['Dzô! 🍻', 'Zo zo zo!', 'Một hai ba dzô!', 'Trăm phần trăm!']), 2.5); }
function turn(o, target, dt, speed = 8) { let d = target - o.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); o.yaw += d * Math.min(1, dt * speed); }
function updateStaff(n, dt, t) {
  const r = n.staff;
  if (r === 'mc') { const b = W.venues.bar; n.mcT = (n.mcT || 0) + dt * 0.35; n.x = b.x + 4.2 + Math.sin(n.mcT) * 2.4; n.z = b.z - 3.25; n.yaw = Math.sin(n.mcT * 0.7) * 0.4; n.av.anim = n.tempAnim || 'mc'; return; }
  if (r === 'clubdj' || r === 'clubmc') { const on = W.club && W.club.open; n.av.anim = n.tempAnim || (on ? (r === 'clubdj' ? 'dj' : 'mc') : 'idle'); if (r === 'clubmc') { n.mcT = (n.mcT || 0) + dt * 0.3; n.z = W.club.z + 2.4 + Math.sin(n.mcT) * 1.2; } return; }
  if (r === 'bouncer' || r === 'host') { n.av.anim = n.tempAnim || 'idle'; return; }
  if (r === 'waiter' || r === 'bartender' || r === 'clubbar') {
    const route = W.routes[r]; n.routeI = n.routeI || 0; const p = route[n.routeI % route.length];
    if (n.wait > 0) { n.wait -= dt; n.av.anim = r === 'waiter' ? 'serve' : (n.barAct || 'pour'); if (r === 'waiter') { const tb = W.venues.restaurant.tables.reduce((a, b) => Math.hypot(b.x - n.x, b.z - n.z) < Math.hypot(a.x - n.x, a.z - n.z) ? b : a); turn(n, Math.atan2(tb.x - n.x, tb.z - n.z), dt); } else turn(n, Math.PI, dt); return; }
    const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz);
    if (d < 0.1) { n.routeI++; n.wait = rnd(2.5, 5.5); if (r !== 'waiter') { n.barAct = pick(['pour', 'shake', 'pour', 'bartend']); holdProp(n.av, n.barAct === 'shake' ? 'shaker' : n.barAct === 'pour' ? 'beer' : 'glass', '#21e6ff'); } return; }
    const s = Math.min(d, 1.2 * dt); n.x += dx / d * s; n.z += dz / d * s; turn(n, Math.atan2(dx, dz), dt); n.av.anim = r === 'waiter' ? 'serveTray' : 'walk';
  } else if (r === 'vendor') { n.av.anim = W.queueList.length ? 'serve' : 'idle'; n.yaw = 0; }
  else if (r === 'barista') { if (Math.random() < dt / 6) n.av.anim = n.av.anim === 'serve' ? 'idle' : 'serve'; }
  if (n.tempAnim) n.av.anim = n.tempAnim;
}

// volleyball
const vb = { from: null, to: null, t: 0 };
function updateVolley(dt) {
  const players = W.spots.filter(s => s.kind === 'volley' && s.occupant && s.occupant.mode === 'act').map(s => s.occupant);
  const ball = W.volley.ball;
  if (players.length < 2) { ball.position.set(W.volley.x + 0.8, W.volley.y + 0.15, W.volley.z + 0.5); vb.from = null; return; }
  if (!vb.from || !players.includes(vb.from) || !players.includes(vb.to) || vb.t >= 1) { vb.from = vb.to && players.includes(vb.to) ? vb.to : players[0]; do { vb.to = pick(players); } while (vb.to === vb.from); vb.t = 0; vb.from.av.animT = 0.0; vb.from.av.phase = 0; }
  vb.t += dt / 1.4; const k = vb.t; const a = vb.from, b = vb.to;
  ball.position.set(a.x + (b.x - a.x) * k, W.volley.y + 2.2 + Math.sin(k * Math.PI) * 3.2, a.z + (b.z - a.z) * k);
}

// ---------- HUD helpers ----------
let toastT; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function logChat(name, text) { if (!text) return; const d = document.createElement('div'); d.innerHTML = `<b></b> `; d.querySelector('b').textContent = name + ':'; d.append(text); const log = $('chatLog'); log.append(d); while (log.children.length > 7) log.firstChild.remove(); }
// hook NPC bubble -> chat log
const _bubble = bubble;
function openPanel(html) { $('panelBody').innerHTML = html; $('panel').classList.remove('hidden'); }
function closePanel() { $('panel').classList.add('hidden'); }
$('panelClose').onclick = closePanel; $('panel').onclick = (e) => { if (e.target.id === 'panel') closePanel(); };

// ---------- order / gift / shop ----------
function openMenu(v) { if (G.venueOpen && !G.venueOpen(v.key || Object.keys(W.venues).find(k => W.venues[k] === v))) return toast(`${v.icon} ${v.name} đang đóng cửa – ${G.hoursText(v)}`);
  openPanel(`<h2>${v.icon} ${v.name}</h2><p class="sub" style="text-align:left">Chọn món – trả bằng Xu ảo</p><div class="grid">${v.menu.map(m => `<div class="item"><div class="ic">${m.icon}</div><div class="nm">${m.name}</div><div class="ds">${m.price} Xu</div><button data-m="${m.id}">Gọi món</button></div>`).join('')}</div>`);
  $('panelBody').onclick = (e) => { const id = e.target.dataset.m; if (!id) return; const m = v.menu.find(x => x.id === id);
    if (st.xu < m.price) return toast('Không đủ Xu 😅 – điểm danh hoặc chơi thêm để nhận Xu'); setXu(-m.price);
    player.holding = { ...m }; holdProp(player.av, m.prop, m.color); closePanel(); toast(`${m.icon} ${m.name} đây ạ! (-${m.price} Xu)`); G.onOrder && G.onOrder(v, m); bubble(player, `${m.icon} ${m.name} ngon quá!`, 3);
    const staffN = npcs.find(n => n.staff && Math.hypot(n.x - player.x, n.z - player.z) < 9); if (staffN) bubble(staffN, pick(['Dạ có ngay ạ!', 'Mời quý khách ạ!', 'Chúc ngon miệng nha!'])); };
}
const GIFT_DRINKS = [{ id: 'g_beer', name: 'Bia tươi', icon: '🍺', price: 10, prop: 'beer' }, { id: 'g_coco', name: 'Nước dừa', icon: '🥥', price: 8, prop: 'coconut' }, { id: 'g_cf', name: 'Cà phê sữa đá', icon: '🧋', price: 8, prop: 'cup', color: '#8d5524' }, { id: 'g_mojito', name: 'Mojito', icon: '🍹', price: 15, prop: 'glass', color: '#9be15d' }];
function openGift(n) {
  openPanel(`<h2>🎁 Tặng đồ uống cho ${n.name}</h2><div class="grid">${GIFT_DRINKS.map(m => `<div class="item"><div class="ic">${m.icon}</div><div class="nm">${m.name}</div><div class="ds">${m.price} Xu</div><button data-m="${m.id}">Tặng</button></div>`).join('')}</div><p class="note">Quà tặng chỉ là vật phẩm ảo cho vui, không có giá trị quy đổi.</p>`);
  $('panelBody').onclick = (e) => { const id = e.target.dataset.m; if (!id) return; const m = GIFT_DRINKS.find(x => x.id === id);
    if (st.xu < m.price) return toast('Không đủ Xu 😅'); setXu(-m.price); closePanel();
    if (!n.staff && !(n.spot && (n.spot.kind === 'swim'))) { holdProp(n.av, m.prop, m.color); n.keepProp = true; }
    faceTo(n, player); bubble(n, fmt(pick(LINES.thanks), st.name || 'bạn')); logChat(n.name, fmt(pick(LINES.thanks), st.name || 'bạn'));
    if (!(n.spot && (n.spot.lie || n.spot.kind === 'swim'))) { n.tempAnim = 'cheers'; n.tempT = 2; n.av.anim = 'cheers'; n.av.animT = 0; }
    doEmote('cheers'); toast(`Đã tặng ${m.icon} ${m.name} cho ${n.name} (-${m.price} Xu)`); };
}
function faceTo(n, o) { if (n.mode === 'act' && n.spot && n.spot.seat) return; n.yaw = Math.atan2(o.x - n.x, o.z - n.z); }
let shopTab = 'outfit';
function openShop(tab = shopTab) {
  shopTab = tab; const T = { outfit: '👕 Trang phục', swim: '🩱 Đồ bơi', dance: '💃 Điệu nhảy', vip: '👑 VIP', ...(SHOP.event && SHOP.event.length ? { event: '🎉 Sự kiện' } : {}), ...(SHOP.dating ? { dating: '💘 Hẹn hò' } : {}), ...(SHOP.club ? { club: '🪩 Vũ Trường' } : {}), ...(SHOP.date2 ? { date2: '🌹 Điểm hẹn' } : {}) }; if (!SHOP[tab]) tab = shopTab = 'outfit';
  const items = SHOP[tab].map(it => { const own = st.owned[it.id]; let btn;
    if (!own) btn = `<button data-buy="${it.id}">Mua ${it.price} Xu</button>`;
    else if (it.slot) { const on = it.slot === 'hat' || it.slot === 'badge' ? st.equip[it.slot] === it.id : st.equip[it.slot]; btn = `<button class="own" data-eq="${it.id}">${on ? '✓ Đang dùng (bỏ)' : 'Dùng'}</button>`; }
    else btn = `<button class="own dis">✓ Đã sở hữu</button>`;
    if (it.consumable) btn = `<button data-buy="${it.id}">Mua ${it.price} Xu</button>`; return `<div class="item"><div class="ic">${it.icon}</div><div class="nm">${it.name}</div><div class="ds">${it.desc}${it.until ? `<br><b style="color:#ffc94a">⏳ ${it.until}</b>` : ''}</div>${btn}</div>`; }).join('');
  openPanel(`<h2>🛍️ Cửa hàng</h2><div class="pill gold" style="display:inline-block">🪙 ${st.xu} Xu</div><div class="tabs">${Object.entries(T).map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'sel' : ''}">${v}</button>`).join('')}</div><div class="grid">${items}</div>
    <p class="note">Bản chơi thử: mọi thứ mua bằng Xu ảo kiếm trong game. Không nạp tiền thật, không quay thưởng, không đổi Xu ra tiền.<br>Ý tưởng kiếm tiền khi ra mắt: bán trang phục/đồ bơi, điệu nhảy, lều VIP, gói sự kiện cho resort/nhãn hàng.</p>`);
  $('panelBody').onclick = (e) => { const b = e.target; if (b.dataset.tab) return openShop(b.dataset.tab);
    const all = Object.values(SHOP).flat();
    if (b.dataset.buy) { const it = all.find(x => x.id === b.dataset.buy); if (st.xu < it.price) return toast('Không đủ Xu 😅'); setXu(-it.price); if (it.consumable) { it.onBuy && it.onBuy(); save(); return openShop(tab); } st.owned[it.id] = true; save(); toast(`Đã mua ${it.icon} ${it.name}!`); G.onBuy && G.onBuy(it);
      if (it.slot) equip(it); if (it.id === 'cabana') unlockCabana(); openShop(tab); }
    if (b.dataset.eq) { equip(all.find(x => x.id === b.dataset.eq)); openShop(tab); } };
}
function equip(it) { const e = st.equip; if (it.slot === 'hat' || it.slot === 'badge') e[it.slot] = e[it.slot] === it.id ? null : it.id; else e[it.slot] = !e[it.slot]; save(); buildPlayer(); }
function unlockCabana() { W.cabana.collider.on = false; W.cabana.rope.forEach(r => r.visible = false); }
if (st.owned.cabana) unlockCabana();

// ---------- emotes, chat ----------
function doEmote(e) { if (player.seat && player.seat.lie) return; player.emoteT = e === 'cheers' ? 1.8 : 2.2; player.av.anim = e; player.av.animT = 0; player.emote = e;
  const txt = { wave: '👋 Xin chào!', cheers: '🥂 Dzô!', clap: '👏👏👏' }[e]; if (txt) bubble(player, txt, 2.2); G.onEmote.forEach(f => f(e));
  if (e === 'cheers' || e === 'wave') npcs.filter(n => Math.hypot(n.x - player.x, n.z - player.z) < 4 && !n.staff).slice(0, 2).forEach(n => { if (!(n.spot && (n.spot.lie || n.spot.kind === 'swim'))) { n.tempAnim = e; n.tempT = 1.8; n.av.anim = e; n.av.animT = 0; } bubble(n, e === 'cheers' ? 'Dzô! 🍻' : fmt(pick(LINES.greet), st.name || 'bạn'), 2.5); }); }
document.querySelectorAll('#emotes button').forEach(b => b.onclick = () => doEmote(b.dataset.e));
$('chatForm').onsubmit = (e) => { e.preventDefault(); let v = $('chatInput').value.trim(); if (!v) return; $('chatInput').value = ''; $('chatInput').blur(); if (G.filter) v = G.filter(v); if (G.onChat && G.onChat(v) === true) return; bubble(player, v, 5); logChat(st.name || 'Bạn', v);
  const near = npcs.filter(n => Math.hypot(n.x - player.x, n.z - player.z) < 6); if (near.length) { const n = pick(near); setTimeout(() => { const l = fmt(pick(LINES.reply), st.name || 'bạn'); bubble(n, l); logChat(n.name, l); }, 1200); } };

// ---------- NPC card (tap) ----------
const card = document.createElement('div'); card.id = 'npcCard'; card.className = 'hidden'; document.getElementById('hud').append(card);
Object.assign(card.style, { position: 'absolute', left: '50%', top: '22%', transform: 'translateX(-50%)', background: 'rgba(20,10,35,.94)', border: '1px solid #ff4fd8', borderRadius: '14px', padding: '12px 14px', pointerEvents: 'auto', minWidth: '230px', textAlign: 'center', boxShadow: '0 0 18px rgba(255,79,216,.5)' });
let cardNPC = null;
function showCard(n) { cardNPC = n; const a = n.staff ? n.text : (ACTS[n.act] ? (n.mode === 'walk' ? '🚶 Đang đi tới: ' + ACTS[n.act].text.replace(/^Đang /, '') : ACTS[n.act].text) : 'Đang đi dạo');
  card.innerHTML = `<div style="font-size:18px;font-weight:700">👤 ${n.name}</div><div style="color:#ffb3f0;font-size:13px;margin:2px 0 4px">${n.title ? n.title : (n.look.age === 'kid' ? 'Du khách nhí' : n.look.age === 'elder' ? 'Du khách lớn tuổi' : 'Du khách')}</div><div style="font-size:13px;color:#ddd;margin-bottom:8px">${a}</div>
   <div style="display:flex;gap:6px;justify-content:center"><button data-c="greet" class="pill btn">👋 Chào</button><button data-c="gift" class="pill btn">🎁 Tặng đồ uống</button><button data-c="x" class="pill btn">✕</button></div>`;
  card.classList.remove('hidden'); }
card.onclick = (e) => { const c = e.target.dataset.c; if (!c) return; const n = cardNPC; card.classList.add('hidden'); if (c === 'x' || !n) return;
  const d = Math.hypot(n.x - player.x, n.z - player.z); if (d > 12) return toast('Lại gần hơn để ' + (c === 'greet' ? 'chào' : 'tặng quà') + ' nhé!');
  if (c === 'greet') { player.yaw = Math.atan2(n.x - player.x, n.z - player.z); doEmote('wave'); faceTo(n, player); setTimeout(() => { const l = fmt(pick(LINES.greet), st.name || 'bạn'); bubble(n, l); logChat(n.name, l); if (!(n.spot && (n.spot.seat || n.spot.kind === 'swim')) && !n.staff) { n.tempAnim = 'wave'; n.tempT = 1.8; n.av.anim = 'wave'; } }, 600); }
  if (c === 'gift') openGift(n); };

// ---------- input ----------
const keys = {}; addEventListener('keydown', (e) => { if (document.activeElement.tagName === 'INPUT') return; keys[e.code] = true; if (e.code === 'Enter') { e.preventDefault(); $('chatInput').focus(); } });
addEventListener('keyup', (e) => { keys[e.code] = false; });
const cam = { yaw: Math.PI, pitch: 0.3, dist: 5.2 };
let drag = null; const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
const pins = new Map(); let pinch0 = 0;
canvas.addEventListener('pointerdown', (e) => { pins.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pins.size === 2) { const [a, b] = [...pins.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (pins.has(e.pointerId)) pins.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pins.size === 2) { const [a, b] = [...pins.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) cam.dist = clamp(cam.dist * pinch0 / d, 2.2, 16); pinch0 = d; if (drag) drag.moved = true; return; } if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) > 7) drag.moved = true;
  if (drag.moved) { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.004, 0.08, 1.2); drag.x = e.clientX; drag.y = e.clientY; } });
const unpin = (e) => { pins.delete(e.pointerId); pinch0 = 0; }; canvas.addEventListener('pointercancel', (e) => { unpin(e); drag = null; });
canvas.addEventListener('pointerup', (e) => { unpin(e); if (drag && !drag.moved) tap(e.clientX, e.clientY); drag = null; });
canvas.addEventListener('wheel', (e) => { cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * Math.min(0.15, Math.abs(e.deltaY) * 0.0015)), 2.2, 16); }, { passive: true });
addEventListener('keydown', (e) => { if (document.activeElement.tagName === 'INPUT') return; if (e.key === '+' || e.key === '=') cam.dist = clamp(cam.dist * 0.88, 2.2, 16); if (e.key === '-') cam.dist = clamp(cam.dist * 1.12, 2.2, 16); if (e.key === 'h' || e.key === 'H') G.toggleUI && G.toggleUI(); });
function tap(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -cy / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  if (G.tapExtra && G.tapExtra(ray)) return; const hits = []; npcs.forEach(n => { if (n.av.root.visible && Math.hypot(n.x - player.x, n.z - player.z) < 30) hits.push(...n.av.hits); });
  const h = ray.intersectObjects(hits, false)[0]; if (h) return showCard(h.object.userData.npc);
  card.classList.add('hidden');
  const g = ray.intersectObjects(W.pick, false)[0]; if (g) { if (player.seat) standUp(); player.target = { x: g.point.x, z: g.point.z }; showMarker(g.point); }
}
const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 20), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.9, depthWrite: false })); marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
function showMarker(p) { marker.position.set(p.x, p.y + 0.06, p.z); marker.visible = true; marker.userData.t = 1.2; }
// joystick
const joy = { x: 0, y: 0, id: null }; const jb = $('joy'), kn = $('knob');
jb.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; jb.setPointerCapture(e.pointerId); moveJoy(e); e.stopPropagation(); });
jb.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; kn.style.transform = ''; }; jb.addEventListener('pointerup', endJoy); jb.addEventListener('pointercancel', endJoy);
function moveJoy(e) { const r = jb.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), R = r.width / 2 - 10; if (m > R) { dx *= R / m; dy *= R / m; } joy.x = dx / R; joy.y = dy / R; kn.style.transform = `translate(${dx}px,${dy}px)`; }

// ---------- player movement & collision ----------
function collide(x, z, r = 0.33) {
  for (const b of W.colliders) { if (!b.on) continue; const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ); const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; } else { const o = [x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z]; const m = Math.min(...o); if (m === o[0]) x = b.minX - r; else if (m === o[1]) x = b.maxX + r; else if (m === o[2]) z = b.minZ - r; else z = b.maxZ + r; } } }
  for (const c of W.circles) { const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); x = c.x + dx / d * rr; z = c.z + dz / d * rr; } }
  return [x, z];
}
const canStand = (x, z, fromY) => { const y = W.walkY(x, z); return y > -0.6 && y - fromY < 0.5 && Math.hypot(x, z) < 110; };
function updatePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
  ix += joy.x; iz += joy.y; let m = Math.hypot(ix, iz);
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = -fz, rz = fx; // forward/right vectors (camera looks toward -offset)
  let dx = 0, dz = 0, run = keys.ShiftLeft || keys.ShiftRight || m > 0.95 && joy.id !== null;
  if (m > 0.1) { if (m > 1) { ix /= m; iz /= m; m = 1; } dx = (-iz) * fx + ix * rx; dz = (-iz) * fz + ix * rz; player.target = null; if (player.seat) standUp(); if (player.dance) stopDance(); }
  if (player.form && !(m > 0.1)) { dx = dz = 0; m = 0; }
  else if (player.target) { const tx = player.target.x - player.x, tz = player.target.z - player.z, d = Math.hypot(tx, tz); if (d < 0.25) { player.target = null; if (player.afterArrive) { const f = player.afterArrive; player.afterArrive = null; f(); } } else { dx = tx / d; dz = tz / d; m = 1; } }
  const moving = (dx || dz) && !player.seat;
  if (moving) { const sp = (run ? 4.6 : 3.0) * Math.min(1, m || 1); const y0 = W.walkY(player.x, player.z);
    let nx = player.x + dx * sp * dt, nz = player.z + dz * sp * dt; [nx, nz] = collide(nx, nz);
    if (canStand(nx, nz, y0)) { player.x = nx; player.z = nz; } else if (canStand(nx, player.z, y0)) player.x = nx; else if (canStand(player.x, nz, y0)) player.z = nz; else player.target = null;
    turn(player, Math.atan2(dx, dz), dt, 12); }
  // anim
  const h = W.walkY(player.x, player.z);
  if (player.emoteT > 0) { player.emoteT -= dt; if (player.emoteT <= 0) player.emote = null; }
  if (player.eatT > 0) { player.eatT -= dt; if (player.eatT <= 0) { holdProp(player.av, null); toast(`Đã ${player.holding && player.holding.prop === 'plate' ? 'ăn' : 'uống'} xong ${player.holding ? player.holding.name : ''} 😋`); player.holding = null; } }
  let anim;
  if (player.seat) anim = player.seat.lie ? 'lie' : (player.eatT > 0 ? 'eat' : (player.emote || player.seat.panim || 'sit'));
  else if (player.emote) anim = player.emote; else if (player.eatT > 0) anim = 'drink';
  else if (player.form) anim = player.form.type; else if (moving) anim = h < -0.45 && st.equip.swim ? 'swim' : (run ? 'run' : 'walk'); else if (player.dance) anim = player.dance; else anim = h < -0.2 ? 'wade' : 'idle';
  if (anim !== player.av.anim) { player.av.anim = anim; player.av.animT = 0; }
  // position
  let y = h; if (player.seat) { const s = player.seat; y = s.lie ? s.y + s.seatH + 0.12 : s.y + (s.seatH || 0) - 0.86 * player.av.root.scale.y; }
  else if (h < -0.45 && st.equip.swim) y = -0.32;
  player.y = y; player.av.root.position.set(player.x, y, player.z); player.av.root.rotation.y = player.yaw;
  if (player.bubble) { player.bubbleT -= dt; if (player.bubbleT <= 0) { disposeSprite(player.bubble); player.bubble = null; } }
}
function sitAt(s) { if (s.vip && !st.owned.cabana) return openShop('vip'); if (G.seatGate && !G.seatGate(s)) return; if (s.occupant) return toast('Chỗ này có người ngồi rồi'); if (player.dance) stopDance(); s.occupant = player; player.seat = s; player.av.seated = !s.lie; player.x = s.x; player.z = s.z; player.yaw = s.rot; player.target = null;
  if (s.lie) toast('Thư giãn tắm nắng… 😎 +2 Xu mỗi phút nghỉ ngơi'); }
function standUp() { const s = player.seat; if (!s) return; player.av.seated = false; s.occupant = null; player.seat = null; const ox = Math.sin(s.rot) * (s.lie ? -0.2 : 0.65), oz = Math.cos(s.rot) * (s.lie ? -0.2 : 0.65); const [x, z] = collide(s.x + ox + (s.lie ? 0.7 : 0), s.z + oz); player.x = x; player.z = z; }
function stopDance() { player.dance = null; if (player.form) leaveForm(player); }
// ---------- group dances (conga / circle / couple) ----------
let form = null, formCool = 25;
const FLOORS = () => [W.danceFloor, W.clubFloor].filter(Boolean);
const floorC = () => { let best = W.danceFloor, bn = -1; for (const f of FLOORS()) { const n = barDancers(f.x, f.z, 7).length + (f === W.clubFloor && W.club && W.club.open ? 1 : 0); if (n > bn) { bn = n; best = f; } } return { x: best.x, z: best.z }; };
const nearFloor = (x, z) => FLOORS().reduce((a, b) => Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a);
function barDancers(px, pz, r) { return npcs.filter(n => !n.staff && n.mode === 'act' && n.spot && ['dance', 'crowd', 'barStand', 'lean'].includes(n.spot.kind) && !n.form && Math.hypot(n.x - px, n.z - pz) < r); }
function startForm(type, members, dur) {
  if (form) endForm(); const c = floorC();
  form = { type, members, t: 0, dur, cx: c.x, cz: c.z, rot: Math.random() * 6 };
  members.forEach((m, i) => { m.form = form; m.formI = i; if (m !== player) { m.mode = 'form'; holdProp(m.av, null); m.tempAnim = null; m.av.anim = type; m.av.animT = 0; } m.av.coupleRole = type === 'couple' ? (i ? 'b' : 'a') : null; });
  if (type === 'couple') { const [a, b] = members; form.cx = (a.x + b.x) / 2; form.cz = (a.z + b.z) / 2; }
  const lead = members.find(m => m !== player); if (lead) bubble(lead, { conga: 'Lên tàu nào cả nhà! 🚂', circle: 'Nắm tay nhảy vòng tròn nè! ⭕', couple: 'Nhảy đôi với mình nha 💞' }[type], 3);
}
function leaveForm(m) { if (!form) return; form.members = form.members.filter(x => x !== m); m.form = null; m.av.coupleRole = null; if (m !== player) backToSpot(m); if (form.members.length < (form.type === 'couple' ? 2 : 2)) endForm(); }
function backToSpot(n) { const s = n.spot; n.form = null; n.av.coupleRole = null; if (!s) { n.mode = 'wait'; n.timer = 1; return; } n.mode = 'walk'; n.path = [{ x: s.x, z: s.z }]; n.onArrive = () => enterSpot(n, s); }
function endForm() { if (!form) return; const f = form; form = null; f.members.forEach(m => { if (m === player) { m.form = null; m.av.coupleRole = null; player.dance = f.type === 'couple' ? 'dance1' : player.dance; } else backToSpot(m); }); }
function updateForm(dt) {
  if (!form) { formCool -= dt; if (formCool <= 0) { formCool = LIVE.isLive ? rnd(14, 24) : rnd(30, 55); const c = floorC(); const d = barDancers(c.x, c.z, 7);
      if (d.length >= 4 && Math.random() < 0.7) startForm(pick(['conga', 'circle']), d.slice(0, 8), rnd(18, 28));
      else if (d.length >= 2) { const a = d[0]; const b = d.slice(1).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0]; startForm('couple', [a, b], rnd(14, 22)); } } return; }
  const f = form; f.t += dt * (LIVE.isLive ? 1.25 : 1); if (f.t > f.dur) return endForm();
  const N = f.members.length;
  f.members.forEach((m, i) => { let x, z, yaw;
    if (f.type === 'circle') { const r = Math.max(1.3, N * 0.33), a = i / N * Math.PI * 2 + f.t * 0.3; x = f.cx + Math.sin(a) * r; z = f.cz + Math.cos(a) * r; yaw = a + Math.PI; }
    else if (f.type === 'conga') { const r = 2.1, a = f.t * 0.45 - i * 0.5; x = f.cx + Math.sin(a) * r; z = f.cz + Math.cos(a) * r; yaw = Math.atan2(Math.cos(a), -Math.sin(a)); }
    else { f.rot += dt * 0.15 / N; const a = f.rot + i * Math.PI; x = f.cx + Math.sin(a) * 0.42; z = f.cz + Math.cos(a) * 0.42; yaw = a + Math.PI; }
    const k = 1 - Math.exp(-dt * 6); m.x += (x - m.x) * k; m.z += (z - m.z) * k; m.yaw = yaw;
    if (m !== player) m.av.anim = f.type; });
}
function joinGroup(type) {
  if (!st.owned[type]) return openShop('dance');
  const near = barDancers(player.x, player.z, 8);
  if (type === 'couple') { const n = near.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0]; if (!n) return toast('Chưa có ai gần đây để nhảy đôi 😅'); closePanel(); startForm('couple', [player, n], 30); player.dance = 'couple'; return; }
  if (near.length < 2) return toast('Cần ít nhất 2 người trên sàn để nhảy nhóm – chờ chút nhé!');
  closePanel(); startForm(type, [player, ...near.slice(0, 7)], 30); player.dance = type; bubble(player, type === 'conga' ? 'Ai lên tàu nào! 🚂' : 'Vào vòng nào mọi người! ⭕', 2.5);
  if (LIVE.isLive) setXu(2);
}
function chooseDance(groupOnly) {
  const list = groupOnly ? SHOP.dance.filter(d => d.group) : SHOP.dance;
  openPanel(`<h2>💃 ${groupOnly ? 'Nhảy nhóm' : 'Chọn điệu nhảy'}</h2><p class="muted">Nhảy theo nhịp ${Math.round(BEAT.bpm)} BPM. Điệu có 🔒 mở trong Shop bằng Xu (ảo).</p><div class="grid">${list.map(d => `<div class="item"><div class="ic">${d.icon}</div><div class="nm">${d.name}</div>${st.owned[d.id] ? `<button data-d="${d.id}">Nhảy</button>` : `<button class="dis" data-shop="1">🔒 ${d.price} Xu</button>`}</div>`).join('')}</div>`);
  $('panelBody').onclick = (e) => { if (e.target.dataset.shop) return openShop('dance'); const d = e.target.dataset.d; if (!d) return; if (['conga', 'circle', 'couple'].includes(d)) return joinGroup(d); if (player.form) leaveForm(player); player.dance = d; closePanel(); bubble(player, pick(['Quẩy thôi! 🕺', 'Lên nhạc nào!', 'Zo zo zo!']), 2.5); };
}

// ---------- context buttons ----------
let ctxSig = '';
function updateContext() {
  const btns = []; const px = player.x, pz = player.z;
  if (player.seat) btns.push(['🧍 Đứng dậy', () => standUp()]);
  else { let best = null, bd = 1.5; for (const s of W.spots) { if (!s.seat || (s.occupant && s.occupant !== player)) continue; const d = Math.hypot(s.x - px, s.z - pz); if (d < bd) { bd = d; best = s; } }
    if (best) btns.push([best.vip && !st.owned.cabana ? '🔒 Giường VIP' : best.lie ? '🏖️ Nằm nghỉ' : best.kind === 'rock' ? '🪨 Ngồi ngắm cảnh' : '🪑 Ngồi xuống', () => sitAt(best)]); }
  if (G.ctxExtra) for (const f of G.ctxExtra) f(btns, px, pz);
  for (const k in W.venues) { const v = W.venues[k]; const near = Math.hypot(v.counter.x - px, v.counter.z - pz) < 3.2 || (player.seat && player.seat.venue === k);
    if (near && v.menu) btns.push([`${v.icon} ${G.venueOpen && !G.venueOpen(k) ? 'Đóng cửa' : 'Gọi món'} – ${v.name}`, () => openMenu(v)]); }
  const df = nearFloor(px, pz); const onFloor = Math.abs(px - df.x) < df.half && Math.abs(pz - df.z) < df.half;
  if (onFloor && !player.seat) { btns.push(player.dance ? ['⏹️ Dừng nhảy', () => stopDance()] : ['💃 Nhảy', () => chooseDance()]); if (player.dance && !player.form) btns.push(['🔁 Đổi điệu', () => chooseDance()]); btns.push(player.form ? ['🚪 Rời nhóm', () => leaveForm(player)] : ['👯 Nhảy nhóm', () => chooseDance(true)]); }
  else if (!player.seat && Math.hypot(px - df.x, pz - df.z) < 10) btns.push(['🪩 Lên sàn nhảy', () => { player.target = { x: df.x + rnd(-1, 1), z: df.z + rnd(-1, 1) }; player.afterArrive = () => chooseDance(); }]);
  if (player.holding && !player.eatT) btns.push([player.holding.prop === 'plate' ? '😋 Ăn' : '😋 Uống', () => { player.eatT = 3.2; }]);
  let nn = null, nd = 2.6; for (const n of npcs) { const d = Math.hypot(n.x - px, n.z - pz); if (d < nd) { nd = d; nn = n; } }
  if (nn) btns.push([`🎁 Tặng đồ uống cho ${nn.name}`, () => openGift(nn)], [`👋 Chào ${nn.name}`, () => { cardNPC = nn; card.onclick({ target: { dataset: { c: 'greet' } } }); }]);
  if (!st.owned.cabana && Math.hypot(px - W.cabana.x, pz - (W.cabana.z + 3.4)) < 3.5) btns.push(['🔒 Lều VIP – mở khóa', () => openShop('vip')]);
  const sig = btns.map(b => b[0]).join('|'); if (sig === ctxSig) return; ctxSig = sig;
  const c = $('context'); c.innerHTML = ''; btns.slice(0, 5).forEach(([l, f]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => { f(); ctxSig = ''; }; c.append(b); });
}

// ---------- minimap ----------
const mm = $('minimap').getContext('2d');
const MM_ICONS = () => [[W.venues.restaurant, '🍤'], [W.venues.cafe, '☕'], [W.venues.bar, '🍺'], [W.venues.club, '🪩'], [W.venues.kiosk, '🥥'], [W.cabana, '👑'], [W.lagoon, '💧'], [{ x: -2, z: -40 }, '⛰️'], [{ x: W.pier.x, z: W.pier.z1 }, '⚓'], [W.volley, '🏐'], ...(G.mmExtra ? G.mmExtra() : [])];
function drawMinimap() {
  const S = W.mapScale, toM = (x, z) => [80 + x * S, 80 + z * S];
  mm.clearRect(0, 0, 160, 160); mm.drawImage(W.minimapBase, 0, 0);
  mm.font = '13px system-ui'; mm.textAlign = 'center'; mm.textBaseline = 'middle'; for (const [p, ic] of MM_ICONS()) { const [x, y] = toM(p.x, p.z); mm.fillText(ic, x, y); }
  mm.fillStyle = '#ff4fd8'; for (const n of npcs) { const [x, y] = toM(n.x, n.z); mm.fillRect(x - 1, y - 1, 2.4, 2.4); }
  const [x, y] = toM(player.x, player.z); mm.save(); mm.translate(x, y); mm.rotate(-player.yaw + Math.PI); mm.fillStyle = '#ffe066'; mm.strokeStyle = '#000'; mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 5); mm.lineTo(-5, 5); mm.closePath(); mm.fill(); mm.stroke(); mm.restore();
}

// ---------- buttons ----------
let started = false;
$('enterBtn').onclick = () => {
  st.name = G.account ? G.account.nick : ($('nameInput').value.trim() || (st.gender === 'f' ? 'Du khách nữ' : 'Du khách')).slice(0, 20); save();
  $('start').classList.add('hidden'); $('hud').classList.remove('hidden'); $('roomLabel').textContent = SERVER_NAMES[st.server]; $('timeBtn').textContent = TIME_ICON[st.server];
  W.setTime(st.server, renderer); buildPlayer();
  if (!started) { populate(); started = true; }
  if (player.seat) standUp(); player.x = W.spawn.x; player.z = W.spawn.z; player.yaw = Math.PI; cam.yaw = 0; // look toward island (north = -z)
  sound.start(); sound.setMuted(muted); setXu(0);
  toast(`🏝️ Chào mừng ${st.name} đến Đảo Ngọc! Đi theo bến tàu vào đảo nhé`);
  setTimeout(() => toast('🎁 Bấm "Điểm danh" để nhận Xu hằng ngày'), 4000);
  G.onEnter.forEach(f => f());
};
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('enterBtn').click(); });
let muted = false;
$('muteBtn').onclick = () => { muted = !muted; sound.setMuted(muted); $('muteBtn').textContent = muted ? '🔇' : '🔊'; };
$('shopBtn').onclick = () => openShop();
$('timeBtn').onclick = () => { const order = ['day', 'sunset', 'night']; const nx = order[(order.indexOf(W.time) + 1) % 3]; W.setTime(nx, renderer); $('timeBtn').textContent = TIME_ICON[nx]; toast({ day: '☀️ Ban ngày', sunset: '🌅 Hoàng hôn', night: '🌙 Ban đêm – Bar Beer lên đèn!' }[nx]); };
$('exitBtn').onclick = () => { $('start').classList.remove('hidden'); $('hud').classList.add('hidden'); closePanel(); };
$('checkinBtn').onclick = () => { const today = new Date().toDateString(); if (st.lastCheckin === today) return toast('Hôm nay bạn đã điểm danh rồi, mai quay lại nhé! 😉'); st.lastCheckin = today; setXu(50); toast('🎁 Điểm danh thành công: +50 Xu'); };
$('xuVal').textContent = st.xu;

// ---------- main loop ----------
const clock = new THREE.Clock(); let t = 0, ctxT = 0, mmT = 0, earnT = 0, frame = 0; const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
camera.position.set(W.spawn.x, 8, W.spawn.z + 10); camera.lookAt(0, 2, 0);
const FCAP = +(new URLSearchParams(location.search).get('fpscap') || 0); let lastRender = 0; // test/low-end: cap render rate
function loop() {
  requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta()); t += dt; frame++;
  const ab = !LIVE.isLive && !muted ? sound.beat() : null;
  if (ab != null && ab > 0) { BEAT.bpm = 124; BEAT.b = ab; } else { BEAT.bpm = LIVE.isLive ? (LIVE.bpm || 128) : 124; BEAT.b += dt * BEAT.bpm / 60; }
  BEAT.energy += ((LIVE.isLive ? 1.4 : W.night ? 1.1 : 0.9) - BEAT.energy) * Math.min(1, dt);
  const bt = BEAT.b, beat = Math.pow(1 - (((bt % 1) + 1) % 1), 3), bi = Math.floor(bt);
  if (started) { updateForm(dt); checkDrop(bi); G.onFrame.forEach(f => f(dt, t)); }
  const playing = started && $('start').classList.contains('hidden');
  if (playing) updatePlayer(dt);
  const pp = player.av ? player.av.root.position : new THREE.Vector3(W.spawn.x, 1, W.spawn.z);
  W.update(t, dt, beat, bi, playing ? pp : { x: 0, z: 0 });
  // NPCs
  const visR = Q.npcDist;
  for (const n of npcs) { const dist = Math.hypot(n.x - pp.x, n.z - pp.z); updateNPC(n, dt, t, dist);
    const vis = dist < visR && !(G.npcHide && G.npcHide(n)); n.av.root.visible = vis; if (!vis) continue;
    if (dist < 25 || (frame + n.id) % 3 === 0) animateAvatar(n.av, dist < 25 ? dt : dt * 3, t);
    n.av.root.position.set(n.x, npcY(n), n.z); n.av.root.rotation.y = n.yaw; }
  if (started) updateVolley(dt);
  if (playing) {
    animateAvatar(player.av, dt, t);
    ctxT -= dt; if (ctxT <= 0) { ctxT = 0.15; updateContext(); $('online').textContent = G.onlineText ? G.onlineText() : '👥 ' + (npcs.length + 1); $('here').textContent = W.zoneName(player.x, player.z); }
    mmT -= dt; if (mmT <= 0) { mmT = 0.2; drawMinimap(); }
    earnT += dt; if (earnT >= 60) { earnT = 0; const bonus = player.seat && player.seat.lie ? 2 : 0; setXu(5 + bonus); toast(`🪙 +${5 + bonus} Xu (thời gian online)`); }
    // audio mix
    const r = Math.hypot(player.x, player.z); const dBar = Math.min(Math.hypot(player.x - W.venues.bar.x, player.z - W.venues.bar.z), G.clubDist ? G.clubDist() : 99); const dCafe = Math.min(Math.hypot(player.x - W.venues.cafe.x, player.z - W.venues.cafe.z), Math.hypot(player.x - W.venues.restaurant.x, player.z - W.venues.restaurant.z));
    sound.setMix(0.12 + 0.75 * clamp((r - 26) / 20, 0, 1), Math.pow(1 - clamp(dBar / 30, 0, 1), 2) * 0.9 * (LIVE.streamOn ? 0 : 1), Math.max(Math.pow(1 - clamp(dCafe / 18, 0, 1), 2) * 0.55, G.extraCafe ? G.extraCafe() : 0));
    declutter(dt);
    // camera
    camTarget.set(pp.x, pp.y + (player.seat && player.seat.lie ? 0.6 : 1.5), pp.z);
    camPos.set(camTarget.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
    const gy = Math.max(W.walkY(camPos.x, camPos.z), 0) + 0.5; if (camPos.y < gy) camPos.y = gy;
    const snap = G.camAdjust ? G.camAdjust(camTarget, camPos, dt) : false;
    if (!(G.camOverride && G.camOverride(camera, dt, t))) { camera.position.lerp(camPos, 1 - Math.exp(-dt * (snap ? 30 : 8))); camera.lookAt(camTarget); }
    if (marker.visible) { marker.userData.t -= dt; marker.scale.setScalar(1 + (1.2 - marker.userData.t) * 0.6); marker.material.opacity = marker.userData.t / 1.2; if (marker.userData.t <= 0 || !player.target) marker.visible = false; }
  } else { camera.position.set(Math.sin(t * 0.05) * 70, 26, Math.cos(t * 0.05) * 70); camera.lookAt(0, 2, 0); }
  if (G.noRender) return; // test hook
  if (FCAP) { const n = performance.now(); if (n - lastRender < 1000 / FCAP) return; lastRender = n; }
  if (G.renderFrame) G.renderFrame(dt, t); else renderer.render(scene, camera);
}
// ---------- name tag / bubble declutter: fade by distance, hide overlapping, never cover the player ----------
const _dv = new THREE.Vector3(); let dcT = 0;
function declutter(dt) {
  dcT -= dt; const full = dcT <= 0; if (full) dcT = 0.12;
  const inClub = !!(G.W.club && G.W.club.inside), far = inClub ? 7 : 10, cp = camera.position;
  const items = []; const push = (spr, owner, pri) => { if (!spr || !owner || !owner.av) return; spr.getWorldPosition(_dv); const dc = _dv.distanceTo(cp); items.push({ spr, owner, pri, dc, wp: _dv.clone() }); };
  if (player.tag) push(player.tag, player, 3); if (player.bubble) push(player.bubble, player, 4);
  for (const n of npcs) { if (n.tag) push(n.tag, n, 0); if (n.bubble) push(n.bubble, n, 1); }
  if (G.net && G.net.remotes) for (const r of G.net.remotes.values()) { if (r.tag) push(r.tag, r, 2); if (r.ttag) push(r.ttag, r, 1.5); if (r.bubble) push(r.bubble, r, 2.5); }
  items.sort((a, b) => b.pri - a.pri || a.dc - b.dc);
  const rects = []; const W2 = innerWidth / 2, H2 = innerHeight / 2;
  for (const it of items) { const m = it.spr.material; const own = it.owner === player;
    let k = own ? (it.pri === 3 ? THREE.MathUtils.clamp((it.dc - 2.2) / 2.8, 0.18, 1) * (inClub ? 0.7 : 1) : 1) : THREE.MathUtils.clamp((far - it.dc + 3) / 3, 0, 1);
    if (!own && it.pri < 2 && it.dc < 2.2) k = 0; // too close to the lens
    if (k > 0) { const p = it.wp.clone().project(camera); if (p.z > 1) k = 0; else { const sx = (p.x + 1) * W2, sy = (1 - p.y) * H2, hw = it.spr.scale.x / Math.max(0.5, it.dc) * H2 * 0.9, hh = it.spr.scale.y / Math.max(0.5, it.dc) * H2 * 0.9;
        const r = [sx - hw, sy - hh, sx + hw, sy + hh]; if (!own && rects.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) k = it.pri >= 2 ? Math.min(k, 0.35) : 0; else rects.push(r); } }
    const tgt = (it.spr.userData.baseO ?? (it.spr.userData.baseO = m.opacity)) * k; m.transparent = true; m.opacity += (tgt - m.opacity) * Math.min(1, dt * 8); it.spr.visible = m.opacity > 0.03; }
}
let uiHidden = false;
G.toggleUI = (on) => { uiHidden = on === undefined ? !uiHidden : !!on; document.body.classList.toggle('noui', uiHidden); const b = document.getElementById('hideUiBtn'); if (b) b.textContent = uiHidden ? '👁️' : '🙈'; if (!G._uiQuiet) toast(uiHidden ? '🙈 Đã ẩn giao diện – bấm 👁️ hoặc phím H để hiện lại' : '👁️ Đã hiện giao diện'); };
{ const b = document.createElement('button'); b.id = 'hideUiBtn'; b.title = 'Ẩn/hiện giao diện (H)'; b.textContent = '🙈'; b.onclick = (e) => { e.stopPropagation(); G.toggleUI(); }; document.body.appendChild(b); b.style.display = 'none'; G.onFrame.push(() => { const v = G.isPlaying() ? '' : 'none'; if (b.style.display !== v) b.style.display = v; });
  const z = document.createElement('div'); z.id = 'zoomBtns'; z.innerHTML = '<button data-z="-1" title="Phóng to (+ / cuộn chuột / chụm 2 ngón)">＋</button><button data-z="1" title="Thu nhỏ (−)">－</button>'; z.onclick = (e) => { const d = e.target.dataset.z; if (d) cam.dist = clamp(cam.dist * (d > 0 ? 1.15 : 0.87), 2.2, 16); }; $('hud').appendChild(z);
  const st2 = document.createElement('style'); st2.textContent = '#hideUiBtn{position:fixed;left:12px;top:calc(50% + 34px);z-index:60;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,120,230,.5);background:rgba(20,8,40,.7);color:#fff;font-size:18px;cursor:pointer}#zoomBtns{position:fixed;left:12px;top:calc(50% - 46px);z-index:59;display:flex;flex-direction:column;gap:6px}#zoomBtns button{width:40px;height:34px;border-radius:10px;border:1px solid rgba(255,120,230,.4);background:rgba(20,8,40,.65);color:#fff;font-size:18px;cursor:pointer}body.noui #hud>*:not(#photoUI):not(#hideUiBtn){display:none!important}body.noui #zoomBtns,body.noui .toast,body.noui #toasts{display:none!important}body.noui.photo #photoUI{opacity:0;pointer-events:none}body.noui #hideUiBtn{opacity:.5}body.photo #hideUiBtn{top:70px;left:auto;right:12px}'; document.head.appendChild(st2); }
let lastDrop = 0;
function checkDrop(bi) { const every = LIVE.isLive ? 32 : 64; if (bi - lastDrop < every || bi % every !== 0) return; lastDrop = bi; doDrop(); }
function doDrop() { // the DJ drops the beat: whole bar throws hands up and cheers
  const dj = npcs.find(n => n.staff === 'dj'), mc = npcs.find(n => n.staff === 'mc'); if (dj) dj.av.drop = 2.2;
  if (mc) { mc.tempAnim = 'hype'; mc.tempT = 2.2; if (Math.random() < 0.6) bubble(mc, pick(LINES.mc), 3); }
  const b = W.venues.bar; let said = 0;
  npcs.forEach(n => { if (n.staff || n.mode !== 'act' || !n.spot || n.spot.venue !== 'bar' || n.av.seated) return; n.av.drop = 2; if (n.spot.kind === 'dance' || n.spot.kind === 'crowd' || Math.random() < 0.5) { n.tempAnim = 'hype'; n.tempT = 2; n.av.anim = 'hype'; n.av.animT = 0; } if (said < 3 && Math.random() < 0.3) { said++; bubble(n, pick(LINES.drop), 2.2); } });
  if (player.av && Math.hypot(player.x - b.x, player.z - b.z) < 12) player.av.drop = 2;
  W.flash && W.flash();
}
// NPC bubble -> chat log for nearby lines
const origUpdate = updateNPC;
window.__game = G; Object.assign(G, { Q, now: () => t, startActivity, enterSpot, buildPath, nearFloor, standUp, sitAt, stopDance, npcs, player, W, st, sound, scene, camera, renderer, LIVE, toast, setXu, save, bubble, logChat, openPanel, closePanel, doDrop, joinGroup, startForm, endForm, getForm: () => form, buildPlayer, BEAT, isTouch, cam, doEmote, goAct: (n, key) => { leaveSpot(n); goSpotKindOrRoute(n, key); }, goActNow: (n, key) => { const a = ACTS[key]; const l = a && a.kinds ? freeSpots(a) : []; if (!l.length) return false; leaveSpot(n); const s = pick(l); s.occupant = n; n.act = key; n.lastAct = key; n.path = []; n.target = s; enterSpot(n, s); n.timer = rnd(20, 60); return true; }, ACTS, LINES, pick, rnd, muted: () => muted, holdProp, createAvatar, textSprite, disposeSprite, playerLook, openShop, SHOP, chooseDance, updateTag: () => buildPlayer(), npcLine, isPlaying: () => started && $('start').classList.contains('hidden') });
loop();
