/* =====================================================================
   แผนที่ 3 มิติจุดชุมนุม + แผนที่นำทาง (โมดูลเสริมของกระดานสถานการณ์)
   - การ์ดแรกบนสุดของหน้าภาพรวม (registerSection host: 'overview', top: true) — วาดเฉพาะตอนเห็นบนจอ
   - ผังถนน/คลองจริงจาก OpenStreetMap (cmd3d-data.js) · อาคารวางตามภาพดาวเทียมที่ผู้ใช้ส่งมา (อ้างอิงเท่านั้น ไม่ฝังภาพ Google)
   - หน่วย 1 = 1 เมตร · แผน: x = ตะวันออก, y = เหนือ · Three.js: X = x, Z = -y, Y = ความสูง
   - จุด (0,0) = จุดชุมนุม 13.883804945497769, 100.80997853378307 (เหนือซอยคู้คลองสิบ 4 ~10 ม. ห่างถนนคู้-คลองสิบ ~43 ม.)
   การควบคุม: ลากนิ้วเดียว/เมาส์ซ้าย = หมุน 360° · จีบสองนิ้ว/ล้อเมาส์ = ซูม · ลากสองนิ้ว/คลิกขวา/Shift+ลาก = เลื่อน
              ปล่อยมือ 8 วินาที = หมุนช้า ๆ เอง · ฉากหยุดวาดเมื่อสลับไปแท็บอื่น
   ===================================================================== */
