// สร้างอัตโนมัติจาก _dev/dash.js — อย่าแก้ที่นี่
// ==========================================================
// แดชบอร์ดศูนย์บัญชาการงานสอบสวน สน.ลำหิน
// ใช้สำหรับพรีเซนต์ในห้องประชุม — เปิดแล้วเห็นภาพรวมทั้งหน่วยในหน้าเดียว
//
// โครงหน้า (วางเป็นบล็อกซ้อนกันลงมา ไม่มีอะไรทับกัน):
//   1) แถบหัวเรื่อง + ตัวเลือกปีงบประมาณ + ปุ่มเต็มจอ
//   2) แถวการ์ดตัวเลขสำคัญ (KPI)
//   3) เวที 3 มิติ (ซ้าย) + แผงรายละเอียดอาคารที่เลือก (ขวา)
//   4) สถานภาพกำลังพลวันนี้
//   5) สถานภาพคดี อาญา/จราจร/ออนไลน์ + อายุคดีค้าง
//   6) กราฟจัดอันดับประเภทคดี (อาญา / ออนไลน์)
//   7) กราฟคดีรับใหม่รายเดือนตลอดปีงบ
// ==========================================================

var DASH = {
    fy: 0,            // ปีงบที่กำลังดู (พ.ศ.)
    rangeVal: '',     // ช่วงที่เลือก เช่น 'fy:2569' หรือ 'span:2569'
    range: null,
    pattern: null,    // รูปแบบการเข้าเวรปัจจุบัน
    stats: null,
    crew: null,
    sel: 'station',   // อาคารที่เลือกอยู่
    booted: false,
    threeLoading: false
};

var DASH_THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

var DASH_TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var DASH_FY_MON = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];

function dashThaiDate(d) {
    if (!d) return '-';
    return d.getDate() + ' ' + DASH_TH_MON[d.getMonth()] + String((d.getFullYear() + 543) % 100);
}
function dashNum(n) { return (n || 0).toLocaleString('en-US'); }
function dashEsc(s) {
    return typeof escapeHtmlSafe === 'function' ? escapeHtmlSafe(s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
}

// ---- ปีงบประมาณที่มีข้อมูลอยู่จริง ----
function dashAvailableFy() {
    var set = {};
    function addFrom(rows, col, idCol) {
        (rows || []).slice(1).forEach(function (r) {
            if (!r || (idCol != null && !r[idCol])) return;
            var d = dashParseDate(r[col]);
            if (d) set[dashFyOf(d)] = true;
        });
    }
    addFrom(typeof DB !== 'undefined' ? DB.crimeCases : null, 7, 1);
    addFrom(typeof DB !== 'undefined' ? DB.onlineCases : null, 1, 0);
    var list = Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
    return list.length ? list : [dashFyOf(new Date())];
}
// ปีงบตั้งต้นของระบบ — ใช้ 2569 ตามที่กำหนด ถ้าไม่มีข้อมูลค่อยถอยไปปีที่มี
var DASH_BASE_FY = 2569;
function dashDefaultRange() {
    var avail = dashAvailableFy();
    if (avail.indexOf(DASH_BASE_FY) > -1) return 'fy:' + DASH_BASE_FY;
    return 'fy:' + avail[0];
}

// รายการช่วงเวลาให้เลือก: ทุกปีงบที่มีข้อมูล + ช่วงสะสมตั้งแต่ปีงบ 2569
function dashRangeOptions() {
    var avail = dashAvailableFy();
    var list = avail.map(function (y) { return { v: 'fy:' + y, t: 'ปีงบประมาณ ' + y }; });
    if (avail.indexOf(DASH_BASE_FY) > -1) {
        list.push({ v: 'span:' + DASH_BASE_FY, t: 'ปีงบ ' + DASH_BASE_FY + ' – ปัจจุบัน (สะสม)' });
    }
    return list;
}

// ==========================================================
// เข้าหน้าแดชบอร์ด
// ==========================================================
function renderCommandDashboard() {
    var root = document.getElementById('dash-root');
    if (!root) return;

    // ข้อมูลคดีมาทีหลัง (โหลดจังหวะที่ 2) — ถ้ายังไม่มาให้ขึ้นข้อความรอไว้ก่อน
    if (typeof DB === 'undefined' || !DB.crimeCases) {
        root.innerHTML = '<div class="dash-wait"><i class="fas fa-circle-notch fa-spin"></i>'
            + ' กำลังโหลดข้อมูลคดี… เปิดค้างไว้สักครู่</div>';
        DASH.booted = false;
        return;
    }
    if (!DASH.rangeVal) DASH.rangeVal = dashDefaultRange();

    // เปิดซ้ำ: ไม่ต้องสร้างฉาก 3 มิติใหม่ แค่คำนวณเลขใหม่แล้วเดินเครื่องต่อ
    if (DASH.booted && document.getElementById('dash-org')) {
        dashRecompute();
        dashPaint();
        dashUpdateLabels();
        if (LamhinScene.isReady()) { LamhinScene.setVisible(true); LamhinScene.resize(); }
        return;
    }

    dashRecompute();
    root.innerHTML = dashMarkup();
    dashPaint();
    dashBoot3D();
    DASH.booted = true;
}

// หยุดวาดฉาก 3 มิติเมื่อออกจากแท็บ — กันกิน CPU ตอนใช้งานหน้าอื่น
function dashLeave() {
    if (LamhinScene.isReady()) LamhinScene.setVisible(false);
    if (dashClockTimer) { clearInterval(dashClockTimer); dashClockTimer = 0; }
}

// ผูกกับการสลับแท็บของ Bootstrap
function dashBindTabEvents() {
    var btn = document.getElementById('tab-dashboard');
    if (!btn || btn.__dashBound) return;
    btn.__dashBound = true;
    btn.addEventListener('shown.bs.tab', function () { renderCommandDashboard(); });
    btn.addEventListener('hidden.bs.tab', dashLeave);
}

function dashRecompute() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    DASH.range = dashRangeOf(DASH.rangeVal, today);
    DASH.fy = DASH.range.fy;
    DASH.stats = dashComputeCases(DB.crimeCases, DB.onlineCases, DASH.range, today);
    DASH.prevSerious = dashCountSerious(DB.crimeCases, dashRangeOf('fy:' + (DASH.range.fy - 1), today));
    DASH.pattern = dashDutyPattern(DB.duty, today);
    DASH.crew = dashComputeCrew(DB.personnel, DB.duty, DB.mission, DB.leave, today, {
        canon: typeof canonicalPersonName === 'function' ? canonicalPersonName : null,
        split: typeof _dsSplitNames === 'function' ? _dsSplitNames : null,
        sameDay: typeof _dsSameDay === 'function' ? _dsSameDay : null
    });
}

function dashSetRange(v) {
    DASH.rangeVal = v || dashDefaultRange();
    dashRecompute();
    dashPaint();
    dashUpdateLabels();
}

