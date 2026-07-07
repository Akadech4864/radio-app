/**
 * Config
 * IMPORTANT: User MUST replace this URL with their new Apps Script Web App URL after redeploying!
 */
const API_URL = "https://script.google.com/macros/s/AKfycbwgwvs6i9DQlxCeC0FWZvvDKTMaszpsrSOX3GsqS56SbhUae-Y9JqAnNf13pDnakoS7/exec"; 

// Data State
let appData = {
    duty: [],
    mission: []
};

// Current Date State
let selectedDate = new Date();
let currentCalendarDate = new Date();

// DOM Elements
const dateFilterInput = document.getElementById('dateFilter');
const searchInput = document.getElementById('searchInput');
const displayDateLabel = document.getElementById('displayDateLabel');
const investigatorDuty = document.getElementById('investigatorDuty');
const assistantDuty = document.getElementById('assistantDuty');
const dailyMissions = document.getElementById('dailyMissions');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const calendarDays = document.getElementById('calendarDays');
const searchResultsPanel = document.getElementById('searchResultsPanel');
const searchResultsList = document.getElementById('searchResultsList');

// Initialize
async function init() {
    setupEventListeners();
    updateDateFilterInput();
    updateDisplayDateLabel();
    
    await loadData();
}

function setupEventListeners() {
    dateFilterInput.addEventListener('change', (e) => {
        if(e.target.value) {
            selectedDate = new Date(e.target.value);
            currentCalendarDate = new Date(selectedDate);
            updateDisplayDateLabel();
            renderDashboard();
            renderCalendar();
            clearSearch();
        }
    });

    searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });

    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
}

function updateDateFilterInput() {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    dateFilterInput.value = `${year}-${month}-${day}`;
}

function updateDisplayDateLabel() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    displayDateLabel.innerText = "ข้อมูลประจำ " + selectedDate.toLocaleDateString('th-TH', options);
}

// Utility to parse Thai dates from sheet (dd/MM/yyyy)
function parseSheetDate(dateStr) {
    if (!dateStr) return null;
    try {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Assume dd/mm/yyyy or dd/mm/yyyy HH:mm:ss
            return new Date(`${parts[2].split(' ')[0]}-${parts[1]}-${parts[0]}`);
        }
        return new Date(dateStr);
    } catch(e) {
        return null;
    }
}

// Fetch Data
async function loadData() {
    try {
        if(API_URL === "YOUR_NEW_APPS_SCRIPT_WEB_APP_URL_HERE" || API_URL === "") {
            // Mock data for preview until user sets the URL
            console.log("Using mock data for preview. Please set API_URL in app.js.");
            appData = {
                duty: [], mission: [], personnel: []
            };
        } else {
            const response = await fetch(`${API_URL}?api=radio`);
            const data = await response.json();
            appData = data;
        }
        
        renderDashboard();
        renderCalendar();
    } catch (error) {
        console.error("Error loading data:", error);
        
        // Safeguard appData so renderCalendar doesn't crash
        if (!appData || !appData.duty) {
            appData = { duty: [], mission: [], personnel: [] };
        }
        
        showError("ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบ API URL: " + error.message);
        // Ensure calendar and dashboard still render empty state
        renderDashboard();
        renderCalendar();
    }
}

function showError(msg) {
    investigatorDuty.innerHTML = `<div class="empty-state" style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</div>`;
    assistantDuty.innerHTML = `<div class="empty-state" style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</div>`;
    dailyMissions.innerHTML = `<div class="empty-state" style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</div>`;
}

function getPersonImage(name) {
    if (!appData.personnel) return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    let nameClean = name.replace(/ร\.ต\.อ\.|ร\.ต\.ท\.|ร\.ต\.ต\.|พ\.ต\.ท\.|พ\.ต\.อ\.|พ\.ต\.ต\.|ส\.ต\.อ\.|ส\.ต\.ท\.|ส\.ต\.ต\.|ดาบตำรวจ|จ\.ส\.ต\.|นาย|นางสาว|นาง/g, '').trim().toLowerCase();
    
    for (let row of appData.personnel) {
        if (!row) continue;
        let rowStr = row.join(' ').toLowerCase();
        if (nameClean.length > 2 && rowStr.includes(nameClean)) {
            // Find a URL in this row
            let urlCell = row.find(cell => cell && typeof cell === 'string' && cell.startsWith('http'));
            if (urlCell) return urlCell;
        }
    }
    return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'; // default avatar
}

