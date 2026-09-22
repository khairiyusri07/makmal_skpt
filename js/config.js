/* ==========================================================================
   LABBOOK - CONFIGURATION & DATE UTILITIES
   ========================================================================== */

const LABS = [
  { id: 'LAB-1', name: 'Makmal Komputer Utama', location: 'Tingkat 1', pcs: 35, specs: 'Core i7, 16GB RAM' }
];

// Paste Google Apps Script Web App URL here to enable live Google Sheets sync
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwY0yrSpvDkR8KrYPEH8__mhJXRv8KmOGzvKjpqoFqDo7MbdrB7xG3KgAAhhYzpp4Fp/exec";


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

  static normalizeDate(dateInput) {
    if (!dateInput) return '';
    let str = String(dateInput).trim();
    if (str.includes('T')) {
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
