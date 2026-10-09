/**
 * Wellspring University Timetable Master - Data Model & Persistence
 * Clean, empty state by default.
 */

const WELLSPRING_COLLEGES = [
  {
    id: "col-sc",
    name: "Science and Computing",
    code: "CSC",
    shortName: "Science & Computing",
    badgeClass: "badge-college-sc",
    departments: [
      "Computer Science",
      "Cyber Security",
      "Software Engineering",
      "Data Science",
      "Information Technology"
    ]
  },
  {
    id: "col-csms",
    name: "Social & Management Sciences (CSMS)",
    code: "CSMS",
    shortName: "CSMS",
    badgeClass: "badge-college-csms",
    departments: [
      "International Relations & Diplomacy (IRD)",
      "Economics",
      "Public Administration",
      "Business Administration",
      "Accounting"
    ]
  },
  {
    id: "col-life",
    name: "Basic Medical & Life Sciences",
    code: "BMLS",
    shortName: "Life Sciences",
    badgeClass: "badge-college-life",
    departments: [
      "Medical Laboratory Science (MLS)",
      "Nursing Science",
      "Medicine & Surgery (MBBS)",
      "Public Health",
      "Biochemistry"
    ]
  },
  {
    id: "col-pg",
    name: "Postgraduate Studies",
    code: "SPS",
    shortName: "Postgraduate",
    badgeClass: "badge-college-pg",
    departments: [
      "Postgraduate Diplomas (PGD)",
      "Masters Programmes (M.Sc)",
      "Doctorate Programmes (Ph.D)"
    ]
  },
  {
    id: "col-general",
    name: "General Studies / University-Wide",
    code: "GST",
    shortName: "General Studies",
    badgeClass: "badge-college-general",
    departments: [
      "General Studies (GST)",
      "Entrepreneurship Studies (ENT)"
    ]
  }
];

function getCollegeById(id) {
  return WELLSPRING_COLLEGES.find(c => c.id === id) || WELLSPRING_COLLEGES[0];
}

function resolveEntityCollege(entity, store) {
  if (!entity) return WELLSPRING_COLLEGES[0];
  if (entity.collegeId) {
    const col = WELLSPRING_COLLEGES.find(c => c.id === entity.collegeId);
    if (col) return col;
  }
  // If course, check enrolled level's college
  if (Array.isArray(entity.levelIds) && store && store.state && Array.isArray(store.state.levels)) {
    for (const lid of entity.levelIds) {
      const lvl = store.state.levels.find(l => l.id === lid);
      if (lvl && lvl.collegeId) {
        const col = WELLSPRING_COLLEGES.find(c => c.id === lvl.collegeId);
        if (col) return col;
      }
    }
  }
  // Check text matching against department, name, code, title
  const text = `${entity.department || ''} ${entity.name || ''} ${entity.code || ''} ${entity.title || ''}`.toLowerCase();
  if (text.includes("comput") || text.includes("cyber") || text.includes("software") || text.includes("data") || text.includes("info") || text.includes("csc") || text.includes("cmp") || text.includes("cyb") || text.includes("sen")) {
    return WELLSPRING_COLLEGES.find(c => c.id === "col-sc");
  }
  if (text.includes("ird") || text.includes("diplomacy") || text.includes("econ") || text.includes("public admin") || text.includes("business") || text.includes("account") || text.includes("csms") || text.includes("acc") || text.includes("bus") || text.includes("pad")) {
    return WELLSPRING_COLLEGES.find(c => c.id === "col-csms");
  }
  if (text.includes("med") || text.includes("nurs") || text.includes("surgery") || text.includes("mbbs") || text.includes("public health") || text.includes("biochem") || text.includes("bmls") || text.includes("mls") || text.includes("nsc") || text.includes("bch")) {
    return WELLSPRING_COLLEGES.find(c => c.id === "col-life");
  }
  if (text.includes("postgrad") || text.includes("pgd") || text.includes("master") || text.includes("m.sc") || text.includes("ph.d") || text.includes("phd") || text.includes("sps")) {
    return WELLSPRING_COLLEGES.find(c => c.id === "col-pg");
  }
  if (text.includes("general") || text.includes("gst") || text.includes("entrepreneur") || text.includes("ent")) {
    return WELLSPRING_COLLEGES.find(c => c.id === "col-general");
  }
  return WELLSPRING_COLLEGES[0];
}


const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const DEFAULT_SLOTS = [
  { id: 0, label: "08:00 - 09:00", time: "8am - 9am" },
  { id: 1, label: "09:00 - 10:00", time: "9am - 10am" },
  { id: 2, label: "10:00 - 11:00", time: "10am - 11am" },
  { id: 3, label: "11:00 - 12:00", time: "11am - 12pm" },
  { id: 4, label: "12:00 - 13:00", time: "12pm - 1pm" },
  { id: 5, label: "13:00 - 14:00", time: "1pm - 2pm" },
  { id: 6, label: "14:00 - 15:00", time: "2pm - 3pm" },
  { id: 7, label: "15:00 - 16:00", time: "3pm - 4pm" },
  { id: 8, label: "16:00 - 17:00", time: "4pm - 5pm" }
];

