/* ==========================================================================
   LABBOOK - CONFIGURATION & DATE UTILITIES
   ========================================================================== */

const LABS = [
  { id: 'LAB-1', name: 'Makmal Komputer Utama', location: 'Tingkat 1', pcs: 35, specs: 'Core i7, 16GB RAM' }
];

// Paste Google Apps Script Web App URL here to enable live Google Sheets sync
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyW2XGJr3vVwZH-bUOc-GNjMx4mdcZyd-0D16yUMVZb5tbLHGueArzNtBXsySQlOwSn/exec";


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
}