// ==========================================================
// โครง HTML
// ==========================================================
function dashSectionHead(no, title, icon, sub) {
    return '<div class="dash-sec">'
        + '<span class="dash-sec-n">' + no + '</span>'
        + '<i class="fas ' + icon + '"></i>'
        + '<span class="dash-sec-t">' + title + '</span>'
        + (sub ? '<span class="dash-sec-s">' + sub + '</span>' : '')
        + '</div>';
}

function dashMarkup() {
    var opts = dashRangeOptions().map(function (o) {
        return '<option value="' + o.v + '"' + (o.v === DASH.rangeVal ? ' selected' : '') + '>' + o.t + '</option>';
    }).join('');

    return ''
        // ---------- แถบหัวเรื่อง ----------
        + '<div class="dash-hero" id="dash-hero">'
        + '  <div class="dash-hero-badge"><i class="fas fa-building-shield"></i></div>'
        + '  <div class="dash-hero-txt">'
        + '    <h3>ศูนย์บัญชาการงานสอบสวน</h3>'
        + '    <span>สถานีตำรวจนครบาลลำหิน</span>'
        + '  </div>'
        + '  <div class="dash-hero-right">'
        + '    <select class="dash-fy" onchange="dashSetRange(this.value)" title="ช่วงข้อมูลคดี">' + opts + '</select>'
        + '    <div class="dash-clock" id="dash-clock">--:--</div>'
        + '    <button class="dash-ic dash-ic-present" onclick="dashPresent()" title="นำเสนอแบบสไลด์ (เหมือน PowerPoint)"><i class="fas fa-person-chalkboard"></i><span>นำเสนอ</span></button>'
        + '    <button class="dash-ic" onclick="dashFullscreen()" title="แสดงเต็มจอ"><i class="fas fa-expand"></i></button>'
        + '  </div>'
        + '</div>'

        // ---------- ภาพรวมสถานี (แผนที่ 3 มิติ) ----------
        + '<div class="dash-stagewrap" id="dash-stagewrap">'
        + '  <div class="dash-stage" id="dash-stage">'
        + '    <div class="dash3d-loading" id="dash3d-loading"><i class="fas fa-circle-notch fa-spin"></i> กำลังสร้างแบบจำลอง 3 มิติ…</div>'
        // หน้าปกโหมดนำเสนอ (แสดงเฉพาะสไลด์แรก)
        + '    <div class="dash-cover" id="dash-cover" hidden>'
        + '      <div class="dash-cover-k">รายงานภาพรวม</div>'
        + '      <h2>งานสอบสวน<br>สถานีตำรวจนครบาลลำหิน</h2>'
        + '      <div class="dash-cover-d" id="dash-cover-date">-</div>'
        + '      <button type="button" onclick="dashDrive()"><i class="fas fa-car-side"></i> จำลองรถวิ่งเข้า สน.</button>'
        + '    </div>'
        + '    <div class="dash3d-ctrl">'
        + '      <button onclick="dashDrive()" title="จำลองรถวิ่งเข้า สน. (มุมมองคนขับ)" class="dash3d-car"><i class="fas fa-car-side"></i></button>'
        + '      <button onclick="dashZoom(-1)" title="ซูมเข้า"><i class="fas fa-plus"></i></button>'
        + '      <button onclick="dashZoom(1)" title="ซูมออก"><i class="fas fa-minus"></i></button>'
        + '      <button onclick="dashResetView()" title="มุมมองเริ่มต้น"><i class="fas fa-house"></i></button>'
        + '    </div>'
        + '    <div class="dash3d-hint"><i class="fas fa-hand-pointer"></i> ลากเพื่อหมุนรอบ 360° · ล้อเมาส์ซูม · คลิกป้ายเพื่อดูรายละเอียด</div>'
        + '  </div>'
        + '  <aside class="dash-side" id="dash-side"></aside>'
        + '</div>'

        // ========== ส่วนที่ 1 · สถานะกำลังพลปัจจุบัน ==========
        + dashSectionHead(1, 'สถานะกำลังพลปัจจุบัน', 'fa-users-gear', '<span id="dash-sec1-sub">-</span>')
        + '<div class="dash-card" id="dash-org">'
        + '  <div class="dash-card-h"><i class="fas fa-sitemap"></i> กำลังพลงานสอบสวน'
        + '    <div class="crew-sw">'
        + '      <button type="button" data-v="org" onclick="dashCrewView(\'org\')"><i class="fas fa-sitemap"></i> ผังบังคับบัญชา</button>'
        + '      <button type="button" data-v="duty" onclick="dashCrewView(\'duty\')"><i class="fas fa-repeat"></i> รูปแบบเวร</button>'
        + '    </div>'
        + '  </div>'
        + '  <div class="crew-pane" id="dash-org-pane"></div>'
        + '  <div class="crew-pane" id="dash-pattern"></div>'
        + '</div>'

        // ========== ส่วนที่ 2 · สถานะคดีและภาระงาน ==========
        + dashSectionHead(2, 'สถานะคดีและภาระงาน', 'fa-scale-balanced', '<span id="dash-sec2-sub">-</span>')
        + '<div class="dash-card" id="dash-cases"></div>'
        + '<div class="dash-card" id="dash-serious"></div>'
        + '<div class="dash-card" id="dash-workload"></div>'
        + '<div class="dash-2col" id="dash-ranks">'
        + '  <div class="dash-card" id="dash-rank-crime"></div>'
        + '  <div class="dash-card" id="dash-rank-online"></div>'
        + '</div>'
        + '<div class="dash-card" id="dash-damage"></div>'
        + '<div class="dash-card" id="dash-trend"></div>'

        // ---------- แถบควบคุมโหมดนำเสนอ ----------
        + '<div class="dash-pres-top">'
        + '  <div class="dash-pres-brand"><i class="fas fa-building-shield"></i> สน.ลำหิน</div>'
        + '  <div class="dash-pres-title" id="dash-pres-title">-</div>'
        + '  <div class="dash-pres-count" id="dash-pres-count">-</div>'
        + '  <button class="dash-pres-x" onclick="dashPresentExit()" title="ออกจากโหมดนำเสนอ (Esc)"><i class="fas fa-xmark"></i></button>'
        + '</div>'
        + '<div class="dash-pres-nav">'
        + '  <button onclick="dashPresentGo(-1)" title="ย้อนกลับ (←)"><i class="fas fa-chevron-left"></i></button>'
        + '  <div class="dash-pres-dots" id="dash-pres-dots"></div>'
        + '  <button onclick="dashPresentGo(1)" title="ถัดไป (→ / Space)"><i class="fas fa-chevron-right"></i></button>'
        + '</div>'
        + '<div class="dash-pres-bar"><i id="dash-pres-prog"></i></div>';
}

// ==========================================================
// เติมข้อมูลลงทุกส่วน
// ==========================================================
function dashPaint() {
    var s = DASH.stats, c = DASH.crew;
    // ช่วงเวลาบอกครั้งเดียวที่หัวข้อส่วนที่ 2 — การ์ดย่อยไม่ต้องบอกซ้ำ
    var s1 = document.getElementById('dash-sec1-sub');
    if (s1) s1.textContent = 'ณ วันที่ ' + dashThaiDate(new Date());
    var s2 = document.getElementById('dash-sec2-sub');
    if (s2) s2.textContent = s.rangeLabel + ' · ' + dashThaiDate(s.from) + ' – '
        + dashThaiDate(new Date(Math.min(s.to.getTime(), Date.now())));

    dashPaintSide(DASH.sel);
    dashPaintOrg(c);
    dashPaintPattern(c, DASH.pattern);
    dashCrewView(DASH.crewView || 'org');
    dashPaintCases(s);
    dashPaintSerious(s);
    dashPaintWorkload(s);
    dashPaintRanks(s);
    dashPaintDamage(s);
    dashPaintTrend(s);
    dashStartClock();
}




