// สร้างอัตโนมัติจาก _dev/stationapp.js — อย่าแก้ที่นี่
// ==========================================================
// เมนู "เวรทุกสายงาน" ในเว็บแอป: ดูรายวัน/ทั้งเดือน · เพิ่ม/แก้ไขเวรรายวัน
// · นำเข้าจากรูป/PDF/Excel ด้วย AI · ทะเบียนเจ้าหน้าที่ · Export PDF
// มุมมองตารางใช้ stationview.js (ชุดเดียวกับกระดาน GitHub)
// ฝ่ายสอบสวนดึงจากตารางเวรงานสอบสวนเดิมอัตโนมัติ แก้ที่นี่ไม่ได้
// ==========================================================
var SVA = { data: null, range: '', date: null, view: 'day', sec: '', mode: '', ed: null, imp: null, busy: false };

function svaToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function svaKeyName(n) {
    return (typeof dashPersonKey === 'function') ? dashPersonKey(n) : String(n || '').replace(/[\s.]/g, '');
}
// ---------- ตัวเลือกชื่อเฉพาะหน้าที่ ----------
// เรียนรู้จากคนที่เคยเข้าเวรหน้าที่นั้น (ใบเวรรายวัน + ตารางเวรแต่ละงาน) → ต่อด้วยคนตำแหน่งเดียวกันในทะเบียน
// ยังไม่มีประวัติ = เดาจากตำแหน่ง (สวป. / ผกก. / สังกัดงาน ป. จร. สส.)
var SVA_SEC_UNIT = { 'ฝ่ายป้องกันปราบปราม': 'ป.', 'ฝ่ายจราจร': 'จร.', 'ฝ่ายสืบสวน': 'สส.' };
function svaRoleCands(sec, time, role) {
    if (SVA._candOf !== SVA.data) { SVA._candOf = SVA.data; SVA._cand = {}; }
    var key = sec + '|' + (time || '') + '|' + role;
    if (SVA._cand[key]) return SVA._cand[key];
    var staff = (SVA.data && SVA.data.staff) || [], cnt = {};
    var add = function (name, w) {
        var st = svaFindStaff(name), n = st ? st.name : String(name || '').trim();
        if (n) cnt[n] = (cnt[n] || 0) + w;
    };
    ((SVA.data && SVA.data.hist) || {})[key] && SVA.data.hist[key].forEach(function (x) { add(x[0], x[1]); });
    (SVA.data && SVA.data.rows || []).forEach(function (r) {
        if (r[1] === sec && (r[2] || '') === (time || '') && r[3] === role && !/^ชื่อประจำ/.test(r[8] || '')) add(r[4], 0);
    });
    var seen = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    var pos = {};
    seen.forEach(function (n) { var st = svaFindStaff(n); if (st && st.pos) pos[st.pos] = 1; });
    var guess = /สวป/.test(role) ? /สวป/ : (sec === 'ผู้บังคับบัญชา' ? /ผกก/ : (SVA_SEC_UNIT[sec] ? new RegExp('\\(' + SVA_SEC_UNIT[sec].replace('.', '\\.') + '\\)') : null));
    var more = staff.filter(function (s) {
        return seen.indexOf(s.name) < 0 && (pos[s.pos] || (guess && guess.test(s.pos || '')));
    });
    var list = seen.map(function (n) {
        var st = svaFindStaff(n); return { name: n, pos: st ? st.pos : 'ไม่มีในทะเบียน', n: cnt[n] };
    }).concat(more.map(function (s) { return { name: s.name, pos: s.pos, n: 0 }; }));
    return (SVA._cand[key] = list);
}
/** datalist ของหน้าที่นั้น (สร้างครั้งเดียวต่อชุดข้อมูล) → คืน id สำหรับ <input list=""> · ไม่มีตัวเลือก = ใช้รายชื่อทั้งทะเบียน */
function svaDl(sec, time, role) {
    var list = svaRoleCands(sec, time, role);
    if (!list.length) return 'sva-staff';
    SVA._dlIds = SVA._dlOf === SVA.data ? SVA._dlIds : {};
    SVA._dlOf = SVA.data;
    var key = sec + '|' + (time || '') + '|' + role, id = SVA._dlIds[key];
    if (id && document.getElementById(id)) return id;
    id = SVA._dlIds[key] = 'sva-dl-' + Object.keys(SVA._dlIds).length + '-' + Date.now().toString(36);
    var dl = document.createElement('datalist');
    dl.id = id;
    dl.innerHTML = list.map(function (x) {
        return '<option value="' + svEsc(x.name) + '">' + svEsc(x.pos + (x.n ? ' · เคยเข้าเวรนี้ ' + x.n + ' ครั้ง' : '')) + '</option>';
    }).join('');
    document.body.appendChild(dl);
    return id;
}

function svaFindStaff(name) {
    var k = svaKeyName(name); if (k.length < 2 || !SVA.data) return null;
    var st = SVA.data.staff || [];
    var hit = st.filter(function (s) { return svaKeyName(s.name) === k; })[0];
    if (hit) return hit;
    var part = st.filter(function (s) { var sk = svaKeyName(s.name); return sk.indexOf(k) === 0 || k.indexOf(sk) === 0; });
    if (part.length === 1) return part[0];
    // ชื่อจริงตรงกันคนเดียว (นามสกุลสะกดต่างกันระหว่างชีต)
    var f = svaFirst(name);
    var byFirst = f.length >= 2 ? st.filter(function (s) { return svaFirst(s.name) === f; }) : [];
    return byFirst.length === 1 ? byFirst[0] : null;
}
/** ชื่อในทะเบียนที่ใกล้ที่สุด (ต่างกันไม่เกิน ๓ ตัวอักษร ไม่นับยศ/วรรค) — เดาชื่อที่ถูกให้ตอนแก้ชื่อที่ AI อ่านผิด */
function svaClosestStaff(name) {
    var hit = svaFindStaff(name); if (hit) return hit;
    var k = svaKeyName(name), best = null, bd = 4;
    var st = (SVA.data && SVA.data.staff) || (SVA.pl && SVA.pl.d && SVA.pl.d.staff) || [];
    st.forEach(function (s) {
        var t = svaKeyName(s.name);
        if (Math.abs(t.length - k.length) >= bd) return;
        var prev = [], cur, i, j;
        for (j = 0; j <= t.length; j++) prev[j] = j;
        for (i = 1; i <= k.length; i++) {
            cur = [i];
            for (j = 1; j <= t.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (k.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1));
            prev = cur;
        }
        if (prev[t.length] < bd) { bd = prev[t.length]; best = s; }
    });
    return best;
}
/** ถามชื่อที่ถูกต้อง (เติมชื่อในทะเบียนที่ใกล้เคียงให้) → ชื่อตามทะเบียน หรือ null ถ้ายกเลิก/ไม่เปลี่ยน */
function svaAskRename(old, where, n) {
    var sug = svaClosestStaff(old);
    var v = prompt('แก้ชื่อ "' + old + '" ทุกช่อง' + where + ' (' + n + ' ช่อง)\nพิมพ์ชื่อที่ถูกต้อง'
        + (sug && sug.name !== old ? '\n(เติมชื่อในทะเบียนที่ใกล้เคียงให้แล้ว: ' + sug.name + ')' : ''), sug ? sug.name : old);
    if (v == null) return null;
    v = v.replace(/\s+/g, ' ').trim();
    var st = svaFindStaff(v); if (st) v = st.name;
    return v && v !== old ? v : null;
}
function svaFirst(name) {
    var s = String(name || '').replace(/\s+/g, ' ').trim();
    var m = s.match(/^((?:ว่าที่\s*)?(?:[฀-๿]{1,4}\.){1,3}(?:\s*หญิง)?)\s*(.*)$/);
    return ((m ? m[2] : s).trim().split(' ')[0] || '');
}

function renderStationDuty() {
    if (!document.getElementById('sv-root')) return;
    if (!SVA.date) SVA.date = svaToday();
    SVA.jumped = '';   // เปิดเมนูใหม่ = เลื่อนมาเวรวันนี้
    svaLoad(false);
}

