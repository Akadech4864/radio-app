/**
 * กระดานงานสอบสวน สน.ลำหิน (หน้า GitHub สำหรับผู้บังคับบัญชา)
 *
 * เน้น "ตอนนี้ใครเข้าเวร / มีภารกิจอะไร" เป็นหลัก แล้วค่อยดูกำลังพล สถิติคดี ภาระงาน/คดีค้าง
 * ส่วนแดชบอร์ด (แผนที่ 3 มิติ, ผังกำลังพล, สถิติ, โหมดนำเสนอ, พิมพ์/PDF) ใช้โค้ดชุดเดียวกับเว็บแอป ในโฟลเดอร์ dash/
 *
 * ข้อมูลมาจาก API ของเว็บแอปหลัก (?api=radio) — แถวเวรเป็น "รูปแบบกลาง" (ดู dutySchedule.js)
 *   [0] วันที่ dd/MM/yyyy  [1] พงส. ช่องกลางวัน  [2] ผช.พงส.  [3] ส่งของกลาง
 *   [4] หมายเหตุ  [5] เวรเสริม  [6] พงส. ช่อง 24 ชม./ผลัดเย็น
 * ภารกิจ: [0] วันที่ [1] เวลา ("09:00" หรือ "09:00-12:00") [2] สถานที่ [3] เรื่อง [4] ผู้เข้าร่วม [5] ประธาน
 * stats: สถิติคดีสรุปเป็นตัวเลข แยกตามช่วงปีงบ (คำนวณที่เซิร์ฟเวอร์ ไม่มีข้อมูลคดีรายเรื่อง)
 */
const API_URL = "https://script.google.com/macros/s/AKfycbz_K2q9mnmi3K0q-nWSNkxjuSO7FaTFyqCgWC2XQ8DguhS43_ytySvn7QRp_tzpYRKA/exec";
const REFRESH_MS = 5 * 60 * 1000;

// รูปแบบเวร พงส. ตามช่วงเวลา
const SPLIT_START = ymd(2026, 9, 10);   // 10 ก.ย.69: แบ่งผลัด เช้า 08:01-17:00 / เย็น 17:01-08:00
const PAIR_START = ymd(2026, 10, 22);   // 22 ต.ค.69: เข้าคู่ คู่เวรกลางวัน 08:01-17:00 + เวร 24 ชม.

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MON_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

let data = { duty: [], mission: [], personnel: [], leave: [], stats: null };
let people = {};             // คีย์ชื่อ (ตัดยศ) -> { name, photo, phone, dial }
let viewDate = null;         // วันที่กำลังดู (null = วันเวรปัจจุบัน)
let calMonth = new Date();   // เดือนที่ปฏิทินแสดง
let query = '';              // คำค้นหา
let showPast = false;

const $ = (id) => document.getElementById(id);

// ==========================================================
// เครื่องมือวันที่ / ชื่อ
// ==========================================================
function ymd(y, m, d) { return y * 10000 + m * 100 + d; }
function keyOf(dt) { return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }
function parseDate(s) {
    const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    let y = +m[3]; if (y > 2400) y -= 543;
    return new Date(y, +m[2] - 1, +m[1]);
}
function rowKey(r) { const d = parseDate(r && r[0]); return d ? keyOf(d) : 0; }
function thShort(dt) { return dt.getDate() + ' ' + TH_MON[dt.getMonth()] + String((dt.getFullYear() + 543) % 100); }
// ป้ายวันที่สั้นบนแถบเลื่อนวัน: "วันจันทร์ที่ 26 ต.ค.69"
function thDay(dt) { return 'วัน' + TH_DOW[dt.getDay()] + 'ที่ ' + thShort(dt); }
function thFull(dt) { return 'วัน' + TH_DOW[dt.getDay()] + 'ที่ ' + dt.getDate() + ' ' + TH_MON_FULL[dt.getMonth()] + ' ' + (dt.getFullYear() + 543); }
function addDays(dt, n) { const x = new Date(dt); x.setDate(x.getDate() + n); return x; }
function midnight(dt) { const x = new Date(dt); x.setHours(0, 0, 0, 0); return x; }
function minutesNow() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** วันเวรปัจจุบัน — รอบเวรเปลี่ยนตอน 08:01 น. ก่อนเวลานั้นยังเป็นเวรของเมื่อวาน */
function currentDutyDate() {
    const now = new Date();
    const d = midnight(now);
    return (now.getHours() * 60 + now.getMinutes() <= 8 * 60) ? addDays(d, -1) : d;
}

// ลอกคำนำหน้ายศออกให้เหลือชื่อ-สกุล เอาไว้จับคู่ชื่อที่เขียนยศต่างกัน
const RANK_WORDS = ['นางสาว', 'ว่าที่', 'พลตอ', 'พลตท', 'พลตต', 'พตอ', 'พตท', 'พตต', 'รตอ', 'รตท', 'รตต',
    'จสต', 'สตอ', 'สตท', 'สตต', 'ดต', 'นาย', 'นาง', 'หญิง', 'นส'];
function personKey(name) {
    let s = String(name || '').replace(/[\s. ]/g, '');
    let again = true;
    while (again) {
        again = false;
        for (const w of RANK_WORDS) { if (s.indexOf(w) === 0) { s = s.slice(w.length); again = true; break; } }
    }
    return s;
}
/** ชื่อแสดงผล: ยศ + ชื่อจริง + ฯ  เช่น ร.ต.อ.คิมหันฐ์ฯ */
function rankName(full) {
    const s = String(full || '').replace(/\s+/g, ' ').trim();
    if (!s) return '-';
    const m = s.match(/^((?:ว่าที่\s*)?(?:[฀-๿]{1,4}\.){1,3}(?:\s*หญิง)?)\s*(.*)$/);
    if (!m) return s.split(' ')[0] + 'ฯ';
    const rank = m[1].replace(/\s+/g, '').replace(/^ว่าที่/, 'ว่าที่ ');
    const first = (m[2] || '').trim().split(/\s+/)[0] || '';
    return rank + (/หญิง$/.test(rank) ? ' ' : '') + first + 'ฯ';
}
function splitNames(v) {
    return String(v || '').split(/[,\n]|\s{2,}/).map((x) => x.trim()).filter((x) => x && x !== '-');
}
function person(name) { return people[personKey(name)] || { name: name, photo: DEFAULT_AVATAR }; }

