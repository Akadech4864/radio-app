// สร้างอัตโนมัติจาก _dev/dashcalc.js — อย่าแก้ที่นี่
// ==========================================================
// คำนวณตัวเลขสำหรับแดชบอร์ดศูนย์บัญชาการ
// แยกออกมาเป็นฟังก์ชันล้วน ๆ เพื่อให้ทดสอบด้วย Node ได้โดยไม่ต้องมีเบราว์เซอร์
// ==========================================================

// ---- ปีงบประมาณ: เริ่ม 1 ต.ค. ----
// ปีงบ พ.ศ. 2569 = 1 ต.ค.2568 ถึง 30 ก.ย.2569
function dashFyOf(d) { return (d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear()) + 543; }
function dashFyStart(fyBE) { return new Date(fyBE - 543 - 1, 9, 1); }
function dashFyEnd(fyBE) { return new Date(fyBE - 543, 8, 30, 23, 59, 59); }

function dashParseDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    var s = String(v || '').trim();
    if (!s) return null;
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
        var y = parseInt(m[3], 10); if (y > 2400) y -= 543;
        var d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
        return isNaN(d.getTime()) ? null : d;
    }
    var d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : d2;
}

// ---- รวมชื่อคนเดียวกันที่เขียนยศต่างกัน ----
// เช่น "ว่าที่ พ.ต.ต. สุพจน์ แก้วเจริญ" กับ "พ.ต.ต.สุพจน์ แก้วเจริญ" = คนเดียวกัน
// วิธี: ตัดช่องว่าง/จุด แล้วลอกคำนำหน้ายศออกจนหมด เหลือแต่ชื่อ-สกุล
var DASH_RANK_WORDS = ['นางสาว', 'ว่าที่', 'พลตอ', 'พลตท', 'พลตต', 'พตอ', 'พตท', 'พตต',
    'รตอ', 'รตท', 'รตต', 'จสต', 'สตอ', 'สตท', 'สตต', 'ดต', 'นาย', 'นาง', 'หญิง', 'นส'];
function dashPersonKey(name) {
    var s = String(name || '').replace(/[\s.\u00a0]/g, '');
    var again = true;
    while (again) {
        again = false;
        for (var i = 0; i < DASH_RANK_WORDS.length; i++) {
            var w = DASH_RANK_WORDS[i];
            if (s.indexOf(w) === 0) { s = s.slice(w.length); again = true; break; }
        }
    }
    return s;
}

// ชื่อสำหรับแสดงผล: เก็บยศไว้ + ชื่อตัว (ตัดนามสกุลออกให้พอดีตาราง)
function dashRankName(full) {
    // รูปแบบที่ใช้ทั้งหน้าแดชบอร์ด: ยศติดชื่อจริง ตามด้วย ฯ  เช่น ร.ต.อ.คิมหันฐ์ฯ
    //   "ว่าที่" เว้นวรรคหนึ่งครั้ง (ว่าที่ ร.ต.ท.สัญญาฯ)
    //   ยศหญิงเว้นวรรคก่อนชื่อ (ร.ต.ท.หญิง นภัสร์นันท์ฯ)
    var s = String(full || '').replace(/\s+/g, ' ').trim();
    if (!s) return '-';
    var m = s.match(/^((?:ว่าที่\s*)?(?:[\u0E00-\u0E7F]{1,4}\.){1,3}(?:\s*หญิง)?)\s*(.*)$/);
    if (!m) return s.split(' ')[0] + 'ฯ';
    var rank = m[1].replace(/\s+/g, '').replace(/^ว่าที่/, 'ว่าที่ ');
    var first = ((m[2] || '').trim().split(/\s+/)[0]) || '';
    var gap = /หญิง$/.test(rank) ? ' ' : '';
    return rank + gap + first + 'ฯ';
}

// ---- ช่วงเวลาที่เลือกดูได้ ----
// 'fy:2569' = ปีงบนั้นเต็มปี | 'span:2569' = ตั้งแต่ต้นปีงบนั้นถึงปัจจุบัน
function dashRangeOf(value, today) {
    today = today || new Date();
    var parts = String(value || '').split(':');
    var kind = parts[0] === 'span' ? 'span' : 'fy';
    var fy = parseInt(parts[1], 10) || dashFyOf(today);
    var from = dashFyStart(fy);
    if (kind === 'span') {
        var to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        return { kind: 'span', fy: fy, from: from, to: to, value: 'span:' + fy,
            label: 'ปีงบ ' + fy + ' – ปัจจุบัน' };
    }
    return { kind: 'fy', fy: fy, from: from, to: dashFyEnd(fy), value: 'fy:' + fy,
        label: 'ปีงบประมาณ ' + fy };
}

