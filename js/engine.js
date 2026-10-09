/**
 * Wellspring University Timetable Master - Constraint Satisfaction Solver Engine
 * 100% Client-Side Algorithmic Scheduler for Clash-Free University Timetables
 */

class TimetableEngine {
  constructor(dataStore) {
    this.store = dataStore;
  }

  /**
   * Pre-processes courses into individual schedulable session units
   */
  prepareSessions(courses, levels) {
    const levelMap = new Map(levels.map(l => [l.id, l]));
    const sessions = [];

    courses.forEach(course => {
      // Calculate total student headcount across all enrolled levels
      const totalStudents = (course.levelIds || []).reduce((sum, lvlId) => {
        const lvl = levelMap.get(lvlId);
        return sum + (lvl ? (lvl.size || 30) : 30);
      }, 0);

      // Determine session durations based on format or credit units
      let durations = [];
      const format = course.sessionFormat;

      if (format === "1x3h") {
        durations = [3];
      } else if (format === "1x2h") {
        durations = [2];
      } else if (format === "1x1h") {
        durations = [1];
      } else if (format === "2h+1h") {
        durations = [2, 1];
      } else if (format === "1h+1h") {
        durations = [1, 1];
      } else {
        // Fallback based on units
        const units = parseInt(course.units, 10) || 2;
        if (units === 1) durations = [1];
        else if (units === 2) durations = [2];
        else if (units === 3) durations = [2, 1];
        else if (units === 4) durations = [2, 2];
        else durations = [2, 1];
      }

      durations.forEach((duration, idx) => {
        sessions.push({
          sessionId: `${course.id}-s${idx + 1}`,
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          units: course.units,
          duration: duration,
          sessionIndex: idx + 1,
          totalSessions: durations.length,
          levelIds: course.levelIds || [],
          totalStudents: totalStudents,
          lecturerId: course.lecturerId,
          venueType: course.venueType || "classroom",
          preferredVenueId: course.preferredVenueId,
          color: course.color || "#3B82F6"
        });
      });
    });

    return sessions;
  }

  /**
   * Evaluates if a venue is capable of hosting a given session
   */
  isVenueEligible(venue, session, strictCapacity = true) {
    // 1. Venue Type Check
    if (session.venueType === "lab" && venue.type !== "lab") return false;
    if (session.venueType === "studio" && venue.type !== "studio") return false;
    if (session.venueType === "theatre" && venue.type !== "theatre" && venue.capacity < 100) return false;

    // 2. Capacity Check
    if (strictCapacity && venue.capacity < session.totalStudents) {
      return false;
    }

    return true;
  }

  /**
   * Checks whether placing a session at (venue, day, startSlot) violates ANY hard constraint
   */
  isHardValidPlacement(placement, session, grid, state) {
    const { venueId, day, startSlot } = placement;
    const duration = session.duration;
    const settings = state.settings;
    const slots = settings.slots;
    const lecturer = state.lecturers.find(l => l.id === session.lecturerId);

    // 1. Boundary check: does it exceed the day's slots?
    if (startSlot + duration > slots.length) return false;

    // 2. Check universal blocked slots (e.g. University Chapel or Devotion)
    const blocked = settings.blockedSlots || [];
    for (let s = startSlot; s < startSlot + duration; s++) {
      const isBlocked = blocked.some(b => b.day === day && b.slotId === s);
      if (isBlocked) return false;
    }

    // 3. Lecturer constraints
    if (lecturer) {
      // Unavailable days
      if (lecturer.unavailableDays && lecturer.unavailableDays.includes(day)) {
        return false;
      }
    }

    // 4. Overlap checks in current grid
    for (let s = startSlot; s < startSlot + duration; s++) {
      const timeKey = `${day}_${s}`;
      const slotEntries = grid[timeKey] || [];

      // A. Venue Clash: Is this venue already occupied?
      const venueBusy = slotEntries.some(e => e.venueId === venueId);
      if (venueBusy) return false;

      // B. Lecturer Clash: Is the lecturer already teaching another class?
      if (session.lecturerId) {
        const lecturerBusy = slotEntries.some(e => e.lecturerId === session.lecturerId);
        if (lecturerBusy) return false;
      }

      // C. Student Group Clash: Is ANY enrolled level already having another class?
      const studentBusy = slotEntries.some(e => 
        e.levelIds && e.levelIds.some(lvl => session.levelIds.includes(lvl))
      );
      if (studentBusy) return false;
    }

    // 5. Same Course Spread Constraint:
    // If a course has multiple sessions (e.g. 2h + 1h), avoid putting both on the exact same day!
    const existingSessionsForCourse = Object.values(grid).flat().filter(e => e.courseId === session.courseId);
    const alreadyOnThisDay = existingSessionsForCourse.some(e => e.day === day);
    if (alreadyOnThisDay) {
      // Soft or hard: prefer different days
      return false;
    }

    return true;
  }

