/**
 * Wellspring University Timetable Master - Mobile-First Application Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  const store = window.dataStore;
  const engine = window.timetableEngine;

  // DOM Elements
  const passcodeModal = document.getElementById("passcode-modal");
  const passcodeInput = document.getElementById("passcode-input");
  const passcodeBtn = document.getElementById("passcode-btn");
  const passcodeError = document.getElementById("passcode-error");
  const lockBtn = document.getElementById("btn-lock-app");

  // State
  let activeTab = "dashboard";
  let activeMode = store.getCurrentMode() || "lecture"; // 'lecture' | 'exam'
  let activeExamDay = "All";
  let activeTimetableViewMode = "college"; // 'college' | 'level' | 'venue' | 'lecturer' | 'master'
  let activeLecturerCollegeFilter = "all";
  let selectedFilterId = "all";
  let activeTimelineDay = "Monday";
  let timetableDisplayFormat = window.innerWidth < 768 ? "timeline" : "grid"; // Timeline default on mobile

  // Initialize Lucide Icons
  if (window.lucide) window.lucide.createIcons();

  // --- MODE SWITCHER (LECTURES vs EXAMS) ---
  function switchMode(mode, silent = false) {
    if (mode !== "lecture" && mode !== "exam") return;
    activeMode = mode;
    store.setMode(mode);

    // Update all mode buttons (desktop & mobile)
    document.querySelectorAll(".mode-switcher-btn").forEach(btn => {
      const btnMode = btn.getAttribute("data-mode");
      if (btnMode === mode) {
        btn.classList.add("active");
        btn.classList.remove("text-slate-400");
      } else {
        btn.classList.remove("active");
        btn.classList.add("text-slate-400");
      }
    });

    // Update Mode Badges & Labels
    const badge = document.getElementById("meta-mode-badge");
    if (badge) {
      badge.textContent = mode === "exam" ? "Examinations" : "Lectures";
    }

    const printSubtitle = document.getElementById("print-timetable-subtitle");
    if (printSubtitle) {
      printSubtitle.textContent = mode === "exam" 
        ? "Official Examination Timetable & Invigilation Docket"
        : "Master Lecture Timetable";
    }

    const runBtnTopText = document.getElementById("btn-run-engine-text");
    if (runBtnTopText) {
      runBtnTopText.textContent = mode === "exam" ? "Generate Exams" : "Generate";
    }

    const runBtnDashText = document.getElementById("btn-run-engine-dash-text");
    if (runBtnDashText) {
      runBtnDashText.textContent = mode === "exam" ? "Generate Exams" : "Generate";
    }

    // Toggle Exam Banner in Dashboard
    const examBanner = document.getElementById("exam-mode-banner");
    if (examBanner) {
      examBanner.classList.toggle("hidden", mode !== "exam");
    }

    renderDashboardStats();
    renderTimetableView();
    renderRulesView();

    if (window.lucide) window.lucide.createIcons();
    if (!silent) {
      showToast(mode === "exam" ? "Switched to Examination Mode" : "Switched to Lecture Mode", "info");
    }
  }

  document.querySelectorAll(".mode-switcher-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      if (mode && mode !== activeMode) {
        switchMode(mode);
      }
    });
  });

  document.getElementById("btn-quick-config-exams")?.addEventListener("click", () => {
    switchTab("rules");
    setTimeout(() => {
      document.getElementById("rules-exam-card")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  });

  // --- PASSCODE SECURITY ---
  function checkLockStatus() {
    const isUnlocked = sessionStorage.getItem("wellspring_unlocked") === "true";
    if (!isUnlocked) {
      passcodeModal.classList.remove("hidden");
      passcodeInput.value = "";
      passcodeError.classList.add("hidden");
      setTimeout(() => passcodeInput.focus(), 150);
    } else {
      passcodeModal.classList.add("hidden");
    }
  }

  function handleUnlock() {
    const entered = passcodeInput.value.trim();
    if (store.verifyPasscode(entered)) {
      sessionStorage.setItem("wellspring_unlocked", "true");
      passcodeModal.classList.add("hidden");
      passcodeError.classList.add("hidden");
      showToast("Access granted. Welcome to Timetable Master!", "success");
      renderAllViews();
    } else {
      passcodeError.classList.remove("hidden");
      passcodeInput.focus();
    }
  }

  passcodeBtn.addEventListener("click", handleUnlock);
  passcodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleUnlock();
  });

  lockBtn.addEventListener("click", () => {
    sessionStorage.removeItem("wellspring_unlocked");
    checkLockStatus();
    showToast("Application locked.", "info");
  });

  // --- TAB NAVIGATION (Top & Mobile Bottom Bar) ---
  const allNavButtons = document.querySelectorAll("[data-tab-target]");
  const tabPanes = document.querySelectorAll(".tab-pane");

  allNavButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.getAttribute("data-tab-target");
      switchTab(target);
    });
  });

  function switchTab(tabId) {
    activeTab = tabId;

    // Synchronize top pills
    document.querySelectorAll(".nav-pill").forEach((pill) => {
      const isCurrent = pill.getAttribute("data-tab-target") === tabId;
      if (isCurrent) {
        pill.classList.add("active");
        pill.classList.remove("text-slate-300");
      } else {
        pill.classList.remove("active");
        pill.classList.add("text-slate-300");
      }
    });



    tabPanes.forEach((pane) => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.remove("hidden");
      } else {
        pane.classList.add("hidden");
      }
    });

    // View-specific refreshes
    if (tabId === "timetable") renderTimetableView();
    if (tabId === "dashboard") renderDashboardStats();
    if (tabId === "courses") renderCoursesList();
    if (tabId === "venues") renderVenuesList();
    if (tabId === "levels") renderLevelsList();
    if (tabId === "lecturers") renderLecturersList();
    if (tabId === "rules") renderRulesView();
    if (tabId === "settings") renderSettingsView();

    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = "info") {
    const toast = document.getElementById("notification-toast");
    const msgEl = document.getElementById("toast-message");
    const iconEl = document.getElementById("toast-icon");

    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.className = "fixed bottom-16 md:bottom-5 right-3 left-3 sm:left-auto sm:right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-white font-medium text-xs sm:text-sm transition-all duration-300 transform translate-y-0 opacity-100";

    if (type === "success") {
      toast.classList.add("bg-emerald-600");
      iconEl.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 flex-shrink-0"></i>`;
    } else if (type === "error") {
      toast.classList.add("bg-rose-600");
      iconEl.innerHTML = `<i data-lucide="alert-octagon" class="w-5 h-5 flex-shrink-0"></i>`;
    } else {
      toast.classList.add("bg-slate-900");
      iconEl.innerHTML = `<i data-lucide="info" class="w-5 h-5 flex-shrink-0"></i>`;
    }

    if (window.lucide) window.lucide.createIcons();

    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-4");
    }, 3500);
  }

  // --- DASHBOARD & CHECKLIST WIZARD ---
  function renderDashboardStats() {
    const { venues, levels, lecturers, courses, activeTimetable, activeExamTimetable, settings, examSettings } = store.state;

    const dashTitle = document.getElementById("dash-title");
    const dashSubtitle = document.getElementById("dash-subtitle");
    const examBanner = document.getElementById("exam-mode-banner");
    const venuesLabel = document.getElementById("stat-venues-label");
    const levelsLabel = document.getElementById("stat-levels-label");
    const lecturersLabel = document.getElementById("stat-lecturers-label");
    const coursesLabel = document.getElementById("stat-courses-label");

    // Progress counter
    let completedSteps = 0;
    if (venues.length > 0) completedSteps++;
    if (levels.length > 0) completedSteps++;
    if (lecturers.length > 0) completedSteps++;
    if (courses.length > 0) completedSteps++;

    const badge = document.getElementById("setup-progress-badge");
    if (badge) {
      badge.textContent = `${completedSteps} / 4 Complete`;
      badge.className = completedSteps === 4 
        ? "text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"
        : "text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600";
    }

    const statusText = document.getElementById("timetable-status-text");
    const statusDot = document.getElementById("status-indicator-dot");
    const statusPill = document.getElementById("timetable-status-pill");
    const metricsContainer = document.getElementById("dashboard-metrics-container");

    if (activeMode === "exam") {
      if (dashTitle) dashTitle.textContent = "Exam Scheduling Overview";
      if (dashSubtitle) dashSubtitle.textContent = "Exam papers, spaced hall capacities & invigilator allocations.";
      if (examBanner) examBanner.classList.remove("hidden");

      if (venuesLabel) venuesLabel.textContent = "Exam Centers";
      if (levelsLabel) levelsLabel.textContent = "Candidate Levels";
      if (lecturersLabel) lecturersLabel.textContent = "Invigilator Pool";
      if (coursesLabel) coursesLabel.textContent = "Exam Papers";

      const factor = (examSettings && examSettings.spacingFactor) || 0.5;
      const totalSpacedSeats = venues.reduce((s, v) => s + Math.max(1, Math.floor(v.capacity * factor)), 0);
      const totalCandidates = levels.reduce((s, l) => s + (l.size || 0), 0);

      document.getElementById("stat-total-courses").textContent = courses.length;
      document.getElementById("stat-total-venues").textContent = venues.length;
      document.getElementById("stat-total-levels").textContent = levels.length;
      document.getElementById("stat-total-lecturers").textContent = lecturers.length;

      document.getElementById("check-status-venues").textContent = `${totalSpacedSeats} spaced seats`;
      document.getElementById("check-status-levels").textContent = `${totalCandidates} candidates`;
      document.getElementById("check-status-lecturers").textContent = `${lecturers.length} invigilators`;
      document.getElementById("check-status-courses").textContent = `${courses.length} papers`;

      if (activeExamTimetable && activeExamTimetable.scheduledExams && activeExamTimetable.scheduledExams.length > 0) {
        if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-emerald-500";
        if (statusPill) statusPill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold";
        if (statusText) statusText.textContent = `Exam Docket Active (${activeExamTimetable.scheduledExams.length} papers)`;

        if (metricsContainer) {
          metricsContainer.classList.remove("hidden");
          const mTitle = document.getElementById("dashboard-metrics-title");
          const mDesc = document.getElementById("dashboard-metrics-desc");
          const mLbl1 = document.getElementById("metric-label-1");
          const mLbl2 = document.getElementById("metric-label-2");
          const mLbl3 = document.getElementById("metric-label-3");
          if (mTitle) mTitle.textContent = "Examination Timetable Active";
          if (mDesc) mDesc.textContent = "All examination papers scheduled with invigilator assignments.";
          if (mLbl1) mLbl1.textContent = "Clashes";
          if (mLbl2) mLbl2.textContent = "Papers Scheduled";
          if (mLbl3) mLbl3.textContent = "Exam Window";
          document.getElementById("metric-clashes").textContent = "0";
          document.getElementById("metric-completion").textContent = `${activeExamTimetable.scheduledExams.length}`;
          document.getElementById("metric-utilization").textContent = `${examSettings.examWeeks || 3} Wks`;
        }
      } else {
        if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
        if (statusPill) statusPill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-semibold";
        if (statusText) statusText.textContent = courses.length > 0 ? "Ready to compute exams" : "Setup required";
        if (metricsContainer) metricsContainer.classList.add("hidden");
      }

    } else {
      // Lecture Mode
      if (dashTitle) dashTitle.textContent = "Lecture Scheduling Overview";
      if (dashSubtitle) dashSubtitle.textContent = "Academic scheduling status and entity summary.";
      if (examBanner) examBanner.classList.add("hidden");

      if (venuesLabel) venuesLabel.textContent = "Lecture Halls";
      if (levelsLabel) levelsLabel.textContent = "Student Levels";
      if (lecturersLabel) lecturersLabel.textContent = "Lecturers";
      if (coursesLabel) coursesLabel.textContent = "Courses";

      document.getElementById("stat-total-courses").textContent = courses.length;
      document.getElementById("stat-total-venues").textContent = venues.length;
      document.getElementById("stat-total-levels").textContent = levels.length;
      document.getElementById("stat-total-lecturers").textContent = lecturers.length;

      updateChecklistStep("venues", venues.length, "hall", "halls");
      updateChecklistStep("levels", levels.length, "level", "levels");
      updateChecklistStep("lecturers", lecturers.length, "lecturer", "lecturers");
      updateChecklistStep("courses", courses.length, "course", "courses");

      if (activeTimetable && activeTimetable.scheduledSessions && activeTimetable.scheduledSessions.length > 0) {
        if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-emerald-500";
        if (statusPill) statusPill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold";
        if (statusText) statusText.textContent = "Timetable Active (0 Clashes)";
        if (metricsContainer) {
          metricsContainer.classList.remove("hidden");
          const mTitle = document.getElementById("dashboard-metrics-title");
          const mDesc = document.getElementById("dashboard-metrics-desc");
          const mLbl1 = document.getElementById("metric-label-1");
          const mLbl2 = document.getElementById("metric-label-2");
          const mLbl3 = document.getElementById("metric-label-3");
          if (mTitle) mTitle.textContent = "Clash-Free Timetable Generated";
          if (mDesc) mDesc.textContent = "All course sessions placed with zero conflicts.";
          if (mLbl1) mLbl1.textContent = "Clashes";
          if (mLbl2) mLbl2.textContent = "Placed";
          if (mLbl3) mLbl3.textContent = "Hall Usage";
          const stats = activeTimetable.stats || {};
          document.getElementById("metric-clashes").textContent = "0";
          document.getElementById("metric-completion").textContent = `${stats.completionRate || 100}%`;
          document.getElementById("metric-utilization").textContent = `${stats.venueUtilization || 0}%`;
        }
      } else {
        if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
        if (statusPill) statusPill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-semibold";
        if (statusText) {
          statusText.textContent = completedSteps < 2 ? "Setup required" : "Ready to generate";
        }
        if (metricsContainer) metricsContainer.classList.add("hidden");
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function updateChecklistStep(stepKey, count, singular, plural) {
    const icon = document.getElementById(`check-icon-${stepKey}`);
    const text = document.getElementById(`check-status-${stepKey}`);
    if (!icon || !text) return;

    if (count > 0) {
      icon.className = "w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold";
      icon.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i>`;
      text.textContent = `${count} ${count === 1 ? singular : plural} added`;
      text.className = "text-[11px] font-semibold text-emerald-600 mt-0.5";
    } else {
      icon.className = "w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] font-bold";
      icon.innerHTML = "0";
      text.textContent = "0 added";
      text.className = "text-[11px] text-slate-400 mt-0.5";
    }
  }

  // Dashboard Quick Add Buttons
  document.querySelector(".btn-quick-add-venue")?.addEventListener("click", () => {
    openAddVenueModal();
  });
  document.querySelector(".btn-quick-add-level")?.addEventListener("click", () => {
    openAddLevelModal();
  });
  document.querySelector(".btn-quick-add-lecturer")?.addEventListener("click", () => {
    openAddLecturerModal();
  });
  document.querySelector(".btn-quick-add-course")?.addEventListener("click", () => {
    openAddCourseModal();
  });
  document.getElementById("btn-view-generated-timetable")?.addEventListener("click", () => {
    switchTab("timetable");
  });

  // --- SOLVER ENGINE TRIGGERS (LECTURES & EXAMS) ---
  const btnRunEngine = document.getElementById("btn-run-engine");
  const btnRunEngineDash = document.getElementById("btn-run-engine-dash");
  const solverModal = document.getElementById("solver-modal");
  const solverProgress = document.getElementById("solver-progress-bar");
  const solverStatus = document.getElementById("solver-status-text");

  function handleGenerateClick() {
    if (activeMode === "exam") {
      triggerExamGeneration();
    } else {
      triggerTimetableGeneration();
    }
  }

  async function triggerTimetableGeneration() {
    if (store.state.courses.length === 0 || store.state.venues.length === 0) {
      showToast("Please add at least one lecture hall and one course first.", "error");
      switchTab("courses");
      return;
    }

    solverModal.classList.remove("hidden");
    solverProgress.style.width = "15%";
    solverStatus.textContent = "Checking venue capacities and schedules...";

    try {
      const result = await engine.solve(store.state, (percent, msg) => {
        solverProgress.style.width = `${percent}%`;
        solverStatus.textContent = msg;
      });

      store.state.activeTimetable = result;
      store.save();

      setTimeout(() => {
        solverModal.classList.add("hidden");
        showToast("Success! Lecture timetable generated with 0 clashes.", "success");
        switchTab("timetable");

        if (window.confetti) {
          window.confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        }
      }, 400);

    } catch (err) {
      solverModal.classList.add("hidden");
      showToast(err.message || "Failed to generate timetable.", "error");
    }
  }

  async function triggerExamGeneration() {
    if (store.state.courses.length === 0 || store.state.venues.length === 0) {
      showToast("Please add at least one exam hall and one course first.", "error");
      switchTab("courses");
      return;
    }

    solverModal.classList.remove("hidden");
    solverProgress.style.width = "25%";
    solverStatus.textContent = "Computing 50% spaced seating and invigilator rosters...";

    try {
      const result = await window.examEngine.solve();

      if (!result.success) {
        solverModal.classList.add("hidden");
        showToast(result.message || "Could not place all exam papers. Check hall sizes.", "error");
        return;
      }

      store.state.activeExamTimetable = result;
      store.save();

      solverProgress.style.width = "100%";
      solverStatus.textContent = "Exam schedule optimized!";

      setTimeout(() => {
        solverModal.classList.add("hidden");
        showToast(`Success! ${result.placedCount} exam papers scheduled with 50% spaced seating.`, "success");
        switchTab("timetable");

        if (window.confetti) {
          window.confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        }
      }, 400);

    } catch (err) {
      solverModal.classList.add("hidden");
      showToast(err.message || "Failed to generate exam timetable.", "error");
    }
  }

  if (btnRunEngine) btnRunEngine.addEventListener("click", handleGenerateClick);
  if (btnRunEngineDash) btnRunEngineDash.addEventListener("click", handleGenerateClick);

  // --- TIMETABLE VIEW FORMAT TOGGLE & FILTERS ---
  const btnToggleTimeline = document.getElementById("btn-toggle-timeline");
  const btnToggleGrid = document.getElementById("btn-toggle-grid");
  const timetableViewModeSelect = document.getElementById("timetable-view-mode");
  const timetableFilterSelect = document.getElementById("timetable-filter-select");
  const timetableContainer = document.getElementById("timetable-grid-container");
  const dayPillsBar = document.getElementById("day-pills-bar");

  btnToggleTimeline?.addEventListener("click", () => {
    timetableDisplayFormat = "timeline";
    updateFormatToggleUI();
    renderTimetableView();
  });

  btnToggleGrid?.addEventListener("click", () => {
    timetableDisplayFormat = "grid";
    updateFormatToggleUI();
    renderTimetableView();
  });

  function updateFormatToggleUI() {
    if (timetableDisplayFormat === "timeline") {
      btnToggleTimeline.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-wellspring-navy shadow-sm transition-all flex items-center gap-1.5";
      btnToggleGrid.className = "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5";
      dayPillsBar.classList.remove("hidden");
    } else {
      btnToggleGrid.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-wellspring-navy shadow-sm transition-all flex items-center gap-1.5";
      btnToggleTimeline.className = "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5";
      dayPillsBar.classList.add("hidden");
    }
  }

  // Day pills click
  document.querySelectorAll(".day-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".day-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeTimelineDay = pill.getAttribute("data-day");
      renderTimetableView();
    });
  });

  timetableViewModeSelect?.addEventListener("change", (e) => {
    activeTimetableViewMode = e.target.value;
    updateTimetableFilterDropdown();
    renderTimetableView();
  });

  timetableFilterSelect?.addEventListener("change", (e) => {
    selectedFilterId = e.target.value;
    renderTimetableView();
  });

  function isSessionInCollege(s, collegeId) {
    if (!collegeId || collegeId === "all") return true;
    // 1. Check if any level in s.levelIds belongs to this college
    if (Array.isArray(s.levelIds) && s.levelIds.length > 0) {
      const matchLvl = s.levelIds.some(lid => {
        const lvl = store.state.levels.find(l => l.id === lid);
        return lvl && resolveEntityCollege(lvl, store).id === collegeId;
      });
      if (matchLvl) return true;
    }
    // 2. Check course
    const crs = store.state.courses.find(c => c.id === s.courseId || c.code === s.courseCode);
    if (crs && resolveEntityCollege(crs, store).id === collegeId) return true;
    // 3. Check lecturer
    const lec = store.state.lecturers.find(l => l.id === s.lecturerId);
    if (lec && resolveEntityCollege(lec, store).id === collegeId) return true;
    // 4. Check invigilators if in exam mode
    if (Array.isArray(s.invigilatorIds) && s.invigilatorIds.length > 0) {
      const matchInv = s.invigilatorIds.some(iid => {
        const inv = store.state.lecturers.find(l => l.id === iid);
        return inv && resolveEntityCollege(inv, store).id === collegeId;
      });
      if (matchInv) return true;
    }
    return false;
  }

  function updateTimetableFilterDropdown() {
    timetableFilterSelect.innerHTML = "";
    selectedFilterId = "all";

    const optAll = document.createElement("option");
    optAll.value = "all";

    if (activeTimetableViewMode === "college") {
      optAll.textContent = "— All Colleges (University-Wide) —";
      timetableFilterSelect.appendChild(optAll);
      const colleges = store.getColleges();
      colleges.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col.id;
        opt.textContent = `${col.name} (${col.code})`;
        timetableFilterSelect.appendChild(opt);
      });
    } else if (activeTimetableViewMode === "level") {
      optAll.textContent = "— All Levels & Departments —";
      timetableFilterSelect.appendChild(optAll);
      store.state.levels.forEach((lvl) => {
        const opt = document.createElement("option");
        opt.value = lvl.id;
        opt.textContent = `${lvl.name} (${lvl.size} std)`;
        timetableFilterSelect.appendChild(opt);
      });
    } else if (activeTimetableViewMode === "venue") {
      optAll.textContent = "— All Venues & Halls —";
      timetableFilterSelect.appendChild(optAll);
      store.state.venues.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.name} (Cap: ${v.capacity})`;
        timetableFilterSelect.appendChild(opt);
      });
    } else if (activeTimetableViewMode === "lecturer") {
      optAll.textContent = "— All Lecturers —";
      timetableFilterSelect.appendChild(optAll);
      store.state.lecturers.forEach((lec) => {
        const opt = document.createElement("option");
        opt.value = lec.id;
        opt.textContent = `${lec.name} (${lec.department})`;
        timetableFilterSelect.appendChild(opt);
      });
    } else {
      optAll.textContent = "Master Matrix (All)";
      timetableFilterSelect.appendChild(optAll);
    }
  }

  // --- TIMETABLE ACTION BUTTON STATES & DELETION ---
  function updateTimetableActionButtons() {
    const hasTimetable = activeMode === "exam"
      ? Boolean(store.state.activeExamTimetable && store.state.activeExamTimetable.scheduledExams && store.state.activeExamTimetable.scheduledExams.length > 0)
      : Boolean(store.state.activeTimetable && store.state.activeTimetable.scheduledSessions && store.state.activeTimetable.scheduledSessions.length > 0);

    const btnDelete = document.getElementById("btn-delete-timetable");
    const btnExcel = document.getElementById("btn-export-excel");
    const btnPrint = document.getElementById("btn-print-timetable");
    const btnPublish = document.getElementById("btn-publish-cloud");
    const btnPublishDash = document.getElementById("btn-publish-cloud-dash");

    [btnDelete, btnExcel, btnPrint, btnPublish, btnPublishDash].forEach(btn => {
      if (!btn) return;
      if (!hasTimetable) {
        btn.classList.add("opacity-40", "pointer-events-none");
        btn.setAttribute("disabled", "true");
      } else {
        btn.classList.remove("opacity-40", "pointer-events-none");
        btn.removeAttribute("disabled");
      }
    });
  }

  function deleteGeneratedTimetable() {
    const isExam = (activeMode === "exam");
    const hasTimetable = isExam
      ? Boolean(store.state.activeExamTimetable && store.state.activeExamTimetable.scheduledExams && store.state.activeExamTimetable.scheduledExams.length > 0)
      : Boolean(store.state.activeTimetable && store.state.activeTimetable.scheduledSessions && store.state.activeTimetable.scheduledSessions.length > 0);

    if (!hasTimetable) {
      showToast(`No generated ${isExam ? 'examination' : 'lecture'} timetable to delete.`, "info");
      return;
    }

    const typeLabel = isExam ? "Examination Timetable" : "Lecture Timetable";
    const entityNotice = isExam
      ? "All courses, examination halls, student levels, and invigilator data will remain safely preserved."
      : "All courses, lecture halls, student levels, and lecturers will remain safely preserved.";

    const confirmed = confirm(`Are you sure you want to delete the active ${typeLabel}?\n\n${entityNotice}`);
    if (confirmed) {
      if (isExam) {
        store.deleteActiveExamTimetable();
        showToast("Examination timetable deleted. Base data preserved.", "success");
      } else {
        store.deleteActiveTimetable();
        showToast("Lecture timetable deleted. Base data preserved.", "success");
      }
      renderDashboardStats();
      renderTimetableView();
    }
  }

  document.getElementById("btn-delete-timetable")?.addEventListener("click", deleteGeneratedTimetable);
  document.getElementById("btn-delete-dashboard-timetable")?.addEventListener("click", deleteGeneratedTimetable);

  // --- GOOGLE CLOUD FIRESTORE INTEGRATION ---
  async function handleCloudPublish() {
    const isExam = (activeMode === "exam");
    const currentTT = isExam ? store.state.activeExamTimetable : store.state.activeTimetable;
    const hasTimetable = isExam
      ? Boolean(currentTT && currentTT.scheduledExams && currentTT.scheduledExams.length > 0)
      : Boolean(currentTT && currentTT.scheduledSessions && currentTT.scheduledSessions.length > 0);

    if (!hasTimetable) {
      showToast(`No generated ${isExam ? 'examination' : 'lecture'} timetable to publish.`, "error");
      return;
    }

    if (!window.cloudSync) {
      showToast("Cloud service is initializing, please try again in a moment.", "info");
      return;
    }

    const btnPublish = document.getElementById("btn-publish-cloud");
    const btnPublishDash = document.getElementById("btn-publish-cloud-dash");
    const originalText = btnPublish ? btnPublish.innerHTML : "";

    try {
      if (btnPublish) {
        btnPublish.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Publishing...</span>`;
        btnPublish.classList.add("pointer-events-none");
      }
      if (btnPublishDash) {
        btnPublishDash.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Publishing...</span>`;
        btnPublishDash.classList.add("pointer-events-none");
      }
      if (window.lucide) window.lucide.createIcons();

      // Ensure ID and metadata are explicitly attached
      const ttToPublish = {
        ...currentTT,
        id: currentTT.id || `tt_${activeMode}_${Date.now()}`,
        mode: activeMode,
        session: store.state.settings?.session || "2025/2026",
        semester: store.state.settings?.semester || "First Semester",
        institution: store.state.settings?.institution || "Wellspring University"
      };

      await window.cloudSync.publishTimetable(ttToPublish, store.state);

      showToast(`🎉 Success! ${isExam ? 'Exam' : 'Lecture'} timetable published to Wellspring Cloud! Students now have instant access.`, "success");

      if (window.confetti) {
        window.confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      }
    } catch (err) {
      console.error("Cloud publish error:", err);
      showToast(`Cloud Publish Failed: ${err.message || 'Check network connection'}`, "error");
    } finally {
      if (btnPublish) {
        btnPublish.innerHTML = originalText;
        btnPublish.classList.remove("pointer-events-none");
      }
      if (btnPublishDash) {
        btnPublishDash.innerHTML = `<i data-lucide="cloud-upload" class="w-3.5 h-3.5 text-amber-300"></i><span class="hidden sm:inline">Publish to Cloud</span><span class="sm:hidden">Publish</span>`;
        btnPublishDash.classList.remove("pointer-events-none");
      }
      if (window.lucide) window.lucide.createIcons();
    }
  }

  document.getElementById("btn-publish-cloud")?.addEventListener("click", handleCloudPublish);
  document.getElementById("btn-publish-cloud-dash")?.addEventListener("click", handleCloudPublish);

  // Settings Tab: Push Catalog to Cloud
  document.getElementById("btn-cloud-push-catalog")?.addEventListener("click", async () => {
    if (!window.cloudSync) {
      showToast("Cloud sync service is not ready.", "error");
      return;
    }
    try {
      showToast("Uploading institutional catalog to Firestore...", "info");
      await window.cloudSync.pushBaseData(store.state);
      showToast("✅ Institutional catalog (courses, halls, lecturers) synced to Cloud!", "success");
    } catch (err) {
      showToast(`Push failed: ${err.message}`, "error");
    }
  });

  // Settings Tab: Pull Catalog from Cloud
  document.getElementById("btn-cloud-pull-catalog")?.addEventListener("click", async () => {
    if (!window.cloudSync) {
      showToast("Cloud sync service is not ready.", "error");
      return;
    }
    if (!confirm("This will merge/update your courses, halls, lecturers, and levels with the cloud database. Continue?")) {
      return;
    }
    try {
      showToast("Fetching catalog from Firestore...", "info");
      const cloudData = await window.cloudSync.pullBaseData();
      if (!cloudData) {
        showToast("No catalog data found in cloud yet.", "info");
        return;
      }
      if (Array.isArray(cloudData.courses)) store.state.courses = cloudData.courses;
      if (Array.isArray(cloudData.venues)) store.state.venues = cloudData.venues;
      if (Array.isArray(cloudData.lecturers)) store.state.lecturers = cloudData.lecturers;
      if (Array.isArray(cloudData.levels)) store.state.levels = cloudData.levels;
      if (cloudData.settings) store.state.settings = { ...store.state.settings, ...cloudData.settings };
      store.save();
      renderAllViews();
      showToast("✅ Catalog successfully updated from Wellspring Cloud!", "success");
    } catch (err) {
      showToast(`Pull failed: ${err.message}`, "error");
    }
  });

  // Listen for Cloud Sync status changes
  window.addEventListener("cloud-sync-status", (e) => {
    const status = e.detail?.status;
    const badge = document.getElementById("cloud-status-badge");
    const label = document.getElementById("cloud-status-label");
    const settingsPill = document.getElementById("settings-cloud-pill");

    if (status === "online") {
      if (badge) badge.className = "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm";
      if (label) label.textContent = "Cloud Sync";
      if (settingsPill) {
        settingsPill.className = "px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5";
        settingsPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>Connected</span>`;
      }
    } else {
      if (badge) badge.className = "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-500/15 border border-slate-500/30 text-slate-300 text-xs font-semibold shadow-sm";
      if (label) label.textContent = "Offline Mode";
      if (settingsPill) {
        settingsPill.className = "px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5";
        settingsPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>Local / Offline</span>`;
      }
    }
  });

  // --- RENDER TIMETABLE (LECTURE TIMELINE/MATRIX OR EXAM DOCKET) ---
  function renderTimetableView() {
    updateTimetableActionButtons();

    if (activeMode === "exam") {
      renderExamDocketView();
      return;
    }

    const timetable = store.state.activeTimetable;
    const settings = store.state.settings;
    const slots = settings.slots || DEFAULT_SLOTS;

    // Reset day pills to weekly lecture days if in lecture mode
    dayPillsBar.classList.remove("hidden");
    dayPillsBar.innerHTML = `
      <button class="day-pill ${activeTimelineDay === 'Monday' ? 'active' : ''}" data-day="Monday">Monday</button>
      <button class="day-pill ${activeTimelineDay === 'Tuesday' ? 'active' : ''}" data-day="Tuesday">Tuesday</button>
      <button class="day-pill ${activeTimelineDay === 'Wednesday' ? 'active' : ''}" data-day="Wednesday">Wednesday</button>
      <button class="day-pill ${activeTimelineDay === 'Thursday' ? 'active' : ''}" data-day="Thursday">Thursday</button>
      <button class="day-pill ${activeTimelineDay === 'Friday' ? 'active' : ''}" data-day="Friday">Friday</button>
    `;

    dayPillsBar.querySelectorAll(".day-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        dayPillsBar.querySelectorAll(".day-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        activeTimelineDay = pill.getAttribute("data-day");
        renderTimetableView();
      });
    });

    // Check if empty
    if (!timetable || !timetable.scheduledSessions || timetable.scheduledSessions.length === 0) {
      timetableContainer.innerHTML = `
        <div class="py-12 sm:py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
          <h4 class="text-base font-extrabold text-slate-900">No Lecture Timetable Generated Yet</h4>
          <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            ${store.state.courses.length === 0 ? 'Add courses and halls first, then generate.' : 'Click "Generate Timetable" to compute a clash-free schedule.'}
          </p>
          <button id="btn-empty-gen" class="px-5 py-2.5 bg-wellspring-navy text-amber-300 rounded-xl font-bold text-xs shadow-md">
            Generate Now
          </button>
        </div>
      `;
      document.getElementById("btn-empty-gen")?.addEventListener("click", triggerTimetableGeneration);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (timetableDisplayFormat === "timeline") {
      renderTimelineFeed(timetable, slots, settings);
    } else {
      renderMatrixGrid(timetable, slots, settings);
    }

    // Attach card inspector events
    document.querySelectorAll(".session-card, .timeline-session-item").forEach(card => {
      card.addEventListener("click", () => {
        const sessId = card.getAttribute("data-session-id");
        if (sessId) openSessionInspector(sessId);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- EXAM TIMETABLE DOCKET RENDERER ---
  function renderExamDocketView() {
    updateTimetableActionButtons();
    const examTimetable = store.state.activeExamTimetable;

    if (!examTimetable || !examTimetable.scheduledExams || examTimetable.scheduledExams.length === 0) {
      dayPillsBar.classList.add("hidden");
      timetableContainer.innerHTML = `
        <div class="py-12 sm:py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-3">
            <i data-lucide="file-check-2" class="w-6 h-6"></i>
          </div>
          <h4 class="text-base font-extrabold text-slate-900">No Examination Timetable Computed Yet</h4>
          <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            ${store.state.courses.length === 0 ? 'Add courses and halls first, then compute.' : 'Click "Generate Exams" to compute spaced seating & invigilator allocations.'}
          </p>
          <button id="btn-empty-exam-gen" class="px-5 py-2.5 bg-wellspring-navy text-amber-300 rounded-xl font-bold text-xs shadow-md">
            Generate Exam Timetable
          </button>
        </div>
      `;
      document.getElementById("btn-empty-exam-gen")?.addEventListener("click", triggerExamGeneration);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let exams = examTimetable.scheduledExams;

    // Apply entity filtering
    if (selectedFilterId !== "all") {
      if (activeTimetableViewMode === "college") {
        exams = exams.filter(e => isSessionInCollege(e, selectedFilterId));
      } else if (activeTimetableViewMode === "level") {
        exams = exams.filter(e => (e.levelIds || []).includes(selectedFilterId));
      } else if (activeTimetableViewMode === "venue") {
        exams = exams.filter(e => e.venueId === selectedFilterId);
      } else if (activeTimetableViewMode === "lecturer") {
        exams = exams.filter(e => (e.invigilatorIds || []).includes(selectedFilterId));
      }
    }

    const uniqueDays = Array.from(new Set(examTimetable.scheduledExams.map(e => e.day)));

    // Render exam day pills
    dayPillsBar.classList.remove("hidden");
    dayPillsBar.innerHTML = `
      <button class="day-pill ${activeExamDay === 'All' ? 'active' : ''}" data-exam-day="All">All Days</button>
      ${uniqueDays.map(d => `
        <button class="day-pill ${activeExamDay === d ? 'active' : ''}" data-exam-day="${d}">
          ${d}
        </button>
      `).join("")}
    `;

    dayPillsBar.querySelectorAll("[data-exam-day]").forEach(btn => {
      btn.addEventListener("click", () => {
        dayPillsBar.querySelectorAll("[data-exam-day]").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        activeExamDay = btn.getAttribute("data-exam-day");
        renderTimetableView();
      });
    });

    // Group exams by Day
    const daysToRender = activeExamDay === "All" ? uniqueDays : [activeExamDay];

    let html = `<div class="space-y-6">`;

    daysToRender.forEach(dayName => {
      const dayExams = exams.filter(e => e.day === dayName);
      if (activeExamDay === "All" && dayExams.length === 0) return;

      const morningExams = dayExams.filter(e => e.sessionLabel?.includes("Morning") || e.time?.includes("09:00"));
      const afternoonExams = dayExams.filter(e => e.sessionLabel?.includes("Afternoon") || e.time?.includes("14:00"));

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-amber-400/30">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <h3 class="font-bold text-xs sm:text-sm uppercase tracking-wider">${dayName}</h3>
            </div>
            <span class="text-[11px] text-amber-300 font-semibold">${dayExams.length} papers</span>
          </div>

          <div class="p-4 sm:p-5 space-y-5">
            <!-- Morning Session -->
            <div>
              <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <span class="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <i data-lucide="sun" class="w-3.5 h-3.5 text-amber-500"></i>
                  Morning Session (09:00 - 12:00)
                </span>
                <span class="text-[10px] text-slate-400 font-medium">${morningExams.length} scheduled</span>
              </div>
              ${renderExamSessionCards(morningExams)}
            </div>

            <!-- Afternoon Session -->
            <div>
              <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <span class="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <i data-lucide="sunset" class="w-3.5 h-3.5 text-orange-500"></i>
                  Afternoon Session (14:00 - 17:00)
                </span>
                <span class="text-[10px] text-slate-400 font-medium">${afternoonExams.length} scheduled</span>
              </div>
              ${renderExamSessionCards(afternoonExams)}
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    timetableContainer.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderExamSessionCards(examList) {
    if (examList.length === 0) {
      return `
        <div class="py-3 px-4 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs text-center">
          — No exams scheduled in this session —
        </div>
      `;
    }

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${examList.map(e => {
          const lvlNames = (e.levelIds || []).map(id => {
            const l = store.state.levels.find(lvl => lvl.id === id);
            return l ? l.name : id;
          }).join(", ");

          const invNames = (e.invigilatorNames && e.invigilatorNames.length > 0)
            ? e.invigilatorNames.join(" & ")
            : "To be assigned";

          const examCol = resolveEntityCollege(e, store);

          return `
            <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition-all shadow-sm space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-2 py-0.5 rounded font-black text-xs bg-wellspring-navy text-amber-300">${e.courseCode}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full badge-exam-spacing flex items-center gap-1">
                      <i data-lucide="shield-check" class="w-3 h-3"></i> 50% Spaced
                    </span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded ${examCol.badgeClass}">
                      ${examCol.shortName}
                    </span>
                  </div>
                  <h4 class="font-bold text-xs sm:text-sm text-slate-900 mt-1">${e.courseTitle}</h4>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                  ${e.units || 2} Units
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-200/60">
                <div class="flex items-center gap-1.5">
                  <i data-lucide="building" class="w-3.5 h-3.5 text-purple-600 flex-shrink-0"></i>
                  <span class="truncate"><strong>${e.venueName}</strong> (${e.candidateCount} / ${e.effectiveCapacity} seats)</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <i data-lucide="graduation-cap" class="w-3.5 h-3.5 text-emerald-600 flex-shrink-0"></i>
                  <span class="truncate">${lvlNames} (${e.candidateCount} std)</span>
                </div>
              </div>

              <div class="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] flex items-center gap-2 text-slate-700">
                <i data-lucide="user-check" class="w-4 h-4 text-blue-600 flex-shrink-0"></i>
                <div class="truncate">
                  <span class="text-slate-400 font-semibold">Invigilators:</span>
                  <span class="font-bold ml-1 text-slate-800">${invNames}</span>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // 1. Mobile-First Timeline Feed
  function renderTimelineFeed(timetable, slots, settings) {
    const day = activeTimelineDay;
    const sessions = timetable.scheduledSessions.filter(s => s.day === day);

    // Apply Filter
    const filteredSessions = sessions.filter(s => {
      if (selectedFilterId === "all") return true;
      if (activeTimetableViewMode === "college") return isSessionInCollege(s, selectedFilterId);
      if (activeTimetableViewMode === "level") return (s.levelIds || []).includes(selectedFilterId);
      if (activeTimetableViewMode === "venue") return s.venueId === selectedFilterId;
      if (activeTimetableViewMode === "lecturer") return s.lecturerId === selectedFilterId;
      return true;
    });

    let html = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div>
            <h3 class="font-extrabold text-slate-900 text-sm sm:text-base uppercase tracking-wide flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              ${day} Schedule
            </h3>
            <span class="text-[11px] text-slate-500">${filteredSessions.length} sessions scheduled</span>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">Timeline Feed</span>
        </div>

        <div class="space-y-3">
    `;

    slots.forEach((slot, sIdx) => {
      // Check if blocked (Chapel)
      const blocked = (settings.blockedSlots || []).find(b => b.day === day && b.slotId === sIdx);

      // Find sessions starting or continuing in this slot
      const startingSessions = filteredSessions.filter(s => s.startSlot === sIdx);
      const continuingSessions = filteredSessions.filter(s => sIdx > s.startSlot && sIdx <= s.endSlot);

      html += `
        <div class="timeline-slot-card p-3 sm:p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              ${slot.label}
            </span>
            <span class="text-[10px] text-slate-400 font-medium">${slot.time}</span>
          </div>
      `;

      if (blocked) {
        html += `
          <div class="cell-blocked p-3 rounded-xl border border-dashed border-slate-300 text-center flex items-center justify-center gap-2">
            <i data-lucide="shield-alert" class="w-4 h-4 text-amber-600 flex-shrink-0"></i>
            <span class="text-xs font-bold text-slate-700">${blocked.reason}</span>
          </div>
        `;
      } else if (startingSessions.length > 0) {
        startingSessions.forEach(sess => {
          const lec = store.state.lecturers.find(l => l.id === sess.lecturerId);
          const venue = store.state.venues.find(v => v.id === sess.venueId);
          const crs = store.state.courses.find(c => c.id === sess.courseId || c.code === sess.courseCode);
          const sessCol = resolveEntityCollege(crs || sess, store);
          const lvlNames = (sess.levelIds || []).map(id => {
            const l = store.state.levels.find(lvl => lvl.id === id);
            return l ? l.name : id;
          }).join(", ");

          html += `
            <div class="timeline-session-item p-3.5 rounded-xl text-white cursor-pointer transition-transform active:scale-98 shadow-sm" style="background-color: ${sess.color};" data-session-id="${sess.sessionId}">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-black text-sm tracking-wide block">${sess.courseCode}</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/25 text-amber-200">
                      ${sessCol.shortName}
                    </span>
                  </div>
                  <span class="text-xs font-medium opacity-95 block mt-0.5">${sess.courseTitle}</span>
                </div>
                <span class="text-[10px] font-bold bg-black/25 px-2 py-0.5 rounded-full flex-shrink-0">
                  ${sess.duration} Hour${sess.duration > 1 ? 's' : ''}
                </span>
              </div>

              <div class="mt-3 pt-2 border-t border-white/20 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-1.5 opacity-90">
                <div class="flex items-center gap-1.5">
                  <i data-lucide="map-pin" class="w-3.5 h-3.5 flex-shrink-0"></i>
                  <span class="font-semibold truncate">${venue ? venue.name : sess.venueCode}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <i data-lucide="user" class="w-3.5 h-3.5 flex-shrink-0"></i>
                  <span class="truncate">${lec ? lec.name : 'Lecturer Unassigned'}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <i data-lucide="users" class="w-3.5 h-3.5 flex-shrink-0"></i>
                  <span class="truncate">${lvlNames} (${sess.totalStudents} std)</span>
                </div>
              </div>
            </div>
          `;
        });
      } else if (continuingSessions.length > 0) {
        continuingSessions.forEach(sess => {
          html += `
            <div class="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-center justify-between" data-session-id="${sess.sessionId}">
              <span class="font-bold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" style="background-color: ${sess.color};"></span>
                ${sess.courseCode} (Continuing lecture block)
              </span>
              <span class="text-slate-400 text-[10px]">${sess.venueName}</span>
            </div>
          `;
        });
      } else {
        html += `
          <div class="py-2.5 px-3 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs text-center">
            — Free Period —
          </div>
        `;
      }

      html += `</div>`;
    });

    html += `</div></div>`;
    timetableContainer.innerHTML = html;
  }

  // 2. Full Matrix Grid View (Responsive Scrollable Table)
  function renderMatrixGrid(timetable, slots, settings) {
    const days = settings.days || DEFAULT_DAYS;

    let rows = [];
    if (activeTimetableViewMode === "college") {
      rows = selectedFilterId === "all"
        ? store.state.levels
        : store.state.levels.filter(l => resolveEntityCollege(l, store).id === selectedFilterId);
    } else if (activeTimetableViewMode === "level") {
      rows = selectedFilterId === "all" ? store.state.levels : store.state.levels.filter(l => l.id === selectedFilterId);
    } else if (activeTimetableViewMode === "venue" || activeTimetableViewMode === "master") {
      rows = selectedFilterId === "all" ? store.state.venues : store.state.venues.filter(v => v.id === selectedFilterId);
    } else if (activeTimetableViewMode === "lecturer") {
      rows = selectedFilterId === "all" ? store.state.lecturers : store.state.lecturers.filter(l => l.id === selectedFilterId);
    }

    let html = `<div class="space-y-6">`;

    days.forEach((day) => {
      html += `
        <div class="timetable-grid-wrapper">
          <div class="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-amber-400/30">
            <h3 class="text-xs sm:text-sm font-bold tracking-wide uppercase flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              ${day}
            </h3>
            <span class="text-[10px] text-slate-300">${settings.session}</span>
          </div>

          <table class="timetable-table text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th class="sticky-col-header text-left py-2 px-3 text-[11px] uppercase tracking-wider text-slate-500">
                  ${activeTimetableViewMode === "college" || activeTimetableViewMode === "level" ? "Cohort / Level" : activeTimetableViewMode === "venue" || activeTimetableViewMode === "master" ? "Venue" : "Lecturer"}
                </th>
      `;

      slots.forEach((slot) => {
        html += `
          <th class="text-center py-2 px-2 text-[11px] min-w-[120px]">
            <div>${slot.time}</div>
            <div class="text-[9px] text-slate-400 font-normal">${slot.label}</div>
          </th>
        `;
      });

      html += `</tr></thead><tbody class="divide-y divide-slate-100">`;

      rows.forEach((rowItem) => {
        html += `
          <tr>
            <td class="sticky-col-header py-2.5 px-3 bg-slate-50 text-slate-900 font-bold">
              <div>${rowItem.name || rowItem.code}</div>
              <div class="text-[9px] text-slate-400 font-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                ${(activeTimetableViewMode === "college" || activeTimetableViewMode === "level") ? `
                  <span class="px-1.5 py-0.2 rounded font-bold ${resolveEntityCollege(rowItem, store).badgeClass}">
                    ${resolveEntityCollege(rowItem, store).code}
                  </span>
                  <span>${rowItem.size || 0} std</span>
                ` : ''}
                ${(activeTimetableViewMode === "venue" || activeTimetableViewMode === "master") ? `Cap: ${rowItem.capacity}` : ''}
                ${activeTimetableViewMode === "lecturer" ? `Max ${rowItem.maxHoursPerDay || 4}h/day` : ''}
              </div>
            </td>
        `;

        let skipSlots = 0;

        for (let s = 0; s < slots.length; s++) {
          if (skipSlots > 0) {
            skipSlots--;
            continue;
          }

          const blocked = (settings.blockedSlots || []).find(b => b.day === day && b.slotId === s);
          if (blocked) {
            html += `
              <td class="cell-blocked text-center p-1 align-middle text-[10px] text-slate-500 font-semibold">
                ${blocked.reason}
              </td>
            `;
            continue;
          }

          const session = timetable.scheduledSessions.find((sess) => {
            if (sess.day !== day || sess.startSlot !== s) return false;
            if (activeTimetableViewMode === "college" || activeTimetableViewMode === "level") return (sess.levelIds || []).includes(rowItem.id);
            if (activeTimetableViewMode === "venue" || activeTimetableViewMode === "master") return sess.venueId === rowItem.id;
            if (activeTimetableViewMode === "lecturer") return sess.lecturerId === rowItem.id;
            return false;
          });

          if (session) {
            const colspan = session.duration > 1 ? session.duration : 1;
            skipSlots = colspan - 1;

            const lec = store.state.lecturers.find(l => l.id === session.lecturerId);
            const venue = store.state.venues.find(v => v.id === session.venueId);

            html += `
              <td colspan="${colspan}" class="p-1 align-top">
                <div class="session-card" style="background-color: ${session.color};" data-session-id="${session.sessionId}">
                  <div class="flex items-center justify-between">
                    <span class="font-black text-[11px]">${session.courseCode}</span>
                    <span class="text-[9px] bg-black/25 px-1 rounded">${session.duration}h</span>
                  </div>
                  <div class="text-[10px] font-medium truncate mt-0.5">${session.courseTitle}</div>
                  <div class="text-[9px] opacity-90 mt-1 flex items-center justify-between">
                    <span class="truncate">${venue ? venue.name : session.venueCode}</span>
                    <span class="truncate">${lec ? lec.name : 'TBA'}</span>
                  </div>
                </div>
              </td>
            `;
          } else {
            const isMiddle = timetable.scheduledSessions.some((sess) => {
              if (sess.day !== day) return false;
              if (s > sess.startSlot && s <= sess.endSlot) {
                if (activeTimetableViewMode === "college" || activeTimetableViewMode === "level") return (sess.levelIds || []).includes(rowItem.id);
                if (activeTimetableViewMode === "venue" || activeTimetableViewMode === "master") return sess.venueId === rowItem.id;
                if (activeTimetableViewMode === "lecturer") return sess.lecturerId === rowItem.id;
              }
              return false;
            });

            if (!isMiddle) {
              html += `<td class="p-1 text-center text-slate-300 text-xs">—</td>`;
            }
          }
        }

        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
    });

    html += `</div>`;
    timetableContainer.innerHTML = html;
  }

  // --- CRUD RESPONSIVE LISTS (COURSES, VENUES, LEVELS, LECTURERS) ---

  // 1. Courses List
  function renderCoursesList() {
    const list = store.state.courses;
    const container = document.getElementById("courses-list-container");
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 mx-auto flex items-center justify-center mb-3">
            <i data-lucide="book-open" class="w-6 h-6"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-800">No Courses Added Yet</h4>
          <p class="text-xs text-slate-500 mt-1 mb-4">Add your first course code, units, and assign a lecturer.</p>
          <button class="btn-trigger-add-course px-4 py-2 bg-wellspring-navy text-amber-300 rounded-xl font-bold text-xs shadow-md">
            + Add Course
          </button>
        </div>
      `;
      container.querySelector(".btn-trigger-add-course")?.addEventListener("click", openAddCourseModal);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${list.map(c => {
          const col = resolveEntityCollege(c, store);
          const lec = store.state.lecturers.find(l => l.id === c.lecturerId);
          const lvlNames = (c.levelIds || []).map(id => {
            const l = store.state.levels.find(lvl => lvl.id === id);
            return l ? l.name : id;
          }).join(", ");

          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 relative overflow-hidden">
              <div class="w-1.5 absolute left-0 top-0 bottom-0" style="background-color: ${c.color};"></div>
              
              <div class="flex items-start justify-between pl-1">
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-extrabold text-base text-slate-900 tracking-tight block">${c.code}</span>
                    <span class="px-2 py-0.5 rounded ${col.badgeClass} font-bold text-[10px] inline-block">
                      ${col.shortName}
                    </span>
                  </div>
                  <span class="text-xs text-slate-600 font-medium block mt-0.5">${c.title}</span>
                </div>
                <div class="flex items-center gap-1">
                  <button class="btn-edit-course text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors" data-id="${c.id}" title="Edit Course">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                  </button>
                  <button class="btn-delete-course text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors" data-id="${c.id}" title="Delete Course">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <div class="pl-1 text-xs space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] text-slate-400 font-semibold">Units & Format:</span>
                  <span class="font-bold text-slate-800">${c.units} Units (${c.sessionFormat || '1x2h'})</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[11px] text-slate-400 font-semibold">Venue Type:</span>
                  <span class="capitalize px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">${c.venueType}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[11px] text-slate-400 font-semibold">Lecturer:</span>
                  <span class="font-semibold text-slate-800 truncate max-w-[160px]">${lec ? lec.name : 'Unassigned'}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[11px] text-slate-400 font-semibold">Levels:</span>
                  <span class="font-medium text-slate-700 truncate max-w-[160px]">${lvlNames || 'None'}</span>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    container.querySelectorAll(".btn-edit-course").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        openAddCourseModal(id);
      });
    });

    container.querySelectorAll(".btn-delete-course").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        const course = store.state.courses.find(c => c.id === id);
        if (confirm(`Are you sure you want to delete ${course ? course.code : 'this course'}?`)) {
          store.state.courses = store.state.courses.filter(c => c.id !== id);
          store.save();
          renderCoursesList();
          renderDashboardStats();
          showToast("Course removed.", "info");
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // 2. Venues List
  function renderVenuesList() {
    const list = store.state.venues;
    const container = document.getElementById("venues-list-container");
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 mx-auto flex items-center justify-center mb-3">
            <i data-lucide="building" class="w-6 h-6"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-800">No Venues Added Yet</h4>
          <p class="text-xs text-slate-500 mt-1 mb-4">Add your classrooms, lecture theatres, or laboratories.</p>
          <button id="btn-trigger-add-venue" class="px-4 py-2 bg-wellspring-navy text-amber-300 rounded-xl font-bold text-xs shadow-md">
            + Add Venue
          </button>
        </div>
      `;
      container.querySelector("#btn-trigger-add-venue")?.addEventListener("click", () => {
        openAddVenueModal();
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${list.map(v => `
          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-start justify-between gap-3">
            <div class="space-y-1">
              <span class="font-extrabold text-slate-900 text-sm block">${v.name}</span>
              <div class="flex items-center gap-2 text-xs">
                <span class="font-mono text-slate-500 font-bold">${v.code}</span>
                <span class="text-slate-300">•</span>
                <span class="font-bold text-slate-800">${v.capacity} Seats</span>
              </div>
              <div class="pt-1 flex items-center gap-2">
                <span class="capitalize px-2 py-0.5 rounded ${v.type === 'theatre' ? 'bg-purple-100 text-purple-700' : v.type === 'lab' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'} font-semibold text-[10px]">
                  ${v.type}
                </span>
                <span class="text-[10px] text-slate-400">${v.building || 'Campus'}</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button class="btn-edit-venue text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors" data-id="${v.id}" title="Edit Venue">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              <button class="btn-delete-venue text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors" data-id="${v.id}" title="Delete Venue">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    container.querySelectorAll(".btn-edit-venue").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        openAddVenueModal(id);
      });
    });

    container.querySelectorAll(".btn-delete-venue").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        const venue = store.state.venues.find(v => v.id === id);
        if (confirm(`Are you sure you want to delete ${venue ? venue.name : 'this venue'}?`)) {
          store.state.venues = store.state.venues.filter(v => v.id !== id);
          store.save();
          renderVenuesList();
          renderDashboardStats();
          showToast("Venue removed.", "info");
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // 3. Levels List
  function renderLevelsList() {
    const list = store.state.levels;
    const container = document.getElementById("levels-list-container");
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 mx-auto flex items-center justify-center mb-3">
            <i data-lucide="graduation-cap" class="w-6 h-6"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-800">No Student Levels Added</h4>
          <p class="text-xs text-slate-500 mt-1 mb-4">Add your student cohorts (e.g., Computer Science 100L).</p>
          <button id="btn-trigger-add-level" class="px-4 py-2 bg-wellspring-navy text-amber-300 rounded-xl font-bold text-xs shadow-md">
            + Add Level
          </button>
        </div>
      `;
      container.querySelector("#btn-trigger-add-level")?.addEventListener("click", () => {
        openAddLevelModal();
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${list.map(l => {
          const col = resolveEntityCollege(l, store);
          return `
          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-extrabold text-slate-900 text-sm block">${l.name}</span>
                <span class="px-2 py-0.5 rounded ${col.badgeClass} font-bold text-[10px] inline-block">
                  ${col.shortName}
                </span>
              </div>
              <div class="text-xs text-slate-500">${l.department}</div>
              <div class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                ${l.size} Students
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button class="btn-edit-level text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors" data-id="${l.id}" title="Edit Level">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              <button class="btn-delete-level text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors" data-id="${l.id}" title="Delete Level">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
        }).join("")}
      </div>
    `;

    container.querySelectorAll(".btn-edit-level").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        openAddLevelModal(id);
      });
    });

    container.querySelectorAll(".btn-delete-level").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        const level = store.state.levels.find(l => l.id === id);
        if (confirm(`Are you sure you want to delete ${level ? level.name : 'this level'}?`)) {
          store.state.levels = store.state.levels.filter(l => l.id !== id);
          store.save();
          renderLevelsList();
          renderDashboardStats();
          showToast("Level removed.", "info");
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // 4. Lecturers List (Separated by College)
  function renderLecturersList() {
    const list = store.state.lecturers;
    const container = document.getElementById("lecturers-list-container");
    if (!container) return;

    // Filter pills event wiring
    const filterBar = document.getElementById("lecturers-college-filter-bar");
    if (filterBar && !filterBar.hasAttribute("data-wired")) {
      filterBar.setAttribute("data-wired", "true");
      filterBar.querySelectorAll(".lecturer-col-pill").forEach(pill => {
        pill.addEventListener("click", () => {
          filterBar.querySelectorAll(".lecturer-col-pill").forEach(p => {
            p.classList.remove("active", "bg-wellspring-navy", "text-amber-300");
            p.classList.add("bg-white", "text-slate-700");
          });
          pill.classList.add("active", "bg-wellspring-navy", "text-amber-300");
          pill.classList.remove("bg-white", "text-slate-700");
          activeLecturerCollegeFilter = pill.getAttribute("data-college") || "all";
          renderLecturersList();
        });
      });
    }

    const filteredList = activeLecturerCollegeFilter === "all"
      ? list
      : list.filter(l => resolveEntityCollege(l, store).id === activeLecturerCollegeFilter);

    if (list.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-3">
            <i data-lucide="users" class="w-6 h-6"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-800">No Lecturers Added</h4>
          <p class="text-xs text-slate-500 mt-1 mb-4">Add your faculty members separated by College.</p>
          <button id="btn-trigger-add-lecturer" class="px-4 py-2 bg-wellspring-navy text-amber-300 rounded-xl font-bold text-xs shadow-md">
            + Add Lecturer
          </button>
        </div>
      `;
      container.querySelector("#btn-trigger-add-lecturer")?.addEventListener("click", () => {
        openAddLecturerModal();
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (filteredList.length === 0) {
      const activeColObj = getCollegeById(activeLecturerCollegeFilter);
      container.innerHTML = `
        <div class="py-10 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-2">
            <i data-lucide="building-2" class="w-5 h-5"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-800">No Lecturers in ${activeColObj ? activeColObj.name : 'this College'}</h4>
          <p class="text-xs text-slate-500 mt-1 mb-4">You have not assigned any faculty members to this college yet.</p>
          <button id="btn-trigger-add-col-lecturer" class="px-4 py-2 bg-wellspring-navy text-amber-300 rounded-xl font-bold text-xs shadow-md">
            + Add Lecturer to ${activeColObj ? activeColObj.shortName : 'College'}
          </button>
        </div>
      `;
      container.querySelector("#btn-trigger-add-col-lecturer")?.addEventListener("click", () => {
        openAddLecturerModal();
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${filteredList.map(lec => {
          const col = resolveEntityCollege(lec, store);
          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-start justify-between gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-extrabold text-slate-900 text-sm block">${lec.name}</span>
                  <span class="px-2 py-0.5 rounded ${col.badgeClass} font-bold text-[10px] inline-flex items-center gap-1">
                    ${col.shortName}
                  </span>
                </div>
                <div class="text-xs text-slate-500">${lec.department || col.name}</div>
                <div class="pt-1 flex items-center gap-1.5 text-[10px] flex-wrap">
                  <span class="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">Max ${lec.maxHoursPerDay || 4}h/day</span>
                  ${(lec.unavailableDays && lec.unavailableDays.length > 0)
                    ? `<span class="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold">Off: ${lec.unavailableDays.join(", ")}</span>`
                    : `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">Available All Week</span>`
                  }
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button class="btn-edit-lecturer text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors" data-id="${lec.id}" title="Edit Lecturer">
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button class="btn-delete-lecturer text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors" data-id="${lec.id}" title="Delete Lecturer">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    container.querySelectorAll(".btn-edit-lecturer").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        openAddLecturerModal(id);
      });
    });

    container.querySelectorAll(".btn-delete-lecturer").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-id");
        const lec = store.state.lecturers.find(l => l.id === id);
        if (confirm(`Are you sure you want to delete ${lec ? lec.name : 'this lecturer'}?`)) {
          store.state.lecturers = store.state.lecturers.filter(l => l.id !== id);
          store.save();
          renderLecturersList();
          renderDashboardStats();
          showToast("Lecturer removed.", "info");
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- MODAL CONTROLS & SAVE / EDIT LOGIC ---

  // 1. Course Modal Helper
  function openAddCourseModal(editId = null) {
    const isEdit = Boolean(editId);
    const course = isEdit ? store.state.courses.find(c => c.id === editId) : null;

    const titleEl = document.getElementById("modal-course-title");
    const saveBtn = document.getElementById("btn-save-course");
    const editIdInput = document.getElementById("edit-course-id");

    if (titleEl) titleEl.textContent = isEdit ? `Edit Course (${course ? course.code : ''})` : "Add New Course";
    if (saveBtn) saveBtn.textContent = isEdit ? "Update Course" : "Save Course";
    if (editIdInput) editIdInput.value = editId || "";

    const lvlContainer = document.getElementById("course-levels-checkboxes");
    if (store.state.levels.length === 0) {
      lvlContainer.innerHTML = `<span class="text-slate-400 text-xs p-2">No levels added yet. Please add a level first.</span>`;
    } else {
      lvlContainer.innerHTML = store.state.levels.map(l => {
        const checked = isEdit && course && Array.isArray(course.levelIds) && course.levelIds.includes(l.id);
        return `
          <label class="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 text-xs cursor-pointer">
            <input type="checkbox" name="course-level" value="${l.id}" class="rounded text-blue-600 w-4 h-4" ${checked ? 'checked' : ''}>
            <span class="font-medium text-slate-800">${l.name}</span>
            <span class="text-slate-400 text-[10px]">(${l.size})</span>
          </label>
        `;
      }).join("");
    }

    const lecSelect = document.getElementById("course-lecturer-select");
    lecSelect.innerHTML = `<option value="">— Select Lecturer —</option>` + store.state.lecturers.map(l => `
      <option value="${l.id}" ${isEdit && course && course.lecturerId === l.id ? 'selected' : ''}>${l.name} (${l.department})</option>
    `).join("");

    if (isEdit && course) {
      document.getElementById("new-course-code").value = course.code || "";
      document.getElementById("new-course-title").value = course.title || "";
      document.getElementById("new-course-units").value = course.units || 2;
      document.getElementById("new-course-college").value = course.collegeId || "auto";
      document.getElementById("new-course-format").value = course.sessionFormat || "1x2h";
      document.getElementById("new-course-venue-type").value = course.venueType || "classroom";
      document.getElementById("new-course-color").value = course.color || "#3B82F6";
    } else {
      document.getElementById("new-course-code").value = "";
      document.getElementById("new-course-title").value = "";
      document.getElementById("new-course-units").value = "2";
      document.getElementById("new-course-college").value = "auto";
      document.getElementById("new-course-format").value = "1x2h";
      document.getElementById("new-course-venue-type").value = "classroom";
      document.getElementById("new-course-color").value = "#3B82F6";
    }

    document.getElementById("modal-add-course")?.classList.remove("hidden");
  }

  document.getElementById("btn-open-add-course")?.addEventListener("click", () => openAddCourseModal());

  document.getElementById("btn-save-course")?.addEventListener("click", () => {
    const editId = document.getElementById("edit-course-id")?.value;
    const code = document.getElementById("new-course-code").value.trim();
    const title = document.getElementById("new-course-title").value.trim();
    let collegeId = document.getElementById("new-course-college")?.value || "auto";
    const units = parseInt(document.getElementById("new-course-units").value, 10) || 2;
    const format = document.getElementById("new-course-format").value;
    const lecturerId = document.getElementById("course-lecturer-select").value;
    const venueType = document.getElementById("new-course-venue-type").value;
    const color = document.getElementById("new-course-color").value;

    const checkedLevels = Array.from(document.querySelectorAll("input[name='course-level']:checked")).map(cb => cb.value);

    if (!code || !title) {
      showToast("Please enter course code and title.", "error");
      return;
    }

    if (checkedLevels.length === 0) {
      showToast("Please select at least one level/cohort for this course.", "error");
      return;
    }

    if (collegeId === "auto") {
      const firstLvl = store.state.levels.find(l => checkedLevels.includes(l.id));
      collegeId = firstLvl ? resolveEntityCollege(firstLvl, store).id : "col-sc";
    }

    if (editId) {
      const existing = store.state.courses.find(c => c.id === editId);
      if (existing) {
        const oldCode = existing.code;
        existing.code = code.toUpperCase();
        existing.title = title;
        existing.units = units;
        existing.sessionFormat = format;
        existing.levelIds = checkedLevels;
        existing.lecturerId = lecturerId || null;
        existing.collegeId = collegeId;
        existing.venueType = venueType;
        existing.color = color;

        // Propagate updates to active timetables if present
        if (store.state.activeTimetable?.scheduledSessions) {
          store.state.activeTimetable.scheduledSessions.forEach(s => {
            if (s.courseId === editId || s.courseCode === oldCode) {
              s.courseCode = existing.code;
              s.courseTitle = existing.title;
              s.units = existing.units;
              s.lecturerId = existing.lecturerId;
              s.levelIds = existing.levelIds;
            }
          });
        }
        if (store.state.activeExamTimetable?.scheduledExams) {
          store.state.activeExamTimetable.scheduledExams.forEach(e => {
            if (e.courseId === editId || e.courseCode === oldCode) {
              e.courseCode = existing.code;
              e.courseTitle = existing.title;
              e.units = existing.units;
            }
          });
        }

        store.save();
        document.getElementById("modal-add-course").classList.add("hidden");
        renderCoursesList();
        renderDashboardStats();
        if (typeof renderTimetableView === "function") renderTimetableView();
        showToast(`Updated ${existing.code} successfully!`, "success");
        return;
      }
    }

    const newCourse = {
      id: `crs-${Date.now()}`,
      code: code.toUpperCase(),
      title,
      units,
      sessionFormat: format,
      levelIds: checkedLevels,
      lecturerId: lecturerId || null,
      collegeId,
      venueType,
      color
    };

    store.state.courses.push(newCourse);
    store.save();
    document.getElementById("modal-add-course").classList.add("hidden");
    renderCoursesList();
    renderDashboardStats();
    showToast(`Added ${newCourse.code} successfully!`, "success");

    // Clear inputs
    document.getElementById("new-course-code").value = "";
    document.getElementById("new-course-title").value = "";
  });

  // 2. Venue Modal Helper & Save
  function openAddVenueModal(editId = null) {
    const isEdit = Boolean(editId);
    const venue = isEdit ? store.state.venues.find(v => v.id === editId) : null;

    const titleEl = document.getElementById("modal-venue-title");
    const saveBtn = document.getElementById("btn-save-venue");
    const editIdInput = document.getElementById("edit-venue-id");

    if (titleEl) titleEl.textContent = isEdit ? `Edit Lecture Hall (${venue ? venue.name : ''})` : "Add Lecture Hall";
    if (saveBtn) saveBtn.textContent = isEdit ? "Update Venue" : "Save Venue";
    if (editIdInput) editIdInput.value = editId || "";

    if (isEdit && venue) {
      document.getElementById("new-venue-name").value = venue.name || "";
      document.getElementById("new-venue-code").value = venue.code || "";
      document.getElementById("new-venue-capacity").value = venue.capacity || 80;
      document.getElementById("new-venue-type").value = venue.type || "classroom";
      document.getElementById("new-venue-building").value = venue.building || "";
    } else {
      document.getElementById("new-venue-name").value = "";
      document.getElementById("new-venue-code").value = "";
      document.getElementById("new-venue-capacity").value = "80";
      document.getElementById("new-venue-type").value = "classroom";
      document.getElementById("new-venue-building").value = "";
    }

    document.getElementById("modal-add-venue")?.classList.remove("hidden");
  }

  document.getElementById("btn-open-add-venue")?.addEventListener("click", () => openAddVenueModal());

  document.getElementById("btn-save-venue")?.addEventListener("click", () => {
    const editId = document.getElementById("edit-venue-id")?.value;
    const name = document.getElementById("new-venue-name").value.trim();
    const code = document.getElementById("new-venue-code").value.trim() || name.slice(0, 8).toUpperCase();
    const capacity = parseInt(document.getElementById("new-venue-capacity").value, 10) || 80;
    const type = document.getElementById("new-venue-type").value;
    const building = document.getElementById("new-venue-building").value.trim() || "Main Campus";

    if (!name) {
      showToast("Please enter a venue name.", "error");
      return;
    }

    if (editId) {
      const existing = store.state.venues.find(v => v.id === editId);
      if (existing) {
        existing.name = name;
        existing.code = code;
        existing.capacity = capacity;
        existing.type = type;
        existing.building = building;

        // Propagate updates to active timetables
        if (store.state.activeTimetable?.scheduledSessions) {
          store.state.activeTimetable.scheduledSessions.forEach(s => {
            if (s.venueId === editId) {
              s.venueName = existing.name;
              s.venueCapacity = existing.capacity;
            }
          });
        }
        if (store.state.activeExamTimetable?.scheduledExams) {
          store.state.activeExamTimetable.scheduledExams.forEach(e => {
            if (e.venueId === editId) {
              e.venueName = existing.name;
              e.venueCapacity = existing.capacity;
            }
          });
        }

        store.save();
        document.getElementById("modal-add-venue").classList.add("hidden");
        renderVenuesList();
        renderDashboardStats();
        if (typeof renderTimetableView === "function") renderTimetableView();
        showToast(`Updated ${existing.name} successfully!`, "success");
        return;
      }
    }

    const newVenue = {
      id: `v-${Date.now()}`,
      name,
      code,
      capacity,
      type,
      building
    };

    store.state.venues.push(newVenue);
    store.save();
    document.getElementById("modal-add-venue").classList.add("hidden");
    renderVenuesList();
    renderDashboardStats();
    showToast(`Added ${newVenue.name} successfully!`, "success");

    document.getElementById("new-venue-name").value = "";
    document.getElementById("new-venue-code").value = "";
  });

  // 3. Level Modal Helper & Save
  function openAddLevelModal(editId = null) {
    const isEdit = Boolean(editId);
    const level = isEdit ? store.state.levels.find(l => l.id === editId) : null;

    const titleEl = document.getElementById("modal-level-title");
    const saveBtn = document.getElementById("btn-save-level");
    const editIdInput = document.getElementById("edit-level-id");

    if (titleEl) titleEl.textContent = isEdit ? `Edit Academic Level (${level ? level.name : ''})` : "Add Academic Level";
    if (saveBtn) saveBtn.textContent = isEdit ? "Update Level" : "Save Level";
    if (editIdInput) editIdInput.value = editId || "";

    if (isEdit && level) {
      document.getElementById("new-level-name").value = level.name || "";
      document.getElementById("new-level-college").value = level.collegeId || "col-sc";
      document.getElementById("new-level-code").value = level.code || "";
      document.getElementById("new-level-size").value = level.size || 40;
      document.getElementById("new-level-dept").value = level.department || "";
    } else {
      document.getElementById("new-level-name").value = "";
      document.getElementById("new-level-college").value = "col-sc";
      document.getElementById("new-level-code").value = "";
      document.getElementById("new-level-size").value = "45";
      document.getElementById("new-level-dept").value = "";
    }

    document.getElementById("modal-add-level")?.classList.remove("hidden");
  }

  document.getElementById("btn-open-add-level")?.addEventListener("click", () => openAddLevelModal());

  document.getElementById("btn-save-level")?.addEventListener("click", () => {
    const editId = document.getElementById("edit-level-id")?.value;
    const name = document.getElementById("new-level-name").value.trim();
    const collegeId = document.getElementById("new-level-college")?.value || "col-sc";
    const code = document.getElementById("new-level-code").value.trim() || name;
    const department = document.getElementById("new-level-dept").value.trim() || getCollegeById(collegeId).shortName;
    const size = parseInt(document.getElementById("new-level-size").value, 10) || 40;

    if (!name) {
      showToast("Please enter a level name (e.g. Computer Science 200L).", "error");
      return;
    }

    if (editId) {
      const existing = store.state.levels.find(l => l.id === editId);
      if (existing) {
        existing.name = name;
        existing.collegeId = collegeId;
        existing.code = code;
        existing.department = department;
        existing.size = size;

        store.save();
        document.getElementById("modal-add-level").classList.add("hidden");
        renderLevelsList();
        renderDashboardStats();
        if (typeof renderTimetableView === "function") renderTimetableView();
        showToast(`Updated ${existing.name} successfully!`, "success");
        return;
      }
    }

    const newLevel = {
      id: `lvl-${Date.now()}`,
      name,
      code,
      collegeId,
      department,
      size
    };

    store.state.levels.push(newLevel);
    store.save();
    document.getElementById("modal-add-level").classList.add("hidden");
    renderLevelsList();
    renderDashboardStats();
    showToast(`Added ${newLevel.name} successfully!`, "success");

    document.getElementById("new-level-name").value = "";
    document.getElementById("new-level-code").value = "";
    document.getElementById("new-level-dept").value = "";
  });

  // 4. Lecturer Modal Helper & Save
  function openAddLecturerModal(editId = null) {
    const isEdit = Boolean(editId);
    const lecturer = isEdit ? store.state.lecturers.find(l => l.id === editId) : null;

    const titleEl = document.getElementById("modal-lecturer-title");
    const saveBtn = document.getElementById("btn-save-lecturer");
    const editIdInput = document.getElementById("edit-lecturer-id");

    if (titleEl) titleEl.textContent = isEdit ? `Edit Lecturer (${lecturer ? lecturer.name : ''})` : "Add Lecturer";
    if (saveBtn) saveBtn.textContent = isEdit ? "Update Lecturer" : "Save Lecturer";
    if (editIdInput) editIdInput.value = editId || "";

    if (isEdit && lecturer) {
      document.getElementById("new-lecturer-name").value = lecturer.name || "";
      document.getElementById("new-lecturer-college").value = lecturer.collegeId || "col-sc";
      document.getElementById("new-lecturer-dept").value = lecturer.department || "";
      document.getElementById("new-lecturer-hours").value = lecturer.maxHoursPerDay || 4;
      document.getElementById("new-lecturer-offday").value = (lecturer.unavailableDays && lecturer.unavailableDays[0]) || "";
    } else {
      document.getElementById("new-lecturer-name").value = "";
      document.getElementById("new-lecturer-college").value = (typeof activeLecturerCollegeFilter !== "undefined" && activeLecturerCollegeFilter !== "all") ? activeLecturerCollegeFilter : "col-sc";
      document.getElementById("new-lecturer-dept").value = "";
      document.getElementById("new-lecturer-hours").value = "4";
      document.getElementById("new-lecturer-offday").value = "";
    }

    document.getElementById("modal-add-lecturer")?.classList.remove("hidden");
  }

  document.getElementById("btn-open-add-lecturer")?.addEventListener("click", () => openAddLecturerModal());

  document.getElementById("btn-save-lecturer")?.addEventListener("click", () => {
    const editId = document.getElementById("edit-lecturer-id")?.value;
    const name = document.getElementById("new-lecturer-name").value.trim();
    const collegeId = document.getElementById("new-lecturer-college")?.value || "col-sc";
    const discipline = document.getElementById("new-lecturer-dept").value.trim();
    const maxHours = parseInt(document.getElementById("new-lecturer-hours").value, 10) || 4;
    const offDay = document.getElementById("new-lecturer-offday").value;

    if (!name) {
      showToast("Please enter lecturer name.", "error");
      return;
    }

    const colObj = getCollegeById(collegeId);
    const department = discipline || colObj.shortName;

    if (editId) {
      const existing = store.state.lecturers.find(l => l.id === editId);
      if (existing) {
        existing.name = name;
        existing.collegeId = collegeId;
        existing.department = department;
        existing.maxHoursPerDay = maxHours;
        existing.unavailableDays = offDay ? [offDay] : [];

        store.save();
        document.getElementById("modal-add-lecturer").classList.add("hidden");
        renderLecturersList();
        renderDashboardStats();
        if (typeof renderTimetableView === "function") renderTimetableView();
        showToast(`Updated ${existing.name} successfully!`, "success");
        return;
      }
    }

    const newLecturer = {
      id: `lec-${Date.now()}`,
      name,
      collegeId,
      department,
      maxHoursPerDay: maxHours,
      unavailableDays: offDay ? [offDay] : []
    };

    store.state.lecturers.push(newLecturer);
    store.save();
    document.getElementById("modal-add-lecturer").classList.add("hidden");
    renderLecturersList();
    renderDashboardStats();
    showToast(`Added ${newLecturer.name} (${colObj.shortName}) successfully!`, "success");

    document.getElementById("new-lecturer-name").value = "";
    document.getElementById("new-lecturer-dept").value = "";
  });

  // Close modals
  document.querySelectorAll(".modal-cancel-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.target.closest(".fixed").classList.add("hidden");
    });
  });

  // --- MANUAL INSPECTOR & RESCHEDULER ---
  const inspectorModal = document.getElementById("session-inspector-modal");
  const inspectorDetails = document.getElementById("inspector-details");
  const inspectorTargetDay = document.getElementById("move-target-day");
  const inspectorTargetSlot = document.getElementById("move-target-slot");
  const inspectorTargetVenue = document.getElementById("move-target-venue");
  const inspectorMoveValidation = document.getElementById("inspector-validation-alert");
  const btnApplyMove = document.getElementById("btn-apply-move");
  let inspectingSession = null;

  function openSessionInspector(sessionId) {
    const timetable = store.state.activeTimetable;
    if (!timetable) return;

    inspectingSession = timetable.scheduledSessions.find(s => s.sessionId === sessionId);
    if (!inspectingSession) return;

    const lecturer = store.state.lecturers.find(l => l.id === inspectingSession.lecturerId);
    const venue = store.state.venues.find(v => v.id === inspectingSession.venueId);
    const levelNames = (inspectingSession.levelIds || []).map(id => {
      const l = store.state.levels.find(lvl => lvl.id === id);
      return l ? l.name : id;
    }).join(", ");

    inspectorDetails.innerHTML = `
      <div class="p-3.5 rounded-xl text-white mb-3" style="background-color: ${inspectingSession.color};">
        <div class="flex justify-between items-start">
          <span class="text-base font-black">${inspectingSession.courseCode}</span>
          <span class="text-[10px] bg-black/30 px-2 py-0.5 rounded font-bold">${inspectingSession.duration} Hours</span>
        </div>
        <p class="text-xs font-medium mt-0.5">${inspectingSession.courseTitle}</p>
        <div class="text-[11px] mt-2 opacity-90 space-y-0.5">
          <div><strong>Lecturer:</strong> ${lecturer ? lecturer.name : 'Unassigned'}</div>
          <div><strong>Venue:</strong> ${venue ? venue.name : 'None'}</div>
          <div><strong>Levels:</strong> ${levelNames}</div>
        </div>
      </div>
    `;

    inspectorTargetDay.innerHTML = store.state.settings.days.map(d => `
      <option value="${d}" ${d === inspectingSession.day ? 'selected' : ''}>${d}</option>
    `).join("");

    inspectorTargetSlot.innerHTML = store.state.settings.slots.map(s => `
      <option value="${s.id}" ${s.id === inspectingSession.startSlot ? 'selected' : ''}>${s.label} (${s.time})</option>
    `).join("");

    inspectorTargetVenue.innerHTML = store.state.venues.map(v => `
      <option value="${v.id}" ${v.id === inspectingSession.venueId ? 'selected' : ''}>${v.name} (Cap: ${v.capacity})</option>
    `).join("");

    runMoveValidation();
    inspectorModal.classList.remove("hidden");
  }

  function runMoveValidation() {
    if (!inspectingSession) return;
    const targetDay = inspectorTargetDay.value;
    const targetSlot = parseInt(inspectorTargetSlot.value, 10);
    const targetVenueId = inspectorTargetVenue.value;

    const validation = engine.validateManualMove(
      store.state.activeTimetable,
      inspectingSession.sessionId,
      targetVenueId,
      targetDay,
      targetSlot,
      store.state
    );

    inspectorMoveValidation.classList.remove("hidden");
    if (validation.valid) {
      inspectorMoveValidation.className = "p-2.5 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2";
      inspectorMoveValidation.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-600"></i> <span><strong>Safe:</strong> 0 clashes!</span>`;
      btnApplyMove.removeAttribute("disabled");
      btnApplyMove.className = "px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700";
    } else {
      inspectorMoveValidation.className = "p-2.5 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200 flex items-start gap-2";
      inspectorMoveValidation.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5"></i> <span><strong>Warning:</strong> ${validation.message}</span>`;
      btnApplyMove.setAttribute("disabled", "true");
      btnApplyMove.className = "px-4 py-2 bg-slate-300 text-slate-500 rounded-lg font-bold text-xs cursor-not-allowed";
    }
    if (window.lucide) window.lucide.createIcons();
  }

  [inspectorTargetDay, inspectorTargetSlot, inspectorTargetVenue].forEach(el => {
    el?.addEventListener("change", runMoveValidation);
  });

  btnApplyMove?.addEventListener("click", () => {
    if (!inspectingSession) return;
    const targetDay = inspectorTargetDay.value;
    const targetSlot = parseInt(inspectorTargetSlot.value, 10);
    const targetVenueId = inspectorTargetVenue.value;
    const targetVenue = store.state.venues.find(v => v.id === targetVenueId);

    inspectingSession.day = targetDay;
    inspectingSession.startSlot = targetSlot;
    inspectingSession.endSlot = targetSlot + inspectingSession.duration - 1;
    inspectingSession.venueId = targetVenueId;
    if (targetVenue) {
      inspectingSession.venueName = targetVenue.name;
      inspectingSession.venueCode = targetVenue.code;
    }

    store.save();
    inspectorModal.classList.add("hidden");
    showToast(`Updated ${inspectingSession.courseCode} slot!`, "success");
    renderTimetableView();
  });

  document.getElementById("btn-close-inspector")?.addEventListener("click", () => {
    inspectorModal.classList.add("hidden");
  });

  // --- SPECIAL RULES ---
  function syncBlockedSlots(settings) {
    const blocked = [];
    if (settings.rules.enforceChapel) {
      blocked.push({ day: "Wednesday", slotId: 4, reason: "University Chapel Service" });
    }
    if (settings.rules.enforceLunch) {
      const otherDays = ["Monday", "Tuesday", "Thursday", "Friday"];
      otherDays.forEach(day => {
        blocked.push({ day: day, slotId: 4, reason: "Lunch & Midday Break" });
      });
    }
    settings.blockedSlots = blocked;
  }

  function renderRulesView() {
    const settings = store.state.settings;
    const chkChapel = document.getElementById("rule-enforce-chapel");
    const chkLunch = document.getElementById("rule-enforce-lunch");
    const chkFriday = document.getElementById("rule-avoid-friday");
    const maxDaily = document.getElementById("rule-max-daily-hours");

    if (chkChapel) chkChapel.checked = settings.rules.enforceChapel;
    if (chkLunch) chkLunch.checked = settings.rules.enforceLunch;
    if (chkFriday) chkFriday.checked = settings.rules.avoidLateFriday;
    if (maxDaily) maxDaily.value = settings.rules.maxDailyHoursPerLevel;

    // Exam rules
    const examSettings = store.state.examSettings || {};
    const examRules = examSettings.rules || {};
    const chkSpacing = document.getElementById("rule-exam-spacing");
    const chkExamMaxDaily = document.getElementById("rule-exam-max-daily");
    const selExamDuration = document.getElementById("rule-exam-duration");
    const selExamInvigilators = document.getElementById("rule-exam-invigilators");

    if (chkSpacing) chkSpacing.checked = examRules.enforceSpacing !== false;
    if (chkExamMaxDaily) chkExamMaxDaily.checked = examRules.maxExamsPerDayPerLevel !== false;
    if (selExamDuration) selExamDuration.value = examSettings.durationWeeks || 2;
    if (selExamInvigilators) selExamInvigilators.value = examRules.invigilatorsPerVenue || 2;
  }

  document.getElementById("btn-save-rules")?.addEventListener("click", () => {
    const settings = store.state.settings;
    settings.rules.enforceChapel = document.getElementById("rule-enforce-chapel").checked;
    settings.rules.enforceLunch = document.getElementById("rule-enforce-lunch").checked;
    settings.rules.avoidLateFriday = document.getElementById("rule-avoid-friday").checked;
    settings.rules.maxDailyHoursPerLevel = parseInt(document.getElementById("rule-max-daily-hours").value, 10) || 6;

    syncBlockedSlots(settings);

    store.save();
    showToast("Special rules saved! (12pm-1pm reserved for Chapel/Lunch)", "success");
  });

  document.getElementById("btn-save-exam-rules")?.addEventListener("click", () => {
    const examSettings = store.state.examSettings || {};
    if (!examSettings.rules) examSettings.rules = {};

    examSettings.rules.enforceSpacing = document.getElementById("rule-exam-spacing").checked;
    examSettings.rules.maxExamsPerDayPerLevel = document.getElementById("rule-exam-max-daily").checked;
    examSettings.durationWeeks = parseInt(document.getElementById("rule-exam-duration").value, 10) || 2;
    examSettings.rules.invigilatorsPerVenue = parseInt(document.getElementById("rule-exam-invigilators").value, 10) || 2;

    store.save();
    showToast("Examination rules & malpractice protocols saved!", "success");
    renderDashboardStats();
  });

  // --- SETTINGS (CALENDAR, INSTITUTION, PASSCODE, EXPORT, IMPORT, CLEAR) ---
  function updateMetadataLabels() {
    const settings = store.state.settings;
    const session = settings.session || "2025/2026 Academic Session";
    const semester = settings.semester || "First Semester";
    const inst = settings.institution || "Wellspring University";

    document.querySelectorAll(".meta-session-label").forEach(el => el.textContent = session);
    document.querySelectorAll(".meta-semester-label").forEach(el => el.textContent = semester);
    document.querySelectorAll(".meta-institution-label").forEach(el => el.textContent = inst.toUpperCase());
    document.querySelectorAll(".meta-inst-title").forEach(el => el.textContent = inst);
  }

  function renderSettingsView() {
    const settings = store.state.settings;
    const instInput = document.getElementById("settings-institution");
    const campusInput = document.getElementById("settings-campus");
    const sessionInput = document.getElementById("settings-session");
    const semesterInput = document.getElementById("settings-semester");

    if (instInput) instInput.value = settings.institution || "Wellspring University";
    if (campusInput) campusInput.value = settings.campus || "Main Campus, Benin City";
    if (sessionInput) sessionInput.value = settings.session || "2025/2026 Academic Session";
    if (semesterInput) semesterInput.value = settings.semester || "First Semester";

    updateMetadataLabels();
  }

  document.getElementById("btn-save-calendar")?.addEventListener("click", () => {
    const inst = document.getElementById("settings-institution").value.trim();
    const campus = document.getElementById("settings-campus").value.trim();
    const session = document.getElementById("settings-session").value.trim();
    const semester = document.getElementById("settings-semester").value.trim();

    if (!session) {
      showToast("Please enter the academic session.", "error");
      return;
    }

    store.state.settings.institution = inst || "Wellspring University";
    store.state.settings.campus = campus || "Main Campus, Benin City";
    store.state.settings.session = session;
    store.state.settings.semester = semester;
    store.save();

    updateMetadataLabels();
    renderTimetableView();

    showToast("Calendar and institution details updated!", "success");
  });

  document.getElementById("btn-update-passcode")?.addEventListener("click", () => {
    const cur = document.getElementById("settings-current-passcode").value.trim();
    const n1 = document.getElementById("settings-new-passcode").value.trim();

    if (!store.verifyPasscode(cur)) {
      showToast("Current passcode is incorrect.", "error");
      return;
    }
    if (n1.length < 3) {
      showToast("New passcode must be at least 3 characters.", "error");
      return;
    }

    store.setPasscode(n1);
    document.getElementById("settings-current-passcode").value = "";
    document.getElementById("settings-new-passcode").value = "";
    showToast("Passcode updated successfully!", "success");
  });

  document.getElementById("btn-clear-all")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all data and start completely fresh?")) {
      store.clearAllData();
      renderAllViews();
      showToast("All data cleared. Workstation reset to clean state.", "info");
    }
  });

  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    store.exportJSON();
    showToast("Backup file downloaded.", "success");
  });

  const fileInput = document.getElementById("file-import-json");
  document.getElementById("btn-import-json")?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = store.importJSON(event.target.result);
      if (res.success) {
        renderAllViews();
        showToast("Project restored successfully!", "success");
      } else {
        showToast(res.message, "error");
      }
    };
    reader.readAsText(file);
    fileInput.value = "";
  });

  // --- EXPORT TO CSV / EXCEL & PRINT ---
  document.getElementById("btn-export-excel")?.addEventListener("click", () => {
    const isCollegeFiltered = activeTimetableViewMode === "college" && selectedFilterId !== "all";
    const activeColObj = isCollegeFiltered ? store.getCollege(selectedFilterId) : null;
    const colSuffix = activeColObj ? `_${activeColObj.shortName.replace(/[^a-zA-Z0-9]/g, "_")}` : "_UniversityWide";

    if (activeMode === "exam") {
      const examTimetable = store.state.activeExamTimetable;
      if (!examTimetable || !examTimetable.scheduledExams || examTimetable.scheduledExams.length === 0) {
        showToast("Please generate an exam timetable before exporting.", "error");
        return;
      }

      let exams = examTimetable.scheduledExams;
      if (selectedFilterId !== "all") {
        if (activeTimetableViewMode === "college") {
          exams = exams.filter(e => isSessionInCollege(e, selectedFilterId));
        } else if (activeTimetableViewMode === "level") {
          exams = exams.filter(e => (e.levelIds || []).includes(selectedFilterId));
        } else if (activeTimetableViewMode === "venue") {
          exams = exams.filter(e => e.venueId === selectedFilterId);
        } else if (activeTimetableViewMode === "lecturer") {
          exams = exams.filter(e => (e.invigilatorIds || []).includes(selectedFilterId));
        }
      }

      let csv = "Week,Day,Session,Time,College,Course Code,Course Title,Credit Units,Candidates,Levels,Exam Hall,Room Capacity,Spaced Desks,Invigilators\n";
      exams.forEach(e => {
        const lvlNames = (e.levelIds || []).map(id => {
          const l = store.state.levels.find(lvl => lvl.id === id);
          return l ? l.name : id;
        }).join(" | ");

        const invNames = (e.invigilatorNames || []).join(" | ");
        const col = resolveEntityCollege(e, store);

        const row = [
          `"Week ${e.weekNumber}"`,
          `"${e.day}"`,
          `"${e.sessionLabel}"`,
          `"${e.time}"`,
          `"${col.shortName}"`,
          `"${e.courseCode}"`,
          `"${(e.courseTitle || '').replace(/"/g, '""')}"`,
          e.units || 2,
          e.candidateCount,
          `"${lvlNames}"`,
          `"${e.venueName}"`,
          e.venueCapacity,
          e.effectiveCapacity,
          `"${invNames}"`
        ];
        csv += row.join(",") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Wellspring_Exam_Timetable${colSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded Exam Timetable (${activeColObj ? activeColObj.shortName : 'University-Wide'})!`, "success");

    } else {
      const timetable = store.state.activeTimetable;
      if (!timetable || !timetable.scheduledSessions || timetable.scheduledSessions.length === 0) {
        showToast("Please generate a timetable before exporting.", "error");
        return;
      }

      let sessions = timetable.scheduledSessions;
      if (selectedFilterId !== "all") {
        if (activeTimetableViewMode === "college") {
          sessions = sessions.filter(s => isSessionInCollege(s, selectedFilterId));
        } else if (activeTimetableViewMode === "level") {
          sessions = sessions.filter(s => (s.levelIds || []).includes(selectedFilterId));
        } else if (activeTimetableViewMode === "venue") {
          sessions = sessions.filter(s => s.venueId === selectedFilterId);
        } else if (activeTimetableViewMode === "lecturer") {
          sessions = sessions.filter(s => s.lecturerId === selectedFilterId);
        }
      }

      let csv = "Day,Time Slot,Duration (Hrs),College,Course Code,Course Title,Credit Units,Lecture Hall,Capacity,Lecturer,Levels,Student Count\n";

      sessions.forEach(s => {
        const slot = store.state.settings.slots[s.startSlot];
        const lec = store.state.lecturers.find(l => l.id === s.lecturerId);
        const crs = store.state.courses.find(c => c.id === s.courseId || c.code === s.courseCode);
        const col = resolveEntityCollege(crs || s, store);
        const lvlNames = (s.levelIds || []).map(id => {
          const l = store.state.levels.find(lvl => lvl.id === id);
          return l ? l.name : id;
        }).join(" | ");

        const row = [
          `"${s.day}"`,
          `"${slot ? slot.label : ''}"`,
          s.duration,
          `"${col.shortName}"`,
          `"${s.courseCode}"`,
          `"${(s.courseTitle || '').replace(/"/g, '""')}"`,
          s.units || 2,
          `"${s.venueName}"`,
          s.venueCapacity,
          `"${lec ? lec.name : 'TBA'}"`,
          `"${lvlNames}"`,
          s.totalStudents
        ];

        csv += row.join(",") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Wellspring_Lecture_Timetable${colSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded Lecture Timetable (${activeColObj ? activeColObj.shortName : 'University-Wide'})!`, "success");
    }
  });

  document.getElementById("btn-print-timetable")?.addEventListener("click", () => {
    const hasTimetable = activeMode === "exam"
      ? Boolean(store.state.activeExamTimetable && store.state.activeExamTimetable.scheduledExams && store.state.activeExamTimetable.scheduledExams.length > 0)
      : Boolean(store.state.activeTimetable && store.state.activeTimetable.scheduledSessions && store.state.activeTimetable.scheduledSessions.length > 0);

    if (!hasTimetable) {
      showToast("No active timetable to print.", "info");
      return;
    }

    const printSubtitle = document.getElementById("print-timetable-subtitle");
    const originalText = printSubtitle ? printSubtitle.textContent : "";
    if (printSubtitle && activeTimetableViewMode === "college" && selectedFilterId !== "all") {
      const colObj = store.getCollege(selectedFilterId);
      printSubtitle.textContent = activeMode === "exam"
        ? `Official Examination Timetable & Docket - ${colObj.name}`
        : `Master Lecture Timetable - ${colObj.name}`;
    }
    window.print();
    if (printSubtitle) {
      setTimeout(() => {
        printSubtitle.textContent = originalText;
      }, 1000);
    }
  });

  // Master Render Function
  function renderAllViews() {
    syncBlockedSlots(store.state.settings);
    updateTimetableFilterDropdown();
    renderDashboardStats();
    renderTimetableView();
    renderCoursesList();
    renderVenuesList();
    renderLevelsList();
    renderLecturersList();
    renderRulesView();
    renderSettingsView();
    if (window.lucide) window.lucide.createIcons();
  }

  // Initial Boot
  checkLockStatus();
  switchMode(activeMode, true);
  renderAllViews();
});
