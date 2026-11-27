/* =====================================================================
   กระดานสถานการณ์ & บริหารเหตุการณ์ (Smart Command Board) — สน.ลำหิน
   Step 1: แถบเหตุการณ์ · Countdown · ระดับสถานการณ์ · Pinned Legal Alerts · Quick Actions
   - โมดูลแยกไฟล์ ไม่แตะโค้ดเดิม: ใช้แท็บ #pane-cmd ผ่าน showTab() ของ app.js
   - เก็บข้อมูลใน localStorage (LamhinCmd.KEY) + Export/Import JSON + คัดลอกสรุปส่ง LINE
   - ผู้ใช้ยืนยันให้แสดงข้อมูลผู้จัด/ผู้ประสานงานบนเว็บได้ (เลขบัตรประชาชนแสดงแบบปิดบางส่วน)
   - โมดูลเสริม (แผนที่ 3 มิติ / คู่มือและหนังสือราชการ) เสียบผ่าน LamhinCmd.registerSection({ id, order, mount, update, visible })
     · host: 'overview' | '<id แท็บอื่น>' = ไม่มีแท็บของตัวเอง แสดงต่อท้ายแท็บนั้น (แท็บเจ้าของกำหนดได้ด้วย shows(id) / reveal(id))
     · host: 'overview' + top: true = วางบนสุดของหน้าภาพรวม ก่อนการ์ดสรุป
   - แท็บหลัก 3 แท็บ: ภาพรวม (แผนที่ 3 มิติบนสุด + แท็บย่อย เหตุการณ์/เวลา & ระดับ/ข้อกฎหมาย/เบอร์โทร)
     · บันทึก ศปก. (แท็บย่อย บันทึกเหตุการณ์ / ขั้นตอน & กฎหมาย) · คู่มือ & เอกสาร (+สายงาน)
   - หลักการ: กดสลับแท็บย่อยแทนการเลื่อนยาวลงด้านล่าง
     การ์ดของโมดูลเสริมสร้างครั้งเดียวและคงอยู่ (ไม่ถูกวาดทับเมื่อกระดานหลักวาดใหม่)
   ===================================================================== */