  /**
   * Scores a feasible placement based on soft constraints (higher score = better schedule)
   */
  scorePlacement(placement, session, grid, state) {
    let score = 100;
    const { venueId, day, startSlot } = placement;

    // 1. Preferred Venue Bonus
    if (session.preferredVenueId && session.preferredVenueId === venueId) {
      score += 50;
    }

    // 2. Right-size capacity fit (avoid putting a 30-student class in the 350-seat auditorium)
    const venue = state.venues.find(v => v.id === venueId);
    if (venue) {
      const ratio = session.totalStudents / (venue.capacity || 1);
      if (ratio >= 0.6 && ratio <= 1.0) {
        score += 30; // Excellent fit
      } else if (ratio < 0.2 && venue.capacity > 150) {
        score -= 40; // Waste of large auditorium
      }
    }

    // 3. Avoid Friday Late Afternoon for heavy lectures
    if (day === "Friday" && startSlot >= 6) {
      score -= 30;
    }

    // 4. Lunch break (Slot 4: 12pm - 1pm) is strictly protected in blockedSlots

    // 5. Balanced daily spread for enrolled levels
    // Calculate how many hours this level already has on this day
    let currentHoursOnDay = 0;
    const slots = state.settings.slots;
    for (let s = 0; s < slots.length; s++) {
      const key = `${day}_${s}`;
      const entries = grid[key] || [];
      const hasClass = entries.some(e => e.levelIds && e.levelIds.some(lvl => session.levelIds.includes(lvl)));
      if (hasClass) currentHoursOnDay++;
    }

    if (currentHoursOnDay + session.duration > (state.settings.rules.maxDailyHoursPerLevel || 6)) {
      score -= 60; // Student fatigue penalty
    } else if (currentHoursOnDay === 0) {
      score += 15; // Spreading across days
    } else {
      score += 10; // Moderate consolidation
    }

    return score;
  }

