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
    var pv = document.querySelector('#sva-view .sv-vscroll'), keepLeft = pv ? pv.scrollLeft : 0;
    var nMis = (SVA.data.rows || []).filter(function (r) { return (r[10] || r[11]) && String(r[0]).slice(3) === monthVal.slice(5, 7) + '/' + monthVal.slice(0, 4); }).length;
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
        + '    <button type="button" class="sva-today" onclick="svaPick(null)">' + (SVA.view === 'month' ? 'เดือนนี้' : 'วันนี้') + '</button>'
        + '  </div>'
        + (SVA.view === 'month' ? '<div class="sva-secs">' + svSecChips(SVA.data, SVA.sec, 'svaSecSet') + '</div>' : '')
        + '  <div class="sva-act">'
        + '    <button type="button" onclick="svaEditOpen()"><i class="fas fa-pen-to-square"></i> เพิ่ม/แก้ไขเวร</button>'
        + '    <button type="button" class="sva-plbtn' + (SVA.mode === 'plan' ? ' on' : '') + '" onclick="svaPlanOpen()" title="ไฟล์และตารางเวรของ ป. / จร. / สส. / ศปก. / อำนวยการ แยกรายเดือน">'
        + '<i class="fas fa-folder-open"></i> ตารางเวรแต่ละงาน' + (nMis ? ' <span class="sva-pl-bad" title="ตารางรายวันไม่ตรงกับตารางเวร">' + nMis + '</span>' : '') + '</button>'
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
            + (s.time ? ' <small>' + svEsc(svTimeText(s.time)) + '</small>' : '') + '</div>';
        s.roles.forEach(function (r, ri) {
            html += '<div class="sva-ed-row"><div class="sva-ed-role">' + svEsc(r.role) + '</div><div class="sva-ed-names">';
            r.names.forEach(function (n, ni) {
                var st = n ? svaFindStaff(n) : null, known = !n || st;
                html += '<div class="sva-ed-name' + (known ? '' : ' unk') + '">'
                    + '<input class="form-control form-control-sm sva-in" list="' + svaDl(s.sec, s.time, r.role) + '" data-s="' + si + '" data-r="' + ri + '" data-n="' + ni + '"'
                    + ' value="' + svEsc(n) + '" placeholder="พิมพ์ชื่อ หรือกด เลือก" onchange="svaEditSync();svaEditPaint()">'
                    + '<button type="button" onclick="svaEditDel(' + si + ',' + ri + ',' + ni + ')" title="ลบ"><i class="fas fa-xmark"></i></button>'
                    + (st ? '<small class="sva-tel"><i class="fas fa-phone"></i> ' + svEsc(st.phone || '-') + ' · ' + svEsc(st.pos) + '</small>' : '')
                    + (known ? '' : '<span>ไม่มีในทะเบียน</span>') + '</div>';
            });
            var open = SVA.pick && SVA.pick.si === si && SVA.pick.ri === ri;
            // ชื่อประจำ: หัวหน้าสถานี (และหน้าที่อื่นที่ตั้งไว้) แสดงทุกวันอัตโนมัติ ไม่ต้องกรอก
            var fixedName = (SVA.data.fixed || {})[s.sec + '|' + (s.time || '') + '|' + r.role];
            var canFix = fixedName || r.role === 'หัวหน้าสถานี';
            html += (fixedName ? '<div class="sva-fixed"><i class="fas fa-thumbtack"></i> ชื่อประจำ: <b>' + svEsc(fixedName)
                    + '</b> — แสดงทุกวันอัตโนมัติ กรอกชื่ออื่นเฉพาะวันที่เปลี่ยนตัว</div>' : '')
                + '<div class="sva-ed-btns">'
                + '<button type="button" class="sva-pickbtn' + (open ? ' on' : '') + '" onclick="svaPickOpen(' + si + ',' + ri + ')"><i class="fas fa-list-check"></i> เลือกจากรายชื่อ</button>'
                + '<button type="button" class="sva-add" onclick="svaEditAdd(' + si + ',' + ri + ')"><i class="fas fa-plus"></i> ช่องพิมพ์</button>'
                + (canFix ? '<button type="button" class="sva-fixbtn" onclick="svaSetFixed(' + si + ',' + ri + ')" title="ใช้ชื่อในช่องนี้ทุกวัน"><i class="fas fa-thumbtack"></i> ตั้งเป็นชื่อประจำ</button>' : '')
                + '</div>'
                + '</div></div>'
                + (open ? svaPickHtml(s, r) : '');
        });
        html += '</div>';
    });
    html += '</div>'
        + '<div class="sva-ed-more">'
        + '  <select id="sva-new-sec" class="form-select form-select-sm">' + SVA.ed.map(function (s, i) {
            return '<option value="' + i + '">' + svEsc(s.sec + (s.time ? ' ' + svTimeText(s.time) : '')) + '</option>';
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

// ตั้งชื่อในช่องเป็น "ชื่อประจำ" ของหน้าที่นั้น (เช่น เปลี่ยน ผกก. → หัวหน้าสถานีคนใหม่) — มีผลทุกวันที่ไม่ได้กรอกชื่ออื่น
function svaSetFixed(si, ri) {
    svaEditSync();
    var s = SVA.ed[si], r = s.roles[ri];
    var name = (r.names.filter(function (n) { return String(n || '').trim(); })[0] || '').trim();
    var st = name ? svaFindStaff(name) : null;
    if (!name) { alert('พิมพ์หรือเลือกชื่อในช่อง "' + r.role + '" ก่อน แล้วค่อยกดตั้งเป็นชื่อประจำ'); return; }
    if (!confirm('ตั้ง "' + (st ? st.name : name) + '" เป็นชื่อประจำของ "' + r.role + '"\nแสดงทุกวันอัตโนมัติ (วันที่กรอกชื่ออื่นไว้จะยังเป็นชื่อนั้น)')) return;
    google.script.run
        .withSuccessHandler(function (map) {
            SVA.data.fixed = map;
            svaLoad(true);   // โหลดใหม่ให้ทุกวันแสดงชื่อประจำใหม่ (หน้าจอกรอกยังคงค่าที่กรอกค้างไว้)
        })
        .withFailureHandler(function (e) { alert('ตั้งชื่อประจำไม่สำเร็จ: ' + ((e && e.message) || e)); })
        .setStationFixed(s.sec, s.time, r.role, st ? st.name : name);
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
            + '<td>' + svEsc(e.date) + '</td><td>' + svEsc(e.sec) + (e.time ? '<small>' + svEsc(svTimeText(e.time)) + '</small>' : '') + '</td>'
            + '<td>' + svEsc(e.role) + '</td>'
            + '<td><input class="form-control form-control-sm" list="' + svaDl(e.sec, e.time, e.role) + '" value="' + svEsc(e.name) + '" onchange="svaImportName(' + i + ',this.value)">'
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
function svaPlanLoad() {
    var pl = SVA.pl, ym = pl.ym;
    svaPlanBusy('กำลังโหลดตารางเวรของแต่ละงาน…');
    google.script.run
        .withSuccessHandler(function (d) { if (SVA.pl.ym !== ym) return; pl.d = d; pl.ed = null; svaPlanPaint(); })
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

/** ช่องของงาน: [{sec,time,role}] ตามแม่แบบ + หน้าที่อื่นที่มีในตารางงานจริง */
function svaPlanCols(u, plan) {
    var cols = [], seen = {};
    function add(sec, time, role) { var k = svSlotKey(sec, time) + '|' + role; if (!seen[k]) { seen[k] = 1; cols.push({ sec: sec, time: time || '', role: role }); } }
    (SVA.pl.d.template || []).forEach(function (t) { if (u.secs.indexOf(t.sec) >= 0) t.roles.forEach(function (r) { add(t.sec, t.time, r); }); });
    plan.forEach(function (x) { add(x.sec, x.time, x.role); });
    return cols;
}
function svaPlanUnitObj() { return (SVA.pl.d.units || []).filter(function (u) { return u.id === SVA.pl.unit; })[0] || SVA.pl.d.units[0]; }
function svaPlanOf(uid) { return (SVA.pl.d.plan || []).filter(function (x) { return x.unit === uid; }); }

function svaPlanPaint() {
    var p = document.getElementById('sva-panel'), pl = SVA.pl;
    if (!p || SVA.mode !== 'plan' || !pl || !pl.d) return;
    var d = pl.d, u = svaPlanUnitObj(), plan = svaPlanOf(u.id);
    var files = (d.files || []).filter(function (f) { return f.unit === u.id; });
    var mis = d.mismatches || [], umis = mis.filter(function (m) { return m.unit === u.id; });
    var tabs = (d.units || []).map(function (x) {
        var days = {}; svaPlanOf(x.id).forEach(function (e) { days[e.date] = 1; });
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
        + '<div class="sva-pl-sec"><div class="sva-pl-sh"><i class="fas fa-paperclip"></i> ไฟล์ตารางเวร' + svEsc(u.name) + ' เดือน' + svaYmText(pl.ym) + '</div>'
        + (files.length ? files.map(svaPlanFileHtml).join('') : '<div class="sva-none">ยังไม่มีไฟล์ — อัปโหลดคำสั่ง/ตารางเวรของงานนี้ (PDF รูปภาพ หรือ Excel)</div>')
        + '<div class="sva-imp sva-pl-up"><input type="file" id="sva-pl-file" class="form-control form-control-sm" multiple accept="image/*,.pdf,.xlsx,.xls,.csv">'
        + '<input id="sva-pl-note" class="form-control form-control-sm" placeholder="หมายเหตุไฟล์ (ถ้ามี) เช่น ฉบับแก้ไข">'
        + '<button type="button" class="sva-save" onclick="svaPlanUpload()"><i class="fas fa-upload"></i> อัปโหลด</button></div></div>'
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
                + '<div class="sva-pl-mb"><button type="button" onclick="svaPlanFix(' + i + ',\'plan\')" title="ใช้ชื่อตามตารางเวรของงาน (ลบชื่อที่กรอกในตารางรายวันของวันนั้น)"><i class="fas fa-table-list"></i> ตามตารางเวร</button>'
                + '<button type="button" onclick="svaPlanFix(' + i + ',\'daily\')" title="ใช้ชื่อตามตารางรายวัน (แก้ตารางเวรของงานให้ตรง เช่น มีการแลกเวร)"><i class="fas fa-calendar-day"></i> ตามตารางรายวัน</button>'
                + '<button type="button" onclick="svaPlanGoDay(' + i + ')" title="เปิดเวรรายวันวันนั้น">เปิดวันนั้น</button></div></div>';
        }).join('') + '</div>';
}
// เบอร์โทรตามใบเวรไม่ตรงฐานข้อมูลกำลังพล: เลือกแก้ฐานข้อมูลตามใบเวร หรือใช้เบอร์ในฐานข้อมูลต่อ
function svaPlanPhoneHtml(list) {
    if (!list.length) return '';
    return '<div class="sva-pl-mis"><div class="sva-pl-mis-h"><i class="fas fa-phone-slash"></i> เบอร์โทรในใบเวรไม่ตรงกับฐานข้อมูลกำลังพล ' + list.length + ' คน</div>'
        + list.map(function (m, i) {
            return '<div class="sva-pl-mi"><div class="sva-pl-mt"><b>' + svEsc(m.name) + '</b> <small>(' + m.dates.map(function (ds) { return svaDayText(ds); }).join(', ') + ')</small></div>'
                + '<div class="sva-pl-mv"><span>ใบเวร: <b>' + svEsc(m.sheet) + '</b></span><span>ฐานข้อมูล: <b>' + svEsc(m.db) + '</b></span></div>'
                + '<div class="sva-pl-mb"><button type="button" onclick="svaPlanPhone(' + i + ',\x27db\x27)" title="แก้เบอร์ในฐานข้อมูลกำลังพลเป็นเบอร์ตามใบเวร (ใช้ทุกวันต่อจากนี้)"><i class="fas fa-address-book"></i> แก้ฐานข้อมูลตามใบเวร</button>'
                + '<button type="button" onclick="svaPlanPhone(' + i + ',\x27sheet\x27)" title="ใช้เบอร์ในฐานข้อมูลต่อ (ไม่แก้)"><i class="fas fa-xmark"></i> ใช้เบอร์ในฐานข้อมูล</button></div></div>';
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
        + '<div class="sva-pl-fb"><button type="button" onclick="svaPlanFileView(\'' + f.id + '\')"><i class="fas fa-eye"></i> ดู</button>'
        + (canAi ? '<button type="button" onclick="svaPlanAI(\'' + f.id + '\')" title="ให้ AI อ่านไฟล์นี้เป็นตารางเวรของงาน แล้วตรวจก่อนบันทึก"><i class="fas fa-robot"></i> อ่านด้วย AI</button>' : '')
        + '<button type="button" onclick="svaPlanFileEdit(\'' + f.id + '\')"><i class="fas fa-pen"></i> แก้ไข</button>'
        + '<button type="button" class="del" onclick="svaPlanFileDel(\'' + f.id + '\')"><i class="fas fa-trash-can"></i> ลบ</button></div></div>';
}
function svaPlanFileOf(id) { return (SVA.pl.d.files || []).filter(function (f) { return f.id === id; })[0]; }
function svaPlanUpload() {
    var inp = document.getElementById('sva-pl-file');
    var files = inp && inp.files ? [].slice.call(inp.files) : [];
    if (!files.length) { alert('กรุณาเลือกไฟล์ก่อน'); return; }
    var big = files.filter(function (f) { return f.size > SVA_PL_MAX_MB * 1048576; })[0];
    if (big) { alert('ไฟล์ "' + big.name + '" ใหญ่เกิน ' + SVA_PL_MAX_MB + ' MB'); return; }
    var note = document.getElementById('sva-pl-note').value.trim(), pl = SVA.pl, i = 0;
    function next() {
        if (i >= files.length) { svaPlanReload(); return; }
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
    var w = window.open('', '_blank');
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
        svaPlanEditStart(res.entries, 'AI อ่านจาก "' + f.name + '" ได้ ' + res.entries.length + ' รายการ — ตรวจ/แก้ในตารางแล้วกดบันทึก (ยังไม่ได้บันทึก)');
    }, 'AI กำลังอ่าน ' + f.name + '… (อาจใช้เวลาราว 30 วินาที)');
}

// ---- ดูตารางของงาน (อ่านอย่างเดียว) ----
function svaPlanViewHtml(u, plan, umis) {
    var btns = '<div class="sva-pl-acts"><button type="button" class="sva-save" onclick="svaPlanEditStart()"><i class="fas fa-pen-to-square"></i> ' + (plan.length ? 'แก้ไขตาราง' : 'สร้างตาราง') + '</button>'
        + (plan.length ? '<button type="button" onclick="svaPlanContinue()" title="สร้างตารางเดือนถัดไปโดยวนรอบเวรเดิม"><i class="fas fa-rotate-right"></i> วนรอบต่อเดือนถัดไป</button>'
            + '<button type="button" class="del" onclick="svaPlanDelete()"><i class="fas fa-trash-can"></i> ลบตารางเดือนนี้</button>' : '') + '</div>';
    if (!plan.length) return '<div class="sva-none">ยังไม่มีตารางของงานนี้ในเดือนนี้ — กด "สร้างตาราง" หรือ "อ่านด้วย AI" จากไฟล์ด้านบน</div>' + btns;
    var cols = svaPlanCols(u, plan), cell = {}, bad = {};
    plan.forEach(function (x) { var k = x.date + '|' + svSlotKey(x.sec, x.time) + '|' + x.role; (cell[k] = cell[k] || []).push(x.name); });
    umis.forEach(function (m) { bad[m.date + '|' + svSlotKey(m.sec, m.time) + '|' + m.role] = m.daily.join(', '); });
    var p = SVA.pl.ym.split('-'), last = new Date(+p[0], +p[1], 0).getDate(), todayK = svKey(new Date());
    var body = '';
    for (var dd = 1; dd <= last; dd++) {
        var dt = new Date(+p[0], +p[1] - 1, dd), ds = svDateStr(dt), dow = dt.getDay();
        body += '<tr class="' + (dow === 0 || dow === 6 ? 'we' : '') + (svKey(dt) === todayK ? ' td' : '') + '"><th>' + dd + ' <small>' + SV_DOW_S[dow] + '</small></th>'
            + cols.map(function (c) {
                var k = ds + '|' + svSlotKey(c.sec, c.time) + '|' + c.role, n = cell[k];
                return '<td' + (bad[k] ? ' class="sv-mis" title="ตารางรายวัน: ' + svEsc(bad[k]) + '"' : '') + '>' + (n ? n.map(function (x) { return svEsc(svShort(x)); }).join('<br>') : '<span class="sv-dash">—</span>') + '</td>';
            }).join('') + '</tr>';
    }
    return btns + '<div class="sva-pl-grid"><table><thead><tr><th>วันที่</th>' + cols.map(svaPlanColHead).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}
function svaPlanColHead(c) {
    return '<th>' + svEsc(c.role) + (c.time ? '<small>' + svEsc(c.time.replace(' (ของวันรุ่งขึ้น)', '')) + '</small>' : '') + '</th>';
}

// ---- แก้ตารางของงานทั้งเดือน (ช่อง = ชื่อ คั่นหลายคนด้วย ,) ----
function svaPlanEditStart(entries, banner) {
    var u = svaPlanUnitObj(), plan = entries || svaPlanOf(u.id);
    var cols = svaPlanCols(u, plan.concat(svaPlanOf(u.id))), val = {}, note = {};
    plan.forEach(function (x) {
        var k = svDateStr(svParse(x.date)) + '|' + svSlotKey(x.sec, x.time) + '|' + x.role;
        (val[k] = val[k] || []).push(x.name);
        if (x.note) note[k] = x.note;
    });
    // หมายเหตุเดิม (เช่น ชุด 3 / 05.00-21.00 น.) เก็บไว้ · ช่องใหม่ใช้หมายเหตุที่พบบ่อยของคอลัมน์ (เช่นช่วงเวลา)
    svaPlanOf(u.id).forEach(function (x) { var k = x.date + '|' + svSlotKey(x.sec, x.time) + '|' + x.role; if (x.note && !note[k]) note[k] = x.note; });
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
                return '<td><input class="' + (unk ? 'unk' : '') + '" list="' + dl + '" data-k="' + svEsc(k) + '" value="' + svEsc(v) + '" onchange="svaPlanEdSet(this)"></td>';
            }).join('') + '</tr>';
    }
    return (ed.banner ? '<div class="sva-pl-ai"><i class="fas fa-robot"></i> ' + svEsc(ed.banner) + '</div>' : '')
        + '<div class="sva-hint"><i class="fas fa-keyboard"></i> พิมพ์หรือกดเลือกชื่อ — ตัวเลือกแต่ละช่องเรียงจากคนที่เคยเข้าเวรหน้าที่นั้นบ่อยสุด ตามด้วยคนตำแหน่งเดียวกัน · หลายคนในช่องเดียวคั่นด้วย , · ช่องว่าง = ไม่มีเวร · ช่องสีส้ม = ชื่อไม่มีในทะเบียน</div>'
        + '<div class="sva-pl-grid ed"><table><thead><tr><th>วันที่</th>' + ed.cols.map(svaPlanColHead).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        + '<div class="sva-foot"><button type="button" onclick="SVA.pl.ed=null;svaPlanPaint()">ยกเลิก</button>'
        + '<button type="button" class="sva-save" onclick="svaPlanSave()"><i class="fas fa-floppy-disk"></i> บันทึกตาราง' + svEsc(u.short) + ' ทั้งเดือน</button></div>';
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
    svaPlanCall('saveStationPlan', [u.id, SVA.pl.ym, entries], function (res) {
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
function svaPlanDelete() {
    var u = svaPlanUnitObj();
    if (!confirm('ลบตาราง' + u.name + ' เดือน' + svaYmText(SVA.pl.ym) + ' ทั้งเดือน?\n(ไฟล์ต้นฉบับไม่ถูกลบ · เวรรายวันที่กรอกเองไม่ถูกลบ)')) return;
    svaPlanCall('deleteStationPlan', [u.id, SVA.pl.ym], function () { svaPlanReload(); }, 'กำลังลบ…');
}

// ---------- สไตล์ของเมนูนี้ (ฉีดครั้งเดียว) ----------
var SVA_CSS = ''
    // เว็บแอป: กรอบแท็บตัดขอบ (overflow:hidden) ทำให้หัวตารางรายเดือนตรึงกับหน้าไม่ได้ — เปิดเฉพาะตอนอยู่เมนูนี้
    + 'body.sva-on #pills-tabContent,#pills-tabContent:has(>#content-station.active){overflow:visible!important}'
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
    + '.sva-sel{border:1px solid #dbe3ee;border-radius:10px;padding:6px 8px;font-size:.82rem;max-width:230px}.sva-secs{flex:1 1 100%;order:9}'
    + '@media (max-width:560px){.sva-secs .sv-secchips{display:grid;grid-template-columns:repeat(3,1fr)}.sva-secs .sv-chip{justify-content:center;padding:7px 4px;border-radius:12px}.sva-secs .sv-chip:first-child{grid-column:1/-1}}'
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
    + '.sva-fixed{font-size:.72rem;color:#0f766e;background:#ccfbf1;border-radius:8px;padding:3px 8px;margin:2px 0 4px}.sva-fixed i{margin-right:3px}'
    + '.sva-fixbtn{border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e;border-radius:8px;font-size:.76rem;font-weight:800;padding:3px 10px;cursor:pointer}'
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
    // ---- ตารางเวรของแต่ละงาน ----
    + '.sva-plbtn{position:relative}.sva-bar .sva-plbtn.on{background:#0f766e;color:#fff;border-color:#0f766e}'
    + '.sva-pl-bad{display:inline-block;min-width:18px;padding:0 5px;border-radius:999px;background:#ea580c;color:#fff;font-size:.7rem;font-weight:800;line-height:18px;text-align:center;animation:svMisBlink 1.2s ease-in-out infinite}'
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
    + '.sva-pl-grid table{border-collapse:collapse;font-size:.76rem;min-width:100%}'
    + '.sva-pl-grid th,.sva-pl-grid td{border:1px solid #e2e8f0;padding:3px 6px;text-align:center;white-space:nowrap}'
    + '.sva-pl-grid thead th{position:sticky;top:0;z-index:2;background:#f1f5f9;font-weight:800}.sva-pl-grid thead th small{display:block;font-weight:600;color:#64748b;font-size:.64rem}'
    + '.sva-pl-grid tbody th{position:sticky;left:0;z-index:1;background:#f8fafc;text-align:left;font-weight:800}.sva-pl-grid tbody th small{color:#64748b;font-weight:600}'
    + '.sva-pl-grid tr.we td{background:#fff7ed}.sva-pl-grid tr.td th,.sva-pl-grid tr.td td{background:#dcfce7}'
    + '.sva-pl-grid.ed td{padding:2px}.sva-pl-grid.ed input{width:100%;min-width:150px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;font:inherit;font-size:.78rem}'
    + '.sva-pl-grid.ed input.unk{border-color:#f59e0b;background:#fffbeb}'
    + '@media (max-width:640px){.sva-act{margin-left:0}.sva-ed{grid-template-columns:1fr}.sva-ed-role{flex-basis:88px}}';

function svaInjectCss() {
    if (document.getElementById('sva-css')) return;
    var st = document.createElement('style'); st.id = 'sva-css'; st.textContent = SVA_CSS;
    document.head.appendChild(st);
}
