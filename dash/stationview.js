// สร้างอัตโนมัติจาก _dev/stationview.js — อย่าแก้ที่นี่
// ==========================================================
// มุมมองตารางเวร (ใช้ร่วมกัน: เว็บแอป + กระดาน GitHub)
//   - ใบเวรประจำวันทั้ง สน. (หน้าตาเหมือนแบบฟอร์มที่ สน. ใช้)
//   - ตารางเวรทุกสายงานรายเดือน
//   - ตารางเวรพนักงานสอบสวนรายเดือน
//   - ส่งออก: PDF/พิมพ์ (ย่อให้พอดี A4 แผ่นเดียวอัตโนมัติ) และบันทึกเป็นภาพ
// ข้อมูลเวรทุกสายงาน: { template:[{sec,time,color,roles[],auto}], staff:[{name,pos,dept,phone}],
//                      rows:[[วันที่, ฝ่าย, ช่วงเวลา, หน้าที่, ชื่อ, ตำแหน่ง, เบอร์, หมายเหตุ], ...] }
// ไม่พึ่งไลบรารีอื่น (ยกเว้น html2canvas ที่โหลดเฉพาะตอนกดบันทึกเป็นภาพ) — สไตล์ฉีดเองครั้งแรก
// ==========================================================

var SV_TH_MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var SV_DOW_S = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
var SV_H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
var SV_PAIR_START = 20261022, SV_SPLIT_START = 20260910;   // ระบบเวร พงส. (ดู dutySchedule.js)

function svEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function svParse(s) {
    var m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    var y = +m[3]; if (y > 2400) y -= 543;
    return new Date(y, +m[2] - 1, +m[1]);
}
function svKey(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function svDateStr(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
function svThaiLong(d) { return d.getDate() + ' ' + SV_TH_MON[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
function svSplit(v) {
    return String(v || '').split(/[,\n]|\s{2,}/).map(function (s) { return s.trim(); }).filter(function (s) { return s && s !== '-'; });
}
function svShort(full) {
    // ยศ + ชื่อจริง + ฯ (เหมือนแดชบอร์ด) — ใช้ในตารางรายเดือนที่ช่องแคบ
    var s = String(full || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    var m = s.match(/^((?:ว่าที่\s*)?(?:[฀-๿]{1,4}\.){1,3}(?:\s*หญิง)?)\s*(.*)$/);
    if (!m) return s.split(' ')[0] + 'ฯ';
    var rank = m[1].replace(/\s+/g, '').replace(/^ว่าที่/, 'ว่าที่ ');
    return rank + (/หญิง$/.test(rank) ? ' ' : '') + ((m[2] || '').trim().split(/\s+/)[0] || '') + 'ฯ';
}
// สีพื้นอ่อนจากสีหลัก (ไม่ใช้ color-mix เพราะตัวบันทึกภาพ html2canvas อ่านไม่ออก)
function svTint(hex, a) {
    var m = String(hex || '#2563eb').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return '#eef2ff';
    var c = [1, 2, 3].map(function (i) { return Math.round(parseInt(m[i], 16) * a + 255 * (1 - a)); });
    return 'rgb(' + c.join(',') + ')';
}
function svSlotKey(sec, time) { return sec + '|' + (time || ''); }

/** จัดกลุ่มแถวตามวัน: { key: { 'ฝ่าย|ช่วงเวลา': { role: [row,...] } } } */
function svIndex(data) {
    var by = {};
    ((data && data.rows) || []).forEach(function (r) {
        var d = svParse(r[0]); if (!d || !r[4]) return;
        var k = svKey(d), sk = svSlotKey(r[1], r[2]);
        by[k] = by[k] || {};
        by[k][sk] = by[k][sk] || {};
        (by[k][sk][r[3]] = by[k][sk][r[3]] || []).push(r);
    });
    return by;
}

/** หัวข้อทั้งหมดที่จะแสดง: ตามแม่แบบ + หัวข้อ/หน้าที่อื่นที่มีในข้อมูลจริง (ต่อท้าย) */
function svSlots(data, dayIdx) {
    var tpl = ((data && data.template) || []).map(function (t) {
        return { sec: t.sec, time: t.time || '', color: t.color || '#2563eb', auto: !!t.auto, roles: t.roles.slice() };
    });
    var find = function (sk) { return tpl.filter(function (t) { return svSlotKey(t.sec, t.time) === sk; })[0]; };
    Object.keys(dayIdx || {}).forEach(function (k) {
        Object.keys(dayIdx[k]).forEach(function (sk) {
            var t = find(sk);
            if (!t) {
                var p = sk.split('|');
                t = { sec: p[0], time: p[1] || '', color: '#64748b', roles: [] };
                tpl.push(t);
            }
            Object.keys(dayIdx[k][sk]).forEach(function (role) { if (t.roles.indexOf(role) < 0) t.roles.push(role); });
        });
    });
    return tpl;
}

function svTitle(main, sub) {
    return '<div class="sv-title"><div class="sv-badge">สน.ลำหิน</div><div class="sv-title-t">' + main
        + (sub ? '<span>' + sub + '</span>' : '') + '</div></div>';
}

// ---------- ใบเวรประจำวัน (หน้าตาเหมือนแบบฟอร์มของ สน.) ----------
function svDayHtml(data, date, opts) {
    opts = opts || {};
    svInjectCss();
    var idx = svIndex(data), k = svKey(date);
    var day = {}; day[k] = idx[k] || {};
    var slots = svSlots(data, day);
    var html = '<div class="sv-sheet sv-day">'
        + svTitle('ตารางเวรการปฏิบัติหน้าที่ของ สน.ลำหิน', 'ประจำวันที่ ' + svThaiLong(date))
        + '<table class="sv-table"><thead><tr><th class="sv-c-role">หน้าที่</th><th>ยศ ชื่อ สกุล</th>'
        + '<th class="sv-c-pos">ตำแหน่ง</th><th class="sv-c-tel">เบอร์โทรศัพท์</th></tr></thead><tbody>';
    var any = false;
    slots.forEach(function (t) {
        var got = day[k][svSlotKey(t.sec, t.time)] || {};
        if (t.sec !== 'ผู้บังคับบัญชา') {
            html += '<tr class="sv-sec"><td colspan="4" style="background:' + svTint(t.color, 0.24) + ';border-left:5px solid ' + t.color + '">'
                + svEsc(t.sec) + (t.time ? ' <small>เวลา ' + svEsc(t.time) + '</small>' : '') + '</td></tr>';
        }
        t.roles.forEach(function (role) {
            var list = got[role] || [];
            if (list.length) any = true;
            if (!list.length) {
                html += '<tr class="sv-empty"><td class="sv-role">' + svEsc(role) + '</td><td colspan="3">—</td></tr>';
                return;
            }
            list.forEach(function (r, i) {
                var tel = String(r[6] || '').replace(/[^0-9+]/g, '');
                html += '<tr>'
                    + (i === 0 ? '<td class="sv-role" rowspan="' + list.length + '">' + svEsc(role) + '</td>' : '')
                    + '<td class="sv-name">' + svEsc(r[4]) + (r[7] ? ' <span class="sv-note">' + svEsc(r[7]) + '</span>' : '')
                    + '<div class="sv-name-pos">' + svEsc(r[5] || '') + '</div></td>'
                    + '<td class="sv-c-pos">' + svEsc(r[5] || '') + '</td>'
                    + '<td class="sv-c-tel">' + (tel && !opts.plain ? '<a href="tel:' + tel + '">' + svEsc(r[6]) + '</a>' : svEsc(r[6] || '')) + '</td>'
                    + '</tr>';
            });
        });
    });
    html += '</tbody></table>';
    if (!any) html += '<div class="sv-none">ยังไม่มีข้อมูลเวรของวันนี้' + (opts.emptyHint ? ' — ' + opts.emptyHint : '') + '</div>';
    return html + svFoot(opts) + '</div>';
}
function svFoot(opts) {
    if (!opts || !opts.foot) return '';
    var n = new Date();
    return '<div class="sv-foot">ข้อมูล ณ ' + svThaiLong(n) + ' ' + ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2)
        + ' น. · ระบบงานสอบสวน สน.ลำหิน</div>';
}

// ---------- ตารางเวรทุกสายงานรายเดือน (แถว = วันที่, คอลัมน์ = หน้าที่) ----------
// secFilter: '' = ทุกฝ่าย หรือ 'ฝ่าย|ช่วงเวลา'
function svMonthHtml(data, year, month, secFilter, opts) {
    svInjectCss();
    var idx = svIndex(data);
    var days = new Date(year, month + 1, 0).getDate();
    var inMonth = {};
    for (var d = 1; d <= days; d++) { var kk = year * 10000 + (month + 1) * 100 + d; if (idx[kk]) inMonth[kk] = idx[kk]; }
    var slots = svSlots(data, inMonth).filter(function (t) { return !secFilter || svSlotKey(t.sec, t.time) === secFilter; });
    var cols = [];
    slots.forEach(function (t) { t.roles.forEach(function (r) { cols.push({ t: t, role: r }); }); });
    var todayK = svKey(new Date());

    var h1 = '<tr><th rowspan="2" class="sv-m-date">วันที่</th>' + slots.map(function (t) {
        return t.roles.length ? '<th colspan="' + t.roles.length + '" class="sv-m-sec" style="background:' + svTint(t.color, 0.26) + ';border-top:4px solid ' + t.color + '">'
            + svEsc(t.sec) + (t.time ? '<small>' + svEsc(t.time) + '</small>' : '') + '</th>' : '';
    }).join('') + '</tr>';
    var h2 = '<tr>' + cols.map(function (c) { return '<th class="sv-m-role">' + svEsc(c.role) + '</th>'; }).join('') + '</tr>';
    var body = '';
    for (var dd = 1; dd <= days; dd++) {
        var dt = new Date(year, month, dd), k = svKey(dt), dow = dt.getDay();
        var row = idx[k] || {};
        body += '<tr class="' + (dow === 0 || dow === 6 ? 'sv-we' : '') + (k === todayK ? ' sv-today' : '') + (k < todayK ? ' sv-past' : '') + '">'
            + '<td class="sv-m-date"><b>' + dd + '</b><span>' + SV_DOW_S[dow] + '</span></td>'
            + cols.map(function (c) {
                var list = (row[svSlotKey(c.t.sec, c.t.time)] || {})[c.role] || [];
                return '<td>' + (list.length ? list.map(function (r) {
                    return '<div title="' + svEsc(r[4] + (r[7] ? ' · ' + r[7] : '')) + '">' + svEsc(svShort(r[4])) + '</div>';
                }).join('') : '<span class="sv-dash">—</span>') + '</td>';
            }).join('') + '</tr>';
    }
    var secName = secFilter ? secFilter.replace('|', ' ').trim() : 'ทุกสายงาน';
    return '<div class="sv-sheet sv-month">'
        + svTitle('ตารางเวร' + svEsc(secName) + ' สน.ลำหิน', 'ประจำเดือน ' + SV_TH_MON[month] + ' ' + (year + 543))
        + '<div class="sv-scroll sv-vscroll"><table class="sv-table sv-mtable"><thead>' + h1 + h2 + '</thead><tbody>' + body + '</tbody></table></div>'
        + svFoot(opts) + '</div>';
}

/** ตัวเลือกฝ่ายสำหรับตารางรายเดือน */
function svSecOptions(data, selected) {
    return '<option value="">ทุกฝ่าย</option>' + svSlots(data, {}).map(function (t) {
        var v = svSlotKey(t.sec, t.time);
        return '<option value="' + svEsc(v) + '"' + (v === selected ? ' selected' : '') + '>' + svEsc(t.sec + (t.time ? ' ' + t.time : '')) + '</option>';
    }).join('');
}

// ---------- ตารางเวรพนักงานสอบสวนรายเดือน (จากแถวเวรรูปแบบกลาง) ----------
// duty: [[วันที่, พงส.ช่องกลางวัน, ผช., ส่งของกลาง, หมายเหตุ, เวรเสริม, พงส.ช่อง 24 ชม./ผลัดเย็น], ...]
function svInvestMonthHtml(duty, year, month, opts) {
    svInjectCss();
    var byKey = {};
    (duty || []).forEach(function (r) { var d = svParse(r && r[0]); if (d) byKey[svKey(d)] = r; });
    var days = new Date(year, month + 1, 0).getDate(), todayK = svKey(new Date());
    var rows = [], has = { day: false, evi: false, extra: false };
    for (var dd = 1; dd <= days; dd++) {
        var dt = new Date(year, month, dd), k = svKey(dt), r = byKey[k] || [];
        var a = svSplit(r[1]), b = svSplit(r[6]);
        var same = a.length && b.length && a.join() === b.join();
        var main = [], day = [], mainNote = '', dayNote = '';
        if (same || !a.length || !b.length) main = a.length ? a : b;
        else if (k >= SV_PAIR_START) { main = b; day = a; }
        else if (k >= SV_SPLIT_START) { main = b; day = a; mainNote = 'ผลัดเย็น'; dayNote = 'ผลัดเช้า'; }
        else { main = b; day = a; }
        var x = { dt: dt, k: k, main: main, day: day, mainNote: mainNote, dayNote: dayNote, asst: svSplit(r[2]), evi: svSplit(r[3]), extra: svSplit(r[5]) };
        if (day.length) has.day = true;
        if (x.evi.length) has.evi = true;
        if (x.extra.length) has.extra = true;
        rows.push(x);
    }
    function cell(list, note) {
        if (!list.length) return '<td><span class="sv-dash">—</span></td>';
        return '<td>' + list.map(function (n) { return '<div>' + svEsc(svShort(n)) + '</div>'; }).join('')
            + (note ? '<small class="sv-cnote">' + note + '</small>' : '') + '</td>';
    }
    var head = '<tr><th class="sv-m-date">วันที่</th>'
        + '<th class="sv-i-main">พงส.เวร<small>24 ชม. (08:01 น.)</small></th>'
        + (has.day ? '<th class="sv-i-day">คู่เวรกลางวัน<small>08:01–18:00 น. (จ.–ศ.)</small></th>' : '')
        + '<th class="sv-i-asst">ผช.พงส.<small>24 ชม.</small></th>'
        + (has.evi ? '<th>ส่งของกลาง</th>' : '') + (has.extra ? '<th>เวรเสริม</th>' : '') + '</tr>';
    var body = rows.map(function (x) {
        var dow = x.dt.getDay();
        return '<tr class="' + (dow === 0 || dow === 6 ? 'sv-we' : '') + (x.k === todayK ? ' sv-today' : '') + (x.k < todayK ? ' sv-past' : '') + '">'
            + '<td class="sv-m-date"><b>' + x.dt.getDate() + '</b><span>' + SV_DOW_S[dow] + '</span></td>'
            + cell(x.main, x.mainNote) + (has.day ? cell(x.day, x.dayNote) : '') + cell(x.asst)
            + (has.evi ? cell(x.evi) : '') + (has.extra ? cell(x.extra) : '') + '</tr>';
    }).join('');
    return '<div class="sv-sheet sv-month sv-invest">'
        + svTitle('ตารางเวรพนักงานสอบสวน สน.ลำหิน', 'ประจำเดือน ' + SV_TH_MON[month] + ' ' + (year + 543))
        + '<div class="sv-scroll sv-vscroll"><table class="sv-table sv-mtable sv-itable"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
        + svFoot(opts) + '</div>';
}

/** เลื่อนกล่องตารางรายเดือนทุกกล่องใน root ให้แถว "วันนี้" อยู่กลางกล่อง (ไม่มีแถววันนี้ = ไม่เลื่อน) */
function svScrollToToday(root) {
    if (!root || !root.querySelectorAll) return;
    [].forEach.call(root.querySelectorAll('.sv-vscroll'), function (box) {
        var tr = box.querySelector('tr.sv-today');
        if (!tr) { box.scrollTop = 0; return; }
        var head = box.querySelector('thead');
        var hh = head ? head.offsetHeight : 0;
        var top = tr.offsetTop - hh - (box.clientHeight - hh - tr.offsetHeight) / 2;
        box.scrollTop = Math.max(0, top);
    });
}

// ==========================================================
// ส่งออก
// ==========================================================
// PDF / พิมพ์: หน้าใหม่ที่มีแต่ตาราง วางในกรอบ A4 แล้วย่อ/ขยายให้พอดีแผ่นเดียวอัตโนมัติ
// ในหน้าต่างพิมพ์เลือกเครื่องพิมพ์ หรือ "บันทึกเป็น PDF"
// opts.a4 = ใบเวรประจำวัน: ยืดตารางเต็มหน้ากระดาษ ตัวอักษรใหญ่ (แทนการย่อเนื้อหาให้พอดีแผ่น)
function svExportPdf(title, sheetHtml, landscape, opts) {
    var a4 = !!(opts && opts.a4);
    var w = window.open('', '_blank');
    if (!w) { alert('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — กรุณาอนุญาตป๊อปอัปแล้วลองอีกครั้ง'); return; }
    var pw = landscape ? 281 : 194, ph = landscape ? 194 : 281;   // พื้นที่พิมพ์ได้ของ A4 (ขอบ 8 มม.)
    w.document.open();
    w.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<title>' + svEsc(title) + '</title>'
        + '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">'
        + '<style>' + SV_CSS + SV_PRINT_CSS
        + '.sv-page{width:' + pw + 'mm;height:' + ph + 'mm}'
        + '@media print{@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:8mm}}</style></head><body class="sv-print">'
        + '<div class="sv-tools"><button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>ปรับให้พอดีกระดาษ A4 '
        + (landscape ? 'แนวนอน' : 'แนวตั้ง') + ' 1 แผ่นแล้ว</span></div>'
        + '<div class="sv-page"><div class="sv-fit' + (a4 ? ' sv-a4' : '') + '">' + sheetHtml + '</div></div>'
        + '<script>(function(){'
        + 'function fit(){var p=document.querySelector(".sv-page"),f=document.querySelector(".sv-fit");f.style.zoom=1;'
        + 'var s=Math.min(f.classList.contains("sv-a4")?1:1.8,p.clientWidth/f.scrollWidth,p.clientHeight/f.scrollHeight);f.style.zoom=s;}'
        + 'var go=function(){fit();setTimeout(function(){window.print();},350);};'
        + 'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(go,150);});}else{window.onload=go;}'
        + '})();<\/script></body></html>');
    w.document.close();
}

// บันทึกเป็นภาพ PNG (ความละเอียด 2 เท่า อ่านชัดบนมือถือ)
// มือถือ: เปิดภาพในแท็บใหม่ให้กดค้างแล้วบันทึก (iPhone ไม่รองรับการดาวน์โหลดตรง)
// คอมพิวเตอร์: ดาวน์โหลดไฟล์ทันที
function svExportImage(title, sheetHtml, landscape, opts) {
    var a4 = !!(opts && opts.a4) && !landscape;
    var W = landscape ? 1240 : (a4 ? 1000 : 860);
    var touch = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    var w = touch ? window.open('', '_blank') : null;   // เปิดตอนกด (หลังรอสร้างภาพเบราว์เซอร์จะบล็อก)
    if (w) w.document.write('<meta name="viewport" content="width=device-width,initial-scale=1"><p style="font-family:sans-serif;padding:24px;color:#334155">กำลังสร้างภาพ…</p>');
    svLoadH2C(function (err) {
        if (err) { if (w) w.close(); alert('สร้างภาพไม่สำเร็จ (โหลดตัวช่วยไม่ได้)'); return; }
        svInjectCss();
        var box = document.createElement('div');
        box.className = 'sv-shot';
        box.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + W + 'px;background:#fff;padding:' + (a4 ? 24 : 18) + 'px';
        // A4 แนวตั้ง = กว้าง:สูง 1:1.414 — ให้ใบเวรยืดเต็มความสูงนั้น
        box.innerHTML = a4 ? '<div class="sv-a4" style="min-height:' + Math.round(W * 1.4142 - 48) + 'px">' + sheetHtml + '</div>' : sheetHtml;
        document.body.appendChild(box);
        var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
        ready.then(function () {
            return window.html2canvas(box, { scale: 2, backgroundColor: '#ffffff', logging: false });
        }).then(function (canvas) {
            box.parentNode.removeChild(box);
            var url = canvas.toDataURL('image/png');
            var name = String(title).replace(/[\\/:*?"<>|]/g, ' ').trim() + '.png';
            if (w) {
                w.document.open();
                w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                    + '<title>' + svEsc(title) + '</title></head><body style="margin:0;background:#0f172a;text-align:center;font-family:sans-serif">'
                    + '<div style="color:#e2e8f0;padding:12px;font-size:15px">กดค้างที่รูป แล้วเลือก "บันทึกรูปภาพ" / "เพิ่มไปยังรูปภาพ"</div>'
                    + '<img src="' + url + '" alt="' + svEsc(title) + '" style="width:100%;max-width:1000px;display:block;margin:0 auto"></body></html>');
                w.document.close();
            } else {
                var a = document.createElement('a');
                a.href = url; a.download = name;
                document.body.appendChild(a); a.click();
                setTimeout(function () { a.parentNode.removeChild(a); }, 500);
            }
        }).catch(function (e) {
            if (box.parentNode) box.parentNode.removeChild(box);
            if (w) w.close();
            alert('สร้างภาพไม่สำเร็จ: ' + e);
        });
    });
}
function svLoadH2C(cb) {
    if (window.html2canvas) { cb(); return; }
    var sc = document.createElement('script');
    sc.src = SV_H2C_URL;
    sc.onload = function () { cb(); };
    sc.onerror = function () { cb(new Error('load')); };
    document.head.appendChild(sc);
}

/** ปุ่มส่งออกคู่ (PDF + ภาพ) — onPdf/onImg เป็นชื่อฟังก์ชันที่จะเรียก */
function svExportButtons(onPdf, onImg) {
    return '<div class="sv-xbtns">'
        + '<button type="button" class="sv-x-pdf" onclick="' + onPdf + '"><i class="fas fa-file-pdf"></i> PDF</button>'
        + '<button type="button" class="sv-x-img" onclick="' + onImg + '"><i class="fas fa-image"></i> ภาพ</button></div>';
}

// ---------- สไตล์ (ฉีดครั้งเดียว) ----------
var SV_CSS = ''
    + '.sv-sheet{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.05),0 8px 24px rgba(15,23,42,.08);color:#0f172a;font-family:Sarabun,system-ui,sans-serif}'
    + '.sv-title{display:flex;align-items:center;gap:12px;padding:12px 16px;color:#fff;background:linear-gradient(118deg,#0a2463,#1d4ed8 62%,#38bdf8)}'
    + '.sv-badge{flex-shrink:0;padding:6px 10px;border-radius:10px;font-weight:800;font-size:.78rem;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35)}'
    + '.sv-title-t{font-weight:800;font-size:1.05rem;line-height:1.3}.sv-title-t span{display:block;font-weight:600;font-size:.86rem;opacity:.92}'
    + '.sv-table{width:100%;border-collapse:collapse;font-size:.86rem}'
    + '.sv-table th,.sv-table td{border:1px solid #d5dde8;padding:6px 9px;vertical-align:middle}'
    + '.sv-table thead th{background:#f1f5f9;font-weight:800;color:#334155;text-align:center}'
    + '.sv-c-role{width:23%}.sv-c-tel{white-space:nowrap;text-align:center}.sv-c-tel a{color:#1d4ed8;text-decoration:none;font-weight:700}'
    + '.sv-role{font-weight:800;text-align:center;background:#f8fafc;color:#1e293b}'
    + '.sv-name{font-weight:700}.sv-name-pos{display:none;font-size:.74rem;font-weight:500;color:#64748b}'
    + '.sv-note{display:inline-block;font-size:.68rem;font-weight:800;color:#92400e;background:#fef3c7;border-radius:999px;padding:0 7px;margin-left:4px}'
    + '.sv-sec td{text-align:left;font-weight:800;color:#0f172a;padding:7px 10px}'
    + '.sv-sec small{font-weight:700;margin-left:6px;color:#334155}'
    + '.sv-empty td{color:#a3b0c2}.sv-empty .sv-role{color:#64748b}'
    + '.sv-none{padding:12px;text-align:center;color:#64748b;font-size:.85rem;background:#f8fafc}'
    + '.sv-foot{padding:7px 12px;font-size:.7rem;color:#64748b;text-align:right;background:#f8fafc;border-top:1px solid #e2e8f0}'
    + '.sv-scroll{overflow-x:auto}'
    + '.sv-mtable{font-size:.76rem;min-width:640px}.sv-mtable td{text-align:center;white-space:nowrap;padding:4px 6px}'
    + '.sv-mtable td div+div{margin-top:2px}'
    + '.sv-m-sec{color:#0f172a}.sv-m-sec small{display:block;font-weight:600;font-size:.66rem}'
    + '.sv-mtable th small{display:block;font-weight:600;font-size:.66rem;color:#475569}'
    + '.sv-m-role{font-size:.7rem}.sv-m-date{width:54px;position:sticky;left:0;background:#fff;z-index:1;text-align:left!important}'
    + '.sv-m-date b{font-size:.95rem;margin-right:4px}.sv-m-date span{font-size:.68rem;color:#64748b}'
    + 'thead .sv-m-date{background:#f1f5f9}'
    + '.sv-we td{background:#fff7ed}'
    + '.sv-today td{background:#dcfce7!important;font-weight:800}.sv-today .sv-m-date b{color:#047857}'
    + '.sv-dash{color:#cbd5e1}.sv-cnote{display:block;font-size:.62rem;color:#b45309;font-weight:700}'
    // ---- ตารางรายเดือนบนจอ: กล่องเลื่อนสูงราวหนึ่งจอ หัวตารางตรึง วันที่ผ่านไปแล้วตัวจาง ----
    + '.sv-vscroll{max-height:calc(100vh - 170px);min-height:320px;overflow:auto;overscroll-behavior:contain}'
    + '.sv-vscroll thead{position:sticky;top:0;z-index:3;box-shadow:0 2px 6px rgba(15,23,42,.12)}'
    + '.sv-vscroll thead .sv-m-date{z-index:4}'
    + '.sv-past td{color:#a3b0c2}.sv-past td div{opacity:.55}.sv-past .sv-m-date b{color:#a3b0c2}'
    + '.sv-itable{min-width:0;font-size:.84rem}.sv-itable td{padding:5px 8px}.sv-i-main{background:#fef3c7!important}.sv-i-day{background:#e0f2fe!important}.sv-i-asst{background:#ede9fe!important}'
    + '.sv-xbtns{display:inline-flex;gap:6px}.sv-xbtns button{border:0;border-radius:10px;padding:7px 12px;font:inherit;font-weight:800;font-size:.82rem;color:#fff;cursor:pointer;white-space:nowrap}'
    + '.sv-x-pdf{background:#dc2626}.sv-x-img{background:#059669}'
    + '@media (max-width:560px){.sv-c-pos{display:none}.sv-name-pos{display:block}.sv-table{font-size:.82rem}.sv-c-role{width:30%}.sv-title{padding:10px 12px}.sv-title-t{font-size:.95rem}.sv-badge{display:none}}'
    // ตอนสร้างภาพ/พิมพ์ ให้แสดงแบบเต็ม (ไม่ซ่อนคอลัมน์แบบจอมือถือ)
    + '.sv-shot .sv-c-pos,.sv-print .sv-c-pos{display:table-cell}.sv-shot .sv-name-pos,.sv-print .sv-name-pos{display:none}'
    + '.sv-shot .sv-badge,.sv-print .sv-badge{display:block}.sv-shot .sv-scroll,.sv-print .sv-scroll{overflow:visible;max-height:none!important}'
    + '.sv-shot .sv-past td,.sv-print .sv-past td{color:inherit!important}.sv-shot .sv-past td div,.sv-print .sv-past td div{opacity:1!important}'
    + '.sv-shot thead,.sv-print thead{position:static!important}'
    + '.sv-shot .sv-sheet,.sv-print .sv-sheet{box-shadow:none;border:1px solid #cbd5e1;border-radius:12px}'
    + '.sv-shot .sv-m-date,.sv-print .sv-m-date{position:static}'
    // ---- ใบเวรประจำวันแบบเต็มหน้า A4 ----
    + '.sv-a4{display:flex;flex-direction:column}'
    + '.sv-a4 .sv-sheet{flex:1;display:flex;flex-direction:column;min-width:0!important}'
    + '.sv-a4 .sv-table{flex:1;height:100%;font-size:1.06rem}'
    + '.sv-a4 .sv-title{padding:18px 22px}.sv-a4 .sv-title-t{font-size:1.5rem}.sv-a4 .sv-title-t span{font-size:1.12rem}'
    + '.sv-a4 .sv-badge{font-size:.95rem;padding:8px 12px}'
    + '.sv-a4 .sv-table thead th{font-size:1rem;padding:10px 12px}'
    + '.sv-a4 .sv-table td{padding:8px 12px}'
    + '.sv-a4 .sv-role{font-size:1.02rem}.sv-a4 .sv-name{font-size:1.14rem}'
    + '.sv-a4 .sv-c-pos{font-size:1rem}.sv-a4 .sv-c-tel{font-size:1.1rem}'
    + '.sv-a4 .sv-sec td{font-size:1.1rem;padding:10px 12px}.sv-a4 .sv-sec small{font-size:.95rem}'
    + '.sv-a4 .sv-note{font-size:.82rem}.sv-a4 .sv-foot{font-size:.88rem;padding:9px 14px}'
    + '.sv-print .sv-fit.sv-a4{width:100%;height:100%}';
var SV_PRINT_CSS = ''
    + 'body.sv-print{margin:0;padding:12px;background:#e2e8f0;font-family:Sarabun,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.sv-tools{display:flex;gap:10px;align-items:center;justify-content:center;margin:0 0 12px;font-size:13px;color:#475569}'
    + '.sv-tools button{border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:800;background:#1d4ed8;color:#fff;cursor:pointer}'
    + '.sv-page{margin:0 auto;background:#fff;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.25);display:flex;align-items:flex-start;justify-content:center}'
    + '.sv-fit{width:max-content;max-width:none}.sv-fit .sv-sheet{min-width:640px}.sv-fit .sv-mtable{min-width:0}'
    + '@media print{body.sv-print{padding:0;background:#fff}.sv-tools{display:none}.sv-page{box-shadow:none;margin:0}}';

function svInjectCss() {
    if (typeof document === 'undefined' || document.getElementById('sv-css')) return;
    var st = document.createElement('style');
    st.id = 'sv-css';
    st.textContent = SV_CSS;
    document.head.appendChild(st);
}