  /**
   * Generates timetable using Backtracking with MRV and Random Restarts
   * @param {Object} state - { venues, levels, lecturers, courses, settings }
   * @param {Function} onProgress - Callback with percentage
   */
  async solve(state, onProgress = null) {
    const venues = state.venues || [];
    const levels = state.levels || [];
    const lecturers = state.lecturers || [];
    const courses = state.courses || [];
    const settings = state.settings || {};
    const days = settings.days || DEFAULT_DAYS;
    const slots = settings.slots || DEFAULT_SLOTS;

    if (venues.length === 0 || courses.length === 0) {
      throw new Error("Please add at least one venue and one course before generating a timetable.");
    }

    // Step 1: Prepare sessions
    const sessions = this.prepareSessions(courses, levels);

    // Step 2: Sort sessions by difficulty / Most Constrained Variable (MRV)
    // - Courses with most enrolled levels (like GSTs) first
    // - Courses needing rare venues (labs/studios) first
    // - Longer sessions (3h > 2h > 1h) first
    sessions.sort((a, b) => {
      const aRareVenue = (a.venueType === "lab" || a.venueType === "studio") ? 10 : 0;
      const bRareVenue = (b.venueType === "lab" || b.venueType === "studio") ? 10 : 0;
      const aConstraint = (a.levelIds.length * 5) + aRareVenue + (a.duration * 3);
      const bConstraint = (b.levelIds.length * 5) + bRareVenue + (b.duration * 3);
      return bConstraint - aConstraint;
    });

    const maxRestarts = 15;
    let bestResult = null;
    let bestScheduledCount = -1;
    let bestScore = -Infinity;

    for (let restart = 0; restart < maxRestarts; restart++) {
      if (onProgress) {
        onProgress(Math.round(((restart + 1) / maxRestarts) * 90), `Solving pass ${restart + 1}/${maxRestarts}...`);
        // Small yield so browser UI remains responsive
        await new Promise(r => setTimeout(r, 10));
      }

      // Initialize empty grid: { 'Monday_0': [ { sessionId, ... } ] }
      const grid = {};
      const scheduledSessions = [];
      const unplacedSessions = [];

      let restartSucceeded = true;

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        
        // Find all feasible venues for this session
        let eligibleVenues = venues.filter(v => this.isVenueEligible(v, session, settings.rules.strictCapacity));
        // Fallback if strict capacity eliminates all venues
        if (eligibleVenues.length === 0) {
          eligibleVenues = venues.filter(v => this.isVenueEligible(v, session, false));
        }
        if (eligibleVenues.length === 0) {
          eligibleVenues = venues;
        }

        // Find all valid (venue, day, startSlot) combinations
        const candidates = [];
        for (const venue of eligibleVenues) {
          for (const day of days) {
            for (let s = 0; s <= slots.length - session.duration; s++) {
              const placement = { venueId: venue.id, day, startSlot: s };
              if (this.isHardValidPlacement(placement, session, grid, state)) {
                const score = this.scorePlacement(placement, session, grid, state);
                candidates.push({ placement, score, venue });
              }
            }
          }
        }

        if (candidates.length === 0) {
          // Could not place this session in this run
          unplacedSessions.push({ session, reason: "No conflict-free slot found matching venue capacity and availability." });
          restartSucceeded = false;
          continue;
        }

        // Sort candidates by score descending
        candidates.sort((a, b) => b.score - a.score);

        // Add slight stochastic variation for restarts (pick among top 3 or top 1)
        let chosen;
        if (restart === 0 || candidates.length === 1) {
          chosen = candidates[0]; // purely greedy best on first attempt
        } else {
          const pool = candidates.slice(0, Math.min(3, candidates.length));
          chosen = pool[Math.floor(Math.random() * pool.length)];
        }

        // Apply placement to grid
        const { placement, venue } = chosen;
        const entry = {
          sessionId: session.sessionId,
          courseId: session.courseId,
          courseCode: session.courseCode,
          courseTitle: session.courseTitle,
          duration: session.duration,
          sessionIndex: session.sessionIndex,
          totalSessions: session.totalSessions,
          levelIds: session.levelIds,
          totalStudents: session.totalStudents,
          lecturerId: session.lecturerId,
          venueId: venue.id,
          venueName: venue.name,
          venueCode: venue.code,
          venueCapacity: venue.capacity,
          day: placement.day,
          startSlot: placement.startSlot,
          endSlot: placement.startSlot + session.duration - 1,
          color: session.color
        };

        scheduledSessions.push(entry);

        for (let s = placement.startSlot; s < placement.startSlot + session.duration; s++) {
          const key = `${placement.day}_${s}`;
          if (!grid[key]) grid[key] = [];
          grid[key].push(entry);
        }
      }

      // Calculate score for this pass
      const passScore = (scheduledSessions.length * 1000) - (unplacedSessions.length * 5000);

      if (scheduledSessions.length > bestScheduledCount || 
         (scheduledSessions.length === bestScheduledCount && passScore > bestScore)) {
        bestScheduledCount = scheduledSessions.length;
        bestScore = passScore;
        bestResult = {
          grid,
          scheduledSessions,
          unplacedSessions,
          totalSessionsCount: sessions.length,
          timestamp: new Date().toISOString()
        };
      }

      // If 100% of sessions were successfully placed with zero clashes, we can finish early!
      if (unplacedSessions.length === 0) {
        break;
      }
    }

    if (onProgress) {
      onProgress(100, "Timetable generation complete!");
    }

