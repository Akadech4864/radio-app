/* =====================================================================
   4 ระยะการดูแลการชุมนุม + บันได 7 ขั้นตอนบังคับใช้กฎหมาย (พ.ร.บ.การชุมนุมสาธารณะฯ ม.21–24) + ทางลัดฉุกเฉิน ม.25
   (Step 3 · แท็บ "4 ระยะ · 7 ขั้น" เสียบผ่าน LamhinCmd.registerSection — ไม่แก้ cmd.js)
   - ข้อมูลชุดเดียวกับแท็บ "บันทึก ศปก." (ev.log) — กดบันทึกที่นี่จะขึ้นใน timeline และเติมคำร้องศาลในแท็บเอกสารเอง
     รูปแบบรายการตรงกับ cmdlog.js: { id, at, kind, title, detail, crowd, vehicles, law, unit, place, by, level, evidence,
     deadlineAt, refId, ann, minutes, outcome } + ladder ('L1'–'L7' / 'S25') / phase (1–4) ของโมดูลนี้
   - สถานะแต่ละขั้นอ่านจากบันทึก ศปก. ทั้งหมด (บันทึกจากแท็บไหนก็ขึ้นตรงกัน)
   - ประกาศ ม.21 / ม.23: ตัวจับเวลาถอยหลังถึงเวลาครบกำหนด + แนะนำระยะเวลาที่ได้สัดส่วนกับจำนวนผู้ชุมนุม
   ===================================================================== */