(function () {
    'use strict';

    const KEY = 'lamhin_cmd_v1';
    const VERSION = 1;
    const STATION_NAME = 'สถานีตำรวจนครบาลลำหิน';

    const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    const CATEGORIES = ['ชุมนุมสาธารณะ', 'งานพิธี / อารักขา', 'จราจร / อุบัติเหตุใหญ่', 'อาชญากรรม / ปิดล้อมตรวจค้น', 'สาธารณภัย', 'อื่นๆ'];

    const LEVELS = {
        green: { name: 'ระดับสีเขียว', short: 'สีเขียว', emoji: '🟢', icon: 'fa-check', desc: 'ชุมนุมโดยสงบ' },
        yellow: { name: 'ระดับสีเหลือง', short: 'สีเหลือง', emoji: '🟡', icon: 'fa-eye', desc: 'เริ่มฝ่าฝืนเงื่อนไข · เฝ้าระวัง' },
        red: { name: 'ระดับสีแดง', short: 'สีแดง', emoji: '🔴', icon: 'fa-triangle-exclamation', desc: 'ยื่นศาล / พื้นที่ควบคุม ม.23–25' }
    };

    const TONES = { gold: 'ทอง (เส้นตาย)', blue: 'ฟ้า (ข้อห้ามช่วงเวลา)', red: 'แดง (บทหนัก)', amber: 'เหลือง (เฝ้าระวัง)', green: 'เขียว (แนวปฏิบัติ)' };

    /* ---------------- ข้อมูลตั้งต้น (Seed) ---------------- */
    const SEED_ID = 'ev-20261128-lamjedee';
    function seedEvent() {
        return {
            id: SEED_ID,
            category: 'ชุมนุมสาธารณะ',
            title: 'การชุมนุมสาธารณะคัดค้านการปักเสาไฟฟ้าและยับยั้งการจั้มไฟ (ชุมชนลำเจดีย์)',
            date: '2026-11-28',
            muster: '04:30',
            musterLabel: 'รวมพล/ปล่อยแถว หน้า สน.ลำหิน',
            start: '05:00',
            end: '18:00',
            place: 'พื้นที่ว่างสาธารณะ ปากทางเข้าซอยคู้คลอง 10 ซอย 4',
            distance: 'ทางรถ 2.8 กม. (~5 นาที)',
            mapQuery: 'ซอยคู้คลองสิบ 4 ถนนคู้-คลองสิบ หนองจอก กรุงเทพมหานคร',
            latlng: '13.883804945497769, 100.80997853378307',
            crowd: 'มวลชน 100–200 คน · รถ ~10 คัน · ไม่เดินขบวน/ไม่ตั้งเวที · ใช้โทรโข่ง',
            organizer: 'นายภูเบศ โพธิ์โซ๊ะ อายุ 65 ปี (ตัวแทนชุมชนลำเจดีย์) เลขประจำตัวประชาชน 3-1003-xxxxx-xx-4 · ที่อยู่ 63/2636 ซอยราษฎร์พัฒนา 5 แขวงราษฎร์พัฒนา เขตสะพานสูง กรุงเทพฯ · โทร. 086-983-6599',
            coordinators: '1) นายสมาน มาลี โทร. 084-002-0480 · 2) นายสิทธิศักดิ์ โห้วตู โทร. 086-071-5943',
            ref: 'หนังสือแจ้ง 26 พ.ย. 69 เวลา 14.00 น. · ปจว.ข้อ 3 ลง 26 พ.ย. 69 เวลา 14.44 น. · เลขรับ EV60026256900637SJ',
            court: 'ศาลแพ่งมีนบุรี (ม.21–22) · ศาลอาญามีนบุรี (คดีอาญา/หมายจับ)',
            level: 'green',
            levelLog: [],
            alerts: [
                {
                    id: 'al-m11', tone: 'gold', icon: 'fa-hourglass-half', law: 'ม.11 · ม.19–20',
                    title: 'ส่งหนังสือเงื่อนไข ม.11 ให้ผู้แจ้ง',
                    detail: 'ภายใน 27 พ.ย. 69 14.00 น. · เก็บหลักฐานเซ็นรับ · แจ้งเขตและประชาสัมพันธ์',
                    kind: 'due', due: '2026-11-27T14:00', from: '', to: '', done: false, doneAt: ''
                },
                {
                    id: 'al-m15-6', tone: 'blue', icon: 'fa-volume-xmark', law: 'ม.15 (6) · โทษ ม.31 ว.1',
                    title: 'ห้ามโทรโข่ง 05.00–06.00 น.',
                    detail: 'ห้ามเครื่องขยายเสียง 24.00–06.00 น. · จำคุกไม่เกิน 6 เดือน หรือปรับไม่เกิน 10,000 บาท',
                    kind: 'window', due: '', from: '05:00', to: '06:00', done: false, doneAt: ''
                },
                {
                    id: 'al-m31-2', tone: 'red', icon: 'fa-bolt', law: 'ม.31 ว.2 (บทหนัก)',
                    title: 'ห้ามทำให้ไฟฟ้า/สาธารณูปโภคใช้การไม่ได้',
                    detail: 'ฝ่าฝืน ม.15 (4)–(7) / ม.16 (3)–(8) จนใช้การไม่ได้ · จำคุกไม่เกิน 10 ปี หรือปรับไม่เกิน 200,000 บาท',
                    kind: 'static', due: '', from: '', to: '', done: false, doneAt: ''
                }
            ],
            contacts: defaultContacts(true),
            createdAt: new Date().toISOString()
        };
    }

    // ตำแหน่งผู้บังคับบัญชาตามข้อมูลกำลังพล สน.ลำหิน 2569 · เบอร์ผู้จัด/ผู้ประสานงานตามหนังสือแจ้งการชุมนุม
    function defaultContacts(isAssembly) {
        const list = [
            { id: 'ct-cmd', name: 'พ.ต.อ.สุขสันต์ แสนสวัสดิ์', role: 'รรท.ผกก.สน.ลำหิน (ผบ.เหตุการณ์)', phone: '084-881-5353' },
            { id: 'ct-dp', name: 'พ.ต.ท.รัติศัย นิลน้อย', role: 'รอง ผกก.ป.สน.ลำหิน (ผู้รับกำลัง คฝ.)', phone: '088-553-2610' }
        ];
        if (isAssembly) {
            list.push(
                { id: 'ct-org', name: 'นายภูเบศ โพธิ์โซ๊ะ', role: 'ผู้จัดการชุมนุม', phone: '086-983-6599' },
                { id: 'ct-co1', name: 'นายสมาน มาลี', role: 'ผู้ประสานงาน 1', phone: '084-002-0480' },
                { id: 'ct-co2', name: 'นายสิทธิศักดิ์ โห้วตู', role: 'ผู้ประสานงาน 2', phone: '086-071-5943' },
                { id: 'ct-court', name: 'เวรไต่สวนฉุกเฉิน ศาลแพ่งมีนบุรี', role: 'ยื่นคำร้อง ม.21 ว.2', phone: '' },
                { id: 'ct-mea', name: 'การไฟฟ้านครหลวง เขตมีนบุรี', role: 'ผู้ประสานงานหน้างาน / นิติกร', phone: '' }
            );
        }
        return list;
    }

    /* ---------------- สถานะ ---------------- */
    let state = null;
    let root = null;    // #pane-cmd
    let shell = null;   // .cmd-root (พื้นหลัง/สีระดับ)
    let head = null;    // แถบบน + แถบเหตุการณ์ (วาดใหม่ทุกครั้ง)
    let tabsEl = null;  // แท็บย่อย (ติดขอบบนเมื่อเลื่อน)
    let core = null;    // เนื้อหาแท็บหลัก (วาดใหม่ทุกครั้ง)
    let ext = null, topBox;     // การ์ดโมดูลเสริม (สร้างครั้งเดียว) · topBox = บนสุดหน้าภาพรวม (แผนที่ 3 มิติ)
    const alOpen = new Set();   // ข้อกฎหมายที่กางรายละเอียดอยู่ (หน้าภาพรวม)
    let timer = 0;
    let lastPhaseKey = '';
    const plugins = [];

    function load() {
        let s = null;
        try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
        if (!s || !Array.isArray(s.events)) s = { version: VERSION, activeId: '', events: [seedEvent()], updatedAt: '' };
        // เหตุการณ์ตั้งต้นที่เคยบันทึกไว้: เติมช่องที่ยังว่างจากข้อมูลตั้งต้นรุ่นใหม่ (ไม่ทับสิ่งที่ผู้ใช้แก้แล้ว)
        const seed = seedEvent();
        s.events = s.events.map((e) => {
            if (!e || e.id !== seed.id) return e;
            // ข้อความรุ่นก่อน (ยาว/คลาดเคลื่อน) → รุ่นกระชับ เฉพาะช่องที่ผู้ใช้ยังไม่ได้แก้เอง
            const OLD = { distance: ['ห่าง สน.ลำหิน ประมาณ 1.5 กม.', 'จาก สน.ลำหิน ทางรถ ~2.8 กม. (~5 นาที) · เส้นตรง ~1.9 กม.'], crowd: ['มวลชนประมาณ 100–200 คน · รถยนต์ ~10 คัน · ไม่เดินขบวน · ไม่ตั้งเวที · ใช้โทรโข่ง'] };
            Object.keys(OLD).forEach((k) => { if (OLD[k].indexOf(e[k]) !== -1) e[k] = seed[k]; });
            const OLD_AL = {
                'al-m11': ['เส้นตาย ม.11 · ม.19 ว.1 · ม.20', 'ส่งหนังสือสรุปสาระสำคัญและเงื่อนไขให้ผู้แจ้ง', 'ส่งมอบให้ผู้แจ้งภายใน 27 พ.ย. 69 เวลา 14.00 น. พร้อมเก็บหลักฐานการส่งมอบ/เซ็นรับ และแจ้งสำนักงานเขตท้องที่กับหน่วยงานประชาสัมพันธ์ตาม ม.19 วรรคหนึ่ง และ ม.20'],
                'al-m15-6': ['ข้อห้าม ม.15 (6) · โทษ ม.31 ว.1', 'ห้ามใช้โทรโข่ง/เครื่องขยายเสียง 05.00 – 06.00 น.', 'ม.15 (6) ห้ามผู้จัดการชุมนุมใช้เครื่องขยายเสียงระหว่างเวลา 24.00 – 06.00 น. ฝ่าฝืนจำคุกไม่เกิน 6 เดือน หรือปรับไม่เกิน 10,000 บาท หรือทั้งจำทั้งปรับ (ม.31 วรรคหนึ่ง)'],
                'al-m31-2': ['บทหนัก ม.31 วรรคสอง', 'ห้ามกระทำการให้ระบบส่งกระแสไฟฟ้า/สาธารณูปโภคใช้การไม่ได้', 'หากฝ่าฝืน ม.15 (4)–(7) หรือ ม.16 (3)–(8) จนระบบผลิตหรือส่งกระแสไฟฟ้า หรือสาธารณูปโภคอื่นใดใช้การไม่ได้ (ชั่วคราวหรือถาวร) ผู้จัดการชุมนุมระวางโทษจำคุกไม่เกิน 10 ปี หรือปรับไม่เกิน 200,000 บาท หรือทั้งจำทั้งปรับ']
            };
            (e.alerts || []).forEach((a) => {
                const o = OLD_AL[a.id], n = seed.alerts.find((x) => x.id === a.id);
                if (o && n) ['law', 'title', 'detail'].forEach((f, i) => { if (a[f] === o[i]) a[f] = n[f]; });
            });
            const OLD_ROLE = { 'ct-co1': 'ผู้ประสานงาน ลำดับ 1', 'ct-co2': 'ผู้ประสานงาน ลำดับ 2', 'ct-court': 'ยื่นคำร้องขอคำสั่งเลิกการชุมนุม' };
            Object.keys(seed).forEach((k) => { if (typeof seed[k] === 'string' && !String(e[k] || '').trim()) e[k] = seed[k]; });
            (e.contacts || []).forEach((c) => {
                const sc = seed.contacts.find((x) => x.id === c.id);
                if (sc && !String(c.phone || '').trim()) c.phone = sc.phone;
                if (sc && OLD_ROLE[c.id] && c.role === OLD_ROLE[c.id]) c.role = sc.role;
                if (sc) delete c.local;
            });
            return e;
        });
        s.events = s.events.map(normalize);
        if (!s.events.some((e) => e.id === s.activeId)) s.activeId = pickDefault(s.events);
        return s;
    }
    function save() {
        state.updatedAt = new Date().toISOString();
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('บันทึกในเครื่องไม่ได้ (พื้นที่เต็มหรือโหมดส่วนตัว)'); }
    }
    // เติมฟิลด์ที่ขาด (ไฟล์ Export รุ่นเก่า / เหตุการณ์ที่เพิ่มเอง) ให้ครบเสมอ — Step ถัดไปเพิ่มฟิลด์ได้ที่นี่
    function normalize(e) {
        const ev = Object.assign({
            id: uid('ev'), category: 'อื่นๆ', title: 'เหตุการณ์ใหม่', date: '', muster: '', musterLabel: 'รวมพล/ปล่อยแถว', start: '', end: '',
            place: '', distance: '', mapQuery: '', latlng: '', crowd: '', organizer: '', coordinators: '', ref: '', court: '', level: 'green',
            levelLog: [], alerts: [], contacts: [], createdAt: new Date().toISOString()
        }, e || {});
        if (!LEVELS[ev.level]) ev.level = 'green';
        ev.levelLog = Array.isArray(ev.levelLog) ? ev.levelLog : [];
        ev.alerts = (Array.isArray(ev.alerts) ? ev.alerts : []).map((a) => Object.assign({ id: uid('al'), tone: 'gold', icon: 'fa-scale-balanced', law: '', title: '', detail: '', kind: 'static', due: '', from: '', to: '', done: false, doneAt: '' }, a));
        ev.contacts = (Array.isArray(ev.contacts) ? ev.contacts : []).map((c) => Object.assign({ id: uid('ct'), name: '', role: '', phone: '' }, c));
        return ev;
    }
    // เหตุการณ์ที่ยังไม่จบที่ใกล้ที่สุด → ถ้าไม่มี ใช้เหตุการณ์ล่าสุด
    function pickDefault(events) {
        const now = Date.now();
        const sorted = events.slice().sort((a, b) => (startOf(a) || 0) - (startOf(b) || 0));
        const next = sorted.find((e) => (endOf(e) || startOf(e) || 0) >= now);
        return (next || sorted[sorted.length - 1] || {}).id || '';
    }
    function active() { return state.events.find((e) => e.id === state.activeId) || null; }

    /* ---------------- เวลา ---------------- */
    const pad = (n) => String(n).padStart(2, '0');
    function at(dateStr, hm) {
        if (!dateStr || !hm) return null;
        const d = dateStr.split('-').map(Number), t = hm.split(':').map(Number);
        if (d.length < 3 || isNaN(d[0]) || isNaN(t[0])) return null;
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0, 0).getTime();
    }
    function startOf(ev) { return at(ev.date, ev.start); }
    function musterOf(ev) { return at(ev.date, ev.muster); }
    function endOf(ev) {
        const s = startOf(ev), e = at(ev.date, ev.end);
        if (e == null) return null;
        return s != null && e <= s ? e + 86400000 : e;   // ข้ามเที่ยงคืน
    }
    function parseLocal(s) {   // 'YYYY-MM-DDTHH:MM'
        if (!s) return null;
        const p = String(s).split('T');
        return at(p[0], p[1] || '00:00');
    }
    function thDateLong(ms) { const d = new Date(ms); return 'วัน' + TH_DAYS[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
    function thDateShort(ms) { const d = new Date(ms); return d.getDate() + ' ' + TH_MONTHS_S[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2); }
    function hmTh(ms) { const d = new Date(ms); return pad(d.getHours()) + '.' + pad(d.getMinutes()) + ' น.'; }
    function hmStr(hm) { return hm ? hm.replace(':', '.') + ' น.' : '-'; }
    function split(ms) {
        const t = Math.max(0, Math.floor(ms / 1000));
        return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
    }
    function human(ms) {   // "2 วัน 3 ชม. 5 นาที" / "45 นาที 10 วิ"
        const x = split(Math.abs(ms));
        if (x.d) return x.d + ' วัน ' + x.h + ' ชม.' + (x.m ? ' ' + x.m + ' นาที' : '');
        if (x.h) return x.h + ' ชม. ' + x.m + ' นาที';
        if (x.m) return x.m + ' นาที ' + pad(x.s) + ' วิ';
        return x.s + ' วินาที';
    }

    /* ---------------- เครื่องมือทั่วไป ---------------- */
    function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function telHref(p) { return 'tel:' + String(p || '').replace(/[^0-9+]/g, ''); }
    function toast(msg) {
        const old = document.querySelector('.cmd-toast'); if (old) old.remove();
        const t = document.createElement('div'); t.className = 'cmd-toast'; t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2400);
    }
    function copyText(text) {
        const done = () => toast('คัดลอกแล้ว — วางในกลุ่ม LINE ได้ทันที');
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(done).catch(() => fallback());
        }
        fallback();
        function fallback() {
            const ta = document.createElement('textarea');
            ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
            document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
            let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            ta.remove();
            if (ok) done(); else showText('คัดลอกข้อความเอง', text);
        }
    }
    function mapUrl(ev) {
        const q = ev.latlng && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(ev.latlng) ? ev.latlng.replace(/\s+/g, '') : (ev.mapQuery || ev.place);
        return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    }
    function dirUrl(ev) {
        const dest = ev.latlng && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(ev.latlng) ? ev.latlng.replace(/\s+/g, '') : (ev.mapQuery || ev.place);
        return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(STATION_NAME) + '&destination=' + encodeURIComponent(dest) + '&travelmode=driving';
    }

    /* ---------------- สถานะเวลาเหตุการณ์ ---------------- */
    // คืน { key, mode: pre|muster|live|over|nodate, label, target, note }
    function phase(ev, now) {
        const m = musterOf(ev), s = startOf(ev), e = endOf(ev);
        if (s == null) return { key: 'nodate', mode: 'nodate' };
        if (m != null && now < m) return { key: 'pre', mode: 'pre', label: 'ถึง <b>' + esc(musterShort(ev)) + ' ' + hmStr(ev.muster) + '</b>', target: m };
        if (now < s) return { key: 'muster', mode: 'pre', label: 'ถึง <b>เริ่ม ' + hmStr(ev.start) + '</b>', target: s };
        if (e != null && now < e) return { key: 'live', mode: 'live', label: '<b>กำลังดำเนินอยู่</b> · ถึง ' + hmStr(ev.end), target: e, note: 'เริ่มแล้ว ' + human(now - s) };
        if (e != null) return { key: 'over', mode: 'over', label: '<b>เลยเวลาเลิก ' + hmStr(ev.end) + '</b>', target: e, note: ev.category === 'ชุมนุมสาธารณะ' ? 'ยังไม่เลิก (ม.18) → พิจารณาประกาศ ม.21 (1)' : 'ตรวจสอบการปิดเหตุการณ์' };
        return { key: 'live-open', mode: 'live', label: '<b>กำลังดำเนินอยู่</b>', target: s, note: 'ไม่ได้กำหนดเวลาสิ้นสุด' };
    }

    // "รวมพล/ปล่อยแถว หน้า สน.ลำหิน" → "รวมพล/ปล่อยแถว" (ใช้แสดงผลแบบย่อ)
    function musterShort(ev) { return String(ev.musterLabel || 'รวมพล/ปล่อยแถว').replace(/\s+(หน้า|ที่|ณ)\s.*$/, '') || 'รวมพล'; }

    function alertStatus(ev, a, now) {
        if (a.kind === 'due') {
            const due = parseLocal(a.due);
            if (a.done) return { cls: 'ok', text: '✓ ดำเนินการแล้ว' + (a.doneAt ? ' ' + hmTh(Date.parse(a.doneAt)) : '') };
            if (due == null) return { cls: '', text: 'ไม่ได้กำหนดเส้นตาย' };
            if (now < due) return { cls: due - now < 6 * 3600000 ? 'warn' : '', text: 'เหลือ ' + human(due - now) };
            return { cls: 'bad', text: 'เลยกำหนด ' + human(now - due) };
        }
        if (a.kind === 'window') {
            const f = at(ev.date, a.from), t = at(ev.date, a.to);
            if (f == null || t == null) return { cls: '', text: 'ไม่ได้กำหนดช่วงเวลา' };
            if (now < f) return { cls: f - now < 3600000 ? 'warn' : '', text: 'อีก ' + human(f - now) };
            if (now < t) return { cls: 'live', text: '● อยู่ในช่วงห้าม · เหลือ ' + human(t - now) };
            return { cls: 'ok', text: 'พ้นช่วงห้ามแล้ว' };
        }
        return null;
    }

    /* ---------------- แท็บย่อยของกระดาน ---------------- */
    const TAB_KEY = 'lamhin_cmd_tab';
    const CORE_TABS = [
        { id: 'overview', label: 'ภาพรวม', icon: 'fa-gauge-high', order: 10 }
    ];
    // แท็บเดิมที่รวมเข้าแท็บใหญ่แล้ว — ปุ่ม/ลิงก์/ค่าที่จำไว้เดิมยังพาไปถูกที่
    //   ข้อกฎหมาย → การ์ดข้อกฎหมายชี้ขาดในหน้าภาพรวม · ติดต่อ & นำทาง → การ์ดปุ่มลัดในหน้าภาพรวม
    const MERGED = { legal: { to: 'overview', ov: 'legal', anchor: '.cmd-alerts' }, contact: { to: 'overview', ov: 'contact', anchor: '.cmd-quick' } };
    // แท็บย่อยของหน้าภาพรวม (ใต้แผนที่ 3 มิติ) — เห็นทีละการ์ด ไม่ต้องเลื่อนยาว
    const OV_KEY = 'lamhin_cmd_ovsub';
    const OV_TABS = [
        { id: 'event', label: 'เหตุการณ์', icon: 'fa-bullhorn' },
        { id: 'time', label: 'เวลา & ระดับ', icon: 'fa-stopwatch' },
        { id: 'legal', label: 'ข้อกฎหมาย', icon: 'fa-scale-balanced' },
        { id: 'contact', label: 'เบอร์โทร', icon: 'fa-phone' }
    ];
    let ovSub = (function () { try { const v = localStorage.getItem(OV_KEY); return OV_TABS.some((t) => t.id === v) ? v : 'event'; } catch (e) { return 'event'; } })();
    function setOv(v) { if (!OV_TABS.some((t) => t.id === v)) return; ovSub = v; try { localStorage.setItem(OV_KEY, v); } catch (e) { /* ไม่จำก็ได้ */ } }
    let curSub = (function () { try { return localStorage.getItem(TAB_KEY) || 'overview'; } catch (e) { return 'overview'; } })();
    const findPlugin = (id) => plugins.find((x) => x.id === id);
    // โมดูลที่ฝากไว้ในแท็บอื่น (host) — ถ้าแท็บเจ้าของโหลดไม่ขึ้น ให้กลับมามีแท็บของตัวเอง
    function hostOf(p) {
        if (!p.host) return '';
        if (p.host === 'overview') return 'overview';
        const h = findPlugin(p.host);
        return h && !h.host ? p.host : '';
    }
    function allTabs() {
        return CORE_TABS.concat(plugins.filter((p) => !hostOf(p)).map((p) => ({ id: p.id, label: p.label || p.id, icon: p.icon || 'fa-puzzle-piece', order: p.order || 50 })))
            .sort((a, b) => a.order - b.order);
    }
    function resolveTab(id) {
        if (MERGED[id]) return { tab: MERGED[id].to, ov: MERGED[id].ov, anchor: MERGED[id].anchor };
        const p = findPlugin(id), h = p ? hostOf(p) : '';
        return h ? { tab: h, child: p } : { tab: id };
    }
    function setSub(id) {
        const r = resolveTab(id);
        if (!allTabs().some((t) => t.id === r.tab)) return;
        const hp = r.child ? findPlugin(r.child.host) : null;   // ให้แท็บเจ้าของเปิดมุมมองที่มีโมดูลนี้ (เช่น คู่มือ › ลำดับปฏิบัติ › สายงาน)
        if (hp && hp.reveal) { try { hp.reveal(r.child.id, API); } catch (e) { console.error('[cmd] reveal ' + hp.id, e); } }
        curSub = r.tab;
        if (r.ov) setOv(r.ov);
        try { localStorage.setItem(TAB_KEY, r.tab); } catch (e) { /* ไม่จำก็ได้ */ }
        render();
        const target = r.child ? r.child._el : r.anchor && shell ? shell.querySelector(r.anchor) : null;
        if (target && target.offsetParent) { window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 64), behavior: 'smooth' }); return; }
        // เลื่อนอยู่ลึกในเนื้อหา → กลับไปต้นเนื้อหาของแท็บใหม่ (ใต้แถบเหตุการณ์)
        const y = head ? head.getBoundingClientRect().bottom + window.scrollY - 4 : 0;
        if (head && window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
    }

    /* ---------------- โมดูลเสริม (แท็บของตัวเอง) ---------------- */
    // p = { id, label, icon, order, host?, mount(el, api), update(ev, api), visible(on, api), shows?(childId), reveal?(childId) }
    function registerSection(p) {
        if (!p || !p.id || plugins.some((x) => x.id === p.id) || CORE_TABS.some((t) => t.id === p.id)) return;
        plugins.push(p);
        if (ext) { mountPlugins(); render(); }
    }
    function mountPlugins() {
        plugins.slice().sort((a, b) => (a.order || 50) - (b.order || 50)).forEach((p) => {
            if (!p._el) {
                const el = document.createElement('section');
                el.className = 'cmd-ext-pane'; el.dataset.ext = p.id; el.hidden = true;
                p._el = el; p._on = false;
                ext.appendChild(el);
                try { if (p.mount) p.mount(el, API); }
                catch (e) { console.error('[cmd] mount ' + p.id, e); el.innerHTML = '<div class="cmd-card"><div class="cmd-empty">โหลดส่วนนี้ไม่สำเร็จ</div></div>'; }
            }
        });
    }
    function syncPlugins() {
        const shown = !!root && !root.hidden && !document.hidden;
        plugins.forEach((p) => {
            if (!p._el) return;
            const h = hostOf(p), hp = h && h !== 'overview' ? findPlugin(h) : null;
            if (hp && hp._el && hp._el.nextElementSibling !== p._el) hp._el.after(p._el);   // วางต่อท้ายแท็บเจ้าของ
            if (h === 'overview' && p.top && topBox && p._el.parentNode !== topBox) topBox.appendChild(p._el);   // บนสุดของหน้าภาพรวม (ก่อนการ์ดสรุป)
            let here = curSub === (h || p.id);
            if (here && hp && hp.shows) { try { here = !!hp.shows(p.id, API); } catch (e) { here = false; } }
            const on = shown && here;
            p._el.hidden = !here;
            try { if (p.update) p.update(active(), API); } catch (e) { console.error('[cmd] update ' + p.id, e); }
            if (on !== p._on) { p._on = on; try { if (p.visible) p.visible(on, API); } catch (e) { console.error('[cmd] visible ' + p.id, e); } }
        });
        // กล่องที่ไม่มีแผงแสดงอยู่ → ซ่อน (ไม่เหลือช่องว่างระหว่างการ์ด)
        [topBox, ext].forEach((box) => { if (box) box.hidden = ![...box.children].some((c) => !c.hidden); });
    }

    /* ---------------- วาดหน้าจอ ---------------- */
    function render() {
        if (!core) return;
        const ev = active();
        const now = Date.now();
        const tabs = allTabs();
        if (!tabs.some((t) => t.id === curSub)) { const r = resolveTab(curSub); curSub = tabs.some((t) => t.id === r.tab) ? r.tab : 'overview'; }
        const events = state.events.slice().sort((a, b) => (startOf(a) || 0) - (startOf(b) || 0));
        const chips = events.map((e) => {
            const s = startOf(e), past = (endOf(e) || s || Infinity) < now;
            return '<button type="button" class="cmd-chip' + (e.id === state.activeId ? ' on' : '') + (past ? ' past' : '') + '" data-act="switch" data-id="' + esc(e.id) + '">' +
                '<i class="cmd-dot ' + esc(e.level) + '"></i><span><b>' + esc(e.title) + '</b><small>' + (s ? thDateShort(s) + ' · ' + hmStr(e.start) : 'ยังไม่กำหนดวัน') + (past ? ' · ผ่านแล้ว' : '') + '</small></span></button>';
        }).join('');

        shell.dataset.level = ev ? ev.level : 'green';
        head.innerHTML =
            '<div class="cmd-topbar">' +
                '<div class="cmd-brand"><div class="cmd-brand-ic"><i class="fa-solid fa-tower-broadcast"></i></div>' +
                    '<div><b>กระดานสถานการณ์ & บริหารเหตุการณ์</b><small>Smart Command Board · สน.ลำหิน</small></div></div>' +
                '<div class="cmd-clock"><b data-tick="clock">--:--:--</b><small data-tick="today">-</small></div>' +
            '</div>' +
            '<div class="cmd-evbar" aria-label="เหตุการณ์">' + chips +
                '<button type="button" class="cmd-chip add" data-act="add"><i class="fa-solid fa-plus"></i> เพิ่มเหตุการณ์ใหม่</button></div>';
        tabsEl.innerHTML = tabs.map((t) =>
            '<button type="button" role="tab" class="cmd-tab' + (t.id === curSub ? ' on' : '') + '" data-act="subtab" data-tab="' + esc(t.id) + '" aria-selected="' + (t.id === curSub) + '">' +
            '<i class="fa-solid ' + esc(t.icon) + '"></i><span>' + esc(t.label) + '</span></button>').join('');
        const onTab = tabsEl.querySelector('.cmd-tab.on');   // มือถือ: เลื่อนแถบให้เห็นแท็บที่เปิดอยู่
        if (onTab && tabsEl.scrollWidth > tabsEl.clientWidth) tabsEl.scrollLeft = Math.max(0, onTab.offsetLeft - (tabsEl.clientWidth - onTab.offsetWidth) / 2);

        const isCore = curSub === 'overview';
        core.hidden = !isCore;
        if (!isCore) core.innerHTML = '';
        else if (!ev) core.innerHTML = '<div class="cmd-grid cmd-g-one"><section class="cmd-card"><div class="cmd-empty"><i class="fa-solid fa-calendar-plus"></i>ยังไม่มีเหตุการณ์ — กด <b>+ เพิ่มเหตุการณ์ใหม่</b> เพื่อเริ่มต้น</div></section></div>';
        else core.innerHTML = ovTabsHtml(ev, now) + ovBodyHtml(ev, now);

        lastPhaseKey = ev ? phase(ev, now).key : '';
        syncPlugins();
        tick();
    }

    function ovTabsHtml(ev, now) {
        const hot = ev.alerts.some((a) => { const st = alertStatus(ev, a, now); return st && /bad|warn|live/.test(st.cls); });
        return '<nav class="cmd-subtabs" role="tablist" aria-label="หัวข้อในภาพรวม">' + OV_TABS.map((t) =>
            '<button type="button" role="tab" class="cmd-subtab' + (t.id === ovSub ? ' on' : '') + '" data-act="ovsub" data-v="' + t.id + '" aria-selected="' + (t.id === ovSub) + '">' +
            (t.id === 'time' ? '<i class="cmd-dot ' + esc(ev.level) + '" title="ระดับปัจจุบัน"></i>' : '<i class="fa-solid ' + t.icon + '"></i>') + '<span>' + t.label + '</span>' +
            (t.id === 'legal' && hot ? '<em class="cmd-flag" title="มีรายการที่ต้องดำเนินการ"></em>' : '') + '</button>').join('') + '</nav>';
    }
    function ovBodyHtml(ev, now) {
        if (ovSub === 'time') return '<div class="cmd-grid cmd-g-pair">' + countHtml(ev, now) + levelHtml(ev) + '</div>';
        if (ovSub === 'legal') return '<div class="cmd-grid cmd-g-one">' + alertsMiniHtml(ev, now) + '</div>';
        if (ovSub === 'contact') return '<div class="cmd-grid cmd-g-one">' + quickHtml(ev) + '</div>';
        return '<div class="cmd-grid cmd-g-one">' + heroHtml(ev) + '</div>';
    }

    // ข้อกฎหมายชี้ขาด (ที่เดียวของกระดาน) — แตะหัวข้อเพื่อดูรายละเอียด · งานที่มีเส้นตายติ๊ก "ดำเนินการแล้ว" ได้ทันที
    function alertsMiniHtml(ev, now) {
        const rows = ev.alerts.map((a) => {
            const st = alertStatus(ev, a, now), open = alOpen.has(a.id);
            return '<div class="cmd-almini' + (open ? ' open' : '') + '" data-tone="' + esc(a.tone) + '">' +
                '<button type="button" class="cmd-almini-h" data-act="almore" data-id="' + esc(a.id) + '" aria-expanded="' + open + '"><i class="fa-solid ' + esc(a.icon || 'fa-scale-balanced') + '"></i>' +
                    '<span><b>' + esc(a.title) + '</b><small>' + esc(a.law) + '</small>' +
                    (st ? '<em class="st ' + st.cls + '" data-tick="al" data-id="' + esc(a.id) + '">' + esc(st.text) + '</em>' : '') + '</span>' +
                    (a.detail ? '<i class="fa-solid fa-chevron-down cmd-almini-chev"></i>' : '') + '</button>' +
                (a.kind === 'due' ? '<button type="button" class="cmd-al-ck' + (a.done ? ' on' : '') + '" data-act="aldone" data-id="' + esc(a.id) + '"><i class="fa-' + (a.done ? 'solid fa-square-check' : 'regular fa-square') + '"></i> ดำเนินการแล้ว</button>' : '') +
                (open && a.detail ? '<div class="cmd-almini-more">' + esc(a.detail) + '</div>' : '') +
                '</div>';
        }).join('');
        return '<section class="cmd-card cmd-alerts">' +
            '<div class="cmd-card-h"><i class="fa-solid fa-thumbtack"></i><h4>ข้อกฎหมายชี้ขาด</h4><small>แตะเพื่อดูรายละเอียด</small></div>' +
            (rows ? '<div class="cmd-almini-list">' + rows + '</div>' : '<div class="cmd-empty" style="padding:14px">ยังไม่มีแถบแจ้งเตือน — เพิ่มได้ที่ "แก้ไข"</div>') +
            '</section>';
    }

    function heroHtml(ev) {
        const s = startOf(ev);
        const rows = [];
        const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
        rows.push('<li><i class="fa-regular fa-calendar"></i><span><b>' + (s ? DOW[new Date(s).getDay()] + ' ' + thDateShort(s) : 'ยังไม่กำหนดวัน') + ' · ' + hmStr(ev.start).replace(/\s*น\.$/, '') + '–' + hmStr(ev.end) + '</b>' +
            (ev.muster ? ' <span class="cmd-mute">(' + esc(musterShort(ev)) + ' ' + hmStr(ev.muster) + ')</span>' : '') + '</span></li>');
        if (ev.place) rows.push('<li><i class="fa-solid fa-location-dot"></i><span>' + esc(ev.place) + (ev.distance ? ' <span class="cmd-mute">· ' + esc(ev.distance) + '</span>' : '') + '</span></li>');
        if (ev.crowd) rows.push('<li><i class="fa-solid fa-people-group"></i><span>' + esc(ev.crowd) + '</span></li>');
        // ผู้จัด: แสดงชื่อ + เบอร์ (อายุ/เลขบัตร/ที่อยู่ ดูได้ใน "แก้ไข") · ผู้ประสานงาน: ชื่ออย่างเดียว (เบอร์อยู่ในการ์ดปุ่มลัด)
        const org = String(ev.organizer || ''), orgName = org.split(/\s+อายุ|\s*\(|\s+เลขประจำตัว|\s*·/)[0].trim();
        const orgTel = (org.match(/0\d{1,2}-?\d{3}-?\d{4}/g) || []).pop() || '';
        const coNames = String(ev.coordinators || '').split(/\s*·\s*|\s*,\s*/).map((x) => x.replace(/^\d+\)\s*/, '').replace(/\s*โทร\.?.*$/, '').trim()).filter(Boolean);
        if (orgName || coNames.length) rows.push('<li><i class="fa-solid fa-user-tie"></i><span>' +
            (orgName ? '<b>ผู้จัด</b> ' + esc(orgName) + (orgTel ? ' <span class="cmd-mute">' + esc(orgTel) + '</span>' : '') : '') +
            (coNames.length ? (orgName ? '<br>' : '') + '<b>ผู้ประสาน</b> ' + esc(coNames.join(', ')) : '') + '</span></li>');
        return '<section class="cmd-card cmd-hero">' +
            '<div class="cmd-hero-top"><div class="cmd-hero-txt">' +
                '<span class="cmd-tag"><i class="fa-solid fa-bullhorn"></i>' + esc(ev.category) + '</span>' +
                '<h2>' + esc(ev.title) + '</h2>' +
            '</div></div>' +
            '<ul class="cmd-meta">' + rows.join('') + '</ul>' +
            '<div class="cmd-tools">' +
                '<button type="button" class="cmd-btn line" data-act="line"><i class="fa-brands fa-line"></i> ส่ง LINE</button>' +
                '<button type="button" class="cmd-btn" data-act="edit"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>' +
                '<button type="button" class="cmd-btn ic" data-act="export" title="Export JSON" aria-label="Export JSON"><i class="fa-solid fa-file-export"></i><span> Export</span></button>' +
                '<button type="button" class="cmd-btn ic" data-act="import" title="Import JSON" aria-label="Import JSON"><i class="fa-solid fa-file-import"></i><span> Import</span></button>' +
            '</div></section>';
    }

    function countHtml(ev, now) {
        const ms = [];
        if (ev.muster) ms.push({ k: 'muster', ic: 'fa-flag', t: musterShort(ev), hm: ev.muster, at: musterOf(ev) });
        if (ev.start) ms.push({ k: 'start', ic: 'fa-play', t: 'เริ่ม', hm: ev.start, at: startOf(ev) });
        if (ev.end) ms.push({ k: 'end', ic: 'fa-flag-checkered', t: 'สิ้นสุดตามแจ้ง', hm: ev.end, at: endOf(ev) });
        const nextIdx = ms.findIndex((x) => x.at != null && x.at > now);
        return '<section class="cmd-card cmd-count">' +
            '<div class="cmd-card-h"><i class="fa-solid fa-stopwatch"></i><h4>นับถอยหลัง</h4><small data-tick="evdate">' + (startOf(ev) ? thDateShort(startOf(ev)) : '') + '</small></div>' +
            '<div class="cmd-main" data-tick="main"></div>' +
            '<div class="cmd-ms">' + ms.map((x, i) =>
                '<div class="cmd-ms-row' + (x.at != null && x.at <= now ? ' done' : '') + (i === nextIdx ? ' next' : '') + '">' +
                    '<div class="cmd-ms-ic"><i class="fa-solid ' + x.ic + '"></i></div>' +
                    '<div class="cmd-ms-txt"><b>' + esc(x.t) + '</b><small>' + hmStr(x.hm) + '</small></div>' +
                    '<div class="cmd-ms-left" data-tick="ms" data-at="' + (x.at || '') + '"></div></div>').join('') +
            '</div></section>';
    }

    function levelHtml(ev) {
        const log = ev.levelLog.slice(-4).reverse();
        return '<section class="cmd-card cmd-level">' +
            '<div class="cmd-card-h"><i class="fa-solid fa-traffic-light"></i><h4>ระดับสถานการณ์</h4><small>แตะเพื่อเปลี่ยน</small></div>' +
            '<div class="cmd-lvlist">' + Object.keys(LEVELS).map((k) => {
                const L = LEVELS[k];
                return '<button type="button" class="cmd-lv' + (ev.level === k ? ' on' : '') + '" data-act="level" data-lv="' + k + '" aria-pressed="' + (ev.level === k) + '">' +
                    '<i class="cmd-lv-dot fa-solid ' + L.icon + '"></i><span><b>' + L.emoji + ' ' + L.name + '</b><small>' + L.desc + '</small></span><em class="cmd-lv-on">ปัจจุบัน</em></button>';
            }).join('') + '</div>' +
            (log.length ? '<ul class="cmd-lvlog">' + log.map((x) => '<li><i class="cmd-dot ' + esc(x.level) + '"></i><b>' + thDateShort(Date.parse(x.at)) + ' ' + hmTh(Date.parse(x.at)) + '</b> ปรับเป็น' + (LEVELS[x.level] || {}).name + '</li>').join('') + '</ul>' : '') +
            '</section>';
    }


    function quickHtml(ev) {
        const calls = ev.contacts.map((c) => {
            const has = !!String(c.phone || '').trim();
            const inner = '<div class="cmd-call-ic"><i class="fa-solid ' + (has ? 'fa-phone' : 'fa-phone-slash') + '"></i></div>' +
                '<div class="cmd-call-txt"><b>' + esc(c.name) + '</b><small>' + esc(c.role) + '</small><em>' + (has ? esc(c.phone) : 'แตะเพื่อใส่เบอร์') + (c.local ? ' <i class="fa-solid fa-lock" title="เก็บเฉพาะเครื่องนี้"></i>' : '') + '</em></div>';
            return '<div style="position:relative">' +
                (has ? '<a class="cmd-call" href="' + esc(telHref(c.phone)) + '">' + inner + '</a>'
                     : '<button type="button" class="cmd-call empty" data-act="contact" data-id="' + esc(c.id) + '">' + inner + '</button>') +
                '<button type="button" class="cmd-call-ed" data-act="contact" data-id="' + esc(c.id) + '" title="แก้ไข" aria-label="แก้ไขเบอร์ ' + esc(c.name) + '"><i class="fa-solid fa-pen"></i></button></div>';
        }).join('');
        return '<section class="cmd-card cmd-quick">' +
            '<div class="cmd-card-h"><i class="fa-solid fa-bolt"></i><h4>ปุ่มลัด & เบอร์โทร</h4></div>' +
            '<div class="cmd-maps">' +
                (ev.id === SEED_ID && findPlugin('map3d') ? '' : '<a class="cmd-map" href="' + esc(mapUrl(ev)) + '" target="_blank" rel="noopener"><i class="fa-solid fa-map-location-dot"></i><span><b>แผนที่จุดเหตุ</b><small>Google Maps</small></span></a>') +
                '<a class="cmd-map" href="' + esc(dirUrl(ev)) + '" target="_blank" rel="noopener"><i class="fa-solid fa-route"></i><span><b>นำทางจาก สน.</b><small>' + esc(ev.distance || 'เส้นทางขับรถ') + '</small></span></a>' +
            '</div>' +
            '<div class="cmd-calls">' + calls + '<button type="button" class="cmd-call add" data-act="contact" data-id=""><i class="fa-solid fa-plus"></i> เพิ่มเบอร์ติดต่อ</button></div>' +
            (ev.contacts.some((c) => c.local) ? '<div class="cmd-note"><i class="fa-solid fa-shield-halved"></i><span>เบอร์ประชาชนเก็บเฉพาะในเครื่องนี้</span></div>' : '') +
            '</section>';
    }

    /* ---------------- อัปเดตทุกวินาที (เฉพาะตัวเลข) ---------------- */
    function tick() {
        if (!root || !root.firstChild) return;
        const now = Date.now(), d = new Date(now);
        const clock = root.querySelector('[data-tick="clock"]');
        if (clock) clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        const today = root.querySelector('[data-tick="today"]');
        if (today) today.textContent = thDateShort(now);
        const ev = active();
        if (!ev) return;
        const ph = phase(ev, now);
        if (ph.key !== lastPhaseKey) { render(); return; }   // เปลี่ยนช่วง (เช่น ถึงเวลาเริ่ม) วาดใหม่ทั้งหน้า

        const main = root.querySelector('[data-tick="main"]');
        if (main) {
            if (ph.mode === 'nodate') {
                main.className = 'cmd-main';
                main.innerHTML = '<div class="cmd-main-lb">ยังไม่กำหนดวัน/เวลาเริ่ม — กด "แก้ไขเหตุการณ์"</div>';
            } else {
                const diff = ph.mode === 'over' ? now - ph.target : ph.target - now;
                const x = split(diff);
                main.className = 'cmd-main' + (ph.mode === 'live' ? ' live' : ph.mode === 'over' ? ' over' : '');
                const cells = (x.d ? [[x.d, 'วัน']] : []).concat([[x.h, 'ชั่วโมง'], [x.m, 'นาที'], [x.s, 'วินาที']]);
                main.innerHTML = '<div class="cmd-main-lb">' + ph.label + '</div>' +
                    '<div class="cmd-digits">' + cells.map((c) => '<div class="cmd-digit"><b>' + (c[1] === 'วัน' ? c[0] : pad(c[0])) + '</b><small>' + c[1] + '</small></div>').join('') + '</div>' +
                    (ph.mode === 'over' ? '<div class="cmd-main-note">เลยเวลามาแล้ว · ' + esc(ph.note) + '</div>' : ph.note ? '<div class="cmd-main-note">' + esc(ph.note) + '</div>' : '');
            }
        }
        root.querySelectorAll('[data-tick="ms"]').forEach((el) => {
            const t = Number(el.dataset.at);
            el.textContent = !t ? '-' : t > now ? 'อีก ' + human(t - now) : '✓ ผ่านแล้ว';
        });
        root.querySelectorAll('[data-tick="al"]').forEach((el) => {
            const a = ev.alerts.find((x) => x.id === el.dataset.id);
            const st = a && alertStatus(ev, a, now);
            if (st) { el.textContent = st.text; el.className = 'st ' + st.cls; }
        });
    }
    function startTimer() { if (!timer) { tick(); timer = setInterval(tick, 1000); } }
    function stopTimer() { clearInterval(timer); timer = 0; }

    /* ---------------- การกระทำ ---------------- */
    function onClick(e) {
        const b = e.target.closest('[data-act]');
        if (!b || !root.contains(b)) return;
        const act = b.dataset.act, ev = active();
        if (act === 'subtab') { setSub(b.dataset.tab); return; }
        if (act === 'ovsub') { setOv(b.dataset.v); render(); return; }
        if (act === 'switch') { state.activeId = b.dataset.id; save(); render(); return; }
        if (act === 'add') { eventForm(null); return; }
        if (!ev) return;
        if (act === 'edit') eventForm(ev);
        else if (act === 'level') setLevel(ev, b.dataset.lv);
        else if (act === 'almore') { const id = b.dataset.id; if (alOpen.has(id)) alOpen.delete(id); else alOpen.add(id); render(); }
        else if (act === 'aldone') {
            const a = ev.alerts.find((x) => x.id === b.dataset.id); if (!a) return;
            a.done = !a.done; a.doneAt = a.done ? new Date().toISOString() : '';
            save(); render();
        } else if (act === 'contact') { e.preventDefault(); contactForm(ev, b.dataset.id); }
        else if (act === 'line') copyText(lineSummary(ev));
        else if (act === 'export') exportJson();
        else if (act === 'import') importJson();
    }

    function setLevel(ev, lv) {
        if (!LEVELS[lv] || ev.level === lv) return;
        ev.level = lv;
        ev.levelLog.push({ at: new Date().toISOString(), level: lv });
        save(); render();
        toast('ปรับเป็น' + LEVELS[lv].name + ' แล้ว (' + hmTh(Date.now()) + ')');
    }

    /* ---------------- สรุปส่ง LINE ---------------- */
    function lineSummary(ev) {
        const now = Date.now(), s = startOf(ev), lv = LEVELS[ev.level], ph = phase(ev, now);
        const last = ev.levelLog[ev.levelLog.length - 1];
        const L = [];
        L.push('📢 สรุปสถานการณ์ | ' + ev.title);
        L.push('🗓 ' + (s ? thDateLong(s) : 'ยังไม่กำหนดวัน') + ' เวลา ' + hmStr(ev.start) + '–' + hmStr(ev.end) + (ev.muster ? ' (' + (ev.musterLabel || 'รวมพล') + ' ' + hmStr(ev.muster) + ')' : ''));
        if (ev.place) L.push('📍 ' + ev.place + (ev.distance ? ' · ' + ev.distance : ''));
        if (ev.crowd) L.push('👥 ' + ev.crowd);
        L.push('🚦 ระดับสถานการณ์: ' + lv.emoji + ' ' + lv.name + ' — ' + lv.desc + (last ? ' (ปรับเมื่อ ' + hmTh(Date.parse(last.at)) + ')' : ''));
        if (ph.mode === 'pre') L.push('⏱ อีก ' + human(ph.target - now) + ' ถึง' + (ph.key === 'pre' ? (ev.musterLabel || 'เวลารวมพล') + ' ' + hmStr(ev.muster) : 'เวลาเริ่ม ' + hmStr(ev.start)));
        else if (ph.mode === 'live') L.push('⏱ กำลังดำเนินการ' + (ph.key === 'live' ? ' · เหลือ ' + human(ph.target - now) + ' ถึงเวลาสิ้นสุด ' + hmStr(ev.end) : ''));
        else if (ph.mode === 'over') L.push('⏱ เลยเวลาสิ้นสุดตามแจ้งมาแล้ว ' + human(now - ph.target));
        if (ev.alerts.length) {
            L.push('');
            L.push('⚖️ ข้อกฎหมายที่ต้องเฝ้าระวัง');
            ev.alerts.forEach((a, i) => {
                const st = alertStatus(ev, a, now);
                L.push((i + 1) + ') ' + (a.law ? '[' + a.law + '] ' : '') + a.title + (st ? ' — ' + st.text : ''));
            });
        }
        if (ev.ref) { L.push(''); L.push('📝 ' + ev.ref); }
        L.push('');
        L.push('ข้อมูล ณ ' + thDateShort(now) + ' ' + hmTh(now) + ' · กระดานสถานการณ์ สน.ลำหิน');
        return L.join('\n');
    }

    /* ---------------- Export / Import ---------------- */
    function exportJson() {
        const d = new Date();
        const name = 'lamhin-command-board-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
        const text = JSON.stringify(Object.assign({ app: 'lamhin-command-board', exportedAt: d.toISOString() }, state), null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        try {
            const file = new File([blob], name, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
                navigator.share({ files: [file], title: name }).catch(() => {});
                return;
            }
        } catch (e) { /* ไม่รองรับ File/share → ดาวน์โหลดปกติ */ }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('ส่งออกไฟล์ ' + name + ' แล้ว');
    }
    function importJson() {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'application/json,.json';
        inp.onchange = () => {
            const f = inp.files && inp.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                let data;
                try { data = JSON.parse(String(r.result || '')); } catch (e) { toast('ไฟล์นี้ไม่ใช่ JSON ที่อ่านได้'); return; }
                if (!data || !Array.isArray(data.events)) { toast('ไม่พบรายการเหตุการณ์ในไฟล์'); return; }
                const n = data.events.length;
                modal({
                    title: 'นำเข้าข้อมูล', icon: 'fa-file-import',
                    body: '<p style="margin:0 0 8px">ไฟล์ <b>' + esc(f.name) + '</b> มี ' + n + ' เหตุการณ์</p><p style="margin:0;color:#93A7C4;font-size:0.84rem">เลือก "รวมกับของเดิม" เพื่อเพิ่ม/อัปเดตตามรหัสเหตุการณ์ หรือ "แทนที่ทั้งหมด" เพื่อใช้ข้อมูลจากไฟล์อย่างเดียว</p>',
                    actions: [
                        { label: 'แทนที่ทั้งหมด', cls: 'danger', run: (close) => { state = { version: VERSION, activeId: data.activeId || '', events: data.events.map(normalize), updatedAt: '' }; finishImport(close); } },
                        { label: 'รวมกับของเดิม', cls: 'gold', run: (close) => {
                            data.events.map(normalize).forEach((e) => {
                                const i = state.events.findIndex((x) => x.id === e.id);
                                if (i > -1) state.events[i] = e; else state.events.push(e);
                            });
                            finishImport(close);
                        } }
                    ]
                });
            };
            r.readAsText(f, 'utf-8');
        };
        inp.click();
        function finishImport(close) {
            if (!state.events.some((e) => e.id === state.activeId)) state.activeId = pickDefault(state.events);
            save(); render(); close(); toast('นำเข้าข้อมูลแล้ว');
        }
    }

    /* ---------------- หน้าต่างซ้อน ---------------- */
    function modal(o) {
        const wrap = document.createElement('div');
        wrap.className = 'cmd-modal';
        wrap.innerHTML = '<div class="cmd-modal-box" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
            '<div class="cmd-modal-h"><i class="fa-solid ' + esc(o.icon || 'fa-pen') + '"></i><h3>' + esc(o.title) + '</h3><button type="button" class="cmd-modal-x" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="cmd-modal-b">' + o.body + '</div>' +
            '<div class="cmd-modal-f">' + (o.actions || []).map((a, i) => '<button type="button" class="cmd-btn ' + (a.cls || '') + '" data-i="' + i + '">' + a.label + '</button>').join('') + '</div></div>';
        const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        wrap.addEventListener('click', (e) => {
            if (e.target === wrap || e.target.closest('.cmd-modal-x')) { close(); return; }
            const b = e.target.closest('.cmd-modal-f [data-i]');
            if (b) o.actions[Number(b.dataset.i)].run(close, wrap);
        });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(wrap);
        if (o.onOpen) o.onOpen(wrap);
        const first = wrap.querySelector('input, select, textarea');
        if (first && window.innerWidth > 700) first.focus();
        return wrap;
    }
    function showText(title, text) {
        modal({ title: title, icon: 'fa-copy', body: '<div class="cmd-f"><textarea style="min-height:240px" readonly>' + esc(text) + '</textarea></div><p class="cmd-hint">กดค้างที่ข้อความ → เลือกทั้งหมด → คัดลอก</p>', actions: [{ label: 'ปิด', run: (c) => c() }] });
    }
    const field = (label, name, val, type, extra) =>
        '<label class="cmd-f ' + ((extra && extra.cls) || '') + '"><span>' + label + '</span>' +
        (type === 'textarea' ? '<textarea name="' + name + '">' + esc(val) + '</textarea>'
            : type === 'select' ? '<select name="' + name + '">' + extra.options.map((op) => '<option value="' + esc(op[0]) + '"' + (op[0] === val ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select>'
            : '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(val) + '"' + (extra && extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : '') + (extra && extra.mode ? ' inputmode="' + extra.mode + '"' : '') + '>') +
        '</label>';
    const formVal = (box, name) => { const el = box.querySelector('[name="' + name + '"]'); return el ? String(el.value || '').trim() : ''; };

    /* ---------------- ฟอร์มเหตุการณ์ (เพิ่ม/แก้ไข/ลบ) ---------------- */
    function eventForm(ev) {
        const isNew = !ev;
        const draft = normalize(ev ? JSON.parse(JSON.stringify(ev)) : { category: 'ชุมนุมสาธารณะ', title: '', muster: '', start: '', end: '', contacts: defaultContacts(false) });
        const alertRows = () => draft.alerts.length ? draft.alerts.map((a, i) =>
            '<div class="cmd-mini-row"><i class="fa-solid ' + esc(a.icon) + '" style="color:#D4AF37"></i><span><b>' + esc(a.law || 'ข้อกฎหมาย') + '</b> · ' + esc(a.title) + '</span>' +
            '<button type="button" class="cmd-btn sm danger" data-al-del="' + i + '"><i class="fa-solid fa-trash"></i></button></div>').join('')
            : '<div class="cmd-hint">ยังไม่มีแถบแจ้งเตือน</div>';
        const body = '<div class="cmd-form">' +
            field('ชื่อเหตุการณ์ *', 'title', draft.title, 'text', { cls: 'full', ph: 'เช่น การชุมนุมสาธารณะ…' }) +
            field('ประเภท', 'category', draft.category, 'select', { options: CATEGORIES.map((c) => [c, c]) }) +
            field('วันที่ *', 'date', draft.date, 'date') +
            field('ข้อความจุดนัด', 'musterLabel', draft.musterLabel, 'text', { ph: 'รวมพล/ปล่อยแถว หน้า สน.ลำหิน' }) +
            field('เวลารวมพล/ปล่อยแถว', 'muster', draft.muster, 'time') +
            field('เวลาเริ่มเหตุการณ์ *', 'start', draft.start, 'time') +
            field('เวลาสิ้นสุด', 'end', draft.end, 'time') +
            field('สถานที่', 'place', draft.place, 'text', { cls: 'full' }) +
            field('ระยะทาง/หมายเหตุสถานที่', 'distance', draft.distance, 'text', { ph: 'เช่น จาก สน.ลำหิน ทางรถ ~2.8 กม.' }) +
            field('คำค้นหาใน Google Maps', 'mapQuery', draft.mapQuery, 'text') +
            field('พิกัด (lat, lng) ถ้ามี', 'latlng', draft.latlng, 'text', { cls: 'full', ph: 'เช่น 13.8xxxx, 100.8xxxx (กดค้างบนแผนที่เพื่อคัดลอกพิกัด)', mode: 'decimal' }) +
            field('มวลชน/รูปแบบ', 'crowd', draft.crowd, 'textarea', { cls: 'full' }) +
            field('ผู้จัด / ผู้รับผิดชอบเหตุการณ์', 'organizer', draft.organizer, 'textarea', { cls: 'full' }) +
            field('ผู้ประสานงาน', 'coordinators', draft.coordinators, 'textarea', { cls: 'full' }) +
            field('หลักฐานรับแจ้ง/อ้างอิง', 'ref', draft.ref, 'textarea', { cls: 'full' }) +
            field('เขตอำนาจศาล', 'court', draft.court, 'text', { cls: 'full' }) +
            '<div class="cmd-sec-h"><i class="fa-solid fa-thumbtack"></i> แถบแจ้งเตือนข้อกฎหมาย</div>' +
            '<div class="cmd-mini" data-al-list>' + alertRows() + '</div>' +
            '<div class="cmd-sec-h" style="color:#00D2FF"><i class="fa-solid fa-plus"></i> เพิ่มแถบแจ้งเตือน</div>' +
            field('อ้างอิงมาตรา', 'al_law', '', 'text', { ph: 'เช่น ม.18 · โทษ ม.28' }) +
            field('สีแถบ', 'al_tone', 'gold', 'select', { options: Object.keys(TONES).map((k) => [k, TONES[k]]) }) +
            field('หัวข้อแจ้งเตือน', 'al_title', '', 'text', { cls: 'full' }) +
            field('รายละเอียด', 'al_detail', '', 'textarea', { cls: 'full' }) +
            field('ชนิด', 'al_kind', 'static', 'select', { options: [['static', 'ข้อความคงที่'], ['due', 'มีเส้นตาย (นับถอยหลัง)'], ['window', 'ช่วงเวลาห้ามในวันเหตุการณ์']] }) +
            field('เส้นตาย (ชนิดมีเส้นตาย)', 'al_due', '', 'datetime-local') +
            field('ช่วงห้าม เริ่ม', 'al_from', '', 'time') +
            field('ช่วงห้าม สิ้นสุด', 'al_to', '', 'time') +
            '<div class="full" style="grid-column:1/-1"><button type="button" class="cmd-btn neon sm" data-al-add><i class="fa-solid fa-plus"></i> เพิ่มแถบนี้</button></div>' +
            '</div>';
        const actions = [];
        if (!isNew) actions.push({ label: '<i class="fa-solid fa-trash"></i> ลบเหตุการณ์', cls: 'danger', run: (close) => {
            if (!window.confirm('ลบเหตุการณ์ "' + ev.title + '" ?\nข้อมูลในเครื่องนี้จะหายถาวร (แนะนำ Export JSON เก็บไว้ก่อน)')) return;
            state.events = state.events.filter((x) => x.id !== ev.id);
            state.activeId = pickDefault(state.events);
            save(); render(); close(); toast('ลบเหตุการณ์แล้ว');
        } });
        actions.push({ label: 'ยกเลิก', run: (close) => close() });
        actions.push({ label: isNew ? '<i class="fa-solid fa-plus"></i> สร้างเหตุการณ์' : '<i class="fa-solid fa-floppy-disk"></i> บันทึก', cls: 'gold', run: (close, box) => {
            ['title', 'category', 'date', 'musterLabel', 'muster', 'start', 'end', 'place', 'distance', 'mapQuery', 'latlng', 'crowd', 'organizer', 'coordinators', 'ref', 'court'].forEach((k) => { draft[k] = formVal(box, k); });
            if (!draft.title) { toast('กรุณากรอกชื่อเหตุการณ์'); return; }
            if (!draft.date || !draft.start) { toast('กรุณากรอกวันที่และเวลาเริ่ม'); return; }
            if (isNew) { state.events.push(draft); state.activeId = draft.id; }
            else { const i = state.events.findIndex((x) => x.id === ev.id); if (i > -1) state.events[i] = draft; }
            save(); render(); close(); toast(isNew ? 'สร้างเหตุการณ์แล้ว' : 'บันทึกแล้ว');
        } });
        modal({
            title: isNew ? 'เพิ่มเหตุการณ์ใหม่' : 'แก้ไขเหตุการณ์', icon: isNew ? 'fa-calendar-plus' : 'fa-pen-to-square', body: body, actions: actions,
            onOpen: (box) => {
                box.addEventListener('click', (e) => {
                    const del = e.target.closest('[data-al-del]');
                    if (del) { draft.alerts.splice(Number(del.dataset.alDel), 1); box.querySelector('[data-al-list]').innerHTML = alertRows(); return; }
                    if (e.target.closest('[data-al-add]')) {
                        const t = formVal(box, 'al_title');
                        if (!t) { toast('กรุณากรอกหัวข้อแจ้งเตือน'); return; }
                        const kind = formVal(box, 'al_kind'), tone = formVal(box, 'al_tone');
                        draft.alerts.push({
                            id: uid('al'), tone: tone, kind: kind, law: formVal(box, 'al_law'), title: t, detail: formVal(box, 'al_detail'),
                            icon: kind === 'due' ? 'fa-hourglass-half' : kind === 'window' ? 'fa-clock' : tone === 'red' ? 'fa-bolt' : 'fa-scale-balanced',
                            due: kind === 'due' ? formVal(box, 'al_due') : '', from: kind === 'window' ? formVal(box, 'al_from') : '', to: kind === 'window' ? formVal(box, 'al_to') : '',
                            done: false, doneAt: ''
                        });
                        ['al_law', 'al_title', 'al_detail', 'al_due', 'al_from', 'al_to'].forEach((k) => { const el = box.querySelector('[name="' + k + '"]'); if (el) el.value = ''; });
                        box.querySelector('[data-al-list]').innerHTML = alertRows();
                        toast('เพิ่มแถบแจ้งเตือนแล้ว (กดบันทึกเพื่อยืนยัน)');
                    }
                });
            }
        });
    }

    /* ---------------- ฟอร์มเบอร์ติดต่อ ---------------- */
    function contactForm(ev, id) {
        const c = ev.contacts.find((x) => x.id === id);
        const isNew = !c;
        const d = c ? Object.assign({}, c) : { id: uid('ct'), name: '', role: '', phone: '' };
        const actions = [];
        if (!isNew) actions.push({ label: '<i class="fa-solid fa-trash"></i> ลบ', cls: 'danger', run: (close) => {
            ev.contacts = ev.contacts.filter((x) => x.id !== c.id); save(); render(); close();
        } });
        actions.push({ label: 'ยกเลิก', run: (close) => close() });
        actions.push({ label: '<i class="fa-solid fa-floppy-disk"></i> บันทึก', cls: 'gold', run: (close, box) => {
            d.name = formVal(box, 'name'); d.role = formVal(box, 'role'); d.phone = formVal(box, 'phone');
            if (!d.name) { toast('กรุณากรอกชื่อ'); return; }
            if (isNew) ev.contacts.push(d); else Object.assign(c, d);
            save(); render(); close(); toast('บันทึกเบอร์แล้ว');
        } });
        modal({
            title: isNew ? 'เพิ่มเบอร์ติดต่อ' : 'แก้ไขเบอร์ติดต่อ', icon: 'fa-address-book',
            body: '<div class="cmd-form">' +
                field('ยศ ชื่อ-สกุล / หน่วยงาน *', 'name', d.name, 'text', { cls: 'full' }) +
                field('ตำแหน่ง / บทบาท', 'role', d.role, 'text', { cls: 'full' }) +
                field('หมายเลขโทรศัพท์', 'phone', d.phone, 'tel', { cls: 'full', ph: '0xx-xxx-xxxx', mode: 'tel' }) +
                (d.local ? '<div class="cmd-hint"><i class="fa-solid fa-lock"></i> ข้อมูลประชาชน — เก็บไว้เฉพาะในเครื่องนี้ ไม่ขึ้นเว็บสาธารณะ (ถ้า Export JSON ไฟล์จะมีเบอร์นี้ด้วย ส่งต่อเฉพาะในหน่วย)</div>' : '') +
                '</div>',
            actions: actions
        });
    }

    /* ---------------- เริ่มทำงาน ---------------- */
    function init() {
        root = document.getElementById('pane-cmd');
        if (!root) return;
        state = load();
        root.innerHTML = '<div class="cmd-root"><div class="cmd-head"></div><nav class="cmd-tabs" role="tablist" aria-label="หัวข้อในกระดาน"></nav><div class="cmd-top"></div><div class="cmd-core"></div><div class="cmd-ext"></div></div>';
        shell = root.querySelector('.cmd-root');
        head = root.querySelector('.cmd-head');
        tabsEl = root.querySelector('.cmd-tabs');
        core = root.querySelector('.cmd-core');
        ext = root.querySelector('.cmd-ext');
        topBox = root.querySelector('.cmd-top');
        root.addEventListener('click', onClick);
        mountPlugins();
        render();
        // นับเวลาเฉพาะตอนแท็บนี้เปิดอยู่ (ประหยัดแบตมือถือ เหมือนฉาก 3 มิติของแท็บเวร สน.)
        const follow = () => { if (root.hidden || document.hidden) { stopTimer(); syncPlugins(); } else { render(); startTimer(); } };
        new MutationObserver(follow).observe(root, { attributes: true, attributeFilter: ['hidden'] });
        document.addEventListener('visibilitychange', follow);
        follow();
        // ลิงก์ตรง .../radio-app/#cmd (app.js รู้จักเฉพาะแท็บเดิม จึงเปิดแท็บนี้เอง)
        const openFromHash = () => { if ((location.hash || '').slice(1) === 'cmd' && typeof window.showTab === 'function' && root.hidden) window.showTab('cmd'); };
        // หน้าเริ่มต้นของเว็บ = แท็บ "เหตุการณ์" (ลิงก์ที่ระบุ #แท็บอื่น เช่น #station ยังเปิดแท็บนั้นตามเดิม)
        if (!(location.hash || '').slice(1) && typeof window.showTab === 'function' && root.hidden) window.showTab('cmd');
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
    }

    // เครื่องมือที่ส่งให้โมดูลเสริมใช้ (ไม่ต้องเขียนซ้ำ)
    const API = {
        KEY: KEY,
        get state() { return state; },
        active: active, save: save, render: render, openTab: setSub, syncSections: syncPlugins, lineSummary: lineSummary,
        toast: toast, copyText: copyText, modal: modal, showText: showText, field: field, formVal: formVal, esc: esc, uid: uid,
        thDateLong: thDateLong, thDateShort: thDateShort, hmTh: hmTh, hmStr: hmStr, pad: pad,
        startOf: startOf, endOf: endOf, musterOf: musterOf, phase: phase, LEVELS: LEVELS, STATION_NAME: STATION_NAME
    };
    window.LamhinCmd = Object.create(API, { registerSection: { value: registerSection } });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
