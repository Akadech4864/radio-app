/* =====================================================================
   บันทึกเหตุการณ์ ศปก.ส่วนหน้า — แบบ Timeline มินิมอล (แท็บ "บันทึก ศปก.")
   - แถบปุ่มลัด 9 ปุ่ม: กดแล้วเปิดแผ่นกรอกสั้น ๆ (เวลาใส่ให้อัตโนมัติ · ตัวช่วยเป็นปุ่มเลือก · ข้อความเรียบเรียงให้เอง แก้ได้)
   - Timeline เดียว ใหม่อยู่บน · แตะรายการเพื่อแก้ไข/ลบ · เตือนครบกำหนดตามประกาศ และเลยเวลาเลิกตามแจ้ง
   - จำนวนผู้ชุมนุม 1–500 คน (เริ่มต้น 100 คน หรือค่าล่าสุดที่บันทึก) · รถ 0–50 คัน
   - พิมพ์ "บันทึกลำดับเหตุการณ์" ตาราง A4 (เอกสารแนบท้ายคำร้องหมายเลข ๕) · คัดลอกส่ง LINE
   - ข้อมูลเดิมใช้ต่อได้: ev.log = [{ id, at, kind, title, detail, crowd, vehicles, law, unit, place, by, level, evidence, deadlineAt, refId }]
   ===================================================================== */
