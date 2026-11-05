// LIVE SHOW – main stage = Vũ Trường LED wall (mirrored on the Bar Beer screen): LED screen (HLS / mp4 / Icecast audio), positional audio,
// schedule countdown, LIVE badge, crowd gathering, attendance rewards, reactions & virtual gifts.
import * as THREE from 'three';
const G = window.__game; const { W, scene, camera, sound, LIVE, toast, setXu, st, save, bubble, logChat, npcs } = G;
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const DAYS = ['Chủ nhật', 'thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7'];

// ---------- config ----------
const CFG = { streamUrl: '', showTime: { weekday: 6, hour: 21, minute: 0, durationMin: 180, tzOffset: 7 }, djName: 'DJ Sóng', mcName: 'MC Bin', bpm: 128, alwaysOn: false };
let forcedLive = false, simulateAt = 0;
async function loadConfig() {
  try { const r = await fetch('config.json', { cache: 'no-store' }); if (r.ok) { const c = await r.json(); Object.assign(CFG, c, { showTime: { ...CFG.showTime, ...(c.showTime || {}) } }); } } catch (e) { /* static host without config */ }
  try { const saved = JSON.parse(localStorage.getItem('daongoc_live') || 'null'); if (saved && Q.has('admin')) Object.assign(CFG, saved); } catch (e) {}
  if (Q.get('stream')) { CFG.streamUrl = Q.get('stream'); forcedLive = true; }
  if (Q.get('dj')) CFG.djName = Q.get('dj'); if (Q.get('mc')) CFG.mcName = Q.get('mc');
  LIVE.bpm = CFG.bpm; G.CFG = CFG;
}

// ---------- schedule (computed in the show's timezone, default UTC+7 Asia/Bangkok) ----------
function showWindow(now = Date.now()) {
  const s = CFG.showTime, off = (s.tzOffset ?? 7) * 3600e3; const local = new Date(now + off);
  const dayDiff = (s.weekday - local.getUTCDay() + 7) % 7;
  let start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayDiff, s.hour, s.minute) - off;
  const dur = (s.durationMin || 180) * 60e3;
  if (start + dur < now) start += 7 * 864e5; // this week's show is over -> next week
  if (start - 7 * 864e5 + dur > now) start -= 7 * 864e5; // still inside last occurrence
  return { start, end: start + dur, inShow: now >= start && now < start + dur };
}
const hhmm = () => { const s = CFG.showTime; return `${s.hour}h${s.minute ? String(s.minute).padStart(2, '0') : ''}`; };
function fmtLeft(ms) { const t = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (d ? d + ' ngày ' : '') + [h, m, s].map(v => String(v).padStart(2, '0')).join(':'); }