(function () {
    'use strict';

    const CMD = window.LamhinCmd;
    if (!CMD || typeof CMD.registerSection !== 'function') { console.warn('[cmd3d] ต้องโหลดหลัง cmd/cmd.js'); return; }

    const SRC = (document.currentScript && document.currentScript.src) || '';
    const BASE = SRC.replace(/[^/]*(\?.*)?$/, '');
    const BUILD = '10';   // เพิ่มเลขนี้ทุกครั้งที่แก้ cmd3d.css / cmd3d-data.js (กันเบราว์เซอร์จำไฟล์เก่า)
    const VER = ((SRC.match(/[?&]v=([^&]+)/) || [])[1] || '1') + '.' + BUILD;

    const LAT = 13.883804945497769, LON = 100.80997853378307;
    const SEED_ID = 'ev-20261128-lamjedee';
    const LEVEL_HEX = { green: 0x16A34A, yellow: 0xF59E0B, red: 0xDC2626 };
    const MAX_CROWD = 500;   // ปรับจำนวนผู้ชุมนุมจำลองได้ 1–500 คน (ค่าเริ่มต้น 100)

    /* ---------------- โหลด CSS / ข้อมูลผัง ---------------- */
    (function () {
        if (document.querySelector('link[data-m3css]')) return;
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = BASE + 'cmd3d.css?v=' + VER; l.setAttribute('data-m3css', '');
        document.head.appendChild(l);
    })();
    let dataPromise = null;
    function loadData() {
        if (window.LamhinCmd3DData) return Promise.resolve(window.LamhinCmd3DData);
        if (dataPromise) return dataPromise;
        dataPromise = new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = BASE + 'cmd3d-data.js?v=' + VER;
            s.onload = () => window.LamhinCmd3DData ? res(window.LamhinCmd3DData) : rej(new Error('ไม่มีข้อมูลผัง'));
            s.onerror = () => rej(new Error('โหลดข้อมูลผังไม่สำเร็จ'));
            document.head.appendChild(s);
        });
        return dataPromise;
    }

    /* ---------------- สถานะ ---------------- */
    let api = null, host = null, ui = {};
    let D = null;                     // ข้อมูลผัง
    let built = false, building = null, running = false, raf = 0, lastT = 0;
    let renderer, scene, camera, sun, hemi, skyTex, skyCanvas;
    const cam = { az: 0.32, pol: 0.86, dist: 600, tx: 0, tz: 0 };
    const want = { az: 0.32, pol: 0.86, dist: 600, tx: 0, tz: 0 };
    let panLock = false;   // ปุ่มมือ: ลากนิ้วเดียว = เลื่อนแผนที่ (แทนหมุน)
    let idleAt = Date.now(), autoRot = true, labelsOn = true, crowdOn = true, crowdN = 100, timeMode = 'day', lowPower = false;
    let curLevel = 'green';
    const labels = [];
    const anim = { crowd: null, heads: null, crowdBase: [], signs: [], leader: null, pulse: null, pin: null, pinMat: null, pulseMat: null, bars: [], traffic: [], lampGlows: [], headlights: [], zone: null, zoneLabel: null, crowdGroup: null };

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const V = (x, y, h) => new THREE.Vector3(x, h || 0, -y);
    function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    /* =====================================================================
       ส่วนหน้าจอ (การ์ด + แถบเครื่องมือ + เวที + ข้อมูลพิกัด)
       ===================================================================== */
    function mount(el, A) {
        api = A; host = el;
        el.innerHTML =
            '<section class="cmd-card m3-card">' +
                '<div class="cmd-card-h"><i class="fa-solid fa-cube"></i><h4>แผนที่ 3 มิติ · รัศมี 300 ม.</h4>' +
                '<small class="m3-hint">ลากหมุน · ล้อเมาส์/จีบนิ้วซูมตรงจุดที่ชี้ · คลิกขวา/สองนิ้วเลื่อน · ดับเบิลคลิกซูมเข้าจุดนั้น</small></div>' +
                '<div class="m3-bar">' +
                    '<div class="m3-seg" data-m3="time">' +
                        '<button type="button" data-time="dawn"><i class="fa-solid fa-moon"></i> 05.00</button>' +
                        '<button type="button" data-time="day" class="on"><i class="fa-solid fa-sun"></i> กลางวัน</button>' +
                        '<button type="button" data-time="dusk"><i class="fa-solid fa-cloud-sun"></i> 18.00</button>' +
                    '</div>' +
                    '<button type="button" class="m3-chip on" data-m3="crowd"><i class="fa-solid fa-people-group"></i> มวลชน</button>' +
                    '<label class="m3-crowd" title="จำนวนผู้ชุมนุมจำลอง"><span>จำนวน</span><input type="range" min="1" max="500" step="1" value="100" data-m3="count"><b data-m3="countv">100</b></label>' +
                    '<button type="button" class="m3-chip on" data-m3="labels"><i class="fa-solid fa-tags"></i> ป้ายชื่อ</button>' +
                    '<button type="button" class="m3-chip on" data-m3="rotate"><i class="fa-solid fa-rotate"></i> หมุนเอง</button>' +
                '</div>' +
                '<div class="m3-stage" data-m3="stage">' +
                    '<div class="m3-labels" data-m3="labelsLayer"></div>' +
                    '<div class="m3-focus">' +
                        '<button type="button" data-focus="overview"><i class="fa-solid fa-expand"></i><span>ภาพรวม 300 ม.</span></button>' +
                        '<button type="button" data-focus="site"><i class="fa-solid fa-location-dot"></i><span>จุดชุมนุม</span></button>' +
                        '<button type="button" data-focus="junction"><i class="fa-solid fa-road"></i><span>แยกปากซอย</span></button>' +
                        '<button type="button" data-focus="mea"><i class="fa-solid fa-bolt"></i><span>แนวเสา/กฟน.</span></button>' +
                        '<button type="button" data-focus="mosque"><i class="fa-solid fa-mosque"></i><span>ลานจอด/ศปก.</span></button>' +
                    '</div>' +
                    '<div class="m3-compass" data-m3="compass" title="แตะเพื่อหันทิศเหนือขึ้น"><div class="m3-needle"><b>N</b></div></div>' +
                    '<button type="button" class="m3-max-btn" data-m3="max" title="เต็มจอ"><i class="fa-solid fa-expand"></i></button>' +
                    // ปุ่มกล้อง (มือถือใช้สะดวก): ซูม · มุมบน/เอียง · ลากเลื่อน
                    '<div class="m3-ctl" role="group" aria-label="ควบคุมกล้อง">' +
                        '<button type="button" data-m3="zin" title="ซูมเข้า" aria-label="ซูมเข้า"><i class="fa-solid fa-plus"></i></button>' +
                        '<button type="button" data-m3="zout" title="ซูมออก" aria-label="ซูมออก"><i class="fa-solid fa-minus"></i></button>' +
                        '<button type="button" data-m3="tilt" title="สลับมุมมองจากด้านบน (2D) / มุมเอียง (3D)" aria-label="สลับมุมมอง"><b>2D</b></button>' +
                        '<button type="button" data-m3="pan" title="ลากนิ้วเดียว = เลื่อนแผนที่" aria-label="โหมดลากเลื่อนแผนที่" aria-pressed="false"><i class="fa-solid fa-hand"></i></button>' +
                    '</div>' +
                    '<div class="m3-legend">' +
                        '<span><i style="background:#D4AF37"></i>จุดชุมนุม</span>' +
                        '<span><i style="background:#F59E0B"></i>แนวเสาใหม่ (พิพาท)</span>' +
                        '<span><i style="background:#1e3a8a"></i>ตำรวจ คฝ.</span>' +
                        '<span><i style="background:#F28C28"></i>รถกระเช้า กฟน.</span>' +
                        '<span><i style="background:#2f6f95"></i>คลอง/คูน้ำ</span>' +
                    '</div>' +
                    '<div class="m3-scale" data-m3="scale"><span>-</span><i></i></div>' +
                    '<div class="m3-attr">© OpenStreetMap contributors · อาคารจำลองโดยประมาณ</div>' +
                    '<div class="m3-loading" data-m3="loading"><span><i class="fa-solid fa-spinner fa-spin"></i> กำลังเตรียมแผนที่ 3 มิติ…</span></div>' +
                    '<div class="m3-note" data-m3="note" hidden></div>' +
                    // แผงข้อมูลการชุมนุม (เห็นเฉพาะตอนเต็มจอ) — แตะหัวแผงเพื่อย่อ/ขยาย
                    '<div class="m3-info" data-m3="info"></div>' +
                '</div>' +
                '<div class="m3-links">' +
                    '<span class="m3-ll"><i class="fa-solid fa-location-dot"></i><code>' + LAT.toFixed(6) + ', ' + LON.toFixed(6) + '</code></span>' +
                    '<button type="button" class="cmd-btn sm neon" data-m3="copyll"><i class="fa-solid fa-copy"></i> คัดลอกพิกัด</button>' +
                    '<a class="cmd-btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + LAT + ',' + LON + '"><i class="fa-solid fa-street-view"></i> Street View</a>' +
                    '<a class="cmd-btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=map&center=' + LAT + ',' + LON + '&zoom=18&basemap=satellite"><i class="fa-solid fa-satellite"></i> ดาวเทียม</a>' +
                    '<a class="cmd-btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + LAT + ',' + LON + '"><i class="fa-solid fa-map-pin"></i> Google Maps</a>' +
                '</div>' +
            '</section>';

        ui = {};
        el.querySelectorAll('[data-m3]').forEach((n) => { ui[n.getAttribute('data-m3')] = n; });
        ui.needle = el.querySelector('.m3-needle');
        el.addEventListener('click', onUiClick);
        ui.count.addEventListener('input', () => { crowdN = Math.max(1, Math.min(MAX_CROWD, Number(ui.count.value) || 100)); ui.countv.textContent = crowdN; applyCrowd(); });

        // อยู่ในหน้าภาพรวมที่เลื่อนยาว → หยุดวาดเมื่อเลื่อนพ้นจอ (ประหยัดแบตมือถือ)
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((es) => { inView = es[es.length - 1].isIntersecting; if (built) syncRun(); }, { rootMargin: '160px 0px' }).observe(ui.stage);
        }
        loadData().then((d) => { D = d; }).catch((e) => {
            console.error('[cmd3d]', e);
            ui.loading.innerHTML = '<span>โหลดข้อมูลผังไม่สำเร็จ — ลองรีเฟรชหน้า</span>';
        });
    }

    function onUiClick(e) {
        const t = e.target.closest('button[data-time], button[data-focus], [data-m3]');
        if (!t || !host.contains(t)) return;
        if (t.dataset.time) { setTime(t.dataset.time); return; }
        if (t.dataset.focus) { focus(t.dataset.focus); return; }
        const k = t.getAttribute('data-m3');
        if (k === 'crowd') { crowdOn = !crowdOn; t.classList.toggle('on', crowdOn); applyCrowd(); }
        else if (k === 'labels') { labelsOn = !labelsOn; t.classList.toggle('on', labelsOn); updateLabels(true); }
        else if (k === 'rotate') { autoRot = !autoRot; t.classList.toggle('on', autoRot); idleAt = Date.now(); }
        else if (k === 'compass') { want.az = 0; idleAt = Date.now(); }
        else if (k === 'max') toggleMax();
        else if (k === 'zin') { zoomAt(0.65); stopAuto(); }
        else if (k === 'zout') { zoomAt(1 / 0.65); stopAuto(); }
        else if (k === 'tilt') { want.pol = want.pol > 0.35 ? 0.06 : 0.95; clampWant(); stopAuto(); idleAt = Date.now(); }
        else if (k === 'pan') { panLock = !panLock; t.classList.toggle('on', panLock); t.setAttribute('aria-pressed', String(panLock)); }
        else if (k === 'copyll') api.copyText(LAT + ', ' + LON);
        else if (k === 'infoToggle') { infoOpen = !infoOpen; paintInfo(); }
    }


    function toggleMax() {
        const st = ui.stage;
        const doc = document;
        if (doc.fullscreenElement === st) { doc.exitFullscreen(); return; }
        if (st.classList.contains('m3-max')) { st.classList.remove('m3-max'); setFs(); setTimeout(resize, 50); return; }
        if (st.requestFullscreen && !/iPhone|iPad/i.test(navigator.userAgent)) {
            st.requestFullscreen().catch(() => { st.classList.add('m3-max'); setFs(); setTimeout(resize, 50); });
        } else { st.classList.add('m3-max'); setFs(); setTimeout(resize, 50); }
    }
    document.addEventListener('fullscreenchange', () => { setFs(); setTimeout(resize, 60); });

    /* ---------------- แผงข้อมูลการชุมนุมบนแผนที่เต็มจอ ---------------- */
    let curEv = null, infoOpen = true, infoTimer = 0;
    function setFs() {
        if (!ui.stage) return;
        const on = document.fullscreenElement === ui.stage || ui.stage.classList.contains('m3-max');
        ui.stage.classList.toggle('m3-fs', on);
        // เต็มจอแบบสำรอง (iPhone): การ์ดที่มี backdrop-filter ทำให้ position:fixed ไม่เต็มจอ → ปิดเอฟเฟกต์ชั่วคราว + ล็อกการเลื่อนหน้า
        const max = ui.stage.classList.contains('m3-max'), card = ui.stage.closest('.m3-card');
        if (card) card.classList.toggle('m3-maxhost', max);
        document.documentElement.classList.toggle('m3-lock', max);
        clearInterval(infoTimer); infoTimer = 0;
        if (on) { paintInfo(); infoTimer = setInterval(paintPhase, 1000); }
    }
    // ช่วงเวลาตอนนี้ เช่น "อีก 3 ชม. 10 นาที ถึง รวมพล 04.30 น." (ข้อความจาก api.phase ของกระดาน)
    function phaseText(ev) {
        if (!api || !api.phase || !ev) return '';
        const now = Date.now(), ph = api.phase(ev, now), hu = api.human || (() => '');
        if (ph.mode === 'pre') return 'อีก ' + hu(ph.target - now) + ' ' + ph.label;
        if (ph.mode === 'live') return ph.label + (ph.key === 'live' ? ' · เหลือ ' + hu(ph.target - now) : '');
        if (ph.mode === 'over') return ph.label + ' มาแล้ว ' + hu(now - ph.target);
        return '';
    }
    function paintPhase() {
        const p = ui.info && ui.info.querySelector('.m3-info-ph');
        if (p) p.innerHTML = '<i class="fa-solid fa-stopwatch"></i><span>' + phaseText(curEv) + '</span>';
    }
    function paintInfo() {
        if (!ui.info) return;
        const ev = curEv;
        if (!ev || !api) { ui.info.innerHTML = ''; return; }
        const L = (api.LEVELS || {})[ev.level] || {};
        const rows = api.heroRows ? api.heroRows(ev) : [];
        const legend = ui.stage.querySelector('.m3-legend');
        ui.info.classList.toggle('open', infoOpen);
        ui.info.innerHTML =
            '<button type="button" class="m3-info-h" data-m3="infoToggle" aria-expanded="' + infoOpen + '">' +
                '<i class="cmd-dot ' + api.esc(ev.level) + '" title="' + api.esc(L.name || '') + '"></i>' +
                '<span><small>' + api.esc(ev.category || 'เหตุการณ์') + ' · ' + api.esc(L.name || '') + '</small><b>' + api.esc(ev.title) + '</b></span>' +
                '<i class="fa-solid fa-chevron-' + (infoOpen ? 'down' : 'up') + ' m3-info-chev"></i></button>' +
            (infoOpen ? '<div class="m3-info-b">' +
                '<div class="m3-info-ph"></div>' +
                (rows.length ? '<ul>' + rows.join('') + '</ul>' : '') +
                (legend ? '<div class="m3-info-lg">' + legend.innerHTML + '</div>' : '') +
            '</div>' : '');
        paintPhase();
    }

    /* ---------------- รับสัญญาณจากกระดาน ---------------- */
    function update(ev) {
        if (!ui.note) return;
        curEv = ev || null;
        if (ui.stage && ui.stage.classList.contains('m3-fs')) paintInfo();
        let msg = '';
        if (ev) {
            const m = String(ev.latlng || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
            if (m) {
                const dx = (Number(m[2]) - LON) * 111320 * Math.cos(LAT * Math.PI / 180), dy = (Number(m[1]) - LAT) * 110574;
                if (Math.hypot(dx, dy) > 400) msg = 'เหตุการณ์ที่เลือกอยู่นอกพื้นที่แผนที่นี้ — ฉากนี้จำลองจุดชุมนุมซอยคู้คลองสิบ 4';
            } else if (ev.id !== SEED_ID) msg = 'ฉากนี้จำลองจุดชุมนุมซอยคู้คลองสิบ 4 (เหตุการณ์ที่เลือกยังไม่ได้ปักพิกัด)';
            curLevel = LEVEL_HEX[ev.level] ? ev.level : 'green';
        }
        ui.note.hidden = !msg; ui.note.textContent = msg;
        applyLevel();
    }

    let shown = false, inView = true;
    function syncRun() { if (shown && inView && host && !host.hidden) start(); else stop(); }
    function visible(on) {
        shown = on;
        if (on) {
            ensureBuilt().then(syncRun).catch((e) => {
                console.error('[cmd3d]', e);
                if (ui.loading) ui.loading.innerHTML = '<span>เปิดแผนที่ 3 มิติไม่ได้บนอุปกรณ์นี้ (WebGL)</span>';
            });
        } else stop();
    }

    function ensureBuilt() {
        if (built) return Promise.resolve();
        if (building) return building;
        if (typeof THREE === 'undefined') return Promise.reject(new Error('ไม่พบ three.js'));
        const fontReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 40px Sarabun'), document.fonts.load('700 40px Sarabun')]).catch(() => {}) : Promise.resolve();
        building = Promise.all([loadData(), fontReady]).then((r) => {
            D = r[0];
            buildScene();
            built = true;
            ui.loading.hidden = true;
        });
        return building;
    }

    /* =====================================================================
       ฉาก 3 มิติ
       ===================================================================== */
    const MAT = {};
    function lam(hex, o) {
        const key = hex + '|' + JSON.stringify(o || {});
        if (MAT[key]) return MAT[key];
        const m = new THREE.MeshLambertMaterial(Object.assign({ color: hex }, o || {}));
        MAT[key] = m; return m;
    }
    function flatMat(hex, layer, o) {
        return new THREE.MeshLambertMaterial(Object.assign({ color: hex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer * 2 }, o || {}));
    }
    const G = {};
    function geos() {
        G.box = new THREE.BoxGeometry(1, 1, 1);
        const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.lineTo(-0.5, 0);
        G.prism = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); G.prism.translate(0, 0, -0.5);   // หน้าจั่วที่ ±Z สันหลังคาตามแกน Z
        G.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
        G.cone = new THREE.ConeGeometry(1, 1, 8);
        G.sph = new THREE.SphereGeometry(1, 14, 10);
        G.dome = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        G.ico = new THREE.IcosahedronGeometry(1, 0);
        G.halfCyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);   // โค้งด้านบน แกนตาม Z
    }
    function addBox(x0, x1, y0, y1, z0, h, mat, shadow) {
        const m = new THREE.Mesh(G.box, mat);
        m.scale.set(Math.abs(x1 - x0), h, Math.abs(y1 - y0));
        m.position.set((x0 + x1) / 2, z0 + h / 2, -(y0 + y1) / 2);
        if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
        scene.add(m); return m;
    }
    function addRoof(x0, x1, y0, y1, z0, rh, mat) {   // หลังคาจั่ว สันตามด้านยาว
        const w = Math.abs(x1 - x0), d = Math.abs(y1 - y0);
        const m = new THREE.Mesh(G.prism, mat);
        if (d >= w) m.scale.set(w * 1.06, rh, d * 1.04);
        else { m.rotation.y = Math.PI / 2; m.scale.set(d * 1.06, rh, w * 1.04); }
        m.position.set((x0 + x1) / 2, z0, -(y0 + y1) / 2);
        m.castShadow = true; scene.add(m); return m;
    }
    function house(x0, x1, y0, y1, h, wall, roof, rh) {
        addBox(x0, x1, y0, y1, 0, h, lam(wall));
        addRoof(x0, x1, y0, y1, h, rh || Math.min(3, Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 0.35), lam(roof));
    }

    // ---------- ผิวพื้นแบบแถบ (ถนน/คลอง) รวมเป็นก้อนเดียวต่อชนิด ----------
    function Batch() { this.p = []; this.i = []; }
    Batch.prototype.strip = function (L, R, h) {
        const b = this.p.length / 3;
        for (let k = 0; k < L.length; k++) { this.p.push(L[k][0], h, -L[k][1], R[k][0], h, -R[k][1]); }
        for (let k = 0; k < L.length - 1; k++) { const a = b + k * 2; this.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    };
    Batch.prototype.fan = function (cx, cy, r, h, seg) {
        const b = this.p.length / 3; seg = seg || 14;
        this.p.push(cx, h, -cy);
        for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; this.p.push(cx + Math.cos(a) * r, h, -(cy + Math.sin(a) * r)); }
        for (let k = 1; k <= seg; k++) this.i.push(b, b + k, b + k + 1);
    };
    Batch.prototype.quad = function (a, b, c, d, h) {
        const s = this.p.length / 3;
        [a, b, c, d].forEach((q) => this.p.push(q[0], h, -q[1]));
        this.i.push(s, s + 1, s + 2, s, s + 2, s + 3);
    };
    Batch.prototype.mesh = function (mat, receive) {
        if (!this.i.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
        const n = new Float32Array(this.p.length); for (let k = 1; k < n.length; k += 3) n[k] = 1;
        g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
        g.setIndex(this.i);
        const m = new THREE.Mesh(g, mat); m.receiveShadow = receive !== false; scene.add(m); return m;
    };
    function offsetLine(pts, off) {
        const n = pts.length, out = [];
        for (let k = 0; k < n; k++) {
            const p = pts[k], a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
            let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            let s = 1;
            if (k > 0 && k < n - 1) {
                let ex = p[0] - a[0], ey = p[1] - a[1]; const E = Math.hypot(ex, ey) || 1; ex /= E; ey /= E;
                s = 1 / Math.max(0.45, (-ey) * (-dy) + ex * dx);
            }
            out.push([p[0] - dy * off * s, p[1] + dx * off * s]);   // off > 0 = ซ้ายของทิศเส้น
        }
        return out;
    }
    function ribbon(batch, pts, w, h) { batch.strip(offsetLine(pts, w / 2), offsetLine(pts, -w / 2), h); }
    function densify(pts, step) {
        const out = [pts[0]];
        for (let k = 1; k < pts.length; k++) {
            const a = pts[k - 1], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
            for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
        }
        return out;
    }
    function dashes(batch, pts, w, h, dash, gap, off) {
        const P = off ? offsetLine(pts, off) : pts;
        let carry = 0;
        for (let k = 1; k < P.length; k++) {
            const a = P[k - 1], b = P[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
            const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * w / 2, ny = ux * w / 2;
            let s = carry;
            while (s < L) {
                const e = Math.min(L, s + dash);
                const p0 = [a[0] + ux * s, a[1] + uy * s], p1 = [a[0] + ux * e, a[1] + uy * e];
                batch.quad([p0[0] + nx, p0[1] + ny], [p1[0] + nx, p1[1] + ny], [p1[0] - nx, p1[1] - ny], [p0[0] - nx, p0[1] - ny], h);
                s += dash + gap;
            }
            carry = s - L;
        }
    }
    function along(pts, dist) {   // จุดและทิศบนเส้นที่ระยะ dist จากต้นเส้น
        let acc = 0;
        for (let k = 1; k < pts.length; k++) {
            const a = pts[k - 1], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (acc + L >= dist) { const t = (dist - acc) / L; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L }; }
            acc += L;
        }
        const a = pts[pts.length - 2], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return { x: b[0], y: b[1], ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L };
    }
    function lineLength(pts) { let s = 0; for (let k = 1; k < pts.length; k++) s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return s; }
    function segDist(px, py, a, b) {
        const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        let t = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
    }
    function mainX(y) {   // ตำแหน่ง x ของแนวกึ่งกลางถนนคู้-คลองสิบ ที่ระดับ y
        if (!mainPts) return -43;
        for (let k = 1; k < mainPts.length; k++) {
            const a = mainPts[k - 1], b = mainPts[k];
            if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
        }
        return mainPts[0][0];
    }
    function canvasTex(w, h, draw, rep) {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c);
        if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
        t.anisotropy = 4;
        return t;
    }

    function buildScene() {
        const st = ui.stage;
        const W = st.clientWidth || 600, H = st.clientHeight || 400;
        lowPower = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || Math.min(window.screen.width, window.screen.height) < 700;
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.6 : 2));
        renderer.setSize(W, H, false);
        renderer.shadowMap.enabled = !lowPower;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        st.insertBefore(renderer.domElement, st.firstChild);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(42, W / H, 2, 5000);
        geos();

        // ---- แสง + ท้องฟ้า ----
        hemi = new THREE.HemisphereLight(0xdfefff, 0x6b7d45, 0.75); scene.add(hemi);
        sun = new THREE.DirectionalLight(0xfff3df, 1.0);
        sun.castShadow = renderer.shadowMap.enabled;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 900 });
        sun.shadow.bias = -0.0006;
        scene.add(sun); scene.add(sun.target);
        skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 256;
        skyTex = new THREE.CanvasTexture(skyCanvas);
        const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
        scene.add(sky);
        scene.fog = new THREE.Fog(0xcfe0f0, 900, 2400);

        // แนวถนนหลัก/ซอย/คลอง (ใช้ตั้งแต่วาดพื้น)
        D.roads.forEach((r) => {
            if (r.k === 'main' && (!mainPts || lineLength(r.p) > lineLength(mainPts))) mainPts = r.p;
            if (r.k === 'soi' && (!soiPts || lineLength(r.p) > lineLength(soiPts))) soiPts = r.p;
        });
        canalPts = (D.water[0] || {}).p || null;
        buildGround();
        buildRoads();
        buildBuildings();
        buildVegetation();
        buildPoles();
        buildEventScene();
        buildRings();
        buildLabels();

        setTime(timeMode);
        applyCrowd();
        applyLevel();
        focus('overview', true);
        bindControls(renderer.domElement);
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(st);
        window.addEventListener('resize', resize);
    }

    /* ---------- พื้น + แปลงที่ดิน ---------- */
    function buildGround() {
        const R = 378;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 6, 10, 120, 1, true), new THREE.MeshLambertMaterial({ color: 0x13233d }));
        base.position.y = -5; scene.add(base);
        const bottom = new THREE.Mesh(new THREE.CircleGeometry(R + 6, 120), new THREE.MeshBasicMaterial({ color: 0x0b1628 }));
        bottom.rotation.x = Math.PI / 2; bottom.position.y = -10; scene.add(bottom);
        // พื้นทั้งแผ่นเป็นภาพเดียว: วาดแปลงนา ลานดิน ลานจอด บ่อ ลงผืนผ้าใบ แล้วแปะบนพื้นวงกลม (ตัดขอบวงกลมพอดี ไม่ล้นแท่นฐาน)
        const top = new THREE.Mesh(new THREE.CircleGeometry(R, 120), new THREE.MeshLambertMaterial({ map: groundTexture(R) }));
        top.rotation.x = -Math.PI / 2; top.receiveShadow = true; scene.add(top);
        // ขอบทองรอบแท่นฐาน
        const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.9, 6, 160), new THREE.MeshBasicMaterial({ color: 0xD4AF37 }));
        rim.rotation.x = Math.PI / 2; rim.position.y = 0.2; scene.add(rim);
    }
    function groundTexture(R) {
        const N = lowPower ? 1536 : 2048, c = document.createElement('canvas'); c.width = c.height = N;
        const g = c.getContext('2d');
        const PX = (x) => (x + R) / (2 * R) * N, PY = (y) => (R - y) / (2 * R) * N;   // ทิศเหนืออยู่บน
        const stripes = (base, line, gapM, vertical) => {
            const p = document.createElement('canvas'), s = Math.max(4, Math.round(gapM / (2 * R) * N));
            p.width = p.height = s; const q = p.getContext('2d');
            q.fillStyle = base; q.fillRect(0, 0, s, s); q.fillStyle = line;
            if (vertical) q.fillRect(0, 0, Math.max(1, s * 0.35), s); else q.fillRect(0, 0, s, Math.max(1, s * 0.35));
            return g.createPattern(p, 'repeat');
        };
        const rect = (x0, x1, y0, y1, fill) => { g.fillStyle = fill; g.fillRect(PX(x0), PY(y1), PX(x1) - PX(x0), PY(y0) - PY(y1)); };
        const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(PX(p[0]), PY(p[1])) : g.moveTo(PX(p[0]), PY(p[1])))); g.closePath(); g.fill(); };
        // พื้นหญ้าแห้ง/ที่รกร้าง
        g.fillStyle = '#8a9a5b'; g.fillRect(0, 0, N, N);
        // นาข้าว (ใต้ซอยฝั่งตะวันออก + ทิศใต้ทั้งแถบ) แบ่งแปลงด้วยคันนา
        rect(-26, 400, -112, -24, stripes('#6f9a3e', '#7fae4a', 3));
        rect(-58, 400, -400, -114, stripes('#7a9f45', '#88b052', 3));
        rect(-158, -65, -88, -14, stripes('#2f5a2a', '#3b6b31', 2.5, true));     // แปลงนา/บ่อสีเขียวเข้ม ฝั่งตะวันตก
        rect(-150, -64, -400, -96, stripes('#6d9440', '#7ba64a', 3, true));
        g.strokeStyle = 'rgba(96,120,60,0.9)'; g.lineWidth = Math.max(1.5, N / 900);
        for (let x = 40; x < 380; x += 70) { g.beginPath(); g.moveTo(PX(x), PY(-24)); g.lineTo(PX(x), PY(-400)); g.stroke(); }
        for (let y = -180; y > -400; y -= 80) { g.beginPath(); g.moveTo(PX(-58), PY(y)); g.lineTo(PX(400), PY(y)); g.stroke(); }
        // ลานดินฝั่งตะวันออก · ลานจอดรถมัสยิด · ลานคอนกรีต Land Biz · สนามเล็กในเขตมัสยิด · บ่อน้ำ
        rect(162, 207, 1, 67, '#bfa274');
        rect(-78, -50.5, -9, 20, '#97978f');      // ลานจอดรถมัสยิด (ลานกว้างติดถนนใหญ่)
        rect(-92, -78, 4, 30, '#6f9e4a');        // สนามหญ้าหน้ามัสยิด
        rect(-23, 222, 88, 140, '#b7b9b4');
        rect(123, 135, 43, 55, '#2f6f95');
        // แปลงบ้านเลขที่ 42 (ขอบตะวันตกขนานถนนใหญ่) · พื้นที่ชุมนุม (ที่ว่างระหว่างรั้วกับซอย) · บ่อ/ไม้ดอกหัวมุมปากซอย
        // ป่าละเมาะ/พงหญ้าริมซอย (ตามภาพ Street View: พ้นรั้วไปทางตะวันออกต้นไม้ขึ้นชิดขอบซอยทั้งสองฝั่ง)
        const strip = (pts, widthM, color) => { g.strokeStyle = color; g.lineWidth = widthM / (2 * R) * N; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(PX(p[0]), PY(p[1])) : g.moveTo(PX(p[0]), PY(p[1])))); g.stroke(); };
        if (soiPts) { strip(offsetLine(soiPts, -9.5), 11, '#62743f'); }
        rect(27, 86, -16, 6, '#62743f');
        poly([[mainX(6) + 11.5, 6], [27, 6], [27, 81], [mainX(81) + 11.5, 81]], '#9aa865');          // สนามหญ้าในรั้ว บ้านเลขที่ 42
        poly([[mainX(-6) + 7.5, -6.5], [27, -6.5], [27, 6], [mainX(6) + 7.5, 6]], '#a79a6f');      // ที่ว่างหน้ารั้ว = พื้นที่ชุมนุม
        poly([[mainX(-1) + 9, -1], [mainX(-1) + 11.2, -1], [mainX(19) + 11.2, 19], [mainX(19) + 9, 19]], '#2f6f95');
        // ใต้ทรงพุ่มไม้ให้เข้มขึ้นเล็กน้อย (ดงไม้)
        g.fillStyle = 'rgba(40,80,40,0.35)';
        [[27, 72, 6, 81], [-128, -50, 58, 82], [207, 252, 0, 80]].forEach((r) => rect(r[0], r[1], r[2], r[3], g.fillStyle));
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return t;
    }

    /* ---------- ถนน คลอง คูน้ำ สะพาน ---------- */
    let mainPts = null, soiPts = null, canalPts = null;
    function buildRoads() {
        const asphalt = new Batch(), concrete = new Batch(), lane = new Batch(), track = new Batch(), white = new Batch(), yellow = new Batch(), wat = new Batch(), bank = new Batch();
        D.roads.forEach((r) => {
            const p = r.p;
            if (r.k === 'main') ribbon(asphalt, p, r.w, 0.34);
            else if (r.k === 'soi') { ribbon(concrete, p, r.w, 0.3); concrete.fan(p[0][0], p[0][1], r.w / 2, 0.3); }
            else if (r.k === 'lane') { ribbon(lane, p, r.w, 0.26); lane.fan(p[0][0], p[0][1], r.w / 2, 0.26, 10); lane.fan(p[p.length - 1][0], p[p.length - 1][1], r.w / 2, 0.26, 10); }
            else ribbon(track, p, r.w, 0.2);
        });
        D.water.forEach((w) => { ribbon(bank, w.p, w.w + 9, 0.14); ribbon(wat, w.p, w.w, 0.17); });
        if (mainPts) {
            const dm = densify(mainPts, 4);
            white.strip(offsetLine(dm, 5.55), offsetLine(dm, 5.35), 0.42);
            white.strip(offsetLine(dm, -5.35), offsetLine(dm, -5.55), 0.42);
            dashes(yellow, dm, 0.18, 0.43, 3, 6);
            // คูน้ำริมถนนฝั่งตะวันออก (เว้นช่วงปากซอย/ทางเข้า)
            const gaps = [[-18, -2], [94, 108]];
            const ditch = offsetLine(dm, -8.4);
            let run = [];
            ditch.forEach((q) => {
                const blocked = gaps.some((g) => q[1] > g[0] && q[1] < g[1]);
                if (!blocked) run.push(q);
                if ((blocked || q === ditch[ditch.length - 1]) && run.length > 1) { ribbon(wat, run, 3.2, 0.18); ribbon(bank, run, 5.5, 0.15); run = []; }
                else if (blocked) run = [];
            });
        }
        bank.mesh(flatMat(0x6f7d4a, 3));
        wat.mesh(flatMat(0x2f6f95, 4, { emissive: 0x062033 }));
        track.mesh(flatMat(0xb09670, 5));
        lane.mesh(flatMat(0x9ea3a8, 6));
        concrete.mesh(flatMat(0xc9ccd0, 7));
        asphalt.mesh(flatMat(0x3b3f46, 8));
        white.mesh(flatMat(0xf4f5f6, 9, { emissive: 0x333333 }), false);
        yellow.mesh(flatMat(0xf2c230, 9, { emissive: 0x4a3a00 }), false);

        // สะพานข้ามคลองลำหิน (ทางจากแยกไปฝั่งตะวันตก)
        if (canalPts) {
            const deck = new THREE.Mesh(G.box, lam(0xb8b3a8));
            deck.scale.set(34, 1.1, 7); deck.position.set(-160, 1.2, 5); deck.rotation.y = -0.1; deck.castShadow = true; scene.add(deck);
            [-1, 1].forEach((s) => {
                const rail = new THREE.Mesh(G.box, lam(0xe8e6e1));
                rail.scale.set(34, 0.9, 0.3); rail.position.set(-160 + s * 0.35, 2.2, 5 + s * 3.4); rail.rotation.y = -0.1; scene.add(rail);
            });
        }
    }

    /* ---------- อาคาร ---------- */
    let winTex = null;
    function windowTex() {
        if (winTex) return winTex;
        winTex = canvasTex(64, 64, (g, w, h) => {
            g.fillStyle = '#f1e3c6'; g.fillRect(0, 0, w, h);
            g.fillStyle = '#5b7187';
            for (let y = 10; y < h; y += 21) for (let x = 6; x < w; x += 16) g.fillRect(x, y, 9, 10);
        });
        winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
        return winTex;
    }
    function buildBuildings() {
        // ===== ฝั่งตะวันตก: มัสยิดดารุ้ลมุกร้อดรอบีน (ลำหิน) และอาคารในเขตมัสยิด =====
        const pink = lam(0xe9a3a8), green = lam(0x23946a, { emissive: 0x062a1c }), gold = lam(0xd4af37, { emissive: 0x3a2a00 });
        addBox(-116, -92, 10, 27, 0, 9, pink);
        addBox(-93.2, -92, 13, 24, 0, 6.5, lam(0xc8473b));   // ซุ้มประตูโค้งสีแดงด้านหน้า (ทิศตะวันออก หันหาลานจอด)
        const md = new THREE.Mesh(G.dome, green); md.scale.set(5.2, 5.6, 5.2); md.position.set(-104, 9, -18.5); md.castShadow = true; scene.add(md);
        [[-112, 13], [-112, 24], [-96, 13], [-96, 24]].forEach((q) => {
            const d = new THREE.Mesh(G.dome, green); d.scale.set(2, 2.3, 2); d.position.set(q[0], 9, -q[1]); scene.add(d);
        });
        [[-92.5, 10.5], [-92.5, 26.5]].forEach((q) => {   // หออะซาน 2 ข้างด้านหน้า
            const t = new THREE.Mesh(G.cyl, lam(0xf2d6d0)); t.scale.set(0.9, 19, 0.9); t.position.set(q[0], 9.5, -q[1]); t.castShadow = true; scene.add(t);
            const ring = new THREE.Mesh(G.cyl, lam(0xc8473b)); ring.scale.set(1.5, 0.6, 1.5); ring.position.set(q[0], 15, -q[1]); scene.add(ring);
            const d = new THREE.Mesh(G.dome, green); d.scale.set(1.2, 1.6, 1.2); d.position.set(q[0], 19, -q[1]); scene.add(d);
            const f = new THREE.Mesh(G.cyl, gold); f.scale.set(0.12, 1.4, 0.12); f.position.set(q[0], 21.2, -q[1]); scene.add(f);
        });
        const fin = new THREE.Mesh(G.cyl, gold); fin.scale.set(0.18, 2.2, 0.18); fin.position.set(-104, 15.6, -18.5); scene.add(fin);
        // หอประชุม/ศาลาหลังคาเขียวขนาดใหญ่ (โครงเปิดโล่ง)
        for (let x = -148; x <= -126; x += 5.5) for (let y = -1; y <= 38; y += 6.5) { const c = new THREE.Mesh(G.cyl, lam(0xd8dde3)); c.scale.set(0.25, 6, 0.25); c.position.set(x, 3, -y); scene.add(c); }
        addRoof(-150, -124, -3, 40, 6, 3.4, lam(0x3f8f7a));
        // อาคารเรียน 3 ชั้นหลังคาส้ม (โรงเรียนอัลนะฮ์ฎ่อตุ้ลอิสลามียะห์ / ศพด.)
        const wt = windowTex().clone(); wt.needsUpdate = true; wt.repeat.set(9, 1.4);
        addBox(-143, -71, 37, 57, 0, 10.5, new THREE.MeshLambertMaterial({ map: wt }));
        addRoof(-143, -71, 37, 57, 10.5, 3.6, lam(0xd9773a));
        // ศาลา/โรงจอดหลังคาขาวยาวด้านหลังลานจอด (โครงเปิดโล่ง ตามภาพ Street View)
        addBox(-89, -57, 20, 27, 3.7, 0.5, lam(0xf2f4f6));
        for (let x = -88; x <= -58; x += 5) [20.6, 26.4].forEach((y) => addBox(x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0, 3.7, lam(0xb8c0c8)));
        addBox(-86, -60, 26.6, 27, 0, 2.2, lam(0x2f5fb0));   // ผ้าใบสีน้ำเงินด้านหลังศาลา
        // แนวพุ่มไม้ริมถนนหน้าลานจอด + ต้นลีลาวดี (เว้นทางเข้าออกลาน)
        [[10, 31]].forEach((r) => addBox(-51.3, -50.1, r[0], r[1], 0, 1.0, lam(0x3f7d3a)));
        [12, 18, 24, 30].forEach((y) => {
            const tr = new THREE.Mesh(G.cyl, lam(0x8b7355)); tr.scale.set(0.2, 2.2, 0.2); tr.position.set(-50.7, 1.1, -y); scene.add(tr);
            const cn = new THREE.Mesh(G.ico, lam(0x4f8f45, { flatShading: true })); cn.scale.set(2, 1.4, 2); cn.position.set(-50.7, 3, -y); cn.castShadow = true; scene.add(cn);
        });
        addBox(-139, -130, 62, 80, 0, 4.5, lam(0xdfe4ea)); addRoof(-139, -130, 62, 80, 4.5, 1.8, lam(0x5d7a99));   // ศูนย์ดิจิทัลชุมชน
        // รั้วเขตมัสยิดริมถนน + ป้ายชื่อ
        const sign = signMesh('مسجد دار المقربين', 'มัสยิด ดารุ้ลมุกร้อดรอบีน (ลำหิน)', 7.5, 2.2, '#8a3b2a', '#fff6e0');
        sign.position.set(-51, 2.6, -2); sign.rotation.y = Math.PI / 2; scene.add(sign);
        [-3.4, 3.4].forEach((o) => { const p = new THREE.Mesh(G.cyl, lam(0x6b4f32)); p.scale.set(0.15, 2.6, 0.15); p.position.set(-51.1, 1.3, -2 + o); scene.add(p); });

        // ===== ฝั่งตะวันออก =====
        // แปลงบ้านเลขที่ 42: รั้วสีฟ้า-ขาว ประตูกลาง ศาลาหลังคาชมพู (ขอบตะวันตกขนานถนนใหญ่ เว้นคูน้ำ)
        const lot = [[mainX(6) + 11.5, 6], [27, 6], [27, 81], [mainX(81) + 11.5, 81]];
        fence(lot, [[-17.5, -9.5]]);
        for (let x = lot[0][0] + 4; x < 25; x += 6.5) {
            if (x > -19 && x < -8) continue;   // ช่องประตู
            const hd = new THREE.Mesh(G.box, lam(0x3f7d3a)); hd.scale.set(1.4, 1.2, 1.1); hd.position.set(x, 0.6, -5.3); hd.castShadow = true; scene.add(hd);
        }
        // ไม้ดอกริมบ่อหัวมุมปากซอย (ตามภาพ Street View — ตัวบ่อวาดบนพื้นแล้ว)
        for (let k = 0; k < 14; k++) { const yy = -0.5 + k * 1.45, fl = new THREE.Mesh(G.sph, lam([0xff5e7e, 0xffd23f, 0xff8c42, 0xf72585][k % 4])); fl.scale.set(0.55, 0.4, 0.55); fl.position.set(mainX(yy) + 8.4, 0.35, -yy); scene.add(fl); }
        addBox(-17, -10, 8, 31, 0, 4.2, lam(0xf3efe7)); addRoof(-17, -10, 8, 31, 4.2, 2.2, lam(0xe08f86));
        // ร้านไก่สดราคาส่ง-ไก่ตกพริกแกง
        house(72, 96, 13, 37, 4.5, 0xeee4d4, 0x8f6a4a, 2.4);
        // Fatinfurniture ร้านเฟอร์นิเจอร์ (ติดซอย)
        addBox(86, 106, -8, 4, 0, 5.5, lam(0xe7e2da)); addRoof(86, 106, -8, 4, 5.5, 2, lam(0x47607c));
        // บ้านเรือนและบ่อ
        house(114, 128, 4, 17, 4.2, 0xe6e0d4, 0x70757c); house(131, 146, 6, 31, 4.5, 0xe9e4da, 0x6b6f75); house(148, 159, 18, 31, 4, 0xe4ddd0, 0x3e5f86);
        house(126, 140, 58, 77, 4.5, 0xe8e3d9, 0x77797d); house(143, 159, 60, 74, 4.2, 0xe2dbcf, 0x8a5b3c);
        // PK เฟอร์นิเจอร์ สาขา 1 + โรงเรือนหลังคาขาว
        addBox(246, 261, 4, 19, 0, 6, lam(0xd9dcdf)); addRoof(246, 261, 4, 19, 6, 2, lam(0x6c7681));
        [[249, 262], [263.5, 276], [277.5, 288]].forEach((g) => {
            const w = g[1] - g[0];
            addBox(g[0], g[1], 21, 55, 0, 2.2, lam(0xe9edf0));
            const gh = new THREE.Mesh(G.halfCyl, lam(0xf4f6f8, { emissive: 0x202020 }));
            gh.scale.set(w / 2, 2.6, 34); gh.position.set((g[0] + g[1]) / 2, 2.2, -38); gh.castShadow = true; scene.add(gh);
        });
        // Land Biz โกดังคู้คลองสิบ หนองจอก: โกดังหลังคาเทา 3 หลัง + อาคารเล็ก + รั้วทิศใต้
        [[156, 177], [177.6, 197], [198, 219]].forEach((g) => { addBox(g[0], g[1], 88, 117, 0, 8.5, lam(0xc9ccd0)); addRoof(g[0], g[1], 88, 117, 8.5, 2.6, lam(0x8f979f)); });
        addBox(7, 27, 107, 116, 0, 4, lam(0xe5e7ea)); addRoof(7, 27, 107, 116, 4, 1.6, lam(0x8d949b));
        addBox(-25, 222, 82, 82.5, 0, 2.2, lam(0xd6d9dc), false);

        // ===== หมู่บ้าน/บ้านเรือนทั่วไปตามซอย (วางอัตโนมัติจากแนวถนน OSM) =====
        autoHouses();
    }
    function fence(poly, gates) {
        const post = lam(0x7fb2d9), panel = lam(0xf2f5f8);
        const y0 = poly[0][1];
        const sides = poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
        sides.forEach((s, si) => {
            const a = s[0], b = s[1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 3);
            for (let k = 0; k < n; k++) {
                const t0 = k / n, t1 = (k + 1) / n;
                const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
                const mx = (p0[0] + p1[0]) / 2;
                if (si === 0 && gates.some((g) => mx > g[0] && mx < g[1])) continue;
                const seg = new THREE.Mesh(G.box, panel);
                const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
                seg.scale.set(len, 1.5, 0.12); seg.position.set(mx, 0.75, -(p0[1] + p1[1]) / 2);
                seg.rotation.y = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); scene.add(seg);
                const pst = new THREE.Mesh(G.box, post); pst.scale.set(0.35, 1.9, 0.35); pst.position.set(p0[0], 0.95, -p0[1]); scene.add(pst);
            }
        });
        // ซุ้มประตูกลาง
        gates.forEach((g) => {
            [g[0], g[1]].forEach((x) => { const p = new THREE.Mesh(G.box, lam(0x2b3442)); p.scale.set(0.5, 3.4, 0.5); p.position.set(x, 1.7, -y0); scene.add(p); });
            const top = new THREE.Mesh(G.box, lam(0x2b3442)); top.scale.set(g[1] - g[0] + 0.6, 0.4, 0.5); top.position.set((g[0] + g[1]) / 2, 3.4, -y0); scene.add(top);
        });
    }
    function autoHouses() {
        const R = rng(42);
        const segs = [];
        D.roads.forEach((r) => { if (r.k !== 'track') for (let k = 1; k < r.p.length; k++) segs.push([r.p[k - 1], r.p[k], r.w]); });
        const avoid = [
            [-160, -40, -100, 82], [-35, 230, -120, 145], [-200, -120, -400, 400], [230, 300, -10, 60],   // พื้นที่ที่วางรายละเอียดเองแล้ว + คลอง
            [-60, 400, -400, -24]   // นาข้าวทิศใต้
        ];
        const roofs = [0x6d7177, 0x8a5a3c, 0x55708f, 0x9a4a3a, 0x7b8086, 0x5c6b4f], walls = [0xe9e3d8, 0xe2dccf, 0xf1ece2, 0xd9d4ca];
        const placed = [];
        D.roads.forEach((r) => {
            if (r.k !== 'lane' && r.k !== 'main') return;
            const L = lineLength(r.p);
            for (let s = 6; s < L - 4; s += 13) {
                const q = along(r.p, s);
                [1, -1].forEach((side) => {
                    if (R() < 0.18) return;
                    const off = r.w / 2 + 7.5;
                    const cx = q.x - q.uy * off * side, cy = q.y + q.ux * off * side;
                    if (Math.hypot(cx, cy) > 350) return;
                    if (avoid.some((a) => cx > a[0] && cx < a[1] && cy > a[2] && cy < a[3])) return;
                    if (canalPts && canalPts.some((c, i) => i && segDist(cx, cy, canalPts[i - 1], c) < 22)) return;
                    if (segs.some((g) => segDist(cx, cy, g[0], g[1]) < g[2] / 2 + 4.5)) return;
                    if (placed.some((p) => Math.hypot(p[0] - cx, p[1] - cy) < 10.5)) return;
                    placed.push([cx, cy]);
                    const w = 7 + R() * 3, d = 8 + R() * 4, ang = Math.atan2(q.uy, q.ux);
                    const grp = new THREE.Group();
                    const h = 3.6 + R() * 3.2;
                    const body = new THREE.Mesh(G.box, lam(walls[(R() * walls.length) | 0])); body.scale.set(w, h, d); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
                    const roof = new THREE.Mesh(G.prism, lam(roofs[(R() * roofs.length) | 0])); roof.scale.set(w * 1.08, 2 + R(), d * 1.06); roof.position.y = h; roof.castShadow = true; grp.add(roof);
                    grp.position.set(cx, 0, -cy); grp.rotation.y = ang + Math.PI / 2;
                    scene.add(grp);
                });
            }
        });
    }
    function signMesh(top, main, wM, hM, bg, fg) {
        const tex = canvasTex(512, Math.round(512 * hM / wM), (g, w, h) => {
            g.fillStyle = bg; g.fillRect(0, 0, w, h);
            g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
            g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = '700 ' + Math.round(h * 0.26) + 'px Sarabun, sans-serif'; g.fillText(top, w / 2, h * 0.33, w - 30);
            g.font = '800 ' + Math.round(h * 0.24) + 'px Sarabun, sans-serif'; g.fillText(main, w / 2, h * 0.7, w - 30);
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
        return m;
    }

    /* ---------- ต้นไม้ ---------- */
    function buildVegetation() {
        const R = rng(7);
        const trees = [], palms = [];
        function scatter(x0, x1, y0, y1, n, s0, s1) {
            for (let k = 0; k < n; k++) {
                const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
                if (Math.hypot(x, y) > 360) continue;
                trees.push([x, y, s0 + R() * (s1 - s0)]);
            }
        }
        scatter(27, 72, 6, 81, 34, 3, 5.5);        // ดงไม้ข้างลานชุมนุม
        scatter(-128, -50, 58, 82, 22, 3, 5);      // ดงไม้เหนือเขตมัสยิด
        scatter(207, 252, 0, 80, 26, 3, 5);
        scatter(96, 160, 32, 56, 10, 2.5, 4.5);
        scatter(-300, -195, -360, 360, 60, 3, 6);  // ฝั่งตะวันตกของคลอง
        scatter(270, 360, 60, 180, 22, 3, 5.5);
        scatter(-40, 0, 145, 175, 10, 3, 5);
        // ===== ซอยคู้คลองสิบ 4 ตามภาพ Street View: ฝั่งใต้เป็นแนวต้นไม้ทึบตลอดซอย · ฝั่งเหนือพ้นรั้วแปลงเลขที่ 42 เป็นป่าละเมาะชิดขอบซอย =====
        const bushes = [];
        if (soiPts) {
            const L = lineLength(soiPts);
            for (let s = 8; s < L; s += 4.5 + R() * 3.5) {
                const q = along(soiPts, s), o1 = 6 + R() * 1.5, o2 = 10.5 + R() * 3;
                trees.push([q.x + q.uy * o1, q.y - q.ux * o1, 2.6 + R() * 1.8]);
                if (R() < 0.8) trees.push([q.x + q.uy * o2, q.y - q.ux * o2, 3 + R() * 2.2]);
                bushes.push([q.x + q.uy * (4.5 + R()), q.y - q.ux * (4.5 + R()), 0.8 + R() * 0.8]);
            }
            for (let s = 72; s < L; s += 4 + R() * 3) {
                const q = along(soiPts, s);
                if (q.x > 84 && q.x < 108) continue;                                  // หน้าร้าน Fatinfurniture
                if (q.x > 112 && q.x < 162) { if (R() < 0.6) bushes.push([q.x - q.uy * 4.6, q.y + q.ux * 4.6, 0.7 + R() * 0.6]); continue; }   // หน้าบ้านเรือน: พุ่มเตี้ย
                const o1 = 5.5 + R() * 1.5, o2 = 10 + R() * 4;
                trees.push([q.x - q.uy * o1, q.y + q.ux * o1, 2.5 + R() * 1.8]);
                if (R() < 0.85) trees.push([q.x - q.uy * o2, q.y + q.ux * o2, 3 + R() * 2]);
                bushes.push([q.x - q.uy * (4.4 + R()), q.y + q.ux * (4.4 + R()), 0.8 + R() * 0.9]);
            }
        }
        // ต้นไม้ในที่ว่างหน้ารั้ว (พื้นที่ชุมนุม) ตามภาพ Street View
        anim.openTrees = [[-15, 1.2, 2.6], [-3, -3.4, 2.3], [19, 3.6, 2.8]];
        anim.openTrees.forEach((t) => trees.push(t));
        // ริมถนนใหญ่ฝั่งตะวันตก (เว้นหน้ามัสยิด/ลานจอดรถ)
        if (mainPts) { const L = lineLength(mainPts); for (let s = 0; s < L; s += 14 + R() * 10) { const q = along(mainPts, s); if (q.y > -30 && q.y < 42) continue; if (R() < 0.55) trees.push([q.x - q.uy * 14, q.y + q.ux * 14, 2.4 + R() * 1.6]); } }
        // ปาล์ม: หัวมุมปากซอย (ตามภาพ Street View) + เขตมัสยิด
        [[-35.5, 3], [-35, 13], [-30, 2.5], [-55, -6], [-56, 30], [-60, 8], [-25, 4.6]].forEach((p) => palms.push(p));

        const canopy = new THREE.InstancedMesh(G.ico, lam(0xffffff, { flatShading: true }), trees.length);
        const trunk = new THREE.InstancedMesh(G.cyl, lam(0x6b4f32), trees.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
        const greens = [0x2f6b3a, 0x3a7d41, 0x2a5e33, 0x4a8a45, 0x356f3b];
        trees.forEach((t, i) => {
            const r = t[2];
            p.set(t[0], r * 0.55 + 2.2, -t[1]); s.set(r, r * 0.9, r); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
            canopy.setMatrixAt(i, m4.compose(p, q, s)); c.setHex(greens[i % greens.length]); canopy.setColorAt(i, c);
            p.set(t[0], 1.3, -t[1]); s.set(0.28, 2.6, 0.28); trunk.setMatrixAt(i, m4.compose(p, q, s));
        });
        canopy.castShadow = true; trunk.castShadow = true;
        scene.add(canopy); scene.add(trunk);
        // พุ่มไม้/พงหญ้าใต้แนวป่าริมซอย
        const bush = new THREE.InstancedMesh(G.ico, lam(0xffffff, { flatShading: true }), bushes.length);
        const bushGreens = [0x4f7f3a, 0x5b8a3f, 0x456f33, 0x6a9346];
        bushes.forEach((b, i) => {
            const r = b[2];
            p.set(b[0], r * 0.45, -b[1]); s.set(r * 1.4, r * 0.75, r * 1.4); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
            bush.setMatrixAt(i, m4.compose(p, q, s)); c.setHex(bushGreens[i % bushGreens.length]); bush.setColorAt(i, c);
        });
        scene.add(bush);

        palms.forEach((pp) => {
            const h = 8 + R() * 3;
            const tr = new THREE.Mesh(G.cyl, lam(0x8b7355)); tr.scale.set(0.32, h, 0.32); tr.position.set(pp[0], h / 2, -pp[1]); tr.castShadow = true; scene.add(tr);
            for (let k = 0; k < 7; k++) {
                const leaf = new THREE.Mesh(G.box, lam(0x3f8a3a)); leaf.scale.set(4.2, 0.12, 0.9);
                const a = k / 7 * Math.PI * 2;
                leaf.position.set(pp[0] + Math.cos(a) * 1.9, h - 0.4, -pp[1] + Math.sin(a) * 1.9);
                leaf.rotation.y = -a; leaf.rotation.z = -0.35; leaf.castShadow = true; scene.add(leaf);
            }
        });
    }

    /* ---------- เสาไฟฟ้า + สายไฟ ---------- */
    function buildPoles() {
        const wires = [];
        const conc = lam(0xbdb9b0), arm = lam(0x8e949b), hl = new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.85 });
        function line(pts, off, every, start, h, highlight, maxR) {
            const P = offsetLine(densify(pts, 2), off), L = lineLength(P), tops = [];
            for (let s = start; s < L; s += every) {
                const q = along(P, s);
                if (Math.hypot(q.x, q.y) > (maxR || 352)) continue;
                const pole = new THREE.Mesh(G.cyl, conc); pole.scale.set(0.2, h, 0.2); pole.position.set(q.x, h / 2, -q.y); pole.castShadow = true; scene.add(pole);
                const ca = new THREE.Mesh(G.box, arm); ca.scale.set(2.6, 0.14, 0.14);
                ca.position.set(q.x, h - 0.6, -q.y); ca.rotation.y = -Math.atan2(-q.ux, q.uy); scene.add(ca);
                if (highlight) {
                    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.6, 20), hl); ring.rotation.x = -Math.PI / 2; ring.position.set(q.x, 0.5, -q.y); scene.add(ring);
                    const band = new THREE.Mesh(G.cyl, hl); band.scale.set(0.24, 0.9, 0.24); band.position.set(q.x, 2.4, -q.y); scene.add(band);
                }
                tops.push({ x: q.x, y: q.y, ux: q.ux, uy: q.uy, h: h - 0.6 });
            }
            for (let k = 1; k < tops.length; k++) {
                const a = tops[k - 1], b = tops[k];
                [-1.15, 0, 1.15].forEach((o) => {
                    const ax = a.x - a.uy * o, ay = a.y + a.ux * o, bx = b.x - b.uy * o, by = b.y + b.ux * o;
                    for (let j = 0; j < 8; j++) {
                        const t0 = j / 8, t1 = (j + 1) / 8, sag = (t) => 0.9 * 4 * t * (1 - t);
                        wires.push(ax + (bx - ax) * t0, a.h + 0.2 - sag(t0), -(ay + (by - ay) * t0), ax + (bx - ax) * t1, a.h + 0.2 - sag(t1), -(ay + (by - ay) * t1));
                    }
                });
            }
            return tops;
        }
        // แนวเสาไฟฟ้าใหม่ (พิพาท): ฝั่งเหนือของซอยคู้คลองสิบ 4 ชิดขอบถนนคอนกรีต ทุก ~40 ม.
        if (soiPts) anim.newPoles = line(soiPts, 3.9, 40, 10, 12, true);
        // แนวเสาเดิมริมถนนคู้-คลองสิบ ทั้งสองฝั่ง
        if (mainPts) { line(mainPts, 7.4, 45, 12, 10, false); line(mainPts, -7.2, 45, 30, 10, false); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
        scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1d232c })));

        // เสาไฟส่องสว่างริมถนนใหญ่ (ใช้ตอนเช้ามืด/โพล้เพล้)
        if (mainPts) {
            const glowTex = canvasTex(64, 64, (gg, w, h) => { const gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.35, 'rgba(255,190,100,0.55)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, w, h); });
            const L = lineLength(mainPts);
            for (let s = 20; s < L; s += 50) {
                const q = along(mainPts, s);
                if (Math.hypot(q.x, q.y) > 350) continue;
                const x = q.x - q.uy * 6.6, y = q.y + q.ux * 6.6;
                const pole = new THREE.Mesh(G.cyl, lam(0x9aa3ad)); pole.scale.set(0.12, 8, 0.12); pole.position.set(x, 4, -y); scene.add(pole);
                const bulb = new THREE.Mesh(G.sph, lam(0xfff1c9, { emissive: 0x000000 })); bulb.scale.set(0.35, 0.25, 0.35); bulb.position.set(x + q.uy * 1.6, 7.9, -(y - q.ux * 1.6)); scene.add(bulb);
                const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
                glow.scale.set(9, 9, 1); glow.position.copy(bulb.position); glow.visible = false; scene.add(glow);
                anim.lampGlows.push({ glow: glow, bulb: bulb });
            }
        }
    }

    /* ---------- เหตุการณ์จำลอง: มวลชน ตำรวจ รถ ---------- */
    // แนวกราฟิกจอรถยนต์ไฟฟ้า: ตัวถังโค้งมนผิวเงา · หลังคา/กระจกดำเงา · ล้อขอบเงิน · เงานุ่มใต้รถ (โมเดลวาดเอง)
    const CARGEO = {}, STD = {};
    function std(hex, rough, metal, o) {
        const key = hex + '|' + rough + '|' + metal + '|' + JSON.stringify(o || {});
        return STD[key] || (STD[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal }, o || {})));
    }
    // รวมจุดที่ซ้อนกัน แล้วคำนวณเวกเตอร์ปกติใหม่ → ผิวเรียบไม่เป็นเหลี่ยม
    function smoothGeo(g) {
        const pos = g.attributes.position, map = new Map(), verts = [], idx = [];
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
            let j = map.get(k); if (j === undefined) { j = verts.length / 3; verts.push(x, y, z); map.set(k, j); } idx.push(j);
        }
        const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); out.setIndex(idx); out.computeVertexNormals();
        g.dispose(); return out;
    }
    // ต่อหลายชิ้นเป็นรูปทรงเดียว (ลดจำนวนการวาด)
    function mergeGeos(list) {
        const P = [], N = [];
        list.forEach((g0) => { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); P.push.apply(P, g.attributes.position.array); N.push.apply(N, g.attributes.normal.array); });
        const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return out;
    }
    function extrudeSide(shape, width, bev) {
        const depth = width - bev * 2;
        const g = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.85, bevelSegments: 4, curveSegments: 12 });
        g.translate(0, 0, -depth / 2); return smoothGeo(g);
    }
    function carGeo(kind) {
        if (CARGEO[kind]) return CARGEO[kind];
        const pickup = kind === 'pickup', van = kind === 'van';
        const lift = pickup ? 0.06 : van ? 0.04 : 0, bl = (pickup ? 1.0 : 0.94) + lift;    // แนวเอว (ขอบล่างกระจก)
        // ตัวถังด้านข้าง (หน้า = +x)
        const body = new THREE.Shape();
        body.moveTo(-2.16, 0.34 + lift); body.lineTo(2.02, 0.34 + lift);
        body.quadraticCurveTo(2.2, 0.36 + lift, 2.2, 0.55 + lift);
        body.quadraticCurveTo(2.18, 0.76 + lift, 1.92, 0.82 + lift);
        body.quadraticCurveTo(1.4, bl - 0.02, 0.95, bl);
        body.lineTo(van ? -2.0 : -1.4, bl);
        body.quadraticCurveTo(-2.05, bl, -2.16, bl - 0.14);
        body.quadraticCurveTo(-2.22, 0.6 + lift, -2.16, 0.34 + lift);
        // ห้องโดยสาร/กระจก (หลังคาดำเงา)
        const gl = new THREE.Shape(), y0 = bl - 0.05;
        if (van) {
            gl.moveTo(-2.06, y0); gl.lineTo(1.22, y0); gl.quadraticCurveTo(0.85, 1.52, 0.25, 1.68); gl.quadraticCurveTo(-1.2, 1.74, -1.85, 1.66); gl.quadraticCurveTo(-2.1, 1.55, -2.06, y0);
        } else if (pickup) {
            gl.moveTo(-0.62, y0); gl.lineTo(0.98, y0); gl.quadraticCurveTo(0.6, 1.42, 0.12, 1.52); gl.lineTo(-0.48, 1.53); gl.quadraticCurveTo(-0.64, 1.48, -0.62, y0);
        } else {
            gl.moveTo(-1.48, y0); gl.lineTo(1.02, y0); gl.quadraticCurveTo(0.56, 1.32, 0.04, 1.4); gl.quadraticCurveTo(-0.82, 1.44, -1.22, 1.2); gl.quadraticCurveTo(-1.48, 1.05, -1.48, y0);
        }
        // ล้อ 4 ล้อ (ยาง + ดุมเงิน) รวมเป็น 2 รูปทรง
        const r = pickup ? 0.39 : 0.36, wx = pickup ? 1.45 : 1.42, wz = 0.78, tires = [], rims = [];
        [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].forEach((w) => {
            const t = new THREE.CylinderGeometry(r, r, 0.26, 20); t.rotateX(Math.PI / 2); t.translate(w[0], r, w[1]); tires.push(t);
            const m = new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.275, 16); m.rotateX(Math.PI / 2); m.translate(w[0], r, w[1]); rims.push(m);
        });
        const out = { body: extrudeSide(body, 1.8, 0.17), glass: extrudeSide(gl, 1.56, 0.1), tires: mergeGeos(tires), rims: mergeGeos(rims), roof: van ? 1.8 : pickup ? 1.62 : 1.5, bl: bl };
        if (pickup) { const bed = new THREE.BoxGeometry(1.5, 0.05, 1.3); bed.translate(-1.38, bl + 0.13, 0); out.bed = bed; }
        return (CARGEO[kind] = out);
    }
    let shadowTex = null;
    function carShadowTex() {
        return shadowTex || (shadowTex = canvasTex(128, 64, (g, w, h) => {
            const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
            gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.save(); g.scale(1, h / w); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.restore();
        }));
    }
    function car(color, kind) {
        const g = new THREE.Group(), G2 = carGeo(kind === 'pickup' || kind === 'van' ? kind : 'sedan');
        const paint = std(color, 0.26, 0.15), glass = std(0x07090d, 0.12, 0.65);
        const body = new THREE.Mesh(G2.body, paint); body.castShadow = true; g.add(body);
        const cab = new THREE.Mesh(G2.glass, glass); cab.castShadow = true; g.add(cab);
        g.add(new THREE.Mesh(G2.tires, std(0x16181c, 0.75, 0)));
        g.add(new THREE.Mesh(G2.rims, std(0xc7ccd3, 0.3, 0.7)));
        if (G2.bed) g.add(new THREE.Mesh(G2.bed, std(0x22272e, 0.8, 0)));
        const hl = new THREE.Mesh(G.box, lam(0xfff6d8, { emissive: 0x000000 })); hl.scale.set(0.05, 0.07, 1.3); hl.position.set(2.31, 0.74, 0); g.add(hl);
        anim.headlights.push(hl);
        const tl = new THREE.Mesh(G.box, lam(0xc81e2a)); tl.scale.set(0.05, 0.07, 1.3); tl.position.set(-2.31, G2.bl - 0.16, 0); g.add(tl);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.7), new THREE.MeshBasicMaterial({ map: carShadowTex(), transparent: true, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.renderOrder = -1; g.add(sh);
        g.userData.roof = G2.roof;
        return g;
    }
    // รถการไฟฟ้า (กฟน.) สีส้ม หัวเก๋งทรงหัวตัด ตามภาพถ่ายหน้างาน — kind: 'crane' รถเครน/กระเช้ายก · 'bucket' รถกระเช้าแขนพับ (raised = ยกกระเช้าทำงาน)
    let meaTex = null;
    function meaTruck(kind, raised) {
        const g = new THREE.Group(), orange = std(0xf2761b, 0.34, 0.15), dark = std(0x23272d, 0.8, 0), glassM = std(0x07090d, 0.12, 0.65), white = std(0xf2f4f7, 0.4, 0.05);
        const box = (mat, sx, sy, sz, x, y, z, rz) => { const m = new THREE.Mesh(G.box, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); if (rz) m.rotation.z = rz; m.castShadow = true; g.add(m); return m; };
        const dbl = kind === 'bucket', cx0 = dbl ? 0.9 : 2.0;               // รถกระเช้า = หัวเก๋งแค็บคู่
        // หัวเก๋ง (ขอบโค้งมน) + กระจก
        const cab = new THREE.Shape();
        cab.moveTo(cx0, 0.85); cab.lineTo(3.52, 0.85); cab.lineTo(3.58, 2.3); cab.quadraticCurveTo(3.58, 2.78, 3.15, 2.8); cab.lineTo(cx0, 2.8); cab.lineTo(cx0, 0.85);
        const cm = new THREE.Mesh(extrudeSide(cab, 2.3, 0.12), orange); cm.castShadow = true; g.add(cm);
        box(glassM, 0.06, 0.72, 2.02, 3.62, 2.1, 0);                         // กระจกหน้า
        [1.16, -1.16].forEach((z) => { box(glassM, dbl ? 2.2 : 1.05, 0.62, 0.05, (cx0 + 3.3) / 2 + 0.15, 2.15, z); });   // กระจกข้าง
        box(dark, 0.14, 0.32, 2.3, 3.62, 0.95, 0);                           // กันชน
        [0.78, -0.78].forEach((z) => box(lam(0xfff6d8, { emissive: 0x000000 }), 0.05, 0.16, 0.36, 3.63, 1.25, z));       // ไฟหน้า
        [0.6, 0, -0.6].forEach((z, i) => box(new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffb000 : 0x22c55e }), 0.22, 0.12, 0.22, 3.0, 2.92, z));   // ไฟบนหลังคา
        // ตัวอักษร กฟน. ข้างประตู
        meaTex = meaTex || canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#ffffff'; c.font = '800 54px Sarabun, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('กฟน. MEA', w / 2, h / 2 + 2, w - 12); });
        [1, -1].forEach((sd) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.43), new THREE.MeshBasicMaterial({ map: meaTex, transparent: true })); d.position.set(cx0 + 0.75, 1.45, sd * 1.19); if (sd < 0) d.rotation.y = Math.PI; g.add(d); });
        // แชสซีและล้อ (หน้าเดี่ยว หลังคู่)
        box(dark, 6.6, 0.28, 1.1, -0.2, 0.72, 0);
        const r = 0.5, tires = [], rims = [];
        [[2.7, 0.92, 0.32], [2.7, -0.92, 0.32], [-1.8, 0.86, 0.56], [-1.8, -0.86, 0.56]].forEach((w) => {
            const t = new THREE.CylinderGeometry(r, r, w[2], 20); t.rotateX(Math.PI / 2); t.translate(w[0], r, w[1]); tires.push(t);
            const m = new THREE.CylinderGeometry(r * 0.55, r * 0.55, w[2] + 0.02, 14); m.rotateX(Math.PI / 2); m.translate(w[0], r, w[1]); rims.push(m);
        });
        g.add(new THREE.Mesh(mergeGeos(tires), std(0x16181c, 0.75, 0)));
        g.add(new THREE.Mesh(mergeGeos(rims), std(0xc7ccd3, 0.3, 0.7)));
        if (kind === 'crane') {
            // กระบะพื้นเรียบ + เสาเครนหลังหัวเก๋ง + แขนเครนพาดไปท้ายรถ (ภาพที่ 1)
            box(orange, 5.0, 0.22, 2.3, -0.75, 1.0, 0);
            [1.12, -1.12].forEach((z) => box(orange, 4.9, 0.32, 0.08, -0.75, 1.27, z));
            box(orange, 0.55, 2.3, 0.7, 1.55, 2.2, 0);                       // เสาเครน
            box(orange, 0.8, 0.45, 1.0, 1.55, 3.4, 0);                        // หัวหมุน
            box(orange, 5.4, 0.38, 0.42, -1.05, 3.35, 0, -0.05);              // แขนเครน
            box(orange, 0.32, 1.9, 0.32, -3.3, 2.3, 0.75); box(orange, 0.32, 1.9, 0.32, -3.3, 2.3, -0.75);   // โครงพักแขนท้ายรถ
            box(orange, 0.3, 0.3, 1.8, -3.3, 3.15, 0);
            [1.0, -1.0].forEach((z) => box(dark, 0.3, 0.55, 0.3, 1.2, 0.5, z * 1.2));                       // ขาค้ำ
        } else {
            // ตู้เครื่องมือ 2 ข้าง + ฐานบูม + แขนพับ + กระเช้า (ภาพที่ 3)
            [0.84, -0.84].forEach((z) => { box(orange, 3.9, 1.25, 0.62, -1.15, 1.55, z); box(white, 3.9, 0.06, 0.64, -1.15, 1.7, z); });
            box(orange, 3.9, 0.12, 1.1, -1.15, 1.0, 0);
            box(orange, 0.9, 0.9, 0.9, -2.5, 2.55, 0);                        // ฐานหมุนบูม
            if (raised) {
                const a1 = box(orange, 6.2, 0.42, 0.42, -2.5 + Math.cos(1.0) * 3.1, 2.8 + Math.sin(1.0) * 3.1, 0, 1.0);   // แขนยกขึ้นทำงาน
                box(std(0xffd400, 0.4, 0.05), 1.0, 1.0, 1.0, -2.5 + Math.cos(1.0) * 6.2, 2.8 + Math.sin(1.0) * 6.2 + 0.55, 0);
                a1.castShadow = true;
            } else {
                box(orange, 5.6, 0.36, 0.38, 0.2, 3.25, 0.25, 0.04);           // แขนล่างพาดเหนือหัวเก๋ง
                box(orange, 4.4, 0.3, 0.32, -0.6, 3.62, -0.2, -0.03);          // แขนบนพับกลับ
                box(std(0xf9a03f, 0.4, 0.05), 0.9, 0.85, 0.9, -2.9, 3.55, -0.2); // กระเช้า
            }
        }
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 3.4), new THREE.MeshBasicMaterial({ map: carShadowTex(), transparent: true, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.renderOrder = -1; g.add(sh);
        return g;
    }
    function placeCar(g, x, y, headingDeg) { g.position.set(x, 0, -y); g.rotation.y = headingDeg * Math.PI / 180; scene.add(g); return g; }
    function personMats() { return { body: std(0xffffff, 0.6, 0.02), head: std(0xffffff, 0.55, 0.02) }; }
    // หุ่นคนแนวกราฟิกจอรถ: สูง ~1.78 ม. หันหน้า +z · ศีรษะแยกชิ้น (ใช้แนวทางเดิมของฉาก)
    function personBodyGeo() {
        const parts = [];
        const prof = [[0.001, 0.86], [0.15, 0.88], [0.168, 0.98], [0.142, 1.12], [0.17, 1.3], [0.205, 1.41], [0.165, 1.48], [0.06, 1.52], [0.001, 1.52]].map((q) => new THREE.Vector2(q[0], q[1]));
        const torso = new THREE.LatheGeometry(prof, 12); torso.scale(1, 1, 0.62); parts.push(torso);
        const neck = new THREE.CylinderGeometry(0.045, 0.052, 0.12, 8); neck.translate(0, 1.56, 0); parts.push(neck);
        [[-0.088, 0.15], [0.088, -0.15]].forEach((q) => {   // ขา (ซ้ายก้าวหลัง ขวาก้าวหน้า)
            const leg = new THREE.CylinderGeometry(0.078, 0.05, 0.88, 8); leg.translate(0, -0.44, 0); leg.rotateX(q[1]); leg.translate(q[0], 0.9, 0); parts.push(leg);
            const foot = new THREE.SphereGeometry(0.06, 8, 5); foot.scale(1, 0.6, 1.8); foot.translate(0, -0.86, 0.05); foot.rotateX(q[1]); foot.translate(q[0], 0.9, 0); parts.push(foot);
        });
        [[-0.218, -0.2], [0.218, 0.2]].forEach((q) => {    // แขนแกว่งสวนขา
            const arm = new THREE.CylinderGeometry(0.05, 0.036, 0.66, 8); arm.translate(0, -0.33, 0); arm.rotateZ(q[0] < 0 ? -0.07 : 0.07); arm.rotateX(q[1]); arm.translate(q[0], 1.45, 0); parts.push(arm);
        });
        return mergeGeos(parts);
    }
    function personHeadGeo() { const h = new THREE.SphereGeometry(0.118, 14, 10); h.scale(0.92, 1.12, 1); h.translate(0, 1.7, 0); return h; }
    function buildEventScene() {
        const R = rng(2811);
        const grp = new THREE.Group(); scene.add(grp); anim.crowdGroup = grp;
        // ---- มวลชน 500 ตำแหน่ง (แสดงตามจำนวนที่เลือก · คนลำดับแรกอยู่กลางลาน จำนวนมากขึ้นจึงขยายออกและล้นลงผิวซอย) ----
        const bodyGeo = personBodyGeo(), headGeo = personHeadGeo();
        const pm = personMats();
        const crowd = new THREE.InstancedMesh(bodyGeo, pm.body, MAX_CROWD), heads = new THREE.InstancedMesh(headGeo, pm.head, MAX_CROWD);
        const tones = [0xa9b2bc, 0xb7bfc8, 0x9ca6b1, 0xc4cbd3, 0x929ca8, 0xb0b8c1];   // หุ่นสีเทาไล่เฉดเล็กน้อย ให้มองเป็นกลุ่มคนได้ชัด
        const c = new THREE.Color();
        // ตารางช่อง 1 ม. ไว้ตรวจระยะห่างระหว่างคน (เร็วพอสำหรับ 500 คนบนมือถือ)
        const cells = new Map(), cellKey = (x, y) => Math.floor(x) + ',' + Math.floor(y);
        const occupy = (x, y) => { const k = cellKey(x, y); (cells.get(k) || cells.set(k, []).get(k)).push([x, y]); };
        const clear = (x, y, d) => {
            for (let gx = Math.floor(x - d); gx <= Math.floor(x + d); gx++) for (let gy = Math.floor(y - d); gy <= Math.floor(y + d); gy++) {
                const list = cells.get(gx + ',' + gy); if (list && list.some((q) => Math.hypot(q[0] - x, q[1] - y) < d)) return false;
            }
            return true;
        };
        for (let k = 0; k < 12; k++) occupy(-14 + k * 2.9, -7.6);                     // แนว คฝ. ริมซอย
        const blocked = (x, y) => (x > -30.8 && x < -25.2 && y > -5.6 && y < -2.8) ||  // รถสายตรวจปลายลาน
            (anim.openTrees || []).some((t) => Math.hypot(t[0] - x, t[1] - y) < 1.1);
        for (let i = 0; i < MAX_CROWD; i++) {
            const sx = 9 + i * 0.026, sy = 2.3 + i * 0.005;
            let x = 4, y = 0, ok = false;
            for (let tries = 0; tries < 60 && !ok; tries++) {            // ลานหน้ารั้ว (พื้นที่ชุมนุม)
                const u = Math.max(1e-6, R()), v = R(), rad = Math.sqrt(-2 * Math.log(u));
                x = 3 + rad * Math.cos(6.283 * v) * sx; y = 0 + rad * Math.sin(6.283 * v) * sy;
                ok = x > -31 && x < 26 && y > -6 && y < 5.2 && !blocked(x, y) && clear(x, y, 0.6);
            }
            for (let tries = 0; tries < 80 && !ok; tries++) {            // ลานเต็ม → ล้นลงผิวซอย (พฤติการณ์ปิดกั้นทางสาธารณะ)
                x = -30 + R() * 56; y = -12.4 + R() * 6.2;
                ok = !blocked(x, y) && clear(x, y, 0.6);
            }
            occupy(x, y);
            anim.crowdBase.push({ x: x, y: y, ph: R() * 6.28, rate: 1.2 + R() * 1.6, rot: Math.atan2(4 - y, 1 - x) + (R() - 0.5) * 0.8 });
            c.setHex(tones[(R() * tones.length) | 0]); crowd.setColorAt(i, c); heads.setColorAt(i, c);
        }
        crowd.castShadow = true; heads.castShadow = true;
        grp.add(crowd); grp.add(heads); anim.crowd = crowd; anim.heads = heads;
        // ป้ายคัดค้านในมือผู้ชุมนุม
        const texts = ['ไม่เอาเสาไฟแนวใหม่', 'หยุดจั้มไฟ!', 'ชุมชนลำเจดีย์', 'ขอความเป็นธรรม', 'กฟน. ต้องชี้แจง', 'เสาไฟกีดขวางทาง'];
        const signTex = texts.map((t, i) => canvasTex(256, 140, (g, w, h) => {
            g.fillStyle = ['#fff6d5', '#ffffff', '#ffe08a', '#ffffff', '#fff1f0', '#e9f7ff'][i]; g.fillRect(0, 0, w, h);
            g.strokeStyle = '#b91c1c'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
            g.fillStyle = i % 2 ? '#b91c1c' : '#102340'; g.font = '800 36px Sarabun, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2, w - 20);
        }));
        for (let k = 0; k < 16; k++) {
            const idx = 3 + k * 17, b = anim.crowdBase[idx];
            const sg = new THREE.Group();
            const stick = new THREE.Mesh(G.box, lam(0x8b6b45)); stick.scale.set(0.05, 1.1, 0.05); stick.position.y = 1.9; sg.add(stick);
            const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.63), new THREE.MeshBasicMaterial({ map: signTex[k % signTex.length], side: THREE.DoubleSide })); pl.position.y = 2.55; sg.add(pl);
            sg.position.set(b.x + 0.25, 0, -b.y); sg.rotation.y = Math.PI + (R() - 0.5) * 0.6;
            grp.add(sg); anim.signs.push({ g: sg, idx: idx });
        }
        // ป้ายผ้าขนาดใหญ่หันออกถนน (ทิศใต้)
        const banTex = canvasTex(1024, 220, (g, w, h) => {
            g.fillStyle = '#fff8e1'; g.fillRect(0, 0, w, h); g.fillStyle = '#b91c1c'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
            g.fillStyle = '#102340'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = '800 64px Sarabun, sans-serif'; g.fillText('ชุมชนลำเจดีย์ คัดค้านการปักเสาไฟฟ้าแนวใหม่', w / 2, 82, w - 40);
            g.fillStyle = '#b91c1c'; g.font = '800 52px Sarabun, sans-serif'; g.fillText('ยับยั้งการจั้มไฟ · ขอให้การไฟฟ้าชี้แจง', w / 2, 152, w - 40);
        });
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.95), new THREE.MeshBasicMaterial({ map: banTex, side: THREE.DoubleSide }));
        banner.position.set(4, 2.6, 5.6); grp.add(banner);
        [-0.6, 8.6].forEach((x) => { const p = new THREE.Mesh(G.cyl, lam(0x8b6b45)); p.scale.set(0.07, 3.6, 0.07); p.position.set(x, 1.8, 5.6); grp.add(p); });
        // ผู้จัดถือโทรโข่ง (ยืนหน้าป้ายผ้า หันหาผู้ชุมนุม)
        const leader = new THREE.Group();
        const lb = new THREE.Mesh(bodyGeo, std(0xe6eaef, 0.55, 0.02)); lb.castShadow = true; leader.add(lb);
        const lh = new THREE.Mesh(headGeo, std(0xe6eaef, 0.5, 0.02)); leader.add(lh);
        const mega = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.06, 0.5, 12, 1, true), std(0xf2f4f7, 0.35, 0.1, { side: THREE.DoubleSide })); mega.rotation.x = Math.PI / 2; mega.position.set(0, 1.62, 0.32); leader.add(mega);
        leader.position.set(4, 0, -4.4); leader.rotation.y = 0; grp.add(leader); anim.leader = leader;

        // ---- รถผู้ชุมนุม ~10 คัน ----
        const cc = [0xf3f5f8, 0x1c1f24, 0xc5cad1, 0xe9ecf0, 0xc0182c, 0x8d949c, 0xf7f8fa, 0x4b5159, 0xffffff, 0xa1162a];
        const kinds = ['pickup', 'sedan', 'pickup', 'van', 'pickup', 'sedan', 'pickup', 'sedan', 'pickup', 'van'];
        // จอดที่ลานจอดรถมัสยิดฝั่งตะวันตกของถนนคู้-คลองสิบ (ริมซอยฝั่งตะวันออกเป็นแนวต้นไม้/ป่า จอดไม่ได้) — จอดตั้งฉาก 2 แถว แถวละ 5 คัน
        [-75, -72, -69, -66, -63].forEach((x, i) => {
            placeCar(car(cc[i], kinds[i]), x, -3.2, 90);
            placeCar(car(cc[5 + i], kinds[5 + i]), x, 8.6, 270);
        });
        // ---- ลานไหล่ทางคอนกรีตริมถนนใหญ่ เฉพาะช่วงใต้ปากทางถนนภายในมัสยิด (กว้าง ~7 ม. · ปากทางและทางเข้าลานจอดโล่ง)
        //      รถเครน + รถกระเช้า จอดเรียงหน้า-หลังขนานถนนใหญ่ หัวรถหันขึ้นเหนือเข้าหาถนนภายในมัสยิด (ตามภาพถ่ายจากปากซอยฝั่งจุดชุมนุม: รถเยื้องซ้ายของทางเข้า) ----
        const APRON_H = 0.22, ay0 = -32, ay1 = -12.2;
        const ap = new THREE.Shape([new THREE.Vector2(mainX(ay0) - 6.1, ay0), new THREE.Vector2(mainX(ay1) - 6.1, ay1), new THREE.Vector2(mainX(ay1) - 13.2, ay1), new THREE.Vector2(mainX(ay0) - 13.2, ay0)]);
        const apG = new THREE.ExtrudeGeometry(ap, { depth: APRON_H, bevelEnabled: false }); apG.rotateX(-Math.PI / 2);
        const apron = new THREE.Mesh(apG, lam(0xb7b8b1)); apron.receiveShadow = true; scene.add(apron);
        const roadHead = Math.atan2(1, mainX(1) - mainX(0)) * 180 / Math.PI;   // ขนานถนนใหญ่ หัวรถขึ้นเหนือ
        [['bucket', -16.4], ['crane', -26]].forEach((t) => {
            const g = placeCar(meaTruck(t[0]), mainX(t[1]) - 8.2, t[1], roadHead); g.position.y = APRON_H;
        });

        // ---- ตำรวจ คฝ. สน.ลำหิน 1 หมู่ (12 นาย) แนวริมซอยหันหาผู้ชุมนุม ----
        const pol = new THREE.InstancedMesh(bodyGeo, std(0x23365e, 0.55, 0.05), 12), helm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 12, 8).translate(0, 1.73, 0), std(0xeef1f5, 0.3, 0.1), 12);
        const shield = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 1.05, 0.04).translate(0, 0.95, 0.34), std(0xbfe0ff, 0.15, 0.1, { transparent: true, opacity: 0.5 }), 12);
        const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3();
        for (let i = 0; i < 12; i++) {
            pp.set(-14 + i * 2.9, 0, 7.6); qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
            m4.compose(pp, qq, one); pol.setMatrixAt(i, m4); helm.setMatrixAt(i, m4); shield.setMatrixAt(i, m4);
        }
        pol.castShadow = true; scene.add(pol); scene.add(helm); scene.add(shield);

        // ---- รถสายตรวจ 2 คัน + ไฟวับวาบ ----
        [[-28, -4.2, 0], [-55.5, -1, 90]].forEach((p) => {
            const g = car(0xf4f6f8, 'sedan');
            const stripe = new THREE.Mesh(G.box, std(0x1f3a7a, 0.4, 0.1)); stripe.scale.set(3.9, 0.12, 1.84); stripe.position.set(-0.05, 0.64, 0); g.add(stripe);
            const r = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xff2a2a })); r.scale.set(0.3, 0.12, 0.55); r.position.set(-0.3, g.userData.roof + 0.04, 0.32); g.add(r);
            const b = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0x2a6bff })); b.scale.set(0.3, 0.12, 0.55); b.position.set(-0.3, g.userData.roof + 0.04, -0.32); g.add(b);
            anim.bars.push([r, b]); placeCar(g, p[0], p[1], p[2]);
        });
        // ---- จุด ศปก.ส่วนหน้า (เต็นท์) ----
        const tent = new THREE.Group();
        const tTop = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.8, 4), lam(0xf8fafc)); tTop.position.y = 3.3; tTop.rotation.y = Math.PI / 4; tTop.castShadow = true; tent.add(tTop);
        [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]].forEach((q) => { const l = new THREE.Mesh(G.cyl, lam(0x9aa3ad)); l.scale.set(0.07, 2.5, 0.07); l.position.set(q[0], 1.25, q[1]); tent.add(l); });
        const table = new THREE.Mesh(G.box, lam(0x6b4f32)); table.scale.set(2.4, 0.8, 1); table.position.y = 0.4; tent.add(table);
        tent.position.set(-57.5, 0, -15.5); scene.add(tent);   // ศปก.ส่วนหน้า: ลานจอดรถมัสยิดติดถนนใหญ่ มองเห็นจุดชุมนุมฝั่งตรงข้าม
        // ---- จุดจราจรที่แยก + กรวย ----
        const tp = new THREE.Mesh(bodyGeo, std(0xd4ff3a, 0.5, 0.02)); tp.position.set(-44, 0.3, 9); tp.castShadow = true; scene.add(tp);
        const tph = new THREE.Mesh(headGeo, std(0xeef1f5, 0.3, 0.1)); tph.position.set(-44, 0.3, 9); scene.add(tph);
        for (let k = 0; k < 6; k++) { const cn = new THREE.Mesh(G.cone, lam(0xff6b1a)); cn.scale.set(0.25, 0.7, 0.25); cn.position.set(-40.5 + k * 1.6, 0.7, 13.5 - k * 0.2); scene.add(cn); }
        // ---- รถกระเช้า กฟน. ที่แนวเสาใหม่ (~100 ม. จากปากซอย) ----
        const mea = meaTruck('bucket', true);
        const meaAt = soiPts ? along(soiPts, 150) : { x: 108, y: -13, ux: 1, uy: 0 };
        mea.position.set(meaAt.x, 0.3, -(meaAt.y + 0.6)); mea.rotation.y = Math.atan2(meaAt.uy, meaAt.ux);
        scene.add(mea); anim.meaAt = meaAt;
        // ---- รถวิ่งบนถนนใหญ่ (มีชีวิตชีวา) ----
        if (mainPts) {
            const L = lineLength(mainPts);
            [[0x1c1f24, 1, 0.1], [0xe9ecf0, -1, 0.45], [0xc0182c, 1, 0.7], [0xc5cad1, -1, 0.9]].forEach((t) => {
                const g = car(t[0], t[0] === 0xe9ecf0 ? 'pickup' : 'sedan'); scene.add(g);
                anim.traffic.push({ g: g, dir: t[1], s: t[2] * L, L: L, speed: 9 + Math.random() * 3 });
            });
        }
        // ---- หมุดจุดชุมนุม + วงพัลส์ ----
        anim.pinMat = new THREE.MeshLambertMaterial({ color: 0xD4AF37, emissive: 0x3a2a00 });
        const pin = new THREE.Group();
        const pc = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.2, 18), anim.pinMat); pc.rotation.x = Math.PI; pc.position.y = 10.2; pin.add(pc);
        const ps = new THREE.Mesh(new THREE.SphereGeometry(1.9, 18, 12), anim.pinMat); ps.position.y = 13; pin.add(ps);
        const pole = new THREE.Mesh(G.cyl, new THREE.MeshBasicMaterial({ color: 0xffffff })); pole.scale.set(0.06, 8, 0.06); pole.position.y = 4; pin.add(pole);
        scene.add(pin); anim.pin = pin;
        anim.pulseMat = new THREE.MeshBasicMaterial({ color: 0x16A34A, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
        const pulse = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), anim.pulseMat); pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.6; scene.add(pulse); anim.pulse = pulse;
        // ---- ตัวอย่างขอบเขตพื้นที่ควบคุม ม.23 (แสดงเมื่อระดับสีแดง) ----
        const zone = new THREE.Group();
        const zf = new THREE.Mesh(new THREE.CircleGeometry(70, 64), new THREE.MeshBasicMaterial({ color: 0xDC2626, transparent: true, opacity: 0.13, depthWrite: false })); zf.rotation.x = -Math.PI / 2; zf.position.y = 0.7; zone.add(zf);
        const zr = new THREE.Mesh(new THREE.RingGeometry(69, 70.5, 96), new THREE.MeshBasicMaterial({ color: 0xDC2626, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); zr.rotation.x = -Math.PI / 2; zr.position.y = 0.72; zone.add(zr);
        zone.position.set(4, 0, 0); zone.visible = false; scene.add(zone); anim.zone = zone;
    }

    /* ---------- วงรัศมี 100/200/300 ม. ---------- */
    function buildRings() {
        [100, 200, 300].forEach((r) => {
            const pts = []; for (let k = 0; k <= 128; k++) { const a = k / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 1.2, Math.sin(a) * r)); }
            const g = new THREE.BufferGeometry().setFromPoints(pts);
            const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xD4AF37, dashSize: 6, gapSize: 5, transparent: true, opacity: 0.9 }));
            l.computeLineDistances(); scene.add(l);
        });
    }

    /* ---------- ป้ายชื่อ (HTML ซ้อนบนฉาก ตัวอักษรคมชัด) ---------- */
    function addLabel(text, sub, x, y, h, cls, maxD) {
        const el = document.createElement('div');
        el.className = 'm3-lb ' + (cls || '');
        el.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '');
        ui.labelsLayer.appendChild(el);
        const L = { el: el, v: V(x, y, h), cls: cls || '', maxD: maxD || 1e9, shown: false };
        labels.push(L); return L;
    }
    function buildLabels() {
        const mainAt = (yy) => [mainX(yy), yy];
        const m1 = mainAt(-180), m2 = mainAt(170);
        addLabel('ถนนคู้-คลองสิบ', '', m1[0], m1[1], 2, 'road');
        addLabel('ถนนคู้-คลองสิบ', '↑ ไป สน.ลำหิน', m2[0], m2[1], 2, 'road');
        if (soiPts) { const q = along(soiPts, 210); addLabel('ซอยคู้คลองสิบ 4', 'ถนนคอนกรีต', q.x, q.y, 2, 'road'); }
        if (canalPts) { addLabel('คลองลำหิน', '', -166, 200, 2, 'water'); addLabel('คลองลำหิน', '', -212, -200, 2, 'water'); }
        addLabel('ซอยคู้-คลองสิบ 7', '', -120, 229, 2, 'road', 700);
        addLabel('หมู่บ้านกิตติชัยวิลล่า 3', '', 180, 250, 3, '', 700);
        addLabel('จุดชุมนุม', LAT.toFixed(6) + ', ' + LON.toFixed(6), 0, 0, 16.5, 'key');
        addLabel('มัสยิด ดารุ้ลมุกร้อดรอบีน (ลำหิน)', 'สุเหร่าลำหิน', -104, 18, 25, '', 900);
        addLabel('โรงเรียนอัลนะฮ์ฎ่อตุ้ลอิสลามียะห์', '', -118, 47, 16, '', 520);
        addLabel('ศพด. ดารุ้ลมุกร้อดรอบีน (ลำหิน)', '', -78, 34, 13, '', 380);
        addLabel('ศูนย์ดิจิทัลชุมชนมัสยิด', '', -135, 73, 8, '', 380);
        addLabel('Land Biz โกดังคู้คลองสิบ หนองจอก', 'คลังสินค้า', 187, 103, 13, '', 700);
        addLabel('PK เฟอร์นิเจอร์ สาขา 1', 'ร้านขายเครื่องใช้ในบ้าน', 258, 10, 10, '', 600);
        addLabel('Fatinfurniture', 'ร้านเฟอร์นิเจอร์', 96, -2, 9, '', 300);
        addLabel('ร้านไก่สดราคาส่ง-ไก่ตกพริกแกง', '', 84, 25, 9, '', 300);
        addLabel('บ้านเลขที่ 42 ซอยคู้คลองสิบ 4', 'ลานโล่งมีรั้ว', -2, 45, 5, '', 300);
        addLabel('นาข้าว', '', 160, -70, 2, 'field', 800);
        addLabel('นาข้าว', '', -110, -50, 2, 'field', 600);
        if (anim.newPoles && anim.newPoles.length) { const p = anim.newPoles[Math.min(4, anim.newPoles.length - 1)]; addLabel('แนวเสาใหม่ (พิพาท)', 'ยาว ~600 ม.', p.x, p.y, 14.5, 'pole', 1200); }
        if (anim.meaAt) addLabel('รถกระเช้า กฟน. (จุดจั้มไฟ)', '', anim.meaAt.x, anim.meaAt.y, 12.5, 'mea', 360);
        addLabel('คฝ. สน.ลำหิน 1 หมู่', '', 2, -7.6, 3.6, 'police', 260);
        addLabel('รถสายตรวจ', '', -28, -4.2, 3.4, 'police', 200);
        addLabel('ศปก.ส่วนหน้า', 'ลานจอดรถมัสยิด', -57.5, 15.5, 5.5, 'police', 320);
        addLabel('จุดจราจร', '', -44, -9, 3.2, 'police', 220);
        addLabel('รถผู้ชุมนุม ~10 คัน', 'จอดลานจอดรถมัสยิด', -69, 2.7, 3.4, '', 320);
        addLabel('รถ กฟน. 2 คัน', 'ไหล่ทางใต้ปากทางเข้ามัสยิด', mainX(-21) - 8.2, -21, 4.8, '', 320);
        anim.crowdLabel = addLabel('มวลชนจำลอง ' + crowdN + ' คน', '', 4, 1, 4.2, '', 240);
        addLabel('↗ สน.ลำหิน 2.8 กม.', 'คฝ. 1 หมวด สแตนด์บาย', m2[0] + 18, Math.min(330, m2[1] + 150), 4, 'dir');
        [100, 200, 300].forEach((r) => addLabel(r + ' ม.', '', r * 0.707, -r * 0.707, 2, 'ring'));
        anim.zoneLabel = addLabel('ตัวอย่างขอบเขตพื้นที่ควบคุม (ม.23)', 'แสดงเมื่อระดับสีแดง', 4, -70, 3, 'zone');
    }
    const _v = new THREE.Vector3();
    function updateLabels(force) {
        if (!camera || !renderer) return;
        const w = ui.stage.clientWidth, h = ui.stage.clientHeight;
        labels.forEach((L) => {
            let show = (labelsOn || L.cls === 'key') && cam.dist <= L.maxD;
            if (L === anim.zoneLabel) show = show && anim.zone && anim.zone.visible;
            if (show) {
                _v.copy(L.v).project(camera);
                if (_v.z > 1 || _v.x < -1.15 || _v.x > 1.15 || _v.y < -1.15 || _v.y > 1.15) show = false;
                else L.el.style.transform = 'translate(' + ((_v.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - _v.y) / 2 * h).toFixed(1) + 'px) translate(-50%,-100%)';
            }
            if (show !== L.shown || force) { L.el.classList.toggle('hide', !show); L.shown = show; }
        });
        // เข็มทิศ + มาตราส่วน
        ui.needle.style.transform = 'rotate(' + (cam.az * 180 / Math.PI).toFixed(1) + 'deg)';
        const tl = ui.tilt && ui.tilt.firstChild, tv = want.pol > 0.35 ? '2D' : '3D';
        if (tl && tl.textContent !== tv) tl.textContent = tv;
        const right = new THREE.Vector3(Math.cos(cam.az), 0, -Math.sin(cam.az));
        const a = new THREE.Vector3(cam.tx, 0, cam.tz).project(camera), b = new THREE.Vector3(cam.tx + right.x * 50, 0, cam.tz + right.z * 50).project(camera);
        const pxPer50 = Math.abs(b.x - a.x) / 2 * w;
        if (pxPer50 > 0.5) {
            const mPerPx = 50 / pxPer50, target = mPerPx * 90;
            const nice = [5, 10, 20, 25, 50, 100, 150, 200, 300, 500].reduce((best, n) => Math.abs(n - target) < Math.abs(best - target) ? n : best, 50);
            ui.scale.querySelector('span').textContent = nice + ' ม.';
            ui.scale.querySelector('i').style.width = (nice / mPerPx).toFixed(0) + 'px';
        }
    }

    /* ---------- กล้อง + การควบคุม ---------- */
    function fitDist() { const a = camera ? camera.aspect : 1.5; return 335 / Math.tan(21 * Math.PI / 180) / Math.max(0.55, Math.min(1.25, a)); }
    const FOCUS = {
        overview: () => ({ az: 0.32, pol: 0.86, dist: fitDist(), tx: 0, tz: 0 }),
        site: () => ({ az: 0.55, pol: 1.02, dist: 85, tx: 6, tz: 0 }),
        junction: () => ({ az: -0.55, pol: 0.98, dist: 120, tx: -38, tz: 8 }),
        mea: () => ({ az: 0.95, pol: 1.0, dist: 150, tx: 90, tz: 12 }),
        mosque: () => ({ az: 1.05, pol: 1.0, dist: 120, tx: -78, tz: -8 })
    };
    function focus(key, instant) {
        const f = FOCUS[key] && FOCUS[key](); if (!f) return;
        // หมุนไปทางที่ใกล้ที่สุด
        while (f.az - want.az > Math.PI) f.az -= Math.PI * 2;
        while (want.az - f.az > Math.PI) f.az += Math.PI * 2;
        Object.assign(want, f); clampWant();
        if (instant) Object.assign(cam, want);
        idleAt = Date.now();
    }
    function clampWant() {
        want.pol = Math.max(0.05, Math.min(1.48, want.pol));
        const fd = fitDist(); want.dist = Math.max(12, Math.min(fd * 2.2, want.dist));
        const r = Math.hypot(want.tx, want.tz); if (r > 360) { want.tx *= 360 / r; want.tz *= 360 / r; }
    }
    // ผู้ใช้คุมกล้องเอง → หยุดหมุนอัตโนมัติ (กดชิป "หมุนเอง" เพื่อเปิดใหม่)
    function stopAuto() { if (!autoRot) return; autoRot = false; if (ui.rotate) ui.rotate.classList.remove('on'); }
    // จุดบนพื้นใต้ตำแหน่งจอ (ใช้มุมกล้องเป้าหมาย want ให้ซูมต่อเนื่องไม่ไหล)
    const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
    function groundAt(cx, cy) {
        if (!camera || !ui.stage) return null;
        const r = ui.stage.getBoundingClientRect(); if (!r.width || !r.height) return null;
        const sp = Math.sin(want.pol), cp = Math.cos(want.pol);
        camera.position.set(want.tx + want.dist * sp * Math.sin(want.az), want.dist * cp + 1, want.tz + want.dist * sp * Math.cos(want.az));
        camera.lookAt(want.tx, 0, want.tz); camera.updateMatrixWorld();
        _ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
        _ray.setFromCamera(_ndc, camera);
        const hit = _ray.ray.intersectPlane(_plane, _hit);
        applyCamera();
        return hit ? { x: hit.x, z: hit.z } : null;
    }
    // ซูมเข้า/ออกโดยให้จุดที่ชี้อยู่กับที่ (ไม่ระบุตำแหน่ง = กลางจอ)
    function zoomAt(f, cx, cy) {
        const before = want.dist, g = cx == null ? null : groundAt(cx, cy);
        want.dist *= f; clampWant();
        const ff = want.dist / before;
        if (g && ff !== 1) { want.tx = g.x + (want.tx - g.x) * ff; want.tz = g.z + (want.tz - g.z) * ff; clampWant(); }
        idleAt = Date.now();
    }
    // ดับเบิลคลิก/แตะสองครั้ง → บินไปจุดนั้นและซูมเข้า
    let lastFly = 0;
    function flyTo(cx, cy) {
        const g = groundAt(cx, cy); if (!g) return;
        want.tx = g.x; want.tz = g.z; want.dist = Math.max(25, Math.min(want.dist * 0.5, 140)); clampWant();
        stopAuto(); idleAt = Date.now(); lastFly = Date.now();
    }
    function applyCamera() {
        const sp = Math.sin(cam.pol), cp = Math.cos(cam.pol);
        camera.position.set(cam.tx + cam.dist * sp * Math.sin(cam.az), cam.dist * cp + 1, cam.tz + cam.dist * sp * Math.cos(cam.az));
        camera.lookAt(cam.tx, 0, cam.tz);
    }
    function bindControls(el) {
        const pts = new Map();
        let last = null, pinch = 0, mid = null, panMode = false, down = null, moved = 0, lastTap = null;
        const pan = (dx, dy) => {
            const k = want.dist * 0.0016;
            const rx = Math.cos(want.az), rz = -Math.sin(want.az), fx = -Math.sin(want.az), fz = -Math.cos(want.az);
            want.tx += -rx * dx * k + fx * dy * k; want.tz += -rz * dx * k + fz * dy * k; clampWant();
        };
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('pointerdown', (e) => {
            el.setPointerCapture && el.setPointerCapture(e.pointerId);
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            panMode = e.button === 2 || e.shiftKey || panLock;
            last = { x: e.clientX, y: e.clientY }; idleAt = Date.now();
            if (pts.size === 1) { down = { x: e.clientX, y: e.clientY, t: Date.now() }; moved = 0; } else down = null;
            if (pts.size === 2) { const a = [...pts.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); mid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; }
        });
        el.addEventListener('pointermove', (e) => {
            if (!pts.has(e.pointerId)) return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); idleAt = Date.now();
            if (pts.size >= 2) {
                const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), m = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
                if (pinch > 0 && d > 0) zoomAt(pinch / d, m.x, m.y);   // จีบนิ้ว: ซูมตรงกลางระหว่างสองนิ้ว
                if (mid) pan(m.x - mid.x, m.y - mid.y);
                pinch = d; mid = m; clampWant(); stopAuto(); return;
            }
            const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
            if (down) moved = Math.max(moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
            if (moved > 4) stopAuto();
            if (panMode) pan(dx, dy);
            else { want.az -= dx * 0.0058; want.pol -= dy * 0.0046; clampWant(); }
        });
        const up = (e) => {
            pts.delete(e.pointerId); if (pts.size < 2) { pinch = 0; mid = null; }
            const r = [...pts.values()][0]; if (r) last = { x: r.x, y: r.y }; idleAt = Date.now();
            // แตะสองครั้ง (จอสัมผัส) → ซูมเข้าจุดนั้น
            if (e.type === 'pointerup' && e.pointerType !== 'mouse' && down && !pts.size && moved < 10 && Date.now() - down.t < 300) {
                const now = Date.now();
                if (lastTap && now - lastTap.t < 340 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 36) { flyTo(e.clientX, e.clientY); lastTap = null; }
                else lastTap = { x: e.clientX, y: e.clientY, t: now };
            }
            if (!pts.size) down = null;
        };
        el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        el.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.pow(1.0012, e.deltaY), e.clientX, e.clientY); stopAuto(); }, { passive: false });
        el.addEventListener('dblclick', (e) => { if (Date.now() - lastFly > 500) flyTo(e.clientX, e.clientY); });
    }
    function resize() {
        if (!renderer) return;
        const w = ui.stage.clientWidth, h = ui.stage.clientHeight; if (!w || !h) return;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); updateLabels(true);
    }

    /* ---------- เวลา / ระดับ / มวลชน ---------- */
    const TIMES = {
        dawn: { sky: ['#030a1a', '#0d1f3f', '#3a3f6a', '#c06a4a'], hemi: [0x6f88c4, 0x1a2436, 0.62], sun: [0xb4c4ff, 0.5, 80, -300, 70], fog: [0x15213a, 380, 1500], lamps: true, ex: 'ก่อนรุ่ง' },
        day: { sky: ['#3f86cf', '#78afe3', '#bcd8f2', '#e7f1fa'], hemi: [0xdfefff, 0x6b7d45, 0.78], sun: [0xfff3df, 1.05, 160, -300, 300], fog: [0xcfe0f0, 900, 2400], lamps: false },
        dusk: { sky: ['#1c1a44', '#4a3570', '#c0607a', '#f6a35c'], hemi: [0xffc9a3, 0x2e2a2a, 0.55], sun: [0xff9a5a, 0.8, -320, -130, 40], fog: [0x4f4060, 520, 1900], lamps: true }
    };
    function setTime(mode) {
        timeMode = TIMES[mode] ? mode : 'day';
        if (ui.time) ui.time.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.time === timeMode));
        if (!scene) return;
        const T = TIMES[timeMode];
        const g = skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, T.sky[0]); gr.addColorStop(0.35, T.sky[1]); gr.addColorStop(0.47, T.sky[2]); gr.addColorStop(0.5, T.sky[3]); gr.addColorStop(1, T.sky[3]);
        g.fillStyle = gr; g.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
        hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity = T.hemi[2];
        sun.color.setHex(T.sun[0]); sun.intensity = T.sun[1]; sun.position.set(T.sun[2], T.sun[4], -T.sun[3]); sun.target.position.set(0, 0, 0);
        scene.fog.color.setHex(T.fog[0]); scene.fog.near = T.fog[1]; scene.fog.far = T.fog[2];
        anim.lampGlows.forEach((l) => { l.glow.visible = T.lamps; l.bulb.material.emissive.setHex(T.lamps ? 0xffd590 : 0x000000); });
        anim.headlights.forEach((m) => m.material.emissive.setHex(T.lamps ? 0xfff2c0 : 0x000000));
        renderOnce();
    }
    function applyLevel() {
        if (!anim.pulseMat) return;
        const hex = LEVEL_HEX[curLevel] || LEVEL_HEX.green;
        anim.pulseMat.color.setHex(hex);
        anim.pinMat.emissive.setHex(curLevel === 'green' ? 0x3a2a00 : hex);
        anim.pinMat.color.setHex(curLevel === 'green' ? 0xD4AF37 : hex);
        if (anim.zone) anim.zone.visible = curLevel === 'red';
        renderOnce(); updateLabels(true);
    }
    function applyCrowd() {
        if (!anim.crowd) return;
        anim.crowdGroup.visible = crowdOn;
        anim.crowd.count = anim.heads.count = crowdN;
        anim.signs.forEach((s) => { s.g.visible = s.idx < crowdN; });
        if (anim.crowdLabel) anim.crowdLabel.el.textContent = 'มวลชนจำลอง ' + crowdN + ' คน';
        renderOnce();
    }

    /* ---------- วงรอบการวาด ---------- */
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
    function animate(t, dt) {
        // หมุนช้า ๆ เมื่อปล่อยมือ
        if (autoRot && Date.now() - idleAt > 8000) want.az += dt * 0.00006;
        const k = 1 - Math.pow(0.0025, dt / 1000);
        cam.az += (want.az - cam.az) * k; cam.pol += (want.pol - cam.pol) * k; cam.dist += (want.dist - cam.dist) * k;
        cam.tx += (want.tx - cam.tx) * k; cam.tz += (want.tz - cam.tz) * k;
        // มวลชนขยับเล็กน้อย
        if (crowdOn && anim.crowd) {
            const n = crowdN, ts = t / 1000;
            for (let i = 0; i < n; i++) {
                const b = anim.crowdBase[i];
                const bob = Math.max(0, Math.sin(ts * b.rate + b.ph)) * 0.06;
                _p.set(b.x + Math.sin(ts * 0.3 + b.ph) * 0.12, bob, -b.y); _q.setFromAxisAngle(_up, b.rot + Math.sin(ts * 0.5 + b.ph) * 0.25);
                _m.compose(_p, _q, _s); anim.crowd.setMatrixAt(i, _m); anim.heads.setMatrixAt(i, _m);
            }
            anim.crowd.instanceMatrix.needsUpdate = true; anim.heads.instanceMatrix.needsUpdate = true;
            anim.signs.forEach((s, j) => { s.g.position.y = Math.max(0, Math.sin(ts * 2.2 + j)) * 0.25; });
            if (anim.leader) anim.leader.rotation.y = Math.sin(ts * 0.7) * 0.5;
        }
        // วงพัลส์ที่จุดชุมนุม
        const ph = (t / 1600) % 1;
        anim.pulse.scale.setScalar(6 + ph * 26); anim.pulseMat.opacity = 0.55 * (1 - ph);
        anim.pin.position.y = Math.sin(t / 500) * 0.4;
        // ไฟวับวาบรถสายตรวจ
        const on = Math.floor(t / 260) % 2 === 0;
        anim.bars.forEach((b) => { b[0].visible = on; b[1].visible = !on; });
        // รถวิ่งบนถนนใหญ่
        anim.traffic.forEach((c) => {
            c.s += c.dir * c.speed * dt / 1000; if (c.s > c.L) c.s -= c.L; if (c.s < 0) c.s += c.L;
            const q = along(mainPts, c.s), off = c.dir > 0 ? 1.9 : -1.9;   // ประเทศไทยขับชิดซ้าย
            c.g.position.set(q.x - q.uy * off, 0.32, -(q.y + q.ux * off));
            c.g.rotation.y = Math.atan2(q.uy * c.dir, q.ux * c.dir);
            c.g.visible = Math.hypot(q.x, q.y) < 352;
        });
    }
    function frame(t) {
        if (!running) return;
        raf = requestAnimationFrame(frame);
        if (lowPower && t - lastT < 30) return;
        const dt = lastT ? Math.min(100, t - lastT) : 16; lastT = t;
        animate(t, dt);
        applyCamera();
        renderer.render(scene, camera);
        updateLabels();
    }
    function renderOnce() { if (!renderer || running) return; applyCamera(); renderer.render(scene, camera); updateLabels(); }
    function start() { if (running || !built) return; running = true; lastT = 0; idleAt = Date.now(); resize(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    // สถานะสำหรับตรวจสอบ (อ่านอย่างเดียว)
    window.LamhinCmd3D = { get running() { return running; }, get built() { return built; }, get view() { return { az: want.az, pol: want.pol, dist: want.dist, tx: want.tx, tz: want.tz, auto: autoRot, panLock: panLock }; }, focus: focus, look: (v) => { Object.assign(want, v || {}); clampWant(); stopAuto(); }, setTime: setTime };

    /* ---------------- ลงทะเบียนแท็บ ---------------- */
    CMD.registerSection({ id: 'map3d', label: 'แผนที่ 3 มิติ', icon: 'fa-cube', order: 30, host: 'overview', top: true, mount: mount, update: update, visible: visible });
})();