    // Attach analysis stats
    bestResult.stats = this.calculateTimetableStats(bestResult, state);
    return bestResult;
  }

  /**
   * Computes utilization metrics and quality scores
   */
  calculateTimetableStats(result, state) {
    const venues = state.venues || [];
    const days = state.settings.days || DEFAULT_DAYS;
    const slots = state.settings.slots || DEFAULT_SLOTS;
    const totalPossibleVenueHours = venues.length * days.length * slots.length;

    let bookedVenueHours = 0;
    (result.scheduledSessions || []).forEach(sess => {
      bookedVenueHours += sess.duration;
    });

    const venueUtilization = totalPossibleVenueHours > 0 
      ? Math.round((bookedVenueHours / totalPossibleVenueHours) * 100) 
      : 0;

    const completionRate = result.totalSessionsCount > 0 
      ? Math.round((result.scheduledSessions.length / result.totalSessionsCount) * 100) 
      : 100;

    const clashesCount = 0; // Hard constraints strictly enforce 0 clashes

    let qualityScore = completionRate;
    if (result.unplacedSessions.length > 0) {
      qualityScore = Math.max(0, completionRate - 20);
    }

    return {
      totalCourses: state.courses.length,
      totalSessions: result.totalSessionsCount,
      scheduledSessionsCount: result.scheduledSessions.length,
      unplacedCount: result.unplacedSessions.length,
      completionRate: completionRate,
      clashesCount: clashesCount,
      venueUtilization: venueUtilization,
      qualityScore: qualityScore
    };
  }

  /**
   * Live Manual Tweak Validator:
   * Validates if dragging or moving a session to a target venue/day/slot causes any conflict.
   */
  validateManualMove(activeTimetable, sessionId, targetVenueId, targetDay, targetStartSlot, state) {
    const sessionToMove = activeTimetable.scheduledSessions.find(s => s.sessionId === sessionId);
    if (!sessionToMove) {
      return { valid: false, message: "Session not found." };
    }

    const duration = sessionToMove.duration;
    const settings = state.settings;
    const slots = settings.slots;
    const lecturer = state.lecturers.find(l => l.id === sessionToMove.lecturerId);
    const targetVenue = state.venues.find(v => v.id === targetVenueId);

    // Boundary check
    if (targetStartSlot + duration > slots.length) {
      return { valid: false, message: `Session of ${duration} hours exceeds day end time.` };
    }

    // Blocked check
    const blocked = settings.blockedSlots || [];
    for (let s = targetStartSlot; s < targetStartSlot + duration; s++) {
      const isBlocked = blocked.find(b => b.day === targetDay && b.slotId === s);
      if (isBlocked) {
        return { valid: false, message: `Conflicts with blocked period: ${isBlocked.reason}.` };
      }
    }

    // Lecturer unavailable day
    if (lecturer && lecturer.unavailableDays && lecturer.unavailableDays.includes(targetDay)) {
      return { valid: false, message: `${lecturer.name} is not available on ${targetDay}s.` };
    }

    // Check overlaps with other sessions (excluding itself)
    const otherSessions = activeTimetable.scheduledSessions.filter(s => s.sessionId !== sessionId);
    const conflicts = [];

    for (const other of otherSessions) {
      if (other.day !== targetDay) continue;

      // Check slot overlap
      const overlap = (targetStartSlot <= other.endSlot && (targetStartSlot + duration - 1) >= other.startSlot);
      if (!overlap) continue;

      // 1. Venue clash
      if (other.venueId === targetVenueId) {
        conflicts.push(`Venue clash: ${targetVenue ? targetVenue.name : 'Hall'} is already booked by ${other.courseCode}`);
      }

      // 2. Lecturer clash
      if (sessionToMove.lecturerId && sessionToMove.lecturerId === other.lecturerId) {
        conflicts.push(`Lecturer clash: ${lecturer ? lecturer.name : 'Lecturer'} is already teaching ${other.courseCode}`);
      }

      // 3. Student Level clash
      const sharedLevels = (sessionToMove.levelIds || []).filter(lvl => (other.levelIds || []).includes(lvl));
      if (sharedLevels.length > 0) {
        const lvlNames = sharedLevels.map(id => {
          const l = state.levels.find(lvl => lvl.id === id);
          return l ? l.name : id;
        }).join(", ");
        conflicts.push(`Student clash for [${lvlNames}]: already scheduled for ${other.courseCode}`);
      }
    }

    if (conflicts.length > 0) {
      return { valid: false, message: conflicts.join(" | "), conflicts };
    }

    return { valid: true, message: "Valid move with 0 clashes!" };
  }
}