// ---------- LED screen ----------
const S = W.stage;
const cv = el('canvas'); cv.width = 512; cv.height = 288; const cx = cv.getContext('2d');
const canvasTex = new THREE.CanvasTexture(cv); canvasTex.colorSpace = THREE.SRGBColorSpace;
const ledMat = new THREE.MeshBasicMaterial({ map: canvasTex, toneMapped: false });
const led = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.h), ledMat); led.position.set(S.x, S.y, S.z + 0.08); scene.add(led);
const frame = new THREE.Mesh(new THREE.BoxGeometry(S.w + 0.3, S.h + 0.3, 0.15), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff2fbf', emissiveIntensity: 0.35 })); frame.position.set(S.x, S.y, S.z); scene.add(frame);
const stageLight = new THREE.PointLight('#ff4fd8', 0, 18); stageLight.position.set(S.x, S.y, S.z + 3); scene.add(stageLight);
// main stage: club LED wall shares the same material (same stream / canvas)
const M = W.club.led; const led2 = new THREE.Mesh(new THREE.PlaneGeometry(M.w, M.h), ledMat); led2.position.set(M.x - 0.06, M.y, M.z); led2.rotation.y = M.rotY; scene.add(led2);
const stageLight2 = new THREE.PointLight('#b04dff', 0, 16); stageLight2.position.set(M.x - 3, M.y, M.z); scene.add(stageLight2);
const BS = { x: S.x, y: S.y, z: S.z, fx: 0, fz: 1 }, CS = { x: M.x, y: M.y, z: M.z, fx: -1, fz: 0 }; let A = CS;
const front = (k) => ({ x: A.x + A.fx * k, z: A.z + A.fz * k });

// ---------- media ----------
const video = el('video', { crossOrigin: 'anonymous', playsInline: true, preload: 'none' }); video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.muted = false;
let plain = null, hls = null, vtex = null, audioOnly = false, srcNode = null, panner = null, analyser = null, freq = null, streamGain = null, corsOK = true, playing = false, lastErr = '';
function loadScript(src) { return new Promise((res, rej) => { const s = el('script', { src, onload: res, onerror: rej }); document.head.append(s); }); }
async function ensureHls() { if (window.Hls) return; try { await loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'); } catch (e) { await loadScript('js/vendor/hls.min.js'); } }
const isHls = (u) => /\.m3u8(\?|$)/i.test(u);
function setupAudioGraph() {
  if (srcNode || !sound.ctx) return; const c = sound.ctx;
  try {
    srcNode = c.createMediaElementSource(video);
    analyser = c.createAnalyser(); analyser.fftSize = 256; freq = new Uint8Array(analyser.frequencyBinCount);
    panner = c.createPanner(); Object.assign(panner, { panningModel: 'HRTF', distanceModel: 'linear', refDistance: 6, maxDistance: 60, rolloffFactor: 0.97 });
    streamGain = c.createGain(); streamGain.gain.value = 1.4;
    srcNode.connect(analyser); analyser.connect(panner); panner.connect(streamGain); streamGain.connect(sound.master);
    setPos(panner, front(1).x, A.y, front(1).z);
  } catch (e) { srcNode = null; lastErr = 'WebAudio: ' + e.message; }
}
function setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
async function playStream(url) {
  stopStream(); if (!url) return; lastErr = ''; audioOnly = false; corsOK = true;
  setupAudioGraph();
  if (isHls(url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
    await ensureHls();
    if (window.Hls && Hls.isSupported()) { hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3, backBufferLength: 30 }); hls.loadSource(url); hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) { lastErr = 'HLS: ' + d.details; if (d.type === Hls.ErrorTypes.NETWORK_ERROR) setTimeout(() => hls && hls.startLoad(), 3000); else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError(); else stopStream(); } }); }
    else { lastErr = 'Trình duyệt không hỗ trợ HLS'; return; }
  } else video.src = url;
  video.onloadedmetadata = () => { audioOnly = !video.videoWidth; if (!audioOnly) { vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace; ledMat.map = vtex; ledMat.needsUpdate = true; } };
  video.onerror = () => { lastErr = 'Media lỗi ' + (video.error ? video.error.code : '?') + ' (kiểm tra link / CORS)';
    if (!hls && !plain) { // server without CORS headers (common for Icecast): play through a plain <audio>, volume by distance, LED shows visualizer
      corsOK = false; plain = new Audio(url); plain.play().then(() => { playing = true; LIVE.streamOn = true; audioOnly = true; lastErr += ' → phát không CORS'; }).catch(e => { lastErr += ' / ' + e.message; needTap(); }); } };
  try { await video.play(); playing = true; LIVE.streamOn = true; } catch (e) { lastErr = 'play(): ' + e.message; needTap(); }
}
function needTap() { if ($('liveTap')) return; const b = el('button', { id: 'liveTap', className: 'pill btn live' }, '▶️ Bấm để nghe LIVE'); b.onclick = () => { b.remove(); (plain || video).play().then(() => { playing = true; LIVE.streamOn = true; }).catch(e => lastErr = e.message); }; $('hud').append(b); }
function stopStream() { if (plain) { plain.pause(); plain = null; } if (hls) { hls.destroy(); hls = null; } video.pause(); video.removeAttribute('src'); video.load(); playing = false; LIVE.streamOn = false; if (vtex) { vtex.dispose(); vtex = null; } ledMat.map = canvasTex; ledMat.needsUpdate = true; }

