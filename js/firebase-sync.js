/**
 * Wellspring University Timetable Master — Firebase Cloud Synchronization
 * Powered by Google Cloud Firestore (Modular CDN)
 */

// Firebase Project Configuration
// Reads from window.firebaseConfig (defined in gitignored js/firebase-config.js)
const firebaseConfig = window.firebaseConfig || {
  authDomain: "wutimetablemaster.firebaseapp.com",
  projectId: "wutimetablemaster",
  storageBucket: "wutimetablemaster.firebasestorage.app",
  messagingSenderId: "721824099311",
  appId: "1:721824099311:web:d024746c59bad6ec8d641a"
};

class CloudSyncService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isOnline = false;
    this.isInitialized = false;
    this.listeners = [];
  }

  async init() {
    if (this.isInitialized) return true;
    try {
      // Dynamic import from Google CDN
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const { 
        getFirestore, 
        doc, 
        setDoc, 
        getDoc, 
        onSnapshot, 
        serverTimestamp,
        enableIndexedDbPersistence 
      } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

      this.docFn = doc;
      this.setDocFn = setDoc;
      this.getDocFn = getDoc;
      this.onSnapshotFn = onSnapshot;
      this.serverTimestampFn = serverTimestamp;

      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);

      this.isOnline = true;
      this.isInitialized = true;
      console.log("☁️ [Firebase CloudSync] Initialized successfully with Firestore project:", firebaseConfig.projectId);
      
      this._emitStatus("online");
      return true;
    } catch (err) {
      console.warn("☁️ [Firebase CloudSync] Running in offline/local mode:", err.message);
      this.isOnline = false;
      this._emitStatus("offline", err.message);
      return false;
    }
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    callback(this.isOnline ? "online" : "offline");
  }

  _emitStatus(status, details = "") {
    this.listeners.forEach(cb => {
      try { cb(status, details); } catch(e) {}
    });
    window.dispatchEvent(new CustomEvent("cloud-sync-status", { detail: { status, details } }));
  }

  /**
   * Publish a generated timetable to Firestore so students and staff can access it.
   */
  async publishTimetable(timetable, baseData = null) {
    if (!this.isInitialized) await this.init();
    if (!this.db) throw new Error("Firestore is not connected.");

    const mode = timetable.mode || "lecture";
    const timetableRef = this.docFn(this.db, "timetables", timetable.id);
    const metaRef = this.docFn(this.db, "metadata", "active_schedules");

    // 1. Save Timetable Document
    await this.setDocFn(timetableRef, {
      ...timetable,
      cloudPublishedAt: new Date().toISOString()
    });

    // 2. Update pointer in active_schedules metadata
    const metaUpdate = {
      lastUpdated: new Date().toISOString(),
      updatedBy: "Academic Planning Directorate"
    };

    if (mode === "exam") {
      metaUpdate.activeExamId = timetable.id;
      metaUpdate.examTitle = timetable.title || "Examination Timetable";
      metaUpdate.examPublishedAt = new Date().toISOString();
    } else {
      metaUpdate.activeLectureId = timetable.id;
      metaUpdate.lectureTitle = timetable.title || "Lecture Timetable";
      metaUpdate.lecturePublishedAt = new Date().toISOString();
    }

    await this.setDocFn(metaRef, metaUpdate, { merge: true });

    // 3. Optionally sync base catalog (levels, courses, lecturers, venues)
    if (baseData) {
      const configRef = this.docFn(this.db, "config", "base_data");
      await this.setDocFn(configRef, {
        levels: baseData.levels || [],
        courses: baseData.courses || [],
        venues: baseData.venues || [],
        lecturers: baseData.lecturers || [],
        settings: baseData.settings || {},
        syncedAt: new Date().toISOString()
      }, { merge: true });
    }

    return { success: true, timetableId: timetable.id, mode };
  }

  /**
   * Fetch the currently active timetable for a specific mode ('lecture' or 'exam').
   */
  async fetchActiveTimetable(mode = "lecture") {
    if (!this.isInitialized) await this.init();
    if (!this.db) return null;

    try {
      const metaRef = this.docFn(this.db, "metadata", "active_schedules");
      const metaSnap = await this.getDocFn(metaRef);

      if (!metaSnap.exists()) return null;
      const meta = metaSnap.data();
      const targetId = mode === "exam" ? meta.activeExamId : meta.activeLectureId;

      if (!targetId) return null;

      const ttRef = this.docFn(this.db, "timetables", targetId);
      const ttSnap = await this.getDocFn(ttRef);

      if (ttSnap.exists()) {
        return ttSnap.data();
      }
      return null;
    } catch (err) {
      console.error("☁️ [Firebase CloudSync] Failed to fetch active timetable:", err);
      return null;
    }
  }

  /**
   * Fetch university base data (courses, levels, venues, lecturers)
   */
  async fetchBaseData() {
    if (!this.isInitialized) await this.init();
    if (!this.db) return null;

    try {
      const configRef = this.docFn(this.db, "config", "base_data");
      const configSnap = await this.getDocFn(configRef);
      if (configSnap.exists()) {
        return configSnap.data();
      }
      return null;
    } catch (err) {
      console.error("☁️ [Firebase CloudSync] Failed to fetch base data:", err);
      return null;
    }
  }

  /**
   * Push base institutional data (levels, courses, venues, lecturers, settings) to cloud.
   */
  async pushBaseData(state) {
    if (!this.isInitialized) await this.init();
    if (!this.db) throw new Error("Firestore is not connected.");

    const configRef = this.docFn(this.db, "config", "base_data");
    await this.setDocFn(configRef, {
      levels: state.levels || [],
      courses: state.courses || [],
      venues: state.venues || [],
      lecturers: state.lecturers || [],
      settings: state.settings || {},
      lastUpdated: new Date().toISOString(),
      updatedBy: "Academic Planning Directorate"
    }, { merge: true });

    return { success: true };
  }

  /**
   * Pull base institutional data from cloud.
   */
  async pullBaseData() {
    return this.fetchBaseData();
  }

  /**
   * Real-time subscription for the Student Portal.
   * Fires callback immediately and every time a timetable is published.
   */
  subscribeToActiveSchedules(callback) {
    if (!this.isInitialized) {
      this.init().then(() => this._setupSubscription(callback));
    } else {
      this._setupSubscription(callback);
    }
  }

  _setupSubscription(callback) {
    if (!this.db || !this.onSnapshotFn) return;

    const metaRef = this.docFn(this.db, "metadata", "active_schedules");
    this.onSnapshotFn(metaRef, async (docSnap) => {
      if (docSnap.exists()) {
        const meta = docSnap.data();
        let lectureTT = null;
        let examTT = null;

        if (meta.activeLectureId) {
          const lSnap = await this.getDocFn(this.docFn(this.db, "timetables", meta.activeLectureId));
          if (lSnap.exists()) lectureTT = lSnap.data();
        }

        if (meta.activeExamId) {
          const eSnap = await this.getDocFn(this.docFn(this.db, "timetables", meta.activeExamId));
          if (eSnap.exists()) examTT = eSnap.data();
        }

        const baseDataSnap = await this.getDocFn(this.docFn(this.db, "config", "base_data"));
        const baseData = baseDataSnap.exists() ? baseDataSnap.data() : null;

        callback({
          meta,
          activeLectureTimetable: lectureTT,
          activeExamTimetable: examTT,
          baseData
        });
      }
    }, (error) => {
      console.warn("☁️ [Firebase CloudSync] Subscription listener error:", error.message);
    });
  }
}

// Global Singleton Instance
window.cloudSync = new CloudSyncService();
// Auto-initialize on load
window.cloudSync.init();
