/* =====================================================================
   เมนูล่าง "งานสอบสวน" — รวม กำลังพล / สถิติคดี / ภาระงาน ไว้ปุ่มเดียว แล้วมีแท็บย่อยด้านบน
   - ไม่แก้ app.js: แผงเดิม #pane-crew / #pane-cases / #pane-work คงเดิมทุกอย่าง (app.js ยังเติมเนื้อหาลงที่เดิม)
   - ปุ่ม "งานสอบสวน" ใช้ data-tab = แท็บย่อยล่าสุด จึงทำงานกับ showTab() เดิมได้ทันที
   - ลิงก์เดิม #crew / #cases / #work ยังใช้ได้
   ===================================================================== */
(function () {
    'use strict';
    const SUBS = [
        { id: 'crew', label: 'กำลังพล', icon: 'fa-sitemap' },
        { id: 'cases', label: 'สถิติคดี', icon: 'fa-scale-balanced' },
        { id: 'work', label: 'ภาระงาน', icon: 'fa-list-ol' }
    ];
    const KEY = 'lamhin_inv_sub';
    const isSub = (n) => SUBS.some((s) => s.id === n);
    const btn = document.querySelector('#rtabs button[data-inv]');
    if (!btn || typeof window.showTab !== 'function') return;

    let sub = 'crew';
    try { const v = localStorage.getItem(KEY); if (isSub(v)) sub = v; } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    btn.dataset.tab = sub;

    // แถบแท็บย่อย (ใช้สไตล์ .subbar/.seg เดิมของเว็บ) — ย้ายไปอยู่บนสุดของแผงที่เปิด
    const bar = document.createElement('div');
    bar.className = 'subbar inv-subbar';
    bar.innerHTML = '<div class="seg inv-seg" role="tablist" aria-label="งานสอบสวน">' + SUBS.map((s) =>
        '<button type="button" role="tab" data-inv-sub="' + s.id + '"><i class="fa-solid ' + s.icon + '"></i> ' + s.label + '</button>').join('') + '</div>';
    bar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-inv-sub]');
        if (b) window.showTab(b.dataset.invSub);
    });
    const css = document.createElement('style');
    css.textContent = '.inv-subbar .inv-seg{flex:1 1 auto;display:flex}.inv-subbar .inv-seg button{flex:1 1 0;justify-content:center;white-space:nowrap}';
    document.head.appendChild(css);

    function sync(name) {
        if (!isSub(name)) return;
        sub = name;
        try { localStorage.setItem(KEY, name); } catch (e) { /* ไม่จำก็ได้ */ }
        const pane = document.getElementById('pane-' + name);
        if (pane && pane.firstChild !== bar) pane.insertBefore(bar, pane.firstChild);
        bar.querySelectorAll('[data-inv-sub]').forEach((b) => {
            const on = b.dataset.invSub === name;
            b.classList.toggle('on', on);
            b.setAttribute('aria-selected', on);
        });
    }

    const orig = window.showTab;
    window.showTab = function (name) {
        if (isSub(name)) btn.dataset.tab = name;   // ให้ปุ่ม "งานสอบสวน" ติดสถานะ on ตามแท็บย่อยที่เปิด
        orig(name);
        sync(name);
    };

    sync(sub);
    // เปิดหน้าด้วย #crew / #cases / #work (app.js เปิดแผงไปแล้ว) → ซิงก์ปุ่มและแถบให้ตรง
    const want = (location.hash || '').slice(1);
    if (isSub(want)) window.showTab(want);
})();
