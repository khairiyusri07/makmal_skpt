/* ==========================================================================
   LABBOOK - BOOKING DATA STORE & GOOGLE SHEETS SYNC
   ========================================================================== */

class BookingStore {
  constructor(authStore) {
    this.auth = authStore;
    this.bookings = [];
    this.currentSunday = DateUtils.getSunday(new Date());
    this.searchQuery = "";
    this.statusFilter = "ALL";
    this.load();
    this.startAutoPolling(4000);

    // Immediate background fetch whenever user returns to tab or window focus
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.fetchFromSheet();
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.fetchFromSheet();
      });
    }
  }

  load() {
    const saved = localStorage.getItem('labbook_bookings_v4');
    if (saved) {
      try {
        const raw = JSON.parse(saved);
        this.bookings = raw.map(b => new Booking(b));
      } catch (e) {
        this.bookings = [];
      }
    } else {
      this.bookings = [];
    }
    this.fetchFromSheet();
  }

  startAutoPolling(intervalMs = 4000) {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      this.fetchFromSheet();
    }, intervalMs);
  }

  async fetchFromSheet() {
    if (!GOOGLE_SHEET_API_URL) return;
    try {
      const res = await fetch(GOOGLE_SHEET_API_URL);
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 'success' && Array.isArray(json.data)) {
          const sheetBookings = json.data
            .filter(row => row.id && row.date && row.slot)
            .map(row => new Booking({
              id: String(row.id),
              labId: 'LAB-1',
              date: String(row.date),
              slot: String(row.slot),
              applicant: row.applicant || 'Guru',
              role: row.role || 'Guru / Tenaga Pengajar',
              subject: row.subject || 'Tempahan',
              pcCount: 35,
              purpose: '',
              status: row.status || 'Menunggu Kelulusan',
              createdAt: row.createdAt || new Date().toISOString()
            }));

          const newJson = JSON.stringify(sheetBookings.map(b => ({ id: b.id, status: b.status, date: b.date, slot: b.slot, applicant: b.applicant, subject: b.subject })));
          const currentJson = JSON.stringify(this.bookings.map(b => ({ id: b.id, status: b.status, date: b.date, slot: b.slot, applicant: b.applicant, subject: b.subject })));

          if (newJson !== currentJson) {
            this.bookings = sheetBookings;
            this.save();
            if (window.app) {
              window.app.render();
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch bookings from Google Sheet API:", err);
    }
  }

  save() {
    localStorage.setItem('labbook_bookings_v4', JSON.stringify(this.bookings));
  }

  addBooking(bookingData) {
    bookingData.status = "Menunggu Kelulusan";
    const booking = new Booking(bookingData);
    this.bookings.unshift(booking);
    this.save();
    this.syncToAddSheet(booking);
    setTimeout(() => this.fetchFromSheet(), 2000);
    return booking;
  }

  approveBooking(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = "Diluluskan";
      this.save();
      this.syncToAddSheet(booking);
      setTimeout(() => this.fetchFromSheet(), 2000);
    }
  }

  rejectBooking(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = "Dibatalkan";
      this.save();
      this.syncToCancelSheet(id);
      setTimeout(() => this.fetchFromSheet(), 2000);
    }
  }

  cancelBooking(id) {
    this.rejectBooking(id);
  }

  syncToAddSheet(booking) {
    if (!GOOGLE_SHEET_API_URL) return;
    try {
      fetch(GOOGLE_SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADD', booking: booking })
      }).catch(err => console.error('Google Sheet Sync Error:', err));
    } catch (e) { }
  }

  syncToCancelSheet(id) {
    if (!GOOGLE_SHEET_API_URL) return;
    try {
      fetch(GOOGLE_SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CANCEL', id: id })
      }).catch(err => console.error('Google Sheet Cancel Error:', err));
    } catch (e) { }
  }

  findConflict(date, slot) {
    return this.bookings.find(b => b.date === date && b.slot === slot && b.status !== "Dibatalkan");
  }

  getFilteredBookings() {
    let list = [...this.bookings];
    if (this.searchQuery) {
      list = list.filter(b =>
        b.applicant.toLowerCase().includes(this.searchQuery) ||
        b.subject.toLowerCase().includes(this.searchQuery) ||
        b.id.toLowerCase().includes(this.searchQuery)
      );
    }
    if (this.statusFilter !== "ALL") {
      list = list.filter(b => b.status === this.statusFilter);
    }
    return list;
  }

  getWeekDays() {
    const todayIso = DateUtils.formatDateIso(new Date());
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.currentSunday);
      d.setDate(d.getDate() + i);
      const dateStr = DateUtils.formatDateIso(d);
      const dayNameStr = DAY_NAMES_MY[d.getDay()];
      const dateNum = d.getDate();
      const isToday = (dateStr === todayIso);
      weekDays.push({ dateObj: d, dateStr, dayNameStr, dateNum, isToday });
    }
    return weekDays;
  }
}

