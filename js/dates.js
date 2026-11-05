// ĐIỂM HẸN RIÊNG TƯ: 9 romantic PG-13 date spots. Each date runs in a server-side private instance:
// only the two invited players see/hear each other; everyone else sees "Khu riêng tư – đang có người".
// Premium spots are booked with virtual Xu (mock). Leave / block / report is always one tap away. 18+ gate stays in 💘.
import * as THREE from 'three';
const G = window.__game; const { W, st, scene, toast, setXu, save, npcs, player } = G; const net = G.net;
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PI = Math.PI;
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const glowM = (c, i = 1.4) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });
const add = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, typeof m === 'string' ? M(m) : m); o.position.set(x, y, z); g.add(o); return o; };
const B = (g, w, h, d, m, x, y, z) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
const Cy = (g, rt, rb, h, m, x, y, z, seg = 10) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const Sp = (g, r, m, x, y, z) => add(g, new THREE.SphereGeometry(r, 10, 8), m, x, y, z);
const flames = [], swings = [], bobs = [];
const candle = (g, x, y, z) => { Cy(g, 0.03, 0.03, 0.14, '#fff8e1', x, y + 0.07, z, 8); const f = Sp(g, 0.025, glowM('#ffb300', 2.5), x, y + 0.17, z); f.scale.y = 1.8; flames.push(f); };
const lantern = (g, x, y, z, c = '#ff5252') => { const l = Sp(g, 0.18, glowM(c, 1.3), x, y, z); l.scale.y = 1.25; Cy(g, 0.1, 0.1, 0.05, '#333', x, y + 0.24, z, 8); flames.push(l); return l; };
const light = (g, c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 2); l.position.set(x, y, z); g.add(l); l.userData.base = i; flames.push(l); return l; };
const chair = (g, x, z, ry, c = '#5d4037') => { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); B(s, 0.45, 0.06, 0.45, c, 0, 0.46, 0); B(s, 0.45, 0.5, 0.05, c, 0, 0.72, -0.21); for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) B(s, 0.04, 0.45, 0.04, c, a, 0.22, b); };
const bench = (g, z, c = '#795548', w = 1.5) => { B(g, w, 0.08, 0.45, c, 0, 0.47, z); B(g, w, 0.4, 0.06, c, 0, 0.75, z - 0.22); for (const s of [-1, 1]) B(g, 0.06, 0.45, 0.4, '#4e342e', s * (w / 2 - 0.08), 0.22, z); };
const table2 = (g, x, z, cloth = '#ffffff') => { Cy(g, 0.45, 0.45, 0.04, cloth, x, 0.76, z, 20); Cy(g, 0.47, 0.47, 0.12, cloth, x, 0.7, z, 20); Cy(g, 0.05, 0.08, 0.72, '#555', x, 0.36, z, 8); };