// ---------- LED canvas: poster (countdown) or audio visualizer ----------
function drawLED(t, state) {
  const g = cx, w = 512, h = 288; const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#1a0033'); grd.addColorStop(1, '#00121f'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  let bins = null; if (analyser && playing) { analyser.getByteFrequencyData(freq); bins = freq; }
  const N = 40; for (let i = 0; i < N; i++) { const v = bins ? bins[Math.floor(i * bins.length / N * 0.8)] / 255 : (0.25 + 0.6 * Math.pow(1 - (G.BEAT.b % 1), 3) * Math.abs(Math.sin(i * 1.7 + G.BEAT.b))) * (state === 'live' ? 1 : 0.6);
    const bh = v * h * 0.55; g.fillStyle = `hsl(${(i * 9 + t * 40) % 360},100%,60%)`; g.fillRect(i * (w / N) + 2, h - bh, w / N - 4, bh); }
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#ff2fbf'; g.shadowBlur = 16;
  if (state === 'live') { g.font = 'bold 40px system-ui'; g.fillText(CFG.djName, w / 2, 70); g.font = 'bold 22px system-ui'; g.fillText((audioOnly ? '🎧 LIVE AUDIO' : '🔴 LIVE') + ' · ' + CFG.mcName, w / 2, 105);
    g.fillStyle = (Math.floor(t * 2) % 2) ? '#ff1744' : '#fff'; g.beginPath(); g.arc(40, 34, 10, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 20px system-ui'; g.textAlign = 'left'; g.fillText('LIVE', 56, 41); }
  else { g.font = 'bold 44px system-ui'; g.fillText('BAR BEER', w / 2, 66); g.font = 'bold 22px system-ui'; g.fillText(`${CFG.djName} lên sóng ${hhmm()} tối ${DAYS[CFG.showTime.weekday]}`, w / 2, 104); g.font = 'bold 30px monospace'; g.fillStyle = '#ffe066'; g.fillText(state === 'soon' ? 'Sắp lên sóng!' : fmtLeft(win.start - Date.now()), w / 2, 146); }
  g.shadowBlur = 0; canvasTex.needsUpdate = true;
}

// ---------- billboard near the bar entrance ----------
const bcv = el('canvas'); bcv.width = 512; bcv.height = 256; const bcx = bcv.getContext('2d'); const btex = new THREE.CanvasTexture(bcv); btex.colorSpace = THREE.SRGBColorSpace;
const board = new THREE.Group(); { const e = W.venues.bar.entry || { x: W.venues.bar.x, z: W.venues.bar.z + 8 };
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false, side: THREE.DoubleSide })); p.position.y = 2.6; board.add(p);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: '#333' })); pole.position.y = 1.1; board.add(pole);
  board.position.set(e.x + 3.2, W.walkY(e.x + 3.2, e.z + 1.5), e.z + 1.5); board.rotation.y = 0.35; scene.add(board); }
function drawBoard(state) { const g = bcx; g.fillStyle = '#12001f'; g.fillRect(0, 0, 512, 256); g.strokeStyle = state === 'live' ? '#ff1744' : '#ff4fd8'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 246); g.textAlign = 'center'; g.fillStyle = '#fff';
  g.font = 'bold 40px system-ui'; g.fillText(state === 'live' ? '🔴 ĐANG LIVE!' : '🎧 LIVE SHOW', 256, 62); g.font = 'bold 28px system-ui'; g.fillText(`${CFG.djName} & ${CFG.mcName}`, 256, 112);
  g.font = '26px system-ui'; g.fillText(state === 'live' ? 'Vào Vũ Trường – sân khấu chính!' : `${hhmm()} tối ${DAYS[CFG.showTime.weekday]} hằng tuần`, 256, 160); g.fillStyle = '#ffe066'; g.font = 'bold 30px monospace'; g.fillText(state === 'live' ? '+Xu khi tham gia' : fmtLeft(win.start - Date.now()), 256, 214); btex.needsUpdate = true; }

// ---------- HUD: banner, LIVE badge, reaction bar, gifts, admin ----------
const banner = el('div', { id: 'liveBanner', className: 'pill' }); $('hud').append(banner);
banner.onclick = () => { if (LIVE.isLive) goStage(); };
const bar = el('div', { id: 'liveBar' }, [['firework', '🎆', 'Pháo hoa'], ['clap', '👏', 'Vỗ tay'], ['heart', '❤️', 'Tim'], ['flash', '⚡', 'Đèn flash'], ['gift', '🎁', 'Tặng DJ']].map(([k, i, n]) => `<button data-r="${k}">${i}<span>${n}</span></button>`).join('')); $('hud').append(bar);
bar.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; react(b.dataset.r, true); };
function goStage() { const p = G.player, v = W.venues.club; if (W.club.contains(p.x, p.z)) p.target = { x: W.clubFloor.x + 1.5, z: W.clubFloor.z + (Math.random() - 0.5) * 3 }; else { p.target = { x: v.inner.x, z: v.inner.z }; p.afterArrive = () => { p.target = { x: W.clubFloor.x + 1.5, z: W.clubFloor.z + (Math.random() - 0.5) * 3 }; }; } toast('🎧 Đang tới sân khấu chính – Vũ Trường...'); }

