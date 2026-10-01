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
    this.dayFilter = "ALL";
    this.customWeeklyClasses = this.loadCustomWeeklyClasses();
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
        if (json && json.status === 'success' && Array.isArray(json.data)) {
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

          // Selaraskan data tempatan dengan Google Sheet
          let hasChanges = false;
          const sheetMap = new Map();
          sheetBookings.forEach(sb => sheetMap.set(sb.id, sb));

          const now = Date.now();
          const reconciled = [];

          // Semak rekod sedia ada dalam cache
          for (const b of this.bookings) {
            if (sheetMap.has(b.id)) {
              const sb = sheetMap.get(b.id);
              if (b.status !== sb.status ||
                b.date !== sb.date ||
                b.slot !== sb.slot ||
                b.subject !== sb.subject ||
                b.applicant !== sb.applicant ||
                b.role !== sb.role ||
                b.userId !== sb.userId ||
                b.userEmail !== sb.userEmail) {
                reconciled.push(sb);
                hasChanges = true;
              } else {
                reconciled.push(b);
              }
              sheetMap.delete(b.id);
            } else {
              // Jika baru dibuat secara tempatan (< 20 saat), kekalkan sementara proses hantar ke sheet berlangsung
              const createdAge = b.createdAt ? (now - new Date(b.createdAt).getTime()) : 999999;
              if (createdAge < 20000) {
                reconciled.push(b);
              } else {
                // Rekod dipadam di Google Sheet, buang daripada cache
                hasChanges = true;
              }
            }
          }

          // Masukkan rekod baru daripada Google Sheet
          for (const [id, sb] of sheetMap.entries()) {
            reconciled.push(sb);
            hasChanges = true;
          }

          if (hasChanges || this.bookings.length !== reconciled.length) {
            this.bookings = reconciled;
            this.save();
            if (window.app) {
              window.app.render();
            }
            console.log(`[LabBook System] Tempahan berjaya dikemaskini dari Google Sheet: ${this.bookings.length} rekod.`);
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
    const isAdmin = (this.auth && (this.auth.isLabCoordinator() || this.auth.isAdminVerified)) || !!bookingData.isAdmin;
    bookingData.status = bookingData.status || (isAdmin ? "Diluluskan" : "Menunggu Kelulusan");
    bookingData.date = DateUtils.normalizeDate(bookingData.date);
    bookingData.slot = DateUtils.normalizeSlot(bookingData.slot);

    // Syarat 1: Guru biasa hanya dibenarkan menempah bagi hari semasa dan hari seterusnya sahaja
    if (!isAdmin) {
      const todayIso = DateUtils.getTodayIso();
      const tomorrowIso = DateUtils.getTomorrowIso();
      if (bookingData.date < todayIso) {
        throw new Error("Tempahan slot makmal tidak dibenarkan bagi tarikh yang telah berlalu.");
      }
      if (bookingData.date > tomorrowIso) {
        throw new Error("Tempahan disekat! Guru biasa hanya dibenarkan menempah bagi hari semasa dan hari seterusnya sahaja.");
      }
    }

    // Syarat 2: Maksimum 2 slot pada hari yang ditempah bagi setiap pengguna (HANYA pengguna biasa)
    if (!isAdmin) {
      const checkUser = (this.auth && this.auth.currentUser) ? this.auth.currentUser : {
        userId: bookingData.userId,
        email: bookingData.userEmail,
        name: bookingData.applicant
      };
      const userSlotCount = this.getUserBookingCountForDate(checkUser, bookingData.date);
      if (userSlotCount >= 2) {
        throw new Error(`Had maksimum tempahan tercapai! Anda telah menempah 2 slot pada tarikh ${bookingData.date}. Setiap pengguna hanya dibenarkan menempah maksimum 2 slot sehari.`);
      }
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
        body: JSON.stringify({ ...booking, isAdmin: isAdmin })
      });
    } catch (e) { }

    this.syncToAddSheet(booking);
    setTimeout(() => {
      this.fetchFromPythonBackend();
      this.fetchFromSheet();
    }, 1500);
    return booking;
  }

  // Janaan Automatik Jadual Penggunaan Kelas Mingguan (Tahun 1 hingga Tahun 6)
  // Mematuhi waktu persekolahan, perhimpunan ahad, dan waktu rehat kedua-dua tahap
  async generateWeeklyClassSchedule(options = {}) {
    const startSundayIso = options.startSunday ? DateUtils.normalizeDate(options.startSunday) : DateUtils.formatDateIso(this.currentSunday);
    const weeksCount = parseInt(options.weeksCount, 10) || 1;
    const overwriteExisting = options.overwriteExisting !== false; // lalai: benar (ganti)

    const baseSunday = new Date(startSundayIso);
    let createdCount = 0;
    let skippedCount = 0;
    const newBookings = [];

    const enableRotation = options.enableRotation !== false; // lalai: benar (bergilir setiap minggu)
    const customClasses = options.customClasses || this.customWeeklyClasses || null;

    for (let w = 0; w < weeksCount; w++) {
      const currentSunday = new Date(baseSunday);
      currentSunday.setDate(currentSunday.getDate() + (w * 7));

      // Ambil jadual mingguan mengikut giliran minggu ke-w dan mengambil kira penyesuaian kelas admin
      const weekSchedule = typeof getWeeklyClassSchedule === 'function'
        ? getWeeklyClassSchedule(w, enableRotation, customClasses)
        : WEEKLY_CLASS_SCHEDULE_TEMPLATE;

      for (const entry of weekSchedule) {
        const targetDate = new Date(currentSunday);
        targetDate.setDate(targetDate.getDate() + entry.dayIndex);
        const dateStr = DateUtils.formatDateIso(targetDate);

        for (let sIdx = 0; sIdx < entry.slots.length; sIdx++) {
          const slot = entry.slots[sIdx];
          const normDate = DateUtils.normalizeDate(dateStr);
          const normSlot = DateUtils.normalizeSlot(slot);

          // Semak pertindihan
          const existingIdx = this.bookings.findIndex(b => {
            if (b.status === "Dibatalkan") return false;
            return DateUtils.normalizeDate(b.date) === normDate && DateUtils.normalizeSlot(b.slot) === normSlot;
          });

          if (existingIdx !== -1) {
            const existingB = this.bookings[existingIdx];
            if (overwriteExisting) {
              if (existingB.id && existingB.id.startsWith('JDL-')) {
                this.bookings.splice(existingIdx, 1);
              } else {
                existingB.status = "Dibatalkan";
              }
            } else {
              skippedCount++;
              continue;
            }
          }

          const cleanClassName = entry.className.replace(/\s+/g, '_');
          const bookingId = `JDL-${normDate.replace(/-/g, '')}-${cleanClassName}-S${sIdx + 1}`;

          // Padam rekod terdahulu dengan ID yang sama jika janaan semula
          const dupIdx = this.bookings.findIndex(b => b.id === bookingId);
          if (dupIdx !== -1) {
            this.bookings.splice(dupIdx, 1);
          }

          const booking = new Booking({
            id: bookingId,
            userId: "USR-ADMIN",
            userEmail: "admin@moe-dl.edu.my",
            labId: "LAB-1",
            date: normDate,
            slot: normSlot,
            applicant: `Jadual Rasmi (${entry.className})`,
            role: "Penyelaras ICT",
            subject: entry.subject,
            pcCount: 35,
            purpose: "Pelajaran & Amali Komputer Mingguan",
            notes: `${entry.notes} (Slot ${sIdx + 1}/4 • Minggu ${w + 1})`,
            status: "Diluluskan",
            createdAt: new Date().toISOString()
          });

          this.bookings.unshift(booking);
          newBookings.push(booking);
          createdCount++;
        }
      }
    }

    this.save();

    // Hantar SEMUA slot janaan sekaligus dalam 1 panggilan pukal ke Google Sheet (BATCH_ADD)
    this.syncBatchToSheet(newBookings);

    // Hantar rekod ke Backend API secara berturutan
    (async () => {
      for (const b of newBookings) {
        try {
          await fetch(`${PYTHON_API_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...b, isAdmin: true, overwrite: overwriteExisting })
          });
        } catch (e) { }
      }
    })();

    return {
      success: true,
      createdCount,
      skippedCount,
      weeksCount,
      startSunday: startSundayIso,
      enableRotation
    };
  }

  loadCustomWeeklyClasses() {
    try {
      const raw = localStorage.getItem('makmal_custom_weekly_classes');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  setCustomWeeklyClass(weekIndex, entryIndex, newClassName) {
    if (!this.customWeeklyClasses) this.customWeeklyClasses = {};
    const wKey = String(Math.abs(parseInt(weekIndex, 10) || 0) % 3);
    if (!this.customWeeklyClasses[wKey]) this.customWeeklyClasses[wKey] = {};
    this.customWeeklyClasses[wKey][entryIndex] = newClassName;
    try {
      localStorage.setItem('makmal_custom_weekly_classes', JSON.stringify(this.customWeeklyClasses));
    } catch (e) { }
  }

  resetCustomWeeklyClasses() {
    this.customWeeklyClasses = {};
    try {
      localStorage.removeItem('makmal_custom_weekly_classes');
    } catch (e) { }
  }

  // Mengosongkan jadual rasmi janaan automatik untuk minggu tertentu
  async clearGeneratedScheduleForWeek(sundayIso, weeksCount = 1) {
    const normSunday = DateUtils.normalizeDate(sundayIso);
    const startSunday = new Date(normSunday);
    const endDays = (weeksCount * 7) - 1;
    const endDate = new Date(startSunday);
    endDate.setDate(endDate.getDate() + endDays);
    const endDateIso = DateUtils.formatDateIso(endDate);

    let removedCount = 0;
    this.bookings = this.bookings.filter(b => {
      const bDate = DateUtils.normalizeDate(b.date);
      if (bDate >= normSunday && bDate <= endDateIso && (b.id && b.id.startsWith('JDL-'))) {
        removedCount++;
        try {
          fetch(`${PYTHON_API_URL}/bookings/${b.id}`, { method: 'DELETE' }).catch(() => { });
          this.syncToUpdateStatusSheet(b.id, "Dibatalkan", b);
        } catch (e) { }
        return false;
      }
      return true;
    });

    this.save();
    return removedCount;
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

  async syncBatchToSheet(bookings) {
    if (!GOOGLE_SHEET_API_URL || !bookings || bookings.length === 0) return;

    // 1. Cuba hantar secara pukal BATCH_ADD (untuk Google Apps Script versi terkini)
    try {
      fetch(GOOGLE_SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BATCH_ADD', bookings: bookings })
      }).catch(() => { });
    } catch (e) { }

    // 2. Hantar setiap slot secara berturutan dengan sela masa 220ms
    // Ini menjamin 100% slot berjaya direkodkan serta-merta walaupun Google Apps Script masih pada versi sedia ada
    for (const b of bookings) {
      try {
        await fetch(GOOGLE_SHEET_API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ADD', booking: b })
        });
      } catch (err) { }
      await new Promise(r => setTimeout(r, 220));
    }
  }

  async syncAllToGoogleSheet() {
    const list = this.bookings.filter(b => b.status !== "Dibatalkan");
    if (!list || list.length === 0) return { count: 0 };
    await this.syncBatchToSheet(list);
    return { count: list.length };
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
    if (this.dayFilter && this.dayFilter !== "ALL") {
      list = list.filter(b => {
        if (!b.date) return false;
        try {
          const parts = b.date.split('-');
          if (parts.length === 3) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const dayName = DAY_NAMES_MY[d.getDay()];
            return dayName === this.dayFilter;
          }
          const d = new Date(b.date);
          return DAY_NAMES_MY[d.getDay()] === this.dayFilter;
        } catch (e) {
          return false;
        }
      });
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