// ---------- spot definitions (ids match server PRIVATE set) ----------
// local frame: +z = view direction (rotation.y = view). seats: [dx, dz, localRot, seatH]
const DEFS = [
  { id: 'cove', name: 'Vịnh Nhỏ – Bữa tối nến', icon: '🕯️', price: 60, x: -46.5, z: 1, view: -PI / 2, r: 3.2, amb: 'Sóng vỗ & guitar mộc',
    build(g) { table2(g, 0, 0.3); candle(g, -0.12, 0.78, 0.3); candle(g, 0.1, 0.78, 0.2); candle(g, 0.02, 0.78, 0.42); chair(g, -0.8, 0.3, PI / 2, '#fafafa'); chair(g, 0.8, 0.3, -PI / 2, '#fafafa');
      light(g, '#ffb35a', 3, 9, 0, 1.3, 0.3); const rk = M('#8d877c', { flatShading: true });
      for (let i = 0; i < 9; i++) { const a = PI * 0.75 + i / 8 * PI * 1.5; const r = add(g, new THREE.DodecahedronGeometry(0.5 + (i % 3) * 0.35), rk, Math.sin(a) * 3.6, 0.3, Math.cos(a) * 3.6); r.rotation.set(i, i * 2, 0); }
      for (let i = 0; i < 40; i++) { const p = add(g, new THREE.CircleGeometry(0.05, 5), M('#e53935', { side: THREE.DoubleSide }), (Math.random() - 0.5) * 3, 0.03, (Math.random() - 0.5) * 3); p.rotation.x = -PI / 2; }
      for (const s of [-1, 1]) { Cy(g, 0.04, 0.05, 1.6, '#5d4037', s * 1.8, 0.8, -1.2, 6); lantern(g, s * 1.8, 1.7, -1.2, '#ffb74d'); } },
    seats: [[-0.62, 0.3, PI / 2, 0.48], [0.62, 0.3, -PI / 2, 0.48]], table: [0, 0.8, 0.3] },
  { id: 'pierend', name: 'Cuối Cầu Tàu Lồng Đèn', icon: '🏮', price: 50, x: 22, z: 0, view: 0, r: 2.4, amb: 'Hoàng hôn & đàn tranh nhẹ', deck: true,
    build(g, sp) { const L = sp.len; const wood = M('#8d6e63'); B(g, 2.4, 0.2, L, wood, 0, -0.1, -L / 2 + 2); B(g, 4.2, 0.2, 4, wood, 0, -0.1, 0);
      for (let k = 0; k <= L; k += 3) for (const s of [-1, 1]) Cy(g, 0.1, 0.1, 2.5, '#5d3a1f', s * 1.15, -1.2, 2 - k, 6);
      for (let k = 1; k < L; k += 2.5) for (const s of [-1, 1]) { Cy(g, 0.04, 0.04, 1.6, '#4e342e', s * 1.15, 0.8, 1.8 - k, 6); lantern(g, s * 1.15, 1.75, 1.8 - k, k % 5 < 2.5 ? '#ff1744' : '#ff9100'); }
      for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { Cy(g, 0.05, 0.05, 2.2, '#4e342e', a, 1.1, b, 6); lantern(g, a, 2.3, b, '#ff1744'); }
      bench(g, 0.6, '#6d4c41'); light(g, '#ff6e40', 3, 10, 0, 2, 0); },
    seats: [[-0.4, 0.68, 0, 0.5], [0.4, 0.68, 0, 0.5]], table: [0, 0.5, 1.4] },
  { id: 'gazebo', name: 'Chòi Ngắm Cảnh Đỉnh Đồi', icon: '🌄', price: 0, x: 31, z: -28, view: Math.atan2(-31, 36), r: 2.6, amb: 'Gió đồi & piano',
    build(g) { Cy(g, 2.3, 2.4, 0.25, '#d7ccc8', 0, 0.12, 0, 8); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + PI / 8; if (Math.abs(Math.cos(a) - 1) < 0.2) continue; Cy(g, 0.07, 0.07, 2.5, '#fafafa', Math.sin(a) * 2.1, 1.45, Math.cos(a) * 2.1, 6); }
      const roof = add(g, new THREE.ConeGeometry(2.8, 1.4, 8), M('#8d5524', { flatShading: true }), 0, 3.35, 0); roof.rotation.y = PI / 8;
      for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; const b = Sp(g, 0.05, glowM(i % 2 ? '#fff59d' : '#ffccbc', 2), Math.sin(a) * 2.35, 2.62, Math.cos(a) * 2.35); flames.push(b); }
      bench(g, -0.2, '#a1887f'); light(g, '#fff3c4', 2.2, 9, 0, 2.4, 0); },
    seats: [[-0.4, -0.12, 0, 0.5], [0.4, -0.12, 0, 0.5]], table: [0, 0.55, 0.6] },
  { id: 'lagoonbench', name: 'Ghế Đá Hồ Thác Nước', icon: '💧', price: 0, x: -25.2, z: -10, view: Math.atan2(-7.8, -6), r: 2.2, amb: 'Tiếng thác & côn trùng đêm',
    build(g) { const stn = M('#9e9e9e', { flatShading: true }); B(g, 1.6, 0.14, 0.5, stn, 0, 0.47, 0); for (const s of [-1, 1]) B(g, 0.2, 0.42, 0.42, stn, s * 0.6, 0.2, 0);
      for (let i = 0; i < 18; i++) { const f = Sp(g, 0.04, glowM('#ccff90', 2.5), (Math.random() - 0.5) * 4, 0.6 + Math.random() * 1.6, (Math.random() - 0.2) * 4); f.userData.fly = Math.random() * 6; flames.push(f); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; const fl = Sp(g, 0.12, M(['#f48fb1', '#fff', '#ce93d8'][i % 3]), Math.sin(a) * 1.4, 0.1, Math.cos(a) * 1.4 - 0.9); fl.scale.y = 0.6; }
      lantern(g, 1.1, 0.9, -0.3, '#b3e5fc'); Cy(g, 0.03, 0.03, 0.8, '#444', 1.1, 0.4, -0.3, 6); },
    seats: [[-0.38, 0.02, 0, 0.5], [0.38, 0.02, 0, 0.5]], table: [0.95, 0.5, 0.4] },
  { id: 'garden', name: 'Vườn Hoa Xích Đu', icon: '🌸', price: 0, x: 12, z: 37, view: 0, r: 3, amb: 'Chim hót & hộp nhạc',
    build(g) { const N = 260, im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 5), M('#ffffff'), N); const m4 = new THREE.Matrix4(), cc = new THREE.Color(); const cols = ['#ff4081', '#ffeb3b', '#ffffff', '#e040fb', '#ff7043', '#f06292'];
      for (let i = 0; i < N; i++) { const a = Math.random() * PI * 2, r = 2.6 + Math.random() * 1.6; m4.makeTranslation(Math.sin(a) * r, 0.25 + Math.random() * 0.2, Math.cos(a) * r); im.setMatrixAt(i, m4); im.setColorAt(i, cc.set(cols[i % cols.length])); } g.add(im);
      for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2; B(g, 0.9, 0.35, 0.5, '#388e3c', Math.sin(a) * 3.4, 0.17, Math.cos(a) * 3.4).rotation.y = a; }
      for (const s of [-1, 1]) { const p = Cy(g, 0.07, 0.07, 2.6, '#fafafa', s * 1.2, 1.3, 0, 6); p.rotation.z = s * 0.12; } Cy(g, 0.06, 0.06, 2.6, '#fafafa', 0, 2.55, 0, 6).rotation.z = PI / 2;
      for (let i = 0; i < 16; i++) Sp(g, 0.11, M(i % 2 ? '#f06292' : '#fff176'), -1.2 + i * 0.16, 2.62 + Math.sin(i) * 0.04, 0);
      const sw = new THREE.Group(); sw.position.set(0, 2.5, 0); g.add(sw); for (const s of [-0.7, 0.7]) Cy(sw, 0.015, 0.015, 1.95, '#bdbdbd', s, -0.98, 0, 4);
      B(sw, 1.6, 0.08, 0.5, '#ffffff', 0, -1.98, 0); B(sw, 1.6, 0.45, 0.05, '#ffffff', 0, -1.75, -0.24); swings.push(sw); light(g, '#ffe0f0', 1.5, 8, 0, 2.2, 1); },
    seats: [[-0.38, 0.04, 0, 0.56], [0.38, 0.04, 0, 0.56]], table: [0, 0.3, 1.2], swing: true },
  { id: 'rooftop', name: 'Café Sân Thượng', icon: '🌃', price: 80, x: 35, z: 4, view: PI / 2, r: 1.9, amb: 'Lofi café', roof: 4.3,
    build(g) { B(g, 4.6, 4.2, 4.6, '#f3e5d8', 0, 2.1, 0); B(g, 1.1, 2, 0.06, '#6d4c41', 0, 1, -2.32); for (const [a, b] of [[-1.2, 2.32], [1.2, 2.32], [-1.2, -2.32], [1.2, -2.32]]) B(g, 0.9, 0.9, 0.06, glowM('#ffe082', 0.6), a, 3, b);
      B(g, 4.8, 0.12, 4.8, '#8d6e63', 0, 4.26, 0); for (const [w, d, a, b] of [[4.8, 0.08, 0, 2.36], [4.8, 0.08, 0, -2.36], [0.08, 4.8, 2.36, 0], [0.08, 4.8, -2.36, 0]]) { B(g, w, 0.06, d, '#424242', a, 5.25, b); B(g, w, 0.9, d, M('#90caf9', { transparent: true, opacity: 0.25 }), a, 4.75, b); }
      const top = new THREE.Group(); top.position.y = 4.32; g.add(top); table2(top, 0, 0.8, '#3e2723'); chair(top, -0.75, 0.8, PI / 2, '#212121'); chair(top, 0.75, 0.8, -PI / 2, '#212121'); candle(top, 0, 0.78, 0.8);
      for (const [a, b] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) Cy(top, 0.03, 0.03, 2, '#333', a, 1, b, 6);
      for (let i = 0; i < 20; i++) { const k = i / 19; flames.push(Sp(top, 0.05, glowM(i % 3 ? '#fff8e1' : '#ffd54f', 2.2), -2.2 + 4.4 * k, 1.95 - Math.sin(k * PI) * 0.3, -2.2 + 4.4 * k)); flames.push(Sp(top, 0.05, glowM('#fff8e1', 2.2), -2.2 + 4.4 * k, 1.95 - Math.sin(k * PI) * 0.3, 2.2 - 4.4 * k)); }
      light(top, '#ffe0b2', 2.5, 8, 0, 1.6, 0.8); },
    seats: [[-0.58, 0.8, PI / 2, 0.48], [0.58, 0.8, -PI / 2, 0.48]], table: [0, 5.1, 0.8] },
  { id: 'boat', name: 'Thuyền Nhỏ Trên Hồ', icon: '🛶', price: 70, x: -33.5, z: -7.5, view: PI / 2, r: 1.2, amb: 'Mái chèo & sáo trúc', water: 0.12,
    build(g) { const bt = new THREE.Group(); g.add(bt); bobs.push(bt); B(bt, 1.4, 0.45, 3, '#8d6e63', 0, 0.05, 0); B(bt, 1.2, 0.1, 2.8, '#6d4c41', 0, 0.2, 0); B(bt, 1.42, 0.08, 3.02, '#ffffff', 0, 0.3, 0);
      const bow = Cy(bt, 0.02, 0.7, 0.9, '#8d6e63', 0, 0.05, 1.9, 4); bow.rotation.x = PI / 2; bow.scale.set(1, 1, 0.45); const st2 = bow.clone(); st2.position.z = -1.9; st2.rotation.x = -PI / 2; bt.add(st2);
      B(bt, 1.2, 0.08, 0.4, '#a1887f', 0, 0.45, -0.85); B(bt, 1.2, 0.08, 0.4, '#a1887f', 0, 0.45, 0.85); Cy(bt, 0.03, 0.03, 1.4, '#4e342e', 0.55, 0.9, -1.4, 6); lantern(bt, 0.55, 1.65, -1.4, '#ffcc80');
      for (const s of [-1, 1]) { const o = B(bt, 0.06, 0.06, 2.2, '#5d4037', s * 0.85, 0.35, 0.3); o.rotation.x = 0.25; }
      for (let i = 0; i < 6; i++) { const lp = add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.02, 8), M('#66bb6a'), Math.sin(i * 1.7) * 3.2, 0.02, Math.cos(i * 1.7) * 3.2); flames.push(Sp(g, 0.07, glowM('#f8bbd0', 1.6), lp.position.x, 0.12, lp.position.z)); } light(bt, '#ffcc80', 2, 8, 0, 1.4, 0); },
    seats: [[0, -0.85, 0, 0.45], [0, 0.85, PI, 0.45]], table: [0, 0.4, 0], exit: { x: -25.6, z: -6.8 } },
  { id: 'bonfire2', name: 'Lửa Trại Đôi Trên Biển', icon: '🔥', price: 40, x: -2, z: -61.5, view: PI, r: 2.8, amb: 'Lửa tí tách & sóng biển',
    build(g) { for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; add(g, new THREE.DodecahedronGeometry(0.16), M('#757575', { flatShading: true }), Math.sin(a) * 0.55, 0.08, 1.2 + Math.cos(a) * 0.55); }
      for (let i = 0; i < 4; i++) { const l = Cy(g, 0.07, 0.07, 0.9, '#4e342e', 0, 0.15, 1.2, 6); l.rotation.set(PI / 2.6, i * PI / 4, 0); }
      for (let i = 0; i < 3; i++) { const f = add(g, new THREE.ConeGeometry(0.28 - i * 0.07, 0.8 - i * 0.15, 7), glowM(['#ff6d00', '#ffab00', '#fff176'][i], 2.2), 0, 0.5, 1.2); f.userData.fire = i; flames.push(f); }
      light(g, '#ff7b29', 4, 11, 0, 1, 1.2); const lg = Cy(g, 0.2, 0.2, 1.7, '#6d4c41', 0, 0.22, 0, 8); lg.rotation.z = PI / 2; B(g, 1.7, 0.03, 0.9, '#c62828', 0, 0.02, -0.25);
      const N = 30, sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3)); const sp = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffcc80', size: 0.06 })); sp.position.set(0, 0, 1.2); g.add(sp); sp.userData.sparks = N; flames.push(sp); },
    seats: [[-0.42, 0, 0, 0.44], [0.42, 0, 0, 0.44]], table: [0.9, 0.06, 0.4] },
  { id: 'cabana2', name: 'Lều Riêng Tư Bên Biển', icon: '🏝️', price: 100, x: 44.5, z: -4.5, view: PI / 2, r: 2.8, amb: 'Chill house nhẹ',
    build(g) { B(g, 4.6, 0.22, 4.4, '#efebe9', 0, 0.11, 0); for (const [a, b] of [[-2.1, -2], [2.1, -2], [-2.1, 2], [2.1, 2]]) Cy(g, 0.08, 0.08, 2.9, '#bcaaa4', a, 1.55, b, 8);
      B(g, 4.6, 0.15, 4.4, '#ffffff', 0, 3.05, 0); const cu = M('#fff8f0', { transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      for (const [px, pz, ry] of [[-2.15, 0, PI / 2], [2.15, 0, PI / 2], [0, -2.1, 0]]) { const c = add(g, new THREE.PlaneGeometry(4.2, 2.8), cu, px, 1.6, pz); c.rotation.y = ry; swings.push(c); c.userData.curtain = true; }
      B(g, 2.1, 0.35, 1.5, '#d7ccc8', 0, 0.4, -0.5); B(g, 2.05, 0.14, 1.45, '#ffffff', 0, 0.64, -0.5); for (const s of [-1, 1]) B(g, 0.5, 0.25, 0.18, '#f48fb1', s * 0.55, 0.82, -1.1);
      table2(g, 0, 1.05, '#fce4ec'); g.children.slice(-3).forEach(o => { o.scale.y = 0.6; o.position.y *= 0.6; }); candle(g, 0, 0.47, 1.05);
      for (const [a, b] of [[-1.9, 1.9], [1.9, 1.9]]) lantern(g, a, 2.6, b, '#ffd180'); light(g, '#ffd180', 2.5, 9, 0, 2.4, 0);
      for (let i = 0; i < 7; i++) { Cy(g, 0.04, 0.06, 0.9, '#d4af37', -2.2 + i * 0.73, 0.45, 2.6, 6); if (i < 6) B(g, 0.73, 0.05, 0.05, '#ad1457', -1.835 + i * 0.73, 0.75, 2.6); } },
    seats: [[-0.42, -0.4, 0, 0.6], [0.42, -0.4, 0, 0.6]], table: [0, 0.5, 1.05] },
];
const SP = {}; const loc = (sp, dx, dz) => { const c = Math.cos(sp.view), s = Math.sin(sp.view); return { x: sp.x + dx * c + dz * s, z: sp.z - dx * s + dz * c }; };
// pier: find shore & extend into the sea
{ const sp = DEFS.find(d => d.id === 'pierend'); let z = 30; while (z < 80 && W.walkY(sp.x, z) > 0.35) z += 0.25; sp.len = 14; sp.z = z + 10; sp.y = 0.85;
  W.decks.push({ minX: sp.x - 1.2, maxX: sp.x + 1.2, minZ: z - 2, maxZ: sp.z + 2, y: 0.85 }, { minX: sp.x - 2.1, maxX: sp.x + 2.1, minZ: sp.z - 2, maxZ: sp.z + 2, y: 0.85 }); sp.exit = { x: sp.x, z: sp.z - 5.5 }; }
for (const sp of DEFS) { SP[sp.id] = sp; if (sp.y === undefined) sp.y = sp.water !== undefined ? 0 : W.walkY(sp.x, sp.z);
  if (sp.roof) { sp.ground = sp.y; sp.collider = { minX: sp.x - 2.4, maxX: sp.x + 2.4, minZ: sp.z - 2.4, maxZ: sp.z + 2.4, on: true, tag: 'rooftop' }; W.colliders.push(sp.collider); sp.deck = { minX: sp.x - 2.2, maxX: sp.x + 2.2, minZ: sp.z - 2.2, maxZ: sp.z + 2.2, y: sp.y + sp.roof }; sp.exit = loc(sp, 0, -3.4); }
  if (sp.water !== undefined) W.decks.push({ minX: sp.x - 1.5, maxX: sp.x + 1.5, minZ: sp.z - 0.7, maxZ: sp.z + 0.7, y: sp.water, boat: true });
  const g = new THREE.Group(); g.position.set(sp.x, sp.y, sp.z); g.rotation.y = sp.view; scene.add(g); sp.g = g; sp.build(g, sp);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  const sy = sp.y + (sp.roof || 0); sp.seatY = sy;
  sp.seatObjs = sp.seats.map(([dx, dz, r, h], i) => { const p = loc(sp, dx, dz); const s = { id: W.spots.length, kind: 'dateseat', venue: 'date', x: p.x, z: p.z, y: sy + (sp.water !== undefined ? 0.05 : 0), seatH: h, rot: sp.view + r, anim: 'sit', seat: true, occupant: null, dateSpot: sp.id, i, base: p }; W.spots.push(s); return s; });
  if (!sp.exit) sp.exit = loc(sp, 0, -(sp.r + 1.6));
  sp.label = G.textSprite(`${sp.icon} ${sp.name}${sp.price ? ' · ' + sp.price + ' Xu' : ''}`, { size: 34, h: 0.42, bg: 'rgba(120,10,70,0.6)', border: 'rgba(255,160,220,0.8)' }); sp.label.position.set(sp.x, sy + 3.4 + (sp.id === 'gazebo' ? 1 : 0), sp.z); scene.add(sp.label);
  // privacy barrier (hidden unless someone else's private date is running here)
  const bar = new THREE.Group(); bar.position.set(sp.x, sy, sp.z); bar.visible = false; scene.add(bar); sp.bar = bar;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(sp.r + 0.3, sp.r + 0.3, 2.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#ff4fa3', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })); wall.position.y = 1.3; bar.add(wall);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(sp.r + 0.3, 0.04, 6, 48), new THREE.MeshBasicMaterial({ color: '#ff80c0' })); ring.rotation.x = PI / 2; ring.position.y = 2.6; bar.add(ring); sp.ring = ring;
  const t = G.textSprite('🔒 Khu riêng tư – đang có người', { size: 34, h: 0.42, bg: 'rgba(60,0,40,0.8)', border: '#ff80c0' }); t.position.y = 2.9 + (sp.id === 'gazebo' ? 1 : 0); bar.add(t);
  sp.circle = { x: sp.x, z: sp.z, r: sp.r + 0.3 }; }
// signpost-ish board at the plaza
{ const c = W.center; const x = c.x - 3.2, z = c.z - 2.6, y = W.walkY(x, z); const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); Cy(g, 0.08, 0.1, 2.4, '#6d4c41', 0, 1.2, 0, 6);
  const s = G.textSprite('💗 ĐIỂM HẸN RIÊNG TƯ · mở 💘 Ghép đôi → Rủ hẹn', { size: 30, h: 0.38, bg: 'rgba(120,10,70,0.75)', border: '#ff80c0' }); s.position.y = 2.7; g.add(s); W.circles.push({ x, z, r: 0.2 }); }

// ---------- state ----------
let priv = null, netBusy = {}, myUid = null; const sim = {}; // offline: simulated NPC couples booked in
const busyAt = (id) => net.on ? (netBusy[id] || 0) : (sim[id] ? 2 : 0);
const othersBusy = (id) => busyAt(id) > 0 && !(priv && priv.spot === id);
st.dpass = st.dpass || {};
const passes = (id) => st.dpass[id] || 0;
G.dateView = null;

// ---------- booking (mock Xu) ----------
function book(sp, then) { const o = el('div', { className: 'overlay', style: 'z-index:45' }, `<div class="card" style="text-align:center"><div style="font-size:44px">${sp.icon}</div><h2>Đặt chỗ: ${esc(sp.name)}</h2><p>Điểm hẹn cao cấp – riêng tư cho hai bạn. Giá <b>${sp.price} Xu</b> (Xu ảo, không phải tiền thật). Bạn đang có ${st.xu} Xu.</p><button class="primary" id="bkY">💳 Đặt chỗ ${sp.price} Xu</button><button class="pill btn" id="bkN" style="margin-top:8px">Để sau</button></div>`);
  document.body.append(o); o.querySelector('#bkN').onclick = () => o.remove();
  o.querySelector('#bkY').onclick = () => { o.remove(); if (st.xu < sp.price) { toast('Không đủ Xu 😅 – chơi sự kiện / hẹn hò để kiếm thêm'); return; } setXu(-sp.price); st.dpass[sp.id] = passes(sp.id) + 1; save(); toast(`✅ Đã đặt ${sp.icon} ${sp.name} (-${sp.price} Xu ảo)`); G.logChat('Điểm hẹn', `Đặt chỗ ${sp.name} (Xu ảo)`); then && then(); }; }
G.SHOP.date2 = DEFS.filter(d => d.price).map(sp => ({ id: 'dpass_' + sp.id, icon: sp.icon, name: `Vé hẹn: ${sp.name}`, price: sp.price, consumable: true,
  get desc() { return `Khu riêng tư cho 2 người · nhạc nền "${sp.amb}". ${passes(sp.id) ? `<b style="color:#8f8">Đang có ${passes(sp.id)} vé</b>` : 'Dùng khi Rủ hẹn trong 💘.'}`; },
  onBuy() { st.dpass[sp.id] = passes(sp.id) + 1; toast(`✅ Đã có vé ${sp.icon} ${sp.name}. Mở 💘 → Rủ hẹn để dùng`); } }));

// ---------- hook into dating PLACES ----------
const D = G.dating;
for (const sp of DEFS) D.PLACES[sp.id] = { name: `${sp.icon} ${sp.name}`, priv: true, get: () => ({ x: sp.x, z: sp.z }),
  tag: () => othersBusy(sp.id) ? '🔒 đang có người' : sp.price ? (passes(sp.id) ? `🎟️ có vé (${passes(sp.id)})` : `${sp.price} Xu`) : 'miễn phí',
  gate: (retry) => { if (othersBusy(sp.id) && !net.on) { toast('🔒 Khu này đang có cặp đôi khác – chọn chỗ khác nhé'); return false; } if (sp.price && !passes(sp.id)) { book(sp, retry); return false; } return true; },
  enter: (m) => enterPriv(m) };

// ---------- enter / exit ----------
function seatFor(sp, k) { return sp.seatObjs[k]; }
function place(o, s, isPlayer) { if (isPlayer) { if (player.seat) G.standUp(); if (player.dance) G.stopDance(); player.target = null; player.x = s.x; player.z = s.z; s.occupant = null; G.sitAt(s); }
  else { const n = o; if (n.spot) { n.spot.occupant = null; } s.occupant = n; n.spot = s; n.path = []; n.target = null; n.mode = 'act'; n.x = s.x; n.z = s.z; n.yaw = s.rot; n.av.seated = true; n.av.anim = 'sit'; n.baseAnim = 'sit'; n.timer = 9999; n.act = 'lovedate'; } }
function enterPriv(m) { const sp = SP[m.place]; if (!sp) return;
  const iInvited = m.npc ? true : (m.inviter == null ? true : m.inviter === myUid);
  if (iInvited && sp.price && (m.npc || net.on)) { if (passes(sp.id)) st.dpass[sp.id]--; save(); }
  priv = { spot: sp.id, sp, partner: m.npc ? { npc: m.npc, name: m.with.nick } : { uid: m.with.id, name: m.with.nick }, online: !m.npc, t0: G.now() };
  if (sp.collider) sp.collider.on = false; if (sp.deck && !W.decks.includes(sp.deck)) W.decks.push(sp.deck);
  const mine = iInvited ? 0 : 1; place(null, seatFor(sp, mine), true); if (m.npc) { place(m.npc, seatFor(sp, 1 - mine), false); G.bubble(m.npc, 'Chỗ này đẹp quá… chỉ có hai đứa mình 💕', 4); }
  G.cam.yaw = sp.view + PI; G.cam.pitch = 0.32; G.cam.dist = 5.5; G.dateView = () => sp.view;
  hud.classList.remove('hidden'); renderHud(); addPoses(); G.logChat('Điểm hẹn', `🔒 Bạn và ${priv.partner.name} đang ở ${sp.icon} ${sp.name}. Chỉ hai bạn thấy nhau & thấy chat. Nhạc: ${sp.amb}.`);
  toast(`${sp.icon} ${sp.name} – khu riêng tư cho hai bạn 💕`); }
function exitPriv(msg) { if (!priv) return; const p = priv, sp = p.sp; priv = null; G.dateView = null; hud.classList.add('hidden'); removePoses();
  if (player.seat) G.standUp(); player.target = null; player.x = sp.exit.x; player.z = sp.exit.z; player.yaw = sp.view + PI;
  if (sp.collider) sp.collider.on = true; const di = W.decks.indexOf(sp.deck); if (di >= 0) W.decks.splice(di, 1);
  if (p.partner.npc) { const n = p.partner.npc; if (n.spot) n.spot.occupant = null; n.spot = null; n.av.seated = false; n.mode = 'wait'; n.timer = 1; n.x = sp.exit.x + 0.8; n.z = sp.exit.z; }
  for (const s of sp.seatObjs) s.occupant = null; if (D.getDate()) D.cancelDate(); G.cam.dist = 7.5; G.cam.pitch = 0.38; if (msg) toast(msg); }
function leave() { if (!priv) return; if (priv.online && net.on) net.send({ t: 'privLeave' }); exitPriv('👋 Đã rời khu riêng tư'); }
function blockP() { if (!priv) return; const p = priv.partner; if (!confirm(`Chặn ${p.name}? Buổi hẹn kết thúc ngay, hai bạn sẽ không thấy chat/tin nhắn của nhau.`)) return;
  if (priv.online && net.on) { net.send({ t: 'block', to: p.uid }); net.blocks.add(p.uid); } else { st.npcBlocks = [...new Set([...(st.npcBlocks || []), p.name])]; save(); } exitPriv(`⛔ Đã chặn ${p.name} và rời khu hẹn`); }
function reportP() { if (!priv) return; const p = priv.partner; if (priv.online && net.on) { leave(); net.openReport(p.uid, p.name); } else { exitPriv(); toast(`🚩 Đã ghi nhận báo cáo về ${p.name} (bản thử offline)`); } }

// ---------- HUD ----------
const hud = el('div', { id: 'privHud', className: 'hidden', style: 'position:fixed;top:92px;left:50%;transform:translateX(-50%);background:rgba(60,0,45,.88);border:1px solid #ff80c0;border-radius:14px;padding:6px 8px;z-index:13;font-size:12px;max-width:96vw;text-align:center' }); document.body.append(hud);
const CPL = [['holdhand', '🤝 Nắm tay'], ['hug', '🤗 Ôm'], ['pairdance', '💃 Nhảy đôi'], ['stargaze', '🌌 Ngắm sao'], ['toast2', '🥂 Nâng ly']];
function renderHud() { if (!priv) return; const sp = priv.sp; hud.innerHTML = `<div style="margin-bottom:4px"><b>🔒 ${sp.icon} ${esc(sp.name)}</b> · với <b>${esc(priv.partner.name)}</b> <span class="muted">· riêng tư · PG-13</span></div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">${CPL.map(([k, v]) => `<button class="pill btn" data-c="${k}">${v}</button>`).join('')}<button class="pill btn" data-a="food">🍽️ Gọi món cho 2</button><button class="pill btn" data-a="photo">📸 Ảnh đôi</button><button class="pill btn" data-a="sit">🪑 Ngồi</button>
  <button class="pill btn" data-a="leave" style="background:#555">🚪 Rời đi</button><button class="pill btn" data-a="block" style="background:#8b0000">⛔ Chặn</button><button class="pill btn" data-a="report" style="background:#8b4000">🚩 Báo cáo</button></div>`; }
hud.onclick = (e) => { const b = e.target.closest('button'); if (!b || !priv) return; const c = b.dataset.c, a = b.dataset.a;
  if (c) { const w = priv.partner.npc ? { npc: priv.partner.npc, name: priv.partner.name } : { uid: priv.partner.uid, name: priv.partner.name }; if (w.npc && w.npc.spot) { w.npc.spot.occupant = null; w.npc.spot = null; w.npc.av.seated = false; } D.sendCouple(c, w); if (!w.npc) toast('💌 Đã hỏi ý người ấy…'); }
  if (a === 'leave') leave(); if (a === 'block') blockP(); if (a === 'report') reportP(); if (a === 'food') foodMenu(); if (a === 'photo') photoDuo();
  if (a === 'sit') { const sp = priv.sp; const s = sp.seatObjs.find(s => !s.occupant || s.occupant === player); if (s) place(null, s, true); const n = priv.partner.npc; if (n && !n.spot) { const s2 = sp.seatObjs.find(x => !x.occupant); if (s2) place(n, s2, false); } } };

// ---------- food for two (mock Xu) ----------
const FOOD = [['lau', '🍲 Lẩu hải sản đôi', 30, '#e53935'], ['bbq', '🍢 Combo nướng BBQ', 25, '#8d4e2a'], ['cake', '🎂 Bánh kem trái tim', 20, '#f48fb1'], ['sinhto', '🍹 2 ly sinh tố & flan', 15, '#ffb74d']];
let foodMesh = null, foodT = 0;
function foodMenu() { G.openPanel(`<h2>🍽️ Gọi món cho hai người</h2><p class="muted">Phục vụ tận nơi – thanh toán bằng Xu ảo.</p><div style="display:flex;flex-direction:column;gap:8px">${FOOD.map(f => `<button class="pill btn" data-f="${f[0]}">${f[1]} – ${f[2]} Xu</button>`).join('')}</div>`);
  $('panelBody').onclick = (e) => { const k = e.target.dataset.f; if (!k || !priv) return; const f = FOOD.find(x => x[0] === k); if (st.xu < f[2]) return toast('Không đủ Xu 😅'); setXu(-f[2]); save(); G.closePanel(); serveFood(f);
    if (priv.online && net.on) net.send({ t: 'chat', text: `🍽️ đã gọi ${f[1]} cho hai bạn`, scope: 'near' }); }; }
function serveFood(f) { const sp = priv.sp; if (foodMesh) { scene.remove(foodMesh); } const g = new THREE.Group(); const [dx, dy, dz] = sp.table; const p = loc(sp, dx, dz); g.position.set(p.x, sp.y + dy + (sp.water !== undefined ? 0.3 : 0), p.z); g.rotation.y = sp.view;
  for (const s of [-1, 1]) { Cy(g, 0.13, 0.11, 0.02, '#ffffff', s * 0.2, 0.01, 0, 14); add(g, new THREE.CylinderGeometry(0.035, 0.03, 0.16, 8), M('#e1f5fe', { transparent: true, opacity: 0.6 }), s * 0.2, 0.08, 0.2); }
  if (f[0] === 'lau') { Cy(g, 0.16, 0.13, 0.12, '#424242', 0, 0.07, 0, 14); Cy(g, 0.15, 0.15, 0.01, f[3], 0, 0.13, 0, 14); } else if (f[0] === 'cake') { Cy(g, 0.13, 0.13, 0.12, f[3], 0, 0.07, 0, 16); Sp(g, 0.05, '#e91e63', 0, 0.16, 0); } else if (f[0] === 'bbq') { for (let i = 0; i < 4; i++) { const k = Cy(g, 0.02, 0.02, 0.26, f[3], -0.06 + i * 0.04, 0.03, 0, 6); k.rotation.x = PI / 2; } } else { Cy(g, 0.08, 0.06, 0.06, '#ffe082', 0, 0.04, 0, 12); }
  scene.add(g); foodMesh = g; foodT = 90; player.holding = { name: f[1], prop: 'plate' }; G.holdProp(player.av, 'plate'); player.eatT = 8; const n = priv.partner.npc; if (n) { n.tempAnim = 'eat'; n.tempT = 8; n.av.anim = 'eat'; G.bubble(n, 'Ngon quá! Cảm ơn nha 😋💕', 3); } toast(`${f[1]} đã được mang tới cho hai bạn 😋`); }

// ---------- photo-mode couple poses ----------
const CPOSES = [['hug', '💑 Ôm đôi'], ['holdhand', '🤝 Nắm tay'], ['stargaze', '🌌 Ngắm sao'], ['toast2', '🥂 Nâng ly đôi'], ['pairdance', '💃 Nhảy đôi']];
function addPoses() { const P = G.photo && G.photo.POSES; if (P && !P.some(p => p[0] === 'hug')) P.push(...CPOSES); }
function removePoses() { const P = G.photo && G.photo.POSES; if (P) for (const [k] of CPOSES) { const i = P.findIndex(p => p[0] === k); if (i >= 0) P.splice(i, 1); } }
function photoDuo() { const sp = priv.sp; if (player.seat) G.standUp(); const c = loc(sp, 0, 0.9); const pv = { x: Math.cos(sp.view), z: -Math.sin(sp.view) };
  player.x = c.x - pv.x * 0.38; player.z = c.z - pv.z * 0.38; player.yaw = sp.view + PI; const n = priv.partner.npc;
  if (n) { if (n.spot) n.spot.occupant = null; n.spot = null; n.av.seated = false; n.mode = 'wait'; n.timer = 9999; n.x = c.x + pv.x * 0.38; n.z = c.z + pv.z * 0.38; n.yaw = sp.view + PI; }
  G.photo.enter(); G.cam.yaw = sp.view; G.cam.dist = 3.6; G.cam.pitch = 0.12; toast('📸 Chọn tư thế đôi rồi bấm chụp'); }

// ---------- ambient music, NPC hiding, privacy barrier, per-frame ----------
const prevExtra = G.extraCafe; G.extraCafe = () => Math.max(prevExtra ? prevExtra() : 0, priv ? 0.6 : 0);
G.npcHide = (n) => { if (n.privHidden) return true; if (!priv) return false; if (n === priv.partner.npc) return false; return Math.hypot(n.x - priv.sp.x, n.z - priv.sp.z) < 24; };
const prevGate = G.seatGate; G.seatGate = (s) => { if (s.dateSpot && !(priv && priv.spot === s.dateSpot)) { toast('💗 Ghế dành cho buổi hẹn riêng tư – mở 💘 Ghép đôi → Rủ hẹn để đặt'); return false; } return prevGate ? prevGate(s) : true; };
G.mmExtra = () => DEFS.map(sp => [sp, othersBusy(sp.id) ? '🔒' : '💗']);
(G.ctxExtra = G.ctxExtra || []).push((btns, px, pz) => { if (priv) return; for (const sp of DEFS) if (Math.hypot(px - sp.x, pz - sp.z) < sp.r + 3) { btns.unshift([othersBusy(sp.id) ? `🔒 ${sp.name}: đang có người` : `💗 Rủ hẹn tại ${sp.name}`, () => othersBusy(sp.id) ? toast('Khu riêng tư đang có cặp đôi – quay lại sau nhé 🙏') : D.open('matches')]); break; } });
const prevChat = G.onChat; G.onChat = (txt) => { if (priv && priv.partner.npc) { const n = priv.partner.npc; const R = ['Hihi, nói tiếp đi 😊', 'Mình cũng nghĩ vậy đó 💕', 'Ở đây yên bình ghê…', 'Lần sau mình đi ngắm sao nữa nha ✨', 'Bạn vui tính thật đó 😆']; setTimeout(() => G.bubble(n, R[Math.floor(Math.random() * R.length)], 3.5), 1100); } return prevChat ? prevChat(txt) : false; };
let acc = 0;
G.onFrame.push((dt, t) => {
  for (const f of flames) { if (f.isPointLight) f.intensity = f.userData.base * (0.85 + Math.sin(t * 9 + f.id) * 0.08 + Math.random() * 0.07); else if (f.userData.sparks) { const a = f.geometry.attributes.position; for (let i = 0; i < f.userData.sparks; i++) { const k = (t * 0.6 + i / f.userData.sparks) % 1; a.setXYZ(i, Math.sin(i * 7.1) * 0.3 * k, 0.4 + k * 2.2, Math.cos(i * 3.3) * 0.3 * k); } a.needsUpdate = true; }
    else if (f.userData.fire !== undefined) f.scale.set(1, 0.85 + Math.sin(t * 11 + f.userData.fire * 2) * 0.15, 1); else if (f.userData.fly !== undefined) f.position.y = 0.8 + Math.sin(t * 0.8 + f.userData.fly) * 0.6; else if (f.material && f.material.emissiveIntensity !== undefined) f.material.emissiveIntensity = 1.3 + Math.sin(t * 6 + f.id) * 0.25; }
  for (const s of swings) { if (s.userData.curtain) s.rotation.z = Math.sin(t * 1.3 + s.position.x) * 0.03; else s.rotation.x = Math.sin(t * 1.1) * 0.12; }
  for (const b of bobs) { b.position.y = Math.sin(t * 1.2) * 0.04; b.rotation.z = Math.sin(t * 0.9) * 0.025; }
  // swing seats carry their sitters
  const gsp = SP.garden; const sw = Math.sin(t * 1.1) * 0.12 * 1.95; for (const s of gsp.seatObjs) { const p = loc(gsp, s.i ? 0.38 : -0.38, 0.04 + sw); s.x = p.x; s.z = p.z; if (s.occupant === player) { player.x = s.x; player.z = s.z; } else if (s.occupant && s.occupant.x !== undefined) { s.occupant.x = s.x; s.occupant.z = s.z; } }
  if (foodT > 0) { foodT -= dt; if (foodT <= 0 && foodMesh) { scene.remove(foodMesh); foodMesh = null; } }
  // barriers & keep-out for other couples' private zones; keep daters inside their zone
  for (const sp of DEFS) { const ob = othersBusy(sp.id); sp.bar.visible = ob; sp.label.visible = !ob && !(priv && priv.spot === sp.id); if (ob) sp.ring.material.color.setHSL(0.92, 1, 0.6 + Math.sin(t * 3) * 0.15);
    const ci = W.circles.indexOf(sp.circle); if (ob && ci < 0) W.circles.push(sp.circle); if (!ob && ci >= 0) W.circles.splice(ci, 1);
    if (ob && !player.seat) { const d = Math.hypot(player.x - sp.x, player.z - sp.z); if (d < sp.r + 0.35 && Math.abs(W.walkY(player.x, player.z) - sp.seatY) < 1.5) { const k = (sp.r + 0.9) / (d || 1); player.x = sp.x + (player.x - sp.x || 1) * k; player.z = sp.z + (player.z - sp.z) * k; player.target = null; } } }
  if (priv && !player.seat) { const sp = priv.sp; const d = Math.hypot(player.x - sp.x, player.z - sp.z); if (d > sp.r) { player.x = sp.x + (player.x - sp.x) / d * sp.r; player.z = sp.z + (player.z - sp.z) / d * sp.r; player.target = null; } }
  acc += dt; if (acc < 1) return; acc = 0;
  if (!net.on) { const now = G.now(); for (const id in sim) if (now > sim[id].until) { for (const n of sim[id].npcs) { n.privHidden = false; n.timer = 1; n.mode = 'wait'; } delete sim[id]; }
    if (Math.random() < 0.012 && Object.keys(sim).length < 2) simBusy(); }
});
function simBusy(id) { const free = DEFS.filter(sp => !sim[sp.id] && !(priv && priv.spot === sp.id) && (id ? sp.id === id : Math.hypot(player.x - sp.x, player.z - sp.z) > 25)); const sp = id ? free[0] : free[Math.floor(Math.random() * free.length)]; if (!sp) return false;
  const cand = npcs.filter(n => !n.staff && !n.privHidden && !n.spot && !(priv && n === priv.partner.npc)).sort(() => Math.random() - 0.5).slice(0, 2); if (cand.length < 2) return false;
  cand.forEach((n, i) => { n.privHidden = true; n.path = []; n.target = null; n.mode = 'wait'; n.timer = 9999; n.x = sp.seatObjs[i].x; n.z = sp.seatObjs[i].z; }); sim[sp.id] = { until: G.now() + 180, npcs: cand }; return true; }

// ---------- network ----------
const prevNet = G.onNet; G.onNet = (m) => { switch (m.t) {
  case 'welcome': myUid = m.uid; netBusy = m.busy || {}; if (m.inst && m.spot && !priv) priv = { spot: m.spot, sp: SP[m.spot], partner: { name: '…' }, online: true, pending: true }; break;
  case 'instSwap': if (m.inst && m.spot) { if (!priv) priv = { spot: m.spot, sp: SP[m.spot], partner: { name: '…' }, online: true, pending: true }; } else if (priv && priv.online) exitPriv('🔓 Buổi hẹn riêng tư đã kết thúc'); break;
  case 'privBusy': netBusy = m.busy || {}; return;
  case 'privEnded': toast(`💔 ${m.by} đã rời buổi hẹn`); return;
  case 'dateGo': if (SP[m.place] && priv && priv.pending) priv = null; break; }
  prevNet && prevNet(m); };
G.onFrame.push(() => { const n = priv && priv.partner.npc; if (n && n.timer < 50) n.timer = 9999; if (n && document.body.classList.contains('photo') && CPOSES.some(p => p[0] === player.emote)) { n.tempAnim = player.emote; n.tempT = 0.5; n.av.anim = player.emote; } });
G.dates = { SPOTS: DEFS, SP, priv: () => priv, enter: enterPriv, exit: exitPriv, leave, simBusy, busy: () => ({ ...netBusy, ...Object.fromEntries(Object.keys(sim).map(k => [k, 2])) }), passes };
