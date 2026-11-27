/* =====================================================================
   กระดานบริหารเหตุการณ์ครบทุกสายงาน (Step 2 · All-Division Operations Board)
   - "สายงาน" อยู่ในแท็บ คู่มือ & เอกสาร › ลำดับปฏิบัติ › สายงาน (registerSection host: 'docs')
   - การ์ด 6 สายงาน: เช็กลิสต์กดแล้วลงเวลา · แถบ % ความคืบหน้า · สถานะ ยังไม่เริ่ม / กำลังปฏิบัติ / เสร็จสิ้น
   - งานสอบสวน: ผังกำลังพลที่สั่งการจริง (ชื่อทางการตามข้อมูลกำลังพล สน.ลำหิน 2569) + รายงานตัว
     และสลับดู "คณะพนักงานสอบสวน 6 ชุด" กรณีสถานการณ์ขยายตัว (แนวทาง บช.น.)
   - ข้อมูลเก็บใน ev.ops (ไปกับ Export JSON ของกระดาน):
     { checks: {itemId: iso}, custom: {divId: [{id, t}]}, roster: {personId: iso}, slots: [4 ชื่อ],
       teams: {teamId: {lead, on}}, heads: {divId: {name, pos, phone}} }
   - เช็กข้อ "ส่งหนังสือ ม.11" = ติ๊ก "ดำเนินการแล้ว" ของแถบเส้นตาย ม.11 ในหน้าภาพรวมด้วย (ข้อมูลชุดเดียวกัน)
   ===================================================================== */