// ---------- แผงข้อมูลข้างเวที 3 มิติ ----------
var DASH_PLACE = {
    station: { title: 'ปฏิบัติหน้าที่วันนี้', icon: 'fa-user-shield', color: '#f59e0b' },
    parking: { title: 'ภารกิจภายนอกวันนี้', icon: 'fa-satellite-dish', color: '#10b981' },
    flat1: { title: 'อาคารที่พัก — การลาวันนี้', icon: 'fa-house-user', color: '#8b5cf6' }
};
// ภารกิจ "ภายใน" = สถานที่ระบุว่าอยู่ใน สน. (สน.ลำหิน / ห้องประชุม / ชั้น x ของ สน. ฯลฯ)
// ไม่ได้ระบุสถานที่ หรือระบุที่อื่น = ภายนอกทั้งหมด
// 1) มีคำว่า "ลำหิน" (สน.ลำหิน / ศปก.ลำหิน / ห้องธุรการ สน.ลำหิน ...) = ภายใน
// 2) ระบุแค่ห้อง/ชั้นล้วน ๆ ไม่มีชื่อที่อื่นปน (เช่น "ห้องประชุมชั้น 3") = ภายใน
// 3) นอกนั้น รวมถึงไม่ได้ระบุสถานที่ = ภายนอก
var DASH_HOME_RE = /ลำหิน/;
var DASH_ROOM_WORDS_RE = /ห้องประชุม|ห้องสอบสวน|ห้องธุรการคดี|ห้องธุรการ|ห้องพนักงานสอบสวน|ห้องเก็บของกลาง|ชั้น\s*[0-9๐-๙]+|สน\.?|ที่ทำการ|[0-9๐-๙\s.,()-]/g;
function dashMissionInside(m) {
    var p = String((m && m.place) || '').trim();
    if (!p) return false;
    if (DASH_HOME_RE.test(p)) return true;
    // ตัดคำบอกห้อง/ชั้นออกหมดแล้วไม่เหลืออะไร = ระบุห้องใน สน. เอง
    return /ห้อง|ชั้น/.test(p) && p.replace(DASH_ROOM_WORDS_RE, '') === '';
}

// อาคารที่ไม่มีป้ายของตัวเอง ให้เปิดแผงของอาคารใกล้เคียง
var DASH_PLACE_ALIAS = { gate: 'station', flat2: 'flat1' };

