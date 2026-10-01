/* ==========================================================================
   LABBOOK - UI VIEW CLASSES (HeaderView, CalendarView, TableView, ModalView)
   Google Calendar Web Interface View Layer
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. HEADER VIEW
// --------------------------------------------------------------------------
class HeaderView {
  constructor(authStore, app) {
    this.auth = authStore;
    this.app = app;
    this.dom = {
      container: document.getElementById('userProfileSection')
    };
  }

  render() {
    if (!this.dom.container) return;

    if (this.auth.isLoggedIn()) {
      const user = this.auth.currentUser;
      const initials = (user.name || 'G').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      this.dom.container.innerHTML = `
        <div class="user-profile-badge">
          <div class="user-avatar">${initials}</div>
          <div class="user-profile-info">
            <span class="user-profile-name">${user.name}</span>
            <span class="user-profile-email">${user.email}</span>
          </div>
          <button class="btn-logout-gcal" onclick="window.app.logout()" title="Log Keluar Akaun">
            <i data-lucide="log-out" style="width:14px;"></i> Keluar
          </button>
        </div>
      `;
    } else {
      this.dom.container.innerHTML = `
        <button class="btn-login-gcal" onclick="window.app.openLogin()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#ffffff" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/><path fill="#ffffff" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.1 0-5.74-2.09-6.68-4.91H1.32v3.13C3.3 21.36 7.37 24 12 24z"/><path fill="#ffffff" d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.6H1.32C.48 8.28 0 10.09 0 12s.48 3.72 1.32 5.4l4-3.13z"/><path fill="#ffffff" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.3 2.64 1.32 6.6l4 3.13c.94-2.82 3.58-4.98 6.68-4.98z"/></svg>
          Log Masuk DELIMa
        </button>
      `;
    }
  }
}

// --------------------------------------------------------------------------
// 2. CALENDAR VIEW (Google Calendar Weekly Grid + Mini Month Calendar Widget)
// --------------------------------------------------------------------------
class CalendarView {
  constructor(store, app) {
    this.store = store;
    this.app = app;
    this.dom = {
      dateRangeText: document.getElementById('gcalDateRangeText'),
      headerRow: document.getElementById('gcalHeaderRow'),
      gridBody: document.getElementById('gcalGridBody'),
      miniCalendar: document.getElementById('miniCalendarContainer')
    };
  }

  render() {
    const weekDays = this.store.getWeekDays();
    this.renderHeaderToolbar(weekDays);
    this.renderHeaderRow(weekDays);
    this.renderGridBody(weekDays);
    this.renderMiniCalendar(weekDays);
  }

  renderHeaderToolbar(weekDays) {
    const lastDayObj = weekDays[6].dateObj;
    const startDay = weekDays[0].dateNum;
    const endDay = lastDayObj.getDate();
    const startMonth = MONTH_NAMES_MY[weekDays[0].dateObj.getMonth()];
    const endMonth = MONTH_NAMES_MY[lastDayObj.getMonth()];
    const year = lastDayObj.getFullYear();

    let rangeText = (startMonth === endMonth)
      ? `${startDay} - ${endDay} ${startMonth} ${year}`
      : `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;

    if (this.dom.dateRangeText) this.dom.dateRangeText.textContent = rangeText;
  }

  renderHeaderRow(weekDays) {
    if (!this.dom.headerRow) return;
    let html = `<div class="gcal-tz-header">GMT+8</div>`;
    weekDays.forEach(day => {
      html += `
        <div class="gcal-day-col-header ${day.isToday ? 'is-today' : ''}">
          <span class="gcal-day-name-str">${day.dayNameStr}</span>
          <span class="gcal-day-num-circle">${day.dateNum}</span>
        </div>
      `;
    });
    this.dom.headerRow.innerHTML = html;
  }

  renderGridBody(weekDays) {
    if (!this.dom.gridBody) return;
    let html = '';
    TIME_SLOTS.forEach(slot => {
      html += `<div class="gcal-time-row">`;
      html += `
        <div class="gcal-time-cell">
          ${slot.split('-')[0].trim()}
        </div>
      `;

      weekDays.forEach(day => {
        const normDayDate = DateUtils.normalizeDate(day.dateStr);
        const normSlot = DateUtils.normalizeSlot(slot);

        const booking = this.store.bookings.find(b => {
          if (b.status === "Dibatalkan") return false;
          return DateUtils.normalizeDate(b.date) === normDayDate && DateUtils.normalizeSlot(b.slot) === normSlot;
        });

        if (booking) {
          const isPending = (booking.status === "Menunggu Kelulusan");
          const cardClass = isPending ? 'pending' : '';
          const badgeText = isPending ? 'MENUNGGU' : 'DITEMPAH';

          html += `
            <div class="gcal-slot-cell">
              <div class="gcal-event-block ${cardClass}" onclick="window.app.openSlip('${booking.id}')">
                <div class="gcal-event-title-text">${booking.subject}</div>
                <div class="gcal-event-applicant-text">${booking.applicant} (${badgeText})</div>
              </div>
            </div>
          `;
        } else {
          const isCoordinator = (this.store.auth && (this.store.auth.isLabCoordinator() || this.store.auth.isAdminVerified));
          const todayIso = DateUtils.getTodayIso();
          const tomorrowIso = DateUtils.getTomorrowIso();
          const isPast = day.dateStr < todayIso;
          const isExceedingTomorrow = day.dateStr > tomorrowIso;

          if (!isCoordinator && isPast) {
            html += `
              <div class="gcal-slot-cell empty-slot past-slot" 
                   title="Tempahan ditutup (Tarikh telah berlalu)"
                   onclick="window.app.openBookingModal('${day.dateStr}', '${slot}')">
              </div>
            `;
          } else if (!isCoordinator && isExceedingTomorrow) {
            html += `
              <div class="gcal-slot-cell empty-slot future-restricted-slot" 
                   title="Tempahan disekat (Hanya dibenarkan untuk hari semasa dan hari seterusnya sahaja)"
                   onclick="window.app.openBookingModal('${day.dateStr}', '${slot}')">
              </div>
            `;
          } else {
            html += `
              <div class="gcal-slot-cell empty-slot" 
                   onclick="window.app.openBookingModal('${day.dateStr}', '${slot}')">
              </div>
            `;
          }
        }
      });

      html += `</div>`;
    });

    this.dom.gridBody.innerHTML = html;
  }

  renderMiniCalendar(weekDays) {
    if (!this.dom.miniCalendar) return;
    const currentSunday = this.store.currentSunday;
    const year = currentSunday.getFullYear();
    const month = currentSunday.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay();

    const totalDays = lastDayOfMonth.getDate();
    const todayStr = DateUtils.formatDateIso(new Date());

    const activeWeekStartStr = weekDays[0].dateStr;
    const activeWeekEndStr = weekDays[6].dateStr;

    let html = `
      <div class="mini-cal-header">
        <span class="mini-cal-title">${MONTH_NAMES_MY[month]} ${year}</span>
        <div class="mini-cal-arrows">
          <button class="gcal-icon-btn" style="width:26px; height:26px;" onclick="window.app.prevWeek()">
            <i data-lucide="chevron-left" style="width:14px;"></i>
          </button>
          <button class="gcal-icon-btn" style="width:26px; height:26px;" onclick="window.app.nextWeek()">
            <i data-lucide="chevron-right" style="width:14px;"></i>
          </button>
        </div>
      </div>

      <div class="mini-cal-grid">
        <div class="mini-cal-dayname">S</div>
        <div class="mini-cal-dayname">M</div>
        <div class="mini-cal-dayname">T</div>
        <div class="mini-cal-dayname">W</div>
        <div class="mini-cal-dayname">T</div>
        <div class="mini-cal-dayname">F</div>
        <div class="mini-cal-dayname">S</div>
    `;

    for (let i = 0; i < startDayOfWeek; i++) {
      html += `<div class="mini-cal-date other-month"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = DateUtils.formatDateIso(dateObj);
      const isToday = (dateStr === todayStr);
      const isActiveWeek = (dateStr >= activeWeekStartStr && dateStr <= activeWeekEndStr);

      let classes = 'mini-cal-date';
      if (isToday) classes += ' is-today';
      else if (isActiveWeek) classes += ' active-week';

      html += `<div class="${classes}" onclick="window.app.selectMiniCalDate('${dateStr}')">${day}</div>`;
    }

    html += `</div>`;
    this.dom.miniCalendar.innerHTML = html;
  }
}

// --------------------------------------------------------------------------
// 3. TABLE VIEW (Record Management Table - Penyelaras ICT)
// --------------------------------------------------------------------------
class TableView {
  constructor(store, app) {
    this.store = store;
    this.app = app;
  }

  render() {
    this.renderBookingsList();
    this.renderUsersList();
  }

  renderBookingsList() {
    const tableBody = document.getElementById('bookingTableBody');
    if (!tableBody) return;

    // Dynamically populate userBookingFilter dropdown if needed
    const userFilterEl = document.getElementById('userBookingFilter');
    if (userFilterEl) {
      const allUsers = this.store.auth.registeredUsers || [];
      const currentSelected = this.store.userFilter || 'ALL';
      let optionsHtml = '<option value="ALL">Semua Pengguna</option>';
      allUsers.forEach(u => {
        const val = u.email || u.userId || u.name;
        const isSel = (currentSelected.toLowerCase() === (u.email || '').toLowerCase() ||
          currentSelected.toLowerCase() === (u.userId || '').toLowerCase() ||
          currentSelected.toLowerCase() === (u.name || '').toLowerCase());
        optionsHtml += `<option value="${val}" ${isSel ? 'selected' : ''}>${u.name} (${u.userId || u.role || 'Guru'})</option>`;
      });
      userFilterEl.innerHTML = optionsHtml;
    }

    // Synchronize day filter dropdown & day pills
    const curDay = this.store.dayFilter || 'ALL';
    const dayFilterEl = document.getElementById('dayFilter');
    if (dayFilterEl && dayFilterEl.value !== curDay) {
      dayFilterEl.value = curDay;
    }

    const dayPills = document.querySelectorAll('#bookingDayPillsBar .day-filter-pill');
    if (dayPills && dayPills.length > 0) {
      dayPills.forEach(pill => {
        if (pill.getAttribute('data-day') === curDay) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
    }

    const statusFilterEl = document.getElementById('statusFilter');
    if (statusFilterEl && this.store.statusFilter && statusFilterEl.value !== this.store.statusFilter) {
      statusFilterEl.value = this.store.statusFilter;
    }

    const list = this.store.getFilteredBookings();

    const countBadge = document.getElementById('countBookingsBadge');
    if (countBadge) countBadge.textContent = list.length;

    if (list.length === 0) {
      const filterDayNotice = (curDay !== 'ALL') ? ` pada hari <strong>${curDay}</strong>` : '';
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 36px 16px; color: var(--gcal-text-subtle);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <i data-lucide="filter-x" style="width: 32px; height: 32px; color: #94a3b8;"></i>
              <span style="font-size: 0.95rem; font-weight: 600; color: #475569;">Tiada rekod tempahan dijumpai${filterDayNotice}.</span>
              <small style="color: #94a3b8;">Sila cuba tukar pilihan penapis hari atau status di atas.</small>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const dayColors = {
      'Ahad': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
      'Isnin': { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
      'Selasa': { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
      'Rabu': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
      'Khamis': { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
      'Jumaat': { bg: '#ccfbf1', text: '#115e59', border: '#99f6e4' },
      'Sabtu': { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' }
    };

    tableBody.innerHTML = list.map(b => {
      let statusBadge = '';
      let actionsHtml = '';

      if (b.status === "Diluluskan") {
        statusBadge = `<span style="background: var(--gcal-green-light); color: var(--gcal-green); padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 0.78rem;">Diluluskan</span>`;
        actionsHtml = `
          <button class="btn-gcal-blue" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.app.openSlip('${b.id}')">
            Slip
          </button>
          <button class="btn-gcal-red" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.app.rejectBooking('${b.id}')">
            Batal
          </button>
        `;
      } else if (b.status === "Menunggu Kelulusan") {
        statusBadge = `<span style="background: var(--gcal-amber-light); color: var(--gcal-amber); padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 0.78rem;">Menunggu</span>`;
        actionsHtml = `
          <button class="btn-gcal-green" onclick="window.app.approveBooking('${b.id}')">
            Luluskan
          </button>
          <button class="btn-gcal-red" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.app.rejectBooking('${b.id}')">
            Tolak
          </button>
        `;
      } else {
        statusBadge = `<span style="background: var(--gcal-red-light); color: var(--gcal-red); padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 0.78rem;">Dibatalkan</span>`;
        actionsHtml = `
          <button class="btn-gcal-blue" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.app.openSlip('${b.id}')">
            Slip
          </button>
        `;
      }

      const dayName = DateUtils.getDayNameMy ? DateUtils.getDayNameMy(b.date) : '';
      const dc = dayColors[dayName] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
      const dayBadge = dayName ? `<span style="background: ${dc.bg}; color: ${dc.text}; border: 1px solid ${dc.border}; padding: 2px 7px; border-radius: 6px; font-weight: 700; font-size: 0.74rem;">${dayName}</span>` : '';

      return `
        <tr>
          <td><strong style="color: var(--gcal-blue);">${b.id}</strong></td>
          <td>
            <strong>${b.applicant}</strong>
            ${b.userId ? `<br><span style="font-size: 0.72rem; background: var(--gcal-blue-light); color: var(--gcal-blue-dark); padding: 1px 6px; border-radius: 8px; font-weight: 600;">${b.userId}</span>` : ''}
            <br><small style="color: var(--gcal-text-subtle);">${b.role}</small>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              ${dayBadge}
              <strong style="color: var(--gcal-text-dark);">${b.date}</strong>
            </div>
            <small style="color: var(--gcal-text-subtle);">${b.slot}</small>
          </td>
          <td><strong>${b.subject}</strong></td>
          <td>${statusBadge}</td>
          <td style="text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
            ${actionsHtml}
          </td>
        </tr>
      `;
    }).join('');
    if (window.lucide) lucide.createIcons();
  }

  renderUsersList() {
    const userTableBody = document.getElementById('userTableBody');
    if (!userTableBody) return;

    const allUsers = this.store.auth.registeredUsers || [];
    const searchInput = document.getElementById('userSearchInput');
    const roleFilter = document.getElementById('userRoleFilter');

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedRole = roleFilter ? roleFilter.value : 'ALL';

    const filteredUsers = allUsers.filter(u => {
      const matchQuery = !query ||
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.userId && u.userId.toLowerCase().includes(query)) ||
        (u.role && u.role.toLowerCase().includes(query));

      const matchRole = (selectedRole === 'ALL') || (u.role === selectedRole);
      return matchQuery && matchRole;
    });

    const countUsersBadge = document.getElementById('countUsersBadge');
    if (countUsersBadge) countUsersBadge.textContent = filteredUsers.length;

    if (filteredUsers.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--gcal-text-subtle);">
            Tiada rekod pengguna dijumpai.
          </td>
        </tr>
      `;
      return;
    }

    userTableBody.innerHTML = filteredUsers.map(u => {
      const roleStr = u.role || 'Guru / Tenaga Pengajar';
      let roleBadgeStyle = 'background: #e2e8f0; color: #475569;';
      if (roleStr.includes('Penyelaras') || roleStr.includes('ICT')) {
        roleBadgeStyle = 'background: #dbeafe; color: #1e40af; font-weight: 700;';
      } else if (roleStr.includes('Pentadbir')) {
        roleBadgeStyle = 'background: #fef3c7; color: #92400e; font-weight: 700;';
      } else if (roleStr.includes('Kelas')) {
        roleBadgeStyle = 'background: #dcfce7; color: #166534; font-weight: 600;';
      }

      const regDate = u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('ms-MY') : '-';
      const userKey = u.userId || u.email;

      // Hitung statistik penggunaan makmal pengguna
      const userBookings = this.store.getUserBookings(u);
      const totalBookings = userBookings.length;
      const approvedCount = userBookings.filter(b => b.status === "Diluluskan").length;
      const pendingCount = userBookings.filter(b => b.status === "Menunggu Kelulusan").length;
      const cancelledCount = userBookings.filter(b => b.status === "Dibatalkan").length;

      return `
        <tr>
          <td>
            <strong style="color: var(--gcal-blue);">${u.userId || 'USR'}</strong>
            <br><small style="color: var(--gcal-text-subtle);">${u.email}</small>
          </td>
          <td>
            <strong style="font-size: 0.92rem; color: var(--gcal-text-dark);">${u.name}</strong>
          </td>
          <td>
            <span style="${roleBadgeStyle} padding: 3px 10px; border-radius: 12px; font-size: 0.78rem;">
              ${roleStr}
            </span>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <div>
                <span style="background: ${totalBookings > 0 ? 'var(--gcal-blue-light)' : '#f1f5f9'}; color: ${totalBookings > 0 ? 'var(--gcal-blue-dark)' : '#64748b'}; font-weight: 700; font-size: 0.78rem; padding: 2px 8px; border-radius: 10px; display: inline-flex; align-items: center; gap: 4px;">
                  <i data-lucide="calendar" style="width: 12px; height: 12px;"></i>
                  ${totalBookings} Tempahan
                </span>
              </div>
              <div style="font-size: 0.72rem; color: var(--gcal-text-subtle); display: flex; gap: 6px; flex-wrap: wrap;">
                <span style="color: var(--gcal-green); font-weight: 600;">✓ ${approvedCount} Lulus</span>
                ${pendingCount > 0 ? `<span style="color: var(--gcal-amber); font-weight: 600;">⏱ ${pendingCount} Tunggu</span>` : ''}
                ${cancelledCount > 0 ? `<span style="color: var(--gcal-red); font-weight: 600;">✕ ${cancelledCount} Batal</span>` : ''}
              </div>
            </div>
          </td>
          <td>
            <strong>${u.phone || 'Tiada No'}</strong>
            <br><small style="color: var(--gcal-text-subtle);">${u.subject || 'Mata Pelajaran'}</small>
          </td>
          <td>
            <small style="color: var(--gcal-text-subtle);">${regDate}</small>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn-gcal-blue" style="padding: 5px 12px; font-size: 0.78rem; font-weight: 600; border-radius: 14px; display: inline-flex; align-items: center; gap: 4px;" onclick="window.app.openUserUsageHistory('${userKey}')" title="Lihat rekod penggunaan makmal oleh guru ini">
                <i data-lucide="history" style="width: 14px; height: 14px;"></i>
                <span>Rekod Penggunaan</span>
              </button>
              <button class="btn-gcal-white" style="padding: 5px 10px; font-size: 0.78rem; font-weight: 600; border-radius: 14px; border: 1px solid #cbd5e1; background: white; color: #334155; display: inline-flex; align-items: center; gap: 4px;" onclick="window.app.openEditUserModal('${userKey}')" title="Edit akaun pengguna">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                <span>Edit</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }
}

// --------------------------------------------------------------------------
// 4. MODAL VIEW (Booking, Login, Admin Auth & Slip Modals)
// --------------------------------------------------------------------------
class ModalView {
  constructor(store, app) {
    this.store = store;
    this.app = app;
    this.dom = {
      // Booking Modal
      bookingModal: document.getElementById('bookingModal'),
      bookingForm: document.getElementById('bookingForm'),
      conflictAlert: document.getElementById('conflictAlert'),
      conflictAlertMsg: document.getElementById('conflictAlertMsg'),
      btnSubmitBooking: document.getElementById('btnSubmitBooking'),

      formLab: document.getElementById('formLab'),
      formDate: document.getElementById('formDate'),
      formSlotCount: document.getElementById('formSlotCount'),
      formSlotLabelText: document.getElementById('formSlotLabelText'),
      formSlot: document.getElementById('formSlot'),
      formSlot2Group: document.getElementById('formSlot2Group'),
      formSlot2: document.getElementById('formSlot2'),
      slotCountHint: document.getElementById('slotCountHint'),
      formApplicant: document.getElementById('formApplicant'),
      formSubject: document.getElementById('formSubject'),
      formNotes: document.getElementById('formNotes'),

      // Admin Recurring in Booking Modal
      adminRecurringBookingSection: document.getElementById('adminRecurringBookingSection'),
      chkAdminRecurring: document.getElementById('chkAdminRecurring'),
      adminRecurringOptions: document.getElementById('adminRecurringOptions'),
      selAdminRepeatWeeks: document.getElementById('selAdminRepeatWeeks'),
      selAdminBookingStatus: document.getElementById('selAdminBookingStatus'),

      // Schedule Generator Modal (Admin Only)
      scheduleGeneratorModal: document.getElementById('scheduleGeneratorModal'),
      scheduleGeneratorForm: document.getElementById('scheduleGeneratorForm'),
      btnCloseScheduleGeneratorModal: document.getElementById('btnCloseScheduleGeneratorModal'),
      btnCancelScheduleGenerator: document.getElementById('btnCancelScheduleGenerator'),
      genStartSunday: document.getElementById('genStartSunday'),
      genWeeksCount: document.getElementById('genWeeksCount'),
      genWeekHint: document.getElementById('genWeekHint'),
      genOverwriteExisting: document.getElementById('genOverwriteExisting'),
      genEnableRotation: document.getElementById('genEnableRotation'),
      previewWeekBadge: document.getElementById('previewWeekBadge'),
      previewRotationControls: document.getElementById('previewRotationControls'),
      schedulePreviewTableBody: document.getElementById('schedulePreviewTableBody'),
      btnClearGeneratedSchedule: document.getElementById('btnClearGeneratedSchedule'),
      btnSubmitScheduleGenerator: document.getElementById('btnSubmitScheduleGenerator'),
      btnSubmitScheduleGeneratorText: document.getElementById('btnSubmitScheduleGeneratorText'),

      // Login Modal
      loginModal: document.getElementById('loginModal'),
      loginForm: document.getElementById('loginForm'),
      btnGoogleSSO: document.getElementById('btnGoogleSSO'),
      loginEmail: document.getElementById('loginEmail'),
      loginPassword: document.getElementById('loginPassword'),
      loginTeacherName: document.getElementById('loginTeacherName'),
      btnCloseLoginModal: document.getElementById('btnCloseLoginModal'),

      // Admin Auth Modal
      adminAuthModal: document.getElementById('adminAuthModal'),
      adminAuthForm: document.getElementById('adminAuthForm'),
      adminPinInput: document.getElementById('adminPinInput'),
      btnCloseAdminAuthModal: document.getElementById('btnCloseAdminAuthModal'),

      // Google SSO Account Chooser Modal
      googleSsoModal: document.getElementById('googleSsoModal'),
      btnCloseGoogleSsoModal: document.getElementById('btnCloseGoogleSsoModal'),
      customGoogleAccountForm: document.getElementById('customGoogleAccountForm'),
      customDelimaEmail: document.getElementById('customDelimaEmail'),
      ssoAccount1: document.getElementById('ssoAccount1'),
      ssoAccount2: document.getElementById('ssoAccount2'),

      // Slip Modal
      slipModal: document.getElementById('slipModal'),
      slipCode: document.getElementById('slipCode'),
      slipDate: document.getElementById('slipDate'),
      slipLab: document.getElementById('slipLab'),
      slipSlot: document.getElementById('slipSlot'),
      slipApplicant: document.getElementById('slipApplicant'),
      slipRole: document.getElementById('slipRole'),
      slipSubject: document.getElementById('slipSubject'),
      slipPCCount: document.getElementById('slipPCCount'),
      slipPurpose: document.getElementById('slipPurpose'),
      slipNotes: document.getElementById('slipNotes'),
      slipStatus: document.getElementById('slipStatus')
    };
  }

  openLogin() {
    this.dom.loginModal.classList.add('active');
    this.initGoogleSIWG();
    this.bindQuickLoginEvents();
  }

  bindQuickLoginEvents() {
    const btnAhmad = document.getElementById('btnQuickLoginAhmad');
    if (btnAhmad && !btnAhmad._bound) {
      btnAhmad._bound = true;
      btnAhmad.addEventListener('click', () => {
        this.selectGoogleAccount('Cikgu Ahmad Razali', 'g-83920192@moe-dl.edu.my');
      });
    }

    const btnSiti = document.getElementById('btnQuickLoginSiti');
    if (btnSiti && !btnSiti._bound) {
      btnSiti._bound = true;
      btnSiti.addEventListener('click', () => {
        this.selectGoogleAccount('Cikgu Siti Nurhaliza', 'g-10293847@moe-dl.edu.my');
      });
    }

    const form = document.getElementById('customDelimaForm');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('customDelimaEmailInput');
        const email = input ? input.value.trim().toLowerCase() : '';
        if (!email.endsWith('@moe-dl.edu.my')) {
          this.app.showToast("ID emel mesti berakhir dengan @moe-dl.edu.my (Contoh: g-12345678@moe-dl.edu.my)", "error");
          return;
        }
        const username = email.split('@')[0];
        const name = `Cikgu (${username})`;
        this.selectGoogleAccount(name, email);
      });
    }
  }

  closeLogin() {
    this.dom.loginModal.classList.remove('active');
  }

  initGoogleSIWG() {
    if (!window.GOOGLE_CLIENT_ID || window.GOOGLE_CLIENT_ID === "" || window.GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") return;
    if (!window.google || !window.google.accounts || !window.google.accounts.id) return;

    try {
      google.accounts.id.initialize({
        client_id: window.GOOGLE_CLIENT_ID,
        callback: (response) => this.handleGoogleCredentialResponse(response),
        auto_select: false
      });

      const container = document.getElementById('googleSiwgButtonContainer');
      if (container) {
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320
        });
      }

      google.accounts.id.prompt();
    } catch (e) {
      console.warn("Ralat Sign In With Google (SIWG):", e);
    }
  }

  handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    try {
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const payload = JSON.parse(jsonPayload);

      const loggedUser = this.store.auth.loginWithGoogleProfile(
        payload.name || payload.given_name || `Cikgu (${payload.email.split('@')[0]})`,
        payload.email,
        payload.picture || ''
      );

      this.closeLogin();
      this.closeGoogleSSOPicker();
      this.app.render();
      this.app.showToast(`Log Masuk Google DELIMa Berjaya! Selamat datang, ${loggedUser.name} (${loggedUser.email})`, "success");
    } catch (err) {
      this.app.showToast(err.message, "error");
    }
  }


  openGoogleSSOPicker() {
    if (this.dom.googleSsoModal) {
      this.dom.googleSsoModal.classList.add('active');
    }
  }

  closeGoogleSSOPicker() {
    if (this.dom.googleSsoModal) {
      this.dom.googleSsoModal.classList.remove('active');
    }
  }

  openAdminAuth(onSuccessCallback = null) {
    this.adminAuthSuccessCallback = onSuccessCallback;
    if (!this.dom.adminAuthModal) return;
    if (this.dom.adminPinInput) this.dom.adminPinInput.value = '';
    this.dom.adminAuthModal.classList.add('active');
    setTimeout(() => {
      if (this.dom.adminPinInput) this.dom.adminPinInput.focus();
    }, 100);
  }

  closeAdminAuth() {
    this.dom.adminAuthModal.classList.remove('active');
    this.adminAuthSuccessCallback = null;
  }

  handleAdminAuthSubmit(e) {
    e.preventDefault();
    const pin = this.dom.adminPinInput.value.trim();
    if (this.store.auth.verifyAdminPin(pin)) {
      this.closeAdminAuth();
      if (this.adminAuthSuccessCallback) {
        const cb = this.adminAuthSuccessCallback;
        this.adminAuthSuccessCallback = null;
        cb();
      } else {
        this.app.switchTab('admin');
      }
      this.app.showToast("Akses Admin Disahkan! Selamat datang ke Panel Rekod Pentadbir.", "success");
    } else {
      this.app.showToast("PIN Admin Tidak Sah! Sila cuba lagi.", "error");
    }
  }

  handleGoogleSSO() {
    if (window.GOOGLE_CLIENT_ID && window.GOOGLE_CLIENT_ID !== "" && window.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: window.GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (response) => {
            if (response.error) {
              this.app.showToast("Ralat Log Masuk Google OAuth: " + response.error, "error");
              return;
            }
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` }
              });
              const userInfo = await res.json();
              const loggedUser = this.store.auth.loginWithGoogleProfile(
                userInfo.name,
                userInfo.email,
                userInfo.picture
              );
              this.closeLogin();
              this.closeGoogleSSOPicker();
              this.app.render();
              this.app.showToast(`Log Masuk Google DELIMa Berjaya! Selamat datang, ${loggedUser.name} (${loggedUser.email})`, "success");
            } catch (e) {
              this.app.showToast(e.message, "error");
            }
          }
        });
        client.requestAccessToken();
        return;
      } catch (err) {
        console.warn("GSI init TokenClient failed, opening SSO picker modal:", err);
      }
    }

    this.openGoogleSSOPicker();
  }

  selectGoogleAccount(name, email) {
    try {
      const loggedUser = this.store.auth.loginWithGoogleProfile(name, email);
      this.closeGoogleSSOPicker();
      this.closeLogin();
      this.app.render();
      this.app.showToast(`Log Masuk Google DELIMa Berjaya! Selamat datang, ${loggedUser.name} (${loggedUser.email})`, "success");
    } catch (err) {
      this.app.showToast(err.message, "error");
    }
  }

  handleCustomGoogleAccountSubmit(e) {
    e.preventDefault();
    const email = this.dom.customDelimaEmail ? this.dom.customDelimaEmail.value.trim() : '';
    const username = email.split('@')[0] || 'Guru';
    const name = `Cikgu (${username})`;

    try {
      const loggedUser = this.store.auth.loginWithGoogleProfile(name, email);
      this.closeGoogleSSOPicker();
      this.closeLogin();
      this.app.render();
      this.app.showToast(`Log Masuk Google DELIMa Berjaya! Selamat datang, ${loggedUser.name} (${loggedUser.email})`, "success");
    } catch (err) {
      this.app.showToast(err.message, "error");
    }
  }

  handleLoginSubmit(e) {
    e.preventDefault();
    const email = this.dom.loginEmail ? this.dom.loginEmail.value : '';
    const password = this.dom.loginPassword ? this.dom.loginPassword.value : '';
    const name = this.dom.loginTeacherName ? this.dom.loginTeacherName.value : '';

    try {
      const loggedUser = this.store.auth.loginWithDelima(email, password, name);
      this.closeLogin();
      this.app.render();
      this.app.showToast(`Log Masuk DELIMa Berjaya! Selamat datang, ${loggedUser.name} (${loggedUser.email})`, "success");
    } catch (err) {
      this.app.showToast(err.message, "error");
    }
  }

  handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('regName') ? document.getElementById('regName').value : '';
    const email = document.getElementById('regEmail') ? document.getElementById('regEmail').value : '';
    const password = document.getElementById('regPassword') ? document.getElementById('regPassword').value : '';
    const role = document.getElementById('regRole') ? document.getElementById('regRole').value : 'Guru';

    try {
      const newUser = this.store.auth.registerUser(name, email, password, role);
      this.app.showToast(`Pendaftaran Berjaya! Akaun ${newUser.email} telah disimpan. Sila log masuk.`, "success");

      this.switchAuthTab('login');
      if (this.dom.loginEmail) this.dom.loginEmail.value = newUser.email;
    } catch (err) {
      this.app.showToast(err.message, "error");
    }
  }

  switchAuthTab(tab) {
    const loginContainer = document.getElementById('loginFormContainer');
    const registerContainer = document.getElementById('registerFormContainer');
    const btnLogin = document.getElementById('authTabLogin');
    const btnRegister = document.getElementById('authTabRegister');
    const title = document.getElementById('authModalTitle');
    const sub = document.getElementById('authModalSub');

    if (tab === 'register') {
      if (loginContainer) loginContainer.style.display = 'none';
      if (registerContainer) registerContainer.style.display = 'block';
      if (btnLogin) {
        btnLogin.style.borderBottom = 'none';
        btnLogin.style.color = 'var(--gcal-text-subtle)';
      }
      if (btnRegister) {
        btnRegister.style.borderBottom = '2px solid var(--gcal-blue)';
        btnRegister.style.color = 'var(--gcal-blue)';
      }
      if (title) title.textContent = "Daftar Akaun DELIMa Baru";
      if (sub) sub.textContent = "Cipta akaun pengguna baharu untuk sistem ini.";
    } else {
      if (registerContainer) registerContainer.style.display = 'none';
      if (loginContainer) loginContainer.style.display = 'block';
      if (btnRegister) {
        btnRegister.style.borderBottom = 'none';
        btnRegister.style.color = 'var(--gcal-text-subtle)';
      }
      if (btnLogin) {
        btnLogin.style.borderBottom = '2px solid var(--gcal-blue)';
        btnLogin.style.color = 'var(--gcal-blue)';
      }
      if (title) title.textContent = "Log Masuk Google DELIMa";
      if (sub) sub.textContent = "Sila log masuk menggunakan Akaun DELIMa.";
    }
  }

  openBooking(dateStr, slotStr) {
    if (!this.store.auth.isLoggedIn()) {
      this.openLogin();
      this.app.showToast("Sila log masuk dengan Akaun Google DELIMa terlebih dahulu.", "error");
      return;
    }

    const isAdmin = (this.store.auth && (this.store.auth.isLabCoordinator() || this.store.auth.isAdminVerified));
    const todayIso = DateUtils.getTodayIso();
    const tomorrowIso = DateUtils.getTomorrowIso();
    if (this.dom.formDate) {
      if (isAdmin) {
        this.dom.formDate.removeAttribute('min');
        this.dom.formDate.removeAttribute('max');
      } else {
        this.dom.formDate.min = todayIso;
        this.dom.formDate.max = tomorrowIso;
      }
    }

    if (!isAdmin && dateStr) {
      if (dateStr < todayIso) {
        this.app.showToast("Tempahan ditutup! Tidak boleh menempah bagi tarikh lepas.", "warning");
        return;
      }
      if (dateStr > tomorrowIso) {
        this.app.showToast("Tempahan disekat! Guru biasa hanya dibenarkan menempah bagi hari semasa dan hari seterusnya sahaja.", "warning");
        return;
      }
      const existingUserCount = this.store.getUserBookingCountForDate(this.store.auth.currentUser, dateStr);
      if (existingUserCount >= 2) {
        this.app.showToast(`Had tempahan tercapai! Anda telah menempah 2 slot pada tarikh ${dateStr}. Maksimum 2 slot sehari sahaja dibenarkan bagi setiap pengguna.`, "warning");
        return;
      }
    }

    this.dom.formLab.value = "LAB-1";
    this.dom.formDate.value = dateStr || (isAdmin ? DateUtils.formatDateIso(new Date()) : todayIso);
    this.dom.formSlot.value = slotStr || TIME_SLOTS[0];
    this.dom.formApplicant.value = this.store.auth.currentUser.name;

    // Pengurusan kuota bilangan slot dalam borang
    if (this.dom.formSlotCount) {
      const targetDate = this.dom.formDate.value;
      const existingUserCount = (!isAdmin && targetDate && this.store.auth.currentUser)
        ? this.store.getUserBookingCountForDate(this.store.auth.currentUser, targetDate)
        : 0;

      const opt2 = this.dom.formSlotCount.querySelector('option[value="2"]');
      if (!isAdmin && existingUserCount === 1) {
        this.dom.formSlotCount.value = "1";
        if (opt2) opt2.disabled = true;
        if (this.dom.slotCountHint) {
          this.dom.slotCountHint.innerHTML = `<span style="color:#d97706;"><i data-lucide="alert-circle" style="width:11px; height:11px; display:inline-block; vertical-align:middle;"></i> Baki kuota: 1 slot lagi untuk tarikh ini</span>`;
        }
      } else {
        if (opt2) opt2.disabled = false;
        this.dom.formSlotCount.value = "1";
        if (this.dom.slotCountHint) {
          this.dom.slotCountHint.innerHTML = `<span style="color:#16a34a;"><i data-lucide="check-circle" style="width:11px; height:11px; display:inline-block; vertical-align:middle;"></i> Anda boleh tempah 2 slot sekaligus (1 jam)</span>`;
        }
      }
      this.updateSlotCountUI();
    }

    // Papar pilihan tempahan berulang sekiranya pengguna adalah Admin
    if (this.dom.adminRecurringBookingSection) {
      if (isAdmin) {
        this.dom.adminRecurringBookingSection.style.display = 'block';
        if (this.dom.chkAdminRecurring) this.dom.chkAdminRecurring.checked = false;
        if (this.dom.adminRecurringOptions) this.dom.adminRecurringOptions.style.display = 'none';
      } else {
        this.dom.adminRecurringBookingSection.style.display = 'none';
      }
    }

    this.checkConflict();
    this.dom.bookingModal.classList.add('active');
  }

  updateSlotCountUI() {
    const isTwoSlots = (this.dom.formSlotCount && this.dom.formSlotCount.value === "2");
    if (this.dom.formSlot2Group) {
      this.dom.formSlot2Group.style.display = isTwoSlots ? "block" : "none";
    }
    if (this.dom.formSlotLabelText) {
      this.dom.formSlotLabelText.textContent = isTwoSlots ? "Slot Masa 1" : "Slot Masa";
    }
    if (isTwoSlots && this.dom.formSlot && this.dom.formSlot2) {
      // Cadangkan slot berturutan secara automatik
      const slot1 = this.dom.formSlot.value;
      const idx = TIME_SLOTS.indexOf(slot1);
      if (idx !== -1 && idx + 1 < TIME_SLOTS.length) {
        this.dom.formSlot2.value = TIME_SLOTS[idx + 1];
      } else if (idx !== -1 && idx - 1 >= 0) {
        this.dom.formSlot2.value = TIME_SLOTS[idx - 1];
      }
    }
    this.checkConflict();
    if (window.lucide) lucide.createIcons();
  }

  handleSlot1Change() {
    const isTwoSlots = (this.dom.formSlotCount && this.dom.formSlotCount.value === "2");
    if (isTwoSlots && this.dom.formSlot && this.dom.formSlot2) {
      const slot1 = this.dom.formSlot.value;
      const idx = TIME_SLOTS.indexOf(slot1);
      if (idx !== -1 && idx + 1 < TIME_SLOTS.length) {
        this.dom.formSlot2.value = TIME_SLOTS[idx + 1];
      }
    }
    this.checkConflict();
  }

  closeBooking() {
    this.dom.bookingModal.classList.remove('active');
    this.dom.bookingForm.reset();
    if (this.dom.btnSubmitBooking) {
      this.dom.btnSubmitBooking.disabled = false;
    }
    if (this.dom.conflictAlert) {
      this.dom.conflictAlert.style.display = 'none';
    }
    if (this.dom.formSlot2Group) {
      this.dom.formSlot2Group.style.display = 'none';
    }
    if (this.dom.formSlotLabelText) {
      this.dom.formSlotLabelText.textContent = 'Slot Masa';
    }
  }

  checkConflict() {
    const date = this.dom.formDate.value;
    const slot = this.dom.formSlot.value;
    const isTwoSlots = (this.dom.formSlotCount && this.dom.formSlotCount.value === "2");
    const slot2 = isTwoSlots && this.dom.formSlot2 ? this.dom.formSlot2.value : null;
    const isAdmin = (this.store.auth && (this.store.auth.isLabCoordinator() || this.store.auth.isAdminVerified));

    // 1. Semakan tarikh tempahan bagi pengguna biasa: Hari semasa dan hari seterusnya sahaja
    if (!isAdmin && date) {
      const todayIso = DateUtils.getTodayIso();
      const tomorrowIso = DateUtils.getTomorrowIso();
      if (date < todayIso) {
        this.dom.conflictAlertMsg.textContent = "Amaran: Tempahan slot makmal tidak dibenarkan bagi tarikh yang telah berlalu.";
        this.dom.conflictAlert.style.display = 'flex';
        if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = true;
        return;
      }
      if (date > tomorrowIso) {
        this.dom.conflictAlertMsg.textContent = "Amaran: Guru biasa hanya dibenarkan menempah bagi hari semasa dan hari seterusnya sahaja.";
        this.dom.conflictAlert.style.display = 'flex';
        if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = true;
        return;
      }
    }

    // 2. Semakan had maksimum 2 slot sehari bagi setiap pengguna (HANYA pengguna biasa)
    const currentUser = (this.store.auth && this.store.auth.currentUser) ? this.store.auth.currentUser : {
      userId: '',
      email: '',
      name: (this.dom.formApplicant ? this.dom.formApplicant.value : '')
    };
    if (!isAdmin && date && currentUser) {
      const userDaySlots = this.store.getUserBookingCountForDate(currentUser, date);
      const requestedSlots = isTwoSlots ? 2 : 1;
      if (userDaySlots + requestedSlots > 2) {
        this.dom.conflictAlertMsg.textContent = `Amaran: Had tempahan tercapai! Anda telah ada ${userDaySlots} slot pada tarikh ${date}. Setiap pengguna hanya dibenarkan maksimum 2 slot sehari.`;
        this.dom.conflictAlert.style.display = 'flex';
        if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = true;
        return;
      }
    }

    // 3. Semakan jika slot 1 dan slot 2 adalah sama
    if (isTwoSlots && slot === slot2) {
      this.dom.conflictAlertMsg.textContent = "Amaran: Slot Masa 1 dan Slot Masa 2 tidak boleh sama! Sila pilih slot kedua yang berbeza.";
      this.dom.conflictAlert.style.display = 'flex';
      if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = true;
      return;
    }

    // 4. Semakan pertindihan slot 1 dengan tempahan sedia ada
    const conflict1 = this.store.findConflict(date, slot);
    if (conflict1) {
      this.dom.conflictAlertMsg.textContent = `Amaran: Slot Masa 1 (${slot}) telah ditempah oleh ${conflict1.applicant} (${conflict1.subject})!`;
      this.dom.conflictAlert.style.display = 'flex';
      if (!isAdmin && this.dom.btnSubmitBooking) {
        this.dom.btnSubmitBooking.disabled = true;
      }
      return;
    }

    // 5. Semakan pertindihan slot 2 jika dipilih 2 slot sekaligus
    if (isTwoSlots && slot2) {
      const conflict2 = this.store.findConflict(date, slot2);
      if (conflict2) {
        this.dom.conflictAlertMsg.textContent = `Amaran: Slot Masa 2 (${slot2}) telah ditempah oleh ${conflict2.applicant} (${conflict2.subject})!`;
        this.dom.conflictAlert.style.display = 'flex';
        if (!isAdmin && this.dom.btnSubmitBooking) {
          this.dom.btnSubmitBooking.disabled = true;
        }
        return;
      }
    }

    // Jika semua syarat dipenuhi
    this.dom.conflictAlert.style.display = 'none';
    if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = false;
  }

  async handleBookingSubmit(e) {
    e.preventDefault();

    if (!this.store.auth.isLoggedIn()) {
      this.openLogin();
      return;
    }

    const date = this.dom.formDate.value;
    const slot = this.dom.formSlot.value;
    const isTwoSlots = (this.dom.formSlotCount && this.dom.formSlotCount.value === "2");
    const slot2 = isTwoSlots && this.dom.formSlot2 ? this.dom.formSlot2.value : null;
    const isAdmin = (this.store.auth && (this.store.auth.isLabCoordinator() || this.store.auth.isAdminVerified));

    if (!isAdmin) {
      // 1. Semakan tarikh tempahan: Guru biasa hanya hari semasa dan hari seterusnya sahaja
      const todayIso = DateUtils.getTodayIso();
      const tomorrowIso = DateUtils.getTomorrowIso();
      if (date < todayIso) {
        this.app.showToast("Gagal! Tempahan tidak dibenarkan bagi tarikh yang telah berlalu.", "error");
        return;
      }
      if (date > tomorrowIso) {
        this.app.showToast("Gagal! Guru biasa hanya dibenarkan menempah bagi hari semasa dan hari seterusnya sahaja.", "error");
        return;
      }

      // 2. Semakan had maksimum 2 slot sehari
      const existingCount = this.store.getUserBookingCountForDate(this.store.auth.currentUser, date);
      const requestedSlots = isTwoSlots ? 2 : 1;
      if (existingCount + requestedSlots > 2) {
        this.app.showToast(`Gagal! Anda telah menempah ${existingCount} slot pada tarikh ${date}. Maksimum 2 slot sehari sahaja dibenarkan bagi setiap pengguna.`, "error");
        return;
      }

      // 3. Semakan jika slot 1 dan slot 2 adalah sama
      if (isTwoSlots && slot === slot2) {
        this.app.showToast("Gagal! Slot Masa 1 dan Slot Masa 2 tidak boleh sama.", "error");
        return;
      }

      // 4. Semakan pertindihan slot 1
      const conflict1 = this.store.findConflict(date, slot);
      if (conflict1) {
        this.app.showToast(`Gagal! Slot Masa 1 (${slot}) telah ditempah oleh ${conflict1.applicant}. Sila pilih slot lain.`, "error");
        return;
      }

      // 5. Semakan pertindihan slot 2
      if (isTwoSlots && slot2) {
        const conflict2 = this.store.findConflict(date, slot2);
        if (conflict2) {
          this.app.showToast(`Gagal! Slot Masa 2 (${slot2}) telah ditempah oleh ${conflict2.applicant}. Sila pilih slot lain.`, "error");
          return;
        }
      }
    }

    const applicant = this.dom.formApplicant.value.trim() || this.store.auth.currentUser.name;
    const subject = this.dom.formSubject.value.trim();
    const notes = this.dom.formNotes.value.trim();
    const isRecurring = isAdmin && this.dom.chkAdminRecurring && this.dom.chkAdminRecurring.checked;
    const repeatWeeks = isRecurring ? (parseInt(this.dom.selAdminRepeatWeeks.value, 10) || 1) : 1;
    const bookingStatus = (isAdmin && this.dom.selAdminBookingStatus) ? this.dom.selAdminBookingStatus.value : (isAdmin ? "Diluluskan" : "Menunggu Kelulusan");

    try {
      let createdBookings = [];
      const baseDate = new Date(date);

      for (let w = 0; w < repeatWeeks; w++) {
        const curDate = new Date(baseDate);
        curDate.setDate(curDate.getDate() + (w * 7));
        const curDateStr = DateUtils.formatDateIso(curDate);

        // Tempahan Slot 1
        const newB1 = await this.store.addBooking({
          labId: "LAB-1",
          date: curDateStr,
          slot: slot,
          applicant: applicant,
          subject: subject,
          pcCount: 35,
          purpose: isRecurring ? "Tempahan Berulang Mingguan (Admin)" : "",
          notes: notes + (isRecurring ? ` (Minggu ${w + 1}/${repeatWeeks})` : ''),
          status: bookingStatus,
          isAdmin: isAdmin
        });
        createdBookings.push(newB1);

        // Tempahan Slot 2 (jika dipilih 2 slot sekaligus)
        if (isTwoSlots && slot2) {
          const newB2 = await this.store.addBooking({
            labId: "LAB-1",
            date: curDateStr,
            slot: slot2,
            applicant: applicant,
            subject: subject,
            pcCount: 35,
            purpose: isRecurring ? "Tempahan Berulang Mingguan (Admin)" : "",
            notes: notes + (isRecurring ? ` (Minggu ${w + 1}/${repeatWeeks} - Slot 2)` : ''),
            status: bookingStatus,
            isAdmin: isAdmin
          });
          createdBookings.push(newB2);
        }
      }

      this.closeBooking();
      this.app.render();

      if (isRecurring && repeatWeeks > 1) {
        this.app.showToast(`Tempahan Berulang Berjaya! Sebanyak ${repeatWeeks} minggu telah ditempah tanpa had oleh Pentadbir.`, "success");
      } else if (isTwoSlots) {
        this.app.showToast(`Berjaya! Sebanyak 2 slot makmal (${slot} & ${slot2}) telah berjaya ditempah sekaligus! (${bookingStatus})`, "success");
      } else {
        this.app.showToast(`Permohonan Dihantar! Kod Tempahan: ${createdBookings[0].id} (${bookingStatus})`, "success");
      }

      if (createdBookings.length > 0) {
        this.openSlip(createdBookings[0].id);
      }
    } catch (err) {
      this.app.showToast(`Ralat: ${err.message}`, "error");
    }
  }

  // Pengurusan Modal Janaan Jadual Kelas Mingguan (Admin Only)
  openScheduleGenerator() {
    const isAuth = this.store.auth && (this.store.auth.isAdminVerified || this.store.auth.isLabCoordinator());
    if (!isAuth) {
      this.openAdminAuth();
      this.app.showToast("Akses Terhad! Sila masukkan PIN Admin untuk mengakses Penjana Jadual Kelas Mingguan.", "error");
      return;
    }

    if (!this.dom.scheduleGeneratorModal) return;

    this.previewWeekOffset = 0;

    // Setkan Ahad minggu semasa sebagai tarikh mula lalai
    const currentSunday = this.store.currentSunday || DateUtils.getSunday(new Date());
    if (this.dom.genStartSunday) {
      this.dom.genStartSunday.value = DateUtils.formatDateIso(currentSunday);
    }
    if (this.dom.genWeeksCount) {
      this.dom.genWeeksCount.value = "4"; // lalai: 4 minggu / 1 bulan
    }
    if (this.dom.genOverwriteExisting) {
      this.dom.genOverwriteExisting.checked = true;
    }
    if (this.dom.genEnableRotation) {
      this.dom.genEnableRotation.checked = true; // lalai: bergilir setiap minggu
    }

    this.updateSchedulePreview(0);
    this.dom.scheduleGeneratorModal.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  closeScheduleGenerator() {
    if (this.dom.scheduleGeneratorModal) {
      this.dom.scheduleGeneratorModal.classList.remove('active');
    }
  }

  updateSchedulePreview(weekOffset = null) {
    if (weekOffset !== null && typeof weekOffset !== 'undefined') {
      this.previewWeekOffset = parseInt(weekOffset, 10) || 0;
    } else if (typeof this.previewWeekOffset !== 'number') {
      this.previewWeekOffset = 0;
    }

    const modalTableBody = this.dom.schedulePreviewTableBody || document.getElementById('schedulePreviewTableBody');
    const tabTableBody = document.getElementById('tabSchedulePreviewTableBody');
    if (!modalTableBody && !tabTableBody) return;

    const startSundayIso = (this.dom.genStartSunday && this.dom.genStartSunday.value)
      || (document.getElementById('tabGenStartSunday') && document.getElementById('tabGenStartSunday').value)
      || DateUtils.formatDateIso(new Date());
    const baseSunday = startSundayIso ? new Date(startSundayIso) : new Date();

    const endThu = new Date(baseSunday);
    endThu.setDate(endThu.getDate() + 4);
    const hintText = `Minggu Persekolahan Bermula: ${DateUtils.formatDateIso(baseSunday)} (Ahad) hingga ${DateUtils.formatDateIso(endThu)} (Khamis)`;

    if (this.dom.genWeekHint) this.dom.genWeekHint.textContent = hintText;
    const tabHint = document.getElementById('tabGenWeekHint');
    if (tabHint) tabHint.textContent = hintText;

    const weeksCount = (this.dom.genWeeksCount && parseInt(this.dom.genWeeksCount.value, 10))
      || (document.getElementById('tabGenWeeksCount') && parseInt(document.getElementById('tabGenWeeksCount').value, 10))
      || 1;
    const totalSlots = weeksCount * 24;
    const isRotation = this.dom.genEnableRotation ? this.dom.genEnableRotation.checked : true;

    if (this.dom.btnSubmitScheduleGeneratorText) {
      const rotText = isRotation ? "Bergilir" : "Tetap";
      this.dom.btnSubmitScheduleGeneratorText.textContent = `Jana ${totalSlots} Slot (${weeksCount} Minggu ${rotText})`;
    }

    // Kemas kini butang tab minggu pratonton di kedua-dua modal & subtab
    ['previewRotationControls', 'tabPreviewRotationControls'].forEach(ctrlId => {
      const ctrl = document.getElementById(ctrlId);
      if (ctrl) {
        const buttons = ctrl.querySelectorAll('.btn-preview-week');
        buttons.forEach(btn => {
          const bWeek = parseInt(btn.dataset.week, 10);
          if (bWeek === this.previewWeekOffset) {
            btn.classList.add('active');
            btn.style.background = '#2563eb';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#2563eb';
          } else {
            btn.classList.remove('active');
            btn.style.background = '#ffffff';
            btn.style.color = '#475569';
            btn.style.borderColor = '#cbd5e1';
          }
        });
      }
    });

    ['previewWeekBadge', 'tabPreviewWeekBadge'].forEach(badgeId => {
      const badge = document.getElementById(badgeId);
      if (badge) {
        if (isRotation) {
          badge.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">🔄 Giliran Minggu ${this.previewWeekOffset + 1} (Berubah)</span>`;
          badge.style.background = '#e0e7ff';
          badge.style.color = '#3730a3';
        } else {
          badge.textContent = 'Jadual Tetap (Sama Setiap Minggu)';
          badge.style.background = '#f1f5f9';
          badge.style.color = '#475569';
        }
      }
    });

    // Kira tarikh sebenar bagi minggu pratonton yang sedang dipaparkan
    const previewSunday = new Date(baseSunday);
    previewSunday.setDate(previewSunday.getDate() + (this.previewWeekOffset * 7));

    // Dapatkan jadual dengan mengambil kira pilihan kelas yang telah diubah suai oleh Admin mengikut Tahap
    const schedule = typeof getWeeklyClassSchedule === 'function'
      ? getWeeklyClassSchedule(this.previewWeekOffset, isRotation, this.store.customWeeklyClasses)
      : WEEKLY_CLASS_SCHEDULE_TEMPLATE;

    let rowsHtml = '';
    schedule.forEach((entry, entryIndex) => {
      const targetDate = new Date(previewSunday);
      targetDate.setDate(targetDate.getDate() + entry.dayIndex);
      const dayDateStr = DateUtils.formatDateIso(targetDate);
      const isTahap1 = entry.level === 'Tahap 1';
      const availableClasses = isTahap1 ? (typeof CLASSES_TAHAP_1 !== 'undefined' ? CLASSES_TAHAP_1 : ["1 UTARID", "2 ZUHRAH", "3 MARIKH"])
        : (typeof CLASSES_TAHAP_2 !== 'undefined' ? CLASSES_TAHAP_2 : ["4 MUSYTARI", "5 ZUHAL", "6 NEPTUN"]);
      const badgeColor = isTahap1 ? 'background: #e0f2fe; color: #0369a1;' : 'background: #fef3c7; color: #b45309;';
      const selectBorderColor = isTahap1 ? '#38bdf8' : '#f59e0b';
      const selectBg = isTahap1 ? '#f0f9ff' : '#fffbeb';
      const selectTextColor = isTahap1 ? '#0369a1' : '#92400e';

      // Dropdown kelas HANYA menyenaraikan kelas dalam Tahap yang sama (Wajib mengikut Tahap)
      const optionsHtml = availableClasses.map(cls => `
        <option value="${cls}" ${cls === entry.className ? 'selected' : ''}>
          ${cls}
        </option>
      `).join('');

      const classDropdownHtml = `
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <select class="schedule-class-select" 
            data-week="${this.previewWeekOffset}" 
            data-entry-idx="${entryIndex}" 
            data-level="${entry.level}"
            title="Tukar kelas bagi slot ini (Hanya kelas ${entry.level})"
            style="font-family: inherit; font-weight: 700; font-size: 0.84rem; padding: 4px 8px; border-radius: 6px; border: 1.5px solid ${selectBorderColor}; background: ${selectBg}; color: ${selectTextColor}; cursor: pointer; outline: none; height: 32px;"
            onchange="window.app.modalView.handleClassChangeInPreview(this, ${this.previewWeekOffset}, ${entryIndex}, '${entry.level}')">
            ${optionsHtml}
          </select>
          <span style="${badgeColor} padding: 2px 7px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; white-space: nowrap;">
            ${entry.level}
          </span>
        </div>
      `;

      const teacherFreeBadge = entry.teacherFreeTime
        ? `<div style="display: inline-flex; align-items: center; gap: 5px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 8px; border-radius: 6px;">
            <span style="color: #059669; font-weight: 800; font-size: 0.8rem;">✓</span>
            <div>
              <strong style="color: #065f46; font-size: 0.76rem; display: block;">${entry.teacherFreeTime}</strong>
              <small style="color: #047857; font-size: 0.68rem;">(${entry.teacherFreeSlotsCount} slot terbuka untuk guru)</small>
            </div>
           </div>`
        : `<span style="color: #64748b; font-size: 0.72rem;">Ada slot terbuka</span>`;

      rowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 10px; font-weight: 700; color: #1e293b;">
            ${entry.dayName}
            <br><span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">${dayDateStr}</span>
          </td>
          <td style="padding: 10px 10px;">
            <strong style="color: #2563eb;">${entry.timeDesc}</strong>
            <br><small style="color: #64748b;">4 Slot Berterusan (${entry.slots[0].split('-')[0].trim()} - ${entry.slots[3].split('-')[1].trim()})</small>
          </td>
          <td style="padding: 10px 10px;">
            ${classDropdownHtml}
          </td>
          <td style="padding: 10px 10px;">
            <div class="schedule-subject-text" style="font-weight: 600; color: #334155; font-size: 0.78rem;">${entry.subject}</div>
            <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">${entry.notes}</div>
          </td>
          <td style="padding: 10px 10px;">
            ${teacherFreeBadge}
          </td>
        </tr>
      `;
    });

    if (modalTableBody) modalTableBody.innerHTML = rowsHtml;
    if (tabTableBody) tabTableBody.innerHTML = rowsHtml;
    if (window.lucide) lucide.createIcons();
  }

  handleClassChangeInPreview(selectEl, weekOffset, entryIndex, level) {
    const newClassName = selectEl.value;
    const allowed = level === 'Tahap 1'
      ? (typeof CLASSES_TAHAP_1 !== 'undefined' ? CLASSES_TAHAP_1 : ["1 UTARID", "2 ZUHRAH", "3 MARIKH"])
      : (typeof CLASSES_TAHAP_2 !== 'undefined' ? CLASSES_TAHAP_2 : ["4 MUSYTARI", "5 ZUHAL", "6 NEPTUN"]);

    if (!allowed.includes(newClassName)) {
      this.app.showToast(`Ralat: ${newClassName} bukan kelas dalam ${level}!`, "error");
      selectEl.value = allowed[0];
      return;
    }

    this.store.setCustomWeeklyClass(weekOffset, entryIndex, newClassName);
    this.updateSchedulePreview(weekOffset);
    this.app.showToast(`Kelas berjaya ditukar kepada "${newClassName}" (${level}).`, "success");
  }

  handleResetCustomClasses() {
    this.store.resetCustomWeeklyClasses();
    this.updateSchedulePreview(this.previewWeekOffset);
    this.app.showToast("Pilihan kelas telah ditetapkan semula kepada jadual asal mengikut tahap.", "info");
  }

  showGeneratorLoading(weeksCount, totalSlots) {
    const overlay = document.getElementById('scheduleGeneratorLoadingOverlay');
    if (!overlay) return;

    const bar = document.getElementById('generatorProgressBar');
    const percent = document.getElementById('generatorProgressPercent');
    const stepText = document.getElementById('generatorProgressStepText');
    const step1 = document.getElementById('genStep1');
    const step2 = document.getElementById('genStep2');
    const step3 = document.getElementById('genStep3');
    const step2Text = document.getElementById('genStep2Text');
    const icon = document.getElementById('generatorLoadingIcon');
    const title = document.getElementById('generatorLoadingTitle');
    const subtitle = document.getElementById('generatorLoadingSubtitle');

    if (bar) bar.style.width = '12%';
    if (percent) percent.textContent = '12%';
    if (stepText) stepText.textContent = 'Menyemak rotasi kelas & jadual waktu...';
    if (title) title.textContent = 'Menjana Jadual Kelas Mingguan...';
    if (subtitle) subtitle.textContent = 'Sila tunggu sebentar. Sistem sedang memproses rotasi adil dan menyelaraskan slot makmal.';
    if (icon) {
      icon.setAttribute('data-lucide', 'sparkles');
      icon.style.color = '#2563eb';
    }

    if (step1) step1.className = 'generator-step-item active';
    if (step2) step2.className = 'generator-step-item';
    if (step3) step3.className = 'generator-step-item';
    if (step2Text) step2Text.textContent = `Menjana ${totalSlots} slot jadual rasmi bagi ${weeksCount} minggu`;

    // Disable buttons
    const btnTab = document.getElementById('btnTabSubmitScheduleGenerator');
    const btnModal = document.getElementById('btnSubmitScheduleGenerator');
    const btnClear = document.getElementById('btnClearGeneratedSchedule');
    const btnTabClear = document.getElementById('btnTabClearGeneratedSchedule');

    if (btnTab) {
      btnTab.disabled = true;
      btnTab.dataset.origHtml = btnTab.innerHTML;
      btnTab.innerHTML = `<i data-lucide="loader-2" class="spin" style="width:16px; height:16px;"></i><span>Sedang Menjana...</span>`;
    }
    if (btnModal) {
      btnModal.disabled = true;
      btnModal.dataset.origHtml = btnModal.innerHTML;
      btnModal.innerHTML = `<i data-lucide="loader-2" class="spin" style="width:16px; height:16px;"></i><span>Sedang Menjana...</span>`;
    }
    if (btnClear) btnClear.disabled = true;
    if (btnTabClear) btnTabClear.disabled = true;

    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  updateGeneratorProgress(percentVal, stepTextStr, stepIndex) {
    const bar = document.getElementById('generatorProgressBar');
    const percent = document.getElementById('generatorProgressPercent');
    const stepText = document.getElementById('generatorProgressStepText');
    const step1 = document.getElementById('genStep1');
    const step2 = document.getElementById('genStep2');
    const step3 = document.getElementById('genStep3');

    if (bar) bar.style.width = `${percentVal}%`;
    if (percent) percent.textContent = `${percentVal}%`;
    if (stepText) stepText.textContent = stepTextStr;

    if (stepIndex === 1) {
      if (step1) step1.className = 'generator-step-item active';
      if (step2) step2.className = 'generator-step-item';
      if (step3) step3.className = 'generator-step-item';
    } else if (stepIndex === 2) {
      if (step1) step1.className = 'generator-step-item completed';
      if (step2) step2.className = 'generator-step-item active';
      if (step3) step3.className = 'generator-step-item';
    } else if (stepIndex === 3) {
      if (step1) step1.className = 'generator-step-item completed';
      if (step2) step2.className = 'generator-step-item completed';
      if (step3) step3.className = 'generator-step-item active';
    }
  }

  async finishGeneratorLoading(createdCount, weeksCount) {
    const bar = document.getElementById('generatorProgressBar');
    const percent = document.getElementById('generatorProgressPercent');
    const stepText = document.getElementById('generatorProgressStepText');
    const step1 = document.getElementById('genStep1');
    const step2 = document.getElementById('genStep2');
    const step3 = document.getElementById('genStep3');
    const icon = document.getElementById('generatorLoadingIcon');
    const title = document.getElementById('generatorLoadingTitle');
    const subtitle = document.getElementById('generatorLoadingSubtitle');

    if (bar) bar.style.width = '100%';
    if (percent) percent.textContent = '100%';
    if (stepText) stepText.textContent = 'Janaan berjaya! Menyiapkan paparan...';
    if (title) title.textContent = 'Jadual Kelas Berjaya Dijana!';
    if (subtitle) subtitle.textContent = `Sebanyak ${createdCount} slot telah selesai dijadualkan bagi ${weeksCount} minggu persekolahan.`;

    if (step1) step1.className = 'generator-step-item completed';
    if (step2) step2.className = 'generator-step-item completed';
    if (step3) step3.className = 'generator-step-item completed';

    if (icon) {
      icon.setAttribute('data-lucide', 'check-circle-2');
      icon.style.color = '#16a34a';
      if (window.lucide) lucide.createIcons();
    }

    await new Promise(r => setTimeout(r, 650));
    this.hideGeneratorLoading();
  }

  hideGeneratorLoading() {
    const overlay = document.getElementById('scheduleGeneratorLoadingOverlay');
    if (overlay) overlay.classList.remove('active');

    const btnTab = document.getElementById('btnTabSubmitScheduleGenerator');
    const btnModal = document.getElementById('btnSubmitScheduleGenerator');
    const btnClear = document.getElementById('btnClearGeneratedSchedule');
    const btnTabClear = document.getElementById('btnTabClearGeneratedSchedule');

    if (btnTab) {
      btnTab.disabled = false;
      if (btnTab.dataset.origHtml) btnTab.innerHTML = btnTab.dataset.origHtml;
    }
    if (btnModal) {
      btnModal.disabled = false;
      if (btnModal.dataset.origHtml) btnModal.innerHTML = btnModal.dataset.origHtml;
    }
    if (btnClear) btnClear.disabled = false;
    if (btnTabClear) btnTabClear.disabled = false;

    if (window.lucide) lucide.createIcons();
  }

  async handleScheduleGeneratorSubmit(e) {
    e.preventDefault();

    const isFromTab = e.target && e.target.id === 'tabScheduleGeneratorForm';
    const startSunday = isFromTab
      ? (document.getElementById('tabGenStartSunday')?.value || '')
      : (this.dom.genStartSunday?.value || document.getElementById('tabGenStartSunday')?.value || '');
    const weeksCount = isFromTab
      ? (parseInt(document.getElementById('tabGenWeeksCount')?.value, 10) || 1)
      : (parseInt(this.dom.genWeeksCount?.value, 10) || 1);
    const overwriteExisting = isFromTab
      ? (document.getElementById('tabGenOverwriteExisting')?.checked ?? true)
      : (this.dom.genOverwriteExisting?.checked ?? true);
    const enableRotation = isFromTab
      ? (document.getElementById('tabGenEnableRotation')?.checked ?? true)
      : (this.dom.genEnableRotation?.checked ?? true);

    if (!startSunday) {
      this.app.showToast("Sila pilih tarikh mula Ahad terlebih dahulu.", "error");
      return;
    }

    const estimatedSlots = weeksCount * 24;
    this.showGeneratorLoading(weeksCount, estimatedSlots);

    try {
      await new Promise(r => setTimeout(r, 350));
      this.updateGeneratorProgress(35, `Mengira susunan kelas mengikut tahap bagi ${weeksCount} minggu...`, 1);

      await new Promise(r => setTimeout(r, 300));
      this.updateGeneratorProgress(65, `Menjana 4 slot berterusan bagi Tahun 1 hingga 6 (${estimatedSlots} slot)...`, 2);

      const res = await this.store.generateWeeklyClassSchedule({
        startSunday: startSunday,
        weeksCount: weeksCount,
        overwriteExisting: overwriteExisting,
        enableRotation: enableRotation,
        customClasses: this.store.customWeeklyClasses
      });

      this.updateGeneratorProgress(90, `Menyimpan ${res.createdCount} slot ke pangkalan data & Google Sheets...`, 3);
      await new Promise(r => setTimeout(r, 400));

      await this.finishGeneratorLoading(res.createdCount, res.weeksCount);

      this.closeScheduleGenerator();
      this.app.render();

      const rotMsg = enableRotation ? "dengan giliran kelas berbeza setiap minggu" : "secara tetap";
      this.app.showToast(`Jadual Kelas Berjaya Dijana! Sebanyak ${res.createdCount} slot telah dijadualkan ${rotMsg} bagi Tahun 1 hingga 6 (${res.weeksCount} minggu).`, "success");
    } catch (err) {
      this.hideGeneratorLoading();
      this.app.showToast(`Ralat Janaan Jadual: ${err.message}`, "error");
    }
  }

  async handleClearGeneratedSchedule() {
    const startSunday = (this.dom.genStartSunday && this.dom.genStartSunday.value)
      || (document.getElementById('tabGenStartSunday') && document.getElementById('tabGenStartSunday').value)
      || '';
    const weeksCount = (this.dom.genWeeksCount && parseInt(this.dom.genWeeksCount.value, 10))
      || (document.getElementById('tabGenWeeksCount') && parseInt(document.getElementById('tabGenWeeksCount').value, 10))
      || 1;

    if (!startSunday) {
      this.app.showToast("Sila pilih tarikh mula Ahad terlebih dahulu.", "error");
      return;
    }

    if (!confirm(`Adakah anda pasti ingin memadam semua tempahan jadual rasmi kelas janaan automatik bermula ${startSunday} untuk ${weeksCount} minggu?`)) {
      return;
    }

    try {
      const removedCount = await this.store.clearGeneratedScheduleForWeek(startSunday, weeksCount);
      this.closeScheduleGenerator();
      this.app.render();
      this.app.showToast(`Sebanyak ${removedCount} slot jadual rasmi janaan automatik telah dipadam.`, "info");
    } catch (err) {
      this.app.showToast(`Ralat: ${err.message}`, "error");
    }
  }

  openSlip(bookingId) {
    if (!bookingId) return;
    const booking = this.store.bookings.find(b => String(b.id) === String(bookingId));
    if (!booking) {
      console.warn("Maklumat tempahan tidak dijumpai bagi ID:", bookingId);
      if (this.app && typeof this.app.showToast === 'function') {
        this.app.showToast("Maklumat slip tempahan tidak dijumpai.", "error");
      }
      return;
    }

    const setField = (id, val) => {
      const el = this.dom[id] || document.getElementById(id);
      if (el) el.textContent = val !== undefined && val !== null ? val : '-';
    };

    setField('slipCode', booking.id);

    let dateDisplay = booking.date || '-';
    try {
      if (booking.date) {
        const parts = booking.date.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const dayName = typeof DAY_NAMES_MY !== 'undefined' ? DAY_NAMES_MY[d.getDay()] : '';
          if (dayName) dateDisplay = `${dayName}, ${booking.date}`;
        }
      }
    } catch (e) { }
    setField('slipDate', dateDisplay);

    setField('slipLab', booking.labName || "Makmal Komputer SKPT");
    setField('slipSlot', booking.slot || '-');
    setField('slipApplicant', booking.applicant || '-');
    setField('slipRole', booking.role || 'Guru / Tenaga Pengajar');
    setField('slipSubject', booking.subject || '-');
    setField('slipPCCount', `${booking.pcCount || 21} Komputer / PC`);
    setField('slipPurpose', booking.purpose || 'Pelajaran & Amali');
    setField('slipNotes', booking.notes || '-');

    const statusEl = this.dom.slipStatus || document.getElementById('slipStatus');
    if (statusEl) {
      const status = booking.status || 'Diluluskan';
      statusEl.textContent = status.toUpperCase();
      if (status === 'Diluluskan') {
        statusEl.style.color = '#1e8e3e';
      } else if (status === 'Menunggu Kelulusan') {
        statusEl.style.color = '#e37400';
      } else {
        statusEl.style.color = '#d93025';
      }
    }

    const modalEl = this.dom.slipModal || document.getElementById('slipModal');
    if (modalEl) {
      modalEl.classList.add('active');
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  closeSlip() {
    const modalEl = this.dom.slipModal || document.getElementById('slipModal');
    if (modalEl) {
      modalEl.classList.remove('active');
    }
  }
  openEditUser(userKey) {
    const editModal = document.getElementById('editUserModal');
    if (!editModal) return;

    const user = this.store.auth.registeredUsers.find(u => u.userId === userKey || u.email === userKey);
    if (!user) {
      this.app.showToast("Akaun pengguna tidak dijumpai.", "error");
      return;
    }

    const editUserId = document.getElementById('editUserId');
    const editUserName = document.getElementById('editUserName');
    const editUserEmail = document.getElementById('editUserEmail');
    const editUserRole = document.getElementById('editUserRole');
    const editUserPhone = document.getElementById('editUserPhone');
    const editUserSubject = document.getElementById('editUserSubject');
    const editUserPassword = document.getElementById('editUserPassword');

    if (editUserId) editUserId.value = user.userId || user.email;
    if (editUserName) editUserName.value = user.name || '';
    if (editUserEmail) editUserEmail.value = user.email || '';
    if (editUserRole) editUserRole.value = user.role || 'Guru / Tenaga Pengajar';
    if (editUserPhone) editUserPhone.value = user.phone || '';
    if (editUserSubject) editUserSubject.value = user.subject || '';
    if (editUserPassword) editUserPassword.value = '';

    editModal.classList.add('active');
  }

  closeEditUser() {
    const editModal = document.getElementById('editUserModal');
    if (editModal) editModal.classList.remove('active');
  }

  handleEditUserSubmit(e) {
    e.preventDefault();
    const userId = document.getElementById('editUserId')?.value;
    const name = document.getElementById('editUserName')?.value;
    const email = document.getElementById('editUserEmail')?.value;
    const role = document.getElementById('editUserRole')?.value;
    const phone = document.getElementById('editUserPhone')?.value;
    const subject = document.getElementById('editUserSubject')?.value;
    const password = document.getElementById('editUserPassword')?.value;

    try {
      const updated = this.store.auth.updateUserByAdmin(userId, { name, email, role, phone, subject, password });
      this.closeEditUser();
      this.app.render();
      this.app.showToast(`Akaun ${updated.name} (${updated.email}) berjaya dikemaskini!`, "success");
    } catch (err) {
      this.app.showToast(err.message, "error");
    }
  }

  openUserUsageHistory(userKey) {
    const modalEl = document.getElementById('userUsageModal');
    if (!modalEl) return;

    const allUsers = this.store.auth.registeredUsers || [];
    const user = allUsers.find(u => u.userId === userKey || u.email === userKey || u.name === userKey) || {
      userId: userKey,
      name: userKey,
      email: userKey,
      role: 'Guru / Tenaga Pengajar'
    };

    this.currentUserUsageUser = user;

    // Reset filters
    const searchInput = document.getElementById('userUsageSearchInput');
    const statusFilter = document.getElementById('userUsageStatusFilter');
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'ALL';

    this.renderUserUsageModal();
    modalEl.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  closeUserUsageHistory() {
    const modalEl = document.getElementById('userUsageModal');
    if (modalEl) modalEl.classList.remove('active');
    this.currentUserUsageUser = null;
  }

  renderUserUsageModal() {
    if (!this.currentUserUsageUser) return;
    const u = this.currentUserUsageUser;

    const modalTitle = document.getElementById('userUsageModalTitle');
    if (modalTitle) {
      modalTitle.textContent = `Rekod Penggunaan Makmal: ${u.name || u.userId}`;
    }

    // Populate user profile banner
    const profileHeader = document.getElementById('userUsageProfileHeader');
    if (profileHeader) {
      const roleStr = u.role || 'Guru / Tenaga Pengajar';
      let roleBadgeStyle = 'background: #e2e8f0; color: #475569;';
      if (roleStr.includes('Penyelaras') || roleStr.includes('ICT')) {
        roleBadgeStyle = 'background: #dbeafe; color: #1e40af; font-weight: 700;';
      } else if (roleStr.includes('Pentadbir')) {
        roleBadgeStyle = 'background: #fef3c7; color: #92400e; font-weight: 700;';
      } else if (roleStr.includes('Kelas')) {
        roleBadgeStyle = 'background: #dcfce7; color: #166534; font-weight: 600;';
      }

      const regDate = u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('ms-MY') : '-';

      profileHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
            ${(u.name || 'G').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <strong style="font-size: 1.05rem; color: var(--gcal-text-dark);">${u.name}</strong>
              <span style="${roleBadgeStyle} padding: 2px 8px; border-radius: 12px; font-size: 0.74rem;">${roleStr}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--gcal-text-subtle); margin-top: 3px; display: flex; gap: 12px; flex-wrap: wrap;">
              <span><strong>ID:</strong> ${u.userId || 'USR'}</span>
              <span><strong>Emel DELIMa:</strong> ${u.email || '-'}</span>
              <span><strong>No. Tel:</strong> ${u.phone || 'Tiada'}</span>
              <span><strong>Subjek:</strong> ${u.subject || 'Umum'}</span>
              <span><strong>Tarikh Daftar:</strong> ${regDate}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Calculate overall stats for this user
    const userBookings = this.store.getUserBookings(u);
    const totalCount = userBookings.length;
    const approvedCount = userBookings.filter(b => b.status === "Diluluskan").length;
    const pendingCount = userBookings.filter(b => b.status === "Menunggu Kelulusan").length;
    const cancelledCount = userBookings.filter(b => b.status === "Dibatalkan").length;

    const elTotal = document.getElementById('userUsageStatTotal');
    const elApproved = document.getElementById('userUsageStatApproved');
    const elPending = document.getElementById('userUsageStatPending');
    const elCancelled = document.getElementById('userUsageStatCancelled');

    if (elTotal) elTotal.textContent = totalCount;
    if (elApproved) elApproved.textContent = approvedCount;
    if (elPending) elPending.textContent = pendingCount;
    if (elCancelled) elCancelled.textContent = cancelledCount;

    this.renderUserUsageBookings();
  }

  renderUserUsageBookings() {
    if (!this.currentUserUsageUser) return;
    const u = this.currentUserUsageUser;

    const searchInput = document.getElementById('userUsageSearchInput');
    const statusFilter = document.getElementById('userUsageStatusFilter');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedStatus = statusFilter ? statusFilter.value : 'ALL';

    const allUserBookings = this.store.getUserBookings(u);

    const filtered = allUserBookings.filter(b => {
      const matchQuery = !query ||
        (b.id && b.id.toLowerCase().includes(query)) ||
        (b.subject && b.subject.toLowerCase().includes(query)) ||
        (b.slot && b.slot.toLowerCase().includes(query)) ||
        (b.date && b.date.toLowerCase().includes(query));

      const matchStatus = (selectedStatus === 'ALL') || (b.status === selectedStatus);
      return matchQuery && matchStatus;
    });

    const tableEl = document.getElementById('userUsageBookingsTable');
    const emptyEl = document.getElementById('userUsageEmptyState');
    const tbody = document.getElementById('userUsageTableBody');
    const footerCount = document.getElementById('userUsageFooterCount');

    if (footerCount) {
      footerCount.textContent = `Menunjukkan ${filtered.length} daripada ${allUserBookings.length} rekod tempahan`;
    }

    if (filtered.length === 0) {
      if (tableEl) tableEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      if (tbody) tbody.innerHTML = '';
      return;
    }

    if (tableEl) tableEl.style.display = 'table';
    if (emptyEl) emptyEl.style.display = 'none';

    if (tbody) {
      tbody.innerHTML = filtered.map(b => {
        let statusBadge = '';
        let actionsHtml = '';

        if (b.status === "Diluluskan") {
          statusBadge = `<span style="background: var(--gcal-green-light); color: var(--gcal-green); padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 0.78rem;">Diluluskan</span>`;
          actionsHtml = `
            <button class="btn-gcal-blue" style="padding: 4px 9px; font-size: 0.75rem;" onclick="window.app.openSlip('${b.id}')" title="Cetak / Papar Slip Rasmi">
              Slip
            </button>
            <button class="btn-gcal-red" style="padding: 4px 9px; font-size: 0.75rem;" onclick="window.app.rejectBookingFromUsage('${b.id}')" title="Batalkan tempahan ini">
              Batal
            </button>
          `;
        } else if (b.status === "Menunggu Kelulusan") {
          statusBadge = `<span style="background: var(--gcal-amber-light); color: var(--gcal-amber); padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 0.78rem;">Menunggu</span>`;
          actionsHtml = `
            <button class="btn-gcal-green" style="padding: 4px 9px; font-size: 0.75rem;" onclick="window.app.approveBookingFromUsage('${b.id}')" title="Luluskan tempahan ini">
              Luluskan
            </button>
            <button class="btn-gcal-red" style="padding: 4px 9px; font-size: 0.75rem;" onclick="window.app.rejectBookingFromUsage('${b.id}')" title="Tolak permohonan">
              Tolak
            </button>
          `;
        } else {
          statusBadge = `<span style="background: var(--gcal-red-light); color: var(--gcal-red); padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 0.78rem;">Dibatalkan</span>`;
          actionsHtml = `
            <button class="btn-gcal-blue" style="padding: 4px 9px; font-size: 0.75rem;" onclick="window.app.openSlip('${b.id}')" title="Cetak / Papar Slip">
              Slip
            </button>
          `;
        }

        let dayName = '';
        if (b.date) {
          try {
            const parts = b.date.split('-');
            if (parts.length === 3) {
              const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              dayName = DAY_NAMES_MY[d.getDay()] || '';
            }
          } catch (e) { }
        }
        const dateDisplay = dayName ? `${dayName}, ${b.date}` : b.date;

        return `
          <tr>
            <td><strong style="color: var(--gcal-blue);">${b.id}</strong></td>
            <td>
              <strong style="color: var(--gcal-text-dark);">${dateDisplay}</strong>
            </td>
            <td>
              <span style="font-weight: 600; color: #334155;">${b.slot}</span>
            </td>
            <td>
              <strong>${b.subject}</strong>
              ${b.notes ? `<br><small style="color: var(--gcal-text-subtle); font-style: italic;">${b.notes}</small>` : ''}
            </td>
            <td>
              <span style="font-size: 0.78rem; background: #f1f5f9; padding: 2px 7px; border-radius: 8px; color: #475569; font-weight: 600;">
                ${b.pcCount || 35} PC
              </span>
            </td>
            <td>${statusBadge}</td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="display: flex; gap: 4px; justify-content: flex-end;">
                ${actionsHtml}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (window.lucide) lucide.createIcons();
  }
}

// --------------------------------------------------------------------------
// 5. PROFILE VIEW (User Profile Management Panel)
// --------------------------------------------------------------------------
class ProfileView {
  constructor(authStore, app) {
    this.auth = authStore;
    this.app = app;
    this.dom = {
      panel: document.getElementById('profileTabPanel'),
      form: document.getElementById('profileForm'),
      inputName: document.getElementById('profileName'),
      inputEmail: document.getElementById('profileEmail'),
      selectRole: document.getElementById('profileRole'),
      inputPhone: document.getElementById('profilePhone'),
      inputSubject: document.getElementById('profileSubject'),
      avatarCircle: document.getElementById('profileAvatarCircle'),
      displayEmailBadge: document.getElementById('profileEmailBadge'),
      displayNameHeading: document.getElementById('profileNameHeading')
    };
  }

  render() {
    if (!this.dom.panel) return;

    if (!this.auth.isLoggedIn()) {
      this.dom.panel.innerHTML = `
        <div class="admin-tab-container">
          <div class="admin-card" style="padding: 40px 20px; text-align: center; max-width: 480px; margin: 40px auto; border-radius: 16px;">
            <div style="width: 64px; height: 64px; background: var(--gcal-blue-light); color: var(--gcal-blue); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <i data-lucide="user-x" style="width: 32px; height: 32px;"></i>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--gcal-text-dark); margin-bottom: 8px;">Akses Profil Dihadkan</h3>
            <p style="font-size: 0.88rem; color: var(--gcal-text-subtle); margin-bottom: 20px;">Sila log masuk dengan Akaun DELIMa KPM anda untuk melihat dan mengemaskini maklumat profil pengguna.</p>
            <button class="btn-gcal-blue" onclick="window.app.openLogin()" style="height: 44px; padding: 0 24px; font-weight: 700; border-radius: 22px;">
              Log Masuk Akaun DELIMa
            </button>
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const user = this.auth.currentUser;
    const initials = (user.name || 'G').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    if (this.dom.avatarCircle) this.dom.avatarCircle.textContent = initials;
    if (this.dom.displayNameHeading) this.dom.displayNameHeading.textContent = user.name;
    if (this.dom.displayEmailBadge) this.dom.displayEmailBadge.textContent = user.email;

    if (this.dom.inputName) this.dom.inputName.value = user.name || '';
    if (this.dom.inputEmail) this.dom.inputEmail.value = user.email || '';
    if (this.dom.selectRole) this.dom.selectRole.value = user.role || 'Guru';
    if (this.dom.inputPhone) this.dom.inputPhone.value = user.phone || '';
    if (this.dom.inputSubject) this.dom.inputSubject.value = user.subject || '';
  }

  handleProfileSubmit(e) {
    e.preventDefault();
    if (!this.auth.isLoggedIn()) {
      this.app.openLogin();
      return;
    }

    const name = this.dom.inputName ? this.dom.inputName.value.trim() : '';
    const role = this.dom.selectRole ? this.dom.selectRole.value : 'Guru';
    const phone = this.dom.inputPhone ? this.dom.inputPhone.value.trim() : '';
    const subject = this.dom.inputSubject ? this.dom.inputSubject.value.trim() : '';

    try {
      const updatedUser = this.auth.updateUserProfile({ name, role, phone, subject });
      this.render();
      this.app.render();
      this.app.showToast(`Profil Berjaya Dikemaskini! Maklumat ${updatedUser.name} telah disimpan.`, "success");
    } catch (err) {
      this.app.showToast(err.message, "error");
    }
  }
}

// --------------------------------------------------------------------------
// 6. HISTORY VIEW (User Booking History Panel - Only Accessible After Login)
// --------------------------------------------------------------------------
class HistoryView {
  constructor(store, authStore, app) {
    this.store = store;
    this.auth = authStore;
    this.app = app;
    this.searchQuery = "";
    this.statusFilter = "ALL";
    this.dom = {
      panel: document.getElementById('historyTabPanel'),
      tableBody: document.getElementById('historyTableBody'),
      table: document.getElementById('historyTable'),
      emptyState: document.getElementById('historyEmptyState'),
      emptyStateTitle: document.getElementById('emptyStateTitle'),
      emptyStateMsg: document.getElementById('emptyStateMsg'),
      userSubtitle: document.getElementById('historyUserSubtitle'),
      statTotal: document.getElementById('histStatTotal'),
      statApproved: document.getElementById('histStatApproved'),
      statPending: document.getElementById('histStatPending'),
      statCancelled: document.getElementById('histStatCancelled'),
      searchInput: document.getElementById('historySearchInput'),
      statusFilter: document.getElementById('historyStatusFilter'),
      btnNewBooking: document.getElementById('btnNewBookingFromHistory'),
      btnEmptyBooking: document.getElementById('btnEmptyBooking'),
      navBadge: document.getElementById('historyNavBadge'),
      statCards: document.querySelectorAll('.history-stat-card')
    };

    this.initEvents();
  }

  initEvents() {
    if (this.dom.searchInput) {
      this.dom.searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        this.renderTableOnly();
      });
    }

    if (this.dom.statusFilter) {
      this.dom.statusFilter.addEventListener('change', (e) => {
        this.setStatusFilter(e.target.value);
      });
    }

    if (this.dom.btnNewBooking) {
      this.dom.btnNewBooking.addEventListener('click', () => {
        this.app.modalView.openBooking();
      });
    }

    if (this.dom.btnEmptyBooking) {
      this.dom.btnEmptyBooking.addEventListener('click', () => {
        this.app.modalView.openBooking();
      });
    }

    if (this.dom.statCards) {
      this.dom.statCards.forEach(card => {
        card.addEventListener('click', () => {
          const filter = card.getAttribute('data-filter') || 'ALL';
          this.setStatusFilter(filter);
        });
      });
    }
  }

  setStatusFilter(filterValue) {
    this.statusFilter = filterValue;
    if (this.dom.statusFilter) this.dom.statusFilter.value = filterValue;

    if (this.dom.statCards) {
      this.dom.statCards.forEach(card => {
        if (card.getAttribute('data-filter') === filterValue) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }

    this.renderTableOnly();
  }

  getUserBookings() {
    if (!this.auth.isLoggedIn()) return [];
    return this.store.getUserBookings(this.auth.currentUser);
  }

  render() {
    if (!this.dom.panel) return;

    if (!this.auth.isLoggedIn()) {
      if (this.dom.navBadge) this.dom.navBadge.style.display = 'none';
      return;
    }

    const user = this.auth.currentUser;
    const userBookings = this.getUserBookings();

    // 1. Update Subtitle
    if (this.dom.userSubtitle) {
      this.dom.userSubtitle.innerHTML = `
        Rekod tempahan untuk <strong>${user.name}</strong> (<span style="color: var(--gcal-blue); font-weight: 600;">${user.email}</span>)
      `;
    }

    // 2. Compute KPI Stats
    const totalCount = userBookings.length;
    const approvedCount = userBookings.filter(b => b.status === "Diluluskan").length;
    const pendingCount = userBookings.filter(b => b.status === "Menunggu Kelulusan").length;
    const cancelledCount = userBookings.filter(b => b.status === "Dibatalkan").length;

    if (this.dom.statTotal) this.dom.statTotal.textContent = totalCount;
    if (this.dom.statApproved) this.dom.statApproved.textContent = approvedCount;
    if (this.dom.statPending) this.dom.statPending.textContent = pendingCount;
    if (this.dom.statCancelled) this.dom.statCancelled.textContent = cancelledCount;

    // Update Sidebar Navigation Badge
    if (this.dom.navBadge) {
      const activeCount = approvedCount + pendingCount;
      if (activeCount > 0) {
        this.dom.navBadge.textContent = activeCount;
        this.dom.navBadge.style.display = 'inline-block';
      } else {
        this.dom.navBadge.style.display = 'none';
      }
    }

    // 3. Render Table
    this.renderTableOnly();
  }

  renderTableOnly() {
    if (!this.dom.tableBody) return;

    const userBookings = this.getUserBookings();

    // Filter by query and status
    let filtered = [...userBookings];

    if (this.statusFilter !== "ALL") {
      filtered = filtered.filter(b => b.status === this.statusFilter);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(b =>
        (b.id && b.id.toLowerCase().includes(this.searchQuery)) ||
        (b.subject && b.subject.toLowerCase().includes(this.searchQuery)) ||
        (b.date && b.date.toLowerCase().includes(this.searchQuery)) ||
        (b.slot && b.slot.toLowerCase().includes(this.searchQuery)) ||
        (b.notes && b.notes.toLowerCase().includes(this.searchQuery))
      );
    }

    // If empty
    if (filtered.length === 0) {
      if (this.dom.table) this.dom.table.style.display = 'none';
      if (this.dom.emptyState) {
        this.dom.emptyState.style.display = 'flex';
        if (userBookings.length === 0) {
          if (this.dom.emptyStateTitle) this.dom.emptyStateTitle.textContent = "Anda Belum Mempunyai Tempahan";
          if (this.dom.emptyStateMsg) this.dom.emptyStateMsg.textContent = "Sila klik butang di bawah untuk menempah slot waktu penggunaan Makmal Komputer.";
          if (this.dom.btnEmptyBooking) this.dom.btnEmptyBooking.style.display = 'inline-flex';
        } else {
          if (this.dom.emptyStateTitle) this.dom.emptyStateTitle.textContent = "Tiada Tempahan Dijumpai";
          if (this.dom.emptyStateMsg) this.dom.emptyStateMsg.textContent = "Tiada rekod tempahan yang sepadan dengan carian atau penapis status yang dipilih.";
          if (this.dom.btnEmptyBooking) this.dom.btnEmptyBooking.style.display = 'none';
        }
      }
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Has items
    if (this.dom.table) this.dom.table.style.display = 'table';
    if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';

    this.dom.tableBody.innerHTML = filtered.map(b => {
      let statusBadge = '';
      let actionButtons = '';

      if (b.status === "Diluluskan") {
        statusBadge = `
          <span style="background: var(--gcal-green-light); color: var(--gcal-green); padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="check-circle-2" style="width: 12px;"></i> Diluluskan
          </span>
        `;
        actionButtons = `
          <button class="btn-gcal-blue" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" onclick="window.app.openSlip('${b.id}')" title="Cetak / Lihat Slip Rasmi">
            <i data-lucide="printer" style="width: 13px;"></i> Slip
          </button>
          <button class="btn-gcal-red" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" onclick="window.app.cancelMyBooking('${b.id}')" title="Batal Tempahan Ini">
            <i data-lucide="x" style="width: 13px;"></i> Batal
          </button>
        `;
      } else if (b.status === "Menunggu Kelulusan") {
        statusBadge = `
          <span style="background: var(--gcal-amber-light); color: var(--gcal-amber); padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="clock" style="width: 12px;"></i> Menunggu
          </span>
        `;
        actionButtons = `
          <button class="btn-gcal-blue" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" onclick="window.app.openSlip('${b.id}')" title="Cetak / Lihat Slip Rasmi">
            <i data-lucide="printer" style="width: 13px;"></i> Slip
          </button>
          <button class="btn-gcal-red" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" onclick="window.app.cancelMyBooking('${b.id}')" title="Batal Tempahan Ini">
            <i data-lucide="x" style="width: 13px;"></i> Batal
          </button>
        `;
      } else {
        statusBadge = `
          <span style="background: var(--gcal-red-light); color: var(--gcal-red); padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="x-circle" style="width: 12px;"></i> Dibatalkan
          </span>
        `;
        actionButtons = `
          <button class="btn-gcal-blue" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" onclick="window.app.openSlip('${b.id}')" title="Cetak / Lihat Slip Rasmi">
            <i data-lucide="file-text" style="width: 13px;"></i> Slip
          </button>
        `;
      }

      return `
        <tr>
          <td>
            <strong style="color: var(--gcal-blue); font-size: 0.88rem;">${b.id}</strong>
            <br><small style="color: var(--gcal-text-subtle);">${b.createdAt ? new Date(b.createdAt).toLocaleDateString('ms-MY') : ''}</small>
          </td>
          <td>
            <strong>${b.date}</strong>
            <br><span style="color: var(--gcal-text-subtle); font-size: 0.78rem; font-weight: 600;">${b.slot}</span>
          </td>
          <td>
            <strong>${b.subject}</strong>
            <br><small style="color: var(--gcal-text-subtle);">Makmal Komputer (${b.pcCount || 35} PC)</small>
          </td>
          <td>
            <span style="color: var(--gcal-text-main); font-size: 0.82rem;">${b.notes ? b.notes : '<em style="color: var(--gcal-text-subtle);">- Tiada catatan -</em>'}</span>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }
}