// ---------- particles (one pooled Points object) ----------
const PN = 600; const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3); const pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); pts.frustumCulled = false; scene.add(pts);
let pI = 0; const col = new THREE.Color();
function burst(x, y, z, n, speed, hue, grav = 4, life = 1.6) { for (let k = 0; k < n; k++) { const i = pI = (pI + 1) % PN; const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), v = speed * (0.6 + Math.random() * 0.4);
  pPos.set([x, y, z], i * 3); pVel.set([Math.sin(ph) * Math.cos(th) * v, Math.cos(ph) * v + grav * 0.25, Math.sin(ph) * Math.sin(th) * v], i * 3); pLife[i] = life * (0.7 + Math.random() * 0.3); col.setHSL(hue < 0 ? Math.random() : hue + Math.random() * 0.08, 1, 0.6); pCol.set([col.r, col.g, col.b], i * 3); } }
function stepParticles(dt) { for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; } pLife[i] -= dt; pVel[i * 3 + 1] -= 4 * dt; for (let a = 0; a < 3; a++) pPos[i * 3 + a] += pVel[i * 3 + a] * dt; const f = Math.min(1, pLife[i]); pCol[i * 3] *= 0.995; } pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pts.material.opacity = 0.95; }
const floaters = []; // emoji sprites rising (hearts / claps)
function emojiSprite(ch) { const c = el('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '48px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 36); const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(0.5, 0.5, 0.5); return s; }
const EMO = {}; const getEmo = (ch) => { const s = (EMO[ch] = EMO[ch] || emojiSprite(ch)).clone(); s.material = s.material.clone(); return s; };
G.floatEmoji = (...a) => floatEmoji(...a);
function floatEmoji(ch, x, y, z, n = 6) { for (let k = 0; k < n; k++) { const s = getEmo(ch); s.position.set(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 0.5, z + (Math.random() - 0.5) * 1.2); scene.add(s); floaters.push({ s, v: 0.8 + Math.random() * 0.8, life: 2 + Math.random() }); if (floaters.length > 80) { const f = floaters.shift(); scene.remove(f.s); f.s.material.dispose(); } } }
let flashT = 0; const flashDiv = el('div', { id: 'flashFx' }); document.body.append(flashDiv);
function react(kind, mine, who) {
  const p = G.player, py = (p.y || 1.6) + 2.1;
  if (kind === 'gift') return mine ? openGifts() : null;
  if (kind === 'firework') { for (let k = 0; k < 3; k++) setTimeout(() => burst(front(2).x + (Math.random() - 0.5) * 6 * A.fz, A.y + 1.5 + Math.random() * 1.5, front(2).z + (Math.random() - 0.5) * 6 * -A.fx, 70, 5, -1), k * 260); if (mine) G.sound.ctx && boom(); }
  if (kind === 'clap') { floatEmoji('👏', p.x, py, p.z, mine ? 5 : 3); if (mine) npcs.filter(n => !n.staff && Math.hypot(n.x - p.x, n.z - p.z) < 7 && n.mode === 'act' && !n.av.seated).slice(0, 4).forEach(n => { n.tempAnim = 'clap'; n.tempT = 2; n.av.anim = 'clap'; }); }
  if (kind === 'heart') { floatEmoji('❤️', p.x, py, p.z, 6); floatEmoji('💖', front(1).x, A.y - 1, front(1).z, 3); }
  if (kind === 'flash') { flashT = 0.6; stageLight.intensity = 60; G.W.flash && G.W.flash(); }
  if (mine) { G.player.av.anim = kind === 'clap' ? 'clap' : 'hype'; G.player.emote = kind === 'clap' ? 'clap' : 'hype'; G.player.emoteT = 1.6; if (G.net && G.net.on) G.net.send({ t: 'react', k: kind }); }
}
G.react = react;
function boom() { const c = sound.ctx, n = c.createBufferSource(), b = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); n.buffer = b; const g = c.createGain(); g.gain.value = 0.35; n.connect(g); g.connect(sound.master); n.start(); }
const GIFTS = [['🌹', 'Hoa hồng', 10], ['🍺', 'Mời bia', 20], ['🎆', 'Pháo hoa lớn', 50], ['💎', 'Kim cương', 100], ['🚀', 'Tên lửa', 200]];
function openGifts() {
  G.openPanel(`<h2>🎁 Tặng DJ ${CFG.djName}</h2><p class="muted">Quà là vật phẩm <b>ảo</b> mua bằng Xu (tiền ảo trong game). Không quy đổi ra tiền thật, không rút tiền, DJ không nhận tiền thật từ quà này.</p>
  <div class="grid">${GIFTS.map(([i, n, p]) => `<div class="item"><div class="ic">${i}</div><div class="nm">${n}</div><button data-g="${i}">${p} Xu</button></div>`).join('')}</div>`);
  $('panelBody').onclick = (e) => { const ic = e.target.dataset.g; if (!ic) return; const g = GIFTS.find(x => x[0] === ic); if (st.xu < g[2]) return toast('Không đủ Xu 😅 – điểm danh hoặc online thêm nhé'); setXu(-g[2]); G.closePanel(); giftFx(st.name || 'Bạn', g, true); };
}
function giftFx(name, g, mine) { const dj = npcs.find(n => n.staff === (A === CS ? 'clubdj' : 'dj')); floatEmoji(g[0], front(1.2).x, A.y - 1.2, front(1.2).z, g[2] >= 100 ? 14 : 7); if (g[2] >= 50) react('firework', false);
  const line = `🎁 ${name} tặng DJ ${g[0]} ${g[1]}!`; logChat('Sân khấu', line); toast(line); if (dj) bubble(dj, `Cảm ơn ${name} nhiều nha! ${g[0]}`, 3.5); if (mine && G.net && G.net.on) G.net.send({ t: 'gift', g: g[0] }); }
