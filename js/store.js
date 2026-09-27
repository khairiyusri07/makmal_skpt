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
    this.fetchFromPythonBackend();
    this.fetchFromSheet();
  }

  startAutoPolling(intervalMs = 4000) {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      this.fetchFromPythonBackend();
      this.fetchFromSheet();
    }, intervalMs);
  }

  async fetchFromPythonBackend() {
    try {
      const res = await fetch(`${PYTHON_API_URL}/bookings`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 'success' && Array.isArray(json.data)) {
          const apiBookings = json.data.map(item => new Booking(item));
          if (apiBookings.length > 0) {
            let updated = false;
            apiBookings.forEach(ab => {
              const idx = this.bookings.findIndex(b => b.id === ab.id);
              if (idx !== -1) {
                if (this.bookings[idx].status !== ab.status ||
                    this.bookings[idx].date !== ab.date ||
                    this.bookings[idx].slot !== ab.slot ||
                    this.bookings[idx].subject !== ab.subject) {
                  this.bookings[idx] = ab;
                  updated = true;
                }
              } else {
                this.bookings.push(ab);
                updated = true;
              }
            });

            if (updated || this.bookings.length === 0) {
              this.save();
              if (window.app) {
                window.app.render();
              }
            }
          }
        }
      }
    } catch (err) {
      // Backend might be offline or starting up
    }
  }

  async fetchFromSheet() {
    if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.includes("YOUR_SCRIPT_ID")) return;
    try {
      const res = await fetch(GOOGLE_SHEET_API_URL);
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          const sheetBookings = json.data
            .map(row => {
              const rId = row.id || row.ID || row.Id;
              const rDate = row.date || row.Date || row.Tarikh || row.tarikh || row["Tarikh"];
              const rSlot = row.slot || row.Slot || row["Slot Masa"] || row.slotMasa || row.SlotMasa || row["Slot"];
              const rApplicant = row.applicant || row.Applicant || row["Nama Pemohon"] || row.namaPemohon;
              const rRole = row.role || row.Role || row.Peranan || row.peranan;
              const rSubject = row.subject || row.Subject || row["Kelas / Subjek"] || row["Kelas/Subjek"] || row.kelasSubjek || row.subjek || row.Kelas;
              const rStatus = row.status || row.Status;
              const rCreatedAt = row.createdAt || row["Tarikh Dicipta"] || row.tarikhDicipta;

              if (!rId || !rDate || !rSlot) return null;

              return new Booking({
                id: String(rId),
                labId: 'LAB-1',
                date: DateUtils.normalizeDate(rDate),
                slot: DateUtils.normalizeSlot(rSlot),
                applicant: rApplicant || 'Guru',
                role: rRole || 'Guru / Tenaga Pengajar',
                subject: rSubject || 'Tempahan',
                pcCount: 35,
                purpose: '',
                status: rStatus || 'Menunggu Kelulusan',
                createdAt: rCreatedAt || new Date().toISOString()
              });
            })
            .filter(b => b !== null);

          if (sheetBookings.length > 0) {
            let updated = false;
            sheetBookings.forEach(sb => {
              const idx = this.bookings.findIndex(b => b.id === sb.id);
              if (idx !== -1) {
                if (this.bookings[idx].status !== sb.status ||
                    this.bookings[idx].date !== sb.date ||
                    this.bookings[idx].slot !== sb.slot ||
                    this.bookings[idx].subject !== sb.subject) {
                  this.bookings[idx] = sb;
                  updated = true;
                }
              } else {
                this.bookings.push(sb);
                updated = true;
              }
            });

            if (updated) {
              this.save();
              if (window.app) {
                window.app.render();
              }
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

  async addBooking(bookingData) {
    bookingData.status = "Menunggu Kelulusan";
    bookingData.date = DateUtils.normalizeDate(bookingData.date);
    bookingData.slot = DateUtils.normalizeSlot(bookingData.slot);
    const booking = new Booking(bookingData);
    this.bookings.unshift(booking);
    this.save();

    // Sync to Python Flask backend
    try {
      await fetch(`${PYTHON_API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });
    } catch (e) { }

    this.syncToAddSheet(booking);
    setTimeout(() => {
      this.fetchFromPythonBackend();
      this.fetchFromSheet();
    }, 1500);
    return booking;
  }

  async approveBooking(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = "Diluluskan";
      this.save();

      // Sync to Python Flask backend
      try {
        await fetch(`${PYTHON_API_URL}/bookings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: "Diluluskan" })
        });
      } catch (e) { }

      this.syncToAddSheet(booking);
      setTimeout(() => {
        this.fetchFromPythonBackend();
        this.fetchFromSheet();
      }, 1500);
    }
  }

  async rejectBooking(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = "Dibatalkan";
      this.save();

      // Sync to Python Flask backend
      try {
        await fetch(`${PYTHON_API_URL}/bookings/${id}`, {
          method: 'DELETE'
        });
      } catch (e) { }

      this.syncToCancelSheet(id);
      setTimeout(() => {
        this.fetchFromPythonBackend();
        this.fetchFromSheet();
      }, 1500);
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
    const normDate = DateUtils.normalizeDate(date);
    const normSlot = DateUtils.normalizeSlot(slot);
    return this.bookings.find(b => {
      if (b.status === "Dibatalkan") return false;
      return DateUtils.normalizeDate(b.date) === normDate && DateUtils.normalizeSlot(b.slot) === normSlot;
    });
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

