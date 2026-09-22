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
    return booking;
  }

  approveBooking(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = "Diluluskan";
      this.save();
      this.syncToAddSheet(booking);
    }
  }

  rejectBooking(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = "Dibatalkan";
      this.save();
      this.syncToCancelSheet(id);
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