G.giftFx = (name, ic) => { const g = GIFTS.find(x => x[0] === ic); if (g) giftFx(name, g, false); };

// ---------- admin panel (?admin=1) ----------
if (Q.has('admin')) {
  const b = el('button', { className: 'pill btn', title: 'Admin LIVE' }, '🛠️'); $('topbar').insertBefore(b, $('muteBtn'));
  b.onclick = openAdmin;
}
function openAdmin() {
  const pre = [['Mux test HLS', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'], ['Apple HLS (bipbop)', 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8']];
  G.openPanel(`<h2>🛠️ Admin LIVE</h2><p class="muted">Dán link stream (HLS .m3u8, mp4, hoặc Icecast mp3/aac). Chỉ lưu trên trình duyệt này; muốn áp dụng cho mọi người, sửa <b>config.json</b>.</p>
   <input id="adUrl" style="width:100%" placeholder="https://.../live.m3u8" value="${CFG.streamUrl || ''}">
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${pre.map(p => `<button class="pill btn" data-pre="${p[1]}">${p[0]}</button>`).join('')}</div>
   <div style="display:flex;gap:6px;flex-wrap:wrap"><input id="adDj" placeholder="Tên DJ" value="${CFG.djName}"><input id="adMc" placeholder="Tên MC" value="${CFG.mcName}"></div>
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button class="pill btn" data-a="play">▶️ Phát thử ngay (LIVE)</button><button class="pill btn" data-a="stop">⏹️ Dừng</button><button class="pill btn" data-a="sim">⏱️ Giả lập show sau 10s</button><button class="pill btn" data-a="save">💾 Lưu (trình duyệt)</button></div>
   <pre id="adStats" style="font-size:12px;white-space:pre-wrap;background:#0006;padding:8px;border-radius:8px"></pre>
   <p class="muted">Đoạn config.json:</p><pre id="adJson" style="font-size:12px;white-space:pre-wrap;background:#0006;padding:8px;border-radius:8px;user-select:all"></pre>`);
  const body = $('panelBody'); const upd = () => { CFG.streamUrl = $('adUrl').value.trim(); CFG.djName = $('adDj').value.trim() || CFG.djName; CFG.mcName = $('adMc').value.trim() || CFG.mcName; $('adJson').textContent = JSON.stringify({ streamUrl: CFG.streamUrl, showTime: CFG.showTime, djName: CFG.djName, mcName: CFG.mcName, bpm: CFG.bpm, serverUrl: CFG.serverUrl || 'auto' }, null, 2); }; upd();
  body.oninput = upd;
  body.onclick = (e) => { const t = e.target; if (t.dataset.pre) { $('adUrl').value = t.dataset.pre; upd(); }
    const a = t.dataset.a; if (!a) return; upd();
    if (a === 'play') { forcedLive = true; simulateAt = 0; setState(true); }
    if (a === 'stop') { forcedLive = false; simulateAt = 0; setState(false); }
    if (a === 'sim') { forcedLive = false; simulateAt = Date.now() + 10000; toast('⏱️ Show giả lập sẽ bắt đầu sau 10 giây'); }
    if (a === 'save') { localStorage.setItem('daongoc_live', JSON.stringify({ streamUrl: CFG.streamUrl, djName: CFG.djName, mcName: CFG.mcName })); toast('💾 Đã lưu cấu hình LIVE trên trình duyệt này'); } };
  const iv = setInterval(() => { const s = $('adStats'); if (!s) return clearInterval(iv);
    s.textContent = `Trạng thái: ${LIVE.isLive ? 'LIVE' : 'chờ'} · đang phát: ${playing}\nLoại: ${hls ? 'hls.js' : video.src ? 'native' : '-'} ${audioOnly ? '(chỉ âm thanh)' : video.videoWidth ? video.videoWidth + 'x' + video.videoHeight : ''}\nĐộ trễ ước tính: ${hls && hls.latency ? hls.latency.toFixed(1) + 's' : '-'} · buffer: ${video.buffered.length ? (video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(1) + 's' : '-'}\nWebAudio 3D: ${srcNode ? 'có (âm thanh theo khoảng cách)' : 'không – dùng volume theo khoảng cách'}\nLỗi: ${lastErr || 'không'}\nShow kế tiếp: ${new Date(win.start).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' })} (GMT+7)`; }, 500);
}

