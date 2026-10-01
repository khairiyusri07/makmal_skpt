/* ==========================================================================
   LABBOOK - CONFIGURATION & DATE UTILITIES
   ========================================================================== */

const LABS = [
  { id: 'LAB-1', name: 'Makmal Komputer Utama', location: 'Tingkat 1', pcs: 21, specs: 'Core i7, 16GB RAM' }
];

// Python Flask Backend API URL Endpoint
const PYTHON_API_URL = "/api";

function getBackendApiUrl(path = '') {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    if (window.location.origin.includes(':5000')) {
      return `/api${path}`;
    }
  }
  return `http://localhost:5000/api${path}`;
}

// Paste Google Apps Script Web App URL here to enable live Google Sheets sync
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxt1jN0FJUTt4SfJzbv1BgS86wvt4SFuCJGdWkXQ6wUGpb2dNLYc7gNSfequC5CQBbi/exec";

// ==========================================================================
// AUTO CLEAR USER CACHE AT WEBSITE LOAD / ENTRY
// ==========================================================================
function autoClearUserCache() {
  try {
    // 1. Bersihkan sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }

    // 2. Bersihkan CacheStorage API (PWA & HTTP Web Caches)
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      }).catch(() => {});
    }

    // 3. Batalkan pendaftaran ServiceWorker jika wujud
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      }).catch(() => {});
    }

    // 4. Bersihkan cache data tempatan (localStorage) supaya data paling terkini sentiasa dimuatkan dari server
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('labbook_bookings');
      localStorage.removeItem('labbook_bookings_v4');
      localStorage.removeItem('labbook_bookings_cache');
    }

    console.log("[LabBook System] Cache tempatan pengguna telah dibersihkan secara automatik pada waktu masuk laman web.");
  } catch (e) {
    console.warn("Gagal membersihkan cache secara automatik:", e);
  }
}

// Jalankan pembersihan cache serta-merta pada permulaan muat laman
autoClearUserCache();



// Ganti dengan Google Client ID anda daripada Google Cloud Console
const GOOGLE_CLIENT_ID = "118978054225-587be9hupkr97ovm0c5dp4eks3fjngdc.apps.googleusercontent.com";

const TIME_SLOTS = [
  "08:00 - 08:30",
  "08:30 - 09:00",
  "09:00 - 09:30",
  "09:30 - 10:00",
  "10:00 - 10:30",
  "10:30 - 11:00",
  "11:00 - 11:30",
  "11:30 - 12:00",
  "12:00 - 12:30",
  "12:30 - 13:00",
  "13:00 - 13:30",
  "13:30 - 14:00",
  "14:00 - 14:30"
];

const DAY_NAMES_MY = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
const MONTH_NAMES_MY = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