// Rendering Dashboard
function renderDashboard() {
    const targetDateStr = String(selectedDate.getDate()).padStart(2,'0') + '/' + String(selectedDate.getMonth()+1).padStart(2,'0') + '/' + selectedDate.getFullYear();
    
    // Find duties
    let invs = [];
    let assts = [];
    
    // Assume Duty sheet structure: [Date, Investigator, Assistant, ...]
    const dutyRows = appData.duty.filter(r => r[0] === targetDateStr);
    dutyRows.forEach(row => {
        if(row[1]) invs.push(row[1]);
        if(row[2]) assts.push(row[2]);
    });

    investigatorDuty.innerHTML = invs.length > 0 
        ? invs.map(i => `
            <div class="duty-item">
                <div class="duty-info-wrapper">
                    <img src="${getPersonImage(i)}" alt="${i}" class="duty-face">
                    <span class="duty-name">${i}</span>
                </div>
                <span class="badge">เวร</span>
            </div>`).join('') 
        : '<div class="empty-state">ไม่มีข้อมูลพนักงานสอบสวนเวร</div>';
        
    assistantDuty.innerHTML = assts.length > 0 
        ? assts.map(a => `
            <div class="duty-item">
                <div class="duty-info-wrapper">
                    <img src="${getPersonImage(a)}" alt="${a}" class="duty-face">
                    <span class="duty-name">${a}</span>
                </div>
                <span class="badge">ผู้ช่วยฯ</span>
            </div>`).join('') 
        : '<div class="empty-state">ไม่มีข้อมูลผู้ช่วยพนักงานสอบสวน</div>';

    // Find missions
    // Assume Mission sheet: [Date, Time, Location, Title, Participants, ...]
    const missionRows = appData.mission.filter(r => r[0] === targetDateStr);
    dailyMissions.innerHTML = missionRows.length > 0
        ? missionRows.map(m => `
            <div class="mission-item">
                <div>
                    <div class="mission-title">${m[3] || 'ภารกิจ'}</div>
                    <div class="mission-details">
                        <i class="fa-regular fa-clock"></i> ${m[1] || '-'} | 
                        <i class="fa-solid fa-location-dot"></i> ${m[2] || '-'}
                    </div>
                    <div class="mission-details" style="margin-top:4px">
                        <i class="fa-solid fa-users"></i> ${m[4] || '-'} 
                        ${m[5] ? `(ประธาน: ${m[5]})` : ''}
                    </div>
                </div>
            </div>
          `).join('')
        : '<div class="empty-state">ไม่มีภารกิจวันนี้</div>';
}

// Rendering Calendar
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const thMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    currentMonthLabel.innerText = `${thMonths[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '';
    
    // Empty cells
    for(let i=0; i<firstDay; i++) {
        html += `<div class="day-cell empty"></div>`;
    }
    
    // Days
    const today = new Date();
    for(let i=1; i<=daysInMonth; i++) {
        const cellDate = new Date(year, month, i);
        const cellDateStr = String(i).padStart(2,'0') + '/' + String(month+1).padStart(2,'0') + '/' + year;
        
        let classes = ['day-cell'];
        
        if (cellDate.toDateString() === today.toDateString()) classes.push('today');
        if (cellDate.toDateString() === selectedDate.toDateString()) classes.push('active');
        
        // Check duty and mission for indicators
        const hasDuty = appData.duty.some(r => r[0] === cellDateStr);
        const hasMission = appData.mission.some(r => r[0] === cellDateStr);
        
        if (hasDuty) classes.push('has-duty');
        if (hasMission) classes.push('has-mission');
        
        html += `<div class="${classes.join(' ')}" onclick="selectDate(${year}, ${month}, ${i})">${i}</div>`;
    }
    
    calendarDays.innerHTML = html;
}

window.selectDate = function(y, m, d) {
    selectedDate = new Date(y, m, d);
    updateDateFilterInput();
    updateDisplayDateLabel();
    renderDashboard();
    renderCalendar();
    clearSearch();
}

// Searching
function handleSearch(query) {
    if(!query || query.trim() === '') {
        searchResultsPanel.style.display = 'none';
        return;
    }
    
    query = query.toLowerCase();
    let results = [];
    
    // Search Duty
    appData.duty.forEach(r => {
        const inv = r[1] ? r[1].toLowerCase() : '';
        const asst = r[2] ? r[2].toLowerCase() : '';
        
        if (inv.includes(query) || asst.includes(query)) {
            let matches = [];
            if (inv.includes(query)) matches.push(`พงส.: ${r[1]}`);
            if (asst.includes(query)) matches.push(`ผู้ช่วยฯ: ${r[2]}`);
            
            results.push({
                date: r[0],
                type: 'duty',
                text: matches.join(' / ')
            });
        }
    });
    
    // Search Mission
    appData.mission.forEach(r => {
        const rowStr = r.join(' ').toLowerCase();
        if (rowStr.includes(query)) {
            results.push({
                date: r[0],
                type: 'mission',
                text: `ภารกิจ: ${r[3]} - ${r[4]}`
            });
        }
    });
    
    if (results.length > 0) {
        // Sort by date (assuming dd/mm/yyyy)
        results.sort((a,b) => parseSheetDate(a.date) - parseSheetDate(b.date));
        
        searchResultsList.innerHTML = results.map(res => `
            <div class="search-item" style="cursor:pointer" onclick="goToDateStr('${res.date}')">
                <span class="date-tag"><i class="fa-regular fa-calendar-check"></i> ${res.date}</span>
                ${res.text}
            </div>
        `).join('');
    } else {
        searchResultsList.innerHTML = '<div class="empty-state">ไม่พบข้อมูล</div>';
    }
    
    searchResultsPanel.style.display = 'block';
}

window.goToDateStr = function(dateStr) {
    const d = parseSheetDate(dateStr);
    if(d) {
        selectedDate = d;
        currentCalendarDate = new Date(d);
        updateDateFilterInput();
        updateDisplayDateLabel();
        renderDashboard();
        renderCalendar();
        
        // On mobile, might want to scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function clearSearch() {
    searchInput.value = '';
    searchResultsPanel.style.display = 'none';
}

// Run
init();