function dashAddMonths(d, n) {
    var r = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(d.getDate(), last)); r.setHours(0, 0, 0, 0);
    return r;
}

// ---- จัดกลุ่ม "ข้อหา" ให้เป็นประเภทคดีสั้น ๆ สำหรับทำกราฟจัดอันดับ ----
// เรียงจากเฉพาะเจาะจงไปกว้าง — เจอตัวแรกถือว่าใช่
var DASH_CHARGE_MAP = [
    [/ประมาท/, 'ขับรถประมาท'],
    [/เสพยาเสพติด|เสพวัตถุออกฤทธิ์|เสพย์?ยาเสพติด/, 'เสพยาเสพติด'],
    [/ผลิต\s*นำเข้า\s*ส่งออก\s*จำหน่าย|จำหน่ายวัตถุออกฤทธิ์|จำหน่ายยาเสพติด|สมคบ.*ยาเสพติด/, 'จำหน่ายยาเสพติด'],
    [/ครอบครองซึ่งยาเสพติด|ครอบครองซึ่งวัตถุออกฤทธิ์|ครอบครองยาเสพติด/, 'ครอบครองยาเสพติด'],
    [/ลักทรัพย์/, 'ลักทรัพย์'],
    [/ช่วยซ่อนเร้น.*รับจำ?นำ|รับของโจร/, 'รับของโจร'],
    [/ฉ้อโกง/, 'ฉ้อโกง'],
    [/ยักยอก/, 'ยักยอก'],
    [/ฟอกเงิน/, 'ฟอกเงิน'],
    [/ดอกเบี้ยเกินอัตรา|ให้สินเชื่อส่วนบุคคล|กู้ยืมเงินโดยไม่ได้รับอนุญาต/, 'ดอกเบี้ย/ปล่อยกู้ผิดกฎหมาย'],
    [/ทำร้ายร่างกาย|อันตรายแก่กายหรือจิตใจ|อันตรายสาหัส/, 'ทำร้ายร่างกาย'],
    [/ทำให้เสียทรัพย์/, 'ทำให้เสียทรัพย์'],
    [/บุกรุก/, 'บุกรุก'],
    [/พาอาวุธ|อาวุธปืน|พ\.?ร\.?บ\.?\s*อาวุธ/, 'อาวุธปืน/พาอาวุธ'],
    [/เมาสุรา|เมาแล้วขับ|เสพย์?สุรา|ของเมา/, 'เมาสุรา'],
    [/การพนัน|การเล่นอื่นใดนอกจากการเล่นในบัญชี/, 'การพนัน'],
    [/คนต่างด้าว|บุคคลต่างด้าว/, 'คนต่างด้าว'],
    [/ข่มขืน|อนาจาร|ค้าประเวณี/, 'ความผิดทางเพศ'],
    [/ดูหมิ่น|หมิ่นประมาท/, 'ดูหมิ่น/หมิ่นประมาท'],
    [/บัตรอิเล็กทรอนิกส์/, 'บัตรอิเล็กทรอนิกส์'],
    [/คอมพิวเตอร์/, 'พ.ร.บ.คอมพิวเตอร์'],
    [/ส่งเสียง|อื้ออึง/, 'ก่อความเดือดร้อนรำคาญ']
];
function dashChargeGroup(txt) {
    var t = String(txt || '').replace(/\s+/g, ' ');
    if (!t) return 'ไม่ระบุข้อหา';
    for (var i = 0; i < DASH_CHARGE_MAP.length; i++) {
        if (DASH_CHARGE_MAP[i][0].test(t)) return DASH_CHARGE_MAP[i][1];
    }
    return 'อื่น ๆ';
}


// ---- คดีอาญาที่เกี่ยวกับออนไลน์ (ข้อหาตาม พ.ร.บ.คอมพิวเตอร์ / ฉ้อโกงทางออนไลน์) ----
var DASH_CYBER_RE = /คอมพิวเตอร์|ออนไลน์|อินเทอร์เน็ต|อิเล็กทรอนิกส์/;

