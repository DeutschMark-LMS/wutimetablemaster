/**
 * Wellspring University Timetable Master — Student Companion Logic
 * Real-time class ticker, personalized cohort timeline, exam docket & calendar sync.
 */

document.addEventListener("DOMContentLoaded", () => {
  const store = new DataStore();

  let activeStudentMode = "lecture"; // 'lecture' | 'exam'
  let selectedLevelId = null;
  let activeTimelineDay = getTodayName();
  let cohortFilterCollege = "all";

  // Cache DOM Elements
  const liveClockEl = document.getElementById("live-clock");
  const liveStatusPill = document.getElementById("live-status-pill");
  const liveStatusText = document.getElementById("live-status-text");
  const liveCourseCode = document.getElementById("live-course-code");
  const liveUnitsBadge = document.getElementById("live-units-badge");
  const liveCourseTitle = document.getElementById("live-course-title");
  const liveVenueName = document.getElementById("live-venue-name");
  const liveTimeSlot = document.getElementById("live-time-slot");
  const livePersonLabel = document.getElementById("live-person-label");
  const livePersonName = document.getElementById("live-person-name");

  const currentCohortName = document.getElementById("current-cohort-name");
  const currentCohortDept = document.getElementById("current-cohort-dept");

  const viewLectureContent = document.getElementById("view-lecture-content");
  const viewExamContent = document.getElementById("view-exam-content");
  const studentEmptyState = document.getElementById("student-empty-state");

  const studentScheduleFeed = document.getElementById("student-schedule-feed");
  const studentExamFeed = document.getElementById("student-exam-feed");
  const daySummaryTitle = document.getElementById("day-summary-title");
  const daySummaryCount = document.getElementById("day-summary-count");
  const examSummaryCount = document.getElementById("exam-summary-count");

  const modalCohortPicker = document.getElementById("modal-cohort-picker");
  const cohortModalList = document.getElementById("cohort-modal-list");
  const cohortSearchInput = document.getElementById("cohort-search-input");

  // --- TIME HELPERS ---
  function getTodayName() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    // If weekend, default to Monday
    if (today === "Saturday" || today === "Sunday") return "Monday";
    return today;
  }

  // Parse slot string into start and end hours (24h format)
  // e.g. "08:00 - 09:00" -> { startHour: 8, startMin: 0, endHour: 9, endMin: 0 }
  function parseSlotTimes(slotLabel) {
    if (!slotLabel) return { startHour: 8, startMin: 0, endHour: 9, endMin: 0 };
    const parts = slotLabel.split("-").map(p => p.trim());
    const [startH, startM] = (parts[0] || "08:00").split(":").map(Number);
    const [endH, endM] = (parts[1] || "09:00").split(":").map(Number);
    return {
      startHour: startH || 8,
      startMin: startM || 0,
      endHour: endH || 9,
      endMin: endM || 0
    };
  }

  function getTimeStatus(day, startSlot, duration = 1) {
    const now = new Date();
    const currentDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
    
    // If not today, status is upcoming if future day, finished if past day
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const curIdx = dayOrder.indexOf(currentDayName);
    const targetIdx = dayOrder.indexOf(day);

    if (targetIdx < curIdx) return "finished";
    if (targetIdx > curIdx) return "upcoming";

    // Today: calculate minutes from midnight
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = store.state.settings?.slots || DEFAULT_SLOTS;
    const firstSlot = slots[startSlot] || slots[0];
    const lastSlot = slots[startSlot + duration - 1] || firstSlot;

    const startTimes = parseSlotTimes(firstSlot.label);
    const endTimes = parseSlotTimes(lastSlot.label);

    const startMinTotal = startTimes.startHour * 60 + startTimes.startMin;
    const endMinTotal = endTimes.endHour * 60 + endTimes.endMin;

    if (nowMinutes >= endMinTotal) return "finished";
    if (nowMinutes >= startMinTotal && nowMinutes < endMinTotal) return "ongoing";
    return "upcoming";
  }

  // --- INITIALIZATION ---
  function initStudentApp() {
    // Check URL parameter: ?level=lvl-...
    const urlParams = new URLSearchParams(window.location.search);
    const paramLevelId = urlParams.get("level");

    if (paramLevelId && store.state.levels.some(l => l.id === paramLevelId)) {
      selectedLevelId = paramLevelId;
      localStorage.setItem("wellspring_student_cohort", selectedLevelId);
    } else {
      selectedLevelId = localStorage.getItem("wellspring_student_cohort");
    }

    // If still no valid selected level, pick the first available one or prompt
    if (!selectedLevelId && store.state.levels.length > 0) {
      selectedLevelId = store.state.levels[0].id;
      localStorage.setItem("wellspring_student_cohort", selectedLevelId);
    }

    // Set institution labels from settings
    const instTitle = store.state.settings?.institution || "Wellspring University";
    const sessionTitle = store.state.settings?.session || "2025/2026 Academic Session";
    const semTitle = store.state.settings?.semester || "First Semester";
    const sessionLabel = document.getElementById("student-session-label");
    if (sessionLabel) {
      sessionLabel.textContent = `${instTitle} • ${sessionTitle} • ${semTitle}`;
    }

    // Activate today's day pill
    document.querySelectorAll(".student-day-pill").forEach(pill => {
      if (pill.getAttribute("data-day") === activeTimelineDay) {
        pill.className = "student-day-pill flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-wellspring-navy text-amber-300 border border-wellspring-navy text-center shadow-sm";
      } else {
        pill.className = "student-day-pill flex-1 py-2 px-3 rounded-xl font-semibold text-xs bg-white text-slate-700 border border-slate-200 text-center shadow-sm";
      }
    });

    updateCohortDisplay();
    renderStudentViews();
    startLiveClock();
  }

  // --- COHORT DISPLAY UPDATE ---
  function updateCohortDisplay() {
    if (!selectedLevelId) {
      currentCohortName.textContent = "Select Your Level / Program";
      currentCohortDept.textContent = "Tap here to choose your cohort";
      return;
    }

    const level = store.state.levels.find(l => l.id === selectedLevelId);
    if (level) {
      const col = resolveEntityCollege(level, store);
      currentCohortName.textContent = level.name;
      currentCohortDept.textContent = `${level.department || col.name} • ${level.size} Students`;
    } else {
      currentCohortName.textContent = "Select Your Level / Program";
      currentCohortDept.textContent = "Tap here to choose your cohort";
    }
  }

  // --- LIVE HERO CARD & REAL-TIME TICKER ---
  function startLiveClock() {
    function tick() {
      const now = new Date();
      if (liveClockEl) {
        liveClockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      updateLiveHeroCard();
    }
    tick();
    setInterval(tick, 1000);
  }

  function updateLiveHeroCard() {
    if (!selectedLevelId) {
      liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold";
      liveStatusText.textContent = "No Cohort Selected";
      liveCourseCode.textContent = "SELECT COHORT";
      liveUnitsBadge.textContent = "--";
      liveCourseTitle.textContent = "Tap 'Select Your Cohort' to load your personalized schedule.";
      liveVenueName.textContent = "--";
      liveTimeSlot.textContent = "--";
      livePersonName.textContent = "--";
      return;
    }

    if (activeStudentMode === "exam") {
      updateLiveExamHero();
      return;
    }

    const timetable = store.state.activeTimetable;
    if (!timetable || !timetable.scheduledSessions || timetable.scheduledSessions.length === 0) {
      liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold";
      liveStatusText.textContent = "No Timetable Published";
      liveCourseCode.textContent = "NO SCHEDULE";
      liveUnitsBadge.textContent = "Pending";
      liveCourseTitle.textContent = "The Timetable Committee has not published an active schedule yet.";
      liveVenueName.textContent = "TBA";
      liveTimeSlot.textContent = "TBA";
      livePersonName.textContent = "TBA";
      return;
    }

    const now = new Date();
    const currentDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Check Chapel Hour: Wednesday 12:00 - 13:00 (720 to 780 minutes)
    if (currentDayName === "Wednesday" && nowMinutes >= 720 && nowMinutes < 780) {
      liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold";
      liveStatusText.textContent = "CHAPEL SERVICE IN SESSION";
      liveCourseCode.textContent = "CHAPEL";
      liveUnitsBadge.textContent = "University-Wide";
      liveCourseTitle.textContent = "All lectures suspended for University Midweek Chapel Service.";
      liveVenueName.textContent = "University Chapel";
      liveTimeSlot.textContent = "12:00 PM – 01:00 PM";
      livePersonName.textContent = "University Chaplaincy";
      return;
    }

    // Check Midday Lunch Break: Monday, Tuesday, Thursday, Friday 12:00 - 13:00
    if (["Monday", "Tuesday", "Thursday", "Friday"].includes(currentDayName) && nowMinutes >= 720 && nowMinutes < 780) {
      liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold";
      liveStatusText.textContent = "MIDDAY BREAK";
      liveCourseCode.textContent = "LUNCH BREAK";
      liveUnitsBadge.textContent = "1 Hour";
      liveCourseTitle.textContent = "Official university lunch and midday rest interval.";
      liveVenueName.textContent = "Student Center / Cafeteria";
      liveTimeSlot.textContent = "12:00 PM – 01:00 PM";
      livePersonName.textContent = "Free Period";
      return;
    }

    // Get today's sessions for this cohort
    const slots = store.state.settings?.slots || DEFAULT_SLOTS;
    const cohortSessions = timetable.scheduledSessions.filter(s => 
      s.day === currentDayName && Array.isArray(s.levelIds) && s.levelIds.includes(selectedLevelId)
    ).sort((a, b) => a.startSlot - b.startSlot);

    if (cohortSessions.length === 0) {
      // Free day today
      liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[11px] font-bold";
      liveStatusText.textContent = currentDayName === "Saturday" || currentDayName === "Sunday" ? "WEEKEND" : "FREE DAY TODAY";
      liveCourseCode.textContent = "NO CLASSES TODAY";
      liveUnitsBadge.textContent = "Rest / Study";
      liveCourseTitle.textContent = "You have no lectures scheduled for today. Enjoy your private study!";
      liveVenueName.textContent = "Campus";
      liveTimeSlot.textContent = "All Day";
      livePersonName.textContent = "Self Study";
      return;
    }

    // 1. Is any class ongoing right now?
    for (const s of cohortSessions) {
      const firstSlot = slots[s.startSlot] || slots[0];
      const lastSlot = slots[s.startSlot + (s.duration || 1) - 1] || firstSlot;
      const startTimes = parseSlotTimes(firstSlot.label);
      const endTimes = parseSlotTimes(lastSlot.label);
      const startMinTotal = startTimes.startHour * 60 + startTimes.startMin;
      const endMinTotal = endTimes.endHour * 60 + endTimes.endMin;

      if (nowMinutes >= startMinTotal && nowMinutes < endMinTotal) {
        const minsLeft = endMinTotal - nowMinutes;
        const lec = store.state.lecturers.find(l => l.id === s.lecturerId);
        liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold";
        liveStatusText.textContent = `LIVE CLASS NOW (${minsLeft}m left)`;
        liveCourseCode.textContent = s.courseCode;
        liveUnitsBadge.textContent = `${s.units || 2} Units`;
        liveCourseTitle.textContent = s.courseTitle || s.courseCode;
        liveVenueName.textContent = s.venueName || "TBA";
        liveTimeSlot.textContent = `${firstSlot.label.split("-")[0].trim()} – ${lastSlot.label.split("-")[1].trim()}`;
        livePersonLabel.textContent = "Lecturer";
        livePersonName.textContent = lec ? lec.name : "TBA";
        return;
      }
    }

    // 2. Is there an upcoming class today?
    for (const s of cohortSessions) {
      const firstSlot = slots[s.startSlot] || slots[0];
      const lastSlot = slots[s.startSlot + (s.duration || 1) - 1] || firstSlot;
      const startTimes = parseSlotTimes(firstSlot.label);
      const startMinTotal = startTimes.startHour * 60 + startTimes.startMin;

      if (nowMinutes < startMinTotal) {
        const minsUntil = startMinTotal - nowMinutes;
        const lec = store.state.lecturers.find(l => l.id === s.lecturerId);
        liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold";
        liveStatusText.textContent = minsUntil <= 60 ? `UP NEXT IN ${minsUntil} MINS` : `NEXT TODAY AT ${firstSlot.label.split("-")[0].trim()}`;
        liveCourseCode.textContent = s.courseCode;
        liveUnitsBadge.textContent = `${s.units || 2} Units`;
        liveCourseTitle.textContent = s.courseTitle || s.courseCode;
        liveVenueName.textContent = s.venueName || "TBA";
        liveTimeSlot.textContent = `${firstSlot.label.split("-")[0].trim()} – ${lastSlot.label.split("-")[1].trim()}`;
        livePersonLabel.textContent = "Lecturer";
        livePersonName.textContent = lec ? lec.name : "TBA";
        return;
      }
    }

    // 3. All classes for today are completed!
    liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold";
    liveStatusText.textContent = "ALL LECTURES DONE FOR TODAY";
    liveCourseCode.textContent = "DAY COMPLETE";
    liveUnitsBadge.textContent = "Well Done";
    liveCourseTitle.textContent = "All scheduled sessions for today are completed. See you tomorrow!";
    liveVenueName.textContent = "Campus";
    liveTimeSlot.textContent = "Concluded";
    livePersonLabel.textContent = "Status";
    livePersonName.textContent = "Free for Evening";
  }

  function updateLiveExamHero() {
    const examTimetable = store.state.activeExamTimetable;
    if (!examTimetable || !examTimetable.scheduledExams || examTimetable.scheduledExams.length === 0) {
      liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold";
      liveStatusText.textContent = "EXAM DOCKET PENDING";
      liveCourseCode.textContent = "NO EXAMS YET";
      liveUnitsBadge.textContent = "Docket";
      liveCourseTitle.textContent = "The examination timetable has not been generated by the committee.";
      liveVenueName.textContent = "TBA";
      liveTimeSlot.textContent = "TBA";
      livePersonLabel.textContent = "Invigilator";
      livePersonName.textContent = "TBA";
      return;
    }

    const myExams = examTimetable.scheduledExams.filter(e => 
      Array.isArray(e.levelIds) && e.levelIds.includes(selectedLevelId)
    );

    if (myExams.length === 0) {
      liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold";
      liveStatusText.textContent = "NO EXAMS FOR THIS COHORT";
      liveCourseCode.textContent = "CLEAR DOCKET";
      liveUnitsBadge.textContent = "0 Papers";
      liveCourseTitle.textContent = "No examination papers scheduled for this cohort.";
      liveVenueName.textContent = "--";
      liveTimeSlot.textContent = "--";
      livePersonLabel.textContent = "Invigilators";
      livePersonName.textContent = "--";
      return;
    }

    const nextExam = myExams[0];
    const invigNames = (nextExam.invigilatorIds || []).map(id => {
      const lec = store.state.lecturers.find(l => l.id === id);
      return lec ? lec.name : null;
    }).filter(Boolean).join(", ");

    liveStatusPill.className = "flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold";
    liveStatusText.textContent = `UPCOMING EXAM • ${nextExam.day}`;
    liveCourseCode.textContent = nextExam.courseCode;
    liveUnitsBadge.textContent = `${nextExam.units || 2} Units`;
    liveCourseTitle.textContent = nextExam.courseTitle || nextExam.courseCode;
    liveVenueName.textContent = `${nextExam.venueName || 'Exam Hall'} (Desk Spacing)`;
    liveTimeSlot.textContent = `${nextExam.day} • ${nextExam.time || '09:00 - 12:00'}`;
    livePersonLabel.textContent = "Invigilator Pool";
    livePersonName.textContent = invigNames || "Assigned Faculty";
  }

  // --- RENDER TIMELINE / FEED ---
  function renderStudentViews() {
    if (!selectedLevelId) {
      viewLectureContent.classList.add("hidden");
      viewExamContent.classList.add("hidden");
      studentEmptyState.classList.remove("hidden");
      return;
    }

    studentEmptyState.classList.add("hidden");

    if (activeStudentMode === "exam") {
      viewLectureContent.classList.add("hidden");
      viewExamContent.classList.remove("hidden");
      renderStudentExamFeed();
    } else {
      viewLectureContent.classList.remove("hidden");
      viewExamContent.classList.add("hidden");
      renderStudentLectureTimeline();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Render Lecture Day Schedule Feed
  function renderStudentLectureTimeline() {
    const timetable = store.state.activeTimetable;
    const slots = store.state.settings?.slots || DEFAULT_SLOTS;

    if (!timetable || !timetable.scheduledSessions || timetable.scheduledSessions.length === 0) {
      studentScheduleFeed.innerHTML = `
        <div class="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
          <h4 class="font-extrabold text-slate-800 text-sm">No Timetable Generated Yet</h4>
          <p class="text-xs text-slate-500 max-w-xs mx-auto">
            The Directorate of Academic Planning has not published a master timetable yet.
          </p>
        </div>
      `;
      daySummaryCount.textContent = "0 classes";
      return;
    }

    // Filter sessions for selected level & active day
    const daySessions = timetable.scheduledSessions.filter(s =>
      s.day === activeTimelineDay && Array.isArray(s.levelIds) && s.levelIds.includes(selectedLevelId)
    ).sort((a, b) => a.startSlot - b.startSlot);

    daySummaryTitle.textContent = `${activeTimelineDay}'s Lectures`;
    daySummaryCount.textContent = `${daySessions.length} ${daySessions.length === 1 ? 'class' : 'classes'}`;

    if (daySessions.length === 0) {
      studentScheduleFeed.innerHTML = `
        <div class="py-10 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-2">
          <div class="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
            <i data-lucide="coffee" class="w-5 h-5"></i>
          </div>
          <h4 class="font-extrabold text-slate-800 text-sm">No Lectures Scheduled on ${activeTimelineDay}</h4>
          <p class="text-xs text-slate-500 max-w-xs mx-auto">
            This is a free lecture day for your cohort. Use this time for personal study or group projects.
          </p>
        </div>
      `;
      return;
    }

    let html = "";

    // Render classes chronologically, inserting Chapel / Lunch period at Slot 4 (12pm - 1pm)
    let breakRendered = false;

    daySessions.forEach(s => {
      // If we crossed 12pm, insert break if not yet inserted
      if (s.startSlot >= 4 && !breakRendered) {
        html += renderBreakCard(activeTimelineDay);
        breakRendered = true;
      }

      const firstSlot = slots[s.startSlot] || slots[0];
      const lastSlot = slots[s.startSlot + (s.duration || 1) - 1] || firstSlot;
      const timeStr = `${firstSlot.label.split("-")[0].trim()} – ${lastSlot.label.split("-")[1].trim()}`;
      const status = getTimeStatus(s.day, s.startSlot, s.duration || 1);
      const lec = store.state.lecturers.find(l => l.id === s.lecturerId);
      const crs = store.state.courses.find(c => c.id === s.courseId || c.code === s.courseCode);

      let statusBadge = "";
      if (status === "ongoing") {
        statusBadge = `<span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 live-pulse-dot"></span> Live Now</span>`;
      } else if (status === "finished") {
        statusBadge = `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">Concluded</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">Upcoming</span>`;
      }

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden space-y-2.5 transition-all hover:shadow-md">
          <div class="w-1.5 absolute left-0 top-0 bottom-0" style="background-color: ${crs ? crs.color : '#3B82F6'};"></div>

          <div class="flex items-start justify-between pl-1 gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-base text-slate-900 font-mono tracking-tight">${s.courseCode}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">${s.units || 2} Units</span>
              </div>
              <h4 class="text-xs font-semibold text-slate-700 mt-0.5">${s.courseTitle || s.courseCode}</h4>
            </div>
            ${statusBadge}
          </div>

          <div class="pl-1 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div class="flex items-center gap-1.5 text-slate-600">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
              <span class="font-bold text-slate-800">${timeStr}</span>
              <span class="text-[10px] text-slate-400">(${s.duration}h)</span>
            </div>
            <div class="flex items-center gap-1.5 text-slate-600 truncate">
              <i data-lucide="building" class="w-3.5 h-3.5 text-blue-500 flex-shrink-0"></i>
              <span class="font-bold text-slate-800 truncate">${s.venueName}</span>
            </div>
            <div class="col-span-2 flex items-center gap-1.5 text-slate-600 truncate">
              <i data-lucide="user-check" class="w-3.5 h-3.5 text-amber-500 flex-shrink-0"></i>
              <span class="text-slate-500 text-[11px]">Lecturer:</span>
              <span class="font-semibold text-slate-800 truncate">${lec ? lec.name : 'Unassigned'}</span>
            </div>
          </div>
        </div>
      `;
    });

    if (!breakRendered) {
      html += renderBreakCard(activeTimelineDay);
    }

    studentScheduleFeed.innerHTML = html;
  }

  function renderBreakCard(day) {
    if (day === "Wednesday") {
      return `
        <div class="bg-amber-50/80 rounded-2xl border border-amber-200 p-3.5 text-xs flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold flex-shrink-0">
            <i data-lucide="church" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-amber-950">University Chapel Service</span>
              <span class="font-mono text-[10px] font-bold text-amber-800">12:00 PM – 01:00 PM</span>
            </div>
            <p class="text-[11px] text-amber-800 mt-0.5">Mandatory university worship. All lectures suspended.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-slate-50 rounded-2xl border border-slate-200 p-3 text-xs flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold flex-shrink-0">
          <i data-lucide="utensils" class="w-4 h-4"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800">Midday Break & Lunch</span>
            <span class="font-mono text-[10px] text-slate-500 font-semibold">12:00 PM – 01:00 PM</span>
          </div>
          <p class="text-[10px] text-slate-500">Official campus resting period.</p>
        </div>
      </div>
    `;
  }

  // Render Examination Docket Feed
  function renderStudentExamFeed() {
    const examTimetable = store.state.activeExamTimetable;
    if (!examTimetable || !examTimetable.scheduledExams || examTimetable.scheduledExams.length === 0) {
      studentExamFeed.innerHTML = `
        <div class="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
            <i data-lucide="file-check-2" class="w-6 h-6"></i>
          </div>
          <h4 class="font-extrabold text-slate-800 text-sm">No Examination Docket Computed Yet</h4>
          <p class="text-xs text-slate-500 max-w-xs mx-auto">
            The exam timetable will appear here as soon as the Directorate computes the examination dockets.
          </p>
        </div>
      `;
      examSummaryCount.textContent = "0 Papers";
      return;
    }

    const myExams = examTimetable.scheduledExams.filter(e => 
      Array.isArray(e.levelIds) && e.levelIds.includes(selectedLevelId)
    );

    examSummaryCount.textContent = `${myExams.length} ${myExams.length === 1 ? 'Paper' : 'Papers'}`;

    if (myExams.length === 0) {
      studentExamFeed.innerHTML = `
        <div class="py-10 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-2">
          <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <i data-lucide="award" class="w-5 h-5"></i>
          </div>
          <h4 class="font-extrabold text-slate-800 text-sm">No Examination Papers for this Level</h4>
          <p class="text-xs text-slate-500 max-w-xs mx-auto">
            No enrolled courses under this cohort have been scheduled for exams.
          </p>
        </div>
      `;
      return;
    }

    let html = "";
    myExams.forEach((e, idx) => {
      const invigNames = (e.invigilatorIds || []).map(id => {
        const lec = store.state.lecturers.find(l => l.id === id);
        return lec ? lec.name : null;
      }).filter(Boolean).join(", ");

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 relative overflow-hidden">
          <div class="w-1.5 absolute left-0 top-0 bottom-0 bg-amber-500"></div>

          <div class="flex items-start justify-between pl-1 gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-base text-slate-900 font-mono tracking-tight">${e.courseCode}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Paper #${idx + 1}</span>
              </div>
              <h4 class="text-xs font-semibold text-slate-700 mt-0.5">${e.courseTitle || e.courseCode}</h4>
            </div>
            <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 text-[10px] font-bold font-mono">
              ${e.sessionLabel?.includes('Morning') ? 'Morning' : 'Afternoon'}
            </span>
          </div>

          <div class="pl-1 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div class="flex items-center gap-1.5 text-slate-600">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-amber-500 flex-shrink-0"></i>
              <span class="font-bold text-slate-800">${e.day}</span>
            </div>
            <div class="flex items-center gap-1.5 text-slate-600">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
              <span class="font-bold text-slate-800">${e.time || '09:00 - 12:00'}</span>
            </div>
            <div class="flex items-center gap-1.5 text-slate-600 truncate">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0"></i>
              <span class="font-bold text-slate-800 truncate">${e.venueName}</span>
              <span class="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-semibold">Spaced</span>
            </div>
            <div class="flex items-center gap-1.5 text-slate-600">
              <i data-lucide="layers" class="w-3.5 h-3.5 text-purple-500 flex-shrink-0"></i>
              <span class="text-slate-600 font-semibold">${e.units || 2} Credit Units</span>
            </div>
            <div class="col-span-2 flex items-center gap-1.5 text-slate-600 text-[11px] pt-1">
              <i data-lucide="user-check" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
              <span class="text-slate-400">Invigilator Pool:</span>
              <span class="font-semibold text-slate-700 truncate">${invigNames || 'Assigned Examination Officers'}</span>
            </div>
          </div>
        </div>
      `;
    });

    studentExamFeed.innerHTML = html;
  }

  // --- ICALENDAR (.ICS) EXPORT FOR PHONE CALENDAR SYNC ---
  function exportCohortICal() {
    if (!selectedLevelId) {
      showStudentToast("Please select your level first.");
      return;
    }

    const level = store.state.levels.find(l => l.id === selectedLevelId);
    const levelName = level ? level.name : "My_Cohort";
    const timetable = activeStudentMode === "exam" ? store.state.activeExamTimetable : store.state.activeTimetable;

    if (!timetable) {
      showStudentToast("No timetable generated to export.");
      return;
    }

    let icsEvents = [];
    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    if (activeStudentMode === "exam") {
      const myExams = (timetable.scheduledExams || []).filter(e => 
        Array.isArray(e.levelIds) && e.levelIds.includes(selectedLevelId)
      );

      if (myExams.length === 0) {
        showStudentToast("No exams found for this cohort.");
        return;
      }

      myExams.forEach((e, i) => {
        const [startStr, endStr] = (e.time || "09:00 - 12:00").split("-").map(s => s.trim());
        const [sH, sM] = (startStr || "09:00").split(":").map(Number);
        const [eH, eM] = (endStr || "12:00").split(":").map(Number);

        // Map day name to upcoming date
        const eventDate = getNextDateForDay(e.day);
        const dtstart = formatICalDate(eventDate, sH, sM);
        const dtend = formatICalDate(eventDate, eH, eM);

        icsEvents.push([
          "BEGIN:VEVENT",
          `UID:wellspring-exam-${e.courseCode}-${i}@wellspring.edu.ng`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${dtstart}`,
          `DTEND:${dtend}`,
          `SUMMARY:EXAM: ${e.courseCode} - ${(e.courseTitle || '').replace(/,/g, '\\,')}`,
          `LOCATION:${(e.venueName || 'Exam Hall').replace(/,/g, '\\,')}`,
          `DESCRIPTION:Official Examination Paper for ${levelName}. Venue: ${e.venueName}. Units: ${e.units || 2}.`,
          "BEGIN:VALARM",
          "TRIGGER:-PT30M",
          "ACTION:DISPLAY",
          "DESCRIPTION:Exam in 30 minutes",
          "END:VALARM",
          "END:VEVENT"
        ].join("\r\n"));
      });

    } else {
      // Weekly Lectures
      const slots = store.state.settings?.slots || DEFAULT_SLOTS;
      const mySessions = (timetable.scheduledSessions || []).filter(s =>
        Array.isArray(s.levelIds) && s.levelIds.includes(selectedLevelId)
      );

      if (mySessions.length === 0) {
        showStudentToast("No classes found for this cohort.");
        return;
      }

      mySessions.forEach((s, i) => {
        const firstSlot = slots[s.startSlot] || slots[0];
        const lastSlot = slots[s.startSlot + (s.duration || 1) - 1] || firstSlot;
        const startTimes = parseSlotTimes(firstSlot.label);
        const endTimes = parseSlotTimes(lastSlot.label);

        const eventDate = getNextDateForDay(s.day);
        const dtstart = formatICalDate(eventDate, startTimes.startHour, startTimes.startMin);
        const dtend = formatICalDate(eventDate, endTimes.endHour, endTimes.endMin);

        const lec = store.state.lecturers.find(l => l.id === s.lecturerId);

        icsEvents.push([
          "BEGIN:VEVENT",
          `UID:wellspring-lecture-${s.courseCode}-${i}@wellspring.edu.ng`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${dtstart}`,
          `DTEND:${dtend}`,
          `RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z`,
          `SUMMARY:CLASS: ${s.courseCode} - ${(s.courseTitle || '').replace(/,/g, '\\,')}`,
          `LOCATION:${(s.venueName || 'Classroom').replace(/,/g, '\\,')}`,
          `DESCRIPTION:Lecture with ${lec ? lec.name : 'Lecturer'}. Level: ${levelName}. Duration: ${s.duration}hr(s).`,
          "BEGIN:VALARM",
          "TRIGGER:-PT15M",
          "ACTION:DISPLAY",
          "DESCRIPTION:Lecture in 15 minutes",
          "END:VALARM",
          "END:VEVENT"
        ].join("\r\n"));
      });
    }

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Wellspring University//Timetable Master Companion//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Wellspring ${levelName} Schedule`,
      ...icsEvents,
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Wellspring_${levelName.replace(/[^a-zA-Z0-9]/g, "_")}_Calendar.ics`;
    link.click();
    URL.revokeObjectURL(url);
    showStudentToast("Calendar (.ics) downloaded! Open to sync to phone.");
  }

  function getNextDateForDay(dayName) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDay = days.indexOf(dayName);
    const date = new Date();
    const currentDay = date.getDay();
    let distance = (targetDay + 7 - currentDay) % 7;
    if (distance === 0) distance = 7; // next week if today
    date.setDate(date.getDate() + distance);
    return date;
  }

  function formatICalDate(date, hours, mins) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(hours).padStart(2, "0");
    const min = String(mins).padStart(2, "0");
    return `${y}${m}${d}T${h}${min}00`;
  }

  // --- SHARE COHORT LINK ---
  function shareCohortLink() {
    if (!selectedLevelId) {
      showStudentToast("Select a cohort first.");
      return;
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?level=${selectedLevelId}`;
    const level = store.state.levels.find(l => l.id === selectedLevelId);
    const title = level ? `Wellspring Timetable - ${level.name}` : "Wellspring Student Companion";

    if (navigator.share) {
      navigator.share({
        title,
        text: `Here is our official timetable for ${level ? level.name : 'our level'}:`,
        url: shareUrl
      }).catch(() => copyToClipboard(shareUrl));
    } else {
      copyToClipboard(shareUrl);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showStudentToast("Cohort link copied to clipboard!");
    }).catch(() => {
      showStudentToast("Could not copy link.");
    });
  }

  // --- COHORT PICKER MODAL ---
  function openCohortModal() {
    renderCohortModalList();
    modalCohortPicker.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => cohortSearchInput.focus(), 100);
  }

  function closeCohortModal() {
    modalCohortPicker.classList.add("hidden");
  }

  function renderCohortModalList() {
    const searchTerm = (cohortSearchInput.value || "").toLowerCase().trim();
    let list = store.state.levels;

    // Filter by college pill
    if (cohortFilterCollege !== "all") {
      list = list.filter(l => resolveEntityCollege(l, store).id === cohortFilterCollege);
    }

    // Filter by search keyword
    if (searchTerm) {
      list = list.filter(l => 
        l.name.toLowerCase().includes(searchTerm) || 
        (l.department && l.department.toLowerCase().includes(searchTerm)) ||
        (l.code && l.code.toLowerCase().includes(searchTerm))
      );
    }

    if (list.length === 0) {
      cohortModalList.innerHTML = `
        <div class="py-8 text-center text-slate-400 text-xs">
          <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <span>No academic cohorts match this filter.</span>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    cohortModalList.innerHTML = list.map(l => {
      const col = resolveEntityCollege(l, store);
      const isSelected = l.id === selectedLevelId;

      return `
        <div class="cohort-item p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected ? 'border-amber-400 bg-amber-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}" data-level-id="${l.id}">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-sm text-slate-900 truncate block">${l.name}</span>
              <span class="px-2 py-0.5 rounded ${col.badgeClass} font-bold text-[9px] flex-shrink-0">
                ${col.shortName}
              </span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5 truncate">${l.department || col.name} • ${l.size} Students</div>
          </div>
          <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-wellspring-navy text-amber-300' : 'bg-slate-100 text-slate-400'}">
            <i data-lucide="${isSelected ? 'check' : 'chevron-right'}" class="w-3.5 h-3.5"></i>
          </div>
        </div>
      `;
    }).join("");

    cohortModalList.querySelectorAll(".cohort-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-level-id");
        if (id) {
          selectedLevelId = id;
          localStorage.setItem("wellspring_student_cohort", id);
          updateCohortDisplay();
          renderStudentViews();
          closeCohortModal();
          showStudentToast(`Switched to ${item.querySelector('.font-extrabold').textContent}`);
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- NOTIFICATION TOAST HELPER ---
  function showStudentToast(msg) {
    const toast = document.getElementById("student-toast");
    const msgEl = document.getElementById("student-toast-msg");
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    toast.classList.remove("opacity-0", "pointer-events-none");
    toast.classList.add("opacity-100");
    setTimeout(() => {
      toast.classList.remove("opacity-100");
      toast.classList.add("opacity-0", "pointer-events-none");
    }, 2800);
  }

  // --- EVENT LISTENERS ---

  // Mode Switcher Buttons
  const btnModeLecture = document.getElementById("student-mode-lecture");
  const btnModeExam = document.getElementById("student-mode-exam");

  btnModeLecture?.addEventListener("click", () => {
    if (activeStudentMode === "lecture") return;
    activeStudentMode = "lecture";
    btnModeLecture.className = "py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all bg-wellspring-navy text-amber-300 shadow-sm";
    btnModeExam.className = "py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all text-slate-500 hover:text-slate-800";
    renderStudentViews();
    updateLiveHeroCard();
  });

  btnModeExam?.addEventListener("click", () => {
    if (activeStudentMode === "exam") return;
    activeStudentMode = "exam";
    btnModeExam.className = "py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all bg-wellspring-navy text-amber-300 shadow-sm";
    btnModeLecture.className = "py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all text-slate-500 hover:text-slate-800";
    renderStudentViews();
    updateLiveHeroCard();
  });

  // Day Selector Pills
  document.querySelectorAll(".student-day-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".student-day-pill").forEach(p => {
        p.className = "student-day-pill flex-1 py-2 px-3 rounded-xl font-semibold text-xs bg-white text-slate-700 border border-slate-200 text-center shadow-sm";
      });
      pill.className = "student-day-pill flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-wellspring-navy text-amber-300 border border-wellspring-navy text-center shadow-sm";
      activeTimelineDay = pill.getAttribute("data-day");
      renderStudentLectureTimeline();
    });
  });

  // Cohort Modal Openers & Closers
  document.getElementById("btn-open-cohort-picker")?.addEventListener("click", openCohortModal);
  document.getElementById("btn-empty-select-cohort")?.addEventListener("click", openCohortModal);
  document.getElementById("btn-close-cohort-modal")?.addEventListener("click", closeCohortModal);

  cohortSearchInput?.addEventListener("input", renderCohortModalList);

  document.querySelectorAll(".cohort-col-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cohort-col-filter").forEach(b => {
        b.className = "cohort-col-filter px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-200";
      });
      btn.className = "cohort-col-filter active px-2.5 py-1 rounded-lg text-xs font-bold bg-wellspring-navy text-amber-300";
      cohortFilterCollege = btn.getAttribute("data-col") || "all";
      renderCohortModalList();
    });
  });

  // Share & Export
  document.getElementById("btn-share-cohort")?.addEventListener("click", shareCohortLink);
  document.getElementById("btn-export-ical")?.addEventListener("click", exportCohortICal);

  // Close modal when tapping backdrop
  modalCohortPicker?.addEventListener("click", (e) => {
    if (e.target === modalCohortPicker) closeCohortModal();
  });

  // --- REAL-TIME CLOUD FIRESTORE SYNCHRONIZATION ---
  function setupCloudLiveSync() {
    if (!window.cloudSync) return;

    window.addEventListener("cloud-sync-status", (e) => {
      const status = e.detail?.status;
      const statusEl = document.getElementById("student-cloud-status");
      if (statusEl) {
        if (status === "online") {
          statusEl.className = "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
          statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>Live Cloud</span>`;
        } else {
          statusEl.className = "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-700/60 text-slate-300 border border-slate-600/50";
          statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span><span>Offline Cache</span>`;
        }
      }
    });

    window.cloudSync.subscribeToActiveSchedules(({ meta, activeLectureTimetable, activeExamTimetable, baseData }) => {
      let updated = false;

      if (baseData) {
        if (Array.isArray(baseData.levels) && baseData.levels.length > 0) {
          store.state.levels = baseData.levels;
          updated = true;
        }
        if (Array.isArray(baseData.courses) && baseData.courses.length > 0) {
          store.state.courses = baseData.courses;
          updated = true;
        }
        if (Array.isArray(baseData.venues) && baseData.venues.length > 0) {
          store.state.venues = baseData.venues;
          updated = true;
        }
        if (Array.isArray(baseData.lecturers) && baseData.lecturers.length > 0) {
          store.state.lecturers = baseData.lecturers;
          updated = true;
        }
        if (baseData.settings) {
          store.state.settings = { ...store.state.settings, ...baseData.settings };
          updated = true;
        }
      }

      if (activeLectureTimetable) {
        store.state.activeTimetable = activeLectureTimetable;
        updated = true;
      }

      if (activeExamTimetable) {
        store.state.activeExamTimetable = activeExamTimetable;
        updated = true;
      }

      if (updated) {
        store.save();

        if (!selectedLevelId && store.state.levels.length > 0) {
          selectedLevelId = store.state.levels[0].id;
          localStorage.setItem("wellspring_student_cohort", selectedLevelId);
        }

        const instTitle = store.state.settings?.institution || "Wellspring University";
        const sessionTitle = store.state.settings?.session || "2025/2026 Academic Session";
        const semTitle = store.state.settings?.semester || "First Semester";
        const sessionLabel = document.getElementById("student-session-label");
        if (sessionLabel) {
          sessionLabel.textContent = `${instTitle} • ${sessionTitle} • ${semTitle}`;
        }

        updateCohortDisplay();
        renderStudentViews();
        updateLiveHeroCard();

        showStudentToast("✨ Timetable updated live from Academic Planning!");
      }
    });
  }

  // Start App
  initStudentApp();
  setupCloudLiveSync();
});