const DEFAULT_SETTINGS = {
  institution: "Wellspring University",
  campus: "Main Campus, Benin City",
  session: "2025/2026 Academic Session",
  semester: "First Semester",
  colleges: WELLSPRING_COLLEGES,
  days: DEFAULT_DAYS,
  slots: DEFAULT_SLOTS,
  passcode: "1234",
  blockedSlots: [
    { day: "Wednesday", slotId: 4, reason: "University Chapel Service" },
    { day: "Monday", slotId: 4, reason: "Lunch & Midday Break" },
    { day: "Tuesday", slotId: 4, reason: "Lunch & Midday Break" },
    { day: "Thursday", slotId: 4, reason: "Lunch & Midday Break" },
    { day: "Friday", slotId: 4, reason: "Lunch & Midday Break" }
  ],
  rules: {
    enforceChapel: true,
    enforceLunch: true,
    maxDailyHoursPerLevel: 6,
    maxConsecutiveHours: 3,
    avoidLateFriday: true,
    strictCapacity: true
  }
};

const DEFAULT_EXAM_SETTINGS = {
  durationWeeks: 2,
  sessions: [
    { id: "morning", label: "Morning Session", time: "09:00 - 12:00" },
    { id: "afternoon", label: "Afternoon Session", time: "14:00 - 17:00" }
  ],
  spacingFactor: 0.5,
  rules: {
    enforceSpacing: true,
    maxExamsPerDayPerLevel: 1,
    avoidConsecutiveDays: true,
    invigilatorsPerVenue: 2
  }
};

class DataStore {
  constructor() {
    this.STORAGE_KEY = "wellspring_timetable_master_v3";
    this.PASSCODE_KEY = "wellspring_timetable_passcode";
    this.state = this.loadInitialState();
  }

  loadInitialState() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          currentMode: parsed.currentMode || "lecture",
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          examSettings: { ...DEFAULT_EXAM_SETTINGS, ...(parsed.examSettings || {}) },
          venues: parsed.venues || [],
          levels: parsed.levels || [],
          lecturers: parsed.lecturers || [],
          courses: parsed.courses || [],
          activeTimetable: parsed.activeTimetable || null,
          activeExamTimetable: parsed.activeExamTimetable || null,
          history: parsed.history || []
        };
      }
    } catch (e) {
      console.warn("Could not load from localStorage, initializing empty state", e);
    }

    // Default to completely clean, empty state
    return this.getEmptyState();
  }

  getEmptyState() {
    return {
      currentMode: "lecture",
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      examSettings: JSON.parse(JSON.stringify(DEFAULT_EXAM_SETTINGS)),
      venues: [],
      levels: [],
      lecturers: [],
      courses: [],
      activeTimetable: null,
      activeExamTimetable: null,
      history: []
    };
  }

  setMode(mode) {
    if (mode === "lecture" || mode === "exam") {
      this.state.currentMode = mode;
      this.save();
      return true;
    }
    return false;
  }

  getCurrentMode() {
    return this.state.currentMode || "lecture";
  }

  getColleges() {
    return this.state.settings.colleges || WELLSPRING_COLLEGES;
  }

  getCollege(collegeId) {
    const list = this.getColleges();
    return list.find(c => c.id === collegeId) || list[0];
  }

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
      return true;
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
      return false;
    }
  }

  deleteActiveTimetable() {
    this.state.activeTimetable = null;
    return this.save();
  }

  deleteActiveExamTimetable() {
    this.state.activeExamTimetable = null;
    return this.save();
  }

  clearAllData() {
    this.state = this.getEmptyState();
    this.save();
    return this.state;
  }

  // Passcode Helpers
  getPasscode() {
    return localStorage.getItem(this.PASSCODE_KEY) || this.state.settings.passcode || "1234";
  }

  setPasscode(newCode) {
    if (!newCode || newCode.trim().length === 0) return false;
    localStorage.setItem(this.PASSCODE_KEY, newCode.trim());
    this.state.settings.passcode = newCode.trim();
    this.save();
    return true;
  }

  verifyPasscode(attempt) {
    const current = this.getPasscode();
    return attempt === current;
  }

  // Export / Import Project File (.json)
  exportJSON() {
    const backup = {
      version: "2.0",
      app: "Wellspring University Timetable Master",
      exportedAt: new Date().toISOString(),
      state: this.state
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Wellspring_Timetable_${this.state.settings.session.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data && data.state && Array.isArray(data.state.courses) && Array.isArray(data.state.venues)) {
        this.state = data.state;
        this.save();
        return { success: true };
      }
      return { success: false, message: "Invalid timetable backup file format." };
    } catch (e) {
      return { success: false, message: "Failed to parse JSON file: " + e.message };
    }
  }
}

// Export singleton instance
window.dataStore = new DataStore();