(function () {
    'use strict';
    const CMD = window.LamhinCmd;
    if (!CMD || typeof CMD.registerSection !== 'function') return;

    const SRC = (document.currentScript && document.currentScript.src) || '';
    const BASE = SRC.replace(/[^/]*(\?.*)?$/, '');
    const VER = ((SRC.match(/[?&]v=([^&]+)/) || [])[1] || '1') + '.4';   // เลขหลังจุด: เพิ่มทุกครั้งที่แก้ cmdops.css
    const UI_KEY = 'lamhin_cmd_ops_ui';
    (function () {
        if (document.querySelector('link[data-opscss]')) return;
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + 'cmdops.css?v=' + VER; l.setAttribute('data-opscss', '');
        document.head.appendChild(l);
    })();

    /* ---------------- แม่แบบสายงาน ---------------- */
    // item: [id, ข้อความ, คำอธิบายย่อย, ป้ายกำกับ (เช่น เส้นตาย), id แถบแจ้งเตือนที่ผูกกัน]
    const ASSEMBLY = [
        {
            id: 'cmd', short: 'ศปก.', name: 'ศปก. / บังคับบัญชา', icon: 'fa-tower-broadcast',
            head: { name: 'พ.ต.อ.สุขสันต์ แสนสวัสดิ์', pos: 'รรท.ผกก.สน.ลำหิน · ผบ.เหตุการณ์', phone: '084-881-5353' },
            items: [
                ['cmd-1', 'ปล่อยแถวหน้า สน.', 'ชี้แจงภารกิจ/ข้อกฎหมาย', '04.30 น.'],
                ['cmd-2', 'ตั้ง ศปก.ส่วนหน้า ลานจอดรถมัสยิด', 'ตรงข้ามจุดชุมนุม'],
                ['cmd-3', 'ช่องทางสื่อสาร: วิทยุ / LINE'],
                ['cmd-4', 'พบผู้จัดและผู้ประสานงาน', 'ย้ำ ม.11 · ห้ามโทรโข่ง 05–06 น. · เลิก 18.00 น.'],
                ['cmd-5', 'รายงาน บก.น.3 เป็นระยะ'],
                ['cmd-6', 'สรุปผล / ปิดภารกิจ', 'หลัง 18.00 น.']
            ]
        },
        {
            id: 'pro', short: 'ป./คฝ.', name: 'ป้องกันปราบปราม / คฝ.', icon: 'fa-shield-halved',
            head: { name: 'พ.ต.ท.รัติศัย นิลน้อย', pos: 'รอง ผกก.ป.สน.ลำหิน · ผู้รับกำลัง คฝ.', phone: '088-553-2610' },
            items: [
                ['pro-1', 'หนังสือเรียน บก.น.3'],
                ['pro-2', 'ส่งหนังสือเงื่อนไข ม.11 ให้ผู้แจ้ง (มีเซ็นรับ)', '', 'ก่อน 27 พ.ย. 14.00 น.', 'al-m11'],
                ['pro-3', 'แจ้งเขต / ประชาสัมพันธ์', 'ม.19 ว.1 · ม.20'],
                ['pro-4', 'คำสั่งจัดกำลัง'],
                ['pro-5', 'คฝ. สน.ลำหิน 1 หมู่ ดูแลการชุมนุม'],
                ['pro-6', 'รับ คฝ. บก.น.3 1 หมวด', 'สแตนด์บายที่ สน. หนุนใน 30 นาที']
            ]
        },
        {
            id: 'inv', short: 'สืบสวน', name: 'งานสืบสวน', icon: 'fa-user-secret',
            head: { name: 'พ.ต.ท.ไพโรจน์ รุกขพันธ์', pos: 'รอง ผกก.สส.สน.ลำหิน', phone: '081-816-8637' },
            items: [
                ['inv-1', 'หาข่าว ก่อน–ขณะ–หลังชุมนุม'],
                ['inv-2', 'ภาพ/คลิปครบ 3 ช่วง', 'มุมกว้าง (ผิวจราจร/จำนวนคน) + มุมเจาะรายบุคคล'],
                ['inv-3', 'คลิป Uncut ขณะเจรจา/อ่านประกาศ', 'มีเสียง-เวลาจริง เห็นผู้อ่านกับผู้ชุมนุมในเฟรมเดียว'],
                ['inv-4', 'เก็บไฟล์ Original (ห้ามลบ ห้ามส่งแค่ LINE)'],
                ['inv-5', 'รายงานเป็นระยะ · ส่งรายงานสืบสวนให้ พงส.']
            ]
        },
        {
            id: 'tra', short: 'จราจร', name: 'งานจราจร', icon: 'fa-traffic-light',
            head: { name: 'พ.ต.ท.สุจิตร ศิริราช', pos: 'รอง ผกก.จร.สน.ลำหิน', phone: '081-782-9997' },
            items: [
                ['tra-1', 'อำนวยการจราจรปากซอย / ถนนคู้-คลองสิบ'],
                ['tra-2', 'รถผู้ชุมนุม ~10 คัน ไม่กีดขวางผิวจราจร'],
                ['tra-3', 'รายงานสภาพจราจรเป็นระยะ'],
                ['tra-4', 'พยานผลกระทบการสัญจร', 'ใช้ประกอบคำร้องศาล']
            ]
        },
        {
            id: 'adm', short: 'อำนวยการ', name: 'งานอำนวยการ', icon: 'fa-utensils',
            head: { name: 'พ.ต.ท.เอกพล สุทธิรักษ์', pos: 'สว.อก.สน.ลำหิน', phone: '081-645-7484' },
            items: [
                ['adm-1', 'อาหาร/น้ำ ชุดปล่อยแถว', '', '04.30 น.'],
                ['adm-2', 'อาหารกลางวัน/น้ำดื่มหน้างาน'],
                ['adm-3', 'สวัสดิการกำลังพลจนจบภารกิจ'],
                ['adm-4', 'ตรวจทรัพย์สินราชการที่นำออก', 'รถสายตรวจ / อุปกรณ์ คฝ.']
            ],
            note: 'ทรัพย์สินราชการเสียหาย: สว.อก. เป็นผู้กล่าวหา · พลขับ/จนท. เป็นพยาน'
        },
        {
            id: 'qa', short: 'สอบสวน', name: 'งานสอบสวน', icon: 'fa-scale-balanced', wide: true,
            head: { name: 'พ.ต.ท.อัคเดช ลัดดาวัลย์', pos: 'รอง ผกก.(สอบสวน)สน.ลำหิน · ที่ปรึกษากฎหมาย ผบ.เหตุการณ์', phone: '085-556-3955' },
            items: [
                ['qa-1', 'ชี้แจงข้อกฎหมาย/การเก็บพยานหลักฐาน', '', '04.30 น.'],
                ['qa-2', 'แฟ้มเอกสารแนบคำร้องศาล 6 รายการ'],
                ['qa-3', 'ตรวจเบอร์เวรไต่สวนฉุกเฉินศาล (วันเสาร์)'],
                ['qa-4', 'รถไปศาล + โน้ตบุ๊ก / เครื่องพิมพ์ / Flash Drive'],
                ['qa-5', 'ส่งมอบเวร', 'ร.ต.ท.สัญญา พนมกุล → ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', '08.00 น.']
            ]
        }
    ];
    // เหตุการณ์ประเภทอื่น: เช็กลิสต์ทั่วไป (เพิ่มรายการเองได้ทุกสายงาน)
    const GENERIC_ITEMS = {
        cmd: [['g-cmd-1', 'ชี้แจงภารกิจ / ปล่อยแถว'], ['g-cmd-2', 'ตั้งจุดบัญชาการ'], ['g-cmd-3', 'กำหนดช่องทางสื่อสาร'], ['g-cmd-4', 'รายงานผู้บังคับบัญชาเป็นระยะ'], ['g-cmd-5', 'สรุปผล / ปิดภารกิจ']],
        pro: [['g-pro-1', 'คำสั่งจัดกำลัง'], ['g-pro-2', 'ประจำจุดตามแผน'], ['g-pro-3', 'ประสานหน่วยสนับสนุน']],
        inv: [['g-inv-1', 'หาข่าว / ประเมินสถานการณ์'], ['g-inv-2', 'เก็บภาพ/คลิปหลักฐาน'], ['g-inv-3', 'รายงานเป็นระยะ']],
        tra: [['g-tra-1', 'วางแผนเส้นทาง / จุดปิดกั้น'], ['g-tra-2', 'อำนวยการจราจร'], ['g-tra-3', 'รายงานสภาพจราจร']],
        adm: [['g-adm-1', 'อาหาร / น้ำดื่ม'], ['g-adm-2', 'ยานพาหนะ / อุปกรณ์'], ['g-adm-3', 'สวัสดิการกำลังพล']],
        qa: [['g-qa-1', 'จัดเวร พงส. รองรับ'], ['g-qa-2', 'เตรียมแบบฟอร์ม / แฟ้มคดี'], ['g-qa-3', 'พร้อมรับตัวผู้ต้องหา / ของกลาง']]
    };

    // ผังกำลังงานสอบสวนที่สั่งการไว้ (ยศ ชื่อ-สกุล ตำแหน่ง ตามข้อมูลกำลังพล สน.ลำหิน 2569)
    const ROSTER = [
        { id: 'r1', plan: 'akd', name: 'พ.ต.ท.อัคเดช ลัดดาวัลย์', pos: 'รอง ผกก.(สอบสวน)สน.ลำหิน', phone: '085-556-3955', role: 'หัวหน้างานสอบสวน · ที่ปรึกษากฎหมาย', time: '04.30 น. เป็นต้นไป', duty: 'ชี้แจงข้อกฎหมาย · ตรวจถ้อยคำประกาศ ม.21/23/25 · ประสานศาล/อัยการ' },
        { id: 'r2', plan: 'sny', name: 'ร.ต.ท.สัญญา พนมกุล', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '084-511-2120', role: 'พงส.เวรเช้า', time: '04.30–08.00 น.', duty: 'เฝ้าช่วงห้ามโทรโข่ง 05–06 น. · บันทึกเหตุการณ์ · ส่งเวร 08.00 น.' },
        { id: 'r3', plan: 'pnc', name: 'ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '083-087-2512', role: 'พงส.เวรหลัก · ตรวจที่เกิดเหตุ', time: '08.00 น. จนเสร็จภารกิจ', duty: 'ตรวจที่เกิดเหตุคู่กับสอบผู้กล่าวหา (ชุดเดียวกัน) · ดูคดีเวรปกติ' },
        { id: 'r4', plan: 'npn', name: 'ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '086-396-9161', role: 'เอกสาร · สอบปากคำ', time: 'ตลอดภารกิจ (ประจำ สน.)', duty: 'ประกาศ / คำร้องศาล / รายงานเหตุ · ช่วยสอบปากคำ' },
        { id: 'r5', plan: 'cyc', name: 'ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '085-290-1659', role: 'สแตนด์บายเสริม (เจ้าของเรื่อง ปจว.ข้อ 3)', time: 'พร้อมเรียกตัว', duty: 'เข้าช่วยเมื่อยกระดับ มีเหตุรุนแรง หรือมีการจับกุม' },
        { id: 'r6', plan: 'asst', group: true, name: 'ผบ.หมู่(ผช.พงส.)สน.ลำหิน 4 นาย', pos: 'ธุรการ · ยานพาหนะ · ประสานศาล', role: 'สแตนด์บาย', time: 'ตลอดภารกิจ', duty: 'ขับรถไปศาล เดินเอกสาร เตรียมแฟ้ม/อุปกรณ์' }
    ];
    const ASSISTANTS = [
        ['ส.ต.ท.นนทิวัฒน์ สิงห์อ่อน', '092-380-9962'], ['ส.ต.ท.สุทัศน์ ขุนทอง', '094-358-1786'], ['ส.ต.ต.กิตติศักดิ์ บุญสม', '062-129-4010'],
        ['ส.ต.ต.ธณต ตัณฑะผลิน', '093-935-0094'], ['ส.ต.ต.อัครพัชร์ ปอสร้อยเจริญ', '063-154-6945'], ['ส.ต.ต.ธีรสรรค พรหมพิทักษ์', '096-235-9110'], ['ส.ต.ต.อลีฟ บือซา', '092-634-4436']
    ];
    const INVESTIGATORS = ['พ.ต.ท.อัคเดช ลัดดาวัลย์', 'พ.ต.ท.สุวเมธ เนื่องขันตรี', 'ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', 'ร.ต.อ.คิมหันฐ์ ศรีสุพรรณ์', 'ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์', 'ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์', 'ร.ต.ท.สัญญา พนมกุล', 'ขอกำลังเสริมจาก บก.น.3'];
    // คณะพนักงานสอบสวน 6 ชุด (แนวทาง บช.น. กรณีสถานการณ์ขยายตัว)
    const TEAMS = [
        { id: 't1', name: 'ตรวจที่เกิดเหตุ + สอบผู้กล่าวหา', sub: 'ชุดเดียวกัน ให้ชี้จุดสอดคล้อง', def: 'ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ' },
        { id: 't2', name: 'สอบพยานภายนอก', sub: 'กฟน. เขต แพทย์ กู้ภัย สื่อ ประชาชน', def: '' },
        { id: 't3', name: 'ศาล: ผัดฟ้อง-ฝากขัง ประกัน ฟ้องวาจา', sub: 'ติดตามกำหนดทุกผลัด', def: 'ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์' },
        { id: 't4', name: 'คลิป / ของกลาง / รถตรวจยึด', sub: 'ปรับบทรายบุคคล · ตรวจประวัติ', def: '' },
        { id: 't5', name: 'รายงานเหตุ / ธุรการคดี', sub: 'บก.น.3 / บช.น. · คุมเอกสารแนบศาล', def: '' },
        { id: 't6', name: 'สรุปสำนวน / ประสานอัยการ', sub: 'เตรียมแผนกรณีกลับคำให้การ', def: 'ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์' }
    ];
    const ST = { todo: 'ยังไม่เริ่ม', doing: 'กำลังปฏิบัติ', done: 'เสร็จสิ้น' };
    // เอกสารแนบท้ายคำร้องศาลแพ่งมีนบุรี 6 รายการ (เลขตรงกับคำร้องในแท็บ "คู่มือ & เอกสาร")
    const ATTACH = [
        ['att-1', 'สำเนาคำสั่งแต่งตั้ง รรท.ผกก.', 'ฐานะเจ้าพนักงานดูแลฯ (ม.19)'],
        ['att-2', 'สำเนาหนังสือแจ้งการชุมนุม 26 พ.ย. 69', ''],
        ['att-3', 'สำเนา ปจว.ข้อ 3 (EV60026256900637SJ)', ''],
        ['att-4', 'สำเนาหนังสือเงื่อนไข ม.11 + เซ็นรับ · หนังสือแจ้งเขต', ''],
        ['att-5', 'ภาพถ่ายสี A4 · แผนที่สังเขป · คลิป (Flash Drive/CD)', ''],
        ['att-6', 'ต้นฉบับประกาศ ม.21 + คลิป Uncut', 'เห็นเวลาประกาศและเวลาครบกำหนด']
    ];

    /* ---------------- สถานะ ---------------- */
    let api = null, host = null, lastKey = '';
    let ui = (function () { try { return JSON.parse(localStorage.getItem(UI_KEY) || 'null') || {}; } catch (e) { return {}; } })();
    ui.open = ui.open || {};
    function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ไม่จำก็ได้ */ } }
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tel = (p) => 'tel:' + String(p || '').replace(/[^0-9+]/g, '');
    const isAssembly = (ev) => ev && (ev.category === 'ชุมนุมสาธารณะ' || ev.id === 'ev-20261128-lamjedee');

    function ops(ev) {
        ev.ops = ev.ops && typeof ev.ops === 'object' ? ev.ops : {};
        const o = ev.ops;
        o.checks = o.checks || {}; o.custom = o.custom || {}; o.roster = o.roster || {};
        o.slots = Array.isArray(o.slots) ? o.slots : ['', '', '', ''];
        o.teams = o.teams || {}; o.heads = o.heads || {};
        return o;
    }
    function divisions(ev) {
        const o = ops(ev), asm = isAssembly(ev);
        return ASSEMBLY.map((d) => {
            const base = asm ? d.items : GENERIC_ITEMS[d.id];
            const items = base.map((it) => ({ id: it[0], t: it[1], sub: it[2] || '', tag: it[3] || '', alert: it[4] || '', custom: false }))
                .concat((o.custom[d.id] || []).map((c) => ({ id: c.id, t: c.t, sub: '', tag: '', alert: '', custom: true })));
            items.forEach((it) => {
                const al = it.alert && (ev.alerts || []).find((a) => a.id === it.alert);
                it.at = o.checks[it.id] || (al && al.done ? (al.doneAt || 'yes') : '');
                if (it.id === 'qa-2' && asm) {
                    const got = ATTACH.filter((a) => o.checks[a[0]]);
                    it.sub = 'ครบ ' + got.length + '/6 · ติ๊กที่หัวข้อเอกสารแนบ';
                    if (!it.at && got.length === ATTACH.length) it.at = got.map((a) => o.checks[a[0]]).sort().pop();
                }
            });
            const done = items.filter((it) => it.at).length;
            const pct = items.length ? Math.round(done / items.length * 100) : 0;
            const st = !done ? 'todo' : done === items.length ? 'done' : 'doing';
            return Object.assign({}, d, { head: Object.assign({}, d.head, o.heads[d.id] || {}), items: items, done: done, pct: pct, st: st, note: asm ? d.note : '' });
        });
    }
    function when(iso) { if (!iso || iso === 'yes') return '✓'; const t = Date.parse(iso); return isNaN(t) ? '✓' : api.hmTh(t); }

    /* ---------------- วาดหน้าจอ ---------------- */
    function render() {
        if (!host || !api) return;
        const ev = api.active();
        if (!ev) { host.innerHTML = '<section class="cmd-card"><div class="cmd-empty"><i class="fa-solid fa-sitemap"></i>ยังไม่มีเหตุการณ์ — เพิ่มเหตุการณ์ที่แถบด้านบนก่อน</div></section>'; return; }
        const divs = divisions(ev), o = ops(ev);
        const total = divs.reduce((s, d) => s + d.items.length, 0), done = divs.reduce((s, d) => s + d.done, 0);
        const pct = total ? Math.round(done / total * 100) : 0;
        const cnt = { todo: 0, doing: 0, done: 0 }; divs.forEach((d) => { cnt[d.st]++; });
        // แสดงทีละสายงาน (แท็บ) — ค่าเริ่มต้น: สายงานแรกที่ยังไม่เสร็จ
        if (!ASSEMBLY.some((d) => d.id === ui.div)) ui.div = (divs.find((d) => d.st !== 'done') || divs[0]).id;
        const C = 2 * Math.PI * 42;
        let html = '<section class="cmd-card">' +
            '<div class="ops-sum">' +
                '<div class="ops-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,178,222,.15)" stroke-width="10"/>' +
                '<circle cx="50" cy="50" r="42" fill="none" stroke="#D4AF37" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><b>' + pct + '%</b></div>' +
                '<div class="ops-sum-txt"><h4>ความพร้อมทุกสายงาน</h4><p>' + done + '/' + total + ' รายการ · แตะเพื่อติ๊ก (ลงเวลาให้)</p>' +
                    '<div class="ops-counts"><span><i style="background:#16A34A"></i>เสร็จสิ้น ' + cnt.done + '</span><span><i style="background:#F59E0B"></i>กำลังปฏิบัติ ' + cnt.doing + '</span><span><i style="background:#5F7594"></i>ยังไม่เริ่ม ' + cnt.todo + '</span></div></div>' +
                '<div class="ops-sum-btns">' +
                    '<button type="button" class="cmd-btn sm danger" data-op="reset"><i class="fa-solid fa-rotate-left"></i> ล้างการติ๊ก</button>' +
                '</div>' +
            '</div>' +
            '<div class="ops-bars" role="tablist" aria-label="สายงาน">' + divs.map((d) => '<button type="button" role="tab" class="ops-bar' + (d.id === ui.div ? ' on' : '') + '" data-op="seldiv" data-div="' + d.id + '" aria-selected="' + (d.id === ui.div) + '"><i class="fa-solid ' + d.icon + '"></i><span>' + esc(d.short) + '</span><em>' + d.done + '/' + d.items.length + '</em></button>').join('') + '</div>' +
            '</section>';

        html += '<div class="ops-grid one">' + divs.filter((d) => d.id === ui.div).map((d) => divCard(d, ev, o)).join('') + '</div>';
        host.innerHTML = html;
    }
    function divCard(d, ev, o) {
        const open = true;
        let body = '<div class="ops-boss"><i class="fa-solid fa-user-tie"></i><span><b>' + esc(d.head.name) + '</b><small>' + esc(d.head.pos) + '</small></span>' +
            (d.head.phone ? '<a class="ops-call" href="' + esc(tel(d.head.phone)) + '"><i class="fa-solid fa-phone"></i> ' + esc(d.head.phone) + '</a>' : '') +
            '<button type="button" class="ops-ico" data-op="head" data-div="' + d.id + '" title="แก้ไขหัวหน้าสายงาน" aria-label="แก้ไขหัวหน้าสายงาน"><i class="fa-solid fa-pen"></i></button></div>';
        body += '<ul class="ops-list">' + d.items.map((it) =>
            '<li style="display:flex;gap:4px;align-items:flex-start"><button type="button" class="ops-item' + (it.at ? ' on' : '') + '" data-op="check" data-item="' + esc(it.id) + '" aria-pressed="' + (!!it.at) + '">' +
                '<span class="ops-box"><i class="fa-solid fa-check"></i></span>' +
                '<span class="ops-item-txt">' + esc(it.t) + (it.tag ? '<span class="ops-tag">' + esc(it.tag) + '</span>' : '') + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
                (it.at ? '<span class="ops-when">' + esc(when(it.at)) + '</span>' : '') + '</button>' +
                (it.custom ? '<button type="button" class="ops-del" data-op="del" data-div="' + d.id + '" data-item="' + esc(it.id) + '" title="ลบรายการ" aria-label="ลบรายการ"><i class="fa-solid fa-xmark"></i></button>' : '') +
            '</li>').join('') + '</ul>';
        body += '<form class="ops-add" data-op="add" data-div="' + d.id + '"><input type="text" maxlength="160" placeholder="เพิ่มรายการของ' + esc(d.short) + '…" aria-label="เพิ่มรายการ"><button type="submit" class="cmd-btn sm neon"><i class="fa-solid fa-plus"></i> เพิ่ม</button></form>';
        if (d.note) body += '<div class="ops-note"><i class="fa-solid fa-circle-info"></i><span>' + esc(d.note) + '</span></div>';
        if (d.id === 'qa' && isAssembly(ev)) body += qaExtra(o);
        return '<section class="cmd-card ops-div' + (d.wide ? ' ops-wide' : '') + (open ? ' open' : '') + '" data-st="' + d.st + '" id="ops-' + d.id + '">' +
            '<div class="ops-head">' +
                '<span class="ops-head-ic"><i class="fa-solid ' + d.icon + '"></i></span>' +
                '<span class="ops-head-txt"><b>' + esc(d.name) + '</b><small>' + esc(d.head.name) + ' · ' + esc(d.head.pos.split(' · ')[0]) + '</small></span>' +
                '<span class="ops-pill">' + ST[d.st] + '</span></div>' +
            '<div class="ops-prog"><i style="width:' + d.pct + '%"></i></div>' +
            '<div class="ops-prog-lb"><span>ความคืบหน้า ' + d.pct + '%</span><span>' + d.done + '/' + d.items.length + ' รายการ</span></div>' +
            '<div class="ops-body">' + body + '</div></section>';
    }
    function qaExtra(o) {
        const got = ATTACH.filter((a) => o.checks[a[0]]).length;
        let h = '<div class="ops-sub">' +
            '<div class="ops-sub-h"><i class="fa-brands fa-line"></i><b>แจ้งกลุ่ม LINE งานสอบสวน</b></div>' +
            '<p class="ops-hint">สรุปเหตุการณ์ + ผังกำลัง พร้อมวางในกลุ่ม</p>' +
            '<button type="button" class="cmd-btn line sm" data-op="grpline"><i class="fa-brands fa-line"></i> คัดลอกข้อความ</button></div>';
        h += '<div class="ops-sub">' +
            '<div class="ops-sub-h"><i class="fa-solid fa-folder-open"></i><b>เอกสารแนบคำร้องศาล</b><em>' + got + '/6</em>' +
            '<button type="button" class="cmd-btn sm" data-op="tab" data-tab="docs"><i class="fa-solid fa-gavel"></i> ร่างคำร้อง</button></div>' +
            '<ul class="ops-list">' + ATTACH.map((a, i) => {
                const at = o.checks[a[0]];
                return '<li><button type="button" class="ops-item' + (at ? ' on' : '') + '" data-op="att" data-item="' + a[0] + '" aria-pressed="' + (!!at) + '">' +
                    '<span class="ops-box"><i class="fa-solid fa-check"></i></span><span class="ops-item-txt">' + (i + 1) + '. ' + esc(a[1]) + (a[2] ? '<small>' + esc(a[2]) + '</small>' : '') + '</span>' +
                    (at ? '<span class="ops-when">' + esc(when(at)) + '</span>' : '') + '</button></li>';
            }).join('') + '</ul></div>';
        // ผังกำลัง/รายงานตัว ย้ายไปรวมกับ "รายคน" ในลำดับปฏิบัติ (ข้อมูลชุดเดิม ev.ops.roster / slots)
        const inCount = ROSTER.filter((p) => o.roster[p.id]).length;
        h += '<div class="ops-sub">' +
            '<div class="ops-sub-h"><i class="fa-solid fa-id-badge"></i><b>ผังกำลัง / รายงานตัว</b><em>' + inCount + '/' + ROSTER.length + '</em>' +
            '<button type="button" class="cmd-btn sm" data-op="people"><i class="fa-solid fa-users"></i> เปิดรายคน</button></div>' +
            '<p class="ops-hint">กดรายงานตัวและเลือก ผช.พงส. 4 นาย ได้ที่ ลำดับปฏิบัติ › รายคน</p></div>';
        h += '<div class="ops-sub"><div class="ops-sub-h"><i class="fa-solid fa-people-group"></i><b>คณะ พงส. 6 ชุด (ถ้าขยายตัว)</b></div>' +
            '<p class="ops-hint">เกินกำลังเวร → ขอตั้งคณะ · เลือกหัวหน้าชุดแล้วติ๊ก</p>';
        h += '<div class="ops-teams">' + TEAMS.map((t, i) => {
            const st = o.teams[t.id] || {}, lead = st.lead !== undefined ? st.lead : t.def;
            const opts = [''].concat(INVESTIGATORS);
            if (lead && opts.indexOf(lead) === -1) opts.push(lead);
            return '<div class="ops-team' + (st.on ? ' on' : '') + '">' +
                '<div class="ops-team-h"><b>' + (i + 1) + '</b><span>' + esc(t.name) + '<small>' + esc(t.sub) + '</small></span></div>' +
                '<select data-op="lead" data-team="' + t.id + '" aria-label="หัวหน้าชุดที่ ' + (i + 1) + '">' + opts.map((n) => '<option value="' + esc(n) + '"' + (n === lead ? ' selected' : '') + '>' + (n ? esc(n) : '— ยังไม่กำหนดหัวหน้าชุด —') + '</option>').join('') + '</select>' +
                '<button type="button" class="ops-in" data-op="team" data-team="' + t.id + '"><i class="fa-' + (st.on ? 'solid fa-circle-check' : 'regular fa-circle') + '"></i> ' + (st.on ? 'ตั้งชุดแล้ว ' + esc(when(st.on)) : 'ตั้งชุดแล้ว') + '</button></div>';
        }).join('') + '</div>';
        h += '</div>';
        return h;
    }

    /* ---------------- การกระทำ ---------------- */
    function commit() { api.save(); render(); }
    function onClick(e) {
        const b = e.target.closest('[data-op]');
        if (!b || !host.contains(b) || b.tagName === 'FORM' || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
        const ev = api.active(); if (!ev) return;
        const o = ops(ev), op = b.dataset.op, now = new Date().toISOString();
        if (op === 'seldiv') { ui.div = b.dataset.div; saveUi(); render(); return; }
        if (op === 'people') { if (window.LamhinDocs && window.LamhinDocs.plan) window.LamhinDocs.plan('person'); return; }
        if (op === 'check') {
            const id = b.dataset.item, d = divisions(ev).find((x) => x.items.some((it) => it.id === id));
            const it = d && d.items.find((x) => x.id === id); if (!it) return;
            const on = !it.at;
            if (on) o.checks[id] = now; else delete o.checks[id];
            if (it.alert) { const al = (ev.alerts || []).find((a) => a.id === it.alert); if (al) { al.done = on; al.doneAt = on ? now : ''; } }
            commit(); return;
        }
        if (op === 'del') {
            const list = o.custom[b.dataset.div] || [];
            o.custom[b.dataset.div] = list.filter((c) => c.id !== b.dataset.item); delete o.checks[b.dataset.item];
            commit(); return;
        }
        if (op === 'att') { const id = b.dataset.item; if (o.checks[id]) delete o.checks[id]; else o.checks[id] = now; commit(); return; }
        if (op === 'tab') {   // เปิดร่างคำร้องศาลในแท็บเดียวกัน (มุมมองหนังสือ)
            if (b.dataset.tab === 'docs' && window.LamhinDocs && window.LamhinDocs.open) window.LamhinDocs.open('petition');
            else api.openTab(b.dataset.tab);
            return;
        }
        if (op === 'grpline') { api.copyText(groupLine(ev)); return; }
        if (op === 'team') { const t = o.teams[b.dataset.team] = o.teams[b.dataset.team] || {}; if (t.lead === undefined) t.lead = (TEAMS.find((x) => x.id === b.dataset.team) || {}).def || ''; t.on = t.on ? '' : now; commit(); return; }
        if (op === 'head') { headForm(ev, b.dataset.div); return; }
        if (op === 'reset') {
            if (!window.confirm('ล้างการติ๊กเช็กลิสต์ การรายงานตัว และสถานะคณะทำงานของเหตุการณ์นี้ทั้งหมด?\n(รายการที่เพิ่มเองและชื่อ ผช.พงส. ยังอยู่)')) return;
            o.checks = {}; o.roster = {}; Object.keys(o.teams).forEach((k) => { o.teams[k].on = ''; });
            commit(); api.toast('ล้างการติ๊กแล้ว'); return;
        }
    }
    function onSubmit(e) {
        const f = e.target.closest('form[data-op="add"]'); if (!f || !host.contains(f)) return;
        e.preventDefault();
        const ev = api.active(); if (!ev) return;
        const inp = f.querySelector('input'), t = String(inp.value || '').trim(); if (!t) return;
        const o = ops(ev), div = f.dataset.div;
        (o.custom[div] = o.custom[div] || []).push({ id: 'c-' + div + '-' + Date.now().toString(36), t: t });
        ui.open[div] = true; saveUi(); commit();
        const again = host.querySelector('form[data-div="' + div + '"] input'); if (again && window.innerWidth >= 860) again.focus();
    }
    function onChange(e) {
        const el = e.target; if (!host.contains(el)) return;
        const ev = api.active(); if (!ev) return;
        const o = ops(ev);
        if (el.dataset.op === 'lead') { const t = o.teams[el.dataset.team] = o.teams[el.dataset.team] || {}; t.lead = el.value; api.save(); }
    }
    function headForm(ev, divId) {
        const d = divisions(ev).find((x) => x.id === divId); if (!d) return;
        const o = ops(ev);
        api.modal({
            title: 'หัวหน้าสายงาน: ' + d.name, icon: 'fa-user-tie',
            body: '<div class="cmd-form">' + api.field('ยศ ชื่อ-สกุล', 'name', d.head.name, 'text', { cls: 'full' }) + api.field('ตำแหน่ง / บทบาท', 'pos', d.head.pos, 'text', { cls: 'full' }) + api.field('โทรศัพท์', 'phone', d.head.phone, 'tel', { cls: 'full', mode: 'tel' }) + '</div>',
            actions: [
                { label: 'ใช้ค่าตั้งต้น', run: (close) => { delete o.heads[divId]; commit(); close(); } },
                { label: 'ยกเลิก', run: (close) => close() },
                { label: '<i class="fa-solid fa-floppy-disk"></i> บันทึก', cls: 'gold', run: (close, box) => { o.heads[divId] = { name: api.formVal(box, 'name'), pos: api.formVal(box, 'pos'), phone: api.formVal(box, 'phone') }; commit(); close(); } }
            ]
        });
    }

    /* ---------------- ข้อความแจ้งกลุ่ม LINE งานสอบสวน (ผังกำลังชื่อทางการ) ---------------- */
    function groupLine(ev) {
        const o = ops(ev), s = api.startOf(ev);
        const day = s ? api.thDateLong(s) : '';
        const L = ['📢 แจ้งเตรียมกำลังงานสอบสวน | ภารกิจดูแลการชุมนุมสาธารณะ',
            (day ? day + ' ' : '') + '(ปล่อยแถว ' + api.hmStr(ev.muster) + ' ' + (ev.musterLabel || 'หน้า สน.ลำหิน').replace(/^รวมพล\/ปล่อยแถว\s*/, '') + ')', '',
            '🔹 สรุปเหตุการณ์',
            '• ' + ev.title,
            '• วันเวลา/สถานที่: ' + api.hmStr(ev.start) + '–' + api.hmStr(ev.end) + ' ณ ' + (ev.place || '-')];
        if (ev.crowd) L.push('• รูปแบบ: ' + ev.crowd);
        if (ev.ref) L.push('• หลักฐานรับแจ้ง: ' + ev.ref);
        if (isAssembly(ev)) L.push('• จุดเสี่ยง: ช่วงการไฟฟ้าเข้าจั้มไฟ อาจปิดถนนหรือขัดขวางการทำงาน (ม.31 วรรคสอง โทษผู้จัดจำคุกไม่เกิน 10 ปี)');
        L.push('', '🔹 การจัดกำลังงานสอบสวน');
        ROSTER.forEach((p) => {
            if (p.group) {
                const names = o.slots.filter(Boolean);
                L.push('• ' + p.name + (names.length ? ' (' + names.join(', ') + ')' : '') + ': ' + p.role + ' ' + p.time + ' — ' + p.duty);
            } else L.push('• ' + p.name + ' ' + p.pos + ' โทร. ' + p.phone + ': ' + p.role + ' ' + p.time);
        });
        const got = ATTACH.filter((a) => o.checks[a[0]]).length;
        L.push('', '🔹 การเตรียมตัวก่อนเริ่มภารกิจ',
            '1. ธุรการ: เตรียมแฟ้มเอกสารแนบคำร้องศาล 6 รายการ (พร้อมแล้ว ' + got + '/6) ไฟล์ร่างคำร้อง/ประกาศ ตรวจรถไปศาลแพ่งมีนบุรี และเบอร์เวรไต่สวนฉุกเฉิน',
            '2. จุดเน้นกฎหมายหน้างาน: ห้ามใช้โทรโข่ง 05.00–06.00 น. (ม.15(6)) · เฝ้าระวังการปิดถนน/ขัดขวางระบบส่งกระแสไฟฟ้า (ม.31 ว.2) · เลิกตามแจ้ง ' + api.hmStr(ev.end),
            '3. มีเหตุ/ฝ่าฝืน: ประสานสืบสวนเก็บคลิปครบทุกขั้น (เจรจา–ประกาศ–ครบกำหนด) ตรวจที่เกิดเหตุควบคู่สอบผู้กล่าวหา และรายงานเหตุเป็นระยะ',
            '4. ศปก.ส่วนหน้า: ลานจอดรถมัสยิดดารุ้ลมุกร้อดรอบีน (ตรงข้ามจุดชุมนุม)');
        const ll = String(ev.latlng || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (ll) L.push('📍 พิกัดจุดชุมนุม ' + ll[1] + ', ' + ll[2] + ' · https://www.google.com/maps/search/?api=1&query=' + ll[1] + ',' + ll[2]);
        return L.join('\n');
    }


    // ให้ ลำดับปฏิบัติ › รายคน (cmddocs.js) ใช้ผังกำลัง/รายงานตัวชุดเดียวกัน
    window.LamhinOps = {
        roster: () => ROSTER.map((p) => ({ id: p.id, plan: p.plan, group: !!p.group })),
        assistants: () => ASSISTANTS.map((a) => ({ name: a[0], phone: a[1] })),
        state: (ev) => { const o = ops(ev); return { roster: o.roster, slots: o.slots }; },
        checkIn: (ev, rid) => { const o = ops(ev); if (o.roster[rid]) delete o.roster[rid]; else o.roster[rid] = new Date().toISOString(); CMD.save(); },
        setSlot: (ev, i, name) => { const o = ops(ev); o.slots[i] = String(name || '').trim(); CMD.save(); }
    };

    /* ---------------- ลงทะเบียนแท็บ ---------------- */
    CMD.registerSection({
        id: 'ops', label: 'สายงาน', icon: 'fa-sitemap', order: 15, host: 'docs',
        mount: function (el, A) {
            api = A; host = el;
            el.addEventListener('click', onClick);
            el.addEventListener('submit', onSubmit);
            el.addEventListener('change', onChange);
            render();
        },
        update: function (ev) {   // เปลี่ยนเหตุการณ์/ข้อมูลจากแท็บอื่น (เช่น ติ๊ก ม.11 ในหน้าภาพรวม) → วาดใหม่เมื่อเห็นอยู่
            const key = ev ? ev.id + '|' + JSON.stringify(ev.ops || {}).length + '|' + (ev.alerts || []).map((a) => a.done ? 1 : 0).join('') : '';
            if (key !== lastKey && host && !host.hidden) { lastKey = key; render(); }
        },
        visible: function (on) { if (on) render(); }
    });
})();
