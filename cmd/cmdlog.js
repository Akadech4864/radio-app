/* =====================================================================
   บันทึกเหตุการณ์ ศปก.ส่วนหน้า (Field Time Log) — โมดูลเสริมของกระดานสถานการณ์ (แท็บ "บันทึก ศปก.")
   - ขั้นตอนมาตรฐานกดครั้งเดียวลงเวลาอัตโนมัติ: ปล่อยแถวชี้แจง → ปล่อยแถวประจำจุด → แต่ละฝ่ายประจำจุด → รายงานสถานการณ์
     → เหตุเสี่ยง/ฝ่าฝืน → เจรจา → ประกาศ ม.21 → ครบกำหนด → ศาลแพ่ง → พื้นที่ควบคุม → สิ้นสุด/ไม่ยอมเลิก
   - ตัวช่วยกรอก: สายงาน จุด กลุ่มผู้ชุมนุม จำนวนคน/รถ พฤติการณ์เสี่ยงพร้อมมาตรา หลักฐาน + เรียบเรียงข้อความทางการอัตโนมัติ
   - เตือนเมื่อครบกำหนดตามประกาศ และเมื่อถึงเวลาเลิกตามแจ้ง → กดบันทึกผลได้ทันที
   - พิมพ์ "บันทึกลำดับเหตุการณ์" เป็นตาราง A4 (เอกสารแนบท้ายคำร้องศาลแพ่ง) · คัดลอกส่ง LINE · ส่งออก CSV
   - ข้อมูลเก็บใน ev.log (ไปกับ Export JSON ของกระดาน) — สคีมา:
     { id, at, kind, step, title, detail, crowd, vehicles, law, unit, place, by, level, evidence, deadlineAt }
   ===================================================================== */