// ==========================================================
// ใครเข้าเวรวันไหน ช่วงเวลาไหน
// ==========================================================
/**
 * แปลงแถวเวรเป็นรายชื่อพร้อมบทบาท/เวลา
 * live = true เฉพาะเมื่อดู "วันเวรปัจจุบัน" เพื่อบอกว่าใครกำลังเข้าเวรอยู่ตอนนี้
 */
function dutyPeople(row, live) {
    if (!row) return { pgs: [], asst: [], other: [] };
    const k = rowKey(row);
    const now = minutesNow();
    const a = splitNames(row[1]), b = splitNames(row[6]);
    const same = a.length && b.length && personKey(a.join()) === personKey(b.join());
    const pgs = [];
    const GOLD = '#f59e0b', BLUE = '#3b82f6';

    // ตอนนี้อยู่ช่วง 00:00-08:00 ของวันถัดไปหรือไม่ (ยังนับเป็นเวรของวันเวรปัจจุบัน)
    const afterMidnight = live && keyOf(new Date()) !== k;

    if (same || (a.length && !b.length) || (!a.length && b.length)) {
        (a.length ? a : b).forEach((n) => pgs.push({ name: n, role: 'พงส.เวร', time: '24 ชม.', color: GOLD, on: live }));
    } else if (k >= PAIR_START) {
        const dayOn = live && !afterMidnight && now >= 8 * 60 + 1 && now <= 17 * 60;
        a.forEach((n) => pgs.push({ name: n, role: 'คู่เวรกลางวัน', time: '08:01–17:00', color: GOLD, on: dayOn, off: live && !dayOn }));
        b.forEach((n) => pgs.push({ name: n, role: 'พงส.เวร', time: '24 ชม.', color: BLUE, on: live }));
    } else if (k >= SPLIT_START) {
        const dayOn = live && !afterMidnight && now >= 8 * 60 + 1 && now <= 17 * 60;
        a.forEach((n) => pgs.push({ name: n, role: 'ผลัดเช้า', time: '08:01–17:00', color: GOLD, on: dayOn, off: live && !dayOn }));
        b.forEach((n) => pgs.push({ name: n, role: 'ผลัดเย็น', time: '17:01–08:00', color: BLUE, on: live && !dayOn, off: live && dayOn }));
    }
    // ให้คนที่กำลังเข้าเวรอยู่ขึ้นก่อน
    pgs.sort((x, y) => (y.on ? 1 : 0) - (x.on ? 1 : 0));

    const asst = splitNames(row[2]).map((n) => ({ name: n, role: 'ผช.พงส.', time: '24 ชม.', color: '#0ea5e9', on: live }));
    const other = splitNames(row[3]).map((n) => ({ name: n, role: 'ส่งของกลาง', time: '', color: '#06b6d4', on: false }))
        .concat(splitNames(row[5]).map((n) => ({ name: n, role: 'เวรเสริม', time: '', color: '#8b5cf6', on: false })));
    return { pgs, asst, other };
}

function dutyRowFor(dt) { const k = keyOf(dt); return data.duty.find((r) => rowKey(r) === k) || null; }
function missionsFor(dt) {
    const k = keyOf(dt);
    return data.mission.slice(1).filter((r) => r && r[3] && rowKey(r) === k)
        .map((r) => {
            const t = misTime(r[1]);
            return { time: t.text, place: String(r[2] || '').trim(), title: String(r[3] || '').trim(), who: splitNames(r[4]), chair: splitNames(r[5]), start: t.start, end: t.end };
        })
        .sort((a, b) => (a.start == null ? 9999 : a.start) - (b.start == null ? 9999 : b.start));
}
/**
 * เวลาภารกิจ "09:00" หรือช่วง "09:00-12:00" → { text, start, end } (นาทีนับจากเที่ยงคืน)
 * end = null เมื่อไม่ได้ระบุเวลาสิ้นสุด · ข้ามคืน (22:00-02:00) end จะเกิน 1440
 */
function misTime(v) {
    const s = String(v || '').replace(/น\.?/g, ' ').replace(/\./g, ':');
    const m = s.match(/(\d{1,2}):(\d{2})(?:\s*(?:-|–|—|ถึง)\s*(\d{1,2}):(\d{2}))?/);
    if (!m) return { text: String(v || '').trim(), start: null, end: null };
    const two = (n) => String(+n).padStart(2, '0');
    const start = (+m[1]) * 60 + (+m[2]);
    let end = m[3] ? (+m[3]) * 60 + (+m[4]) : null;
    if (end != null && end <= start) end += 1440;
    return { text: two(m[1]) + ':' + m[2] + (m[3] ? '–' + two(m[3]) + ':' + m[4] : ''), start, end };
}