// ---------- state machine ----------
let win = showWindow(), state = 'idle', liveSince = 0, nearT = 0, rewardKey = '';
function setState(live) {
  if (live === LIVE.isLive) { if (live && CFG.streamUrl && !playing && G.isPlaying()) playStream(CFG.streamUrl); return; }
  LIVE.isLive = live; document.body.classList.toggle('isLive', live);
  if (live) { liveSince = Date.now(); rewardKey = 'show-' + new Date(win.start).toISOString().slice(0, 10) + (forcedLive ? '-t' + Math.floor(Date.now() / 36e5) : ''); nearT = 0;
    if (CFG.streamUrl && G.isPlaying()) playStream(CFG.streamUrl);
    toast(`🔴 LIVE! ${CFG.djName} & ${CFG.mcName} đang diễn tại Vũ Trường (sân khấu chính) – bấm banner để tới xem`); logChat('Sân khấu', `🔴 ${CFG.djName} đã lên sóng!`);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) try { new Notification('Đảo Ngọc: LIVE!', { body: `${CFG.djName} đang diễn tại Vũ Trường` }); } catch (e) {}
    gather(); }
  else { stopStream(); toast('Show đã kết thúc – hẹn gặp lại tối thứ 7 tuần sau! 👋'); }
}
function gather() { // NPCs head to the stage to watch and dance
  const pool = npcs.filter(n => !n.staff && n.look.age !== 'kid' && n.mode !== 'form' && !(n.spot && n.spot.venue === 'bar'));
  pool.sort(() => Math.random() - 0.5).slice(0, Math.round(pool.length * 0.55)).forEach((n, i) => setTimeout(() => G.goAct(n, Math.random() < 0.75 ? (Math.random() < 0.5 ? 'clubCrowd' : 'clubDance') : (Math.random() < 0.5 ? 'crowd' : 'dance')), i * 250));
}
G.onEnter.push(() => { if (LIVE.isLive && CFG.streamUrl && !playing) playStream(CFG.streamUrl); });
let tick = 0, ledT = 0; const fwd = new THREE.Vector3();
G.onFrame.push((dt, t) => {
  tick -= dt; if (tick <= 0) { tick = 1; win = showWindow(); const sim = simulateAt && Date.now() >= simulateAt;
    const live = forcedLive || sim || win.inShow; // scheduled window is an in-game event even without a stream (NPC DJ + built-in beat)
    const soon = !live && win.start - Date.now() < 15 * 60e3; state = live ? 'live' : soon ? 'soon' : 'idle'; setState(live);
    banner.innerHTML = live ? `<b class="badge">● LIVE</b> ${CFG.djName} & ${CFG.mcName} đang diễn ở Vũ Trường <u>Đến xem ➜</u>` : `🎧 ${CFG.djName} lên sóng lúc ${hhmm()} tối ${DAYS[CFG.showTime.weekday]} · còn <b>${simulateAt ? fmtLeft(simulateAt - Date.now()) : fmtLeft(win.start - Date.now())}</b>`;
    drawBoard(state);
    // participation reward
    const p = G.player; const near = live && (Math.hypot(p.x - (CS.x - 6), p.z - CS.z) < 10 || Math.hypot(p.x - S.x, p.z - (S.z + 5)) < 12);
    if (near) { nearT += 1; const got = st.liveRewards && st.liveRewards[rewardKey] || 0;
      if (nearT === 60 && !got) { st.liveRewards = { [rewardKey]: 1 }; setXu(30); toast('🎉 +30 Xu: thưởng tham gia LIVE show!');  G.onEventAttend && G.onEventAttend('djlive'); }
      else if (nearT > 60 && nearT % 300 === 0) { setXu(20); toast('🪩 +20 Xu: quẩy cùng DJ thêm 5 phút!'); } }
  }
  // LED texture & positional audio
  const p = G.player, dB = Math.hypot(p.x - S.x, p.z - S.z), dC = Math.hypot(p.x - CS.x, p.z - CS.z); A = dC < dB ? CS : BS; const dStage = Math.min(dB, dC); if (panner) setPos(panner, front(1).x, A.y, front(1).z);
  ledT -= dt; if ((!vtex || audioOnly) && ledT <= 0 && dStage < 70) { ledT = dStage < 30 ? 1 / 24 : 0.25; drawLED(t, state); }
  if (sound.ctx) { const L = sound.ctx.listener; camera.getWorldDirection(fwd); const c = camera.position;
    if (L.positionX) { L.positionX.value = c.x; L.positionY.value = c.y; L.positionZ.value = c.z; L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; } else { L.setPosition(c.x, c.y, c.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); } }
  const vol = Math.max(0, Math.min(1, 1 - (dStage - 6) / 54)) * (G.muted && G.muted() ? 0 : 1); if (plain) plain.volume = vol; else if (playing && !srcNode) video.volume = vol; // fallback when WebAudio is unavailable
  // stage lights
  const beat = Math.pow(1 - (((G.BEAT.b % 1) + 1) % 1), 3); flashT = Math.max(0, flashT - dt);
  stageLight.intensity = flashT > 0 ? 40 * flashT : (LIVE.isLive ? 6 + 10 * beat : 0); stageLight.color.setHSL((t * 0.1) % 1, 1, 0.6); stageLight2.intensity = LIVE.isLive ? 8 + 14 * beat : 0; stageLight2.color.copy(stageLight.color); frame.material.emissiveIntensity = 0.2 + (LIVE.isLive ? beat * 0.9 : 0.2);
  flashDiv.style.opacity = flashT > 0 && dStage < 25 ? (flashT * 0.8 * (Math.floor(t * 20) % 2)).toFixed(2) : 0;
  stepParticles(dt);
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.life -= dt; f.s.position.y += f.v * dt; f.s.material.opacity = Math.min(1, f.life); if (f.life <= 0) { scene.remove(f.s); f.s.material.dispose(); floaters.splice(i, 1); } }
  // during the show NPC crowd spontaneously reacts
  if (LIVE.isLive && Math.random() < dt / 6) { const n = npcs.find(n => !n.staff && n.spot && n.spot.kind === 'crowd' && Math.random() < 0.3); if (n) { floatEmoji(G.pick(['❤️', '👏', '🔥']), n.x, 3.4, n.z, 2); if (Math.random() < 0.3) bubble(n, G.pick(G.LINES.live), 2.5); } }
  bar.classList.toggle('show', G.isPlaying() && (LIVE.isLive || dStage < 22));
});
await loadConfig(); win = showWindow(); drawLED(0, 'idle'); drawBoard('idle');
G.live = { force(on) { forcedLive = on; simulateAt = 0; setState(on); }, CFG, playStream, stopStream, setState, video, get playing() { return playing; }, get audioOnly() { return audioOnly; }, get hls() { return hls; }, react, showWindow, get err() { return lastErr; } };
