// สร้างอัตโนมัติจาก _dev/scene3d.js — อย่าแก้ที่นี่
// ==========================================================
// แผนที่ 3 มิติ สน.ลำหิน — Three.js (WebGL) หมุนดูได้อิสระ 360 องศา
//
// การควบคุม
//   • ลากเมาส์ซ้าย / ลากนิ้วเดียว  → หมุนรอบโรงพัก 360° (ก้ม-เงย 10°-78°)
//   • ล้อเมาส์ / จีบสองนิ้ว        → ซูมเข้า-ออก (จำกัดระยะ กันทะลุพื้น/หลุดเฟรม)
//   • ชี้ค้างที่อาคาร               → อาคารสว่างขึ้น + เคอร์เซอร์เป็นมือ
//   • คลิกอาคาร                    → กล้องบินไปโฟกัส + แผงข้อมูลด้านขวาเปลี่ยนตาม
//   • ปล่อยมือ 6 วินาที            → หมุนช้า ๆ เองอัตโนมัติ (โหมดตั้งโชว์ในห้องประชุม)
//                                     ขยับเมาส์เมื่อไหร่หยุดทันที
//
// ใช้ THREE เวอร์ชัน UMD (ตัวแปร global THREE) โหลดแบบ lazy ตอนเปิดแท็บแดชบอร์ดเท่านั้น
// ==========================================================