// ==========================================================
// โหลดข้อมูล
// ==========================================================
// เปิดหน้าแล้วแสดงข้อมูลชุดล่าสุดที่เก็บไว้ในเครื่องทันที แล้วโหลดของใหม่เบื้องหลัง (ไม่ต้องรอหน้าว่าง)
const LS_DATA = 'radio-data-v1';
let shownCached = false;
function applyData(json, at, cached) {
    data = { duty: json.duty || [], mission: json.mission || [], personnel: json.personnel || [], leave: json.leave || [],
        stats: json.stats || null, station: json.station || null };
    buildPeople();
    $('lastSync').textContent = (cached ? 'ข้อมูลที่บันทึกไว้ ' : 'ข้อมูลล่าสุด ')
        + new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' + (cached ? ' · กำลังอัปเดต…' : '');
    renderAll();
    renderDutyMonth();
    renderStation();
    try { renderBoard(); } catch (err) { console.error('board', err); }
}
async function loadData() {
    if (!shownCached) {
        shownCached = true;
        try {
            const c = JSON.parse(localStorage.getItem(LS_DATA) || 'null');
            if (c && c.json) applyData(c.json, c.at, true);
        } catch (e) { }
    }
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 60000);
    try {
        const res = await fetch(API_URL + '?api=radio', { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
        const text = await res.text();
        const json = JSON.parse(text);
        applyData(json, Date.now(), false);
        try { localStorage.setItem(LS_DATA, JSON.stringify({ at: Date.now(), json: json })); } catch (e) { }
    } catch (e) {
        console.error(e);
        if (data && data.duty && data.duty.length) {
            // มีข้อมูลเดิมแสดงอยู่แล้ว — ใช้ต่อ แจ้งเฉพาะที่แถบเวลา
            $('lastSync').textContent = $('lastSync').textContent.replace(' · กำลังอัปเดต…', '') + ' · อัปเดตไม่สำเร็จ จะลองใหม่อัตโนมัติ';
        } else {
            const msg = '<div class="err"><i class="fa-solid fa-triangle-exclamation"></i> โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง (' + esc(e.name === 'AbortError' ? 'หมดเวลา' : e.message) + ')</div>';
            $('duty').innerHTML = msg; $('missions').innerHTML = msg;
        }
    } finally {
        clearTimeout(timer);
    }
}

function buildPeople() {
    people = {};
    const opts = [];
    data.personnel.slice(1).forEach((r) => {
        if (!r || !r[1]) return;
        const photo = [r[8], r[9]].concat(r).find((c) => typeof c === 'string' && /^https?:\/\//.test(c)) || DEFAULT_AVATAR;
        people[personKey(r[1])] = { name: r[1], nick: r[2] || '', photo, phone: r[3] || '', dial: r[10] || r[3] || '', pos: r[4] || '' };
        opts.push('<option value="' + esc(r[1]) + '">' + esc(rankName(r[1])) + (r[2] ? ' (' + esc(r[2]) + ')' : '') + '</option>');
    });
    $('peopleList').innerHTML = opts.join('');
}

// ==========================================================
// วาดหน้าจอ
// ==========================================================
function renderAll() {
    renderDay();
    renderCalendar();
    if (query) renderResults();
}

function personCard(p) {
    const info = person(p.name);
    const state = p.on ? '<span class="tag tag-live"><i class="fa-solid fa-circle-dot"></i> กำลังเข้าเวร</span>'
        : (p.off ? '<span class="tag tag-done">นอกเวลา</span>' : '');
    const phone = info.phone ? '<a class="call" href="tel:' + esc(String(info.dial).replace(/[^0-9+]/g, '')) + '"><i class="fa-solid fa-phone"></i> ' + esc(info.phone) + '</a>' : '';
    return '<div class="person' + (p.on ? ' on' : '') + (p.off ? ' off' : '') + '" style="--pc:' + p.color + '">'
        + '<div class="person-av"><img src="' + esc(info.photo) + '" alt="" loading="lazy" onerror="this.src=\'' + DEFAULT_AVATAR + '\'"></div>'
        + '<div class="person-main">'
        + '<div class="person-name" title="' + esc(p.name) + '">' + esc(rankName(p.name)) + '</div>'
        + '<div class="person-role"><span class="tag">' + esc(p.role) + '</span>'
        + (p.time ? '<span class="tag tag-ghost">' + esc(p.time) + '</span>' : '') + state + '</div>'
        + '</div>' + phone + '</div>';
}

function renderDay() {
    const cur = currentDutyDate();
    const dt = viewDate || cur;
    const live = keyOf(dt) === keyOf(cur);
    $('dutyDayLabel').textContent = thDay(dt);

    // แถบบอกวันที่
    const banner = $('dayBanner');
    banner.className = 'day-banner' + (live ? '' : ' other');
    banner.innerHTML = live
        ? '<span class="db-badge"><span class="live"></span> ขณะนี้</span>'
          + '<span class="db-date">เวร' + esc(thFull(dt)) + '</span>'
          + '<span class="db-note">รอบเวร 08:01 น. ถึง 08:00 น. วันรุ่งขึ้น</span>'
        : '<span class="db-badge"><i class="fa-regular fa-calendar"></i> ดูย้อนหลัง/ล่วงหน้า</span>'
          + '<span class="db-date">' + esc(thFull(dt)) + '</span>'
          + '<button class="db-back" type="button" onclick="goToday()"><i class="fa-solid fa-rotate-left"></i> กลับมาเวรปัจจุบัน</button>';

    // เวร
    const row = dutyRowFor(dt);
    const d = dutyPeople(row, live);
    const onNow = d.pgs.filter((p) => p.on).length + d.asst.filter((p) => p.on).length;
    $('dutyTitle').textContent = live ? 'ใครเข้าเวรตอนนี้' : 'เวรสอบสวน';
    $('dutySub').textContent = live ? ('เข้าเวรอยู่ ' + onNow + ' นาย') : thShort(dt);
    const groups = [];
    if (d.pgs.length) groups.push(['<i class="fa-solid fa-user-shield"></i> พนักงานสอบสวน', d.pgs]);
    if (d.asst.length) groups.push(['<i class="fa-solid fa-user-group"></i> ผู้ช่วยพนักงานสอบสวน', d.asst]);
    if (d.other.length) groups.push(['<i class="fa-solid fa-box-archive"></i> ส่งของกลาง / เวรเสริม', d.other]);
    $('duty').innerHTML = groups.length
        ? groups.map((g) => '<div class="duty-group"><div class="dg-h">' + g[0] + '</div><div class="people">' + g[1].map(personCard).join('') + '</div></div>').join('')
        : '<div class="empty"><i class="fa-regular fa-calendar-xmark"></i> ไม่มีข้อมูลเวรวันนี้</div>';

    // ภารกิจ — วันเวรปัจจุบันให้ภารกิจที่กำลังทำ/ถัดไปขึ้นก่อน ที่ผ่านไปแล้วไว้ท้าย
    const calDay = live ? midnight(new Date()) : dt;
    let list = missionsFor(calDay);
    const now = minutesNow();
    list.forEach((m) => {
        m.state = '';
        if (!live || keyOf(calDay) !== keyOf(new Date()) || m.start == null) return;
        // ระบุเวลาสิ้นสุด = ใช้ตามจริง · ไม่ระบุ = ถือว่าใช้เวลา 3 ชม.
        const end = m.end != null ? m.end : m.start + 180;
        if (now < m.start) m.state = 'next';
        else if (now < end) m.state = 'now';
        else m.state = 'past';
    });
    if (live) {
        const firstNext = list.find((m) => m.state === 'next');
        list.forEach((m) => { if (m.state === 'next' && m !== firstNext) m.state = 'later'; });
        const rank = { now: 0, next: 1, later: 2, '': 3, past: 4 };
        list = list.slice().sort((a, b) => rank[a.state] - rank[b.state] || (a.start || 0) - (b.start || 0));
    }
    $('missionTitle').textContent = live ? 'ภารกิจวันนี้' : 'ภารกิจ';
    $('missionSub').textContent = list.length ? (list.length + ' ภารกิจ') : thShort(calDay);
    $('missions').innerHTML = list.length ? '<div class="mis-list">' + list.map(missionCard).join('') + '</div>'
        : '<div class="empty"><i class="fa-regular fa-calendar-check"></i> ไม่มีภารกิจ</div>';
}

function missionCard(m) {
    const st = { now: '<span class="tag tag-live"><i class="fa-solid fa-circle-dot"></i> กำลังดำเนินการ</span>',
        next: '<span class="tag" style="--pc:#3b82f6">ถัดไป</span>',
        past: '<span class="tag tag-done">ผ่านไปแล้ว</span>' }[m.state] || '';
    const face = (n, chair) => {
        const info = person(n);
        return '<div class="mf' + (chair ? ' chair' : '') + '" title="' + esc(n) + '">'
            + '<img src="' + esc(info.photo) + '" alt="" loading="lazy" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">'
            + '<span>' + (chair ? 'ปธ. ' : '') + esc(rankName(n)) + '</span></div>';
    };
    const cls = m.state === 'later' ? '' : m.state;
    return '<div class="mis ' + cls + '">'
        + '<div class="mis-top"><span class="mis-time"><i class="fa-regular fa-clock"></i> ' + esc(m.time || 'ทั้งวัน') + '</span>' + st + '</div>'
        + '<div class="mis-title">' + esc(m.title) + '</div>'
        + (m.place ? '<div class="mis-place"><i class="fa-solid fa-location-dot"></i>' + esc(m.place) + '</div>' : '')
        + ((m.chair.length || m.who.length) ? '<div class="mis-faces">' + m.chair.map((n) => face(n, true)).join('') + m.who.map((n) => face(n, false)).join('') + '</div>' : '')
        + '</div>';
}

// ==========================================================
// ปฏิทิน
// ==========================================================
function renderCalendar() {
    const y = calMonth.getFullYear(), mo = calMonth.getMonth();
    $('monthLabel').textContent = TH_MON_FULL[mo] + ' ' + (y + 543);
    const first = new Date(y, mo, 1).getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    const todayK = keyOf(new Date());
    const selK = keyOf(viewDate || currentDutyDate());

    const dutyDays = {}, misDays = {}, personDays = {};
    data.duty.forEach((r) => { const k = rowKey(r); if (k && (r[1] || r[6] || r[2])) dutyDays[k] = 1; });
    data.mission.slice(1).forEach((r) => { const k = rowKey(r); if (k && r[3]) misDays[k] = 1; });
    if (query) matches().forEach((x) => { personDays[x.key] = 1; });

    let html = '';
    for (let i = 0; i < first; i++) html += '<div class="day empty"></div>';
    for (let d = 1; d <= days; d++) {
        const k = ymd(y, mo + 1, d);
        const cls = ['day'];
        if (k === todayK) cls.push('today');
        if (k === selK) cls.push('sel');
        if (personDays[k]) cls.push('person');
        const marks = (dutyDays[k] ? '<i class="dot dot-duty"></i>' : '') + (misDays[k] ? '<i class="dot dot-mis"></i>' : '');
        html += '<div class="' + cls.join(' ') + '" onclick="pickDate(' + y + ',' + mo + ',' + d + ')">' + d
            + (marks ? '<span class="marks">' + marks + '</span>' : '') + '</div>';
    }
    $('calDays').innerHTML = html;
    $('legendPerson').hidden = !query;
}

// ==========================================================
// ค้นหาตามชื่อคน / ภารกิจ
// ==========================================================
/** รายการเวร+ภารกิจที่ตรงกับคำค้น (ชื่อคนเทียบแบบตัดยศ, ภารกิจเทียบชื่อเรื่อง/สถานที่ด้วย) */
function matches() {
    const q = query.trim();
    if (!q) return [];
    const qk = personKey(q).toLowerCase();
    const ql = q.toLowerCase();
    const hitName = (n) => { const k = personKey(n).toLowerCase(); return qk.length >= 2 && (k.indexOf(qk) > -1 || qk.indexOf(k) > -1 && k.length >= 3); };
    const out = [];
    data.duty.forEach((r) => {
        const k = rowKey(r); if (!k) return;
        const dp = dutyPeople(r, false);
        dp.pgs.concat(dp.asst, dp.other).forEach((p) => {
            if (hitName(p.name)) out.push({ key: k, date: parseDate(r[0]), type: 'duty', title: p.role + (p.time ? ' · ' + p.time : ''), sub: rankName(p.name) });
        });
    });
    data.mission.slice(1).forEach((r) => {
        const k = rowKey(r); if (!k || !r[3]) return;
        const names = splitNames(r[4]).concat(splitNames(r[5]));
        const byName = names.some(hitName);
        const byText = ql.length >= 2 && (String(r[3]).toLowerCase().indexOf(ql) > -1 || String(r[2] || '').toLowerCase().indexOf(ql) > -1);
        if (byName || byText) out.push({ key: k, date: parseDate(r[0]), type: 'mission', title: String(r[3]), sub: [r[1] ? misTime(r[1]).text + ' น.' : '', r[2] || ''].filter(Boolean).join(' · ') });
    });
    return out.sort((a, b) => a.key - b.key);
}

function renderResults() {
    const box = $('results');
    if (!query.trim()) { box.hidden = true; return; }
    box.hidden = false;
    const all = matches();
    const todayK = keyOf(currentDutyDate());
    const up = all.filter((x) => x.key >= todayK);
    const past = all.filter((x) => x.key < todayK).reverse();
    // พิมพ์แค่ชื่อจริงก็หาคนเจอ (ถ้าตรงคนเดียว)
    const qk = personKey(query).toLowerCase();
    const cands = qk.length >= 2 ? Object.values(people).filter((x) => personKey(x.name).toLowerCase().indexOf(qk) > -1) : [];
    const p = people[personKey(query)] || (cands.length === 1 ? cands[0] : null);

    $('resultsTitle').textContent = 'ผลการค้นหา "' + query.trim() + '"';
    $('pastToggle').classList.toggle('on', showPast);
    $('pastToggle').textContent = showPast ? 'ซ่อนย้อนหลัง' : ('แสดงย้อนหลัง (' + past.length + ')');

    let html = '';
    if (p) {
        const nextDuty = up.find((x) => x.type === 'duty');
        html += '<div class="res-person"><img src="' + esc(p.photo) + '" alt="" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">'
            + '<div><b>' + esc(rankName(p.name)) + '</b><small>' + esc(p.pos) + '</small>'
            + (p.phone ? '<small><a href="tel:' + esc(String(p.dial).replace(/[^0-9+]/g, '')) + '"><i class="fa-solid fa-phone"></i> ' + esc(p.phone) + '</a></small>' : '') + '</div>'
            + '<div class="res-stat"><b>' + (nextDuty ? esc(thShort(nextDuty.date)) : '–') + '</b><small>เวรครั้งถัดไป</small></div></div>';
    }
    const row = (x) => '<div class="res' + (x.key === todayK ? ' today' : '') + (x.key < todayK ? ' past' : '') + '" onclick="pickKey(' + x.key + ')">'
        + '<div class="res-date"><b>' + x.date.getDate() + '</b><span>' + TH_MON[x.date.getMonth()] + String((x.date.getFullYear() + 543) % 100) + '</span></div>'
        + '<div class="res-body"><div class="res-t">' + esc(x.title) + '</div><div class="res-s">' + esc(x.sub) + '</div></div>'
        + (x.key === todayK ? '<span class="res-badge b-when">วันนี้</span>' : '')
        + '<span class="res-badge ' + (x.type === 'duty' ? 'b-duty' : 'b-mis') + '">' + (x.type === 'duty' ? 'เวร' : 'ภารกิจ') + '</span></div>';

    html += up.length ? '<div class="res-sec">ที่จะถึง (' + up.length + ')</div>' + up.map(row).join('')
        : '<div class="empty">ไม่มีเวรหรือภารกิจที่จะถึง</div>';
    if (showPast && past.length) html += '<div class="res-sec">ย้อนหลัง</div>' + past.map(row).join('');
    $('resultsList').innerHTML = html;
}

// ==========================================================
// การเลือกวัน
// ==========================================================
window.pickDate = function (y, m, d) { setView(new Date(y, m, d)); };
window.pickKey = function (k) { setView(new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100)); };
window.goToday = function () { setView(null); };

// แถบเลื่อนวัน (แบบเวร สน.): ไม่เลื่อนหน้าจอ
window.dutyDayStep = function (n) { setView(addDays(viewDate || currentDutyDate(), n), true); };
function setView(dt, stay) {
    viewDate = (dt && keyOf(dt) !== keyOf(currentDutyDate())) ? midnight(dt) : null;
    const show = viewDate || currentDutyDate();
    calMonth = new Date(show.getFullYear(), show.getMonth(), 1);
    $('dateInput').value = show.getFullYear() + '-' + String(show.getMonth() + 1).padStart(2, '0') + '-' + String(show.getDate()).padStart(2, '0');
    renderDay();
    renderCalendar();
    showTab('duty');
    setDutyView('day');
    if (!stay) $('dayBanner').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================================
// เวรสอบสวน: ดูทั้งเดือนเป็นตาราง + ส่งออก PDF/ภาพ (เฉพาะตาราง)
// ==========================================================
let dutyView = 'day';
let dutyMonth = new Date();
function setDutyView(v) {
    dutyView = v;
    document.querySelectorAll('#dutySeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    $('dutyDay').hidden = v !== 'day';
    $('dutyMonth').hidden = v !== 'month';
    $('dutyMonthNav').hidden = v !== 'month';
    $('dutyDayNav').hidden = v !== 'day';
    $('dutyExport').hidden = v !== 'month';
    if (v === 'month') renderDutyMonth(true);
}
window.dutyMonthStep = function (n) { dutyMonth = new Date(dutyMonth.getFullYear(), dutyMonth.getMonth() + n, 1); renderDutyMonth(true); };
// jump = เลื่อนหน้ามาแถววันนี้ (เปิดหน้า/เปลี่ยนเดือน) · โหลดข้อมูลใหม่อัตโนมัติไม่ต้องเลื่อน คงตำแหน่งเดิม
function renderDutyMonth(jump) {
    if (dutyView !== 'month') return;
    const y = dutyMonth.getFullYear(), m = dutyMonth.getMonth();
    $('dutyMonthLabel').textContent = TH_MON_FULL[m] + ' ' + (y + 543);
    $('dutyMonth').innerHTML = svInvestMonthHtml(data.duty, y, m);
    $('dutyExport').innerHTML = svExportButtons("exportDutyMonth('pdf')", "exportDutyMonth('img')");
    // เลื่อนทั้งหน้า หัวตารางตรึงกับขอบบนจอ
    if (jump) svScrollToToday($('dutyMonth')); else svFloatHeads($('dutyMonth'));
}
window.exportDutyMonth = function (kind) {
    const y = dutyMonth.getFullYear(), m = dutyMonth.getMonth();
    const title = 'ตารางเวรพนักงานสอบสวน สน.ลำหิน ' + TH_MON_FULL[m] + ' ' + (y + 543);
    const html = svInvestMonthHtml(data.duty, y, m, { foot: true });
    if (kind === 'img') svExportImage(title, html, false); else svExportPdf(title, html, false);
};

// ==========================================================
// เวรทุกสายงาน สน. (อ่านอย่างเดียว — เพิ่ม/แก้ไข/นำเข้าจากรูปที่เว็บแอปเมนู "เวรทุกสายงาน")
// ==========================================================
let stView = 'day', stDate = null, stSec = '';
// jump = เลื่อนตารางรายเดือนมาแถววันนี้ (เปิดแท็บ/เปลี่ยนเดือน) · โหลดใหม่อัตโนมัติคงตำแหน่งเดิม
function renderStation(jump) {
    const box = $('stView'); if (!box) return;
    const prev = box.querySelector('.sv-vscroll');
    const keepLeft = prev ? prev.scrollLeft : 0;
    if (!stDate) stDate = midnight(new Date());
    if (!data.station) { box.innerHTML = '<div class="empty">ยังไม่มีข้อมูลเวรทุกสายงาน</div>'; return; }
    document.querySelectorAll('#stSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === stView));
    const sel = $('stSec');
    sel.hidden = stView !== 'month';
    sel.innerHTML = svSecOptions(data.station, stSec);
    $('stLabel').textContent = stView === 'day' ? thDay(stDate) : (TH_MON_FULL[stDate.getMonth()] + ' ' + (stDate.getFullYear() + 543));
    box.innerHTML = stView === 'day'
        ? svDayHtml(data.station, stDate, { emptyHint: 'งานธุรการกดปุ่ม "แก้ไข/เพิ่มเวร" ด้านบน' })
        : svMonthHtml(data.station, stDate.getFullYear(), stDate.getMonth(), stSec);
    $('stExport').innerHTML = svExportButtons("exportStation('pdf')", "exportStation('img')");
    if (stView === 'day') stCheckApply(box, stDate);   // เช็คชื่อ (ในเครื่องนี้ ไม่ออกในภาพ/PDF)
    else if (window.stCheckOff) stCheckOff();
    if (stView === 'month') {
        // เลื่อนทั้งหน้า หัวตารางตรึงกับขอบบนจอ · เปิดแท็บ/เปลี่ยนเดือน = เลื่อนมาเวรวันนี้รอไว้
        if (jump || !prev) svScrollToToday(box);
        else {
            svFloatHeads(box);
            const nb = box.querySelector('.sv-vscroll');
            if (nb) nb.scrollLeft = keepLeft;
        }
    }
}
window.stStep = function (n) {
    stDate = stView === 'day' ? addDays(stDate, n) : new Date(stDate.getFullYear(), stDate.getMonth() + n, 1);
    renderStation(true);
};
window.stToday = function () { stDate = midnight(new Date()); renderStation(true); };
window.exportStation = function (kind) {
    const day = stView === 'day';
    const title = day ? 'ตารางเวร สน.ลำหิน ' + thShort(stDate)
        : 'ตารางเวร สน.ลำหิน ' + TH_MON_FULL[stDate.getMonth()] + ' ' + (stDate.getFullYear() + 543);
    const html = day ? svDayHtml(data.station, stDate, { foot: true, plain: true })
        : svMonthHtml(data.station, stDate.getFullYear(), stDate.getMonth(), stSec, { foot: true });
    // ทุกฝ่ายทั้งเดือน = A4 แนวนอน ไม่พอขึ้นหน้าถัดไปพร้อมหัวตาราง
    if (!day && !stSec) { svExportMonth(kind, title, data.station, stDate.getFullYear(), stDate.getMonth(), ''); return; }
    const landscape = false;
    const opt = { a4: day };   // ใบเวรประจำวัน = ยืดเต็มหน้า A4 ตัวอักษรใหญ่
    if (kind === 'img') svExportImage(title, html, landscape, opt); else svExportPdf(title, html, landscape, opt);
};

// ==========================================================
// เมนูหัวข้อ (แท็บ)
// ==========================================================
let curTab = 'station';   // เปิดหน้าแรก = เวร สน. รายวัน
// หน้านี้เป็นกระดานงานสอบสวน ที่ให้ธุรการ สน. ยืมใช้แท็บ "เวร สน." — หัวบาร์จึงต่างกันตามแท็บ
const HERO_TITLE = { station: 'ตารางเวรทุกสายงาน สน.ลำหิน', other: 'สอบสวน สน.ลำหิน' };
function heroFollowTab() {
    const hero = $('dash-hero'); if (!hero) return;
    const st = curTab === 'station';
    hero.classList.toggle('hero-station', st);
    const h3 = hero.querySelector('.dash-hero-txt h3');
    if (h3) h3.textContent = st ? HERO_TITLE.station : HERO_TITLE.other;
    document.title = st ? HERO_TITLE.station : 'กระดานงานสอบสวน สน.ลำหิน';
}
function showTab(name) {
    curTab = name;
    heroFollowTab();
    document.querySelectorAll('.rpane').forEach((p) => { p.hidden = p.id !== 'pane-' + name; });
    document.querySelectorAll('#rtabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    if (name === 'station') renderStation(true);
    scene3dFollowTab();
    try { history.replaceState(null, '', '#' + name); } catch (e) { }
}
// วาดฉาก 3 มิติเฉพาะตอนเปิดแท็บ "เวร สน." (แท็บอื่นหยุดวาด ประหยัดแบตมือถือ)
function scene3dFollowTab() {
    if (typeof LamhinScene === 'undefined' || !LamhinScene.isReady() || (DASH && DASH.present)) return;
    const on = curTab === 'station';
    if (!on && LamhinScene.isDriving()) LamhinScene.stopDrive();
    LamhinScene.setVisible(on);
    if (on) setTimeout(() => LamhinScene.resize(), 60);
}

// ==========================================================
// กระดานแดชบอร์ด (ใช้ dash/*.js ชุดเดียวกับเว็บแอป)
// ==========================================================
// ตัวแปร DB / ฟังก์ชันที่ dash.js เรียกหา — ให้ชี้มาที่ข้อมูลของหน้านี้
var DB = {};
window._dsPhoto = function (name) { const p = person(name); return p.photo && p.photo !== DEFAULT_AVATAR ? p.photo : ''; };
// คลิกหน้าคน = ค้นหาเวร/ภารกิจของคนนั้น
window.showPersonProfile = function (name) {
    if (typeof dashPresentExit === 'function' && DASH.present) dashPresentExit();
    query = String(name || ''); $('q').value = query; showPast = false;
    showTab('duty'); renderResults(); renderCalendar();
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
window.showMissionPopup = function () { setView(null); };

// ปีงบที่มีข้อมูล / สถิติแต่ละช่วง มาจากเซิร์ฟเวอร์ (หน้านี้ไม่มีข้อมูลคดีรายเรื่อง)
window.dashAvailableFy = function () {
    const f = data.stats && data.stats.fys;
    return f && f.length ? f.slice() : [dashFyOf(new Date())];
};
function statsFor(rv) {
    const today = midnight(new Date());
    const st = data.stats && data.stats.ranges && data.stats.ranges[rv];
    if (!st) return Object.assign(dashComputeCases([], [], dashRangeOf(rv, today), today), { prevSerious: 0, empty: true });
    const s = Object.assign({}, st);
    s.from = new Date(st.from); s.to = new Date(st.to);
    return s;
}
window.dashRecompute = function () {
    const today = midnight(new Date());
    DASH.range = dashRangeOf(DASH.rangeVal, today);
    DASH.fy = DASH.range.fy;
    DASH.stats = statsFor(DASH.rangeVal);
    DASH.prevSerious = DASH.stats.prevSerious || 0;
    DASH.pattern = dashDutyPattern(DB.duty, today);
    DASH.crew = dashComputeCrew(DB.personnel, DB.duty, DB.mission, DB.leave, today, { split: splitNames });
};
// ตัวเลือกช่วงข้อมูลแบบสั้น: "ปีงบ 69", "ปีงบ 69–ปัจจุบัน"
window.dashRangeOptions = function () {
    const avail = dashAvailableFy();
    const list = avail.map((y) => ({ v: 'fy:' + y, t: 'ปีงบ ' + (y % 100) }));
    if (avail.indexOf(DASH_BASE_FY) > -1) list.push({ v: 'span:' + DASH_BASE_FY, t: 'ปีงบ ' + (DASH_BASE_FY % 100) + '–ปัจจุบัน' });
    return list;
};

/** วางกล่องต่าง ๆ ของแดชบอร์ดลงตำแหน่งในหน้านี้ (ครั้งแรก) แล้วเติมข้อมูล */
function renderBoard() {
    DB = { duty: data.duty, mission: data.mission, personnel: data.personnel, leave: data.leave };
    if (!DASH.rangeVal) DASH.rangeVal = dashDefaultRange();
    dashRecompute();

    if (!DASH.booted) {
        const tmp = document.createElement('div');
        tmp.innerHTML = dashMarkup();
        const take = (id) => tmp.querySelector('#' + id);
        const hero = take('dash-hero');
        // หัวบาร์บรรทัดเดียว: ตรา สน. + ชื่อ (ไม่มีนาฬิกา/ปุ่มเต็มจอ ประหยัดที่บนมือถือ)
        // เปลี่ยนตามแท็บ (heroFollowTab): แท็บ เวร สน. = ภาพรวม สน. · แท็บอื่น = งานสอบสวน + ปีงบ + Present
        const badge = hero.querySelector('.dash-hero-badge');
        if (badge) badge.innerHTML = '<img src="logo.png" alt="ตรา สน.ลำหิน">';
        hero.querySelectorAll('.dash-hero-txt span, #dash-clock, .dash-ic:not(.dash-ic-present)').forEach((el) => el.remove());
        const pres = hero.querySelector('.dash-ic-present span'); if (pres) pres.textContent = 'Present';
        $('slot-hero').replaceWith(hero);
        heroFollowTab();
        // แผนที่ 3 มิติอยู่เฉพาะแท็บ "เวร สน." (และเป็นหน้าปกตอน Present)
        // แผง "ปฏิบัติหน้าที่วันนี้" ข้างแผนที่ซ้ำกับแท็บเวรสอบสวน — เอาออก ให้แผนที่เต็มความกว้าง
        const stage = take('dash-stagewrap');
        const side = stage.querySelector('#dash-side'); if (side) side.remove();
        $('pane-station').insertBefore(stage, $('pane-station').firstChild);   // ภาพ 3 มิติอยู่บนสุดของแท็บ เวร สน.
        $('pane-crew').appendChild(take('dash-org'));
        ['dash-cases', 'dash-serious', 'dash-ranks', 'dash-damage', 'dash-trend'].forEach((id) => $('pane-cases').appendChild(take(id)));
        $('pane-work').appendChild(take('dash-workload'));
        const root = $('dash-root');
        tmp.querySelectorAll('.dash-pres-top, .dash-pres-nav, .dash-pres-bar').forEach((el) => root.appendChild(el));
        dashPaint();
        dashBoot3D();
        DASH.booted = true;
        scene3dFollowTab();
    } else {
        dashPaint();
        dashUpdateLabels();
    }
    if (data.stats == null) {
        $('dash-cases').insertAdjacentHTML('afterbegin', '<div class="err">ยังไม่มีสถิติคดีจากระบบ (เว็บแอปหลักยังไม่ได้อัปเดต) — ตัวเลขด้านล่างเป็นศูนย์ชั่วคราว</div>');
    }
}

// โหมดนำเสนอ: จำไว้ว่ากำลังนำเสนออยู่ — คลิกหน้าคนระหว่างนำเสนอจะออกจากสไลด์ก่อนไปหน้าค้นหา
(function () {
    if (typeof dashPresent !== 'function') return;
    const on = dashPresent, off = dashPresentExit;
    window.dashPresent = function () { DASH.present = true; on(); };
    window.dashPresentExit = function () { DASH.present = false; off(); setTimeout(scene3dFollowTab, 80); };
})();

// ==========================================================
// เริ่มต้น
// ==========================================================
function init() {
    let calToday = keyOf(midnight(new Date()));
    setInterval(() => {
        const nowKey = keyOf(midnight(new Date()));
        if (nowKey !== calToday) {
            if (stDate && stView === 'day' && keyOf(stDate) === calToday) { stDate = midnight(new Date()); renderStation(); }
            calToday = nowKey;
        }
    }, 30 * 1000);
    setInterval(() => {
        const before = keyOf(currentDutyDate());
        // สถานะ "กำลังเข้าเวร/ภารกิจถัดไป" ขึ้นกับเวลา จึงวาดใหม่ทุกนาที
        if (!viewDate || keyOf(currentDutyDate()) !== before) renderDay();
    }, 60 * 1000);
    setInterval(loadData, REFRESH_MS);

    // กดเมนูล่าง = สลับหัวข้อแล้วเลื่อนไปต้นหัวข้อนั้น (ข้ามแผนที่ด้านบน)
    document.querySelectorAll('#rtabs button').forEach((b) => b.addEventListener('click', () => {
        showTab(b.dataset.tab);
        const pane = $('pane-' + b.dataset.tab);
        if (pane) window.scrollTo({ top: Math.max(0, pane.getBoundingClientRect().top + window.scrollY - 8), behavior: 'smooth' });
    }));
    // เมนูล่าง: เลื่อนลง = ซ่อนให้เห็นเนื้อหาเต็มจอ · เลื่อนขึ้น / หยุดเลื่อน / อยู่บนสุดหรือล่างสุด = แสดงให้กดได้
    (function () {
        const bar = $('rtabs');
        let lastY = window.scrollY, idle = 0;
        window.addEventListener('scroll', () => {
            const y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
            if (y < 80 || y > max - 40 || y < lastY - 6) bar.classList.remove('hide');
            else if (y > lastY + 6) bar.classList.add('hide');
            lastY = y;
            clearTimeout(idle);
            idle = setTimeout(() => bar.classList.remove('hide'), 1200);
        }, { passive: true });
    })();
    const want = (location.hash || '').slice(1);
    if (['duty', 'station', 'crew', 'cases', 'work'].indexOf(want) > -1) showTab(want);
    document.querySelectorAll('#dutySeg button').forEach((b) => b.addEventListener('click', () => setDutyView(b.dataset.v)));
    document.querySelectorAll('#stSeg button').forEach((b) => b.addEventListener('click', () => {
        stView = b.dataset.v; if (stView === 'month' && stDate) stDate = new Date(stDate.getFullYear(), stDate.getMonth(), 1);
        if (stView === 'day') stDate = midnight(new Date());
        renderStation(true);
    }));
    $('stSec').addEventListener('change', (e) => { stSec = e.target.value; renderStation(true); });

    let t = 0;
    $('q').addEventListener('input', (e) => {
        clearTimeout(t);
        t = setTimeout(() => { query = e.target.value; showPast = false; renderResults(); renderCalendar(); }, 200);
    });
    $('dateInput').addEventListener('change', (e) => {
        const v = e.target.value; if (!v) return;
        const [y, m, d] = v.split('-').map(Number);
        setView(new Date(y, m - 1, d));
    });
    $('todayBtn').addEventListener('click', () => {
        query = ''; $('q').value = ''; showPast = false;
        $('results').hidden = true;
        setView(null);
    });
    $('closeResults').addEventListener('click', () => { query = ''; $('q').value = ''; $('results').hidden = true; renderCalendar(); });
    $('pastToggle').addEventListener('click', () => { showPast = !showPast; renderResults(); });
    $('prevMonth').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
    $('nextMonth').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });

    const cur = currentDutyDate();
    calMonth = new Date(cur.getFullYear(), cur.getMonth(), 1);
    $('dateInput').value = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
    loadData();
}

init();
