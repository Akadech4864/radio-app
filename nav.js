/* =====================================================================
   ย้อนกลับ / ไปข้างหน้า ทุกส่วนของเว็บ (สำคัญเมื่อใช้แบบแอปบนหน้าจอโฮม iPhone ที่ไม่มีปุ่มย้อนกลับ)
   - ทุกครั้งที่กดเปลี่ยนหน้า (เมนูหลัก · แท็บกระดาน · แท็บย่อย · เปิดหนังสือ/บทคู่มือ ฯลฯ) บันทึกภาพมุมมองลงประวัติเบราว์เซอร์
   - ปุ่ม ‹ › มุมซ้ายล่าง + ปุ่มย้อนกลับของเบราว์เซอร์/มือถือ = กลับไปมุมมองก่อนหน้า พร้อมตำแหน่งเลื่อนหน้าเดิม
   - แต่ละส่วนบอกสถานะมุมมองของตัวเองผ่าน LamhinNav.register(id, get, set, order)
   ===================================================================== */
window.LamhinNav = (function () {
    'use strict';
    const providers = [];
    const key = (s) => JSON.stringify(s == null ? null : s);
    let cur = null, idx = 0, maxIdx = 0, restoring = false, clickY = 0, ui = null;

    function register(id, get, set, order) {
        providers.push({ id: id, get: get, set: set, order: order == null ? 50 : order });
        providers.sort((a, b) => a.order - b.order);
    }
    function snap() {
        const s = {};
        providers.forEach((p) => { try { const v = p.get(); if (v != null) s[p.id] = v; } catch (e) { /* ส่วนนี้ยังไม่พร้อม */ } });
        return s;
    }

    // app.js เรียก history.replaceState(null, '', '#แท็บ') ทุกครั้งที่สลับเมนู — เก็บภาพมุมมองของรายการเดิมไว้ ไม่ให้ถูกล้าง
    const rs = history.replaceState.bind(history), ps = history.pushState.bind(history);
    history.replaceState = function (st, title, url) {
        const old = history.state;
        if ((st == null || typeof st !== 'object') && old && old.lnav) st = old;
        return rs(st, title, url);
    };

    function commit() {
        if (restoring) return;
        const s = snap();
        if (cur && key(s) === key(cur)) return;
        if (!cur) {   // ภาพแรก (หลังโหลด/รีเฟรช เบราว์เซอร์ยังจำลำดับในประวัติเดิมไว้)
            const old = history.state;
            if (old && old.lnav) { idx = Number(old.i) || 0; maxIdx = idx; }
            rs({ lnav: s, i: idx, y: window.scrollY }, ''); cur = s; paint(); return;
        }
        try { rs(Object.assign({}, history.state, { lnav: cur, i: idx, y: clickY }), ''); } catch (e) { /* ไม่เป็นไร */ }   // จำตำแหน่งเลื่อนของหน้าเดิม
        idx += 1; maxIdx = idx;
        ps({ lnav: s, i: idx, y: 0 }, '');
        cur = s;
        paint();
    }

    function restore(st) {
        restoring = true;
        const s = st.lnav;
        providers.forEach((p) => {
            if (!(p.id in s)) return;
            try { if (key(p.get()) !== key(s[p.id])) p.set(s[p.id]); } catch (e) { console.error('[nav] ' + p.id, e); }
        });
        setTimeout(() => {
            window.scrollTo(0, Number(st.y) || 0);
            cur = snap();
            try { rs(Object.assign({}, history.state, { lnav: cur }), ''); } catch (e) { /* ไม่เป็นไร */ }
            restoring = false;
            paint();
        }, 120);
    }
    window.addEventListener('popstate', (e) => {
        const st = e.state;
        if (!st || !st.lnav) return;
        idx = Number(st.i) || 0;
        if (idx > maxIdx) maxIdx = idx;
        restore(st);
    });

    // ตรวจหลังทุกการกด (รอให้หน้าวาดใหม่ก่อน)
    document.addEventListener('click', (e) => {
        if (ui && ui.contains(e.target)) return;
        clickY = window.scrollY;
        setTimeout(commit, 90);
    }, true);
    document.addEventListener('change', () => setTimeout(commit, 90), true);

    /* ---------- ปุ่ม ‹ › ---------- */
    function paint() {
        if (!ui) return;
        const b = ui.querySelector('[data-nav="back"]'), f = ui.querySelector('[data-nav="fwd"]');
        b.hidden = idx <= 0; f.hidden = idx >= maxIdx;
        ui.hidden = b.hidden && f.hidden;
    }
    function build() {
        const st = document.createElement('style');
        st.textContent =
            '.lnav{position:fixed;left:12px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:10040;display:flex;gap:6px}' +
            '.lnav[hidden],.lnav button[hidden]{display:none}' +
            '.lnav button{width:44px;height:44px;border-radius:50%;border:1px solid rgba(212,175,55,.55);background:rgba(10,22,40,.88);color:#F3D774;' +
            'font-size:17px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
            '.lnav button:active{transform:scale(.94)}' +
            '@media (min-width:1000px){.lnav{bottom:24px;left:20px}}' +
            '@media print{.lnav{display:none}}';
        document.head.appendChild(st);
        ui = document.createElement('div');
        ui.className = 'lnav';
        ui.hidden = true;
        ui.innerHTML = '<button type="button" data-nav="back" aria-label="ย้อนกลับหน้าเดิม" title="ย้อนกลับ"><i class="fa-solid fa-chevron-left"></i></button>' +
            '<button type="button" data-nav="fwd" aria-label="ไปหน้าถัดไป" title="ไปข้างหน้า"><i class="fa-solid fa-chevron-right"></i></button>';
        ui.addEventListener('click', (e) => {
            const b = e.target.closest('[data-nav]'); if (!b) return;
            if (b.dataset.nav === 'back') history.back(); else history.forward();
        });
        document.body.appendChild(ui);
        paint();
    }

    /* ---------- มุมมองของส่วนต่าง ๆ ---------- */
    // เมนูหลัก (เวร สน. / เวรสอบสวน / งานสอบสวน › กำลังพล·สถิติ·ภาระงาน / เหตุการณ์) — app.js ใช้ #แท็บ
    register('main', () => (location.hash || '').slice(1) || 'station', (v) => { if (typeof window.showTab === 'function') window.showTab(v); }, 0);
    // แท็บกระดานสถานการณ์ (ภาพรวม / บันทึก ศปก. / คู่มือ & เอกสาร)
    register('cmd', () => { const b = document.querySelector('.cmd-tab.on'); return b ? b.dataset.tab : null; },
        (v) => { if (window.LamhinCmd && window.LamhinCmd.openTab) window.LamhinCmd.openTab(v); }, 10);
    // แท็บย่อยทั่วไป: เลือกด้วยการกดปุ่มเดิมซ้ำ (เฉพาะกลุ่มที่แสดงอยู่)
    const groups = [
        ['ov', '.cmd-subtab[data-act="ovsub"]', 'v'],
        ['logsub', '.cmd-subtab[data-cl="sub"]', 'v'],
        ['opsdiv', '.ops-bar[data-op="seldiv"]', 'div'],
        ['duty', '#dutySeg button[data-v]', 'v'],
        ['station', '#stSeg button[data-v]', 'v']
    ];
    const idOf = (b, attr) => (attr ? b.dataset[attr] : (b.dataset.div || b.dataset.v || b.dataset.id || b.textContent.trim()));
    groups.forEach((g, n) => register(g[0], () => {
        const on = Array.from(document.querySelectorAll(g[1])).find((b) => b.offsetParent && b.classList.contains('on'));
        return on ? idOf(on, g[2]) : null;
    }, (v) => {
        const b = Array.from(document.querySelectorAll(g[1])).find((x) => idOf(x, g[2]) === v);
        if (b && !b.classList.contains('on')) b.click();
    }, 20 + n));

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
    setTimeout(commit, 1500);   // ภาพมุมมองแรกหลังทุกส่วนวาดเสร็จ

    return { register: register, commit: commit };
})();
