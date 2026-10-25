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
function svaFirst(name) {
    var s = String(name || '').replace(/\s+/g, ' ').trim();
    var m = s.match(/^((?:ว่าที่\s*)?(?:[฀-๿]{1,4}\.){1,3}(?:\s*หญิง)?)\s*(.*)$/);
    return ((m ? m[2] : s).trim().split(' ')[0] || '');
}

function renderStationDuty() {
    if (!document.getElementById('sv-root')) return;
    if (!SVA.date) SVA.date = svaToday();
    svaLoad(false);
}

// โหลดครั้งละ 3 เดือน (เดือนก่อน–เดือนถัดไป) พอสำหรับเลื่อนดูและคัดลอกจากวันก่อน
function svaLoad(force) {
    var root = document.getElementById('sv-root'); if (!root) return;
    var y = SVA.date.getFullYear(), m = SVA.date.getMonth();
    var from = new Date(y, m - 1, 1), to = new Date(y, m + 2, 0);
    var key = svKey(from) + '-' + svKey(to);
    if (!force && SVA.data && SVA.range === key) { svaPaint(); return; }
    if (!SVA.data) root.innerHTML = '<div class="sva-wait"><i class="fas fa-circle-notch fa-spin"></i> กำลังโหลดตารางเวรทุกสายงาน…</div>';
    google.script.run
        .withSuccessHandler(function (d) { SVA.data = d; SVA.range = key; svaPaint(); })
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
    root.innerHTML = '<div class="sva">'
        + '<div class="sva-head"><i class="fas fa-building-shield"></i><span>ตารางเวรทุกสายงาน สน.ลำหิน</span></div>'
        + '<div class="sva-bar">'
        + '  <div class="sva-seg">'
        + '    <button type="button" class="' + (SVA.view === 'day' ? 'on' : '') + '" onclick="svaSetView(\'day\')"><i class="fas fa-calendar-day"></i> รายวัน</button>'
        + '    <button type="button" class="' + (SVA.view === 'month' ? 'on' : '') + '" onclick="svaSetView(\'month\')"><i class="fas fa-table"></i> ทั้งเดือน</button>'
        + '  </div>'
        + '  <div class="sva-nav">'
        + '    <button type="button" onclick="svaStep(-1)" title="ก่อนหน้า"><i class="fas fa-chevron-left"></i></button>'
        + (SVA.view === 'day'
            ? '<input type="date" value="' + dateVal + '" onchange="svaPick(this.value)">'
            : '<input type="month" value="' + monthVal + '" onchange="svaPick(this.value + \'-01\')">')
        + '    <button type="button" onclick="svaStep(1)" title="ถัดไป"><i class="fas fa-chevron-right"></i></button>'
        + '    <button type="button" class="sva-today" onclick="svaPick(null)">วันนี้</button>'
        + '  </div>'
        + (SVA.view === 'month' ? '<select class="sva-sel" onchange="SVA.sec=this.value;svaPaint()">' + svSecOptions(SVA.data, SVA.sec) + '</select>' : '')
        + '  <div class="sva-act">'
        + '    <button type="button" onclick="svaEditOpen()"><i class="fas fa-pen-to-square"></i> เพิ่ม/แก้ไขเวร</button>'
        + '    <button type="button" onclick="svaImportOpen()"><i class="fas fa-wand-magic-sparkles"></i> นำเข้าจากรูป/ไฟล์</button>'
        + '    <button type="button" onclick="svaStaffOpen()"><i class="fas fa-address-book"></i> ทะเบียน</button>'
        // เว็บแอป: ตั้งรหัสให้ธุรการใช้กรอกเวรบนหน้า GitHub · หน้า GitHub: ปุ่มออกจากโหมดแก้ไข
        + (window.SVA_REMOTE
            ? '    <button type="button" class="sva-exit" onclick="if(window.stEditClose)stEditClose()"><i class="fas fa-right-from-bracket"></i> ออกจากโหมดแก้ไข</button>'
            : '    <button type="button" onclick="svaSetPin()" title="รหัสสำหรับงานธุรการ ใช้กรอกเวรบนหน้า GitHub"><i class="fas fa-key"></i> รหัสธุรการ</button>')
        + svExportButtons("svaExport('pdf')", "svaExport('img')")
        + '  </div>'
        + '</div>'
        + '<div id="sva-panel"></div>'
        + '<div id="sva-view">' + (SVA.view === 'day'
            ? svDayHtml(SVA.data, d, { emptyHint: 'กด "เพิ่ม/แก้ไขเวร" หรือ "นำเข้าจากรูป/ไฟล์"' })
            : svMonthHtml(SVA.data, d.getFullYear(), d.getMonth(), SVA.sec)) + '</div>'
        + '<datalist id="sva-staff">' + (SVA.data.staff || []).map(function (s) {
            return '<option value="' + svEsc(s.name) + '">' + svEsc(s.pos) + '</option>';
        }).join('') + '</datalist>'
        + '</div>';
    if (SVA.mode === 'edit') svaEditPaint();
    else if (SVA.mode === 'import') svaImportPaint();
    else if (SVA.mode === 'staff') svaStaffPaint();
}