// ---- คดีอุกฉกรรจ์และสะเทือนขวัญ (กลุ่มที่ 1 ตามการแบ่งประเภทคดีของ ตร.) ----
var DASH_SERIOUS = [
    [/ฆ่าผู้อื่น|ฆ่าคนตาย|เจตนาฆ่า|พยายามฆ่า/, 'ฆ่า / พยายามฆ่า'],
    [/ปล้นทรัพย์/, 'ปล้นทรัพย์'],
    [/ชิงทรัพย์|วิ่งราวทรัพย์/, 'ชิงทรัพย์ / วิ่งราวทรัพย์'],
    [/เรียกค่าไถ่|หน่วงเหนี่ยว|กักขัง/, 'ลักพา / หน่วงเหนี่ยวกักขัง'],
    [/วางเพลิง/, 'วางเพลิง'],
    [/ข่มขืน|กระทำชำเรา/, 'ข่มขืนกระทำชำเรา'],
    [/อั้งยี่|ซ่องโจร/, 'อั้งยี่ / ซ่องโจร']
];
function dashSeriousOf(charge) {
    var t = String(charge || '').replace(/s+/g, ' ');
    for (var i = 0; i < DASH_SERIOUS.length; i++) {
        if (DASH_SERIOUS[i][0].test(t)) return DASH_SERIOUS[i][1];
    }
    return null;
}
// นับคดีอุกฉกรรจ์ของปีงบใดก็ได้ (ใช้เทียบกับปีก่อนหน้า)
function dashCountSerious(crimeRows, range) {
    if (typeof range === 'number' || typeof range === 'string') range = dashRangeOf('fy:' + range);
    var from = range.from, to = range.to, n = 0;
    (crimeRows || []).slice(1).forEach(function (r) {
        if (!r) return;
        var d = dashParseDate(r[7]);
        if (!d || d < from || d > to) return;
        if (dashSeriousOf(r[5])) n++;
    });
    return n;
}

function dashIsFinished(status) {
    var s = String(status || '');
    return s.indexOf('จำหน่าย') > -1 || s.indexOf('เสร็จ') > -1
        || s.indexOf('งดการ') > -1 || s.indexOf('เปรียบเทียบปรับ') > -1;
}

