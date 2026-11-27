/* =====================================================================
   กระดานบริหารเหตุการณ์ครบทุกสายงาน (Step 2 · All-Division Operations Board)
   - แท็บ "สายงาน" เสียบผ่าน LamhinCmd.registerSection (ไม่แก้ cmd.js)
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
    const VER = ((SRC.match(/[?&]v=([^&]+)/) || [])[1] || '1') + '.2';   // เลขหลังจุด: เพิ่มทุกครั้งที่แก้ cmdops.css
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
            id: 'cmd', short: 'ศปก.', name: 'ศูนย์ควบคุม / บังคับบัญชา (ศปก.)', icon: 'fa-tower-broadcast',
            head: { name: 'พ.ต.อ.สุขสันต์ แสนสวัสดิ์', pos: 'รรท.ผกก.สน.ลำหิน · ผบ.เหตุการณ์', phone: '084-881-5353' },
            items: [
                ['cmd-1', 'นัดรวมพลปล่อยแถว 04.30 น. หน้า สน.ลำหิน', 'ชี้แจงภารกิจและกรอบกฎหมายให้ทุกสายงาน', '04.30 น.'],
                ['cmd-2', 'ตั้ง ศปก.ส่วนหน้า ที่ลานจอดรถมัสยิดดารุ้ลมุกร้อดรอบีน', 'ฝั่งตรงข้ามจุดชุมนุม มองเห็นพื้นที่ทั้งหมด'],
                ['cmd-3', 'กำหนดช่องทางสื่อสาร (วิทยุ / กลุ่ม LINE) และผู้ประสานของแต่ละสายงาน'],
                ['cmd-4', 'พบผู้จัด (นายภูเบศ โพธิ์โซ๊ะ) และผู้ประสานงาน 2 ท่านหน้างาน', 'ย้ำเงื่อนไข ม.11 / ห้ามโทรโข่ง 05.00–06.00 น. / เลิก 18.00 น.'],
                ['cmd-5', 'รายงานสถานการณ์ บก.น.3 เป็นระยะ'],
                ['cmd-6', 'สรุปผลการปฏิบัติ / ปิดภารกิจ', 'หลังเลิกชุมนุมตามแจ้ง 18.00 น.']
            ]
        },
        {
            id: 'pro', short: 'ป./คฝ.', name: 'งานป้องกันปราบปราม (ป.) / คฝ.', icon: 'fa-shield-halved',
            head: { name: 'พ.ต.ท.รัติศัย นิลน้อย', pos: 'รอง ผกก.ป.สน.ลำหิน · ผู้รับกำลัง คฝ.', phone: '088-553-2610' },
            items: [
                ['pro-1', 'ทำหนังสือเรียน บก.น.3 ตาม พ.ร.บ.การชุมนุมสาธารณะฯ'],
                ['pro-2', 'ส่งหนังสือสรุปสาระสำคัญและเงื่อนไข ม.11 ให้ผู้แจ้ง พร้อมหลักฐานเซ็นรับ', '', 'ก่อน 27 พ.ย. 14.00 น.', 'al-m11'],
                ['pro-3', 'หนังสือแจ้งสำนักงานเขต / หน่วยงานประชาสัมพันธ์', 'ม.19 วรรคหนึ่ง และ ม.20'],
                ['pro-4', 'คำสั่งจัดกำลังทุกสายงาน'],
                ['pro-5', 'จัด คฝ. สน.ลำหิน 1 หมู่ ดูแลการชุมนุม'],
                ['pro-6', 'รับกำลัง คฝ. บก.น.3 1 หมวด', 'สแตนด์บายที่ สน.ลำหิน พร้อมหนุนภายใน 30 นาที (ทางรถ ~2.8 กม.)']
            ]
        },
        {
            id: 'inv', short: 'สืบสวน', name: 'งานสืบสวน', icon: 'fa-user-secret',
            head: { name: 'พ.ต.ท.ไพโรจน์ รุกขพันธ์', pos: 'รอง ผกก.สส.สน.ลำหิน', phone: '081-816-8637' },
            items: [
                ['inv-1', 'เกาะติดสถานการณ์ หาข่าวเชิงลึก ก่อน–ขณะ–หลังชุมนุม'],
                ['inv-2', 'เก็บภาพ/คลิปครบ 3 ช่วง (ก่อน–ขณะ–หลัง)', 'มุมกว้างเห็นผิวจราจร/จำนวนมวลชน + มุมเจาะรายบุคคล'],
                ['inv-3', 'ถ่ายคลิป Uncut มีเสียงและเวลาจริง ขณะเจรจา/อ่านประกาศ ม.21 / ม.23', 'เห็นผู้อ่านประกาศและกลุ่มผู้ชุมนุมในเฟรมเดียวกัน'],
                ['inv-4', 'รักษาไฟล์ Original (ห้ามลบ ห้ามส่งเฉพาะทาง LINE)'],
                ['inv-5', 'รายงานผู้บังคับบัญชาเป็นระยะ / ส่งแฟ้มรายงานสืบสวนให้งานสอบสวน']
            ]
        },
        {
            id: 'tra', short: 'จราจร', name: 'งานจราจร', icon: 'fa-traffic-light',
            head: { name: 'พ.ต.ท.สุจิตร ศิริราช', pos: 'รอง ผกก.จร.สน.ลำหิน', phone: '081-782-9997' },
            items: [
                ['tra-1', 'อำนวยการจราจรแยกปากซอยคู้คลองสิบ 4 / ถนนคู้-คลองสิบ'],
                ['tra-2', 'ดูแลรถผู้ชุมนุม ~10 คัน (ลานจอดรถมัสยิด) ไม่ให้กีดขวางผิวจราจร'],
                ['tra-3', 'รายงานสภาพจราจรเป็นระยะจนจบภารกิจ'],
                ['tra-4', 'เป็นพยานยืนยันผลกระทบการสัญจร', 'กรณีต้องยื่นคำร้องศาลแพ่งมีนบุรี']
            ]
        },
        {
            id: 'adm', short: 'อำนวยการ', name: 'งานอำนวยการ', icon: 'fa-utensils',
            head: { name: 'พ.ต.ท.เอกพล สุทธิรักษ์', pos: 'สว.อก.สน.ลำหิน', phone: '081-645-7484' },
            items: [
                ['adm-1', 'อาหาร/เครื่องดื่มชุดปล่อยแถว 04.30 น.'],
                ['adm-2', 'อาหารกลางวันและน้ำดื่มกำลังพลหน้างาน'],
                ['adm-3', 'สวัสดิการกำลังพลจนเสร็จสิ้นภารกิจ'],
                ['adm-4', 'ตรวจทะเบียนทรัพย์สินราชการที่นำออกปฏิบัติ', 'รถสายตรวจ / อุปกรณ์ คฝ.']
            ],
            note: 'กรณีทรัพย์สินราชการของ สน. เสียหาย ให้ สว.อก. เป็นผู้กล่าวหา (ผู้ควบคุมพัสดุ) ส่วนพลขับ/เจ้าหน้าที่ในเหตุการณ์สอบเป็นพยาน'
        },
        {
            id: 'qa', short: 'สอบสวน', name: 'งานสอบสวน', icon: 'fa-scale-balanced', wide: true,
            head: { name: 'พ.ต.ท.อัคเดช ลัดดาวัลย์', pos: 'รอง ผกก.(สอบสวน)สน.ลำหิน · ที่ปรึกษากฎหมาย ผบ.เหตุการณ์', phone: '085-556-3955' },
            items: [
                ['qa-1', 'ปล่อยแถว 04.30 น. ชี้แจงข้อกฎหมายและการเก็บพยานหลักฐาน'],
                ['qa-2', 'เตรียมแฟ้มเอกสารแนบคำร้องศาลแพ่งมีนบุรี 6 รายการ'],
                ['qa-3', 'ตรวจเบอร์เวรไต่สวนฉุกเฉินศาลแพ่งมีนบุรี (วันเสาร์)'],
                ['qa-4', 'ตรวจรถธุรการสำหรับเดินทางไปศาล + โน้ตบุ๊ก / เครื่องพิมพ์ / Flash Drive'],
                ['qa-5', 'ส่งมอบเวร 08.00 น.', 'ร.ต.ท.สัญญา พนมกุล → ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', '08.00 น.']
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
        { id: 'r1', name: 'พ.ต.ท.อัคเดช ลัดดาวัลย์', pos: 'รอง ผกก.(สอบสวน)สน.ลำหิน', phone: '085-556-3955', role: 'หัวหน้างานสอบสวน / ที่ปรึกษากฎหมาย ผบ.เหตุการณ์', time: '04.30 น. เป็นต้นไป', duty: 'ปล่อยแถวชี้แจงข้อกฎหมาย อำนวยการทีมสอบสวน ตรวจทานถ้อยคำประกาศ ม.21/23/25 พิจารณาความได้สัดส่วน ประสานศาล/อัยการ' },
        { id: 'r2', name: 'ร.ต.ท.สัญญา พนมกุล', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '084-511-2120', role: 'พนักงานสอบสวนเวรช่วงเช้า', time: '04.30–08.00 น.', duty: 'ร่วมปล่อยแถว เฝ้าระวังช่วงห้ามโทรโข่ง 05.00–06.00 น. (ม.15(6)) บันทึกเหตุการณ์ช่วงเช้า ส่งมอบเวร 08.00 น.' },
        { id: 'r3', name: 'ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '083-087-2512', role: 'พนักงานสอบสวนเวรหลัก / ชุดตรวจที่เกิดเหตุส่วนหน้า', time: '08.00 น. จนเสร็จภารกิจ', duty: 'ดูคดีเวรปกติ ตรวจที่เกิดเหตุ/ดำเนินการทันทีเมื่อมีเหตุเกี่ยวกับการชุมนุม (ตรวจที่เกิดเหตุควบคู่สอบผู้กล่าวหาเป็นชุดเดียวกัน)' },
        { id: 'r4', name: 'ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '086-396-9161', role: 'ชุดสนับสนุนเอกสารและสอบปากคำ', time: 'ตลอดภารกิจ (ประจำ สน.)', duty: 'จัดทำเอกสารทั้งหมด (ประกาศ / คำร้องศาล / รายงานเหตุ) และช่วยสอบปากคำพยาน ผู้กล่าวหา ผู้ต้องหา' },
        { id: 'r5', name: 'ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์', pos: 'รอง สว.(สอบสวน)สน.ลำหิน', phone: '085-290-1659', role: 'ชุดสแตนด์บายเสริมกำลัง (เจ้าของเรื่อง ปจว.ข้อ 3)', time: 'พร้อมเรียกตัวตลอด', duty: 'เข้าช่วยทันทีเมื่อสถานการณ์ยกระดับ มีเหตุรุนแรง มีการจับกุม หรือต้องระดมสอบปากคำจำนวนมาก' },
        { id: 'r6', group: true, name: 'ผบ.หมู่(ผช.พงส.)สน.ลำหิน 4 นาย', pos: 'ชุดธุรการ ยานพาหนะ และประสานศาล', role: 'สแตนด์บายสนับสนุน', time: 'ตลอดภารกิจ', duty: 'ขับรถไปยื่นคำร้องศาลแพ่งมีนบุรี เดินเอกสาร เตรียมแฟ้ม/อุปกรณ์ และภารกิจสนับสนุนตามสั่งการ' }
    ];
    const ASSISTANTS = [
        ['ส.ต.ท.นนทิวัฒน์ สิงห์อ่อน', '092-380-9962'], ['ส.ต.ท.สุทัศน์ ขุนทอง', '094-358-1786'], ['ส.ต.ต.กิตติศักดิ์ บุญสม', '062-129-4010'],
        ['ส.ต.ต.ธณต ตัณฑะผลิน', '093-935-0094'], ['ส.ต.ต.อัครพัชร์ ปอสร้อยเจริญ', '063-154-6945'], ['ส.ต.ต.ธีรสรรค พรหมพิทักษ์', '096-235-9110'], ['ส.ต.ต.อลีฟ บือซา', '092-634-4436']
    ];
    const INVESTIGATORS = ['พ.ต.ท.อัคเดช ลัดดาวัลย์', 'พ.ต.ท.สุวเมธ เนื่องขันตรี', 'ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ', 'ร.ต.อ.คิมหันฐ์ ศรีสุพรรณ์', 'ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์', 'ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์', 'ร.ต.ท.สัญญา พนมกุล', 'ขอกำลังเสริมจาก บก.น.3'];
    // คณะพนักงานสอบสวน 6 ชุด (แนวทาง บช.น. กรณีสถานการณ์ขยายตัว)
    const TEAMS = [
        { id: 't1', name: 'ตรวจสถานที่เกิดเหตุ + สอบปากคำผู้กล่าวหา', sub: 'ต้องเป็นชุดเดียวกัน ให้ผู้กล่าวหาชี้จุดได้สอดคล้อง', def: 'ร.ต.อ.ภาณุเชษฐ์ บุญชูดำ' },
        { id: 't2', name: 'สอบพยานบุคคลภายนอก', sub: 'กฟน.มีนบุรี เขต แพทย์ กู้ภัย สื่อมวลชน ประชาชนผู้ใช้เส้นทาง', def: '' },
        { id: 't3', name: 'ยื่นคำร้องศาล ผัดฟ้อง-ฝากขัง ประกันตัว ฟ้องวาจา ประสานทนายความ', sub: 'ติดตามกำหนดผัดฟ้องฝากขังทุกผลัด', def: 'ร.ต.ท.หญิงนภัสร์นันท์ จันทร์พเนาว์' },
        { id: 't4', name: 'ถอดเทป วิเคราะห์คลิป ควบคุมของกลาง/รถตรวจยึด', sub: 'ปรับบทรายบุคคล ตรวจประวัติ บัญชีรถ 3 กลุ่ม', def: '' },
        { id: 't5', name: 'รายงานเหตุและธุรการคดี', sub: 'รายงาน บก.น.3 / บช.น. · คุมเอกสารแนบคำร้องศาล 6 รายการ', def: '' },
        { id: 't6', name: 'สรุปสำนวนและประสานอัยการ', sub: 'เตรียมแผนกรณีผู้ต้องหากลับคำให้การ', def: 'ร.ต.อ.เชี่ยวชาญชัย ทีหนองสังข์' }
    ];
    const ST = { todo: 'ยังไม่เริ่ม', doing: 'กำลังปฏิบัติ', done: 'เสร็จสิ้น' };

    /* ---------------- สถานะ ---------------- */
    let api = null, host = null, lastKey = '';
    let ui = (function () { try { return JSON.parse(localStorage.getItem(UI_KEY) || 'null') || {}; } catch (e) { return {}; } })();
    ui.open = ui.open || {}; ui.view = ui.view || 'roster';
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
        const mobile = window.innerWidth < 860;
        const C = 2 * Math.PI * 42;
        let html = '<section class="cmd-card">' +
            '<div class="ops-sum">' +
                '<div class="ops-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,178,222,.15)" stroke-width="10"/>' +
                '<circle cx="50" cy="50" r="42" fill="none" stroke="#D4AF37" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><b>' + pct + '%</b></div>' +
                '<div class="ops-sum-txt"><h4>ความพร้อมทุกสายงาน</h4><p>' + done + ' จาก ' + total + ' รายการ · แตะรายการเพื่อติ๊กพร้อมลงเวลาอัตโนมัติ</p>' +
                    '<div class="ops-counts"><span><i style="background:#16A34A"></i>เสร็จสิ้น ' + cnt.done + '</span><span><i style="background:#F59E0B"></i>กำลังปฏิบัติ ' + cnt.doing + '</span><span><i style="background:#5F7594"></i>ยังไม่เริ่ม ' + cnt.todo + '</span></div></div>' +
                '<div class="ops-sum-btns">' +
                    '<button type="button" class="cmd-btn line sm" data-op="line"><i class="fa-brands fa-line"></i> คัดลอกสรุปส่ง LINE</button>' +
                    '<button type="button" class="cmd-btn sm" data-op="expand"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> ' + (divs.every((d) => isOpen(d.id, mobile)) ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด') + '</button>' +
                    '<button type="button" class="cmd-btn sm danger" data-op="reset"><i class="fa-solid fa-rotate-left"></i> ล้างการติ๊ก</button>' +
                '</div>' +
            '</div>' +
            '<div class="ops-bars">' + divs.map((d) => '<button type="button" class="ops-bar" data-op="jump" data-div="' + d.id + '"><i class="fa-solid ' + d.icon + '"></i><span>' + esc(d.short) + '</span><em>' + d.done + '/' + d.items.length + '</em></button>').join('') + '</div>' +
            '</section>';

        html += '<div class="ops-grid">' + divs.map((d) => divCard(d, ev, o, mobile)).join('') + '</div>';
        host.innerHTML = html;
    }
    function isOpen(id, mobile) { return ui.open[id] !== undefined ? !!ui.open[id] : !mobile; }
    function divCard(d, ev, o, mobile) {
        const open = isOpen(d.id, mobile);
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
            '<button type="button" class="ops-head" data-op="toggle" data-div="' + d.id + '" aria-expanded="' + open + '">' +
                '<span class="ops-head-ic"><i class="fa-solid ' + d.icon + '"></i></span>' +
                '<span class="ops-head-txt"><b>' + esc(d.name) + '</b><small>' + esc(d.head.name) + ' · ' + esc(d.head.pos.split(' · ')[0]) + '</small></span>' +
                '<span class="ops-pill">' + ST[d.st] + '</span><i class="fa-solid fa-chevron-down ops-chev"></i></button>' +
            '<div class="ops-prog"><i style="width:' + d.pct + '%"></i></div>' +
            '<div class="ops-prog-lb"><span>ความคืบหน้า ' + d.pct + '%</span><span>' + d.done + '/' + d.items.length + ' รายการ</span></div>' +
            '<div class="ops-body">' + body + '</div></section>';
    }
    function qaExtra(o) {
        const view = ui.view === 'teams' ? 'teams' : 'roster';
        let h = '<div style="margin-top:14px"><div class="ops-seg">' +
            '<button type="button" data-op="view" data-view="roster" class="' + (view === 'roster' ? 'on' : '') + '"><i class="fa-solid fa-id-badge"></i> ผังกำลังวันนี้</button>' +
            '<button type="button" data-op="view" data-view="teams" class="' + (view === 'teams' ? 'on' : '') + '"><i class="fa-solid fa-people-group"></i> คณะทำงาน 6 ชุด (กรณีขยายตัว)</button></div>';
        if (view === 'roster') {
            const inCount = ROSTER.filter((p) => o.roster[p.id]).length;
            h += '<p class="ops-hint">ผังกำลังตามที่สั่งการ (ปล่อยแถว 04.30 น. หน้า สน.ลำหิน) — กด "รายงานตัว" เมื่อพร้อมปฏิบัติ · รายงานตัวแล้ว ' + inCount + '/' + ROSTER.length + '</p>';
            h += '<datalist id="ops-assist">' + ASSISTANTS.map((a) => '<option value="' + esc(a[0]) + '">').join('') + '</datalist>';
            h += '<div class="ops-roster">' + ROSTER.map((p) => {
                const at = o.roster[p.id];
                let extra = '';
                if (p.group) {
                    extra = '<div style="display:grid;gap:5px">' + [0, 1, 2, 3].map((i) => {
                        const nm = o.slots[i] || '', ph = (ASSISTANTS.find((a) => a[0] === nm) || [])[1];
                        return '<div class="ops-slot"><input type="text" list="ops-assist" data-op="slot" data-slot="' + i + '" value="' + esc(nm) + '" placeholder="' + (i + 1) + ') เลือก/พิมพ์ชื่อ ผช.พงส." aria-label="ผช.พงส. คนที่ ' + (i + 1) + '">' +
                            (ph ? '<a class="ops-call" href="' + esc(tel(ph)) + '"><i class="fa-solid fa-phone"></i></a>' : '') + '</div>';
                    }).join('') + '</div>';
                }
                return '<div class="ops-person' + (at ? ' in' : '') + '">' +
                    '<div class="ops-person-h"><i class="fa-solid ' + (p.group ? 'fa-users' : 'fa-user-shield') + '"></i><span><b>' + esc(p.name) + '</b><small>' + esc(p.pos) + '</small></span></div>' +
                    '<div class="ops-role">' + esc(p.role) + '</div>' +
                    '<div class="ops-time"><i class="fa-regular fa-clock"></i> ' + esc(p.time) + '</div>' +
                    '<div class="ops-duty">' + esc(p.duty) + '</div>' + extra +
                    '<div class="ops-person-f"><button type="button" class="ops-in" data-op="in" data-person="' + p.id + '"><i class="fa-' + (at ? 'solid fa-circle-check' : 'regular fa-circle') + '"></i> ' + (at ? 'รายงานตัวแล้ว ' + esc(when(at)) : 'รายงานตัว') + '</button>' +
                    (p.phone ? '<a class="ops-call" href="' + esc(tel(p.phone)) + '"><i class="fa-solid fa-phone"></i> ' + esc(p.phone) + '</a>' : '') + '</div></div>';
            }).join('') + '</div>';
        } else {
            h += '<p class="ops-hint">คดีชุมนุมไม่ควรทำโดยลำพัง หากเหตุการณ์เกินกำลังเวรปกติ ให้รายงานขอตั้งคณะพนักงานสอบสวนระดับ สน./บก.น.3 แบ่ง 6 ชุด — เลือกหัวหน้าชุด แล้วติ๊กเมื่อตั้งชุดแล้ว</p>';
            h += '<div class="ops-teams">' + TEAMS.map((t, i) => {
                const st = o.teams[t.id] || {}, lead = st.lead !== undefined ? st.lead : t.def;
                const opts = [''].concat(INVESTIGATORS);
                if (lead && opts.indexOf(lead) === -1) opts.push(lead);
                return '<div class="ops-team' + (st.on ? ' on' : '') + '">' +
                    '<div class="ops-team-h"><b>' + (i + 1) + '</b><span>' + esc(t.name) + '<small>' + esc(t.sub) + '</small></span></div>' +
                    '<select data-op="lead" data-team="' + t.id + '" aria-label="หัวหน้าชุดที่ ' + (i + 1) + '">' + opts.map((n) => '<option value="' + esc(n) + '"' + (n === lead ? ' selected' : '') + '>' + (n ? esc(n) : '— ยังไม่กำหนดหัวหน้าชุด —') + '</option>').join('') + '</select>' +
                    '<button type="button" class="ops-in" data-op="team" data-team="' + t.id + '"><i class="fa-' + (st.on ? 'solid fa-circle-check' : 'regular fa-circle') + '"></i> ' + (st.on ? 'ตั้งชุดแล้ว ' + esc(when(st.on)) : 'ตั้งชุดแล้ว') + '</button></div>';
            }).join('') + '</div>';
        }
        return h + '</div>';
    }

    /* ---------------- การกระทำ ---------------- */
    function commit() { api.save(); render(); }
    function onClick(e) {
        const b = e.target.closest('[data-op]');
        if (!b || !host.contains(b) || b.tagName === 'FORM' || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
        const ev = api.active(); if (!ev) return;
        const o = ops(ev), op = b.dataset.op, now = new Date().toISOString();
        if (op === 'toggle') { ui.open[b.dataset.div] = !isOpen(b.dataset.div, window.innerWidth < 860); saveUi(); render(); return; }
        if (op === 'expand') { const all = ASSEMBLY.every((d) => isOpen(d.id, window.innerWidth < 860)); ASSEMBLY.forEach((d) => { ui.open[d.id] = !all; }); saveUi(); render(); return; }
        if (op === 'jump') {
            ui.open[b.dataset.div] = true; saveUi(); render();
            const card = document.getElementById('ops-' + b.dataset.div);
            if (card) window.scrollTo({ top: Math.max(0, card.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' });
            return;
        }
        if (op === 'view') { ui.view = b.dataset.view; saveUi(); render(); return; }
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
        if (op === 'in') { const id = b.dataset.person; if (o.roster[id]) delete o.roster[id]; else o.roster[id] = now; commit(); return; }
        if (op === 'team') { const t = o.teams[b.dataset.team] = o.teams[b.dataset.team] || {}; if (t.lead === undefined) t.lead = (TEAMS.find((x) => x.id === b.dataset.team) || {}).def || ''; t.on = t.on ? '' : now; commit(); return; }
        if (op === 'head') { headForm(ev, b.dataset.div); return; }
        if (op === 'line') { api.copyText(lineText(ev)); return; }
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
        if (el.dataset.op === 'slot') { o.slots[Number(el.dataset.slot)] = String(el.value || '').trim(); commit(); }
        else if (el.dataset.op === 'lead') { const t = o.teams[el.dataset.team] = o.teams[el.dataset.team] || {}; t.lead = el.value; api.save(); }
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

    /* ---------------- สรุปส่ง LINE ---------------- */
    function lineText(ev) {
        const divs = divisions(ev), o = ops(ev), now = Date.now();
        const total = divs.reduce((s, d) => s + d.items.length, 0), done = divs.reduce((s, d) => s + d.done, 0);
        const cnt = { todo: 0, doing: 0, done: 0 }; divs.forEach((d) => { cnt[d.st]++; });
        const L = ['📋 ความพร้อมทุกสายงาน | ' + ev.title, 'ภาพรวม ' + (total ? Math.round(done / total * 100) : 0) + '% (' + done + '/' + total + ') · เสร็จสิ้น ' + cnt.done + ' · กำลังปฏิบัติ ' + cnt.doing + ' · ยังไม่เริ่ม ' + cnt.todo, ''];
        divs.forEach((d) => {
            const mark = d.st === 'done' ? '✅' : d.st === 'doing' ? '🟡' : '⚪';
            const left = d.items.filter((it) => !it.at).map((it) => it.t);
            L.push(mark + ' ' + d.short + ' ' + d.done + '/' + d.items.length + (left.length && d.st !== 'todo' ? ' — ค้าง: ' + left.slice(0, 3).join(' / ') + (left.length > 3 ? ' (+' + (left.length - 3) + ')' : '') : ''));
        });
        if (isAssembly(ev)) {
            const ins = ROSTER.filter((p) => o.roster[p.id]);
            L.push('');
            L.push('👮 งานสอบสวน รายงานตัว ' + ins.length + '/' + ROSTER.length + (ins.length ? ': ' + ins.map((p) => p.group ? 'ผช.พงส.' : p.name.split(' ')[0]).join(', ') : ''));
            const missing = ROSTER.filter((p) => !o.roster[p.id]);
            if (missing.length) L.push('   ยังไม่รายงานตัว: ' + missing.map((p) => p.group ? 'ผช.พงส. 4 นาย' : p.name).join(', '));
        }
        L.push(''); L.push('ข้อมูล ณ ' + api.thDateShort(now) + ' ' + api.hmTh(now) + ' · กระดานสถานการณ์ สน.ลำหิน');
        return L.join('\n');
    }

    /* ---------------- ลงทะเบียนแท็บ ---------------- */
    CMD.registerSection({
        id: 'ops', label: 'สายงาน', icon: 'fa-sitemap', order: 15,
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
