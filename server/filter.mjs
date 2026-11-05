// Shared (client + server) Vietnamese profanity filter, phone-number masking and nickname rules.
const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
// A: matched on lowercase text WITH diacritics (so "các", "lớn", "đeo", "buổi" stay clean)
const A = ['địt', 'đụ', 'đéo', 'lồn', 'buồi', 'cặc', 'đĩ', 'đm', 'đmm', 'đcm', 'dm', 'dmm', 'dcm', 'vcl', 'vkl', 'vl', 'clm', 'cl', 'cc', 'óc chó', 'chó đẻ', 'thằng chó', 'con chó', 'đồ chó', 'con đĩ', 'mẹ mày', 'má mày', 'đù má', 'đụ má', 'đụ mẹ', 'địt mẹ', 'fuck', 'fck', 'shit', 'bitch', 'dick', 'pussy', 'nigga', 'nigger'];
// B: unambiguous spellings matched after stripping diacritics / separators (catches "d.i.t m.e", "dít mẹ")
const B = ['ditme', 'ditmemay', 'dume', 'duma', 'dumemay', 'occho', 'chode', 'fuck', 'motherfuck', 'vcl', 'vkl'];
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s._-]*');
const reA = new RegExp('(^|[^\\p{L}\\p{N}])(' + A.sort((a, b) => b.length - a.length).map(esc).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
const lower = (s) => String(s).normalize('NFC').toLocaleLowerCase('vi');
export function hasProfanity(text) { const l = lower(text); reA.lastIndex = 0; if (reA.test(l)) { reA.lastIndex = 0; return true; } const c = strip(l).replace(/[^a-z0-9]/g, ''); return B.some(w => c.includes(w)); }
export function cleanText(text) {
  let t = String(text).normalize('NFC').slice(0, 200); const l = lower(t);
  if (l.length === t.length) { const arr = t.split(''); let m; reA.lastIndex = 0; while ((m = reA.exec(l))) { const st = m.index + m[1].length; for (let i = st; i < st + m[2].length; i++) if (arr[i] !== ' ') arr[i] = '*'; } t = arr.join(''); }
  t = t.replace(/\S+(\s+\S+)?/g, (w) => { const c = strip(w).replace(/[^a-z0-9]/g, ''); return B.some(b => c.includes(b)) ? w.replace(/[^\s]/g, '*') : w; });
  return maskPhone(t);
}
// 9+ digits possibly separated by spaces . - ( ) or written with '+84'
export function maskPhone(t) { return String(t).replace(/(\+?\d[\d\s.\-()]{7,}\d)/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '📵[đã ẩn SĐT]' : m)); }
export const RESERVED = ['admin', 'administrator', 'dj', 'mc', 'gm', 'mod', 'moderator', 'system', 'he thong', 'quan tri', 'quan tri vien', 'staff', 'nhan vien', 'support', 'ho tro', 'bql', 'dao ngoc', 'daongoc', 'official', 'san khau', 'su kien', 'khach'];
export function normNick(n) { return String(n || '').normalize('NFC').replace(/\s+/g, ' ').trim(); }
export function nickKey(n) { return normNick(n).toLocaleLowerCase('vi'); }
export function checkNick(n) {
  n = normNick(n); const len = [...n].length;
  if (len < 3 || len > 20) return 'Biệt danh phải dài 3–20 ký tự';
  if (!/^[\p{L}\p{M}0-9 _.]+$/u.test(n)) return 'Biệt danh chỉ gồm chữ (có dấu tiếng Việt), số, khoảng trắng, dấu _ và .';
  if (!/\p{L}/u.test(n)) return 'Biệt danh phải có ít nhất một chữ cái';
  const s = strip(n).replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim(); const words = s.split(' '); const flat = s.replace(/ /g, '');
  if (RESERVED.some(r => s === r || flat === r.replace(/ /g, '') || (r.length <= 3 ? words[0] === r : s.includes(r)))) return 'Biệt danh này được dành riêng cho ban quản trị/nhân viên (admin, DJ, MC, GM...)';
  if (hasProfanity(n)) return 'Biệt danh chứa từ ngữ không phù hợp';
  if (/\d{6,}/.test(n)) return 'Biệt danh không được chứa dãy số dài (số điện thoại)';
  return null;
}
