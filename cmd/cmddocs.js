/* =====================================================================
   คู่มือปฏิบัติงาน + ศูนย์หนังสือราชการพร้อมพิมพ์ (โมดูลเสริมของกระดานสถานการณ์)
   - แท็บ "คู่มือ & เอกสาร" ผ่าน LamhinCmd.registerSection({ id: 'docs', ... })
   - ข้อมูล: cmd/docs/manual.js (คู่มือ) · cmd/docs/templates.js (แบบหนังสือ) · cmd/docs/garuda.js (ตราครุฑจากโปรแกรม)
   - รูปแบบหนังสือตามโปรแกรม Case Glambing Management (backend/letterdocx.js = หนังสือภายนอก, backend/docx.js = บันทึกข้อความ)
     ระยะทุกค่าใช้ตัวเลขเดียวกับโปรแกรม (ซม.) ทั้งหน้าตัวอย่าง การพิมพ์ และไฟล์ Word (.docx)
   - ข้อความที่แก้: ev.docs[<templateId>] (เก็บเฉพาะช่องที่ต่างจากค่าตั้งต้น) · คู่มือ: ev.docs['manual:<sectionId>']
     ค่ากลางหน่วยงาน (เลขที่หนังสือ ที่ตั้ง โทร.): state.docPrefs
   - บันทึก ศปก. (ev.log) อ่านอย่างเดียว ใช้เติมคำร้องศาลและรายงานผล
   ===================================================================== */
