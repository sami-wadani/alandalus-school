/* =========================================
   SCRIPT.JS - النسخة الاحترافية (إصلاح التقارير وتصغير الخريطة)
   ========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCAaCv1juy4rZc5IKLma9bIpTGlS6qWcS4",
  authDomain: "andalus-chool.firebaseapp.com",
  databaseURL: "https://andalus-chool-default-rtdb.firebaseio.com",
  projectId: "andalus-chool",
  storageBucket: "andalus-chool.firebasestorage.app",
  messagingSenderId: "403522351505",
  appId: "1:403522351505:web:b06fba2f19c098251aea30"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let studentsData = {}; let assessmentsData = {}; let behaviorData = {}; let rewardsData = {}; 
let settingsData = { groups: {1:"المجموعة 1", 2:"المجموعة 2", 3:"المجموعة 3", 4:"المجموعة 4", 5:"المجموعة 5"} };
let teachersData = {}; let dailyRecords = []; 

let isDataLoaded = false;
let selectedDailyDate = new Date().toISOString().split("T")[0];
let currentRole = null; let currentUser = null; 

// ==========================================
// 🔐 نظام الجلسات الذكي
// ==========================================
const SESSION_DURATION = 8 * 60 * 60 * 1000; 

window.checkSession = function() {
    const savedSession = localStorage.getItem('school_session');
    if(savedSession) {
        const sessionData = JSON.parse(savedSession);
        const now = Date.now();
        if(now - sessionData.timestamp < SESSION_DURATION) {
            currentRole = sessionData.role;
            currentUser = sessionData.user;
            if(currentRole === 'admin') {
                document.body.classList.remove('role-teacher'); 
                document.getElementById('roleDisplay').innerHTML = `<i class="fa-solid fa-user-shield"></i> إداري: ${currentUser.name}`;
            } else {
                document.body.classList.add('role-teacher'); 
                document.getElementById('roleDisplay').innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> أ. ${currentUser.name}`;
            }
            window.startApp(true);
            return true;
        } else {
            localStorage.removeItem('school_session');
        }
    }
    return false;
};

window.sortArabicAlphabetically = function(a, b) {
    const nameA = a.name ? a.name.trim() : (a[1] && a[1].name ? a[1].name.trim() : "");
    const nameB = b.name ? b.name.trim() : (b[1] && b[1].name ? b[1].name.trim() : "");
    return nameA.localeCompare(nameB, 'ar');
};

window.generateId = function(prefix) { return prefix + "_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8); };

const ALL_GRADES = ["الأول متوسط", "الثاني متوسط", "الثالث متوسط"];
const ALL_CLASSES = ["1", "2", "3", "4"];

document.addEventListener("DOMContentLoaded", () => {
  const d1 = document.getElementById('dailyDateInput'); if(d1) d1.value = selectedDailyDate;
  const d2 = document.getElementById('mapDateInput'); if(d2) d2.value = selectedDailyDate;
});
document.addEventListener('keypress', function (e) { if (e.key === 'Enter') window.handleLogin(); });

database.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    
    const cleanObj = (obj) => {
        let res = {};
        if (obj) { Object.keys(obj).forEach(k => { if (obj[k] !== null && obj[k] !== undefined) res[k] = obj[k]; }); }
        return res;
    };

    studentsData = cleanObj(data.students);
    assessmentsData = cleanObj(data.assessments);
    behaviorData = cleanObj(data.behavior);
    rewardsData = cleanObj(data.rewards);
    teachersData = cleanObj(data.teachers);
    settingsData = data.settings || { groups: {1:"المجموعة 1", 2:"المجموعة 2", 3:"المجموعة 3", 4:"المجموعة 4", 5:"المجموعة 5"} };

    const rawDaily = data.daily || {};
    dailyRecords = Object.keys(rawDaily).map(k => rawDaily[k]).filter(r => r !== null && r !== undefined);

    Object.values(studentsData).forEach(s => {
      if (!s.levels) s.levels = { "رياضيات": 3, "علوم": 3, "لغتي": 3, "إنجليزي": 3 };
      if (s.stars === undefined) s.stars = 0; 
    });

    isDataLoaded = true;
    const loginBtn = document.getElementById('loginBtn');
    if(loginBtn && loginBtn.disabled) {
        loginBtn.textContent = "دخول للمنصة"; loginBtn.disabled = false;
        loginBtn.classList.remove('bg-gray-400', 'opacity-50', 'cursor-not-allowed'); loginBtn.classList.add('primary-bg', 'hover:opacity-90');
        window.checkSession();
    }
    if(currentRole) window.refreshActiveSection();
});

window.refreshActiveSection = function() {
    const activeBtn = document.querySelector('.nav-btn.active');
    if(activeBtn) {
        const onclickStr = activeBtn.getAttribute('onclick') || "";
        if(onclickStr.includes('dashboard')) { window.renderDashboard(); window.renderStudents(); }
        if(onclickStr.includes('teachersAdmin')) window.renderTeachersGrid();
        if(onclickStr.includes('seating')) { window.renderSeatingClassButtons(); window.renderSeating(); }
        if(onclickStr.includes('academic')) window.renderAcademicDashboard();
        if(onclickStr.includes('teacherDaily') || onclickStr.includes('teacherMap')) window.renderTeacherViews();
        if(onclickStr.includes('teacherHonorRoll')) window.generateTeacherHonorRoll();
        if(onclickStr.includes('teacherAcademic')) window.renderTeacherAcademicDashboard();
        if(onclickStr.includes('teacherFullReport')) window.generateTeacherFullReport();
    }
    const sEl = document.getElementById("searchInput");
    if(sEl && sEl.value.trim().length > 0 && currentRole === 'admin') window.renderStudents();
};

window.printSection = function(sectionId) {
    document.querySelectorAll('.printableArea').forEach(el => el.style.display = 'none');
    const targetSection = document.getElementById(sectionId);
    if(targetSection) { targetSection.style.display = 'block'; window.print(); targetSection.style.display = 'none'; }
    const activeBtn = document.querySelector('.nav-btn.active');
    if(activeBtn) { const activeSectionId = activeBtn.getAttribute('onclick').match(/'([^']+)'/)[1] + 'Section'; document.getElementById(activeSectionId).style.display = 'block'; }
};

window.changeDailyDate = function(newDate) {
    if(!newDate) return; selectedDailyDate = newDate;
    const d1 = document.getElementById('dailyDateInput'); if(d1 && d1.value !== newDate) d1.value = newDate;
    const d2 = document.getElementById('mapDateInput'); if(d2 && d2.value !== newDate) d2.value = newDate;
    window.renderTeacherViews();
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('mobileSidebar'); const overlay = document.getElementById('sidebarOverlay');
    if(sidebar.classList.contains('open')) { sidebar.classList.remove('open'); overlay.classList.remove('show'); } 
    else { sidebar.classList.add('open'); overlay.classList.add('show'); }
};

window.syncMobileClassSelect = function(val) {
    const deskSel = document.getElementById('teacherClassSelect');
    if(deskSel) { deskSel.value = val; window.refreshActiveSection(); window.toggleSidebar(); }
};

window.populateSidebarMenu = function() {
    const menuContent = document.getElementById('sidebarMenuContent'); const roleDisplay = document.getElementById('sidebarRoleDisplay');
    if (currentRole === 'admin') {
        roleDisplay.innerHTML = '<i class="fa-solid fa-user-shield"></i> مدير النظام';
        menuContent.innerHTML = `<a href="#" onclick="window.showSection('dashboard'); window.toggleSidebar();" class="sidebar-link active"><i class="fa-solid fa-chart-line ml-2 w-5"></i> الإدارة</a><a href="#" onclick="window.showSection('teachersAdmin'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-users-gear ml-2 w-5"></i> المستخدمين</a><a href="#" onclick="window.showSection('seating'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-chair ml-2 w-5"></i> الفصول</a><a href="#" onclick="window.showSection('academic'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-chart-pie ml-2 w-5"></i> تقارير التقييم</a><a href="#" onclick="window.showSection('reports'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-file-lines ml-2 w-5"></i> التقارير</a>`;
    } else if (currentRole === 'teacher') {
        roleDisplay.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> أستاذ/ة ${currentUser.name}`;
        let mobileClassSelect = '';
        if (currentUser.classes && currentUser.classes.length > 0) {
            const deskSel = document.getElementById('teacherClassSelect'); const currentVal = deskSel ? deskSel.value : '0';
            const options = currentUser.classes.map((c, i) => `<option value="${i}" ${String(i)===String(currentVal)?'selected':''}>${c.grade} - ف${c.class}</option>`).join('');
            mobileClassSelect = `<div class="mx-4 my-4 p-3 bg-purple-50 rounded-xl border border-purple-100"><label class="text-xs font-black text-purple-800 mb-2 block"><i class="fa-solid fa-users-viewfinder"></i> تبديل الفصل الحالي:</label><select id="mobileTeacherClassSelect" onchange="window.syncMobileClassSelect(this.value)" class="w-full border-0 p-2 rounded-lg font-bold text-sm bg-white text-purple-900 outline-none shadow-sm cursor-pointer">${options}</select></div><hr class="border-gray-100 mb-2">`;
        }
        menuContent.innerHTML = mobileClassSelect + `<a href="#" onclick="window.showSection('teacherDaily'); window.toggleSidebar();" class="sidebar-link active"><i class="fa-solid fa-list-check ml-2 w-5"></i> الكشف اليومي</a><a href="#" onclick="window.showSection('teacherMap'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-map ml-2 w-5"></i> خريطة المجموعات</a><a href="#" onclick="window.showSection('teacherHonorRoll'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-medal ml-2 w-5"></i> لوحة الشرف</a><a href="#" onclick="window.showSection('teacherAcademic'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-graduation-cap ml-2 w-5"></i> التقييم الأكاديمي</a><a href="#" onclick="window.showSection('teacherFullReport'); window.toggleSidebar();" class="sidebar-link"><i class="fa-solid fa-file-signature ml-2 w-5"></i> التقرير الشامل</a>`;
    }
};

window.handleLogin = function() {
  if(!isDataLoaded) return alert("يرجى الانتظار، جاري تحميل البيانات من السحابة...");
  const emailEl = document.getElementById('loginEmail'); const passEl = document.getElementById('loginPassword');
  if(!emailEl || !passEl) return;
  const email = emailEl.value.trim().toLowerCase(); const pass = passEl.value.trim();
  if(!email || !pass) return;
  
  if(email === 'admin@school.com' && pass === '123') { 
      currentRole = 'admin'; currentUser = { id: 'admin_sys', name: 'المدير' };
      document.body.classList.remove('role-teacher'); document.getElementById('roleDisplay').innerHTML = '<i class="fa-solid fa-user-shield"></i> آدمن (رئيسي)'; 
      localStorage.setItem('school_session', JSON.stringify({ role: currentRole, user: currentUser, timestamp: Date.now() }));
      window.startApp(false); return; 
  } 
  
  const userEntry = Object.entries(teachersData).find(([k, t]) => t.email === email && t.password === pass);
  if(userEntry) {
    const userId = userEntry[0]; const userData = userEntry[1];
    if(userData.role === 'admin') { 
        currentRole = 'admin'; currentUser = { id: userId, ...userData }; 
        document.body.classList.remove('role-teacher'); document.getElementById('roleDisplay').innerHTML = `<i class="fa-solid fa-user-shield"></i> إداري: ${currentUser.name}`; 
    } else { 
        currentRole = 'teacher'; currentUser = { id: userId, ...userData }; 
        document.body.classList.add('role-teacher'); document.getElementById('roleDisplay').innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> أ. ${currentUser.name}`; 
    }
    localStorage.setItem('school_session', JSON.stringify({ role: currentRole, user: currentUser, timestamp: Date.now() }));
    window.startApp(false);
  } else { alert("بيانات الدخول غير صحيحة!"); }
};

window.startApp = function(isAutoLogin = false) {
  document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('mainApp').classList.remove('hidden'); 
  if(currentRole === 'admin') { 
      document.getElementById('adminNav').classList.remove('hidden'); document.getElementById('adminNav').classList.add('lg:flex'); 
      window.populateSidebarMenu();
      if(!isAutoLogin) window.showSection('dashboard'); 
  } 
  else {
      document.getElementById('teacherNav').classList.remove('hidden'); document.getElementById('teacherNav').classList.add('lg:flex');
      const sel = document.getElementById('teacherClassSelect'); 
      if(sel && currentUser.classes) { 
          sel.innerHTML = currentUser.classes.map((c, i) => `<option value="${i}">${c.grade} - ف${c.class}</option>`).join(''); 
          sel.addEventListener('change', (e) => {
              const mobSel = document.getElementById('mobileTeacherClassSelect');
              if(mobSel) mobSel.value = e.target.value;
              window.refreshActiveSection();
          });
      }
      const d1 = document.getElementById('dailyDateInput'); if(d1) d1.value = selectedDailyDate; const d2 = document.getElementById('mapDateInput'); if(d2) d2.value = selectedDailyDate;
      window.populateSidebarMenu(); 
      if(!isAutoLogin) window.showSection('teacherDaily');
  }
};

window.handleLogout = function() { localStorage.removeItem('school_session'); location.reload(); };
window.closeModal = function(id) { const el = document.getElementById(id); if(el){ el.classList.add('hidden'); el.classList.remove('flex');} };
window.openModal = function(id) { const el = document.getElementById(id); if(el){ el.classList.remove('hidden'); el.classList.add('flex');} };
window.escapeHtml = function(str) { return String(str||"").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); };

window.showSection = function(name) {
  document.querySelectorAll('.view-section').forEach(s => { s.classList.add('hidden-section'); s.style.display = ''; });
  const target = document.getElementById(name + 'Section'); if(target) target.classList.remove('hidden-section');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById('nav' + name.charAt(0).toUpperCase() + name.slice(1)); if(btn) btn.classList.add('active');
  document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
  for (let link of document.querySelectorAll('.sidebar-link')) { if (link.getAttribute('onclick').includes(name)) { link.classList.add('active'); break; } }
  window.refreshActiveSection();
};

window.renderDashboard = function() {
  const arr = Object.values(studentsData);
  const sT = document.getElementById("statTotal"); if(sT) sT.textContent = arr.length;
  const sR = document.getElementById("statRemedial"); if(sR) sR.textContent = arr.filter(s => s.planType === 'remedial').length;
  const sS = document.getElementById("statSupport"); if(sS) sS.textContent = arr.filter(s => s.planType === 'support').length;
  const sH = document.getElementById("statHealth"); if(sH) sH.textContent = arr.filter(s => s.health && s.health.trim() !== "" && s.health.trim() !== "سليم").length;
  let b1=0, b2=0, b3=0, b4=0, b5=0; Object.values(behaviorData).forEach(b => { if(b.degree==1)b1++; else if(b.degree==2)b2++; else if(b.degree==3)b3++; else if(b.degree==4)b4++; else if(b.degree==5)b5++; });
  const bs1 = document.getElementById("behStat1"); if(bs1) bs1.textContent = b1; const bs2 = document.getElementById("behStat2"); if(bs2) bs2.textContent = b2; const bs3 = document.getElementById("behStat3"); if(bs3) bs3.textContent = b3; const bs4 = document.getElementById("behStat4"); if(bs4) bs4.textContent = b4; const bs5 = document.getElementById("behStat5"); if(bs5) bs5.textContent = b5;
};

window.renderStudents = function() {
  const sEl = document.getElementById("searchInput"); const search = sEl ? sEl.value.trim().toLowerCase() : "";
  const gEl = document.getElementById("filterGrade"); const grade = gEl ? gEl.value : "";
  const cEl = document.getElementById("filterClass"); const cls = cEl ? cEl.value : "";
  const tbody = document.getElementById("studentsTableBody"); const cardsGrid = document.getElementById("studentsCardsGrid");
  const searchResultsSection = document.getElementById("searchResultsSection"); const defaultTableSection = document.getElementById("defaultTableSection");
  if(!tbody || !cardsGrid) return;

  const arr = Object.entries(studentsData).filter(x => {
    if (search && !x[1].name.toLowerCase().includes(search)) return false;
    if (grade && x[1].grade !== grade) return false;
    if (cls && String(x[1].class) !== cls) return false; return true;
  }).sort(window.sortArabicAlphabetically);

  const countLabel = document.getElementById("studentCountLabel"); const searchCount = document.getElementById("searchResultCount");
  if(countLabel) countLabel.textContent = `${arr.length} طالب`; if(searchCount) searchCount.textContent = `${arr.length} نتيجة`;

  if (search.length > 0) {
    if(searchResultsSection) searchResultsSection.classList.remove("hidden"); if(defaultTableSection) defaultTableSection.classList.add("hidden");
    if (arr.length === 0) { cardsGrid.innerHTML = `<div class="col-span-full text-center py-12"><i class="fa-solid fa-user-slash text-4xl text-gray-300 mb-2"></i><p class="font-bold text-gray-400">لا توجد نتائج</p></div>`; return; }
    cardsGrid.innerHTML = arr.map(x => {
      const k = x[0]; const s = x[1]; const hasHealth = s.health && s.health.trim() !== "" && s.health.trim() !== "سليم";
      const stBehCount = Object.values(behaviorData).filter(b => b.studentKey === k).length; const behBadge = stBehCount > 0 ? `<span class="bg-red-500 text-white text-[10px] px-1 rounded ml-1">⚠️ ${stBehCount}</span>` : '';
      let starBadge = s.stars >= 20 ? '🥇' : s.stars >= 10 ? '🥈' : s.stars >= 5 ? '🥉' : '⭐'; let starsHtml = s.stars > 0 ? `<div class="mt-1"><button type="button" onclick="window.openRewardRecord('${k}')" class="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-1 rounded border border-yellow-200">${starBadge} ${s.stars} نجوم</button></div>` : '';
      const math = s.levels['رياضيات']||3; const sci = s.levels['علوم']||3; const ar = s.levels['لغتي']||3; const en = s.levels['إنجليزي']||3;
      let contactInfoHtml = `<div class="mt-3 bg-gray-50 p-2 rounded-lg text-[10px] text-gray-600 font-bold space-y-1 text-right border border-gray-100"><div class="flex justify-between"><span><i class="fa-solid fa-id-card text-purple-400"></i> الهوية:</span> <span class="font-mono">${s.studentId || '--'}</span></div><div class="flex justify-between"><span><i class="fa-solid fa-phone text-green-400"></i> جوال الأب:</span> <span class="font-mono">${s.dadPhone || '--'}</span></div></div>`;
      return `<div class="card p-5 flex flex-col justify-between bg-white relative">${hasHealth ? `<div class="mb-3 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1"><i class="fa-solid fa-heart-pulse"></i> ${window.escapeHtml(s.health)}</div>` : ''}<div class="text-center"><h3 class="font-black text-lg text-gray-800">${behBadge} ${window.escapeHtml(s.name)}</h3>${starsHtml}<p class="text-[11px] font-bold text-gray-400 mt-2">${window.escapeHtml(s.grade)} - فصل ${window.escapeHtml(s.class)}</p></div>${contactInfoHtml}<div class="mt-4 grid grid-cols-2 gap-2 text-xs font-bold"><div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg"><span class="text-gray-500 text-[10px]">رياضيات</span><span class="level-badge level-${math}">${math}</span></div><div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg"><span class="text-gray-500 text-[10px]">علوم</span><span class="level-badge level-${sci}">${sci}</span></div><div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg"><span class="text-gray-500 text-[10px]">لغتي</span><span class="level-badge level-${ar}">${ar}</span></div><div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg"><span class="text-gray-500 text-[10px]">إنجليزي</span><span class="level-badge level-${en}">${en}</span></div></div><div class="flex gap-2 mt-4 pt-4 border-t border-gray-100"><button type="button" onclick="window.openAddRewardModal('${k}')" class="bg-yellow-50 text-yellow-600 hover:bg-yellow-100 py-2 rounded-lg flex-1 text-xs font-black transition" title="نجمة"><i class="fa-solid fa-star"></i></button><button type="button" onclick="window.openInfoModal('${k}')" class="bg-purple-50 text-purple-700 hover:bg-purple-100 py-2 rounded-lg flex-1 text-xs font-black transition" title="معلومات وتواصل"><i class="fa-solid fa-id-card"></i></button><button type="button" onclick="window.openBehaviorRecord('${k}')" class="bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-lg flex-1 text-xs font-black transition" title="سلوك"><i class="fa-solid fa-scale-balanced"></i></button><button type="button" onclick="window.openLevelModal('${k}')" class="bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 rounded-lg flex-1 text-xs font-black transition" title="مستويات"><i class="fa-solid fa-layer-group"></i></button><button type="button" onclick="window.editStudent('${k}')" class="bg-gray-100 text-gray-600 hover:bg-gray-200 py-2 rounded-lg flex-1 text-xs font-bold transition" title="تعديل"><i class="fa-solid fa-pen"></i></button></div></div>`;
    }).join("");
  } else {
    if(searchResultsSection) searchResultsSection.classList.add("hidden"); if(defaultTableSection) defaultTableSection.classList.remove("hidden");
    if (arr.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">لا يوجد بيانات</td></tr>`; return; }
    tbody.innerHTML = arr.map(x => {
      const k = x[0]; const s = x[1]; const hasHealth = s.health && s.health.trim() !== "" && s.health.trim() !== "سليم";
      const stBehCount = Object.values(behaviorData).filter(b => b.studentKey === k).length; const behBadge = stBehCount > 0 ? `<span class="bg-red-500 text-white text-[10px] px-1 rounded ml-1">⚠️ ${stBehCount}</span>` : '';
      let starBadge = s.stars >= 20 ? '🥇' : s.stars >= 10 ? '🥈' : s.stars >= 5 ? '🥉' : '⭐'; let starsHtml = s.stars > 0 ? `<button type="button" onclick="window.openRewardRecord('${k}')" class="text-[10px] bg-yellow-50 text-yellow-700 px-1 rounded">${starBadge} ${s.stars}</button>` : '';
      return `<tr class="border-t hover:bg-gray-50"><td class="p-3 text-center no-print"><input type="checkbox" class="studentCheck" data-key="${k}"></td><td class="p-3 font-bold">${behBadge} ${window.escapeHtml(s.name)} ${starsHtml} ${hasHealth ? `<span class="text-red-500 text-[10px]" title="${window.escapeHtml(s.health)}"><i class="fa-solid fa-heart-pulse"></i></span>` : ''}</td><td class="p-3 text-xs text-right">${window.escapeHtml(s.grade)} - ف${window.escapeHtml(s.class)}</td><td class="p-3 text-center"><div class="flex gap-1 justify-center"><span class="mini-subj level-${s.levels['رياضيات']||3}">${s.levels['رياضيات']||3}</span><span class="mini-subj level-${s.levels['علوم']||3}">${s.levels['علوم']||3}</span><span class="mini-subj level-${s.levels['لغتي']||3}">${s.levels['لغتي']||3}</span><span class="mini-subj level-${s.levels['إنجليزي']||3}">${s.levels['إنجليزي']||3}</span></div></td><td class="p-3 text-center"><button type="button" onclick="window.openInfoModal('${k}')" class="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-bold">معلومات</button></td><td class="p-3 text-center flex justify-center gap-1 no-print"><button type="button" onclick="window.openBehaviorRecord('${k}')" class="bg-red-50 text-red-600 px-2 py-1 rounded text-xs"><i class="fa-solid fa-scale-balanced"></i></button><button type="button" onclick="window.openAddRewardModal('${k}')" class="bg-yellow-50 text-yellow-600 px-2 py-1 rounded text-xs"><i class="fa-solid fa-star"></i></button><button type="button" onclick="window.openLevelModal('${k}')" class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">مستويات</button><button type="button" onclick="window.editStudent('${k}')" class="bg-gray-100 px-2 py-1 rounded text-xs"><i class="fa-solid fa-pen"></i></button></td></tr>`;
    }).join("");
  }
};

window.resetAllStars = async function() { 
  if(confirm("هل أنت متأكد من تصفير النجوم بالكامل؟")) { 
    const updates = {}; updates['rewards'] = null; Object.keys(studentsData).forEach(k => { updates[`students/${k}/stars`] = 0; }); await database.ref('/').update(updates);
  } 
};

window.toggleAll = function(c) { document.querySelectorAll(".studentCheck").forEach(cb => cb.checked = c); };

window.deleteSelectedStudents = async function() { 
  const keys = [...document.querySelectorAll(".studentCheck:checked")].map(cb => cb.dataset.key); 
  if (!keys.length) return; 
  if(confirm("هل أنت متأكد من حذف الطلاب المحددين؟")) { const updates = {}; keys.forEach(k => { updates[`students/${k}`] = null; }); await database.ref('/').update(updates); } 
};

window.openStudentModal = function(k = null) { 
  document.getElementById("studentForm").reset(); document.getElementById("studentKey").value = k || ""; 
  if (k && studentsData[k]) { 
    const s = studentsData[k]; document.getElementById("studentName").value=s.name; document.getElementById("studentGrade").value=s.grade; document.getElementById("studentClass").value=s.class; document.getElementById("studentHealth").value=s.health||""; document.getElementById("studentId").value=s.studentId||""; document.getElementById("guardianId").value=s.guardianId||""; document.getElementById("dadPhone").value=s.dadPhone||""; document.getElementById("momPhone").value=s.momPhone||""; 
  } window.openModal("studentModal"); 
};
window.editStudent = function(k) { window.openStudentModal(k); };

window.saveStudent = async function(e) { 
  e.preventDefault(); 
  const k = document.getElementById("studentKey").value || window.generateId("std"); 
  const old = studentsData[k] || {}; 
  const newGrade = document.getElementById("studentGrade").value; const newClass = document.getElementById("studentClass").value;
  let gNum = old.groupNum; let sNum = old.seatNum;
  if(old.grade && (old.grade !== newGrade || String(old.class) !== String(newClass))) { gNum = null; sNum = null; }
  const payload = { name: document.getElementById("studentName").value, grade: newGrade, class: newClass, levels: old.levels || {"رياضيات":3,"علوم":3,"لغتي":3,"إنجليزي":3}, stars: old.stars || 0, health: document.getElementById("studentHealth").value || "", studentId: document.getElementById("studentId").value || "", guardianId: document.getElementById("guardianId").value || "", dadPhone: document.getElementById("dadPhone").value || "", momPhone: document.getElementById("momPhone").value || "", groupNum: gNum === undefined ? null : gNum, seatNum: sNum === undefined ? null : sNum, planType: old.planType||"none" }; 
  await database.ref(`students/${k}`).set(payload); window.closeModal("studentModal"); 
};

window.openInfoModal = function(k) { 
  const s = studentsData[k]; if(!s) return; 
  document.getElementById("infoModalStudentName").textContent = s.name; document.getElementById("infoStudentId").textContent = s.studentId || "--"; document.getElementById("infoGuardianId").textContent = s.guardianId || "--"; document.getElementById("infoDadPhone").textContent = s.dadPhone || "--"; document.getElementById("infoMomPhone").textContent = s.momPhone || "--"; window.openModal("infoModal"); 
};

window.openLevelModal = function(k) { const s = studentsData[k]; if(!s) return; document.getElementById("levelStudentKey").value = k; document.getElementById("edit_lvl_math").value = s.levels['رياضيات']||3; document.getElementById("edit_lvl_science").value = s.levels['علوم']||3; document.getElementById("edit_lvl_arabic").value = s.levels['لغتي']||3; document.getElementById("edit_lvl_english").value = s.levels['إنجليزي']||3; document.getElementById("edit_plan_type").value=s.planType||"none"; window.openModal("levelModal"); };

window.saveLevels = async function(e) { 
  e.preventDefault(); const k = document.getElementById("levelStudentKey").value; 
  if(studentsData[k]) { 
      const updates = {}; updates[`students/${k}/levels/رياضيات`] = parseInt(document.getElementById("edit_lvl_math").value); updates[`students/${k}/levels/علوم`] = parseInt(document.getElementById("edit_lvl_science").value); updates[`students/${k}/levels/لغتي`] = parseInt(document.getElementById("edit_lvl_arabic").value); updates[`students/${k}/levels/إنجليزي`] = parseInt(document.getElementById("edit_lvl_english").value); updates[`students/${k}/planType`] = document.getElementById("edit_plan_type").value;
      await database.ref('/').update(updates); window.closeModal("levelModal"); 
  } 
};

window.filterBehaviorStudents = function() { 
  const g = document.getElementById("behaviorGradeFilter").value; const c = document.getElementById("behaviorClassFilter").value; const sel = document.getElementById("behaviorStudent"); sel.innerHTML = ""; 
  const arr = Object.entries(studentsData).filter(x => (!g || x[1].grade===g) && (!c || String(x[1].class)===String(c))).sort(window.sortArabicAlphabetically);
  arr.forEach(x => { sel.innerHTML += `<option value="${x[0]}">${window.escapeHtml(x[1].name)}</option>`; }); 
};
window.openAddBehaviorModal = function() { window.filterBehaviorStudents(); window.openModal("addBehaviorModal"); };

window.saveBehavior = async function(e) { 
  e.preventDefault(); 
  const k = document.getElementById("behaviorStudent").value; const id = window.generateId("beh");
  const payload = { studentKey: k, degree: document.getElementById("behaviorDegree").value, description: document.getElementById("behaviorDesc").value, action: document.getElementById("behaviorAction").value || "لا يوجد", date: document.getElementById("behaviorDate").value }; 
  await database.ref(`behavior/${id}`).set(payload); window.closeModal("addBehaviorModal"); 
};

window.openBehaviorRecord = function(k) { const stBehs = Object.values(behaviorData).filter(b => b.studentKey === k); document.getElementById("behaviorRecordContent").innerHTML = stBehs.map(b => `<div class="p-2 border-b"><span class="text-red-500 font-bold">د ${b.degree}:</span> ${b.description} <span class="text-xs text-gray-400">(${b.date})</span></div>`).join(""); window.openModal("studentBehaviorRecordModal"); };

window.openAddRewardModal = function(k) { 
  document.getElementById("rewardStudentKey").value = k; document.getElementById("rewardStudentNameDisplay").textContent = studentsData[k].name; 
  if (currentRole === 'teacher') { const subjSelect = document.getElementById("rewardSubject"); if(subjSelect) subjSelect.value = currentUser.subject || "عام"; }
  window.openModal("addRewardModal"); 
};

window.saveReward = async function(e) { 
  e.preventDefault(); const k = document.getElementById("rewardStudentKey").value; const id = window.generateId("rew"); const currentStars = studentsData[k].stars || 0;
  const updates = {}; updates[`rewards/${id}`] = { studentKey: k, subject: document.getElementById("rewardSubject").value || "عام", reason: document.getElementById("rewardReason").value, date: selectedDailyDate }; updates[`students/${k}/stars`] = currentStars + 1;
  await database.ref('/').update(updates); window.closeModal("addRewardModal"); 
};

window.openRewardRecord = function(k) { const stRews = Object.values(rewardsData).filter(r => r.studentKey === k); document.getElementById("rewardRecordContent").innerHTML = stRews.map(r => `<div class="p-2 border-b"><span class="text-yellow-600 font-bold">⭐</span> ${r.reason} (${r.subject}) <span class="text-xs text-gray-400">(${r.date})</span></div>`).join(""); window.openModal("studentRewardRecordModal"); };

window.openImportModal = function() { document.getElementById("importData").value=""; window.openModal("importModal"); };

window.executeImport = async function() { 
  const g = document.getElementById("importGrade").value; const c = document.getElementById("importClass").value; const data = document.getElementById("importData").value.trim(); if(!data) return; 
  const updates = {};
  data.split('\n').forEach(row => { const cols = row.split('\t').map(x=>x.trim()); if(cols[0]) { const newKey = window.generateId("imp"); updates[`students/${newKey}`] = { name: cols[0], dadPhone: cols[1]||"", momPhone: cols[2]||"", studentId: cols[3]||"", guardianId: cols[4]||"", health: cols[5]||"سليم", grade: g, class: c, levels: {"رياضيات":3,"علوم":3,"لغتي":3,"إنجليزي":3}, stars: 0 }; } }); 
  await database.ref('/').update(updates); window.closeModal("importModal"); 
};

window.toggleTeacherFields = function() { const role = document.getElementById('userRole').value; const fields = document.getElementById('teacherSpecificFields'); if(role === 'admin') { fields.style.display = 'none'; } else { fields.style.display = 'block'; } };

window.renderTeachersGrid = function() {
  const grid = document.getElementById("teachersGrid"); const arr = Object.entries(teachersData).sort((a,b) => window.sortArabicAlphabetically(a[1], b[1]));
  if(arr.length === 0) { grid.innerHTML = `<p class="col-span-full text-center text-gray-400 font-bold py-10">لا يوجد مستخدمين. أضف مستخدماً جديداً من الزر بالأعلى.</p>`; return; }
  grid.innerHTML = arr.map(([k, t]) => {
      const isAdm = t.role === 'admin'; const roleBadge = isAdm ? `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black"><i class="fa-solid fa-shield"></i> إداري</span>` : `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-black"><i class="fa-solid fa-chalkboard-user"></i> معلم</span>`;
      const classesHtml = isAdm ? '' : `<div class="flex flex-wrap gap-1 mb-3">${(t.classes || []).map(c=>`<span class="bg-gray-100 px-2 py-1 rounded text-xs font-bold">${c.grade}-ف${c.class}</span>`).join('')}</div>`;
      const subjHtml = isAdm ? '' : ` | ${window.escapeHtml(t.subject)}`;
      return `<div class="card p-5 ${isAdm ? 'border-t-4 border-t-red-500 bg-red-50/10' : 'border-t-4 border-t-blue-500'} relative"><div class="absolute top-4 left-4">${roleBadge}</div><h4 class="font-black text-lg mt-2">${window.escapeHtml(t.name)}</h4><p class="text-sm text-gray-600 font-bold mb-2" dir="ltr">${window.escapeHtml(t.email)}${subjHtml}</p>${classesHtml}<div class="flex gap-2 mt-4"><button type="button" onclick="window.editTeacher('${k}')" class="text-blue-600 bg-blue-50 px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 flex-1 transition no-print">تعديل</button><button type="button" onclick="window.deleteTeacher('${k}')" class="text-red-500 bg-red-50 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-100 flex-1 transition no-print">حذف</button></div></div>`;
  }).join('');
};

window.openTeacherModal = function(id) { 
  const teacherId = typeof id === 'string' ? id : ""; document.getElementById("formTeacher").reset(); document.getElementById("tchId").value = teacherId; let t = teacherId ? teachersData[teacherId] : null;
  const cont = document.getElementById("tchClassesContainer"); cont.innerHTML=""; 
  ALL_GRADES.forEach(g => { ALL_CLASSES.forEach(c => { let isChecked = t && t.classes && t.classes.some(tc => tc.grade === g && String(tc.class) === String(c)) ? 'checked' : ''; cont.innerHTML += `<label class="flex items-center gap-2 p-2 bg-white rounded border hover:bg-blue-50 cursor-pointer text-sm font-bold"><input type="checkbox" value="${g}|${c}" class="tch-cls-cb" ${isChecked}> ${g} - ف${c}</label>`; }); }); 
  if(t) { document.getElementById("tchName").value = t.name || ""; document.getElementById("tchEmail").value = t.email || ""; document.getElementById("tchPass").value = t.password || ""; document.getElementById("tchSubject").value = t.subject || "رياضيات"; document.getElementById("userRole").value = t.role || "teacher"; } else { document.getElementById("userRole").value = "teacher"; }
  window.toggleTeacherFields(); window.openModal("modalTeacher"); 
};

window.editTeacher = function(id) { window.openTeacherModal(id); };

window.saveTeacher = async function(e) { 
  e.preventDefault(); const id = document.getElementById("tchId").value || window.generateId("tch"); const role = document.getElementById("userRole").value; const classes = []; 
  if (role === 'teacher') { document.querySelectorAll(".tch-cls-cb:checked").forEach(cb => { const [g, c] = cb.value.split('|'); classes.push({grade: g, class: c}); }); if(classes.length === 0) return alert("الرجاء اختيار فصل واحد على الأقل للمعلم!"); }
  const payload = { name: document.getElementById("tchName").value.trim(), email: document.getElementById("tchEmail").value.trim().toLowerCase(), password: document.getElementById("tchPass").value.trim(), role: role, subject: role === 'teacher' ? document.getElementById("tchSubject").value : "", classes: role === 'teacher' ? classes : [] }; 
  await database.ref(`teachers/${id}`).set(payload); window.closeModal("modalTeacher"); 
};

window.deleteTeacher = async function(id) { if(confirm("هل أنت متأكد من حذف المستخدم؟")) { await database.ref(`teachers/${id}`).set(null); } };

let currentSeatingClassAdmin = "1";
window.renderSeatingClassButtons = function() { const cont = document.getElementById("classButtonsContainer"); if(cont) cont.innerHTML = ALL_CLASSES.map(c => `<button type="button" onclick="window.setSeatingClass('${c}')" class="px-4 py-2 border rounded font-bold ${currentSeatingClassAdmin===c ? 'bg-purple-900 text-white' : 'bg-white'}">فصل ${c}</button>`).join(""); };
window.setSeatingClass = function(c) { currentSeatingClassAdmin = c; window.renderSeatingClassButtons(); window.renderSeating(); };

// ==========================================
// التعديل: ضغط مسافات الخريطة العلوية والسفلية
// ==========================================
window.renderSeating = function() {
  const g = document.getElementById("seatingGrade").value, c = currentSeatingClassAdmin; 
  const arr = Object.entries(studentsData).filter(x => x[1].grade === g && String(x[1].class) === String(c)).sort(window.sortArabicAlphabetically);
  const grid = document.getElementById("seatingGrid"); if(!grid) return; grid.innerHTML = "";
  
  // قللنا المسافات من 90px إلى 20px من الحواف
  const groupPositions = [ 
      "top: 20px; left: 20px; transform: rotate(45deg);", 
      "top: 20px; right: 20px; transform: rotate(-45deg);", 
      "bottom: 20px; left: 20px; transform: rotate(45deg);", 
      "bottom: 20px; right: 20px; transform: rotate(-45deg);", 
      "top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(0deg);" 
  ];

  for (let i = 1; i <= 5; i++) {
    const gStudents = arr.filter(x => x[1].groupNum === i); let rows = ["", "", ""];
    for (let seat = 1; seat <= 5; seat++) {
      const std = gStudents.find(x => x[1].seatNum === seat); 
      let h = `<div class="seat-pill seat-empty" onclick="window.openAssignModal(${i},${seat})">+</div>`;
      if(std) { const lvl = std[1].levels['رياضيات']||3; const nameParts = std[1].name.trim().split(" "); const firstName = nameParts[0]; const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''; h = `<div class="seat-pill border-seat-${lvl}" onclick="window.openSwapModal('${std[0]}')"><span class="font-black text-gray-800 text-[11px] leading-tight">${firstName}</span>${lastName ? `<span class="text-[8px] text-gray-400 font-bold -mt-0.5 truncate w-full px-1">${lastName}</span>` : ''}</div>`; }
      if(seat<=2) rows[0]+=h; else if(seat<=4) rows[1]+=h; else rows[2]+=h;
    }
    grid.innerHTML += `<div class="absolute bg-white border-[2px] rounded-[28px] p-4 flex flex-col items-center" style="width: 250px; ${groupPositions[i-1]}"><div class="flex gap-2 mb-2">${rows[0]}</div><div class="flex gap-2 mb-2">${rows[1]}</div><div class="flex gap-2">${rows[2]}</div></div>`;
  }
};

window.smartDistributeStudents = async function() { 
    const g=document.getElementById("seatingGrade").value, c=currentSeatingClassAdmin; const arr=Object.entries(studentsData).filter(x=>x[1].grade===g&&String(x[1].class)===String(c)); if(!arr.length)return; arr.sort((a,b)=>a[1].levels['رياضيات']-b[1].levels['رياضيات']); let gIdx=1,dir=1; const groups={1:[],2:[],3:[],4:[],5:[]}; arr.forEach(x=>{groups[gIdx].push(x[0]); gIdx+=dir; if(gIdx>5){gIdx=5;dir=-1;gIdx+=dir;}else if(gIdx<1){gIdx=1;dir=1;gIdx+=dir;}}); const updates = {}; Object.entries(groups).forEach(([gn,keys])=>{keys.forEach((k,i)=>{updates[`students/${k}/groupNum`]=Number(gn); updates[`students/${k}/seatNum`]=i+1;});}); await database.ref('/').update(updates); 
};

window.randomShuffle = async function() { 
    const g=document.getElementById("seatingGrade").value, c=currentSeatingClassAdmin; const arr=Object.entries(studentsData).filter(x=>x[1].grade===g&&String(x[1].class)===String(c)); if(!arr.length)return; for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} const updates = {}; arr.forEach((x,i)=>{updates[`students/${x[0]}/groupNum`]=Math.floor(i/5)+1; updates[`students/${x[0]}/seatNum`]=(i%5)+1;}); await database.ref('/').update(updates); 
};

window.openAssignModal = function(g, s) { currentAssignGroup=g; currentAssignSeat=s; const sel = document.getElementById("assignTargetStudent"); sel.innerHTML=""; const arr = Object.entries(studentsData).filter(x=>x[1].grade===document.getElementById("seatingGrade").value && String(x[1].class)===String(currentSeatingClassAdmin)).sort(window.sortArabicAlphabetically); arr.forEach(x=>sel.innerHTML+=`<option value="${x[0]}">${window.escapeHtml(x[1].name)}</option>`); window.openModal("assignModal"); };
window.executeAssign = async function() { const k = document.getElementById("assignTargetStudent").value; const updates = {}; Object.entries(studentsData).forEach(([stdK, s])=>{if(s.groupNum===currentAssignGroup && s.seatNum===currentAssignSeat){updates[`students/${stdK}/groupNum`]=null; updates[`students/${stdK}/seatNum`]=null;}}); updates[`students/${k}/groupNum`]=currentAssignGroup; updates[`students/${k}/seatNum`]=currentAssignSeat; await database.ref('/').update(updates); window.closeModal("assignModal"); };
window.openSwapModal = function(k) { currentSwapStudentKey=k; const sel = document.getElementById("swapTargetStudent"); sel.innerHTML=""; const arr = Object.entries(studentsData).filter(x=>x[1].grade===studentsData[k].grade && String(x[1].class)===String(studentsData[k].class) && x[0]!==k).sort(window.sortArabicAlphabetically); arr.forEach(x=>sel.innerHTML+=`<option value="${x[0]}">${window.escapeHtml(x[1].name)}</option>`); window.openModal("swapModal"); };
window.executeSwap = async function() { const k2 = document.getElementById("swapTargetStudent").value; const tG=studentsData[currentSwapStudentKey].groupNum, tS=studentsData[currentSwapStudentKey].seatNum; const updates = {}; updates[`students/${currentSwapStudentKey}/groupNum`]=studentsData[k2].groupNum||null; updates[`students/${currentSwapStudentKey}/seatNum`]=studentsData[k2].seatNum||null; updates[`students/${k2}/groupNum`]=tG||null; updates[`students/${k2}/seatNum`]=tS||null; await database.ref('/').update(updates); window.closeModal("swapModal"); };

window.filterAssessmentStudents = function() { 
  const g = document.getElementById("assessmentGradeFilter").value; const c = document.getElementById("assessmentClassFilter").value; const sel = document.getElementById("assessmentStudent"); sel.innerHTML = ""; const arr = Object.entries(studentsData).filter(x => (!g || x[1].grade===g) && (!c || String(x[1].class)===String(c))).sort(window.sortArabicAlphabetically); arr.forEach(x => { sel.innerHTML += `<option value="${x[0]}">${window.escapeHtml(x[1].name)}</option>`; }); 
};

window.openAssessmentModal = function() { 
  const sel = document.getElementById("assessmentStudent"); sel.innerHTML = ""; const subjSel = document.getElementById("assessmentSubject");
  if (currentRole === 'teacher') {
      const activeCls = currentUser.classes[document.getElementById('teacherClassSelect').value]; const arr = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class)).sort(window.sortArabicAlphabetically); arr.forEach(x => { sel.innerHTML += `<option value="${x[0]}">${window.escapeHtml(x[1].name)}</option>`; }); subjSel.value = currentUser.subject || "عام"; subjSel.disabled = true; document.getElementById("assessmentGradeFilter").style.display = 'none'; document.getElementById("assessmentClassFilter").style.display = 'none';
  } else { window.filterAssessmentStudents(); subjSel.disabled = false; document.getElementById("assessmentGradeFilter").style.display = 'block'; document.getElementById("assessmentClassFilter").style.display = 'block'; }
  window.openModal("assessmentModal"); 
};

window.saveAssessment = async function(e) { 
  e.preventDefault(); const k = document.getElementById("assessmentStudent").value; const sc = Number(document.getElementById("assessmentScore").value); const lvl = sc<50?1:sc<65?2:sc<80?3:sc<90?4:5; const subj = currentRole === 'teacher' ? (currentUser.subject || "عام") : document.getElementById("assessmentSubject").value; const id = window.generateId("ass");
  const updates = {}; updates[`assessments/${id}`] = { studentKey: k, subject: subj, skill: document.getElementById("assessmentSkill").value, score: sc, level: lvl }; updates[`students/${k}/levels/${subj}`] = lvl; await database.ref('/').update(updates); window.closeModal("assessmentModal"); 
};

window.deleteAssessment = async function(k) { if(confirm("حذف التقييم؟")){ await database.ref(`assessments/${k}`).set(null); } };

window.renderAcademicDashboard = function() {
  const gEl = document.getElementById("academicGrade"); if(!gEl) return; const g = gEl.value, c = document.getElementById("academicClass").value, subj = document.getElementById("academicSubjectFilter").value;
  const arr = Object.values(studentsData).filter(s => (!g || s.grade === g) && (!c || String(s.class) === String(c))); const tot = arr.length || 1; const cols = {1:"bg-red-500", 2:"bg-orange-400", 3:"bg-yellow-400", 4:"bg-green-400", 5:"bg-blue-400"};
  document.getElementById("academicLevelsChart").innerHTML = [5,4,3,2,1].map(l => { const count = arr.filter(s => (s.levels[subj]||3) == l).length; return `<div class="flex items-center gap-3"><span class="w-12 text-sm font-bold">مستوى ${l}</span><div class="flex-1 bg-gray-100 h-3 rounded-full overflow-hidden"><div class="${cols[l]} h-full" style="width:${Math.round((count/tot)*100)}%"></div></div><span class="w-8 font-black">${count}</span></div>`; }).join("");
  const stKeys = new Set(Object.entries(studentsData).filter(x=>(!g||x[1].grade===g)&&(!c||String(x[1].class)===String(c))).map(x=>x[0]));
  const filteredAssessments = Object.values(assessmentsData).filter(a => stKeys.has(a.studentKey) && a.subject === subj); const skillsAgg = {}; filteredAssessments.forEach(a => { if(!skillsAgg[a.skill]) skillsAgg[a.skill] = { total: 0, count: 0 }; skillsAgg[a.skill].total += a.score; skillsAgg[a.skill].count++; });
  const sortedSkills = Object.entries(skillsAgg).map(([sk, val]) => ({ skill: sk, avg: val.total / val.count })).sort((a,b) => a.avg - b.avg).slice(0, 5); const weakContainer = document.getElementById("weakSkillsList");
  if(sortedSkills.length === 0) { weakContainer.innerHTML = `<p class="text-gray-400 text-sm font-bold mt-4 text-center py-6">لا توجد تقييمات كافية في هذه المادة لعرض المهارات</p>`; } else { weakContainer.innerHTML = sortedSkills.map(sk => `<div class="flex justify-between items-center border-b border-gray-100 py-3 last:border-0"><span class="font-bold text-gray-700">${window.escapeHtml(sk.skill)}</span><span class="${sk.avg < 65 ? 'text-red-500' : 'text-gray-500'} font-black">${Math.round(sk.avg)}%</span></div>`).join(""); }
  const tbody = document.getElementById("assessmentsTableBody");
  const tableData = Object.entries(assessmentsData).filter(x => stKeys.has(x[1].studentKey) && x[1].subject === subj).sort((a,b) => window.sortArabicAlphabetically(studentsData[a[1].studentKey], studentsData[b[1].studentKey]));
  if(tableData.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400 font-bold">لا يوجد تقييمات مسجلة</td></tr>`; } else { tbody.innerHTML = tableData.map(x=> `<tr class="border-b"><td class="p-4 font-bold text-right">${window.escapeHtml(studentsData[x[1].studentKey].name)}</td><td class="p-4 text-center">${x[1].subject}</td><td class="p-4 text-right">${x[1].skill}</td><td class="p-4 font-black text-center">${x[1].score}%</td><td class="p-4 text-center"><span class="level-badge level-${x[1].level}">${x[1].level}</span></td><td class="p-4 text-center no-print"><button type="button" onclick="window.deleteAssessment('${x[0]}')" class="text-red-500 font-bold hover:bg-red-50 px-3 py-1 rounded">حذف</button></td></tr>`).join(""); }
};

window.renderTeacherAcademicDashboard = function() {
    const sel = document.getElementById('teacherClassSelect'); if(!sel || sel.options.length === 0) return; const activeCls = currentUser.classes[sel.value]; const subj = currentUser.subject || "عام";
    const arr = Object.values(studentsData).filter(x => x.grade === activeCls.grade && String(x.class) === String(activeCls.class)); const tot = arr.length || 1; const cols = {1:"bg-red-500", 2:"bg-orange-400", 3:"bg-yellow-400", 4:"bg-green-400", 5:"bg-blue-400"};
    document.getElementById("tchAcademicLevelsChart").innerHTML = [5,4,3,2,1].map(l => { const count = arr.filter(s => (s.levels[subj]||3) == l).length; return `<div class="flex items-center gap-3"><span class="w-12 text-sm font-bold">مستوى ${l}</span><div class="flex-1 bg-gray-100 h-3 rounded-full overflow-hidden"><div class="${cols[l]} h-full" style="width:${Math.round((count/tot)*100)}%"></div></div><span class="w-8 font-black">${count}</span></div>`; }).join("");
    const stKeys = new Set(Object.entries(studentsData).filter(x=>x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class)).map(x=>x[0]));
    const filteredAssessments = Object.values(assessmentsData).filter(a => stKeys.has(a.studentKey) && a.subject === subj); const skillsAgg = {}; filteredAssessments.forEach(a => { if(!skillsAgg[a.skill]) skillsAgg[a.skill] = { total: 0, count: 0 }; skillsAgg[a.skill].total += a.score; skillsAgg[a.skill].count++; });
    const sortedSkills = Object.entries(skillsAgg).map(([sk, val]) => ({ skill: sk, avg: val.total / val.count })).sort((a,b) => a.avg - b.avg).slice(0, 5); const weakContainer = document.getElementById("tchWeakSkillsList");
    if(sortedSkills.length === 0) { weakContainer.innerHTML = `<p class="text-gray-400 text-sm font-bold mt-4 text-center py-6">لا توجد تقييمات كافية في هذه المادة لعرض المهارات</p>`; } else { weakContainer.innerHTML = sortedSkills.map(sk => `<div class="flex justify-between items-center border-b border-gray-100 py-3 last:border-0"><span class="font-bold text-gray-700">${window.escapeHtml(sk.skill)}</span><span class="${sk.avg < 65 ? 'text-red-500' : 'text-gray-500'} font-black">${Math.round(sk.avg)}%</span></div>`).join(""); }
    const tbody = document.getElementById("tchAssessmentsTableBody");
    const tableData = Object.entries(assessmentsData).filter(x => stKeys.has(x[1].studentKey) && x[1].subject === subj).sort((a,b) => window.sortArabicAlphabetically(studentsData[a[1].studentKey], studentsData[b[1].studentKey]));
    if(tableData.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400 font-bold">لا يوجد تقييمات مسجلة</td></tr>`; } else { tbody.innerHTML = tableData.map(x=> `<tr class="border-b"><td class="p-4 font-bold text-right">${window.escapeHtml(studentsData[x[1].studentKey].name)}</td><td class="p-4 text-right">${x[1].skill}</td><td class="p-4 font-black text-center">${x[1].score}%</td><td class="p-4 text-center"><span class="level-badge level-${x[1].level}">${x[1].level}</span></td><td class="p-4 text-center no-print"><button type="button" onclick="window.deleteAssessment('${x[0]}')" class="text-red-500 font-bold hover:bg-red-50 px-3 py-1 rounded">حذف</button></td></tr>`).join(""); }
};

window.generateTeacherHonorRoll = function() {
    const sel = document.getElementById('teacherClassSelect'); if(!sel || sel.options.length === 0) return; const activeCls = currentUser.classes[sel.value]; const subj = currentUser.subject || "عام";
    const clsStudents = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class));
    const subjStars = {}; Object.values(rewardsData).forEach(r => { if (r.subject === subj) { subjStars[r.studentKey] = (subjStars[r.studentKey] || 0) + 1; } });
    const arr = clsStudents.map(([k, s]) => { return { name: s.name, grade: s.grade, class: s.class, stars: subjStars[k] || 0 }; }).filter(s => s.stars > 0).sort((a,b) => { if(b.stars !== a.stars) return b.stars - a.stars; return window.sortArabicAlphabetically(a, b); });
    let html = '';
    if(arr.length === 0) { html += `<div class="card p-10 text-center text-gray-400 font-bold w-full">لا يوجد نجوم مسجلة في مادتك لهذا الفصل بعد</div>`; } else { html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">` + arr.map(s => `<div class="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex justify-between items-center shadow-sm relative overflow-hidden card"><div class="z-10"><h4 class="font-black text-lg text-yellow-800">${s.name}</h4><p class="text-xs font-bold text-yellow-600">${s.grade} - ف${s.class}</p></div><div class="text-center z-10"><div class="text-3xl font-black text-yellow-700">${s.stars}</div><div class="text-[10px] font-bold mt-1 bg-white px-2 py-0.5 rounded-full text-yellow-800">نجمة</div></div><i class="fa-solid fa-medal absolute -left-4 -bottom-4 text-6xl text-yellow-200 opacity-50"></i></div>`).join('') + `</div>`; }
    document.getElementById("teacherHonorRollOutput").innerHTML = html;
};

window.getAdminReportFilters = function() { const gEl = document.getElementById("globalReportGrade"); const cEl = document.getElementById("globalReportClass"); return { g: gEl ? gEl.value : "", c: cEl ? cEl.value : "" }; };

window.generateClassReport = function() { 
  const f = window.getAdminReportFilters(); const classes = {}, grades = {}, grandTotal = {total: 0, levels: {1:0, 2:0, 3:0, 4:0, 5:0}};
  Object.values(studentsData).filter(s => (!f.g || s.grade === f.g) && (!f.c || String(s.class) === String(f.c))).forEach(s => { const clsKey = s.grade + " - الفصل " + s.class; const grdKey = s.grade; const avgLvl = Math.round((s.levels['رياضيات'] + s.levels['علوم'] + s.levels['لغتي'] + s.levels['إنجليزي']) / 4) || 3; if(!classes[clsKey]) classes[clsKey] = {total: 0, levels: {1:0, 2:0, 3:0, 4:0, 5:0}}; classes[clsKey].total++; classes[clsKey].levels[avgLvl]++; if(!grades[grdKey]) grades[grdKey] = {total: 0, levels: {1:0, 2:0, 3:0, 4:0, 5:0}}; grades[grdKey].total++; grades[grdKey].levels[avgLvl]++; grandTotal.total++; grandTotal.levels[avgLvl]++; });
  function renderLevelsGrid(dataObj, title) { return `<div class="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-4"><div class="flex justify-between items-center mb-4"><h4 class="font-black text-lg text-gray-800">${title}</h4><span class="bg-white px-3 py-1 rounded-full text-xs font-bold text-gray-500 shadow-sm">${dataObj.total} طلاب</span></div><div class="grid grid-cols-5 gap-2 text-center">${[1,2,3,4,5].map(l => `<div class="level-${l} rounded-xl py-2"><div class="text-[10px] opacity-70">مستوى ${l}</div><div class="font-black text-lg">${dataObj.levels[l]}</div></div>`).join("")}</div></div>`; }
  let html = `<h3 class='text-2xl font-black mb-6 primary-text'>تقرير مستويات الطلاب (المتوسط العام للمواد)</h3>`; if(grandTotal.total > 0) html += `<div class="mb-6">${renderLevelsGrid(grandTotal, "الإجمالي العام")}</div>`; if(Object.keys(grades).length > 0) { html += `<div class="mb-6"><h4 class="font-black text-xl text-blue-800 mb-3 border-b-2 border-blue-100 pb-2">إجماليات الصفوف</h4><div class="space-y-4">`; for(let g in grades) html += renderLevelsGrid(grades[g], `إجمالي ${g}`); html += `</div></div>`; } html += `<div><h4 class="font-black text-xl text-gray-800 mb-3 border-b-2 border-gray-100 pb-2">تفاصيل الفصول</h4><div class="space-y-4">`; if (Object.keys(classes).length === 0) html += `<div class="text-center py-10 text-gray-400 font-bold">لا توجد بيانات</div>`; else for(let c in classes) html += renderLevelsGrid(classes[c], c); html += `</div></div>`; document.getElementById("reportOutput").innerHTML = html;
};

window.generateInterventionReport = function() { 
  const f = window.getAdminReportFilters(); const arr = Object.values(studentsData).filter(s => (s.levels['رياضيات'] <= 2 || s.levels['علوم'] <= 2 || s.levels['لغتي'] <= 2 || s.levels['إنجليزي'] <= 2) && (!f.g || s.grade === f.g) && (!f.c || String(s.class) === String(f.c))).sort(window.sortArabicAlphabetically); 
  let html = `<h3 class='text-xl font-black text-orange-600 mb-4'>الطلاب الذين يحتاجون خطط وتدخل (مستوى 1 و 2)</h3>`;
  if(arr.length === 0) { html += `<div class="text-center py-10 text-gray-400 font-bold">لا يوجد طلاب متأخرين في هذا الفلتر</div>`; } else { html += `<div class="space-y-3">` + arr.map(s => { let weak = []; if(s.levels['رياضيات'] <= 2) weak.push('رياضيات'); if(s.levels['علوم'] <= 2) weak.push('علوم'); if(s.levels['لغتي'] <= 2) weak.push('لغتي'); if(s.levels['إنجليزي'] <= 2) weak.push('إنجليزي'); return `<div class="bg-orange-50 p-4 rounded-xl flex justify-between items-center border border-orange-100"><div><span class="font-black text-orange-800 text-lg">${s.name}</span><span class="text-xs font-bold text-orange-500 mr-2">${s.grade} - ف${s.class}</span></div><div class="flex gap-1">${weak.map(w => `<span class="bg-white text-orange-700 px-2 py-1 rounded text-xs font-black shadow-sm">${w}</span>`).join('')}</div></div>`; }).join('') + `</div>`; }
  document.getElementById("reportOutput").innerHTML = html; 
};

window.generateBehaviorReport = function() { 
  const f = window.getAdminReportFilters(); const arr = Object.values(behaviorData).filter(b => { const s = studentsData[b.studentKey]; return s && (!f.g || s.grade === f.g) && (!f.c || String(s.class) === String(f.c)); }).sort((a,b)=> new Date(b.date) - new Date(a.date));
  let html = `<h3 class='text-xl font-black text-red-600 mb-4'>سجل المتابعة السلوكية</h3>`; if(arr.length === 0) { html += `<div class="text-center py-10 text-gray-400 font-bold">لا توجد مخالفات سلوكية مسجلة</div>`; } else { html += `<div class="space-y-3">` + arr.map(b => `<div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div class="flex justify-between items-center mb-2"><h4 class="font-black text-gray-800">${studentsData[b.studentKey].name}</h4><span class="text-xs text-gray-400 font-bold">${b.date}</span></div><p class="text-sm font-bold text-gray-600 mb-2"><span class="text-red-500">[الدرجة ${b.degree}]</span> ${window.escapeHtml(b.description)}</p><p class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">الإجراء: ${window.escapeHtml(b.action || 'لا يوجد')}</p></div>`).join('') + `</div>`; }
  document.getElementById("reportOutput").innerHTML = html; 
};

window.generateHonorRollReport = function() { 
  const f = window.getAdminReportFilters(); const arr = Object.values(studentsData).filter(s => s.stars > 0 && (!f.g || s.grade === f.g) && (!f.c || String(s.class) === String(f.c))).sort((a,b) => { if(b.stars !== a.stars) return b.stars - a.stars; return window.sortArabicAlphabetically(a, b); }); 
  let html = `<h3 class='text-xl font-black text-yellow-600 mb-4'>لوحة الشرف والمتميزين (جميع المواد)</h3>`; if(arr.length === 0) { html += `<div class="text-center py-10 text-gray-400 font-bold">لا يوجد نجوم مسجلة بعد</div>`; } else { html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">` + arr.map(s => `<div class="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex justify-between items-center shadow-sm relative overflow-hidden"><div class="z-10"><h4 class="font-black text-lg text-yellow-800">${s.name}</h4><p class="text-xs font-bold text-yellow-600">${s.grade} - ف${s.class}</p></div><div class="text-center z-10"><div class="text-3xl font-black text-yellow-700">${s.stars}</div><div class="text-[10px] font-bold mt-1 bg-white px-2 py-0.5 rounded-full text-yellow-800">نجمة</div></div><i class="fa-solid fa-medal absolute -left-4 -bottom-4 text-6xl text-yellow-200 opacity-50"></i></div>`).join('') + `</div>`; }
  document.getElementById("reportOutput").innerHTML = html; 
};

// ==========================================
// التعديل: إزالة شرط الإخفاء وعرض جميع الطلاب بالتقرير الإداري
// ==========================================
window.generateDailyTrackingAdminReport = function(isUpdate = false) {
  const f = window.getAdminReportFilters(); let dateFrom = ""; let dateTo = ""; let subjFilter = "";
  if(isUpdate) { dateFrom = document.getElementById("repDailyFrom")?.value || ""; dateTo = document.getElementById("repDailyTo")?.value || ""; subjFilter = document.getElementById("repDailySubj")?.value || ""; }
  const stdStats = {};
  dailyRecords.forEach(r => {
    if(subjFilter && r.subject !== subjFilter) return; if(dateFrom && r.date < dateFrom) return; if(dateTo && r.date > dateTo) return;
    if(!stdStats[r.stdKey]) stdStats[r.stdKey] = { xp:0, abs:0, tardies:0, missedHw:0, doneHw:0, parts:0, behs:0 };
    stdStats[r.stdKey].xp += r.points;
    if(r.type === 'attendance') stdStats[r.stdKey].abs++; if(r.type === 'tardy') stdStats[r.stdKey].tardies++; if(r.type === 'homework' && r.points > 0) stdStats[r.stdKey].doneHw++; if(r.type === 'homework' && r.points < 0) stdStats[r.stdKey].missedHw++; if(r.type === 'participation') stdStats[r.stdKey].parts++; if(r.type === 'behavior') stdStats[r.stdKey].behs++;
  });
  let html = `<div class="flex justify-between items-center mb-4 border-b-2 border-blue-100 pb-2"><h3 class='text-2xl font-black text-blue-800'>المتابعة اليومية للمدرسة</h3><button onclick="window.printSection('reportsSection')" class="bg-gray-100 px-3 py-1 rounded text-sm font-bold shadow-sm no-print"><i class="fa-solid fa-print"></i> طباعة</button></div>`;
  html += `<div class="flex flex-wrap gap-3 mb-4 bg-blue-50 p-3 rounded-xl border border-blue-100 no-print"><div class="flex-1 min-w-[150px]"><label class="text-xs font-bold text-gray-500 mb-1 block">من تاريخ:</label><input type="date" id="repDailyFrom" value="${dateFrom}" onchange="window.generateDailyTrackingAdminReport(true)" class="w-full border p-2 rounded outline-none font-bold text-sm"></div><div class="flex-1 min-w-[150px]"><label class="text-xs font-bold text-gray-500 mb-1 block">إلى تاريخ:</label><input type="date" id="repDailyTo" value="${dateTo}" onchange="window.generateDailyTrackingAdminReport(true)" class="w-full border p-2 rounded outline-none font-bold text-sm"></div><div class="flex-1 min-w-[150px]"><label class="text-xs font-bold text-gray-500 mb-1 block">تحديد المادة:</label><select id="repDailySubj" onchange="window.generateDailyTrackingAdminReport(true)" class="w-full border p-2 rounded outline-none font-bold text-sm text-purple-700"><option value="">جميع المواد</option><option value="رياضيات" ${subjFilter==='رياضيات'?'selected':''}>رياضيات</option><option value="علوم" ${subjFilter==='علوم'?'selected':''}>علوم</option><option value="لغتي" ${subjFilter==='لغتي'?'selected':''}>لغتي</option><option value="إنجليزي" ${subjFilter==='إنجليزي'?'selected':''}>إنجليزي</option></select></div></div>`;
  html += `<div class="overflow-x-auto"><table class="w-full text-sm text-center border-collapse"><thead class="bg-gray-100 font-bold"><tr><th class="p-2 border">الطالب</th><th class="p-2 border text-green-600">المشاركات</th><th class="p-2 border text-blue-600">واجب تم</th><th class="p-2 border text-orange-600">واجب ناقص</th><th class="p-2 border text-red-600">غياب (-1)</th><th class="p-2 border text-yellow-600">تأخر (-1)</th><th class="p-2 border text-red-800">مخالفات</th><th class="p-2 border">الصافي (XP)</th></tr></thead><tbody>`;
  const filteredStudents = Object.entries(studentsData).filter(([k, s]) => (!f.g || s.grade === f.g) && (!f.c || String(s.class) === String(f.c))).sort(window.sortArabicAlphabetically);
  
  if(filteredStudents.length === 0) {
      html += `<tr><td colspan="8" class="p-4 text-center text-gray-500 font-bold">لا يوجد طلاب في هذا الفصل/الصف</td></tr>`;
  } else {
      filteredStudents.forEach(([k, s]) => {
        const stat = stdStats[k] || { xp:0, abs:0, tardies:0, missedHw:0, doneHw:0, parts:0, behs:0 };
        // إزالة شرط الإخفاء، سيظهر الجميع حتى لو أصفار
        html += `<tr class="hover:bg-gray-50"><td class="p-2 border font-bold text-right">${s.name} <span class="text-[10px] text-gray-400">(${s.grade}-ف${s.class})</span></td><td class="p-2 border font-black">${stat.parts}</td><td class="p-2 border font-black">${stat.doneHw}</td><td class="p-2 border font-black">${stat.missedHw}</td><td class="p-2 border font-black text-red-500">${stat.abs}</td><td class="p-2 border font-black text-yellow-600">${stat.tardies}</td><td class="p-2 border font-black text-red-800">${stat.behs}</td><td class="p-2 border font-black" dir="ltr">${stat.xp}</td></tr>`;
      });
  }
  html += `</tbody></table></div>`;
  document.getElementById("reportOutput").innerHTML = html;
};

window.getUpdatedLevel = function(stdKey, subj, updatesObj) {
    let simDaily = dailyRecords.filter(r => r.stdKey === stdKey && r.subject === subj);
    Object.keys(updatesObj).forEach(path => {
        if (path.startsWith('daily/')) {
            const recId = path.split('/')[1]; const prop = path.split('/')[2]; const val = updatesObj[path];
            if (val === null) { simDaily = simDaily.filter(r => r.id !== recId); } 
            else if (prop === 'points') { const rec = simDaily.find(r => r.id === recId); if(rec) rec.points = val; } 
            else if (!prop && typeof val === 'object') { simDaily = simDaily.filter(r => r.id !== recId); if (val.stdKey === stdKey && val.subject === subj) simDaily.push(val); }
        }
    });
    let xp = 0; simDaily.forEach(r => xp += r.points);
    if(xp >= 20) return 5; if(xp >= 10) return 4; if(xp <= -10) return 1; if(xp <= -5) return 2; return 3;
};

window.recordDailyXP = async function(stdKey, type, points, note) {
  const subj = currentUser.subject || "عام";
  const tId = currentUser.id || "unknown";
  const isAbsent = dailyRecords.some(r => r.stdKey === stdKey && r.date === selectedDailyDate && r.type === 'attendance' && r.subject === subj);
  if(isAbsent) return alert("لا يمكن الرصد لطالب غائب!");
  const updates = {}; const newId = window.generateId("rec");
  
  if (type === 'participation') {
      const beh = dailyRecords.find(r => r.stdKey === stdKey && r.date === selectedDailyDate && r.type === 'behavior' && r.subject === subj);
      if (beh) updates[`daily/${beh.id}`] = null; else updates[`daily/${newId}`] = { id: newId, stdKey, teacherId: tId, subject: subj, date: selectedDailyDate, type, points, note };
  } else if (type === 'behavior') {
      const part = dailyRecords.find(r => r.stdKey === stdKey && r.date === selectedDailyDate && r.type === 'participation' && r.subject === subj);
      if (part) updates[`daily/${part.id}`] = null; else updates[`daily/${newId}`] = { id: newId, stdKey, teacherId: tId, subject: subj, date: selectedDailyDate, type, points, note };
  } else { updates[`daily/${newId}`] = { id: newId, stdKey, teacherId: tId, subject: subj, date: selectedDailyDate, type, points, note }; }
  
  updates[`students/${stdKey}/levels/${subj}`] = window.getUpdatedLevel(stdKey, subj, updates);
  await database.ref('/').update(updates); 
};

window.toggleHomework = async function(stdKey) {
  const subj = currentUser.subject || "عام";
  const tId = currentUser.id || "unknown";
  const isAbsent = dailyRecords.some(r => r.stdKey === stdKey && r.date === selectedDailyDate && r.type === 'attendance' && r.subject === subj);
  if(isAbsent) return;
  const rec = dailyRecords.find(r => r.stdKey === stdKey && r.date === selectedDailyDate && r.type === 'homework' && r.subject === subj);
  const updates = {};
  if (!rec) {
    const newId = window.generateId("rec"); updates[`daily/${newId}`] = { id: newId, stdKey, teacherId: tId, subject: subj, date: selectedDailyDate, type: 'homework', points: 1, note: 'تم حل الواجب' };
  } else {
    if (rec.points > 0) { updates[`daily/${rec.id}/points`] = -1; updates[`daily/${rec.id}/note`] = 'لم يحل الواجب'; } else { updates[`daily/${rec.id}`] = null; }
  }
  updates[`students/${stdKey}/levels/${subj}`] = window.getUpdatedLevel(stdKey, subj, updates);
  await database.ref('/').update(updates);
};

window.toggleAttendance = async function(stdKey) {
  const subj = currentUser.subject || "عام";
  const tId = currentUser.id || "unknown";
  const tardyRec = dailyRecords.find(r => r.stdKey === stdKey && r.date === selectedDailyDate && r.type === 'tardy' && r.subject === subj);
  const absRec = dailyRecords.find(r => r.stdKey === stdKey && r.date === selectedDailyDate && r.type === 'attendance' && r.subject === subj);
  const updates = {}; const newId = window.generateId("rec");
  if (!tardyRec && !absRec) { updates[`daily/${newId}`] = { id: newId, stdKey, teacherId: tId, subject: subj, date: selectedDailyDate, type: 'tardy', points: -1, note: 'تأخر' }; } 
  else if (tardyRec) {
      updates[`daily/${tardyRec.id}`] = null;
      dailyRecords.forEach(r => { if(r.stdKey === stdKey && r.date === selectedDailyDate && r.subject === subj && r.type !== 'attendance') updates[`daily/${r.id}`] = null; });
      updates[`daily/${newId}`] = { id: newId, stdKey, teacherId: tId, subject: subj, date: selectedDailyDate, type: 'attendance', points: -1, note: 'غياب' };
  } else if (absRec) { updates[`daily/${absRec.id}`] = null; }
  updates[`students/${stdKey}/levels/${subj}`] = window.getUpdatedLevel(stdKey, subj, updates);
  await database.ref('/').update(updates);
};

window.openTeacherLevelModal = function(stdKey) { 
  const subj = currentUser.subject || "عام";
  document.getElementById("tchLvlStdKey").value = stdKey; const currentLvl = studentsData[stdKey].levels[subj] || 3; document.getElementById("tchLvlSelect").value = currentLvl; window.openModal("teacherLevelModal"); 
};

window.saveTeacherLevel = async function(e) {
  e.preventDefault(); const subj = currentUser.subject || "عام"; const stdKey = document.getElementById("tchLvlStdKey").value; const newLvl = parseInt(document.getElementById("tchLvlSelect").value);
  if(studentsData[stdKey]) { await database.ref(`students/${stdKey}/levels/${subj}`).set(newLvl); window.closeModal("teacherLevelModal"); }
};

// ==========================================
// التعديل: تقريب مجموعات الخريطة للمعلم
// ==========================================
window.renderTeacherViews = function() {
  const sel = document.getElementById('teacherClassSelect'); if(!sel || sel.options.length === 0) return; const activeCls = currentUser.classes[sel.value];
  const subj = currentUser.subject || "عام";
  const clsStudents = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class)).sort(window.sortArabicAlphabetically);
  const tbody = document.getElementById("teacherDailyTable");
  if(tbody) {
    tbody.innerHTML = clsStudents.map(x => {
      const k = x[0]; const s = x[1]; const stdRecords = dailyRecords.filter(r => r.stdKey === k && r.subject === subj); const currentLevel = s.levels[subj] || 3;
      const attToday = stdRecords.find(r => r.date === selectedDailyDate && r.type === 'attendance'); const tardyToday = stdRecords.find(r => r.date === selectedDailyDate && r.type === 'tardy'); const hwToday = stdRecords.find(r => r.date === selectedDailyDate && r.type === 'homework');
      let partCount = 0; let behCount = 0; stdRecords.forEach(r => { if(r.date === selectedDailyDate) { if(r.type === 'participation') partCount++; if(r.type === 'behavior') behCount++; } });
      const partBadge = partCount > 0 ? `<span class="badge-counter badge-green left-[-6px] top-[-6px]">${partCount}</span>` : ''; const behBadge = behCount > 0 ? `<span class="badge-counter badge-red left-[-6px] top-[-6px]">${behCount}</span>` : '';
      let attBtn = ''; if (attToday) { attBtn = `<button type="button" onclick="window.toggleAttendance('${k}')" class="text-red-500 hover:text-red-600 text-2xl transition shadow-inner" title="غائب"><i class="fa-solid fa-square-xmark"></i></button>`; } else if (tardyToday) { attBtn = `<button type="button" onclick="window.toggleAttendance('${k}')" class="text-orange-500 hover:text-orange-600 text-2xl transition shadow-inner" title="متأخر"><i class="fa-solid fa-clock"></i></button>`; } else { attBtn = `<button type="button" onclick="window.toggleAttendance('${k}')" class="text-gray-300 hover:text-gray-400 text-2xl transition" title="حاضر"><i class="fa-regular fa-square"></i></button>`; }
      let actionClass = attToday ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105 cursor-pointer';
      let hwBtn = ''; if (!hwToday) { hwBtn = `<button type="button" onclick="window.toggleHomework('${k}')" class="text-gray-300 hover:text-blue-500 text-2xl transition ${attToday ? 'opacity-30 cursor-not-allowed' : ''}"><i class="fa-regular fa-square"></i></button>`; } else if (hwToday.points > 0) { hwBtn = `<button type="button" onclick="window.toggleHomework('${k}')" class="text-green-500 hover:text-green-600 text-2xl transition ${attToday ? 'opacity-30 cursor-not-allowed' : ''}"><i class="fa-solid fa-square-check"></i></button>`; } else { hwBtn = `<button type="button" onclick="window.toggleHomework('${k}')" class="text-orange-500 hover:text-orange-600 text-2xl transition ${attToday ? 'opacity-30 cursor-not-allowed' : ''}"><i class="fa-solid fa-square-xmark"></i></button>`; }
      let starBadgeIcon = s.stars >= 20 ? '🥇' : s.stars >= 10 ? '🥈' : s.stars >= 5 ? '🥉' : '⭐'; let starsHtml = s.stars > 0 ? `<button type="button" onclick="window.openRewardRecord('${k}')" class="cursor-pointer text-[10px] bg-yellow-50 text-yellow-700 px-1 rounded inline-block mr-1" title="سجل النجوم">${starBadgeIcon} ${s.stars}</button>` : ''; let starBtn = `<button type="button" onclick="window.openAddRewardModal('${k}')" class="bg-yellow-50 text-yellow-500 hover:bg-yellow-100 hover:text-yellow-600 px-3 py-1.5 rounded-lg font-black transition ${actionClass}" title="منح نجمة"><i class="fa-solid fa-star"></i></button>`;
      return `<tr class="border-b hover:bg-purple-50/20 ${attToday ? 'bg-red-50/30' : ''}"><td class="p-4 font-black text-right ${attToday ? 'text-gray-400 line-through' : ''}">${window.escapeHtml(s.name)} ${starsHtml}</td><td class="p-3 no-print">${attBtn}</td><td class="p-3 no-print">${hwBtn}</td><td class="p-3 no-print"><button type="button" onclick="window.recordDailyXP('${k}','participation',1,'مشاركة صفية')" class="btn-relative bg-yellow-100 text-yellow-700 px-4 py-1.5 rounded-full font-black shadow-sm transition ${actionClass}"><i class="fa-solid fa-hand-sparkles"></i> +1 ${partBadge}</button></td><td class="p-3 no-print"><button type="button" onclick="window.recordDailyXP('${k}','behavior',-1,'تنبيه سلوكي بالحصة')" class="btn-relative text-red-400 hover:text-red-600 text-lg transition ${actionClass}"><i class="fa-solid fa-triangle-exclamation"></i> -1 ${behBadge}</button></td><td class="p-3 no-print">${starBtn}</td><td class="p-3"><button type="button" onclick="window.openTeacherLevelModal('${k}')" class="level-badge level-${currentLevel} text-sm cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition" title="انقر لتعديل المستوى يدوياً">${currentLevel}</button></td><td class="p-3 no-print"><button type="button" onclick="window.openStudentTracker('${k}')" class="text-gray-400 hover:text-purple-600"><i class="fa-solid fa-chart-line text-lg"></i></button></td></tr>`;
    }).join("");
  }
  
  const mapGrid = document.getElementById("teacherSeatingGrid");
  if(mapGrid) {
    mapGrid.innerHTML = "";
    
    // قللنا المسافات لتصغير الارتفاع وتناسب شاشات الديسكتوب
    const groupPositions = [ 
      "top: 20px; left: 20px; transform: rotate(45deg);", 
      "top: 20px; right: 20px; transform: rotate(-45deg);", 
      "bottom: 20px; left: 20px; transform: rotate(45deg);", 
      "bottom: 20px; right: 20px; transform: rotate(-45deg);", 
      "top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(0deg);" 
    ];

    for (let i = 1; i <= 5; i++) {
      const gStudents = clsStudents.filter(x => x[1].groupNum === i); let rows = ["", "", ""];
      for (let seat = 1; seat <= 5; seat++) {
        const std = gStudents.find(x => x[1].seatNum === seat); 
        let h = `<button type="button" class="seat-pill seat-empty no-print" onclick="window.openAssignModalTeacher(${i},${seat})" title="إضافة طالب في هذا المقعد"><i class="fa-solid fa-plus text-gray-300"></i></button>`;
        if(std) { 
          const stdRecords = dailyRecords.filter(r => r.stdKey === std[0] && r.subject === subj); let xp = 0; stdRecords.forEach(r => xp += r.points); const currentLevel = std[1].levels[subj] || 3;
          let partCount = 0; stdRecords.forEach(r => { if(r.date === selectedDailyDate && r.type === 'participation') partCount++; }); const mapPartBadge = partCount > 0 ? `<span class="badge-counter badge-green no-print" style="top:-8px; left:-8px;">${partCount}</span>` : '';
          const attToday = stdRecords.find(r => r.date === selectedDailyDate && r.type === 'attendance'); const isAbsentClass = attToday ? 'opacity-40 grayscale' : 'hover:bg-yellow-50';
          const nameParts = std[1].name.trim().split(" "); const firstName = nameParts[0]; const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''; const lineThrough = attToday ? 'line-through text-gray-400' : '';
          const starsText = std[1].stars > 0 ? ` | ⭐ ${std[1].stars}` : ''; const xpCapsule = `<div class="xp-capsule">XP ${xp}${starsText}</div>`;
          h = `<div class="seat-pill border-seat-${currentLevel} relative group ${isAbsentClass}">${mapPartBadge}<button type="button" class="w-full h-full flex flex-col justify-center items-center" onclick="window.recordDailyXP('${std[0]}','participation',1,'مشاركة خريطة')"><span class="font-black text-gray-800 text-[11px] leading-tight ${lineThrough}">${firstName}</span>${lastName ? `<span class="text-[8px] text-gray-500 font-bold truncate w-full px-1 ${lineThrough}">${lastName}</span>` : ''}</button>${xpCapsule}<button type="button" onclick="window.openSwapModalTeacher('${std[0]}', event)" class="absolute -top-2 -right-2 bg-gray-200 text-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] hidden group-hover:flex hover:bg-purple-600 hover:text-white transition no-print"><i class="fa-solid fa-right-left"></i></button></div>`; 
        }
        if(seat<=2) rows[0]+=h; else if(seat<=4) rows[1]+=h; else rows[2]+=h;
      }
      mapGrid.innerHTML += `<div class="absolute bg-white border-2 border-gray-100 rounded-[28px] p-4 flex flex-col items-center shadow-sm" style="width: 250px; ${groupPositions[i-1]}"><div class="flex gap-2 mb-2 w-full justify-center">${rows[0]}</div><div class="flex gap-2 mb-2 w-full justify-center">${rows[1]}</div><div class="flex gap-2 mb-3 w-full justify-center">${rows[2]}</div><button type="button" onclick="window.rewardGroupXP(${i})" class="w-full bg-yellow-100 text-yellow-700 font-black text-sm py-1.5 rounded-full hover:bg-yellow-200 transition no-print"><i class="fa-solid fa-star"></i> مكافأة المجموعة (+1)</button></div>`;
    }
  }
};

window.rewardGroupXP = function(groupNum) {
  const sel = document.getElementById('teacherClassSelect'); const activeCls = currentUser.classes[sel.value];
  const subj = currentUser.subject || "عام";
  const gStudents = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class) && x[1].groupNum === groupNum);
  if(gStudents.length === 0) return alert("لا يوجد طلاب هنا");
  gStudents.forEach(x => { const isAbsent = dailyRecords.some(r => r.stdKey === x[0] && r.date === selectedDailyDate && r.type === 'attendance' && r.subject === subj); if(!isAbsent) window.recordDailyXP(x[0], 'participation', 1, 'عمل جماعي مميز'); });
};

window.smartDistributeStudentsTeacher = async function() { 
  const sel = document.getElementById('teacherClassSelect'); const activeCls = currentUser.classes[sel.value];
  const subj = currentUser.subject || "عام";
  const arr = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class));
  if(!arr.length) return; arr.sort((a,b) => (a[1].levels[subj]||3) - (b[1].levels[subj]||3)); 
  let gIdx=1, dir=1; const groups={1:[],2:[],3:[],4:[],5:[]}; 
  arr.forEach(x => { groups[gIdx].push(x[0]); gIdx += dir; if(gIdx > 5){ gIdx=5; dir=-1; gIdx+=dir; } else if(gIdx < 1){ gIdx=1; dir=1; gIdx+=dir; } }); 
  const updates = {}; Object.entries(groups).forEach(([gn,keys]) => { keys.forEach((k,i) => { updates[`students/${k}/groupNum`] = Number(gn); updates[`students/${k}/seatNum`] = i+1; }); }); 
  await database.ref('/').update(updates); 
};

window.randomShuffleTeacher = async function() { 
  const sel = document.getElementById('teacherClassSelect'); const activeCls = currentUser.classes[sel.value];
  const arr = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class));
  if(!arr.length) return; for(let i=arr.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; } 
  const updates = {}; arr.forEach((x,i) => { updates[`students/${x[0]}/groupNum`] = Math.floor(i/5)+1; updates[`students/${x[0]}/seatNum`] = (i%5)+1; }); 
  await database.ref('/').update(updates); 
};

window.openAssignModalTeacher = function(g, s) {
  currentAssignGroup = g; currentAssignSeat = s; const selObj = document.getElementById('teacherClassSelect'); const activeCls = currentUser.classes[selObj.value]; const sel = document.getElementById("assignTargetStudent"); sel.innerHTML="";
  const arr = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class)).sort(window.sortArabicAlphabetically);
  arr.forEach(x => sel.innerHTML+=`<option value="${x[0]}">${window.escapeHtml(x[1].name)}</option>`); window.openModal("assignModal");
};

window.openSwapModalTeacher = function(k, event) {
  event.stopPropagation(); currentSwapStudentKey = k; const sel = document.getElementById("swapTargetStudent"); sel.innerHTML="";
  const arr = Object.entries(studentsData).filter(x => x[1].grade === studentsData[k].grade && String(x[1].class) === String(studentsData[k].class) && x[0] !== k).sort(window.sortArabicAlphabetically);
  arr.forEach(x => sel.innerHTML+=`<option value="${x[0]}">${window.escapeHtml(x[1].name)}</option>`); window.openModal("swapModal");
};

// ==========================================
// التعديل: إزالة شرط الإخفاء في التقرير الشامل للمعلم
// ==========================================
window.generateTeacherFullReport = function(isUpdate = false) {
  const sel = document.getElementById('teacherClassSelect'); if(!sel || sel.options.length === 0) return; const activeCls = currentUser.classes[sel.value];
  const subj = currentUser.subject || "عام";
  const clsStudents = Object.entries(studentsData).filter(x => x[1].grade === activeCls.grade && String(x[1].class) === String(activeCls.class)).sort(window.sortArabicAlphabetically);
  let dateFrom = ""; let dateTo = ""; if(isUpdate) { dateFrom = document.getElementById("tchRepFrom")?.value || ""; dateTo = document.getElementById("tchRepTo")?.value || ""; }
  let html = `<div class="flex flex-wrap gap-3 mb-4 bg-purple-50 p-3 rounded-xl border border-purple-100 no-print"><div class="flex-1 min-w-[150px]"><label class="text-xs font-bold text-gray-500 mb-1 block">من تاريخ:</label><input type="date" id="tchRepFrom" value="${dateFrom}" onchange="window.generateTeacherFullReport(true)" class="w-full border p-2 rounded outline-none font-bold text-sm"></div><div class="flex-1 min-w-[150px]"><label class="text-xs font-bold text-gray-500 mb-1 block">إلى تاريخ:</label><input type="date" id="tchRepTo" value="${dateTo}" onchange="window.generateTeacherFullReport(true)" class="w-full border p-2 rounded outline-none font-bold text-sm"></div></div>`;
  html += `<table class="w-full text-sm text-center border-collapse"><thead class="bg-gray-100 font-bold border-b-2"><tr><th class="p-3 border">اسم الطالب</th><th class="p-3 border text-green-700">المشاركات (+1)</th><th class="p-3 border text-blue-700">واجبات محلولة</th><th class="p-3 border text-orange-600">واجبات مفقودة</th><th class="p-3 border text-red-700">غياب (-1)</th><th class="p-3 border text-yellow-600">تأخر (-1)</th><th class="p-3 border text-red-900">مخالفات (-1)</th><th class="p-3 border">الصافي (XP)</th></tr></thead><tbody>`;
  
  if(clsStudents.length === 0) {
      html += `<tr><td colspan="8" class="p-4 text-center text-gray-500 font-bold">لا يوجد طلاب مسجلين في هذا الفصل</td></tr>`;
  } else {
      clsStudents.forEach(([k, s]) => {
        const stdRecords = dailyRecords.filter(r => { if(r.stdKey !== k || r.subject !== subj) return false; if(dateFrom && r.date < dateFrom) return false; if(dateTo && r.date > dateTo) return false; return true; });
        // إظهار الطالب دائماً بدون شروط
        let xp = 0; stdRecords.forEach(r => xp += r.points); 
        const parts = stdRecords.filter(r => r.type === 'participation').length; 
        const hwDone = stdRecords.filter(r => r.type === 'homework' && r.points > 0).length; 
        const hwMissed = stdRecords.filter(r => r.type === 'homework' && r.points < 0).length; 
        const abs = stdRecords.filter(r => r.type === 'attendance').length; 
        const tardies = stdRecords.filter(r => r.type === 'tardy').length; 
        const behs = stdRecords.filter(r => r.type === 'behavior').length;
        html += `<tr class="border-b hover:bg-gray-50"><td class="p-3 border font-bold text-right">${window.escapeHtml(s.name)}</td><td class="p-3 border font-black">${parts}</td><td class="p-3 border font-black">${hwDone}</td><td class="p-3 border font-black">${hwMissed}</td><td class="p-3 border font-black text-red-500">${abs}</td><td class="p-3 border font-black text-yellow-600">${tardies}</td><td class="p-3 border font-black text-red-800">${behs}</td><td class="p-3 border font-black" dir="ltr">${xp}</td></tr>`;
      });
  }
  html += `</tbody></table>`; document.getElementById("teacherReportOutput").innerHTML = html;
};

window.openStudentTracker = function(stdKey) {
  const subj = currentUser.subject || "عام";
  const s = studentsData[stdKey]; if(!s) return; const stdRecords = dailyRecords.filter(r => r.stdKey === stdKey && r.subject === subj); let xp = 0; stdRecords.forEach(r => xp += r.points);
  document.getElementById("trackerStudentName").textContent = s.name; document.getElementById("trackXP").textContent = xp; document.getElementById("trackLevel").textContent = s.levels[subj] || 3; document.getElementById("trackAbs").textContent = stdRecords.filter(r => r.type === 'attendance').length; document.getElementById("trackTardy").textContent = stdRecords.filter(r => r.type === 'tardy').length; document.getElementById("trackMissedHW").textContent = stdRecords.filter(r => r.type === 'homework' && r.points < 0).length;
  const hist = document.getElementById("trackerHistory");
  if(stdRecords.length === 0) { hist.innerHTML = `<p class="text-sm font-bold text-gray-400">لا يوجد سجلات</p>`; } else { hist.innerHTML = stdRecords.sort((a,b)=> new Date(b.date)-new Date(a.date)).map(r => { const color = r.points > 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"; return `<div class="flex justify-between p-3 rounded-lg border border-gray-100 ${color}"><span class="font-bold text-sm">${window.escapeHtml(r.note)}</span><span class="font-black" dir="ltr">${r.points > 0 ? '+':''}${r.points}</span></div>`; }).join(""); }
  window.openModal("modalTracker");
};