// เปิดเมนูนี้ได้หลายทาง (แถบเมนู / เมนู 3 ขีด / แถบข้าง) และบางทางเปิดแท็บด้วย bootstrap.Tab โดยไม่ได้คลิกปุ่ม
// onclick ของปุ่มจึงไม่ทำงาน — วาดเมื่อแท็บแสดงแล้ว (shown.bs.tab) แทน เหมือนแดชบอร์ด
(function () {
    function bind() {
        var btn = document.getElementById('tab-station');
        if (!btn || btn.__svaBound) return;
        btn.__svaBound = true;
        btn.addEventListener('shown.bs.tab', function () { document.body.classList.add('sva-on'); renderStationDuty(); });
        btn.addEventListener('hidden.bs.tab', function () { document.body.classList.remove('sva-on'); });
    }
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();

// โหลดครั้งละ 3 เดือน (เดือนก่อน–เดือนถัดไป) พอสำหรับเลื่อนดูและคัดลอกจากวันก่อน
function svaLoad(force, then) {
    var root = document.getElementById('sv-root'); if (!root) return;
    var y = SVA.date.getFullYear(), m = SVA.date.getMonth();
    var from = new Date(y, m - 1, 1), to = new Date(y, m + 2, 0);
    var key = svKey(from) + '-' + svKey(to);
    if (!force && SVA.data && SVA.range === key) { svaPaint(); return; }
    if (!SVA.data) root.innerHTML = '<div class="sva-wait"><i class="fas fa-circle-notch fa-spin"></i> กำลังโหลดตารางเวรทุกสายงาน…</div>';
    google.script.run
        .withSuccessHandler(function (d) { SVA.data = d; SVA.range = key; if (then) then(); svaPaint(); })
        .withFailureHandler(function (e) {
            root.innerHTML = '<div class="sva-wait sva-err">โหลดไม่สำเร็จ: ' + svEsc((e && e.message) || e) + '</div>';
        })
        .getStationDutyData(svDateStr(from), svDateStr(to));
}

function svaPaint() {
    var root = document.getElementById('sv-root'); if (!root || !SVA.data) return;
    svInjectCss(); svaInjectCss();
    var d = SVA.date;
    var dateVal = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var monthVal = dateVal.slice(0, 7);
    var pv = document.querySelector('#sva-view .sv-vscroll'), keepLeft = pv ? pv.scrollLeft : 0;
    var nMis = (SVA.data.rows || []).filter(function (r) { return (r[10] || r[11]) && String(r[0]).slice(3) === monthVal.slice(5, 7) + '/' + monthVal.slice(0, 4); }).length;
    root.innerHTML = '<div class="sva">'
        // หน้า GitHub มีหัวของหน้าอยู่แล้ว — ไม่ต้องซ้ำ
        + (window.SVA_REMOTE ? '' : '<div class="sva-head"><i class="fas fa-building-shield"></i><span>ตารางเวรทุกสายงาน สน.ลำหิน</span></div>')
        + '<div class="sva-bar">'
        + '  <div class="sva-seg">'
        + '    <button type="button" class="' + (SVA.view === 'day' ? 'on' : '') + '" onclick="svaSetView(\'day\')"><i class="fas fa-calendar-day"></i> วัน</button>'
        + '    <button type="button" class="' + (SVA.view === 'month' ? 'on' : '') + '" onclick="svaSetView(\'month\')"><i class="fas fa-table"></i> เดือน</button>'
        + '  </div>'
        + '  <div class="sva-nav">'
        + '    <button type="button" onclick="svaStep(-1)" title="ก่อนหน้า"><i class="fas fa-chevron-left"></i></button>'
        + (SVA.view === 'day'
            ? '<input type="date" value="' + dateVal + '" onchange="svaPick(this.value)">'
            : '<input type="month" value="' + monthVal + '" onchange="svaPick(this.value + \'-01\')">')
        + '    <button type="button" onclick="svaStep(1)" title="ถัดไป"><i class="fas fa-chevron-right"></i></button>'
        + '    <button type="button" class="sva-today" onclick="svaPick(null)"' + (svaIsNow() ? ' disabled' : '') + '>' + (SVA.view === 'month' ? 'เดือนนี้' : 'วันนี้') + '</button>'
        + '  </div>'
        + (SVA.view === 'month' ? '<div class="sva-secs">' + svSecChips(SVA.data, SVA.sec, 'svaSecSet') + '</div>' : '')
        + '  <div class="sva-act">'
        + '    <button type="button" onclick="svaEditOpen()" title="เพิ่ม/แก้ไขเวรรายวัน" aria-label="แก้ไขเวร"><i class="fas fa-pen-to-square"></i><span class="sva-tx"> แก้ไข</span></button>'
        + '    <button type="button" class="sva-plbtn' + (SVA.mode === 'plan' ? ' on' : '') + '" onclick="svaPlanOpen()" title="ตารางเวรของแต่ละงาน (ป. / จร. / สส. / ศปก. / อำนวยการ) + ไฟล์ต้นฉบับ" aria-label="ตารางเวรแต่ละงาน">'
        + '<i class="fas fa-folder-open"></i><span class="sva-tx"> ตารางงาน</span>' + (nMis ? ' <span class="sva-pl-bad" title="ตารางรายวันไม่ตรงกับตารางเวร">' + nMis + '</span>' : '') + '</button>'
        + '    <button type="button" onclick="svaImportOpen()" title="นำเข้าตารางเวรจากรูป/PDF/Excel ด้วย AI (ไม่ต้องเลือกงาน)" aria-label="นำเข้าจากไฟล์"><i class="fas fa-wand-magic-sparkles"></i><span class="sva-tx"> นำเข้า</span></button>'
        + '    <button type="button" onclick="svaStaffOpen()" title="ทะเบียนเจ้าหน้าที่" aria-label="ทะเบียน"><i class="fas fa-address-book"></i><span class="sva-tx"> ทะเบียน</span></button>'
        // เว็บแอป: ตั้งรหัสให้ธุรการใช้กรอกเวรบนหน้า GitHub · หน้า GitHub: ปุ่มออกจากโหมดแก้ไข
        + (window.SVA_REMOTE
            ? '    <button type="button" class="sva-exit" onclick="if(window.stEditClose)stEditClose()" title="ออกจากโหมดแก้ไข" aria-label="ออกจากโหมดแก้ไข"><i class="fas fa-right-from-bracket"></i><span class="sva-tx"> ออก</span></button>'
            : '    <button type="button" onclick="svaSetPin()" title="รหัสธุรการ (ใช้กรอกเวรบนหน้า GitHub)" aria-label="รหัสธุรการ"><i class="fas fa-key"></i><span class="sva-tx"> รหัส</span></button>')
        + svExportButtons("svaExport('pdf')", "svaExport('img')")
        + '  </div>'
        + '</div>'
        + '<div id="sva-panel"></div>'
        + '<div id="sva-view">' + (SVA.view === 'day'
            ? (SVA.mode === 'edit' && SVA.ed ? svaSheetHtml() : svDayHtml(SVA.data, d, { emptyHint: 'กด "แก้ไข" หรือ "นำเข้า"' }))
            : svMonthHtml(SVA.data, d.getFullYear(), d.getMonth(), SVA.sec)) + '</div>'
        + '<datalist id="sva-staff">' + (SVA.data.staff || []).map(function (s) {
            return '<option value="' + svEsc(s.name) + '">' + svEsc(s.pos) + '</option>';
        }).join('') + '</datalist>'
        + '</div>';
    // ตารางรายเดือนเลื่อนทั้งหน้า หัวตารางตรึงกับขอบบน · ไม่เลื่อนไปวันนี้เอง (แถววันนี้กระพริบให้เห็นแทน)
    // วาดซ้ำเพราะบันทึก/เปิดแผงแก้ไข = คงตำแหน่งเดิม
    if (SVA.view === 'month') {
        var jk = monthVal + '|' + SVA.sec, view = document.getElementById('sva-view');
        svFloatHeads(view);
        if (SVA.jumped !== jk) SVA.jumped = jk;
        else { var nb = view.querySelector('.sv-vscroll'); if (nb) nb.scrollLeft = keepLeft; }
    } else SVA.jumped = '';
    if (SVA.mode === 'edit') svaEditPaint();
    else if (SVA.mode === 'import') svaImportPaint();
    else if (SVA.mode === 'staff') svaStaffPaint();
    else if (SVA.mode === 'plan') svaPlanPaint();
}

function svaSetView(v) { SVA.view = v; svaPaint(); }
/** กำลังดูวันนี้ (รายวัน) / เดือนนี้ (รายเดือน) อยู่หรือไม่ — ปุ่มวันนี้/เดือนนี้กดไม่ได้ */
function svaIsNow() {
    var d = SVA.date, t = svaToday();
    if (!d) return true;
    return SVA.view === 'month' ? (d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth()) : svKey(d) === svKey(t);
}
function svaSecSet(v) { SVA.sec = v; svaPaint(); }
function svaPick(v) {
    if (!v) SVA.date = svaToday();
    else { var p = v.split('-'); SVA.date = new Date(+p[0], +p[1] - 1, +p[2]); }
    if (SVA.mode === 'edit') svaEditStart();
    svaLoad(false);
}
function svaStep(n) {
    var d = SVA.date;
    SVA.date = SVA.view === 'day' ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) : new Date(d.getFullYear(), d.getMonth() + n, 1);
    if (SVA.mode === 'edit') svaEditStart();
    svaLoad(false);
}
// ส่งออกเฉพาะตารางเวร (ไม่ใช่ทั้งหน้าเว็บ) — PDF ย่อพอดี A4 แผ่นเดียว / ภาพ PNG
function svaExport(kind) {
    var d = SVA.date, day = SVA.view === 'day';
    var title = day ? 'ตารางเวร สน.ลำหิน ' + svThaiLong(d)
        : 'ตารางเวร สน.ลำหิน เดือน' + SV_TH_MON[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    var html = day ? svDayHtml(SVA.data, d, { foot: true, plain: true })
        : svMonthHtml(SVA.data, d.getFullYear(), d.getMonth(), SVA.sec, { foot: true });
    // ทุกฝ่ายทั้งเดือน = A4 แนวนอน ไม่พอขึ้นหน้าถัดไปพร้อมหัวตาราง
    if (!day) { svExportMonth(kind, title, SVA.data, d.getFullYear(), d.getMonth(), SVA.sec); return; }
    var landscape = false;
    var opt = { a4: day };   // ใบเวรประจำวัน = ยืดเต็มหน้า A4 ตัวอักษรใหญ่
    if (kind === 'img') svExportImage(title, html, landscape, opt); else svExportPdf(title, html, landscape, opt);
}
function svaClose() { SVA.mode = ''; var p = document.getElementById('sva-panel'); if (p) p.innerHTML = ''; }

// ตั้ง/เปลี่ยนรหัสธุรการ (ใช้เฉพาะในเว็บแอป) — ธุรการใช้รหัสนี้กรอกเวรทุกสายงานบนหน้า GitHub
function svaSetPin() {
    var pin = prompt('ตั้งรหัสธุรการสำหรับกรอกเวรบนหน้า GitHub\n(ตัวเลข 6–12 หลัก · ตั้งใหม่ได้ตลอด รหัสเดิมจะใช้ไม่ได้ทันที)');
    if (pin == null) return;
    pin = String(pin).trim();
    if (!/^\d{6,12}$/.test(pin)) { alert('รหัสต้องเป็นตัวเลข 6–12 หลัก'); return; }
    if (prompt('พิมพ์รหัสอีกครั้งเพื่อยืนยัน') !== pin) { alert('รหัสสองครั้งไม่ตรงกัน'); return; }
    google.script.run
        .withSuccessHandler(function (msg) { alert(msg + '\nแจ้งรหัสนี้ให้งานธุรการ ใช้ที่หน้า GitHub แท็บ "เวร สน." ปุ่ม "แก้ไข/เพิ่มเวร"'); })
        .withFailureHandler(function (e) { alert('ตั้งรหัสไม่สำเร็จ: ' + ((e && e.message) || e)); })
        .setStationEditorPin(pin);
}

// โหลดตัวอ่าน Excel เฉพาะตอนต้องใช้ (หน้า GitHub ไม่ได้โหลดไว้ล่วงหน้า)
function svaEnsureXlsx(cb) {
    if (typeof XLSX !== 'undefined') { cb(); return; }
    var sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    sc.onload = function () { cb(); };
    sc.onerror = function () { cb(new Error('โหลดตัวอ่าน Excel ไม่สำเร็จ')); };
    document.head.appendChild(sc);
}

// ==========================================================
// แก้ไขเวรรายวัน "บนใบเวร" (แบบตาราง Excel)
// - ช่องชื่อ = พิมพ์/เลือกได้ทันที (เฉพาะวันนี้ เช่น แลกเวร/ลา) · ป้ายเวลาหลังชื่อ = เวลาของคนนั้นวันนี้
// - ชื่อหน้าที่ / ชื่อหัวข้อ / เวลาที่หัวข้อ / + หน้าที่ = แก้คอลัมน์ (มีผลทุกวัน) ผ่าน saveStationTemplate เดียวกับ "คอลัมน์"
// - + ที่ช่องหน้าที่ = เพิ่มแถว (อีกคน) เฉพาะวันนี้
// ข้อมูลที่แก้อยู่ใน SVA.ed (ชุดเดียวกับที่บันทึกด้วย saveStationDutyDay)
// ==========================================================
function svaEditOpen() { SVA.view = 'day'; SVA.mode = 'edit'; svaEditStart(); svaPaint(); }

/** ช่องกรอกจากแม่แบบ + ข้อมูลของวันนั้น · ฝ่ายสอบสวน (ดึงอัตโนมัติ) แสดงอย่างเดียว */
function svaEditStart(fromDate) {
    var src = fromDate || SVA.date;
    SVA.pick = null;
    var idx = svIndex(SVA.data), day = {}; day[svKey(src)] = idx[svKey(src)] || {};
    SVA.ed = svSlots(SVA.data, day).filter(function (t) { return t.roles.length; }).map(function (t) {
        var got = day[svKey(src)][svSlotKey(t.sec, t.time)] || {};
        return {
            sec: t.sec, label: t.label, time: t.time, timeLabel: t.timeLabel, roleTimes: t.roleTimes, color: t.color, auto: t.auto,
            roles: t.roles.map(function (r) {
                var rows = got[r] || [];
                return { role: r, names: rows.length ? rows.map(function (x) { return x[4]; }) : [''],
                         notes: rows.length ? rows.map(function (x) { return x[7] || ''; }) : [''],
                         pos: rows.map(function (x) { return x[5] || ''; }), tel: rows.map(function (x) { return x[6] || ''; }) };
            })
        };
    });
}
function svaEditSync() {
    [].forEach.call(document.querySelectorAll('#sva-panel .sva-in, #sva-view .sva-in'), function (el) {
        var s = SVA.ed[+el.dataset.s], r = s && s.roles[+el.dataset.r];
        if (r) r.names[+el.dataset.n] = el.value;
    });
}
function svaEditPaint() {
    var p = document.getElementById('sva-panel'), v = document.getElementById('sva-view');
    if (!p || !SVA.ed) return;
    p.innerHTML = '<div class="sva-card sva-xl-bar"><div class="sva-card-h"><i class="fas fa-pen-to-square"></i> แก้ไขเวรวันที่ ' + svThaiLong(SVA.date)
        + '<button type="button" class="sva-x" onclick="svaClose();svaPaint()" title="ปิด (ไม่บันทึก)"><i class="fas fa-xmark"></i></button></div>'
        + '<div class="sva-hint"><i class="fas fa-hand-pointer"></i> แตะช่องชื่อเพื่อเปลี่ยนเฉพาะวันนี้ (แลกเวร/ลา) · แตะ <i class="fas fa-plus"></i> เพิ่มคน · '
        + 'แตะเวลาเพื่อแก้เวลา · แตะชื่อหน้าที่/หัวข้อเพื่อเปลี่ยนชื่อ (ทุกวัน)</div>'
        + '<div class="sva-foot">'
        + '<button type="button" onclick="svaEditCopyPrev()" title="คัดลอกรายชื่อจากวันก่อน"><i class="fas fa-copy"></i> คัดลอกวันก่อน</button>'
        + '<button type="button" onclick="svaColsOpen()" title="เพิ่ม/ลบ/เปลี่ยนชื่อ/เรียงหน้าที่ และเวลาเข้าเวร"><i class="fas fa-table-columns"></i> คอลัมน์</button>'
        + '<button type="button" class="sva-save" id="sva-save" onclick="svaEditSave()"><i class="fas fa-floppy-disk"></i> บันทึก</button></div></div>';
    if (v && SVA.view === 'day') v.innerHTML = svaSheetHtml();
}
/** ใบเวรประจำวันที่แก้ได้ (หน้าตาเดียวกับใบเวร svDayHtml) */
function svaSheetHtml() {
    var html = '<div class="sv-sheet sv-day sva-xl">'
        + svTitle('ตารางเวรการปฏิบัติหน้าที่ของ สน.ลำหิน', 'ประจำวัน' + SV_DOW_L[SVA.date.getDay()] + 'ที่ ' + svThaiLong(SVA.date))
        + '<table class="sv-table"><thead><tr><th class="sv-c-role">หน้าที่</th><th>ยศ ชื่อ สกุล</th>'
        + '<th class="sv-c-pos">ตำแหน่ง</th><th class="sv-c-tel">เบอร์โทรศัพท์</th></tr></thead><tbody>';
    SVA.ed.forEach(function (s, si) {
        var headTm = svHeadTime(svTimeText(s.time) || s.timeLabel || '');
        if (!SV_NO_HEAD[s.sec]) {
            html += '<tr class="sv-sec"><td colspan="4" style="background:' + svTint(s.color, 0.24) + ';border-left:5px solid ' + s.color + '">'
                + (s.auto ? svEsc(s.label || s.sec) + ' <small>ดึงจากตารางเวรงานสอบสวนอัตโนมัติ</small>'
                    : '<span class="sva-xl-k" onclick="svaXlSecName(' + si + ')" title="เปลี่ยนชื่อหัวข้อ (ทุกวัน)">' + svEsc(s.label || s.sec) + '</span>'
                    + ' <span class="sv-note sv-head-tm sva-xl-k' + (headTm ? '' : ' dim') + '" onclick="svaXlHeadTime(' + si + ')" title="แก้เวลาที่หัวข้อ (ทุกวัน)">' + svEsc(headTm || '+ เวลา') + '</span>'
                    + '<button type="button" class="sva-xl-addcol" onclick="svaXlAddRole(' + si + ')" title="เพิ่มหน้าที่ (คอลัมน์) ในหัวข้อนี้ — ใช้ทุกวัน"><i class="fas fa-plus"></i> หน้าที่</button>')
                + '</td></tr>';
        }
        var roleBg = 'background:' + svTint(s.color, 0.12);
        s.roles.forEach(function (r, ri) {
            var fk = s.sec + '|' + (s.time || '') + '|' + r.role, fx = svaFixAt(fk, svKey(SVA.date)), fixedName = fx && fx.name;
            var canFix = !s.auto && (fixedName || r.role === 'หัวหน้าสถานี');
            var open = SVA.pick && SVA.pick.si === si && SVA.pick.ri === ri;
            var def = svRoleTime(s, r.role);
            r.names.forEach(function (n, ni) {
                var st = n ? svaFindStaff(n) : null;
                var note = r.notes[ni] || '';
                html += '<tr' + (n && !st && !s.auto ? ' class="sva-xl-unk"' : '') + '>';
                if (ni === 0) {
                    html += '<td class="sv-role" rowspan="' + r.names.length + '" style="' + roleBg + '">'
                        + (s.auto ? svEsc(r.role) : '<span class="sva-xl-k" onclick="svaXlRole(' + si + ',' + ri + ')" title="เปลี่ยนชื่อหน้าที่ (ทุกวัน)">' + svEsc(r.role) + '</span>'
                            + '<span class="sva-xl-rb"><button type="button" onclick="svaEditAdd(' + si + ',' + ri + ')" title="เพิ่มคน (เฉพาะวันนี้)" aria-label="เพิ่มคน"><i class="fas fa-plus"></i></button>'
                            + '<button type="button" class="' + (open ? 'on' : '') + '" onclick="svaPickOpen(' + si + ',' + ri + ')" title="เลือกจากรายชื่อ" aria-label="เลือกจากรายชื่อ"><i class="fas fa-list-check"></i></button>'
                            + (canFix ? '<button type="button" data-k="' + svEsc(fk) + '" onclick="svaFixOpen(this.dataset.k)" title="ชื่อประจำ (แสดงทุกวัน) · เปลี่ยนคนใหม่ตั้งแต่วันที่ / ตำแหน่ง" aria-label="ชื่อประจำ"><i class="fas fa-thumbtack"></i></button>' : '')
                            + '</span>')
                        + '</td>';
                }
                if (s.auto) {
                    html += '<td class="sv-name"><span class="sv-nm">' + svEsc(n || '—') + '</span>' + (note ? ' <span class="sv-note">' + svEsc(svNoteText(note)) + '</span>' : '') + '</td>';
                } else {
                    // แตะชื่อ = กลายเป็นช่องพิมพ์ (แบบ Excel) · ช่องว่างพิมพ์ได้เลย
                    html += '<td class="sv-name"><div class="sva-xl-cell">'
                        + (n ? '<span class="sva-xl-nm" onclick="svaXlCell(this)" title="แตะเพื่อเปลี่ยนชื่อ (เฉพาะวันนี้)">' + svEsc(n) + '</span>' : '')
                        + '<input class="sva-in sva-xl-in' + (n ? ' hid' : '') + '" list="' + svaDl(s.sec, s.time, r.role) + '" data-s="' + si + '" data-r="' + ri + '" data-n="' + ni + '"'
                        + ' value="' + svEsc(n) + '" placeholder="—" onchange="svaEditSync();svaEditPaint()" onblur="svaXlCellOff(this)">'
                        // เวลาของคนนี้ (ป้ายส้ม) · ไม่ได้ตั้ง = ไอคอนนาฬิกา (ใช้เวลาปกติของหน้าที่/หัวข้อ)
                        + (n ? (svNoteTime(note)
                            ? '<span class="sv-note sva-xl-k" onclick="svaXlNote(' + si + ',' + ri + ',' + ni + ')" title="แก้เวลาของคนนี้วันนี้">' + svEsc(svNoteTime(note)) + '</span>'
                            : '<button type="button" class="sva-xl-del" onclick="svaXlNote(' + si + ',' + ri + ',' + ni + ')" title="ตั้งเวลาเฉพาะคนนี้วันนี้ (ปกติ ' + svEsc(svNoteTime(def) || headTm || '-') + ')" aria-label="ตั้งเวลา"><i class="fas fa-clock"></i></button>')
                            + '<button type="button" class="sva-xl-del" onclick="svaEditDel(' + si + ',' + ri + ',' + ni + ')" title="เอาออก (เฉพาะวันนี้)" aria-label="เอาออก"><i class="fas fa-xmark"></i></button>' : '')
                        + '</div>' + (n ? '<div class="sv-name-pos">' + svEsc(svPos(st ? st.pos : (r.pos[ni] || ''))) + '</div>' : '')
                        + (fixedName && ni === 0 ? '<small class="sva-xl-fix"><i class="fas fa-thumbtack"></i> ชื่อประจำ ' + svEsc(svShort(fixedName)) + '</small>' : '')
                        + (n && !st ? '<small class="sva-xl-fix r">ไม่มีในทะเบียน</small>' : '') + '</td>';
                }
                html += '<td class="sv-c-pos">' + svEsc(svPos(st ? st.pos : (r.pos[ni] || ''))) + '</td>'
                    + '<td class="sv-c-tel">' + svEsc(st ? st.phone : (r.tel[ni] || '')) + '</td></tr>';
            });
            if (open) html += '<tr class="sva-xl-pick"><td colspan="4">' + svaPickHtml(s, r) + '</td></tr>';
        });
    });
    return html + '</tbody></table>'
        + '<div class="sva-foot"><button type="button" class="sva-save" onclick="svaEditSave()"><i class="fas fa-floppy-disk"></i> บันทึกเวรวันนี้</button></div></div>';
}
function svaEditAdd(si, ri) { svaEditSync(); var r = SVA.ed[si].roles[ri]; r.names.push(''); r.notes.push(''); svaEditPaint(); }
function svaXlCell(span) {
    var inp = span.nextElementSibling;
    span.style.display = 'none'; inp.classList.remove('hid'); inp.focus(); inp.select();
}
function svaXlCellOff(inp) {
    if (!inp.value || inp.value !== inp.defaultValue) return;   // เปลี่ยนแล้ว = onchange วาดใหม่เอง
    inp.classList.add('hid');
    if (inp.previousElementSibling) inp.previousElementSibling.style.display = '';
}
/** เวลาของคนนี้วันนี้ (เว้นว่าง = ใช้เวลาปกติของหน้าที่/หัวข้อ) */
function svaXlNote(si, ri, ni) {
    svaEditSync();
    var s = SVA.ed[si], r = s.roles[ri];
    var def = svRoleTime(s, r.role) || svHeadTime(svTimeText(s.time) || s.timeLabel || '');
    var v = prompt('เวลาเข้าเวรของ ' + r.names[ni] + ' วันนี้ เช่น 08.00-16.00 น.\n(เว้นว่าง = ใช้เวลาปกติ' + (def ? ' ' + def : '') + ')', svNoteTime(r.notes[ni]) || '');
    if (v == null) return;
    // "8:00-16.00" → "08.00-16.00 น." (รูปแบบเดียวกับเวลาที่อ่านจากไฟล์)
    var m = v.replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); })
        .match(/^\s*(\d{1,2})[.:](\d{2})\s*(?:น\.)?\s*[-–]\s*(\d{1,2})[.:](\d{2})\s*(?:น\.)?\s*(.*)$/);
    r.notes[ni] = m ? ('0' + m[1]).slice(-2) + '.' + m[2] + '-' + ('0' + m[3]).slice(-2) + '.' + m[4] + ' น.' + (m[5] ? ' ' + m[5].trim() : '')
        : v.replace(/\s+/g, ' ').trim();
    svaEditPaint();
}
// ---- แก้คอลัมน์จากใบเวร (มีผลทุกวัน) — ชื่อที่แก้ค้างไว้บนใบเวรยังอยู่ ----
function svaXlTplSlot(tpl, s) { return tpl.filter(function (t) { return !t.auto && t.sec === s.sec && (t.time || '') === (s.time || ''); })[0]; }
function svaXlSecName(si) {
    var s = SVA.ed[si], v = prompt('ชื่อหัวข้อ (แสดงทุกวัน)\nเว้นว่าง = ใช้ชื่อเดิม "' + s.sec + '"', s.label || s.sec);
    if (v == null) return;
    v = v.replace(/\s+/g, ' ').trim();
    var tpl = JSON.parse(JSON.stringify(svaTpl()));
    tpl.forEach(function (t) { if (t.sec === s.sec) t.label = v === s.sec ? '' : v; });   // ทุกผลัดของฝ่ายนี้
    svaTplSave(tpl, [], 'เปลี่ยนชื่อหัวข้อแล้ว');
}
function svaXlHeadTime(si) {
    var s = SVA.ed[si], cur = s.timeLabel || svHeadTime(svTimeText(s.time));
    var v = prompt('เวลาที่หัวข้อ ' + (s.label || s.sec) + ' (ทุกวัน)\nเช่น 08.00-20.00 น. · เว้นว่าง = ' + (s.time ? 'เวลาเดิมของผลัด' : 'ไม่แสดง'), cur);
    if (v == null) return;
    var tpl = JSON.parse(JSON.stringify(svaTpl())), t = svaXlTplSlot(tpl, s);
    if (!t) return;
    t.timeLabel = v.trim();
    svaTplSave(tpl, [], 'แก้เวลาที่หัวข้อแล้ว');
}
function svaXlAddRole(si) {
    var s = SVA.ed[si], v = prompt('เพิ่มหน้าที่ (คอลัมน์) ใน ' + (s.label || s.sec) + ' — ใช้ทุกวัน\nเช่น สายตรวจรถยนต์');
    if (v == null) return;
    v = v.replace(/\s+/g, ' ').trim(); if (!v) return;
    var tpl = JSON.parse(JSON.stringify(svaTpl())), t = svaXlTplSlot(tpl, s);
    if (!t) { t = { sec: s.sec, time: s.time || '', roles: [] }; tpl.push(t); }
    if (t.roles.indexOf(v) >= 0) { alert('มีหน้าที่ "' + v + '" อยู่แล้ว'); return; }
    t.roles.push(v);
    svaTplSave(tpl, [], 'เพิ่มหน้าที่ "' + v + '" แล้ว');
}
function svaXlRole(si, ri) {
    var s = SVA.ed[si], old = s.roles[ri].role;
    var v = prompt('เปลี่ยนชื่อหน้าที่ "' + old + '" เป็น (ทุกวัน ข้อมูลเดิมเปลี่ยนตาม)\nจะลบหรือเรียงลำดับ ใช้ปุ่ม "คอลัมน์"', old);
    if (v == null) return;
    v = v.replace(/\s+/g, ' ').trim(); if (!v || v === old) return;
    var tpl = JSON.parse(JSON.stringify(svaTpl())), t = svaXlTplSlot(tpl, s);
    if (!t) { t = { sec: s.sec, time: s.time || '', roles: [] }; tpl.push(t); }
    var at = t.roles.indexOf(old);
    if (t.roles.indexOf(v) >= 0) {
        if (!confirm('มีหน้าที่ "' + v + '" อยู่แล้ว — รวม "' + old + '" เข้าไปเป็นหน้าที่เดียวกัน?')) return;
        if (at >= 0) t.roles.splice(at, 1);
    } else if (at >= 0) t.roles[at] = v; else t.roles.push(v);
    if (t.roleTimes && old in t.roleTimes) { if (!(v in t.roleTimes)) t.roleTimes[v] = t.roleTimes[old]; delete t.roleTimes[old]; }
    var k = svSlotKey(s.sec, s.time) + '|' + old;
    var moves = (SVA.data.roleStart || {})[k] ? [{ sec: s.sec, time: s.time || '', role: old, toSec: s.sec, toTime: s.time || '', toRole: v }] : [];
    svaTplSave(tpl, moves, 'เปลี่ยนชื่อหน้าที่เป็น "' + v + '" แล้ว');
}
/** บันทึกคอลัมน์จากหน้าแก้ไขเวรรายวัน แล้วโหลดใหม่โดยคงชื่อที่แก้ค้างไว้ (หน้าที่ที่เปลี่ยนชื่อตามไปด้วย) */
function svaTplSave(tpl, moves, msg) {
    var keep = svaEditKeep();
    (moves || []).forEach(function (m) {
        var a = svSlotKey(m.sec, m.time) + '|' + m.role, b = svSlotKey(m.toSec || m.sec, m.toTime == null ? m.time : m.toTime) + '|' + m.toRole;
        if (!keep[a] || !m.toRole) { delete keep[a]; return; }
        if (keep[b]) { keep[b].names = keep[b].names.concat(keep[a].names); keep[b].notes = keep[b].notes.concat(keep[a].notes); }
        else keep[b] = keep[a];
        delete keep[a];
    });
    svaBusy(true);
    google.script.run
        .withSuccessHandler(function (res) {
            svaTplSet(res.template);
            svaLoad(true, function () {
                svaBusy(false);
                if (SVA.mode !== 'edit') return;
                svaEditStart();
                svaEditRestore(keep);
            });
            if (msg) setTimeout(function () { alert(msg + (res.moved ? ' (ย้ายข้อมูลเดิม ' + res.moved + ' รายการ)' : '')); }, 60);
        })
        .withFailureHandler(function (e) { svaBusy(false); alert('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e)); })
        .saveStationTemplate(tpl, moves || []);
}
/** ชื่อ/เวลาที่แก้ค้างบนใบเวร (ยังไม่บันทึก) { 'ฝ่าย|ช่วงเวลา|หน้าที่': {names, notes} } */
function svaEditKeep() {
    svaEditSync();
    var keep = {};
    (SVA.ed || []).forEach(function (s) {
        if (s.auto) return;
        s.roles.forEach(function (r) { keep[svSlotKey(s.sec, s.time) + '|' + r.role] = { names: r.names.slice(), notes: r.notes.slice() }; });
    });
    return keep;
}
function svaEditRestore(keep) {
    SVA.ed.forEach(function (s) {
        s.roles.forEach(function (r) {
            var x = keep[svSlotKey(s.sec, s.time) + '|' + r.role]; if (!x) return;
            var names = [], notes = [];
            x.names.forEach(function (n, i) { if (n || !names.length) { names.push(n); notes.push(x.notes[i] || ''); } });
            r.names = names; r.notes = notes;
        });
    });
}
function svaBusy(on) {
    var b = document.getElementById('sva-save');
    if (b) { b.disabled = !!on; b.innerHTML = on ? '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก…' : '<i class="fas fa-floppy-disk"></i> บันทึก'; }
}

// ตั้งชื่อในช่องเป็น "ชื่อประจำ" ของหน้าที่นั้น (เช่น เปลี่ยน ผกก. → หัวหน้าสถานีคนใหม่) — มีผลทุกวันที่ไม่ได้กรอกชื่ออื่น
// ---------- ชื่อประจำ (เช่น หัวหน้าสถานี) + ประวัติการดำรงตำแหน่ง ----------
// แต่ละคน: ตั้งแต่วันที่ + ตำแหน่งที่แสดงในใบเวร (เช่น รรท.ผกก. → ผกก.คนใหม่ตั้งแต่ 1 ธ.ค.) · แต่ละวันใช้คนที่ดำรงตำแหน่งวันนั้น
function svaFixHist() { return (SVA.pl && SVA.pl.d && SVA.pl.d.fixedHist) || (SVA.data && SVA.data.fixedHist) || {}; }
/** คนในหน้าที่วันนั้น: รักษาราชการแทนที่ครอบวันนั้นก่อน ไม่มี = คนที่ดำรงตำแหน่ง */
function svaFixAt(k, dayKey) {
    var hit = null, act = null;
    (svaFixHist()[k] || []).forEach(function (x) {
        if (x.acting) { if (x.from <= dayKey && dayKey <= x.to) act = x; }
        else if ((+x.from || 0) <= dayKey) hit = x;
    });
    return act || hit;
}
function svaFixDay(n) { n = +n || 0; return (n % 100) + ' ' + SVA_MON_S[Math.floor(n / 100) % 100 - 1] + ' ' + (Math.floor(n / 10000) + 543); }
function svaFixKey(id) { var v = (document.getElementById(id).value || '').split('-'); return v.length === 3 ? +v[0] * 10000 + +v[1] * 100 + +v[2] : 0; }
/**
 * ตำแหน่งตอนรักษาราชการแทน = ตำแหน่งจริง (ตัด "สน.ลำหิน" ท้ายเป็น ฯ) + " รรท." + ตำแหน่งของคนที่ดำรงตำแหน่งวันนั้น
 * เช่น รอง ผกก.สส.สน.ลำหิน → "รอง ผกก.สส.ฯ รรท.ผกก.สน.ลำหิน"
 */
function svaActingPos(name, dayKey) {
    var st = svaFindStaff(name), own = svPos(st ? st.pos : '').replace(/\s*สน\.ลำหิน\s*$/, 'ฯ');
    var chief = null;
    SVA.fx.list.forEach(function (x) { if (!x.acting && (+x.from || 0) <= (dayKey || 99999999)) chief = x; });
    var cs = chief && svaFindStaff(chief.name);
    var cpos = ((chief && chief.pos) || (cs && cs.pos) || 'ผกก.สน.ลำหิน').replace(/^\s*รรท\.\s*/, '');
    return (own ? own + ' ' : '') + 'รรท.' + cpos;
}
function svaFixDate(n) {
    n = +n || 0;
    return n ? 'ตั้งแต่ ' + (n % 100) + ' ' + SVA_MON_S[Math.floor(n / 100) % 100 - 1] + ' ' + (Math.floor(n / 10000) + 543) : 'ตั้งแต่ต้น';
}
function svaFixOpen(k) {
    var p = k.split('|');
    SVA.fx = { k: k, sec: p[0], time: p[1], role: p.slice(2).join('|'), list: JSON.parse(JSON.stringify(svaFixHist()[k] || [])) };
    svaFixPaint();
}
function svaFixPaint() {
    var F = SVA.fx, today = svKey(svaToday()), cur = null;
    F.list.sort(function (a, b) { return (+a.from || 0) - (+b.from || 0); });
    F.list.forEach(function (x) { if (!x.acting && (+x.from || 0) <= today) cur = x; });
    var acts = F.list.map(function (x, i) {
        if (!x.acting) return '';
        var now = x.from <= today && today <= x.to;
        return '<div class="sva-cm-r"><span class="sva-cm-n">' + svEsc(x.name) + '<small>' + svaFixDay(x.from) + (x.to !== x.from ? ' – ' + svaFixDay(x.to) : '')
            + (x.why ? ' · ' + svEsc(x.why) : '') + (now ? ' · วันนี้' : (x.to < today ? ' · ผ่านแล้ว' : '')) + '</small></span>'
            + '<input class="sva-cm-tm sva-fx-ap form-control form-control-sm" value="' + svEsc(x.pos || '') + '" title="ตำแหน่งที่แสดงในใบเวรช่วงนี้" onchange="SVA.fx.list[' + i + '].pos=this.value.trim()">'
            + '<span class="sva-cm-b"><button type="button" class="del" onclick="SVA.fx.list.splice(' + i + ',1);svaFixPaint()" title="ลบ" aria-label="ลบ"><i class="fas fa-trash-can"></i></button></span></div>';
    }).join('');
    var rows = F.list.map(function (x, i) {
        if (x.acting) return '';
        var st = svaFindStaff(x.name);
        return '<div class="sva-cm-r"><span class="sva-cm-n">' + svEsc(x.name) + '<small>' + svaFixDate(x.from) + (x === cur ? ' · ปัจจุบัน' : '') + '</small></span>'
            + '<input class="sva-cm-tm form-control form-control-sm" value="' + svEsc(x.pos || '') + '" placeholder="' + svEsc(svPos(st ? st.pos : 'ตำแหน่ง')) + '"'
            + ' title="ตำแหน่งที่แสดงในใบเวร (เว้นว่าง = ตามทะเบียน)" onchange="SVA.fx.list[' + i + '].pos=this.value.trim()">'
            + '<span class="sva-cm-b"><button type="button" class="del" onclick="SVA.fx.list.splice(' + i + ',1);svaFixPaint()" title="ลบ" aria-label="ลบ"><i class="fas fa-trash-can"></i></button></span></div>';
    }).join('');
    var d = svaToday(), dv = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    svaModal('<i class="fas fa-thumbtack"></i> ชื่อประจำ: ' + svEsc(F.role),
        '<div class="sva-hint"><i class="fas fa-circle-info"></i> แสดงในใบเวรทุกวันอัตโนมัติ (วันที่กรอกชื่ออื่นไว้ใช้ชื่อนั้น) · '
        + 'มีคนใหม่มาดำรงตำแหน่ง = เพิ่มชื่อพร้อมวันที่เริ่ม วันก่อนหน้ายังเป็นคนเดิม · แก้ตำแหน่งได้ เช่น รรท.ผกก. → ผกก.</div>'
        + '<div class="sva-cm-s"><div class="sva-cm-h">ผู้ดำรงตำแหน่ง</div>' + (rows || '<div class="sva-none">ยังไม่มีชื่อประจำ</div>')
        + '<div class="sva-fg">'
        + '<label class="sva-f s2"><span>ยศ ชื่อ สกุล</span><input id="sva-fx-n" class="form-control" list="sva-staff" placeholder="พิมพ์หรือเลือกชื่อ" onchange="var s=svaFindStaff(this.value);if(s){this.value=s.name;document.getElementById(\'sva-fx-p\').placeholder=svPos(s.pos);}"></label>'
        + '<label class="sva-f s2"><span>เริ่มดำรงตำแหน่ง</span><input id="sva-fx-d" type="date" class="form-control" value="' + dv + '"></label>'
        + '<label class="sva-f s4"><span>ตำแหน่งที่แสดง</span><input id="sva-fx-p" class="form-control" placeholder="เช่น ผกก.สน.ลำหิน"></label></div>'
        + '<div class="sva-fr"><label class="sva-chk"><input type="checkbox" id="sva-fx-st" checked> แก้ตำแหน่งในทะเบียนกำลังพลด้วย</label>'
        + '<button type="button" class="sva-btn-add" onclick="svaFixAdd()"><i class="fas fa-plus"></i> เพิ่มผู้ดำรงตำแหน่ง</button></div></div>'
        // รักษาราชการแทนชั่วคราว (ลา / ไปราชการ) — ช่วงวันที่ ไม่แก้ทะเบียน
        + '<div class="sva-cm-s"><div class="sva-cm-h">รักษาราชการแทน (รรท.) ชั่วคราว <small>พ้นช่วงแล้วกลับเป็นผู้ดำรงตำแหน่งเอง</small></div>'
        + (acts || '<div class="sva-none">ยังไม่มี</div>')
        + '<div class="sva-fg">'
        + '<label class="sva-f s2"><span>ผู้รักษาราชการแทน</span><input id="sva-fa-n" class="form-control" list="sva-staff" placeholder="พิมพ์หรือเลือกชื่อ" onchange="svaFixActPos()"></label>'
        + '<label class="sva-f"><span>ตั้งแต่</span><input id="sva-fa-f" type="date" class="form-control" value="' + dv + '" onchange="if(!document.getElementById(\'sva-fa-t\').value||document.getElementById(\'sva-fa-t\').value<this.value)document.getElementById(\'sva-fa-t\').value=this.value;svaFixActPos()"></label>'
        + '<label class="sva-f"><span>ถึง</span><input id="sva-fa-t" type="date" class="form-control" value="' + dv + '"></label>'
        + '<label class="sva-f"><span>เหตุ</span><input id="sva-fa-w" class="form-control" list="sva-fa-why" placeholder="เช่น ลาพักผ่อน"></label>'
        + '<datalist id="sva-fa-why"><option>ลาป่วย</option><option>ลากิจ</option><option>ลาพักผ่อน</option><option>ไปราชการ</option><option>อบรม/สัมมนา</option></datalist>'
        + '<label class="sva-f s3"><span>ตำแหน่งที่แสดง <small>(สร้างให้อัตโนมัติ แก้ได้)</small></span><input id="sva-fa-p" class="form-control" placeholder="เช่น รอง ผกก.ป.ฯ รรท.ผกก.สน.ลำหิน"></label></div>'
        + '<div class="sva-fr"><button type="button" class="sva-btn-add" onclick="svaFixActAdd()"><i class="fas fa-plus"></i> เพิ่มผู้รักษาราชการแทน</button></div></div>',
        '<button type="button" onclick="svaModalClose()">ยกเลิก</button>'
        + '<button type="button" class="sva-save" id="sva-fx-ok" onclick="svaFixSave()"><i class="fas fa-floppy-disk"></i> บันทึก</button>');
}
/** ชื่อ/วันที่เปลี่ยน → สร้างตำแหน่ง รรท. ให้ (ถ้ายังไม่ได้พิมพ์เอง) */
function svaFixActPos() {
    var n = document.getElementById('sva-fa-n'), p = document.getElementById('sva-fa-p');
    var st = svaFindStaff(n.value); if (st) n.value = st.name;
    if (!n.value.trim() || (p.value && p.dataset.auto !== p.value)) return;
    p.value = p.dataset.auto = svaActingPos(n.value, svaFixKey('sva-fa-f'));
}
function svaFixActAdd() {
    var F = SVA.fx, n = document.getElementById('sva-fa-n').value.trim();
    if (!n) { document.getElementById('sva-fa-n').focus(); return; }
    var st = svaFindStaff(n), from = svaFixKey('sva-fa-f'), to = svaFixKey('sva-fa-t') || from;
    if (!from) { alert('กรุณาเลือกวันที่เริ่ม'); return; }
    if (to < from) { alert('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'); return; }
    var clash = F.list.filter(function (x) { return x.acting && x.from <= to && from <= x.to; })[0];
    if (clash && !confirm('ช่วงนี้ทับกับ ' + clash.name + ' (' + svaFixDay(clash.from) + ' – ' + svaFixDay(clash.to) + ') — แทนที่?')) return;
    if (clash) F.list = F.list.filter(function (x) { return !(x.acting && x.from <= to && from <= x.to); });
    var name = st ? st.name : n;
    F.list.push({ name: name, from: from, to: to, acting: true, why: document.getElementById('sva-fa-w').value.trim(),
                  pos: document.getElementById('sva-fa-p').value.trim() || svaActingPos(name, from) });
    svaFixPaint();
}
function svaFixAdd() {
    var F = SVA.fx, n = document.getElementById('sva-fx-n').value.trim();
    if (!n) { document.getElementById('sva-fx-n').focus(); return; }
    var st = svaFindStaff(n), dv = (document.getElementById('sva-fx-d').value || '').split('-');
    var from = dv.length === 3 ? +dv[0] * 10000 + +dv[1] * 100 + +dv[2] : 0;
    F.list = F.list.filter(function (x) { return x.acting || (+x.from || 0) !== from; });   // วันเดียวกันได้คนเดียว
    F.list.push({ name: st ? st.name : n, from: from, pos: document.getElementById('sva-fx-p').value.trim() });
    svaFixPaint();
}
function svaFixSave() {
    var F = SVA.fx, up = document.getElementById('sva-fx-st').checked, b = document.getElementById('sva-fx-ok');
    b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก…';
    var keep = SVA.mode === 'edit' ? svaEditKeep() : null;
    if (keep) delete keep[F.k];   // ช่องนี้ใช้ชื่อประจำใหม่
    google.script.run
        .withSuccessHandler(function (res) {
            svaModalClose();
            if (SVA.data) { SVA.data.fixed = res.fixed; SVA.data.fixedHist = res.fixedHist; }
            if (SVA.mode === 'plan') { svaPlanReload(); return; }
            svaLoad(true, function () { if (keep && SVA.mode === 'edit') { svaEditStart(); svaEditRestore(keep); } });
        })
        .withFailureHandler(function (e) {
            b.disabled = false; b.innerHTML = '<i class="fas fa-floppy-disk"></i> บันทึก';
            alert('บันทึกชื่อประจำไม่สำเร็จ: ' + ((e && e.message) || e));
        })
        .saveStationFixedHist(F.sec, F.time, F.role, F.list, up);
}

// ---------- เลือกชื่อจากทะเบียน: เปิดที่ "งานของหัวข้อนั้น" ก่อน เลือกข้ามงานได้อิสระ ----------
var SVA_SEC_DEPT = { 'ฝ่ายป้องกันปราบปราม': 'ป้องกันปราบปราม', 'ฝ่ายสืบสวน': 'สืบสวน', 'ฝ่ายจราจร': 'จราจร', 'ฝ่ายสอบสวน': 'สอบสวน', 'ผู้บังคับบัญชา': '*หัวหน้า' };
var SVA_CHIEF_RE = /ผกก|สวป|(^|[\s.])สว[.(]/;   // ระดับสารวัตรขึ้นไป (หัวหน้าสถานี/เวรอำนวยการ)
function svaPickOpen(si, ri) {
    svaEditSync();
    if (SVA.pick && SVA.pick.si === si && SVA.pick.ri === ri) { SVA.pick = null; svaEditPaint(); return; }
    var home = SVA_SEC_DEPT[SVA.ed[si].sec] || '';
    SVA.pick = { si: si, ri: ri, tab: home || '*all', home: home, q: '' };
    svaEditPaint();
}
function svaPickList(tab, q) {
    return (SVA.data.staff || []).filter(function (s) {
        if (tab === '*หัวหน้า') { if (!(s.dept === 'บริหาร' || SVA_CHIEF_RE.test(s.pos))) return false; }
        else if (tab && tab !== '*all' && s.dept !== tab) return false;
        if (q && (s.name + ' ' + s.pos + ' ' + s.phone).toLowerCase().indexOf(q.toLowerCase()) < 0) return false;
        return true;
    });
}
function svaPickChosen(r) {
    var chosen = {};
    r.names.forEach(function (n) { var x = n && svaFindStaff(n); if (x) chosen[x.name] = 1; });
    return chosen;
}
function svaPickHtml(s, r) {
    var P = SVA.pick, depts = [];
    (SVA.data.staff || []).forEach(function (x) { if (x.dept && depts.indexOf(x.dept) < 0) depts.push(x.dept); });
    var tabs = [];
    if (P.home) tabs.push({ v: P.home, t: P.home === '*หัวหน้า' ? 'ระดับสารวัตรขึ้นไป' : 'งาน' + P.home, home: true });
    tabs.push({ v: '*all', t: 'ทุกงาน' });
    depts.forEach(function (d) { if (d !== P.home) tabs.push({ v: d, t: d }); });
    var chosen = svaPickChosen(r);
    return '<div class="sva-pick">'
        + '<div class="sva-pick-h"><i class="fas fa-list-check"></i> เลือกผู้เข้าเวร “' + svEsc(r.role) + '” — กดชื่อเพื่อเลือก/ยกเลิก เลือกได้หลายคน · ไปช่วยงานอื่นให้กดแท็บงานนั้น</div>'
        + '<div class="sva-pick-tabs">' + tabs.map(function (t) {
            return '<button type="button" class="' + (t.v === P.tab ? 'on' : '') + (t.home ? ' home' : '') + '" onclick="svaPickTab(\'' + t.v + '\')">'
                + svEsc(t.t) + ' <small>' + svaPickList(t.v, '').length + '</small></button>';
        }).join('') + '</div>'
        + '<input class="form-control form-control-sm sva-pick-q" placeholder="ค้นหาชื่อ / ตำแหน่ง / เบอร์" value="' + svEsc(P.q) + '" oninput="svaPickQ(this.value)">'
        + '<div class="sva-pick-list" id="sva-pick-list">' + svaPickChips(svaPickList(P.tab, P.q), chosen) + '</div>'
        + '<div class="sva-pick-foot"><span>เลือกแล้ว <b>' + Object.keys(chosen).length + '</b> คน</span>'
        + '<button type="button" onclick="svaPickOpen(' + P.si + ',' + P.ri + ')"><i class="fas fa-check"></i> เสร็จ</button></div>'
        + '</div>';
}
function svaPickChips(list, chosen) {
    if (!list.length) return '<div class="sva-none">ไม่พบรายชื่อ</div>';
    var all = SVA.data.staff || [];
    return list.map(function (x) {
        return '<button type="button" class="sva-chip' + (chosen[x.name] ? ' on' : '') + '" onclick="svaPickToggle(' + all.indexOf(x) + ')">'
            + (chosen[x.name] ? '<i class="fas fa-circle-check"></i>' : '')
            + '<b>' + svEsc(svShort(x.name)) + '</b><small>' + svEsc(x.pos) + '</small><small>' + svEsc(x.phone || '') + '</small></button>';
    }).join('');
}
function svaPickTab(v) { svaEditSync(); SVA.pick.tab = v; svaEditPaint(); }
function svaPickQ(v) {
    SVA.pick.q = v;
    var r = SVA.ed[SVA.pick.si].roles[SVA.pick.ri];
    var el = document.getElementById('sva-pick-list');
    if (el) el.innerHTML = svaPickChips(svaPickList(SVA.pick.tab, v), svaPickChosen(r));
}
function svaPickToggle(i) {
    svaEditSync();
    var x = (SVA.data.staff || [])[i]; if (!x || !SVA.pick) return;
    var r = SVA.ed[SVA.pick.si].roles[SVA.pick.ri];
    var at = -1;
    r.names.forEach(function (n, k) { var f = n && svaFindStaff(n); if (f && f.name === x.name) at = k; });
    if (at > -1) { r.names.splice(at, 1); r.notes.splice(at, 1); if (!r.names.length) { r.names.push(''); r.notes.push(''); } }
    else { var e = r.names.indexOf(''); if (e > -1) { r.names[e] = x.name; r.notes[e] = ''; } else { r.names.push(x.name); r.notes.push(''); } }
    svaEditPaint();
}
function svaEditDel(si, ri, ni) {
    svaEditSync();
    var r = SVA.ed[si].roles[ri]; r.names.splice(ni, 1); r.notes.splice(ni, 1); if (!r.names.length) { r.names.push(''); r.notes.push(''); }
    svaEditPaint();
}
function svaEditCopyPrev() {
    var prev = new Date(SVA.date.getFullYear(), SVA.date.getMonth(), SVA.date.getDate() - 1);
    svaEditStart(prev);
    svaEditPaint();
}
function svaEditSave() {
    svaEditSync();
    var entries = [];
    SVA.ed.forEach(function (s) {
        if (s.auto) return;   // ฝ่ายสอบสวนดึงจากตารางเวรงานสอบสวน
        s.roles.forEach(function (r) {
            r.names.forEach(function (n, ni) {
                n = String(n || '').trim(); if (!n) return;
                var st = svaFindStaff(n) || {};
                entries.push({ sec: s.sec, time: s.time, role: r.role, name: st.name || n, pos: st.pos || '', phone: st.phone || '', note: r.notes[ni] || '' });
            });
        });
    });
    var btn = document.getElementById('sva-save');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก…'; }
    google.script.run
        .withSuccessHandler(function (res) {
            SVA.mode = '';
            svaLoad(true);
            setTimeout(function () { alert('บันทึกเวรวันที่ ' + svThaiLong(SVA.date) + ' แล้ว ' + res.saved + ' รายการ'); }, 50);
        })
        .withFailureHandler(function (e) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> บันทึก'; }
            alert('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e));
        })
        .saveStationDutyDay(svDateStr(SVA.date), entries);
}

// ==========================================================
// นำเข้าจากรูป / PDF / Excel ด้วย AI
// ==========================================================
function svaImportOpen() { SVA.mode = 'import'; SVA.imp = SVA.imp || { list: null }; svaPaint(); }
function svaImportPaint() {
    var p = document.getElementById('sva-panel'); if (!p) return;
    var d = SVA.date;
    var secs = [];
    (SVA.data.template || []).forEach(function (t) { if (!t.auto && secs.indexOf(t.sec) < 0) secs.push(t.sec); });
    var html = '<div class="sva-card"><div class="sva-card-h"><i class="fas fa-wand-magic-sparkles"></i> นำเข้าตารางเวรจากรูป / PDF / Excel'
        + '<button type="button" class="sva-x" onclick="svaClose()" title="ปิด"><i class="fas fa-xmark"></i></button></div>'
        + '<div class="sva-hint"><i class="fas fa-circle-info"></i> รูปถ่ายตารางเวร ใบเวรประจำวัน หรือ Excel ของงานใดก็ได้ (หลายไฟล์ได้) — AI อ่านให้ตรวจก่อนบันทึก '
        + '· ไฟล์ต้นฉบับเก็บเข้าถังของงานที่อยู่ในไฟล์ให้เอง</div>'
        + '<div class="sva-imp">'
        + '  <input type="file" id="sva-file" hidden multiple accept="image/*,.pdf,.xlsx,.xls,.csv" onchange="svaImportRead()">'
        + '  <select id="sva-hint" class="form-select form-select-sm" title="ตารางของงานไหน (ไม่ระบุก็ได้)"><option value="">ทุกงาน (AI ดูเอง)</option>'
        + '<option value="ใบเวรประจำวันทั้ง สน.">ใบเวรประจำวันทั้ง สน.</option>'
        + secs.map(function (s) { return '<option>' + svEsc(s) + '</option>'; }).join('') + '</select>'
        + '  <input type="month" id="sva-month" class="form-control form-control-sm" value="' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '" title="เดือนของตาราง">'
        + '  <button type="button" class="sva-save" id="sva-read" onclick="document.getElementById(\'sva-file\').click()" title="เลือกรูป/PDF/Excel แล้ว AI อ่านทันที"><i class="fas fa-file-arrow-up"></i> เลือกไฟล์ให้ AI อ่าน</button>'
        + '</div><div id="sva-imp-res">' + svaImportResHtml() + '</div></div>';
    p.innerHTML = html;
}
function svaReadFile(f) {
    return new Promise(function (res, rej) {
        var r = new FileReader();
        var isSheet = /\.(xlsx|xls|csv)$/i.test(f.name);
        r.onload = function (e) {
            if (isSheet) {
                try {
                    var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                    res({ text: wb.SheetNames.map(function (n) { return '### ' + n + '\n' + XLSX.utils.sheet_to_csv(wb.Sheets[n]); }).join('\n\n') });
                } catch (err) { rej(err); }
            } else {
                res({ file: { name: f.name, mimeType: f.type || 'application/pdf', data: String(e.target.result).split(',')[1] } });
            }
        };
        r.onerror = rej;
        if (isSheet) r.readAsArrayBuffer(f); else r.readAsDataURL(f);
    });
}
function svaImportRead() {
    var inp = document.getElementById('sva-file');
    var files = inp && inp.files ? [].slice.call(inp.files) : [];
    if (!files.length) return;
    var btn = document.getElementById('sva-read');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังอ่าน…';
    var hint = document.getElementById('sva-hint').value;
    var mv = (document.getElementById('sva-month').value || '').split('-');
    var needXlsx = files.some(function (f) { return /\.(xlsx|xls|csv)$/i.test(f.name); });
    new Promise(function (ok, bad) {
        if (!needXlsx) return ok();
        svaEnsureXlsx(function (err) { if (err) bad(err); else ok(); });
    }).then(function () {
        return Promise.all(files.map(svaReadFile));
    }).then(function (parts) {
        var payload = {
            files: parts.filter(function (x) { return x.file; }).map(function (x) { return x.file; }),
            text: parts.filter(function (x) { return x.text; }).map(function (x) { return x.text; }).join('\n\n'),
            hint: hint, month: mv.length === 2 ? mv[1] + '/' + mv[0] : ''
        };
        google.script.run
            .withSuccessHandler(function (res) {
                // หน้าที่ที่ไม่ตรงคอลัมน์เดิม → ถามก่อนว่าจะไว้คอลัมน์ไหน
                svaColAsk(res.unknown, res.entries || [], function (list) {
                    // ไฟล์ที่อ่านเก็บไว้ส่งตอนบันทึก — ตารางรายเดือนของงานจะเก็บไฟล์ไว้ที่หน้าตารางของงานนั้น
                    SVA.imp = { list: list.map(function (e) { e.on = true; return e; }),
                                files: payload.files, ym: mv.length === 2 ? mv[0] + '-' + mv[1] : '' };
                    svaImportPaint();
                }, res.timeHints);
            })
            .withFailureHandler(function (e) {
                btn.disabled = false; btn.innerHTML = '<i class="fas fa-robot"></i> อ่านด้วย AI';
                alert('อ่านไม่สำเร็จ: ' + ((e && e.message) || e));
            })
            .extractStationDutyFromDoc(payload);
    }).catch(function (e) {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-robot"></i> อ่านด้วย AI';
        alert('อ่านไฟล์ไม่สำเร็จ: ' + e);
    });
    inp.value = '';   // เลือกไฟล์เดิมซ้ำได้
}
function svaImportResHtml() {
    var L = SVA.imp && SVA.imp.list;
    if (!L) return '';
    if (!L.length) return '<div class="sva-none">AI อ่านไม่พบรายชื่อเวรในไฟล์นี้</div>';
    var unk = L.filter(function (e) { return !e.matched; }).length;
    var rows = L.map(function (e, i) {
        return '<tr class="' + (e.matched ? '' : 'unk') + '">'
            + '<td><input type="checkbox" ' + (e.on ? 'checked' : '') + ' onchange="SVA.imp.list[' + i + '].on=this.checked;svaImportCount()"></td>'
            + '<td>' + svEsc(e.date) + '</td><td>' + svEsc(e.sec) + (e.time ? '<small>' + svEsc(svTimeText(e.time)) + '</small>' : '') + '</td>'
            + '<td>' + svEsc(e.role) + (e.note ? '<small>' + svEsc(e.note) + '</small>' : '') + '</td>'
            + '<td><input class="form-control form-control-sm" list="' + svaDl(e.sec, e.time, e.role) + '" value="' + svEsc(e.name) + '" onchange="svaImportName(' + i + ',this.value)">'
            + (e.matched ? '' : '<span class="sva-unk">ไม่มีในทะเบียน</span>') + '</td></tr>';
    }).join('');
    return '<div class="sva-imp-sum">อ่านได้ <b>' + L.length + '</b> รายการ' + (unk ? ' · ชื่อที่ไม่ตรงทะเบียน <b class="r">' + unk + '</b> (แก้ชื่อในช่องได้)' : '') + '</div>'
        + '<div class="sva-imp-wrap"><table class="sva-imp-t"><thead><tr><th></th><th>วันที่</th><th>ฝ่าย</th><th>หน้าที่</th><th>ชื่อ</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '<div class="sva-foot"><button type="button" onclick="SVA.imp={list:null};svaImportPaint()">ล้าง</button>'
        + '<button type="button" class="sva-save" id="sva-imp-save" onclick="svaImportSave()"><i class="fas fa-floppy-disk"></i> <span id="sva-imp-n">บันทึก ' + L.filter(function (e) { return e.on; }).length + ' รายการ</span></button></div>';
}
function svaImportName(i, v) {
    // แก้ชื่อแถวหนึ่ง → ทุกแถวที่เป็นชื่อเดิมเดียวกันเปลี่ยนตามทั้งหมด (AI อ่านชื่อผิดแบบเดียวกันทุกวัน)
    var old = SVA.imp.list[i].name, st = svaFindStaff(v);
    SVA.imp.list.forEach(function (e) {
        if (e.name !== old) return;
        e.name = st ? st.name : v; e.pos = st ? st.pos : ''; e.phone = st ? st.phone : ''; e.matched = !!st;
    });
    document.getElementById('sva-imp-res').innerHTML = svaImportResHtml();
}
function svaImportCount() {
    var n = document.getElementById('sva-imp-n');
    if (n) n.textContent = 'บันทึก ' + SVA.imp.list.filter(function (e) { return e.on; }).length + ' รายการ';
}
function svaImportSave() {
    var list = SVA.imp.list.filter(function (e) { return e.on && e.name; });
    if (!list.length) return;
    var btn = document.getElementById('sva-imp-save');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก…';
    google.script.run
        .withSuccessHandler(function (res) {
            SVA.imp = { list: null }; SVA.mode = '';
            var first = svParse(list[0].date); if (first) SVA.date = first;
            svaLoad(true);
            var lines = (res.plan || []).map(function (p) {
                return '• ตาราง' + p.name + ' เดือน' + svaYmText(p.ym) + ' ' + p.days + ' วัน (' + p.saved + ' รายการ)';
            });
            if (res.daily) lines.push('• เวรรายวัน ' + res.daily + ' รายการ');
            if (res.files) lines.push('• เก็บไฟล์ต้นฉบับ ' + res.files + ' ไฟล์ ไว้ที่ "ตารางเวรของแต่ละงาน" (เปิดดู/กรอกอัตโนมัติซ้ำได้)');
            setTimeout(function () { alert('นำเข้าแล้ว ' + res.saved + ' รายการ\n' + lines.join('\n')); }, 50);
        })
        .withFailureHandler(function (e) {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> บันทึก';
            alert('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e));
        })
        .saveStationImport(list.map(function (e) {
            return { date: e.date, sec: e.sec, time: e.time, role: e.role, name: e.name, pos: e.pos, phone: e.phone, note: e.note || '' };
        }), SVA.imp.files || [], SVA.imp.ym || '');
}

// ==========================================================
// ทะเบียนเจ้าหน้าที่ (เพิ่ม/แก้ไข)
// ==========================================================
function svaStaffOpen() { SVA.mode = 'staff'; svaPaint(); }
function svaStaffPaint() {
    var p = document.getElementById('sva-panel'); if (!p) return;
    var depts = ['บริหาร', 'ป้องกันปราบปราม', 'สอบสวน', 'สืบสวน', 'จราจร', 'อำนวยการ', 'อื่น ๆ'];
    var rows = (SVA.data.staff || []).map(function (s) {
        return '<tr onclick="svaStaffFill(\'' + svEsc(s.name).replace(/'/g, '&#39;') + '\')"><td>' + svEsc(s.name) + '</td><td>' + svEsc(svPos(s.pos))
            + '</td><td>' + svEsc(s.dept) + '</td><td>' + svEsc(s.phone) + '</td></tr>';
    }).join('');
    p.innerHTML = '<div class="sva-card"><div class="sva-card-h"><i class="fas fa-address-book"></i> ทะเบียนเจ้าหน้าที่ทุกสายงาน ('
        + (SVA.data.staff || []).length + ' นาย)'
        + '<button type="button" class="sva-x" onclick="svaClose()" title="ปิด"><i class="fas fa-xmark"></i></button></div>'
        + '<div class="sva-hint"><i class="fas fa-circle-info"></i> คลิกชื่อในตารางเพื่อแก้ไข · ชื่อซ้ำ = แก้ไขข้อมูลเดิม · แก้ในชีต "กำลังพล สน." ได้เช่นกัน</div>'
        + '<div class="sva-imp">'
        + '<input id="sva-s-name" class="form-control form-control-sm" placeholder="ยศ ชื่อ สกุล">'
        + '<input id="sva-s-pos" class="form-control form-control-sm" placeholder="ตำแหน่ง">'
        + '<select id="sva-s-dept" class="form-select form-select-sm">' + depts.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select>'
        + '<input id="sva-s-phone" class="form-control form-control-sm" placeholder="เบอร์โทร">'
        + '<button type="button" class="sva-save" onclick="svaStaffSave()"><i class="fas fa-floppy-disk"></i> บันทึก</button></div>'
        + '<div class="sva-imp-wrap"><table class="sva-imp-t sva-staff-t"><thead><tr><th>ยศ ชื่อ สกุล</th><th>ตำแหน่ง</th><th>ฝ่าย</th><th>เบอร์</th></tr></thead><tbody>'
        + rows + '</tbody></table></div></div>';
}
function svaStaffFill(name) {
    var s = (SVA.data.staff || []).filter(function (x) { return x.name === name; })[0]; if (!s) return;
    document.getElementById('sva-s-name').value = s.name;
    document.getElementById('sva-s-pos').value = s.pos;
    document.getElementById('sva-s-dept').value = s.dept || 'อื่น ๆ';
    document.getElementById('sva-s-phone').value = s.phone;
}
function svaStaffSave() {
    var p = {
        name: document.getElementById('sva-s-name').value.trim(), pos: document.getElementById('sva-s-pos').value.trim(),
        dept: document.getElementById('sva-s-dept').value, phone: document.getElementById('sva-s-phone').value.trim()
    };
    if (!p.name) { alert('กรุณาระบุชื่อ'); return; }
    google.script.run
        .withSuccessHandler(function (msg) { svaLoad(true); setTimeout(function () { alert(p.name + ' — ' + msg); }, 50); })
        .withFailureHandler(function (e) { alert('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e)); })
        .saveStationStaff(p);
}

// ==========================================================
// ตารางเวรของแต่ละงาน (ป. / จร. / สส. / ศปก. / อำนวยการ) — แยกหมวดตามงาน รายเดือน
// ไฟล์ต้นฉบับ (ดู / อ่านด้วย AI / แก้ชื่อ / ลบ) + ตารางเวรของงาน (แก้ในตาราง / วนรอบต่อเดือนถัดไป / ลบ)
// + จุดที่ตารางรายวันไม่ตรงกับตารางเวร (เลือก "ตามตารางเวร" / "ตามตารางรายวัน")
// ==========================================================
var SVA_PL_MAX_MB = 15;
function svaYm(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
var SVA_MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function svaDayText(ds) { var d = svParse(ds); return d ? SV_DOW_S[d.getDay()] + ' ' + d.getDate() + ' ' + SVA_MON_S[d.getMonth()] : ds; }
function svaYmText(ym) { return SV_TH_MON[+ym.slice(5, 7) - 1] + ' ' + (+ym.slice(0, 4) + 543); }
function svaPlanOpen() {
    SVA.mode = 'plan';
    SVA.pl = SVA.pl || { unit: 'ป.' };
    SVA.pl.ym = svaYm(SVA.date);
    SVA.pl.d = null; SVA.pl.ed = null;
    svaPaint();
    svaPlanLoad();
}
function svaPlanLoad(then) {
    var pl = SVA.pl, ym = pl.ym;
    svaPlanBusy('กำลังโหลดตารางเวรของแต่ละงาน…');
    google.script.run
        .withSuccessHandler(function (d) { if (SVA.pl.ym !== ym) return; pl.d = d; pl.ed = null; svaPlanPaint(); if (then) then(); })
        .withFailureHandler(function (e) { svaPlanBusy('โหลดไม่สำเร็จ: ' + ((e && e.message) || e), true); })
        .getStationPlan(ym);
}
function svaPlanBusy(msg, err) {
    var p = document.getElementById('sva-panel'); if (!p) return;
    p.innerHTML = '<div class="sva-card"><div class="sva-wait' + (err ? ' sva-err' : '') + '">'
        + (err ? '' : '<i class="fas fa-circle-notch fa-spin"></i> ') + svEsc(msg) + '</div></div>';
}
function svaPlanStep(n) {
    var p = SVA.pl.ym.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1);
    SVA.pl.ym = svaYm(d); svaPlanLoad();
}
function svaPlanUnit(id) { SVA.pl.unit = id; SVA.pl.ed = null; svaPlanPaint(); }
function svaPlanCall(fn, args, done, label) {
    svaPlanBusy(label || 'กำลังบันทึก…');
    var r = google.script.run
        .withSuccessHandler(function (res) { if (done) done(res); })
        .withFailureHandler(function (e) { alert('ไม่สำเร็จ: ' + ((e && e.message) || e)); svaPlanPaint(); });
    r[fn].apply(r, args);
}
// บันทึกแล้วโหลดใหม่ทั้งหน้าตารางงานและตารางเวรรายวัน (ชื่อตามตารางงานเติมให้ทุกวันที่ไม่ได้กรอก)
function svaPlanReload(msg) { svaPlanLoad(); svaLoad(true); if (msg) setTimeout(function () { alert(msg); }, 60); }

/**
 * ช่องของงาน: [{sec,time,role}] ตามแม่แบบ + หน้าที่อื่นที่มีในตารางงานจริง
 * untilKey (yyyymmdd, เฉพาะหน้าดู) = หน้าที่ในแม่แบบที่ยังไม่เริ่มมีถึงวันนั้นและเดือนนี้ไม่มีข้อมูล ไม่แสดงคอลัมน์
 * หน้าแก้ไขไม่ส่ง untilKey — มีครบทุกช่องให้กรอกหน้าที่ใหม่ได้
 */
function svaPlanCols(u, plan, untilKey) {
    var cols = [], seen = {}, has = {}, start = SVA.pl.d.roleStart;
    plan.forEach(function (x) { has[svSlotKey(x.sec, x.time) + '|' + x.role] = 1; });
    function add(sec, time, role) { var k = svSlotKey(sec, time) + '|' + role; if (!seen[k]) { seen[k] = 1; cols.push({ sec: sec, time: time || '', role: role }); } }
    (SVA.pl.d.template || []).forEach(function (t) {
        if (u.secs.indexOf(t.sec) < 0) return;
        t.roles.forEach(function (r) {
            var k = svSlotKey(t.sec, t.time) + '|' + r;
            // ยังไม่เริ่มมี = ไม่แสดง (ยกเว้นหน้าที่ที่มีชื่อประจำ เช่น หัวหน้าสถานี)
            if (untilKey && start && !has[k] && !(start[k] && start[k] <= untilKey) && !svaFixHist()[k]) return;
            add(t.sec, t.time, r);
        });
    });
    plan.forEach(function (x) { add(x.sec, x.time, x.role); });
    return cols;
}
/**
 * ตารางที่ใช้จริงของงานทั้งเดือน = ตารางของงาน แล้วช่องที่มีเวรรายวัน (กรอกเอง/นำเข้าจากไฟล์) ใช้ตามรายวัน
 * เหมือนที่ตารางเวรประจำวันแสดง — ข้อมูลที่นำเข้ามาจึงเห็นและแก้ได้ในหน้านี้ด้วย
 */
function svaPlanEff(uid) {
    var cell = {}, order = [];
    function put(x, src) {
        var k = x.date + '|' + svSlotKey(x.sec, x.time) + '|' + x.role;
        if (!cell[k]) { cell[k] = { src: src, list: [] }; order.push(k); }
        else if (cell[k].src !== src) { if (src !== 'daily') return; cell[k] = { src: src, list: [] }; }
        cell[k].list.push({ date: x.date, sec: x.sec, time: x.time || '', role: x.role, name: x.name, note: x.note || '', src: src });
    }
    svaPlanOf(uid).forEach(function (x) { put(x, 'plan'); });
    ((SVA.pl.d && SVA.pl.d.daily) || []).filter(function (x) { return x.unit === uid; }).forEach(function (x) { put(x, 'daily'); });
    var out = [];
    order.forEach(function (k) { out = out.concat(cell[k].list); });
    return out;
}
function svaPlanUnitObj() { return (SVA.pl.d.units || []).filter(function (u) { return u.id === SVA.pl.unit; })[0] || SVA.pl.d.units[0]; }
function svaPlanOf(uid) { return (SVA.pl.d.plan || []).filter(function (x) { return x.unit === uid; }); }

function svaPlanPaint() {
    var p = document.getElementById('sva-panel'), pl = SVA.pl;
    if (!p || SVA.mode !== 'plan' || !pl || !pl.d) return;
    var d = pl.d, u = svaPlanUnitObj(), plan = svaPlanEff(u.id);
    var files = (d.files || []).filter(function (f) { return f.unit === u.id; });
    var mis = d.mismatches || [], umis = mis.filter(function (m) { return m.unit === u.id; });
    var tabs = (d.units || []).map(function (x) {
        var days = {}; svaPlanEff(x.id).forEach(function (e) { days[e.date] = 1; });
        var nd = Object.keys(days).length, nf = (d.files || []).filter(function (f) { return f.unit === x.id; }).length;
        var nm = mis.filter(function (m) { return m.unit === x.id; }).length;
        return '<button type="button" class="' + (x.id === u.id ? 'on' : '') + '" onclick="svaPlanUnit(\'' + x.id + '\')">'
            + '<b>' + svEsc(x.short) + '</b><small>' + (nd ? nd + ' วัน' : 'ยังไม่มีตาราง') + (nf ? ' · ' + nf + ' ไฟล์' : '') + '</small>'
            + (nm ? '<span class="sva-pl-bad">' + nm + '</span>' : '') + '</button>';
    }).join('');
    var html = '<div class="sva-card sva-pl"><div class="sva-card-h"><i class="fas fa-folder-open"></i> ตารางเวรของแต่ละงาน'
        + '<div class="sva-pl-nav"><button type="button" onclick="svaPlanStep(-1)" title="เดือนก่อน"><i class="fas fa-chevron-left"></i></button>'
        + '<b>' + svaYmText(pl.ym) + '</b><button type="button" onclick="svaPlanStep(1)" title="เดือนถัดไป"><i class="fas fa-chevron-right"></i></button></div>'
        + '<button type="button" class="sva-x" onclick="svaClose()" title="ปิด"><i class="fas fa-xmark"></i></button></div>'
        + '<div class="sva-hint"><i class="fas fa-circle-info"></i> เวรรายวันที่กรอกไว้เป็นหลัก · วันที่ไม่ได้กรอกใช้ตามตารางของงานอัตโนมัติ · '
        + 'ชื่อไม่ตรงกันจะกระพริบสีส้มในตารางเวร</div>'
        + (mis.length ? svaPlanMisHtml(mis) : '<div class="sva-pl-ok"><i class="fas fa-circle-check"></i> ตารางรายวันเดือนนี้ตรงกับตารางเวรของทุกงาน</div>')
        + svaPlanPhoneHtml(d.phoneMismatches || [])
        + '<div class="sva-pl-tabs">' + tabs + '</div>'
        // ---- ไฟล์ต้นฉบับ ----
        + '<div class="sva-pl-sec"><div class="sva-pl-sh"><i class="fas fa-paperclip"></i> ไฟล์ต้นฉบับ (แหล่งข้อมูล) ตารางเวร' + svEsc(u.name) + ' เดือน' + svaYmText(pl.ym) + '</div>'
        + (files.length ? files.map(svaPlanFileHtml).join('') : '<div class="sva-none">ยังไม่มีไฟล์ของเดือนนี้</div>')
        + '<div class="sva-pl-up"><input type="file" id="sva-pl-file" hidden multiple accept="image/*,.pdf,.xlsx,.xls,.csv" onchange="svaPlanUpload()">'
        + '<button type="button" class="sva-save" onclick="document.getElementById(\'sva-pl-file\').click()" title="เลือกคำสั่ง/ตารางเวร (PDF รูป Excel) — อัปโหลดแล้ว AI กรอกตารางให้ตรวจทันที">'
        + '<i class="fas fa-file-arrow-up"></i> อัปโหลด/กรอกอัตโนมัติ</button></div></div>'
        // ---- ตารางเวรของงาน ----
        + '<div class="sva-pl-sec"><div class="sva-pl-sh"><i class="fas fa-table-list"></i> ตารางเวร' + svEsc(u.name)
        + (plan.length ? ' <small>(' + Object.keys(plan.reduce(function (a, e) { a[e.date] = 1; return a; }, {})).length + ' วัน)</small>' : '') + '</div>'
        + (pl.ed ? svaPlanEdHtml(u) : svaPlanViewHtml(u, plan, umis))
        + '</div></div>';
    p.innerHTML = html;
}

function svaPlanMisHtml(mis) {
    return '<div class="sva-pl-mis"><div class="sva-pl-mis-h"><i class="fas fa-triangle-exclamation"></i> ตารางรายวันไม่ตรงกับตารางเวร ' + mis.length + ' จุด — เลือกว่าจะใช้ชื่อตามตารางไหน</div>'
        + mis.map(function (m, i) {
            return '<div class="sva-pl-mi"><div class="sva-pl-mt"><b>' + svEsc(svaDayText(m.date)) + '</b> · ' + svEsc(m.unit) + ' ' + svEsc(m.role)
                + (m.time ? ' <small>' + svEsc(svTimeText(m.time)) + '</small>' : '') + '</div>'
                + '<div class="sva-pl-mv"><span>ตารางรายวัน: <b>' + svEsc(m.daily.join(', ')) + '</b></span><span>ตารางเวร: <b>' + svEsc(m.plan.join(', ')) + '</b></span></div>'
                + '<div class="sva-pl-mb"><button type="button" onclick="svaPlanFix(' + i + ',\'plan\')" title="ใช้ชื่อตามตารางเวรของงาน (ลบชื่อที่กรอกในตารางรายวันของวันนั้น)"><i class="fas fa-table-list"></i> ใช้ตารางงาน</button>'
                + '<button type="button" onclick="svaPlanFix(' + i + ',\'daily\')" title="ใช้ชื่อตามตารางรายวัน (แก้ตารางเวรของงานให้ตรง เช่น มีการแลกเวร)"><i class="fas fa-calendar-day"></i> ใช้รายวัน</button>'
                + '<button type="button" onclick="svaPlanGoDay(' + i + ')" title="เปิดเวรรายวันวันนั้น" aria-label="เปิดวันนั้น"><i class="fas fa-arrow-up-right-from-square"></i></button></div></div>';
        }).join('') + '</div>';
}
// เบอร์โทรตามใบเวรไม่ตรงฐานข้อมูลกำลังพล: เลือกแก้ฐานข้อมูลตามใบเวร หรือใช้เบอร์ในฐานข้อมูลต่อ
function svaPlanPhoneHtml(list) {
    if (!list.length) return '';
    return '<div class="sva-pl-mis"><div class="sva-pl-mis-h"><i class="fas fa-phone-slash"></i> เบอร์โทรในใบเวรไม่ตรงกับฐานข้อมูลกำลังพล ' + list.length + ' คน</div>'
        + list.map(function (m, i) {
            return '<div class="sva-pl-mi"><div class="sva-pl-mt"><b>' + svEsc(m.name) + '</b> <small>(' + m.dates.map(function (ds) { return svaDayText(ds); }).join(', ') + ')</small></div>'
                + '<div class="sva-pl-mv"><span>ใบเวร: <b>' + svEsc(m.sheet) + '</b></span><span>ฐานข้อมูล: <b>' + svEsc(m.db) + '</b></span></div>'
                + '<div class="sva-pl-mb"><button type="button" onclick="svaPlanPhone(' + i + ',\x27db\x27)" title="แก้เบอร์ในฐานข้อมูลกำลังพลเป็นเบอร์ตามใบเวร (ใช้ทุกวันต่อจากนี้)"><i class="fas fa-address-book"></i> ใช้เบอร์ใบเวร</button>'
                + '<button type="button" onclick="svaPlanPhone(' + i + ',\x27sheet\x27)" title="ใช้เบอร์ในฐานข้อมูลต่อ (ไม่แก้)"><i class="fas fa-xmark"></i> ใช้เบอร์เดิม</button></div></div>';
        }).join('') + '</div>';
}
function svaPlanPhone(i, mode) {
    var m = (SVA.pl.d.phoneMismatches || [])[i]; if (!m) return;
    svaPlanCall('resolveStationPhone', [m.name, m.sheet, mode], function () { svaPlanReload(); });
}
function svaPlanFix(i, mode) {
    var m = SVA.pl.d.mismatches[i]; if (!m) return;
    svaPlanCall('resolveStationMismatch', [m.date, m.sec, m.time, m.role, mode], function () { svaPlanReload(); });
}
function svaPlanGoDay(i) {
    var m = SVA.pl.d.mismatches[i]; if (!m) return;
    SVA.date = svParse(m.date); SVA.view = 'day'; SVA.mode = '';
    svaLoad(false);
}

function svaPlanFileHtml(f) {
    var ic = /pdf/.test(f.type) ? 'fa-file-pdf' : /image/.test(f.type) ? 'fa-file-image' : 'fa-file-excel';
    var kb = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB';
    var canAi = /pdf|image/.test(f.type);
    return '<div class="sva-pl-f"><i class="fas ' + ic + '"></i><div class="sva-pl-fn"><b>' + svEsc(f.name) + '</b>'
        + '<small>' + kb + ' · ' + svEsc(f.at) + (f.note ? ' · ' + svEsc(f.note) : '') + '</small></div>'
        + '<div class="sva-pl-fb"><button type="button" onclick="svaPlanFileView(\'' + f.id + '\')" title="ดูไฟล์" aria-label="ดูไฟล์"><i class="fas fa-eye"></i></button>'
        + (canAi ? '<button type="button" onclick="svaPlanAI(\'' + f.id + '\')" title="กรอกตารางอัตโนมัติจากไฟล์นี้ (AI)" aria-label="กรอกอัตโนมัติ"><i class="fas fa-robot"></i></button>' : '')
        + '<button type="button" onclick="svaPlanFileEdit(\'' + f.id + '\')" title="แก้ชื่อไฟล์/หมายเหตุ" aria-label="แก้ไข"><i class="fas fa-pen"></i></button>'
        + '<button type="button" class="del" onclick="svaPlanFileDel(\'' + f.id + '\')" title="ลบไฟล์" aria-label="ลบไฟล์"><i class="fas fa-trash-can"></i></button></div></div>';
}
function svaPlanFileOf(id) { return (SVA.pl.d.files || []).filter(function (f) { return f.id === id; })[0]; }
function svaPlanUpload() {
    var inp = document.getElementById('sva-pl-file');
    var files = inp && inp.files ? [].slice.call(inp.files) : [];
    if (!files.length) { alert('กรุณาเลือกไฟล์ก่อน'); return; }
    var big = files.filter(function (f) { return f.size > SVA_PL_MAX_MB * 1048576; })[0];
    if (big) { alert('ไฟล์ "' + big.name + '" ใหญ่เกิน ' + SVA_PL_MAX_MB + ' MB'); return; }
    var note = '', pl = SVA.pl, i = 0, aiId = '';
    inp.value = '';
    function next(res) {
        if (res && res.id && /pdf|image/.test(files[i - 1].type || '')) aiId = res.id;
        if (i >= files.length) {
            svaLoad(true);
            svaPlanLoad(function () {
                if (aiId) svaPlanAI(aiId);   // PDF/รูป: AI กรอกตารางให้ตรวจทันที (Excel เก็บเป็นไฟล์ต้นฉบับ)
            });
            return;
        }
        var f = files[i++];
        svaPlanBusy('กำลังอัปโหลด ' + f.name + ' (' + i + '/' + files.length + ')…');
        var r = new FileReader();
        r.onload = function (e) {
            google.script.run
                .withSuccessHandler(next)
                .withFailureHandler(function (err) { alert('อัปโหลด ' + f.name + ' ไม่สำเร็จ: ' + ((err && err.message) || err)); svaPlanReload(); })
                .uploadStationFile(pl.unit, pl.ym, { name: f.name, mimeType: f.type || 'application/pdf', data: String(e.target.result).split(',')[1] }, note);
        };
        r.onerror = function () { alert('อ่านไฟล์ ' + f.name + ' ไม่สำเร็จ'); svaPlanReload(); };
        r.readAsDataURL(f);
    }
    next();
}
// เปิดดูไฟล์: เปิดหน้าต่างก่อน (หลังรอโหลดเบราว์เซอร์จะบล็อก) แล้วใส่ไฟล์ตามมา
function svaPlanFileView(id) {
    var f = svaPlanFileOf(id); if (!f) return;
    var w = svOpenWin();   // เว็บแอปบนหน้าจอโฮม iPhone = หน้าต่างซ้อนมีปุ่มกลับ
    if (!w) { alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ — กรุณาอนุญาตป๊อปอัป'); return; }
    w.document.write('<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + svEsc(f.name) + '</title>'
        + '<p style="font-family:sans-serif;padding:24px;color:#334155">กำลังเปิด ' + svEsc(f.name) + '…</p>');
    google.script.run
        .withSuccessHandler(function (x) {
            var bin = atob(x.data), arr = new Uint8Array(bin.length);
            for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
            var url = URL.createObjectURL(new Blob([arr], { type: x.mimeType }));
            var body = /^image\//.test(x.mimeType) ? '<img src="' + url + '" style="max-width:100%;display:block;margin:0 auto">'
                : /pdf/.test(x.mimeType) ? '<iframe src="' + url + '" style="border:0;width:100%;height:calc(100vh - 52px)"></iframe>'
                : '<p style="padding:24px">ไฟล์ชนิดนี้เปิดในเบราว์เซอร์ไม่ได้ — กดดาวน์โหลด</p>';
            w.document.open();
            w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + svEsc(x.name) + '</title></head>'
                + '<body style="margin:0;background:#e2e8f0;font-family:sans-serif"><div style="display:flex;gap:10px;align-items:center;padding:10px 14px;background:#0f172a;color:#fff">'
                + '<b style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + svEsc(x.name) + '</b>'
                + '<a href="' + url + '" download="' + svEsc(x.name) + '" style="color:#fff;background:#1d4ed8;padding:6px 12px;border-radius:8px;text-decoration:none;font-weight:700">ดาวน์โหลด</a></div>'
                + body + '</body></html>');
            w.document.close();
        })
        .withFailureHandler(function (e) { w.close(); alert('เปิดไฟล์ไม่สำเร็จ: ' + ((e && e.message) || e)); })
        .getStationFileData(id);
}
function svaPlanFileEdit(id) {
    var f = svaPlanFileOf(id); if (!f) return;
    var name = prompt('ชื่อไฟล์', f.name); if (name == null) return;
    var note = prompt('หมายเหตุไฟล์ (เว้นว่างได้)', f.note || ''); if (note == null) return;
    svaPlanCall('updateStationFile', [id, { name: name.trim() || f.name, note: note.trim() }], function () { svaPlanLoad(); });
}
function svaPlanFileDel(id) {
    var f = svaPlanFileOf(id); if (!f) return;
    if (!confirm('ลบไฟล์ "' + f.name + '" ?\n(ไฟล์ย้ายไปถังขยะของ Google Drive กู้คืนได้ภายใน 30 วัน · ตารางเวรที่บันทึกไว้ไม่ถูกลบ)')) return;
    svaPlanCall('deleteStationFile', [id], function () { svaPlanLoad(); }, 'กำลังลบไฟล์…');
}
function svaPlanAI(id) {
    var f = svaPlanFileOf(id); if (!f) return;
    svaPlanCall('extractStationPlanFromFile', [id], function (res) {
        if (!res.entries.length) { alert('AI อ่านไม่พบรายชื่อเวรของงานนี้ในเดือน' + svaYmText(res.ym) + ' จากไฟล์นี้'); svaPlanPaint(); return; }
        SVA.pl.unit = res.unit;
        svaPlanPaint();
        var short = res.monthDays && res.days < res.monthDays;
        svaColAsk(res.unknown, res.entries, function (list) {
            svaPlanEditStart(list, 'AI อ่านจาก "' + f.name + '" ได้ ' + list.length + ' รายการ ครบ ' + res.days + (res.monthDays ? '/' + res.monthDays : '') + ' วัน'
                + (short ? ' ⚠️ ยังขาด ' + (res.monthDays - res.days) + ' วัน' + (res.missing && res.missing.length ? ' (' + res.missing.map(function (d) { return +d.slice(0, 2); }).join(', ') + ')' : '') + ' เพิ่มเองในตารางได้' : '')
                + ' — ตรวจ/แก้ในตารางแล้วกดบันทึก (ยังไม่ได้บันทึก)');
        }, res.timeHints);
    }, 'AI กำลังอ่าน ' + f.name + '… (ตารางทั้งเดือนอาจใช้เวลา ๓๐ วินาที – ๒ นาที)');
}

// ---- ดูตารางของงาน (อ่านอย่างเดียว) ----
function svaPlanViewHtml(u, plan, umis) {
    var hasPlan = svaPlanOf(u.id).length;
    var nDaily = {}; plan.forEach(function (x) { if (x.src === 'daily') nDaily[x.date] = 1; });
    // กรอกอัตโนมัติจากไฟล์ = ปุ่มอัปโหลดด้านบน / ไอคอน AI ที่ไฟล์ (ไม่มีปุ่มซ้ำตรงนี้)
    var btns = '<div class="sva-pl-acts"><button type="button" class="sva-save" onclick="svaPlanEditStart()" title="แก้ไขตารางทั้งเดือน (ชื่อ / เวลา)"><i class="fas fa-pen-to-square"></i> ' + (plan.length ? 'แก้ไขทั้งเดือน' : 'สร้างตาราง') + '</button>'
        + (hasPlan ? '<button type="button" onclick="svaPlanContinue()" title="สร้างตารางเดือนถัดไปโดยวนรอบเวรเดิม"><i class="fas fa-rotate-right"></i> วนรอบเดือนหน้า</button>' : '')
        + '<button type="button" onclick="svaColsOpen()" title="เพิ่ม/ลบ/เปลี่ยนชื่อ/เรียงคอลัมน์ (หน้าที่) และเวลาเข้าเวร"><i class="fas fa-table-columns"></i> คอลัมน์</button>'
        + (plan.length ? '<button type="button" class="del" onclick="svaPlanClear()" title="ล้างตารางของงานและเวรรายวันของงานนี้ทั้งเดือน (ไฟล์ต้นฉบับไม่ถูกลบ)" aria-label="ล้างข้อมูลทั้งเดือน"><i class="fas fa-eraser"></i><span class="sva-tx"> ล้างเดือนนี้</span></button>' : '') + '</div>'
        + (Object.keys(nDaily).length ? '<div class="sva-hint"><i class="fas fa-circle-info"></i> ' + Object.keys(nDaily).length + ' วันใช้ข้อมูลจากเวรรายวัน/ที่นำเข้าจากไฟล์ — กด "แก้ไขทั้งเดือน" แล้วบันทึก จะรวมเป็นตารางของงานชุดเดียว</div>' : '');
    if (!plan.length) return '<div class="sva-none">ยังไม่มีตารางของงานนี้ในเดือนนี้ — กด "อัปโหลด/กรอกอัตโนมัติ" หรือ "สร้างตาราง"</div>' + btns;
    var ymP = SVA.pl.ym.split('-');
    var cols = svaPlanCols(u, plan, +ymP[0] * 10000 + +ymP[1] * 100 + new Date(+ymP[0], +ymP[1], 0).getDate()), cell = {}, bad = {};
    plan.forEach(function (x) { var k = x.date + '|' + svSlotKey(x.sec, x.time) + '|' + x.role; (cell[k] = cell[k] || []).push(x.name); });
    umis.forEach(function (m) { bad[m.date + '|' + svSlotKey(m.sec, m.time) + '|' + m.role] = m.daily.join(', '); });
    var p = SVA.pl.ym.split('-'), last = new Date(+p[0], +p[1], 0).getDate(), todayK = svKey(new Date());
    var body = '', names = SVA.pl.names = [];
    var nameHtml = function (x) {
        var i = names.indexOf(x); if (i < 0) { i = names.length; names.push(x); }
        return '<span class="sva-nm' + (svaFindStaff(x) ? '' : ' unk') + '" onclick="svaPlanRename(' + i + ')" title="' + svEsc(x) + ' — แตะเพื่อแก้ชื่อนี้ทุกช่องในตาราง">' + svEsc(svShort(x)) + '</span>';
    };
    for (var dd = 1; dd <= last; dd++) {
        var dt = new Date(+p[0], +p[1] - 1, dd), ds = svDateStr(dt), dow = dt.getDay();
        body += '<tr class="' + (dow === 0 || dow === 6 ? 'we' : '') + (svKey(dt) === todayK ? ' td' : '') + '"><th>' + dd + ' <small>' + SV_DOW_S[dow] + '</small></th>'
            + cols.map(function (c) {
                var k = ds + '|' + svSlotKey(c.sec, c.time) + '|' + c.role, n = cell[k];
                var fx = !n && svaFixAt(svSlotKey(c.sec, c.time) + '|' + c.role, svKey(dt));
                return '<td' + (bad[k] ? ' class="sv-mis" title="ตารางรายวัน: ' + svEsc(bad[k]) + '"' : '') + '>'
                    + (n ? n.map(nameHtml).join('<br>') : fx ? '<span class="sva-fx" title="ชื่อประจำ ' + svEsc(fx.name) + '"><i class="fas fa-thumbtack"></i> ' + svEsc(svShort(fx.name)) + '</span>' : '<span class="sv-dash">—</span>') + '</td>';
            }).join('') + '</tr>';
    }
    var unk = names.filter(function (x) { return !svaFindStaff(x); }).length;
    return btns + '<div class="sva-hint"><i class="fas fa-hand-pointer"></i> แตะชื่อในตารางเพื่อแก้ชื่อนั้นทุกช่องพร้อมกัน (เช่น AI อ่านการันต์ไม่ขึ้น/สะกดผิด)'
        + (unk ? ' · <b class="r">ชื่อสีส้ม ' + unk + ' ชื่อ ไม่ตรงทะเบียน</b>' : '') + '</div>'
        + '<div class="sva-pl-grid"><table><thead><tr><th>วันที่</th>' + cols.map(svaPlanColHead).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}
function svaPlanRename(i) {
    var old = (SVA.pl.names || [])[i]; if (!old) return;
    var u = svaPlanUnitObj(), n = svaPlanEff(u.id).filter(function (x) { return x.name === old; }).length;
    var v = svaAskRename(old, 'ในตาราง' + u.name + ' เดือน' + svaYmText(SVA.pl.ym), n);
    if (!v) return;
    svaPlanCall('renameStationName', [u.id, SVA.pl.ym, old, v], function (res) {
        svaPlanReload('แก้ชื่อเป็น "' + v + '" แล้ว ' + ((res.plan || 0) + (res.daily || 0)) + ' ช่อง');
    }, 'กำลังแก้ชื่อทุกช่อง…');
}
function svaPlanColHead(c) {
    var k = svSlotKey(c.sec, c.time) + '|' + c.role, pin = svaFixHist()[k] || c.role === 'หัวหน้าสถานี';
    return '<th>' + svEsc(c.role)
        + (pin ? ' <button type="button" class="sva-fxbtn" data-k="' + svEsc(k) + '" onclick="svaFixOpen(this.dataset.k)" title="ชื่อประจำ / เปลี่ยนคนใหม่ตั้งแต่วันที่ / ตำแหน่ง" aria-label="ชื่อประจำ"><i class="fas fa-thumbtack"></i></button>' : '')
        + (c.time ? '<small>' + svEsc(svTimeText(c.time).replace(' (ของวันรุ่งขึ้น)', '')) + '</small>' : '') + '</th>';
}

// ---- แก้ตารางของงานทั้งเดือน (ช่อง = ชื่อ คั่นหลายคนด้วย ,) ----
function svaPlanEditStart(entries, banner) {
    var u = svaPlanUnitObj(), eff = svaPlanEff(u.id), plan = entries || eff;
    var cols = svaPlanCols(u, plan.concat(eff)), val = {}, note = {};
    plan.forEach(function (x) {
        var k = svDateStr(svParse(x.date)) + '|' + svSlotKey(x.sec, x.time) + '|' + x.role;
        (val[k] = val[k] || []).push(x.name);
        if (x.note) note[k] = x.note;
    });
    // หมายเหตุเดิม (เช่น ชุด 3 / 05.00-21.00 น.) เก็บไว้ · ช่องใหม่ใช้หมายเหตุที่พบบ่อยของคอลัมน์ (เช่นช่วงเวลา)
    eff.forEach(function (x) { var k = x.date + '|' + svSlotKey(x.sec, x.time) + '|' + x.role; if (x.note && !note[k]) note[k] = x.note; });
    SVA.pl.ed = { cols: cols, val: val, note: note, banner: banner || '' };
    svaPlanPaint();
}
function svaPlanEdHtml(u) {
    var ed = SVA.pl.ed, p = SVA.pl.ym.split('-'), last = new Date(+p[0], +p[1], 0).getDate();
    var body = '', dls = [];   // ตัวเลือกชื่อเฉพาะหน้าที่ของแต่ละคอลัมน์
    for (var dd = 1; dd <= last; dd++) {
        var dt = new Date(+p[0], +p[1] - 1, dd), ds = svDateStr(dt), dow = dt.getDay();
        body += '<tr class="' + (dow === 0 || dow === 6 ? 'we' : '') + '"><th>' + dd + ' <small>' + SV_DOW_S[dow] + '</small></th>'
            + ed.cols.map(function (c, ci) {
                var dl = dls[ci] || (dls[ci] = svaDl(c.sec, c.time, c.role));
                var k = ds + '|' + svSlotKey(c.sec, c.time) + '|' + c.role, v = (ed.val[k] || []).join(', ');
                var unk = v && v.split(',').some(function (n) { return n.trim() && !svaFindStaff(n.trim()); });
                var fx = svaFixAt(svSlotKey(c.sec, c.time) + '|' + c.role, svKey(dt));   // ว่าง = ชื่อประจำ
                return '<td><input class="' + (unk ? 'unk' : '') + '" list="' + dl + '" data-k="' + svEsc(k) + '" value="' + svEsc(v) + '"'
                    + (fx ? ' placeholder="📌 ' + svEsc(svShort(fx.name)) + '"' : '') + ' onchange="svaPlanEdSet(this)"></td>';
            }).join('') + '</tr>';
    }
    var cnt = {};
    Object.keys(ed.val).forEach(function (k) { ed.val[k].forEach(function (n) { cnt[n] = (cnt[n] || 0) + 1; }); });
    ed.names = Object.keys(cnt).sort(function (a, b) { return (!!svaFindStaff(a) - !!svaFindStaff(b)) || cnt[b] - cnt[a]; });
    var chips = ed.names.map(function (n, i) {
        return '<button type="button" class="sva-nchip' + (svaFindStaff(n) ? '' : ' unk') + '" onclick="svaPlanEdRename(' + i + ')" title="แตะเพื่อแก้ชื่อนี้ทุกช่อง">'
            + svEsc(n) + ' <small>' + cnt[n] + '</small></button>';
    }).join('');
    return (ed.banner ? '<div class="sva-pl-ai"><i class="fas fa-robot"></i> ' + svEsc(ed.banner) + '</div>' : '')
        + (chips ? '<div class="sva-nchips"><div class="sva-nchips-h"><i class="fas fa-user-pen"></i> ชื่อในตาราง — แตะชื่อเพื่อแก้ทุกช่องพร้อมกัน (สีส้ม = ไม่ตรงทะเบียน)</div>' + chips + '</div>' : '')
        + '<div class="sva-hint"><i class="fas fa-keyboard"></i> พิมพ์หรือกดเลือกชื่อ — ตัวเลือกแต่ละช่องเรียงจากคนที่เคยเข้าเวรหน้าที่นั้นบ่อยสุด ตามด้วยคนตำแหน่งเดียวกัน · หลายคนในช่องเดียวคั่นด้วย , · ช่องว่าง = ไม่มีเวร · ช่องสีส้ม = ชื่อไม่มีในทะเบียน</div>'
        + '<div class="sva-pl-grid ed"><table><thead><tr><th>วันที่</th>' + ed.cols.map(svaPlanColHead).join('') + '</tr>'
        + '<tr class="sva-pl-tm"><th title="เวลาเข้าเวรที่แสดงหลังชื่อในใบเวร">เวลา</th>' + ed.cols.map(function (c, ci) {
            var t = svaTpl().filter(function (x) { return x.sec === c.sec && (x.time || '') === (c.time || ''); })[0];
            return '<th><input value="' + svEsc(svaPlanColTime(c)) + '" placeholder="' + svEsc(svRoleTime(t, c.role) || 'เช่น 05.00-21.00 น.') + '"'
                + ' title="เวลาหลังชื่อทุกวันในคอลัมน์นี้ (เว้นว่าง = ใช้เวลาประจำหน้าที่)" onchange="svaPlanColTimeSet(' + ci + ',this.value)"></th>';
        }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        + '<div class="sva-foot"><button type="button" onclick="SVA.pl.ed=null;svaPlanPaint()">ยกเลิก</button>'
        + '<button type="button" class="sva-save" onclick="svaPlanSave()"><i class="fas fa-floppy-disk"></i> บันทึกตาราง' + svEsc(u.short) + ' ทั้งเดือน</button></div>';
}
/** เวลาของคอลัมน์ในเดือนนี้ = หมายเหตุที่ใช้กันเกือบทุกช่อง (ช่องที่ต่างกันมาก = ว่าง) */
function svaPlanColTime(c) {
    var ed = SVA.pl.ed, suf = '|' + svSlotKey(c.sec, c.time) + '|' + c.role, cnt = {}, n = 0;
    Object.keys(ed.val).forEach(function (k) {
        if (k.slice(-suf.length) !== suf || !ed.val[k].length) return;
        n++; var v = ed.note[k] || ''; cnt[v] = (cnt[v] || 0) + 1;
    });
    var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0] || '';
    return n && cnt[top] >= 0.8 * n ? top : '';
}
function svaPlanColTimeSet(ci, v) {
    var ed = SVA.pl.ed, c = ed.cols[ci], p = SVA.pl.ym.split('-'), last = new Date(+p[0], +p[1], 0).getDate();
    v = String(v || '').replace(/\s+/g, ' ').trim();
    for (var dd = 1; dd <= last; dd++) ed.note[svDateStr(new Date(+p[0], +p[1] - 1, dd)) + '|' + svSlotKey(c.sec, c.time) + '|' + c.role] = v;
}
function svaPlanEdRename(i) {
    var ed = SVA.pl.ed, old = ed && ed.names[i]; if (!old) return;
    var n = 0; Object.keys(ed.val).forEach(function (k) { ed.val[k].forEach(function (x) { if (x === old) n++; }); });
    var v = svaAskRename(old, 'ในตารางนี้', n);
    if (!v) return;
    Object.keys(ed.val).forEach(function (k) {
        ed.val[k] = ed.val[k].map(function (x) { return x === old ? v : x; })
            .filter(function (x, j, a) { return a.indexOf(x) === j; });   // แก้แล้วชื่อซ้ำในช่องเดียวกัน = เหลือชื่อเดียว
    });
    svaPlanPaint();
}
function svaPlanEdSet(inp) {
    var names = inp.value.split(/[,\n]/).map(function (n) { return n.trim(); }).filter(function (n) { return n; }).map(function (n) {
        var st = svaFindStaff(n); return st ? st.name : n;
    });
    SVA.pl.ed.val[inp.dataset.k] = names;
    inp.value = names.join(', ');
    inp.classList.toggle('unk', names.some(function (n) { return !svaFindStaff(n); }));
}
function svaPlanSave() {
    var ed = SVA.pl.ed, u = svaPlanUnitObj(), entries = [], colNote = {};
    // หมายเหตุประจำคอลัมน์ (เช่นช่วงเวลา 05.00-21.00 น.) = ช่องเดิมเกือบทั้งหมดใช้ข้อความเดียวกัน → ใช้กับช่องที่เพิ่มใหม่ด้วย
    var colCells = {};
    Object.keys(ed.note).forEach(function (k) { var c = k.split('|').slice(1).join('|'); colNote[c] = colNote[c] || {}; colNote[c][ed.note[k]] = (colNote[c][ed.note[k]] || 0) + 1; });
    Object.keys(ed.val).forEach(function (k) { var c = k.split('|').slice(1).join('|'); colCells[c] = (colCells[c] || 0) + 1; });
    Object.keys(ed.val).forEach(function (k) {
        var parts = k.split('|'), c = parts.slice(1).join('|');
        var top = Object.keys(colNote[c] || {}).sort(function (a, b) { return colNote[c][b] - colNote[c][a]; })[0] || '';
        var common = top && colNote[c][top] >= 0.8 * (colCells[c] || 1) ? top : '';
        ed.val[k].forEach(function (n) {
            entries.push({ date: parts[0], sec: parts[1], time: parts[2], role: parts[3], name: n, note: ed.note[k] || common });
        });
    });
    // ตารางในหน้านี้รวมเวรรายวันของเดือนนี้ไว้แล้ว → บันทึกเป็นตารางของงานชุดเดียว (ล้างเวรรายวันของงานนี้ในเดือนนี้)
    svaPlanCall('saveStationPlan', [u.id, SVA.pl.ym, entries, { replaceDaily: true }], function (res) {
        svaPlanReload('บันทึกตาราง' + u.name + ' เดือน' + svaYmText(SVA.pl.ym) + ' แล้ว (' + res.saved + ' รายการ)');
    });
}
function svaPlanContinue() {
    var u = svaPlanUnitObj(), pl = SVA.pl;
    var go = function (overwrite) {
        svaPlanBusy('กำลังสร้างตารางเดือนถัดไป…');
        google.script.run
            .withSuccessHandler(function (res) {
                pl.ym = res.ym;
                svaPlanReload('สร้างตาราง' + u.name + ' เดือน' + svaYmText(res.ym) + ' แล้ว (วนรอบทุก ' + res.period + ' วัน · ' + res.saved + ' รายการ)\nตรวจทานได้ที่หน้านี้');
            })
            .withFailureHandler(function (e) {
                var m = (e && e.message) || String(e);
                if (/EXISTS/.test(m)) {
                    if (confirm('เดือนถัดไปมีตาราง' + u.name + 'อยู่แล้ว — แทนที่ด้วยการวนรอบจากเดือนนี้?')) go(true); else svaPlanPaint();
                    return;
                }
                alert(m); svaPlanPaint();
            })
            .continueStationPlan(u.id, pl.ym, !!overwrite);
    };
    go(false);
}
function svaPlanClear() {
    var u = svaPlanUnitObj();
    if (!confirm('ล้างข้อมูลเวร' + u.name + ' เดือน' + svaYmText(SVA.pl.ym) + ' ทั้งหมด?\n\n'
        + '• ลบตารางของงาน และเวรรายวันของงานนี้ทุกวันในเดือนนี้ (รวมที่นำเข้าจากไฟล์)\n'
        + '• ไฟล์ต้นฉบับไม่ถูกลบ — กด "กรอกอัตโนมัติจากไฟล์" เพื่อสร้างใหม่ได้')) return;
    svaPlanCall('clearStationUnitMonth', [u.id, SVA.pl.ym], function (msg) { svaPlanReload(msg); }, 'กำลังล้างข้อมูล…');
}
function svaPlanDelete() {
    var u = svaPlanUnitObj();
    if (!confirm('ลบตาราง' + u.name + ' เดือน' + svaYmText(SVA.pl.ym) + ' ทั้งเดือน?\n(ไฟล์ต้นฉบับไม่ถูกลบ · เวรรายวันที่กรอกเองไม่ถูกลบ)')) return;
    svaPlanCall('deleteStationPlan', [u.id, SVA.pl.ym], function () { svaPlanReload(); }, 'กำลังลบ…');
}

// ==========================================================
// คอลัมน์ (หน้าที่) ของแต่ละงาน
// - AI อ่านได้หน้าที่ที่ไม่มีในคอลัมน์เดิม → หน้าต่างถามว่าจะไว้คอลัมน์ไหน / เพิ่มคอลัมน์ใหม่ / ไม่นำเข้า
// - "จัดการคอลัมน์" ในตารางเวรของแต่ละงาน: เพิ่ม ลบ เปลี่ยนชื่อ เรียงลำดับ (ข้อมูลเดิมย้ายตามได้)
// ==========================================================
function svaTpl() { return (SVA.pl && SVA.pl.d && SVA.pl.d.template) || (SVA.data && SVA.data.template) || []; }
function svaTplSet(tpl) { if (SVA.data) SVA.data.template = tpl; if (SVA.pl && SVA.pl.d) SVA.pl.d.template = tpl; }
function svaModal(title, body, foot) {
    svaModalClose();
    var m = document.createElement('div');
    m.id = 'sva-modal'; m.className = 'sva-modal';
    m.innerHTML = '<div class="sva-modal-box" role="dialog" aria-modal="true"><div class="sva-card-h">' + title + '</div>'
        + '<div class="sva-modal-b">' + body + '</div><div class="sva-foot">' + foot + '</div></div>';
    document.body.appendChild(m);
}
function svaModalClose() { var m = document.getElementById('sva-modal'); if (m) m.parentNode.removeChild(m); }
function svaColLabel(sec, time) { return sec + (time ? ' ' + svTimeText(time) : ''); }

function svaColAsk(unknown, entries, done, hints) {
    unknown = unknown || []; hints = hints || [];
    if (!unknown.length && !hints.length) { done(entries); return; }
    SVA.ask = { unk: unknown, entries: entries, done: done, hints: hints };
    var tpl = svaTpl();
    var rows = unknown.map(function (u, i) {
        var slots = tpl.filter(function (t) { return !t.auto && t.sec === u.sec; });
        if (!slots.length) slots = tpl.filter(function (t) { return !t.auto; });
        var sg = u.suggest ? svSlotKey(u.suggest.sec, u.suggest.time) + '|' + u.suggest.role : '';
        var opts = slots.map(function (t) {
            return '<optgroup label="' + svEsc(svaColLabel(t.sec, t.time)) + '">' + t.roles.map(function (r) {
                var v = svSlotKey(t.sec, t.time) + '|' + r;
                return '<option value="m|' + svEsc(v) + '"' + (v === sg ? ' selected' : '') + '>' + svEsc(r) + '</option>';
            }).join('') + '</optgroup>';
        }).join('');
        return '<div class="sva-ask"><div class="sva-ask-t">AI อ่านได้หน้าที่ <b>"' + svEsc(u.role) + '"</b>'
            + ' <small>' + svEsc(svaColLabel(u.sec, u.time)) + ' · ' + u.count + ' รายการ</small></div>'
            + '<div class="sva-ask-r"><span>นำไปไว้คอลัมน์</span><select id="sva-ask-' + i + '" class="form-select form-select-sm" onchange="svaColAskSel(' + i + ')">'
            + opts + '<option value="new"' + (sg ? '' : ' selected') + '>➕ เพิ่มเป็นคอลัมน์ใหม่…</option>'
            + '<option value="skip">✖ ไม่นำเข้ารายการนี้</option></select>'
            + '<input id="sva-ask-n' + i + '" class="form-control form-control-sm" value="' + svEsc(u.role) + '" placeholder="ชื่อคอลัมน์ใหม่"' + (sg ? ' hidden' : '') + '></div></div>';
    }).join('');
    // เวลาเข้าเวรในไฟล์ไม่ตรงกับเวลาที่หัวข้อ (เช่น ป. เปลี่ยนเวลาผลัด) → ติ๊กเพื่อปรับหัวข้อตามไฟล์
    var tm = hints.map(function (h, i) {
        return '<label class="sva-ask"><input type="checkbox" id="sva-ask-t' + i + '" checked> ปรับเวลาหัวข้อ <b>' + svEsc(h.sec) + '</b>'
            + ' จาก <s>' + svEsc(h.label) + '</s> เป็น <b>' + svEsc(h.doc) + '</b> <small>ตามไฟล์ ' + h.count + ' รายการ</small></label>';
    }).join('');
    svaModal('<i class="fas fa-table-columns"></i> ตรวจก่อนนำเข้า',
        (rows ? '<div class="sva-hint"><i class="fas fa-circle-info"></i> หน้าที่ที่ไม่ตรงกับคอลัมน์เดิม — ระบบเลือกคอลัมน์ที่ใกล้ที่สุดไว้ให้ '
            + '(เลือก "เพิ่มเป็นคอลัมน์ใหม่" เมื่อเป็นหน้าที่ใหม่จริง · แก้ภายหลังได้ที่ "คอลัมน์")</div>' + rows : '')
        + (tm ? '<div class="sva-hint"><i class="fas fa-clock"></i> เวลาเข้าเวรในไฟล์ไม่ตรงกับเวลาที่หัวข้อ</div>' + tm : ''),
        '<button type="button" class="sva-save" id="sva-ask-ok" onclick="svaColAskOk()"><i class="fas fa-check"></i> ตกลง</button>');
}
function svaColAskSel(i) {
    var v = document.getElementById('sva-ask-' + i).value, n = document.getElementById('sva-ask-n' + i);
    n.hidden = v !== 'new';
    if (!n.hidden) n.focus();
}
function svaColAskOk() {
    var A = SVA.ask; if (!A) return;
    var tpl = JSON.parse(JSON.stringify(svaTpl())), added = 0, map = {};
    A.hints.forEach(function (h, i) {
        if (!document.getElementById('sva-ask-t' + i).checked) return;
        var t = tpl.filter(function (x) { return x.sec === h.sec && (x.time || '') === (h.time || ''); })[0];
        if (t) { t.timeLabel = h.doc; added++; }
    });
    A.unk.forEach(function (u, i) {
        var v = document.getElementById('sva-ask-' + i).value, k = [u.sec, u.time || '', u.role].join('|');
        if (v === 'skip') { map[k] = null; return; }
        if (v === 'new') {
            var nm = (document.getElementById('sva-ask-n' + i).value || '').replace(/\s+/g, ' ').trim() || u.role;
            var same = tpl.filter(function (x) { return !x.auto && x.sec === u.sec; });
            var t = same.filter(function (x) { return (x.time || '') === (u.time || ''); })[0] || (same.length === 1 ? same[0] : null);
            if (!t) { t = { sec: u.sec, time: u.time || '', roles: [] }; tpl.push(t); }   // ฝ่าย/ช่วงเวลาที่ยังไม่มี = หัวข้อใหม่
            if (t.roles.indexOf(nm) < 0) { t.roles.push(nm); added++; }
            map[k] = { sec: t.sec, time: t.time || '', role: nm };
            return;
        }
        var p = v.slice(2).split('|');
        map[k] = { sec: p[0], time: p[1], role: p.slice(2).join('|') };
    });
    var list = [];
    A.entries.forEach(function (e) {
        var k = [e.sec, e.time || '', e.role].join('|');
        if (!(k in map)) { list.push(e); return; }
        if (!map[k]) return;
        e.sec = map[k].sec; e.time = map[k].time; e.role = map[k].role;
        list.push(e);
    });
    var fin = function () { SVA.ask = null; svaModalClose(); A.done(list); };
    if (!added) { fin(); return; }
    var b = document.getElementById('sva-ask-ok');
    b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก…';
    google.script.run
        .withSuccessHandler(function (res) { svaTplSet(res.template); svTimeSync(res.template); fin(); })
        .withFailureHandler(function (e) {
            b.disabled = false; b.innerHTML = '<i class="fas fa-check"></i> ตกลง';
            alert('บันทึกคอลัมน์/เวลาไม่สำเร็จ: ' + ((e && e.message) || e));
        })
        .saveStationTemplate(tpl, []);
}

// ---- จัดการคอลัมน์ของงาน ----
function svaColsStart() { return (SVA.pl && SVA.pl.d && SVA.pl.d.roleStart) || (SVA.data && SVA.data.roleStart) || {}; }
function svaColsHas(sec, time, role) {
    var k = svSlotKey(sec, time) + '|' + role, cm = SVA.cm;
    if (cm.moves.some(function (m) { return [m.toSec, m.toTime, m.toRole].join('|') === k; })) return true;
    if (cm.moves.some(function (m) { return [m.sec, m.time, m.role].join('|') === k; })) return false;
    return !!svaColsStart()[k];
}
function svaColsOpen() {
    var tpl = JSON.parse(JSON.stringify(svaTpl()));
    var unit = SVA.mode === 'plan' && SVA.pl && SVA.pl.d ? svaPlanUnitObj()
        : { name: 'ทุกงาน', secs: tpl.filter(function (t) { return !t.auto; }).map(function (t) { return t.sec; }) };
    SVA.cm = { unit: unit, tpl: tpl, moves: [], del: null, done: {} };
    svaColsPaint();
}
function svaColsTargets(sec, skipTime, skipRole) {
    var out = [];
    SVA.cm.tpl.forEach(function (t) {
        if (t.auto || t.sec !== sec) return;
        t.roles.forEach(function (r) {
            if ((t.time || '') === skipTime && r === skipRole) return;
            out.push('<option value="mv|' + svEsc((t.time || '') + '|' + r) + '">ย้ายข้อมูลไป: ' + svEsc(r) + (t.time ? ' (' + svEsc(svTimeText(t.time).replace(' (ของวันรุ่งขึ้น)', '')) + ')' : '') + '</option>');
        });
    });
    return out.join('');
}
function svaColsPaint() {
    var cm = SVA.cm, u = cm.unit, inTpl = {};
    var body = cm.tpl.map(function (t, si) {
        if (t.auto || u.secs.indexOf(t.sec) < 0) return '';
        var rows = t.roles.map(function (r, ri) {
            inTpl[svSlotKey(t.sec, t.time) + '|' + r] = 1;
            var has = svaColsHas(t.sec, t.time || '', r);
            if (cm.del && cm.del.si === si && cm.del.ri === ri) {
                return '<div class="sva-cm-r del"><b>ลบคอลัมน์ "' + svEsc(r) + '"</b> — คอลัมน์นี้มีข้อมูลเวรอยู่แล้ว'
                    + '<select id="sva-cm-dsel" class="form-select form-select-sm">' + svaColsTargets(t.sec, t.time || '', r)
                    + '<option value="keep">เก็บข้อมูลไว้ (เดือนที่มีข้อมูลยังเห็นเป็นคอลัมน์สีเทา)</option>'
                    + '<option value="del">ลบข้อมูลของคอลัมน์นี้ทั้งหมด</option></select>'
                    + '<span class="sva-cm-b"><button type="button" onclick="SVA.cm.del=null;svaColsPaint()">ยกเลิก</button>'
                    + '<button type="button" class="del" onclick="svaColsDelOk(' + si + ',' + ri + ')">ลบคอลัมน์</button></span></div>';
            }
            return '<div class="sva-cm-r"><span class="sva-cm-n">' + svEsc(r) + '<small>' + (has ? 'มีข้อมูล' : 'ยังไม่มีข้อมูล') + '</small></span>'
                + '<input class="sva-cm-tm form-control form-control-sm" value="' + svEsc(svRoleTime(t, r)) + '" placeholder="เวลา เช่น 05.00-21.00 น."'
                + ' title="เวลาเข้าเวรที่แสดงหลังชื่อ (ใช้เมื่อตารางเวรวันนั้นไม่ได้ระบุเวลา)" onchange="svaColsTime(' + si + ',' + ri + ',this.value)">'
                + '<span class="sva-cm-b"><button type="button" onclick="svaColsMove(' + si + ',' + ri + ',-1)" title="เลื่อนขึ้น"' + (ri ? '' : ' disabled') + '><i class="fas fa-arrow-up"></i></button>'
                + '<button type="button" onclick="svaColsMove(' + si + ',' + ri + ',1)" title="เลื่อนลง"' + (ri < t.roles.length - 1 ? '' : ' disabled') + '><i class="fas fa-arrow-down"></i></button>'
                + '<button type="button" onclick="svaColsRename(' + si + ',' + ri + ')" title="เปลี่ยนชื่อ (ข้อมูลเดิมเปลี่ยนตาม)"><i class="fas fa-pen"></i></button>'
                + '<button type="button" class="del" onclick="svaColsDel(' + si + ',' + ri + ')" title="ลบคอลัมน์"><i class="fas fa-trash-can"></i></button></span></div>';
        }).join('');
        return '<div class="sva-cm-s"><div class="sva-cm-h" style="border-color:' + svEsc(t.color || '#64748b') + '">' + svEsc(t.sec)
            + (t.time ? ' <small>ผลัด ' + svEsc(t.time.slice(0, 5)) + '</small>' : '')
            // ฝ่ายที่แบ่งผลัด: แก้เวลาที่แสดงได้ (กุญแจผลัดเดิมคงไว้ ข้อมูลเดิมไม่ต้องย้าย)
            + '<label class="sva-cm-hl">เวลาที่หัวข้อ <input class="form-control form-control-sm" value="' + svEsc(t.timeLabel || '') + '"'
            + ' placeholder="' + svEsc(t.time ? (SV_TIME_LABEL[t.time] || t.time) : 'ไม่แสดง') + '"'
            + ' onchange="SVA.cm.tpl[' + si + '].timeLabel=this.value.trim()"></label></div>' + rows
            + '<div class="sva-cm-add"><input id="sva-cm-new' + si + '" class="form-control form-control-sm" placeholder="ชื่อหน้าที่ใหม่" onkeydown="if(event.key===\'Enter\')svaColsAdd(' + si + ')">'
            + '<button type="button" class="sva-btn-add" onclick="svaColsAdd(' + si + ')"><i class="fas fa-plus"></i> เพิ่มคอลัมน์</button></div></div>';
    }).join('');
    // หน้าที่ที่มีในข้อมูลแต่ไม่อยู่ในรายการคอลัมน์ (เคยบันทึกด้วยชื่ออื่น)
    var extra = Object.keys(svaColsStart()).filter(function (k) {
        var p = k.split('|');
        return u.secs.indexOf(p[0]) >= 0 && !inTpl[k] && !cm.done[k] && svaColsHas(p[0], p[1], p.slice(2).join('|'));
    });
    cm.extra = extra;
    var ex = extra.length ? '<div class="sva-cm-s"><div class="sva-cm-h">คอลัมน์ที่มีในข้อมูลเดิมแต่ไม่อยู่ในรายการ</div>'
        + extra.map(function (k, i) {
            var p = k.split('|'), r = p.slice(2).join('|');
            return '<div class="sva-cm-r del"><b>' + svEsc(r) + '</b> <small>' + svEsc(svaColLabel(p[0], p[1])) + '</small>'
                + '<select id="sva-cm-x' + i + '" class="form-select form-select-sm"><option value="add">เพิ่มเข้ารายการคอลัมน์</option>'
                + svaColsTargets(p[0], p[1], r) + '<option value="del">ลบข้อมูลนี้ทั้งหมด</option></select>'
                + '<span class="sva-cm-b"><button type="button" onclick="svaColsExtra(' + i + ')">ใช้</button></span></div>';
        }).join('') + '</div>' : '';
    svaModal('<i class="fas fa-table-columns"></i> จัดการคอลัมน์ ตารางเวร' + svEsc(u.name),
        '<div class="sva-hint"><i class="fas fa-circle-info"></i> คอลัมน์ = หน้าที่ในตารางเวร ใช้ทั้งใบเวรประจำวัน ตารางรายเดือน และตอน AI อ่านไฟล์ '
        + '· คอลัมน์ใหม่จะเริ่มแสดงในใบเวรตั้งแต่วันแรกที่มีชื่อ · เปลี่ยนชื่อแล้วข้อมูลเดิมทุกเดือนเปลี่ยนตาม</div>' + body + ex,
        '<button type="button" onclick="svaModalClose()">ยกเลิก</button>'
        + '<button type="button" class="sva-save" onclick="svaColsSave()"><i class="fas fa-floppy-disk"></i> บันทึกคอลัมน์</button>');
}
function svaColsTime(si, ri, v) {
    var t = SVA.cm.tpl[si];
    if (!t.roleTimes) {   // แม่แบบที่ยังไม่มีเวลาประจำหน้าที่: เริ่มจากค่าที่แสดงอยู่
        t.roleTimes = {};
        t.roles.forEach(function (r) { var x = SV_ROLE_NOTE[r]; if (x) t.roleTimes[r] = x; });
    }
    t.roleTimes[t.roles[ri]] = String(v || '').replace(/\s+/g, ' ').trim();
}
function svaColsMove(si, ri, d) {
    var a = SVA.cm.tpl[si].roles, j = ri + d;
    if (j < 0 || j >= a.length) return;
    var x = a[ri]; a[ri] = a[j]; a[j] = x;
    svaColsPaint();
}
function svaColsAdd(si) {
    var inp = document.getElementById('sva-cm-new' + si), t = SVA.cm.tpl[si];
    var v = (inp && inp.value || '').replace(/\s+/g, ' ').trim();
    if (!v) { if (inp) inp.focus(); return; }
    if (t.roles.indexOf(v) >= 0) { alert('มีคอลัมน์ "' + v + '" อยู่แล้ว'); return; }
    t.roles.push(v);
    svaColsPaint();
}
function svaColsRename(si, ri) {
    var cm = SVA.cm, t = cm.tpl[si], old = t.roles[ri];
    var v = prompt('เปลี่ยนชื่อคอลัมน์ "' + old + '" เป็น', old);
    if (v == null) return;
    v = v.replace(/\s+/g, ' ').trim();
    if (!v || v === old) return;
    var has = svaColsHas(t.sec, t.time || '', old);
    if (t.roles.indexOf(v) >= 0) {
        if (!confirm('มีคอลัมน์ "' + v + '" อยู่แล้ว — รวม "' + old + '" เข้าไปเป็นคอลัมน์เดียวกัน?')) return;
        t.roles.splice(ri, 1);
    } else {
        t.roles[ri] = v;
        if (t.roleTimes && old in t.roleTimes) { t.roleTimes[v] = t.roleTimes[old]; delete t.roleTimes[old]; }
    }
    if (has) cm.moves.push({ sec: t.sec, time: t.time || '', role: old, toSec: t.sec, toTime: t.time || '', toRole: v });
    svaColsPaint();
}
function svaColsDel(si, ri) {
    var cm = SVA.cm, t = cm.tpl[si], r = t.roles[ri];
    if (cm.tpl.filter(function (x) { return !x.auto; }).reduce(function (n, x) { return n + x.roles.length; }, 0) <= 1) { alert('ต้องมีคอลัมน์อย่างน้อย 1 คอลัมน์'); return; }
    if (svaColsHas(t.sec, t.time || '', r)) { cm.del = { si: si, ri: ri }; svaColsPaint(); return; }
    t.roles.splice(ri, 1);
    if (t.roleTimes) delete t.roleTimes[r];
    svaColsPaint();
}
function svaColsDelOk(si, ri) {
    var cm = SVA.cm, t = cm.tpl[si], r = t.roles[ri], v = document.getElementById('sva-cm-dsel').value;
    if (v === 'del') cm.moves.push({ sec: t.sec, time: t.time || '', role: r, toRole: '' });
    else if (v !== 'keep') {
        var p = v.slice(3).split('|');
        cm.moves.push({ sec: t.sec, time: t.time || '', role: r, toSec: t.sec, toTime: p[0], toRole: p.slice(1).join('|') });
    }
    t.roles.splice(ri, 1);
    if (t.roleTimes) delete t.roleTimes[r];
    cm.del = null;
    svaColsPaint();
}
function svaColsExtra(i) {
    var cm = SVA.cm, k = cm.extra[i]; if (!k) return;
    var p = k.split('|'), r = p.slice(2).join('|'), v = document.getElementById('sva-cm-x' + i).value;
    if (v === 'add') {
        var same = cm.tpl.filter(function (x) { return !x.auto && x.sec === p[0]; });
        var t = same.filter(function (x) { return (x.time || '') === p[1]; })[0];
        if (!t) { t = { sec: p[0], time: p[1], roles: [] }; cm.tpl.push(t); }
        if (t.roles.indexOf(r) < 0) t.roles.push(r);
    } else if (v === 'del') {
        cm.moves.push({ sec: p[0], time: p[1], role: r, toRole: '' });
    } else {
        var q = v.slice(3).split('|');
        cm.moves.push({ sec: p[0], time: p[1], role: r, toSec: p[0], toTime: q[0], toRole: q.slice(1).join('|') });
    }
    cm.done[k] = 1;
    svaColsPaint();
}
function svaColsSave() {
    var cm = SVA.cm, u = cm.unit;
    var nDel = cm.moves.filter(function (m) { return !m.toRole; }).length;
    if (nDel && !confirm('ข้อมูลเวรของ ' + nDel + ' คอลัมน์ที่เลือก "ลบข้อมูล" จะถูกลบทุกเดือน (กู้คืนไม่ได้) — ยืนยัน?')) return;
    svaModalClose();
    var msg = function (res) {
        return 'บันทึกคอลัมน์ของ' + u.name + 'แล้ว'
            + (res.moved ? '\n• ย้ายข้อมูลเดิม ' + res.moved + ' รายการ' : '') + (res.deleted ? '\n• ลบข้อมูล ' + res.deleted + ' รายการ' : '');
    };
    if (SVA.mode === 'plan') {
        svaPlanCall('saveStationTemplate', [cm.tpl, cm.moves], function (res) {
            svaTplSet(res.template); SVA.cm = null; svaPlanReload(msg(res));
        }, 'กำลังบันทึกคอลัมน์…');
        return;
    }
    // หน้าแก้ไขเวรรายวัน: โหลดใหม่โดยคงชื่อที่แก้ค้างไว้บนใบเวร
    SVA.cm = null;
    svaTplSave(cm.tpl, cm.moves, 'บันทึกคอลัมน์ของ' + u.name + 'แล้ว');
}

// ---------- สไตล์ของเมนูนี้ (ฉีดครั้งเดียว) ----------
var SVA_CSS = ''
    // หน้าต่างถามคอลัมน์ / จัดการคอลัมน์
    + '.sva-modal{position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:5vh 12px;overflow:auto}'
    + '.sva-modal-box{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);width:100%;max-width:640px;padding:14px 16px}'
    + '.sva-modal-b{max-height:65vh;overflow:auto;margin:8px 0}'
    + '.sva-ask,.sva-cm-s{border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin:8px 0;background:#f8fafc}'
    + '.sva-ask-t small,.sva-cm-n small,.sva-cm-r small{color:#64748b;margin-left:6px;font-weight:400}'
    + '.sva-ask-r{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}.sva-ask-r>span{font-size:.82rem;color:#475569}'
    + '.sva-ask-r select,.sva-ask-r input{flex:1 1 180px;min-width:0}'
    + '.sva-cm-h{font-weight:800;border-left:4px solid #64748b;padding-left:8px;margin-bottom:6px}.sva-cm-h small{font-weight:400;color:#64748b}'
    + '.sva-cm-r{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 0;border-top:1px dashed #e2e8f0}'
    + '.sva-cm-r.del{background:#fff7ed;border-radius:8px;padding:6px 8px;border:1px solid #fed7aa;margin:4px 0}.sva-cm-r.del select{flex:1 1 220px;min-width:0}'
    + '.sva-cm-n{flex:1;font-weight:700}.sva-cm-b{display:flex;gap:4px;margin-left:auto}'
    + '.sva-cm-b button,.sva-cm-add button{border:1px solid #dbe3ee;background:#fff;border-radius:8px;padding:3px 9px;font-size:.8rem;font-weight:700;cursor:pointer}'
    + '.sva-cm-b button:disabled{opacity:.35;cursor:default}.sva-cm-b button.del{color:#b91c1c;border-color:#fecaca}'
    + '.sva-cm-add{display:flex;gap:6px;margin-top:6px}.sva-cm-add input{flex:1;min-width:0}'
    + '.sva-cm-tm{width:150px!important;flex:0 1 150px}.sva-cm-hl{display:inline-flex;align-items:center;gap:6px;margin-left:10px;font-weight:400;font-size:.8rem;color:#475569}.sva-cm-hl input{width:140px}'
    + '.sva-pl-grid thead tr.sva-pl-tm th{position:static;background:#f8fafc}.sva-pl-tm input{width:100%;min-width:90px;border:1px solid #dbe3ee;border-radius:6px;padding:2px 5px;font-size:.75rem;font-weight:400}'
    + '.sva-imp-t td small{display:block;color:#64748b}'
    + '.sva-xl .sva-xl-k{cursor:pointer;border-bottom:1px dashed rgba(15,23,42,.35)}.sva-xl .sva-xl-k:hover{background:rgba(37,99,235,.08)}'
    + '.sva-xl .sv-note.sva-xl-k{border-bottom:0}.sva-xl .sv-note.dim{background:#f1f5f9;color:#64748b;font-weight:600}'
    + '.sva-xl-addcol{margin-left:10px;border:1px dashed #64748b;background:rgba(255,255,255,.6);border-radius:8px;font-size:.72rem;font-weight:700;padding:1px 8px;cursor:pointer}'
    + '.sva-xl-rb{display:flex;gap:3px;margin-top:4px}.sva-xl-rb button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;font-size:.68rem;padding:1px 6px;cursor:pointer}.sva-xl-rb button.on{background:#dbeafe}'
    + '.sva-xl-cell{display:flex;align-items:center;gap:4px}.sva-xl-in{flex:1;min-width:0;width:100%;border:1px solid transparent;background:transparent;font:inherit;font-weight:700;padding:2px 4px;border-radius:6px}'
    + '.sva-xl-in.hid{display:none}.sva-xl-nm{flex:1;min-width:0;font-weight:700;cursor:text;padding:2px 4px;border-radius:6px;border:1px solid transparent}.sva-xl-nm:hover{border-color:#93c5fd;background:#fff}'
    + '.sva-xl-in:hover,.sva-xl-in:focus{border-color:#93c5fd;background:#fff;outline:0}.sva-xl-unk .sva-xl-in{background:#fff7ed;border-color:#fdba74}'
    + '.sva-xl-del{border:0;background:transparent;color:#94a3b8;cursor:pointer;padding:0 4px}.sva-xl-del:hover{color:#b91c1c}'
    + '.sva-xl-fix{display:block;color:#64748b;font-size:.7rem}.sva-xl-fix.r{color:#c2410c}.sva-xl .sv-note-in,.sva-xl .sv-note-row{display:none}'
    + '.sva-xl-pick td{background:#f8fafc}'
    + '.sva-fx{color:#0f766e;font-weight:700}.sva-fx i{font-size:.7em}.sva-fx-ap{width:260px!important;flex-basis:260px}'
    + '#sva-fa-p{flex-basis:100%}'
    + '.sva-fxbtn{border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e;border-radius:6px;font-size:.66rem;padding:0 5px;cursor:pointer;vertical-align:middle}'
    + 'label.sva-ask{display:block;cursor:pointer;font-weight:400}label.sva-ask input{margin-right:6px}label.sva-ask small{color:#64748b;margin-left:4px}'
    + '.sva-pl-fb button{min-width:34px}'
    + '@media (max-width:640px){.sva-tx{display:none}.sva-act button,.sv-xbtns button{min-width:38px}}'
    // เว็บแอป: กรอบแท็บตัดขอบ (overflow:hidden) ทำให้หัวตารางรายเดือนตรึงกับหน้าไม่ได้ — เปิดเฉพาะตอนอยู่เมนูนี้
    + 'body.sva-on #pills-tabContent,#pills-tabContent:has(>#content-station.active){overflow:visible!important}'
    + '.sva{display:flex;flex-direction:column;gap:12px;font-family:Sarabun,system-ui,sans-serif}'
    + '.sva-wait{padding:40px 12px;text-align:center;color:#94a3b8}.sva-err{color:#f87171}'
    + '.sva-head{display:flex;align-items:center;gap:10px;font-size:1.15rem;font-weight:800;color:#fff;padding:12px 16px;border-radius:16px;'
    + 'background:linear-gradient(118deg,#0a2463,#1d4ed8 60%,#38bdf8 130%)}'
    + '.sva-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px;border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.12)}'
    + '.sva-bar button,.sva-foot button,.sva-imp button{border:1px solid #dbe3ee;background:#f8fafc;color:#1e293b;font-weight:700;font-size:.82rem;'
    + 'border-radius:10px;padding:6px 11px;cursor:pointer;white-space:nowrap}'
    + '.sva-bar button:hover{background:#eaf2ff}'
    + '.sva-seg{display:flex;gap:4px;padding:3px;border-radius:12px;background:#f1f5f9}.sva-seg button{border:0;background:transparent}'
    + '.sva-seg button.on{background:#1d4ed8;color:#fff}'
    + '.sva-nav{display:flex;gap:4px;align-items:center}.sva-nav input{border:1px solid #dbe3ee;border-radius:10px;padding:5px 8px;font:inherit;font-size:.85rem;color:#0f172a}'
    + '.sva-sel{border:1px solid #dbe3ee;border-radius:10px;padding:6px 8px;font-size:.82rem;max-width:230px}.sva-secs{flex:1 1 100%;order:9}.sva-today:disabled{opacity:.4;cursor:default;pointer-events:none;filter:grayscale(.7)}'
    + '@media (max-width:560px){.sva-secs .sv-secchips{display:grid;grid-template-columns:repeat(3,1fr)}.sva-secs .sv-chip{justify-content:center;padding:7px 4px;border-radius:12px}.sva-secs .sv-chip:first-child{grid-column:1/-1}}'
    + '.sva-act{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}'
    + '.sva-bar .sv-x-pdf{background:#dc2626;color:#fff;border-color:#dc2626}.sva-bar .sv-x-img{background:#059669;color:#fff;border-color:#059669}'
    + '.sva-bar .sva-exit{background:#0f172a;color:#fff;border-color:#0f172a}'
    + '.sva-card{background:#fff;color:#0f172a;border-radius:16px;padding:12px 14px;box-shadow:0 8px 24px rgba(15,23,42,.14)}'
    + '.sva-card-h{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1rem;margin-bottom:8px}'
    + '.sva-x{margin-left:auto;border:0;background:#f1f5f9;border-radius:9px;width:30px;height:30px;cursor:pointer}'
    + '.sva-hint{font-size:.78rem;color:#64748b;margin-bottom:10px}.sva-hint i{color:#3b82f6;margin-right:4px}'
    + '.sva-unk{font-size:.68rem;color:#b45309;font-weight:700}'
    + '.sva-pick{margin:0 10px 10px;padding:10px;border-radius:12px;background:#f8fafc;border:1px solid #bfdbfe}'
    + '.sva-pick-h{font-size:.76rem;font-weight:700;color:#334155;margin-bottom:8px}.sva-pick-h i{color:#1d4ed8;margin-right:4px}'
    + '.sva-pick-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}'
    + '.sva-pick-tabs button{flex-shrink:0;border:1px solid #dbe3ee;background:#fff;border-radius:999px;padding:4px 11px;font-size:.76rem;font-weight:700;cursor:pointer;color:#334155;white-space:nowrap}'
    + '.sva-pick-tabs button small{color:#94a3b8;font-weight:700}.sva-pick-tabs button.home{border-color:#93c5fd}'
    + '.sva-pick-tabs button.on{background:#1d4ed8;border-color:#1d4ed8;color:#fff}.sva-pick-tabs button.on small{color:#bfdbfe}'
    + '.sva-pick-q{margin:4px 0 8px}'
    + '.sva-pick-list{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));max-height:300px;overflow-y:auto}'
    + '.sva-chip{position:relative;text-align:left;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:6px 9px;cursor:pointer;line-height:1.25}'
    + '.sva-chip b{display:block;font-size:.8rem;color:#0f172a}.sva-chip small{display:block;font-size:.66rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.sva-chip.on{background:#dbeafe;border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.25)}'
    + '.sva-chip i{position:absolute;right:7px;top:7px;color:#1d4ed8}'
    + '.sva-pick-foot{display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:.8rem}'
    + '.sva-pick-foot button{border:0;background:#1d4ed8;color:#fff;border-radius:9px;padding:5px 14px;font-weight:800;cursor:pointer}'
    + '.sva-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}'
    + '.sva-save{background:#1d4ed8!important;color:#fff!important;border-color:#1d4ed8!important}'
    + '.sva-imp{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.sva-imp>*{flex:1 1 170px}.sva-imp button{flex:0 0 auto}'
    + '.sva-imp-sum{margin:10px 0 6px;font-size:.84rem}.sva-imp-sum .r{color:#b45309}'
    + '.sva-imp-wrap{max-height:420px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;margin-top:8px}'
    + '.sva-imp-t{width:100%;border-collapse:collapse;font-size:.8rem}.sva-imp-t th{position:sticky;top:0;background:#f1f5f9;padding:6px;text-align:left}'
    + '.sva-imp-t td{padding:4px 6px;border-top:1px solid #f1f5f9;vertical-align:middle}.sva-imp-t small{display:block;color:#64748b;font-size:.68rem}'
    + '.sva-imp-t tr.unk td{background:#fffbeb}.sva-staff-t tr{cursor:pointer}.sva-staff-t tr:hover td{background:#eff6ff}'
    + '.sva-none{padding:12px;text-align:center;color:#64748b}'
    // ---- ตารางเวรของแต่ละงาน ----
    + '.sva-plbtn{position:relative}.sva-bar .sva-plbtn.on{background:#0f766e;color:#fff;border-color:#0f766e}'
    + '.sva-pl-bad{display:inline-block;min-width:18px;padding:0 5px;border-radius:999px;background:#ea580c;color:#fff;font-size:.7rem;font-weight:800;line-height:18px;text-align:center;animation:svaBadgePulse 1.4s ease-in-out infinite}@keyframes svaBadgePulse{0%,100%{box-shadow:0 0 0 0 rgba(234,88,12,.55)}50%{box-shadow:0 0 0 5px rgba(234,88,12,0)}}'
    + '.sva-pl-nav{display:flex;align-items:center;gap:6px;margin-left:12px;font-size:.92rem}'
    + '.sva-pl-nav button{border:1px solid #dbe3ee;background:#f8fafc;border-radius:8px;width:28px;height:28px;cursor:pointer}'
    + '.sva-pl-ok{padding:8px 12px;border-radius:10px;background:#ecfdf5;color:#047857;font-weight:700;font-size:.84rem;margin-bottom:10px}'
    + '.sva-pl-mis{border:1px solid #fdba74;background:#fff7ed;border-radius:12px;padding:8px 10px;margin-bottom:10px}'
    + '.sva-pl-mis-h{font-weight:800;color:#c2410c;margin-bottom:6px}'
    + '.sva-pl-mi{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;padding:6px 0;border-top:1px dashed #fed7aa;font-size:.82rem}'
    + '.sva-pl-mi:first-of-type{border-top:0}.sva-pl-mt{min-width:200px}.sva-pl-mt small{color:#64748b}'
    + '.sva-pl-mv{display:flex;flex-wrap:wrap;gap:4px 12px;flex:1}.sva-pl-mv span{white-space:nowrap}'
    + '.sva-pl-mb{display:flex;gap:5px;flex-wrap:wrap}.sva-pl-mb button{border:1px solid #fdba74;background:#fff;color:#9a3412;border-radius:8px;padding:4px 9px;font-size:.76rem;font-weight:800;cursor:pointer}'
    + '.sva-pl-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px}'
    + '.sva-pl-tabs button{position:relative;flex-shrink:0;text-align:left;border:1px solid #dbe3ee;background:#f8fafc;border-radius:12px;padding:6px 12px;cursor:pointer;color:#0f172a}'
    + '.sva-pl-tabs button b{display:block;font-size:.9rem}.sva-pl-tabs button small{font-size:.68rem;color:#64748b}'
    + '.sva-pl-tabs button.on{background:#1d4ed8;border-color:#1d4ed8;color:#fff}.sva-pl-tabs button.on small{color:#dbeafe}'
    + '.sva-pl-tabs .sva-pl-bad{position:absolute;top:-6px;right:-6px}'
    + '.sva-pl-sec{border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:10px}'
    + '.sva-pl-sh{font-weight:800;font-size:.9rem;margin-bottom:8px;color:#1e293b}.sva-pl-sh i{color:#1d4ed8;margin-right:5px}.sva-pl-sh small{color:#64748b;font-weight:700}'
    + '.sva-pl-f{display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}'
    + '.sva-pl-f>i{font-size:1.4rem;color:#dc2626;width:22px;text-align:center}.sva-pl-f>i.fa-file-image{color:#059669}.sva-pl-f>i.fa-file-excel{color:#15803d}'
    + '.sva-pl-fn{flex:1;min-width:160px}.sva-pl-fn b{display:block;font-size:.84rem;word-break:break-word}.sva-pl-fn small{font-size:.7rem;color:#64748b}'
    + '.sva-pl-fb,.sva-pl-acts{display:flex;gap:5px;flex-wrap:wrap}'
    + '.sva-pl-fb button,.sva-pl-acts button{border:1px solid #dbe3ee;background:#f8fafc;color:#1e293b;border-radius:8px;padding:5px 10px;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap}'
    + '.sva-pl-fb button.del,.sva-pl-acts button.del{color:#b91c1c;border-color:#fecaca;background:#fef2f2}'
    + '.sva-pl-up{margin-top:8px}.sva-pl-acts{margin-bottom:8px}'
    + '.sva-pl-ai{padding:7px 10px;border-radius:10px;background:#eef2ff;color:#3730a3;font-size:.8rem;font-weight:700;margin-bottom:8px}'
    + '.sva-pl-grid{max-height:62vh;overflow:auto;border:1px solid #e2e8f0;border-radius:10px}'
    + '.sva-nm{cursor:pointer;border-bottom:1px dotted #94a3b8}.sva-nm:hover{background:#eaf2ff}.sva-nm.unk{color:#c2410c;background:#fff7ed;border-bottom-color:#f97316}'
    + '.sva-nchips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px;padding:8px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}'
    + '.sva-nchips-h{flex:1 1 100%;font-size:.78rem;font-weight:700;color:#334155}'
    + '.sva-nchip{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:3px 10px;font-size:.78rem;cursor:pointer;color:#0f172a}'
    + '.sva-nchip small{color:#64748b;margin-left:2px}.sva-nchip.unk{border-color:#f97316;background:#fff7ed;color:#c2410c}'
    + '.sva-pl-grid table{border-collapse:collapse;font-size:.76rem;min-width:100%}'
    + '.sva-pl-grid th,.sva-pl-grid td{border:1px solid #e2e8f0;padding:3px 6px;text-align:center;white-space:nowrap}'
    + '.sva-pl-grid thead th{position:sticky;top:0;z-index:2;background:#f1f5f9;font-weight:800}.sva-pl-grid thead th small{display:block;font-weight:600;color:#64748b;font-size:.64rem}'
    + '.sva-pl-grid tbody th{position:sticky;left:0;z-index:1;background:#f8fafc;text-align:left;font-weight:800}.sva-pl-grid tbody th small{color:#64748b;font-weight:600}'
    + '.sva-pl-grid tr.we td{background:#fff7ed}.sva-pl-grid tr.td th,.sva-pl-grid tr.td td{background:#dcfce7}'
    + '.sva-pl-grid.ed td{padding:2px}.sva-pl-grid.ed input{width:100%;min-width:150px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;font:inherit;font-size:.78rem}'
    + '.sva-pl-grid.ed input.unk{border-color:#f59e0b;background:#fffbeb}'
    // ---- ธีมเดียวกันทุกจุดแก้ไข (แผงแก้ไข / ตารางของงาน / หน้าต่าง): ปุ่ม · ช่องกรอก · กล่อง · ป้ายกำกับ ----
    + '.sva-modal-box{border-radius:16px;padding:16px 18px;color:#0f172a}.sva-modal-box>.sva-card-h{font-size:1.05rem;margin-bottom:6px}'
    + '.sva-card .form-control,.sva-card .form-select,.sva-modal .form-control,.sva-modal .form-select{height:34px;border:1px solid #dbe3ee;border-radius:10px;font-size:.85rem;padding:4px 10px;color:#0f172a;background-color:#fff;box-shadow:none}'
    + '.sva-card .form-control:focus,.sva-card .form-select:focus,.sva-modal .form-control:focus,.sva-modal .form-select:focus{border-color:#93c5fd;box-shadow:0 0 0 3px rgba(59,130,246,.15);outline:0}'
    + '.sva-foot button,.sva-imp button,.sva-cm-b button,.sva-cm-add button,.sva-pl-fb button,.sva-pl-acts button,.sva-pl-mb button,.sva-pl-up button,.sva-fr button,.sva-btn-add{'
    + 'display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;min-width:34px;padding:0 12px;border-radius:10px;font:inherit;font-size:.82rem;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap}'
    + '.sva-cm-b button,.sva-pl-fb button{padding:0 10px}'
    + '.sva-btn-add{border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1d4ed8!important}.sva-btn-add:hover{background:#dbeafe!important}'
    + '.sva-card button.del,.sva-modal button.del{color:#b91c1c;border-color:#fecaca;background:#fef2f2}'
    + '.sva-cm-s{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:10px 0}'
    + '.sva-cm-h{font-size:.92rem;font-weight:800;border-left:3px solid #1d4ed8;padding-left:8px;margin-bottom:8px;color:#0f172a}'
    + '.sva-cm-h small{font-size:.74rem;font-weight:500;color:#64748b;margin-left:6px}'
    + '.sva-cm-s .sva-none{padding:2px 0 6px;text-align:left;font-size:.8rem}.sva-cm-n{font-size:.88rem}'
    + '.sva-fg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 10px;margin-top:8px}'
    + '.sva-f{display:flex;flex-direction:column;gap:3px;margin:0;min-width:0}.sva-f>span{font-size:.74rem;font-weight:700;color:#475569}.sva-f>span small{font-weight:500;color:#94a3b8}'
    + '.sva-f.s2{grid-column:span 2}.sva-f.s3{grid-column:span 3}.sva-f.s4{grid-column:1/-1}'
    + '.sva-fr{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px}'
    + '.sva-chk{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;color:#334155;margin:0 auto 0 0;cursor:pointer}'
    + '.sva-chk input,label.sva-ask input{width:16px;height:16px;accent-color:#1d4ed8;flex:0 0 auto}'
    + '.sva-xl-rb button{width:26px;height:26px;padding:0;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:.72rem}'
    + '.sva-xl-addcol{height:24px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:8px;font-size:.72rem}'
    + '@media (max-width:560px){.sva-fg{grid-template-columns:repeat(2,minmax(0,1fr))}.sva-f.s3{grid-column:1/-1}.sva-modal-box{padding:14px}.sva-cm-r .sva-cm-tm{flex:1 1 120px;width:auto!important}.sva-cm-n{flex-basis:100%}}'
    + '@media (max-width:640px){.sva-act{margin-left:0}}';

function svaInjectCss() {
    if (document.getElementById('sva-css')) return;
    var st = document.createElement('style'); st.id = 'sva-css'; st.textContent = SVA_CSS;
    document.head.appendChild(st);
}
