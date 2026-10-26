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
    var SITE = { x: 1.6, y: -6.0, w: 18.0, d: 35.0 };  // ขอบเขตแท่นฐานที่มองเห็น (เหนือ สน. เป็นทุ่งยาวถึงคลองสนาม)

    var PLAN = {
        // ตามภาพดาวเทียม คลองสนามอยู่เหนือ สน. ไปไกล (ย่อระยะลงให้พอดีแท่น) — ระหว่างนั้นเป็นทุ่ง/ที่รกร้าง
        mainRoad: { x: 1.6, y: -6.0, w: 18.0, d: 1.1 },   // ถนนคลองสิบ-คลองสิบสี่
        canal: { x: 1.6, y: -4.9, w: 18.0, d: 1.5 },      // คลองสนาม
        bankRoad: { x: 1.6, y: -3.4, w: 18.0, d: 0.45 },  // ถนนเลียบคลองฝั่งใต้
        scrub: { x: 1.6, y: -2.95, w: 1.4, d: 31.95 },    // ที่รกร้างฝั่งตะวันตก
        soi: { x: 3.0, y: -3.4, w: 1.7, d: 32.4 },        // ซอยคลองสิบ-สิบสี่ 7 (ข้ามสะพานคลองไปถนนใหญ่)
        fieldN: { x: 4.7, y: -2.95, w: 8.87, d: 6.35 },   // ทุ่ง/ที่ว่างระหว่างคลองกับ สน.
        warehouse: { x: 5.3, y: -2.75, w: 1.7, d: 1.15 }, // โกดังหลังคาเทาริมคลอง
        paddyE: { x: 13.57, y: -2.95, w: 6.03, d: 29.65 }, // นาข้าวฝั่งตะวันออก (ติดรั้วหลัง สน.)
        paddyS: { x: 4.7, y: 26.6, w: 8.87, d: 2.4 },     // นาข้าวด้านใต้
        yard: { x: 4.7, y: 3.4, w: 8.87, d: 23.2 },        // เขตโรงพัก (ลาดยางทั้งแปลง) — รั้วหลังชิดเข้ามาตามภาพดาวเทียม

        // ---- โซนเหนือ: อาคารที่ทำการ ----
        station: { x: 7.7, y: 5.3, w: 2.8, d: 6.6 },      // หน้าอาคารยาวราว 44 ม. ลึกราว 17 ม. (ด้านข้างจอดรถได้ราว 2 คันตามภาพ)
        driveN: { x: 4.9, y: 3.6, w: 8.05, d: 1.7 },      // ถนนข้าง สน. (ด้านเหนือ) 2 เลน + จอดชิดตึก
        parkN: { x: 5.24, y: 5.6, w: 1.05, d: 5.6 },      // ช่องจอดหน้า สน. ชิดฟุตบาธ (6 ช่อง)
        laneN: { x: 6.29, y: 3.6, w: 1.41, d: 9.1 },      // ผ่านหน้าอาคาร: เลนเดียว กว้างราว 1 เลนครึ่ง
        driveE: { x: 11.3, y: 3.6, w: 1.65, d: 9.1 },      // ด้านหลัง สน. (หลังส่วนต่อเติม 2.5 ม. + ฟุตบาธ) จอดชิดรั้วได้แถวเดียว      // ด้านหลัง สน. 2 เลน (จอดชิดฟุตบาธ เหลือวิ่ง 1 เลน)
        apron: { x: 7.3, y: 8.0, w: 0.4, d: 2.3 },        // ลานปูนหน้าทางเข้าอาคาร

        // ---- ถนนกลาง: ประตูหลัก 2 เลนสวนกันได้ ----
        driveMid: { x: 4.7, y: 12.4, w: 8.35, d: 1.45 },

        // ---- โซนใต้: อาคารที่พัก 2 หลัง ขนาดเท่ากัน ----
        // อาคารที่พักยาวราว 1.4 เท่าของอาคารที่ทำการ กว้างกว่าเล็กน้อย (ตามภาพดาวเทียม)
        parkS: { x: 4.74, y: 13.85, w: 1.06, d: 10.3 },   // ลานจอดหน้าแฟลต (เปิดโล่งถึงซอย ใช้ซอยเป็นทางเข้าออก)
        // ลึกราว 16 ม. รวมระเบียง (น้อยกว่าอาคารที่ทำการที่ราว 22 ม. รวมชายคา) — วางให้พอดีรั้วหลังที่ขยับเข้ามา
        flat1: { x: 5.9, y: 13.85, w: 2.7, d: 10.3 },     // หลังตะวันตก — หลังคาเทา
        driveBtw: { x: 8.6, y: 13.85, w: 1.7, d: 11.7 },  // ช่องทางรถระหว่างอาคาร (จอดได้ 2 ฝั่ง)
        flat2: { x: 10.3, y: 13.85, w: 2.7, d: 10.3 },    // หลังตะวันออก — หลังคาแดง (ขนาดเท่าหลังแรก)
        driveS: { x: 4.7, y: 24.15, w: 8.35, d: 1.4 },    // ถนนท้ายแปลง — เลี้ยวขวาออกซอย

        guard: { x: 5.0, y: 11.9, w: 0.85, d: 0.85 }      // ป้อมยามประตูหลัก
    };

    // ช่องเปิดของรั้ว — มีเฉพาะด้านตะวันตก (ติดซอย) ช่วงกลางลงมาเท่านั้น
    // หน้าอาคารที่ทำการเป็นกำแพงทึบตลอดแนว (ไม่มีประตูด้านเหนือ) · ด้านเหนือ/ตะวันออก/ใต้ เป็นกำแพงทึบ
    var GATES = [
        { y: 12.4, d: 12.65 }    // ประตูหลัก (ช่องกลาง) + หน้าอาคารที่พัก (เปิดโล่ง) + ทางออกท้ายแปลง
    ];

    // ฟุตบาธปูนเลียบรั้ว — มีทุกด้านที่มีกำแพง
    var WALKS = [
        { x: 4.84, y: 3.54, w: 8.61, d: 0.4 },      // เหนือ
        { x: 4.84, y: 26.06, w: 8.61, d: 0.4 },     // ใต้ (หลังดงไม้ท้ายแปลง)
        { x: 13.05, y: 3.94, w: 0.4, d: 22.12 },    // ตะวันออก
        { x: 4.84, y: 3.94, w: 0.4, d: 8.46 },      // ตะวันตก (ช่วงอาคารที่ทำการ)
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

    // ผิวอาคารที่พัก (1 แผ่น = ราว 1.1 หน่วยตามยาว, 64 px ต่อชั้น)
    //   outer = ด้านนอก: หน้าต่างกรอบน้ำเงินเข้ม มีกันสาดเล็ก + แอร์บางห้อง
    //   corr  = ด้านระเบียง: ประตูห้องไม้ + หน้าต่างเล็ก (ช่วงล่างถูกผนังราวระเบียงบัง)
    //   end   = หัวท้ายตึก: ผนังเรียบ หน้าต่างเล็กกลางผนัง
    function flatTexture(kind, floors) {
        var key = 'flat|' + kind + '|' + floors;
        if (texCache[key]) return texCache[key];
        var c = document.createElement('canvas');
        c.width = 256; c.height = 64 * floors;
        var g = c.getContext('2d');
        g.fillStyle = kind === 'corr' ? '#e7ebf0' : '#f2f4f7'; g.fillRect(0, 0, c.width, c.height);
        for (var f = 0; f < floors; f++) {
            var y0 = f * 64;
            g.fillStyle = '#dde2e8'; g.fillRect(0, y0 + 61, 256, 3);           // แนวพื้นแต่ละชั้น
            if (kind === 'outer') {
                [30, 150].forEach(function (x, i) {
                    g.fillStyle = '#c9d0d8'; g.fillRect(x - 6, y0 + 10, 78, 6);     // กันสาด
                    g.fillStyle = '#2f4a66'; g.fillRect(x, y0 + 17, 66, 32);        // กรอบ
                    g.fillStyle = '#5d7d9c'; g.fillRect(x + 3, y0 + 20, 28, 26); g.fillRect(x + 35, y0 + 20, 28, 26);
                    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 3, y0 + 20, 28, 7);
                    if ((f + i) % 2 === 0) {                                          // แอร์
                        g.fillStyle = '#e3e6ea'; g.fillRect(x + 72, y0 + 30, 26, 18);
                        g.fillStyle = '#9aa3ad'; for (var k = 0; k < 4; k++) g.fillRect(x + 75, y0 + 33 + k * 4, 20, 1);
                    }
                });
            } else if (kind === 'corr') {
                [40, 168].forEach(function (x) {
                    g.fillStyle = '#8a6a4c'; g.fillRect(x, y0 + 12, 24, 49);         // ประตูห้อง
                    g.fillStyle = '#6e5238'; g.fillRect(x + 2, y0 + 14, 20, 2);
                    g.fillStyle = '#41566e'; g.fillRect(x + 38, y0 + 16, 40, 20);     // หน้าต่างเล็ก
                    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x + 38, y0 + 16, 40, 5);
                });
            } else {
                g.fillStyle = '#41566e'; g.fillRect(112, y0 + 20, 32, 20);
            }
        }
        var t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
        texCache[key] = t; return t;
    }

    function corrTexture() {
        if (texCache.corr) return texCache.corr;
        var c = document.createElement('canvas');
        c.width = 64; c.height = 16;
        var g = c.getContext('2d');
        g.fillStyle = '#f7f8fa'; g.fillRect(0, 0, 64, 16);
        for (var i = 0; i < 8; i++) { g.fillStyle = '#dfe3e8'; g.fillRect(i * 8 + 5, 0, 2, 16); g.fillStyle = '#ffffff'; g.fillRect(i * 8 + 1, 0, 2, 16); }
        var t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        texCache.corr = t; return t;
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
        s *= 0.62;   // ต้นไม้สูงราว 8–12 ม. เทียบกับอาคารที่ปรับสัดส่วนตามจริง
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

    // ---------- รถยนต์ (เก๋ง / กระบะ) ----------
    // โครงด้านข้างรีดเป็นตัวถังโค้งมน + ห้องโดยสารกระจกเข้ม หลังคาสีตัวรถ + ล้อแม็ก + ไฟหน้า/ท้าย/กระจกข้าง
    // ขนาด (1 หน่วย ≈ 6 ม.): ยาว ~5 ม. กว้าง ~2.2 ม. สูง ~1.8 ม. — ใหญ่กว่าของจริงเล็กน้อยให้มองเห็นชัด
    // หัวรถอยู่ด้าน +x · จุดอ้างอิงอยู่ที่พื้น (ล้อแตะ y = 0)
    var CAR_W = 0.32, carGeo = null, carMatCache = {}, carSeq = 0;   // กว้างราว 1.9 ม.
    function carShape(pts) {
        var s = new THREE.Shape();
        s.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) {
            var p = pts[i];
            if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]);
        }
        return s;
    }
    function carExtrude(pts, width, bevel) {
        var g = new THREE.ExtrudeGeometry(carShape(pts), {
            depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6,
            bevelSegments: 2, curveSegments: 8
        });
        g.translate(0, 0, -(width - bevel * 2) / 2);
        return g;
    }
    function carGeometry() {
        if (carGeo) return carGeo;
        carGeo = {
            sedan: {
                body: carExtrude([[-0.395, 0.055], [0.385, 0.055], [0.415, 0.06, 0.413, 0.11], [0.41, 0.152, 0.37, 0.162],
                    [0.16, 0.183], [-0.27, 0.188], [-0.39, 0.183, -0.405, 0.15], [-0.418, 0.08, -0.395, 0.055]], CAR_W, 0.02),
                cabin: carExtrude([[0.165, 0.18], [0.07, 0.268, 0.03, 0.284], [-0.15, 0.29], [-0.225, 0.285, -0.29, 0.186]], CAR_W - 0.05, 0.012),
                roof: { x: -0.06, l: 0.19, y: 0.288 }, wheelX: 0.255, frontX: 0.414, backX: -0.41, lightY: 0.135
            },
            pickup: {
                body: carExtrude([[-0.43, 0.065], [0.4, 0.065], [0.432, 0.07, 0.43, 0.12], [0.428, 0.165, 0.385, 0.176],
                    [0.17, 0.2], [-0.43, 0.205], [-0.432, 0.12]], CAR_W + 0.01, 0.018),
                cabin: carExtrude([[0.172, 0.196], [0.11, 0.285, 0.075, 0.305], [-0.1, 0.31], [-0.118, 0.196]], CAR_W - 0.04, 0.012),
                roof: { x: -0.012, l: 0.17, y: 0.309 }, bed: true, wheelX: 0.275, frontX: 0.432, backX: -0.432, lightY: 0.15
            },
            tire: new THREE.CylinderGeometry(0.072, 0.072, 0.05, 18),
            rim: new THREE.CylinderGeometry(0.042, 0.042, 0.054, 12),
            box: new THREE.BoxGeometry(1, 1, 1)
        };
        return carGeo;
    }
    function carMat(hex, kind) {
        var k = kind + hex;
        if (carMatCache[k]) return carMatCache[k];
        var m = kind === 'paint' ? new THREE.MeshPhongMaterial({ color: hex, shininess: 70, specular: 0x666666 })
            : kind === 'glass' ? new THREE.MeshPhongMaterial({ color: 0x1f2c3a, shininess: 110, specular: 0xaabbcc })
            : kind === 'glow' ? new THREE.MeshLambertMaterial({ color: hex, emissive: hex === 0xfff4cc ? 0x8a7d4a : 0x5a0b0b })
            : new THREE.MeshLambertMaterial({ color: hex });
        carMatCache[k] = m; return m;
    }
    function carPart(parent, mat, sx, sy, sz, x, y, z) {
        var m = new THREE.Mesh(carGeometry().box, mat);
        m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m);
        return m;
    }
    /** โมเดลรถ 1 คัน: kind = 'sedan' | 'pickup' */
    function carModel(color, kind) {
        var G = carGeometry(), k = G[kind] || G.sedan, g = new THREE.Group();
        var paint = carMat(color, 'paint'), W = CAR_W;
        var body = new THREE.Mesh(k.body, paint); body.castShadow = true; g.add(body);
        // ห้องโดยสาร (กระจกเข้ม) + หลังคาสีตัวรถ — แยกกลุ่มไว้ซ่อนในมุมมองคนขับ
        var cab = new THREE.Group();
        var glass = new THREE.Mesh(k.cabin, carMat(0, 'glass')); glass.castShadow = true; cab.add(glass);
        carPart(cab, paint, k.roof.l, 0.014, W - 0.07, k.roof.x, k.roof.y, 0);
        g.add(cab);
        if (k.bed) carPart(g, carMat(0x2a2f37, 'flat'), 0.29, 0.012, W - 0.05, -0.27, 0.2, 0);   // กระบะท้าย
        // ล้อ + แม็ก
        [k.wheelX, -k.wheelX].forEach(function (x) {
            [1, -1].forEach(function (s) {
                var t = new THREE.Mesh(G.tire, carMat(0x15181d, 'flat'));
                t.rotation.x = Math.PI / 2; t.position.set(x, 0.072, s * (W / 2 - 0.02)); g.add(t);
                var r = new THREE.Mesh(G.rim, carMat(0xc9ced6, 'flat'));
                r.rotation.x = Math.PI / 2; r.position.set(x, 0.072, s * (W / 2 - 0.02)); g.add(r);
            });
        });
        // ไฟหน้า / กระจังหน้า / ไฟท้าย / กระจกมองข้าง
        [1, -1].forEach(function (s) {
            carPart(g, carMat(0xfff4cc, 'glow'), 0.014, 0.028, 0.07, k.frontX, k.lightY, s * 0.12);
            carPart(g, carMat(0xd61f1f, 'glow'), 0.012, 0.03, 0.06, k.backX, k.lightY + 0.01, s * 0.13);
            carPart(g, paint, 0.03, 0.022, 0.025, 0.13, k.cabin === G.pickup.cabin ? 0.215 : 0.2, s * (W / 2 + 0.012));
        });
        carPart(g, carMat(0x1d2128, 'flat'), 0.012, 0.03, 0.13, k.frontX + 0.002, k.lightY - 0.01, 0);
        g.userData.cabin = cab;
        return g;
    }
    // รถจอด: rotY = 0 คือหัวรถชี้ไปทางตะวันออก, Math.PI/2 คือชี้ไปทางเหนือ — ทุกคันที่ 3 เป็นรถกระบะ
    function car(x, z, color, rotY) {
        var g = carModel(color, (carSeq++ % 3 === 2) ? 'pickup' : 'sedan');
        g.position.set(wx(x), 0.19, wz(z));
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
        // เสาธงสูงราว 17 ม. (สูงกว่าอาคารที่ทำการ 2 ชั้นตามภาพ)
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 2.9, 8),
            new THREE.MeshLambertMaterial({ color: 0xd4dae2 }));
        p.position.y = 1.45; g.add(p);
        // ลูกกลมยอดเสา
        var knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
            new THREE.MeshLambertMaterial({ color: 0xe8c86a }));
        knob.position.y = 2.94; g.add(knob);
        // ฐานปูน
        var pad = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45),
            new THREE.MeshLambertMaterial({ color: 0xb9c1cb }));
        pad.position.y = 0.04; g.add(pad);
        // ผืนธง — ชักอยู่ใกล้ยอดเสา ด้านคันธงชิดเสา
        var fw = 0.66, fh = 0.44;
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
        flag.position.set(fw / 2 + 0.04, 2.62, 0);
        flag.castShadow = true;
        g.add(flag);
        g.position.set(wx(x), 0.16, wz(z));
        return g;
    }

    // ศาลพระภูมิ: เกาะยกพื้นปูอิฐแดง ขอบขาวแดง · เสาขาว + ตัวศาลทองทรงไทย หลังคาซ้อนชั้น ยอดแหลม · ป้ายทางเข้าแดง
    function shrine(x, z) {
        var g = new THREE.Group(), gold = new THREE.MeshLambertMaterial({ color: 0xe0b23a }), gold2 = new THREE.MeshLambertMaterial({ color: 0xf2cc55 });
        var IW = 0.82, ID = 0.66;
        var pad = new THREE.Mesh(new THREE.BoxGeometry(IW, 0.07, ID), new THREE.MeshLambertMaterial({ color: 0xb5523c }));
        pad.position.y = 0.035; pad.receiveShadow = true; g.add(pad);
        var t = curbTexture('red').clone(); t.needsUpdate = true; t.repeat.set(6, 1);
        var cm = new THREE.MeshLambertMaterial({ map: t });
        [[IW, 0, ID / 2, 0], [IW, 0, -ID / 2, 0], [ID, IW / 2, 0, 1], [ID, -IW / 2, 0, 1]].forEach(function (e) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(e[0], 0.09, 0.05), cm); m.position.set(e[1], 0.045, e[2]);
            if (e[3]) m.rotation.y = Math.PI / 2; g.add(m);
        });
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.09), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
        post.position.y = 0.07 + 0.2; g.add(post);
        var deck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.26), gold); deck.position.y = 0.485; g.add(deck);
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.17), gold2); body.position.y = 0.575; body.castShadow = true; g.add(body);
        [[0.2, 0.08, 0.67], [0.15, 0.08, 0.73], [0.1, 0.08, 0.79]].forEach(function (r) {     // หลังคาซ้อนชั้น
            var roof = new THREE.Mesh(new THREE.ConeGeometry(r[0], r[1], 4), gold); roof.rotation.y = Math.PI / 4; roof.position.y = r[2]; g.add(roof);
        });
        var spire = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 6), gold2); spire.position.y = 0.9; g.add(spire);
        // ป้าย "ทางเข้า Entrance"
        var sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.02), new THREE.MeshLambertMaterial({ color: 0x9aa4b1 }));
        sp.position.set(-IW / 2 + 0.08, 0.28, ID / 2 - 0.08); g.add(sp);
        var sb = signPlane('ทางเข้า Entrance', '#c62828', '#ffffff', 0.32, 0.08);
        sb.position.set(-IW / 2 + 0.08, 0.5, ID / 2 - 0.08); sb.rotation.y = -Math.PI / 2; g.add(sb);
        g.position.set(wx(x), 0.16, wz(z));
        return g;
    }

    function lamp(x, z, flip) {
        var g = new THREE.Group();
        // เสาไฟสูงราว 9 ม.
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.55, 6),
            new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
        p.position.y = 0.775; g.add(p);
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04),
            new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
        arm.position.set((flip ? -0.2 : 0.2), 1.54, 0); g.add(arm);
        var head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.14),
            new THREE.MeshLambertMaterial({ color: 0xfcd34d, emissive: 0x4a3c00 }));
        head.position.set((flip ? -0.38 : 0.38), 1.5, 0); g.add(head);
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

    function signPlane2(main, sub, wUnit, hUnit) {
        var c = document.createElement('canvas');
        c.width = 1024; c.height = 128;
        var g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.textAlign = 'center';
        g.font = 'bold 66px "Sarabun",system-ui,sans-serif'; g.textBaseline = 'alphabetic';
        g.fillText(main, 512, 72);
        g.font = '600 34px "Sarabun",system-ui,sans-serif';
        g.fillText(sub, 512, 116);
        return new THREE.Mesh(new THREE.PlaneGeometry(wUnit, hUnit),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    }
    // ขอบฟุตบาธทาสีสลับ (ขาวแดง / ขาวดำ) — กล่องยาวแนวแกน x หรือ y
    function meshTexture() {
        if (texCache.mesh) return texCache.mesh;
        var c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        var g = c.getContext('2d');
        g.clearRect(0, 0, 64, 64);
        g.strokeStyle = 'rgba(200,206,214,0.85)'; g.lineWidth = 1;
        for (var i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
        g.fillStyle = 'rgba(160,168,178,0.95)'; g.fillRect(0, 0, 3, 64); g.fillRect(0, 0, 64, 3);   // โครงเหล็ก
        var t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
        texCache.mesh = t; return t;
    }
    function curbTexture(kind) {
        var key = 'curb' + kind;
        if (texCache[key]) return texCache[key];
        var c = document.createElement('canvas');
        c.width = 64; c.height = 8;
        var g = c.getContext('2d');
        g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 64, 8);
        g.fillStyle = kind === 'red' ? '#d62f2f' : '#1f242b'; g.fillRect(32, 0, 32, 8);
        var t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        texCache[key] = t; return t;
    }
    function curb(x0, y0, x1, y1, kind, h) {
        var alongX = Math.abs(x1 - x0) >= Math.abs(y1 - y0), len = alongX ? Math.abs(x1 - x0) : Math.abs(y1 - y0);
        var t = curbTexture(kind).clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 0.32)), 1);
        var m = new THREE.Mesh(new THREE.BoxGeometry(len, h || 0.07, 0.05), new THREE.MeshLambertMaterial({ map: t }));
        m.position.set(wx((x0 + x1) / 2), 0.16 + (h || 0.07) / 2, wz((y0 + y1) / 2));
        if (!alongX) m.rotation.y = Math.PI / 2;
        return m;
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
        slab(PLAN.fieldN, 0xb8c98a, 0, 0.07);
        slab(PLAN.canal, COL.water, -0.14, 0.22);
        slab(PLAN.mainRoad, COL.road, 0, 0.1);
        slab(PLAN.bankRoad, COL.road, 0, 0.1);
        slab(PLAN.soi, COL.road, 0, 0.1);
        scene.add(plainBox(PLAN.warehouse, 0.07, 0.42, 0xd5dbe2));
        scene.add(plainBox(grow(PLAN.warehouse, 0.06), 0.49, 0.06, 0x9fb3c8));
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
        var YC = PLAN.yard.x + PLAN.yard.w / 2, YCy = PLAN.yard.y + PLAN.yard.d / 2;
        WALKS.forEach(function (r) {
            slab(r, COL.concrete, 0.16, 0.13, true);
            slab(r, 0xbac2cc, 0.29, 0.02, true);
            // ขอบฟุตบาธเลียบรั้วด้านในทาสีขาวดำเป็นช่วง ๆ (ตามภาพ)
            var c;
            if (r.w > r.d) { var ey = (r.y + r.d / 2 < YCy) ? r.y + r.d : r.y; c = curb(r.x, ey, r.x + r.w, ey, 'bw', 0.15); }
            else { var ex = (r.x + r.w / 2 < YC) ? r.x + r.w : r.x; c = curb(ex, r.y, ex, r.y + r.d, 'bw', 0.15); }
            scene.add(c);
        });

        var i;
        // เส้นช่องจอดหน้าอาคารที่ทำการ
        for (i = 1; i < 6; i++) {
            slab({ x: PLAN.parkN.x, y: PLAN.parkN.y + PLAN.parkN.d * i / 6 - 0.025, w: PLAN.parkN.w, d: 0.05 },
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
        dashLine(5.6, 13.12, 12.6, 13.12);      // ถนนกลาง
        dashLine(7.9, 4.39, 11.2, 4.39);        // ข้าง สน.
        dashLine(12.1, 5.4, 12.1, 12.2);        // ด้านหลัง สน.
        dashLine(5.6, 24.85, 12.5, 24.85);      // ท้ายแปลง
        // เส้นช่องจอดหน้าอาคารที่พัก
        for (i = 1; i < 9; i++) {
            slab({ x: PLAN.parkS.x + 0.1, y: PLAN.parkS.y + PLAN.parkS.d * i / 9 - 0.025, w: PLAN.parkS.w - 0.1, d: 0.05 },
                COL.line, 0.2, 0.02, true);
        }
        // เส้นแบ่งกลางซอย
        for (i = 0; i < 20; i++) {
            slab({ x: PLAN.soi.x + PLAN.soi.w / 2 - 0.05, y: PLAN.soi.y + 0.6 + i * 1.6, w: 0.1, d: 0.8 },
                0xd8c468, 0.1, 0.02, true);
        }

        // ---- รั้ว: ทึบทุกด้าน เว้นช่องเฉพาะด้านตะวันตก (ไม่มีทางออกด้านหลัง) ----
        var Y = PLAN.yard, fh = 0.32, fw = 0.12, fcol = 0xdbe2ea;   // กำแพงสูงราว 2 ม.
        scene.add(plainBox({ x: Y.x, y: Y.y, w: Y.w, d: fw }, 0.16, fh, fcol));                  // เหนือ
        scene.add(plainBox({ x: Y.x, y: Y.y + Y.d - fw, w: Y.w, d: fw }, 0.16, fh, fcol));        // ใต้
        scene.add(plainBox({ x: Y.x + Y.w - fw, y: Y.y, w: fw, d: Y.d }, 0.16, fh, fcol));        // ตะวันออก
        var cur = Y.y;
        GATES.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (gt) {
            if (gt.y > cur) scene.add(plainBox({ x: Y.x, y: cur, w: fw, d: gt.y - cur }, 0.16, fh, fcol));
            [gt.y - 0.1, gt.y + gt.d - 0.14].forEach(function (py) {      // เสาประตู
                scene.add(plainBox({ x: Y.x - 0.06, y: py, w: 0.22, d: 0.22 }, 0.16, 0.46, 0xf1f5f9));
            });
            cur = gt.y + gt.d;
        });
        if (cur < Y.y + Y.d) scene.add(plainBox({ x: Y.x, y: cur, w: fw, d: Y.y + Y.d - cur }, 0.16, fh, fcol));

        pickables = [];

        // ==========================================================
        // อาคารที่ทำการ 3 ชั้น (ตามภาพถ่ายหน้า/ข้าง สน.)
        // ชั้น 1: ผนังสีครีมน้ำตาล ฐานแดงสูง เสาขาวโคนแดง · ที่จอดใต้อาคารมุมหน้า-เหนือ (ไม่มีผนังด้านหน้า/ด้านถนน มีแต่เสา)
        // ชั้น 2: ยื่นออกเล็กน้อย แถบหน้าต่างกรอบขาวยาวต่อเนื่อง ขอบพื้นแผ่นลอนสีขาว
        // ชั้น 3: ระเบียงยื่นรอบตึก ครีบเสาขาวเรียงห่าง ๆ · ขอบหลังคาแผ่นลอนสีขาวหนา ป้าย POLICE แดงฝังในขอบหลังคา
        // หลังคาแบน (ดาดฟ้าสีแดงอิฐตามภาพดาวเทียม) + เสาอากาศโครงเหล็กสูง · ป้ายชื่อสถานีแดงที่ระดับชั้น 2 เหนือทางเข้า
        // ==========================================================
        var st = PLAN.station, g1 = new THREE.Group();
        var Y0 = 0.16, GF = 0.58, Y1 = Y0 + GF, F2 = 0.52, Y2 = Y1 + 0.07 + F2, F3 = 0.52, Y3 = Y2 + 0.09 + F3;
        var CARPORT = { x: st.x, y: st.y, w: st.w / 2, d: 2.6 };
        var gfParts = [
            { x: st.x + st.w / 2, y: st.y, w: st.w / 2, d: st.d },                         // ครึ่งหลังตลอดแนว
            { x: st.x, y: CARPORT.y + CARPORT.d, w: st.w / 2, d: st.d - CARPORT.d }        // ครึ่งหน้า (โถงทางเข้า)
        ];
        var gfTex = wallTexture(1, 0xcdb08d, 0x3c4b5c, 0xbfa27f);
        var lows = gfParts.map(function (r) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(r.w, GF, r.d),
                texMats(gfTex, r, Math.max(1, Math.round(r.w / 1.7)), Math.max(1, Math.round(r.d / 1.7)), 0xcdb08d));
            m.position.set(wx(r.x + r.w / 2), Y0 + GF / 2, wz(r.y + r.d / 2));
            m.castShadow = m.receiveShadow = true;
            g1.add(m);
            g1.add(plainBox(grow(r, 0.012), Y0, 0.13, COL.baseRed));                      // ฐานแดง
            return m;
        });
        // เสาขาวโคนแดง: มุมตึก + แนวที่จอดใต้อาคาร
        function whiteCol(x, y) {
            g1.add(plainBox({ x: x, y: y, w: 0.11, d: 0.11 }, Y0, GF, 0xf6f7f9));
            g1.add(plainBox({ x: x - 0.005, y: y - 0.005, w: 0.12, d: 0.12 }, Y0, 0.14, COL.baseRed));
        }
        g1.add(plainBox(CARPORT, Y0, 0.02, COL.concrete));
        [[st.x - 0.02, st.y - 0.02], [st.x - 0.02, st.y + 1.25], [st.x - 0.02, CARPORT.y + CARPORT.d - 0.1],
        [st.x + 1.35, st.y - 0.02], [st.x + CARPORT.w - 0.1, st.y - 0.02],
        [st.x - 0.02, st.y + st.d - 0.1], [st.x + st.w - 0.09, st.y - 0.02], [st.x + st.w - 0.09, st.y + st.d - 0.1]]
            .forEach(function (c) { whiteCol(c[0], c[1]); });

        // แผ่นลอนสีขาว (ขอบพื้น/ขอบหลังคา) — รอบตึกเป็นวง 4 ด้าน
        function corrRing(r, y, h) {
            var mat = function (len) {
                var t = corrTexture().clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 0.5)), 1);
                return new THREE.MeshLambertMaterial({ map: t });
            };
            [[{ x: r.x, y: r.y, w: r.w, d: 0.05 }, r.w], [{ x: r.x, y: r.y + r.d - 0.05, w: r.w, d: 0.05 }, r.w],
            [{ x: r.x, y: r.y, w: 0.05, d: r.d }, r.d], [{ x: r.x + r.w - 0.05, y: r.y, w: 0.05, d: r.d }, r.d]].forEach(function (p) {
                var m = new THREE.Mesh(new THREE.BoxGeometry(p[0].w, h, p[0].d), mat(p[1]));
                m.position.set(wx(p[0].x + p[0].w / 2), y + h / 2, wz(p[0].y + p[0].d / 2));
                m.castShadow = true; g1.add(m);
            });
        }
        // ---- ชั้น 2 ----
        var S2 = grow(st, 0.13);
        g1.add(plainBox(S2, Y1, 0.07, 0xf3f5f8));
        corrRing(grow(st, 0.15), Y1, 0.08);
        var winTex = wallTexture(1, 0xf3f5f7, 0x5a7590, 0xe4e8ed);
        var f2 = new THREE.Mesh(new THREE.BoxGeometry(S2.w, F2, S2.d),
            texMats(winTex, S2, Math.round(S2.w / 1.0), Math.round(S2.d / 1.0), 0xf3f5f7));
        f2.position.set(wx(S2.x + S2.w / 2), Y1 + 0.07 + F2 / 2, wz(S2.y + S2.d / 2));
        f2.castShadow = f2.receiveShadow = true; g1.add(f2);
        // ---- ชั้น 3: ระเบียงยื่น + ครีบเสาขาว ----
        var S3 = grow(st, 0.4);
        g1.add(plainBox(S3, Y2, 0.09, 0xf3f5f8));
        corrRing(grow(st, 0.42), Y2, 0.11);
        var W3 = grow(st, 0.13);
        var f3 = new THREE.Mesh(new THREE.BoxGeometry(W3.w, F3, W3.d),
            texMats(winTex, W3, Math.round(W3.w / 1.0), Math.round(W3.d / 1.0), 0xf3f5f7));
        f3.position.set(wx(W3.x + W3.w / 2), Y2 + 0.09 + F3 / 2, wz(W3.y + W3.d / 2));
        f3.castShadow = f3.receiveShadow = true; g1.add(f3);
        var finGeo = new THREE.BoxGeometry(0.06, F3, 0.13), finMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        var finPos = [], STEP = 0.62, FE = grow(st, 0.36);
        for (var fx = FE.x; fx <= FE.x + FE.w + 1e-6; fx += STEP) { finPos.push([fx, FE.y, 0]); finPos.push([fx, FE.y + FE.d, 0]); }
        for (var fy = FE.y + STEP; fy < FE.y + FE.d - 1e-6; fy += STEP) { finPos.push([FE.x, fy, 1]); finPos.push([FE.x + FE.w, fy, 1]); }
        var fins = new THREE.InstancedMesh(finGeo, finMat, finPos.length), fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fe = new THREE.Euler();
        finPos.forEach(function (p, i) {
            fe.set(0, p[2] ? 0 : Math.PI / 2, 0); fq.setFromEuler(fe);
            fm.compose(new THREE.Vector3(wx(p[0]), Y2 + 0.09 + F3 / 2, wz(p[1])), fq, new THREE.Vector3(1, 1, 1));
            fins.setMatrixAt(i, fm);
        });
        fins.castShadow = true; g1.add(fins);
        // ---- ขอบหลังคาแผ่นลอนหนา + ดาดฟ้า ----
        g1.add(plainBox(grow(st, 0.38), Y3, 0.04, 0xb45a46));
        corrRing(grow(st, 0.42), Y3, 0.22);
        // ป้าย POLICE: แผ่นแดงฝังในขอบหลังคาด้านหน้า ช่วงเหนือ (เหนือบันไดทางขึ้น)
        var SBC = PLAN.apron.y + PLAN.apron.d / 2;                 // แนวกึ่งกลางป้าย (เหนือบันไดทางขึ้น/ทางเข้า)
        var RF = grow(st, 0.42), PB = { y0: SBC - 1.15, d: 2.3 };
        g1.add(plainBox({ x: RF.x - 0.02, y: PB.y0, w: 0.03, d: PB.d }, Y3, 0.22, 0xb3261e));
        var sgn = signPlane('POLICE', null, '#ffffff', 2.1, 0.2);
        sgn.position.set(wx(RF.x - 0.04), Y3 + 0.11, wz(PB.y0 + PB.d / 2));
        sgn.rotation.y = -Math.PI / 2; g1.add(sgn);
        // ป้ายชื่อสถานี: แผ่นแดงระดับชั้น 2 เหนือทางเข้า
        var SB = { y: SBC - 1.25, d: 2.5 };
        g1.add(plainBox({ x: S2.x - 0.03, y: SB.y, w: 0.03, d: SB.d }, Y1 + 0.2, 0.16, 0xa8291f));
        var sgn2 = signPlane('สถานีตำรวจนครบาลลำหิน', null, '#ffffff', 2.3, 0.14);
        sgn2.position.set(wx(S2.x - 0.05), Y1 + 0.28, wz(SB.y + SB.d / 2));
        sgn2.rotation.y = -Math.PI / 2; g1.add(sgn2);
        // ป้าย "โรงพักเพื่อประชาชน" เหนือประตูทางเข้าหลัก (ขวาของป้ายชื่อ สน. ต่ำกว่าเล็กน้อย)
        var PP = { y: SBC + 0.95, d: 1.35 };
        g1.add(plainBox({ x: st.x - 0.025, y: PP.y, w: 0.025, d: PP.d }, Y0 + GF - 0.27, 0.17, 0xa8291f));
        var sgn3 = signPlane2('โรงพักเพื่อประชาชน', 'ผู้พิทักษ์ รับใช้ ประชาชน', 1.28, 0.16);
        sgn3.position.set(wx(st.x - 0.03), Y0 + GF - 0.185, wz(PP.y + PP.d / 2));
        sgn3.rotation.y = -Math.PI / 2; g1.add(sgn3);
        // ผนังชั้นล่างช่วงขวาของทางเข้า: ช่วงล่างทาสีแดง (ป้ายประชาสัมพันธ์) + กรอบรูปสีทอง 3 กรอบ
        var RW = { y: PP.y + PP.d + 0.05, d: st.y + st.d - PP.y - PP.d - 0.2 };
        g1.add(plainBox({ x: st.x - 0.02, y: RW.y, w: 0.02, d: RW.d }, Y0, 0.25, 0xc62828));
        [0.25, 0.5, 0.75].forEach(function (k) {
            var fy = RW.y + RW.d * k;
            g1.add(plainBox({ x: st.x - 0.03, y: fy - 0.11, w: 0.02, d: 0.22 }, Y0 + 0.3, 0.2, 0xd4a52a));
            g1.add(plainBox({ x: st.x - 0.035, y: fy - 0.075, w: 0.01, d: 0.15 }, Y0 + 0.33, 0.14, 0xe9e2cf));
        });
        // เสาอากาศโครงเหล็กบนดาดฟ้า
        (function () {
            var ax = wx(st.x + st.w * 0.62), az = wz(st.y + st.d * 0.55), base = Y3 + 0.04, AH = 2.1, steel = new THREE.MeshLambertMaterial({ color: 0x9aa4b1 });
            [[0.09, 0], [-0.045, 0.078], [-0.045, -0.078]].forEach(function (o) {
                var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, AH, 4), steel);
                leg.position.set(ax + o[0], base + AH / 2, az + o[1]); g1.add(leg);
            });
            for (var k = 1; k < 9; k++) {
                var ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.005, 3, 3), steel);
                ring.rotation.x = Math.PI / 2; ring.position.set(ax, base + k * AH / 9, az); g1.add(ring);
            }
            var whip = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 4), steel);
            whip.position.set(ax, base + AH + 0.3, az); g1.add(whip);
        })();
        // บันไดทางเข้า
        [0, 1, 2].forEach(function (k) {
            g1.add(plainBox({ x: PLAN.apron.x - 0.06 + k * 0.14, y: PLAN.apron.y + 0.3, w: 0.14, d: 1.7 },
                0.16 + k * 0.035, 0.035, 0xc3cad3));
        });
        scene.add(g1);
        lows.concat([f2, f3]).forEach(function (m) { m.userData.key = 'station'; pickables.push(m); });
        // ---- ส่วนต่อเติมชั้นเดียวด้านหลัง (ใต้ชายคา): กรงตาข่ายเก็บรถ จยย. ของกลาง หลังคาเหล็กลาดเอียง ----
        var SW = 0.32, X0 = st.x, X1 = st.x + st.w, YN = st.y, YS = st.y + st.d, CPE = CARPORT.y + CARPORT.d;
        var EXT = { x: X1, y: YN - SW, w: 0.42, d: st.d + SW * 2 };            // ด้านหลังตลอดแนว กว้างราว 2.5 ม. (กินแนวฟุตบาธหัวท้าย)
        var CG = [EXT, { x: X0 + st.w * 0.45, y: YN - SW + 0.04, w: X1 - X0 - st.w * 0.45, d: SW - 0.04 },   // ฝั่งซ้าย (เหนือ) ช่วงหลัง
            { x: X0 + st.w * 0.45, y: YS, w: X1 - X0 - st.w * 0.45, d: SW - 0.04 }];                        // ฝั่งขวา (ใต้) ช่วงหลัง
        var meshMat = new THREE.MeshLambertMaterial({ map: meshTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
        var tinRoof = new THREE.MeshLambertMaterial({ color: 0x8f4a3c });
        CG.forEach(function (r, i) {
            scene.add(plainBox(r, 0.16, 0.03, 0xcfd5dc));                                   // พื้นปูน
            var H = 0.44, wall = new THREE.Mesh(new THREE.BoxGeometry(r.w, H, r.d), meshMat);
            wall.position.set(wx(r.x + r.w / 2), 0.19 + H / 2, wz(r.y + r.d / 2)); scene.add(wall);
            // หลังคาเหล็กลาดจากผนังตึกลงด้านนอก
            var roof = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.06, 0.025, r.d + 0.06), tinRoof);
            roof.position.set(wx(r.x + r.w / 2), 0.19 + H + 0.05, wz(r.y + r.d / 2));
            if (i === 0) roof.rotation.z = -0.06; else roof.rotation.x = i === 1 ? -0.12 : 0.12;
            roof.castShadow = true; scene.add(roof);
        });
        // รถ จยย. ของกลางเรียงในกรงด้านหลัง
        for (var mb = 0; mb < 14; mb++) {
            var bike = new THREE.Group(), bc = [0x1f2937, 0xb91c1c, 0x374151, 0x1e3a8a][mb % 4];
            var bb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), new THREE.MeshLambertMaterial({ color: bc })); bb.position.y = 0.11; bike.add(bb);
            [0.11, -0.11].forEach(function (wxp) {
                var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), new THREE.MeshLambertMaterial({ color: 0x111418 }));
                wh.rotation.x = Math.PI / 2; wh.position.set(wxp, 0.05, 0); bike.add(wh);
            });
            bike.position.set(wx(EXT.x + 0.21), 0.19, wz(EXT.y + 0.35 + mb * 0.48));
            bike.rotation.y = Math.PI / 2; scene.add(bike);
        }
        // ---- ฟุตบาธรอบอาคาร: หน้า + ซ้าย (เหนือ) ขอบขาวแดง · ขวา (ใต้) ขอบขาวดำ · ไม่มีฟุตบาธหน้าที่จอดใต้อาคาร ----
        var BX = EXT.x + EXT.w;                                                     // ขอบหลังของส่วนต่อเติม
        [{ x: X0 - SW, y: CPE, w: SW, d: YS + SW - CPE },          // หน้า
        { x: X0 - SW, y: YS, w: X1 - X0 + SW, d: SW },               // ข้างขวา (ใต้)
        { x: X0 - SW, y: YN - SW, w: X1 - X0 + SW, d: SW },          // ข้างซ้าย (เหนือ) ตลอดแนว
        { x: BX, y: YN - SW, w: SW, d: st.d + SW * 2 }               // หลังส่วนต่อเติม
        ].forEach(function (r) { scene.add(plainBox(r, 0.16, 0.05, 0xd9dee5)); });
        scene.add(curb(X0 - SW, CPE, X0 - SW, YS + SW, 'red'));
        scene.add(curb(X0 - SW, CPE, X0, CPE, 'red'));
        scene.add(curb(X0 - SW, YN - SW, X0 - SW, YN, 'red'));
        scene.add(curb(X0 - SW, YN - SW, BX + SW, YN - SW, 'red'));
        scene.add(curb(X0 - SW, YS + SW, BX + SW, YS + SW, 'bw'));
        scene.add(curb(BX + SW, YN - SW, BX + SW, YS + SW, 'bw'));


        // ==========================================================
        // อาคารที่พัก 2 หลัง (5 ชั้น ตามภาพถ่าย) — ขนาดเท่ากัน ต่างแค่สีหลังคา
        // ชั้นล่าง: ช่วงเหนือ 1/4 เป็นห้อง ที่เหลือเปิดโล่งจอดรถใต้ตึก (เพดานสูงพอดีรถ มีเสา)
        // ระเบียงทางเดินด้านหน้าของแต่ละหลังหันเข้าหากัน (ฝั่งช่องทางระหว่างอาคาร) ผนังราวทึบสีขาว
        // ด้านนอกเป็นหน้าต่างเรียง มีกันสาดเล็ก + เครื่องปรับอากาศ · บนหลังคามีหอบันได/ถังน้ำด้านเหนือ
        // ==========================================================
        var GH = 0.55, FH = 0.56, NF = 4, BAL = 0.36, FLAT_BAY = 0.56;   // FLAT_BAY = ช่องจอดเข้าซอง 1 คัน
        [[PLAN.flat1, 'flat1', COL.roofGrey, 1, 0xd8d1c5], [PLAN.flat2, 'flat2', COL.roofRed, -1, 0xf6f7f9]].forEach(function (cfg) {
            var r = cfg[0], g = new THREE.Group(), side = cfg[3];      // side 1 = ระเบียงด้านตะวันออก, -1 = ด้านตะวันตก
            var B = { x: side > 0 ? r.x : r.x + BAL, y: r.y, w: r.w - BAL, d: r.d };      // ตัวอาคาร (ไม่รวมระเบียง)
            var balX = side > 0 ? r.x + r.w - BAL : r.x;
            var yT = 0.16 + GH, H = NF * FH;
            // ชั้นล่าง: ห้องช่วงเหนือ + พื้นปูนช่วงจอดรถ
            var rN = { x: B.x, y: r.y, w: B.w, d: r.d * 0.25 };
            var gN = new THREE.Mesh(new THREE.BoxGeometry(rN.w, GH, rN.d),
                texMats(wallTexture(1, 0xeef1f4, 0x9fb0c2, 0xd5dbe2), rN, Math.round(rN.w / 1.2), Math.round(rN.d / 1.2), 0xeef1f4));
            gN.position.set(wx(rN.x + rN.w / 2), 0.16 + GH / 2, wz(rN.y + rN.d / 2));
            gN.castShadow = gN.receiveShadow = true; g.add(gN);
            g.add(plainBox({ x: r.x, y: r.y + rN.d, w: r.w, d: r.d - rN.d }, 0.16, 0.02, COL.concrete));
            // เสาใต้ตึก: แนวขอบอาคาร 2 แนว + แนวขอบระเบียง ห่างเท่าช่องจอดเข้าซอง
            for (var pk = 0; pk <= Math.floor((r.d - rN.d) / FLAT_BAY); pk++) {
                var pyy = r.y + rN.d + pk * FLAT_BAY - 0.05;
                [B.x + 0.02, B.x + B.w - 0.11, side > 0 ? r.x + r.w - 0.1 : r.x + 0.01].forEach(function (pxx) {
                    g.add(plainBox({ x: pxx, y: pyy, w: 0.09, d: 0.09 }, 0.16, GH, 0xe2e8f0));
                });
            }
            // ตัวอาคารชั้น 2–5: ผิวต่างกันตามด้าน (นอก = หน้าต่าง+กันสาด+แอร์, ระเบียง = ประตูห้อง, หัวท้าย = เรียบ)
            var outerT = flatTexture('outer', NF), corrT = flatTexture('corr', NF), endT = flatTexture('end', NF);
            function rep(t, n) { var c = t.clone(); c.needsUpdate = true; c.repeat.set(n, 1); return new THREE.MeshLambertMaterial({ map: c }); }
            var plain = new THREE.MeshLambertMaterial({ color: 0xeef1f4 });
            var long = Math.round(B.d / 1.1);
            var mats = [side > 0 ? rep(corrT, long) : rep(outerT, long), side > 0 ? rep(outerT, long) : rep(corrT, long),
                plain, plain, rep(endT, 1), rep(endT, 1)];
            var body = new THREE.Mesh(new THREE.BoxGeometry(B.w, H, B.d), mats);
            body.position.set(wx(B.x + B.w / 2), yT + H / 2, wz(B.y + B.d / 2));
            body.castShadow = body.receiveShadow = true; g.add(body);
            // ระเบียงแต่ละชั้น: พื้นยื่น + ผนังราวทึบสีขาว
            for (var f = 0; f < NF; f++) {
                var fy0 = yT + f * FH;
                g.add(plainBox({ x: balX, y: r.y + 0.06, w: BAL, d: r.d - 0.12 }, fy0 - 0.06, 0.06, cfg[4]));
                g.add(plainBox({ x: side > 0 ? r.x + r.w - 0.05 : r.x, y: r.y + 0.06, w: 0.05, d: r.d - 0.12 }, fy0, 0.26, cfg[4]));
            }
            // ผนังปิดหัวท้ายระเบียง (ช่องบันไดขึ้นลงที่หัวตึก)
            [r.y + 0.06, r.y + r.d - 0.1].forEach(function (yy) {
                g.add(plainBox({ x: balX, y: yy, w: BAL, d: 0.04 }, yT - 0.05, H, 0xe9edf2));
            });
            // ท่อ/ราวเหล็กแนวตั้งเรียงริมระเบียง ตั้งแต่พื้นถึงชั้นบนสุด (ตามภาพ)
            for (var rod = r.y + 0.5; rod < r.y + r.d - 0.3; rod += 1.25) {
                var rm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, GH + H, 5), new THREE.MeshLambertMaterial({ color: 0x8a939e }));
                rm.position.set(wx(side > 0 ? r.x + r.w + 0.02 : r.x - 0.02), 0.16 + (GH + H) / 2, wz(rod)); g.add(rm);
            }
            // หลังคา: แผ่นพื้น + ขอบกันตก ตามสีหลังคาจากภาพดาวเทียม
            g.add(plainBox(grow(r, 0.04), yT + H, 0.07, cfg[2]));
            g.add(plainBox({ x: r.x - 0.04, y: r.y - 0.04, w: r.w + 0.08, d: 0.05 }, yT + H + 0.07, 0.1, 0xf1f3f6));
            g.add(plainBox({ x: r.x - 0.04, y: r.y + r.d - 0.01, w: r.w + 0.08, d: 0.05 }, yT + H + 0.07, 0.1, 0xf1f3f6));
            // หอบันได + ถังเก็บน้ำบนหลังคา (หัวตึกด้านเหนือ)
            var TW = { x: B.x + B.w / 2 - 0.45, y: r.y + 0.15, w: 0.9, d: 0.8 };
            g.add(plainBox(TW, yT + H + 0.07, 0.42, 0xe6eaef));
            var tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12), new THREE.MeshLambertMaterial({ color: 0xcfd6de }));
            tank.position.set(wx(TW.x + TW.w / 2), yT + H + 0.07 + 0.42 + 0.14, wz(TW.y + TW.d / 2)); g.add(tank);
            // ท่อน้ำสีฟ้าแนวตั้งที่หัวตึก
            var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H + GH, 6), new THREE.MeshLambertMaterial({ color: 0x3b82c4 }));
            pipe.position.set(wx(B.x + B.w * 0.3), 0.16 + (H + GH) / 2, wz(r.y - 0.03)); g.add(pipe);
            scene.add(g);
            body.userData.key = gN.userData.key = cfg[1];
            pickables.push(body, gN);
        });

        // ---- ป้อมยามประตูหลัก ----
        // (ป้อมยามเดิมเอาออก — ภาพถ่ายจริงตรงประตูหลักเป็นเกาะศาลพระภูมิ)

        // ---- ลานจอด (คลิกได้) ----
        var pk = new THREE.Mesh(new THREE.BoxGeometry(PLAN.parkN.w + PLAN.laneN.w, 0.06, PLAN.parkN.d),
            new THREE.MeshLambertMaterial({ color: COL.park, transparent: true, opacity: 0.02 }));
        pk.position.set(wx(PLAN.parkN.x + (PLAN.parkN.w + PLAN.laneN.w) / 2), 0.24,
            wz(PLAN.parkN.y + PLAN.parkN.d / 2));
        pk.userData.key = 'parking'; scene.add(pk); pickables.push(pk);

        // ---- องค์ประกอบย่อย ----
        scene.add(flagpole(5.04, PLAN.station.y + PLAN.station.d / 2));   // กึ่งกลางอาคารที่ทำการ ติดรั้วบนฟุตบาธ
        scene.add(shrine(5.45, 11.78));      // ศาลพระภูมิบนเกาะยกพื้น หัวมุมประตูหลัก
        // เสาไฟ: ฝั่งตะวันออกตั้งบนฟุตบาธริมกำแพง (ไม่ขวางรถที่จอด)
        [[5.5, 6.8, 0], [5.5, 10.8, 0], [13.25, 6.0, 1], [13.25, 11.0, 1],
        [13.25, 16.35, 1], [13.25, 21.95, 1], [5.5, 25.75, 0]].forEach(function (p) {
            scene.add(lamp(p[0], p[1], p[2]));
        });

        // ---- รถ ----
        // หน้าอาคารที่ทำการ: จอดชิดฟุตบาธ หัวรถชี้ตะวันออก เหลือเลนสัญจรด้านหลังรถ 1 เลน
        var P = PLAN.parkN;
        [0x1f3f8f, 0x9aa3ad, 0x2b2f36, 0xb8453a, 0xe8eaed, 0x28527a]
            .forEach(function (c, k) {
                scene.add(car(P.x + 0.52, P.y + P.d * (k + 0.5) / 6, c, 0));
            });
        // หน้าอาคารที่พัก: หันหน้ารถเข้าหาตึก
        var S = PLAN.parkS;
        [0x9aa3ad, 0x2b2f36, 0x1f3f8f, 0xd8dde4, 0x5b6472, 0xb8453a, 0x44506a, 0xe8eaed, 0x2b2f36]
            .forEach(function (c, k) {
                scene.add(car(S.x + S.w - 0.56, S.y + S.d * (k + 0.5) / 9, c, 0));   // ลานหน้าแฟลต จอดเต็มแถว
            });
        // ที่จอดใต้อาคารที่ทำการ: 4 คัน หันหน้าเข้าตึก (ช่วงละ 2 คันระหว่างเสา)
        [[0.35, 0x9aa3ad], [0.9, 0x1f3f8f], [1.62, 0xe8eaed], [2.2, 0x2b2f36]].forEach(function (c) {
            scene.add(car(PLAN.station.x + 0.5, PLAN.station.y + c[0], c[1], 0));
        });
        // ทิศหัวรถ: 0 = ตะวันออก, PI = ตะวันตก, PI/2 = เหนือ, -PI/2 = ใต้
        // ข้าง สน. (เหนือ): 2 คันชิดตึก หันไปทางด้านหลัง สน.
        [[10.0, 0xe8eaed], [11.1, 0x28527a]].forEach(function (c) {
            scene.add(car(c[0], PLAN.station.y - 0.52, c[1], 0));
        });
        // ด้านหลัง สน.: 3 คันชิดฟุตบาธ จอดต่อกัน หันไปทางอาคารที่พัก
        [[6.6, 0xf8fafc], [7.7, 0x2b2f36], [8.8, 0x9aa3ad]].forEach(function (c) {
            scene.add(car(12.75, c[0], c[1], -Math.PI / 2));
        });
        // ถนนกลาง: 2 คันจอดต่อท้ายกัน ชิดอาคารที่ทำการ หันไปทางออก
        [[7.95, 0x1b1f26], [8.95, 0x1b1f26]].forEach(function (c) {     // ตามภาพ: SUV ดำ + เก๋งดำ จอดเรียงชิดฟุตบาธข้างอาคาร
            scene.add(car(c[0], PLAN.station.y + PLAN.station.d + 0.32 + 0.21, c[1], 0));
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
        [12.8, 26.26, 1.7],
        // ดงไม้ใหญ่ฝั่งขวา (ตะวันออก) ของโรงพัก
        [16.9, 15.0, 1.7], [17.6, 17.2, 2.0], [16.8, 19.4, 1.85], [17.9, 21.4, 2.1],
        [16.9, 23.4, 1.95], [18.4, 23.8, 1.75], [17.4, 26.0, 1.6], [18.7, 18.8, 1.6],
        [17.2, 12.6, 1.3], [18.2, 10.4, 1.15], [17.0, 7.6, 1.0], [17.8, 5.2, 0.95],
        // ในแปลง บนฟุตบาธริมกำแพงตะวันออก (ไม่ล้ำลงถนน)
        [13.25, 9.9, 0.8], [13.25, 12.4, 0.75],
        // ริมซอยฝั่งตะวันตก
        [2.3, -1.6, 1.1], [2.4, 1.4, 0.95], [5.4, -0.6, 1.2], [9.6, 0.4, 1.0], [13.8, -1.2, 1.3],
        [2.3, 4.6, 1.0], [2.5, 9.0, 0.9], [2.2, 15.4, 1.05], [2.5, 20.6, 0.95], [2.3, 25.2, 0.9]
        ].forEach(function (t) { scene.add(tree(t[0], t[1], t[2])); });
    }


    // ---------- จุดยึดป้ายข้อมูลในพิกัดโลก ----------
    var ANCHOR = {
        station: [PLAN.station.x + PLAN.station.w / 2, 3.0, PLAN.station.y + PLAN.station.d / 2],
        flat1:   [PLAN.flat1.x + PLAN.flat1.w / 2, 3.8, PLAN.flat1.y + PLAN.flat1.d / 2],
        flat2:   [PLAN.flat2.x + PLAN.flat2.w / 2, 3.6, PLAN.flat2.y + PLAN.flat2.d / 2],
        parking: [PLAN.parkN.x + PLAN.parkN.w / 2, 3.4, PLAN.parkN.y + PLAN.parkN.d * 0.3],
        gate:    [PLAN.guard.x + PLAN.guard.w / 2, 1.0, PLAN.guard.y + PLAN.guard.d / 2 + 1.2]
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
        want.tx = wx(PLAN.yard.x + PLAN.yard.w / 2); want.ty = 0.9; want.tz = wz(PLAN.yard.y + PLAN.yard.d / 2);
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
        { p: [12.0, -5.2], say: 'ถนนคลองสิบ–คลองสิบสี่' },
        { p: [4.25, -5.2], say: 'เลี้ยวซ้ายข้ามสะพานคลองสนาม เข้าซอยคลองสิบ–สิบสี่ 7' },
        { p: [4.25, 0.6], say: 'ผ่านทุ่งนาสองข้างทาง มุ่งหน้า สน.ลำหิน' },
        { p: [4.25, 12.82], say: 'เลี้ยวซ้ายเข้า สน. — ถนน 2 เลนสวนกันได้' },
        { p: [7.0, 12.82], say: 'เลี้ยวซ้าย ผ่านหน้าอาคารที่ทำการ (เลนเดียว)' },
        { p: [7.0, 4.2], say: 'เลี้ยวขวา ถนนข้าง สน. 2 เลน' },
        { p: [12.0, 4.2], say: 'เลี้ยวขวา วนไปด้านหลัง สน.' },
        { p: [12.0, 13.45], say: 'เลี้ยวขวา ถนน 2 เลนกลาง สน.' },
        { p: [9.6, 13.45], say: 'เลี้ยวซ้าย เข้าระหว่างอาคารที่พัก' },
        { p: [9.6, 24.95], say: 'เลี้ยวขวาออก ถนนท้ายแปลง' },
        { p: [3.45, 24.95], say: 'เลี้ยวขวา วิ่งตามซอยผ่านหน้า สน.ลำหิน' },
        { p: [3.45, -5.7], say: 'ข้ามสะพาน เลี้ยวขวาออกถนนคลองสิบ–คลองสิบสี่' },
        { p: [11.0, -5.7], say: 'สิ้นสุดการจำลอง' }
    ];
    var DRIVE_SPEED = 2.8;      // หน่วยผัง/วินาที (1 หน่วย ≈ 6 ม.) → ราว 35 วินาทีทั้งเส้นทาง
    var drive = null;

    // รถสายตรวจ: กระบะสีขาว คาดแถบน้ำเงิน ไฟไซเรนแดง-น้ำเงินบนหลังคา (กะพริบตอนวิ่ง)
    function policeCar() {
        var g = carModel(0xf8fafc, 'pickup');
        var navy = carMat(0x1e3a8a, 'flat');
        [1, -1].forEach(function (s) { carPart(g, navy, 0.76, 0.03, 0.004, 0, 0.13, s * (CAR_W / 2 + 0.008)); });
        var cab = g.userData.cabin;
        carPart(cab, carMat(0x1f2937, 'flat'), 0.07, 0.016, 0.26, -0.012, 0.324, 0);          // ฐานไฟไซเรน
        var red = carPart(g, new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0x000000 }), 0.06, 0.024, 0.11, -0.012, 0.343, 0.065);
        var blue = carPart(g, new THREE.MeshLambertMaterial({ color: 0x3b82f6, emissive: 0x000000 }), 0.06, 0.024, 0.11, -0.012, 0.343, -0.065);
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
        var ccam = new THREE.PerspectiveCamera(62, 1, 0.05, 200);   // มุมติดตามตรงหลังรถ
        drive = {
            route: R, car: carObj, cam: dcam, chase: ccam, cpos: null, clook: null, u: 0, t0: performance.now(), last: performance.now(),
            swap: false, look: null, cap: -1, onEnd: onEnd || null, y: 0.1, az: null
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
        var dt = Math.min(0.25, (now - D.last) / 1000); D.last = now;   // เครื่องช้า/เฟรมตก รถยังวิ่งตามเวลาจริง
        var el = (now - D.t0) / 1000;
        var remain = (1 - D.u) * R.total;
        var k = Math.min(1, el / 1.6) * Math.min(1, 0.25 + remain / 2.5);    // ออกตัวนุ่ม ๆ / ชะลอก่อนจบ
        D.u = Math.min(1, D.u + DRIVE_SPEED * k * dt / R.total);

        var p = R.path.getPointAt(D.u), tg = R.path.getTangentAt(D.u);
        var px = p.x + (SITE.x + SITE.w / 2), py = p.z + (SITE.y + SITE.d / 2);
        D.y += ((inYard(px, py) ? 0.19 : 0.1) - D.y) * 0.15;    // ขึ้นลาน สน. สูงกว่าถนนนิดหน่อย
        D.car.position.set(p.x, D.y, p.z);
        D.car.rotation.y = Math.atan2(-tg.z, tg.x);
        var blink = Math.floor(el * 4) % 2;
        D.car.userData.lights[0].material.emissive.setHex(blink ? 0xb91c1c : 0x200000);
        D.car.userData.lights[1].material.emissive.setHex(blink ? 0x0b1f4d : 0x1d4ed8);

        // มุมมองคนขับ: ตาอยู่ในห้องโดยสาร มองไปข้างหน้าตามเส้นทาง
        var ahead = R.path.getPointAt(Math.min(1, D.u + 2.4 / R.total));
        // ตาอยู่ด้านหน้าห้องโดยสาร (ห้องโดยสารกับไฟหลังคาไม่วาดในมุมนี้ — ไม่บังทาง) เห็นฝากระโปรงหน้านิดหน่อย
        var eye = new THREE.Vector3(p.x + tg.x * 0.1, D.y + 0.26, p.z + tg.z * 0.1);
        var lookT = new THREE.Vector3(ahead.x, D.y + 0.2, ahead.z);
        if (!D.look) D.look = lookT.clone(); else D.look.lerp(lookT, 0.12);
        D.cam.position.copy(eye);
        D.cam.lookAt(D.look);

        // มุมติดตาม: กล้องอยู่ตรงหลังรถบนเส้นทางที่รถเพิ่งผ่าน (เลี้ยวตามถนน ไม่ทะลุผ่านตึก) มองตรงไปข้างหน้ารถ
        var BACK = 1.15, back = D.u * R.total - BACK, cp;
        if (back >= 0) cp = R.path.getPointAt(back / R.total);
        else { var t0 = R.path.getTangentAt(0); cp = R.path.getPointAt(0).clone().addScaledVector(t0, back); }   // ต้นทาง: ถอยตามแนวถนน
        var cpos = new THREE.Vector3(cp.x, D.y + 0.55, cp.z);
        var clook = new THREE.Vector3(p.x + tg.x * 0.6, D.y + 0.1, p.z + tg.z * 0.6);   // รถอยู่กลางภาพ เห็นถนนข้างหน้า
        if (!D.cpos) { D.cpos = cpos.clone(); D.clook = clook.clone(); }
        D.cpos.lerp(cpos, 0.2); D.clook.lerp(clook, 0.2);
        D.chase.position.copy(D.cpos);
        D.chase.lookAt(D.clook);
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
        hud.pip.querySelector('span').textContent = drive.swap ? 'มุมมองคนขับ' : 'มุมติดตามหลังรถ';
        hud.tag.innerHTML = '<i class="fas ' + (drive.swap ? 'fa-video' : 'fa-car') + '"></i> ' + (drive.swap ? 'มุมติดตามหลังรถ' : 'มุมมองคนขับ');
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
    // มุมคนขับ: ไม่วาดห้องโดยสาร/ไฟหลังคาของรถตัวเอง (อยู่ระดับสายตา บังทางวิ่ง)
    function renderCam(c) {
        var own = c === drive.cam, car = drive.car.userData;
        car.cabin.visible = !own;
        car.lights.forEach(function (m) { m.visible = !own; });
        renderer.render(scene, c);
        car.cabin.visible = true;
        car.lights.forEach(function (m) { m.visible = true; });
    }
    function renderDrive() {
        var w = host.clientWidth || 800, h = host.clientHeight || 460;
        var mainCam = drive.swap ? drive.chase : drive.cam, insetCam = drive.swap ? drive.cam : drive.chase;
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        mainCam.aspect = w / h; mainCam.updateProjectionMatrix();
        renderCam(mainCam);
        var r = pipRect(w, h);
        renderer.setScissorTest(true);
        renderer.setScissor(r.x, h - r.y - r.h, r.w, r.h);
        renderer.setViewport(r.x, h - r.y - r.h, r.w, r.h);
        insetCam.aspect = r.w / r.h; insetCam.updateProjectionMatrix();
        renderCam(insetCam);
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
        resetView();
        cam.az = want.az; cam.pol = want.pol; cam.tx = want.tx; cam.ty = want.ty; cam.tz = want.tz;
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
