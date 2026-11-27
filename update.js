/* =====================================================================
   ปุ่มอัปเดตอัตโนมัติ — เมื่อเว็บจริงมีเวอร์ชันใหม่ (เลข ?v= ของไฟล์ใน index.html เปลี่ยน) ให้ขึ้นปุ่ม "อัปเดต"
   - ตรวจทุก 3 นาทีขณะเปิดหน้าอยู่ · ตรวจทันทีเมื่อกลับมาที่แอป (สลับแอป/ปลดล็อกจอ) หรือกลับมาออนไลน์
   - ดึง index.html แบบไม่ใช้แคช แล้วเทียบเลขเวอร์ชันกับไฟล์ที่หน้านี้โหลดอยู่ (ไม่นับสคริปต์ที่โหลดภายหลังเอง)
   - แตะปุ่ม = ดึงหน้าใหม่ทับแคชแล้วโหลดใหม่ (ใช้ได้ทั้งเบราว์เซอร์และแบบแอปบนหน้าจอโฮม iPhone)
   ===================================================================== */
(function () {
    'use strict';
    const EVERY = 3 * 60 * 1000;
    const VER_RE = /\b(?:src|href)\s*=\s*"([^"]+\?v=[^"]+)"/g;
    const pathOf = (u) => { try { return new URL(u, location.href).pathname; } catch (e) { return u; } };
    const verOf = (u) => { const m = String(u).match(/[?&]v=([^&#]+)/); return m ? m[1] : ''; };

    // เวอร์ชันที่หน้านี้กำลังใช้ (อ่านจากแท็กใน DOM)
    function running() {
        const cur = {};
        document.querySelectorAll('script[src*="?v="],link[href*="?v="]').forEach((el) => {
            const u = el.getAttribute('src') || el.getAttribute('href');
            const p = pathOf(u);
            if (!(p in cur)) cur[p] = verOf(u);
        });
        return cur;
    }
    // เทียบกับ index.html ล่าสุด: ไฟล์ใดใน index ที่เลขไม่ตรง (หรือเพิ่มใหม่) = มีอัปเดต
    function differs(html) {
        const cur = running();
        let m;
        VER_RE.lastIndex = 0;
        while ((m = VER_RE.exec(html))) {
            if (cur[pathOf(m[1])] !== verOf(m[1])) return true;
        }
        return false;
    }

    let shown = false, busy = false, last = 0;
    function check() {
        if (shown || busy || !navigator.onLine) return;
        busy = true; last = Date.now();
        fetch(location.pathname + '?upd=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
            .then((r) => (r.ok ? r.text() : ''))
            .then((html) => { if (html && differs(html)) show(); })
            .catch(() => { /* ออฟไลน์/เครือข่ายช้า — ตรวจรอบหน้า */ })
            .then(() => { busy = false; });
    }

    function show() {
        if (shown) return;
        shown = true;
        const st = document.createElement('style');
        st.textContent =
            '.app-upd{position:fixed;left:50%;bottom:calc(92px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:10050;display:flex;align-items:center;gap:6px;' +
            'padding:6px 6px 6px 16px;border-radius:999px;background:linear-gradient(135deg,#F3D774,#D4AF37);color:#0A1628;box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 0 3px rgba(212,175,55,.25);' +
            'font:800 15px/1.2 Sarabun,"TH Sarabun New",system-ui,sans-serif;animation:appUpdIn .35s ease-out}' +
            '.app-upd button{border:0;font:inherit;cursor:pointer}' +
            '.app-upd .go{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border-radius:999px;background:#0A1628;color:#F3D774}' +
            '.app-upd .go i{animation:appUpdSpin 2.4s linear infinite}' +
            '.app-upd .x{width:32px;height:32px;border-radius:50%;background:rgba(10,22,40,.12);color:#0A1628;font-size:14px}' +
            '@keyframes appUpdIn{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}' +
            '@keyframes appUpdSpin{to{transform:rotate(360deg)}}' +
            '@media (prefers-reduced-motion:reduce){.app-upd,.app-upd .go i{animation:none}}';
        document.head.appendChild(st);
        const box = document.createElement('div');
        box.className = 'app-upd';
        box.setAttribute('role', 'status');
        box.innerHTML = '<span>มีเวอร์ชันใหม่</span><button type="button" class="go"><i class="fa-solid fa-rotate"></i> อัปเดต</button>' +
            '<button type="button" class="x" aria-label="ไว้ทีหลัง"><i class="fa-solid fa-xmark"></i></button>';
        document.body.appendChild(box);
        box.querySelector('.go').addEventListener('click', update);
        box.querySelector('.x').addEventListener('click', () => {   // ซ่อนไว้ 10 นาที แล้วเตือนใหม่
            box.remove(); st.remove(); shown = false; last = Date.now() + 7 * 60 * 1000;
        });
    }

    function update() {
        const b = document.querySelector('.app-upd .go');
        if (b) { b.disabled = true; b.innerHTML = '<i class="fa-solid fa-rotate"></i> กำลังอัปเดต…'; }
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // ให้ช่องที่กำลังแก้บันทึกก่อน
        // ดึงหน้าใหม่ทับแคชของเบราว์เซอร์ก่อน แล้วค่อยโหลดใหม่ (กันได้หน้าเก่าจากแคช 10 นาทีของ GitHub Pages)
        fetch(location.pathname, { cache: 'reload', credentials: 'same-origin' }).catch(() => {}).then(() => {
            setTimeout(() => location.reload(), 150);
        });
    }

    setInterval(() => { if (!document.hidden && Date.now() - last >= EVERY) check(); }, 30 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > 30 * 1000) check(); });
    window.addEventListener('online', check);
    setTimeout(check, 20 * 1000);   // ตรวจครั้งแรกหลังเปิดแอป 20 วินาที

    window.LamhinUpdate = { check: check, show: show };   // สำหรับทดสอบ
})();
