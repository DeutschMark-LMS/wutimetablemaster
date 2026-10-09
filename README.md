# Timetable Master

An academic timetable scheduling and distribution platform with real-time sync for students and administrators.

## 🌟 Overview

Timetable Master provides an automated timetable generation engine and companion portal:
- **Administrative Portal**: Constraint-based scheduling for lectures and examinations, venue management, and clash detection.
- **Student Companion Portal**: Real-time class status, personalized cohort timelines, and calendar sync.

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, Tailwind CSS (CDN)
- **Backend & Database**: Google Cloud Firestore (Real-time sync)
- **Icons & Visuals**: Lucide Icons, Canvas Confetti

## 🚀 Getting Started

The platform runs directly in the browser with no build steps required:

1. Clone the repository:
   ```bash
   git clone https://github.com/DeutschMark-LMS/wutimetablemaster.git
   cd wutimetablemaster
   ```

2. Open locally using a static server:
   ```bash
   # Using Python:
   python3 -m http.server 8000

   # Or using Node:
   npx serve .
   ```

3. Open `http://localhost:8000` in your browser.

## 📄 License

Licensed under the [MIT License](LICENSE).