(function () {
    'use strict';
    if (!window.LamhinCmd || typeof window.LamhinCmd.registerSection !== 'function') return;

    const BY_KEY = 'lamhin_cmd_logby';
    const PRINT_KEY = 'lamhin_cmd_logprint';
    const ORDER_KEY = 'lamhin_cmd_logorder';
    // แท็บย่อย: บันทึกเหตุการณ์ | เวลา & ระดับ | ข้อกฎหมาย | เบอร์โทร (การ์ด 3 แท็บหลังวาดโดย cmd.js ผ่าน api.card)
    // · 'ladder' = มาตรการจากเบาไปหนัก (แผงของ cmdladder.js ที่ cmd.js วางต่อท้าย) เปิดจากปุ่มในแถบปุ่มลัด ไม่มีแท็บของตัวเอง
    const SUB_KEY = 'lamhin_cmd_logsub';
    const SUBS = [['log', 'fa-clipboard-list', 'บันทึกเหตุการณ์'], ['time', 'fa-stopwatch', 'เวลา & ระดับ'], ['legal', 'fa-scale-balanced', 'ข้อกฎหมาย'], ['contact', 'fa-phone', 'เบอร์โทร']];
    const isSub = (v) => v === 'ladder' || SUBS.some((t) => t[0] === v);

    const KINDS = {
        muster: { label: 'ปล่อยแถว', icon: 'fa-flag', tone: 'blue' },
        deploy: { label: 'ประจำจุด', icon: 'fa-route', tone: 'blue' },
        post: { label: 'ประจำจุด', icon: 'fa-location-crosshairs', tone: 'blue' },
        sitrep: { label: 'สถานการณ์', icon: 'fa-tower-broadcast', tone: 'neon' },
        crowd: { label: 'มวลชน', icon: 'fa-people-group', tone: 'neon' },
        risk: { label: 'เสี่ยง', icon: 'fa-triangle-exclamation', tone: 'amber' },
        violation: { label: 'ฝ่าฝืน', icon: 'fa-gavel', tone: 'red' },
        negotiate: { label: 'เจรจา', icon: 'fa-handshake', tone: 'gold' },
        announce: { label: 'ประกาศ', icon: 'fa-bullhorn', tone: 'gold' },
        deadline: { label: 'ครบกำหนด', icon: 'fa-hourglass-end', tone: 'gold' },
        court: { label: 'ศาล', icon: 'fa-scale-balanced', tone: 'violet' },
        control: { label: 'พื้นที่ควบคุม', icon: 'fa-road-barrier', tone: 'red' },
        arrest: { label: 'จับกุม/ยึด', icon: 'fa-handcuffs', tone: 'red' },
        end: { label: 'สิ้นสุด', icon: 'fa-flag-checkered', tone: 'green' },
        note: { label: 'บันทึก', icon: 'fa-note-sticky', tone: 'gray' }
    };
    // ประเภทที่ใช้ประกอบคำร้องศาล
    const COURT_KINDS = ['crowd', 'sitrep', 'risk', 'violation', 'negotiate', 'announce', 'deadline', 'court', 'control', 'arrest', 'end'];

    // ปุ่มลัด (เรียงตามลำดับเหตุการณ์จริง)
    const QUICK = [
        { k: 'muster', label: 'ปล่อยแถวชี้แจง', icon: 'fa-flag' },
        { k: 'deploy', label: 'แยกประจำจุด', icon: 'fa-route' },
        { k: 'sitrep', label: 'รายงานสถานการณ์', icon: 'fa-tower-broadcast' },
        { k: 'risk', label: 'เสี่ยง / ฝ่าฝืน', icon: 'fa-triangle-exclamation' },
        { k: 'ladder', label: 'เข้าสู่มาตรการ เบา → หนัก', sm: 'เจรจา › ประกาศ › ศาล', icon: 'fa-stairs', go: 'ladder' },   // บันได 7 ขั้น (ที่เดียว บังคับลำดับ)
        { k: 'end', label: 'สิ้นสุด', icon: 'fa-flag-checkered' },
        { k: 'note', label: 'อื่น ๆ', icon: 'fa-plus' }
    ];

    const UNITS_POST = ['งานป้องกันปราบปราม/คฝ.', 'งานสืบสวน', 'งานจราจร', 'งานสอบสวน', 'งานอำนวยการ'];
    const GROUPS = ['ชาวบ้านชุมชนลำเจดีย์', 'ผู้จัด/แกนนำ', 'ผู้ประสานงาน', 'คนนอกพื้นที่', 'สื่อ/ผู้ไลฟ์สด', 'ผู้สูงอายุ/เด็ก'];
    const MOODS = ['สงบ', 'มีการปราศรัย', 'เริ่มตึงเครียด', 'กฟน. เข้าพื้นที่'];
    const RISKS = [
        { id: 'megaphone', label: 'ใช้โทรโข่งก่อน 06.00 น.', law: 'ม.15(6) / ม.31 ว.1', text: 'มีการใช้โทรโข่งหรือเครื่องขยายเสียงปราศรัยในช่วงเวลาห้ามใช้ (ก่อน 06.00 น.)' },
        { id: 'block', label: 'ปิดกั้นผิวจราจร', law: 'ม.15(2), ม.16(1) / ป.อ. ม.385', text: 'นำรถยนต์และกลุ่มบุคคลปิดกั้นผิวจราจร ทำให้ประชาชนผู้ใช้เส้นทางไม่ได้รับความสะดวกเกินสมควร' },
        { id: 'mea', label: 'ขัดขวางรถ/ช่าง กฟน.', law: 'ป.อ. ม.309 / ม.16(6)', text: 'กลุ่มผู้ชุมนุมปิดล้อมรถกระเช้าและขัดขวางการปฏิบัติงานของช่างการไฟฟ้านครหลวง' },
        { id: 'power', label: 'ระบบไฟฟ้าใช้การไม่ได้', law: 'ม.31 วรรคสอง', text: 'การกระทำของผู้ชุมนุมเป็นเหตุให้ระบบส่งกระแสไฟฟ้าใช้การไม่ได้' },
        { id: 'march', label: 'เคลื่อนขบวน', law: 'ม.17 / ม.28', text: 'ผู้ชุมนุมเคลื่อนขบวนหรือเคลื่อนย้ายสถานที่ชุมนุมโดยมิได้แจ้งล่วงหน้า' },
        { id: 'loud', label: 'เสียงดังเกินกำหนด', law: 'ม.15(7) / ม.31 ว.1', text: 'ใช้เครื่องขยายเสียงดังเกินระดับที่กำหนด' },
        { id: 'mask', label: 'ปิดบังใบหน้า', law: 'ม.16(2) / ม.30', text: 'ผู้ชุมนุมบางรายปิดบังอำพรางใบหน้าโดยจงใจมิให้ระบุตัวได้' },
        { id: 'weapon', label: 'อาวุธ/ดอกไม้เพลิง', law: 'ม.16(3) / ม.34', text: 'พบผู้ชุมนุมพกพาอาวุธ ดอกไม้เพลิง หรือสิ่งเทียมอาวุธ' },
        { id: 'damage', label: 'ทำลายทรัพย์', law: 'ม.16(4) / ป.อ. ม.358, 360', text: 'มีการทำให้เสียหายซึ่งทรัพย์สินของผู้อื่น' },
        { id: 'violence', label: 'ทำร้าย/ขู่เข็ญ', law: 'ม.16(5)(6)', text: 'มีการใช้กำลังประทุษร้ายหรือขู่เข็ญผู้อื่น' },
        { id: 'officer', label: 'ขัดขวางเจ้าพนักงาน', law: 'ม.16(7) / ป.อ. ม.138', text: 'ผู้ชุมนุมขัดขวางการปฏิบัติหน้าที่ของเจ้าพนักงาน' },
        { id: 'condition', label: 'ไม่ทำตามเงื่อนไข', law: 'ม.19(5) / ม.32', text: 'ผู้ชุมนุมไม่ปฏิบัติตามเงื่อนไขหรือคำสั่งของเจ้าพนักงานดูแลการชุมนุมสาธารณะ' }
    ];
    const ANNOUNCES = [
        { id: 'a212', label: 'ให้แก้ไข ม.21(2)', law: 'ม.21(2)', text: 'เจ้าพนักงานดูแลการชุมนุมสาธารณะประกาศให้ผู้ชุมนุมแก้ไขการกระทำที่ฝ่าฝืน ตามมาตรา 21 (2)' },
        { id: 'a211', label: 'ให้เลิก ม.21(1)', law: 'ม.21(1)', text: 'เจ้าพนักงานดูแลการชุมนุมสาธารณะประกาศให้ผู้ชุมนุมเลิกการชุมนุม ตามมาตรา 21 (1)' },
        { id: 'a23', label: 'พื้นที่ควบคุม ม.23', law: 'ม.23', text: 'ประกาศกำหนดพื้นที่ควบคุมและให้ผู้ชุมนุมออกจากพื้นที่ควบคุม ตามมาตรา 23' },
        { id: 'a25', label: 'ยุติเหตุรุนแรง ม.25', law: 'ม.25', text: 'สั่งให้ผู้ชุมนุมยุติการกระทำที่มีลักษณะรุนแรง ตามมาตรา 25' }
    ];
    const OUT = {
        negotiate: ['ผู้จัดยินยอมปฏิบัติตาม', 'ผู้จัดขอเวลาหารือกับผู้ชุมนุม', 'ผู้จัดปฏิเสธไม่ปฏิบัติตาม'],
        deadline: ['ผู้ชุมนุมปฏิบัติตามประกาศแล้ว', 'ผู้ชุมนุมไม่ปฏิบัติตามประกาศ', 'ผู้ชุมนุมปฏิบัติตามบางส่วน'],
        court: ['ยื่นคำร้องต่อศาลแพ่งมีนบุรีขอให้มีคำสั่งให้เลิกการชุมนุม (ม.21 วรรคสอง)', 'ศาลนัดไต่สวนคำร้องฉุกเฉิน', 'ศาลแพ่งมีนบุรีมีคำสั่งให้ผู้ชุมนุมเลิกการชุมนุม (ม.22)', 'ปิดประกาศคำบังคับของศาล ณ สถานที่ชุมนุม'],
        end: ['ผู้ชุมนุมยุติการชุมนุมและแยกย้ายโดยสงบ', 'ครบเวลาตามที่แจ้งแล้ว ผู้ชุมนุมไม่ยอมเลิกการชุมนุม', 'ตรวจสภาพพื้นที่ คืนพื้นที่สาธารณะ และปิดภารกิจ'],
        note: ['จับกุม/ตรวจยึดตามอำนาจ', 'ประกาศพื้นที่ควบคุม (ม.23)', 'บันทึกอื่น']
    };
    const WHO = ['นายภูเบศ โพธิ์โซ๊ะ (ผู้จัด)', 'ผู้ประสานงาน 2 ท่าน'];
    const MINUTES = [15, 20, 30, 45, 60];
    const UNIT_OF = { muster: 'ศปก.ส่วนหน้า', deploy: 'ศปก.ส่วนหน้า', sitrep: 'งานสืบสวน', risk: 'งานสืบสวน', violation: 'งานสืบสวน', negotiate: 'ศปก.ส่วนหน้า', announce: 'ศปก.ส่วนหน้า', deadline: 'ศปก.ส่วนหน้า', court: 'งานสอบสวน', end: 'ศปก.ส่วนหน้า', arrest: 'งานป้องกันปราบปราม/คฝ.', control: 'ศปก.ส่วนหน้า', note: 'ศปก.ส่วนหน้า' };
    const PLACE_OF = { muster: 'หน้า สน.ลำหิน', deploy: 'หน้า สน.ลำหิน', court: 'ศาลแพ่งมีนบุรี' };
    const DEFAULT_PLACE = 'จุดชุมนุม ปากซอยคู้คลองสิบ 4';

    // รายชื่อผู้บันทึก (ยศ ชื่อ-สกุลทางการตามข้อมูลกำลังพล สน.ลำหิน 2569)
    const RECENT_KEY = 'lamhin_cmd_logby_recent';
    const DUTY = ['ร.ต.ท.สัญญา พนมกุล', 'ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', 'ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์', 'ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์', 'พ.ต.ท.อัคเดช ลัดดาวัลย์'];
    const STAFF = [
        ['พ.ต.อ.สุขสันต์ แสนสวัสดิ์', 'รรท.ผกก.สน.ลำหิน'], ['พ.ต.ท.รัติศัย นิลน้อย', 'รอง ผกก.ป.'], ['พ.ต.ท.ไพโรจน์ รุกขพันธ์', 'รอง ผกก.สส.'],
        ['พ.ต.ท.อัคเดช ลัดดาวัลย์', 'รอง ผกก.(สอบสวน)'], ['พ.ต.ท.สุจิตร ศิริราช', 'รอง ผกก.จร.'],
        ['พ.ต.ท.ภานุพงษ์ เทศสุวรรณ', 'สวป.'], ['พ.ต.ท.เกียรติศักดิ์ สุรังกาญจน์', 'สวป.'], ['พ.ต.ท.สุวเมธ เนื่องขันตรี', 'สว.(สอบสวน)'],
        ['พ.ต.ท.ธีร์ธวัช สวัสดิสาร', 'สว.สส.'], ['พ.ต.ท.เอกพล สุทธิรักษ์', 'สว.อก.'], ['พ.ต.ท.กฤตวัฒน์ เจริญชัย', 'สวป.(ชส.)'], ['พ.ต.ต.วิสิทธิ์ คงบุญ', 'สว.จร.'],
        ['ร.ต.อ.วีรยุทธ น้อยพันธ์', 'รอง สวป.'], ['ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', 'รอง สว.(สอบสวน)'], ['ร.ต.อ.คิมหันฐ์ ศรีสุพรรณ์', 'รอง สว.(สอบสวน)'],
        ['ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์', 'รอง สว.(สอบสวน)'], ['ร.ต.อ.ธรรมฤทธิ์ จุ่นมา', 'รอง สว.(จร.)'], ['ร.ต.ท.เศกสรรค์ เนียมสวรรค์', 'รอง สว.(จร.)'],
        ['ร.ต.ท.เอกวัชร์ วชิรทรงสัตยา', 'รอง สว.(ป.)'], ['ร.ต.ท.ประสิทธิ์ พัลพัฒน์', 'รอง สว.(สส.)'], ['ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์', 'รอง สว.(สอบสวน)'],
        ['ร.ต.ท.สัญญา พนมกุล', 'รอง สว.(สอบสวน)'], ['ร.ต.ต.หญิงประสพสุข เสนาจันทร์', 'รอง สว.(สส.)'], ['ร.ต.ต.อดิศักดิ์ กองมนต์', 'รอง สว.(จร.)'],
        ['ด.ต.เริงณรงค์ รัตนโสภณ', 'ผบ.หมู่(สส.)'], ['จ.ส.ต.มานะ บัวใหญ่รักษา', 'ผบ.หมู่(สส.)'], ['ส.ต.อ.เมธาพร โขงจำปา', 'ผบ.หมู่(สส.)'],
        ['ส.ต.อ.นราธร สายสีแก้ว', 'ผบ.หมู่(สส.)'], ['ส.ต.ท.เกียรติคุณ แสนศรี', 'ผบ.หมู่(สส.)'],
        ['ส.ต.ท.นนทิวัฒน์ สิงห์อ่อน', 'ผบ.หมู่(ผช.พงส.)'], ['ส.ต.ท.สุทัศน์ ขุนทอง', 'ผบ.หมู่(ผช.พงส.)'], ['ส.ต.ต.กิตติศักดิ์ บุญสม', 'ผบ.หมู่(ผช.พงส.)'],
        ['ส.ต.ต.ธณต ตัณฑะผลิน', 'ผบ.หมู่(ผช.พงส.)'], ['ส.ต.ต.อัครพัชร์ ปอสร้อยเจริญ', 'ผบ.หมู่(ผช.พงส.)'], ['ส.ต.ต.ธีรสรรค พรหมพิทักษ์', 'ผบ.หมู่(ผช.พงส.)'],
        ['ส.ต.ต.อลีฟ บือซา', 'ผบ.หมู่(ผช.พงส.)']
    ];

    /* ---------------- สถานะ ---------------- */
    let api = null, el = null, evId = '', timer = 0, sheet = null, S = null;
    let newestFirst = (function () { try { return localStorage.getItem(ORDER_KEY) !== 'old'; } catch (e) { return true; } })();
    // จำแท็บย่อยที่เปิดล่าสุด (ไม่จำแผงมาตรการ — เปิดเว็บใหม่เริ่มที่บันทึกเหตุการณ์ แล้วกดปุ่มเข้าเอง)
    let sub = (function () { try { const v = localStorage.getItem(SUB_KEY); return v !== 'ladder' && isSub(v) ? v : 'log'; } catch (e) { return 'log'; } })();
    const hasLadder = () => !!document.querySelector('.cmd-ext-pane[data-ext="ladder"]');
    function setSubTab(v) { sub = isSub(v) ? v : 'log'; if (sub !== 'ladder') { try { localStorage.setItem(SUB_KEY, sub); } catch (e) { /* ไม่จำก็ได้ */ } } }
    function subTabsHtml(ev) {
        const hot = api.alertsHot ? api.alertsHot(ev) : false;
        return '<nav class="cmd-subtabs" role="tablist" aria-label="บันทึก ศปก.">' + SUBS.filter((t) => t[0] === 'log' || api.card).map((t) =>
            '<button type="button" role="tab" class="cmd-subtab' + (sub === t[0] ? ' on' : '') + '" data-cl="sub" data-v="' + t[0] + '" aria-selected="' + (sub === t[0]) + '">' +
            (t[0] === 'time' ? '<i class="cmd-dot ' + esc(ev.level) + '" title="ระดับปัจจุบัน"></i>' : '<i class="fa-solid ' + t[1] + '"></i>') + '<span>' + t[2] + '</span>' +
            (t[0] === 'legal' && hot ? '<em class="cmd-flag" title="มีรายการที่ต้องดำเนินการ"></em>' : '') + '</button>').join('') + '</nav>';
    }
    // หัวแผงมาตรการเบา → หนัก: ปุ่มกลับไปบันทึกเหตุการณ์ (ปุ่มย้อนกลับของเว็บอ่านสถานะจาก data-cl="sub" ที่มี class on)
    function ladderBarHtml() {
        return '<div class="cl-ladbar"><button type="button" class="cl-back" data-cl="sub" data-v="log"><i class="fa-solid fa-arrow-left"></i> บันทึกเหตุการณ์</button>' +
            '<b class="on" data-cl="sub" data-v="ladder"><i class="fa-solid fa-stairs"></i> มาตรการจากเบาไปหนัก</b></div>';
    }
    const esc = (s) => api.esc(s);
    const pad = (n) => String(n).padStart(2, '0');
    const hm = (ms) => { const d = new Date(ms); return pad(d.getHours()) + '.' + pad(d.getMinutes()); };
    const hmc = (ms) => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    const thDigits = (s) => String(s == null ? '' : s).replace(/[0-9]/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]);
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const num = (v) => { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };
    function recorder() { try { return localStorage.getItem(BY_KEY) || ''; } catch (e) { return ''; } }
    function setRecorder(v) { try { localStorage.setItem(BY_KEY, v); } catch (e) { /* ไม่จำก็ได้ */ } }
    function recents() { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function pushRecent(name) {
        const n = String(name || '').trim(); if (!n) return;
        try { localStorage.setItem(RECENT_KEY, JSON.stringify([n].concat(recents().filter((x) => x !== n)).slice(0, 4))); } catch (e) { /* ไม่จำก็ได้ */ }
    }
    // ปุ่มชื่อด่วน: ที่ใช้ล่าสุด → ผช.พงส. 4 นายที่เลือกไว้ในแท็บ "สายงาน" → ชุดสอบสวนเวรวันนี้ (ไม่ซ้ำ ไม่เกิน 8 ชื่อ)
    function quickNames(ev) {
        const slots = ev && ev.ops && Array.isArray(ev.ops.slots) ? ev.ops.slots : [];
        const out = [];
        recents().concat(slots, DUTY).forEach((n) => { n = String(n || '').trim(); if (n && out.indexOf(n) === -1) out.push(n); });
        return out.slice(0, 8);
    }
    function logOf(ev) { if (!Array.isArray(ev.log)) ev.log = []; return ev.log; }
    function sorted(ev) { return logOf(ev).slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); }
    function latest(ev, key) {
        const l = sorted(ev).filter((x) => x[key] != null && x[key] !== '');
        return l.length ? l[l.length - 1][key] : null;
    }

    /* ---------------- แจ้งเตือน: ครบกำหนดตามประกาศ / เลยเวลาเลิก ---------------- */
    function pendingAnnounce(ev) {
        const L = sorted(ev);
        for (let i = L.length - 1; i >= 0; i--) {
            const a = L[i];
            if (a.kind !== 'announce' || !a.deadlineAt) continue;
            if (L.some((x) => x.kind === 'deadline' && (x.refId === a.id || Date.parse(x.at) >= Date.parse(a.deadlineAt)))) return null;
            return a;
        }
        return null;
    }
    function overtime(ev) {
        const end = api.endOf(ev);
        if (!end || Date.now() < end) return false;
        return !logOf(ev).some((x) => x.kind === 'end' || (x.kind === 'violation' && Date.parse(x.at) >= end));
    }
    function left(ms) {
        const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60), s = t % 60;
        return m >= 60 ? Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' นาที' : m + ':' + pad(s);
    }
    function alertHtml(ev) {
        const a = pendingAnnounce(ev);
        let h = '';
        if (a) {
            const due = Date.parse(a.deadlineAt), now = Date.now();
            h += due > now
                ? '<div class="cl-alert wait"><i class="fa-solid fa-hourglass-half"></i><span>ครบกำหนดตามประกาศ ' + esc(a.law || '') + ' เวลา <b>' + hm(due) + ' น.</b></span><em data-cl-tick="due" data-due="' + due + '">' + left(due - now) + '</em></div>'
                : '<div class="cl-alert due"><i class="fa-solid fa-bell"></i><span>ครบกำหนดตามประกาศแล้ว (' + hm(due) + ' น.) — ผู้ชุมนุม</span>' +
                  '<button type="button" data-cl="due-ok" data-ref="' + esc(a.id) + '">ปฏิบัติตาม</button><button type="button" class="bad" data-cl="due-no" data-ref="' + esc(a.id) + '">ไม่ปฏิบัติตาม</button></div>';
        }
        if (overtime(ev)) {
            h += '<div class="cl-alert due"><i class="fa-solid fa-clock"></i><span>เลยเวลาเลิกตามแจ้ง (' + esc(api.hmStr(ev.end)) + ')</span>' +
                '<button type="button" data-cl="ot-ok">เลิกแล้ว</button><button type="button" class="bad" data-cl="ot-no">ไม่ยอมเลิก</button></div>';
        }
        return h;
    }

    /* ---------------- หน้าจอ ---------------- */
    function render() {
        const ev = api.active();
        if (!el) return;
        if (!ev) { el.innerHTML = '<div class="cmd-card"><div class="cmd-empty">ยังไม่มีเหตุการณ์</div></div>'; return; }
        evId = ev.id;
        const crowd = latest(ev, 'crowd'), veh = latest(ev, 'vehicles');
        const lv = api.LEVELS[ev.level] || {};
        if (sub === 'ladder' && hasLadder()) { el.innerHTML = '<div class="cl">' + ladderBarHtml() + '</div>'; return; }
        // เวลา & ระดับ / ข้อกฎหมาย / เบอร์โทร: การ์ดจาก cmd.js (ตัวเลขนับถอยหลังเดินด้วย tick ของ cmd.js)
        const card = !api.card ? '' : sub === 'time' ? '<div class="cmd-grid cmd-g-pair">' + api.card('count', ev) + api.card('level', ev) + '</div>'
            : sub === 'legal' ? '<div class="cmd-grid cmd-g-one">' + api.card('legal', ev) + '</div>'
            : sub === 'contact' ? '<div class="cmd-grid cmd-g-one">' + api.card('contact', ev) + '</div>' : '';
        if (card && api.card) { el.innerHTML = '<div class="cl">' + subTabsHtml(ev) + card + '</div>'; if (api.tick) api.tick(); return; }
        el.innerHTML = '<div class="cl">' + subTabsHtml(ev) +
            '<section class="cmd-card cl-head">' +
                '<div class="cl-top"><div class="cl-stats">' +
                    '<span><i class="fa-regular fa-clock"></i><b data-cl-tick="now">' + hm(Date.now()) + '</b></span>' +
                    '<span><i class="fa-solid fa-people-group"></i><b>' + (crowd == null ? '–' : crowd) + '</b> คน</span>' +
                    '<span><i class="fa-solid fa-car-side"></i><b>' + (veh == null ? '–' : veh) + '</b> คัน</span>' +
                    '<span><i class="cmd-dot ' + esc(ev.level) + '"></i>' + esc(lv.short || '') + '</span>' +
                '</div><div class="cl-acts">' +
                    '<button type="button" class="cl-ic" data-cl="line" title="คัดลอกส่ง LINE" aria-label="คัดลอกส่ง LINE"><i class="fa-brands fa-line"></i></button>' +
                    '<button type="button" class="cl-ic" data-cl="print" title="พิมพ์ตารางแนบคำร้องศาล" aria-label="พิมพ์ตารางแนบคำร้องศาล"><i class="fa-solid fa-print"></i></button>' +
                '</div></div>' +
                '<div class="cl-alerts">' + alertHtml(ev) + '</div>' +
                '<div class="cl-quick">' + QUICK.map((q) => '<button type="button" class="cl-q t-' + (KINDS[q.k] || KINDS.negotiate).tone + (q.go ? ' go' : '') + '" ' + (q.go ? 'data-cl="sub" data-v="' + q.go + '"' : 'data-cl="new" data-k="' + q.k + '"') + '><i class="fa-solid ' + q.icon + '"></i><span>' + q.label + (q.sm ? '<small>' + q.sm + '</small>' : '') + '</span></button>').join('') + '</div>' +
            '</section>' +
            '<section class="cmd-card cl-tl-card">' + timelineHtml(ev) + '</section>' +
        '</div>';
    }
    function timelineHtml(ev) {
        const items = sorted(ev).map((x) => ({ x: x, t: Date.parse(x.at) }));
        (Array.isArray(ev.levelLog) ? ev.levelLog : []).forEach((l) => items.push({ lv: l, t: Date.parse(l.at) }));
        items.sort((a, b) => newestFirst ? b.t - a.t : a.t - b.t);
        const plan = 'กำหนดการ: รวมพล ' + esc(api.hmStr(ev.muster)) + ' · ชุมนุม ' + esc(api.hmStr(ev.start)) + '–' + esc(api.hmStr(ev.end));
        let h = '<div class="cl-tl-h"><b>Timeline</b><small>' + plan + '</small>' +
            '<button type="button" class="cl-order" data-cl="order">' + (newestFirst ? 'ใหม่ → เก่า' : 'เก่า → ใหม่') + ' <i class="fa-solid fa-arrow-down-wide-short"></i></button>' +
            (items.length ? '<button type="button" class="cl-order cl-clear" data-cl="clear"><i class="fa-solid fa-trash-can"></i> ล้างทั้งหมด</button>' : '') + '</div>';
        if (!items.length) return h + '<div class="cl-empty"><i class="fa-regular fa-clock"></i>ยังไม่มีบันทึก — กดปุ่มด้านบนเพื่อบันทึกเหตุการณ์แรก<br><small>เวลาใส่ให้อัตโนมัติ</small></div>';
        let lastDay = '';
        h += '<ol class="cl-tl">';
        items.forEach((it) => {
            const day = new Date(it.t).toDateString();
            if (day !== lastDay) { h += '<li class="cl-day">' + esc(api.thDateLong(it.t)) + '</li>'; lastDay = day; }
            if (it.lv) {
                const L = api.LEVELS[it.lv.level] || {};
                h += '<li class="cl-it lv"><time>' + hm(it.t) + '</time><i class="cl-dot t-gray"></i><div class="cl-body"><span class="cl-meta">ปรับระดับสถานการณ์เป็น ' + esc((L.emoji || '') + ' ' + (L.name || '')) + '</span></div>' +
                    '<button type="button" class="cl-del" data-cl="del-lv" data-at="' + esc(it.lv.at) + '" title="ลบการปรับระดับนี้" aria-label="ลบการปรับระดับนี้"><i class="fa-solid fa-xmark"></i></button></li>';
                return;
            }
            const x = it.x, k = KINDS[x.kind] || KINDS.note;
            const tags = [];
            if (x.crowd != null && x.crowd !== '') tags.push('<span><i class="fa-solid fa-people-group"></i>' + esc(x.crowd) + ' คน</span>');
            if (x.vehicles != null && x.vehicles !== '') tags.push('<span><i class="fa-solid fa-car-side"></i>' + esc(x.vehicles) + ' คัน</span>');
            if (x.law) tags.push('<span class="law">' + esc(x.law) + '</span>');
            if (x.deadlineAt) tags.push('<span><i class="fa-solid fa-hourglass-half"></i>ครบ ' + hm(Date.parse(x.deadlineAt)) + ' น.</span>');
            h += '<li class="cl-it"><time>' + hm(it.t) + '</time><i class="cl-dot t-' + k.tone + '"><i class="fa-solid ' + k.icon + '"></i></i>' +
                '<button type="button" class="cl-body" data-cl="edit" data-id="' + esc(x.id) + '"><span class="cl-kind t-' + k.tone + '">' + esc(k.label) + '</span><b>' + esc(x.title || k.label) + '</b>' +
                (x.detail && x.detail !== x.title ? '<span class="cl-det">' + esc(x.detail) + '</span>' : '') +
                (tags.length ? '<span class="cl-tags">' + tags.join('') + '</span>' : '') + '</button>' +
                '<button type="button" class="cl-del" data-cl="del" data-id="' + esc(x.id) + '" title="ลบรายการนี้" aria-label="ลบรายการนี้"><i class="fa-solid fa-xmark"></i></button></li>';
        });
        return h + '</ol>';
    }

    /* ---------------- แผ่นกรอก (ตัวช่วยกรอกแบบปุ่มเลือก) ---------------- */
    function freshS(ev, kind, extra) {
        const now = Date.now();
        return Object.assign({
            kind: kind, at: now, title: '', detail: '', law: '', titleDirty: false, detailDirty: false, editId: '', refId: '',
            crowd: clamp(num(latest(ev, 'crowd')) || 100, 1, 500), vehicles: clamp(num(latest(ev, 'vehicles')) == null ? 10 : num(latest(ev, 'vehicles')), 0, 50),
            withCount: kind === 'sitrep' || kind === 'risk', picks: [], groups: [], units: [], who: [WHO[0]], outcome: '', ann: 'a212', minutes: 30, violated: false
        }, extra || {});
    }
    function fromEntry(x) {
        const k = x.kind === 'violation' ? 'risk' : x.kind === 'crowd' ? 'sitrep' : (x.kind === 'control' || x.kind === 'arrest' || x.kind === 'post') ? (x.kind === 'post' ? 'deploy' : 'note') : x.kind;
        return Object.assign(freshS(api.active(), k), {
            editId: x.id, at: Date.parse(x.at) || Date.now(), title: x.title || '', detail: x.detail || '', law: x.law || '', titleDirty: true, detailDirty: true,
            crowd: x.crowd != null && x.crowd !== '' ? clamp(num(x.crowd) || 1, 1, 500) : 100, vehicles: x.vehicles != null && x.vehicles !== '' ? clamp(num(x.vehicles) || 0, 0, 50) : 10,
            withCount: x.crowd != null && x.crowd !== '', violated: x.kind === 'violation', refId: x.refId || '', deadlineAt: x.deadlineAt || '',
            origKind: x.kind, picks: x.picks || [], groups: x.groups || [], units: x.units || [], outcome: x.outcome || '', ann: x.ann || 'a212', minutes: x.minutes || 30
        });
    }
    // เรียบเรียงหัวข้อ/รายละเอียด/มาตราจากปุ่มที่เลือก (ถ้าผู้ใช้ยังไม่ได้พิมพ์แก้เอง)
    function compose() {
        let title = '', detail = '', law = '';
        const k = S.kind;
        if (k === 'muster') title = 'ปล่อยแถวชี้แจงภารกิจและข้อกฎหมายแก่กำลังพล ณ หน้า สน.ลำหิน';
        else if (k === 'deploy') title = S.units.length ? S.units.join(' / ') + ' แยกประจำจุดเรียบร้อย' : 'ปล่อยแถว กำลังพลแยกย้ายประจำจุดตามแผน';
        else if (k === 'sitrep') {
            title = 'ผู้ชุมนุมประมาณ ' + S.crowd + ' คน รถยนต์ ' + S.vehicles + ' คัน' + (S.picks.length ? ' · ' + S.picks.join(' · ') : '');
            detail = S.groups.length ? 'กลุ่มผู้ชุมนุม: ' + S.groups.join(', ') : '';
        } else if (k === 'risk') {
            const rs = RISKS.filter((r) => S.picks.indexOf(r.id) !== -1);
            title = (S.violated ? 'ฝ่าฝืน: ' : 'เฝ้าระวัง: ') + (rs.length ? rs.map((r) => r.label).join(' / ') : 'พบพฤติการณ์เสี่ยงต่อการฝ่าฝืนกฎหมาย');
            detail = rs.map((r) => r.text).join(' ');
            law = rs.map((r) => r.law).join(', ');
        } else if (k === 'negotiate') {
            title = 'ชุดเจรจาพบ ' + (S.who.length ? S.who.join(' และ ') : 'ผู้จัดการชุมนุม') + ' เพื่อทำความเข้าใจ';
            detail = S.outcome;
        } else if (k === 'announce') {
            const a = ANNOUNCES.find((x) => x.id === S.ann) || ANNOUNCES[0];
            const withTime = a.id !== 'a25';
            title = a.text + (withTime ? ' กำหนดเวลา ' + S.minutes + ' นาที (ครบ ' + hm(S.at + S.minutes * 60000) + ' น.)' : '');
            law = a.law;
        } else if (k === 'deadline') title = S.outcome || 'ครบกำหนดเวลาตามประกาศ';
        else if (k === 'court') title = S.outcome || OUT.court[0];
        else if (k === 'end') { title = S.outcome || OUT.end[0]; if (S.outcome === OUT.end[1]) law = 'ม.18 / ม.28'; }
        else title = S.outcome && S.outcome !== 'บันทึกอื่น' ? S.outcome : '';
        if (!S.titleDirty) S.title = title;
        if (!S.detailDirty) S.detail = detail;
        if (!S.lawDirty) S.law = law;
    }
    const chips = (group, items, sel, multi) => '<div class="cl-chips">' + items.map((it) => {
        const v = typeof it === 'string' ? it : it.id, label = typeof it === 'string' ? it : it.label;
        const on = multi ? sel.indexOf(v) !== -1 : sel === v;
        return '<button type="button" class="cl-chip' + (on ? ' on' : '') + '" data-cl-chip="' + group + '" data-v="' + esc(v) + '">' + esc(label) + '</button>';
    }).join('') + '</div>';
    const counter = (key, label, val, min, max, step) =>
        '<div class="cl-count"><span>' + label + '</span><div class="cl-count-row">' +
        '<button type="button" data-cl-step="' + key + '" data-d="-' + step + '">−' + step + '</button>' +
        '<input type="range" min="' + min + '" max="' + max + '" value="' + val + '" data-cl-in="' + key + '" aria-label="' + esc(label) + '">' +
        '<button type="button" data-cl-step="' + key + '" data-d="' + step + '">+' + step + '</button>' +
        '<input type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + val + '" data-cl-num="' + key + '"></div></div>';
    function sheetBody() {
        const k = S.kind;
        let f = '';
        if (k === 'deploy') f += '<div class="cl-sec"><span>สายงานที่ประจำจุดแล้ว</span>' + chips('units', UNITS_POST, S.units, true) + '</div>';
        if (k === 'sitrep') {
            f += counter('crowd', 'ผู้ชุมนุม (คน)', S.crowd, 1, 500, 10) + counter('vehicles', 'รถยนต์ (คัน)', S.vehicles, 0, 50, 1);
            f += '<div class="cl-sec"><span>กลุ่มผู้ชุมนุม</span>' + chips('groups', GROUPS, S.groups, true) + '</div>';
            f += '<div class="cl-sec"><span>สภาพ</span>' + chips('picks', MOODS, S.picks, true) + '</div>';
        }
        if (k === 'risk') {
            f += '<div class="cl-sec"><span>สถานะ</span>' + chips('violated', [{ id: '0', label: 'เฝ้าระวัง (ยังไม่ฝ่าฝืน)' }, { id: '1', label: 'ฝ่าฝืนแล้ว' }], S.violated ? '1' : '0', false) + '</div>';
            f += '<div class="cl-sec"><span>พฤติการณ์ (เลือกได้หลายข้อ · ใส่มาตราให้อัตโนมัติ)</span>' + chips('picks', RISKS, S.picks, true) + '</div>';
            f += '<label class="cl-toggle"><input type="checkbox" data-cl-in="withCount"' + (S.withCount ? ' checked' : '') + '> บันทึกจำนวนผู้ชุมนุม/รถด้วย</label>';
            if (S.withCount) f += counter('crowd', 'ผู้ชุมนุม (คน)', S.crowd, 1, 500, 10) + counter('vehicles', 'รถยนต์ (คัน)', S.vehicles, 0, 50, 1);
        }
        if (k === 'negotiate') f += '<div class="cl-sec"><span>เจรจากับ</span>' + chips('who', WHO, S.who, true) + '</div><div class="cl-sec"><span>ผล</span>' + chips('outcome', OUT.negotiate, S.outcome, false) + '</div>';
        if (k === 'announce') {
            f += '<div class="cl-sec"><span>ประกาศ</span>' + chips('ann', ANNOUNCES, S.ann, false) + '</div>';
            if (S.ann !== 'a25') f += '<div class="cl-sec"><span>ให้ปฏิบัติภายใน (นาที) — ระบบเตือนเมื่อครบกำหนด</span>' + chips('minutes', MINUTES.map(String), String(S.minutes), false) + '</div>';
        }
        if (k === 'deadline' || k === 'court' || k === 'end' || k === 'note') f += '<div class="cl-sec"><span>' + (k === 'note' ? 'ประเภท' : 'เลือก') + '</span>' + chips('outcome', OUT[k], S.outcome, false) + '</div>';
        f += '<label class="cl-f"><span>หัวข้อ (เรียบเรียงให้อัตโนมัติ แก้ได้)</span><textarea rows="2" data-cl-in="title">' + esc(S.title) + '</textarea></label>';
        if (k === 'risk' || k === 'sitrep' || k === 'negotiate' || k === 'note' || S.detail) f += '<label class="cl-f"><span>รายละเอียด</span><textarea rows="2" data-cl-in="detail" placeholder="ไม่บังคับ">' + esc(S.detail) + '</textarea></label>';
        if (S.law || k === 'risk') f += '<label class="cl-f"><span>ข้อกฎหมาย</span><input data-cl-in="law" value="' + esc(S.law) + '"></label>';
        const by = S.by != null ? S.by : recorder();
        f += '<label class="cl-f cl-time"><span>เวลา</span><input type="time" data-cl-in="time" value="' + hmc(S.at) + '"></label>';
        f += '<div class="cl-sec cl-by"><span>ผู้บันทึก — แตะชื่อ หรือพิมพ์ค้นจากรายชื่อ สน.ลำหิน</span>' + chips('by', quickNames(api.active()), by, false) +
            '<input list="cl-staff" data-cl-in="by" value="' + esc(by) + '" placeholder="พิมพ์ชื่อหรือตำแหน่ง เช่น ภาณุ, สส., ผช.พงส." autocomplete="off">' +
            '<datalist id="cl-staff">' + STAFF.map((p) => '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>').join('') + '</datalist></div>';
        return f;
    }
    function drawSheet() {
        if (!sheet) return;
        compose();
        const b = sheet.querySelector('.cmd-modal-b');
        const keep = b.scrollTop;
        b.innerHTML = '<div class="cl-sheet">' + sheetBody() + '</div>';
        b.scrollTop = keep;
    }
    function openSheet(st) {
        S = st;
        const k = KINDS[S.kind === 'risk' && S.violated ? 'violation' : S.kind] || KINDS.note;
        const q = QUICK.find((x) => x.k === S.kind);
        const actions = [];
        if (S.editId) actions.push({ label: '<i class="fa-solid fa-trash"></i> ลบ', cls: 'danger', run: (close) => {
            if (!window.confirm('ลบรายการนี้?')) return;
            const ev = api.active(); ev.log = logOf(ev).filter((x) => x.id !== S.editId); api.save(); close(); sheet = null; render(); api.toast('ลบแล้ว');
        } });
        actions.push({ label: 'ยกเลิก', run: (close) => { close(); sheet = null; } });
        actions.push({ label: '<i class="fa-solid fa-check"></i> บันทึก', cls: 'gold', run: (close) => { if (saveS()) { close(); sheet = null; } } });
        sheet = api.modal({ title: (S.editId ? 'แก้ไข · ' : '') + (q ? q.label : k.label), icon: k.icon, body: '<div class="cl-sheet"></div>', actions: actions });
        sheet.classList.add('cl-modal');
        sheet.addEventListener('click', onSheetClick);
        sheet.addEventListener('input', onSheetInput);
        drawSheet();
    }
    function onSheetClick(e) {
        if (e.target.closest('.cmd-modal-x') || e.target === sheet) { sheet = null; return; }
        const c = e.target.closest('[data-cl-chip]');
        if (c) {
            const g = c.dataset.clChip, v = c.dataset.v;
            if (g === 'by') { S.by = v; setRecorder(v); }
            else if (g === 'violated') S.violated = v === '1';
            else if (g === 'minutes') S.minutes = Number(v);
            else if (g === 'ann') S.ann = v;
            else if (g === 'outcome') S.outcome = S.outcome === v ? '' : v;
            else { const arr = S[g]; const i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); }
            drawSheet(); return;
        }
        const st = e.target.closest('[data-cl-step]');
        if (st) {
            const key = st.dataset.clStep, max = key === 'crowd' ? 500 : 50, min = key === 'crowd' ? 1 : 0;
            S[key] = clamp((S[key] || 0) + Number(st.dataset.d), min, max);
            syncCount(key); return;
        }
    }
    function syncCount(key) {
        const r = sheet.querySelector('[data-cl-in="' + key + '"]'), n = sheet.querySelector('[data-cl-num="' + key + '"]');
        if (r) r.value = S[key]; if (n) n.value = S[key];
        if (!S.titleDirty) { compose(); const t = sheet.querySelector('[data-cl-in="title"]'); if (t) t.value = S.title; }
    }
    function onSheetInput(e) {
        const t = e.target;
        if (t.dataset.clNum) {
            const key = t.dataset.clNum, max = key === 'crowd' ? 500 : 50, min = key === 'crowd' ? 1 : 0;
            const v = num(t.value); if (v == null) return;
            S[key] = clamp(v, min, max);
            const r = sheet.querySelector('[data-cl-in="' + key + '"]'); if (r) r.value = S[key];
            if (!S.titleDirty) { compose(); const ti = sheet.querySelector('[data-cl-in="title"]'); if (ti) ti.value = S.title; }
            return;
        }
        const k = t.dataset.clIn; if (!k) return;
        if (k === 'crowd' || k === 'vehicles') { S[k] = Number(t.value); syncCount(k); }
        else if (k === 'withCount') { S.withCount = t.checked; drawSheet(); }
        else if (k === 'title') { S.title = t.value; S.titleDirty = true; }
        else if (k === 'detail') { S.detail = t.value; S.detailDirty = true; }
        else if (k === 'law') { S.law = t.value; S.lawDirty = true; }
        else if (k === 'by') {
            S.by = t.value; setRecorder(t.value.trim());
            sheet.querySelectorAll('[data-cl-chip="by"]').forEach((c) => c.classList.toggle('on', c.dataset.v === t.value.trim()));
        }
        else if (k === 'time') {
            const m = t.value.match(/^(\d{1,2}):(\d{2})/); if (!m) return;
            const d = new Date(S.at); d.setHours(Number(m[1]), Number(m[2]), 0, 0); S.at = d.getTime();
            if (S.kind === 'announce' && !S.titleDirty) { compose(); const ti = sheet.querySelector('[data-cl-in="title"]'); if (ti) ti.value = S.title; }
        }
    }
    function saveS() {
        const ev = api.active(); if (!ev) return false;
        compose();
        const title = String(S.title || '').trim();
        if (!title) { api.toast('กรุณาเลือกหรือพิมพ์หัวข้อ'); return false; }
        let kind = S.kind;
        if (kind === 'risk') kind = S.violated ? 'violation' : 'risk';
        if (kind === 'end' && S.outcome === OUT.end[1]) kind = 'violation';
        if (kind === 'note') kind = S.outcome === OUT.note[0] ? 'arrest' : S.outcome === OUT.note[1] ? 'control' : 'note';
        if (S.origKind === 'post' && kind === 'deploy') kind = 'post';
        const counted = S.kind === 'sitrep' || (S.kind === 'risk' && S.withCount);
        const a = ANNOUNCES.find((x) => x.id === S.ann);
        const entry = {
            at: new Date(S.at).toISOString(), kind: kind, title: title, detail: String(S.detail || '').trim(), law: String(S.law || '').trim(),
            crowd: counted ? S.crowd : null, vehicles: counted ? S.vehicles : null,
            unit: UNIT_OF[kind] || UNIT_OF[S.kind] || 'ศปก.ส่วนหน้า', place: PLACE_OF[kind] || DEFAULT_PLACE,
            by: String(S.by != null ? S.by : recorder()).trim(),
            deadlineAt: S.kind === 'announce' && a && a.id !== 'a25' ? new Date(S.at + S.minutes * 60000).toISOString() : (S.kind === 'announce' ? '' : S.deadlineAt || ''),
            refId: S.refId || '', picks: S.picks.slice(), groups: S.groups.slice(), units: S.units.slice(), outcome: S.outcome, ann: S.kind === 'announce' ? S.ann : '', minutes: S.kind === 'announce' ? S.minutes : ''
        };
        pushRecent(entry.by);
        if (S.editId) {
            const x = logOf(ev).find((y) => y.id === S.editId);
            if (x) Object.assign(x, entry);
        } else {
            logOf(ev).push(Object.assign({ id: api.uid('lg'), level: '', evidence: '' }, entry));
        }
        api.save(); render();
        api.toast((S.editId ? 'แก้ไขแล้ว · ' : 'บันทึกแล้ว · ') + hm(S.at) + ' น.');
        return true;
    }
    // ตอบแจ้งเตือนในกล่องด้านบน (บันทึกทันที ไม่ต้องเปิดแผ่นกรอก)
    function quickAdd(kind, title, extra) {
        const ev = api.active(); if (!ev) return;
        logOf(ev).push(Object.assign({ id: api.uid('lg'), at: new Date().toISOString(), kind: kind, title: title, detail: '', crowd: null, vehicles: null, law: '',
            unit: UNIT_OF[kind] || 'ศปก.ส่วนหน้า', place: DEFAULT_PLACE, by: recorder(), level: '', evidence: '', deadlineAt: '', refId: '' }, extra || {}));
        api.save(); render(); api.toast('บันทึกแล้ว · ' + hm(Date.now()) + ' น.');
    }

    /* ---------------- คัดลอกส่ง LINE ---------------- */
    function lineText(ev) {
        const rows = sorted(ev).slice(-15);
        const c = latest(ev, 'crowd'), v = latest(ev, 'vehicles'), L0 = api.LEVELS[ev.level] || {};
        const L = ['📋 บันทึกเหตุการณ์ ศปก.ส่วนหน้า', ev.title, '📍 ' + (ev.place || '-'),
            '👥 ผู้ชุมนุมล่าสุด ' + (c == null ? '-' : c + ' คน') + ' · รถ ' + (v == null ? '-' : v + ' คัน') + ' · ระดับ ' + (L0.emoji || '') + ' ' + (L0.short || ''), ''];
        rows.forEach((x) => L.push('• ' + hm(Date.parse(x.at)) + ' น. ' + x.title + (x.law ? ' [' + x.law + ']' : '')));
        L.push('', 'ข้อมูล ณ ' + api.thDateShort(Date.now()) + ' ' + api.hmTh(Date.now()));
        return L.join('\n');
    }

    /* ---------------- พิมพ์ตารางลำดับเหตุการณ์ (เอกสารแนบท้ายคำร้อง) ---------------- */
    function rowsFor(ev, opts) {
        const o = opts || {};
        let rows = sorted(ev).filter((x) => !o.court || COURT_KINDS.indexOf(x.kind) !== -1).map((x) => Object.assign({ src: 'log' }, x));
        if (o.schedule) {
            const add = (t, title) => { if (t) rows.push({ src: 'plan', at: new Date(t).toISOString(), kind: 'note', title: title }); };
            add(api.musterOf(ev), 'กำหนดการ: รวมพล/ปล่อยแถว ' + (ev.musterLabel || ''));
            add(api.startOf(ev), 'กำหนดการ: เริ่มการชุมนุมตามที่แจ้ง');
            add(api.endOf(ev), 'กำหนดการ: ครบเวลาเลิกการชุมนุมตามที่แจ้ง');
        }
        if (o.levels) (ev.levelLog || []).forEach((l) => rows.push({ src: 'level', at: l.at, kind: 'note', title: 'ปรับระดับสถานการณ์เป็น' + ((api.LEVELS[l.level] || {}).name || '') }));
        return rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    }
    function printPrefs() {
        let p = {};
        try { p = JSON.parse(localStorage.getItem(PRINT_KEY) || '{}') || {}; } catch (e) { p = {}; }
        return Object.assign({ scope: 'court', schedule: true, levels: false, attach: 'เอกสารแนบท้ายคำร้องหมายเลข ๕', thai: true, landscape: false,
            maker: recorder(), checker: 'พันตำรวจโท อัคเดช ลัดดาวัลย์', checkerPos: 'รองผู้กำกับการ (สอบสวน) สถานีตำรวจนครบาลลำหิน' }, p);
    }
    function printDialog() {
        const ev = api.active(); if (!ev) return;
        if (!logOf(ev).length) { api.toast('ยังไม่มีบันทึกให้พิมพ์'); return; }
        const p = printPrefs();
        api.modal({
            title: 'พิมพ์ตารางลำดับเหตุการณ์ (แนบคำร้องศาล)', icon: 'fa-print',
            body: '<div class="cmd-form">' +
                api.field('รายการที่พิมพ์', 'scope', p.scope, 'select', { cls: 'full', options: [['court', 'เฉพาะที่ใช้ประกอบคำร้อง (สถานการณ์ ฝ่าฝืน เจรจา ประกาศ ศาล)'], ['all', 'ทุกรายการ']] }) +
                api.field('ข้อความมุมขวาบน', 'attach', p.attach, 'text', { cls: 'full' }) +
                api.field('ผู้บันทึก (ยศ ชื่อ-สกุล)', 'maker', p.maker, 'text') +
                api.field('ผู้ตรวจสอบ', 'checker', p.checker, 'text') +
                api.field('ตำแหน่งผู้ตรวจสอบ', 'checkerPos', p.checkerPos, 'text', { cls: 'full' }) + '</div>',
            actions: [
                { label: 'ยกเลิก', run: (c) => c() },
                { label: '<i class="fa-solid fa-print"></i> พิมพ์ / PDF', cls: 'gold', run: (close, box) => {
                    const v = (n) => api.formVal(box, n);
                    const np = Object.assign({}, p, { scope: v('scope'), attach: v('attach'), maker: v('maker'), checker: v('checker'), checkerPos: v('checkerPos') });
                    try { localStorage.setItem(PRINT_KEY, JSON.stringify(np)); } catch (e) { /* ไม่จำก็ได้ */ }
                    close(); printLog(ev, np);
                } }
            ]
        });
    }
    function printHtml(ev, p) {
        const T = (s) => p.thai ? thDigits(s) : String(s == null ? '' : s);
        const rows = rowsFor(ev, { court: p.scope === 'court', schedule: p.schedule, levels: p.levels });
        const s = api.startOf(ev);
        const multiDay = new Set(rows.map((x) => new Date(x.at).toDateString())).size > 1;
        const tr = rows.map((x, i) => {
            const plan = x.src !== 'log';
            const k = KINDS[x.kind] || KINDS.note;
            const counts = [x.crowd != null ? 'ผู้ชุมนุม ' + x.crowd + ' คน' : '', x.vehicles != null ? 'รถ ' + x.vehicles + ' คัน' : ''].filter(Boolean).join('<br>');
            const what = '<b>' + esc(x.title) + '</b>' + (x.detail && x.detail !== x.title ? '<br>' + esc(x.detail) : '') +
                (x.place && !plan ? '<br><span class="m">จุด: ' + esc(x.place) + '</span>' : '') + (x.unit && !plan ? '<span class="m"> · ผู้รายงาน: ' + esc(x.unit) + '</span>' : '');
            return '<tr class="' + (plan ? 'plan' : '') + '"><td class="c">' + T(i + 1) + '</td><td class="c">' + T(hm(Date.parse(x.at))) + ' น.' +
                (multiDay ? '<br><span class="m">' + T(api.thDateShort(Date.parse(x.at))) + '</span>' : '') + (plan ? '' : '<br><span class="m">' + esc(k.label) + '</span>') + '</td>' +
                '<td>' + T(what) + '</td><td class="c">' + T(counts || '-') + '</td><td>' + T(esc(x.law || '-')) + '</td><td>' + T(esc(x.evidence || (plan ? '' : '-'))) + '</td></tr>';
        }).join('');
        const title = 'บันทึกลำดับเหตุการณ์การชุมนุมสาธารณะ';
        const dateLine = s ? api.thDateLong(s) : '';
        const css = '@font-face{font-family:THSarabunDoc;src:url("cmd/fonts/THSarabunPSK.woff") format("woff");font-weight:400}' +
            '@font-face{font-family:THSarabunDoc;src:url("cmd/fonts/THSarabunPSK-Bold.woff") format("woff");font-weight:700}' +
            '@page{size:A4 ' + (p.landscape ? 'landscape' : 'portrait') + ';margin:2cm 2cm 2cm 3cm;@top-center{content:"- " counter(page' + (p.thai ? ', thai' : '') + ') " -";font-family:THSarabunDoc,"TH SarabunPSK",Sarabun,sans-serif;font-size:16pt}}' +
            '@page:first{@top-center{content:none}}' +
            '*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#000}body{font-family:THSarabunDoc,"TH SarabunPSK","TH Sarabun New",Sarabun,sans-serif;font-size:16pt;line-height:1.15}' +
            '.att{text-align:right;font-size:14pt;margin:0 0 4pt}h1{font-size:20pt;text-align:center;margin:0}.sub{text-align:center;margin:2pt 0 0}' +
            '.info{margin:8pt 0 8pt;font-size:15pt}.info div{margin:1pt 0}' +
            'table{width:100%;border-collapse:collapse;font-size:14pt;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}' +
            'th,td{border:1px solid #000;padding:3pt 5pt;vertical-align:top}th{background:#e9e9e9;font-weight:700;text-align:center}' +
            'td.c{text-align:center;white-space:nowrap}.m{font-size:12.5pt;color:#333}tr.plan td{font-style:italic;color:#444;background:#f6f6f6}' +
            '.cert{margin-top:12pt;text-indent:2.5cm;text-align:justify}.signs{margin-top:22pt;page-break-inside:avoid}.sg{margin-left:37.5%;text-align:center}.sg+.sg{margin-top:16pt}.signs p{margin:0}' +
            // ลงชื่อ: เส้นจุด (ที่เซน) กว้างเท่าชื่อในวงเล็บ อยู่กึ่งกลางชื่อ · ยศจบก่อนวงเล็บชื่อเล็กน้อย · คำบทบาทต่อท้ายเส้น
            '.sc{display:inline-block;position:relative;min-width:3.6cm}.sc .sa,.sc .sb{position:absolute;top:0;white-space:nowrap}.sc .sa{right:calc(100% + .3cm)}.sc .sb{left:calc(100% + .15cm)}' +
            '.sd,.sdl{display:block;width:0;min-width:100%;overflow:clip;white-space:nowrap;text-decoration:underline dotted 1px;text-underline-offset:.2em}.sdl{display:inline-block;min-width:0;width:3.6cm;vertical-align:baseline}';
        // ลงชื่อ: ยศอยู่บรรทัดลงชื่อ · (ชื่อจริง นามสกุล) ไม่มียศ
        const RANK_RE = /^((?:ว่าที่\s*)?(?:พล\.ต\.[อทต]\.|[พร]\.ต\.[อทต]\.|ส\.ต\.[อทต]\.|จ\.ส\.ต\.|ด\.ต\.|พลตำรวจ(?:เอก|โท|ตรี)|พันตำรวจ(?:เอก|โท|ตรี)|ร้อยตำรวจ(?:เอก|โท|ตรี)|ดาบตำรวจ|จ่าสิบตำรวจ|สิบตำรวจ(?:เอก|โท|ตรี))(?:\s*หญิง)?)\s*/;
        const sign = (label, name, pos) => {
            const n = String(name || '').trim(), m = n.match(RANK_RE), rank = m && n.slice(m[0].length) ? m[1] : '', nm = rank ? n.slice(m[0].length) : n;
            const NB = ' '.repeat(120);
            return '<div class="sg"><div class="sc"><span class="sa">' + (rank ? esc(rank) : '') + '</span><span class="sd">' + NB + '</span><span class="sb">' + label + '</span>' +
                '<p>(' + (nm ? esc(nm) : '<span class="sdl">' + NB + '</span>') + ')</p></div>' + (pos ? '<p>' + esc(pos) + '</p>' : '') + '</div>';
        };
        const body =
            (p.attach ? '<p class="att">' + esc(T(p.attach)) + '</p>' : '') +
            '<h1>' + title + '</h1><p class="sub">' + esc(ev.title) + '</p>' +
            '<div class="info">' +
                '<div><b>สถานที่</b> ' + T(esc(ev.place || '-')) + (ev.latlng ? ' (พิกัด ' + T(esc(ev.latlng)) + ')' : '') + '</div>' +
                '<div><b>วันเวลาตามที่แจ้ง</b> ' + T(esc(dateLine)) + ' เวลา ' + T(esc(api.hmStr(ev.start))) + ' ถึง ' + T(esc(api.hmStr(ev.end))) + '</div>' +
                (ev.organizer ? '<div><b>ผู้จัดการชุมนุม</b> ' + T(esc(ev.organizer.split(' · ')[0])) + '</div>' : '') +
                (ev.ref ? '<div><b>หลักฐานการรับแจ้ง</b> ' + T(esc(ev.ref)) + '</div>' : '') +
                '<div><b>บันทึกโดย</b> ศูนย์ปฏิบัติการส่วนหน้า สถานีตำรวจนครบาลลำหิน</div>' +
            '</div>' +
            '<table><thead><tr><th style="width:6%">ลำดับ</th><th style="width:11%">เวลา</th><th>เหตุการณ์ / พฤติการณ์</th><th style="width:11%">จำนวน</th><th style="width:13%">ข้อกฎหมาย</th><th style="width:11%">หลักฐาน</th></tr></thead><tbody>' + tr + '</tbody></table>' +
            '<p class="cert">ข้าพเจ้าขอรับรองว่าบันทึกลำดับเหตุการณ์ฉบับนี้ จัดทำขึ้นตามเหตุการณ์ที่เกิดขึ้นจริงในขณะปฏิบัติหน้าที่ดูแลการชุมนุมสาธารณะ ณ สถานที่และวันเวลาดังกล่าวข้างต้น โดยมีภาพถ่ายและคลิปวิดีโอบันทึกเหตุการณ์ประกอบตามที่ระบุไว้</p>' +
            '<div class="signs">' + sign('ผู้บันทึก', p.maker, '') + sign('ผู้ตรวจสอบ', p.checker, p.checkerPos) + '</div>';
        return '<!doctype html><html lang="th"><head><meta charset="utf-8"><title>' + title + '</title><style>' + css + '</style></head><body>' + body + '</body></html>';
    }
    function printLog(ev, p) {
        const old = document.getElementById('cmdl-print'); if (old) old.remove();
        const f = document.createElement('iframe');
        f.id = 'cmdl-print';
        f.setAttribute('aria-hidden', 'true');
        f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
        document.body.appendChild(f);
        const d = f.contentDocument;
        d.open(); d.write(printHtml(ev, p).replace('<head>', '<head><base href="' + esc(document.baseURI) + '">')); d.close();
        const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { api.toast('เปิดหน้าพิมพ์ไม่ได้ในเบราว์เซอร์นี้'); } };
        const ready = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
        Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(go, 150));
    }

    /* ---------------- คลิก / ทุกวินาที ---------------- */
    function onClick(e) {
        const b = e.target.closest('[data-cl]');
        if (!b || !el.contains(b)) return;
        const ev = api.active(); if (!ev) return;
        const act = b.dataset.cl;
        if (act === 'sub') {
            if (b.dataset.v === 'ladder' && !hasLadder()) return;
            const was = sub;
            setSubTab(b.dataset.v); render(); if (api.syncSections) api.syncSections();
            if (sub !== was && el.getBoundingClientRect().top < 0) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 64), behavior: 'smooth' });
            return;
        }
        if (act === 'new') openSheet(freshS(ev, b.dataset.k));
        else if (act === 'go') api.openTab(b.dataset.tab);
        else if (act === 'edit') { const x = logOf(ev).find((y) => y.id === b.dataset.id); if (x) openSheet(fromEntry(x)); }
        else if (act === 'order') { newestFirst = !newestFirst; try { localStorage.setItem(ORDER_KEY, newestFirst ? 'new' : 'old'); } catch (er) { /* ไม่จำก็ได้ */ } render(); }
        else if (act === 'line') api.copyText(lineText(ev));
        else if (act === 'print') printDialog();
        else if (act === 'due-ok') quickAdd('deadline', OUT.deadline[0], { refId: b.dataset.ref });
        else if (act === 'due-no') openSheet(freshS(ev, 'deadline', { outcome: OUT.deadline[1], refId: b.dataset.ref }));
        else if (act === 'del') {
            const x = logOf(ev).find((y) => y.id === b.dataset.id); if (!x) return;
            if (!window.confirm('ลบรายการ ' + hm(Date.parse(x.at)) + ' น. "' + (x.title || '').slice(0, 60) + '" ?')) return;
            ev.log = logOf(ev).filter((y) => y.id !== x.id); api.save(); render(); api.toast('ลบรายการแล้ว');
        } else if (act === 'del-lv') {
            const lv = Array.isArray(ev.levelLog) ? ev.levelLog : [];
            const i = lv.findIndex((l) => l.at === b.dataset.at); if (i < 0) return;
            if (!window.confirm('ลบการปรับระดับสถานการณ์ เวลา ' + hm(Date.parse(lv[i].at)) + ' น. ?')) return;
            const wasLatest = i === lv.length - 1 || lv.every((l, j) => j === i || Date.parse(l.at) < Date.parse(lv[i].at));
            lv.splice(i, 1);
            // ลบการปรับล่าสุด → ระดับกลับไปเป็นระดับก่อนหน้า (ไม่มีแล้ว = สีเขียว)
            if (wasLatest) { const prev = lv.slice().sort((p, q) => Date.parse(p.at) - Date.parse(q.at)).pop(); ev.level = prev ? prev.level : 'green'; }
            api.save(); api.render(); render(); api.toast('ลบการปรับระดับแล้ว');
        } else if (act === 'clear') {
            const n = logOf(ev).length, m = (ev.levelLog || []).length;
            if (!window.confirm('ล้างบันทึกทั้งหมด ' + n + ' รายการ และการปรับระดับ ' + m + ' ครั้ง?\nลบแล้วกู้คืนไม่ได้ (แนะนำกด Export JSON ในหน้าภาพรวมเก็บไว้ก่อน)')) return;
            ev.log = []; ev.levelLog = []; api.save(); api.render(); render(); api.toast('ล้างบันทึกแล้ว');
        }
        else if (act === 'ot-ok') quickAdd('end', OUT.end[0]);
        else if (act === 'ot-no') openSheet(freshS(ev, 'end', { outcome: OUT.end[1] }));
    }
    let lastAlertKey = '';
    function tick() {
        if (!el) return;
        const ev = api.active(); if (!ev) return;
        const now = el.querySelector('[data-cl-tick="now"]'); if (now) now.textContent = hm(Date.now());
        const due = el.querySelector('[data-cl-tick="due"]');
        if (due) due.textContent = left(Number(due.dataset.due) - Date.now());
        // สถานะแจ้งเตือนเปลี่ยน (เช่น ถึงเวลาครบกำหนด) → วาดกล่องแจ้งเตือนใหม่
        const a = pendingAnnounce(ev);
        const key = (a ? a.id + (Date.parse(a.deadlineAt) > Date.now() ? 'w' : 'd') : '') + (overtime(ev) ? 'ot' : '');
        if (key !== lastAlertKey) { lastAlertKey = key; const box = el.querySelector('.cl-alerts'); if (box) box.innerHTML = alertHtml(ev); }
    }

    // ให้โมดูลอื่นใช้ร่วม
    window.LamhinCmdLog = {
        KINDS: KINDS,
        rows: (ev, opts) => rowsFor(ev, opts),
        printHtml: (ev, opts) => printHtml(ev, Object.assign(printPrefs(), opts || {})),
        print: (ev, opts) => printLog(ev, Object.assign(printPrefs(), opts || {})),
        showSub: (v) => { setSubTab(v); api.openTab('log'); }   // เช่น ปุ่ม "บันทึก ศปก." ในแผงมาตรการ → กลับแท็บย่อยบันทึกเหตุการณ์
    };

    window.LamhinCmd.registerSection({
        id: 'log', label: 'บันทึก ศปก.', icon: 'fa-clipboard-list', order: 35,
        shows(childId) { return childId === 'ladder' ? sub === 'ladder' : true; },
        // เปิดแผงมาตรการ (openTab('ladder')) หรือแท็บย่อยที่ย้ายมา (openTab('legal' / 'contact' / 'time'))
        reveal(childId) { if (isSub(childId)) { setSubTab(childId); if (el) render(); } },
        mount(node, a) {
            api = a; el = node;
            el.addEventListener('click', onClick);
            render();
        },
        update(ev) {
            if (sheet && sheet.isConnected) return;   // กำลังกรอกอยู่ ไม่วาดทับ
            render();
        },
        visible(on) {
            clearInterval(timer); timer = 0;
            if (on) { render(); timer = setInterval(tick, 1000); }
        }
    });
})();