// ==========================================================
// คำนวณสถิติคดีทั้งหมดในช่วงปีงบที่เลือก
// crimeRows = ชีต "รวมข้อมูล" (รวมหัวตาราง), onlineRows = ชีต "คดีออนไลน์"
// ==========================================================
function dashComputeCases(crimeRows, onlineRows, range, today, canon) {
    today = today || new Date(); today.setHours(0, 0, 0, 0);
    if (typeof range === 'number' || typeof range === 'string') range = dashRangeOf('fy:' + range, today);
    var fyBE = range.fy, from = range.from, to = range.to;
    // รวมชื่อซ้ำด้วยคีย์ที่ตัดยศออก ไม่ต้องพึ่งทะเบียนกำลังพล (คนย้ายไปแล้วก็ยังรวมถูก)
    var norm = dashPersonKey;
    // จำนวนวันที่ผ่านไปในปีงบนี้ (ถ้าปีงบจบแล้วก็นับเต็มปี) — ใช้หาค่าเฉลี่ยต่อวัน
    var until = new Date(Math.min(to.getTime(), today.getTime()));
    var elapsedDays = Math.max(1, Math.round((until - from) / 86400000) + 1);

    var out = {
        fy: fyBE, from: from, to: to, days: elapsedDays,
        range: range, rangeLabel: range.label,
        total: 0, criminal: 0, traffic: 0, online: 0,
        open: 0, openCriminal: 0, openTraffic: 0, finished: 0,
        age3: 0, age6: 0, age1y: 0,      // ค้างเกิน 3 เดือน / 6 เดือน / 1 ปี (นับเฉพาะที่ยังสอบสวน)
        overCriminal: 0, overTraffic: 0,  // ค้างเกินกำหนด แยกอาญา/จราจร
        damage: 0,
        serious: 0, seriousItems: [],     // คดีอุกฉกรรจ์และสะเทือนขวัญ
        byMonth: [],                      // 12 เดือนของปีงบ (ต.ค. → ก.ย.)
        rankCriminal: [], rankTraffic: [], rankOnline: [],
        byOfficer: [], oldest: []
    };
    // สร้างช่องรายเดือนตามช่วงที่เลือก (ปีงบเดียว = 12 เดือน ต.ค.→ก.ย. | ช่วงยาว = เท่าที่มีจริง)
    var TH_MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var monIndex = {};
    (function () {
        var cur = new Date(from.getFullYear(), from.getMonth(), 1);
        var last = new Date(to.getFullYear(), to.getMonth(), 1);
        while (cur <= last) {
            var key = cur.getFullYear() + '-' + cur.getMonth();
            monIndex[key] = out.byMonth.length;
            out.byMonth.push({
                key: key, crime: 0, online: 0,
                label: TH_MON_S[cur.getMonth()],
                year: (cur.getFullYear() + 543) % 100
            });
            cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        }
    })();
    function monSlot(d) { return monIndex[d.getFullYear() + '-' + d.getMonth()]; }

    var gC = {}, gT = {}, gO = {}, byOfc = {}, openList = [], gS = {}, gOD = {};

    (crimeRows || []).slice(1).forEach(function (r) {
        if (!r) return;
        var d = dashParseDate(r[7]);
        if (!d || d < from || d > to) return;
        var type = String(r[9] || '');
        var isTraf = type.indexOf('จราจร') > -1;
        var isCrim = !isTraf;                      // ไม่ใช่จราจร = นับเป็นอาญา
        var fin = dashIsFinished(r[0]);
        var grp = dashChargeGroup(r[5]);
        var ofc = String(r[6] || '').trim() || 'ไม่ระบุ';

        out.total++;
        if (isTraf) out.traffic++; else out.criminal++;
        if (isTraf) gT[grp] = (gT[grp] || 0) + 1; else gC[grp] = (gC[grp] || 0) + 1;
        var sv = dashSeriousOf(r[5]);
        if (sv) { out.serious++; gS[sv] = (gS[sv] || 0) + 1; }

        var mi = monSlot(d);
        if (mi != null) out.byMonth[mi].crime++;

        var ok = norm(ofc);
        if (!byOfc[ok]) byOfc[ok] = { name: ofc, total: 0, open: 0, over3: 0, over6: 0, online: 0, criminal: 0, traffic: 0, damage: 0, cyber: 0 };
        // ชีตคนละใบเขียนยศไม่เหมือนกัน — เก็บชื่อที่ยาวที่สุดไว้แสดง จะได้มียศครบ
        if (String(ofc).length > String(byOfc[ok].name).length) byOfc[ok].name = ofc;
        byOfc[ok].total++;
        if (isTraf) byOfc[ok].traffic++; else byOfc[ok].criminal++;
        // คดีอาญาที่มาจากออนไลน์ (เลขคดีอาญาแล้ว) ดูจากข้อหา เช่น ฉ้อโกง + นำเข้าข้อมูลคอมพิวเตอร์อันเป็นเท็จ
        if (!isTraf && DASH_CYBER_RE.test(String(r[5] || ''))) { byOfc[ok].cyber++; out.cyber = (out.cyber || 0) + 1; }

        if (fin) { out.finished++; return; }

        out.open++;
        byOfc[ok].open++;
        if (isTraf) out.openTraffic++; else out.openCriminal++;
        var m3 = dashAddMonths(d, 3), m6 = dashAddMonths(d, 6), y1 = dashAddMonths(d, 12);
        if (today >= m3) {
            if (today >= y1) out.age1y++; else if (today >= m6) out.age6++; else out.age3++;
            if (today >= m6) byOfc[ok].over6++; else byOfc[ok].over3++;   // ภาระงาน: ค้าง 3–6 เดือน / เกิน 6 เดือน
            if (isTraf) out.overTraffic++; else out.overCriminal++;
        }
        openList.push({
            caseNo: String(r[1] || ''), date: d, officer: ofc, charge: grp,
            type: isTraf ? 'จราจร' : 'อาญา',
            days: Math.round((today - d) / 86400000)
        });
    });

    (onlineRows || []).slice(1).forEach(function (r) {
        if (!r || !r[0]) return;
        var d = dashParseDate(r[1]);
        if (!d || d < from || d > to) return;
        out.online++;
        // สถานะคดีออนไลน์: สิ้นสุด / ส่งสำนวนอัยการ = สิ้นสุด · อื่น ๆ (พบ พงส., อายัดบัญชี, ออกหมายเรียก …) = ระหว่างสอบสวน
        var onDone = /สิ้นสุด|ส่งสำนวน|เสร็จ|ยุติ/.test(String(r[14] || ''));
        if (onDone) out.onlineDone = (out.onlineDone || 0) + 1; else out.onlineOpen = (out.onlineOpen || 0) + 1;
        out.damage += parseFloat(String(r[8] || '0').replace(/[^0-9.\-]/g, '')) || 0;
        var g = String(r[5] || '').trim() || 'ไม่ระบุ';
        gO[g] = (gO[g] || 0) + 1;
        gOD[g] = (gOD[g] || 0) + (parseFloat(String(r[8] || '0').replace(/[^0-9.-]/g, '')) || 0);
        var moi = monSlot(d);
        if (moi != null) out.byMonth[moi].online++;
        var oo = String(r[12] || '').trim();
        if (oo) {
            var ook = norm(oo);
            if (!byOfc[ook]) byOfc[ook] = { name: oo, total: 0, open: 0, over3: 0, over6: 0, online: 0, criminal: 0, traffic: 0, damage: 0, cyber: 0 };
            if (String(oo).length > String(byOfc[ook].name).length) byOfc[ook].name = oo;
            byOfc[ook].online++;
            if (onDone) byOfc[ook].onlineDone = (byOfc[ook].onlineDone || 0) + 1; else byOfc[ook].onlineOpen = (byOfc[ook].onlineOpen || 0) + 1;
            byOfc[ook].damage += parseFloat(String(r[8] || '0').replace(/[^0-9.-]/g, '')) || 0;
        }
    });

    function rank(obj, n) {
        return Object.keys(obj).map(function (k) { return { label: k, n: obj[k] }; })
            .sort(function (a, b) { return b.n - a.n; }).slice(0, n || 8);
    }
    out.rankCriminal = rank(gC, 8);
    out.rankTraffic = rank(gT, 5);
    out.rankOnline = rank(gO, 8);
    // เรียงตาม "มูลค่าความเสียหาย" ไม่ใช่จำนวนคดี — คดีน้อยแต่เสียหายหนักจะไม่ถูกมองข้าม
    out.rankOnlineDamage = Object.keys(gOD).map(function (k) {
        return { label: k, n: Math.round(gOD[k]), cases: gO[k] || 0 };
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6);
    // คดีอุกฉกรรจ์: แสดงทุกประเภทที่กำหนดไว้ แม้ค่าเป็นศูนย์ จะได้เห็นว่า "ไม่มี" จริง ๆ
    out.seriousItems = DASH_SERIOUS.map(function (p) { return { label: p[1], n: gS[p[1]] || 0 }; })
        .sort(function (a, b) { return b.n - a.n; });
    out.byOfficer = Object.keys(byOfc).map(function (k) {
        var o = byOfc[k];
        o.grand = o.total;                                   // คดีที่รับ (มีเลขคดี: อาญา+จราจร) — คดีออนไลน์ไม่มีเลขคดี ไม่นับภาระงาน
        o.perDay = o.grand / elapsedDays;                    // เฉลี่ยคดี/วัน
        o.perMonth = o.grand / (elapsedDays / 30.44);         // เฉลี่ยคดี/เดือน
        o.daysPerCase = o.grand ? elapsedDays / o.grand : 0;  // รับ 1 คดีทุก ๆ กี่วัน
        return o;
    }).sort(function (a, b) { return b.grand - a.grand || b.open - a.open; });
    // ค่าเฉลี่ยทั้งหน่วย
    var withCases = out.byOfficer.filter(function (o) { return o.grand > 0; }).length;
    out.unitPerDay = out.total / elapsedDays;
    out.avgPerOfficer = withCases ? out.total / withCases : 0;
    out.oldest = openList.sort(function (a, b) { return b.days - a.days; }).slice(0, 8);
    return out;
}

// ==========================================================
// สถานภาพกำลังพลวันนี้
// ==========================================================
function dashComputeCrew(personnel, duty, mission, leave, today, helpers) {
    var H = helpers || {};
    var canon = H.canon || function (s) { return String(s || '').replace(/\s+/g, ''); };
    var split = H.split || function (v) {
        return String(v || '').split(/[,\n]|\s{2,}/).map(function (s) { return s.trim(); }).filter(Boolean);
    };
    var sameDay = H.sameDay || function (v) {
        var d = dashParseDate(v); if (!d) return false;
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    };

    // ตั้งแต่ 26 ต.ค.69 เวร พงส. 2 คนเป็นแบบ "เข้าคู่":
    //   คอลัมน์ 1 = คู่เวรกลางวัน 08:01-17:00 | คอลัมน์ 6 = เวรหลัก 24 ชม. เริ่ม 08:01
    var DASH_PAIR_START = new Date(2026, 9, 22);
    var res = {
        day: [], eve: [], full: [], asst: [], evi: [], extra: [],
        pairMode: false, dayTime: '08:01-17:00', eveTime: '17:01-08:00', fullTime: 'ทั้งวัน 24 ชม.',
        dayRole: 'ผลัดเช้า', eveRole: 'ผลัดเย็น',
        missions: [], leave: [], free: [], totalStaff: 0, onDuty: 0,
        roles: { lead: 0, pgs: 0, asst: 0, admin: 0, other: 0 }, rotating: 0,
        // สายการบังคับบัญชา เรียงจากบนลงล่าง
        tiers: [
            { key: 'lead', title: 'หัวหน้างานสอบสวน', short: 'หัวหน้างาน', color: '#f87171', people: [] },
            { key: 'pgs', title: 'พนักงานสอบสวน (เวร)', short: 'พงส.เวร', color: '#ffb020', people: [] },
            { key: 'asst', title: 'ผู้ช่วยพนักงานสอบสวน', short: 'ผช.พงส.', color: '#fcd34d', people: [] },
            { key: 'admin', title: 'ธุรการคดี / ส่งของกลาง', short: 'ธุรการคดี', color: '#22d3ee', people: [] },
            { key: 'other', title: 'อื่น ๆ', short: 'อื่น ๆ', color: '#94a3b8', people: [] }
        ]
    };

    (duty || []).slice(1).forEach(function (r) {
        if (!sameDay(r[0])) return;
        var two = !!(r[6] && String(r[6]).trim());
        var dayN = split(r[1]), eveN = split(r[6]);
        var isFull = two && dayN.length === 1 && eveN.length === 1 && canon(dayN[0]) === canon(eveN[0]);
        if (two && !isFull) {
            var dd = dashParseDate(r[0]);
            if (dd && dd >= DASH_PAIR_START) {
                res.pairMode = true;
                res.dayTime = '08:01-17:00';
                res.eveTime = 'ทั้งวัน 24 ชม.';
                res.dayRole = 'คู่เวรกลางวัน';
                res.eveRole = 'เวร 24 ชม.';
            }
        }
        if (isFull) res.full = res.full.concat(dayN);
        else { res.day = res.day.concat(dayN); if (two) res.eve = res.eve.concat(eveN); }
        res.asst = res.asst.concat(split(r[2]));
        res.evi = res.evi.concat(split(r[3]));
        res.extra = res.extra.concat(split(r[5]));
    });

    (mission || []).slice(1).forEach(function (r, i) {
        if (!sameDay(r[0])) return;
        res.missions.push({
            // เวลา "09:00-12:00" (เริ่ม-สิ้นสุด) แสดงเป็น "09:00–12:00"
            rowIdx: i + 1, time: String(r[1] || '').trim().replace(/\s*-\s*/, '–'), place: String(r[2] || ''),
            title: String(r[3] || 'ภารกิจ'), who: split(r[4]), chair: split(r[5])
        });
    });

    // ชีต "ลา": [0] ลาวันที่ (วันเริ่ม) | [1] จำนวนวัน | [2] ชื่อ | [4] ประเภทการลา
    (leave || []).slice(1).forEach(function (r) {
        if (!r || !r[0]) return;
        var st = dashParseDate(r[0]); if (!st) return;
        var days = parseInt(r[1], 10) || 1;
        var en = new Date(st); en.setDate(en.getDate() + days - 1); en.setHours(23, 59, 59);
        if (today >= st && today <= en) {
            res.leave.push({ name: String(r[2] || ""), type: String(r[4] || "ลา"), days: days, from: st, to: en });
        }
    });
    var busy = {};
    [res.day, res.eve, res.full, res.asst, res.evi, res.extra].forEach(function (a) {
        a.forEach(function (n) { busy[canon(n)] = 'duty'; });
    });
    res.onDuty = Object.keys(busy).length;
    res.missions.forEach(function (m) {
        m.who.concat(m.chair).forEach(function (n) { if (!busy[canon(n)]) busy[canon(n)] = 'mission'; });
    });
    res.leave.forEach(function (l) { busy[canon(l.name)] = 'leave'; });

    (personnel || []).slice(1).forEach(function (r) {
        var name = r && r[1]; if (!name) return;
        res.totalStaff++;
        // แยกตามคอลัมน์ "ทำหน้าที่" — ลำดับการตรวจสำคัญ เพราะบางคนเขียนรวมกันหลายหน้าที่
        var duty = String(r[5] || '');
        var tierKey;
        if (duty.indexOf('หัวหน้างาน') > -1) { res.roles.lead++; tierKey = 'lead'; }
        else if (duty.indexOf('ธุรการ') > -1) { res.roles.admin++; tierKey = 'admin'; }
        else if (duty.indexOf('ผู้ช่วย') > -1) { res.roles.asst++; tierKey = 'asst'; }
        else if (duty.indexOf('เวรสอบสวน') > -1) { res.roles.pgs++; tierKey = 'pgs'; }
        else { res.roles.other++; tierKey = 'other'; }

        // สถานะวันนี้ของแต่ละคน — เอาไว้ขึ้นจุดสีบนการ์ดในผังสายการบังคับบัญชา
        var st = busy[canon(name)] || 'free';
        for (var ti = 0; ti < res.tiers.length; ti++) {
            if (res.tiers[ti].key !== tierKey) continue;
            res.tiers[ti].people.push({
                name: name,
                position: String(r[4] || ''),
                nickname: String(r[2] || ''),
                duty: duty,
                status: st
            });
            break;
        }
        if (!busy[canon(name)]) res.free.push({ name: name, role: String(r[5] || '') });
    });
    // กำลังพลที่หมุนเวียนเข้าเวรจริง = ทั้งหมด หักหัวหน้างานออก
    res.rotating = res.totalStaff - res.roles.lead;
    return res;
}

// ==========================================================
// วิเคราะห์ "รูปแบบการเข้าเวรปัจจุบัน" จากตารางเวรจริง
// (ไม่ฮาร์ดโค้ดชื่อคน ถ้าเปลี่ยนตารางในชีท ผลที่แสดงจะเปลี่ยนตาม)
//
// รูปแบบตั้งแต่ 26 ต.ค.69:
//   จันทร์-ศุกร์  พงส. 1 นาย เข้า 08:01-17:00 คู่กับ พงส.อีก 1 นายที่เข้า 24 ชม.
//   เสาร์-อาทิตย์ พงส. 1 นาย เข้าคนเดียวทั้งวัน 24 ชม.
// ==========================================================
var DASH_DOW_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
var DASH_DOW_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function dashDutyPattern(dutyRows, today, pairStart) {
  today = today || new Date();
  var start = pairStart || new Date(2026, 9, 22);
  var out = {
    active: false, pairStart: start,
    dayPerson: null, dayDows: [], dayCount: 0,
    rotation: [], cycleDays: 0,
    asstRotation: [], asstCycle: 0,
    weekendPeople: [], windowFrom: null, windowTo: null, sampleDays: 0
  };
  if (!dutyRows || dutyRows.length < 2) return out;

  // ดูช่วง 60 วันรอบปัจจุบัน แต่ไม่ก่อนวันเริ่มระบบเข้าคู่
  var from = new Date(Math.max(start.getTime(), today.getTime() - 21 * 86400000));
  var to = new Date(today.getTime() + 45 * 86400000);
  var dayTally = {}, rotTally = {}, weekTally = {}, names = {};
  var rows = [];

  dutyRows.slice(1).forEach(function (r) {
    if (!r || !r[0]) return;
    var d = dashParseDate(r[0]); if (!d || d < from || d > to) return;
    var a = String(r[1] || '').trim(), b = String(r[6] || '').trim();
    if (!a && !b) return;
    rows.push({ date: d, day: a, eve: b, asst: String(r[2] || '').trim() });
  });
  if (!rows.length) return out;
  rows.sort(function (x, y) { return x.date - y.date; });

  out.active = true;
  out.windowFrom = rows[0].date;
  out.windowTo = rows[rows.length - 1].date;
  out.sampleDays = rows.length;

  rows.forEach(function (r) {
    var same = r.day && r.eve && dashPersonKey(r.day) === dashPersonKey(r.eve);
    var dow = r.date.getDay();
    function remember(n) { var k = dashPersonKey(n); if (k && (!names[k] || n.length > names[k].length)) names[k] = n; }
    remember(r.day); remember(r.eve);

    if (same || !r.eve) {
      // เข้าคนเดียวทั้งวัน 24 ชม.
      var k0 = dashPersonKey(r.day || r.eve);
      weekTally[k0] = (weekTally[k0] || 0) + 1;
      return;
    }
    // เข้าคู่: คอลัมน์ 1 = คู่เวรกลางวัน, คอลัมน์ 6 = เวร 24 ชม.
    var k1 = dashPersonKey(r.day), k2 = dashPersonKey(r.eve);
    if (!dayTally[k1]) dayTally[k1] = { n: 0, dows: {} };
    dayTally[k1].n++; dayTally[k1].dows[dow] = true;
    if (!rotTally[k2]) rotTally[k2] = { n: 0, dates: [] };
    rotTally[k2].n++; rotTally[k2].dates.push(r.date);
  });

  // คนที่ยืนช่องกลางวันบ่อยที่สุด = คู่เวรกลางวันประจำ
  var dayKeys = Object.keys(dayTally).sort(function (a, b) { return dayTally[b].n - dayTally[a].n; });
  if (dayKeys.length) {
    var k = dayKeys[0];
    out.dayPerson = names[k] || k;
    out.dayCount = dayTally[k].n;
    out.dayDows = Object.keys(dayTally[k].dows).map(Number).sort(function (a, b) { return a - b; });
  }

  // คนที่หมุนเวียนเข้าเวร 24 ชม. ในวันเข้าคู่
  out.rotation = Object.keys(rotTally).map(function (key) {
    var dates = rotTally[key].dates.sort(function (a, b) { return a - b; });
    var next = null;
    for (var i = 0; i < dates.length; i++) {
      if (dates[i] > today) { next = dates[i]; break; }
    }
    return { name: names[key] || key, count: rotTally[key].n, next: next, dates: dates };
  }).sort(function (a, b) {
    if (a.next && b.next) return a.next - b.next;
    if (a.next) return -1;
    if (b.next) return 1;
    return b.count - a.count;
  });
  out.cycleDays = out.rotation.length;

  // ผู้ช่วย พงส.: เข้า 24 ชม. หมุนเวียนทุกวัน (รวมเสาร์-อาทิตย์)
  var asstTally = {};
  rows.forEach(function (r) {
    if (!r.asst) return;
    var k = dashPersonKey(r.asst);
    if (!names[k] || r.asst.length > names[k].length) names[k] = r.asst;
    if (!asstTally[k]) asstTally[k] = { n: 0, dates: [] };
    asstTally[k].n++; asstTally[k].dates.push(r.date);
  });
  out.asstRotation = Object.keys(asstTally).map(function (key) {
    var dates = asstTally[key].dates.sort(function (a, b) { return a - b; });
    var next = null;
    for (var i = 0; i < dates.length; i++) { if (dates[i] > today) { next = dates[i]; break; } }
    return { name: names[key] || key, count: asstTally[key].n, next: next };
  }).sort(function (a, b) {
    if (a.next && b.next) return a.next - b.next;
    return a.next ? -1 : (b.next ? 1 : b.count - a.count);
  });
  out.asstCycle = out.asstRotation.length;

  out.weekendPeople = Object.keys(weekTally).map(function (key) {
    return { name: names[key] || key, count: weekTally[key] };
  }).sort(function (a, b) { return b.count - a.count; });

  return out;
}

if (typeof module !== 'undefined') {
    module.exports = {
        dashFyOf: dashFyOf, dashFyStart: dashFyStart, dashFyEnd: dashFyEnd,
        dashParseDate: dashParseDate, dashChargeGroup: dashChargeGroup,
        dashComputeCases: dashComputeCases, dashComputeCrew: dashComputeCrew,
        dashCountSerious: dashCountSerious, dashSeriousOf: dashSeriousOf,
        dashPersonKey: dashPersonKey, dashRankName: dashRankName,
        dashRangeOf: dashRangeOf, dashDutyPattern: dashDutyPattern
    };
}