function dashPersonChip(name, tag, color) {
    var photo = typeof _dsPhoto === 'function' ? _dsPhoto(name) : '';
    var safe = String(name).replace(/'/g, "\\'");
    return '<div class="dash-chip" style="--cc:' + (color || '#3b82f6') + '"'
        + ' onclick="if(typeof showPersonProfile===\'function\')showPersonProfile(\'' + safe + '\')"'
        + ' title="' + dashEsc(name) + '">'
        + (photo ? '<img src="' + photo + '" onerror="this.style.visibility=\'hidden\'">' : '<span class="dash-chip-av"><i class="fas fa-user"></i></span>')
        + '<span class="dash-chip-n">' + dashEsc(dashRankName(name)) + '</span>'
        + (tag ? '<span class="dash-chip-t">' + dashEsc(tag) + '</span>' : '')
        + '</div>';
}

function dashSelectPlace(key) {
    DASH.sel = key || 'station';
    dashPaintSide(DASH.sel);
}

function dashPaintSide(key) {
    var el = document.getElementById('dash-side'); if (!el) return;
    key = DASH_PLACE_ALIAS[key] || key;
    if (!DASH_PLACE[key]) key = 'station';
    var p = DASH_PLACE[key];
    var s = DASH.stats, c = DASH.crew;
    var body = '';

    if (key === 'station') {
        // คนที่อยู่ประจำ สน. วันนี้ — เห็นเป็นหน้าคน
        function grp(title, faces) {
            return faces ? '<div class="dash-side-sec">' + title + '</div><div class="dr-faces sd-faces">' + faces + '</div>' : '';
        }
        var pgs = c.full.map(function (n) { return dashDutyFace(n, '#f59e0b', '24 ชม.'); })
            .concat(c.day.map(function (n) { return dashDutyFace(n, '#f59e0b', c.dayTime); }))
            .concat(c.eve.map(function (n) { return dashDutyFace(n, '#3b82f6', c.eveTime); })).join('');
        var asst = c.asst.map(function (n) { return dashDutyFace(n, '#0ea5e9', 'ผช.พงส.'); })
            .concat(c.evi.map(function (n) { return dashDutyFace(n, '#06b6d4', 'ส่งของกลาง'); }))
            .concat(c.extra.map(function (n) { return dashDutyFace(n, '#8b5cf6', 'เวรเสริม'); })).join('');
        var seen = {}, misIn = [], misOut = [];
        c.missions.forEach(function (m) {
            var inside = dashMissionInside(m);
            m.who.forEach(function (n) {
                var k = dashPersonKey(n); if (seen[k]) return; seen[k] = 1;
                (inside ? misIn : misOut).push(dashDutyFace(n, inside ? '#8b5cf6' : '#10b981', m.time || 'ภารกิจ'));
            });
        });
        body = grp('<i class="fas fa-user-shield"></i> เวรสอบสวน', pgs)
            + grp('<i class="fas fa-user-group"></i> ผช.พงส. / ส่งของกลาง', asst)
            + grp('<i class="fas fa-building"></i> ภารกิจภายใน สน.', misIn.join(''))
            + grp('<i class="fas fa-route"></i> ภารกิจภายนอก', misOut.join(''));
        if (!body) body = '<div class="dash-none">วันนี้ไม่มีข้อมูลเวร</div>';
    } else if (key === 'parking') {
        var outs = c.missions.filter(function (m) { return !dashMissionInside(m); });
        body = outs.length ? outs.map(function (m) {
            return '<div class="dash-mis" onclick="if(typeof showMissionPopup===\'function\')showMissionPopup(' + m.rowIdx + ')">'
                + '<div class="dash-mis-t">' + (m.time ? '<b>' + dashEsc(m.time) + '</b> ' : '') + dashEsc(m.title) + '</div>'
                + (m.place ? '<div class="dash-mis-p"><i class="fas fa-location-dot"></i> ' + dashEsc(m.place) + '</div>' : '')
                + '<div class="dash-mis-w"><i class="fas fa-users"></i> ' + m.who.length + ' นาย</div>'
                + '</div>';
        }).join('') : '<div class="dash-none">วันนี้ไม่มีภารกิจภายนอก</div>';
    } else if (key === 'flat1') {
        body = c.leave.length ? '<div class="dash-chips dash-chips-col">' + c.leave.map(function (l) {
            var period = l.from ? (dashThaiDate(l.from) + (l.days > 1 ? ' – ' + dashThaiDate(l.to) : '')) : '';
            return '<div class="dash-leave">'
                + dashPersonChip(l.name, l.type, '#ef4444')
                + '<span class="dash-leave-d">' + dashEsc(period) + (l.days ? ' · ' + l.days + ' วัน' : '') + '</span>'
                + '</div>';
        }).join('') + '</div>' : '<div class="dash-none">วันนี้ไม่มีผู้ลา</div>';
    }

    el.innerHTML = '<div class="dash-side-head" style="--sc:' + p.color + '">'
        + '<i class="fas ' + p.icon + '"></i><span>' + p.title + '</span></div>'
        + '<div class="dash-side-body">' + body + '</div>';
}

function dashMiniStat(pairs) {
    return '<div class="dash-ms">' + pairs.map(function (p) {
        return '<div class="dash-ms-r"><span>' + dashEsc(p[0]) + '</span><b>' + p[1] + '</b></div>';
    }).join('') + '</div>';
}

// ---------- กราฟแท่งแนวนอน ----------
function dashBars(items, color, wide, fmt) {
    if (!items || !items.length) return '<div class="dash-none">ไม่มีข้อมูล</div>';
    var max = Math.max.apply(null, items.map(function (i) { return i.n; })) || 1;
    return '<div class="dash-bars' + (wide ? ' dash-bars-wide' : '') + '">' + items.map(function (i) {
        return '<div class="dash-bar-r">'
            + '<span class="dash-bar-l" title="' + dashEsc(i.label) + '">' + dashEsc(i.label) + '</span>'
            + '<span class="dash-bar-t"><i style="width:' + (i.n / max * 100).toFixed(1) + '%;background:' + color + '"></i></span>'
            + '<b class="dash-bar-n">' + (fmt ? fmt(i) : dashNum(i.n)) + '</b>'
            + '</div>';
    }).join('') + '</div>';
}


// เปิดโปรไฟล์จากแถวในตารางภาระงาน (อ้างด้วยลำดับ ไม่ต้องยัดชื่อลง onclick)
function dashGoPerson(idx) {
    var list = (DASH.stats && DASH.stats.byOfficer || []).filter(function (o) {
        return o.name && o.name !== 'ไม่ระบุ' && o.grand > 0;
    });
    var o = list[idx];
    if (o && typeof showPersonProfile === 'function') showPersonProfile(o.name);
}

// ---------- รูปแบบการเข้าเวรปัจจุบัน ----------
// อ่านจากตารางเวรจริง ไม่ได้ฮาร์ดโค้ดชื่อ ถ้าแก้ตารางในชีทตัวเลขจะขยับตาม
function dashDutyFace(name, color, sub) {
    var photo = typeof _dsPhoto === 'function' ? _dsPhoto(name) : '';
    var safe = String(name).replace(/'/g, "\\'");
    return '<div class="dr-face" style="--fc:' + color + '"'
        + ' onclick="if(typeof showPersonProfile===\'function\')showPersonProfile(\'' + safe + '\')"'
        + ' title="' + dashEsc(name) + '">'
        + (photo ? '<img src="' + photo + '" onerror="this.style.visibility=\'hidden\'">'
            : '<span class="dr-face-x"><i class="fas fa-user"></i></span>')
        + '<div class="dr-face-n">' + dashEsc(dashRankName(name)) + '</div>'
        + (sub ? '<div class="dr-face-d">' + dashEsc(sub) + '</div>' : '')
        + '</div>';
}

function dashPaintPattern(c, p) {
    var el = document.getElementById('dash-pattern'); if (!el) return;
    if (!p || !p.active) { el.innerHTML = '<div class="dash-none">ไม่มีข้อมูลตารางเวร</div>'; return; }

    // พงส.เวร ที่ไม่ได้อยู่ในรอบหมุนเวียนช่วงนี้
    var pgsTier = (c.tiers || []).filter(function (t) { return t.key === 'pgs'; })[0];
    var inRota = {};
    if (p.dayPerson) inRota[dashPersonKey(p.dayPerson)] = 1;
    p.rotation.forEach(function (r) { inRota[dashPersonKey(r.name)] = 1; });
    p.weekendPeople.forEach(function (w) { inRota[dashPersonKey(w.name)] = 1; });
    var offRota = pgsTier ? pgsTier.people.filter(function (x) { return !inRota[dashPersonKey(x.name)]; }) : [];

    var dd = p.dayDows || [];
    var dowRange = dd.length ? (DASH_DOW_SHORT[dd[0]] + '–' + DASH_DOW_SHORT[dd[dd.length - 1]]) : '';
    function nx(r) { return r.next ? dashThaiDate(r.next) : '–'; }
    function row(color, icon, label, faces, right) {
        return '<div class="dr-row" style="--rc:' + color + '">'
            + '<div class="dr-lab"><i class="fas ' + icon + '"></i><span>' + label + '</span></div>'
            + '<div class="dr-faces">' + faces + '</div>'
            + '<div class="dr-num">' + right + '</div>'
            + '</div>';
    }
    function big(n, unit) { return '<b>' + n + '</b><small>' + unit + '</small>'; }
    function chip(t) { return '<span class="dr-chip">' + t + '</span>'; }

    var html = '<div class="dr-rows">';
    if (p.dayPerson) {
        html += row('#f59e0b', 'fa-sun', 'คู่เวรกลางวัน',
            dashDutyFace(p.dayPerson, '#f59e0b', ''),
            big('1', 'นาย') + chip('08:01–18:00') + chip(dowRange));
    }
    html += row('#3b82f6', 'fa-moon', 'พงส. 24 ชม.',
        p.rotation.map(function (r) { return dashDutyFace(r.name, '#3b82f6', nx(r)); }).join(''),
        big(p.cycleDays, 'นาย') + chip('เข้า 1 : พัก ' + Math.max(0, p.cycleDays - 1)));
    if (p.asstCycle) {
        html += row('#0ea5e9', 'fa-user-group', 'ผช.พงส. 24 ชม.',
            p.asstRotation.map(function (r) { return dashDutyFace(r.name, '#0ea5e9', nx(r)); }).join(''),
            big(p.asstCycle, 'นาย') + chip('เข้า 1 : พัก ' + Math.max(0, p.asstCycle - 1)));
    }
    html += '</div>';

    html += '<div class="dr-foot">'
        + chip('<i class="fas fa-calendar-week"></i> ส–อา พงส. 1 นาย 24 ชม.')
        + (offRota.length ? '<span class="dr-chip dr-off"><i class="fas fa-circle-minus"></i> นอกรอบ: '
            + offRota.map(function (x) { return dashEsc(dashRankName(x.name)); }).join(', ') + '</span>' : '')
        + '</div>';
    el.innerHTML = html;
}

// ---------- สวิตช์สลับ ผังบังคับบัญชา / รูปแบบเวร ----------
function dashCrewView(v) {
    DASH.crewView = (v === 'duty') ? 'duty' : 'org';
    var a = document.getElementById('dash-org-pane'), b = document.getElementById('dash-pattern');
    if (a) a.hidden = DASH.crewView !== 'org';
    if (b) b.hidden = DASH.crewView !== 'duty';
    var card = document.getElementById('dash-org');
    if (card && card.querySelectorAll) {
        [].forEach.call(card.querySelectorAll('.crew-sw button'), function (x) {
            x.classList[x.getAttribute('data-v') === DASH.crewView ? 'add' : 'remove']('on');
        });
    }
}

// ---------- สายการบังคับบัญชา ----------
var DASH_ORG_STATUS = {
    duty: { label: 'เข้าเวร', color: '#f59e0b' },
    mission: { label: 'ภารกิจ', color: '#10b981' },
    leave: { label: 'ลา', color: '#ef4444' },
    free: { label: 'พร้อมปฏิบัติ', color: '#64748b' }
};

function dashOrgCard(p, big) {
    var st = DASH_ORG_STATUS[p.status] || DASH_ORG_STATUS.free;
    var photo = typeof _dsPhoto === 'function' ? _dsPhoto(p.name) : '';
    var safe = String(p.name).replace(/'/g, "\\'");
    return '<div class="org-p' + (big ? ' org-p-big' : '') + '" style="--sc:' + st.color + '"'
        + ' onclick="if(typeof showPersonProfile===\'function\')showPersonProfile(\'' + safe + '\')"'
        + ' title="' + dashEsc(p.name) + ' · ' + dashEsc(p.position) + ' · ' + st.label + '">'
        + '<div class="org-av">'
        + (photo ? '<img src="' + photo + '" onerror="this.style.visibility=\'hidden\'">'
            : '<span class="org-av-x"><i class="fas fa-user"></i></span>')
        + '<i class="org-dot"></i></div>'
        + '<div class="org-p-n">' + dashEsc(dashRankName(p.name)) + '</div>'
        + '<div class="org-p-r">' + dashEsc(p.position || '-') + '</div>'
        + '<div class="org-p-s">' + st.label + '</div>'
        + '</div>';
}

function dashPaintOrg(c) {
    var el = document.getElementById('dash-org-pane'); if (!el) return;
    var tiers = (c.tiers || []).filter(function (t) { return t.people.length; });
    if (!tiers.length) { el.innerHTML = ''; return; }

    // นับสถานะวันนี้จากคนในผังโดยตรง (ตัวเลขชุดเดียวทั้งหน้า)
    var cnt = { duty: 0, mission: 0, leave: 0, free: 0 };
    tiers.forEach(function (t) { t.people.forEach(function (p) { cnt[p.status in cnt ? p.status : 'free']++; }); });
    var legend = Object.keys(DASH_ORG_STATUS).map(function (k) {
        return '<span><i style="background:' + DASH_ORG_STATUS[k].color + '"></i>'
            + DASH_ORG_STATUS[k].label + ' <b>' + cnt[k] + '</b></span>';
    }).join('');

    var chief = (tiers[0].key === 'lead') ? tiers[0] : null;
    var rest = chief ? tiers.slice(1) : tiers;

    var html = '<div class="dash-legend org-legend">' + legend + '</div>'
        + '<div class="org">';

    if (chief) {
        html += '<div class="org-chief" style="--tc:' + chief.color + '">'
            + '<div class="org-chief-tag">' + dashEsc(chief.title) + '</div>'
            + '<div class="org-row org-row-c">' + chief.people.map(function (p) { return dashOrgCard(p, true); }).join('') + '</div>'
            + '</div>';
    }
    rest.forEach(function (t, i) {
        html += '<div class="org-link"><span></span></div>'
            + '<div class="org-tier" style="--tc:' + t.color + '">'
            + '  <div class="org-tier-h">'
            + '    <span class="org-tier-n">' + (i + 1) + '</span>'
            + '    <span class="org-tier-t">' + dashEsc(t.title) + '</span>'
            + '    <b class="org-tier-c">' + t.people.length + ' นาย</b>'
            + '  </div>'
            + '  <div class="org-row org-row-c">' + t.people.map(function (p) { return dashOrgCard(p, false); }).join('') + '</div>'
            + '</div>';
    });
    el.innerHTML = html + '</div>';
}

// ---------- ภาระงานพนักงานสอบสวน: จัดอันดับจำนวนคดีที่รับ ----------
function dashPaintWorkload(s) {
    var el = document.getElementById('dash-workload'); if (!el) return;
    var list = (s.byOfficer || []).filter(function (o) {
        return o.name && o.name !== 'ไม่ระบุ' && o.grand > 0;
    });
    if (!list.length) { el.innerHTML = ''; return; }
    var max = list[0].grand || 1;
    var short = function (n) { return dashRankName(n); };
    // คนที่ไม่อยู่ในชีตกำลังพลแล้ว = ย้ายออกไปแล้ว (ยังนับคดีที่เคยรับไว้ตามจริง)
    var current = {};
    ((typeof DB !== 'undefined' && DB.personnel) || []).slice(1).forEach(function (r) {
        if (r && r[1]) current[dashPersonKey(r[1])] = true;
    });
    var hasRoster = Object.keys(current).length > 0;
    var moved = function (n) { return hasRoster && !current[dashPersonKey(n)]; };

    var rows = list.map(function (o, i) {
        var rank = i + 1;
        return '<tr class="' + (rank <= 3 ? 'top' : '') + '"'
            + ' onclick="dashGoPerson(' + i + ')" title="' + dashEsc(o.name) + '">'
            + '<td class="wl-rank">' + rank + '</td>'
            + '<td class="wl-name">' + dashEsc(short(o.name))
            + (moved(o.name) ? ' <span class="wl-moved">ย้ายแล้ว</span>' : '') + '</td>'
            + '<td class="wl-bar"><i style="width:' + (o.grand / max * 100).toFixed(1) + '%"></i></td>'
            + '<td class="wl-n">' + dashNum(o.grand) + '</td>'
            + '<td class="wl-s">' + dashNum(o.criminal) + '</td>'
            + '<td class="wl-s">' + dashNum(o.traffic) + '</td>'
            + '<td class="wl-s">' + dashNum(o.online) + '</td>'
            // คดีค้าง (อาญา+จราจรที่ยังสอบสวน) และค้างเกิน 3 เดือน — ผบ.ดูได้ทันทีว่าใครค้างมาก
            + '<td class="wl-o' + (o.open ? '' : ' z') + '">' + dashNum(o.open) + '</td>'
            + '<td class="wl-o wl-over' + (o.over3 ? '' : ' z') + '">' + dashNum(o.over3) + '</td>'
            + '<td class="wl-r">' + o.perMonth.toFixed(1) + '</td>'
            + '<td class="wl-r">' + o.perDay.toFixed(2) + '</td>'
            + '<td class="wl-d">' + (o.daysPerCase ? o.daysPerCase.toFixed(1) : '-') + '</td>'
            + '</tr>';
    }).join('');

    el.innerHTML = '<div class="dash-card-h"><i class="fas fa-list-ol"></i> ภาระงานพนักงานสอบสวน — จัดอันดับจำนวนคดีที่รับ'
        + '<span class="dash-card-sub">นับมาแล้ว ' + dashNum(s.days) + ' วัน</span></div>'
        + '<div class="dash-wl-sum">'
        + '  <span>ทั้งหน่วยรับแจ้งเฉลี่ย <b>' + s.unitPerDay.toFixed(2) + '</b> คดี/วัน</span>'
        + '  <span>เฉลี่ยต่อ พงส. <b>' + Math.round(s.avgPerOfficer) + '</b> คดี/คน</span>'
        + '</div>'
        + '<div class="dash-wl-wrap"><table class="dash-wl">'
        + '<thead><tr><th>#</th><th>พนักงานสอบสวน</th><th></th><th>รวม</th>'
        + '<th>อาญา</th><th>จร.</th><th>ออนไลน์</th><th>ค้าง</th><th>เกิน 3 ด.</th><th>คดี/เดือน</th><th>คดี/วัน</th><th>1 คดีทุก (วัน)</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}


function dashPaintCases(s) {
    var el = document.getElementById('dash-cases'); if (!el) return;
    var all = s.total + s.online;
    var over = s.age3 + s.age6 + s.age1y;
    function col(title, icon, color, total, open, extra) {
        return '<div class="dash-ccol" style="--cc:' + color + '">'
            + '<div class="dash-ccol-h"><i class="fas ' + icon + '"></i> ' + title + '</div>'
            + '<div class="dash-ccol-v">' + dashNum(total) + '<small>คดี</small></div>'
            + (open != null
                ? '<div class="dash-ccol-b"><i style="width:' + (total ? (open / total * 100).toFixed(1) : 0) + '%"></i></div>'
                  + '<div class="dash-ccol-l">ระหว่างสอบสวน <b>' + dashNum(open) + '</b> · เสร็จสิ้น <b>' + dashNum(total - open) + '</b></div>'
                : '')
            + '<div class="dash-ccol-x">' + extra + '</div>'
            + '</div>';
    }
    el.innerHTML = '<div class="dash-card-h"><i class="fas fa-scale-balanced"></i> สถานภาพคดี</div>'
        + '<div class="dash-total"><span>รับแจ้งทั้งหมด</span><b>' + dashNum(all) + '</b><small>คดี</small></div>'
        + '<div class="dash-ccols">'
        + col('คดีอาญา', 'fa-gavel', '#f59e0b', s.criminal, s.openCriminal,
            'ค้างเกิน 3 เดือนขึ้นไป <b>' + dashNum(s.overCriminal) + '</b> คดี')
        + col('คดีจราจร', 'fa-car-burst', '#06b6d4', s.traffic, s.openTraffic,
            'ค้างเกิน 3 เดือนขึ้นไป <b>' + dashNum(s.overTraffic) + '</b> คดี')
        + col('คดีออนไลน์', 'fa-globe', '#ec4899', s.online, null,
            'คิดเป็น <b>' + (all ? Math.round(s.online / all * 100) : 0) + '%</b> ของคดีที่รับแจ้งทั้งหมด')
        + '</div>'
        + '<div class="dash-agewrap">'
        + '  <div class="dash-age-h">อายุคดีที่ยังอยู่ระหว่างสอบสวน</div>'
        + '  <div class="dash-ages">'
        + dashAgeBox('ยังไม่เกิน 3 เดือน', s.open - over, '#10b981')
        + dashAgeBox('เกิน 3 เดือน', s.age3, '#f59e0b')
        + dashAgeBox('เกิน 6 เดือน', s.age6, '#f97316')
        + dashAgeBox('เกิน 1 ปี', s.age1y, '#ef4444')
        + '  </div>'
        + '</div>';
}
function dashAgeBox(label, n, color) {
    return '<div class="dash-age" style="--ac:' + color + '"><b>' + dashNum(n) + '</b><span>' + label + '</span></div>';
}

// ---------- คดีอุกฉกรรจ์และสะเทือนขวัญ ----------
function dashPaintSerious(s) {
    var el = document.getElementById('dash-serious'); if (!el) return;
    var prev = DASH.prevSerious || 0;
    var diff = s.serious - prev;
    var trend = diff === 0
        ? '<span class="dash-trend-flat">เท่าปีก่อน</span>'
        : (diff < 0 ? '<span class="dash-trend-down"><i class="fas fa-arrow-down"></i> ลดลง ' + dashNum(-diff) + ' คดี</span>'
            : '<span class="dash-trend-up"><i class="fas fa-arrow-up"></i> เพิ่มขึ้น ' + dashNum(diff) + ' คดี</span>');

    el.innerHTML = '<div class="dash-card-h"><i class="fas fa-triangle-exclamation"></i> คดีอุกฉกรรจ์และสะเทือนขวัญ</div>'
        + '<div class="dash-serious">'
        + '  <div class="dash-serious-big' + (s.serious ? ' has' : '') + '">'
        + '    <b>' + dashNum(s.serious) + '</b><span>คดี</span>'
        + '    <div class="dash-serious-cmp">ปีงบ ' + (s.fy - 1) + ' มี ' + dashNum(prev) + ' คดี · ' + trend + '</div>'
        + '  </div>'
        + '  <div class="dash-serious-list">'
        + s.seriousItems.map(function (it) {
            return '<div class="dash-serious-i' + (it.n ? ' on' : '') + '">'
                + '<b>' + dashNum(it.n) + '</b><span>' + dashEsc(it.label) + '</span></div>';
        }).join('')
        + '  </div>'
        + '</div>';
}

// ---------- กราฟจัดอันดับ ----------
function dashPaintRanks(s) {
    // ยอดรวมแต่ละประเภทอยู่ในการ์ดสถานภาพคดีแล้ว หัวกราฟจึงไม่บอกซ้ำ
    var a = document.getElementById('dash-rank-crime');
    if (a) {
        a.innerHTML = '<div class="dash-card-h"><i class="fas fa-ranking-star"></i> ประเภทคดีอาญาที่รับแจ้งมากที่สุด</div>'
            + dashBars(s.rankCriminal, '#f59e0b')
            + (s.rankTraffic.length ? '<div class="dash-sub-h">คดีจราจร</div>' + dashBars(s.rankTraffic, '#06b6d4') : '');
    }
    var b = document.getElementById('dash-rank-online');
    if (b) {
        b.innerHTML = '<div class="dash-card-h"><i class="fas fa-ranking-star"></i> ประเภทคดีออนไลน์ที่รับแจ้งมากที่สุด</div>'
            + dashBars(s.rankOnline, '#ec4899', true);
    }
}

// ---------- คดีออนไลน์: มูลค่าความเสียหายสูงสุด ----------
function dashPaintDamage(s) {
    var el = document.getElementById('dash-damage'); if (!el) return;
    var items = s.rankOnlineDamage || [];
    el.innerHTML = '<div class="dash-card-h"><i class="fas fa-sack-dollar"></i> คดีออนไลน์ — มูลค่าความเสียหายแยกตามประเภท'
        + '<span class="dash-card-sub">รวม ' + dashNum(Math.round(s.damage)) + ' บาท</span></div>'
        + dashBars(items.map(function (i) {
            return { label: i.label + ' (' + i.cases + ' คดี)', n: i.n };
        }), '#f43f5e', true, function (i) { return dashNum(i.n); })
        + '<div class="dash-dmg-note">ตัวเลขท้ายแถบคือมูลค่าความเสียหาย (บาท) · ตัวเลขในวงเล็บคือจำนวนคดี</div>';
}

// ---------- กราฟรายเดือน ----------
function dashPaintTrend(s) {
    var el = document.getElementById('dash-trend'); if (!el) return;
    var W = 760, H = 190, PL = 34, PR = 12, PT = 16, PB = 30;
    var NM = Math.max(2, s.byMonth.length);
    var max = 1;
    s.byMonth.forEach(function (m) { max = Math.max(max, m.crime, m.online); });
    max = Math.ceil(max / 5) * 5;
    var iw = W - PL - PR, ih = H - PT - PB;
    function X(i) { return PL + iw * (i / (NM - 1)); }
    function Y(v) { return PT + ih - ih * (v / max); }
    function path(key) {
        return s.byMonth.map(function (m, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(m[key]).toFixed(1); }).join(' ');
    }
    function area(key) {
        return path(key) + ' L' + X(NM - 1).toFixed(1) + ' ' + Y(0) + ' L' + X(0).toFixed(1) + ' ' + Y(0) + ' Z';
    }
    var grid = '';
    for (var g = 0; g <= 4; g++) {
        var y = PT + ih * (g / 4);
        grid += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" stroke="#e6ebf3"/>'
            + '<text x="' + (PL - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="#94a3b8">'
            + Math.round(max - max * g / 4) + '</text>';
    }
    var labels = s.byMonth.map(function (m, i) {
        var lab = m.label || DASH_FY_MON[i] || '';
        // ช่วงยาวหลายปี ใส่ปีกำกับที่เดือน ม.ค. และช่องแรก
        var showYear = (s.byMonth.length > 12) && (i === 0 || m.label === 'ม.ค.');
        return '<text x="' + X(i).toFixed(1) + '" y="' + (H - 16) + '" text-anchor="middle" font-size="10" font-weight="600" fill="#475569">'
            + lab + '</text>'
            + (showYear ? '<text x="' + X(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="8.5" fill="#94a3b8">'
                + m.year + '</text>' : '');
    }).join('');
    var dots = s.byMonth.map(function (m, i) {
        var lab = (m.label || DASH_FY_MON[i] || '') + (m.year != null ? ' ' + m.year : '');
        return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(m.crime).toFixed(1) + '" r="4" fill="#fff" stroke="#f59e0b" stroke-width="2.2"><title>'
            + lab + ' อาญา/จราจร ' + m.crime + ' คดี</title></circle>'
            + '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(m.online).toFixed(1) + '" r="4" fill="#fff" stroke="#ec4899" stroke-width="2.2"><title>'
            + lab + ' ออนไลน์ ' + m.online + ' คดี</title></circle>';
    }).join('');

    el.innerHTML = '<div class="dash-card-h"><i class="fas fa-chart-line"></i> คดีรับใหม่รายเดือน'
        + '</div>'
        + '<div class="dash-legend"><span><i style="background:#f59e0b"></i>อาญา/จราจร</span>'
        + '<span><i style="background:#ec4899"></i>ออนไลน์</span></div>'
        + '<div class="dash-trend"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">'
        + '<defs><linearGradient id="dgA" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0" stop-color="rgba(245,158,11,0.28)"/><stop offset="1" stop-color="rgba(245,158,11,0)"/></linearGradient>'
        + '<linearGradient id="dgB" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0" stop-color="rgba(236,72,153,0.22)"/><stop offset="1" stop-color="rgba(236,72,153,0)"/></linearGradient></defs>'
        + grid
        + '<path d="' + area('crime') + '" fill="url(#dgA)"/>'
        + '<path d="' + area('online') + '" fill="url(#dgB)"/>'
        + '<path d="' + path('crime') + '" fill="none" stroke="#f59e0b" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>'
        + '<path d="' + path('online') + '" fill="none" stroke="#ec4899" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>'
        + dots + labels
        + '</svg></div>';
}

// ---------- นาฬิกา ----------
var dashClockTimer = 0;
function dashStartClock() {
    if (dashClockTimer) clearInterval(dashClockTimer);
    function tick() {
        var el = document.getElementById('dash-clock');
        if (!el) { clearInterval(dashClockTimer); dashClockTimer = 0; return; }
        var d = new Date();
        el.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
            + ':' + ('0' + d.getSeconds()).slice(-2) + ' น.';
    }
    tick();
    dashClockTimer = setInterval(tick, 1000);
}

// ==========================================================
// ฉาก 3 มิติ — โหลด Three.js แบบ lazy เฉพาะตอนเปิดแท็บนี้
// ==========================================================
function dashLabelDefs() {
    // ป้ายบนแผนที่เป็น "ชื่อสถานที่" ไม่มีตัวเลข — ตัวเลขทุกตัวอยู่ในการ์ดด้านล่างแล้ว
    return [
        { anchor: 'station', color: '#f59e0b', icon: 'fas fa-building-shield', val: '', unit: 'อาคารที่ทำการ' },
        { anchor: 'parking', color: '#10b981', icon: 'fas fa-satellite-dish', val: '', unit: 'ภารกิจภายนอก' },
        { anchor: 'flat1', color: '#8b5cf6', icon: 'fas fa-house-user', val: '', unit: 'อาคารที่พัก' }
    ];
}

function dashBoot3D() {
    var stage = document.getElementById('dash-stage'); if (!stage) return;
    if (window.THREE) { dashInit3D(); return; }
    if (DASH.threeLoading) return;
    DASH.threeLoading = true;
    var sc = document.createElement('script');
    sc.src = DASH_THREE_URL;
    sc.onload = function () { DASH.threeLoading = false; dashInit3D(); };
    sc.onerror = function () {
        DASH.threeLoading = false;
        var l = document.getElementById('dash3d-loading');
        if (l) l.innerHTML = '<i class="fas fa-triangle-exclamation"></i> เปิดแบบจำลอง 3 มิติไม่ได้ (เครือข่ายเข้าไม่ถึง CDN)';
    };
    document.head.appendChild(sc);
}

function dashInit3D() {
    var stage = document.getElementById('dash-stage'); if (!stage) return;
    try {
        if (LamhinScene.isReady()) LamhinScene.dispose();
        var ok = LamhinScene.init(stage, dashLabelDefs(), function (key) { dashSelectPlace(key); });
        var l = document.getElementById('dash3d-loading');
        if (l) l.style.display = ok ? 'none' : 'flex';
        if (ok) {
            if (!window.__dashResizeBound) {
                window.__dashResizeBound = true;
                window.addEventListener('resize', function () { LamhinScene.resize(); });
            }
        }
    } catch (e) {
        var l2 = document.getElementById('dash3d-loading');
        if (l2) l2.innerHTML = '<i class="fas fa-triangle-exclamation"></i> แสดงผล 3 มิติไม่ได้: ' + dashEsc(e.message);
    }
}

function dashUpdateLabels() {
    if (LamhinScene.isReady()) LamhinScene.setLabels(dashLabelDefs());
}
function dashZoom(dir) { if (LamhinScene.isReady()) LamhinScene.zoom(dir); }
function dashResetView() { if (LamhinScene.isReady()) LamhinScene.resetView(); }
// จำลองรถสายตรวจวิ่งเข้า สน. (กดซ้ำระหว่างวิ่ง = หยุด)
function dashDrive() {
    if (typeof LamhinScene === 'undefined' || !LamhinScene.isReady()) return;
    if (LamhinScene.isDriving()) { LamhinScene.stopDrive(); return; }
    var cover = document.getElementById('dash-cover');
    if (cover) cover.classList.add('dash-cover-min');   // ย่อหน้าปกลง ไม่บังภาพขับรถ
    LamhinScene.startDrive(function () { if (cover) cover.classList.remove('dash-cover-min'); });
}

// ==========================================================
// โหมดนำเสนอแบบสไลด์
// ==========================================================
var DASH_SLIDES = [
    { title: 'สถานีตำรวจนครบาลลำหิน', els: ['dash-stagewrap'], is3d: true, cover: true },
    { title: 'สายการบังคับบัญชา — งานสอบสวน', els: ['dash-org'], view: 'org' },
    { title: 'รูปแบบการเข้าเวรปัจจุบัน', els: ['dash-org'], view: 'duty' },
    { title: 'สถานภาพคดี', els: ['dash-cases'] },
    { title: 'คดีอุกฉกรรจ์และสะเทือนขวัญ', els: ['dash-serious'] },
    { title: 'ภาระงานพนักงานสอบสวน', els: ['dash-workload'] },
    { title: 'ประเภทคดีที่รับแจ้งมากที่สุด', els: ['dash-ranks'] },
    { title: 'คดีออนไลน์ — มูลค่าความเสียหาย', els: ['dash-damage'] },
    { title: 'คดีรับใหม่รายเดือน', els: ['dash-trend'] }
];
var dashPres = { on: false, i: 0 };

function dashPresent() {
    var root = document.getElementById('dash-root'); if (!root) return;
    dashPres.on = true; dashPres.i = 0;
    root.classList.add('present');
    document.documentElement.classList.add('dash-presenting');
    // ลองเต็มจอจริง (ถ้าเบราว์เซอร์/กรอบแอปไม่อนุญาต ก็ยังเต็มหน้าต่างด้วย CSS อยู่ดี)
    try { if (root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(function () { }); } catch (e) { }
    var dots = document.getElementById('dash-pres-dots');
    if (dots) dots.innerHTML = DASH_SLIDES.map(function (sl, k) {
        return '<button onclick="dashPresentTo(' + k + ')" title="' + dashEsc(sl.title) + '"></button>';
    }).join('');
    if (!window.__dashPresKeys) {
        window.__dashPresKeys = true;
        document.addEventListener('keydown', function (e) {
            if (!dashPres.on) return;
            var k = e.key;
            if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); dashPresentGo(1); }
            else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); dashPresentGo(-1); }
            else if (k === 'Home') { e.preventDefault(); dashPresentTo(0); }
            else if (k === 'End') { e.preventDefault(); dashPresentTo(DASH_SLIDES.length - 1); }
            else if (k === 'Escape') { dashPresentExit(); }
        });
        document.addEventListener('fullscreenchange', function () {
            // ผู้ใช้กด Esc ออกจากเต็มจอ = ออกจากโหมดนำเสนอด้วย
            if (dashPres.on && !document.fullscreenElement && dashPres.wasFull) dashPresentExit();
            dashPres.wasFull = !!document.fullscreenElement;
        });
    }
    dashPresentTo(0);
}

function dashPresentGo(d) { dashPresentTo(dashPres.i + d); }

function dashPresentTo(i) {
    if (!dashPres.on) return;
    i = Math.max(0, Math.min(DASH_SLIDES.length - 1, i));
    dashPres.i = i;
    var sl = DASH_SLIDES[i];
    var root = document.getElementById('dash-root'); if (!root) return;
    [].forEach.call(root.querySelectorAll('.dash-slide-on'), function (el) { el.classList.remove('dash-slide-on'); });
    sl.els.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.classList.remove('dash-slide-on'); void el.offsetWidth; el.classList.add('dash-slide-on'); }
    });
    if (sl.view) dashCrewView(sl.view);
    var t = document.getElementById('dash-pres-title'); if (t) t.textContent = sl.title;
    var c = document.getElementById('dash-pres-count'); if (c) c.textContent = (i + 1) + ' / ' + DASH_SLIDES.length;
    var p = document.getElementById('dash-pres-prog'); if (p) p.style.width = ((i + 1) / DASH_SLIDES.length * 100) + '%';
    var dots = document.getElementById('dash-pres-dots');
    if (dots) [].forEach.call(dots.children, function (b, k) { b.classList[k === i ? 'add' : 'remove']('on'); });
    root.scrollTop = 0;
    // หน้าปก: ชื่อรายงานซ้อนบนแผนที่ + หมุนรอบ สน. แบบภาพยนตร์ 1 รอบ
    var cover = document.getElementById('dash-cover');
    if (cover) {
        cover.hidden = !sl.cover;
        cover.classList.remove('dash-cover-min');
        var cd = document.getElementById('dash-cover-date');
        if (cd) cd.textContent = 'ข้อมูล ณ วันที่ ' + dashThaiDate(new Date());
    }
    // แผนที่ 3 มิติวาดเฉพาะตอนอยู่สไลด์ที่มีแผนที่ ประหยัดเครื่อง
    if (typeof LamhinScene !== 'undefined' && LamhinScene.isReady()) {
        if (!sl.is3d && LamhinScene.isDriving()) LamhinScene.stopDrive();
        LamhinScene.setVisible(!!sl.is3d);
        if (sl.is3d) setTimeout(function () {
            LamhinScene.resize();
            if (sl.cover) { LamhinScene.setAutoRotate(false); LamhinScene.spin(18000); }
        }, 60);
    }
}

function dashPresentExit() {
    var root = document.getElementById('dash-root');
    dashPres.on = false;
    if (root) {
        root.classList.remove('present');
        [].forEach.call(root.querySelectorAll('.dash-slide-on'), function (el) { el.classList.remove('dash-slide-on'); });
    }
    document.documentElement.classList.remove('dash-presenting');
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) { }
    var cover = document.getElementById('dash-cover'); if (cover) cover.hidden = true;
    if (typeof LamhinScene !== 'undefined' && LamhinScene.isReady()) {
        if (LamhinScene.isDriving()) LamhinScene.stopDrive();
        LamhinScene.setAutoRotate(true);
        LamhinScene.setVisible(true);
        setTimeout(function () { LamhinScene.resize(); }, 60);
    }
}

function dashFullscreen() {
    var el = document.getElementById('dash-root');
    if (!el) return;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (el.requestFullscreen) el.requestFullscreen();
    setTimeout(function () { if (LamhinScene.isReady()) LamhinScene.resize(); }, 350);
}