class DateUtils {
  static getSunday(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  static getMonday(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  static formatDateIso(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static getFormattedOffsetDate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return DateUtils.formatDateIso(d);
  }

  static getTodayIso() {
    return DateUtils.formatDateIso(new Date());
  }

  static getTomorrowIso() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return DateUtils.formatDateIso(d);
  }

  static isAtLeastOneDayInAdvance(dateInput) {
    const norm = DateUtils.normalizeDate(dateInput);
    if (!norm) return false;
    const tomorrowIso = DateUtils.getTomorrowIso();
    return norm >= tomorrowIso;
  }

  static normalizeDate(dateInput) {
    if (!dateInput) return '';
    let str = String(dateInput).trim();
    if (str.includes('T')) {
      const dObj = new Date(str);
      if (!isNaN(dObj.getTime())) {
        return DateUtils.formatDateIso(dObj);
      }
      str = str.split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return DateUtils.formatDateIso(d);
    }
    return str;
  }

  static normalizeSlot(slotInput) {
    if (!slotInput) return '';
    let str = String(slotInput).toUpperCase().replace(/AM|PM/g, '').trim();
    const parts = str.split(/[\-\–\—]/);
    if (parts.length === 2) {
      let start = parts[0].trim().replace('.', ':');
      let end = parts[1].trim().replace('.', ':');
      if (start.length === 4 && start.includes(':')) start = '0' + start;
      if (end.length === 4 && end.includes(':')) end = '0' + end;
      return `${start} - ${end}`;
    }
    return str;
  }
}

const ALL_CLASSES = {
  "1 UTARID": { className: "1 UTARID", level: "Tahap 1", subject: "1 UTARID" },
  "2 ZUHRAH": { className: "2 ZUHRAH", level: "Tahap 1", subject: "2 ZUHRAH" },
  "3 MARIKH": { className: "3 MARIKH", level: "Tahap 1", subject: "3 MARIKH" },
  "4 MUSYTARI": { className: "4 MUSYTARI", level: "Tahap 2", subject: "4 MUSYTARI" },
  "5 ZUHAL": { className: "5 ZUHAL", level: "Tahap 2", subject: "5 ZUHAL" },
  "6 NEPTUN": { className: "6 NEPTUN", level: "Tahap 2", subject: "6 NEPTUN" }
};

/**
 * Matriks Rotasi Jadual Mingguan (Kitaran 3 Minggu):
 * 1. WAJIB menggunakan SEMUA 5 hari persekolahan (Ahad hingga Khamis).
 * 2. Slot penggunaan BERUBAH dan PELBAGAI setiap hari & minggu (08:00-10:00, 08:30-10:30, 10:30-12:30, 11:00-13:00, 11:30-13:30).
 * 3. Setiap hari ADA WAKTU TERBUKA untuk guru lain membuat tempahan makmal (5 hingga 9 slot sehari).
 * 4. Mematuhi perhimpunan rasmi Ahad (08:00-08:30), rehat Tahap 1 (10:00-10:30), rehat Tahap 2 (10:30-11:00), dan waktu balik SKPT.
 */
const ROTATING_WEEKLY_SCHEDULES = [
  // ===================== MINGGU 1 =====================
  [
    {
      dayIndex: 0,
      dayName: "Ahad",
      className: "4 MUSYTARI",
      slots: ["08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00", "10:00 - 10:30"],
      timeDesc: "08:30 AM - 10:30 AM",
      timeNote: "Selepas Perhimpunan Rasmi Ahad (08:00-08:30) & sebelum Rehat Tahap 2 (10:30-11:00)",
      teacherFreeTime: "10:30 AM - 02:30 PM",
      teacherFreeSlotsCount: 7
    },
    {
      dayIndex: 1,
      dayName: "Isnin",
      className: "1 UTARID",
      slots: ["08:00 - 08:30", "08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00"],
      timeDesc: "08:00 AM - 10:00 AM",
      timeNote: "Awal pagi sebelum Rehat Tahap 1 (10:00-10:30)",
      teacherFreeTime: "10:00 AM - 02:30 PM",
      teacherFreeSlotsCount: 8
    },
    {
      dayIndex: 2,
      dayName: "Selasa",
      className: "5 ZUHAL",
      slots: ["11:00 - 11:30", "11:30 - 12:00", "12:00 - 12:30", "12:30 - 13:00"],
      timeDesc: "11:00 AM - 01:00 PM",
      timeNote: "Selepas Rehat Tahap 2 (10:30-11:00) & sebelum Waktu Balik (13:30)",
      teacherFreeTime: "08:00 AM - 11:00 AM & 01:00 PM - 02:30 PM",
      teacherFreeSlotsCount: 9
    },
    {
      dayIndex: 3,
      dayName: "Rabu",
      className: "2 ZUHRAH",
      slots: ["10:30 - 11:00", "11:00 - 11:30", "11:30 - 12:00", "12:00 - 12:30"],
      timeDesc: "10:30 AM - 12:30 PM",
      timeNote: "Selepas Rehat Tahap 1 (10:00-10:30) & tamat tepat Waktu Balik Awal Rabu (12:30)",
      teacherFreeTime: "08:00 AM - 10:30 AM & 12:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 9
    },
    {
      dayIndex: 4,
      dayName: "Khamis",
      className: "3 MARIKH",
      slots: ["08:00 - 08:30", "08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00"],
      timeDesc: "08:00 AM - 10:00 AM",
      timeNote: "Awal pagi sebelum Rehat Tahap 1 (10:00-10:30)",
      teacherFreeTime: "10:00 AM - 11:30 AM & 01:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 5
    },
    {
      dayIndex: 4,
      dayName: "Khamis",
      className: "6 NEPTUN",
      slots: ["11:30 - 12:00", "12:00 - 12:30", "12:30 - 13:00", "13:00 - 13:30"],
      timeDesc: "11:30 AM - 01:30 PM",
      timeNote: "Selepas Rehat Tahap 2 (10:30-11:00) & tamat tepat Waktu Balik (13:30)",
      teacherFreeTime: "10:00 AM - 11:30 AM & 01:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 5
    }
  ],

  // ===================== MINGGU 2 =====================
  [
    {
      dayIndex: 0,
      dayName: "Ahad",
      className: "5 ZUHAL",
      slots: ["08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00", "10:00 - 10:30"],
      timeDesc: "08:30 AM - 10:30 AM",
      timeNote: "Selepas Perhimpunan Rasmi Ahad (08:00-08:30) & sebelum Rehat Tahap 2 (10:30-11:00)",
      teacherFreeTime: "10:30 AM - 02:30 PM",
      teacherFreeSlotsCount: 7
    },
    {
      dayIndex: 1,
      dayName: "Isnin",
      className: "2 ZUHRAH",
      slots: ["08:00 - 08:30", "08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00"],
      timeDesc: "08:00 AM - 10:00 AM",
      timeNote: "Awal pagi sebelum Rehat Tahap 1 (10:00-10:30)",
      teacherFreeTime: "10:00 AM - 11:00 AM & 01:00 PM - 02:30 PM",
      teacherFreeSlotsCount: 5
    },
    {
      dayIndex: 1,
      dayName: "Isnin",
      className: "6 NEPTUN",
      slots: ["11:00 - 11:30", "11:30 - 12:00", "12:00 - 12:30", "12:30 - 13:00"],
      timeDesc: "11:00 AM - 01:00 PM",
      timeNote: "Selepas Rehat Tahap 2 (10:30-11:00) & sebelum Waktu Balik (13:30)",
      teacherFreeTime: "10:00 AM - 11:00 AM & 01:00 PM - 02:30 PM",
      teacherFreeSlotsCount: 5
    },
    {
      dayIndex: 2,
      dayName: "Selasa",
      className: "3 MARIKH",
      slots: ["10:30 - 11:00", "11:00 - 11:30", "11:30 - 12:00", "12:00 - 12:30"],
      timeDesc: "10:30 AM - 12:30 PM",
      timeNote: "Selepas Rehat Tahap 1 (10:00-10:30) & sebelum Waktu Balik (13:00)",
      teacherFreeTime: "08:00 AM - 10:30 AM & 12:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 9
    },
    {
      dayIndex: 3,
      dayName: "Rabu",
      className: "4 MUSYTARI",
      slots: ["11:30 - 12:00", "12:00 - 12:30", "12:30 - 13:00", "13:00 - 13:30"],
      timeDesc: "11:30 AM - 01:30 PM",
      timeNote: "Selepas Rehat Tahap 2 (10:30-11:00) & tamat tepat Waktu Balik (13:30)",
      teacherFreeTime: "08:00 AM - 11:30 AM & 01:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 9
    },
    {
      dayIndex: 4,
      dayName: "Khamis",
      className: "1 UTARID",
      slots: ["08:00 - 08:30", "08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00"],
      timeDesc: "08:00 AM - 10:00 AM",
      timeNote: "Awal pagi sebelum Rehat Tahap 1 (10:00-10:30) & tamat sebelum Pulang Awal (12:30)",
      teacherFreeTime: "10:00 AM - 02:30 PM",
      teacherFreeSlotsCount: 8
    }
  ],

  // ===================== MINGGU 3 =====================
  [
    {
      dayIndex: 0,
      dayName: "Ahad",
      className: "6 NEPTUN",
      slots: ["08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00", "10:00 - 10:30"],
      timeDesc: "08:30 AM - 10:30 AM",
      timeNote: "Selepas Perhimpunan Rasmi Ahad (08:00-08:30) & sebelum Rehat Tahap 2 (10:30-11:00)",
      teacherFreeTime: "10:30 AM - 02:30 PM",
      teacherFreeSlotsCount: 7
    },
    {
      dayIndex: 1,
      dayName: "Isnin",
      className: "4 MUSYTARI",
      slots: ["11:00 - 11:30", "11:30 - 12:00", "12:00 - 12:30", "12:30 - 13:00"],
      timeDesc: "11:00 AM - 01:00 PM",
      timeNote: "Selepas Rehat Tahap 2 (10:30-11:00) & sebelum Waktu Balik (13:30)",
      teacherFreeTime: "08:00 AM - 11:00 AM & 01:00 PM - 02:30 PM",
      teacherFreeSlotsCount: 9
    },
    {
      dayIndex: 2,
      dayName: "Selasa",
      className: "1 UTARID",
      slots: ["08:00 - 08:30", "08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00"],
      timeDesc: "08:00 AM - 10:00 AM",
      timeNote: "Awal pagi sebelum Rehat Tahap 1 (10:00-10:30)",
      teacherFreeTime: "10:00 AM - 02:30 PM",
      teacherFreeSlotsCount: 8
    },
    {
      dayIndex: 3,
      dayName: "Rabu",
      className: "3 MARIKH",
      slots: ["10:30 - 11:00", "11:00 - 11:30", "11:30 - 12:00", "12:00 - 12:30"],
      timeDesc: "10:30 AM - 12:30 PM",
      timeNote: "Selepas Rehat Tahap 1 (10:00-10:30) & tamat tepat Waktu Balik Awal Rabu (12:30)",
      teacherFreeTime: "08:00 AM - 10:30 AM & 12:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 9
    },
    {
      dayIndex: 4,
      dayName: "Khamis",
      className: "2 ZUHRAH",
      slots: ["08:00 - 08:30", "08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00"],
      timeDesc: "08:00 AM - 10:00 AM",
      timeNote: "Awal pagi sebelum Rehat Tahap 1 (10:00-10:30) & tamat sebelum Pulang Awal (12:30)",
      teacherFreeTime: "10:00 AM - 11:30 AM & 01:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 5
    },
    {
      dayIndex: 4,
      dayName: "Khamis",
      className: "5 ZUHAL",
      slots: ["11:30 - 12:00", "12:00 - 12:30", "12:30 - 13:00", "13:00 - 13:30"],
      timeDesc: "11:30 AM - 01:30 PM",
      timeNote: "Selepas Rehat Tahap 2 (10:30-11:00) & tamat tepat Waktu Balik (13:30)",
      teacherFreeTime: "10:00 AM - 11:30 AM & 01:30 PM - 02:30 PM",
      teacherFreeSlotsCount: 5
    }
  ]
];

/**
 * Menghasilkan jadual waktu mingguan kelas (Tahun 1 hingga 6).
 * Menyokong rotasi adil kitaran 3 minggu merangkumi Ahad hingga Khamis dengan slot berubah-ubah.
 * @param {number} weekOffset - Indeks minggu (0 = Minggu 1, 1 = Minggu 2, 2 = Minggu 3, dst.)
 * @param {boolean} enableRotation - Benarkan penggiliran bergilir setiap minggu (lalai: benar)
 */
function getWeeklyClassSchedule(weekOffset = 0, enableRotation = true) {
  const rotIdx = enableRotation ? (Math.abs(weekOffset) % ROTATING_WEEKLY_SCHEDULES.length) : 0;
  const rawList = ROTATING_WEEKLY_SCHEDULES[rotIdx];

  const schedule = rawList.map(entry => {
    const classInfo = ALL_CLASSES[entry.className] || {
      className: entry.className,
      level: entry.className.startsWith('1') || entry.className.startsWith('2') || entry.className.startsWith('3') ? 'Tahap 1' : 'Tahap 2',
      subject: `Pelajaran Komputer - ${entry.className}`
    };

    return {
      dayIndex: entry.dayIndex,
      dayName: entry.dayName,
      className: classInfo.className,
      level: classInfo.level,
      subject: classInfo.subject,
      slots: entry.slots,
      timeDesc: entry.timeDesc,
      teacherFreeTime: entry.teacherFreeTime,
      teacherFreeSlotsCount: entry.teacherFreeSlotsCount,
      notes: `Jadual Rasmi Mingguan (Giliran Minggu ${(weekOffset % 3) + 1}): ${entry.timeNote}`
    };
  });

  // Susun mengikut hari (Ahad -> Isnin -> Selasa -> Rabu -> Khamis) dan slot masa
  schedule.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.slots[0].localeCompare(b.slots[0]);
  });

  return schedule;
}

// Untuk keserasian kod sedia ada
const WEEKLY_CLASS_SCHEDULE_TEMPLATE = getWeeklyClassSchedule(0, false);

