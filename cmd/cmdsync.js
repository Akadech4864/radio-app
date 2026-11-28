/* =====================================================================
   ซิงก์กระดานเหตุการณ์ข้ามเครื่อง ผ่าน Google Sheet (Apps Script Web App · ไฟล์ CmdBoardSync.gs)
   - ข้อมูลทั้งกระดานยังเก็บในเครื่องเหมือนเดิม (localStorage 'lamhin_cmd_v1') โมดูลนี้คอยส่งขึ้น/ดึงลงเท่านั้น
   - หน่วยซิงก์ = 1 เหตุการณ์ (ev) · มีรุ่น (rev = เวลาแก้ล่าสุด) · จำสำเนาที่ซิงก์ล่าสุดไว้ใน 'lamhin_cmd_sync'
   - แก้พร้อมกันสองเครื่อง: รวมบันทึก ศปก./ระดับ/ติ๊กสายงาน ทั้งสองฝั่ง (รายการไม่หาย) · ค่าเดี่ยวยึดเครื่องนี้
   - รูป/ไฟล์แนบอยู่ใน IndexedDB ของแต่ละเครื่อง (ไม่ซิงก์) — บันทึกจะเห็นชื่อไฟล์แต่เปิดรูปได้เฉพาะเครื่องที่ถ่าย
   - ไม่แก้ cmd.js: อ่าน/เขียนผ่าน window.LamhinCmd (state, save, render)
   ===================================================================== */
