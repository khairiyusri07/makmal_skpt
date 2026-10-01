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
    this.startAutoPolling(500);

    // Immediate background fetch whenever user returns to tab or window focus
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.fetchFromPythonBackend();
          this.fetchFromSheet();
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.fetchFromPythonBackend();
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
    }
    if (!this.bookings || this.bookings.length === 0) {
      const today = new Date();
      const sunday = DateUtils.getSunday(today);
      const monday = new Date(sunday); monday.setDate(monday.getDate() + 1);
      const tuesday = new Date(sunday); tuesday.setDate(tuesday.getDate() + 2);
      const wednesday = new Date(sunday); wednesday.setDate(wednesday.getDate() + 3);

      this.bookings = [
        new Booking({
          id: "TB-1001",
          userId: "USR-83920192",
          userEmail: "g-83920192@moe-dl.edu.my",
          labId: "LAB-1",
          date: DateUtils.formatDateIso(monday),
          slot: "08:00 - 08:30",
          applicant: "Cikgu Ahmad Razali",
          role: "Guru / Tenaga Pengajar",
          subject: "RBT Tahun 5 - Coding Scratch",
          pcCount: 35,
          purpose: "Pelajaran & Amali",
          notes: "Perlu projektor dan pembesar suara",
          status: "Diluluskan",
          createdAt: new Date().toISOString()
        }),
        new Booking({
          id: "TB-1002",
          userId: "USR-10293847",
          userEmail: "g-10293847@moe-dl.edu.my",
          labId: "LAB-1",
          date: DateUtils.formatDateIso(tuesday),
          slot: "10:00 - 10:30",
          applicant: "Cikgu Siti Nurhaliza",
          role: "Guru / Tenaga Pengajar",
          subject: "Matematik - Kuiz Digital Kahoot",
          pcCount: 35,
          purpose: "Pelajaran & Amali",
          notes: "Latihan kuiz interaktif",
          status: "Diluluskan",
          createdAt: new Date().toISOString()
        }),
        new Booking({
          id: "TB-1003",
          userId: "USR-83920192",
          userEmail: "g-83920192@moe-dl.edu.my",
          labId: "LAB-1",
          date: DateUtils.formatDateIso(wednesday),
          slot: "11:00 - 11:30",
          applicant: "Cikgu Ahmad Razali",
          role: "Guru / Tenaga Pengajar",
          subject: "Sains - Latihan Interaktif DELIMa",
          pcCount: 35,
          purpose: "Pelajaran & Amali",
          notes: "Sains Tahun 5",
          status: "Menunggu Kelulusan",
          createdAt: new Date().toISOString()
        })
      ];
      this.save();
    }
    this.fetchFromPythonBackend();
    this.fetchFromSheet();
  }

  startAutoPolling(intervalMs = 500) {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      // Fetch both database and Google Sheets every 0.5s (500ms)
      this.fetchFromPythonBackend();
      this.fetchFromSheet();
    }, intervalMs);
  }

  async fetchFromPythonBackend() {
    try {
      const apiUrl = (typeof getBackendApiUrl === 'function') ? getBackendApiUrl('/bookings') : `${PYTHON_API_URL}/bookings`;
      let res = await fetch(apiUrl);
      if (!res.ok && !apiUrl.startsWith('http')) {
        res = await fetch('http://localhost:5000/api/bookings');
      }
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
      try {
        const resFallback = await fetch('http://localhost:5000/api/bookings');
        if (resFallback.ok) {
          const json = await resFallback.json();
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
      } catch (e2) { }
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
              const rUserId = row.userId || row.UserID || row.userid || row["UserID"] || "";
              const rDate = row.date || row.Date || row.Tarikh || row.tarikh || row["Tarikh"];
              const rSlot = row.slot || row.Slot || row["Slot Masa"] || row.slotMasa || row.SlotMasa || row["Slot"];
              const rApplicant = row.applicant || row.Applicant || row.Pemohon || row["Nama Pemohon"] || row.namaPemohon;
              const rUserEmail = row.userEmail || row.UserEmail || row.email || row.Email || "";
              const rRole = row.role || row.Role || row.Peranan || row.peranan;
              const rSubject = row.subject || row.Subject || row.Subjek || row["Kelas / Subjek"] || row["Kelas/Subjek"] || row.kelasSubjek || row.subjek || row.Kelas;
              const rStatus = row.status || row.Status;
              const rCreatedAt = row.createdAt || row["Tarikh Dicipta"] || row.tarikhDicipta;

              if (!rId || !rDate || !rSlot) return null;

              return new Booking({
                id: String(rId),
                userId: String(rUserId || ""),
                userEmail: String(rUserEmail || ""),
                labId: 'LAB-1',
                date: DateUtils.normalizeDate(rDate),
                slot: DateUtils.normalizeSlot(rSlot),
                applicant: String(rApplicant || 'Guru'),
                role: String(rRole || 'Guru / Tenaga Pengajar'),
                subject: String(rSubject || 'Tempahan'),
                pcCount: 21,
                purpose: '',
                status: String(rStatus || 'Menunggu Kelulusan'),
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
                  this.bookings[idx].subject !== sb.subject ||
                  this.bookings[idx].applicant !== sb.applicant) {
                  this.bookings[idx] = sb;
                  updated = true;
                }
              } else {
                this.bookings.push(sb);
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
      console.warn("Could not fetch bookings from Google Sheet API:", err);
    }
  }

  save() {
    localStorage.setItem('labbook_bookings_v4', JSON.stringify(this.bookings));
  }

  async addBooking(bookingData) {
    if (this.auth && this.auth.currentUser) {
      if (!bookingData.userId) {
        bookingData.userId = this.auth.currentUser.userId || (this.auth.generateUserId ? this.auth.generateUserId(this.auth.currentUser.email) : '');
      }
      if (!bookingData.userEmail) {
        bookingData.userEmail = this.auth.currentUser.email || '';
      }
      if (!bookingData.applicant) {
        bookingData.applicant = this.auth.currentUser.name;
      }
      if (!bookingData.role) {
        bookingData.role = this.auth.currentUser.role || 'Guru / Tenaga Pengajar';
      }
    }
    bookingData.status = "Menunggu Kelulusan";
    bookingData.date = DateUtils.normalizeDate(bookingData.date);
    bookingData.slot = DateUtils.normalizeSlot(bookingData.slot);

    // Syarat 1: Sekurang-kurangnya sehari sebelum tarikh penggunaan
    if (!DateUtils.isAtLeastOneDayInAdvance(bookingData.date)) {
      throw new Error("Tempahan slot makmal hanya dibenarkan sekurang-kurangnya 1 hari sebelum tarikh penggunaan (mulai esok).");
    }

    // Syarat 2: Maksimum 2 slot pada hari yang ditempah bagi setiap pengguna
    const checkUser = (this.auth && this.auth.currentUser) ? this.auth.currentUser : {
      userId: bookingData.userId,
      email: bookingData.userEmail,
      name: bookingData.applicant
    };
    const userSlotCount = this.getUserBookingCountForDate(checkUser, bookingData.date);
    if (userSlotCount >= 2) {
      throw new Error(`Had maksimum tempahan tercapai! Anda telah menempah 2 slot pada tarikh ${bookingData.date}. Setiap pengguna hanya dibenarkan menempah maksimum 2 slot sehari.`);
    }

    // Semakan pertindihan slot
    const conflict = this.findConflict(bookingData.date, bookingData.slot);
    if (conflict) {
      throw new Error(`Slot masa ${bookingData.slot} pada tarikh ${bookingData.date} telah ditempah oleh ${conflict.applicant}.`);
    }

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

  getUserBookings(user) {
    if (!user) return [];
    const userEmail = (user.email || '').trim().toLowerCase();
    const userId = (user.userId || '').trim().toLowerCase();
    const userName = (user.name || '').trim().toLowerCase();

    return this.bookings.filter(b => {
      // 1. Match by userEmail
      if (userEmail && b.userEmail && b.userEmail.trim().toLowerCase() === userEmail) {
        return true;
      }
      // 2. Match by userId
      if (userId && b.userId && b.userId.trim().toLowerCase() === userId) {
        return true;
      }
      // 3. Match by applicant name
      if (userName && b.applicant && b.applicant.trim().toLowerCase() === userName) {
        return true;
      }
      return false;
    });
  }

  getUserBookingsForDate(user, date) {
    if (!user || !date) return [];
    const normDate = DateUtils.normalizeDate(date);
    return this.getUserBookings(user).filter(b => {
      if (b.status === "Dibatalkan") return false;
      return DateUtils.normalizeDate(b.date) === normDate;
    });
  }

  getUserBookingCountForDate(user, date) {
    return this.getUserBookingsForDate(user, date).length;
  }

  async cancelUserBooking(id, user) {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) throw new Error("Tempahan tidak dijumpai.");

    // Check ownership unless admin/coordinator
    const isOwner = this.getUserBookings(user).some(b => b.id === id);
    if (!isOwner && (!this.auth || !this.auth.isLabCoordinator())) {
      throw new Error("Anda hanya mempunyai kebenaran untuk membatalkan tempahan anda sendiri.");
    }

    booking.status = "Dibatalkan";
    this.save();

    // Sync to Python Flask backend
    try {
      await fetch(`${PYTHON_API_URL}/bookings/${id}`, {
        method: 'DELETE'
      });
    } catch (e) { }

    this.syncToUpdateStatusSheet(id, "Dibatalkan", booking);
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

      this.syncToUpdateStatusSheet(id, "Diluluskan", booking);
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

      this.syncToUpdateStatusSheet(id, "Dibatalkan", booking);
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

  syncToUpdateStatusSheet(id, status, bookingObj) {
    if (!GOOGLE_SHEET_API_URL) return;
    try {
      fetch(GOOGLE_SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STATUS', id: id, status: status, booking: bookingObj })
      }).catch(err => console.error('Google Sheet Status Update Error:', err));
    } catch (e) { }
  }

  syncToCancelSheet(id) {
    this.syncToUpdateStatusSheet(id, "Dibatalkan");
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

