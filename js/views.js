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
          const isPastOrToday = !DateUtils.isAtLeastOneDayInAdvance(day.dateStr);
          if (isPastOrToday) {
            html += `
              <div class="gcal-slot-cell empty-slot past-slot" 
                   title="Tempahan ditutup (perlu sekurang-kurangnya 1 hari sebelum)"
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
// 3. TABLE VIEW (Record Management Table - Admin Only)
// --------------------------------------------------------------------------
class TableView {
  constructor(store, app) {
    this.store = store;
    this.app = app;
    this.dom = {
      tableBody: document.getElementById('bookingTableBody')
    };
  }

  render() {
    if (!this.dom.tableBody) return;
    const list = this.store.getFilteredBookings();

    if (list.length === 0) {
      this.dom.tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--gcal-text-subtle);">
            Tiada rekod tempahan dijumpai.
          </td>
        </tr>
      `;
      return;
    }

    this.dom.tableBody.innerHTML = list.map(b => {
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

      return `
        <tr>
          <td><strong style="color: var(--gcal-blue);">${b.id}</strong></td>
          <td>
            <strong>${b.applicant}</strong>
            ${b.userId ? `<br><span style="font-size: 0.72rem; background: var(--gcal-blue-light); color: var(--gcal-blue-dark); padding: 1px 6px; border-radius: 8px; font-weight: 600;">${b.userId}</span>` : ''}
            <br><small style="color: var(--gcal-text-subtle);">${b.role}</small>
          </td>
          <td>
            <strong>${b.date}</strong>
            <br><small style="color: var(--gcal-text-subtle);">${b.slot}</small>
          </td>
          <td><strong>${b.subject}</strong></td>
          <td>${statusBadge}</td>
          <td style="text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
            ${actionsHtml}
          </td>
        </tr>
      `;
    }).join('');
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
      formSlot: document.getElementById('formSlot'),
      formApplicant: document.getElementById('formApplicant'),
      formSubject: document.getElementById('formSubject'),
      formNotes: document.getElementById('formNotes'),

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
      slipPurpose: document.getElementById('slipPurpose')
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

  openAdminAuth() {
    if (!this.dom.adminAuthModal) return;
    if (this.dom.adminPinInput) this.dom.adminPinInput.value = '';
    this.dom.adminAuthModal.classList.add('active');
    setTimeout(() => {
      if (this.dom.adminPinInput) this.dom.adminPinInput.focus();
    }, 100);
  }

  closeAdminAuth() {
    this.dom.adminAuthModal.classList.remove('active');
  }

  handleAdminAuthSubmit(e) {
    e.preventDefault();
    const pin = this.dom.adminPinInput.value.trim();
    if (this.store.auth.verifyAdminPin(pin)) {
      this.closeAdminAuth();
      this.app.switchTab('admin');
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

    const tomorrowIso = DateUtils.getTomorrowIso();
    if (this.dom.formDate) {
      this.dom.formDate.min = tomorrowIso;
    }

    if (dateStr) {
      if (!DateUtils.isAtLeastOneDayInAdvance(dateStr)) {
        this.app.showToast("Tempahan slot makmal hanya dibenarkan sekurang-kurangnya 1 hari sebelum tarikh penggunaan (mulai esok).", "warning");
        return;
      }
      const existingUserCount = this.store.getUserBookingCountForDate(this.store.auth.currentUser, dateStr);
      if (existingUserCount >= 2) {
        this.app.showToast(`Had tempahan tercapai! Anda telah menempah 2 slot pada tarikh ${dateStr}. Maksimum 2 slot sehari sahaja dibenarkan bagi setiap pengguna.`, "warning");
        return;
      }
    }

    this.dom.formLab.value = "LAB-1";
    this.dom.formDate.value = dateStr || tomorrowIso;
    this.dom.formSlot.value = slotStr || TIME_SLOTS[0];
    this.dom.formApplicant.value = this.store.auth.currentUser.name;

    this.checkConflict();
    this.dom.bookingModal.classList.add('active');
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
  }

  checkConflict() {
    const date = this.dom.formDate.value;
    const slot = this.dom.formSlot.value;

    // 1. Semakan tempahan sekurang-kurangnya sehari sebelum
    if (date && !DateUtils.isAtLeastOneDayInAdvance(date)) {
      this.dom.conflictAlertMsg.textContent = "Amaran: Tempahan slot makmal mesti dibuat sekurang-kurangnya 1 hari sebelum tarikh penggunaan (mulai esok).";
      this.dom.conflictAlert.style.display = 'flex';
      if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = true;
      return;
    }

    // 2. Semakan had maksimum 2 slot sehari bagi setiap pengguna
    const currentUser = (this.store.auth && this.store.auth.currentUser) ? this.store.auth.currentUser : {
      userId: '',
      email: '',
      name: (this.dom.formApplicant ? this.dom.formApplicant.value : '')
    };
    if (date && currentUser) {
      const userDaySlots = this.store.getUserBookingCountForDate(currentUser, date);
      if (userDaySlots >= 2) {
        this.dom.conflictAlertMsg.textContent = `Amaran: Had tempahan tercapai! Anda telah menempah ${userDaySlots} slot pada tarikh ${date}. Setiap pengguna hanya dibenarkan menempah maksimum 2 slot sehari.`;
        this.dom.conflictAlert.style.display = 'flex';
        if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = true;
        return;
      }
    }

    // 3. Semakan pertindihan slot dengan tempahan sedia ada
    const conflict = this.store.findConflict(date, slot);
    if (conflict) {
      this.dom.conflictAlertMsg.textContent = `Amaran: Slot masa ini telah ditempah oleh ${conflict.applicant} (${conflict.subject})!`;
      this.dom.conflictAlert.style.display = 'flex';
      if (this.dom.btnSubmitBooking) this.dom.btnSubmitBooking.disabled = true;
      return;
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

    // 1. Semakan sekurang-kurangnya sehari sebelum
    if (!DateUtils.isAtLeastOneDayInAdvance(date)) {
      this.app.showToast("Gagal! Tempahan slot makmal mesti dibuat sekurang-kurangnya 1 hari sebelum tarikh penggunaan.", "error");
      return;
    }

    // 2. Semakan had maksimum 2 slot sehari
    const existingCount = this.store.getUserBookingCountForDate(this.store.auth.currentUser, date);
    if (existingCount >= 2) {
      this.app.showToast(`Gagal! Anda telah menempah 2 slot pada tarikh ${date}. Maksimum 2 slot sehari sahaja dibenarkan bagi setiap pengguna.`, "error");
      return;
    }

    // 3. Semakan pertindihan slot
    const conflict = this.store.findConflict(date, slot);
    if (conflict) {
      this.app.showToast(`Gagal! Slot masa ini telah ditempah oleh ${conflict.applicant}. Sila pilih slot lain.`, "error");
      return;
    }

    try {
      const newBooking = await this.store.addBooking({
        labId: "LAB-1",
        date: date,
        slot: slot,
        applicant: this.dom.formApplicant.value.trim() || this.store.auth.currentUser.name,
        subject: this.dom.formSubject.value.trim(),
        pcCount: 35,
        purpose: "",
        notes: this.dom.formNotes.value.trim()
      });

      this.closeBooking();
      this.app.render();
      this.app.showToast(`Permohonan Dihantar! Kod Tempahan: ${newBooking.id} (Menunggu Kelulusan Admin)`, "success");
      this.openSlip(newBooking.id);
    } catch (err) {
      this.app.showToast(`Ralat: ${err.message}`, "error");
    }
  }

  openSlip(bookingId) {
    const booking = this.store.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    this.dom.slipCode.textContent = booking.id;
    this.dom.slipDate.textContent = booking.date;
    this.dom.slipLab.textContent = "Makmal Komputer Utama (35 PC • Tingkat 1)";
    this.dom.slipSlot.textContent = booking.slot;
    this.dom.slipApplicant.textContent = booking.applicant;
    this.dom.slipRole.textContent = booking.role;
    this.dom.slipSubject.textContent = booking.subject;
    this.dom.slipPCCount.textContent = `${booking.pcCount} Komputer / PC`;
    this.dom.slipPurpose.textContent = booking.purpose;

    this.dom.slipModal.classList.add('active');
  }

  closeSlip() {
    this.dom.slipModal.classList.remove('active');
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