/**
 * Examination Timetable Engine
 * Handles spaced seating (anti-malpractice), multi-week calendar schedules,
 * student fatigue prevention (max 1 exam/day), and invigilator rosters.
 */
class ExamTimetableEngine {
  constructor(dataStore) {
    this.store = dataStore;
  }

  prepareExamPapers(courses, levels) {
    const levelMap = new Map(levels.map(l => [l.id, l]));
    const papers = [];

    courses.forEach(c => {
      const candidateCount = (c.levelIds || []).reduce((sum, lvlId) => {
        const lvl = levelMap.get(lvlId);
        return sum + (lvl ? (lvl.size || 30) : 30);
      }, 0);

      papers.push({
        paperId: `exam-${c.id}`,
        courseId: c.id,
        courseCode: c.code,
        courseTitle: c.title,
        units: c.units,
        levelIds: c.levelIds || [],
        candidateCount: candidateCount,
        preferredVenueId: c.preferredVenueId,
        lecturerId: c.lecturerId,
        color: c.color || "#CFA144"
      });
    });

    return papers;
  }

  buildExamSlots(examSettings) {
    const weeks = examSettings.durationWeeks || 2;
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const sessions = examSettings.sessions || [
      { id: "morning", label: "Morning Session", time: "09:00 - 12:00" },
      { id: "afternoon", label: "Afternoon Session", time: "14:00 - 17:00" }
    ];

    const slots = [];
    let slotIndex = 0;

    for (let w = 1; w <= weeks; w++) {
      for (let d = 0; d < days.length; d++) {
        const dayName = days[d];
        const dayLabel = `Week ${w} - ${dayName}`;
        const dayShort = `W${w} ${dayName.slice(0, 3)}`;

        sessions.forEach(sess => {
          slots.push({
            slotIndex: slotIndex++,
            weekNumber: w,
            day: dayLabel,
            dayShort: dayShort,
            rawDay: dayName,
            sessionId: sess.id,
            sessionLabel: sess.label,
            time: sess.time
          });
        });
      }
    }

    return slots;
  }