(function () {
    'use strict';
    if (!window.LamhinCmd || typeof window.LamhinCmd.registerSection !== 'function') return;

    const BY_KEY = 'lamhin_cmd_logby';
    const PRINT_KEY = 'lamhin_cmd_logprint';

    const KINDS = {
        muster: { label: 'ปล่อยแถว', icon: 'fa-flag', tone: 'blue' },
        deploy: { label: 'ออกประจำจุด', icon: 'fa-route', tone: 'blue' },
        post: { label: 'ประจำจุด', icon: 'fa-location-crosshairs', tone: 'blue' },
        sitrep: { label: 'รายงานสถานการณ์', icon: 'fa-tower-broadcast', tone: 'neon' },
        crowd: { label: 'จำนวนมวลชน/รถ', icon: 'fa-people-group', tone: 'neon' },
        risk: { label: 'เหตุเสี่ยงฝ่าฝืน', icon: 'fa-triangle-exclamation', tone: 'amber' },
        violation: { label: 'ฝ่าฝืนกฎหมาย', icon: 'fa-gavel', tone: 'red' },
        negotiate: { label: 'เจรจา', icon: 'fa-handshake', tone: 'gold' },
        announce: { label: 'ประกาศเจ้าพนักงาน', icon: 'fa-bullhorn', tone: 'gold' },
        deadline: { label: 'ครบกำหนดตามประกาศ', icon: 'fa-hourglass-end', tone: 'gold' },
        court: { label: 'ศาลแพ่งมีนบุรี', icon: 'fa-scale-balanced', tone: 'violet' },
        control: { label: 'พื้นที่ควบคุม', icon: 'fa-road-barrier', tone: 'red' },
        arrest: { label: 'จับกุม/ตรวจยึด', icon: 'fa-handcuffs', tone: 'red' },
        end: { label: 'สิ้นสุด/แยกย้าย', icon: 'fa-flag-checkered', tone: 'green' },
        note: { label: 'บันทึกอื่น', icon: 'fa-note-sticky', tone: 'gray' }
    };
    const FORM_KINDS = ['sitrep', 'crowd', 'risk', 'violation', 'negotiate', 'announce', 'deadline', 'court', 'control', 'arrest', 'end', 'note'];
    // ประเภทที่ใช้ประกอบคำร้องศาล (เลือกพิมพ์เฉพาะได้)
    const COURT_KINDS = ['crowd', 'sitrep', 'risk', 'violation', 'negotiate', 'announce', 'deadline', 'court', 'control', 'arrest', 'end'];

    const UNITS = ['ศปก.ส่วนหน้า', 'งานป้องกันปราบปราม/คฝ.', 'งานสืบสวน', 'งานจราจร', 'งานสอบสวน', 'งานอำนวยการ', 'การไฟฟ้านครหลวง', 'ผู้จัด/ผู้ชุมนุม'];
    const PLACES = ['จุดชุมนุม ปากซอยคู้คลองสิบ 4', 'แยกถนนคู้-คลองสิบ/ซอยคู้คลองสิบ 4', 'ผิวจราจรถนนคู้-คลองสิบ', 'แนวเสาไฟฟ้าใหม่ ซอยคู้คลองสิบ 4', 'ลานจอดรถมัสยิดดารุ้ลมุกร้อดรอบีน', 'หน้า สน.ลำหิน'];
    const GROUPS = ['ชาวบ้านชุมชนลำเจดีย์', 'ผู้จัดการชุมนุม (นายภูเบศ โพธิ์โซ๊ะ)', 'ผู้ประสานงาน (นายสมาน มาลี/นายสิทธิศักดิ์ โห้วตู)', 'ผู้สูงอายุ/เด็ก', 'กลุ่มบุคคลภายนอกพื้นที่', 'สื่อมวลชน/ผู้ไลฟ์สด', 'ช่าง/เจ้าหน้าที่ กฟน.'];
    const EVIDENCE = ['ภาพถ่าย', 'คลิปวิดีโอ (Uncut)', 'ไลฟ์สด/โซเชียลมีเดีย', 'ภาพหน้าจอเครื่องวัดเสียง', 'รายงานการสืบสวน'];
    const RISKS = [
        { id: 'megaphone', label: 'ใช้โทรโข่งก่อน 06.00 น.', law: 'ม.15(6) / ม.31 ว.1', text: 'มีการใช้โทรโข่งหรือเครื่องขยายเสียงปราศรัยในช่วงเวลาห้ามใช้ (ก่อน 06.00 น.)' },
        { id: 'loud', label: 'เสียงดังเกินกำหนด', law: 'ม.15(7) / ม.31 ว.1', text: 'ใช้เครื่องขยายเสียงดังเกินระดับที่กำหนด (วัดได้ประมาณ ...... dB(A))' },
        { id: 'block', label: 'ปิดกั้นผิวจราจร', law: 'ม.15(2), ม.16(1) / ป.อ. ม.385 / พ.ร.บ.จราจรฯ ม.114', text: 'นำรถยนต์และกลุ่มบุคคลปิดกั้นผิวจราจร ทำให้ประชาชนผู้ใช้เส้นทางไม่ได้รับความสะดวกเกินสมควร' },
        { id: 'mea', label: 'ขัดขวางรถ/ช่าง กฟน.', law: 'ป.อ. ม.309 / ม.16(6)', text: 'กลุ่มผู้ชุมนุมยืนปิดล้อมรถกระเช้าและขัดขวางการปฏิบัติงานของช่างการไฟฟ้านครหลวง' },
        { id: 'power', label: 'ระบบส่งไฟฟ้าใช้การไม่ได้', law: 'ม.31 วรรคสอง', text: 'การกระทำของผู้ชุมนุมเป็นเหตุให้ระบบส่งกระแสไฟฟ้าใช้การไม่ได้ (ชั่วคราว/ถาวร)' },
        { id: 'march', label: 'เคลื่อนขบวนโดยไม่แจ้ง', law: 'ม.17 / ม.28', text: 'ผู้ชุมนุมเคลื่อนขบวนหรือเคลื่อนย้ายสถานที่ชุมนุมโดยมิได้แจ้งล่วงหน้า' },
        { id: 'mask', label: 'ปิดบังอำพรางใบหน้า', law: 'ม.16(2) / ม.30', text: 'ผู้ชุมนุมบางรายปิดบังอำพรางใบหน้าโดยจงใจมิให้ระบุตัวได้' },
        { id: 'weapon', label: 'พกอาวุธ/ดอกไม้เพลิง', law: 'ม.16(3) / ม.31, ม.34', text: 'พบผู้ชุมนุมพกพาอาวุธ ดอกไม้เพลิง หรือสิ่งเทียมอาวุธเข้ามาในที่ชุมนุม' },
        { id: 'damage', label: 'บุกรุก/ทำลายทรัพย์', law: 'ม.16(4) / ป.อ. ม.358, 360', text: 'มีการบุกรุกหรือทำให้เสียหายซึ่งทรัพย์สินของผู้อื่น (ระบุทรัพย์ ......)' },
        { id: 'violence', label: 'ทำร้าย/ขู่เข็ญ', law: 'ม.16(5)(6)', text: 'มีการใช้กำลังประทุษร้ายหรือขู่เข็ญผู้อื่นให้เกิดความกลัว' },
        { id: 'officer', label: 'ขัดขวางเจ้าพนักงาน', law: 'ม.16(7) / ป.อ. ม.138', text: 'ผู้ชุมนุมขัดขวางการปฏิบัติหน้าที่ของเจ้าพนักงาน' },
        { id: 'overtime', label: 'ไม่เลิกเมื่อครบ 18.00 น.', law: 'ม.18 / ม.28', text: 'เมื่อครบกำหนดเวลาการชุมนุมตามที่แจ้งไว้ (18.00 น.) ผู้ชุมนุมยังไม่เลิกการชุมนุมและมิได้แจ้งขอขยายระยะเวลา' },
        { id: 'condition', label: 'ไม่ทำตามเงื่อนไข จนท.', law: 'ม.19(5) / ม.32', text: 'ผู้ชุมนุมไม่ปฏิบัติตามเงื่อนไขหรือคำสั่งของเจ้าพนักงานดูแลการชุมนุมสาธารณะ' },
        { id: 'insult', label: 'ดูหมิ่นเจ้าพนักงาน', law: 'ป.อ. ม.136', text: 'มีผู้กล่าวถ้อยคำดูหมิ่นเจ้าพนักงานซึ่งกระทำการตามหน้าที่' }
    ];
    const ANNOUNCES = [
        { id: 'a212', label: 'ให้แก้ไข ม.21(2)', law: 'ม.21(2)', text: 'ประกาศให้ผู้ชุมนุมแก้ไขการกระทำที่ฝ่าฝืนตามมาตรา 21 (2)' },
        { id: 'a211', label: 'ให้เลิก ม.21(1)', law: 'ม.21(1)', text: 'ประกาศให้ผู้ชุมนุมเลิกการชุมนุมตามมาตรา 21 (1)' },
        { id: 'a23', label: 'พื้นที่ควบคุม ม.23', law: 'ม.23', text: 'ประกาศกำหนดพื้นที่ควบคุมและให้ผู้ชุมนุมออกจากพื้นที่ควบคุมตามมาตรา 23' },
        { id: 'a25', label: 'ยุติเหตุรุนแรง ม.25', law: 'ม.25', text: 'สั่งให้ผู้ชุมนุมยุติการกระทำที่มีลักษณะรุนแรงตามมาตรา 25' }
    ];
    const OUTCOMES = {
        negotiate: ['ผู้จัดยินยอมปฏิบัติตาม', 'ผู้จัดขอเวลาหารือกับผู้ชุมนุม', 'ผู้จัดปฏิเสธไม่ปฏิบัติตาม'],
        deadline: ['ผู้ชุมนุมปฏิบัติตามประกาศแล้ว', 'ผู้ชุมนุมไม่ปฏิบัติตามประกาศ', 'ผู้ชุมนุมปฏิบัติตามบางส่วน'],
        end: ['ผู้ชุมนุมแยกย้ายโดยสงบ', 'ไม่มีความเสียหาย', 'มีผู้ชุมนุมบางส่วนยังอยู่ในพื้นที่'],
        court: ['ยื่นคำร้องแล้ว', 'ศาลนัดไต่สวนฉุกเฉิน', 'ศาลมีคำสั่งให้เลิกการชุมนุม'],
        arrest: ['จับกุมความผิดซึ่งหน้า', 'ตรวจยึดทรัพย์สินที่ใช้ในการชุมนุม', 'นำตัวส่งพนักงานสอบสวน สน.ลำหิน']
    };

    // ขั้นตอนมาตรฐาน (กดครั้งเดียว = ลงเวลา / ขั้นที่ต้องระบุรายละเอียด = เปิดตัวช่วยกรอก)
    const PHASES = [
        { id: 'A', title: 'ก่อนการชุมนุม', steps: [
            { id: 'brief', label: 'ปล่อยแถวชี้แจงการปฏิบัติ', kind: 'muster', unit: 'ศปก.ส่วนหน้า', place: 'หน้า สน.ลำหิน', title: 'ปล่อยแถวชี้แจงภารกิจและกรอบข้อกฎหมายแก่กำลังพล ณ หน้า สน.ลำหิน' },
            { id: 'deploy', label: 'ปล่อยแถวประจำจุด', kind: 'deploy', unit: 'ศปก.ส่วนหน้า', place: 'หน้า สน.ลำหิน', title: 'ปล่อยแถว กำลังพลเดินทางออกประจำจุดตามแผน' },
            { id: 'post-p', label: 'ป./คฝ. ประจำจุด', kind: 'post', unit: 'งานป้องกันปราบปราม/คฝ.', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'งานป้องกันปราบปรามและชุด คฝ. ถึงจุดและประจำจุดเรียบร้อย' },
            { id: 'post-s', label: 'สืบสวน ประจำจุด', kind: 'post', unit: 'งานสืบสวน', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'งานสืบสวนประจำจุด เริ่มบันทึกภาพและคลิปเหตุการณ์' },
            { id: 'post-t', label: 'จราจร ประจำจุด', kind: 'post', unit: 'งานจราจร', place: 'แยกถนนคู้-คลองสิบ/ซอยคู้คลองสิบ 4', title: 'งานจราจรประจำจุดอำนวยการจราจรบริเวณแยกถนนคู้-คลองสิบ' },
            { id: 'post-i', label: 'สอบสวน ประจำจุด', kind: 'post', unit: 'งานสอบสวน', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'งานสอบสวนตั้งจุด ศปก.ส่วนหน้า พร้อมรับแจ้งเหตุและให้คำปรึกษาข้อกฎหมาย' },
            { id: 'post-a', label: 'อำนวยการ พร้อม', kind: 'post', unit: 'งานอำนวยการ', place: 'หน้า สน.ลำหิน', title: 'งานอำนวยการพร้อมสนับสนุนอาหาร น้ำดื่ม และสวัสดิการกำลังพล' },
            { id: 'gather', label: 'ผู้ชุมนุมเริ่มรวมตัว', kind: 'crowd', unit: 'งานสืบสวน', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'กลุ่มผู้ชุมนุมเริ่มรวมตัว', form: true },
            { id: 'start', label: 'เริ่มการชุมนุม', kind: 'sitrep', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'เริ่มการชุมนุมสาธารณะ', form: true }
        ] },
        { id: 'B', title: 'ระหว่างการชุมนุม', steps: [
            { id: 'sitrep', label: 'รายงานสถานการณ์', kind: 'sitrep', unit: 'งานสืบสวน', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'รายงานสถานการณ์', form: true, repeat: true },
            { id: 'mea', label: 'กฟน. เข้าพื้นที่', kind: 'sitrep', unit: 'การไฟฟ้านครหลวง', place: 'แนวเสาไฟฟ้าใหม่ ซอยคู้คลองสิบ 4', title: 'เจ้าหน้าที่การไฟฟ้านครหลวงเข้าพื้นที่เพื่อดำเนินการ', form: true },
            { id: 'risk', label: 'เหตุเสี่ยง/ฝ่าฝืน', kind: 'risk', unit: 'งานสืบสวน', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'พบพฤติการณ์เสี่ยงต่อการฝ่าฝืนกฎหมาย', form: true, repeat: true },
            { id: 'negotiate', label: 'เจรจา', kind: 'negotiate', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'ชุดเจรจาเข้าพบผู้จัดการชุมนุมเพื่อทำความเข้าใจ', form: true, repeat: true },
            { id: 'announce', label: 'ประกาศ ม.21', kind: 'announce', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'เจ้าพนักงานดูแลการชุมนุมสาธารณะอ่านประกาศ', form: true, repeat: true }
        ] },
        { id: 'C', title: 'ขั้นบังคับใช้กฎหมาย', steps: [
            { id: 'court', label: 'ยื่นคำร้องศาลแพ่ง', kind: 'court', unit: 'งานสอบสวน', place: 'ศาลแพ่งมีนบุรี', title: 'ยื่นคำร้องต่อศาลแพ่งมีนบุรีขอให้มีคำสั่งให้เลิกการชุมนุม (ม.21 วรรคสอง)', form: true },
            { id: 'order', label: 'ศาลมีคำสั่ง', kind: 'court', unit: 'งานสอบสวน', place: 'ศาลแพ่งมีนบุรี', title: 'ศาลแพ่งมีนบุรีมีคำสั่งให้ผู้ชุมนุมเลิกการชุมนุม (ม.22)', form: true },
            { id: 'posted', label: 'ปิดประกาศคำสั่งศาล', kind: 'court', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'ปิดประกาศคำสั่งศาล ณ สถานที่ชุมนุม และประกาศให้ทราบโดยทั่วกัน (ม.22 วรรคสี่)' },
            { id: 'control', label: 'พื้นที่ควบคุม ม.23', kind: 'control', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'ประกาศกำหนดพื้นที่ควบคุม (ม.23)', form: true },
            { id: 'm25', label: 'สั่งยุติเหตุ ม.25', kind: 'announce', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'สั่งให้ผู้ชุมนุมยุติการกระทำที่มีลักษณะรุนแรง (ม.25)', form: true },
            { id: 'arrest', label: 'จับกุม/ตรวจยึด', kind: 'arrest', unit: 'งานป้องกันปราบปราม/คฝ.', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'จับกุม/ตรวจยึดตามอำนาจ (ม.24 / ป.วิ.อ.)', form: true, repeat: true }
        ] },
        { id: 'D', title: 'สิ้นสุดการชุมนุม', steps: [
            { id: 'end', label: 'ผู้ชุมนุมยุติ/แยกย้าย', kind: 'end', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'ผู้ชุมนุมยุติการชุมนุมและแยกย้ายออกจากพื้นที่', form: true },
            { id: 'refuse', label: 'ไม่ยอมเลิกการชุมนุม', kind: 'violation', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'ครบกำหนดเวลาตามที่แจ้งแล้ว ผู้ชุมนุมไม่ยอมเลิกการชุมนุม', form: true, risk: 'overtime' },
            { id: 'clear', label: 'คืนพื้นที่/ปิดภารกิจ', kind: 'end', unit: 'ศปก.ส่วนหน้า', place: 'จุดชุมนุม ปากซอยคู้คลองสิบ 4', title: 'ตรวจสภาพพื้นที่ คืนพื้นที่สาธารณะ และปิดภารกิจ' }
        ] }
    ];
    const STEP = {};
    PHASES.forEach((p) => p.steps.forEach((s) => { STEP[s.id] = s; }));

    /* ---------------- สถานะโมดูล ---------------- */
    let api = null, el = null, evId = '', timer = 0, F = null, showAll = false, newestFirst = true, filter = 'all';
    const $ = (sel) => el.querySelector(sel);
    const esc = (s) => api.esc(s);
    const pad = (n) => String(n).padStart(2, '0');
    const hm = (ms) => { const d = new Date(ms); return pad(d.getHours()) + '.' + pad(d.getMinutes()); };
    const thDigits = (s) => String(s == null ? '' : s).replace(/[0-9]/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]);
    const toLocal = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    const fromLocal = (s) => { const t = Date.parse(s); return isNaN(t) ? Date.now() : t; };
    const num = (v) => { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };
    function recorder() { try { return localStorage.getItem(BY_KEY) || ''; } catch (e) { return ''; } }
    function setRecorder(v) { try { localStorage.setItem(BY_KEY, v); } catch (e) { /* ไม่จำก็ได้ */ } }
    function logOf(ev) { if (!Array.isArray(ev.log)) ev.log = []; return ev.log; }
    function sorted(ev) { return logOf(ev).slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); }
    function latestCount(ev, key) {
        const l = sorted(ev).filter((x) => x[key] != null && x[key] !== '');
        return l.length ? l[l.length - 1][key] : null;
    }
    function stepEntries(ev, id) { return logOf(ev).filter((x) => x.step === id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); }
    function freshForm(ev) {
        return { kind: 'sitrep', step: '', unit: 'งานสืบสวน', place: PLACES[0], crowd: ev ? latestCount(ev, 'crowd') : null, vehicles: ev ? latestCount(ev, 'vehicles') : null,
            groups: [], risks: [], evidence: [], announce: '', outcome: [], level: '', deadlineMin: 30, manualTime: false, titleDirty: false, detailDirty: false, editId: '' };
    }

    function addEntry(ev, e) {
        const entry = Object.assign({ id: api.uid('lg'), at: new Date().toISOString(), kind: 'note', step: '', title: '', detail: '', crowd: null, vehicles: null,
            law: '', unit: '', place: '', by: recorder(), level: '', evidence: '', deadlineAt: '' }, e);
        logOf(ev).push(entry);
        if (entry.level && entry.level !== ev.level && api.LEVELS[entry.level]) {
            ev.level = entry.level;
            ev.levelLog = Array.isArray(ev.levelLog) ? ev.levelLog : [];
            ev.levelLog.push({ at: entry.at, level: entry.level });
        }
        api.save();
        if (entry.level) api.render(); else refresh();
        return entry;
    }

    /* ---------------- โครงหน้า (สร้างครั้งเดียวต่อเหตุการณ์) ---------------- */
    function build(ev) {
        evId = ev ? ev.id : '';
        if (!ev) { el.innerHTML = '<section class="cmd-card"><div class="cmd-empty"><i class="fa-solid fa-clipboard-list"></i>ยังไม่มีเหตุการณ์ — สร้างเหตุการณ์ที่แท็บภาพรวมก่อน</div></section>'; return; }
        F = freshForm(ev);
        el.innerHTML =
            '<div class="cmdl">' +
            '<section class="cmd-card cmdl-head">' +
                '<div class="cmd-card-h"><i class="fa-solid fa-clipboard-list"></i><h4>บันทึกเหตุการณ์ ศปก.ส่วนหน้า</h4><small data-l-stat="count"></small></div>' +
                '<div class="cmdl-headrow">' +
                    '<label class="cmd-f cmdl-by"><span>ผู้บันทึก (จำไว้ในเครื่องนี้)</span><input data-l-in="by" type="text" placeholder="ยศ ชื่อ-สกุล ผู้บันทึก" value="' + esc(recorder()) + '"></label>' +
                    '<div class="cmdl-now"><div><small>มวลชนล่าสุด</small><b data-l-stat="crowd">-</b></div><div><small>รถล่าสุด</small><b data-l-stat="veh">-</b></div><div><small>บันทึกล่าสุด</small><b data-l-stat="last">-</b></div></div>' +
                '</div>' +
                '<div class="cmd-tools">' +
                    '<button type="button" class="cmd-btn gold" data-l="print"><i class="fa-solid fa-print"></i> พิมพ์ตารางประกอบคำร้องศาล</button>' +
                    '<button type="button" class="cmd-btn line" data-l="line"><i class="fa-brands fa-line"></i> คัดลอกส่ง LINE</button>' +
                    '<button type="button" class="cmd-btn" data-l="csv"><i class="fa-solid fa-file-csv"></i> ส่งออก CSV</button>' +
                '</div>' +
            '</section>' +
            '<div class="cmdl-banners" data-l-box="banners"></div>' +
            '<div class="cmdl-grid">' +
                '<section class="cmd-card cmdl-steps"><div class="cmd-card-h"><i class="fa-solid fa-list-check"></i><h4>ขั้นตอนตามลำดับ</h4><small>แตะ = ลงเวลาทันที</small></div><div data-l-box="steps"></div></section>' +
                '<section class="cmd-card cmdl-form" data-l-box="formcard"><div class="cmd-card-h"><i class="fa-solid fa-pen-to-square"></i><h4 data-l-box="formtitle">บันทึกเหตุการณ์ (ตัวช่วยกรอก)</h4></div><div data-l-box="form"></div></section>' +
            '</div>' +
            '<section class="cmd-card cmdl-tl"><div class="cmd-card-h"><i class="fa-solid fa-timeline"></i><h4>ลำดับเหตุการณ์</h4>' +
                '<button type="button" class="cmd-btn sm" data-l="order"></button></div>' +
                '<div class="cmdl-filters" data-l-box="filters"></div><div data-l-box="list"></div></section>' +
            '</div>';
        renderForm();
        refresh();
    }

    function chipRow(group, items, selected, multi) {
        return '<div class="cmdl-chips">' + items.map((it) => {
            const id = typeof it === 'string' ? it : it.id, label = typeof it === 'string' ? it : it.label;
            const on = multi ? selected.indexOf(id) > -1 : selected === id;
            return '<button type="button" class="cmdl-chip' + (on ? ' on' : '') + '" data-l-chip="' + group + '" data-v="' + esc(id) + '">' + esc(label) + '</button>';
        }).join('') + '</div>';
    }

    /* ---------------- ฟอร์มตัวช่วยกรอก ---------------- */
    function renderForm() {
        const box = $('[data-l-box="form"]'); if (!box) return;
        const k = F.kind;
        const showAnn = k === 'announce' || k === 'control';
        const outs = OUTCOMES[k] || [];
        const now = Date.now();
        box.innerHTML =
            '<div class="cmdl-f">' +
            '<div class="cmdl-sec"><span>ประเภทเหตุการณ์</span>' + chipRow('kind', FORM_KINDS.map((x) => ({ id: x, label: KINDS[x].label })), k, false) + '</div>' +
            '<div class="cmdl-row2">' +
                '<label class="cmd-f"><span>เวลา</span><div class="cmdl-time"><input data-l-in="time" type="datetime-local" value="' + toLocal(F.manualTime && F.at ? F.at : now) + '"' + (F.manualTime ? '' : ' disabled') + '>' +
                '<button type="button" class="cmd-btn sm' + (F.manualTime ? '' : ' neon') + '" data-l="timemode">' + (F.manualTime ? 'ระบุเวลาเอง' : 'เวลาปัจจุบัน') + '</button></div></label>' +
                '<label class="cmd-f"><span>ผู้รายงาน/สายงาน</span><select data-l-in="unit">' + UNITS.map((u) => '<option' + (u === F.unit ? ' selected' : '') + '>' + esc(u) + '</option>').join('') + '</select></label>' +
            '</div>' +
            '<div class="cmdl-sec"><span>จุด/ตำแหน่ง</span>' + chipRow('place', PLACES, F.place, false) +
                '<input data-l-in="place" type="text" class="cmdl-in" placeholder="หรือพิมพ์ตำแหน่งเอง" value="' + esc(PLACES.indexOf(F.place) > -1 ? '' : F.place) + '"></div>' +
            '<div class="cmdl-row2">' + counter('crowd', 'จำนวนผู้ชุมนุม (คน)', F.crowd, [50, 100, 150, 200, 300], 10) + counter('vehicles', 'จำนวนรถยนต์ (คัน)', F.vehicles, [5, 10, 15, 20], 1) + '</div>' +
            '<div class="cmdl-sec"><span>กลุ่มผู้ชุมนุม/บุคคลที่พบ</span>' + chipRow('groups', GROUPS, F.groups, true) + '</div>' +
            '<div class="cmdl-sec"><span>พฤติการณ์เสี่ยง/ฝ่าฝืน (แตะเพื่อใส่ข้อความและมาตรา)</span>' + chipRow('risks', RISKS, F.risks, true) + '</div>' +
            (showAnn ? '<div class="cmdl-sec"><span>ประกาศ</span>' + chipRow('announce', ANNOUNCES, F.announce, false) +
                '<div class="cmdl-dl"><span>กำหนดเวลาให้ปฏิบัติ</span>' + [15, 20, 30, 45, 60].map((m) => '<button type="button" class="cmdl-chip' + (F.deadlineMin === m ? ' on' : '') + '" data-l-chip="deadline" data-v="' + m + '">' + m + ' นาที</button>').join('') +
                '<input data-l-in="deadline" type="number" min="1" max="600" inputmode="numeric" value="' + esc(F.deadlineMin || '') + '" aria-label="นาที"></div>' +
                '<p class="cmdl-hint"><i class="fa-solid fa-scale-balanced"></i> ม.21 ต้องกำหนดเวลาให้ได้สัดส่วนกับจำนวนผู้ชุมนุม (100–200 คน) และเส้นทางออก — ห้ามสั้นเกินวิสัย · ม.23 กำหนดเป็นนาทีได้ (20–30 นาที)</p></div>' : '') +
            (outs.length ? '<div class="cmdl-sec"><span>ผลการดำเนินการ</span>' + chipRow('outcome', outs, F.outcome, true) + '</div>' : '') +
            '<div class="cmdl-sec"><span>หลักฐานที่บันทึกไว้</span>' + chipRow('evidence', EVIDENCE, F.evidence, true) + '</div>' +
            '<div class="cmdl-sec"><span>ปรับระดับสถานการณ์ (ถ้าต้องการ)</span>' + chipRow('level', [{ id: '', label: 'คงเดิม' }, { id: 'green', label: '🟢 เขียว' }, { id: 'yellow', label: '🟡 เหลือง' }, { id: 'red', label: '🔴 แดง' }], F.level, false) + '</div>' +
            '<label class="cmd-f"><span>หัวข้อ</span><input data-l-in="title" type="text" value="' + esc(F.title || '') + '" placeholder="สร้างให้อัตโนมัติจากตัวเลือก"></label>' +
            '<label class="cmd-f"><span>รายละเอียด <button type="button" class="cmd-btn sm neon" data-l="compose"><i class="fa-solid fa-wand-magic-sparkles"></i> เรียบเรียงข้อความอัตโนมัติ</button></span>' +
                '<textarea data-l-in="detail" rows="4" placeholder="แตะตัวเลือกด้านบน ระบบจะเรียบเรียงข้อความทางการให้ แก้ไขต่อได้">' + esc(F.detail || '') + '</textarea></label>' +
            '<div class="cmdl-row2"><label class="cmd-f"><span>ข้อกฎหมายที่เกี่ยวข้อง</span><input data-l-in="law" type="text" value="' + esc(F.law || '') + '" placeholder="เช่น ม.15(6) / ม.31 ว.1"></label>' +
                '<label class="cmd-f"><span>อ้างอิงหลักฐาน (ไฟล์/ผู้ถ่าย)</span><input data-l-in="evref" type="text" value="' + esc(F.evref || '') + '" placeholder="เช่น คลิป IMG_0123 ด.ต.…"></label></div>' +
            '<div class="cmdl-actions">' +
                (F.editId ? '<button type="button" class="cmd-btn" data-l="cancel">ยกเลิกการแก้ไข</button>' : '<button type="button" class="cmd-btn" data-l="reset"><i class="fa-solid fa-eraser"></i> ล้างฟอร์ม</button>') +
                '<button type="button" class="cmd-btn gold" data-l="save"><i class="fa-solid fa-floppy-disk"></i> ' + (F.editId ? 'บันทึกการแก้ไข' : 'บันทึกเหตุการณ์') + '</button>' +
            '</div></div>';
        if (!F.titleDirty || !F.detailDirty) autoCompose(false);
    }
    function counter(key, label, val, presets, step) {
        return '<div class="cmd-f"><span>' + label + '</span><div class="cmdl-count">' +
            '<button type="button" class="cmd-btn sm" data-l-step="' + key + '" data-d="-' + step + '">−' + step + '</button>' +
            '<input data-l-in="' + key + '" type="number" min="0" inputmode="numeric" value="' + (val == null ? '' : val) + '" placeholder="-">' +
            '<button type="button" class="cmd-btn sm" data-l-step="' + key + '" data-d="' + step + '">+' + step + '</button></div>' +
            '<div class="cmdl-presets">' + presets.map((p) => '<button type="button" class="cmdl-chip" data-l-set="' + key + '" data-v="' + p + '">' + p + '</button>').join('') + '</div></div>';
    }

    function readForm() {
        const g = (n) => { const x = $('[data-l-in="' + n + '"]'); return x ? x.value : ''; };
        F.unit = g('unit') || F.unit;
        const pl = g('place').trim(); if (pl) F.place = pl;
        F.crowd = num(g('crowd')); F.vehicles = num(g('vehicles'));
        F.title = g('title'); F.detail = g('detail'); F.law = g('law'); F.evref = g('evref');
        if (F.manualTime) F.at = fromLocal(g('time'));
        const dl = num(g('deadline')); if (dl) F.deadlineMin = dl;
    }

    // เรียบเรียงข้อความทางการจากตัวเลือก
    function compose() {
        const at = F.manualTime && F.at ? F.at : Date.now();
        const parts = ['เวลา ' + hm(at) + ' น.'];
        if (F.unit) parts.push(F.unit + 'รายงานว่า');
        if (F.place) parts.push('บริเวณ' + F.place);
        if (F.groups.length) parts.push('พบ' + F.groups.join(' ') );
        if (F.crowd != null) parts.push('มีผู้ชุมนุมประมาณ ' + F.crowd + ' คน');
        if (F.vehicles != null) parts.push('รถยนต์ประมาณ ' + F.vehicles + ' คัน');
        const stepDef = STEP[F.step];
        if (stepDef && !F.risks.length && !F.announce) parts.push(stepDef.title);
        F.risks.forEach((id) => { const r = RISKS.find((x) => x.id === id); if (r) parts.push(r.text); });
        if (F.announce) {
            const a = ANNOUNCES.find((x) => x.id === F.announce);
            const dl = F.deadlineMin ? at + F.deadlineMin * 60000 : 0;
            if (a) parts.push('เจ้าพนักงานดูแลการชุมนุมสาธารณะ' + a.text + (dl ? ' กำหนดให้ปฏิบัติภายใน ' + F.deadlineMin + ' นาที (ครบกำหนดเวลา ' + hm(dl) + ' น.)' : '') + ' โดยบันทึกภาพและเสียงขณะประกาศไว้ต่อเนื่อง');
        }
        if (F.outcome.length) parts.push('ผลการดำเนินการ: ' + F.outcome.join(' / '));
        if (F.evidence.length) parts.push('ได้บันทึก' + F.evidence.join(' ') + 'ไว้เป็นหลักฐาน');
        return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    function autoTitle() {
        const stepDef = STEP[F.step];
        if (F.announce) { const a = ANNOUNCES.find((x) => x.id === F.announce); return 'ประกาศ' + (a ? a.label : ''); }
        if (F.risks.length) { const r = RISKS.find((x) => x.id === F.risks[0]); return (F.kind === 'violation' ? 'ฝ่าฝืน: ' : 'เหตุเสี่ยง: ') + (r ? r.label : '') + (F.risks.length > 1 ? ' และอื่นๆ' : ''); }
        if (stepDef) return stepDef.title;
        return KINDS[F.kind].label;
    }
    function autoLaw() {
        const laws = F.risks.map((id) => (RISKS.find((x) => x.id === id) || {}).law).filter(Boolean);
        if (F.announce) laws.push((ANNOUNCES.find((x) => x.id === F.announce) || {}).law);
        return laws.join(' · ');
    }
    function autoCompose(force) {
        const t = $('[data-l-in="title"]'), d = $('[data-l-in="detail"]'), l = $('[data-l-in="law"]');
        if (t && (force || !F.titleDirty)) { t.value = autoTitle(); F.title = t.value; }
        if (d && (force || !F.detailDirty)) { d.value = compose(); F.detail = d.value; }
        if (l && (force || !F.lawDirty)) { l.value = autoLaw(); F.law = l.value; }
    }

    function saveForm() {
        const ev = api.active(); if (!ev) return;
        readForm();
        const by = ($('[data-l-in="by"]') || {}).value || '';
        if (by) setRecorder(by.trim());
        if (!F.title && !F.detail) { api.toast('กรุณาเลือกตัวเลือกหรือกรอกรายละเอียด'); return; }
        const at = F.manualTime && F.at ? F.at : Date.now();
        const kind = F.risks.length && (F.kind === 'sitrep' || F.kind === 'crowd') ? 'risk' : F.kind;
        const data = {
            at: new Date(at).toISOString(), kind: kind, step: F.step || '', title: F.title || autoTitle(), detail: F.detail || compose(),
            crowd: F.crowd, vehicles: F.vehicles, law: F.law || autoLaw(), unit: F.unit, place: F.place, by: recorder(),
            level: F.level, evidence: [F.evidence.join(', '), F.evref].filter(Boolean).join(' · '),
            deadlineAt: F.announce && F.deadlineMin ? new Date(at + F.deadlineMin * 60000).toISOString() : ''
        };
        if (F.editId) {
            const e = logOf(ev).find((x) => x.id === F.editId);
            if (e) { Object.assign(e, data, { by: e.by || data.by }); api.save(); }
            api.toast('แก้ไขบันทึกแล้ว');
        } else {
            addEntry(ev, data);
            api.toast('บันทึกเหตุการณ์ ' + hm(at) + ' น. แล้ว');
        }
        F = Object.assign(freshForm(ev), { unit: F.unit, place: F.place, crowd: F.crowd, vehicles: F.vehicles });
        renderForm(); refresh();
    }

    function openStep(id) {
        const ev = api.active(), s = STEP[id]; if (!ev || !s) return;
        const done = stepEntries(ev, id);
        if (!s.form) {
            if (done.length && !s.repeat && !window.confirm('ขั้นตอน "' + s.label + '" บันทึกไว้แล้วเมื่อ ' + hm(Date.parse(done[0].at)) + ' น.\nบันทึกซ้ำอีกครั้ง?')) return;
            addEntry(ev, { kind: s.kind, step: s.id, title: s.title, detail: 'เวลา ' + hm(Date.now()) + ' น. ' + s.title, unit: s.unit, place: s.place });
            api.toast('ลงเวลา "' + s.label + '" ' + hm(Date.now()) + ' น.');
            return;
        }
        F = Object.assign(freshForm(ev), { kind: s.kind, step: s.id, unit: s.unit, place: s.place, risks: s.risk ? [s.risk] : [] });
        if (s.id === 'announce') F.announce = 'a212';
        if (s.id === 'control') F.announce = 'a23';
        if (s.id === 'm25') F.announce = 'a25';
        if (s.id === 'refuse') F.kind = 'violation';
        renderForm();
        const card = $('[data-l-box="formcard"]');
        const t = $('[data-l-box="formtitle"]'); if (t) t.textContent = 'บันทึก: ' + s.label;
        if (card) { card.classList.add('cmdl-flash'); setTimeout(() => card.classList.remove('cmdl-flash'), 900); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }

    function editEntry(id) {
        const ev = api.active(); if (!ev) return;
        const e = logOf(ev).find((x) => x.id === id); if (!e) return;
        F = Object.assign(freshForm(ev), {
            editId: e.id, kind: FORM_KINDS.indexOf(e.kind) > -1 ? e.kind : 'note', step: e.step, unit: e.unit, place: e.place, crowd: e.crowd, vehicles: e.vehicles,
            title: e.title, detail: e.detail, law: e.law, evref: e.evidence, manualTime: true, at: Date.parse(e.at), titleDirty: true, detailDirty: true, lawDirty: true
        });
        renderForm();
        const t = $('[data-l-box="formtitle"]'); if (t) t.textContent = 'แก้ไขบันทึก ' + hm(Date.parse(e.at)) + ' น.';
        const card = $('[data-l-box="formcard"]'); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function deleteEntry(id) {
        const ev = api.active(); if (!ev) return;
        const e = logOf(ev).find((x) => x.id === id); if (!e) return;
        if (!window.confirm('ลบบันทึก ' + hm(Date.parse(e.at)) + ' น. "' + e.title + '" ?')) return;
        ev.log = logOf(ev).filter((x) => x.id !== id);
        api.save(); refresh(); api.toast('ลบบันทึกแล้ว');
    }

    /* ---------------- ส่วนที่อัปเดตบ่อย ---------------- */
    function refresh() {
        const ev = api.active(); if (!ev || !el.querySelector('.cmdl')) return;
        const list = sorted(ev);
        const set = (k, v) => { const x = $('[data-l-stat="' + k + '"]'); if (x) x.textContent = v; };
        set('count', list.length + ' รายการ');
        const c = latestCount(ev, 'crowd'), v = latestCount(ev, 'vehicles');
        set('crowd', c == null ? '-' : c + ' คน'); set('veh', v == null ? '-' : v + ' คัน');
        set('last', list.length ? hm(Date.parse(list[list.length - 1].at)) + ' น.' : '-');
        renderSteps(ev); renderList(ev); renderBanners(ev);
    }

    function currentPhase(ev) {
        const now = Date.now(), s = api.startOf(ev), e = api.endOf(ev);
        if (stepEntries(ev, 'end').length || stepEntries(ev, 'clear').length) return 'D';
        if (logOf(ev).some((x) => ['court', 'control', 'arrest'].indexOf(x.kind) > -1)) return 'C';
        if (e && now >= e) return 'D';
        if (s && now >= s) return 'B';
        return 'A';
    }
    let openPhases = null;
    function renderSteps(ev) {
        const box = $('[data-l-box="steps"]'); if (!box) return;
        if (!openPhases) { openPhases = {}; openPhases[currentPhase(ev)] = true; }
        box.innerHTML = PHASES.map((p) => {
            const doneN = p.steps.filter((s) => stepEntries(ev, s.id).length).length;
            const open = !!openPhases[p.id];
            return '<div class="cmdl-phase' + (open ? ' open' : '') + '">' +
                '<button type="button" class="cmdl-ph-h" data-l-phase="' + p.id + '" aria-expanded="' + open + '"><b>' + esc(p.title) + '</b><small>' + doneN + '/' + p.steps.length + '</small><i class="fa-solid fa-chevron-down"></i></button>' +
                (open ? '<div class="cmdl-steplist">' + p.steps.map((s) => {
                    const d = stepEntries(ev, s.id), k = KINDS[s.kind];
                    return '<button type="button" class="cmdl-step' + (d.length ? ' done' : '') + '" data-l-stepbtn="' + s.id + '" data-tone="' + k.tone + '">' +
                        '<i class="fa-solid ' + (d.length && !s.repeat ? 'fa-circle-check' : k.icon) + '"></i><span><b>' + esc(s.label) + '</b><small>' +
                        (d.length ? '✓ ' + d.map((x) => hm(Date.parse(x.at))).slice(-3).join(', ') + ' น.' + (d.length > 3 ? ' (+' + (d.length - 3) + ')' : '') : (s.form ? 'แตะเพื่อกรอกรายละเอียด' : 'แตะเพื่อลงเวลา')) +
                        '</small></span>' + (s.repeat ? '<em>ซ้ำได้</em>' : '') + '</button>';
                }).join('') + '</div>' : '') + '</div>';
        }).join('');
    }

    function rowsFor(ev, opts) {
        const o = opts || {};
        let rows = sorted(ev).map((x) => Object.assign({ src: 'log' }, x));
        if (o.levels) (ev.levelLog || []).forEach((l) => rows.push({ src: 'level', at: l.at, kind: 'note', title: 'ปรับระดับสถานการณ์เป็น' + ((api.LEVELS[l.level] || {}).name || l.level), detail: '', unit: 'ศปก.ส่วนหน้า', level: l.level }));
        if (o.schedule) {
            const m = api.musterOf(ev), s = api.startOf(ev), e = api.endOf(ev);
            if (m) rows.push({ src: 'plan', at: new Date(m).toISOString(), title: 'กำหนดการ: ' + (ev.musterLabel || 'รวมพล/ปล่อยแถว'), detail: '' });
            if (s) rows.push({ src: 'plan', at: new Date(s).toISOString(), title: 'กำหนดการ: เวลาเริ่มการชุมนุมตามที่แจ้ง', detail: '' });
            const six = s ? new Date(s).setHours(6, 0, 0, 0) : 0;   // เริ่มก่อน 06.00 น. → มีช่วงห้ามใช้เครื่องขยายเสียง
            if (s && six > s && ev.category === 'ชุมนุมสาธารณะ') rows.push({ src: 'plan', at: new Date(six).toISOString(), title: 'กำหนดการ: สิ้นสุดช่วงห้ามใช้เครื่องขยายเสียง (ม.15(6))', detail: '' });
            if (e) rows.push({ src: 'plan', at: new Date(e).toISOString(), title: 'กำหนดการ: ครบกำหนดเวลาเลิกการชุมนุมตามที่แจ้ง (ม.18)', detail: '' });
        }
        if (o.court) rows = rows.filter((r) => r.src !== 'log' || COURT_KINDS.indexOf(r.kind) > -1);
        return rows.filter((r) => r.at).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    }

    function renderList(ev) {
        const fbox = $('[data-l-box="filters"]'), box = $('[data-l-box="list"]'), ob = $('[data-l="order"]');
        if (!box) return;
        if (ob) ob.innerHTML = newestFirst ? '<i class="fa-solid fa-arrow-down-wide-short"></i> ใหม่ → เก่า' : '<i class="fa-solid fa-arrow-up-wide-short"></i> เก่า → ใหม่';
        const FILTERS = [['all', 'ทั้งหมด'], ['law', 'เสี่ยง/ฝ่าฝืน'], ['act', 'เจรจา/ประกาศ'], ['court', 'ศาล/ควบคุม'], ['ops', 'กำลังพล']];
        if (fbox) fbox.innerHTML = FILTERS.map((f) => '<button type="button" class="cmdl-chip' + (filter === f[0] ? ' on' : '') + '" data-l-filter="' + f[0] + '">' + f[1] + '</button>').join('');
        const match = { all: () => true, law: (x) => x.kind === 'risk' || x.kind === 'violation', act: (x) => ['negotiate', 'announce', 'deadline'].indexOf(x.kind) > -1,
            court: (x) => ['court', 'control', 'arrest'].indexOf(x.kind) > -1, ops: (x) => ['muster', 'deploy', 'post'].indexOf(x.kind) > -1 };
        let rows = rowsFor(ev, { levels: filter === 'all' }).filter((x) => x.src !== 'log' || match[filter](x));
        if (newestFirst) rows.reverse();
        const total = rows.length;
        if (!showAll) rows = rows.slice(0, 15);
        if (!total) { box.innerHTML = '<div class="cmd-empty" style="padding:16px">ยังไม่มีบันทึก — เริ่มจากกด "ปล่อยแถวชี้แจงการปฏิบัติ"</div>'; return; }
        box.innerHTML = '<ol class="cmdl-list">' + rows.map((x) => {
            if (x.src === 'level') return '<li class="cmdl-it lvl"><time>' + hm(Date.parse(x.at)) + '</time><div class="cmdl-body"><span class="cmdl-kind"><i class="cmd-dot ' + esc(x.level) + '"></i> ระดับสถานการณ์</span><b>' + esc(x.title) + '</b></div></li>';
            const k = KINDS[x.kind] || KINDS.note;
            const meta = [];
            if (x.unit) meta.push('<span><i class="fa-solid fa-user-shield"></i>' + esc(x.unit) + '</span>');
            if (x.place) meta.push('<span><i class="fa-solid fa-location-dot"></i>' + esc(x.place) + '</span>');
            if (x.crowd != null) meta.push('<span><i class="fa-solid fa-people-group"></i>' + x.crowd + ' คน</span>');
            if (x.vehicles != null) meta.push('<span><i class="fa-solid fa-car-side"></i>' + x.vehicles + ' คัน</span>');
            if (x.deadlineAt) meta.push('<span class="dl"><i class="fa-solid fa-hourglass-half"></i>ครบกำหนด ' + hm(Date.parse(x.deadlineAt)) + ' น.</span>');
            if (x.evidence) meta.push('<span><i class="fa-solid fa-camera"></i>' + esc(x.evidence) + '</span>');
            if (x.by) meta.push('<span><i class="fa-solid fa-pen"></i>' + esc(x.by) + '</span>');
            return '<li class="cmdl-it" data-tone="' + k.tone + '"><time>' + hm(Date.parse(x.at)) + '<small>' + api.thDateShort(Date.parse(x.at)) + '</small></time>' +
                '<div class="cmdl-body"><span class="cmdl-kind"><i class="fa-solid ' + k.icon + '"></i> ' + k.label + (x.law ? ' · <em>' + esc(x.law) + '</em>' : '') + '</span>' +
                '<b>' + esc(x.title) + '</b>' + (x.detail && x.detail !== x.title ? '<p>' + esc(x.detail) + '</p>' : '') +
                (meta.length ? '<div class="cmdl-meta">' + meta.join('') + '</div>' : '') + '</div>' +
                '<div class="cmdl-ops"><button type="button" data-l-edit="' + esc(x.id) + '" title="แก้ไข" aria-label="แก้ไข"><i class="fa-solid fa-pen"></i></button>' +
                '<button type="button" data-l-del="' + esc(x.id) + '" title="ลบ" aria-label="ลบ"><i class="fa-solid fa-trash"></i></button></div></li>';
        }).join('') + '</ol>' +
            (total > 15 ? '<button type="button" class="cmd-btn sm cmdl-more" data-l="more">' + (showAll ? 'แสดงเฉพาะ 15 รายการ' : 'แสดงทั้งหมด ' + total + ' รายการ') + '</button>' : '');
    }

    // แถบเตือน: ครบกำหนดตามประกาศ / ถึงเวลาเลิกตามแจ้ง
    function renderBanners(ev) {
        const box = $('[data-l-box="banners"]'); if (!box) return;
        const now = Date.now(), html = [];
        const log = sorted(ev);
        log.filter((x) => x.deadlineAt).forEach((x) => {
            const dl = Date.parse(x.deadlineAt);
            const answered = log.some((y) => y.kind === 'deadline' && y.ref === x.id);
            if (answered) return;
            if (now < dl) html.push('<div class="cmdl-banner wait"><i class="fa-solid fa-hourglass-half"></i><span><b>' + esc(x.title) + '</b> ครบกำหนดเวลา ' + hm(dl) + ' น. — อีก <em data-l-cd="' + dl + '">' + left(dl - now) + '</em></span></div>');
            else html.push('<div class="cmdl-banner due"><i class="fa-solid fa-bell"></i><span><b>ครบกำหนดตาม' + esc(x.title) + ' (' + hm(dl) + ' น.)</b> บันทึกผล:</span>' +
                '<button type="button" class="cmd-btn sm" data-l-due="ok" data-ref="' + esc(x.id) + '">ปฏิบัติตามแล้ว</button>' +
                '<button type="button" class="cmd-btn sm danger" data-l-due="no" data-ref="' + esc(x.id) + '">ไม่ปฏิบัติตาม</button></div>');
        });
        const e = api.endOf(ev);
        const ended = log.some((x) => x.step === 'end' || x.step === 'refuse' || x.step === 'clear');
        if (e && now >= e && !ended && now - e < 12 * 3600000) {
            html.push('<div class="cmdl-banner due"><i class="fa-solid fa-flag-checkered"></i><span><b>ครบเวลาเลิกการชุมนุมตามแจ้ง ' + hm(e) + ' น.</b> ผู้ชุมนุมเลิกแล้วหรือไม่?</span>' +
                '<button type="button" class="cmd-btn sm" data-l-stepbtn="end">เลิก/แยกย้ายแล้ว</button>' +
                '<button type="button" class="cmd-btn sm danger" data-l-stepbtn="refuse">ยังไม่เลิก (ม.18)</button></div>');
        }
        box.innerHTML = html.join('');
        bannerAt = now;
    }
    let bannerAt = 0;
    function left(ms) { const t = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(t / 60), s = t % 60; return m >= 60 ? Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' นาที' : m + ':' + pad(s) + ' นาที'; }
    function tick() {
        if (!el) return;
        const ev = api.active(); if (!ev) return;
        let needs = false;
        el.querySelectorAll('[data-l-cd]').forEach((x) => { const dl = Number(x.dataset.lCd); if (Date.now() >= dl) needs = true; else x.textContent = left(dl - Date.now()); });
        const e = api.endOf(ev);
        if (needs || (e && Date.now() >= e && bannerAt < e)) renderBanners(ev);   // เพิ่งถึงเวลาเลิกตามแจ้ง → ขึ้นแถบถามผล
        const tIn = $('[data-l-in="time"]');
        if (tIn && !F.manualTime) tIn.value = toLocal(Date.now());
    }
    function answerDeadline(refId, ok) {
        const ev = api.active(); if (!ev) return;
        const a = logOf(ev).find((x) => x.id === refId); if (!a) return;
        const dl = Date.parse(a.deadlineAt);
        addEntry(ev, {
            kind: 'deadline', ref: refId, unit: 'ศปก.ส่วนหน้า', place: a.place, law: a.law,
            title: ok ? 'ครบกำหนดตามประกาศ ผู้ชุมนุมปฏิบัติตามแล้ว' : 'ครบกำหนดตามประกาศแล้ว ผู้ชุมนุมไม่ปฏิบัติตาม',
            detail: 'เวลา ' + hm(Date.now()) + ' น. ครบกำหนดเวลาตาม' + a.title + ' (กำหนด ' + hm(dl) + ' น.) ' + (ok ? 'ผู้ชุมนุมได้ปฏิบัติตามประกาศแล้ว' : 'ผู้ชุมนุมยังคงเพิกเฉยไม่ปฏิบัติตามประกาศ เห็นควรดำเนินการยื่นคำร้องต่อศาลแพ่งมีนบุรีตามมาตรา 21 วรรคสอง'),
            crowd: latestCount(ev, 'crowd'), vehicles: latestCount(ev, 'vehicles')
        });
    }

    /* ---------------- คัดลอก LINE / CSV ---------------- */
    function lineText(ev) {
        const rows = rowsFor(ev, {}).slice(-12);
        const L = ['📋 บันทึกเหตุการณ์ ศปก.ส่วนหน้า', ev.title, '📍 ' + (ev.place || '-'),
            '👥 มวลชนล่าสุด ' + (latestCount(ev, 'crowd') == null ? '-' : latestCount(ev, 'crowd') + ' คน') + ' · รถ ' + (latestCount(ev, 'vehicles') == null ? '-' : latestCount(ev, 'vehicles') + ' คัน') +
            ' · ระดับ ' + (api.LEVELS[ev.level] || {}).emoji + ' ' + (api.LEVELS[ev.level] || {}).short, ''];
        rows.forEach((x) => L.push('• ' + hm(Date.parse(x.at)) + ' น. ' + x.title + (x.law ? ' [' + x.law + ']' : '') + (x.crowd != null ? ' (' + x.crowd + ' คน)' : '')));
        L.push('', 'ข้อมูล ณ ' + api.thDateShort(Date.now()) + ' ' + api.hmTh(Date.now()));
        return L.join('\n');
    }
    function exportCsv(ev) {
        const head = ['ลำดับ', 'วันที่', 'เวลา', 'ประเภท', 'หัวข้อ', 'รายละเอียด', 'สายงาน', 'จุด', 'จำนวนผู้ชุมนุม', 'จำนวนรถ', 'ข้อกฎหมาย', 'หลักฐาน', 'ผู้บันทึก'];
        const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const lines = [head.map(q).join(',')].concat(sorted(ev).map((x, i) => [i + 1, api.thDateShort(Date.parse(x.at)), hm(Date.parse(x.at)) + ' น.', (KINDS[x.kind] || KINDS.note).label, x.title, x.detail, x.unit, x.place, x.crowd, x.vehicles, x.law, x.evidence, x.by].map(q).join(',')));
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        const d = new Date();
        a.href = URL.createObjectURL(blob); a.download = 'บันทึกเหตุการณ์-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        api.toast('ส่งออกไฟล์ CSV แล้ว (เปิดด้วย Excel ได้)');
    }

    /* ---------------- พิมพ์ตารางลำดับเหตุการณ์ (เอกสารแนบท้ายคำร้อง) ---------------- */
    function printPrefs() {
        let p = {};
        try { p = JSON.parse(localStorage.getItem(PRINT_KEY) || '{}') || {}; } catch (e) { p = {}; }
        return Object.assign({ scope: 'court', schedule: true, levels: false, attach: 'เอกสารแนบท้ายคำร้องหมายเลข ๕', thai: true, landscape: false,
            maker: recorder(), checker: 'พันตำรวจโท อัคเดช ลัดดาวัลย์', checkerPos: 'รองผู้กำกับการ (สอบสวน) สถานีตำรวจนครบาลลำหิน' }, p);
    }
    function printDialog() {
        const ev = api.active(); if (!ev) return;
        if (!logOf(ev).length) { api.toast('ยังไม่มีบันทึกเหตุการณ์ให้พิมพ์'); return; }
        const p = printPrefs();
        api.modal({
            title: 'พิมพ์บันทึกลำดับเหตุการณ์', icon: 'fa-print',
            body: '<div class="cmd-form">' +
                api.field('ขอบเขต', 'scope', p.scope, 'select', { cls: 'full', options: [['court', 'เฉพาะเหตุการณ์ประกอบคำร้องศาล (สถานการณ์ ฝ่าฝืน เจรจา ประกาศ ครบกำหนด ศาล)'], ['all', 'ทุกรายการ (รวมการจัดกำลัง/ประจำจุด)']] }) +
                api.field('ข้อความกำกับมุมขวาบน', 'attach', p.attach, 'text', { cls: 'full', ph: 'เช่น เอกสารแนบท้ายคำร้องหมายเลข ๕ (เว้นว่างได้)' }) +
                api.field('แสดงกำหนดการตามหนังสือแจ้ง', 'schedule', p.schedule ? '1' : '0', 'select', { options: [['1', 'แสดง'], ['0', 'ไม่แสดง']] }) +
                api.field('แสดงการปรับระดับสถานการณ์', 'levels', p.levels ? '1' : '0', 'select', { options: [['0', 'ไม่แสดง'], ['1', 'แสดง']] }) +
                api.field('ตัวเลข', 'thai', p.thai ? '1' : '0', 'select', { options: [['1', 'เลขไทย (ตามหนังสือราชการ)'], ['0', 'เลขอารบิก']] }) +
                api.field('แนวกระดาษ', 'landscape', p.landscape ? '1' : '0', 'select', { options: [['0', 'แนวตั้ง A4'], ['1', 'แนวนอน A4']] }) +
                api.field('ผู้บันทึก (ยศ ชื่อ-สกุล)', 'maker', p.maker, 'text') +
                api.field('ผู้ตรวจสอบ/รับรอง', 'checker', p.checker, 'text') +
                api.field('ตำแหน่งผู้ตรวจสอบ', 'checkerPos', p.checkerPos, 'text', { cls: 'full' }) +
                '</div>',
            actions: [
                { label: 'ยกเลิก', run: (c) => c() },
                { label: '<i class="fa-solid fa-print"></i> พิมพ์ / บันทึก PDF', cls: 'gold', run: (close, box) => {
                    const v = (n) => api.formVal(box, n);
                    const np = { scope: v('scope'), attach: v('attach'), schedule: v('schedule') === '1', levels: v('levels') === '1', thai: v('thai') === '1', landscape: v('landscape') === '1', maker: v('maker'), checker: v('checker'), checkerPos: v('checkerPos') };
                    try { localStorage.setItem(PRINT_KEY, JSON.stringify(np)); } catch (e) { /* ไม่จำก็ได้ */ }
                    close(); printLog(ev, np);
                } }
            ]
        });
    }
    function printHtml(ev, p) {
        const T = (s) => p.thai ? thDigits(s) : String(s == null ? '' : s);
        const rows = rowsFor(ev, { court: p.scope === 'court', schedule: p.schedule, levels: p.levels });
        const s = api.startOf(ev);
        const multiDay = new Set(rows.map((x) => new Date(x.at).toDateString())).size > 1;   // ข้ามวัน → แสดงวันที่ใต้เวลา
        const tr = rows.map((x, i) => {
            const plan = x.src !== 'log';
            const k = KINDS[x.kind] || KINDS.note;
            const counts = [x.crowd != null ? 'ผู้ชุมนุม ' + x.crowd + ' คน' : '', x.vehicles != null ? 'รถ ' + x.vehicles + ' คัน' : ''].filter(Boolean).join('<br>');
            const what = '<b>' + esc(x.title) + '</b>' + (x.detail && x.detail !== x.title ? '<br>' + esc(x.detail) : '') +
                (x.place && !plan ? '<br><span class="m">จุด: ' + esc(x.place) + '</span>' : '') + (x.unit && !plan ? '<span class="m"> · ผู้รายงาน: ' + esc(x.unit) + '</span>' : '');
            return '<tr class="' + (plan ? 'plan' : '') + '"><td class="c">' + T(i + 1) + '</td><td class="c">' + T(hm(Date.parse(x.at))) + ' น.' +
                (multiDay ? '<br><span class="m">' + T(api.thDateShort(Date.parse(x.at))) + '</span>' : '') + (plan ? '' : '<br><span class="m">' + esc(k.label) + '</span>') + '</td>' +
                '<td>' + T(what) + '</td><td class="c">' + T(counts || '-') + '</td><td>' + T(esc(x.law || '-')) + '</td><td>' + T(esc(x.evidence || (plan ? '' : '-'))) + '</td></tr>';
        }).join('');
        const title = 'บันทึกลำดับเหตุการณ์การชุมนุมสาธารณะ';
        const dateLine = s ? api.thDateLong(s) : '';
        const css = '@font-face{font-family:THSarabunDoc;src:url("cmd/fonts/THSarabunPSK.woff") format("woff");font-weight:400}' +
            '@font-face{font-family:THSarabunDoc;src:url("cmd/fonts/THSarabunPSK-Bold.woff") format("woff");font-weight:700}' +
            // เลขหน้าตามระเบียบงานสารบรรณ: กึ่งกลางหัวกระดาษ "- ๒ -" ตั้งแต่หน้า 2
            '@page{size:A4 ' + (p.landscape ? 'landscape' : 'portrait') + ';margin:2cm 2cm 2cm 3cm;@top-center{content:"- " counter(page' + (p.thai ? ', thai' : '') + ') " -";font-family:THSarabunDoc,"TH SarabunPSK",Sarabun,sans-serif;font-size:16pt}}' +
            '@page:first{@top-center{content:none}}' +
            '*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#000}body{font-family:THSarabunDoc,"TH SarabunPSK","TH Sarabun New",Sarabun,sans-serif;font-size:16pt;line-height:1.15}' +
            '.att{text-align:right;font-size:14pt;margin:0 0 4pt}h1{font-size:20pt;text-align:center;margin:0}.sub{text-align:center;margin:2pt 0 0}' +
            '.info{margin:8pt 0 8pt;font-size:15pt}.info div{margin:1pt 0}' +
            'table{width:100%;border-collapse:collapse;font-size:14pt;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}' +
            'th,td{border:1px solid #000;padding:3pt 5pt;vertical-align:top}th{background:#e9e9e9;font-weight:700;text-align:center}' +
            'td.c{text-align:center;white-space:nowrap}.m{font-size:12.5pt;color:#333}tr.plan td{font-style:italic;color:#444;background:#f6f6f6}' +
            '.cert{margin-top:12pt;text-indent:2.5cm;text-align:justify}.signs{display:flex;justify-content:space-around;margin-top:22pt;page-break-inside:avoid}.signs div{text-align:center;min-width:40%}' +
            '.signs p{margin:0}';
        const sign = (label, name, pos) => '<div><p>(ลงชื่อ) ..................................................... ' + label + '</p><p>(' + esc(name || '.....................................................') + ')</p>' + (pos ? '<p>' + esc(pos) + '</p>' : '') + '</div>';
        const body =
            (p.attach ? '<p class="att">' + esc(T(p.attach)) + '</p>' : '') +
            '<h1>' + title + '</h1><p class="sub">' + esc(ev.title) + '</p>' +
            '<div class="info">' +
                '<div><b>สถานที่</b> ' + T(esc(ev.place || '-')) + (ev.latlng ? ' (พิกัด ' + T(esc(ev.latlng)) + ')' : '') + '</div>' +
                '<div><b>วันเวลาตามที่แจ้ง</b> ' + T(esc(dateLine)) + ' เวลา ' + T(esc(api.hmStr(ev.start))) + ' ถึง ' + T(esc(api.hmStr(ev.end))) + '</div>' +
                (ev.organizer ? '<div><b>ผู้จัดการชุมนุม</b> ' + T(esc(ev.organizer.split(' · ')[0])) + '</div>' : '') +
                (ev.ref ? '<div><b>หลักฐานการรับแจ้ง</b> ' + T(esc(ev.ref)) + '</div>' : '') +
                '<div><b>บันทึกโดย</b> ศูนย์ปฏิบัติการส่วนหน้า สถานีตำรวจนครบาลลำหิน</div>' +
            '</div>' +
            '<table><thead><tr><th style="width:6%">ลำดับ</th><th style="width:11%">เวลา</th><th>เหตุการณ์ / พฤติการณ์</th><th style="width:11%">จำนวน</th><th style="width:13%">ข้อกฎหมาย</th><th style="width:11%">หลักฐาน</th></tr></thead><tbody>' + tr + '</tbody></table>' +
            '<p class="cert">ข้าพเจ้าขอรับรองว่าบันทึกลำดับเหตุการณ์ฉบับนี้ จัดทำขึ้นตามเหตุการณ์ที่เกิดขึ้นจริงในขณะปฏิบัติหน้าที่ดูแลการชุมนุมสาธารณะ ณ สถานที่และวันเวลาดังกล่าวข้างต้น โดยมีภาพถ่ายและคลิปวิดีโอบันทึกเหตุการณ์ประกอบตามที่ระบุไว้</p>' +
            '<div class="signs">' + sign('ผู้บันทึก', p.maker, '') + sign('ผู้ตรวจสอบ', p.checker, p.checkerPos) + '</div>';
        return '<!doctype html><html lang="th"><head><meta charset="utf-8"><title>' + title + '</title><style>' + css + '</style></head><body>' + body + '</body></html>';
    }
    function printLog(ev, p) {
        const old = document.getElementById('cmdl-print'); if (old) old.remove();
        const f = document.createElement('iframe');
        f.id = 'cmdl-print';
        f.setAttribute('aria-hidden', 'true');
        f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
        document.body.appendChild(f);
        const d = f.contentDocument;
        d.open(); d.write(printHtml(ev, p).replace('<head>', '<head><base href="' + esc(document.baseURI) + '">')); d.close();
        const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { api.toast('เปิดหน้าพิมพ์ไม่ได้ในเบราว์เซอร์นี้'); } };
        const ready = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
        Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(go, 150));
    }

    /* ---------------- เหตุการณ์คลิก/พิมพ์ ---------------- */
    function onClick(e) {
        const t = e.target;
        const q = (attr) => t.closest('[' + attr + ']');
        let b;
        const ev = api.active();
        if (!ev) return;
        if ((b = q('data-l-chip'))) {
            readForm();
            const g = b.dataset.lChip, v = b.dataset.v;
            if (g === 'kind') { F.kind = v; if (v !== 'announce' && v !== 'control') F.announce = ''; F.outcome = []; if (v === 'announce' && !F.announce) F.announce = 'a212'; if (v === 'control') F.announce = 'a23'; }
            else if (g === 'place') F.place = v;
            else if (g === 'announce') F.announce = v;
            else if (g === 'deadline') F.deadlineMin = Number(v);
            else if (g === 'level') F.level = v;
            else { const arr = F[g]; const i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); if (g === 'risks' && F.risks.length && (F.kind === 'sitrep' || F.kind === 'crowd' || F.kind === 'note')) F.kind = 'risk'; }
            renderForm();
            return;
        }
        if ((b = q('data-l-step'))) { readForm(); const k = b.dataset.lStep; F[k] = Math.max(0, (F[k] || 0) + Number(b.dataset.d)); const x = $('[data-l-in="' + k + '"]'); if (x) x.value = F[k]; autoCompose(false); return; }
        if ((b = q('data-l-set'))) { readForm(); const k = b.dataset.lSet; F[k] = Number(b.dataset.v); const x = $('[data-l-in="' + k + '"]'); if (x) x.value = F[k]; autoCompose(false); return; }
        if ((b = q('data-l-stepbtn'))) { openStep(b.dataset.lStepbtn); return; }
        if ((b = q('data-l-phase'))) { const id = b.dataset.lPhase; openPhases[id] = !openPhases[id]; renderSteps(ev); return; }
        if ((b = q('data-l-filter'))) { filter = b.dataset.lFilter; showAll = false; renderList(ev); return; }
        if ((b = q('data-l-edit'))) { editEntry(b.dataset.lEdit); return; }
        if ((b = q('data-l-del'))) { deleteEntry(b.dataset.lDel); return; }
        if ((b = q('data-l-due'))) { answerDeadline(b.dataset.ref, b.dataset.lDue === 'ok'); return; }
        if (!(b = q('data-l'))) return;
        const act = b.dataset.l;
        if (act === 'save') saveForm();
        else if (act === 'compose') { readForm(); F.titleDirty = false; F.detailDirty = false; F.lawDirty = false; autoCompose(true); }
        else if (act === 'reset' || act === 'cancel') { F = Object.assign(freshForm(ev), { unit: F.unit, place: F.place }); renderForm(); const tt = $('[data-l-box="formtitle"]'); if (tt) tt.textContent = 'บันทึกเหตุการณ์ (ตัวช่วยกรอก)'; }
        else if (act === 'timemode') { readForm(); F.manualTime = !F.manualTime; if (F.manualTime && !F.at) F.at = Date.now(); renderForm(); }
        else if (act === 'order') { newestFirst = !newestFirst; renderList(ev); }
        else if (act === 'more') { showAll = !showAll; renderList(ev); }
        else if (act === 'print') printDialog();
        else if (act === 'line') api.copyText(lineText(ev));
        else if (act === 'csv') exportCsv(ev);
    }
    function onInput(e) {
        const n = e.target.dataset && e.target.dataset.lIn;
        if (!n) return;
        if (n === 'title') F.titleDirty = true;
        else if (n === 'detail') F.detailDirty = true;
        else if (n === 'law') F.lawDirty = true;
        else if (n === 'by') setRecorder(e.target.value.trim());
        else if (['crowd', 'vehicles', 'place', 'unit', 'deadline', 'time'].indexOf(n) > -1) { readForm(); autoCompose(false); }
    }

    // ให้โมดูลอื่นใช้ร่วม (เช่น คำร้องศาลแพ่งดึงลำดับเหตุการณ์) + ดูตัวอย่างหน้าพิมพ์
    window.LamhinCmdLog = {
        KINDS: KINDS,
        rows: (ev, opts) => rowsFor(ev, opts),
        printHtml: (ev, opts) => printHtml(ev, Object.assign(printPrefs(), opts || {})),
        print: (ev, opts) => printLog(ev, Object.assign(printPrefs(), opts || {}))
    };

    window.LamhinCmd.registerSection({
        id: 'log', label: 'บันทึก ศปก.', icon: 'fa-clipboard-list', order: 35,
        mount(node, a) {
            api = a; el = node;
            el.addEventListener('click', onClick);
            el.addEventListener('input', onInput);
            el.addEventListener('change', onInput);
            build(a.active());
        },
        update(ev) {
            if ((ev ? ev.id : '') !== evId) { openPhases = null; build(ev); }
            else refresh();
        },
        visible(on) {
            clearInterval(timer); timer = 0;
            if (on) { refresh(); timer = setInterval(tick, 1000); }
        }
    });
})();