function svaSetView(v) { SVA.view = v; svaPaint(); }
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
    var landscape = !day && !SVA.sec;   // ทุกฝ่ายทั้งเดือนคอลัมน์เยอะ ใช้แนวนอน
    if (kind === 'img') svExportImage(title, html, landscape); else svExportPdf(title, html, landscape);
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
// เพิ่ม/แก้ไขเวรรายวัน
// ==========================================================
function svaEditOpen() { SVA.view = 'day'; SVA.mode = 'edit'; svaEditStart(); svaPaint(); }

/** สร้างช่องกรอกจากแม่แบบ + ข้อมูลที่มีอยู่ของวันนั้น (ไม่รวมฝ่ายสอบสวน) */
function svaEditStart(fromDate) {
    var src = fromDate || SVA.date;
    SVA.pick = null;
    var idx = svIndex(SVA.data), day = {}; day[svKey(src)] = idx[svKey(src)] || {};
    SVA.ed = svSlots(SVA.data, day).filter(function (t) { return !t.auto; }).map(function (t) {
        var got = day[svKey(src)][svSlotKey(t.sec, t.time)] || {};
        return {
            sec: t.sec, time: t.time, color: t.color, roles: t.roles.map(function (r) {
                var names = (got[r] || []).map(function (x) { return x[4]; });
                return { role: r, names: names.length ? names : [''] };
            })
        };
    });
}
function svaEditSync() {
    [].forEach.call(document.querySelectorAll('#sva-panel .sva-in'), function (el) {
        var s = SVA.ed[+el.dataset.s], r = s && s.roles[+el.dataset.r];
        if (r) r.names[+el.dataset.n] = el.value;
    });
}
function svaEditPaint() {
    var p = document.getElementById('sva-panel'); if (!p || !SVA.ed) return;
    var html = '<div class="sva-card"><div class="sva-card-h"><i class="fas fa-pen-to-square"></i> เพิ่ม/แก้ไขเวรวันที่ ' + svThaiLong(SVA.date)
        + '<button type="button" class="sva-x" onclick="svaClose()" title="ปิด"><i class="fas fa-xmark"></i></button></div>'
        + '<div class="sva-hint"><i class="fas fa-circle-info"></i> พิมพ์ชื่อแล้วเลือกจากรายชื่อ ระบบเติมตำแหน่ง/เบอร์ให้เอง · ฝ่ายสอบสวนดึงจากตารางเวรงานสอบสวนอัตโนมัติ</div>'
        + '<div class="sva-ed">';
    SVA.ed.forEach(function (s, si) {
        html += '<div class="sva-ed-sec" style="--sc:' + s.color + '"><div class="sva-ed-sh">' + svEsc(s.sec)
            + (s.time ? ' <small>' + svEsc(s.time) + '</small>' : '') + '</div>';
        s.roles.forEach(function (r, ri) {
            html += '<div class="sva-ed-row"><div class="sva-ed-role">' + svEsc(r.role) + '</div><div class="sva-ed-names">';
            r.names.forEach(function (n, ni) {
                var st = n ? svaFindStaff(n) : null, known = !n || st;
                html += '<div class="sva-ed-name' + (known ? '' : ' unk') + '">'
                    + '<input class="form-control form-control-sm sva-in" list="sva-staff" data-s="' + si + '" data-r="' + ri + '" data-n="' + ni + '"'
                    + ' value="' + svEsc(n) + '" placeholder="พิมพ์ชื่อ หรือกด เลือก" onchange="svaEditSync();svaEditPaint()">'
                    + '<button type="button" onclick="svaEditDel(' + si + ',' + ri + ',' + ni + ')" title="ลบ"><i class="fas fa-xmark"></i></button>'
                    + (st ? '<small class="sva-tel"><i class="fas fa-phone"></i> ' + svEsc(st.phone || '-') + ' · ' + svEsc(st.pos) + '</small>' : '')
                    + (known ? '' : '<span>ไม่มีในทะเบียน</span>') + '</div>';
            });
            var open = SVA.pick && SVA.pick.si === si && SVA.pick.ri === ri;
            html += '<div class="sva-ed-btns">'
                + '<button type="button" class="sva-pickbtn' + (open ? ' on' : '') + '" onclick="svaPickOpen(' + si + ',' + ri + ')"><i class="fas fa-list-check"></i> เลือกจากรายชื่อ</button>'
                + '<button type="button" class="sva-add" onclick="svaEditAdd(' + si + ',' + ri + ')"><i class="fas fa-plus"></i> ช่องพิมพ์</button></div>'
                + '</div></div>'
                + (open ? svaPickHtml(s, r) : '');
        });
        html += '</div>';
    });
    html += '</div>'
        + '<div class="sva-ed-more">'
        + '  <select id="sva-new-sec" class="form-select form-select-sm">' + SVA.ed.map(function (s, i) {
            return '<option value="' + i + '">' + svEsc(s.sec + (s.time ? ' ' + s.time : '')) + '</option>';
        }).join('') + '</select>'
        + '  <input id="sva-new-role" class="form-control form-control-sm" placeholder="หน้าที่อื่น เช่น สายตรวจ 191">'
        + '  <button type="button" onclick="svaEditAddRole()"><i class="fas fa-plus"></i> เพิ่มหน้าที่</button>'
        + '</div>'
        + '<div class="sva-foot">'
        + '  <button type="button" onclick="svaEditCopyPrev()"><i class="fas fa-copy"></i> คัดลอกจากวันก่อน</button>'
        + '  <button type="button" onclick="svaClose()">ยกเลิก</button>'
        + '  <button type="button" class="sva-save" id="sva-save" onclick="svaEditSave()"><i class="fas fa-floppy-disk"></i> บันทึกเวรวันนี้</button>'
        + '</div></div>';
    p.innerHTML = html;
}
function svaEditAdd(si, ri) { svaEditSync(); SVA.ed[si].roles[ri].names.push(''); svaEditPaint(); }

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
    if (at > -1) { r.names.splice(at, 1); if (!r.names.length) r.names.push(''); }
    else { var e = r.names.indexOf(''); if (e > -1) r.names[e] = x.name; else r.names.push(x.name); }
    svaEditPaint();
}
function svaEditDel(si, ri, ni) {
    svaEditSync();
    var r = SVA.ed[si].roles[ri]; r.names.splice(ni, 1); if (!r.names.length) r.names.push('');
    svaEditPaint();
}
function svaEditAddRole() {
    svaEditSync();
    var si = +document.getElementById('sva-new-sec').value, role = document.getElementById('sva-new-role').value.trim();
    if (!role) return;
    SVA.ed[si].roles.push({ role: role, names: [''] });
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
        s.roles.forEach(function (r) {
            r.names.forEach(function (n) {
                n = String(n || '').trim(); if (!n) return;
                var st = svaFindStaff(n) || {};
                entries.push({ sec: s.sec, time: s.time, role: r.role, name: st.name || n, pos: st.pos || '', phone: st.phone || '' });
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
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> บันทึกเวรวันนี้'; }
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
        + '<div class="sva-hint"><i class="fas fa-circle-info"></i> แนบรูปถ่ายตารางเวร ใบเวรประจำวัน หรือไฟล์ Excel/CSV ของฝ่ายใดก็ได้ (หลายไฟล์ได้) '
        + 'AI จะอ่านแล้วแตกเป็นรายวันให้ตรวจก่อนบันทึก</div>'
        + '<div class="sva-imp">'
        + '  <input type="file" id="sva-file" class="form-control form-control-sm" multiple accept="image/*,.pdf,.xlsx,.xls,.csv">'
        + '  <select id="sva-hint" class="form-select form-select-sm"><option value="">ไม่ระบุฝ่าย (ให้ AI ดูเอง)</option>'
        + '<option value="ใบเวรประจำวันทั้ง สน.">ใบเวรประจำวันทั้ง สน.</option>'
        + secs.map(function (s) { return '<option>' + svEsc(s) + '</option>'; }).join('') + '</select>'
        + '  <input type="month" id="sva-month" class="form-control form-control-sm" value="' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '" title="เดือนของตาราง">'
        + '  <button type="button" class="sva-save" id="sva-read" onclick="svaImportRead()"><i class="fas fa-robot"></i> อ่านด้วย AI</button>'
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
    if (!files.length) { alert('กรุณาเลือกไฟล์ตารางเวรก่อน'); return; }
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
                SVA.imp = { list: (res.entries || []).map(function (e) { e.on = true; return e; }) };
                svaImportPaint();
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
}
function svaImportResHtml() {
    var L = SVA.imp && SVA.imp.list;
    if (!L) return '';
    if (!L.length) return '<div class="sva-none">AI อ่านไม่พบรายชื่อเวรในไฟล์นี้</div>';
    var unk = L.filter(function (e) { return !e.matched; }).length;
    var rows = L.map(function (e, i) {
        return '<tr class="' + (e.matched ? '' : 'unk') + '">'
            + '<td><input type="checkbox" ' + (e.on ? 'checked' : '') + ' onchange="SVA.imp.list[' + i + '].on=this.checked;svaImportCount()"></td>'
            + '<td>' + svEsc(e.date) + '</td><td>' + svEsc(e.sec) + (e.time ? '<small>' + svEsc(e.time) + '</small>' : '') + '</td>'
            + '<td>' + svEsc(e.role) + '</td>'
            + '<td><input class="form-control form-control-sm" list="sva-staff" value="' + svEsc(e.name) + '" onchange="svaImportName(' + i + ',this.value)">'
            + (e.matched ? '' : '<span class="sva-unk">ไม่มีในทะเบียน</span>') + '</td></tr>';
    }).join('');
    return '<div class="sva-imp-sum">อ่านได้ <b>' + L.length + '</b> รายการ' + (unk ? ' · ชื่อที่ไม่ตรงทะเบียน <b class="r">' + unk + '</b> (แก้ชื่อในช่องได้)' : '') + '</div>'
        + '<div class="sva-imp-wrap"><table class="sva-imp-t"><thead><tr><th></th><th>วันที่</th><th>ฝ่าย</th><th>หน้าที่</th><th>ชื่อ</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '<div class="sva-foot"><button type="button" onclick="SVA.imp={list:null};svaImportPaint()">ล้าง</button>'
        + '<button type="button" class="sva-save" id="sva-imp-save" onclick="svaImportSave()"><i class="fas fa-floppy-disk"></i> <span id="sva-imp-n">บันทึก ' + L.filter(function (e) { return e.on; }).length + ' รายการ</span></button></div>';
}
function svaImportName(i, v) {
    var e = SVA.imp.list[i], st = svaFindStaff(v);
    e.name = st ? st.name : v; e.pos = st ? st.pos : ''; e.phone = st ? st.phone : ''; e.matched = !!st;
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
            setTimeout(function () { alert('นำเข้าแล้ว ' + res.saved + ' รายการ'); }, 50);
        })
        .withFailureHandler(function (e) {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> บันทึก';
            alert('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e));
        })
        .saveStationDutyBulk(list.map(function (e) {
            return { date: e.date, sec: e.sec, time: e.time, role: e.role, name: e.name, pos: e.pos, phone: e.phone };
        }));
}

// ==========================================================
// ทะเบียนเจ้าหน้าที่ (เพิ่ม/แก้ไข)
// ==========================================================
function svaStaffOpen() { SVA.mode = 'staff'; svaPaint(); }
function svaStaffPaint() {
    var p = document.getElementById('sva-panel'); if (!p) return;
    var depts = ['บริหาร', 'ป้องกันปราบปราม', 'สอบสวน', 'สืบสวน', 'จราจร', 'อำนวยการ', 'อื่น ๆ'];
    var rows = (SVA.data.staff || []).map(function (s) {
        return '<tr onclick="svaStaffFill(\'' + svEsc(s.name).replace(/'/g, '&#39;') + '\')"><td>' + svEsc(s.name) + '</td><td>' + svEsc(s.pos)
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

// ---------- สไตล์ของเมนูนี้ (ฉีดครั้งเดียว) ----------
var SVA_CSS = ''
    + '.sva{display:flex;flex-direction:column;gap:12px;font-family:Sarabun,system-ui,sans-serif}'
    + '.sva-wait{padding:40px 12px;text-align:center;color:#94a3b8}.sva-err{color:#f87171}'
    + '.sva-head{display:flex;align-items:center;gap:10px;font-size:1.15rem;font-weight:800;color:#fff;padding:12px 16px;border-radius:16px;'
    + 'background:linear-gradient(118deg,#0a2463,#1d4ed8 60%,#38bdf8 130%)}'
    + '.sva-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px;border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.12)}'
    + '.sva-bar button,.sva-foot button,.sva-imp button,.sva-ed-more button{border:1px solid #dbe3ee;background:#f8fafc;color:#1e293b;font-weight:700;font-size:.82rem;'
    + 'border-radius:10px;padding:6px 11px;cursor:pointer;white-space:nowrap}'
    + '.sva-bar button:hover{background:#eaf2ff}'
    + '.sva-seg{display:flex;gap:4px;padding:3px;border-radius:12px;background:#f1f5f9}.sva-seg button{border:0;background:transparent}'
    + '.sva-seg button.on{background:#1d4ed8;color:#fff}'
    + '.sva-nav{display:flex;gap:4px;align-items:center}.sva-nav input{border:1px solid #dbe3ee;border-radius:10px;padding:5px 8px;font:inherit;font-size:.85rem;color:#0f172a}'
    + '.sva-sel{border:1px solid #dbe3ee;border-radius:10px;padding:6px 8px;font-size:.82rem;max-width:230px}'
    + '.sva-act{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}'
    + '.sva-bar .sv-x-pdf{background:#dc2626;color:#fff;border-color:#dc2626}.sva-bar .sv-x-img{background:#059669;color:#fff;border-color:#059669}'
    + '.sva-bar .sva-exit{background:#0f172a;color:#fff;border-color:#0f172a}'
    + '.sva-card{background:#fff;color:#0f172a;border-radius:16px;padding:12px 14px;box-shadow:0 8px 24px rgba(15,23,42,.14)}'
    + '.sva-card-h{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1rem;margin-bottom:8px}'
    + '.sva-x{margin-left:auto;border:0;background:#f1f5f9;border-radius:9px;width:30px;height:30px;cursor:pointer}'
    + '.sva-hint{font-size:.78rem;color:#64748b;margin-bottom:10px}.sva-hint i{color:#3b82f6;margin-right:4px}'
    + '.sva-ed{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}'
    + '.sva-ed-sec{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}'
    + '.sva-ed-sh{padding:6px 10px;font-weight:800;font-size:.86rem;background:color-mix(in srgb,var(--sc) 20%,#fff)}.sva-ed-sh small{font-weight:600}'
    + '.sva-ed-row{display:flex;gap:8px;padding:6px 10px;border-top:1px solid #f1f5f9;align-items:flex-start}'
    + '.sva-ed-role{flex:0 0 110px;font-weight:700;font-size:.8rem;padding-top:5px}'
    + '.sva-ed-names{flex:1;display:flex;flex-direction:column;gap:4px}'
    + '.sva-ed-name{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.sva-ed-name input{flex:1;min-width:140px}'
    + '.sva-ed-name button{border:0;background:#fee2e2;color:#b91c1c;border-radius:8px;width:28px;height:28px;cursor:pointer}'
    + '.sva-ed-name.unk input{border-color:#f59e0b;background:#fffbeb}.sva-ed-name span,.sva-unk{font-size:.68rem;color:#b45309;font-weight:700}'
    + '.sva-add{border:1px dashed #94a3b8;background:#fff;border-radius:8px;font-size:.74rem;padding:3px 9px;cursor:pointer;color:#475569}'
    + '.sva-ed-btns{display:flex;gap:6px;flex-wrap:wrap}'
    + '.sva-pickbtn{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:8px;font-size:.76rem;font-weight:800;padding:3px 10px;cursor:pointer}'
    + '.sva-pickbtn.on{background:#1d4ed8;color:#fff;border-color:#1d4ed8}'
    + '.sva-tel{flex-basis:100%;font-size:.7rem;color:#047857;font-weight:700}.sva-tel i{margin-right:3px}'
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
    + '.sva-ed-more{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.sva-ed-more select{max-width:260px}.sva-ed-more input{max-width:240px}'
    + '.sva-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}'
    + '.sva-save{background:#1d4ed8!important;color:#fff!important;border-color:#1d4ed8!important}'
    + '.sva-imp{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.sva-imp>*{flex:1 1 170px}.sva-imp button{flex:0 0 auto}'
    + '.sva-imp-sum{margin:10px 0 6px;font-size:.84rem}.sva-imp-sum .r{color:#b45309}'
    + '.sva-imp-wrap{max-height:420px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;margin-top:8px}'
    + '.sva-imp-t{width:100%;border-collapse:collapse;font-size:.8rem}.sva-imp-t th{position:sticky;top:0;background:#f1f5f9;padding:6px;text-align:left}'
    + '.sva-imp-t td{padding:4px 6px;border-top:1px solid #f1f5f9;vertical-align:middle}.sva-imp-t small{display:block;color:#64748b;font-size:.68rem}'
    + '.sva-imp-t tr.unk td{background:#fffbeb}.sva-staff-t tr{cursor:pointer}.sva-staff-t tr:hover td{background:#eff6ff}'
    + '.sva-none{padding:12px;text-align:center;color:#64748b}'
    + '@media (max-width:640px){.sva-act{margin-left:0}.sva-ed{grid-template-columns:1fr}.sva-ed-role{flex-basis:88px}}';

function svaInjectCss() {
    if (document.getElementById('sva-css')) return;
    var st = document.createElement('style'); st.id = 'sva-css'; st.textContent = SVA_CSS;
    document.head.appendChild(st);
}