  async solve(options = {}) {
    const state = this.store.state;
    const { courses, levels, venues, lecturers } = state;
    const examSettings = state.examSettings || {
      durationWeeks: 2,
      sessions: [
        { id: "morning", label: "Morning Session", time: "09:00 - 12:00" },
        { id: "afternoon", label: "Afternoon Session", time: "14:00 - 17:00" }
      ],
      spacingFactor: 0.5,
      rules: { enforceSpacing: true, maxExamsPerDayPerLevel: 1, invigilatorsPerVenue: 2 }
    };

    const rules = examSettings.rules || {};
    const spacingFactor = rules.enforceSpacing !== false ? (examSettings.spacingFactor || 0.5) : 1.0;

    if (!courses || courses.length === 0) {
      return { success: false, message: "No courses added. Please add courses to schedule exams." };
    }
    if (!venues || venues.length === 0) {
      return { success: false, message: "No halls available. Please add lecture/exam halls." };
    }

    const papers = this.prepareExamPapers(courses, levels);
    // Sort papers with largest candidate headcount first (hardest to fit)
    papers.sort((a, b) => b.candidateCount - a.candidateCount);

    const examSlots = this.buildExamSlots(examSettings);

    // Compute effective spaced exam hall capacities
    const examVenues = venues.map(v => ({
      ...v,
      effectiveCapacity: Math.max(1, Math.floor(v.capacity * spacingFactor))
    })).sort((a, b) => b.effectiveCapacity - a.effectiveCapacity);

    const scheduledExams = [];
    const levelDayMap = new Map(); // levelId -> Set of day labels
    const levelSlotMap = new Map(); // levelId -> Set of slotIndices
    const venueSlotMap = new Map(); // venueId -> Set of slotIndices
    const invigilatorSlotMap = new Map(); // lecturerId -> Set of slotIndices
    const invigilatorCountMap = new Map(); // lecturerId -> total assignments

    (lecturers || []).forEach(l => invigilatorCountMap.set(l.id, 0));

    const unplacedPapers = [];

    for (const paper of papers) {
      let placed = false;

      for (const slot of examSlots) {
        // 1. Student level clash & fatigue check
        let levelConflict = false;

        for (const lvlId of paper.levelIds) {
          const slotSet = levelSlotMap.get(lvlId) || new Set();
          if (slotSet.has(slot.slotIndex)) {
            levelConflict = true;
            break;
          }

          if (rules.maxExamsPerDayPerLevel) {
            const daySet = levelDayMap.get(lvlId) || new Set();
            if (daySet.has(slot.day)) {
              levelConflict = true;
              break;
            }
          }
        }

        if (levelConflict) continue;

        // 2. Hall availability & spaced capacity
        const suitableVenues = examVenues.filter(v => {
          const booked = venueSlotMap.get(v.id) || new Set();
          if (booked.has(slot.slotIndex)) return false;
          return v.effectiveCapacity >= paper.candidateCount;
        });

        if (suitableVenues.length === 0) {
          continue;
        }

        // Pick best fitting hall to conserve large halls
        suitableVenues.sort((a, b) => a.effectiveCapacity - b.effectiveCapacity);
        const chosenVenue = suitableVenues[0];

        // 3. Invigilator assignment (fair rotation from lecturer pool)
        const numInvigilators = rules.invigilatorsPerVenue || 2;
        const availableLecturers = (lecturers || []).filter(l => {
          const busy = invigilatorSlotMap.get(l.id) || new Set();
          return !busy.has(slot.slotIndex);
        });

        availableLecturers.sort((a, b) => {
          const cA = invigilatorCountMap.get(a.id) || 0;
          const cB = invigilatorCountMap.get(b.id) || 0;
          return cA - cB;
        });

        const assignedInvigilators = availableLecturers.slice(0, numInvigilators);

        // Record successful schedule
        scheduledExams.push({
          examId: `sched-${paper.paperId}`,
          courseId: paper.courseId,
          courseCode: paper.courseCode,
          courseTitle: paper.courseTitle,
          units: paper.units,
          levelIds: paper.levelIds,
          candidateCount: paper.candidateCount,
          color: paper.color,
          slotIndex: slot.slotIndex,
          weekNumber: slot.weekNumber,
          day: slot.day,
          rawDay: slot.rawDay,
          dayShort: slot.dayShort,
          sessionLabel: slot.sessionLabel,
          time: slot.time,
          venueId: chosenVenue.id,
          venueName: chosenVenue.name,
          venueCapacity: chosenVenue.capacity,
          effectiveCapacity: chosenVenue.effectiveCapacity,
          invigilatorIds: assignedInvigilators.map(i => i.id),
          invigilatorNames: assignedInvigilators.map(i => i.name)
        });

        // Update tracking maps
        for (const lvlId of paper.levelIds) {
          if (!levelDayMap.has(lvlId)) levelDayMap.set(lvlId, new Set());
          levelDayMap.get(lvlId).add(slot.day);

          if (!levelSlotMap.has(lvlId)) levelSlotMap.set(lvlId, new Set());
          levelSlotMap.get(lvlId).add(slot.slotIndex);
        }

        if (!venueSlotMap.has(chosenVenue.id)) venueSlotMap.set(chosenVenue.id, new Set());
        venueSlotMap.get(chosenVenue.id).add(slot.slotIndex);

        assignedInvigilators.forEach(inv => {
          if (!invigilatorSlotMap.has(inv.id)) invigilatorSlotMap.set(inv.id, new Set());
          invigilatorSlotMap.get(inv.id).add(slot.slotIndex);
          invigilatorCountMap.set(inv.id, (invigilatorCountMap.get(inv.id) || 0) + 1);
        });

        placed = true;
        break;
      }

      if (!placed) {
        unplacedPapers.push(paper);
      }
    }

    const success = unplacedPapers.length === 0;
    const result = {
      success: success,
      scheduledExams: scheduledExams,
      unplacedPapers: unplacedPapers,
      totalPapers: papers.length,
      placedCount: scheduledExams.length,
      spacingFactor: spacingFactor,
      weeks: examSettings.durationWeeks || 2,
      generatedAt: new Date().toISOString()
    };

    if (success) {
      state.activeExamTimetable = result;
      this.store.save();
    }

    return result;
  }
}

// Export singleton instances
window.timetableEngine = new TimetableEngine(window.dataStore);
window.examEngine = new ExamTimetableEngine(window.dataStore);