(function () {
    'use strict';
    // Web App URL ของ Apps Script (ลงท้าย /exec) — ว่าง = ปิดซิงก์
    const SYNC_URL = '';
    const KEY = 'lamhin_cmd_v1', BASE_KEY = 'lamhin_cmd_sync', DEL = '__deleted__';
    const CHECK_MS = 3000, PULL_MS = 20000;

    /* ---------------- รวมข้อมูลเมื่อแก้พร้อมกัน (ทดสอบได้ผ่าน LamhinSync._merge) ---------------- */
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    const keyOf = (x) => (isObj(x) ? (x.id != null ? 'id:' + x.id : x.at != null ? 'at:' + x.at + '|' + (x.level || x.kind || '') : null) : null);
    function mergeArr(a, b) {
        const ka = a.map(keyOf);
        if (ka.some((k) => k === null) || b.map(keyOf).some((k) => k === null)) return a;     // อาร์เรย์ค่าธรรมดา → ยึดเครื่องนี้
        const out = a.map((x) => x), seen = new Map(ka.map((k, i) => [k, i]));
        b.forEach((y) => { const k = keyOf(y); if (seen.has(k)) out[seen.get(k)] = merge(out[seen.get(k)], y); else { seen.set(k, out.length); out.push(y); } });
        if (out.every((x) => x.at)) out.sort((p, q) => String(p.at).localeCompare(String(q.at)));
        return out;
    }
    // local = เครื่องนี้ · remote = จากชีต · ค่าเดี่ยวที่ต่างกันยึดเครื่องนี้ (ยกเว้น "ดำเนินการแล้ว" ฝั่งใดติ๊กถือว่าติ๊ก)
    function merge(local, remote) {
        if (Array.isArray(local) && Array.isArray(remote)) return mergeArr(local, remote);
        if (isObj(local) && isObj(remote)) {
            const out = Object.assign({}, remote, local);
            Object.keys(remote).forEach((k) => { if (k in local) out[k] = merge(local[k], remote[k]); });
            if (local.done === false && remote.done === true) { out.done = true; out.doneAt = remote.doneAt || out.doneAt; }
            return out;
        }
        if ((local === '' || local == null) && remote != null && remote !== '') return remote;
        return local;
    }
    // รวมทั้งเหตุการณ์ + เคารพรายการที่ถูกลบ (ev.deleted = รหัสบันทึก ศปก. / 'lv:'+เวลาปรับระดับ / รหัสรูป)
    function mergeEvent(local, remote) {
        const out = merge(local, remote);
        const del = new Set([].concat(local.deleted || [], remote.deleted || []).map(String));
        if (!del.size) return out;
        out.deleted = [...del];
        if (Array.isArray(out.log)) out.log = out.log.filter((x) => !del.has(String(x.id))).map((x) => (Array.isArray(x.media) ? Object.assign({}, x, { media: x.media.filter((m) => !del.has(String(m.id))) }) : x));
        if (Array.isArray(out.levelLog)) out.levelLog = out.levelLog.filter((x) => !del.has('lv:' + x.at));
        return out;
    }

    /* ---------------- สถานะ ---------------- */
    const CMD = window.LamhinCmd;
    if (!CMD || typeof CMD.registerSection !== 'function') return;
    let base = (function () { try { return JSON.parse(localStorage.getItem(BASE_KEY) || '{}') || {}; } catch (e) { return {}; } })();
    let lastRaw = '', busy = false, pending = false, lastOk = 0, lastErr = '', badge = null;
    const saveBase = () => { try { localStorage.setItem(BASE_KEY, JSON.stringify(base)); } catch (e) { /* เต็ม */ } };
    const evJson = (e) => JSON.stringify(e);
    const state = () => CMD.state;

    // เหตุการณ์ที่เปลี่ยนในเครื่องนี้นับจากซิงก์ล่าสุด (รวมที่ลบไปแล้ว)
    function localChanges() {
        const st = state(); if (!st) return [];
        const out = [], ids = new Set();
        st.events.forEach((e) => { ids.add(e.id); const j = evJson(e), b = base[e.id]; if (!b || b.json !== j) out.push({ id: e.id, rev: Date.now(), json: j }); });
        Object.keys(base).forEach((id) => { if (!ids.has(id) && base[id].json !== DEL) out.push({ id: id, rev: Date.now(), deleted: true }); });
        return out;
    }

    // นำข้อมูลจากชีตมาลงเครื่องนี้
    function applyRemote(list) {
        const st = state(); if (!st || !Array.isArray(list)) return false;
        let changed = false;
        list.forEach((r) => {
            if (!r || !r.id) return;
            const b = base[r.id], idx = st.events.findIndex((e) => e.id === r.id), local = idx >= 0 ? st.events[idx] : null;
            const lj = local ? evJson(local) : null, untouched = local ? (b && b.json === lj) : !b || b.json === DEL;
            if (b && r.rev <= b.rev) return;                                   // ไม่มีอะไรใหม่
            if (r.json === DEL) {
                if (local && untouched) { st.events.splice(idx, 1); changed = true; }
                base[r.id] = { rev: r.rev, json: DEL };
                return;
            }
            let remote; try { remote = JSON.parse(r.json); } catch (e) { return; }
            if (!local) {
                if (b && b.json !== DEL && !untouched) { /* ลบในเครื่องนี้แต่อีกเครื่องแก้ → เก็บไว้ (ข้อมูลไม่หาย) */ }
                st.events.push(remote); changed = true;
            } else if (!b) { st.events[idx] = mergeEvent(remote, local); changed = true; }     // เครื่องนี้ไม่เคยซิงก์ → ยึดค่าจากชีต แต่เก็บบันทึกในเครื่องไว้ด้วย
            else if (untouched) { st.events[idx] = remote; changed = true; }
            else { st.events[idx] = mergeEvent(local, remote); changed = true; }            // แก้ทั้งสองฝั่ง → รวม แล้วส่งขึ้นรอบหน้า
            base[r.id] = { rev: r.rev, json: r.json };
        });
        if (changed) {
            if (!st.events.some((e) => e.id === st.activeId) && st.events[0]) st.activeId = st.events[0].id;
            CMD.save(); lastRaw = localStorage.getItem(KEY) || '';
            try { CMD.render(); } catch (e) { /* ไม่ขัดการทำงาน */ }
        }
        saveBase();
        return changed;
    }

    /* ---------------- รับ-ส่งกับ Apps Script ---------------- */
    async function call(payload) {
        const opt = payload ? { method: 'POST', body: JSON.stringify(payload) } : { cache: 'no-store' };   // text/plain = ไม่มี preflight
        const res = await fetch(SYNC_URL + (payload ? '' : (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now()), opt);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json(); if (!j || !j.ok) throw new Error((j && j.error) || 'ตอบกลับไม่ถูกต้อง');
        return j;
    }
    async function sync(force) {
        if (!SYNC_URL || busy) { pending = pending || !!force; return; }
        if (!navigator.onLine) { setBadge('off'); return; }
        busy = true;
        try {
            // ดึงก่อนส่งเสมอ (กันเครื่องที่เพิ่งเปิดครั้งแรกส่งข้อมูลตั้งต้นไปทับของจริงในชีต)
            applyRemote((await call(null)).events);
            const ch = localChanges();
            if (ch.length) {
                const j = await call({ events: ch });
                ch.forEach((c) => { base[c.id] = { rev: c.rev, json: c.deleted ? DEL : c.json }; });
                applyRemote(j.events);
            }
            saveBase(); lastOk = Date.now(); lastErr = ''; setBadge('ok');
            uploadMedia();
        } catch (e) { lastErr = String(e.message || e); setBadge('err'); }
        finally { busy = false; if (pending) { pending = false; setTimeout(() => sync(), 300); } }
    }

    /* ---------------- รูป/ไฟล์แนบ → Google Drive (โฟลเดอร์ที่ Apps Script สร้าง) ----------------
       เครื่องที่มีไฟล์ในเครื่อง (IndexedDB) อัปโหลดเอง แล้วจด m.drive = รหัสไฟล์ใน Drive ลงบันทึก ศปก. (ซิงก์ไปเครื่องอื่นตามปกติ)
       เครื่องอื่นที่ไม่มีไฟล์: แสดง/เปิด/พิมพ์จาก Drive แทน (ห่อ LamhinMedia.url / open / dataUrl / b64) */
    const MAX_UP = 15 * 1024 * 1024, retryAt = {};
    let upBusy = false;
    function mediaItems() {
        const st = state(), out = [];
        (st ? st.events : []).forEach((e) => (e.log || []).forEach((x) => (x.media || []).forEach((m) => { if (m && m.id) out.push(m); })));
        return out;
    }
    const driveOf = (id) => { const m = mediaItems().find((x) => x.id === id && x.drive); return m ? m.drive : ''; };
    const driveImg = (fid, w) => 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fid) + '=w' + w;
    async function uploadMedia() {
        const M = window.LamhinMedia;
        if (!SYNC_URL || upBusy || !M || !M.get) return;
        upBusy = true;
        try {
            for (const m of mediaItems().filter((x) => !x.drive && !(retryAt[x.id] > Date.now())).slice(0, 3)) {
                const rec = await M.get(m.id).catch(() => null);
                if (!rec || !rec.blob) continue;                                         // ไฟล์อยู่เครื่องอื่น
                if (rec.blob.size > MAX_UP) { retryAt[m.id] = Infinity; continue; }
                try {
                    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => rej(fr.error); fr.readAsDataURL(rec.blob); });
                    const j = await call({ upload: { id: m.id, name: m.name || (m.id + '.jpg'), type: m.type || rec.blob.type, caption: m.caption || '', b64: b64 } });
                    if (j.fileId) { mediaItems().filter((x) => x.id === m.id).forEach((x) => { x.drive = j.fileId; }); CMD.save(); }   // ส่งขึ้นชีตรอบถัดไป
                } catch (e) { retryAt[m.id] = Date.now() + 5 * 60000; }
            }
        } finally { upBusy = false; }
    }
    function fromDrive(id, as) {
        const fid = driveOf(id); if (!fid) return Promise.resolve('');
        return fetch(driveImg(fid, 1600)).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? new Promise((res) => { const fr = new FileReader(); fr.onload = () => { const d = String(fr.result); res(as === 'b64' ? d.split(',')[1] : d); }; fr.onerror = () => res(''); fr.readAsDataURL(b); }) : '')).catch(() => '');
    }
    function wrapMedia() {
        const M = window.LamhinMedia; if (!M || M._sync) return;
        const u0 = M.url, o0 = M.open, d0 = M.dataUrl, b0 = M.b64;
        M.url = (id, thumb) => u0.call(M, id, thumb).then((u) => u || (driveOf(id) ? driveImg(driveOf(id), thumb ? 400 : 1600) : ''));
        M.open = (id) => M.get(id).then((r) => (r && r.blob ? o0.call(M, id) : driveOf(id) ? window.open('https://drive.google.com/file/d/' + encodeURIComponent(driveOf(id)) + '/view', '_blank', 'noopener') : o0.call(M, id)));
        M.dataUrl = (id) => d0.call(M, id).then((v) => v || fromDrive(id, 'data'));
        M.b64 = (id) => b0.call(M, id).then((v) => v || fromDrive(id, 'b64'));
        M._sync = true;
    }

    /* ---------------- ป้ายสถานะท้ายกระดาน ---------------- */
    function setBadge(st) {
        const root = document.querySelector('#pane-cmd .cmd-root'); if (!root) return;
        if (!badge || !badge.isConnected) { badge = document.createElement('div'); badge.className = 'cmd-sync'; root.appendChild(badge); }
        const t = lastOk ? new Date(lastOk) : null, hm = t ? String(t.getHours()).padStart(2, '0') + '.' + String(t.getMinutes()).padStart(2, '0') + ' น.' : '';
        badge.dataset.st = st;
        badge.innerHTML = st === 'ok' ? '<i class="fa-solid fa-cloud"></i> ซิงก์ข้ามเครื่องแล้ว · ' + hm
            : st === 'off' ? '<i class="fa-solid fa-cloud-slash"></i> ออฟไลน์ — บันทึกในเครื่องไว้ก่อน จะส่งขึ้นเมื่อมีสัญญาณ'
            : '<i class="fa-solid fa-triangle-exclamation"></i> ซิงก์ไม่สำเร็จ (' + lastErr.replace(/[<>&]/g, '') + ') — ข้อมูลยังอยู่ในเครื่อง' + (hm ? ' · สำเร็จล่าสุด ' + hm : '');
    }

    /* ---------------- เริ่มทำงาน ---------------- */
    function tick() {
        if (document.hidden) return;
        const raw = localStorage.getItem(KEY) || '';
        if (raw !== lastRaw) { lastRaw = raw; clearTimeout(tick.t); tick.t = setTimeout(() => sync(true), 1200); }   // แก้ในเครื่อง → ส่งขึ้นภายใน ~1 วิ
    }
    function start() {
        if (!SYNC_URL) return;
        const st = document.createElement('style');
        st.textContent = '.cmd-sync{margin-top:2px;padding:4px 10px;border-radius:10px;font-size:.72rem;font-weight:700;color:#93A7C4;background:rgba(10,22,40,.5);border:1px solid rgba(148,178,222,.16);text-align:center}' +
            '.cmd-sync[data-st="ok"] i{color:#4ade80}.cmd-sync[data-st="err"]{color:#fca5a5;border-color:rgba(220,38,38,.4)}.cmd-sync[data-st="off"]{color:#fcd34d}';
        document.head.appendChild(st);
        lastRaw = localStorage.getItem(KEY) || '';
        wrapMedia();
        sync(true);
        setInterval(tick, CHECK_MS);
        setInterval(() => { if (!document.hidden) sync(); }, PULL_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(true); });
        window.addEventListener('online', () => sync(true));
    }
    window.LamhinSync = { get enabled() { return !!SYNC_URL; }, get lastOk() { return lastOk; }, get error() { return lastErr; }, now: () => sync(true), _merge: mergeEvent };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 500)); else setTimeout(start, 500);
})();