var LamhinScene = (function () {

    // ---- ผังพื้นจริง (อ้างอิงภาพถ่ายดาวเทียม Google Maps) ----
    // แกน x = ตะวันออก, y = ใต้, หน่วย 1 ช่อง ≈ 6 เมตร
    // อาคารทั้ง 3 หลังวางตัว "ยาวขนานไปกับซอยคลองสิบ-สิบสี่ 7" (ยาวตามแกน y)
    // ==========================================================
    // ผังพื้น สน.ลำหิน — วัดจากภาพถ่ายดาวเทียม Google Maps
    // แกน x = ตะวันออก, y = ใต้, 1 หน่วย ≈ 6 เมตร
    // สัดส่วนแปลง 11.5 x 23.2 หน่วย (กว้าง:ยาว ≈ 1 : 2)
    // อาคารทั้งหมดวางตัวยาวขนานไปกับซอยคลองสิบ-สิบสี่ 7
    // ==========================================================
    var PLAN_W = 22, PLAN_H = 30;
    var SITE = { x: 1.6, y: 0, w: 18.0, d: 29.0 };     // ขอบเขตแท่นฐานที่มองเห็น

    var PLAN = {
        mainRoad: { x: 1.6, y: 0, w: 18.0, d: 1.1 },      // ถนนคลองสิบ-คลองสิบสี่
        canal: { x: 1.6, y: 1.1, w: 18.0, d: 1.6 },       // คลองสนาม
        scrub: { x: 1.6, y: 2.7, w: 1.4, d: 26.3 },       // ที่รกร้างฝั่งตะวันตก
        soi: { x: 3.0, y: 2.7, w: 1.7, d: 26.3 },         // ซอยคลองสิบ-สิบสี่ 7
        paddyE: { x: 16.2, y: 2.7, w: 3.4, d: 26.3 },     // นาข้าวฝั่งตะวันออก
        paddyS: { x: 4.7, y: 26.6, w: 11.5, d: 2.4 },     // นาข้าวด้านใต้
        yard: { x: 4.7, y: 3.4, w: 11.5, d: 23.2 },       // เขตโรงพัก (ลาดยางทั้งแปลง)

        // ---- โซนเหนือ: อาคารที่ทำการ ----
        station: { x: 7.7, y: 5.3, w: 5.5, d: 7.4 },      // ยาว 7.4 > ลึก 5.5 ตามตึกจริง
        driveN: { x: 4.9, y: 3.6, w: 11.1, d: 1.7 },      // ถนนข้าง สน. (ด้านเหนือ) 2 เลน + จอดชิดตึก
        parkN: { x: 5.24, y: 5.6, w: 1.05, d: 6.6 },      // ช่องจอดหน้า สน. ชิดฟุตบาธ
        laneN: { x: 6.29, y: 3.6, w: 1.41, d: 9.1 },      // ผ่านหน้าอาคาร: เลนเดียว กว้างราว 1 เลนครึ่ง
        driveE: { x: 13.2, y: 3.6, w: 2.8, d: 9.1 },      // ด้านหลัง สน. 2 เลน (จอดชิดฟุตบาธ เหลือวิ่ง 1 เลน)
        apron: { x: 7.3, y: 8.0, w: 0.4, d: 2.3 },        // ลานปูนหน้าทางเข้าอาคาร

        // ---- ถนนกลาง: ประตูหลัก 2 เลนสวนกันได้ ----
        driveMid: { x: 4.7, y: 12.7, w: 11.5, d: 1.45 },

        // ---- โซนใต้: อาคารที่พัก 2 หลัง ขนาดเท่ากัน ----
        parkS: { x: 4.74, y: 14.15, w: 1.56, d: 9.5 },    // ลานจอดหน้าแฟลต (เปิดโล่งถึงซอย)
        flat1: { x: 6.4, y: 14.15, w: 3.6, d: 9.5 },      // หลังตะวันตก — หลังคาเทา
        driveBtw: { x: 10.0, y: 14.15, w: 1.9, d: 10.9 }, // ช่องทางรถระหว่างอาคาร (กว้าง จอดได้ 2 ฝั่ง)
        flat2: { x: 11.9, y: 14.15, w: 3.6, d: 9.5 },     // หลังตะวันออก — หลังคาแดง (ขนาดเท่าหลังแรก)
        driveS: { x: 4.7, y: 23.65, w: 10.8, d: 1.4 },    // ถนนท้ายแปลง — เลี้ยวขวาออกซอย

        guard: { x: 5.0, y: 11.9, w: 0.85, d: 0.85 }      // ป้อมยามประตูหลัก
    };

    // ช่องเปิดของรั้ว — มีเฉพาะด้านตะวันตก (ติดซอย) ช่วงกลางลงมาเท่านั้น
    // หน้าอาคารที่ทำการเป็นกำแพงทึบตลอดแนว (ไม่มีประตูด้านเหนือ) · ด้านเหนือ/ตะวันออก/ใต้ เป็นกำแพงทึบ
    var GATES = [
        { y: 12.7, d: 12.35 }    // ประตูหลัก (ช่องกลาง) + หน้าอาคารที่พัก (เปิดโล่ง) + ทางออกท้ายแปลง
    ];

    // ฟุตบาธปูนเลียบรั้ว — มีทุกด้านที่มีกำแพง
    var WALKS = [
        { x: 4.84, y: 3.54, w: 11.22, d: 0.4 },     // เหนือ
        { x: 4.84, y: 26.06, w: 11.22, d: 0.4 },    // ใต้ (หลังดงไม้ท้ายแปลง)
        { x: 15.66, y: 3.94, w: 0.4, d: 22.12 },    // ตะวันออก
        { x: 4.84, y: 3.94, w: 0.4, d: 8.76 },      // ตะวันตก (ช่วงอาคารที่ทำการ)
        { x: 4.84, y: 25.05, w: 0.4, d: 1.01 }      // ตะวันตก (ช่วงท้ายแปลง ต่อจากทางออก)
    ];

    // โทนกลางวันสดใส — หญ้าเขียวสด นาข้าวเขียวอ่อน น้ำฟ้าใส หลังคาแดงอิฐ
    var COL = {
        grass: 0x7cc96b, paddy: 0x9ed86a, scrub: 0xd8c48c, water: 0x4fc3f7,
        road: 0x6b7480, asphalt: 0x7a838f, park: 0x8a939e, concrete: 0xe4e8ee,
        earth: 0xa77d52, wall: 0xfbfcfe, roofRed: 0xe0533f, roofGrey: 0xcfd6df,
        trim: 0xb08766, baseRed: 0xd64a36, glass: 0x5aa9f0, line: 0xffe066
    };

    var THREE, renderer, scene, camera, raf = 0, host;
    var pickables = [], hoverMesh = null, selectedKey = null;
    var onPick = null;
    var cam = { az: Math.PI * 1.62, pol: 0.74, dist: 56, tx: 0, ty: 1.6, tz: 0 };
    var want = { az: cam.az, pol: cam.pol, dist: cam.dist, tx: 0, ty: 1.6, tz: 0 };
    var idleAt = 0, dragging = false, moved = false, lastP = null, pinch = 0;
    var labels = [], running = false, visible = true;


    // ---------- แปลงพิกัดผัง → พิกัดโลก (กึ่งกลางแปลงอยู่ที่จุด 0,0) ----------
    function wx(x) { return x - (SITE.x + SITE.w / 2); }
    function wz(y) { return y - (SITE.y + SITE.d / 2); }

    // ---------- พื้นผิวบาง ๆ (ถนน/นา/ลาน) ----------
    function slab(r, color, y, h, noShadow) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(r.w, h || 0.08, r.d),
            new THREE.MeshLambertMaterial({ color: color }));
        m.position.set(wx(r.x + r.w / 2), (y || 0) + (h || 0.08) / 2, wz(r.y + r.d / 2));
        if (!noShadow) m.receiveShadow = true;
        scene.add(m); return m;
    }

    // ---------- ผิวอาคาร: วาดหน้าต่างลงผ้าใบแล้วใช้เป็นเท็กซ์เจอร์ ----------
    var texCache = {};
    function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }
    function wallTexture(floors, wallHex, winHex, bandHex) {
        var key = 'w' + floors + '|' + wallHex + '|' + winHex + '|' + bandHex;
        if (texCache[key]) return texCache[key];
        var c = document.createElement('canvas');
        c.width = 256; c.height = 64 * floors;
        var g = c.getContext('2d');
        g.fillStyle = hex(wallHex); g.fillRect(0, 0, c.width, c.height);
        for (var f = 0; f < floors; f++) {
            var y0 = f * 64;
            g.fillStyle = hex(bandHex || 0xd8dde4);
            g.fillRect(0, y0 + 56, c.width, 8);
            g.fillStyle = hex(winHex);
            for (var i = 0; i < 6; i++) g.fillRect(14 + i * 40, y0 + 15, 27, 31);
            g.fillStyle = 'rgba(255,255,255,0.25)';
            for (i = 0; i < 6; i++) g.fillRect(14 + i * 40, y0 + 15, 27, 7);
            g.fillStyle = 'rgba(0,0,0,0.12)';
            for (i = 0; i < 6; i++) g.fillRect(14 + i * 40, y0 + 42, 27, 4);
        }
        var t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
        texCache[key] = t; return t;
    }
    // ผิวชั้น 2 ของอาคารที่ทำการ: ครีบแนวตั้งสีขาวเหนือแถบหน้าต่าง (เอกลักษณ์ของตึกจริง)
    function finTexture() {
        if (texCache.fin) return texCache.fin;
        var c = document.createElement('canvas');
        c.width = 256; c.height = 128;
        var g = c.getContext('2d');
        g.fillStyle = '#f2f4f7'; g.fillRect(0, 0, 256, 128);
        // แถบหน้าต่างชั้นล่างของผิวนี้
        g.fillStyle = hex(COL.glass); g.fillRect(0, 74, 256, 40);
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 74, 256, 8);
        // ครีบแนวตั้ง
        g.fillStyle = '#ffffff';
        for (var i = 0; i < 26; i++) g.fillRect(i * 10 + 2, 6, 6, 64);
        g.fillStyle = 'rgba(120,135,155,0.35)';
        for (i = 0; i < 26; i++) g.fillRect(i * 10 + 8, 6, 2, 64);
        g.fillStyle = '#e4e8ed'; g.fillRect(0, 0, 256, 6);
        g.fillStyle = '#dfe4ea'; g.fillRect(0, 114, 256, 14);
        var t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
        texCache.fin = t; return t;
    }

    function texMats(tex, r, repW, repD, plainHex) {
        var a = tex.clone(); a.needsUpdate = true; a.repeat.set(Math.max(1, repW), 1);
        var b = tex.clone(); b.needsUpdate = true; b.repeat.set(Math.max(1, repD), 1);
        var plain = new THREE.MeshLambertMaterial({ color: plainHex });
        return [
            new THREE.MeshLambertMaterial({ map: b }), new THREE.MeshLambertMaterial({ map: b }),
            plain, plain,
            new THREE.MeshLambertMaterial({ map: a }), new THREE.MeshLambertMaterial({ map: a })
        ];
    }

    function plainBox(r, baseY, h, color) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(r.w, h, r.d),
            new THREE.MeshLambertMaterial({ color: color }));
        m.position.set(wx(r.x + r.w / 2), baseY + h / 2, wz(r.y + r.d / 2));
        m.castShadow = true; m.receiveShadow = true;
        return m;
    }
    function grow(r, by) { return { x: r.x - by, y: r.y - by, w: r.w + by * 2, d: r.d + by * 2 }; }

    function tree(x, z, s) {
        var g = new THREE.Group();
        var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, 1.1 * s, 6),
            new THREE.MeshLambertMaterial({ color: 0x8b5e3c }));
        trunk.position.y = 0.55 * s; g.add(trunk);
        var leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s, 0),
            new THREE.MeshLambertMaterial({ color: 0x34b864, flatShading: true }));
        leaf.position.y = 1.5 * s; leaf.castShadow = true; g.add(leaf);
        var leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 * s, 0),
            new THREE.MeshLambertMaterial({ color: 0x5fd88a, flatShading: true }));
        leaf2.position.set(0.3 * s, 2.0 * s, -0.2 * s); g.add(leaf2);
        g.position.set(wx(x), 0, wz(z));
        return g;
    }

    // รถ: rotY = 0 คือหัวรถชี้ไปทางตะวันออก, Math.PI/2 คือชี้ไปทางใต้
    function car(x, z, color, rotY) {
        var g = new THREE.Group();
        var b = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 0.42),
            new THREE.MeshLambertMaterial({ color: color }));
        b.position.y = 0.2; b.castShadow = true; g.add(b);
        var c = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.36),
            new THREE.MeshLambertMaterial({ color: 0xbfdcef }));
        c.position.set(-0.04, 0.42, 0); c.castShadow = true; g.add(c);
        [[0.3, 0.19], [0.3, -0.19], [-0.3, 0.19], [-0.3, -0.19]].forEach(function (w) {
            var t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 8),
                new THREE.MeshLambertMaterial({ color: 0x1b1f26 }));
            t.rotation.x = Math.PI / 2; t.position.set(w[0], 0.1, w[1]); g.add(t);
        });
        g.position.set(wx(x), 0.16, wz(z));
        g.rotation.y = rotY || 0;
        return g;
    }

    // ---------- เสาธงพร้อมธงไตรรงค์ ----------
    // ธงชาติไทย: แดง-ขาว-น้ำเงิน(หนาสองเท่า)-ขาว-แดง อัตราส่วน 2:3
    function thaiFlagTexture() {
        if (texCache.flag) return texCache.flag;
        var c = document.createElement('canvas');
        c.width = 360; c.height = 240;
        var g = c.getContext('2d');
        var bands = [['#A51931', 40], ['#F4F5F8', 40], ['#2D2A4A', 80], ['#F4F5F8', 40], ['#A51931', 40]];
        var y = 0;
        bands.forEach(function (b) { g.fillStyle = b[0]; g.fillRect(0, y, c.width, b[1]); y += b[1]; });
        var t = new THREE.CanvasTexture(c);
        t.anisotropy = 4;
        texCache.flag = t; return t;
    }
    function flagpole(x, z) {
        var g = new THREE.Group();
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 7.4, 8),
            new THREE.MeshLambertMaterial({ color: 0xd4dae2 }));
        p.position.y = 3.7; g.add(p);
        // ลูกกลมยอดเสา
        var knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
            new THREE.MeshLambertMaterial({ color: 0xe8c86a }));
        knob.position.y = 7.45; g.add(knob);
        // ฐานปูน
        var pad = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.75),
            new THREE.MeshLambertMaterial({ color: 0xb9c1cb }));
        pad.position.y = 0.08; g.add(pad);
        // ผืนธง — ชักอยู่ใกล้ยอดเสา ด้านคันธงชิดเสา
        var fw = 1.35, fh = 0.9;
        var geo = new THREE.PlaneGeometry(fw, fh, 10, 1);
        // ดัดให้เป็นลอนเล็กน้อย เหมือนธงสะบัดลม
        var pos = geo.attributes.position;
        for (var i = 0; i < pos.count; i++) {
            var px = pos.getX(i);
            var k = (px + fw / 2) / fw;                     // 0 ที่คันธง → 1 ที่ปลายธง
            pos.setZ(i, Math.sin(k * Math.PI * 1.8) * 0.11 * k);
        }
        geo.computeVertexNormals();
        var flag = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
            map: thaiFlagTexture(), side: THREE.DoubleSide
        }));
        flag.position.set(fw / 2 + 0.06, 6.72, 0);
        flag.castShadow = true;
        g.add(flag);
        g.position.set(wx(x), 0.16, wz(z));
        return g;
    }

    function shrine(x, z) {
        var g = new THREE.Group();
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07),
            new THREE.MeshLambertMaterial({ color: 0xc9a227 }));
        post.position.y = 0.21; g.add(post);
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22),
            new THREE.MeshLambertMaterial({ color: 0xe0b43c }));
        body.position.y = 0.51; body.castShadow = true; g.add(body);
        var roof = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.2, 4),
            new THREE.MeshLambertMaterial({ color: 0xffd45e }));
        roof.position.y = 0.7; roof.rotation.y = Math.PI / 4; g.add(roof);
        // ฐานปูนเล็ก ๆ
        var pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5),
            new THREE.MeshLambertMaterial({ color: 0xb9c1cb }));
        pad.position.y = 0.03; g.add(pad);
        g.position.set(wx(x), 0.16, wz(z));
        return g;
    }

    function lamp(x, z, flip) {
        var g = new THREE.Group();
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 5),
            new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
        p.position.y = 1.8; g.add(p);
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.07),
            new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
        arm.position.set((flip ? -0.35 : 0.35), 3.58, 0); g.add(arm);
        var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.22),
            new THREE.MeshLambertMaterial({ color: 0xfcd34d, emissive: 0x4a3c00 }));
        head.position.set((flip ? -0.65 : 0.65), 3.5, 0); g.add(head);
        g.position.set(wx(x), 0.16, wz(z));
        return g;
    }

    // ---------- ป้ายตัวอักษรติดผนัง ----------
    function signPlane(text, bg, fg, wUnit, hUnit) {
        var c = document.createElement('canvas');
        c.width = 1024; c.height = 160;
        var g = c.getContext('2d');
        if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
        else { g.clearRect(0, 0, c.width, c.height); }
        g.fillStyle = fg;
        // ย่อขนาดตัวอักษรอัตโนมัติให้พอดีป้าย (ชื่อไทยยาวกว่า POLICE มาก)
        var size = 104;
        do { g.font = 'bold ' + size + 'px "Sarabun",system-ui,sans-serif'; size -= 4; }
        while (g.measureText(text).width > c.width - 40 && size > 24);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, c.width / 2, c.height / 2 + 4);
        var t = new THREE.CanvasTexture(c);
        return new THREE.Mesh(new THREE.PlaneGeometry(wUnit, hUnit),
            new THREE.MeshBasicMaterial({ map: t, transparent: !bg }));
    }

    // ---------- ลูกศรบอกทางเดินรถบนพื้น ----------
    function roadArrow(x, z, rotY) {
        var g = new THREE.Group();
        var body = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.8),
            new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.55 }));
        body.rotation.x = -Math.PI / 2; g.add(body);
        var head = new THREE.Mesh(new THREE.CircleGeometry(0.22, 3),
            new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.55 }));
        head.rotation.x = -Math.PI / 2; head.rotation.z = Math.PI / 6;
        head.position.set(0, 0, -0.52); g.add(head);
        g.position.set(wx(x), 0.2, wz(z));
        g.rotation.y = rotY || 0;
        return g;
    }

    // ==========================================================
    // ประกอบฉากทั้งหมด
    // ==========================================================
    function buildScene() {
        scene = new THREE.Scene();
        scene.background = null;                         // โปร่งใส เห็นท้องฟ้าไล่สีจาก CSS
        scene.fog = new THREE.Fog(0xe6f2ff, 90, 170);    // หมอกจาง ๆ สีขอบฟ้า ให้ไกล ๆ ดูมีมิติ

        scene.add(new THREE.HemisphereLight(0xffffff, 0xa8d08d, 0.9));
        scene.add(new THREE.AmbientLight(0xffffff, 0.18));
        var sun = new THREE.DirectionalLight(0xfff6e5, 1.05);
        sun.position.set(20, 32, 16);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        var sc = sun.shadow.camera;
        sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 90;
        scene.add(sun);

        // ---- แท่นฐาน ----
        var earth = new THREE.MeshLambertMaterial({ color: COL.earth });
        var base = new THREE.Mesh(new THREE.BoxGeometry(SITE.w, 1.2, SITE.d), [
            earth, earth, new THREE.MeshLambertMaterial({ color: COL.grass }), earth, earth, earth
        ]);
        base.position.set(0, -0.6, 0); base.receiveShadow = true;
        scene.add(base);

        // ---- พื้นผิวโดยรอบ ----
        slab(PLAN.paddyE, COL.paddy, 0, 0.1);
        slab(PLAN.paddyS, COL.paddy, 0, 0.1);
        slab(PLAN.scrub, COL.scrub, 0, 0.06);
        slab(PLAN.canal, COL.water, -0.14, 0.22);
        slab(PLAN.mainRoad, COL.road, 0, 0.1);
        slab(PLAN.soi, COL.road, 0, 0.1);
        // สะพานข้ามคลองสนาม ตรงปากซอย (ทางเข้า สน. จากถนนใหญ่)
        slab({ x: PLAN.soi.x, y: PLAN.canal.y, w: PLAN.soi.w, d: PLAN.canal.d }, COL.road, 0, 0.1);
        [PLAN.soi.x - 0.08, PLAN.soi.x + PLAN.soi.w - 0.04].forEach(function (rx) {
            scene.add(plainBox({ x: rx, y: PLAN.canal.y, w: 0.12, d: PLAN.canal.d }, 0.1, 0.22, 0xe5e7eb));
        });

        // ---- ลานโรงพัก: ลาดยางทั้งแปลง แล้วทับด้วยถนน/ลานจอด/ทางเท้า ----
        slab(PLAN.yard, COL.asphalt, 0, 0.16);
        [PLAN.driveN, PLAN.driveE, PLAN.driveMid, PLAN.driveBtw, PLAN.laneN, PLAN.driveS].forEach(function (r) {
            slab(r, COL.road, 0.16, 0.03, true);
        });
        slab(PLAN.parkN, COL.park, 0.16, 0.03, true);
        slab(PLAN.parkS, COL.park, 0.16, 0.03, true);
        slab(PLAN.apron, COL.concrete, 0.16, 0.06, true);

        // ฟุตบาธเลียบรั้ว (ยกขอบให้เห็นเป็นทางเท้าจริง)
        WALKS.forEach(function (r) {
            slab(r, COL.concrete, 0.16, 0.13, true);
            slab(r, 0xbac2cc, 0.29, 0.02, true);
        });

        var i;
        // เส้นช่องจอดหน้าอาคารที่ทำการ
        for (i = 1; i < 7; i++) {
            slab({ x: PLAN.parkN.x, y: PLAN.parkN.y + PLAN.parkN.d * i / 7 - 0.025, w: PLAN.parkN.w, d: 0.05 },
                COL.line, 0.2, 0.02, true);
        }
        // เส้นแบ่งเลนถนน 2 เลนใน สน. (ถนนกลาง / ข้าง สน. / ด้านหลัง สน. / ท้ายแปลง)
        function dashLine(x0, y0, x1, y1) {
            var n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 0.9);
            for (var k = 0; k < n; k++) {
                var t = (k + 0.25) / n, h = x0 === x1;
                var cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
                slab(h ? { x: cx - 0.04, y: cy - 0.25, w: 0.08, d: 0.5 } : { x: cx - 0.25, y: cy - 0.04, w: 0.5, d: 0.08 },
                    0xf8fafc, 0.19, 0.015, true);
            }
        }
        dashLine(5.6, 13.43, 15.3, 13.43);      // ถนนกลาง
        dashLine(7.9, 4.39, 13.0, 4.39);        // ข้าง สน.
        dashLine(14.2, 5.4, 14.2, 12.5);        // ด้านหลัง สน.
        dashLine(5.6, 24.35, 15.2, 24.35);      // ท้ายแปลง
        // เส้นช่องจอดหน้าอาคารที่พัก
        for (i = 1; i < 9; i++) {
            slab({ x: PLAN.parkS.x + 0.1, y: PLAN.parkS.y + PLAN.parkS.d * i / 9 - 0.025, w: PLAN.parkS.w - 0.1, d: 0.05 },
                COL.line, 0.2, 0.02, true);
        }
        // เส้นแบ่งกลางซอย
        for (i = 0; i < 16; i++) {
            slab({ x: PLAN.soi.x + PLAN.soi.w / 2 - 0.05, y: PLAN.soi.y + 0.6 + i * 1.6, w: 0.1, d: 0.8 },
                0xd8c468, 0.1, 0.02, true);
        }

        // ---- รั้ว: ทึบทุกด้าน เว้นช่องเฉพาะด้านตะวันตก (ไม่มีทางออกด้านหลัง) ----
        var Y = PLAN.yard, fh = 0.62, fw = 0.14, fcol = 0xdbe2ea;
        scene.add(plainBox({ x: Y.x, y: Y.y, w: Y.w, d: fw }, 0.16, fh, fcol));                  // เหนือ
        scene.add(plainBox({ x: Y.x, y: Y.y + Y.d - fw, w: Y.w, d: fw }, 0.16, fh, fcol));        // ใต้
        scene.add(plainBox({ x: Y.x + Y.w - fw, y: Y.y, w: fw, d: Y.d }, 0.16, fh, fcol));        // ตะวันออก
        var cur = Y.y;
        GATES.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (gt) {
            if (gt.y > cur) scene.add(plainBox({ x: Y.x, y: cur, w: fw, d: gt.y - cur }, 0.16, fh, fcol));
            [gt.y - 0.1, gt.y + gt.d - 0.14].forEach(function (py) {      // เสาประตู
                scene.add(plainBox({ x: Y.x - 0.06, y: py, w: 0.24, d: 0.24 }, 0.16, 1.1, 0xf1f5f9));
            });
            cur = gt.y + gt.d;
        });
        if (cur < Y.y + Y.d) scene.add(plainBox({ x: Y.x, y: cur, w: fw, d: Y.y + Y.d - cur }, 0.16, fh, fcol));

        pickables = [];

        // ==========================================================
        // อาคารที่ทำการ — ฐานแดง ชั้นล่างน้ำตาล ชั้น 2 ยื่นมีครีบแนวตั้ง หลังคาแดง
        // ==========================================================
        var st = PLAN.station, g1 = new THREE.Group();
        // ชั้นล่าง: ด้านหน้าฝั่งเหนือ (ก่อนถึงบันไดทางเข้า) เจาะเป็นที่จอดใต้อาคาร ลึกครึ่งตัวตึก
        // จอดได้ 4 คัน หันหน้าเข้าตึก — เสา 2 ต้นแนวหน้าอาคาร จอดช่วงละ 2 คัน
        var CARPORT = { x: st.x, y: st.y + 0.15, w: st.w / 2, d: 2.5 };
        var gfParts = [
            { x: st.x + st.w / 2, y: st.y, w: st.w / 2, d: st.d },                                       // ครึ่งหลังตลอดแนว
            { x: st.x, y: CARPORT.y + CARPORT.d, w: st.w / 2, d: st.y + st.d - CARPORT.y - CARPORT.d },  // ครึ่งหน้า ส่วนโถงทางเข้า
            { x: st.x, y: st.y, w: st.w / 2, d: CARPORT.y - st.y }                                       // ผนังหัวมุมด้านเหนือ
        ];
        var l1tex = wallTexture(1, 0xe8ebef, COL.glass, 0xd3d8df);
        var lows = gfParts.map(function (r) {
            g1.add(plainBox(r, 0.16, 0.45, COL.baseRed));
            var m = new THREE.Mesh(new THREE.BoxGeometry(r.w, 1.9, r.d),
                texMats(l1tex, r, Math.max(1, Math.round(r.w / 2.6)), Math.max(1, Math.round(r.d / 2.6)), 0xe4e8ec));
            m.position.set(wx(r.x + r.w / 2), 0.61 + 0.95, wz(r.y + r.d / 2));
            m.castShadow = m.receiveShadow = true;
            g1.add(m);
            g1.add(plainBox(grow(r, 0.03), 0.61, 0.75, COL.trim));
            return m;
        });
        g1.add(plainBox(CARPORT, 0.16, 0.05, COL.concrete));
        [CARPORT.y + CARPORT.d / 2 - 0.09, CARPORT.y + CARPORT.d - 0.2].forEach(function (py) {
            g1.add(plainBox({ x: CARPORT.x + 0.02, y: py, w: 0.18, d: 0.18 }, 0.2, 2.31, 0xf4f6f9));
        });
        var up = grow(st, 0.42);
        var upMesh = new THREE.Mesh(new THREE.BoxGeometry(up.w, 2.25, up.d),
            texMats(finTexture(), up, Math.round(up.w / 3.4), Math.round(up.d / 3.4), 0xf2f4f7));
        upMesh.position.set(wx(up.x + up.w / 2), 2.51 + 1.125, wz(up.y + up.d / 2));
        upMesh.castShadow = upMesh.receiveShadow = true;
        g1.add(upMesh);
        g1.add(plainBox(grow(st, 0.58), 4.76, 0.3, 0xf7f9fb));
        g1.add(plainBox(grow(st, 0.1), 5.06, 0.72, COL.roofRed));
        // ---- ป้ายอาคาร (หันออกซอยด้านตะวันตก) ----
        // POLICE: แถบแดงพาดบนสันหลังคา ตัวอักษรขาว
        var band = plainBox({ x: st.x - 0.14, y: st.y + st.d * 0.22, w: 0.1, d: st.d * 0.56 },
            5.12, 0.62, 0xa8322a);
        g1.add(band);
        var sgn = signPlane('POLICE', null, '#ffffff', 3.4, 0.5);
        sgn.position.set(wx(st.x - 0.2), 5.43, wz(st.y + st.d / 2));
        sgn.rotation.y = -Math.PI / 2; g1.add(sgn);
        // ป้ายชื่อสถานี: แผ่นแดงเข้มติดหน้าชั้น 2 ช่วงบน กึ่งกลางอาคาร
        // วางสูงกว่าหัวเสาไฟ (3.7) เสาไฟ 2 ต้นที่ขนาบหน้าอาคารจึงไม่บังตัวอักษร
        var SB = { y: st.y + st.d / 2 - 1.5, d: 3.0 };
        var board = plainBox({ x: up.x - 0.06, y: SB.y, w: 0.06, d: SB.d }, 3.95, 0.6, 0x8e2c20);
        g1.add(board);
        var sgn2 = signPlane('สถานีตำรวจนครบาลลำหิน', null, '#ffffff', 2.85, 0.46);
        sgn2.position.set(wx(up.x - 0.1), 4.25, wz(SB.y + SB.d / 2));
        sgn2.rotation.y = -Math.PI / 2; g1.add(sgn2);
        // เสาค้ำชั้น 2 + บันไดทางเข้า
        // (เสาต้นเหนือเดิมย้ายไปเป็นเสาของที่จอดใต้อาคารแล้ว)
        [st.y + st.d * 0.5, st.y + st.d - 0.9].forEach(function (py) {
            g1.add(plainBox({ x: st.x - 0.38, y: py, w: 0.24, d: 0.24 }, 0.16, 2.35, 0xf4f6f9));
        });
        [0, 1, 2].forEach(function (k) {
            g1.add(plainBox({ x: PLAN.apron.x - 0.06 + k * 0.14, y: PLAN.apron.y + 0.3, w: 0.14, d: 1.7 },
                0.16 + k * 0.09, 0.09, 0xc3cad3));
        });
        scene.add(g1);
        lows.concat([upMesh]).forEach(function (m) { m.userData.key = 'station'; pickables.push(m); });

        // ==========================================================
        // อาคารที่พัก 2 หลัง — ขนาด/จำนวนชั้นเท่ากันทุกอย่าง ต่างแค่สีหลังคา
        // ==========================================================
        var FLOORS = 4, FLOOR_H = 1.2, FLAT_BAY = 0.56;
        [[PLAN.flat1, 'flat1', COL.roofGrey], [PLAN.flat2, 'flat2', COL.roofRed]].forEach(function (cfg) {
            var r = cfg[0], g = new THREE.Group();
            // ชั้นล่าง 3/4 ฝั่งที่ไม่ติดอาคารที่ทำการ (ฝั่งใต้) เปิดโล่งเป็นที่จอดรถใต้ตึก มีเสารับ
            var rN = { x: r.x, y: r.y, w: r.w, d: r.d * 0.25 };
            var rS = { x: r.x, y: r.y + rN.d, w: r.w, d: r.d - rN.d };
            g.add(plainBox(rN, 0.16, 0.35, 0xa8452f));
            g.add(plainBox(rS, 0.16, 0.04, COL.concrete));
            var tex = wallTexture(FLOORS, COL.wall, COL.glass, 0xdfe5ec);
            var body = new THREE.Mesh(new THREE.BoxGeometry(r.w, FLOORS * FLOOR_H, rN.d),
                texMats(tex, rN, Math.round(r.w / 2.4), Math.round(rN.d / 2.4), 0xe4e8ed));
            body.position.set(wx(r.x + r.w / 2), 0.51 + FLOORS * FLOOR_H / 2, wz(rN.y + rN.d / 2));
            body.castShadow = body.receiveShadow = true;
            g.add(body);
            var texU = wallTexture(FLOORS - 1, COL.wall, COL.glass, 0xdfe5ec);
            var upper = new THREE.Mesh(new THREE.BoxGeometry(r.w, (FLOORS - 1) * FLOOR_H, rS.d),
                texMats(texU, rS, Math.round(r.w / 2.4), Math.round(rS.d / 2.4), 0xe4e8ed));
            upper.position.set(wx(r.x + r.w / 2), 0.51 + FLOOR_H + (FLOORS - 1) * FLOOR_H / 2, wz(rS.y + rS.d / 2));
            upper.castShadow = upper.receiveShadow = true;
            g.add(upper);
            // เสาใต้ตึกห่างกันพอดีความกว้างรถ 1 คัน = ช่องจอดแบบเข้าซอง (FLAT_BAY)
            for (var pk = 0; pk <= Math.floor(rS.d / FLAT_BAY); pk++) {
                var pyy = rS.y + pk * FLAT_BAY - 0.06;
                [r.x + 0.04, r.x + r.w - 0.16].forEach(function (pxx) {
                    g.add(plainBox({ x: pxx, y: pyy, w: 0.12, d: 0.12 }, 0.2, 0.51 + FLOOR_H - 0.2, 0xe2e8f0));
                });
            }
            var top = 0.51 + FLOORS * FLOOR_H;
            g.add(plainBox(grow(r, 0.18), top, 0.5, cfg[2]));
            // ช่องบันไดกลางอาคาร หันเข้าช่องทางรถ
            g.add(plainBox({ x: r.x + r.w, y: r.y + r.d * 0.44, w: 0.26, d: 1.5 },
                0.51, FLOORS * FLOOR_H, 0xd9dfe6));
            scene.add(g);
            body.userData.key = upper.userData.key = cfg[1];
            pickables.push(body, upper);
        });

        // ---- ป้อมยามประตูหลัก ----
        var gd = plainBox(PLAN.guard, 0.16, 1.7, 0xe4e9ef);
        gd.userData.key = 'gate'; scene.add(gd); pickables.push(gd);
        scene.add(plainBox(grow(PLAN.guard, 0.16), 1.86, 0.22, COL.roofRed));

        // ---- ลานจอด (คลิกได้) ----
        var pk = new THREE.Mesh(new THREE.BoxGeometry(PLAN.parkN.w + PLAN.laneN.w, 0.06, PLAN.parkN.d),
            new THREE.MeshLambertMaterial({ color: COL.park, transparent: true, opacity: 0.02 }));
        pk.position.set(wx(PLAN.parkN.x + (PLAN.parkN.w + PLAN.laneN.w) / 2), 0.24,
            wz(PLAN.parkN.y + PLAN.parkN.d / 2));
        pk.userData.key = 'parking'; scene.add(pk); pickables.push(pk);

        // ---- องค์ประกอบย่อย ----
        scene.add(flagpole(5.04, PLAN.station.y + PLAN.station.d / 2));   // กึ่งกลางอาคารที่ทำการ ติดรั้วบนฟุตบาธ
        scene.add(shrine(5.42, 12.35));      // ศาลพระภูมิ ท้ายช่องจอดรถ
        // เสาไฟ: ฝั่งตะวันออกตั้งบนฟุตบาธริมกำแพง (ไม่ขวางรถที่จอด)
        [[5.5, 6.8, 0], [5.5, 10.8, 0], [15.86, 6.0, 1], [15.86, 11.0, 1],
        [15.86, 16.35, 1], [15.86, 21.95, 1], [5.5, 25.75, 0]].forEach(function (p) {
            scene.add(lamp(p[0], p[1], p[2]));
        });

        // ---- รถ ----
        // หน้าอาคารที่ทำการ: จอดชิดฟุตบาธ หัวรถชี้ตะวันออก เหลือเลนสัญจรด้านหลังรถ 1 เลน
        var P = PLAN.parkN;
        [0x1f3f8f, 0x9aa3ad, 0x2b2f36, 0xb8453a, 0xe8eaed, 0x28527a, 0x5b6472]
            .forEach(function (c, k) {
                scene.add(car(P.x + 0.52, P.y + P.d * (k + 0.5) / 7, c, 0));
            });
        // หน้าอาคารที่พัก: หันหน้ารถเข้าหาตึก
        var S = PLAN.parkS;
        [0x9aa3ad, 0x2b2f36, 0x1f3f8f, 0xd8dde4, 0x5b6472, 0xb8453a, 0x44506a, 0xe8eaed, 0x2b2f36]
            .forEach(function (c, k) {
                var cy = S.y + S.d * (k + 0.5) / 9;
                if (cy > PLAN.flat1.y + PLAN.flat1.d * 0.25 - 0.2) return;   // ช่วงหน้าที่จอดใต้ตึก เว้นไว้เป็นทางเข้าซอง
                scene.add(car(S.x + S.w - 0.56, cy, c, 0));
            });
        // ที่จอดใต้อาคารที่ทำการ: 4 คัน หันหน้าเข้าตึก (ช่วงละ 2 คันระหว่างเสา)
        [[0.29, 0x9aa3ad], [0.87, 0x1f3f8f], [1.58, 0xe8eaed], [2.05, 0x2b2f36]].forEach(function (c) {
            scene.add(car(PLAN.station.x + 0.55, PLAN.station.y + 0.15 + c[0], c[1], 0));
        });
        // ทิศหัวรถ: 0 = ตะวันออก, PI = ตะวันตก, PI/2 = เหนือ, -PI/2 = ใต้
        // ข้าง สน. (เหนือ): 2 คันชิดตึก หันไปทางด้านหลัง สน.
        [[10.0, 0xe8eaed], [11.1, 0x28527a]].forEach(function (c) {
            scene.add(car(c[0], PLAN.station.y - 0.26, c[1], 0));
        });
        // ด้านหลัง สน.: 3 คันชิดฟุตบาธ จอดต่อกัน หันไปทางอาคารที่พัก
        [[6.6, 0xf8fafc], [7.7, 0x2b2f36], [8.8, 0x9aa3ad]].forEach(function (c) {
            scene.add(car(15.4, c[0], c[1], -Math.PI / 2));
        });
        // ถนนกลาง: 2 คันจอดต่อท้ายกัน ชิดอาคารที่ทำการ หันไปทางออก
        [[8.2, 0x2b2f36], [9.3, 0xb8453a]].forEach(function (c) {
            scene.add(car(c[0], PLAN.driveMid.y + 0.27, c[1], Math.PI));
        });
        // ระหว่างอาคารที่พัก: จอดชิดอาคารทั้ง 2 ฝั่ง ฝั่งละ 3 คัน หันไปทาง สน.
        // อยู่ช่วงใต้ ไม่ขวางทางเข้าตึกด้านเหนือ และพ้นช่องบันไดของหลังตะวันตก
        [PLAN.driveBtw.x + 0.26, PLAN.driveBtw.x + PLAN.driveBtw.w - 0.26].forEach(function (cx, side) {
            [0x44506a, 0x8b929c, 0x1f3f8f].forEach(function (col, k) {
                scene.add(car(cx, PLAN.driveBtw.y + 6.45 + k * 1.1, side ? col : [0xd8dde4, 0x2b2f36, 0x5b6472][k], Math.PI / 2));
            });
        });
        // ใต้อาคารที่พัก (ชั้นล่างเปิดโล่ง 3/4 ฝั่งใต้): จอดเข้าซองระหว่างเสา หันหน้าเข้าตึก ราว 5 คันต่อหลัง
        // ทั้งสองหลังเปิดออกด้านตะวันตก — หลังตะวันตกเข้าจากลานหน้าแฟลต / หลังตะวันออกเข้าจากช่องทางระหว่างอาคาร
        // (หลังตะวันออกใช้ซองช่วงเหนือ เพราะช่วงใต้มีรถจอดเรียงริมทางอยู่)
        [[PLAN.flat1, [0, 2, 4, 7, 9]], [PLAN.flat2, [0, 1, 2, 4, 5]]].forEach(function (cfg, fi) {
            var f = cfg[0], y0 = f.y + f.d * 0.25;
            var cols = fi ? [0x9aa3ad, 0x2b2f36, 0xe8eaed, 0x28527a, 0xb8453a] : [0x5b6472, 0xd8dde4, 0x1f3f8f, 0x8b929c, 0x2b2f36];
            cfg[1].forEach(function (bay, k) {
                scene.add(car(f.x + 0.55, y0 + (bay + 0.5) * FLAT_BAY, cols[k], 0));
            });
        });

        // ---- ลูกศรบอกทางเดินรถ: เลนผ่านหน้าอาคารที่ทำการเป็นเลนเดียว ทางเดียว (มุ่งเหนือ) ----
        // ถนนเส้นอื่นเป็น 2 เลนสวนกันได้ ใช้เส้นแบ่งเลนแทน
        [[7.0, 9.6, 0], [7.0, 6.2, 0]].forEach(function (a) { scene.add(roadArrow(a[0], a[1], a[2])); });

        // ---- ต้นไม้ — ดงไม้ใหญ่ฝั่งตะวันออก (ขวามือของ สน.) และท้ายแปลง ----
        [// ท้ายแปลง บนฟุตบาธริมกำแพงด้านใต้
        [6.2, 26.26, 1.5], [8.0, 26.26, 1.8], [9.9, 26.26, 1.65], [11.8, 26.26, 1.9],
        [13.6, 26.26, 1.7], [15.2, 26.26, 1.55],
        // ดงไม้ใหญ่ฝั่งขวา (ตะวันออก) ของโรงพัก
        [16.9, 15.0, 1.7], [17.6, 17.2, 2.0], [16.8, 19.4, 1.85], [17.9, 21.4, 2.1],
        [16.9, 23.4, 1.95], [18.4, 23.8, 1.75], [17.4, 26.0, 1.6], [18.7, 18.8, 1.6],
        [17.2, 12.6, 1.3], [18.2, 10.4, 1.15], [17.0, 7.6, 1.0], [17.8, 5.2, 0.95],
        // ในแปลง บนฟุตบาธริมกำแพงตะวันออก (ไม่ล้ำลงถนน)
        [15.86, 9.9, 0.8], [15.86, 12.4, 0.75],
        // ริมซอยฝั่งตะวันตก
        [2.3, 4.6, 1.0], [2.5, 9.0, 0.9], [2.2, 15.4, 1.05], [2.5, 20.6, 0.95], [2.3, 25.2, 0.9]
        ].forEach(function (t) { scene.add(tree(t[0], t[1], t[2])); });
    }


    // ---------- จุดยึดป้ายข้อมูลในพิกัดโลก ----------
    var ANCHOR = {
        station: [PLAN.station.x + PLAN.station.w / 2, 6.2, PLAN.station.y + PLAN.station.d / 2],
        flat1:   [PLAN.flat1.x + PLAN.flat1.w / 2, 7.4, PLAN.flat1.y + PLAN.flat1.d / 2],
        flat2:   [PLAN.flat2.x + PLAN.flat2.w / 2, 6.5, PLAN.flat2.y + PLAN.flat2.d / 2],
        parking: [PLAN.parkN.x + PLAN.parkN.w / 2, 3.4, PLAN.parkN.y + PLAN.parkN.d * 0.3],
        gate:    [PLAN.guard.x + PLAN.guard.w / 2, 2.2, PLAN.guard.y + PLAN.guard.d / 2 + 1.2]
    };
    // มุมกล้องที่จะบินไปเมื่อคลิกแต่ละอาคาร
    var FOCUS = {
        station: { az: Math.PI * 1.58, pol: 0.78, k: 0.52 },
        flat1:   { az: Math.PI * 1.70, pol: 0.82, k: 0.54 },
        flat2:   { az: Math.PI * 1.42, pol: 0.82, k: 0.54 },
        parking: { az: Math.PI * 1.62, pol: 0.70, k: 0.46 },
        gate:    { az: Math.PI * 1.58, pol: 0.74, k: 0.40 }
    };

    // ==========================================================
    // กล้อง + การควบคุม
    // ==========================================================
    // ระยะกล้องที่ทำให้เห็นทั้งแปลงพอดี — คิดจากสัดส่วนกว้าง:สูงของกรอบ
    // จอแคบต้องถอยไกลกว่า ไม่งั้นภาพโดนตัดซ้าย-ขวา
    function fitDist() {
        var w = (host && host.clientWidth) || 800, h = (host && host.clientHeight) || 460;
        var a = w / Math.max(1, h);
        return Math.max(35, 42 / a);
    }

    function applyCamera() {
        var sp = Math.sin(cam.pol), cp = Math.cos(cam.pol);
        camera.position.set(
            cam.tx + cam.dist * sp * Math.sin(cam.az),
            cam.ty + cam.dist * cp,
            cam.tz + cam.dist * sp * Math.cos(cam.az)
        );
        camera.lookAt(cam.tx, cam.ty, cam.tz);
    }
    function clampCam(w) {
        w.pol = Math.max(0.18, Math.min(1.36, w.pol));
        var fd = fitDist();
        w.dist = Math.max(fd * 0.3, Math.min(fd * 1.7, w.dist));
        return w;
    }
    function resetView() {
        want.az = Math.PI * 1.62; want.pol = 0.74; want.dist = fitDist();
        want.tx = 0; want.ty = 1.6; want.tz = 0;
        idleAt = Date.now();
    }
    function focusOn(key) {
        var f = FOCUS[key]; if (!f) return;
        var a = ANCHOR[key];
        want.az = f.az; want.pol = f.pol; want.dist = fitDist() * f.k;
        want.tx = wx(a[0]); want.ty = a[1] * 0.45; want.tz = wz(a[2]);
        idleAt = Date.now();
    }

    function bindControls(el) {
        function down(e) {
            dragging = true; moved = false;
            spin = null;   // แตะจอระหว่างหมุนหน้าปก = หยุดหมุน ให้ผู้ใช้หมุนเอง
            lastP = { x: e.clientX, y: e.clientY };
            idleAt = Date.now();
            el.setPointerCapture && e.pointerId != null && el.setPointerCapture(e.pointerId);
        }
        function move(e) {
            idleAt = Date.now();
            if (!dragging) { hoverTest(e); return; }
            var dx = e.clientX - lastP.x, dy = e.clientY - lastP.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            want.az -= dx * 0.0062;
            want.pol -= dy * 0.0052;
            clampCam(want);
            lastP = { x: e.clientX, y: e.clientY };
        }
        function up(e) {
            if (dragging && !moved) clickTest(e);
            dragging = false; idleAt = Date.now();
        }
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointerleave', function () { dragging = false; setHover(null); });
        el.addEventListener('wheel', function (e) {
            e.preventDefault();
            want.dist *= (1 + (e.deltaY > 0 ? 1 : -1) * 0.09);
            clampCam(want); idleAt = Date.now();
        }, { passive: false });

        // มือถือ: สองนิ้วจีบเพื่อซูม
        el.addEventListener('touchmove', function (e) {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY);
            if (pinch) { want.dist *= pinch / d; clampCam(want); }
            pinch = d; idleAt = Date.now();
        }, { passive: false });
        el.addEventListener('touchend', function () { pinch = 0; });
    }

    // ---------- ชี้ / คลิก ----------
    var ray = null, ndc = null;
    function pickAt(e) {
        var r = renderer.domElement.getBoundingClientRect();
        ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        var hit = ray.intersectObjects(pickables, false);
        return hit.length ? hit[0].object : null;
    }
    function setHover(m) {
        if (hoverMesh === m) return;
        if (hoverMesh) applyEmissive(hoverMesh, 0x000000);
        hoverMesh = m;
        if (hoverMesh) applyEmissive(hoverMesh, 0x1d4e73);
        renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
    }
    function applyEmissive(mesh, hex) {
        var ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        ms.forEach(function (mm) { if (mm.emissive) mm.emissive.setHex(hex); });
    }
    function hoverTest(e) { setHover(pickAt(e)); }
    function clickTest(e) {
        var m = pickAt(e);
        if (!m) return;
        selectedKey = m.userData.key;
        focusOn(selectedKey);
        if (onPick) onPick(selectedKey);
    }

    // ==========================================================
    // หมุนรอบแบบภาพยนตร์ 1 รอบ (หน้าปกโหมดนำเสนอ)
    // ==========================================================
    var spin = null, autoRotate = true;
    function spinOnce(ms, done) {
        resetView();
        spin = { t0: performance.now(), dur: ms || 16000, az0: want.az, done: done || null };
    }
    function spinStep() {
        var p = Math.min(1, (performance.now() - spin.t0) / spin.dur);
        var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // ค่อย ๆ เร่ง แล้วค่อย ๆ ผ่อน
        var s = Math.sin(p * Math.PI);
        want.az = spin.az0 + Math.PI * 2 * e;
        want.pol = 0.74 + 0.16 * s;                // กลางรอบโฉบต่ำลงเห็นด้านข้างอาคาร
        want.dist = fitDist() * (1 - 0.22 * s);    // และเข้าใกล้ขึ้นเล็กน้อย
        idleAt = Date.now();
        if (p >= 1) { var d = spin.done; spin = null; if (d) d(); }
    }

    // ==========================================================
    // จำลองรถสายตรวจวิ่งเข้า สน. — มุมมองคนขับ + ภาพมุมสูงติดตาม (ภาพซ้อน)
    // เส้นทาง (ชิดซ้ายตามกฎจราจรไทย): ถนนใหญ่ → ข้ามสะพานเข้าซอย → เลี้ยวซ้ายเข้าประตูหลัก (ช่องกลาง)
    // → เลี้ยวซ้ายผ่านหน้าอาคารที่ทำการ → ขวา ข้าง สน. → ขวา ด้านหลัง สน. → ขวา ถนนกลาง (ครบ 1 รอบ)
    // → เลี้ยวซ้ายเข้าระหว่างอาคารที่พัก → ขวาออกถนนท้ายแปลง → ขวาตามซอยผ่านหน้า สน. → ออกถนนใหญ่
    // ==========================================================
    var DRIVE_ROUTE = [
        { p: [12.0, 0.8], say: 'ถนนคลองสิบ–คลองสิบสี่' },
        { p: [4.25, 0.8], say: 'เลี้ยวซ้ายข้ามสะพาน เข้าซอยคลองสิบ–สิบสี่ 7' },
        { p: [4.25, 13.2], say: 'เลี้ยวซ้ายเข้า สน. — ถนน 2 เลนสวนกันได้' },
        { p: [7.0, 13.2], say: 'เลี้ยวซ้าย ผ่านหน้าอาคารที่ทำการ (เลนเดียว)' },
        { p: [7.0, 4.2], say: 'เลี้ยวขวา ถนนข้าง สน. 2 เลน' },
        { p: [14.6, 4.2], say: 'เลี้ยวขวา วนไปด้านหลัง สน.' },
        { p: [14.6, 13.7], say: 'เลี้ยวขวา ถนน 2 เลนกลาง สน.' },
        { p: [10.95, 13.7], say: 'เลี้ยวซ้าย เข้าระหว่างอาคารที่พัก' },
        { p: [10.95, 24.6], say: 'เลี้ยวขวาออก ถนนท้ายแปลง' },
        { p: [3.45, 24.6], say: 'เลี้ยวขวา วิ่งตามซอยผ่านหน้า สน.ลำหิน' },
        { p: [3.45, 0.3], say: 'เลี้ยวขวาออกถนนคลองสิบ–คลองสิบสี่' },
        { p: [11.0, 0.3], say: 'สิ้นสุดการจำลอง' }
    ];
    var DRIVE_SPEED = 2.8;      // หน่วยผัง/วินาที (1 หน่วย ≈ 6 ม.) → ราว 35 วินาทีทั้งเส้นทาง
    var drive = null;

    function policeCar() {
        var g = new THREE.Group();
        var white = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
        var b = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 0.42), white);
        b.position.y = 0.2; b.castShadow = true; g.add(b);
        var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.43), new THREE.MeshLambertMaterial({ color: 0x1e3a8a }));
        stripe.position.y = 0.21; g.add(stripe);
        var c = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.36), new THREE.MeshLambertMaterial({ color: 0x9cc7e6 }));
        c.position.set(-0.04, 0.42, 0); c.castShadow = true; g.add(c);
        [[0.3, 0.19], [0.3, -0.19], [-0.3, 0.19], [-0.3, -0.19]].forEach(function (w) {
            var t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 8), new THREE.MeshLambertMaterial({ color: 0x1b1f26 }));
            t.rotation.x = Math.PI / 2; t.position.set(w[0], 0.1, w[1]); g.add(t);
        });
        // ไฟไซเรนแดง-น้ำเงินบนหลังคา (กะพริบตอนวิ่ง)
        var red = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.15), new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0x000000 }));
        var blue = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.15), new THREE.MeshLambertMaterial({ color: 0x3b82f6, emissive: 0x000000 }));
        red.position.set(-0.04, 0.545, 0.085); blue.position.set(-0.04, 0.545, -0.085);
        g.add(red); g.add(blue);
        // ไฟหน้า
        [0.11, -0.11].forEach(function (z) {
            var hl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.08), new THREE.MeshLambertMaterial({ color: 0xfff7cc, emissive: 0x665c1f }));
            hl.position.set(0.48, 0.24, z); g.add(hl);
        });
        g.userData.lights = [red, blue];
        return g;
    }

    function buildRoute() {
        var pts = DRIVE_ROUTE.map(function (w) { return new THREE.Vector3(wx(w.p[0]), 0, wz(w.p[1])); });
        var path = new THREE.CurvePath(), cur = pts[0].clone(), corner = [0];
        for (var i = 1; i < pts.length; i++) {
            var a = pts[i - 1], b = pts[i];
            if (i < pts.length - 1) {
                var c = pts[i + 1];
                var r = Math.min(0.7, a.distanceTo(b) / 2, b.distanceTo(c) / 2);   // มุมเลี้ยวโค้งมน
                var p1 = b.clone().addScaledVector(b.clone().sub(a).normalize(), -r);
                var p2 = b.clone().addScaledVector(c.clone().sub(b).normalize(), r);
                path.add(new THREE.LineCurve3(cur, p1));
                corner.push(path.curves.length);             // คำบรรยายจุดที่ i เริ่มที่โค้งนี้
                path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
                cur = p2;
            } else {
                path.add(new THREE.LineCurve3(cur, b));
                corner.push(path.curves.length);
            }
        }
        var lens = path.getCurveLengths(), total = path.getLength();
        var at = corner.map(function (ci) { return ci ? lens[ci - 1] / total : 0; });
        return { path: path, total: total, at: at };
    }

    function startDrive(onEnd) {
        if (!renderer) return;
        stopDrive(true);
        spin = null;
        var R = buildRoute();
        var carObj = policeCar();
        scene.add(carObj);
        var dcam = new THREE.PerspectiveCamera(96, 1, 0.02, 160);   // เลนส์มุมกว้าง เห็นถนนและสองข้างทางได้มากขึ้น
        drive = {
            route: R, car: carObj, cam: dcam, u: 0, t0: performance.now(), last: performance.now(),
            swap: false, look: null, cap: -1, onEnd: onEnd || null, y: 0.09, az: null
        };
        driveHud(true);
        idleAt = Date.now();
    }
    function stopDrive(silent) {
        if (!drive) return;
        if (drive.car && scene) scene.remove(drive.car);
        var cb = drive.onEnd;
        drive = null;
        driveHud(false);
        if (!silent) { resetView(); if (cb) cb(); }
    }
    function inYard(x, y) { return x >= PLAN.yard.x && x <= PLAN.yard.x + PLAN.yard.w && y >= PLAN.yard.y && y <= PLAN.yard.y + PLAN.yard.d; }

    function driveStep(now) {
        var D = drive, R = D.route;
        var dt = Math.min(0.05, (now - D.last) / 1000); D.last = now;
        var el = (now - D.t0) / 1000;
        var remain = (1 - D.u) * R.total;
        var k = Math.min(1, el / 1.6) * Math.min(1, 0.25 + remain / 2.5);    // ออกตัวนุ่ม ๆ / ชะลอก่อนจบ
        D.u = Math.min(1, D.u + DRIVE_SPEED * k * dt / R.total);

        var p = R.path.getPointAt(D.u), tg = R.path.getTangentAt(D.u);
        var px = p.x + (SITE.x + SITE.w / 2), py = p.z + (SITE.y + SITE.d / 2);
        D.y += ((inYard(px, py) ? 0.17 : 0.09) - D.y) * 0.15;   // ขึ้นลาน สน. สูงกว่าถนนนิดหน่อย
        D.car.position.set(p.x, D.y, p.z);
        D.car.rotation.y = Math.atan2(-tg.z, tg.x);
        var blink = Math.floor(el * 4) % 2;
        D.car.userData.lights[0].material.emissive.setHex(blink ? 0xb91c1c : 0x200000);
        D.car.userData.lights[1].material.emissive.setHex(blink ? 0x0b1f4d : 0x1d4ed8);

        // มุมมองคนขับ: ตาอยู่ในห้องโดยสาร มองไปข้างหน้าตามเส้นทาง
        var ahead = R.path.getPointAt(Math.min(1, D.u + 2.4 / R.total));
        var eye = new THREE.Vector3(p.x - tg.x * 0.05, D.y + 0.5, p.z - tg.z * 0.05);   // ถอยหลังนิด ยกสูงนิด ให้เห็นฝากระโปรงหน้า
        var lookT = new THREE.Vector3(ahead.x, D.y + 0.4, ahead.z);
        if (!D.look) D.look = lookT.clone(); else D.look.lerp(lookT, 0.12);
        D.cam.position.copy(eye);
        D.cam.lookAt(D.look);

        // มุมสูงติดตาม: กล้องหลักลอยตามหลังรถเฉียง ๆ
        var behind = Math.atan2(-tg.x, -tg.z) + 0.55;
        if (D.az == null) D.az = behind;
        var dA = behind - D.az; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); D.az += dA * 0.06;
        want.az = D.az; want.pol = 0.62; want.dist = fitDist() * 0.4;   // มุมค่อนข้างสูง ตึกที่พัก 4 ชั้นไม่บังรถ
        want.tx = p.x; want.ty = 0.5; want.tz = p.z;
        idleAt = Date.now();

        // คำบรรยายตามช่วงทาง
        var ci = 0;
        for (var i = 0; i < R.at.length; i++) if (D.u >= R.at[i] - 1e-6) ci = i;
        if (ci !== D.cap) { D.cap = ci; driveCaption(DRIVE_ROUTE[ci].say); }
        if (hud.bar) hud.bar.style.width = (D.u * 100).toFixed(1) + '%';
        if (D.u >= 1 && !D.ending) {
            D.ending = true;
            setTimeout(function () { if (drive === D) stopDrive(false); }, 1600);
        }
    }

    // ---------- แผงควบคุม/คำบรรยายระหว่างจำลอง (สร้างในกรอบแผนที่) ----------
    var hud = {};
    function driveHud(on) {
        if (!host) return;
        if (!on) {
            ['box', 'pip', 'tag'].forEach(function (k) { if (hud[k] && hud[k].parentNode) hud[k].parentNode.removeChild(hud[k]); });
            hud = {};
            if (host.classList) host.classList.remove('dash3d-driving');
            return;
        }
        host.classList.add('dash3d-driving');
        var box = document.createElement('div');
        box.className = 'dash3d-drive';
        box.innerHTML = '<div class="dd-cap"><i class="fas fa-car-side"></i><span>-</span></div>'
            + '<div class="dd-bar"><i></i></div>'
            + '<div class="dd-btns"><button type="button" data-a="swap"><i class="fas fa-repeat"></i> สลับมุมมอง</button>'
            + '<button type="button" data-a="stop"><i class="fas fa-stop"></i> หยุด</button></div>';
        box.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button') : null; if (!b || !drive) return;
            if (b.getAttribute('data-a') === 'swap') { drive.swap = !drive.swap; drivePipLabel(); }
            else stopDrive(false);
        });
        var pip = document.createElement('div'); pip.className = 'dash3d-pip'; pip.innerHTML = '<span></span>';
        var tag = document.createElement('div'); tag.className = 'dash3d-viewtag';
        host.appendChild(box); host.appendChild(pip); host.appendChild(tag);
        hud = { box: box, pip: pip, tag: tag, cap: box.querySelector('.dd-cap span'), bar: box.querySelector('.dd-bar i') };
        drivePipLabel();
    }
    function drivePipLabel() {
        if (!hud.pip || !drive) return;
        hud.pip.querySelector('span').textContent = drive.swap ? 'มุมมองคนขับ' : 'มุมสูงติดตาม';
        hud.tag.innerHTML = '<i class="fas ' + (drive.swap ? 'fa-plane' : 'fa-car') + '"></i> ' + (drive.swap ? 'มุมสูงติดตาม' : 'มุมมองคนขับ');
    }
    function driveCaption(t) {
        if (!hud.cap) return;
        hud.cap.textContent = t;
        hud.box.classList.remove('dd-flash'); void hud.box.offsetWidth; hud.box.classList.add('dd-flash');
    }
    // กรอบภาพซ้อน (มุมขวาบน) — คิดเป็นพิกเซลของกรอบแผนที่
    function pipRect(w, h) {
        var iw = Math.round(Math.max(150, Math.min(w * 0.34, 380))), ih = Math.round(iw * 0.62);
        return { x: w - iw - 12, y: 12, w: iw, h: ih };
    }
    function renderDrive() {
        var w = host.clientWidth || 800, h = host.clientHeight || 460;
        var mainCam = drive.swap ? camera : drive.cam, insetCam = drive.swap ? drive.cam : camera;
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        mainCam.aspect = w / h; mainCam.updateProjectionMatrix();
        renderer.render(scene, mainCam);
        var r = pipRect(w, h);
        renderer.setScissorTest(true);
        renderer.setScissor(r.x, h - r.y - r.h, r.w, r.h);
        renderer.setViewport(r.x, h - r.y - r.h, r.w, r.h);
        insetCam.aspect = r.w / r.h; insetCam.updateProjectionMatrix();
        renderer.render(scene, insetCam);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        if (hud.pip) { hud.pip.style.left = r.x + 'px'; hud.pip.style.top = r.y + 'px'; hud.pip.style.width = r.w + 'px'; hud.pip.style.height = r.h + 'px'; }
    }

    // ==========================================================
    // วงรอบวาดภาพ
    // ==========================================================
    function tick() {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        var now = performance.now();

        if (drive) driveStep(now);
        else if (spin) spinStep();
        // หมุนเองเมื่อไม่มีใครแตะ 6 วินาที
        else if (autoRotate && Date.now() - idleAt > 6000) want.az += 0.0016;

        // เคลื่อนกล้องแบบนุ่มนวล
        cam.az += (want.az - cam.az) * 0.12;
        cam.pol += (want.pol - cam.pol) * 0.12;
        cam.dist += (want.dist - cam.dist) * 0.12;
        cam.tx += (want.tx - cam.tx) * 0.1;
        cam.ty += (want.ty - cam.ty) * 0.1;
        cam.tz += (want.tz - cam.tz) * 0.1;
        applyCamera();
        if (drive) renderDrive();
        else renderer.render(scene, camera);
        updateLabels();
    }

    // ---------- ป้ายข้อมูลลอยเหนืออาคาร (HTML วางทับ canvas) ----------
    var v3 = null;
    function updateLabels() {
        if (!labels.length) return;
        // ระหว่างจำลองรถ ภาพหลักอาจเป็นมุมคนขับ — ป้ายอาคารจะวางผิดที่ จึงซ่อนไว้
        if (drive) { labels.forEach(function (L) { L.el.style.opacity = 0; }); return; }
        var r = renderer.domElement.getBoundingClientRect();
        labels.forEach(function (L) {
            var a = ANCHOR[L.anchor]; if (!a) return;
            v3.set(wx(a[0]), a[1], wz(a[2]));
            v3.project(camera);
            var x = (v3.x * 0.5 + 0.5) * r.width;
            var y = (-v3.y * 0.5 + 0.5) * r.height;
            var depth = v3.z;
            L.el.style.transform = 'translate(-50%,-100%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
            L.el.style.opacity = (depth > 1 || depth < -1) ? 0 : 1;
            L.el.style.zIndex = String(1000 - Math.round(depth * 500));
        });
    }

    // ==========================================================
    // API
    // ==========================================================
    function init(hostEl, labelDefs, pickCb) {
        THREE = window.THREE;
        if (!THREE) return false;
        host = hostEl;
        onPick = pickCb || null;
        canvasWrap = host;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.className = 'dash3d-canvas';
        renderer.domElement.style.cursor = 'grab';
        host.appendChild(renderer.domElement);

        camera = new THREE.PerspectiveCamera(38, 1, 0.5, 220);
        ray = new THREE.Raycaster();
        ndc = new THREE.Vector2();
        v3 = new THREE.Vector3();

        buildScene();
        want.dist = cam.dist = fitDist();
        bindControls(renderer.domElement);
        setLabels(labelDefs || []);
        resize();
        applyCamera();
        idleAt = Date.now();
        if (!running) { running = true; tick(); }
        return true;
    }

    function setLabels(defs) {
        labels.forEach(function (L) { if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el); });
        labels = [];
        defs.forEach(function (d) {
            var el = document.createElement('div');
            el.className = 'dash3d-pin';
            el.style.setProperty('--pc', d.color);
            el.innerHTML = '<div class="dash3d-pill"><i class="' + d.icon + '"></i><b>' + d.val + '</b>' + d.unit + '</div>'
                + '<div class="dash3d-stem"></div>';
            el.onclick = function () { selectedKey = d.anchor; focusOn(d.anchor); if (onPick) onPick(d.anchor); };
            host.appendChild(el);
            labels.push({ el: el, anchor: d.anchor });
        });
        updateLabels();
    }

    function resize() {
        if (!renderer || !host) return;
        var oldFit = fitDist();
        var w = host.clientWidth || 800, h = host.clientHeight || 460;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        var k = oldFit ? (want.dist / oldFit) : 1;
        want.dist = fitDist() * k;
        cam.dist = want.dist;
        clampCam(want);
        applyCamera();
        updateLabels();
    }

    function setVisible(v) { visible = !!v; if (v) { resize(); idleAt = Date.now(); } }
    function dispose() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0; running = false;
        if (renderer) { renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
        renderer = null; scene = null; labels = [];
    }

    function zoom(dir) {
        want.dist *= (dir > 0 ? 1.18 : 0.85);
        clampCam(want); idleAt = Date.now();
    }

    function setView(az, pol, dist) {
        if (az != null) want.az = az;
        if (pol != null) want.pol = pol;
        if (dist != null) want.dist = dist;
        clampCam(want); idleAt = Date.now();
    }

    return {
        init: init, resize: resize, resetView: resetView, focusOn: focusOn, setView: setView, zoom: zoom,
        setLabels: setLabels, setVisible: setVisible, dispose: dispose,
        spin: spinOnce, setAutoRotate: function (v) { autoRotate = !!v; if (!v) spin = null; else idleAt = Date.now(); },
        startDrive: startDrive, stopDrive: function () { stopDrive(false); }, isDriving: function () { return !!drive; },
        isReady: function () { return !!renderer; },
        PLAN: PLAN
    };
})();

if (typeof module !== 'undefined') module.exports = LamhinScene;