(function () {
    'use strict';
    const CMD = window.LamhinCmd;
    if (!CMD || typeof CMD.registerSection !== 'function') return;

    const SRC = (document.currentScript && document.currentScript.src) || '';
    const BASE = SRC.replace(/[^/]*(\?.*)?$/, '');
    const VER = ((SRC.match(/[?&]v=([^&]+)/) || [])[1] || '1') + '.2';   // เลขหลังจุด: เพิ่มทุกครั้งที่แก้ cmdladder.css
    (function () {
        if (document.querySelector('link[data-ldcss]')) return;
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + 'cmdladder.css?v=' + VER; l.setAttribute('data-ldcss', '');
        document.head.appendChild(l);
    })();

    const BY_KEY = 'lamhin_cmd_logby';                  // ชื่อผู้บันทึก (ใช้ร่วมกับแท็บบันทึก ศปก.)
    const PLACE = 'จุดชุมนุม ปากซอยคู้คลองสิบ 4';

    const PHASES = [
        { n: 1, name: 'ขั้นเตรียมการ', icon: 'fa-clipboard-list', desc: 'ประสานเขต/บรรเทาสาธารณภัย/โรงพยาบาล ส่งหนังสือ ม.11 เตรียมกำลังพล อุปกรณ์ ข้อกฎหมาย และแฟ้มคำร้องศาล' },
        { n: 2, name: 'ขั้นเผชิญเหตุ', icon: 'fa-person-walking', desc: 'เริ่มฝ่าฝืนเงื่อนไข/กฎหมาย → ส่งชุดเจรจา กระชับพื้นที่ตามแผน (ยังไม่สลายการชุมนุม) บันทึกภาพทุกขั้นตอน' },
        { n: 3, name: 'ขั้นใช้กำลังคลี่คลายสถานการณ์', icon: 'fa-shield-halved', desc: 'ต้องพิสูจน์ได้ว่าทำครบจากเบาไปหนัก (เจรจา → ประกาศ → คำสั่งศาล → พื้นที่ควบคุม) ใช้กำลังเท่าที่จำเป็นตามแผน ม.21' },
        { n: 4, name: 'ขั้นหลังการชุมนุม / ฟื้นฟู', icon: 'fa-broom', desc: 'คืนพื้นที่ ตรวจที่เกิดเหตุ รวบรวมพยานหลักฐาน 3 ช่วง คืนรถ/ทรัพย์ที่ไม่เกี่ยวข้อง สรุปสำนวนหรือบันทึกปิดภารกิจ' }
    ];
    const STEPS = [
        { n: 1, name: 'เจรจา', law: 'หลักความได้สัดส่วน', who: 'ชุดเจรจา / งาน ป. / พงส.ส่วนหน้า', desc: 'เจรจาทำความเข้าใจกับผู้จัด (นายภูเบศ โพธิ์โซ๊ะ) และผู้ประสานงานทั้ง 2 ท่านเป็นลำดับแรก บันทึกภาพและเวลาการเจรจา', btn: 'บันทึกการเจรจา', repeat: true },
        { n: 2, name: 'ประกาศให้แก้ไข / ให้เลิกการชุมนุม', law: 'ม.21 (2) / ม.21 (1)', who: 'รรท.ผกก. (เจ้าพนักงานดูแลฯ) + งานสืบสวนถ่ายคลิป Uncut', desc: 'ฝ่าฝืน ม.15 / 16 / 17 ช่วง 05.00–18.00 น. → ประกาศให้แก้ไข ม.21 (2) · เลย 18.00 น. (ฝ่าฝืน ม.18) → ประกาศให้เลิก ม.21 (1) · กำหนดเวลาให้ได้สัดส่วนกับจำนวนผู้ชุมนุมและเส้นทางออก ห้ามสั้นเกินวิสัย', btn: 'บันทึกการประกาศ', repeat: true, docs: 'เปิดบทประกาศ' },
        { n: 3, name: 'ยื่นคำร้องไต่สวนฉุกเฉินต่อศาลแพ่งมีนบุรี', law: 'ม.21 วรรคสอง', who: 'พงส. ชุดเอกสาร + ธุรการขับรถไปศาล', desc: 'ครบกำหนดตามประกาศแล้วยังไม่แก้ไข/ไม่เลิก → ยื่นคำร้องพร้อมเอกสารแนบ 6 รายการ ระหว่างรอคำสั่งศาลใช้มาตรการเท่าที่จำเป็นตามแผน ม.21', btn: 'บันทึกการยื่นคำร้อง', docs: 'เปิดร่างคำร้องศาล' },
        { n: 4, name: 'ศาลมีคำสั่ง / ออกคำบังคับให้เลิกการชุมนุม', law: 'ม.22', who: 'ศาลแพ่งมีนบุรี / พงส. รับคำสั่ง', desc: 'ศาลพิจารณาเป็นการด่วนและออกคำบังคับให้เลิกภายในเวลาที่ศาลกำหนด (ผู้ชุมนุมอุทธรณ์ได้ แต่ไม่ตัดขั้นตอนบังคับตามคำสั่ง)', btn: 'บันทึกคำสั่งศาล' },
        { n: 5, name: 'ปิดประกาศคำสั่งศาล + รายงานศาลและรัฐมนตรี', law: 'ม.22 วรรคสี่', who: 'เจ้าพนักงานบังคับคดีร่วมกับตำรวจ / พงส.', desc: 'ปิดประกาศคำสั่งศาลในที่แลเห็นได้ง่าย ณ ปากซอยคู้คลองสิบ 4 หรือส่งมอบผู้จัด ประกาศให้ทราบทั่วกัน หากไม่เลิกให้รายงานศาลและรัฐมนตรี', btn: 'บันทึกการปิดประกาศ' },
        { n: 6, name: 'ประกาศกำหนดพื้นที่ควบคุม', law: 'ม.23', who: 'เจ้าพนักงานดูแลฯ / ผบช.น. (ผู้ควบคุมสถานการณ์)', desc: 'กำหนดขอบเขตพื้นที่ควบคุม ห้ามเข้าโดยไม่ได้รับอนุญาต และสั่งให้ออกภายในเวลาที่กำหนด (กำหนดเป็นนาทีได้ เช่น 20–30 นาที ตามจำนวนคนและเส้นทางออก)', btn: 'บันทึกการประกาศพื้นที่ควบคุม', docs: 'เปิดบทประกาศ' },
        { n: 7, name: 'พ้นกำหนด = ความผิดซึ่งหน้า: จับกุม / ค้น / ยึด', law: 'ม.24', who: 'ผบช.น. / ผู้ได้รับมอบหมาย / คฝ. / พงส. รับตัว', desc: 'ผู้ที่ยังอยู่หรือเข้าไปในพื้นที่ควบคุมโดยไม่ได้รับอนุญาตถือว่ากระทำความผิดซึ่งหน้า มีอำนาจจับกุม ค้น ยึด อายัด รื้อถอนทรัพย์สินที่ใช้ในการชุมนุม และสั่งห้ามกระทำการใด ๆ', btn: 'บันทึกการจับกุม/ยึด' }
    ];
    // ข้อความประกาศ/ผลลัพธ์ ใช้คำเดียวกับแท็บบันทึก ศปก. (cmdlog.js)
    const ANN = {
        a212: { label: 'ให้แก้ไข ม.21 (2)', law: 'ม.21(2)', text: 'เจ้าพนักงานดูแลการชุมนุมสาธารณะประกาศให้ผู้ชุมนุมแก้ไขการกระทำที่ฝ่าฝืน ตามมาตรา 21 (2)' },
        a211: { label: 'ให้เลิก ม.21 (1)', law: 'ม.21(1)', text: 'เจ้าพนักงานดูแลการชุมนุมสาธารณะประกาศให้ผู้ชุมนุมเลิกการชุมนุม ตามมาตรา 21 (1)' },
        a23: { label: 'พื้นที่ควบคุม ม.23', law: 'ม.23', text: 'ประกาศกำหนดพื้นที่ควบคุมและให้ผู้ชุมนุมออกจากพื้นที่ควบคุม ตามมาตรา 23' },
        a25: { label: 'ยุติเหตุรุนแรง ม.25', law: 'ม.25', text: 'สั่งให้ผู้ชุมนุมยุติการกระทำที่มีลักษณะรุนแรง ตามมาตรา 25' }
    };
    const NEG_OUT = ['ผู้จัดยินยอมปฏิบัติตาม', 'ผู้จัดขอเวลาหารือกับผู้ชุมนุม', 'ผู้จัดปฏิเสธไม่ปฏิบัติตาม'];
    const DUE_OUT = ['ผู้ชุมนุมปฏิบัติตามประกาศแล้ว', 'ผู้ชุมนุมไม่ปฏิบัติตามประกาศ', 'ผู้ชุมนุมปฏิบัติตามบางส่วน'];
    const COURT_FILE = 'ยื่นคำร้องต่อศาลแพ่งมีนบุรีขอให้มีคำสั่งให้เลิกการชุมนุม (ม.21 วรรคสอง)';
    const COURT_ORDER = 'ศาลแพ่งมีนบุรีมีคำสั่งให้ผู้ชุมนุมเลิกการชุมนุม (ม.22)';
    const COURT_POST = 'ปิดประกาศคำบังคับของศาล ณ สถานที่ชุมนุม';
    const VIOLATIONS = [
        { law: 'ม.15 (6)', act: 'ใช้โทรโข่ง/เครื่องขยายเสียงก่อนเวลา 06.00 น.', fix: 'หยุดใช้โทรโข่งจนถึงเวลา 06.00 น.' },
        { law: 'ม.15 (2) / ม.16 (1)', act: 'นำรถยนต์และกลุ่มบุคคลปิดกั้นผิวจราจรเกินสมควร', fix: 'นำรถและบุคคลขึ้นจากผิวจราจร เปิดเส้นทางสัญจร' },
        { law: 'ม.16 (7)', act: 'ขัดขวางการปฏิบัติงานของเจ้าพนักงาน / ช่างการไฟฟ้า', fix: 'เปิดทางให้เจ้าพนักงานและช่างการไฟฟ้าปฏิบัติงาน' },
        { law: 'ม.17', act: 'เคลื่อนขบวนโดยมิได้แจ้งล่วงหน้า', fix: 'ยุติการเคลื่อนขบวน กลับเข้าพื้นที่ชุมนุมตามที่แจ้ง' },
        { law: 'ม.15 (7)', act: 'ใช้เสียงเกินระดับที่กำหนด', fix: 'ลดระดับเสียงไม่ให้เกินมาตรฐาน' }
    ];
    const VIOLENT = ['ทำร้ายร่างกายผู้อื่น/เจ้าหน้าที่', 'ทุบทำลายทรัพย์สิน', 'พกพาอาวุธ/วัตถุอันตราย', 'วางเพลิง', 'ขว้างปาสิ่งของใส่เจ้าหน้าที่', 'บุกรุก/ยึดรถการไฟฟ้า'];
    const MINUTES = [10, 15, 20, 30, 45, 60, 90];

    /* ---------------- สถานะ / ข้อมูล ---------------- */
    let api = null, host = null, timer = 0, lastKey = '', timerKey = '';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = (n) => String(n).padStart(2, '0');
    const logOf = (ev) => { if (!Array.isArray(ev.log)) ev.log = []; return ev.log; };
    const sorted = (ev) => logOf(ev).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const hm = (t) => api.hmTh(typeof t === 'number' ? t : Date.parse(t));
    const recorder = () => { try { return localStorage.getItem(BY_KEY) || ''; } catch (e) { return ''; } };
    function entry(o) {
        return Object.assign({ id: api.uid('lg'), at: new Date().toISOString(), kind: 'note', title: '', detail: '', crowd: null, vehicles: null, law: '',
            unit: 'ศปก.ส่วนหน้า', place: PLACE, by: recorder(), level: '', evidence: '', deadlineAt: '', refId: '' }, o);
    }
    const courtIs = (x, re) => x.kind === 'court' && re.test((x.title || '') + ' ' + (x.outcome || ''));
    const MATCH = {
        1: (x) => x.kind === 'negotiate',
        2: (x) => x.kind === 'announce' && (x.ann === 'a212' || x.ann === 'a211' || /ม\.\s*21/.test(x.law || '')),
        3: (x) => x.ladder === 'L3' || courtIs(x, /ยื่นคำร้อง/),
        4: (x) => x.ladder === 'L4' || courtIs(x, /มีคำสั่ง/),
        5: (x) => x.ladder === 'L5' || courtIs(x, /ปิดประกาศ/),
        6: (x) => x.kind === 'control' || (x.kind === 'announce' && (x.ann === 'a23' || /ม\.\s*23/.test(x.law || ''))),
        7: (x) => x.kind === 'arrest'
    };
    function stepRecs(L) { const r = {}; STEPS.forEach((s) => { r[s.n] = L.filter(MATCH[s.n]); }); return r; }
    function curPhase(L) { const p = L.filter((x) => x.phase); return p.length ? p[p.length - 1].phase : 0; }
    // ประกาศที่ยังรอผล (มีเวลาครบกำหนด และยังไม่ได้บันทึกผลครบกำหนด) — ใช้เกณฑ์เดียวกับแท็บบันทึก ศปก.
    function openTimer(L) {
        for (let i = L.length - 1; i >= 0; i--) {
            const a = L[i];
            if (a.kind !== 'announce' || !a.deadlineAt) continue;
            if (L.some((x) => x.kind === 'deadline' && (x.refId === a.id || Date.parse(x.at) >= Date.parse(a.deadlineAt)))) return null;
            return a;
        }
        return null;
    }
    function crowdNow(ev) {
        const L = sorted(ev);
        for (let i = L.length - 1; i >= 0; i--) if (L[i].crowd != null && L[i].crowd !== '' && !isNaN(Number(L[i].crowd))) return Number(L[i].crowd);
        const nums = String(ev.crowd || '').match(/\d+/g);
        return nums ? Math.max.apply(null, nums.map(Number).filter((n) => n < 5000)) : 150;
    }
    // ระยะเวลาที่ได้สัดส่วน (แนวทางในคู่มือ: ม.21 มวลชน 100–200 คน ราว 30–60 นาที · ม.23 กำหนดเป็นนาที เช่น 20–30 นาที)
    function suggest(ann, n) {
        if (ann === 'a23') return n > 200 ? [30, 45] : [20, 30];
        return n <= 50 ? [15, 30] : n <= 200 ? [30, 60] : [60, 90];
    }
    const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    function atMs(v) { const p = String(v || '').split(':').map(Number), d = new Date(); if (p.length < 2 || isNaN(p[0])) return Date.now(); d.setHours(p[0], p[1] || 0, 0, 0); return d.getTime(); }

    /* ---------------- วาดหน้าจอ ---------------- */
    function render() {
        if (!host || !api) return;
        const ev = api.active();
        if (!ev) { host.innerHTML = '<section class="cmd-card"><div class="cmd-empty"><i class="fa-solid fa-stairs"></i>ยังไม่มีเหตุการณ์ — เพิ่มเหตุการณ์ที่แถบด้านบนก่อน</div></section>'; return; }
        const L = sorted(ev), R = stepRecs(L), cur = curPhase(L);
        const next = STEPS.find((s) => !R[s.n].length);
        const s25 = L.filter((x) => x.kind === 'announce' && (x.ann === 'a25' || /ม\.\s*25/.test(x.law || '')));
        const curName = cur ? 'ระยะที่ ' + cur + ' ' + PHASES[cur - 1].name : 'ยังไม่ได้บันทึกระยะ';

        let h = '<section class="cmd-card"><div class="ld-top">' +
            '<div class="ld-now"><small>ขั้นถัดไปตามบันได ม.21–24 · ' + esc(curName) + '</small>' +
                (next ? '<b>ขั้นที่ ' + next.n + ' · ' + esc(next.name) + '</b><span class="ld-law">' + esc(next.law) + '</span>' : '<b>บันทึกครบทั้ง 7 ขั้นแล้ว</b>') +
                '<div class="ld-btns">' +
                    (next ? '<button type="button" class="cmd-btn gold" data-ld="step" data-n="' + next.n + '"><i class="fa-solid fa-pen-to-square"></i> ' + esc(next.btn) + '</button>' : '') +
                    '<button type="button" class="ld-sos" data-ld="s25"><i class="fa-solid fa-triangle-exclamation"></i> เหตุรุนแรง ม.25</button>' +
                '</div>' +
                '<div class="ld-btns">' +
                    '<button type="button" class="cmd-btn line sm" data-ld="line"><i class="fa-brands fa-line"></i> คัดลอกลำดับขั้นส่ง LINE</button>' +
                    '<button type="button" class="cmd-btn sm" data-ld="tab" data-tab="log"><i class="fa-solid fa-clipboard-list"></i> ดูบันทึก ศปก.</button>' +
                '</div></div>' +
            '<div class="ld-timer" id="ld-timer"></div>' +
            '</div>' +
            (s25.length ? '<div class="ld-note"><i class="fa-solid fa-triangle-exclamation"></i><span><b>สั่งยุติเหตุรุนแรงตาม ม.25 เมื่อ ' + esc(hm(s25[s25.length - 1].at)) + '</b> — ไม่ต้องรอคำสั่งศาล หากผู้ชุมนุมไม่ยุติการกระทำ ประกาศพื้นที่ควบคุม ม.23 และดำเนินการตาม ม.24 ได้ทันที (ผู้ไม่ปฏิบัติตามมีโทษตาม ม.33)</span></div>' : '') +
            '</section>';

        // ---- 4 ระยะ ----
        h += '<section class="cmd-card"><div class="cmd-card-h"><i class="fa-solid fa-route"></i><h4>4 ระยะการดูแลการชุมนุม</h4><small>แตะเพื่อลงเวลาเข้าสู่ระยะ (ใช้บรรยายในสำนวน)</small></div><div class="ld-phases">' +
            PHASES.map((p) => {
                const first = L.find((x) => x.phase === p.n);
                const cls = p.n === cur ? 'cur' : first ? 'done' : '';
                return '<button type="button" class="ld-ph ' + cls + '" data-ld="phase" data-n="' + p.n + '" aria-pressed="' + (p.n === cur) + '">' +
                    '<span class="ld-ph-n"><i class="fa-solid ' + p.icon + '"></i><b>ระยะที่ ' + p.n + '<br>' + esc(p.name) + '</b></span>' +
                    '<small>' + esc(p.desc) + '</small>' +
                    '<em>' + (p.n === cur ? '● ระยะปัจจุบัน · เริ่ม ' + esc(hm(L.filter((x) => x.phase === p.n).pop().at)) : first ? '✓ เริ่ม ' + esc(hm(first.at)) : 'แตะเพื่อเริ่มระยะนี้') + '</em></button>';
            }).join('') + '</div></section>';

        // ---- บันได 7 ขั้น ----
        h += '<section class="cmd-card"><div class="cmd-card-h"><i class="fa-solid fa-stairs"></i><h4>บันได 7 ขั้นตอนบังคับใช้กฎหมาย (ม.21–24)</h4><small>บันทึกตามลำดับ ห้ามข้ามขั้น เว้นแต่เหตุรุนแรง ม.25</small></div><ol class="ld-ladder">' +
            STEPS.map((s) => {
                const recs = R[s.n], done = recs.length > 0, isNext = next && next.n === s.n;
                const cls = done ? 'done' : isNext ? 'next' : 'lock';
                const recHtml = recs.length ? '<ul class="ld-recs">' + recs.map((x) => {
                    const due = x.deadlineAt ? ' · ให้เวลา ' + (x.minutes || Math.round((Date.parse(x.deadlineAt) - Date.parse(x.at)) / 60000)) + ' นาที ครบ ' + hm(x.deadlineAt) : '';
                    const res = x.deadlineAt ? L.find((y) => y.kind === 'deadline' && y.refId === x.id) : null;
                    return '<li class="' + (x.deadlineAt && !res ? 'due' : '') + '"><b>' + esc(hm(x.at)) + '</b><span>' + esc(x.title) + esc(due) + (res ? ' → ' + esc(res.title) + ' (' + esc(hm(res.at)) + ')' : '') + '</span></li>';
                }).join('') + '</ul>' : '';
                const canAct = isNext || (done && s.repeat) || (!done && !isNext);
                return '<li class="ld-step ' + cls + '"><div class="ld-dot">' + (done ? '<i class="fa-solid fa-check"></i>' : s.n) + '</div>' +
                    '<div class="ld-card"><div class="ld-card-h"><b>ขั้นที่ ' + s.n + ' · ' + esc(s.name) + '</b><span class="ld-law">' + esc(s.law) + '</span></div>' +
                    '<p>' + esc(s.desc) + '</p><div class="ld-who"><i class="fa-solid fa-user-shield"></i>' + esc(s.who) + '</div>' + recHtml +
                    '<div class="ld-act">' +
                        (canAct ? '<button type="button" class="cmd-btn sm ' + (isNext ? 'gold' : '') + '" data-ld="step" data-n="' + s.n + '"><i class="fa-solid ' + (done ? 'fa-plus' : 'fa-pen-to-square') + '"></i> ' + (done ? 'บันทึกเพิ่ม' : esc(s.btn)) + '</button>' : '') +
                        (s.docs ? '<button type="button" class="cmd-btn sm" data-ld="tab" data-tab="docs"><i class="fa-solid fa-file-lines"></i> ' + esc(s.docs) + '</button>' : '') +
                    '</div></div></li>';
            }).join('') + '</ol>' +
            '<div class="ld-note"><i class="fa-solid fa-bolt"></i><span><b>ข้อยกเว้นเหตุรุนแรงฉุกเฉิน (ม.25):</b> ผู้ชุมนุมกระทำการรุนแรงอาจเป็นอันตรายแก่ชีวิต ร่างกาย จิตใจ หรือทรัพย์สินจนเกิดความวุ่นวาย เจ้าพนักงานดูแลฯ สั่งให้ยุติได้ทันที ไม่ปฏิบัติตามเข้าสู่ ม.23–24 ได้โดยไม่ต้องรอคำสั่งศาล (คัดค้านต่อศาลแพ่งได้ภายใน 30 วัน) · ความผิดอาญาร้ายแรงซึ่งหน้า (พกอาวุธ ทำร้ายร่างกาย วางเพลิง) จับกุมตาม ป.วิ.อ. ได้ทันที</span></div>' +
            '</section>';
        host.innerHTML = h;
        tick(true);
    }

    // ---- นาฬิกาครบกำหนดตามประกาศ (อัปเดตทุกวินาที) ----
    function tick(force) {
        const box = host && host.querySelector('#ld-timer'); if (!box) return;
        const ev = api.active(); if (!ev) return;
        const L = sorted(ev), a = openTimer(L), now = Date.now();
        if (!a) {
            if (force || timerKey !== 'idle') { box.className = 'ld-timer idle'; box.innerHTML = '<small>ตัวจับเวลาครบกำหนดตามประกาศ</small><b>ยังไม่มีประกาศที่รอครบกำหนด</b><em>บันทึกขั้นที่ 2 หรือ 6 แล้วระบบจะนับถอยหลังให้</em>'; timerKey = 'idle'; }
            return;
        }
        const due = Date.parse(a.deadlineAt), left = due - now, over = left <= 0;
        const s = Math.floor(Math.abs(left) / 1000), mmss = (s >= 3600 ? Math.floor(s / 3600) + ':' + pad(Math.floor(s % 3600 / 60)) : Math.floor(s / 60)) + ':' + pad(s % 60);
        const key = a.id + (over ? 'd' : 'w');
        const label = (ANN[a.ann] || {}).label || a.law || 'ประกาศ';
        if (force || key !== timerKey) {
            box.className = 'ld-timer' + (over ? ' due' : '');
            box.innerHTML = '<small>' + esc(label) + ' · ประกาศ ' + esc(hm(a.at)) + ' · ครบ ' + esc(hm(due)) + '</small><b id="ld-mmss"></b>' +
                (over ? '<em>ครบกำหนดแล้ว — บันทึกผล</em><div class="ld-res">' + DUE_OUT.map((o, i) => '<button type="button" class="cmd-btn sm ' + (i === 1 ? 'danger' : i === 0 ? 'neon' : '') + '" data-ld="due" data-ref="' + esc(a.id) + '" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div>'
                    : '<em>เหลือเวลาก่อนครบกำหนดตามประกาศ</em>');
            timerKey = key;
        }
        const t = box.querySelector('#ld-mmss'); if (t) t.textContent = (over ? 'เลย ' : '') + mmss;
    }
    function startTimer() { if (!timer) timer = setInterval(() => tick(false), 1000); }
    function stopTimer() { clearInterval(timer); timer = 0; }

    /* ---------------- การกระทำ ---------------- */
    function onClick(e) {
        const b = e.target.closest('[data-ld]');
        if (!b || !host.contains(b)) return;
        const ev = api.active(); if (!ev) return;
        const k = b.dataset.ld;
        if (k === 'step') openSheet(Number(b.dataset.n));
        else if (k === 's25') openSheet('s25');
        else if (k === 'phase') phaseClick(ev, Number(b.dataset.n));
        else if (k === 'tab') api.openTab(b.dataset.tab);
        else if (k === 'line') api.copyText(lineText(ev));
        else if (k === 'due') {
            const i = Number(b.dataset.i), out = DUE_OUT[i];
            const a = logOf(ev).find((x) => x.id === b.dataset.ref);
            logOf(ev).push(entry({ kind: 'deadline', title: out, outcome: out, refId: b.dataset.ref, law: a ? a.law : '', ladder: a && a.ladder ? a.ladder + 'R' : '' }));
            api.save(); render();
            if (i !== 0 && a) {
                const nxt = a.ann === 'a23' ? 'ขั้นที่ 7 · จับกุม/ค้น/ยึด (ม.24)' : 'ขั้นที่ 3 · ยื่นคำร้องต่อศาลแพ่งมีนบุรี (ม.21 ว.2)';
                api.toast('บันทึกผลแล้ว · ขั้นถัดไป: ' + nxt);
            } else api.toast('บันทึกผลครบกำหนดแล้ว');
        }
    }
    function phaseClick(ev, n) {
        const L = sorted(ev), cur = curPhase(L);
        if (n === cur) {
            if (!window.confirm('ยกเลิกเวลาเข้าสู่ระยะที่ ' + n + ' ที่บันทึกล่าสุด?')) return;
            const last = L.filter((x) => x.phase === n).pop();
            ev.log = logOf(ev).filter((x) => x !== last && x.id !== last.id);
            api.save(); render(); return;
        }
        const p = PHASES[n - 1];
        logOf(ev).push(entry({ kind: 'sitrep', phase: n, title: 'เข้าสู่ระยะที่ ' + n + ' ' + p.name, detail: p.desc }));
        api.save(); render(); api.toast('ลงเวลาเข้าสู่ระยะที่ ' + n + ' แล้ว · ' + hm(Date.now()));
    }

    /* ---------------- แผ่นบันทึกแต่ละขั้น ---------------- */
    const chips = (name, opts, sel, multi, shortSet) => '<div class="ld-chips" data-group="' + name + '"' + (multi ? ' data-multi="1"' : '') + '>' +
        opts.map((o) => { const v = Array.isArray(o) ? o[0] : o, lb = Array.isArray(o) ? o[1] : o, on = multi ? (sel || []).indexOf(String(v)) !== -1 : String(sel) === String(v);
            return '<button type="button" class="ld-chip' + (on ? ' on' : '') + (shortSet && shortSet(v) ? ' short' : '') + '" data-chip="' + esc(name) + '" data-v="' + esc(v) + '">' + esc(lb) + '</button>'; }).join('') + '</div>';
    const sec = (label, inner) => '<div class="ld-sec"><span>' + label + '</span>' + inner + '</div>';
    const inp = (label, name, val, type, ph) => '<label class="cmd-f full"><span>' + label + '</span><input data-f="' + name + '" type="' + (type || 'text') + '" value="' + esc(val) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (type === 'number' ? ' inputmode="numeric" min="1" max="500"' : '') + '></label>';

    function openSheet(kind) {
        const ev = api.active(); if (!ev) return;
        const L = sorted(ev), R = stepRecs(L), now = Date.now();
        const endT = api.endOf(ev);
        const S = { at: nowHM(), crowd: crowdNow(ev), outcome: NEG_OUT[2], who: 'รรท.ผกก.สน.ลำหิน', note: '', ann: endT && now > endT ? 'a211' : 'a212', vio: 0, fix: VIOLATIONS[0].fix, minutes: 0, area: 'ปากซอยคู้คลองสิบ 4 โดยรอบในระยะ 100 เมตร', caseNo: '', within: '', posts: [], acts: [], arrests: '', violent: [], toRed: '1', toPhase3: '1' };
        S.minutes = suggest(kind === 6 ? 'a23' : S.ann, S.crowd)[0];
        const step = typeof kind === 'number' ? STEPS[kind - 1] : null;
        const skip = step && step.n > 1 && !R[step.n - 1].length ? 'ยังไม่ได้บันทึกขั้นที่ ' + (step.n - 1) + ' (' + STEPS[step.n - 2].name + ') — หลักต้องทำตามลำดับ ห้ามข้ามขั้น ถ้าทำไปแล้วแต่ยังไม่ได้บันทึก ให้บันทึกขั้นนั้นก่อน' : '';
        const title = kind === 's25' ? 'เหตุรุนแรงฉุกเฉิน · สั่งยุติตาม ม.25' : 'ขั้นที่ ' + step.n + ' · ' + step.name;
        const body = () => {
            let f = '<div class="cmd-form">';
            if (skip) f += '<div class="ld-guide warn"><b>เตือน:</b> ' + esc(skip) + '</div>';
            f += inp('เวลาที่เกิดขึ้นจริง', 'at', S.at, 'time');
            if (kind === 1) {
                f += sec('ผลการเจรจา', chips('outcome', NEG_OUT, S.outcome));
                f += inp('ผู้เจรจา', 'who', S.who) + inp('รายละเอียดเพิ่มเติม (ถ้ามี)', 'note', S.note, 'text', 'เช่น ขอให้นำรถขึ้นจากผิวจราจร');
            } else if (kind === 2) {
                f += sec('ประเภทประกาศ', chips('ann', [['a212', 'ให้แก้ไข ม.21 (2) · ช่วง 05.00–18.00 น.'], ['a211', 'ให้เลิกการชุมนุม ม.21 (1) · เลย 18.00 น.']], S.ann));
                f += '<div class="ld-sec" data-show="a212"><span>พฤติการณ์ที่ฝ่าฝืน</span>' + chips('vio', VIOLATIONS.map((v, i) => [i, v.law + ' · ' + v.act]), S.vio) + '</div>';
                f += '<label class="cmd-f full" data-show="a212"><span>ให้แก้ไขโดย</span><input data-f="fix" type="text" value="' + esc(S.fix) + '"></label>';
                f += inp('จำนวนผู้ชุมนุมขณะประกาศ (คน)', 'crowd', S.crowd, 'number');
                f += sec('ให้เวลาปฏิบัติ (นาที)', '<div data-minutes></div>');
                f += '<div class="ld-guide" data-guide></div><div class="ld-preview" data-preview></div>';
            } else if (kind === 3) {
                f += inp('ผู้ยื่นคำร้อง / หมายเหตุ', 'note', S.note, 'text', 'เช่น ร.ต.ท.หญิงนภัสร์นันท์ฯ ยื่นเวรไต่สวนฉุกเฉิน');
                f += '<div class="ld-guide">คำร้องและเอกสารแนบ 6 รายการอยู่ในแท็บ <b>คู่มือ & เอกสาร</b> — เวลาเจรจา/ประกาศ/ครบกำหนดที่บันทึกไว้จะถูกเติมลงคำร้องให้อัตโนมัติ</div>';
            } else if (kind === 4) {
                f += inp('คดีหมายเลขดำที่ (ถ้าทราบ)', 'caseNo', S.caseNo, 'text', 'เช่น พ 123/2569') + inp('ระยะเวลาที่ศาลกำหนดให้เลิก', 'within', S.within, 'text', 'เช่น ภายใน 2 ชั่วโมง');
            } else if (kind === 5) {
                f += sec('สิ่งที่ดำเนินการแล้ว (เลือกได้หลายข้อ)', chips('posts', ['ปิดประกาศ ณ ปากซอยคู้คลองสิบ 4', 'ส่งมอบคำบังคับให้ผู้จัด', 'ประกาศให้ผู้ชุมนุมทราบทั่วกัน', 'รายงานศาลและรัฐมนตรี (ผู้ชุมนุมยังไม่เลิก)'], S.posts, true));
            } else if (kind === 6) {
                f += inp('ขอบเขตพื้นที่ควบคุม', 'area', S.area);
                f += inp('จำนวนผู้ชุมนุมขณะประกาศ (คน)', 'crowd', S.crowd, 'number');
                f += sec('ให้ออกจากพื้นที่ภายใน (นาที)', '<div data-minutes></div>');
                f += '<div class="ld-guide" data-guide></div>';
            } else if (kind === 7) {
                f += sec('การดำเนินการ (เลือกได้หลายข้อ)', chips('acts', ['จับกุมผู้ฝ่าฝืน', 'ตรวจค้น', 'ยึด/อายัดทรัพย์สินที่ใช้ในการชุมนุม', 'รื้อถอนสิ่งกีดขวาง'], S.acts, true));
                f += inp('จำนวนผู้ถูกจับกุม (คน)', 'arrests', S.arrests, 'number') + inp('รายละเอียดเพิ่มเติม', 'note', S.note, 'text', 'เช่น ยึดรถเครื่องเสียง 1 คัน (บัญชีรถกลุ่มที่ 1)');
            } else if (kind === 's25') {
                f += sec('การกระทำที่รุนแรง (เลือกได้หลายข้อ)', chips('violent', VIOLENT, S.violent, true));
                f += inp('รายละเอียด', 'note', S.note, 'text', 'เช่น ขว้างขวดน้ำใส่แนว คฝ. บริเวณปากซอย');
                f += sec('ดำเนินการพร้อมกัน', chips('toRed', [['1', 'ปรับระดับสถานการณ์เป็นสีแดง']], S.toRed, true) + chips('toPhase3', [['1', 'ลงเวลาเข้าสู่ระยะที่ 3 (ใช้กำลังคลี่คลาย)']], S.toPhase3, true));
                f += '<div class="ld-guide warn"><b>ม.25:</b> สั่งให้ยุติการกระทำทันที — ไม่ปฏิบัติตาม ประกาศพื้นที่ควบคุม ม.23 และดำเนินการตาม ม.24 ได้ทันที · ผู้ไม่ปฏิบัติตามมีโทษตาม ม.33 จำคุกไม่เกิน 3 ปี หรือปรับไม่เกิน 60,000 บาท</div>';
            }
            return f + '</div>';
        };
        const refresh = (box) => {
            box.querySelectorAll('[data-show]').forEach((el) => { el.style.display = S.ann === el.dataset.show ? '' : 'none'; });
            const mBox = box.querySelector('[data-minutes]');
            if (mBox) {
                const ann = kind === 6 ? 'a23' : S.ann, sg = suggest(ann, Number(S.crowd) || 0);
                mBox.innerHTML = chips('minutes', MINUTES.filter((m) => kind === 6 ? m <= 45 : m >= 10).map(String), String(S.minutes), false, (v) => Number(v) < sg[0]);
                const g = box.querySelector('[data-guide]'), short = Number(S.minutes) < sg[0];
                if (g) {
                    g.className = 'ld-guide' + (short ? ' warn' : '');
                    g.innerHTML = '<b>หลักความได้สัดส่วน:</b> ผู้ชุมนุม ' + (Number(S.crowd) || '-') + ' คน → แนะนำ ' + sg[0] + '–' + sg[1] + ' นาที และต้องมีเส้นทางออกชัดเจน' +
                        (short ? '<br><b>ระยะเวลาสั้นกว่าที่แนะนำ</b> — อาจถูกโต้แย้งว่าสั้นเกินวิสัย ไม่ได้สัดส่วนกับจำนวนคน' : '') +
                        '<br>ครบกำหนดเวลา <b>' + hm(atMs(S.at) + Number(S.minutes) * 60000) + '</b>';
                }
            }
            const pv = box.querySelector('[data-preview]');
            if (pv) {
                const a = ANN[S.ann], v = VIOLATIONS[S.vio] || VIOLATIONS[0];
                pv.textContent = a.text + ' กำหนดเวลา ' + S.minutes + ' นาที (ครบ ' + hm(atMs(S.at) + Number(S.minutes) * 60000) + ')' +
                    (S.ann === 'a212' ? ' · ฝ่าฝืน ' + v.law + ' — ' + v.act + ' · ให้แก้ไขโดย ' + S.fix : ' · พ้นเวลาเลิกการชุมนุมตามที่แจ้ง (ม.18)');
            }
        };
        api.modal({
            title: title, icon: kind === 's25' ? 'fa-triangle-exclamation' : 'fa-stairs', body: body(),
            actions: [
                { label: 'ยกเลิก', run: (close) => close() },
                { label: '<i class="fa-solid fa-floppy-disk"></i> บันทึก', cls: kind === 's25' ? 'danger' : 'gold', run: (close) => { if (save(kind, S)) close(); } }
            ],
            onOpen: (box) => {
                box.addEventListener('click', (e) => {
                    const c = e.target.closest('[data-chip]'); if (!c) return;
                    const name = c.dataset.chip, grp = c.closest('[data-group]'), multi = grp && grp.dataset.multi;
                    if (multi) {
                        const arr = Array.isArray(S[name]) ? S[name] : (S[name] ? [S[name]] : []);
                        const i = arr.indexOf(c.dataset.v); if (i === -1) arr.push(c.dataset.v); else arr.splice(i, 1);
                        S[name] = name === 'toRed' || name === 'toPhase3' ? (arr.length ? '1' : '') : arr;
                        c.classList.toggle('on');
                    } else {
                        S[name] = name === 'vio' ? Number(c.dataset.v) : name === 'minutes' ? Number(c.dataset.v) : c.dataset.v;
                        grp.querySelectorAll('.ld-chip').forEach((x) => x.classList.toggle('on', x === c));
                        if (name === 'vio') { S.fix = VIOLATIONS[S.vio].fix; const fx = box.querySelector('[data-f="fix"]'); if (fx) fx.value = S.fix; }
                        if (name === 'ann') S.minutes = suggest(S.ann, Number(S.crowd) || 0)[0];
                    }
                    refresh(box);
                });
                box.addEventListener('input', (e) => {
                    const el = e.target.closest('[data-f]'); if (!el) return;
                    S[el.dataset.f] = el.value;
                    if (el.dataset.f === 'crowd' || el.dataset.f === 'at') refresh(box);
                });
                refresh(box);
            }
        });
    }

    function save(kind, S) {
        const ev = api.active(); if (!ev) return false;
        const at = atMs(S.at), iso = new Date(at).toISOString(), log = logOf(ev);
        const crowd = S.crowd !== '' && !isNaN(Number(S.crowd)) ? Math.max(1, Math.min(500, Number(S.crowd))) : null;
        if (kind === 1) {
            log.push(entry({ at: iso, kind: 'negotiate', title: 'เจรจากับผู้จัดการชุมนุม — ' + S.outcome, outcome: S.outcome, detail: ['ผู้เจรจา: ' + (S.who || '-'), S.note].filter(Boolean).join(' · '), ladder: 'L1' }));
        } else if (kind === 2) {
            const a = ANN[S.ann], v = VIOLATIONS[S.vio] || VIOLATIONS[0], mins = Number(S.minutes) || 30, due = at + mins * 60000;
            if (S.ann === 'a212' && !log.some((x) => x.kind === 'violation')) {   // ข้อเท็จจริงการฝ่าฝืน (ใช้เติมคำร้องศาล)
                log.push(entry({ at: new Date(at - 60000).toISOString(), kind: 'violation', law: v.law, title: v.act, crowd: crowd, unit: 'งานสืบสวน', ladder: 'L2v' }));
            }
            log.push(entry({ at: iso, kind: 'announce', ann: S.ann, law: a.law, minutes: mins, deadlineAt: new Date(due).toISOString(), crowd: crowd,
                title: a.text + ' กำหนดเวลา ' + mins + ' นาที (ครบ ' + hm(due) + ')',
                detail: (S.ann === 'a212' ? 'ฝ่าฝืน ' + v.law + ' — ' + v.act + ' · ให้แก้ไขโดย ' + S.fix : 'พ้นเวลาเลิกการชุมนุมตามที่แจ้ง (ม.18)') + (crowd ? ' · ผู้ชุมนุมประมาณ ' + crowd + ' คน' : ''),
                ladder: 'L2' }));
        } else if (kind === 3) {
            log.push(entry({ at: iso, kind: 'court', title: COURT_FILE, outcome: COURT_FILE, detail: S.note, unit: 'งานสอบสวน', place: 'ศาลแพ่งมีนบุรี', ladder: 'L3' }));
        } else if (kind === 4) {
            log.push(entry({ at: iso, kind: 'court', title: COURT_ORDER + (S.caseNo ? ' คดีหมายเลขดำที่ ' + S.caseNo : ''), outcome: COURT_ORDER, detail: S.within ? 'ให้เลิกการชุมนุม' + S.within : '', unit: 'งานสอบสวน', place: 'ศาลแพ่งมีนบุรี', ladder: 'L4' }));
        } else if (kind === 5) {
            log.push(entry({ at: iso, kind: 'court', title: COURT_POST + ' (ม.22 วรรคสี่)', outcome: COURT_POST, detail: (S.posts || []).join(' · '), ladder: 'L5' }));
        } else if (kind === 6) {
            const a = ANN.a23, mins = Number(S.minutes) || 20, due = at + mins * 60000;
            log.push(entry({ at: iso, kind: 'announce', ann: 'a23', law: a.law, minutes: mins, deadlineAt: new Date(due).toISOString(), crowd: crowd,
                title: a.text + ' กำหนดเวลา ' + mins + ' นาที (ครบ ' + hm(due) + ')', detail: 'ขอบเขต: ' + S.area + (crowd ? ' · ผู้ชุมนุมประมาณ ' + crowd + ' คน' : ''), ladder: 'L6' }));
        } else if (kind === 7) {
            if (!(S.acts || []).length) { api.toast('เลือกการดำเนินการอย่างน้อย 1 ข้อ'); return false; }
            log.push(entry({ at: iso, kind: 'arrest', title: 'พ้นกำหนดเวลาพื้นที่ควบคุม — ความผิดซึ่งหน้า (ม.24): ' + S.acts.join(' / '), law: 'ม.24',
                detail: [S.arrests ? 'จับกุม ' + S.arrests + ' คน' : '', S.note].filter(Boolean).join(' · '), unit: 'งานป้องกันปราบปราม/คฝ.', ladder: 'L7' }));
        } else if (kind === 's25') {
            if (!(S.violent || []).length && !S.note) { api.toast('เลือกหรือระบุการกระทำที่รุนแรง'); return false; }
            const acts = (S.violent || []).concat(S.note ? [S.note] : []).join(' / ');
            log.push(entry({ at: new Date(at - 30000).toISOString(), kind: 'violation', law: 'ม.25', title: 'เหตุรุนแรง: ' + acts, unit: 'งานสืบสวน', ladder: 'S25v' }));
            log.push(entry({ at: iso, kind: 'announce', ann: 'a25', law: 'ม.25', title: ANN.a25.text, detail: 'ไม่ต้องรอคำสั่งศาล · ไม่ปฏิบัติตามเข้าสู่ ม.23–24 ได้ทันที · โทษ ม.33', ladder: 'S25' }));
            if (S.toPhase3 && curPhase(sorted(ev)) !== 3) log.push(entry({ at: iso, kind: 'sitrep', phase: 3, title: 'เข้าสู่ระยะที่ 3 ' + PHASES[2].name, detail: 'เหตุรุนแรงตาม ม.25' }));
            if (S.toRed && ev.level !== 'red') { ev.level = 'red'; (ev.levelLog = ev.levelLog || []).push({ at: iso, level: 'red' }); }
            api.save(); api.render(); render(); api.toast('บันทึกคำสั่งยุติเหตุรุนแรง ม.25 แล้ว · ' + hm(at));
            return true;
        }
        api.save(); render();
        api.toast('บันทึกขั้นที่ ' + kind + ' แล้ว · ' + hm(at) + ' (ขึ้นในบันทึก ศปก. ด้วย)');
        return true;
    }

    /* ---------------- สรุปส่ง LINE ---------------- */
    function lineText(ev) {
        const L = sorted(ev), R = stepRecs(L), cur = curPhase(L), now = Date.now();
        const out = ['⚖️ ลำดับการบังคับใช้กฎหมาย (พ.ร.บ.ชุมนุมฯ ม.21–25)', ev.title,
            '📍 ' + (cur ? 'ระยะที่ ' + cur + ' ' + PHASES[cur - 1].name + ' (เริ่ม ' + hm(L.filter((x) => x.phase === cur).pop().at) + ')' : 'ยังไม่ได้บันทึกระยะ'), ''];
        STEPS.forEach((s) => {
            const r = R[s.n];
            if (!r.length) { out.push('⬜ ' + s.n + ') ' + s.name + ' [' + s.law + ']'); return; }
            r.forEach((x, i) => {
                const res = x.deadlineAt ? L.find((y) => y.kind === 'deadline' && y.refId === x.id) : null;
                out.push((i ? '   ' : '✅ ' + s.n + ') ') + hm(x.at) + ' ' + x.title + (res ? ' → ' + res.title + ' (' + hm(res.at) + ')' : ''));
            });
        });
        const s25 = L.filter((x) => x.ann === 'a25');
        if (s25.length) out.push('', '🚨 สั่งยุติเหตุรุนแรง ม.25 เมื่อ ' + hm(s25[s25.length - 1].at));
        const a = openTimer(L);
        if (a) out.push('', '⏱ รอครบกำหนด ' + ((ANN[a.ann] || {}).label || a.law) + ' เวลา ' + hm(a.deadlineAt) + (Date.parse(a.deadlineAt) < now ? ' (ครบกำหนดแล้ว)' : ''));
        out.push('', 'ข้อมูล ณ ' + api.thDateShort(now) + ' ' + api.hmTh(now) + ' · กระดานสถานการณ์ สน.ลำหิน');
        return out.join('\n');
    }

    /* ---------------- ลงทะเบียนแท็บ ---------------- */
    CMD.registerSection({
        id: 'ladder', label: '4 ระยะ · 7 ขั้น', icon: 'fa-stairs', order: 18,
        mount: function (el, A) { api = A; host = el; el.addEventListener('click', onClick); render(); },
        update: function (ev) {   // บันทึกจากแท็บอื่น (เช่น บันทึก ศปก.) → วาดใหม่เมื่อเห็นอยู่
            const L = ev && Array.isArray(ev.log) ? ev.log : [];
            const key = ev ? ev.id + '|' + L.length + '|' + (L.length ? L[L.length - 1].id + L[L.length - 1].at : '') + '|' + ev.level : '';
            if (key !== lastKey && host && !host.hidden) { lastKey = key; render(); }
        },
        visible: function (on) { if (on) { render(); startTimer(); } else stopTimer(); }
    });
})();