(function () {
    'use strict';
    if (!window.LamhinCmd || typeof window.LamhinCmd.registerSection !== 'function') return;

    const SRC = (document.currentScript && document.currentScript.src) || '';
    const BASE = SRC ? SRC.replace(/[^/]*(\?.*)?$/, '') : new URL('cmd/', location.href).href;   // .../cmd/
    const VER = '8';
    const UI_KEY = 'lamhin_cmd_docs_ui';
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    const PX_CM = 96 / 2.54;

    let api = null, host = null, lastEvId = null, depsP = null, built = false;
    // มุมมองเริ่มต้น = ลำดับปฏิบัติ (ตารางเรียงเวลา) · ui.pv = 2 ย้ายผู้ที่เคยเปิดคู่มือไว้มาที่ลำดับปฏิบัติครั้งเดียว
    const UI_DEF = { view: 'plan', planBy: 'time', doc: '', open: {}, prompt: 34, mob: 'form', pv: 2 };
    let ui = (function () {
        try {
            const s = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
            if (s.pv !== 2) { s.view = 'plan'; s.planBy = 'time'; s.pv = 2; }
            return Object.assign({}, UI_DEF, s);
        } catch (e) { return Object.assign({}, UI_DEF); }
    })();
    function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ไม่จำก็ได้ */ } }

    /* ---------------- โหลดไฟล์ข้อมูล ---------------- */
    function loadScript(src) {
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = () => rej(new Error('โหลดไม่ได้: ' + src));
            document.head.appendChild(s);
        });
    }
    function deps() {
        if (!depsP) {
            // โหลดฟอนต์เอกสารก่อนจัดหน้า เพื่อให้วัดความกว้างจริงได้ (realCm)
            depsP = Promise.all(['docs/garuda.js', 'docs/manual.js', 'docs/templates.js', 'docs/plan.js'].map((f) => loadScript(BASE + f + '?v=' + VER)).concat([fontsReady()]))
                .catch((e) => { depsP = null; throw e; });
        }
        return depsP;
    }

    /* ---------------- เครื่องมือข้อความ ---------------- */
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toThai = (s) => String(s == null ? '' : s).replace(/[0-9]/g, (d) => String.fromCharCode(0x0E50 + Number(d)));
    const toArabic = (s) => String(s == null ? '' : s).replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0E50));
    const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const cm = (n) => (Math.round(n * 1000) / 1000) + 'cm';
    // ช่องที่ยังไม่มีข้อมูล "[ระบุ…]" → เส้นจุดให้เขียนด้วยมือ (หน้าตัวอย่างไฮไลต์สีเหลือง)
    const PH_RE = /\[([^\]\n]{1,160})\]/g;
    const PH_DOTS = '..................';
    // «…» = คำแนะนำ/ตัวอย่างตามคู่มือ สตช. — หน้าตัวอย่างแสดงตัวเอียงสีเทา · หน้าพิมพ์และ Word ไม่แสดง
    const HINT_RE = /\s*«[^»\n]{0,400}»/g;
    let showHints = false;
    const noHints = (s) => String(s == null ? '' : s).replace(HINT_RE, '');
    // แก้บนกระดาษ A4: ห่อข้อความแต่ละช่องด้วย span ระบุช่อง (data-ed) · บรรทัด (data-li) · ข้อความนำหน้าที่ไม่แสดงให้แก้ (data-pre)
    // · ส่วนของชื่อผู้ลงนาม (data-sr = rank / name) — หน้าตัวอย่างแตะแก้แล้วเขียนกลับเข้าช่องเดิม
    const ED = (key, li, html, pre, sr) => '<span class="ds-ed" data-ed="' + key + '"' + (li != null ? ' data-li="' + li + '"' : '') +
        (pre ? ' data-pre="' + esc(pre) + '"' : '') + (sr ? ' data-sr="' + sr + '"' : '') + '>' + html + '</span>';
    // เส้นจุด = ขีดเส้นใต้ตัวอักษรแบบจุด (ไม่พิมพ์ "....") — ช่อง [กรอก] และจุดต่อกัน 4 ตัวขึ้นไป กลายเป็นช่องว่างขีดเส้นใต้จุดกว้างเท่าเดิม
    const DOT_CM = 0.0914;   // ความกว้างจุด TH SarabunPSK 16 pt
    const NB = '\u00A0'.repeat(120);
    const blankU = (n, cls, title) => '<span class="ds-dl' + (cls ? ' ' + cls : '') + '"' + (title ? ' title="' + title + '"' : '') + ' style="width:' + (n * DOT_CM).toFixed(2) + 'cm">' + NB + '</span>';
    const tf = (th) => (s) => esc(th(s)).replace(HINT_RE, (m) => (showHints ? ' <span class="ds-hint">' + m.trim() + '</span>' : ''))
        .replace(PH_RE, (m, a) => blankU(PH_DOTS.length, 'ds-ph', 'กรอก: ' + a)).replace(/\.{4,}/g, (m) => blankU(m.length));
    const pad = (n) => String(n).padStart(2, '0');
    // ความกว้างโดยประมาณของข้อความไทย 16 pt (ซม.) — ตรงกับ letterTextCm_ ของโปรแกรม
    function textCm(text) {
        let w = 0;
        String(text || '').split('').forEach((ch) => {
            if (/[ัิ-ฺ็-๎]/.test(ch)) return;
            w += ch === ' ' ? 0.13 : /[0-9๐-๙]/.test(ch) ? 0.27 : /[a-zA-Z]/.test(ch) ? 0.2 : 0.22;
        });
        return Math.round(w * 100) / 100;
    }
    // ความกว้างจริงของ TH SarabunPSK 16 pt — ค่า advance width จากไฟล์ฟอนต์ cmd/fonts/THSarabunPSK.woff (unitsPerEm 1000)
    // ใช้จัดกึ่งกลางชื่อ/ตำแหน่งใต้คำลงท้ายและเส้นลงชื่อ ให้ตรงทั้งหน้าพิมพ์และ Word โดยไม่ขึ้นกับการโหลดฟอนต์
    // (ค่าประมาณ textCm นับจุด "." 0.22 ซม. แต่จริง 0.091 ซม.) · ช่อง [กรอก] นับเป็นเส้นจุด
    const ADV_ASCII = [216,147,208,403,361,585,423,120,190,190,285,411,162,216,162,270,362,362,362,362,362,362,362,362,362,362,162,162,411,411,411,283,536,400,378,406,431,351,351,425,441,147,264,376,353,548,441,486,378,487,379,352,379,466,390,588,418,366,424,196,262,196,412,352,204,344,401,331,401,374,206,311,390,143,155,316,200,601,390,398,401,401,217,282,238,390,341,507,318,337,321,208,153,208,416];
    const ADV_THAI = [386,378,382,393,393,408,294,367,377,380,384,519,519,425,425,343,461,532,543,391,391,378,430,335,420,428,428,381,381,447,447,425,400,375,322,378,381,425,335,393,438,381,427,454,387,372,391,357,0,316,316,0,0,0,0,0,0,0,-1,-1,-1,-1,411,203,377,237,242,244,205,399,0,0,0,0,0,0,0,0,450,449,449,449,449,449,449,449,449,449,449,522,697];
    const ADV_MISC = { 0xA0: 216, 0x2013: 360, 0x2014: 720, 0x2026: 479, 0x200B: 0 };
    function realCm(text) {
        let u = 0;
        for (const ch of noHints(text).replace(PH_RE, PH_DOTS)) {
            const c = ch.codePointAt(0);
            const a = c >= 0x20 && c <= 0x7E ? ADV_ASCII[c - 0x20] : c >= 0x0E01 && c <= 0x0E5B ? ADV_THAI[c - 0x0E01] : ADV_MISC[c];
            u += a == null || a < 0 ? 390 : a;
        }
        return u * 16 * 0.0352778 / 1000;
    }
    const DOC_RANK_RE = /^((?:ว่าที่\s*)?(?:พล\.ต\.[อทต]\.|[พร]\.ต\.[อทต]\.|ส\.ต\.[อทต]\.|จ\.ส\.ต\.|ด\.ต\.|พล\.[อทต]\.|[พร]\.[อทต]\.|จ\.ส\.อ\.|ส\.อ\.|[พร]\.ต\.|พลตำรวจ(?:เอก|โท|ตรี)|พันตำรวจ(?:เอก|โท|ตรี)|ร้อยตำรวจ(?:เอก|โท|ตรี)|ดาบตำรวจ|จ่าสิบตำรวจ|สิบตำรวจ(?:เอก|โท|ตรี))(?:\s*หญิง)?)(?:\s+|(?<=\.)\s*|$)/;
    function splitRank(name) {
        const t = String(name || '').trim();
        const m = t.match(DOC_RANK_RE);
        return m && t.slice(m[0].length) ? [m[1].trim(), t.slice(m[0].length).trim()] : ['', t];
    }
    // ตามโปรแกรม (docSignFix_): "(สอบสวน)" → "(สอบสวน)ฯ"
    const signFix = (s) => String(s || '').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\((สอบสวน|ป้องกันปราบปราม|จราจร|อำนวยการ|สืบสวน)\)(?!ฯ)/g, '($1)ฯ');
    const memoNo = (v) => String(v || '').replace(/^\s*ตช\.?\s*/, '').trim();   // หนังสือภายในไม่มี "ตช"

    /* ---------------- ลำดับหัวข้อบันทึกข้อความ (พอร์ตจาก docx.js ของโปรแกรม) ---------------- */
    const NUMBER_LEVELS = [
        { level: 6, re: /^([0-9๐-๙]{1,2}(?:\.[0-9๐-๙]{1,2}){3}\s*\([0-9๐-๙]{1,2}\.[0-9๐-๙]{1,2}\))[ \t]+(?=\S)/ },
        { level: 5, re: /^([0-9๐-๙]{1,2}(?:\.[0-9๐-๙]{1,2}){3}\s*\([0-9๐-๙]{1,2}\))[ \t]+(?=\S)/ },
        { level: 4, re: /^([0-9๐-๙]{1,2}(?:\.[0-9๐-๙]{1,2}){3})\.?[ \t]+(?=\S)/ },
        { level: 3, re: /^([0-9๐-๙]{1,2}\.[0-9๐-๙]{1,2}\.[0-9๐-๙]{1,2})\.?[ \t]+(?=\S)/ },
        { level: 2, re: /^([0-9๐-๙]{1,2}\.[0-9๐-๙]{1,2})\.?[ \t]+(?=\S)/ },
        { level: 1, re: /^([0-9๐-๙]{1,2}\.)[ \t]+(?=\S)/ },
        { level: 9, re: /^(\(?[0-9๐-๙]{1,2}\)|\([ก-ฮ]\)|[ก-ฮ]\.)[ \t]+(?=\S)/ }
    ];
    function numberedHead(text) {
        const t = String(text || '');
        for (let i = 0; i < NUMBER_LEVELS.length; i++) {
            const m = t.match(NUMBER_LEVELS[i].re);
            if (m) return { level: NUMBER_LEVELS[i].level, num: m[1], rest: t.slice(m[0].length) };
        }
        return null;
    }
    function numberWidthCm(num) {
        const s = String(num || '');
        const digits = (s.match(/[0-9๐-๙]/g) || []).length, dots = (s.match(/\./g) || []).length;
        return Math.round((digits * 0.27 + dots * 0.12 + (s.length - digits - dots) * 0.2 + 0.3) * 100) / 100;
    }
    const CONCLUSION_RE = /^(?:ข้าฯ\s*(?:กับพวก)?\s*)?(?:จึง|ดังนั้น|ทั้งนี้|สรุป|โดยสรุป|เห็นควร|อาศัยเหตุ)/;
    function numberedLayout(paragraphs, baseCm) {
        const base = baseCm || 2.54;
        const list = paragraphs.map((t) => String(t || ''));
        const heads = [], parentOf = [], resetAt = [];
        let stack = [];
        list.forEach((text, i) => {
            resetAt[i] = /^\s*จึง(?:เรียน|ขอ)/.test(text);
            if (resetAt[i]) stack = [];
            const h = numberedHead(text);
            heads[i] = h; parentOf[i] = -2;
            if (!h) return;
            while (stack.length && heads[stack[stack.length - 1]].level >= h.level) stack.pop();
            parentOf[i] = stack.length ? stack[stack.length - 1] : -1;
            stack.push(i);
        });
        const hasChild = {};
        parentOf.forEach((p) => { if (p >= 0) hasChild[p] = true; });
        const groups = {};
        heads.forEach((h, i) => { if (h && h.level > 1) { const k = parentOf[i] + ':' + h.level; (groups[k] = groups[k] || []).push(i); } });
        const drop = {};
        Object.keys(groups).forEach((k) => {
            const g = groups[k], last = g[g.length - 1];
            if (g.length > 1 && !hasChild[last] && CONCLUSION_RE.test(heads[last].rest)) drop[last] = true;
            const left = g.filter((i) => !drop[i]);
            if (left.length === 1 && !hasChild[left[0]]) drop[left[0]] = true;
        });
        stack = [];
        return list.map((text, i) => {
            if (resetAt[i]) stack = [];
            const h = heads[i];
            if (h && !drop[i]) {
                while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
                const parent = stack[stack.length - 1];
                const numCm = h.level === 1 || !parent ? base : parent.textCm;
                const item = { level: h.level, num: h.num, rest: h.rest, numCm: numCm, textCm: Math.round((numCm + numberWidthCm(h.num)) * 100) / 100 };
                stack.push(item);
                return item;
            }
            if (h) while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
            const top = stack[stack.length - 1];
            const at = top ? top.numCm : base;
            return { num: '', rest: h ? h.rest : text, numCm: at, textCm: at };
        });
    }
    // หนังสือภายนอก: p = ย่อหน้า (2.5 ซม. + เว้น 6pt) · i = ข้อย่อย (3 ซม.) · h = หัวข้อตัวหนา
    function extBody(text) {
        return lines(text).map((l) => {
            if (/^#\s*/.test(l)) return { t: 'h', text: l.replace(/^#\s*/, '') };
            if (/^(\(?[0-9๐-๙]{1,2}[.)]|\([ก-ฮ]\)|[ก-ฮ]\.)\s/.test(l)) return { t: 'i', text: l };
            return { t: 'p', text: l };
        });
    }

    /* ---------------- ข้อมูลเหตุการณ์ / ค่ากลาง / แบบหนังสือ ---------------- */
    function ev() { return api ? api.active() : null; }
    function kit() {
        const e = ev() || {};
        const k0 = window.LAMHIN_DOC_KIT({ ev: e, prefs: {}, log: [] });
        const savedPrefs = Object.assign({}, (api.state && api.state.docPrefs) || {});
        Object.keys(savedPrefs).forEach((key) => { if (key !== 'digits' && !String(savedPrefs[key] == null ? '' : savedPrefs[key]).trim()) delete savedPrefs[key]; });
        if (/^สถานีตำรวจนครบาลลำหิน\n\.{6,}\nกรุงเทพมหานคร \.+$/.test(savedPrefs.office || '')) delete savedPrefs.office;   // ค่าตั้งต้นรุ่นแรก (ยังไม่มีที่ตั้ง)
        const prefs = Object.assign({}, k0.prefsDefaults, savedPrefs);
        const k = window.LAMHIN_DOC_KIT({ ev: e, prefs: prefs, log: Array.isArray(e.log) ? e.log : [], now: new Date() });
        k.prefs = prefs;
        k.prefsDefaults = k0.prefsDefaults;
        return k;
    }
    // รหัสเดิม (ext-m11 / ann1–4 / petition) ชี้ไปแบบ สตช. ที่แทนที่ — ลิงก์จากแท็บอื่นและแท็บที่จำไว้ยังใช้ได้
    function tplById(k, id) { return k.templates.find((t) => t.id === id) || k.templates.find((t) => t.alias === id) || null; }
    function saved(t) { const e = ev(); return (e && e.docs && e.docs[t.id]) || {}; }
    function fields(t) {
        const s = saved(t);
        const F = Object.assign({}, t.defaults, s);
        if (t.kind === 'announce') {
            if (t.buildBody && !('body' in s)) F.body = t.buildBody(F);
            F.given = String(F.given || '').replace('{varAt}', String(F.varAt || '').trim() || '[เวลา]');
        }
        return F;
    }
    function defaultOf(t, key) {
        if (t.kind === 'announce' && key === 'body' && t.buildBody) return t.buildBody(Object.assign({}, t.defaults, saved(t)));
        return t.defaults[key] == null ? '' : String(t.defaults[key]);
    }
    let saveTimer = 0;
    function setField(t, key, value) {
        const e = ev(); if (!e) return;
        e.docs = e.docs && typeof e.docs === 'object' ? e.docs : {};
        const s = Object.assign({}, e.docs[t.id] || {});
        if (value === defaultOf(t, key)) delete s[key]; else s[key] = value;
        if (Object.keys(s).length) e.docs[t.id] = s; else delete e.docs[t.id];
        clearTimeout(saveTimer); saveTimer = setTimeout(() => api.save(), 500);
    }
    function resetDoc(t) { const e = ev(); if (e && e.docs) { delete e.docs[t.id]; api.save(); } }
    const useThai = (k) => (k.prefs.digits || 'thai') !== 'arabic';

    /* =====================================================================
       ตัวจัดหน้า HTML (หน้าตัวอย่าง + พิมพ์) — ค่าระยะตามโปรแกรม
       ===================================================================== */
    const GW = (h) => h * 118 / 130;   // ความกว้างครุฑ (ภาพ 118×130)
    const garuda = () => 'data:image/png;base64,' + (window.LAMHIN_GARUDA_B64 || '');
    const blank = (n) => new Array(n + 1).join('<div class="ds-bl"></div>');

    function rExternal(t, F, th) {
        const T = tf(th);
        const W = 16, gW = GW(3), gX = (W - gW) / 2, rightFoot = gX + gW * 0.86, center = W / 2;
        const office = lines(F.office);
        const officeTab = Math.max(9.45, Math.min(12, W - Math.max.apply(null, office.map((s) => textCm(th(s))).concat([3.5])) - 0.1));
        let h = '<img class="ds-gar" alt="ตราครุฑ" src="' + garuda() + '" style="left:' + cm(gX) + ';top:0;width:' + cm(gW) + ';height:3cm">';
        if (String(F.formCode || '').trim()) h += '<div class="ds-fcode">' + ED('formCode', null, T(F.formCode)) + '</div>';
        h += '<div class="ds-row" style="padding-top:' + cm(3 - 0.66) + '"><span>ที่ ' + ED('no', null, T(F.no || '')) + '</span><span class="ds-at" style="left:' + cm(officeTab) + '">' + ED('office', 0, T(office[0] || '')) + '</span></div>';
        office.slice(1).forEach((l, i) => { h += '<div style="padding-left:' + cm(officeTab) + '">' + ED('office', i + 1, T(l)) + '</div>'; });
        const date = String(F.date || '').trim();
        const dm = date.match(/^([0-9๐-๙]{1,2})\s+/);
        h += '<div style="margin-top:6pt;padding-left:' + cm(Math.max(0, rightFoot - (dm ? textCm(th(dm[1]) + ' ') : 0))) + '">' + ED('date', null, T(date)) + '</div>';
        [['เรื่อง', F.subject, 'subject'], ['เรียน', F.to, 'to'], ['อ้างถึง', F.refs, 'refs'], ['สิ่งที่ส่งมาด้วย', F.attach, 'attach']].forEach((kv) => {
            const vs = lines(kv[1]); if (!vs.length) return;
            const tab = textCm(kv[0]) + 0.35;
            vs.forEach((v, i) => {
                h += '<div style="margin-top:' + (i ? 0 : 6) + 'pt;padding-left:' + cm(tab) + ';text-indent:-' + cm(tab) + '"><span class="ds-kw" style="width:' + cm(tab) + '">' + (i ? '' : kv[0]) + '</span>' + ED(kv[2], i, T(v)) + '</div>';
            });
        });
        const eb = extBody(F.body);
        eb.forEach((b, bi) => {
            h += '<p class="ds-j' + (b.t === 'h' ? ' ds-b' : '') + '"' + (b.t === 'h' || bi === eb.length - 1 ? ' data-kn="1"' : '') + ' style="margin-top:' + (b.t === 'p' ? 6 : 0) + 'pt;text-indent:' + cm(b.t === 'i' ? 3 : 2.5) + '">' + ED('body', bi, T(b.text), b.t === 'h' ? '# ' : '') + '</p>';
        });
        const closing = String(F.closing || 'ขอแสดงความนับถือ').trim();
        const signCenter = center + realCm(th(closing)) / 2;
        h += signBlock(F, closing, center, signCenter, th, W, 12);
        const owner = lines(F.owner);
        if (owner.length) h += blank(3) + owner.map((l, i) => '<div>' + ED('owner', i, T(l)) + '</div>').join('');
        if (t.receipt && (F.receiptText || '').trim()) {
            h += '<div class="ds-keep ds-rcpt"><div class="ds-cut">ตัดตามรอยประ — ส่วนบันทึกการรับทราบ</div>' +
                '<div class="ds-b" style="text-align:center">บันทึกการรับทราบ</div>' +
                '<p class="ds-j" style="text-indent:2.5cm">' + T(F.receiptText) + '</p>' + blank(2) +
                '<table class="ds-sig2"><tr><td>' + T('ลงชื่อ ................................ ผู้รับทราบ') + '<br>' + T('(' + (F.recvName || '') + ')') + '</td>' +
                '<td>' + T('ลงชื่อ ................................ ผู้ส่งมอบ') + '<br>' + T('(' + (F.giverName || '') + ')') + '</td></tr></table></div>';
        }
        return sheet('external', h) + annexSheet(F, th);
    }
    // สิ่งที่ส่งมาด้วย (แผ่นแยก) เช่น ท้ายแบบ 2-1: รหัสมุมขวาบน · ชื่อเรื่องกึ่งกลางตัวหนาขีดเส้นใต้ · "#" = หัวข้อตัวหนา · "หมายเหตุ" ขีดเส้นใต้
    function annexSheet(F, th) {
        const body = lines(F.annexBody);
        if (!body.length) return '';
        const T = tf(th);
        let h = String(F.annexCode || '').trim() ? '<div class="ds-b" style="text-align:right">' + ED('annexCode', null, T(F.annexCode)) + '</div>' : '';
        lines(F.annexTitle).forEach((l, i) => { h += '<div class="ds-b ds-ul" style="text-align:center;' + (i ? '' : 'margin-top:6pt') + '">' + ED('annexTitle', i, T(l)) + '</div>'; });
        body.forEach((l, i) => {
            if (/^#\s*/.test(l)) h += '<p class="ds-b" data-kn="1" style="margin-top:' + (i ? 3 : 10) + 'pt">' + ED('annexBody', i, T(l.replace(/^#\s*/, '')), '# ') + '</p>';
            else if (/^หมายเหตุ/.test(l)) h += '<p style="margin-top:3pt"><span class="ds-b ds-ul">หมายเหตุ</span>' + ED('annexBody', i, T(l.replace(/^หมายเหตุ/, '')), 'หมายเหตุ') + '</p>';
            else h += '<p class="ds-j" style="text-indent:1.5cm">' + ED('annexBody', i, T(l)) + '</p>';
        });
        return sheet('external', h);
    }
    // คำลงท้าย + ลงชื่อ + ตำแหน่ง (กึ่งกลางซึ่งกันและกันกับคำลงท้าย · ยศบรรทัดแยก) — ตามโปรแกรม
    function signBlock(F, closing, closeAt, signCenter, th, W, beforePt) {
        const T = tf(th);
        const rank = String(F.signRank || '').trim();
        const signLeft = Math.max(-2.5, 2 * signCenter - W);
        let s ='<div class="ds-keep"><div style="margin-top:' + beforePt + 'pt;padding-left:' + cm(closeAt) + '">' + ED('closing', null, T(closing)) + '</div>' + blank(rank ? 2 : 3);
        if (rank) s += '<div style="padding-left:' + cm(Math.max(0, signCenter - 3.0)) + '">' + ED('signRank', null, T(rank)) + '</div>';
        s += '<div style="margin-left:' + cm(signLeft) + ';text-align:center">(' + ED('signName', null, T(F.signName || '..................................................')) + ')</div>';
        lines(F.signPos).forEach((l, i) => { s += '<div style="margin-left:' + cm(signLeft) + ';text-align:center">' + ED('signPos', i, T(l)) + '</div>'; });
        return s + '</div>';
    }

    function rMemo(t, F, th) {
        const T = tf(th);
        let h = '<img class="ds-gar" alt="ตราครุฑ" src="' + garuda() + '" style="left:0;top:-0.5cm;width:' + cm(GW(1.5)) + ';height:1.5cm">';
        h += '<div class="ds-b" style="margin-top:4pt;padding-left:0.64cm;text-align:center;font-size:29pt">บันทึกข้อความ</div>';
        h += '<div><span class="ds-k20">ส่วนราชการ</span>&nbsp;&nbsp;' + ED('department', null, T(F.department || '')) + (F.phone ? '  โทร. ' + ED('phone', null, T(F.phone)) : '') + '</div>';
        h += '<div class="ds-row"><span><span class="ds-k20">ที่</span>&nbsp;&nbsp;' + ED('no', null, T(memoNo(F.no))) + '</span><span class="ds-at" style="left:8cm"><span class="ds-k20">วันที่</span>&nbsp;&nbsp;' + ED('date', null, T(F.date)) + '</span></div>';
        h += '<div style="padding-left:1.126cm;text-indent:-1.126cm"><span class="ds-k20">เรื่อง</span>&nbsp;&nbsp;' + ED('subject', null, T(F.subject)) + '</div>';
        h += '<div style="margin-top:6pt;padding-left:1.126cm;text-indent:-1.126cm">เรียน&nbsp;&nbsp;' + ED('to', null, T(F.to)) + '</div>';
        const paras = lines(F.body);
        const lay = numberedLayout(paras.map(toArabic));
        paras.forEach((p, i) => {
            const L = lay[i];
            const bold = L.level === 1 && L.rest.length <= 60;
            const pre = p.slice(0, Math.max(0, p.length - L.rest.length));   // เลขข้อเดิม (ไม่ให้แก้ในกระดาษ)
            if (L.num) h += '<p class="ds-j' + (bold ? ' ds-b' : '') + '"' + (bold ? ' data-kn="1"' : '') + ' style="text-indent:' + cm(L.numCm) + '"><span class="ds-kw" style="width:' + cm(L.textCm - L.numCm) + '">' + T(L.num) + '</span>' + ED('body', i, T(L.rest), pre) + '</p>';
            else h += '<p class="ds-j" style="margin-top:6pt;text-indent:' + cm(L.numCm) + '">' + ED('body', i, T(L.rest), pre) + '</p>';
        });
        lines(F.closing).forEach((l, i) => { h += '<p class="ds-j" data-kn="1" style="margin-top:6pt;text-indent:2.54cm">' + ED('closing', i, T(l)) + '</p>'; });
        // ลงชื่อ: เว้น 3 บรรทัด · ยศที่ 6.25 ซม. · ชื่อ/ตำแหน่งกึ่งกลางที่ 12.25 ซม. จากขอบกระดาษ
        const signIndent = 2 * (12.25 - 3) - 16;
        let s = '<div class="ds-keep">' + blank(3);
        if (String(F.signRank || '').trim()) s += '<div style="padding-left:6.25cm">' + ED('signRank', null, T(F.signRank)) + '</div>';
        s += '<div style="margin-left:' + cm(signIndent) + ';text-align:center">(' + ED('signName', null, T(signFix(F.signName || '..................................................'))) + ')</div>';
        lines(F.signPos).forEach((l, i) => { s += '<div style="margin-left:' + cm(signIndent) + ';text-align:center">' + ED('signPos', i, T(signFix(l))) + '</div>'; });
        h += s + '</div>';
        return sheet('memo', h);
    }

    /* ประกาศ / คำสั่ง ตามแบบ สตช. (แบบ 3-1 … 3-8): รหัสแบบมุมขวาบน · ครุฑกึ่งกลาง · หัว 2 บรรทัดตัวหนา · ที่ · เรื่อง · เส้นสั้น
       เนื้อความย่อหน้า 2.5 ซม. · "ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป" · "ประกาศ/สั่ง ณ วันที่" ที่ 3 ซม. · (ลงชื่อ) ที่ 6.5 ซม.
       · ชื่อ/ตำแหน่งกึ่งกลางที่ 9.5 ซม. จากขอบซ้ายเนื้อความ · "หมายเหตุ" ตัวหนาขีดเส้นใต้ */
    const ORD = { givenAt: 3, signAt: 6.5, nameC: 9.5 };
    function rAnnounce(t, F, th) {
        const T = tf(th);
        const W = 16, gW = GW(3), nameLeft = 2 * ORD.nameC - W;
        let h = '<img class="ds-gar" alt="ตราครุฑ" src="' + garuda() + '" style="left:' + cm((W - gW) / 2) + ';top:0;width:' + cm(gW) + ';height:3cm">';
        if (String(F.formCode || '').trim()) h += '<div class="ds-fcode">' + ED('formCode', null, T(F.formCode)) + '</div>';
        lines(F.issuer).forEach((l, i) => { h += '<div class="ds-b" style="text-align:center;' + (i ? '' : 'padding-top:' + cm(3) + ';margin-top:6pt') + '">' + ED('issuer', i, T(l)) + '</div>'; });
        if (String(F.no || '').trim()) h += '<div style="text-align:center">ที่ ' + ED('no', null, T(F.no)) + '</div>';
        if (String(F.subject || '').trim()) h += '<div style="text-align:center">เรื่อง ' + ED('subject', null, T(F.subject)) + '</div>';
        h += '<div class="ds-line"></div>';
        // ตามแบบ สตช.: ย่อหน้าต่อเนื่อง (ไม่เว้นระยะ) · เว้นบรรทัดก่อน "ทั้งนี้…" และ "ประกาศ ณ วันที่"
        lines(F.body).forEach((l, i) => { h += '<p class="ds-j" style="margin-top:' + (i ? 0 : 4) + 'pt;text-indent:2.5cm">' + ED('body', i, T(l)) + '</p>'; });
        if (String(F.effective || '').trim()) h += '<p data-kn="1" style="margin-top:9pt;text-indent:2.5cm">' + ED('effective', null, T(F.effective)) + '</p>';
        let s = '<div class="ds-keep"><div style="margin-top:9pt;padding-left:' + cm(ORD.givenAt) + '">' + ED('given', null, T(String(F.given || '').trim())) + '</div>';
        // ลงชื่อ: ยศอยู่บรรทัดลงชื่อ · ชื่อจริง นามสกุลในวงเล็บ (ไม่มียศ)
        const sr = splitRank(F.signName);
        s += '<div style="margin-top:10pt;padding-left:' + cm(ORD.signAt) + '">(ลงชื่อ)' + (sr[0] ? ' ' + ED('signName', null, T(sr[0]), '', 'rank') : '') + '</div>';
        s += '<div style="margin-left:' + cm(nameLeft) + ';text-align:center">(' + ED('signName', null, T(sr[1] || '..................................................'), '', 'name') + ')</div>';
        lines(F.signPos).forEach((l, i) => { s += '<div style="margin-left:' + cm(nameLeft) + ';text-align:center">' + ED('signPos', i, T(l)) + '</div>'; });
        h += s + '</div>';
        const notes = lines(F.notes);
        if (notes.length) {
            // หมายเหตุทั้งชุดไม่แยกหน้า (ถ้าไม่พอ ย้ายไปหน้าถัดไปทั้งชุด)
            h += '<div class="ds-keep"><p class="ds-b ds-ul" style="margin-top:6pt">หมายเหตุ</p>' + notes.map((l, i) => '<p class="ds-j" style="text-indent:2.5cm">' + ED('notes', i, T(l)) + '</p>').join('') + '</div>';
        }
        return sheet('announce', h);
    }

    /* ---------- แบบ 3-5 คำร้องให้เลิกการชุมนุมสาธารณะ (แบบพิมพ์ศาล (7) ตามคู่มือ สตช.) ----------
       วงกลมมุมซ้ายบน · ชื่อคำร้องชิดซ้าย · ครุฑกลาง · รหัสแบบขวาบน · คดีหมายเลขดำ/แดง · ศาล · วันที่ · ความ
       · ระหว่าง { โจทก์ / ผู้ร้อง / จำเลย } · ข้อมูลผู้ร้อง · ข้อ 1–3 · ควรมิควรแล้วแต่จะโปรด · ลงชื่อ ผู้ร้อง (+ ผู้เรียงและพิมพ์) */
    const PET_DOTS = '........................................';
    const PET_SIGN_AT = 7.5;
    // บรรทัดลงชื่อ: "ลงชื่อ [ยศ] ........ ผู้ร้อง" · (ชื่อจริง นามสกุล) กึ่งกลางใต้เส้นจุด
    // กล่องกึ่งกลางเริ่มที่ left ถึงขอบขวา → จุดกึ่งกลาง = (left + 16) / 2
    const petSignLead = (rank) => 'ลงชื่อ ' + (rank ? rank + ' ' : '');
    const petSignLeft = (rank) => Math.max(-2.5, 2 * (PET_SIGN_AT + realCm(petSignLead(rank)) + realCm(PET_DOTS) / 2) - 16);
    const BRACE = '<svg class="ds-brace" viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true"><path d="M9 1 C4 1 5 6 5 16 L5 40 C5 47 3 50 1 50 C3 50 5 53 5 60 L5 84 C5 94 4 99 9 99" fill="none" stroke="#000" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
    // ตำแหน่งตามคู่มือ สตช. หน้า 96 (ซม. จากขอบซ้ายเนื้อความ กว้าง 16 ซม.) — ช่องกรอก = ป้าย + ค่า + เส้นจุดจนถึงจุดหยุดถัดไป
    const P35 = {
        gar: { left: 6.3, h: 3.2 },
        caseAt: 9.6,
        court: [['ศาล', 'court', 0, 4.9]],
        date: [['วันที่', 'day', 6.4, 8.5], ['เดือน', 'month', 8.5, 12.0], ['พุทธศักราช', 'year', 12.0, 15.3]],
        kind: [['ความ', 'caseKind', 7.35, 14.05]],
        btw: { at: 2.56, end: 14.1, role: 14.3 },
        me: [['ข้าพเจ้า', 'pName', 1.32, 14.05]],
        rows: [
            [['เชื้อชาติ', 'race', 0, 3.4], ['สัญชาติ', 'nationality', 3.4, 6.85], ['อาชีพ', 'occupation', 6.85, 10.65], ['เกิดวันที่', 'birthDay', 10.65, 14.05]],
            [['เดือน', 'birthMonth', 0, 3.3], ['พ.ศ.', 'birthYear', 3.3, 5.7], ['อายุ', 'age', 5.7, 7.0], ['ปี อยู่บ้านเลขที่', 'houseNo', 7.0, 12.1], ['หมู่ที่', 'moo', 12.1, 14.9]],
            [['ถนน', 'road', 0, 3.9], ['ตรอก/ซอย', 'soi', 3.9, 8.3], ['ใกล้เคียง', 'near', 8.3, 10.6], ['ตำบล/แขวง', 'subdistrict', 10.6, 15.25]],
            [['อำเภอ/เขต', 'district', 0, 5.4], ['จังหวัด', 'province', 5.4, 10.1], ['โทรศัพท์', 'phone', 10.1, 14.9]]
        ],
        itemIndent: 2.6, signAt: 7.7, signEnd: 15.1
    };
    function rPetition(t, F, th) {
        const T = tf(th);
        const gW = GW(P35.gar.h);
        // ช่องกรอก: ป้าย · ค่า (แก้บนกระดาษได้) · เส้นจุดเติมถึงจุดหยุด
        const seg = (s) => '<span class="pf" style="min-width:' + cm(s[3] - s[2]) + '"><span class="pl">' + s[0] + '</span>' +
            ED(s[1], null, String(F[s[1]] || '').trim() ? T(F[s[1]]) : '', '', '') + '<span class="pd">' + NB + '</span></span>';
        const row = (segs, gapPt) => '<div class="prow" style="margin-top:' + (gapPt || 0) + 'pt;padding-left:' + cm(segs[0][2]) + '">' + segs.map(seg).join('') + '</div>';
        const caseNo = (label, key, top) => '<div class="pf" style="position:absolute;left:' + cm(P35.caseAt) + ';width:' + cm(16 - P35.caseAt) + ';top:' + cm(top) + '"><span class="pl">' + label + '</span>' +
            (String(F[key] || '').trim() ? ED(key, null, T(F[key])) + '<span class="pd">' + NB + '</span>'
                : ED(key, null, '') + '<span class="pd">' + NB + '</span><span class="pl">' + T('/25') + '</span><span class="pd" style="flex:0 0 1.1cm">' + NB + '</span>') + '</div>';
        let h = '<div class="ds-h35"><span class="ds-circ"></span><div class="ds-b ds-h35t">' + ED('title', null, T(F.title)) + '</div>' +
            '<img class="ds-gar" alt="ตราครุฑ" src="' + garuda() + '" style="left:' + cm(P35.gar.left) + ';top:0;width:' + cm(gW) + ';height:' + cm(P35.gar.h) + '">' +
            (String(F.formCode || '').trim() ? '<div class="ds-fcode">' + ED('formCode', null, T(F.formCode)) + '</div>' : '') +
            caseNo('คดีหมายเลขดำที่', 'blackNo', 2.35) + caseNo('คดีหมายเลขแดงที่', 'redNo', 3.1) + '</div>';
        h += row(P35.court, 2) + row(P35.date, 4) + row(P35.kind, 24);
        // ระหว่าง { โจทก์ / ผู้ร้อง / จำเลย }
        const bt = (key, role, out) => '<div class="ds-btr" style="padding-left:' + cm(P35.btw.at) + '"><span class="pf" style="min-width:' + cm(P35.btw.end - P35.btw.at) + '">' +
            ED(key, null, String(F[key] || '').trim() ? T(F[key]) : '') + '<span class="pd">' + NB + '</span></span><span class="ds-btl' + (out ? ' out' : '') + '">' + role + '</span></div>';
        h += '<div class="ds-btw ds-keep"><span class="ds-b ds-btk">ระหว่าง</span>' + BRACE + bt('plaintiff', 'โจทก์') + bt('applicant', 'ผู้ร้อง', true) + bt('defendant', 'จำเลย') + '</div>';
        h += row(P35.me, 14);
        P35.rows.forEach((r) => { h += row(r, 7); });
        h += '<div style="margin-top:2pt">ขอยื่นคำร้องมีข้อความตามที่จะกล่าวต่อไปนี้</div>';
        // ข้อ 1–3: "ข้อ ๑." ตัวหนา · ข้อความเขียนบนเส้นจุด · บรรทัดสุดท้ายเส้นจุดเติมจนสุดบรรทัด (ds-lead)
        lines(F.body).forEach((l, i) => {
            const m = l.match(/^(ข้อ\s*[0-9๐-๙]+\.?)\s*([\s\S]*)$/);
            h += '<p class="ds-j ds-lead" style="margin-top:' + (i ? 2 : 8) + 'pt;text-indent:' + cm(P35.itemIndent) + '">' + (m ? '<b>' + T(m[1]) + '</b> <span class="ds-dul">' + ED('body', i, T(m[2]), m[1] + ' ') + '</span>' : '<span class="ds-dul">' + ED('body', i, T(l)) + '</span>') + '</p>';
        });
        h += '<p data-kn="1" style="margin-top:6pt;text-align:center">' + ED('prayer', null, T(F.prayer)) + '</p>';
        // ลงชื่อ [ยศ] ........ ผู้ร้อง · (ชื่อจริง นามสกุล) กึ่งกลางใต้เส้นจุด
        const sr = splitRank(F.signName);
        const lead = 'ลงชื่อ ' + (sr[0] ? sr[0] + ' ' : '');
        const dotsFrom = P35.signAt + realCm(th(lead)), dotsTo = 16 - realCm(' ผู้ร้อง') - 0.12;   // เส้นจุดจบก่อนคำว่า "ผู้ร้อง" ชิดขวา
        const nameLeft = 2 * ((dotsFrom + dotsTo) / 2) - 16;
        h += '<div class="ds-keep" style="margin-top:16pt"><div class="prow" style="padding-left:' + cm(P35.signAt) + '"><span class="pf" style="flex:1 1 auto"><span class="pl">ลงชื่อ ' +
            (sr[0] ? ED('signName', null, T(sr[0]), '', 'rank') : '') + '</span><span class="pd" style="margin-right:.1cm">' + NB + '</span><span class="pl">ผู้ร้อง</span></span></div>' +
            (sr[1] ? '<div style="margin-left:' + cm(nameLeft) + ';text-align:center">(' + ED('signName', null, T(sr[1]), '', 'name') + ')</div>' : '') + '</div>';
        // ผู้เรียงและพิมพ์ (ด้านหลังแบบพิมพ์ศาล) ตัวเล็กลง
        const wr = splitRank(/[ก-๙A-Za-z]/.test(F.writer || '') ? F.writer : '');
        h += '<div class="ds-keep ds-sm" style="margin-top:12pt"><p style="text-indent:' + cm(P35.itemIndent) + '">คำร้องฉบับนี้ ข้าพเจ้า ' + ED('writer', null, T(F.writer || '')) + ' เป็นผู้เรียงและพิมพ์</p>' +
            '<div class="prow" style="margin-top:10pt;padding-left:' + cm(P35.signAt) + '"><span class="pf" style="flex:1 1 auto"><span class="pl">ลงชื่อ ' + (wr[0] ? ED('writer', null, T(wr[0]), '', 'rank') : '') +
            '</span><span class="pd" style="margin-right:.1cm">' + NB + '</span><span class="pl">ผู้เรียงและพิมพ์</span></span></div>' +
            (wr[1] ? '<div style="margin-left:' + cm(nameLeft) + ';text-align:center">(' + ED('writer', null, T(wr[1]), '', 'name') + ')</div>' : '') + '</div>';
        return sheet('petition', h);
    }


    /* =====================================================================
       แบ่งหน้า A4 จริง — วัดบรรทัดด้วยฟอนต์เดียวกับที่พิมพ์ แล้วตัดย่อหน้าตรงบรรทัด
       - ไม่ทิ้งบรรทัดเดียวท้าย/ต้นหน้า (orphan/widow) · หัวข้อ/ย่อหน้าที่ data-kn ติดไปกับบล็อกถัดไป
       - .ds-keep (คำลงท้าย+ลงชื่อ ฯลฯ) ไม่แยกหน้า · ไม่เริ่มหน้าใหม่ด้วยบรรทัดว่าง
       - หน้าตัวอย่างและหน้าพิมพ์ใช้ผลชุดเดียวกัน (ตรงกันทุกหน้า) · เลขหน้า "- ๒ -" เฉพาะหนังสือภายนอก นับใหม่ทุกฉบับ
       ===================================================================== */
    const PAGE = { external: [29.7, 2.5, 2], announce: [29.7, 2.5, 2], memo: [29.7, 2, 2], petition: [29.7, 2, 2], cover: [21, 2, 2] };
    let measureEl = null, fontsP = null;
    function fontsReady() {
        if (!document.fonts || !document.fonts.load) return Promise.resolve();
        if (!fontsP) fontsP = Promise.all(['16pt', 'bold 16pt', 'bold 20pt', 'italic 14pt'].map((f) => document.fonts.load(f + ' THSarabunDoc'))).catch(() => {});
        return fontsP;
    }
    function measureHost() {
        if (!measureEl || !measureEl.isConnected) {
            measureEl = document.createElement('div');
            measureEl.setAttribute('aria-hidden', 'true');
            measureEl.style.cssText = 'position:absolute;left:-40000px;top:0;visibility:hidden;pointer-events:none;contain:layout';
            document.body.appendChild(measureEl);
        }
        return measureEl;
    }
    const NOSPLIT = '.ds-keep,.ds-row,.ds-chead,.ds-party,.ds-bl,.ds-dotline,.ds-sig2,.ds-rcpt';
    function splittable(b) {
        return b.nodeType === 1 && (b.tagName === 'P' || b.tagName === 'DIV') && !b.matches(NOSPLIT) && !b.querySelector('div,p,table,img,br') && b.textContent.trim().length > 0;
    }
    function lineMap(el) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        const out = [];
        let n, idx = 0;
        while ((n = walker.nextNode())) {
            for (let i = 0; i < n.data.length; i++, idx++) {
                range.setStart(n, i); range.setEnd(n, i + 1);
                const r = range.getClientRects()[0];
                if (!r || (!r.width && !r.height)) continue;
                const last = out[out.length - 1];
                if (!last || r.top > last.top + r.height * 0.5) out.push({ start: idx, top: r.top, bottom: r.bottom });
                else if (r.bottom > last.bottom) last.bottom = r.bottom;
            }
        }
        return out;
    }
    function cutAt(el, s, keepHead) {
        const c = el.cloneNode(true);
        const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
        const nodes = []; let n, off = 0;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach((node) => {
            const a = off, b = off + node.data.length; off = b;
            if (keepHead) { if (a >= s) node.data = ''; else if (b > s) node.data = node.data.slice(0, s - a); }
            else { if (b <= s) node.data = ''; else if (a < s) node.data = node.data.slice(s - a); }
        });
        // ช่องว่างขีดเส้นใต้ (กว้างคงที่) ที่อยู่อีกฝั่งของรอยตัดทั้งช่อง → เอาออก ไม่ให้ดันข้อความ
        c.querySelectorAll('.ds-dl,.ds-leadfill').forEach((x) => { if (!x.textContent) x.remove(); });
        if (keepHead) {
            c.setAttribute('data-split', 'head');
            if (c.classList.contains('ds-j')) c.style.textAlignLast = 'justify';   // บรรทัดสุดท้ายของหน้ายังไม่จบย่อหน้า = จัดเต็มบรรทัด
            c.removeAttribute('data-kn');
        } else {
            c.style.textIndent = '0'; c.style.marginTop = '0';                       // ต่อจากหน้าก่อน: ไม่มีย่อหน้าแรก
            c.querySelectorAll('.ds-kw').forEach((k) => { if (!k.textContent.trim()) k.remove(); });
            const w2 = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let x;
            while ((x = w2.nextNode())) { if (!x.data.length) continue; x.data = x.data.replace(/^\s+/, ''); if (x.data.length) break; }
        }
        return c;
    }
    function splitBlock(b, pc, limit) {
        const lines0 = lineMap(b);
        let f = lines0.filter((l) => l.bottom <= limit + 0.5).length;
        if (lines0.length - f === 1 && f >= 3) f -= 1;                              // ไม่ทิ้งบรรทัดเดียวไว้ต้นหน้าถัดไป
        if (f < 2 || f >= lines0.length) return null;                               // ไม่ทิ้งบรรทัดเดียวไว้ท้ายหน้า
        const s = lines0[f].start;
        return { head: cutAt(b, s, true), tail: cutAt(b, s, false) };
    }
    // ย่อหน้าแบบพิมพ์ศาล (ds-lead): เติมเส้นจุดจากท้ายข้อความถึงขอบขวาของบรรทัดสุดท้าย (ส่วนหัวที่ถูกตัดไปหน้าใหม่ไม่ต้องเติม)
    function fillLeaders(root) {
        root.querySelectorAll('.ds-lead').forEach((p) => {
            if (p.getAttribute('data-split') === 'head' || p.querySelector('.ds-leadfill')) return;
            const r = document.createRange(); r.selectNodeContents(p);
            const rects = Array.from(r.getClientRects()).filter((x) => x.width > 0.5);
            if (!rects.length) return;
            const last = rects[rects.length - 1], pr = p.getBoundingClientRect();
            const w = pr.right - last.right - 4;
            if (w < 10) return;
            const f = document.createElement('span');
            f.className = 'ds-leadfill'; f.style.width = (w / PX_CM).toFixed(3) + 'cm'; f.textContent = '\u00A0'.repeat(120);
            p.appendChild(f);
        });
    }
    function pageNo(i, thai) { const n = String(i + 1); return thai ? toThai(n) : n; }
    function paginate(flowHtml, opt) {
        return fontsReady().then(() => {
            const host0 = measureHost();
            host0.innerHTML = flowHtml;
            const sheets = Array.from(host0.children).filter((x) => x.classList.contains('ds-sheet'));
            let out = '';
            sheets.forEach((sh) => {
                const kind = (sh.className.match(/\bk-(\w+)/) || [])[1] || 'external';
                const src = sh.querySelector('.ds-c');
                const wrap = (html, i) => '<section class="ds-page k-' + kind + '"><div class="ds-c">' + html + '</div>' +
                    (opt.pageNumbers && kind === 'external' && i > 0 ? '<div class="ds-pno">- ' + pageNo(i, opt.thai) + ' -</div>' : '') + '</section>';
                if (kind === 'cover') { out += wrap(src.innerHTML, 0); return; }
                const P = PAGE[kind] || PAGE.external;
                const avail = (P[0] - P[1] - P[2]) * PX_CM;
                const page = document.createElement('section');
                page.className = 'ds-page k-' + kind;
                page.style.height = 'auto'; page.style.overflow = 'visible';
                const pc = document.createElement('div');
                pc.className = 'ds-c';
                page.appendChild(pc);
                host0.appendChild(page);
                const pages = [];
                const flush = () => { fillLeaders(pc); pages.push(pc.innerHTML); pc.innerHTML = ''; };
                const fits = () => pc.scrollHeight <= avail + 0.5;
                const queue = Array.from(src.childNodes).filter((x) => x.nodeType === 1 || (x.nodeType === 3 && x.data.trim())).map((x) => x.cloneNode(true));
                let guard = 0;
                while (queue.length && guard++ < 5000) {
                    const b = queue.shift();
                    if (b.nodeType === 1 && b.classList.contains('ds-bl') && !pc.childNodes.length && pages.length) continue;
                    pc.appendChild(b);
                    if (fits()) continue;
                    let r = null;
                    if (splittable(b)) r = splitBlock(b, pc, pc.getBoundingClientRect().top + avail);
                    pc.removeChild(b);
                    if (r) {
                        pc.appendChild(r.head);
                        if (!fits()) { pc.removeChild(r.head); r = null; }
                    }
                    if (r) { flush(); queue.unshift(r.tail); continue; }
                    const moved = [];
                    let last = pc.lastElementChild;
                    while (last && last.getAttribute('data-kn') && pc.children.length > 1) { moved.unshift(last); pc.removeChild(last); last = pc.lastElementChild; }
                    while (pc.lastElementChild && pc.lastElementChild.classList.contains('ds-bl') && pc.children.length > 1) pc.removeChild(pc.lastElementChild);
                    if (!pc.childNodes.length) { pc.appendChild(b); flush(); continue; }   // บล็อกสูงเกินหน้า: วางหน้าเดียว
                    flush();
                    moved.forEach((m) => pc.appendChild(m));
                    queue.unshift(b);
                }
                if (pc.childNodes.length || !pages.length) flush();
                page.remove();
                pages.forEach((html, i) => { out += wrap(html, i); });
            });
            host0.innerHTML = '';
            return out;
        });
    }
    function sheet(kind, inner, breakBefore) {
        return '<section class="ds-sheet k-' + kind + (breakBefore ? ' ds-pb' : '') + '"><div class="ds-c">' + inner + '</div></section>';
    }
    function renderDoc(t, F, thai) {
        const th = thai ? toThai : toArabic;
        if (t.kind === 'memo') return rMemo(t, F, th);
        if (t.kind === 'announce') return rAnnounce(t, F, th);
        if (t.kind === 'petition') return rPetition(t, F, th);
        return rExternal(t, F, th);
    }

    // CSS ของกระดาษ (ใช้ทั้งหน้าตัวอย่างในแอปและหน้าพิมพ์)
    const SHEET_CSS = [
        '.ds-sheet,.ds-page{position:relative;box-sizing:border-box;background:#fff;color:#000;font-family:"THSarabunDoc","TH SarabunPSK","TH Sarabun New",Sarabun,sans-serif;font-size:16pt;line-height:1.17;font-weight:400;text-align:left;overflow-wrap:break-word}',
        '.ds-sheet{width:21cm;min-height:29.7cm}.ds-page{width:21cm;height:29.69cm;overflow:hidden}',
        '.ds-sheet.k-external,.ds-sheet.k-announce,.ds-page.k-external,.ds-page.k-announce{padding:2.5cm 2cm 2cm 3cm}',
        '.ds-sheet.k-memo,.ds-sheet.k-petition,.ds-page.k-memo,.ds-page.k-petition{padding:2cm 2cm 2cm 3cm}',
        '.ds-sheet *,.ds-page *{box-sizing:border-box}.ds-c{position:relative}',
        '.ds-pno{position:absolute;left:0;right:0;top:1.25cm;text-align:center}',
        '.ds-page p{margin:0}',
        '.ds-sheet p{margin:0}.ds-j{text-align:justify;text-justify:inter-character}',
        '.ds-ph{white-space:nowrap}',
        '.ds-gar{position:absolute;display:block}',
        '.ds-bl{height:1.17em}',
        '.ds-row{position:relative}.ds-at{position:absolute;bottom:0;white-space:nowrap}',
        '.ds-kw{display:inline-block;text-indent:0;white-space:nowrap}',
        '.ds-k20{font-size:20pt;font-weight:700}.ds-b{font-weight:700}',
        '.ds-keep{break-inside:avoid;page-break-inside:avoid}',
        '.ds-line{width:4.5cm;margin:8pt auto 4pt;border-top:1px solid #000}',
        '.ds-party{display:flex;gap:.4cm;align-items:flex-end;margin-top:4pt}.ds-party>div:first-child{flex:1 1 auto}.ds-role{flex:0 0 2.4cm;text-align:right}',
        '.ds-rcpt{margin-top:18pt}.ds-cut{border-top:1px dashed #000;text-align:center;font-size:12pt;color:#444;padding-top:2pt;margin-bottom:6pt}',
        '.ds-sig2{width:100%;border-collapse:collapse;font-size:inherit}.ds-sig2 td{width:50%;text-align:center;vertical-align:top;padding:0}',
        '.ds-pb{break-before:page;page-break-before:always}',
        '.ds-chead{position:relative;height:3.2cm}.ds-chl{position:absolute;left:0;top:.1cm}.ds-chr{position:absolute;right:0;top:1.85cm;text-align:right}',
        '.ds-u{display:inline-block;border-bottom:1px dotted #000;text-align:center;padding:0 .15cm;line-height:1.05;text-indent:0}',
        '.ds-recv{position:absolute;left:0;top:0;font-size:14pt;font-style:italic;line-height:1.3}.ds-recvj{font-size:14pt;font-style:italic}',
        '.ds-dotline{border-bottom:1px dotted #000;height:1.17em}.ds-fill{display:inline-block;width:6cm;border-bottom:1px dotted #000;text-indent:0}',
        '.ds-fcode{position:absolute;right:0;top:0;font-weight:700;z-index:1}.ds-hint{color:#6b7280;font-style:italic}.ds-ul{text-decoration:underline}',
        '.ds-ui{border-bottom:1px dotted #000;padding:0 .15cm;-webkit-box-decoration-break:clone;box-decoration-break:clone}',
        '.ds-h35{position:relative;height:3.85cm}.ds-circ{position:absolute;left:0;top:0;width:.75cm;height:.75cm;border:1px solid #000;border-radius:50%}.ds-h35t{position:absolute;left:0;top:.85cm}.ds-h35n{position:absolute;left:9.6cm;top:2.1cm;line-height:1.35}',
        '.ds-btw{position:relative;margin-top:6pt;padding-left:2.5cm}.ds-btk{position:absolute;left:0;top:1.3em}.ds-brace{position:absolute;left:1.85cm;top:.15cm;width:.4cm;height:calc(100% - .3cm)}',
        '.ds-btr{display:flex;align-items:flex-end;gap:.2cm;margin:3pt 0}.ds-btv{flex:1 1 auto;text-align:left;padding-left:.25cm}.ds-btl{flex:0 0 1.4cm}',
        '.prow{display:flex;align-items:baseline}.pf{display:flex;align-items:baseline;white-space:nowrap;flex:0 0 auto}.pf .pl{flex:0 0 auto}',
        '.pf .pd{flex:1 1 0;width:0;min-width:.3cm;overflow:clip;white-space:nowrap;text-decoration:underline dotted 1px;text-underline-offset:.2em}',
        '.pf .ds-ed{flex:0 0 auto;padding:0 .1cm;min-width:.35cm;text-decoration:underline dotted 1px;text-underline-offset:.2em;white-space:pre}',
        '.ds-btw{padding-left:0}.ds-btw .ds-btr{display:flex;align-items:baseline;position:relative;margin:13pt 0 0}.ds-btw .ds-btr:first-of-type{margin-top:4pt}.ds-btw .ds-btl{flex:0 0 auto;margin-left:.15cm}.ds-btw .ds-btl.out{position:absolute;right:0;top:0}.ds-btw .ds-btk{top:calc(1.17em + 17pt)}',
        '.ds-dul{text-decoration:underline dotted 1px;text-underline-offset:.2em}.ds-sm{font-size:14pt}',
        '.ds-leadfill,.ds-dl{display:inline-block;overflow:clip;white-space:nowrap;vertical-align:baseline;text-indent:0;text-decoration:underline dotted 1px;text-underline-offset:.2em}',
        '.ds-sheet.k-cover,.ds-page.k-cover{width:29.7cm;padding:2cm 2cm 2cm 3cm}.ds-sheet.k-cover{min-height:21cm}.ds-page.k-cover{height:20.99cm}.k-cover>.ds-c{height:16.9cm;display:flex;flex-direction:column;justify-content:space-between}'
    ].join('\n');

    /* =====================================================================
       พิมพ์ (iframe แยก ไม่กระทบสไตล์พิมพ์ของแอปเดิม)
       ===================================================================== */
    function fontCss() {
        const f = new URL('fonts/', BASE).href;
        return '@font-face{font-family:"THSarabunDoc";src:url("' + f + 'THSarabunPSK.woff") format("woff");font-weight:400}' +
            '@font-face{font-family:"THSarabunDoc";src:url("' + f + 'THSarabunPSK-Bold.woff") format("woff");font-weight:700}';
    }
    function printCss(opt) {
        const paged = opt.paged ? '@page{size:A4;margin:0}@page land{size:A4 landscape;margin:0}' +
            '.ds-page{break-after:page;page-break-after:always}.ds-page:last-child{break-after:auto;page-break-after:auto}.ds-page.k-cover{page:land}' : '';
        return fontCss() + SHEET_CSS + 'html,body{margin:0;padding:0;background:#fff}' + paged + (opt.extraCss || '');
    }
    function printDocument(body, opt) {
        return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(opt.title || 'พิมพ์เอกสาร') + '</title><style>' + printCss(opt) + '</style></head><body>' + body + '</body></html>';
    }
    // เปิดหน้าพิมพ์: จอสัมผัส (มือถือ/แท็บเล็ต) ใช้หน้าต่างใหม่ · คอมพิวเตอร์ใช้ iframe ซ่อน
    // body = HTML หรือ Promise ของ HTML (หน้าต่างใหม่ต้องเปิดทันทีตอนกด ไม่งั้นเบราว์เซอร์บล็อก)
    function printHtml(body, opt) {
        const touch = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
        let win = null, frame = null;
        if (touch) {
            win = window.open('', '_blank');
            if (!win) { api.toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาตป๊อปอัปแล้วลองอีกครั้ง'); return; }
            try { win.document.write('<p style="font:16px sans-serif;padding:20px">กำลังจัดหน้าเอกสาร…</p>'); } catch (e) { /* ไม่ต้อง */ }
        }
        Promise.resolve(body).then((html0) => {
            const html = printDocument(html0, opt);
            if (!touch) {
                frame = document.createElement('iframe');
                frame.setAttribute('aria-hidden', 'true');
                frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
                document.body.appendChild(frame);
                win = frame.contentWindow;
            }
            const d = win.document;
            d.open(); d.write(html); d.close();
            const go = () => {
                const imgs = Array.from(d.images || []).map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }));
                const fonts = d.fonts ? Promise.all([d.fonts.load('16pt THSarabunDoc'), d.fonts.load('bold 16pt THSarabunDoc')]).then(() => d.fonts.ready) : Promise.resolve();
                Promise.race([Promise.all([fonts].concat(imgs)), new Promise((r) => setTimeout(r, 4000))]).then(() => {
                    setTimeout(() => {
                        try { win.focus(); win.print(); } catch (e) { api.toast('สั่งพิมพ์ไม่สำเร็จ'); }
                        if (frame) setTimeout(() => frame.remove(), 60000);
                    }, 120);
                });
            };
            if (d.readyState === 'complete') go(); else win.addEventListener('load', go);
        }).catch((e) => { console.error('[docs] print', e); api.toast('จัดหน้าไม่สำเร็จ'); if (touch && win) win.close(); });
    }
    // แต่ละฉบับแบ่งหน้าแยกกัน (เลขหน้านับใหม่ทุกฉบับ) แล้วต่อกันเป็นชุดเดียว
    function pagedDocs(list, k) {
        const thai = useThai(k);
        return Promise.all(list.map((t) => paginate(renderDoc(t, fields(t), thai), { pageNumbers: t.kind === 'external', thai: thai }))).then((a) => a.join(''));
    }
    function printDocs(list, k) {
        printHtml(pagedDocs(list, k), { title: list.length === 1 ? list[0].title : 'ชุดเอกสารประสานงาน', paged: true });
    }

    /* =====================================================================
       ส่งออก Word (.docx) — พอร์ตตรรกะจากโปรแกรม (letterdocx.js / docx.js)
       ===================================================================== */
    let zipP = null;
    function jszip() {
        if (window.JSZip) return Promise.resolve(window.JSZip);
        if (!zipP) zipP = loadScript(JSZIP_URL).then(() => window.JSZip).catch((e) => { zipP = null; throw e; });
        return zipP;
    }
    const DX = { CM: 567, EMU_CM: 360000, PAGE_W: 11906, PAGE_H: 16838, FONT: 'TH SarabunPSK' };
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const xe = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const tw = (c) => Math.round(c * DX.CM);
    // จุดตัดคำไทย (U+200B) ให้ Word ตัดบรรทัดคำยาวได้ — ตามโปรแกรม (letterBreaks_)
    function wbr(text) {
        const t = String(text || '');
        if (!/[ก-๛]{12,}/.test(t) || typeof Intl === 'undefined' || !Intl.Segmenter) return t;
        try {
            const seg = new Intl.Segmenter('th', { granularity: 'word' });
            let out = '', prev = '';
            Array.from(seg.segment(t)).forEach((x) => { const s = x.segment; if (prev && /[ก-๎]$/.test(prev) && /^[ก-๎]/.test(s)) out += '​'; out += s; prev = s; });
            return out;
        } catch (e) { return t; }
    }
    const runX = (text, pt, bold, italic, under) => {
        const rpr = (u) => '<w:rPr>' + (bold ? '<w:b/><w:bCs/>' : '') + (italic ? '<w:i/><w:iCs/>' : '') + (u ? '<w:u w:val="dotted"/>' : '') + '<w:sz w:val="' + pt * 2 + '"/><w:szCs w:val="' + pt * 2 + '"/><w:cs/></w:rPr>';
        // เส้นจุด = ขีดเส้นใต้แบบจุดบนช่องว่าง (ไม่พิมพ์ "....")
        return noHints(text).replace(PH_RE, PH_DOTS).split(/(\.{4,})/).filter((x) => x !== '').map((x) => /^\.{4,}$/.test(x)
            ? '<w:r>' + rpr(true) + '<w:t xml:space="preserve">' + '\u00A0'.repeat(Math.max(3, Math.round(x.length * 0.75))) + '</w:t></w:r>'
            : '<w:r>' + rpr(under) + '<w:t xml:space="preserve">' + xe(x) + '</w:t></w:r>').join('') || ('<w:r>' + rpr(under) + '<w:t xml:space="preserve"></w:t></w:r>');
    };
    const runU = (text) => '<w:r><w:rPr><w:u w:val="dotted"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:cs/></w:rPr><w:t xml:space="preserve">' + xe(noHints(text).replace(PH_RE, PH_DOTS)) + '</w:t></w:r>';
    const runBU = (text) => '<w:r><w:rPr><w:b/><w:bCs/><w:u w:val="single"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:cs/></w:rPr><w:t xml:space="preserve">' + xe(noHints(text).replace(PH_RE, PH_DOTS)) + '</w:t></w:r>';
    const pX = (ppr, inner) => '<w:p><w:pPr>' + ppr + '</w:pPr>' + (inner || '') + '</w:p>';
    const spX = (before) => '<w:spacing w:before="' + Math.round(before * 20) + '" w:after="0" w:line="240" w:lineRule="auto"/>';
    function picX(rid, w, h, id) {
        return '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="Picture ' + id + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
            '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>';
    }
    function anchorX(rid, w, h, xEmu, yEmu, id) {
        return '<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="1" behindDoc="0" locked="1" layoutInCell="1" allowOverlap="1">' +
            '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>' + Math.round(xEmu) + '</wp:posOffset></wp:positionH>' +
            '<wp:positionV relativeFrom="page"><wp:posOffset>' + Math.round(yEmu) + '</wp:posOffset></wp:positionV>' +
            '<wp:extent cx="' + Math.round(w) + '" cy="' + Math.round(h) + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>' +
            '<wp:docPr id="' + id + '" name="Garuda"/><wp:cNvGraphicFramePr/>' + picX(rid, Math.round(w), Math.round(h), id) + '</wp:anchor></w:drawing></w:r>';
    }

    // พารามิเตอร์ร่วม → ไฟล์ .docx (Blob)
    function docxPackage(JSZip, bodyXml, o) {
        const pt = 16;
        const hdr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '><w:p><w:pPr><w:jc w:val="center"/></w:pPr>' + runX('- ', pt, false) +
            '<w:r><w:rPr><w:sz w:val="32"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="32"/></w:rPr><w:instrText xml:space="preserve"> PAGE \\* ' + (o.thai ? 'ThaiArabic' : 'Arabic') + ' </w:instrText></w:r>' +
            '<w:r><w:rPr><w:sz w:val="32"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>' + runX(o.thai ? '๒' : '2', pt, false) + '<w:r><w:rPr><w:sz w:val="32"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>' + runX(' -', pt, false) + '</w:p></w:hdr>';
        const emptyHdr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '><w:p/></w:hdr>';
        const m = o.margin;
        const sect = '<w:sectPr>' + (o.pageNumbers ? '<w:headerReference w:type="default" r:id="rIdHdr"/><w:headerReference w:type="first" r:id="rIdHdrFirst"/>' : '') +
            '<w:pgSz w:w="' + DX.PAGE_W + '" w:h="' + DX.PAGE_H + '"/><w:pgMar w:top="' + tw(m[0]) + '" w:right="' + tw(m[1]) + '" w:bottom="' + tw(m[2]) + '" w:left="' + tw(m[3]) + '" w:header="709" w:footer="709" w:gutter="0"/>' +
            (o.pageNumbers ? '<w:titlePg/>' : '') + '</w:sectPr>';
        const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + bodyXml + (o.finalSect || sect) + '</w:body></w:document>';
        const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            '<Relationship Id="rIdGaruda" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/garuda.png"/>' +
            (o.pageNumbers ? '<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdHdrFirst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>' : '') +
            '</Relationships>';
        const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>' +
            '<w:rFonts w:ascii="' + DX.FONT + '" w:hAnsi="' + DX.FONT + '" w:eastAsia="' + DX.FONT + '" w:cs="' + DX.FONT + '"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="th-TH" w:bidi="th-TH"/></w:rPr></w:rPrDefault>' +
            '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';
        const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
            (o.pageNumbers ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '') +
            '</Types>';
        const root = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
        const z = new JSZip();
        z.file('[Content_Types].xml', types);
        z.file('_rels/.rels', root);
        z.file('word/document.xml', doc);
        z.file('word/styles.xml', styles);
        z.file('word/_rels/document.xml.rels', rels);
        if (o.pageNumbers) { z.file('word/header1.xml', hdr); z.file('word/header2.xml', emptyHdr); }
        z.file('word/media/garuda.png', window.LAMHIN_GARUDA_B64 || '', { base64: true });
        return z.generateAsync({ type: 'blob', mimeType: DOCX_MIME });
    }

    // ลงชื่อแบบหนังสือภายนอก (buildExternalLetterDocx_)
    function signX(F, closing, closeAt, signCenter, th, beforePt) {
        const run = (s, b) => runX(wbr(th(s)), 16, b);
        const parts = [];
        const W = 16;
        parts.push(pX('<w:keepNext/>' + spX(beforePt) + '<w:ind w:left="' + tw(closeAt) + '"/>', run(closing)));
        const rank = String(F.signRank || '').trim();
        const signLeft = Math.max(-2.5, 2 * signCenter - W);
        for (let k = 0; k < (rank ? 2 : 3); k++) parts.push(pX('<w:keepNext/>' + spX(0)));
        if (rank) parts.push(pX('<w:keepNext/>' + spX(0) + '<w:ind w:left="' + tw(Math.max(0, signCenter - 3.0)) + '"/>', run(rank)));
        const pos = lines(F.signPos);
        parts.push(pX((pos.length ? '<w:keepNext/>' : '') + spX(0) + '<w:ind w:left="' + tw(signLeft) + '"/><w:jc w:val="center"/>', run('(' + (F.signName || '..................................................') + ')')));
        pos.forEach((l, i) => parts.push(pX((i < pos.length - 1 ? '<w:keepNext/>' : '') + spX(0) + '<w:ind w:left="' + tw(signLeft) + '"/><w:jc w:val="center"/>', run(l))));
        return parts.join('');
    }
    function xExternal(t, F, th) {
        const run = (s, b) => runX(wbr(th(s)), 16, b);
        const W = 16, gH = 3 * DX.EMU_CM, gW = Math.round(gH * 118 / 130), gWcm = GW(3), gX = (W - gWcm) / 2, rightFoot = gX + gWcm * 0.86, center = W / 2;
        const parts = [];
        const office = lines(F.office);
        const officeTab = Math.max(9.45, Math.min(12, W - Math.max.apply(null, office.map((s) => textCm(th(s))).concat([3.5])) - 0.1));
        const fcode = String(F.formCode || '').trim();   // รหัสแบบ (เช่น แบบ 2-1) มุมขวาบน
        if (fcode) parts.push(pX(spX(0) + '<w:jc w:val="right"/>', run(fcode, true)));
        parts.push(pX('<w:tabs><w:tab w:val="left" w:pos="' + tw(officeTab) + '"/></w:tabs>' + spX(Math.max(0, 3 - 0.66 - (fcode ? 0.74 : 0)) * 28.35),
            anchorX('rIdGaruda', gW, gH, gX * DX.EMU_CM, 2.5 * DX.EMU_CM, 1) + run('ที่ ' + (F.no || '')) + '<w:r><w:tab/></w:r>' + run(office[0] || '')));
        office.slice(1).forEach((l) => parts.push(pX(spX(0) + '<w:ind w:left="' + tw(officeTab) + '"/>', run(l))));
        const date = String(F.date || '').trim(), dm = date.match(/^([0-9๐-๙]{1,2})\s+/);
        parts.push(pX(spX(6) + '<w:ind w:left="' + tw(Math.max(0, rightFoot - (dm ? textCm(th(dm[1]) + ' ') : 0))) + '"/>', run(date)));
        [['เรื่อง', F.subject], ['เรียน', F.to], ['อ้างถึง', F.refs], ['สิ่งที่ส่งมาด้วย', F.attach]].forEach((kv) => {
            const vs = lines(kv[1]); if (!vs.length) return;
            const tab = textCm(kv[0]) + 0.35;
            vs.forEach((v, i) => parts.push(pX('<w:tabs><w:tab w:val="left" w:pos="' + tw(tab) + '"/></w:tabs>' + spX(i ? 0 : 6) + '<w:ind w:left="' + tw(tab) + '" w:hanging="' + tw(tab) + '"/>', (i ? '' : run(kv[0])) + '<w:r><w:tab/></w:r>' + run(v))));
        });
        const body = extBody(F.body);
        body.forEach((b, i) => {
            const keep = i === body.length - 1 ? '<w:keepNext/>' : '';
            parts.push(pX(keep + spX(b.t === 'p' ? 6 : 0) + '<w:ind w:left="0" w:firstLine="' + tw(b.t === 'i' ? 3 : 2.5) + '"/><w:jc w:val="thaiDistribute"/>', run(b.text, b.t === 'h')));
        });
        const closing = String(F.closing || 'ขอแสดงความนับถือ').trim();
        parts.push(signX(F, closing, center, center + realCm(th(closing)) / 2, th, 12));
        const owner = lines(F.owner);
        if (owner.length) { for (let k = 0; k < 3; k++) parts.push(pX(spX(0))); owner.forEach((l) => parts.push(pX(spX(0), run(l)))); }
        if (t.receipt && (F.receiptText || '').trim()) {
            parts.push(pX(spX(18) + '<w:pBdr><w:top w:val="dashed" w:sz="6" w:space="2" w:color="000000"/></w:pBdr><w:jc w:val="center"/>', runX('ตัดตามรอยประ — ส่วนบันทึกการรับทราบ', 12, false)));
            parts.push(pX('<w:keepNext/>' + spX(6) + '<w:jc w:val="center"/>', run('บันทึกการรับทราบ', true)));
            parts.push(pX('<w:keepNext/>' + spX(0) + '<w:ind w:firstLine="' + tw(2.5) + '"/><w:jc w:val="thaiDistribute"/>', run(F.receiptText)));
            parts.push(pX('<w:keepNext/>' + spX(0)) + pX('<w:keepNext/>' + spX(0)));
            const cell = (a, b) => '<w:tc><w:tcPr><w:tcW w:w="' + tw(8) + '" w:type="dxa"/></w:tcPr>' + pX(spX(0) + '<w:jc w:val="center"/>', run(a)) + pX(spX(0) + '<w:jc w:val="center"/>', run(b)) + '</w:tc>';
            parts.push('<w:tbl><w:tblPr><w:tblW w:w="' + tw(16) + '" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="' + tw(8) + '"/><w:gridCol w:w="' + tw(8) + '"/></w:tblGrid><w:tr>' +
                cell('ลงชื่อ ................................ ผู้รับทราบ', '(' + (F.recvName || '') + ')') + cell('ลงชื่อ ................................ ผู้ส่งมอบ', '(' + (F.giverName || '') + ')') + '</w:tr></w:tbl>' + pX(spX(0)));
        }
        // สิ่งที่ส่งมาด้วย (แผ่นแยก): ขึ้นส่วนใหม่ ไม่มีเลขหน้าของหนังสือ
        const annex = lines(F.annexBody);
        let finalSect = null;
        if (annex.length) {
            const pg = '<w:pgSz w:w="' + DX.PAGE_W + '" w:h="' + DX.PAGE_H + '"/><w:pgMar w:top="' + tw(2.5) + '" w:right="' + tw(2) + '" w:bottom="' + tw(2) + '" w:left="' + tw(3) + '" w:header="709" w:footer="709" w:gutter="0"/>';
            parts.push(pX('<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:headerReference w:type="first" r:id="rIdHdrFirst"/>' + pg + '<w:titlePg/></w:sectPr>'));
            if (String(F.annexCode || '').trim()) parts.push(pX(spX(0) + '<w:jc w:val="right"/>', run(F.annexCode, true)));
            lines(F.annexTitle).forEach((l, i) => parts.push(pX(spX(i ? 0 : 6) + '<w:jc w:val="center"/>', runBU(wbr(th(l))))));
            annex.forEach((l, i) => {
                if (/^#\s*/.test(l)) parts.push(pX('<w:keepNext/>' + spX(i ? 3 : 10), run(l.replace(/^#\s*/, ''), true)));
                else if (/^หมายเหตุ/.test(l)) parts.push(pX(spX(3), runBU('หมายเหตุ') + run(l.replace(/^หมายเหตุ/, ''))));
                else parts.push(pX(spX(0) + '<w:ind w:firstLine="' + tw(1.5) + '"/><w:jc w:val="thaiDistribute"/>', run(l)));
            });
            finalSect = '<w:sectPr><w:headerReference w:type="default" r:id="rIdHdrFirst"/>' + pg + '</w:sectPr>';
        }
        return { xml: parts.join(''), margin: [2.5, 2, 2, 3], pageNumbers: true, finalSect: finalSect };
    }
    function xMemo(t, F, th) {
        const run = (s, pt, b) => runX(wbr(th(s)), pt || 16, b);
        const parts = [];
        const gH = 1.5 * DX.EMU_CM, gW = Math.round(gH * 118 / 130);
        parts.push(pX(spX(4) + '<w:ind w:left="' + tw(0.64) + '"/><w:jc w:val="center"/>', anchorX('rIdGaruda', gW, gH, 0, 1.5 * DX.EMU_CM, 1) + run('บันทึกข้อความ', 29, true)));
        const dept = String(F.department || '') + (F.phone ? '  โทร. ' + F.phone : '');
        const hang = '<w:ind w:left="' + tw(1.126) + '" w:hanging="' + tw(1.126) + '"/>';
        parts.push(pX(spX(0), run('ส่วนราชการ', 20, true) + run('  ', 16) + run(dept)));
        parts.push(pX(spX(0) + '<w:tabs><w:tab w:val="left" w:pos="' + tw(8) + '"/></w:tabs>', run('ที่', 20, true) + run('  ', 16) + run(memoNo(F.no)) + '<w:r><w:tab/></w:r>' + run('วันที่', 20, true) + run('  ' + (F.date || ''))));
        parts.push(pX(spX(0) + hang, run('เรื่อง', 20, true) + run('  ', 16) + run(F.subject)));
        parts.push(pX(spX(6) + hang, run('เรียน  ' + (F.to || ''))));
        const paras = lines(F.body), lay = numberedLayout(paras.map(toArabic));
        paras.forEach((p, i) => {
            const L = lay[i], bold = L.level === 1 && L.rest.length <= 60;
            const tabs = L.num ? '<w:tabs><w:tab w:val="left" w:pos="' + tw(L.textCm) + '"/></w:tabs>' : '';
            parts.push(pX(tabs + spX(L.num ? 0 : 6) + '<w:ind w:firstLine="' + tw(L.numCm) + '"/><w:jc w:val="thaiDistribute"/>',
                (L.num ? run(L.num, 16, bold) + '<w:r><w:tab/></w:r>' : '') + run(L.rest, 16, bold && !!L.num)));
        });
        lines(F.closing).forEach((l) => parts.push(pX(spX(6) + '<w:ind w:firstLine="' + tw(2.54) + '"/><w:jc w:val="thaiDistribute"/>', run(l))));
        for (let k = 0; k < 3; k++) parts.push(pX(spX(0)));
        if (String(F.signRank || '').trim()) parts.push(pX(spX(0) + '<w:ind w:left="' + tw(6.25) + '"/>', run(F.signRank)));
        const signIndent = tw(2 * (12.25 - 3) - 16);
        parts.push(pX(spX(0) + '<w:ind w:left="' + signIndent + '"/><w:jc w:val="center"/>', run(signFix('(' + (F.signName || '') + ')'))));
        lines(F.signPos).forEach((l) => parts.push(pX(spX(0) + '<w:ind w:left="' + signIndent + '"/><w:jc w:val="center"/>', run(signFix(l)))));
        return { xml: parts.join(''), margin: [2, 2, 2, 3], pageNumbers: false };
    }
    // ประกาศ / คำสั่ง ตามแบบ สตช. (.docx) — ระยะเดียวกับหน้าพิมพ์ (ORD)
    function xAnnounce(t, F, th) {
        const run = (s, b) => runX(wbr(th(s)), 16, b);
        const W = 16, gH = 3 * DX.EMU_CM, gW = Math.round(gH * 118 / 130), gX = (W - GW(3)) / 2;
        const nameLeft = tw(2 * ORD.nameC - W);
        const parts = [];
        parts.push(pX(spX(0) + '<w:jc w:val="right"/>', anchorX('rIdGaruda', gW, gH, gX * DX.EMU_CM, 2.5 * DX.EMU_CM, 1) + run(F.formCode || '', true)));
        lines(F.issuer).forEach((l, i) => parts.push(pX(spX(i ? 0 : (3 - 0.74) * 28.35 + 6) + '<w:jc w:val="center"/>', run(l, true))));
        if (String(F.no || '').trim()) parts.push(pX(spX(0) + '<w:jc w:val="center"/>', run('ที่ ' + F.no)));
        if (String(F.subject || '').trim()) parts.push(pX(spX(0) + '<w:jc w:val="center"/>', run('เรื่อง ' + F.subject)));
        parts.push(pX(spX(4) + '<w:ind w:left="' + tw(5.75) + '" w:right="' + tw(5.75) + '"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>'));
        lines(F.body).forEach((l, i) => parts.push(pX(spX(i ? 0 : 4) + '<w:ind w:firstLine="' + tw(2.5) + '"/><w:jc w:val="thaiDistribute"/>', run(l))));
        if (String(F.effective || '').trim()) parts.push(pX('<w:keepNext/>' + spX(9) + '<w:ind w:firstLine="' + tw(2.5) + '"/>', run(F.effective)));
        parts.push(pX('<w:keepNext/>' + spX(9) + '<w:ind w:left="' + tw(ORD.givenAt) + '"/>', run(String(F.given || '').trim())));
        const sr = splitRank(F.signName);   // ยศอยู่บรรทัดลงชื่อ · (ชื่อจริง นามสกุล)
        parts.push(pX('<w:keepNext/>' + spX(10) + '<w:ind w:left="' + tw(ORD.signAt) + '"/>', run('(ลงชื่อ)' + (sr[0] ? ' ' + sr[0] : ''))));
        const pos = lines(F.signPos);
        parts.push(pX((pos.length ? '<w:keepNext/>' : '') + spX(0) + '<w:ind w:left="' + nameLeft + '"/><w:jc w:val="center"/>', run('(' + (sr[1] || '..................................................') + ')')));
        pos.forEach((l, i) => parts.push(pX((i < pos.length - 1 ? '<w:keepNext/>' : '') + spX(0) + '<w:ind w:left="' + nameLeft + '"/><w:jc w:val="center"/>', run(l))));
        const notes = lines(F.notes);
        if (notes.length) {
            parts.push(pX('<w:keepNext/>' + spX(6), runBU(th('หมายเหตุ'))));
            notes.forEach((l) => parts.push(pX('<w:keepLines/>' + spX(0) + '<w:ind w:firstLine="' + tw(2.5) + '"/><w:jc w:val="thaiDistribute"/>', run(l))));
        }
        return { xml: parts.join(''), margin: [2.5, 2, 2, 3], pageNumbers: false };
    }
    // แบบ 3-5 คำร้องให้เลิกการชุมนุมสาธารณะ (.docx) — ตำแหน่งเดียวกับหน้าพิมพ์ (P35) · เส้นจุดด้วยแท็บจุดนำ
    function xPetition(t, F, th) {
        const run = (s, b, pt, it) => runX(wbr(th(s)), pt || 16, b, it);
        const runDU = (s) => runX(wbr(th(s)), 16, false, false, true);
        const TAB = '<w:r><w:tab/></w:r>';
        const UTAB = '<w:r><w:rPr><w:u w:val="dotted"/></w:rPr><w:tab/></w:r>';   // แท็บขีดเส้นใต้จุด = เส้นจุดถึงจุดหยุด
        const dotTab = (c) => '<w:tab w:val="left" w:pos="' + tw(c) + '"/>';
        const v = (k) => String(F[k] || '').trim();
        const W = 16, gH = P35.gar.h * DX.EMU_CM, gW = Math.round(gH * 118 / 130);
        // แถวช่องกรอก: ป้าย ค่า ....... (จุดหยุด) ป้ายถัดไป ...
        const rowX = (segs, before) => pX(spX(before || 0) + '<w:tabs>' + segs.map((s) => dotTab(s[3])).join('') + '</w:tabs>' + (segs[0][2] ? '<w:ind w:left="' + tw(segs[0][2]) + '"/>' : ''),
            segs.map((s) => run(s[0] + ' ') + (v(s[1]) ? runDU(v(s[1]) + ' ') : '') + UTAB).join(''));
        const x = [];
        x.push(pX(spX(0) + '<w:tabs><w:tab w:val="right" w:pos="' + tw(W) + '"/></w:tabs>',
            anchorX('rIdGaruda', gW, gH, P35.gar.left * DX.EMU_CM, 2 * DX.EMU_CM, 1) + runX('○', 30, false) + TAB + run(F.formCode || '', true)));
        x.push(pX(spX(0), run(F.title, true)));
        const caseX = (label, k, before) => pX(spX(before) + '<w:tabs>' + (v(k) ? dotTab(W) : dotTab(14.7) + dotTab(W)) + '</w:tabs><w:ind w:left="' + tw(P35.caseAt) + '"/>',
            run(label + ' ') + (v(k) ? runDU(v(k) + ' ') + UTAB : UTAB + run('/25') + UTAB));
        x.push(caseX('คดีหมายเลขดำที่', 'blackNo', 22), caseX('คดีหมายเลขแดงที่', 'redNo', 0));
        x.push(rowX(P35.court, 10), rowX(P35.date, 4), rowX(P35.kind, 24));
        // ระหว่าง { (ตัวปีกกาสูง) โจทก์ / ผู้ร้อง / จำเลย
        const btX = (k, role, mid) => pX(spX(mid ? 4 : 10) + '<w:tabs>' + (mid ? '<w:tab w:val="left" w:pos="' + tw(1.75) + '"/>' : '') + '<w:tab w:val="left" w:pos="' + tw(P35.btw.at) + '"/>' + dotTab(P35.btw.end) +
            (mid ? '<w:tab w:val="right" w:pos="' + tw(W) + '"/>' : '') + '</w:tabs>',
            (mid ? run('ระหว่าง', true) + TAB + runX('{', 44, false) : '') + TAB + (v(k) ? runDU(v(k) + ' ') : '') + UTAB + (mid ? TAB : run(' ')) + run(role));
        x.push(btX('plaintiff', 'โจทก์'), btX('applicant', 'ผู้ร้อง', true), btX('defendant', 'จำเลย'));
        x.push(rowX(P35.me, 14));
        P35.rows.forEach((r) => x.push(rowX(r, 7)));
        x.push(pX(spX(2), run('ขอยื่นคำร้องมีข้อความตามที่จะกล่าวต่อไปนี้')));
        // ข้อ 1–3: ข้อความขีดเส้นใต้จุด + แท็บจุดนำเติมบรรทัดสุดท้ายจนสุดขอบขวา
        lines(F.body).forEach((l, i) => {
            const m = l.match(/^(ข้อ\s*[0-9๐-๙]+\.?)\s*([\s\S]*)$/);
            x.push(pX(spX(i ? 2 : 8) + '<w:tabs>' + dotTab(W) + '</w:tabs><w:ind w:firstLine="' + tw(P35.itemIndent) + '"/><w:jc w:val="thaiDistribute"/>',
                (m ? run(m[1], true) + run(' ') + runDU(m[2]) : runDU(l)) + UTAB));
        });
        x.push(pX('<w:keepNext/>' + spX(6) + '<w:jc w:val="center"/>', run(F.prayer)));
        const signRow = (name, role, pt, before) => {
            const sr = splitRank(name), lead = 'ลงชื่อ ' + (sr[0] ? sr[0] + ' ' : '');
            const k = pt / 16, from = P35.signAt + realCm(th(lead)) * k, end = W - realCm(' ' + role) * k - 0.12;   // จุดจบก่อนคำบทบาทชิดขวา
            const left = 2 * ((from + end) / 2) - W;
            return pX((sr[1] ? '<w:keepNext/>' : '') + spX(before) + '<w:tabs>' + dotTab(end) + '</w:tabs><w:ind w:left="' + tw(P35.signAt) + '"/>', run(lead, false, pt) + UTAB + run(' ' + role, false, pt)) +
                (sr[1] ? pX(spX(0) + '<w:ind w:left="' + tw(left) + '"/><w:jc w:val="center"/>', run('(' + sr[1] + ')', false, pt)) : '');
        };
        x.push(signRow(F.signName, 'ผู้ร้อง', 16, 16));
        const writer = /[ก-๙A-Za-z]/.test(F.writer || '') ? F.writer : '';
        x.push(pX('<w:keepNext/>' + spX(12) + '<w:ind w:firstLine="' + tw(P35.itemIndent) + '"/>', run('คำร้องฉบับนี้ ข้าพเจ้า ' + (F.writer || '') + ' เป็นผู้เรียงและพิมพ์', false, 14)) + signRow(writer, 'ผู้เรียงและพิมพ์', 14, 10));
        return { xml: x.join(''), margin: [2, 2, 2, 3], pageNumbers: false };
    }
        function docxBlob(t, k) {
        const thai = useThai(k);
        const th = thai ? toThai : toArabic;
        const F = fields(t);
        return jszip().then((JSZip) => {
            const b = t.kind === 'memo' ? xMemo(t, F, th) : t.kind === 'announce' ? xAnnounce(t, F, th) : t.kind === 'petition' ? xPetition(t, F, th) : xExternal(t, F, th);
            // เอกสารหน้าเดียว (หนังสือถึงศาล/คำร้อง): ระยะบรรทัด 0.9 เท่า ≈ 0.66 ซม. เท่าหน้าพิมพ์ในแอป จึงจบหน้าเดียวเหมือนกัน
            if (t.onePage) b.xml = b.xml.replace(/w:line="240" w:lineRule="auto"/g, 'w:line="216" w:lineRule="auto"');
            return docxPackage(JSZip, b.xml,{ margin: b.margin, pageNumbers: b.pageNumbers, thai: thai, finalSect: b.finalSect });
        });
    }
    function exportDocx(t, k) {
        const F = fields(t);
        api.toast('กำลังสร้างไฟล์ Word…');
        docxBlob(t, k).then((blob) => {
            const name = (String(F.subject || t.title).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'เอกสาร') + (t.kind === 'external' ? ' (หนังสือภายนอก)' : t.kind === 'memo' ? ' (บันทึกข้อความ)' : '') + '.docx';
            download(blob, name);
        }).catch((e) => { console.error('[docs] docx', e); api.toast('สร้างไฟล์ Word ไม่สำเร็จ (ต้องต่ออินเทอร์เน็ตครั้งแรกเพื่อโหลดตัวสร้างไฟล์)'); });
    }
    function download(blob, name) {
        try {
            const file = new File([blob], name, { type: blob.type });
            if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
                navigator.share({ files: [file], title: name }).catch(() => {});
                return;
            }
        } catch (e) { /* ดาวน์โหลดปกติ */ }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        api.toast('ดาวน์โหลด ' + name + ' แล้ว');
    }

    /* =====================================================================
       หน้าจอ
       ===================================================================== */
    function render() {
        if (!host || !api) return;
        if (!window.LAMHIN_DOC_KIT || !window.LAMHIN_MANUAL || !window.LAMHIN_PLAN) {
            host.innerHTML = '<div class="cmd-card"><div class="cmd-empty"><span class="spin"></span> กำลังโหลดคู่มือและแบบหนังสือ…</div></div>';
            deps().then(render).catch(() => { host.innerHTML = '<div class="cmd-card"><div class="cmd-empty">โหลดไฟล์คู่มือไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วกดแท็บนี้อีกครั้ง</div></div>'; });
            return;
        }
        if (!ev()) { host.innerHTML = '<div class="cmd-card"><div class="cmd-empty">ยังไม่มีเหตุการณ์</div></div>'; return; }
        const k = kit();
        const nav = '<div class="cmdd-top cmd-card">' +
            '<div class="cmdd-seg" role="tablist">' +
            '<button type="button" role="tab" class="' + (ui.view === 'plan' ? 'on' : '') + '" data-d="view" data-v="plan"><i class="fa-solid fa-list-ol"></i> ลำดับปฏิบัติ</button>' +
            '<button type="button" role="tab" class="' + (ui.view === 'manual' ? 'on' : '') + '" data-d="view" data-v="manual"><i class="fa-solid fa-book-open"></i> คู่มือ</button>' +
            '<button type="button" role="tab" class="' + (ui.view === 'docs' ? 'on' : '') + '" data-d="view" data-v="docs"><i class="fa-solid fa-file-pen"></i> หนังสือ</button></div>' +
            '<button type="button" class="cmd-btn sm" data-d="prompt-menu"><i class="fa-solid fa-microphone-lines"></i> อ่านหน้างาน</button>' +
            '</div>';
        host.innerHTML = nav + '<div class="cmdd-body"></div>';
        const body = host.querySelector('.cmdd-body');
        if (ui.view === 'docs') {
            const t = ui.doc ? tplById(k, ui.doc) : null;
            if (t) renderEditor(body, k, t); else renderList(body, k);
        } else if (ui.view === 'manual') renderManual(body, k);
        else renderPlan(body, k);
    }

    /* ---------------- ลำดับปฏิบัติ: ใคร ทำอะไร เมื่อไร (เรียงเวลา / รายคน / สายงาน) ----------------
       "สายงาน" = แผงของ cmdops.js (host: 'docs') ที่ cmd.js วางต่อท้ายแท็บนี้ — ที่นี่แสดงแค่แถบเลือก แล้วบอกให้ cmd.js เปิดแผง (shows) */
    function planData(k) {
        const L = window.LAMHIN_PLAN, e = ev();
        const steps = L.build(e);
        const P = {}; L.people.forEach((p) => { P[p.id] = p; });
        // ขั้นถัดไป (เฉพาะวันชุมนุม): ขั้นแรกที่ยังไม่ถึงเวลา
        let nextIdx = -1;
        const d = new Date(), today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        if (e.date === today) { const nx = steps.find((s) => s.at && s.at.getTime() >= d.getTime()); if (nx) nextIdx = nx.idx; }
        const slots = e.ops && Array.isArray(e.ops.slots) ? e.ops.slots.map((x) => String(x || '').trim()).filter(Boolean) : [];
        // ผังกำลัง/รายงานตัวจากสายงาน (cmdops.js) — แสดงในมุมมองรายคน
        const O = window.LamhinOps;
        const roster = O ? O.roster() : [], ost = O ? O.state(e) : { roster: {}, slots: [] }, assist = O ? O.assistants() : [];
        return { L: L, steps: steps, P: P, nextIdx: nextIdx, slots: slots, roster: roster, ost: ost, assist: assist, doc: (id) => (id ? tplById(k, id) : null) };
    }
    const planTime = (s, withDay) => (withDay && s.dayKey && !s.c && !s.n ? '<small>' + esc(s.dayLabel.replace(/^\S+\s/, '')) + '</small>' : '') + esc(s.time);
    function planRow(D, s, opt) {
        const t = D.doc(s.doc);
        const who = opt.who ? '<div class="cmdd-po">' + s.who.map((id, i) => {
            const p = D.P[id]; if (!p) return '';
            return '<span class="cmdd-who' + (i ? '' : ' main') + '" title="' + esc(p.name + ' · ' + p.role) + '">' + esc(p.short) + '</span>';
        }).join('') + '</div>' : '';
        const tag = opt.me ? (s.who[0] === opt.me ? '' : '<em class="cmdd-ptag">ร่วม</em>') : '';
        return '<div class="cmdd-pr' + (s.ph === 3 ? ' cond' : '') + (s.idx === D.nextIdx ? ' next' : '') + (opt.who ? '' : ' nowho') + '">' +
            '<div class="cmdd-pt">' + planTime(s, opt.day) + (s.idx === D.nextIdx ? '<i>ถัดไป</i>' : '') + '</div>' +
            '<div class="cmdd-pw"><b>' + esc(s.what) + tag + '</b>' + (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</div>' + who +
            (t ? '<button type="button" class="cmdd-pdoc" data-d="plan-doc" data-id="' + esc(s.doc) + '" title="เปิดหนังสือ: ' + esc(t.title) + '" aria-label="เปิดหนังสือ ' + esc(t.title) + '"><i class="fa-solid fa-file-lines"></i></button>' : '<span class="cmdd-pdoc0"></span>') +
            '</div>';
    }
    function planSeg(by) {
        const b = (v, ic, t) => '<button type="button" role="tab" class="' + (by === v ? 'on' : '') + '" data-d="plan-by" data-v="' + v + '"><i class="fa-solid ' + ic + '"></i> ' + t + '</button>';
        return '<div class="cmdd-seg" role="tablist" aria-label="มุมมองลำดับปฏิบัติ">' + b('time', 'fa-clock', 'เรียงเวลา') + b('person', 'fa-users', 'รายคน') + (opsReady() ? b('ops', 'fa-sitemap', 'สายงาน') : '') + '</div>';
    }
    const opsReady = () => !!(window.LamhinCmd && document.querySelector('.cmd-ext-pane[data-ext="ops"]'));
    // ช่วง "หากฝ่าฝืน" = บันได 7 ขั้น — ไม่ไล่ซ้ำในหน้าจอ พาไปแท็บ "ขั้นตอน & กฎหมาย" (ฉบับพิมพ์ยังแสดงครบ)
    function planJump() {
        return '<div class="cmdd-pjump"><span><b>ทำตามบันได 7 ขั้น ห้ามข้ามขั้น</b><small>เจรจา → ประกาศ ม.21 → ยื่นศาล → คำบังคับ → พื้นที่ควบคุม ม.23 → จับกุม ม.24 · เหตุรุนแรง ม.25 สั่งยุติได้ทันที</small></span>' +
            '<button type="button" class="cmd-btn sm gold" data-d="goto-ladder"><i class="fa-solid fa-stairs"></i> เปิดบันได 7 ขั้น</button></div>';
    }
    // ปุ่มรายงานตัว + ช่อง ผช.พงส. (ย้ายมาจากผังกำลังในสายงาน)
    function planCheckIn(D, p) {
        const R = D.roster.find((r) => r.plan === p.id);
        if (!R) return { btn: '', slots: '' };
        const at = D.ost.roster[R.id];
        const btn = '<button type="button" class="cmdd-pin' + (at ? ' on' : '') + '" data-d="ops-in" data-rid="' + esc(R.id) + '" aria-pressed="' + (!!at) + '"><i class="fa-' + (at ? 'solid fa-circle-check' : 'regular fa-circle') + '"></i> ' + (at ? 'มาแล้ว ' + esc(api.hmTh(Date.parse(at))) : 'รายงานตัว') + '</button>';
        const slots = R.group ? '<div class="cmdd-slots">' + [0, 1, 2, 3].map((i) => {
            const nm = D.ost.slots[i] || '', ph = (D.assist.find((a) => a.name === nm) || {}).phone;
            return '<div><input type="text" list="cmdd-assist" data-d="ops-slot" data-slot="' + i + '" value="' + esc(nm) + '" placeholder="' + (i + 1) + ') เลือกชื่อ ผช.พงส." aria-label="ผช.พงส. คนที่ ' + (i + 1) + '">' +
                (ph ? '<a class="cmdd-ptel" href="tel:' + ph.replace(/\D/g, '') + '" aria-label="โทร ' + esc(nm) + '"><i class="fa-solid fa-phone"></i></a>' : '') + '</div>';
        }).join('') + '</div>' : '';
        return { btn: btn, slots: slots };
    }
    function renderPlan(body, k) {
        if (ui.planBy === 'ops' && opsReady()) {
            body.innerHTML = '<div class="cmdd-ptools cmd-card">' + planSeg('ops') +
                '<small class="cmdd-psum">ความพร้อม 6 สายงาน · ผังกำลังชื่อทางการ · เช็กลิสต์เอกสารแนบคำร้องศาล — ติ๊กแล้วบันทึกในเครื่องนี้</small></div>';
            return;
        }
        const D = planData(k), byPerson = ui.planBy === 'person';
        let html = '', chips = '';
        if (!byPerson) {
            // ชิปเลือกช่วง (ค่าตั้งต้น = ทั้งหมด ต่อเนื่องตามเวลา)
            const phs = Object.keys(D.L.phases).map(Number);
            const cur = phs.indexOf(Number(ui.pphase)) !== -1 ? Number(ui.pphase) : 0;
            chips = '<div class="cmdd-chtabs cmdd-ptabs" role="tablist" aria-label="ช่วงปฏิบัติ"><button type="button" role="tab" class="' + (cur ? '' : 'on') + '" data-d="pphase" data-v="0"><span>ทั้งหมด</span></button>' +
                phs.map((n) => '<button type="button" role="tab" class="' + (cur === n ? 'on' : '') + '" data-d="pphase" data-v="' + n + '"><b>' + n + '</b><span>' + esc(D.L.phases[n].label.split(' · ')[0].split(' (')[0]) + '</span></button>').join('') + '</div>';
            let ph = 0, day = null, jumped = false;
            D.steps.filter((s) => !cur || s.ph === cur).forEach((s) => {
                if (s.ph !== ph) {
                    if (ph) html += '</section>';
                    ph = s.ph; day = null;
                    const P = D.L.phases[ph];
                    const days = ph === 1 ? D.steps.filter((x) => x.ph === 1).map((x) => x.dayLabel) : [];
                    const sub = ph === 1 ? (days[0] === days[days.length - 1] ? days[0] : days[0] + ' – ' + days[days.length - 1]) : ph === 2 ? s.dayLabel : '';
                    html += '<section class="cmdd-pgrp cmd-card"><div class="cmdd-ph"><b class="n">' + ph + '</b><i class="fa-solid ' + P.icon + '"></i><span>' + esc(P.label) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
                }
                if (ph === 1 && s.dayLabel !== day) { day = s.dayLabel; html += '<div class="cmdd-pday">' + esc(day) + '</div>'; }
                if (s.ph === 3) { if (!jumped) { jumped = true; html += planJump(); } return; }
                html += planRow(D, s, { who: true });
            });
            if (ph) html += '</section>';
        } else {
            // เลือกทีละคน (แถวชื่อด้านบน) แทนการ์ดยาวเรียงลงมา
            const people = D.L.people.filter((p) => D.steps.some((s) => s.who.indexOf(p.id) !== -1));
            const sel = people.find((p) => p.id === ui.pperson) || people[0];
            chips = '<div class="cmdd-chtabs cmdd-ptabs" role="tablist" aria-label="ผู้รับผิดชอบ">' + people.map((p) =>
                '<button type="button" role="tab" class="' + (p === sel ? 'on' : '') + '" data-d="pperson" data-v="' + p.id + '" title="' + esc(p.name) + '"><span>' + esc(p.short) + '</span><em>' + D.steps.filter((s) => s.who.indexOf(p.id) !== -1).length + '</em></button>').join('') + '</div>';
            html = [sel].map((p) => {
                const mine = D.steps.filter((s) => s.who.indexOf(p.id) !== -1);
                if (!mine.length) return '';
                const lead = mine.filter((s) => s.who[0] === p.id).length;
                const ci = planCheckIn(D, p);
                return '<section class="cmdd-pgrp cmd-card"><div class="cmdd-pph"><i class="fa-solid ' + (p.team ? 'fa-people-group' : 'fa-user-shield') + '"></i><span><b>' + esc(p.name) + '</b><small>' + esc(p.role) + '</small></span>' +
                    '<em>' + mine.length + ' งาน' + (lead && lead < mine.length ? ' · หลัก ' + lead : '') + '</em>' + ci.btn +
                    (p.tel ? '<a class="cmdd-ptel" href="tel:' + p.tel.replace(/\D/g, '') + '" aria-label="โทร ' + esc(p.name) + '"><i class="fa-solid fa-phone"></i></a>' : '') + '</div>' + ci.slots +
                    mine.map((s) => planRow(D, s, { who: false, me: p.id, day: true })).join('') + '</section>';
            }).join('') + '<datalist id="cmdd-assist">' + D.assist.map((a) => '<option value="' + esc(a.name) + '">').join('') + '</datalist>';
        }
        body.innerHTML = '<div class="cmdd-ptools cmd-card">' + planSeg(byPerson ? 'person' : 'time') +
            '<button type="button" class="cmd-btn sm gold" data-d="print-plan"><i class="fa-solid fa-print"></i> พิมพ์</button>' +
            chips + '</div>' + html;
    }
    function printPlan(k) {
        const D = planData(k), byPerson = ui.planBy === 'person', e = ev();
        const names = (ids) => ids.map((id) => (D.P[id] ? D.P[id].name : '')).filter(Boolean).join(', ');
        const tr = (s, who) => '<tr><td class="t">' + (s.dayKey && !s.c && !s.n ? esc(s.dayLabel.replace(/^\S+\s/, '')) + '<br>' : '') + esc(s.time) + '</td><td><b>' + esc(s.what) + '</b>' + (s.note ? '<br><small>' + esc(s.note) + '</small>' : '') + '</td>' + (who ? '<td>' + esc(names(s.who)) + '</td>' : '') + '</tr>';
        let body = '<div class="pp"><h1>ลำดับปฏิบัติงานสอบสวน — ' + esc(e.title || 'การชุมนุมสาธารณะ') + '</h1><p class="sub">' + esc((D.steps.find((s) => s.ph === 2) || {}).dayLabel || '') + ' · เรียง' + (byPerson ? 'รายผู้รับผิดชอบ' : 'ตามเวลา') + '</p>';
        if (!byPerson) {
            body += '<table><thead><tr><th style="width:2.4cm">เวลา</th><th>ขั้นตอน</th><th style="width:5.4cm">ผู้รับผิดชอบ</th></tr></thead><tbody>';
            let ph = 0;
            D.steps.forEach((s) => { if (s.ph !== ph) { ph = s.ph; body += '<tr class="ph"><td colspan="3">' + ph + '. ' + esc(D.L.phases[ph].label) + '</td></tr>'; } body += tr(s, true); });
            body += '</tbody></table>';
        } else {
            D.L.people.forEach((p) => {
                const mine = D.steps.filter((s) => s.who.indexOf(p.id) !== -1); if (!mine.length) return;
                body += '<h3>' + esc(p.name) + ' <small>' + esc(p.role) + (p.tel ? ' · โทร. ' + esc(p.tel) : '') + '</small></h3><table><tbody>' + mine.map((s) => tr(s, false)).join('') + '</tbody></table>';
            });
        }
        body += '</div>';
        printHtml(body, {
            title: 'ลำดับปฏิบัติ', thai: false, pageNumbers: false,
            extraCss: '@page{size:A4;margin:1.6cm 1.5cm 1.6cm 2cm}' +
                '.pp{font-family:"THSarabunDoc","TH SarabunPSK",Sarabun,sans-serif;font-size:15pt;line-height:1.2;color:#000}.pp h1{font-size:20pt;text-align:center;margin:0}.pp .sub{text-align:center;margin:0 0 8pt}' +
                '.pp table{width:100%;border-collapse:collapse;margin:0 0 6pt}.pp th,.pp td{border:1px solid #777;padding:2pt 5pt;vertical-align:top;text-align:left}.pp th{background:#eef;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
                '.pp td.t{white-space:nowrap;font-weight:700}.pp tr{break-inside:avoid}.pp small{font-size:13pt;color:#333}.pp tr.ph td{background:#0A1628;color:#fff;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
                '.pp h3{font-size:16pt;margin:10pt 0 3pt;break-after:avoid}.pp h3 small{font-weight:400}'
        });
    }

    /* ---------------- คู่มือ ---------------- */
    function manualHtml(sec) {
        const e = ev();
        const s = e && e.docs && e.docs['manual:' + sec.id];
        return s ? s.html : sec.html;
    }
    // คู่มือแบบแท็บ: แท็บบท (แถวบน) → แท็บหัวข้อในบท → แสดงทีละหัวข้อ ไม่ต้องเลื่อนยาว · ค้นหา = รายการหัวข้อที่พบ กดเพื่อเปิด
    function secArticle(s, e) {
        const edited = !!(e.docs && e.docs['manual:' + s.id]);
        return '<article class="cmdd-sec" data-sec="' + s.id + '"><header><h4>' + esc(s.title) + '</h4><div class="cmdd-tools">' +
            (s.script ? '<button type="button" class="cmd-btn sm neon" data-d="prompt-sec" data-id="' + s.id + '"><i class="fa-solid fa-microphone-lines"></i> อ่านหน้างาน</button>' : '') +
            '<button type="button" class="cmd-btn sm" data-d="edit-sec" data-id="' + s.id + '"><i class="fa-solid fa-pen"></i> แก้ไข</button>' +
            (edited ? '<button type="button" class="cmd-btn sm danger" data-d="reset-sec" data-id="' + s.id + '" title="คืนค่าข้อความเดิม"><i class="fa-solid fa-rotate-left"></i></button>' : '') +
            '</div></header><div class="cmdd-md">' + manualHtml(s) + '</div></article>';
    }
    function renderManual(body, k) {
        const M = window.LAMHIN_MANUAL;
        const q = String(ui.q || '').trim().toLowerCase();
        const e = ev();
        const head = '<div class="cmdd-mhead cmd-card"><div class="cmdd-mtools"><label class="cmdd-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-d="q" placeholder="ค้นหาในคู่มือ เช่น ม.21, ยึดรถ, ศาล" value="' + esc(ui.q || '') + '"></label>' +
            '<button type="button" class="cmd-btn sm gold" data-d="print-manual"><i class="fa-solid fa-print"></i> พิมพ์คู่มือ</button></div>';
        if (q) {
            const hits = [];
            M.chapters.forEach((c) => c.sections.forEach((s) => { if ((s.title + ' ' + stripTags(manualHtml(s))).toLowerCase().indexOf(q) !== -1) hits.push({ c: c, s: s }); }));
            body.innerHTML = head + '<div class="cmdd-hits">พบ ' + hits.length + ' หัวข้อ — กดเพื่อเปิด</div></div>' +
                (hits.length ? '<div class="cmd-card cmdd-hitlist">' + hits.map((h) => '<button type="button" class="cmdd-hit" data-d="msec" data-ch="' + h.c.id + '" data-id="' + h.s.id + '"><small>' + esc(h.c.no) + '</small><b>' + esc(h.s.title) + '</b><i class="fa-solid fa-chevron-right"></i></button>').join('') + '</div>'
                    : '<div class="cmd-card"><div class="cmd-empty">ไม่พบคำที่ค้นหา</div></div>');
            return;
        }
        const ch = M.chapters.find((c) => c.id === ui.ch) || M.chapters[0];
        ui.sec = ui.sec || {};
        const sec = ch.sections.find((s) => s.id === ui.sec[ch.id]) || ch.sections[0];
        body.innerHTML = head + '<div class="cmdd-chtabs" role="tablist" aria-label="บทในคู่มือ">' + M.chapters.map((c) =>
            '<button type="button" role="tab" class="' + (c === ch ? 'on' : '') + '" data-d="mch" data-id="' + c.id + '" title="' + esc(c.no + ' ' + c.title) + '"><i class="fa-solid ' + c.icon + '"></i><span>' + esc(c.no.replace('บทที่ ', 'บท ')) + '</span></button>').join('') + '</div></div>' +
            '<section class="cmd-card cmdd-chbox"><div class="cmdd-chtitle"><small>' + esc(ch.no) + '</small><b>' + esc(ch.title) + '</b></div>' +
            (ch.sections.length > 1 ? '<div class="cmdd-sectabs" role="tablist" aria-label="หัวข้อในบท">' + ch.sections.map((s) =>
                '<button type="button" role="tab" class="' + (s === sec ? 'on' : '') + '" data-d="msec" data-ch="' + ch.id + '" data-id="' + s.id + '">' + esc(s.title.replace(/\s*\(.*\)\s*$/, '')) + '</button>').join('') + '</div>' : '') +
            secArticle(sec, e) + '</section>';
    }
    const stripTags = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    function findSection(id) {
        const M = window.LAMHIN_MANUAL;
        for (const c of M.chapters) for (const s of c.sections) if (s.id === id) return s;
        return null;
    }
    // อนุญาตเฉพาะแท็กจัดรูปแบบพื้นฐาน (ข้อความที่แก้/นำเข้าจาก JSON)
    function sanitize(html) {
        const ok = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, P: 1, DIV: 1, SPAN: 1, UL: 1, OL: 1, LI: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, SMALL: 1, A: 1, MARK: 1 };
        const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
        const walk = (node) => {
            Array.from(node.childNodes).forEach((ch) => {
                if (ch.nodeType === 1) {
                    if (!ok[ch.tagName]) { walk(ch); while (ch.firstChild) node.insertBefore(ch.firstChild, ch); ch.remove(); return; }
                    Array.from(ch.attributes).forEach((a) => {
                        const keep = (a.name === 'class') || (a.name === 'colspan' || a.name === 'rowspan') || (ch.tagName === 'A' && a.name === 'href' && /^tel:[0-9+]+$/.test(a.value));
                        if (!keep) ch.removeAttribute(a.name);
                    });
                    walk(ch);
                } else if (ch.nodeType !== 3) ch.remove();
            });
        };
        const rootEl = doc.body.firstChild;
        walk(rootEl);
        return rootEl.innerHTML;
    }
    function editSection(id) {
        const art = host.querySelector('.cmdd-sec[data-sec="' + id + '"]'); if (!art) return;
        const md = art.querySelector('.cmdd-md');
        const before = md.innerHTML;
        md.contentEditable = 'true'; md.classList.add('editing'); md.focus();
        const bar = document.createElement('div');
        bar.className = 'cmdd-editbar';
        bar.innerHTML = '<span><i class="fa-solid fa-pen"></i> กำลังแก้ไข — พิมพ์ทับได้เลย (Ctrl+B ตัวหนา)</span><button type="button" class="cmd-btn sm" data-x="cancel">ยกเลิก</button><button type="button" class="cmd-btn sm gold" data-x="save"><i class="fa-solid fa-floppy-disk"></i> บันทึก</button>';
        art.insertBefore(bar, md);
        bar.addEventListener('click', (e) => {
            const b = e.target.closest('[data-x]'); if (!b) return;
            if (b.dataset.x === 'save') {
                const ev0 = ev(); ev0.docs = ev0.docs || {};
                const clean = sanitize(md.innerHTML);
                const sec = findSection(id);
                if (sec && clean.replace(/\s+/g, '') === sec.html.replace(/\s+/g, '')) delete ev0.docs['manual:' + id];
                else ev0.docs['manual:' + id] = { html: clean, at: new Date().toISOString() };
                api.save(); api.toast('บันทึกหัวข้อแล้ว');
            } else md.innerHTML = before;
            render();
        });
    }
    function printManual() {
        const M = window.LAMHIN_MANUAL;
        const body = '<div class="mp"><h1>' + esc(M.title) + '</h1><p class="mp-sub">' + esc(M.sub) + '</p><p class="mp-by">' + esc(M.by) + '</p>' +
            M.chapters.map((c) => '<h2>' + esc(c.no + ' ' + c.title) + '</h2>' + c.sections.map((s) => '<h3>' + esc(s.title) + '</h3>' + manualHtml(s)).join('')).join('') + '</div>';
        printHtml(body, {
            title: M.title, thai: false, pageNumbers: false,
            extraCss: '@page{size:A4;margin:1.8cm 1.6cm 1.8cm 2.2cm;@bottom-center{content:counter(page);font-family:"THSarabunDoc";font-size:13pt}}' +
                '.mp{font-family:"THSarabunDoc","TH SarabunPSK",Sarabun,sans-serif;font-size:15pt;line-height:1.25;color:#000}.mp h1{font-size:24pt;text-align:center;margin:0}.mp-sub,.mp-by{text-align:center;margin:2pt 0}' +
                '.mp h2{font-size:19pt;margin:14pt 0 4pt;padding:3pt 8pt;background:#0A1628;color:#fff;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}.mp h3{font-size:16pt;margin:10pt 0 3pt;break-after:avoid;border-bottom:1px solid #999}' +
                '.mp table{width:100%;border-collapse:collapse;margin:4pt 0;break-inside:auto}.mp th,.mp td{border:1px solid #777;padding:2pt 5pt;vertical-align:top;text-align:left}.mp th{background:#eef;-webkit-print-color-adjust:exact;print-color-adjust:exact}.mp tr{break-inside:avoid}' +
                '.mp .note{border:1px solid #999;border-left:4px solid #b45309;padding:4pt 8pt;margin:4pt 0}.mp .note.danger{border-left-color:#b91c1c}.mp ol,.mp ul{margin:3pt 0 3pt 20pt;padding:0}.mp p{margin:3pt 0}.mp a{color:#000;text-decoration:none}.mp ul.ck{list-style:none;margin-left:6pt}'
        });
    }

    /* ---------------- รายการหนังสือ ---------------- */
    function renderList(body, k) {
        const e = ev();
        const officeMissing = /\.{6,}/.test(k.prefs.office || '') || !String(k.prefs.phone || '').trim();
        const groups = [];
        k.templates.forEach((t) => { let g = groups.find((x) => x.name === t.group); if (!g) groups.push(g = { name: t.group, items: [] }); g.items.push(t); });
        const logN = Array.isArray(e.log) ? e.log.length : 0;
        const g0 = groups.find((g) => g.name === ui.grp) || groups[0];
        const tabs = '<div class="cmdd-chtabs cmdd-gtabs" role="tablist" aria-label="กลุ่มหนังสือ">' + groups.map((g) =>
            '<button type="button" role="tab" class="' + (g === g0 ? 'on' : '') + '" data-d="grp" data-v="' + esc(g.name) + '"><span>' + esc(g.name.replace(/\s*\(.*\)$/, '')) + '</span><em>' + g.items.length + '</em></button>').join('') + '</div>';
        body.innerHTML = '<div class="cmdd-lhead cmd-card">' +
            '<div class="cmdd-ltools">' +
            '<button type="button" class="cmd-btn sm gold" data-d="print-set"><i class="fa-solid fa-print"></i> พิมพ์ชุดเอกสารประสานงาน</button>' +
            '<button type="button" class="cmd-btn sm" data-d="prefs"><i class="fa-solid fa-gear"></i> ค่ากลางหน่วยงาน</button>' +
            '<button type="button" class="cmd-btn sm" data-d="digits"><i class="fa-solid fa-hashtag"></i> ' + (useThai(k) ? 'เลขไทย ๑๒๓' : 'เลขอารบิก 123') + '</button></div>' +
            (officeMissing ? '<div class="cmdd-warn"><i class="fa-solid fa-circle-exclamation"></i> ยังไม่ได้กรอกที่ตั้ง/โทรศัพท์ของ สน.ลำหิน — กด "ค่ากลางหน่วยงาน" กรอกครั้งเดียว ใช้กับหนังสือทุกฉบับ</div>' : '') +
            (e.category && e.category !== 'ชุมนุมสาธารณะ' ? '<div class="cmdd-warn"><i class="fa-solid fa-circle-info"></i> แบบหนังสือชุดนี้ตั้งต้นจากการชุมนุม 28 พ.ย. 69 — แก้ข้อความให้ตรงเหตุการณ์ก่อนพิมพ์</div>' : '') +
            tabs + '</div>' +
            [g0].map((g) => '<section class="cmd-card cmdd-grp"><div class="cmdd-cards">' +
                g.items.map((t) => {
                    const edited = !!(e.docs && e.docs[t.id]);
                    return '<button type="button" class="cmdd-doc" data-d="open" data-id="' + t.id + '"><i class="fa-solid ' + t.icon + '"></i><span><b>' + esc(t.title) + '</b><small>' + esc(t.to || '') + '</small>' +
                        '<em>' + (t.kind === 'memo' ? 'บันทึกข้อความ' : t.kind === 'external' ? 'หนังสือภายนอก' : t.kind === 'petition' ? 'แบบพิมพ์ศาล' : 'ประกาศ / คำสั่ง') +
                        (edited ? ' · <u>แก้ไขแล้ว</u>' : '') + (t.fromLog ? ' · ดึงจากบันทึก ศปก. (' + logN + ')' : '') + '</em></span><i class="fa-solid fa-chevron-right"></i></button>';
                }).join('') + '</div></section>').join('');
    }

    /* ---------------- ตัวแก้ไขหนังสือ ---------------- */
    const FIELDS = {
        memo: [['department', 'ส่วนราชการ'], ['phone', 'โทร. (ต่อท้ายส่วนราชการ)'], ['no', 'ที่ (หนังสือภายในไม่มี "ตช")'], ['date', 'วันที่'], ['subject', 'เรื่อง', 'ml', 2], ['to', 'เรียน'],
            ['body', 'เนื้อความ — บรรทัดละ 1 ย่อหน้า · ขึ้นต้น 1. / 1.1 / 1.1.1 = ลำดับหัวข้ออัตโนมัติ', 'body', 16], ['closing', 'ย่อหน้าลงท้าย (จึงเรียนมา…)', 'ml', 2],
            ['signRank', 'ยศผู้ลงนาม (แสดงบรรทัดแยก)'], ['signName', 'ชื่อ-สกุลผู้ลงนาม'], ['signPos', 'ตำแหน่ง (บรรทัดละ 1 บรรทัด)', 'ml', 2]],
        external: [['no', 'ที่'], ['office', 'ส่วนราชการเจ้าของหนังสือ / ที่ตั้ง (บรรทัดละ 1 บรรทัด)', 'ml', 3], ['date', 'วัน เดือน ปี'], ['subject', 'เรื่อง', 'ml', 2], ['to', 'เรียน'],
            ['refs', 'อ้างถึง (ถ้ามี)', 'ml', 2], ['attach', 'สิ่งที่ส่งมาด้วย (ถ้ามี)', 'ml', 2],
            ['body', 'เนื้อความ — บรรทัดละ 1 ย่อหน้า · ขึ้นต้น 1. = ข้อย่อย (ย่อหน้า 3 ซม.) · # = หัวข้อตัวหนา', 'body', 16], ['closing', 'คำลงท้าย'],
            ['signRank', 'ยศ (เต็ม)'], ['signName', 'ชื่อ-สกุล'], ['signPos', 'ตำแหน่ง (บรรทัดละ 1 บรรทัด)', 'ml', 2], ['owner', 'ส่วนราชการเจ้าของเรื่อง / โทร. / โทรสาร', 'ml', 3]],
        petition: [['formCode', 'รหัสแบบ (มุมขวาบน)'], ['title', 'ชื่อคำร้อง (ชิดซ้ายบน)'], ['blackNo', 'คดีหมายเลขดำที่'], ['redNo', 'คดีหมายเลขแดงที่'],
            ['court', 'ศาล (เช่น แพ่งมีนบุรี)'], ['day', 'วันที่'], ['month', 'เดือน'], ['year', 'พุทธศักราช'], ['caseKind', 'ความ'],
            ['plaintiff', 'ระหว่าง — โจทก์ (เว้นว่าง)'], ['applicant', 'ระหว่าง — ผู้ร้อง'], ['defendant', 'ระหว่าง — จำเลย (เว้นว่าง)'],
            ['pName', 'ข้าพเจ้า (ยศ ชื่อ-สกุล ตำแหน่ง)'], ['race', 'เชื้อชาติ'], ['nationality', 'สัญชาติ'], ['occupation', 'อาชีพ'],
            ['birthDay', 'เกิดวันที่'], ['birthMonth', 'เดือน'], ['birthYear', 'พ.ศ.'], ['age', 'อายุ (ปี)'], ['houseNo', 'อยู่บ้านเลขที่'], ['moo', 'หมู่ที่'],
            ['road', 'ถนน'], ['soi', 'ตรอก/ซอย'], ['near', 'ใกล้เคียง'], ['subdistrict', 'ตำบล/แขวง'], ['district', 'อำเภอ/เขต'], ['province', 'จังหวัด'], ['phone', 'โทรศัพท์'],
            ['body', 'ข้อความคำร้อง — บรรทัดละ 1 ข้อ ("ข้อ 1." เป็นตัวหนา)', 'body', 14],
            ['prayer', 'คำลงท้าย'], ['signName', 'ผู้ร้อง (ชื่อในวงเล็บใต้ลายมือชื่อ)'], ['writer', 'ผู้เรียงและพิมพ์ (ยศ ชื่อ-สกุล)']],
        announce: [['formCode', 'รหัสแบบ (มุมขวาบน)'], ['issuer', 'หัวประกาศ / คำสั่ง (บรรทัดละ 1 บรรทัด · ตัวหนา)', 'ml', 2], ['no', 'ที่'], ['subject', 'เรื่อง'],
            ['body', 'ข้อความ — บรรทัดละ 1 ย่อหน้า · [ช่อง] = เส้นจุด · «…» = คำแนะนำ (ไม่พิมพ์)', 'body', 14], ['effective', 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป'], ['given', 'ประกาศ / สั่ง ณ วันที่'],
            ['signName', 'ผู้ลงนาม (ยศ ชื่อ-สกุล)'], ['signPos', 'ตำแหน่ง (บรรทัดละ 1 บรรทัด)', 'ml', 2], ['notes', 'หมายเหตุ (บรรทัดละ 1 ข้อ)', 'ml', 5]]
    };
    function renderEditor(body, k, t) {
        const F = fields(t);
        const s = saved(t);
        const list = FIELDS[t.kind].slice();
        if (t.kind === 'external' && t.defaults.formCode != null) list.unshift(['formCode', 'รหัสแบบ (มุมขวาบน)']);
        if (t.kind === 'external' && t.defaults.annexBody != null) list.push(['annexCode', 'สิ่งที่ส่งมาด้วย: ข้อความมุมขวาบน'], ['annexTitle', 'สิ่งที่ส่งมาด้วย: ชื่อเรื่อง (บรรทัดละ 1 บรรทัด)', 'ml', 2],
            ['annexBody', 'สิ่งที่ส่งมาด้วย: เนื้อหา — "#" = หัวข้อตัวหนา', 'body', 12]);
        if (t.receipt) list.push(['receiptText', 'บันทึกการรับทราบ (ท้ายหนังสือ)', 'ml', 3], ['recvName', 'ผู้รับทราบ'], ['giverName', 'ผู้ส่งมอบ']);
        const input = (f) => {
            const v = F[f[0]] == null ? '' : F[f[0]];
            const changed = f[0] in s;
            const lab = '<span>' + esc(f[1]) + (changed ? ' <u>แก้ไขแล้ว</u>' : '') + '</span>';
            if (f[2] === 'ml' || f[2] === 'body') return '<label class="cmd-f full' + (f[2] === 'body' ? ' cmdd-bodyf' : '') + '">' + lab + '<textarea data-k="' + f[0] + '" rows="' + (f[3] || 3) + '" spellcheck="false">' + esc(v) + '</textarea></label>';
            return '<label class="cmd-f">' + lab + '<input data-k="' + f[0] + '" value="' + esc(v) + '"></label>';
        };
        let varsHtml = '';
        if (t.vars) {
            const bodyEdited = 'body' in s;
            varsHtml = '<div class="cmdd-vars full"><div class="cmdd-vars-h"><i class="fa-solid fa-wand-magic-sparkles"></i> ช่องกรอกหน้างาน — ข้อความประกาศอัปดตอัตโนมัติ' +
                '<button type="button" class="cmd-btn sm neon" data-d="now">เวลาปัจจุบัน + คำนวณครบกำหนด</button></div>' +
                (bodyEdited ? '<div class="cmdd-warn"><i class="fa-solid fa-circle-info"></i> ข้อความประกาศถูกแก้เอง ช่องกรอกจะไม่เปลี่ยนข้อความ — กด "คืนค่าข้อความ" เพื่อกลับมาใช้ช่องกรอก <button type="button" class="cmd-btn sm" data-d="unbody">คืนค่าข้อความ</button></div>' : '') +
                '<div class="cmd-form">' + t.vars.map((v) => '<label class="cmd-f"><span>' + esc(v[1]) + '</span><input data-k="' + v[0] + '" value="' + esc(F[v[0]] || '') + '" placeholder="' + esc(v[2] || '') + '"></label>').join('') + '</div></div>';
        }
        body.innerHTML = '<div class="cmdd-edhead cmd-card">' +
            '<button type="button" class="cmd-btn sm" data-d="back"><i class="fa-solid fa-chevron-left"></i> รายการ</button>' +
            '<div class="cmdd-edtitle"><i class="fa-solid ' + t.icon + '"></i><span><b>' + esc(t.title) + '</b><small>' + esc(t.group) + '</small></span></div>' +
            '<div class="cmdd-edtools">' +
            '<button type="button" class="cmd-btn sm gold" data-d="print"><i class="fa-solid fa-print"></i> พิมพ์ / PDF</button>' +
            '<button type="button" class="cmd-btn sm" data-d="docx"><i class="fa-solid fa-file-word"></i> Word</button>' +
            (t.script ? '<button type="button" class="cmd-btn sm neon" data-d="prompt-doc"><i class="fa-solid fa-microphone-lines"></i> อ่านหน้างาน</button>' : '') +
            (t.fromLog ? '<button type="button" class="cmd-btn sm" data-d="fromlog" title="สร้างข้อความใหม่จากบันทึก ศปก. ล่าสุด"><i class="fa-solid fa-rotate"></i> ดึงจากบันทึก ศปก.</button>' : '') +
            '<button type="button" class="cmd-btn sm" data-d="digits"><i class="fa-solid fa-hashtag"></i> ' + (useThai(k) ? '๑๒๓' : '123') + '</button>' +
            '<button type="button" class="cmd-btn sm danger" data-d="reset"' + (Object.keys(s).length ? '' : ' disabled') + '><i class="fa-solid fa-rotate-left"></i> คืนค่าตั้งต้น</button>' +
            '</div></div>' +
            '<div class="cmdd-mseg"><button type="button" data-d="mob" data-v="form" class="' + (ui.mob !== 'preview' ? 'on' : '') + '"><i class="fa-solid fa-pen"></i> แก้ไขข้อความ</button><button type="button" data-d="mob" data-v="preview" class="' + (ui.mob === 'preview' ? 'on' : '') + '"><i class="fa-solid fa-file"></i> ตัวอย่าง A4</button></div>' +
            '<div class="cmdd-ed' + (ui.mob === 'preview' ? ' show-pv' : ' show-form') + '">' +
            '<div class="cmdd-form cmd-card"><div class="cmd-form">' + varsHtml +
            '<details class="cmdd-allf full"' + (ui.allf ? ' open' : '') + '><summary><i class="fa-solid fa-list"></i> ช่องกรอกทั้งหมด (' + list.length + ' ช่อง) <small>หรือแตะแก้บนกระดาษ A4 ได้เลย</small></summary><div class="cmd-form">' + list.map(input).join('') + '</div></details></div></div>' +
            '<div class="cmdd-pvwrap"><div class="cmdd-pvbar"><span><i class="fa-solid fa-pen-to-square"></i> กระดาษ A4 — แตะข้อความเพื่อแก้ได้ทันที · Enter = บันทึก · Esc = ยกเลิก</span><small data-pages></small></div><div class="cmdd-pv"><div class="cmdd-pv-in"></div></div></div>' +
            '</div>';
        const af = body.querySelector('.cmdd-allf');
        if (af) af.addEventListener('toggle', () => { ui.allf = af.open; saveUi(); });
        drawPreview(body, k, t);
    }
    let pvTimer = 0, pvGen = 0;
    function drawPreview(body, k, t) {
        const pv = body.querySelector('.cmdd-pv'), inn = body.querySelector('.cmdd-pv-in');
        if (!pv || !inn) return;
        const gen = ++pvGen;
        const thai = useThai(k);
        if (!inn.firstChild) inn.innerHTML = '<div class="cmdd-pvwait"><span class="spin"></span> กำลังจัดหน้า A4…</div>';
        showHints = true;   // หน้าตัวอย่างเท่านั้น: แสดงคำแนะนำ «…» สีเทา (หน้าพิมพ์/Word ไม่แสดง)
        let flow;
        try { flow = renderDoc(t, fields(t), thai); } finally { showHints = false; }
        paginate(flow, { pageNumbers: t.kind === 'external', thai: thai }).then((html) => {
            if (gen !== pvGen || !inn.isConnected) return;
            inn.innerHTML = html;
            inn.querySelectorAll('.ds-ed').forEach((x) => { x.contentEditable = 'true'; x.spellcheck = false; });   // แตะแก้บนกระดาษได้
            edCtx = { t: t, k: k };
            fitPreview(pv, inn);
        });
    }

    /* ---------------- แก้ข้อความบนกระดาษ A4 โดยตรง ----------------
       แตะข้อความ → พิมพ์ → Enter หรือแตะที่อื่น = บันทึกเข้าช่องเดิม (ช่องกรอกด้านซ้ายอัปเดตตาม) แล้วจัดหน้าใหม่ · Esc = ยกเลิก
       เส้นจุด [ช่อง] / คำแนะนำ «…» ที่ไม่ได้แตะยังคงเป็นช่อง/คำแนะนำเหมือนเดิม */
    let edCtx = null, edCancel = false;
    function edText(el) {
        const c = el.cloneNode(true);
        c.querySelectorAll('.ds-dl').forEach((x) => {
            const typed = x.textContent.replace(/\u00A0/g, '').trim();
            const lab = String(x.getAttribute('title') || '').replace(/^กรอก:\s*/, '');
            const dots = '.'.repeat(Math.max(4, Math.round((parseFloat(x.style.width) || 0) / DOT_CM)));
            x.replaceWith(document.createTextNode(typed || (x.classList.contains('ds-ph') && lab ? '[' + lab + ']' : dots)));
        });
        c.querySelectorAll('.ds-hint').forEach((x) => x.replaceWith(document.createTextNode(' ' + x.textContent)));
        return c.textContent;
    }
    function edCommit(el) {
        if (!edCtx) return 0;
        const t = edCtx.t, k = edCtx.k;
        const key = el.dataset.ed, li = el.dataset.li, sr = el.dataset.sr || '';
        const sel = '[data-ed="' + key + '"]' + (li != null ? '[data-li="' + li + '"]' : ':not([data-li])') + (sr ? '[data-sr="' + sr + '"]' : ':not([data-sr])');
        let text = Array.from(host.querySelectorAll('.cmdd-pv ' + sel)).map(edText).join('').replace(/[ \t\r\n]+/g, ' ').trim();
        if (useThai(k)) text = toArabic(text);
        text = (el.dataset.pre || '') + text;
        const F = fields(t);
        const cur = String(F[key] == null ? '' : F[key]);
        let val, removed = false;
        if (sr) { const p = splitRank(cur); val = (sr === 'rank' ? text + ' ' + p[1] : (p[0] ? p[0] + ' ' : '') + text).trim(); }
        else if (li != null) {
            const arr = lines(cur), i = Number(li);
            if (!text.trim() || text === (el.dataset.pre || '')) { arr.splice(i, 1); removed = true; } else arr[i] = text;   // ลบข้อความหมด = ลบย่อหน้านั้น
            val = arr.join('\n');
        } else val = text;
        // ประกาศ: เวลาที่มาจากช่องกรอก "เวลาที่ประกาศ" คงเป็นตัวแปรเดิม
        if (t.kind === 'announce' && key === 'given') {
            const src = String(saved(t).given != null ? saved(t).given : t.defaults.given || '');
            const shown = String(F.varAt || '').trim() || '[เวลา]';
            if (src.indexOf('{varAt}') !== -1 && val.indexOf(shown) !== -1) val = val.replace(shown, '{varAt}');
        }
        if (val === cur) return 0;
        setField(t, key, val);
        const inp = host.querySelector('.cmdd-form [data-k="' + key + '"]'); if (inp) inp.value = val;
        const rb = host.querySelector('[data-d="reset"]'); if (rb) rb.disabled = !Object.keys(saved(t)).length;
        return removed ? 2 : 1;
    }
    const edRedraw = () => { const b = host.querySelector('.cmdd-body'); if (b && edCtx) drawPreview(b, kit(), edCtx.t); };
    function onEdKey(e) {
        const el = e.target.closest && e.target.closest('.cmdd-pv .ds-ed'); if (!el) return;
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); edCancel = true; el.blur(); }
    }
    function onEdPaste(e) {
        const el = e.target.closest && e.target.closest('.cmdd-pv .ds-ed'); if (!el) return;
        e.preventDefault();
        const tx = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\s+/g, ' ');
        document.execCommand('insertText', false, tx);
    }
    function onEdBlur(e) {
        const el = e.target.closest && e.target.closest('.cmdd-pv .ds-ed'); if (!el) return;
        if (edCancel) { edCancel = false; edRedraw(); return; }
        const r = edCommit(el);
        if (r === 2) { edPending = false; edRedraw(); return; }   // ย่อหน้าถูกลบ: ลำดับบรรทัดเปลี่ยน ต้องจัดหน้าใหม่ทันที
        if (r) edPending = true;
        // จัดหน้าใหม่เมื่อเลิกแก้ (ถ้าแตะไปแก้อีกจุดทันที รอจนเลิกแก้จุดนั้น)
        setTimeout(() => {
            const a = document.activeElement;
            if (edPending && !(a && a.closest && a.closest('.cmdd-pv .ds-ed'))) { edPending = false; edRedraw(); }
        }, 0);
    }
    let edPending = false;
    function fitPreview(pv, inn) {
        const w = pv.clientWidth || 600;
        const pages = Array.from(inn.querySelectorAll('.ds-page'));
        const pagePx = Math.max(21 * PX_CM, ...pages.map((x) => x.offsetWidth));   // ใบปะหน้าแนวนอนกว้าง 29.7 ซม.
        const s = Math.min(1.25, w / pagePx);
        inn.style.transform = 'scale(' + s + ')';
        inn.style.width = pagePx + 'px';
        pv.style.height = Math.ceil(inn.scrollHeight * s) + 'px';
        const info = pv.parentNode.querySelector('[data-pages]');
        if (info) info.textContent = pages.length + ' หน้า (A4)';
    }

    /* ---------------- โหมดอ่านหน้างาน (ตัวใหญ่) ---------------- */
    function prompter(title, html, tpl) {
        const k = kit();
        const wrap = document.createElement('div');
        wrap.className = 'cmdd-tp';
        const draw = () => {
            let text = html;
            if (tpl) {   // อ่านประกาศ/คำสั่งทั้งฉบับ: หัว · เรื่อง · เนื้อความ · ทั้งนี้… · ประกาศ ณ วันที่ (ไม่อ่านคำแนะนำ «…»)
                const F = fields(tpl), cl = (s) => esc(noHints(s)).replace(PH_RE, PH_DOTS);
                text = '<p class="cmdd-tp-hd">' + lines(F.issuer).map(cl).join('<br>') + (String(F.subject || '').trim() ? '<br>เรื่อง ' + cl(F.subject) : '') + '</p>' +
                    lines(F.body).map((l) => '<p>' + cl(l) + '</p>').join('') + (String(F.effective || '').trim() ? '<p>' + cl(F.effective) + '</p>' : '') + '<p>' + cl(F.given) + '</p>';
            }
            wrap.querySelector('.cmdd-tp-text').innerHTML = text;
        };
        const varRow = tpl ? '<div class="cmdd-tp-vars">' + tpl.vars.filter((v) => /^(varAt|varWithin|varDeadline)$/.test(v[0])).map((v) =>
            '<label><span>' + esc(v[1]) + '</span><input data-k="' + v[0] + '" value="' + esc(fields(tpl)[v[0]] || '') + '" placeholder="' + esc(v[2] || '') + '"></label>').join('') +
            '<button type="button" data-tp="now">เวลาปัจจุบัน</button></div>' : '';
        wrap.innerHTML = '<div class="cmdd-tp-bar"><b>' + esc(title) + '</b><span>' +
            '<button type="button" data-tp="minus" aria-label="ตัวเล็กลง">A−</button><button type="button" data-tp="plus" aria-label="ตัวใหญ่ขึ้น">A+</button>' +
            '<button type="button" data-tp="scroll"><i class="fa-solid fa-play"></i> เลื่อนอัตโนมัติ</button>' +
            '<button type="button" data-tp="copy"><i class="fa-solid fa-copy"></i> คัดลอก</button>' +
            '<button type="button" data-tp="print"><i class="fa-solid fa-print"></i> พิมพ์ A4</button>' +
            '<button type="button" data-tp="close" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button></span></div>' + varRow +
            '<div class="cmdd-tp-scroll"><div class="cmdd-tp-text" style="font-size:' + ui.prompt + 'px"></div></div>';
        document.body.appendChild(wrap);
        draw();
        let auto = 0;
        const sc = wrap.querySelector('.cmdd-tp-scroll');
        const close = () => { clearInterval(auto); wrap.remove(); document.removeEventListener('keydown', onKey); render(); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        wrap.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tp]'); if (!b) return;
            const a = b.dataset.tp;
            if (a === 'close') close();
            else if (a === 'plus' || a === 'minus') {
                ui.prompt = Math.max(18, Math.min(72, ui.prompt + (a === 'plus' ? 4 : -4))); saveUi();
                wrap.querySelector('.cmdd-tp-text').style.fontSize = ui.prompt + 'px';
            } else if (a === 'scroll') {
                if (auto) { clearInterval(auto); auto = 0; b.innerHTML = '<i class="fa-solid fa-play"></i> เลื่อนอัตโนมัติ'; }
                else { auto = setInterval(() => { sc.scrollTop += 1; }, 45); b.innerHTML = '<i class="fa-solid fa-pause"></i> หยุด'; }
            } else if (a === 'copy') {   // คัดลอกข้อความที่แสดงอยู่ (รวมเวลา/พฤติการณ์ที่กรอกแล้ว) ไปวาง LINE/เอกสาร
                api.copyText(wrap.querySelector('.cmdd-tp-text').innerText.replace(/\n{3,}/g, '\n\n').trim());
            } else if (a === 'print') {  // พิมพ์บทพูด/ประกาศที่แสดงอยู่เป็น A4 (ตัว TH Sarabun 16pt)
                printHtml('<div class="tpp"><h1>' + esc(title) + '</h1>' + wrap.querySelector('.cmdd-tp-text').innerHTML + '</div>', {
                    title: title,
                    extraCss: '@page{size:A4;margin:2cm 2cm 2cm 3cm}.tpp{font-family:"THSarabunDoc","TH SarabunPSK",Sarabun,sans-serif;font-size:16pt;line-height:1.35;color:#000}' +
                        '.tpp h1{font-size:20pt;text-align:center;margin:0 0 10pt}.tpp p{margin:0 0 6pt;text-indent:2.5cm}.tpp .cmdd-tp-hd{text-indent:0;font-weight:700}' +
                        '.tpp ol,.tpp ul{margin:4pt 0 4pt 20pt;padding:0}.tpp li{margin:0 0 4pt}.tpp table{width:100%;border-collapse:collapse}.tpp th,.tpp td{border:1px solid #777;padding:2pt 5pt;text-align:left;vertical-align:top}'
                });
            } else if (a === 'now' && tpl) { fillNow(tpl); wrap.querySelectorAll('.cmdd-tp-vars input').forEach((i) => { i.value = fields(tpl)[i.dataset.k] || ''; }); draw(); }
        });
        wrap.addEventListener('input', (e) => {
            const i = e.target.closest('.cmdd-tp-vars input'); if (!i || !tpl) return;
            setField(tpl, i.dataset.k, i.value); draw();
        });
    }
    const minutesOf = (s) => { const m = String(toArabic(s || '')).match(/(\d+)/); return m ? Number(m[1]) : 0; };
    function fillNow(t) {
        const d = new Date();
        const at = pad(d.getHours()) + '.' + pad(d.getMinutes());
        setField(t, 'varAt', at);
        const F = fields(t);
        const mins = minutesOf(F.varWithin);
        if (mins && t.vars.some((v) => v[0] === 'varDeadline')) {
            const dl = new Date(d.getTime() + mins * 60000);
            setField(t, 'varDeadline', pad(dl.getHours()) + '.' + pad(dl.getMinutes()));
        }
        api.toast('ใส่เวลา ' + at + ' น.' + (mins ? ' · ครบกำหนดอีก ' + mins + ' นาที' : ''));
    }
    function promptMenu() {
        const k = kit();
        const M = window.LAMHIN_MANUAL;
        const secs = [];
        M.chapters.forEach((c) => c.sections.forEach((s) => { if (s.script) secs.push(s); }));
        const anns = k.templates.filter((t) => t.kind === 'announce' && t.script);
        const box = api.modal({
            title: 'โหมดอ่านหน้างาน (ตัวใหญ่)', icon: 'fa-microphone-lines',
            body: '<div class="cmdd-pmenu">' + secs.map((s) => '<button type="button" class="cmd-btn" data-p="sec" data-id="' + s.id + '"><i class="fa-solid fa-scroll"></i> ' + esc(s.title) + '</button>').join('') +
                anns.map((t) => '<button type="button" class="cmd-btn neon" data-p="ann" data-id="' + t.id + '"><i class="fa-solid ' + t.icon + '"></i> ' + esc(t.title) + '</button>').join('') + '</div>',
            actions: [{ label: 'ปิด', run: (c) => c() }]
        });
        box.addEventListener('click', (e) => {
            const b = e.target.closest('[data-p]'); if (!b) return;
            box.remove();
            if (b.dataset.p === 'sec') { const s = findSection(b.dataset.id); prompter(s.title, manualHtml(s)); }
            else { const t = tplById(kit(), b.dataset.id); prompter(t.title, '', t); }
        });
    }

    /* ---------------- ค่ากลาง / พิมพ์ชุด ---------------- */
    function prefsForm() {
        const k = kit();
        const p = k.prefs;
        api.modal({
            title: 'ค่ากลางหน่วยงาน (ใช้กับหนังสือทุกฉบับ)', icon: 'fa-gear',
            body: '<div class="cmd-form">' +
                api.field('ที่ (เลขที่หนังสือภายนอก · บันทึกข้อความตัด "ตช" ให้เอง)', 'extNo', p.extNo, 'text', { cls: 'full' }) +
                api.field('ส่วนราชการเจ้าของหนังสือ / ที่ตั้ง (บรรทัดละ 1 บรรทัด)', 'office', p.office, 'textarea', { cls: 'full' }) +
                api.field('โทรศัพท์ (ส่วนราชการเจ้าของเรื่อง)', 'phone', p.phone, 'tel', { mode: 'tel' }) +
                api.field('โทรสาร', 'fax', p.fax, 'tel', { mode: 'tel' }) +
                api.field('ไปรษณีย์อิเล็กทรอนิกส์', 'email', p.email, 'email', { cls: 'full' }) +
                api.field('ส่วนราชการ (บันทึกข้อความ)', 'memoDept', p.memoDept, 'text') +
                api.field('โทร. ภายใน (บันทึกข้อความ)', 'memoPhone', p.memoPhone, 'tel', { mode: 'tel' }) +
                '<div class="cmd-hint">ค่าที่กรอกจะใช้กับหนังสือที่ยังไม่ได้แก้ช่องนั้นเอง · ยังไม่ทราบที่อยู่จริงให้คงจุดไว้ ห้ามเดา</div></div>',
            actions: [
                { label: 'ยกเลิก', run: (c) => c() },
                { label: '<i class="fa-solid fa-floppy-disk"></i> บันทึก', cls: 'gold', run: (close, box) => {
                    const st = api.state;
                    st.docPrefs = Object.assign({}, st.docPrefs || {});
                    ['extNo', 'office', 'phone', 'fax', 'email', 'memoDept', 'memoPhone'].forEach((key) => {
                        const el = box.querySelector('[name="' + key + '"]');
                        const v = el ? String(el.value || '').replace(/\r/g, '').trim() : '';
                        if (!v || v === String(k.prefsDefaults[key] || '')) delete st.docPrefs[key]; else st.docPrefs[key] = v;
                    });
                    api.save(); close(); render(); api.toast('บันทึกค่ากลางแล้ว');
                } }
            ]
        });
    }
    function printSet() {
        const k = kit();
        const box = api.modal({
            title: 'พิมพ์ชุดเอกสาร', icon: 'fa-print',
            body: '<p class="cmd-hint" style="margin:0 0 8px">เลือกฉบับที่ต้องการ ระบบพิมพ์ต่อกันในครั้งเดียว (แต่ละฉบับขึ้นหน้าใหม่) · เลขหน้า "- ๒ -" มีเมื่อพิมพ์ทีละฉบับ</p><div class="cmdd-checks">' +
                k.templates.map((t) => '<label><input type="checkbox" value="' + t.id + '"' + (t.coord ? ' checked' : '') + '><span>' + esc(t.title) + '<small>' + esc(t.to || '') + '</small></span></label>').join('') + '</div>',
            actions: [
                { label: 'ยกเลิก', run: (c) => c() },
                { label: '<i class="fa-solid fa-print"></i> พิมพ์ที่เลือก', cls: 'gold', run: (close, b) => {
                    const ids = Array.from(b.querySelectorAll('.cmdd-checks input:checked')).map((i) => i.value);
                    if (!ids.length) { api.toast('ยังไม่ได้เลือกเอกสาร'); return; }
                    close(); printDocs(ids.map((id) => tplById(k, id)), k);
                } }
            ]
        });
        return box;
    }

    /* ---------------- เหตุการณ์คลิก/พิมพ์ ---------------- */
    function onClick(e) {
        const b = e.target.closest('[data-d]');
        if (!b || !host.contains(b) || b.tagName === 'INPUT') return;
        const d = b.dataset.d, k = kit();
        const t = ui.doc ? tplById(k, ui.doc) : null;
        if (d === 'view') { ui.view = b.dataset.v; saveUi(); render(); syncOps(); }
        else if (d === 'plan-by') { ui.planBy = b.dataset.v; saveUi(); render(); syncOps(); }
        else if (d === 'print-plan') printPlan(k);
        else if (d === 'goto-ladder') api.openTab('ladder');
        else if (d === 'ops-in') { if (window.LamhinOps) { window.LamhinOps.checkIn(ev(), b.dataset.rid); render(); } }
        else if (d === 'plan-doc') { ui.view = 'docs'; ui.doc = b.dataset.id; saveUi(); render(); syncOps(); window.scrollTo({ top: Math.max(0, host.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' }); }
        else if (d === 'chapter') { const id = b.dataset.id; if (ui.open[id]) delete ui.open[id]; else ui.open[id] = 1; saveUi(); render(); }
        else if (d === 'mch') { ui.ch = b.dataset.id; ui.q = ''; saveUi(); render(); }
        else if (d === 'msec') { ui.ch = b.dataset.ch; ui.sec = ui.sec || {}; ui.sec[b.dataset.ch] = b.dataset.id; ui.q = ''; saveUi(); render(); }
        else if (d === 'grp') { ui.grp = b.dataset.v; saveUi(); render(); }
        else if (d === 'pphase') { ui.pphase = b.dataset.v; saveUi(); render(); }
        else if (d === 'pperson') { ui.pperson = b.dataset.v; saveUi(); render(); }
        else if (d === 'expand') { const all = Object.keys(ui.open).length >= window.LAMHIN_MANUAL.chapters.length; ui.open = {}; if (!all) window.LAMHIN_MANUAL.chapters.forEach((c) => { ui.open[c.id] = 1; }); saveUi(); render(); }
        else if (d === 'edit-sec') editSection(b.dataset.id);
        else if (d === 'reset-sec') { if (window.confirm('คืนค่าข้อความเดิมของหัวข้อนี้?')) { const e0 = ev(); delete e0.docs['manual:' + b.dataset.id]; api.save(); render(); } }
        else if (d === 'prompt-sec') { const s = findSection(b.dataset.id); prompter(s.title, manualHtml(s)); }
        else if (d === 'prompt-menu') promptMenu();
        else if (d === 'print-manual') printManual();
        else if (d === 'open') { ui.doc = b.dataset.id; saveUi(); render(); window.scrollTo({ top: Math.max(0, host.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' }); }
        else if (d === 'back') { ui.doc = ''; saveUi(); render(); }
        else if (d === 'prefs') prefsForm();
        else if (d === 'print-set') printSet();
        else if (d === 'digits') {
            const st = api.state; st.docPrefs = Object.assign({}, st.docPrefs || {}, { digits: useThai(k) ? 'arabic' : 'thai' });
            api.save(); render();
        } else if (d === 'mob') { ui.mob = b.dataset.v; saveUi(); render(); }
        else if (!t) return;
        else if (d === 'print') printDocs([t], k);
        else if (d === 'docx') exportDocx(t, k);
        else if (d === 'prompt-doc') prompter(t.title, '', t);
        else if (d === 'reset') { if (window.confirm('คืนค่าข้อความตั้งต้นของ "' + t.title + '"? ข้อความที่แก้ไว้จะหาย')) { resetDoc(t); render(); api.toast('คืนค่าแล้ว'); } }
        else if (d === 'unbody') { setField(t, 'body', defaultOf(t, 'body')); api.save(); render(); }
        else if (d === 'fromlog') {
            if (!window.confirm('สร้างข้อความใหม่จากบันทึก ศปก. ล่าสุด? (ข้อความเนื้อหาที่แก้ไว้จะถูกแทนที่)')) return;
            const e0 = ev(); if (e0.docs && e0.docs[t.id]) { delete e0.docs[t.id].body; if (!Object.keys(e0.docs[t.id]).length) delete e0.docs[t.id]; }
            api.save(); render(); api.toast('ดึงข้อมูลจากบันทึก ศปก. แล้ว (' + ((ev().log || []).length) + ' รายการ)');
        } else if (d === 'now') { fillNow(t); render(); }
    }
    function onInput(e) {
        const q = e.target.closest('[data-d="q"]');
        if (q) { ui.q = q.value; saveUi(); clearTimeout(pvTimer); pvTimer = setTimeout(() => { const pos = q.selectionStart; render(); const nq = host.querySelector('[data-d="q"]'); if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (er) { /* ไม่ต้อง */ } } }, 250); return; }
        const f = e.target.closest('.cmdd-form [data-k]');
        if (!f) return;
        const k = kit(), t = ui.doc ? tplById(k, ui.doc) : null;
        if (!t) return;
        const val = f.type === 'checkbox'
            ? Array.from(host.querySelectorAll('.cmdd-form input[type="checkbox"][data-k="' + f.dataset.k + '"]:checked')).map((i) => i.value).join(',')
            : f.value.replace(/\r/g, '');
        setField(t, f.dataset.k, val);
        // คืนค่าตั้งต้นได้หรือยัง
        const rb = host.querySelector('[data-d="reset"]'); if (rb) rb.disabled = !Object.keys(saved(t)).length;
        clearTimeout(pvTimer);
        pvTimer = setTimeout(() => {
            const body = host.querySelector('.cmdd-body');
            if (t.vars && !('body' in saved(t)) && /^var/.test(f.dataset.k)) {
                const ta = host.querySelector('.cmdd-form [data-k="body"]'); if (ta) ta.value = fields(t).body;
                const gv = host.querySelector('.cmdd-form [data-k="given"]'); if (gv && !('given' in saved(t))) gv.value = fields(t).given;
            }
            drawPreview(body, k, t);
        }, 180);
    }

    // แผง "สายงาน" (cmdops.js) แสดงเฉพาะ ลำดับปฏิบัติ › สายงาน — แจ้ง cmd.js ให้ซ่อน/แสดงทันทีที่สลับมุมมอง
    const showsOps = () => ui.view === 'plan' && ui.planBy === 'ops';
    function syncOps() { if (api && api.syncSections) api.syncSections(); }

    /* ---------------- ลงทะเบียนแท็บ ---------------- */
    let ro = null;
    window.LamhinCmd.registerSection({
        id: 'docs', label: 'คู่มือ & เอกสาร', icon: 'fa-book', order: 40,
        shows: function (childId) { return childId === 'ops' ? showsOps() : true; },
        reveal: function (childId) { if (childId === 'ops') { ui.view = 'plan'; ui.planBy = 'ops'; saveUi(); if (built) render(); } },
        mount: function (el, a) {
            api = a; host = el;
            el.classList.add('cmdd');
            el.addEventListener('click', onClick);
            el.addEventListener('input', onInput);
            el.addEventListener('keydown', onEdKey);     // แก้บนกระดาษ A4
            el.addEventListener('paste', onEdPaste);
            el.addEventListener('focusout', onEdBlur);
            // ย้อนกลับ/ไปข้างหน้า (nav.js): มุมมองในแท็บนี้ — ลำดับปฏิบัติ/คู่มือ/หนังสือ · หนังสือที่เปิด · บท/หัวข้อ · กลุ่ม · ช่วง/รายคน
            if (window.LamhinNav) window.LamhinNav.register('docs', () => {
                if (!host || !host.offsetParent) return null;
                const M = window.LAMHIN_MANUAL, ch = ui.ch || (M && M.chapters[0] ? M.chapters[0].id : '');
                return { view: ui.view, doc: ui.view === 'docs' ? (ui.doc || '') : '', planBy: ui.planBy, pphase: Number(ui.pphase) || 0, pperson: ui.pperson || '',
                    ch: ch, sec: (ui.sec || {})[ch] || '', grp: ui.grp || '', q: ui.q || '' };
            }, (v) => {
                ui.view = v.view; ui.doc = v.doc; ui.planBy = v.planBy; ui.pphase = v.pphase; ui.pperson = v.pperson; ui.grp = v.grp; ui.q = v.q; ui.ch = v.ch;
                ui.sec = ui.sec || {}; if (v.ch && v.sec) ui.sec[v.ch] = v.sec;
                saveUi(); render();
            }, 30);
            el.addEventListener('change', (e) => {   // เลือกชื่อ ผช.พงส. (รายคน)
                const sl = e.target.closest('[data-d="ops-slot"]');
                if (sl && window.LamhinOps) { window.LamhinOps.setSlot(ev(), Number(sl.dataset.slot), sl.value); render(); }
            });
            if (window.ResizeObserver) {
                ro = new ResizeObserver(() => {
                    const pv = host.querySelector('.cmdd-pv'), inn = host.querySelector('.cmdd-pv-in');
                    if (pv && inn && inn.querySelector('.ds-page')) fitPreview(pv, inn);
                });
                ro.observe(el);
            }
        },
        update: function (e, a) {
            api = a;
            const id = e ? e.id : null;
            if (built && id !== lastEvId) { lastEvId = id; render(); }
        },
        visible: function (on, a) {
            api = a;
            if (on && !built) { built = true; lastEvId = (a.active() || {}).id; deps().then(render, render); render(); }
            else if (on) { lastEvId = (a.active() || {}).id; render(); }
        }
    });

    // ใช้ร่วมกับโมดูลอื่น (เช่น บันทึก ศปก.) และใช้ทดสอบ: ได้ HTML หน้าพิมพ์ / ไฟล์ Word ของหนังสือตามรหัส
    window.LamhinDocs = {
        ready: deps,
        // เปิดลำดับปฏิบัติตามมุมมอง ('time' | 'person' | 'ops') เช่น ปุ่ม "เปิดรายคน" ในสายงาน
        plan: (by) => {
            ui.view = 'plan'; ui.planBy = by || 'time'; saveUi();
            if (api && api.openTab) api.openTab('docs');
            if (built) render();
            syncOps();
            if (host) window.scrollTo({ top: Math.max(0, host.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' });
        },
        // เปิดหนังสือตามรหัสในมุมมอง "หนังสือ" (เช่น ปุ่มเปิดร่างคำร้องในสายงาน)
        open: (id) => {
            ui.view = 'docs'; ui.doc = id; saveUi();
            if (api && api.openTab) api.openTab('docs');
            if (built) render();
            syncOps();
            if (host) window.scrollTo({ top: Math.max(0, host.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' });
        },
        templates: () => (api && window.LAMHIN_DOC_KIT ? kit().templates.map((t) => ({ id: t.id, kind: t.kind, title: t.title })) : []),
        printHtml: (ids) => { const k = kit(); const list = ids.map((id) => tplById(k, id)).filter(Boolean); return pagedDocs(list, k).then((b) => printDocument(b, { title: list.length === 1 ? list[0].title : 'ชุดเอกสาร', paged: true })); },
        paginate: paginate,
        docx: (id) => { const k = kit(); return docxBlob(tplById(k, id), k); },
        sheetCss: SHEET_CSS, fontCss: fontCss, garuda: garuda, print: printHtml
    };

    // CSS ของกระดาษสำหรับหน้าตัวอย่างในแอป
    const st = document.createElement('style');
    st.id = 'cmdd-sheet-css';
    st.textContent = SHEET_CSS;
    document.head.appendChild(st);
})();
