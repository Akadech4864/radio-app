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
    const VER = '1';
    const UI_KEY = 'lamhin_cmd_docs_ui';
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    const PX_CM = 96 / 2.54;

    let api = null, host = null, lastEvId = null, depsP = null, built = false;
    let ui = (function () { try { return Object.assign({ view: 'manual', doc: '', open: {}, prompt: 34, mob: 'form' }, JSON.parse(localStorage.getItem(UI_KEY) || '{}')); } catch (e) { return { view: 'manual', doc: '', open: {}, prompt: 34, mob: 'form' }; } })();
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
            depsP = Promise.all(['docs/garuda.js', 'docs/manual.js', 'docs/templates.js'].map((f) => loadScript(BASE + f + '?v=' + VER)))
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
    const tf = (th) => (s) => esc(th(s)).replace(PH_RE, (m, a) => '<span class="ds-ph" title="กรอก: ' + a + '">' + PH_DOTS + '</span>');
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
    function tplById(k, id) { return k.templates.find((t) => t.id === id) || null; }
    function saved(t) { const e = ev(); return (e && e.docs && e.docs[t.id]) || {}; }
    function fields(t) {
        const s = saved(t);
        const F = Object.assign({}, t.defaults, s);
        if (t.kind === 'announce') {
            if (!('body' in s)) F.body = t.buildBody(F);
            F.given = String(F.given || '').replace('{varAt}', F.varAt || '........');
        }
        return F;
    }
    function defaultOf(t, key) {
        if (t.kind === 'announce' && key === 'body') return t.buildBody(Object.assign({}, t.defaults, saved(t)));
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
        h += '<div class="ds-row" style="padding-top:' + cm(3 - 0.66) + '"><span>' + T('ที่ ' + (F.no || '')) + '</span><span class="ds-at" style="left:' + cm(officeTab) + '">' + T(office[0] || '') + '</span></div>';
        office.slice(1).forEach((l) => { h += '<div style="padding-left:' + cm(officeTab) + '">' + T(l) + '</div>'; });
        const date = String(F.date || '').trim();
        const dm = date.match(/^([0-9๐-๙]{1,2})\s+/);
        h += '<div style="margin-top:6pt;padding-left:' + cm(Math.max(0, rightFoot - (dm ? textCm(th(dm[1]) + ' ') : 0))) + '">' + T(date) + '</div>';
        [['เรื่อง', F.subject], ['เรียน', F.to], ['อ้างถึง', F.refs], ['สิ่งที่ส่งมาด้วย', F.attach]].forEach((kv) => {
            const vs = lines(kv[1]); if (!vs.length) return;
            const tab = textCm(kv[0]) + 0.35;
            vs.forEach((v, i) => {
                h += '<div style="margin-top:' + (i ? 0 : 6) + 'pt;padding-left:' + cm(tab) + ';text-indent:-' + cm(tab) + '"><span class="ds-kw" style="width:' + cm(tab) + '">' + (i ? '' : kv[0]) + '</span>' + T(v) + '</div>';
            });
        });
        const eb = extBody(F.body);
        eb.forEach((b, bi) => {
            h += '<p class="ds-j' + (b.t === 'h' ? ' ds-b' : '') + '"' + (b.t === 'h' || bi === eb.length - 1 ? ' data-kn="1"' : '') + ' style="margin-top:' + (b.t === 'p' ? 6 : 0) + 'pt;text-indent:' + cm(b.t === 'i' ? 3 : 2.5) + '">' + T(b.text) + '</p>';
        });
        const closing = String(F.closing || 'ขอแสดงความนับถือ').trim();
        const signCenter = center + textCm(th(closing)) / 2;
        h += signBlock(F, closing, center, signCenter, th, W, 12);
        const owner = lines(F.owner);
        if (owner.length) h += blank(3) + owner.map((l) => '<div>' + T(l) + '</div>').join('');
        if (t.receipt && (F.receiptText || '').trim()) {
            h += '<div class="ds-keep ds-rcpt"><div class="ds-cut">ตัดตามรอยประ — ส่วนบันทึกการรับทราบ</div>' +
                '<div class="ds-b" style="text-align:center">บันทึกการรับทราบ</div>' +
                '<p class="ds-j" style="text-indent:2.5cm">' + T(F.receiptText) + '</p>' + blank(2) +
                '<table class="ds-sig2"><tr><td>' + T('ลงชื่อ ................................ ผู้รับทราบ') + '<br>' + T('(' + (F.recvName || '') + ')') + '</td>' +
                '<td>' + T('ลงชื่อ ................................ ผู้ส่งมอบ') + '<br>' + T('(' + (F.giverName || '') + ')') + '</td></tr></table></div>';
        }
        return sheet('external', h);
    }
    // คำลงท้าย + ลงชื่อ + ตำแหน่ง (กึ่งกลางซึ่งกันและกันกับคำลงท้าย · ยศบรรทัดแยก) — ตามโปรแกรม
    function signBlock(F, closing, closeAt, signCenter, th, W, beforePt) {
        const T = tf(th);
        const rank = String(F.signRank || '').trim();
        const signLeft = Math.max(0, 2 * signCenter - W);
        let s = '<div class="ds-keep"><div style="margin-top:' + beforePt + 'pt;padding-left:' + cm(closeAt) + '">' + T(closing) + '</div>' + blank(rank ? 2 : 3);
        if (rank) s += '<div style="padding-left:' + cm(Math.max(0, signCenter - 3.0)) + '">' + T(rank) + '</div>';
        s += '<div style="margin-left:' + cm(signLeft) + ';text-align:center">' + T('(' + (F.signName || '..................................................') + ')') + '</div>';
        lines(F.signPos).forEach((l) => { s += '<div style="margin-left:' + cm(signLeft) + ';text-align:center">' + T(l) + '</div>'; });
        return s + '</div>';
    }

    function rMemo(t, F, th) {
        const T = tf(th);
        let h = '<img class="ds-gar" alt="ตราครุฑ" src="' + garuda() + '" style="left:0;top:-0.5cm;width:' + cm(GW(1.5)) + ';height:1.5cm">';
        h += '<div class="ds-b" style="margin-top:4pt;padding-left:0.64cm;text-align:center;font-size:29pt">บันทึกข้อความ</div>';
        const dept = String(F.department || '') + (F.phone ? '  โทร. ' + F.phone : '');
        h += '<div><span class="ds-k20">ส่วนราชการ</span>&nbsp;&nbsp;' + T(dept) + '</div>';
        h += '<div class="ds-row"><span><span class="ds-k20">ที่</span>&nbsp;&nbsp;' + T(memoNo(F.no)) + '</span><span class="ds-at" style="left:8cm"><span class="ds-k20">วันที่</span>&nbsp;&nbsp;' + T(F.date) + '</span></div>';
        h += '<div style="padding-left:1.126cm;text-indent:-1.126cm"><span class="ds-k20">เรื่อง</span>&nbsp;&nbsp;' + T(F.subject) + '</div>';
        h += '<div style="margin-top:6pt;padding-left:1.126cm;text-indent:-1.126cm">เรียน&nbsp;&nbsp;' + T(F.to) + '</div>';
        const paras = lines(F.body);
        const lay = numberedLayout(paras.map(toArabic));
        paras.forEach((p, i) => {
            const L = lay[i];
            const bold = L.level === 1 && L.rest.length <= 60;
            if (L.num) h += '<p class="ds-j' + (bold ? ' ds-b' : '') + '"' + (bold ? ' data-kn="1"' : '') + ' style="text-indent:' + cm(L.numCm) + '"><span class="ds-kw" style="width:' + cm(L.textCm - L.numCm) + '">' + T(L.num) + '</span>' + T(L.rest) + '</p>';
            else h += '<p class="ds-j" style="margin-top:6pt;text-indent:' + cm(L.numCm) + '">' + T(L.rest) + '</p>';
        });
        lines(F.closing).forEach((l) => { h += '<p class="ds-j" data-kn="1" style="margin-top:6pt;text-indent:2.54cm">' + T(l) + '</p>'; });
        // ลงชื่อ: เว้น 3 บรรทัด · ยศที่ 6.25 ซม. · ชื่อ/ตำแหน่งกึ่งกลางที่ 12.25 ซม. จากขอบกระดาษ
        const signIndent = 2 * (12.25 - 3) - 16;
        let s = '<div class="ds-keep">' + blank(3);
        if (String(F.signRank || '').trim()) s += '<div style="padding-left:6.25cm">' + T(F.signRank) + '</div>';
        s += '<div style="margin-left:' + cm(signIndent) + ';text-align:center">' + T(signFix('(' + (F.signName || '..................................................') + ')')) + '</div>';
        lines(F.signPos).forEach((l) => { s += '<div style="margin-left:' + cm(signIndent) + ';text-align:center">' + T(signFix(l)) + '</div>'; });
        h += s + '</div>';
        return sheet('memo', h);
    }

    function rAnnounce(t, F, th) {
        const T = tf(th);
        const W = 16, gW = GW(3);
        let h = '<img class="ds-gar" alt="ตราครุฑ" src="' + garuda() + '" style="left:' + cm((W - gW) / 2) + ';top:0;width:' + cm(gW) + ';height:3cm">';
        lines(F.issuer).forEach((l, i) => { h += '<div style="text-align:center;' + (i ? '' : 'padding-top:' + cm(3) + ';margin-top:6pt') + '">' + T(l) + '</div>'; });
        if ((F.subject || '').trim()) h += '<div style="text-align:center;margin-top:6pt">' + T('เรื่อง  ' + F.subject) + '</div>';
        h += '<div class="ds-line"></div>';
        const ab = lines(F.body);
        ab.forEach((l, i) => { h += '<p class="ds-j"' + (i === ab.length - 1 ? ' data-kn="1"' : '') + ' style="margin-top:6pt;text-indent:2.5cm">' + T(l) + '</p>'; });
        const given = String(F.given || '').trim();
        const givenAt = 4.5;
        const signCenter = givenAt + textCm(th(given)) / 2;
        h += signBlock(F, given, givenAt, signCenter, th, W, 12);
        return sheet('announce', h);
    }

    /* ---------- ชุดเอกสารยื่นศาลแพ่ง: คัดเฉพาะหน้าที่ใช้ได้จากแบบคำร้องขอหมายค้น (ไม่ลอกทั้งฉบับ) ----------
       คำร้อง (หัวแบบพิมพ์ศาล) · บัญชีเอกสารแนบ · รายงานกระบวนพิจารณา · คำให้การพยาน (ชั้นไต่สวนคำร้อง) · ใบปะหน้าเสนอศาล (แนวนอน) */
    const PET_PARTS = [['petition', 'คำร้อง (หัวแบบพิมพ์ศาล)'], ['attach', 'บัญชีเอกสารแนบท้ายคำร้อง'], ['report', 'รายงานกระบวนพิจารณา (ให้ศาลบันทึก)'], ['testimony', 'คำให้การพยาน (ชั้นไต่สวนคำร้อง)'], ['cover', 'ใบปะหน้าเสนอศาล (แนวนอน)']];
    const partsOf = (F) => {
        const s = String(F.parts == null ? 'petition,attach,report,testimony,cover' : F.parts).split(',').map((x) => x.trim());
        return PET_PARTS.map((p) => p[0]).filter((p) => s.indexOf(p) !== -1);
    };
    const PET_DOTS = '........................................';
    const PET_SIGN_AT = 5;
    const petSignLeft = () => Math.max(0, 2 * (PET_SIGN_AT + textCm('ลงชื่อ ') + textCm(PET_DOTS) / 2) - 16);
    const courtName = (F) => String(F.court || '').replace(/^ศาล\s*/, '');
    function rPetition(t, F, th) {
        const T = tf(th);
        const U = (v, minCm) => '<span class="ds-u" style="min-width:' + cm(minCm || 1) + '">' + (String(v || '').trim() ? T(v) : '&nbsp;') + '</span>';
        const dateLine = () => 'วันที่ ' + U(F.day, 1.2) + ' เดือน ' + U(F.month, 2.8) + ' พุทธศักราช ' + U(F.year, 1.6);
        const head = (leftHtml, rightHtml) => {
            const gW = GW(2.5);
            return '<div class="ds-chead"><img class="ds-gar" alt="ตราครุฑ" src="' + garuda() + '" style="left:' + cm((16 - gW) / 2) + ';top:0;width:' + cm(gW) + ';height:2.5cm">' +
                '<div class="ds-chl">' + leftHtml + '</div><div class="ds-chr">' + rightHtml + '</div></div>';
        };
        const kind = () => '<div class="ds-b" style="text-align:center;font-size:18pt;margin-top:4pt">' + T('ความ' + (F.caseKind || '')) + '</div>';
        const party = () => {
            const row = (name, role) => { const ls = lines(name); return ls.length ? '<div class="ds-party" style="padding-left:2.5cm"><div>' + ls.map(T).join('<br>') + '</div><div class="ds-role ds-b">' + role + '</div></div>' : ''; };
            return row(F.applicant, 'ผู้ร้อง') + (lines(F.respondent).length ? '<div style="text-align:center">ระหว่าง</div>' + row(F.respondent, 'ผู้คัดค้าน') : '');
        };
        const left = petSignLeft();
        const sign = (role, name, pos) => '<div style="padding-left:' + cm(PET_SIGN_AT) + '">' + T('ลงชื่อ ' + PET_DOTS + ' ' + role) + '</div>' +
            (name ? '<div style="margin-left:' + cm(left) + ';text-align:center">' + T('(' + name + ')') + '</div>' : '') +
            lines(pos).map((l) => '<div style="margin-left:' + cm(left) + ';text-align:center">' + T(l) + '</div>').join('');
        const caseNos = '<div>คดีหมายเลขดำที่ ' + U(F.blackNo, 2.6) + '</div><div>คดีหมายเลขแดงที่ ' + U(F.redNo, 2.6) + '</div>';
        const courtDate = '<div style="text-align:right;margin-top:2pt">ศาล ' + U(courtName(F), 5) + '</div><div style="text-align:right">' + dateLine() + '</div>';
        const parts = partsOf(F);
        let out = '';
        if (parts.indexOf('petition') !== -1) {
            let h = head('<div>(คำร้อง)</div><div>' + T(F.subtitle) + '</div>', '<div>ที่ ' + U(F.petNo, 3) + '</div>');
            h += '<div class="ds-b" style="text-align:center;font-size:20pt">' + T(F.court) + '</div>';
            h += '<div class="ds-row" style="min-height:2.5em"><div class="ds-recv">รับคำร้อง<br>เรียกสอบ</div><div style="text-align:right">' + dateLine() + '</div></div>';
            h += '<div class="ds-recvj">................................ ผู้พิพากษา</div>';
            h += kind() + party();
            h += '<p class="ds-j" style="margin-top:10pt;text-indent:2.5cm">' + T(F.intro) + '</p>';
            lines(F.body).forEach((l) => {
                const m = l.match(/^(ข้อ\s*[0-9๐-๙]+\.?)\s*([\s\S]*)$/);
                h += '<p class="ds-j" style="margin-top:6pt;text-indent:2.5cm">' + (m ? '<b>' + T(m[1]) + '</b> ' + T(m[2]) : T(l)) + '</p>';
            });
            h += '<p data-kn="1" style="margin-top:6pt;text-indent:2.5cm">' + T(F.prayer) + '</p>';
            h += '<div class="ds-keep">' + blank(2) + sign('ผู้ร้อง', F.signName, F.signPos) + '</div>';
            h += '<div class="ds-keep">' + blank(1) + '<p style="text-indent:2.5cm">' + T('คำร้องฉบับนี้ ข้าพเจ้า ' + (F.writer || '') + ' เป็นผู้เรียงและพิมพ์') + '</p>' + blank(2) + sign('ผู้เรียงและพิมพ์', F.writer, '') + '</div>';
            out += sheet('petition', h);
        }
        const list = lines(F.attachList);
        if (parts.indexOf('attach') !== -1 && list.length) {
            let a = '<div class="ds-b" style="text-align:center;font-size:18pt">บัญชีเอกสารแนบท้ายคำร้อง</div>' +
                '<div style="text-align:center">' + T((F.court || '') + ' · คำร้องที่ ' + (F.petNo || '')) + '</div>' + blank(1);
            list.forEach((l) => { a += '<div style="padding-left:1cm;text-indent:-1cm;margin-top:6pt"><span class="ds-kw" style="width:1cm">☐</span>' + T(l) + '</div>'; });
            out += sheet('petition', a);
        }
        if (parts.indexOf('report') !== -1) {
            let h = head('<div>รายงาน</div><div>กระบวนพิจารณา</div>', caseNos) + courtDate + kind() + party();
            h += '<div style="margin-top:8pt">ผู้พิพากษาออกนั่งพิจารณาคดีนี้เวลา ' + U('', 3) + ' นาฬิกา</div>';
            h += '<p class="ds-j" style="margin-top:6pt;text-indent:2.5cm">' + T(F.reportText) + '</p>';
            h += '<div class="ds-keep">' + blank(2) + '<div style="padding-left:6cm">' + T('.................................... ผู้พิพากษา บันทึก/อ่าน') + '</div>' + blank(1) +
                '<div style="padding-left:6cm">' + T((splitRank(F.signName)[0] || '') + ' .................................... พยานผู้ร้อง') + '</div></div>';
            h += blank(1) + '<div class="ds-b" style="text-align:center;font-size:18pt">คำสั่ง</div>';
            h += '<div style="text-indent:2.5cm">พิเคราะห์พยานหลักฐานของผู้ร้องแล้วเห็นว่า <span class="ds-fill"></span></div>' + new Array(10).join('<div class="ds-dotline"></div>');
            out += sheet('petition', h);
        }
        if (parts.indexOf('testimony') !== -1) {
            let h = head('<div class="ds-b">คำให้การพยาน</div><div class="ds-b">(ชั้นไต่สวนคำร้อง)</div>', caseNos) + courtDate + kind() + party();
            h += '<div class="ds-b" style="margin-top:8pt;padding-left:1.5cm">ข้าพเจ้าได้ปฏิญาณหรือสาบานตนแล้ว ขอให้การว่า</div>';
            h += '<div style="margin-top:6pt"><b>ข้าพเจ้า</b> ' + U(F.signName, 6) + ' <b>อายุ</b> ' + U(F.age, 1.2) + ' <b>ปี อาชีพ</b> ' + U('รับราชการตำรวจ', 3) + '</div>';
            h += '<div><b>ตั้งบ้านเรือนอยู่เลขที่ / สถานที่ทำงาน</b> ' + U(F.workplace, 7) + '</div>';
            h += '<div style="margin-top:4pt">เกี่ยวพันกับคู่ความเป็น ☑ ผู้ร้อง ☐ ผู้รับมอบอำนาจ</div>';
            lines(F.testimony).forEach((l) => { h += '<p class="ds-j" style="margin-top:6pt;text-indent:2.5cm">' + T(l) + '</p>'; });
            h += '<div class="ds-keep">' + blank(2) + sign('ผู้ร้อง/พยาน', F.signName, '') + blank(1) +
                '<div style="padding-left:' + cm(PET_SIGN_AT) + '">' + T('ลงชื่อ ' + PET_DOTS + ' ผู้พิพากษา/บันทึก/อ่าน') + '</div></div>';
            out += sheet('petition', h);
        }
        if (parts.indexOf('cover') !== -1) {
            const hd = (kw, v) => { const tab = textCm(kw) + 0.35; return lines(v).map((x, i) => '<div class="ds-b" style="padding-left:' + cm(tab) + ';text-indent:-' + cm(tab) + '"><span class="ds-kw" style="width:' + cm(tab) + '">' + (i ? '' : kw) + '</span>' + T(x) + '</div>').join(''); };
            out += sheet('cover', '<div>' + hd('เรื่อง', F.coverSubject) + hd('เรียน', F.coverTo) + '</div>' +
                '<div>' + (F.coverUnit ? '<div>' + T(F.coverUnit) + '</div>' : '') + (F.coverCase ? '<div class="ds-b">' + T(F.coverCase) + '</div>' : '') + (F.coverCount ? '<div class="ds-b">' + T(F.coverCount) + '</div>' : '') + '</div>');
        }
        return out || sheet('petition', '<div style="text-align:center;color:#888">ยังไม่ได้เลือกหน้าที่จะพิมพ์ (ช่อง "หน้าที่จะพิมพ์")</div>');
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
        if (keepHead) {
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
                const flush = () => { pages.push(pc.innerHTML); pc.innerHTML = ''; };
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
    const runX = (text, pt, bold, italic) => '<w:r><w:rPr>' + (bold ? '<w:b/><w:bCs/>' : '') + (italic ? '<w:i/><w:iCs/>' : '') + '<w:sz w:val="' + pt * 2 + '"/><w:szCs w:val="' + pt * 2 + '"/><w:cs/></w:rPr><w:t xml:space="preserve">' + xe(String(text == null ? '' : text).replace(PH_RE, PH_DOTS)) + '</w:t></w:r>';
    const runU = (text) => '<w:r><w:rPr><w:u w:val="dotted"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:cs/></w:rPr><w:t xml:space="preserve">' + xe(String(text).replace(PH_RE, PH_DOTS)) + '</w:t></w:r>';
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
        const signLeft = Math.max(0, 2 * signCenter - W);
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
        parts.push(pX('<w:tabs><w:tab w:val="left" w:pos="' + tw(officeTab) + '"/></w:tabs>' + spX((3 - 0.66) * 28.35),
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
        parts.push(signX(F, closing, center, center + textCm(th(closing)) / 2, th, 12));
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
        return { xml: parts.join(''), margin: [2.5, 2, 2, 3], pageNumbers: true };
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
    function xAnnounce(t, F, th) {
        const run = (s, b) => runX(wbr(th(s)), 16, b);
        const W = 16, gH = 3 * DX.EMU_CM, gW = Math.round(gH * 118 / 130), gX = (W - GW(3)) / 2;
        const parts = [];
        lines(F.issuer).forEach((l, i) => parts.push(pX(spX(i ? 0 : 3 * 28.35 + 6) + '<w:jc w:val="center"/>', (i ? '' : anchorX('rIdGaruda', gW, gH, gX * DX.EMU_CM, 2.5 * DX.EMU_CM, 1)) + run(l))));
        if ((F.subject || '').trim()) parts.push(pX(spX(6) + '<w:jc w:val="center"/>', run('เรื่อง  ' + F.subject)));
        parts.push(pX(spX(4) + '<w:ind w:left="' + tw(5.75) + '" w:right="' + tw(5.75) + '"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>'));
        lines(F.body).forEach((l) => parts.push(pX(spX(6) + '<w:ind w:firstLine="' + tw(2.5) + '"/><w:jc w:val="thaiDistribute"/>', run(l))));
        const given = String(F.given || '').trim();
        parts.push(signX(F, given, 4.5, 4.5 + textCm(th(given)) / 2, th, 12));
        return { xml: parts.join(''), margin: [2.5, 2, 2, 3], pageNumbers: false };
    }
    // ชุดเอกสารยื่นศาลแพ่ง (.docx): หน้าละส่วน · ใบปะหน้าเป็นส่วนสุดท้ายแนวนอน
    function xPetition(t, F, th) {
        const run = (s, b, pt, it) => runX(wbr(th(s)), pt || 16, b, it);
        const U = (s, n) => runU(String(s || '').trim() ? ' ' + th(s) + ' ' : new Array((n || 12) + 1).join(' '));
        const W = 16, gH = 2.5 * DX.EMU_CM, gW = Math.round(gH * 118 / 130), gX = (W - GW(2.5)) / 2;
        let gid = 1;
        const garudaRun = () => anchorX('rIdGaruda', gW, gH, gX * DX.EMU_CM, 2 * DX.EMU_CM, gid++);
        const right = '<w:tabs><w:tab w:val="right" w:pos="' + tw(W) + '"/></w:tabs>';
        const dateRuns = () => run('วันที่ ') + U(F.day, 6) + run(' เดือน ') + U(F.month, 14) + run(' พุทธศักราช ') + U(F.year, 8);
        const kind = () => pX(spX(4) + '<w:jc w:val="center"/>', run('ความ' + (F.caseKind || ''), true, 18));
        const partyX = () => {
            const row = (name, role) => { const ls = lines(name); return ls.length ? pX(spX(4) + right + '<w:ind w:left="' + tw(2.5) + '"/>', ls.map((l, i) => (i ? '<w:r><w:br/></w:r>' : '') + run(l)).join('') + '<w:r><w:tab/></w:r>' + run(role, true)) : ''; };
            return row(F.applicant, 'ผู้ร้อง') + (lines(F.respondent).length ? pX(spX(0) + '<w:jc w:val="center"/>', run('ระหว่าง')) + row(F.respondent, 'ผู้คัดค้าน') : '');
        };
        const left = tw(petSignLeft());
        const signX2 = (role, name, pos) => pX('<w:keepNext/>' + spX(0) + '<w:ind w:left="' + tw(PET_SIGN_AT) + '"/>', run('ลงชื่อ ' + PET_DOTS + ' ' + role)) +
            (name ? pX('<w:keepNext/>' + spX(0) + '<w:ind w:left="' + left + '"/><w:jc w:val="center"/>', run('(' + name + ')')) : '') +
            lines(pos).map((l) => pX(spX(0) + '<w:ind w:left="' + left + '"/><w:jc w:val="center"/>', run(l))).join('');
        const blankX = (n) => new Array(n + 1).join(pX('<w:keepNext/>' + spX(0)));
        const headX = (leftLines, rightLines, leftBold) => {
            const ps = [];
            leftLines.forEach((l, i) => ps.push(pX(spX(0), (i ? '' : garudaRun()) + run(l, leftBold))));
            const pad = Math.max(0, 2.5 - leftLines.length * 0.66 - rightLines.length * 0.66 + 0.4);
            rightLines.forEach((r, i) => ps.push(pX(spX(i ? 0 : pad * 28.35) + '<w:jc w:val="right"/>', r)));
            return ps.join('');
        };
        const caseNos = [run('คดีหมายเลขดำที่ ') + U(F.blackNo, 12), run('คดีหมายเลขแดงที่ ') + U(F.redNo, 12)];
        const courtDateX = () => pX(spX(2) + '<w:jc w:val="right"/>', run('ศาล ') + U(courtName(F), 20)) + pX(spX(0) + '<w:jc w:val="right"/>', dateRuns());
        const para = (text, before) => pX(spX(before == null ? 6 : before) + '<w:ind w:firstLine="' + tw(2.5) + '"/><w:jc w:val="thaiDistribute"/>', run(text));
        const parts = partsOf(F);
        const docs = [];
        if (parts.indexOf('petition') !== -1) {
            const x = [];
            x.push(headX(['(คำร้อง)', F.subtitle || ''], [run('ที่ ') + U(F.petNo, 14)]));
            x.push(pX(spX(0) + '<w:jc w:val="center"/>', run(F.court, true, 20)));
            x.push(pX(spX(2) + right, run('รับคำร้อง', false, 14, true) + '<w:r><w:tab/></w:r>' + dateRuns()));
            x.push(pX(spX(0), run('เรียกสอบ', false, 14, true)));
            x.push(pX(spX(0), run('................................ ผู้พิพากษา', false, 14, true)));
            x.push(kind() + partyX());
            x.push(para(F.intro, 10));
            lines(F.body).forEach((l) => {
                const m = l.match(/^(ข้อ\s*[0-9๐-๙]+\.?)\s*([\s\S]*)$/);
                x.push(pX(spX(6) + '<w:ind w:firstLine="' + tw(2.5) + '"/><w:jc w:val="thaiDistribute"/>', m ? run(m[1], true) + run(' ' + m[2]) : run(l)));
            });
            x.push(pX('<w:keepNext/>' + spX(6) + '<w:ind w:firstLine="' + tw(2.5) + '"/>', run(F.prayer)));
            x.push(blankX(2) + signX2('ผู้ร้อง', F.signName, F.signPos));
            x.push(pX(spX(0)) + pX('<w:keepNext/>' + spX(0) + '<w:ind w:firstLine="' + tw(2.5) + '"/>', run('คำร้องฉบับนี้ ข้าพเจ้า ' + (F.writer || '') + ' เป็นผู้เรียงและพิมพ์')) + blankX(2) + signX2('ผู้เรียงและพิมพ์', F.writer, ''));
            docs.push(x.join(''));
        }
        const list = lines(F.attachList);
        if (parts.indexOf('attach') !== -1 && list.length) {
            docs.push(pX(spX(0) + '<w:jc w:val="center"/>', run('บัญชีเอกสารแนบท้ายคำร้อง', true, 18)) +
                pX(spX(0) + '<w:jc w:val="center"/>', run((F.court || '') + ' · คำร้องที่ ' + (F.petNo || ''))) + pX(spX(0)) +
                list.map((l) => pX(spX(6) + '<w:tabs><w:tab w:val="left" w:pos="' + tw(1) + '"/></w:tabs><w:ind w:left="' + tw(1) + '" w:hanging="' + tw(1) + '"/>', run('☐') + '<w:r><w:tab/></w:r>' + run(l))).join(''));
        }
        if (parts.indexOf('report') !== -1) {
            docs.push(headX(['รายงาน', 'กระบวนพิจารณา'], caseNos) + courtDateX() + kind() + partyX() +
                pX(spX(8), run('ผู้พิพากษาออกนั่งพิจารณาคดีนี้เวลา ') + U('', 16) + run(' นาฬิกา')) + para(F.reportText) +
                blankX(2) + pX('<w:keepNext/>' + spX(0) + '<w:ind w:left="' + tw(6) + '"/>', run('.................................... ผู้พิพากษา บันทึก/อ่าน')) + blankX(1) +
                pX(spX(0) + '<w:ind w:left="' + tw(6) + '"/>', run((splitRank(F.signName)[0] || '') + ' .................................... พยานผู้ร้อง')) + pX(spX(0)) +
                pX(spX(0) + '<w:jc w:val="center"/>', run('คำสั่ง', true, 18)) +
                pX(spX(0) + '<w:ind w:firstLine="' + tw(2.5) + '"/>', run('พิเคราะห์พยานหลักฐานของผู้ร้องแล้วเห็นว่า ') + U('', 40)) +
                new Array(10).join(pX(spX(0) + '<w:pBdr><w:bottom w:val="dotted" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>')));
        }
        if (parts.indexOf('testimony') !== -1) {
            docs.push(headX(['คำให้การพยาน', '(ชั้นไต่สวนคำร้อง)'], caseNos, true) + courtDateX() + kind() + partyX() +
                pX(spX(8) + '<w:ind w:left="' + tw(1.5) + '"/>', run('ข้าพเจ้าได้ปฏิญาณหรือสาบานตนแล้ว ขอให้การว่า', true)) +
                pX(spX(6), run('ข้าพเจ้า ', true) + U(F.signName, 30) + run(' อายุ ', true) + U(F.age, 6) + run(' ปี อาชีพ ', true) + U('รับราชการตำรวจ')) +
                pX(spX(0), run('ตั้งบ้านเรือนอยู่เลขที่ / สถานที่ทำงาน ', true) + U(F.workplace, 30)) +
                pX(spX(4), run('เกี่ยวพันกับคู่ความเป็น ☑ ผู้ร้อง ☐ ผู้รับมอบอำนาจ')) +
                lines(F.testimony).map((l) => para(l)).join('') +
                blankX(2) + signX2('ผู้ร้อง/พยาน', F.signName, '') + blankX(1) +
                pX(spX(0) + '<w:ind w:left="' + tw(PET_SIGN_AT) + '"/>', run('ลงชื่อ ' + PET_DOTS + ' ผู้พิพากษา/บันทึก/อ่าน')));
        }
        const margin = [2, 2, 2, 3];
        let xml = docs.join('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        let finalSect = null;
        if (parts.indexOf('cover') !== -1) {
            const hd = (kw, v) => { const tab = textCm(kw) + 0.35; return lines(v).map((x, i) => pX('<w:tabs><w:tab w:val="left" w:pos="' + tw(tab) + '"/></w:tabs>' + spX(0) + '<w:ind w:left="' + tw(tab) + '" w:hanging="' + tw(tab) + '"/>', (i ? '' : run(kw, true)) + '<w:r><w:tab/></w:r>' + run(x, true))).join(''); };
            const cover = hd('เรื่อง', F.coverSubject) + hd('เรียน', F.coverTo) +
                pX(spX(11 * 28.35), run(F.coverUnit || '')) + (F.coverCase ? pX(spX(0), run(F.coverCase, true)) : '') + (F.coverCount ? pX(spX(0), run(F.coverCount, true)) : '');
            if (xml) xml += pX('<w:sectPr><w:pgSz w:w="' + DX.PAGE_W + '" w:h="' + DX.PAGE_H + '"/><w:pgMar w:top="' + tw(margin[0]) + '" w:right="' + tw(margin[1]) + '" w:bottom="' + tw(margin[2]) + '" w:left="' + tw(margin[3]) + '" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>');
            xml += cover;
            finalSect = '<w:sectPr><w:pgSz w:w="' + DX.PAGE_H + '" w:h="' + DX.PAGE_W + '" w:orient="landscape"/><w:pgMar w:top="' + tw(2) + '" w:right="' + tw(2) + '" w:bottom="' + tw(2) + '" w:left="' + tw(3) + '" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';
        }
        if (!xml) xml = pX(spX(0), run('ยังไม่ได้เลือกหน้าที่จะพิมพ์'));
        return { xml: xml, margin: margin, pageNumbers: false, finalSect: finalSect };
    }
        function docxBlob(t, k) {
        const thai = useThai(k);
        const th = thai ? toThai : toArabic;
        const F = fields(t);
        return jszip().then((JSZip) => {
            const b = t.kind === 'memo' ? xMemo(t, F, th) : t.kind === 'announce' ? xAnnounce(t, F, th) : t.kind === 'petition' ? xPetition(t, F, th) : xExternal(t, F, th);
            return docxPackage(JSZip, b.xml, { margin: b.margin, pageNumbers: b.pageNumbers, thai: thai, finalSect: b.finalSect });
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
        if (!window.LAMHIN_DOC_KIT || !window.LAMHIN_MANUAL) {
            host.innerHTML = '<div class="cmd-card"><div class="cmd-empty"><span class="spin"></span> กำลังโหลดคู่มือและแบบหนังสือ…</div></div>';
            deps().then(render).catch(() => { host.innerHTML = '<div class="cmd-card"><div class="cmd-empty">โหลดไฟล์คู่มือไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วกดแท็บนี้อีกครั้ง</div></div>'; });
            return;
        }
        if (!ev()) { host.innerHTML = '<div class="cmd-card"><div class="cmd-empty">ยังไม่มีเหตุการณ์</div></div>'; return; }
        const k = kit();
        const nav = '<div class="cmdd-top cmd-card">' +
            '<div class="cmdd-seg" role="tablist">' +
            '<button type="button" role="tab" class="' + (ui.view === 'manual' ? 'on' : '') + '" data-d="view" data-v="manual"><i class="fa-solid fa-book-open"></i> คู่มือปฏิบัติ</button>' +
            '<button type="button" role="tab" class="' + (ui.view === 'docs' ? 'on' : '') + '" data-d="view" data-v="docs"><i class="fa-solid fa-file-pen"></i> หนังสือราชการ</button></div>' +
            '<button type="button" class="cmd-btn sm" data-d="prompt-menu"><i class="fa-solid fa-microphone-lines"></i> อ่านหน้างาน</button>' +
            '</div>';
        host.innerHTML = nav + '<div class="cmdd-body"></div>';
        const body = host.querySelector('.cmdd-body');
        if (ui.view === 'docs') {
            const t = ui.doc ? tplById(k, ui.doc) : null;
            if (t) renderEditor(body, k, t); else renderList(body, k);
        } else renderManual(body, k);
    }

    /* ---------------- คู่มือ ---------------- */
    function manualHtml(sec) {
        const e = ev();
        const s = e && e.docs && e.docs['manual:' + sec.id];
        return s ? s.html : sec.html;
    }
    function renderManual(body, k) {
        const M = window.LAMHIN_MANUAL;
        const q = String(ui.q || '').trim().toLowerCase();
        const e = ev();
        let hits = 0;
        const chapters = M.chapters.map((c) => {
            const secs = c.sections.filter((s) => !q || (s.title + ' ' + stripTags(manualHtml(s))).toLowerCase().indexOf(q) !== -1);
            hits += secs.length;
            if (q && !secs.length) return '';
            const open = q ? true : !!ui.open[c.id];
            return '<section class="cmdd-ch cmd-card' + (open ? ' open' : '') + '">' +
                '<button type="button" class="cmdd-ch-h" data-d="chapter" data-id="' + c.id + '" aria-expanded="' + open + '"><i class="fa-solid ' + c.icon + '"></i><span><small>' + esc(c.no) + '</small><b>' + esc(c.title) + '</b></span><em>' + secs.length + ' หัวข้อ</em><i class="fa-solid fa-chevron-down cmdd-chev"></i></button>' +
                (open ? '<div class="cmdd-secs">' + secs.map((s) => {
                    const edited = !!(e.docs && e.docs['manual:' + s.id]);
                    return '<article class="cmdd-sec" data-sec="' + s.id + '"><header><h4>' + esc(s.title) + '</h4><div class="cmdd-tools">' +
                        (s.script ? '<button type="button" class="cmd-btn sm neon" data-d="prompt-sec" data-id="' + s.id + '"><i class="fa-solid fa-microphone-lines"></i> อ่านหน้างาน</button>' : '') +
                        '<button type="button" class="cmd-btn sm" data-d="edit-sec" data-id="' + s.id + '"><i class="fa-solid fa-pen"></i> แก้ไข</button>' +
                        (edited ? '<button type="button" class="cmd-btn sm danger" data-d="reset-sec" data-id="' + s.id + '" title="คืนค่าข้อความเดิม"><i class="fa-solid fa-rotate-left"></i></button>' : '') +
                        '</div></header><div class="cmdd-md">' + manualHtml(s) + '</div></article>';
                }).join('') + '</div>' : '') + '</section>';
        }).join('');
        body.innerHTML = '<div class="cmdd-mhead cmd-card"><div><b>' + esc(M.title) + '</b><small>' + esc(M.sub) + '</small><small>' + esc(M.by) + '</small></div>' +
            '<div class="cmdd-mtools"><label class="cmdd-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-d="q" placeholder="ค้นหาในคู่มือ เช่น ม.21, ยึดรถ, ศาล" value="' + esc(ui.q || '') + '"></label>' +
            '<button type="button" class="cmd-btn sm" data-d="expand">' + (Object.keys(ui.open).length >= M.chapters.length ? 'ย่อทั้งหมด' : 'เปิดทั้งหมด') + '</button>' +
            '<button type="button" class="cmd-btn sm gold" data-d="print-manual"><i class="fa-solid fa-print"></i> พิมพ์คู่มือ</button></div>' +
            (q ? '<div class="cmdd-hits">พบ ' + hits + ' หัวข้อ</div>' : '') + '</div>' + (chapters || '<div class="cmd-card"><div class="cmd-empty">ไม่พบคำที่ค้นหา</div></div>');
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
        body.innerHTML = '<div class="cmdd-lhead cmd-card">' +
            '<div><b>ศูนย์หนังสือราชการพร้อมพิมพ์</b><small>จัดหน้าตามโปรแกรม Case Glambing Management (ระเบียบงานสารบรรณ) · แก้ข้อความแล้วตัวอย่างอัปเดตทันที · พิมพ์ / PDF / Word</small></div>' +
            '<div class="cmdd-ltools">' +
            '<button type="button" class="cmd-btn sm gold" data-d="print-set"><i class="fa-solid fa-print"></i> พิมพ์ชุดเอกสารประสานงาน</button>' +
            '<button type="button" class="cmd-btn sm" data-d="prefs"><i class="fa-solid fa-gear"></i> ค่ากลางหน่วยงาน</button>' +
            '<button type="button" class="cmd-btn sm" data-d="digits"><i class="fa-solid fa-hashtag"></i> ' + (useThai(k) ? 'เลขไทย ๑๒๓' : 'เลขอารบิก 123') + '</button></div>' +
            (officeMissing ? '<div class="cmdd-warn"><i class="fa-solid fa-circle-exclamation"></i> ยังไม่ได้กรอกที่ตั้ง/โทรศัพท์ของ สน.ลำหิน — กด "ค่ากลางหน่วยงาน" กรอกครั้งเดียว ใช้กับหนังสือทุกฉบับ</div>' : '') +
            (e.category && e.category !== 'ชุมนุมสาธารณะ' ? '<div class="cmdd-warn"><i class="fa-solid fa-circle-info"></i> แบบหนังสือชุดนี้ตั้งต้นจากการชุมนุม 28 พ.ย. 69 — แก้ข้อความให้ตรงเหตุการณ์ก่อนพิมพ์</div>' : '') +
            '</div>' +
            groups.map((g) => '<section class="cmd-card cmdd-grp"><div class="cmd-card-h"><i class="fa-solid fa-folder-open"></i><h4>' + esc(g.name) + '</h4><small>' + g.items.length + ' ฉบับ</small></div><div class="cmdd-cards">' +
                g.items.map((t) => {
                    const edited = !!(e.docs && e.docs[t.id]);
                    return '<button type="button" class="cmdd-doc" data-d="open" data-id="' + t.id + '"><i class="fa-solid ' + t.icon + '"></i><span><b>' + esc(t.title) + '</b><small>' + esc(t.to || '') + '</small>' +
                        '<em>' + (t.kind === 'memo' ? 'บันทึกข้อความ' : t.kind === 'external' ? 'หนังสือภายนอก' : t.kind === 'petition' ? 'แบบพิมพ์ศาล' : 'ประกาศ') +
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
        petition: [['parts', 'หน้าที่จะพิมพ์ — คัดเฉพาะหน้าที่ใช้ได้จากแบบคำร้องขอหมายค้น', 'parts'],
            ['petNo', 'ที่ (เลขคำร้อง มุมขวาบน)'], ['subtitle', 'ชื่อคำร้อง (ใต้ "(คำร้อง)")'], ['court', 'ศาล'], ['day', 'วันที่'], ['month', 'เดือน'], ['year', 'พุทธศักราช'], ['caseKind', 'ความ'],
            ['blackNo', 'คดีหมายเลขดำที่ (รายงาน/คำให้การ)'], ['redNo', 'คดีหมายเลขแดงที่'],
            ['applicant', 'ผู้ร้อง (บรรทัดละ 1 บรรทัด)', 'ml', 2], ['respondent', 'ผู้คัดค้าน (เว้นว่างได้ — คำร้องตาม ม.21 ยื่นฝ่ายเดียว)', 'ml', 2],
            ['intro', 'คำขึ้นต้น (ข้าพเจ้า … ขอยื่นคำร้อง)', 'ml', 3], ['body', 'ข้อความคำร้อง — บรรทัดละ 1 ข้อ ("ข้อ 1." เป็นตัวหนา)', 'body', 18],
            ['prayer', 'คำลงท้าย'], ['signName', 'ผู้ร้อง (ยศ ชื่อ-สกุล)'], ['signPos', 'ตำแหน่ง', 'ml', 2], ['writer', 'ผู้เรียงและพิมพ์ (ยศ ชื่อ-สกุล)'],
            ['attachList', 'บัญชีเอกสารแนบ (บรรทัดละรายการ)', 'ml', 6],
            ['reportText', 'รายงานกระบวนพิจารณา — ข้อความ "วันนี้ …"', 'ml', 4],
            ['age', 'คำให้การพยาน: อายุผู้ร้อง'], ['workplace', 'คำให้การพยาน: ตั้งบ้านเรือน / สถานที่ทำงาน'], ['testimony', 'คำให้การพยาน — บรรทัดละ 1 ย่อหน้า', 'ml', 10],
            ['coverSubject', 'ใบปะหน้า: เรื่อง', 'ml', 2], ['coverTo', 'ใบปะหน้า: เรียน'], ['coverUnit', 'ใบปะหน้า: หน่วยงาน'], ['coverCase', 'ใบปะหน้า: เลขที่ / วันที่'], ['coverCount', 'ใบปะหน้า: จำนวน']],
        announce: [['issuer', 'ชื่อผู้ออกประกาศ (บรรทัดละ 1 บรรทัด)', 'ml', 2], ['subject', 'เรื่อง'], ['body', 'ข้อความประกาศ — บรรทัดละ 1 ย่อหน้า', 'body', 14], ['given', 'ประกาศ ณ วันที่'],
            ['signRank', 'ยศ (เต็ม)'], ['signName', 'ชื่อ-สกุล'], ['signPos', 'ตำแหน่ง', 'ml', 2]]
    };
    function renderEditor(body, k, t) {
        const F = fields(t);
        const s = saved(t);
        const list = FIELDS[t.kind].slice();
        if (t.receipt) list.push(['receiptText', 'บันทึกการรับทราบ (ท้ายหนังสือ)', 'ml', 3], ['recvName', 'ผู้รับทราบ'], ['giverName', 'ผู้ส่งมอบ']);
        const input = (f) => {
            const v = F[f[0]] == null ? '' : F[f[0]];
            const changed = f[0] in s;
            const lab = '<span>' + esc(f[1]) + (changed ? ' <u>แก้ไขแล้ว</u>' : '') + '</span>';
            if (f[2] === 'parts') {
                const cur = partsOf(F);
                return '<div class="cmd-f full">' + lab + '<div class="cmdd-partlist">' + PET_PARTS.map((p) =>
                    '<label><input type="checkbox" data-k="parts" value="' + p[0] + '"' + (cur.indexOf(p[0]) !== -1 ? ' checked' : '') + '><span>' + esc(p[1]) + '</span></label>').join('') + '</div></div>';
            }
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
            '<div class="cmdd-form cmd-card"><div class="cmd-form">' + varsHtml + list.map(input).join('') + '</div></div>' +
            '<div class="cmdd-pvwrap"><div class="cmdd-pvbar"><span><i class="fa-solid fa-file"></i> ตัวอย่างกระดาษ A4 ' + (t.kind === 'memo' ? '(บันทึกข้อความ)' : t.kind === 'external' ? '(หนังสือภายนอก · เลขหน้าตั้งแต่หน้า 2)' : '') + '</span><small data-pages></small></div><div class="cmdd-pv"><div class="cmdd-pv-in"></div></div></div>' +
            '</div>';
        drawPreview(body, k, t);
    }
    let pvTimer = 0, pvGen = 0;
    function drawPreview(body, k, t) {
        const pv = body.querySelector('.cmdd-pv'), inn = body.querySelector('.cmdd-pv-in');
        if (!pv || !inn) return;
        const gen = ++pvGen;
        const thai = useThai(k);
        if (!inn.firstChild) inn.innerHTML = '<div class="cmdd-pvwait"><span class="spin"></span> กำลังจัดหน้า A4…</div>';
        paginate(renderDoc(t, fields(t), thai), { pageNumbers: t.kind === 'external', thai: thai }).then((html) => {
            if (gen !== pvGen || !inn.isConnected) return;
            inn.innerHTML = html;
            fitPreview(pv, inn);
        });
    }
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
            if (tpl) { const F = fields(tpl); text = '<p class="cmdd-tp-hd">' + lines(F.issuer).map(esc).join('<br>') + '</p>' + lines(F.body).map((l) => '<p>' + esc(useThai(k) ? l : l) + '</p>').join(''); }
            wrap.querySelector('.cmdd-tp-text').innerHTML = text;
        };
        const varRow = tpl ? '<div class="cmdd-tp-vars">' + tpl.vars.filter((v) => /^(varAt|varWithin|varDeadline)$/.test(v[0])).map((v) =>
            '<label><span>' + esc(v[1]) + '</span><input data-k="' + v[0] + '" value="' + esc(fields(tpl)[v[0]] || '') + '" placeholder="' + esc(v[2] || '') + '"></label>').join('') +
            '<button type="button" data-tp="now">เวลาปัจจุบัน</button></div>' : '';
        wrap.innerHTML = '<div class="cmdd-tp-bar"><b>' + esc(title) + '</b><span>' +
            '<button type="button" data-tp="minus" aria-label="ตัวเล็กลง">A−</button><button type="button" data-tp="plus" aria-label="ตัวใหญ่ขึ้น">A+</button>' +
            '<button type="button" data-tp="scroll"><i class="fa-solid fa-play"></i> เลื่อนอัตโนมัติ</button>' +
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
        const anns = k.templates.filter((t) => t.kind === 'announce');
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
        if (d === 'view') { ui.view = b.dataset.v; saveUi(); render(); }
        else if (d === 'chapter') { const id = b.dataset.id; if (ui.open[id]) delete ui.open[id]; else ui.open[id] = 1; saveUi(); render(); }
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

    /* ---------------- ลงทะเบียนแท็บ ---------------- */
    let ro = null;
    window.LamhinCmd.registerSection({
        id: 'docs', label: 'คู่มือ & เอกสาร', icon: 'fa-book', order: 40,
        mount: function (el, a) {
            api = a; host = el;
            el.classList.add('cmdd');
            el.addEventListener('click', onClick);
            el.addEventListener('input', onInput);
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
