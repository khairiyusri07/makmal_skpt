/* ==========================================================================
   LABBOOK - MAIN APPLICATION CONTROLLER
   Google Calendar Web Interface Controller
   ========================================================================== */

class App {
  constructor() {
    this.authStore = new AuthStore();
    this.store = new BookingStore(this.authStore);
    this.headerView = new HeaderView(this.authStore, this);
    this.calendarView = new CalendarView(this.store, this);
    this.tableView = new TableView(this.store, this);
    this.modalView = new ModalView(this.store, this);
    this.profileView = new ProfileView(this.authStore, this);
    this.historyView = new HistoryView(this.store, this.authStore, this);
    this.activeTab = 'schedule';
  }

  init() {
    this.bindEvents();
    this.render();

    // Benda paling pertama perlu buat: Kemas kini data terus daripada Google Sheet
    this.syncFromSheetFirst();
  }

  async syncFromSheetFirst() {
    try {
      console.log("[LabBook System] Memulakan penyelarasan data daripada Google Sheet...");
      await Promise.allSettled([
        this.store.fetchFromSheet(),
        (this.authStore && typeof this.authStore.fetchUsersFromSheet === 'function')
          ? this.authStore.fetchUsersFromSheet()
          : Promise.resolve()
      ]);
      this.render();
      console.log("[LabBook System] Data makmal & pengguna berjaya diselaraskan daripada Google Sheet!");
    } catch (e) {
      console.warn("Ralat penyelarasan awal Google Sheet:", e);
    }

    // Selaraskan juga dengan pelayan tempatan jika wujud
    try {
      this.store.fetchFromPythonBackend();
      if (this.authStore && typeof this.authStore.fetchUsersFromBackend === 'function') {
        this.authStore.fetchUsersFromBackend();
      }
    } catch (e) { }
  }

  render() {
    this.headerView.render();
    this.calendarView.render();

    // Kawalan paparan Tab Sejarah Tempahan (Hanya Boleh Dilihat Selepas Log Masuk)
    const isLoggedIn = this.authStore.isLoggedIn();
    const btnHistory = document.getElementById('tabBtnHistory');
    if (btnHistory) {
      btnHistory.style.display = isLoggedIn ? 'flex' : 'none';
    }

    // Jika pengguna sedang di tab history tetapi belum/tidak lagi log masuk, alihkan semula ke schedule
    if (!isLoggedIn && this.activeTab === 'history') {
      this.switchTab('schedule');
      return;
    }

    if (isLoggedIn) {
      this.historyView.render();
    }

    // Kawalan paparan Tab Penyelaras ICT (Hanya Boleh Dilihat Oleh Penyelaras ICT / Admin Verified)
    const isCoordinator = this.authStore.isLabCoordinator();
    const btnAdmin = document.getElementById('tabBtnAdmin');
    if (btnAdmin) {
      btnAdmin.style.display = isCoordinator ? 'flex' : 'none';
    }

    if (this.activeTab === 'admin') {
      if (!isCoordinator) {
        this.switchTab('schedule');
        return;
      }
      this.tableView.render();
    }
    if (this.activeTab === 'profile') {
      this.profileView.render();
    }
    if (this.activeTab === 'history') {
      this.historyView.render();
    }
    if (window.lucide) lucide.createIcons();
  }

  switchTab(tabName) {
    this.closeMobileSidebar();
    const schedPanel = document.getElementById('scheduleTabPanel');
    const historyPanel = document.getElementById('historyTabPanel');
    const adminPanel = document.getElementById('adminTabPanel');
    const profilePanel = document.getElementById('profileTabPanel');
    const btnSched = document.getElementById('tabBtnSchedule');
    const btnHistory = document.getElementById('tabBtnHistory');
    const btnAdmin = document.getElementById('tabBtnAdmin');
    const btnProfile = document.getElementById('tabBtnProfile');

    if (schedPanel) {
      schedPanel.classList.remove('active');
      schedPanel.style.display = 'none';
    }
    if (historyPanel) {
      historyPanel.classList.remove('active');
      historyPanel.style.display = 'none';
    }
    if (adminPanel) {
      adminPanel.classList.remove('active');
      adminPanel.style.display = 'none';
    }
    if (profilePanel) {
      profilePanel.classList.remove('active');
      profilePanel.style.display = 'none';
    }

    if (btnSched) btnSched.classList.remove('active');
    if (btnHistory) btnHistory.classList.remove('active');
    if (btnAdmin) btnAdmin.classList.remove('active');
    if (btnProfile) btnProfile.classList.remove('active');

    if (tabName === 'history') {
      // Tab hanya boleh dilihat selepas log masuk
      if (!this.authStore.isLoggedIn()) {
        this.modalView.openLogin();
        this.showToast("Sila log masuk untuk melihat sejarah tempahan anda.", "error");
        return;
      }
      this.activeTab = 'history';
      if (historyPanel) {
        historyPanel.classList.add('active');
        historyPanel.style.display = 'flex';
      }
      if (btnHistory) btnHistory.classList.add('active');
      this.historyView.render();
    } else if (tabName === 'admin') {
      if (!this.authStore.isLabCoordinator()) {
        if (!this.authStore.isLoggedIn()) {
          this.modalView.openLogin();
          this.showToast("Tab ini hanya untuk akaun Penyelaras ICT sahaja.", "error");
        } else {
          this.modalView.openAdminAuth();
        }
        return;
      }
      this.activeTab = 'admin';
      if (adminPanel) {
        adminPanel.classList.add('active');
        adminPanel.style.display = 'flex';
      }
      if (btnAdmin) btnAdmin.classList.add('active');
      this.tableView.render();
    } else if (tabName === 'profile') {
      this.activeTab = 'profile';
      if (profilePanel) {
        profilePanel.classList.add('active');
        profilePanel.style.display = 'flex';
      }
      if (btnProfile) btnProfile.classList.add('active');
      this.profileView.render();
    } else {
      this.activeTab = 'schedule';
      if (schedPanel) {
        schedPanel.classList.add('active');
        schedPanel.style.display = 'flex';
      }
      if (btnSched) btnSched.classList.add('active');
      this.calendarView.render();
    }
    requestAnimationFrame(() => {
      if (window.lucide) lucide.createIcons();
    });
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('gcalSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  bindEvents() {
    // Navigation Tabs
    const tabSched = document.getElementById('tabBtnSchedule');
    if (tabSched) tabSched.addEventListener('click', () => this.switchTab('schedule'));

    const tabHistory = document.getElementById('tabBtnHistory');
    if (tabHistory) tabHistory.addEventListener('click', () => this.switchTab('history'));

    const tabAdmin = document.getElementById('tabBtnAdmin');
    if (tabAdmin) tabAdmin.addEventListener('click', () => this.switchTab('admin'));

    const tabProfile = document.getElementById('tabBtnProfile');
    if (tabProfile) tabProfile.addEventListener('click', () => this.switchTab('profile'));

    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', (e) => this.profileView.handleProfileSubmit(e));

    // Sidebar Toggle (Desktop & Mobile)
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        const sidebar = document.getElementById('gcalSidebar');
        if (sidebar) {
          if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-open');
            if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active');
          } else {
            sidebar.classList.toggle('collapsed');
          }
        }
      });
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => this.closeMobileSidebar());
    }

    // Mobile FAB Button & Desktop Create Button
    const btnCreateSidebar = document.getElementById('btnOpenBookingModalSidebar');
    if (btnCreateSidebar) btnCreateSidebar.addEventListener('click', () => {
      this.closeMobileSidebar();
      this.modalView.openBooking();
    });

    const mobileFabBtn = document.getElementById('mobileFabBtn');
    if (mobileFabBtn) mobileFabBtn.addEventListener('click', () => {
      this.closeMobileSidebar();
      this.modalView.openBooking();
    });

    // Week Navigation
    const btnToday = document.getElementById('btnToday');
    if (btnToday) {
      btnToday.addEventListener('click', () => {
        this.store.currentSunday = DateUtils.getSunday(new Date());
        this.render();
      });
    }

    const btnPrevWeek = document.getElementById('btnPrevWeek');
    if (btnPrevWeek) {
      btnPrevWeek.addEventListener('click', () => this.prevWeek());
    }

    const btnNextWeek = document.getElementById('btnNextWeek');
    if (btnNextWeek) {
      btnNextWeek.addEventListener('click', () => this.nextWeek());
    }

    // Search & Filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.store.searchQuery = e.target.value.toLowerCase();
        this.tableView.render();
        if (window.lucide) lucide.createIcons();
      });
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.store.statusFilter = e.target.value;
        this.tableView.render();
        if (window.lucide) lucide.createIcons();
      });
    }

    const dayFilter = document.getElementById('dayFilter');
    if (dayFilter) {
      dayFilter.addEventListener('change', (e) => {
        this.store.dayFilter = e.target.value;
        this.tableView.render();
        if (window.lucide) lucide.createIcons();
      });
    }

    const userBookingFilter = document.getElementById('userBookingFilter');
    if (userBookingFilter) {
      userBookingFilter.addEventListener('change', (e) => {
        this.store.userFilter = e.target.value;
        this.tableView.renderBookingsList();
        if (window.lucide) lucide.createIcons();
      });
    }

    // Modal Events
    const btnCloseBookingModal = document.getElementById('btnCloseBookingModal');
    if (btnCloseBookingModal) btnCloseBookingModal.addEventListener('click', () => this.modalView.closeBooking());

    const btnCancelBooking = document.getElementById('btnCancelBooking');
    if (btnCancelBooking) btnCancelBooking.addEventListener('click', () => this.modalView.closeBooking());

    // Form
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) bookingForm.addEventListener('submit', (e) => this.modalView.handleBookingSubmit(e));

    const formDate = document.getElementById('formDate');
    if (formDate) {
      formDate.addEventListener('change', () => this.modalView.checkConflict());
      formDate.addEventListener('input', () => this.modalView.checkConflict());
    }

    const formSlot = document.getElementById('formSlot');
    if (formSlot) {
      formSlot.addEventListener('change', () => this.modalView.handleSlot1Change());
    }

    const formSlotCount = document.getElementById('formSlotCount');
    if (formSlotCount) {
      formSlotCount.addEventListener('change', () => this.modalView.updateSlotCountUI());
    }

    const formSlot2 = document.getElementById('formSlot2');
    if (formSlot2) {
      formSlot2.addEventListener('change', () => this.modalView.checkConflict());
    }

    // Login & Google SSO & Registration Events
    const authTabLogin = document.getElementById('authTabLogin');
    if (authTabLogin) authTabLogin.addEventListener('click', () => this.modalView.switchAuthTab('login'));

    const authTabRegister = document.getElementById('authTabRegister');
    if (authTabRegister) authTabRegister.addEventListener('click', () => this.modalView.switchAuthTab('register'));

    const btnGoogleSSO = document.getElementById('btnGoogleSSO');
    if (btnGoogleSSO) btnGoogleSSO.addEventListener('click', () => this.modalView.handleGoogleSSO());

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', (e) => this.modalView.handleLoginSubmit(e));

    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', (e) => this.modalView.handleRegisterSubmit(e));

    const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
    if (btnCloseLoginModal) btnCloseLoginModal.addEventListener('click', () => this.modalView.closeLogin());

    // Google SSO Account Chooser Modal Events
    const btnCloseGoogleSsoModal = document.getElementById('btnCloseGoogleSsoModal');
    if (btnCloseGoogleSsoModal) btnCloseGoogleSsoModal.addEventListener('click', () => this.modalView.closeGoogleSSOPicker());

    const ssoAccount1 = document.getElementById('ssoAccount1');
    if (ssoAccount1) ssoAccount1.addEventListener('click', () => this.modalView.selectGoogleAccount('Cikgu Ahmad Razali', 'g-83920192@moe-dl.edu.my'));

    const ssoAccount2 = document.getElementById('ssoAccount2');
    if (ssoAccount2) ssoAccount2.addEventListener('click', () => this.modalView.selectGoogleAccount('Cikgu Siti Nurhaliza', 'g-10293847@moe-dl.edu.my'));

    const customGoogleAccountForm = document.getElementById('customGoogleAccountForm');
    if (customGoogleAccountForm) customGoogleAccountForm.addEventListener('submit', (e) => this.modalView.handleCustomGoogleAccountSubmit(e));

    // Admin Auth Modal Events
    const adminAuthForm = document.getElementById('adminAuthForm');
    if (adminAuthForm) adminAuthForm.addEventListener('submit', (e) => this.modalView.handleAdminAuthSubmit(e));

    const btnCloseAdminAuthModal = document.getElementById('btnCloseAdminAuthModal');
    if (btnCloseAdminAuthModal) btnCloseAdminAuthModal.addEventListener('click', () => this.modalView.closeAdminAuth());

    // Admin Recurring Checkbox in Booking Modal
    const chkAdminRecurring = document.getElementById('chkAdminRecurring');
    const adminRecurringOptions = document.getElementById('adminRecurringOptions');
    if (chkAdminRecurring && adminRecurringOptions) {
      chkAdminRecurring.addEventListener('change', (e) => {
        adminRecurringOptions.style.display = e.target.checked ? 'grid' : 'none';
      });
    }

    // Schedule Generator & Google Sheet Batch Sync Events (Admin Only)
    const btnSyncAllToSheet = document.getElementById('btnSyncAllToSheet');
    if (btnSyncAllToSheet) {
      btnSyncAllToSheet.addEventListener('click', () => this.handleSyncAllToGoogleSheet());
    }

    const btnOpenScheduleGenerator = document.getElementById('btnOpenScheduleGenerator');
    if (btnOpenScheduleGenerator) {
      btnOpenScheduleGenerator.addEventListener('click', () => this.modalView.openScheduleGenerator());
    }

    const tabBtnScheduleGenerator = document.getElementById('tabBtnScheduleGenerator');
    if (tabBtnScheduleGenerator) {
      tabBtnScheduleGenerator.addEventListener('click', () => {
        this.closeMobileSidebar();
        this.modalView.openScheduleGenerator();
      });
    }

    const btnCloseScheduleGeneratorModal = document.getElementById('btnCloseScheduleGeneratorModal');
    if (btnCloseScheduleGeneratorModal) {
      btnCloseScheduleGeneratorModal.addEventListener('click', () => this.modalView.closeScheduleGenerator());
    }

    const btnCancelScheduleGenerator = document.getElementById('btnCancelScheduleGenerator');
    if (btnCancelScheduleGenerator) {
      btnCancelScheduleGenerator.addEventListener('click', () => this.modalView.closeScheduleGenerator());
    }

    const scheduleGeneratorForm = document.getElementById('scheduleGeneratorForm');
    if (scheduleGeneratorForm) {
      scheduleGeneratorForm.addEventListener('submit', (e) => this.modalView.handleScheduleGeneratorSubmit(e));
    }

    const btnClearGeneratedSchedule = document.getElementById('btnClearGeneratedSchedule');
    if (btnClearGeneratedSchedule) {
      btnClearGeneratedSchedule.addEventListener('click', () => this.modalView.handleClearGeneratedSchedule());
    }

    const genStartSunday = document.getElementById('genStartSunday');
    if (genStartSunday) {
      genStartSunday.addEventListener('change', () => this.modalView.updateSchedulePreview());
      genStartSunday.addEventListener('input', () => this.modalView.updateSchedulePreview());
    }

    const genWeeksCount = document.getElementById('genWeeksCount');
    if (genWeeksCount) {
      genWeeksCount.addEventListener('change', () => this.modalView.updateSchedulePreview());
    }

    const genEnableRotation = document.getElementById('genEnableRotation');
    if (genEnableRotation) {
      genEnableRotation.addEventListener('change', () => this.modalView.updateSchedulePreview());
    }

    const previewRotationControls = document.getElementById('previewRotationControls');
    if (previewRotationControls) {
      previewRotationControls.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-preview-week');
        if (btn) {
          const weekOffset = parseInt(btn.dataset.week, 10) || 0;
          this.modalView.updateSchedulePreview(weekOffset);
        }
      });
    }

    const tabGenStartSunday = document.getElementById('tabGenStartSunday');
    if (tabGenStartSunday) {
      tabGenStartSunday.addEventListener('change', () => this.modalView.updateSchedulePreview());
      tabGenStartSunday.addEventListener('input', () => this.modalView.updateSchedulePreview());
    }

    const tabGenWeeksCount = document.getElementById('tabGenWeeksCount');
    if (tabGenWeeksCount) {
      tabGenWeeksCount.addEventListener('change', () => this.modalView.updateSchedulePreview());
    }

    const tabGenEnableRotation = document.getElementById('tabGenEnableRotation');
    if (tabGenEnableRotation) {
      tabGenEnableRotation.addEventListener('change', () => this.modalView.updateSchedulePreview());
    }

    const tabPreviewRotationControls = document.getElementById('tabPreviewRotationControls');
    if (tabPreviewRotationControls) {
      tabPreviewRotationControls.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-preview-week');
        if (btn) {
          const weekOffset = parseInt(btn.dataset.week, 10) || 0;
          this.modalView.updateSchedulePreview(weekOffset);
        }
      });
    }

    // Slip Modal
    const btnCloseSlipModal = document.getElementById('btnCloseSlipModal');
    if (btnCloseSlipModal) btnCloseSlipModal.addEventListener('click', () => this.modalView.closeSlip());

    const btnCloseSlipBtn = document.getElementById('btnCloseSlipBtn');
    if (btnCloseSlipBtn) btnCloseSlipBtn.addEventListener('click', () => this.modalView.closeSlip());

    const slipModal = document.getElementById('slipModal');
    if (slipModal) {
      slipModal.addEventListener('click', (e) => {
        if (e.target === slipModal) this.modalView.closeSlip();
      });
    }

    const btnPrintSlip = document.getElementById('btnPrintSlip');
    if (btnPrintSlip) btnPrintSlip.addEventListener('click', () => window.print());

    // Edit User Modal Events (Penyelaras ICT)
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
      editUserForm.addEventListener('submit', (e) => this.modalView.handleEditUserSubmit(e));
    }

    const btnCloseEditUserModal = document.getElementById('btnCloseEditUserModal');
    if (btnCloseEditUserModal) {
      btnCloseEditUserModal.addEventListener('click', () => this.modalView.closeEditUser());
    }

    const btnCancelEditUser = document.getElementById('btnCancelEditUser');
    if (btnCancelEditUser) {
      btnCancelEditUser.addEventListener('click', () => this.modalView.closeEditUser());
    }

    const tabScheduleGeneratorForm = document.getElementById('tabScheduleGeneratorForm');
    if (tabScheduleGeneratorForm) {
      tabScheduleGeneratorForm.addEventListener('submit', (e) => this.modalView.handleScheduleGeneratorSubmit(e));
    }

    // User Usage History Modal Events (Penyelaras ICT)
    const btnCloseUserUsageModal = document.getElementById('btnCloseUserUsageModal');
    if (btnCloseUserUsageModal) {
      btnCloseUserUsageModal.addEventListener('click', () => this.modalView.closeUserUsageHistory());
    }

    const btnCloseUserUsageBtn = document.getElementById('btnCloseUserUsageBtn');
    if (btnCloseUserUsageBtn) {
      btnCloseUserUsageBtn.addEventListener('click', () => this.modalView.closeUserUsageHistory());
    }

    const userUsageModal = document.getElementById('userUsageModal');
    if (userUsageModal) {
      userUsageModal.addEventListener('click', (e) => {
        if (e.target === userUsageModal) this.modalView.closeUserUsageHistory();
      });
    }

    const userUsageSearchInput = document.getElementById('userUsageSearchInput');
    if (userUsageSearchInput) {
      userUsageSearchInput.addEventListener('input', () => this.modalView.renderUserUsageBookings());
    }

    const userUsageStatusFilter = document.getElementById('userUsageStatusFilter');
    if (userUsageStatusFilter) {
      userUsageStatusFilter.addEventListener('change', () => this.modalView.renderUserUsageBookings());
    }
  }

  switchPenyelarasSubtab(subtab) {
    const btnBookings = document.getElementById('subtabBtnBookings');
    const btnGenerator = document.getElementById('subtabBtnGenerator');
    const btnUsers = document.getElementById('subtabBtnUsers');

    const contentBookings = document.getElementById('subtabContentBookings');
    const contentGenerator = document.getElementById('subtabContentGenerator');
    const contentUsers = document.getElementById('subtabContentUsers');

    [btnBookings, btnGenerator, btnUsers].forEach(b => { if (b) b.classList.remove('active'); });
    [contentBookings, contentGenerator, contentUsers].forEach(c => { if (c) c.style.display = 'none'; });

    if (subtab === 'generator') {
      if (btnGenerator) btnGenerator.classList.add('active');
      if (contentGenerator) contentGenerator.style.display = 'block';
      this.modalView.updateSchedulePreview();
    } else if (subtab === 'users') {
      if (btnUsers) btnUsers.classList.add('active');
      if (contentUsers) contentUsers.style.display = 'block';
      this.tableView.renderUsersList();
    } else {
      if (btnBookings) btnBookings.classList.add('active');
      if (contentBookings) contentBookings.style.display = 'block';
      this.tableView.renderBookingsList();
    }
    if (window.lucide) lucide.createIcons();
  }

  filterUsersList() {
    this.tableView.renderUsersList();
  }

  openEditUserModal(userKey) {
    if (!this.authStore.isLabCoordinator()) {
      this.showToast("Akses dinafikan. Hanya Penyelaras ICT sahaja yang boleh edit akaun pengguna.", "error");
      return;
    }
    this.modalView.openEditUser(userKey);
  }

  openUserUsageHistory(userKey) {
    if (!this.authStore.isLabCoordinator()) {
      this.showToast("Akses dinafikan", "error");
      return;
    }
    this.modalView.openUserUsageHistory(userKey);
  }

  approveBookingFromUsage(id) {
    this.approveBooking(id);
    if (this.modalView && this.modalView.currentUserUsageUser) {
      this.modalView.renderUserUsageModal();
    }
  }

  rejectBookingFromUsage(id) {
    this.rejectBooking(id);
    if (this.modalView && this.modalView.currentUserUsageUser) {
      this.modalView.renderUserUsageModal();
    }
  }

  selectMiniCalDate(dateStr) {
    if (dateStr) {
      this.closeMobileSidebar();
      this.store.currentSunday = DateUtils.getSunday(new Date(dateStr));
      this.render();
    }
  }

  prevWeek() {
    const d = new Date(this.store.currentSunday);
    d.setDate(d.getDate() - 7);
    this.store.currentSunday = DateUtils.getSunday(d);
    this.render();
  }

  nextWeek() {
    const d = new Date(this.store.currentSunday);
    d.setDate(d.getDate() + 7);
    this.store.currentSunday = DateUtils.getSunday(d);
    this.render();
  }

  openLogin() {
    this.modalView.openLogin();
  }

  logout() {
    this.authStore.logout();
    const btnHistory = document.getElementById('tabBtnHistory');
    if (btnHistory) btnHistory.style.display = 'none';
    this.switchTab('schedule');
    this.render();
    this.showToast("Anda telah log keluar daripada Akaun Google DELIMa.", "success");
  }

  async cancelMyBooking(id) {
    if (!this.authStore.isLoggedIn()) {
      this.openLogin();
      return;
    }
    if (confirm(`Adakah anda pasti mahu membatalkan tempahan ${id} anda?`)) {
      try {
        await this.store.cancelUserBooking(id, this.authStore.currentUser);
        this.render();
        this.showToast(`Tempahan ${id} anda telah berjaya dibatalkan.`, "success");
      } catch (err) {
        this.showToast(err.message, "error");
      }
    }
  }

  openBookingModal(dateStr, slotStr) {
    this.modalView.openBooking(dateStr, slotStr);
  }

  openSlip(bookingId) {
    this.modalView.openSlip(bookingId);
  }

  approveBooking(id) {
    if (!this.authStore.isAdminVerified) {
      this.modalView.openAdminAuth();
      return;
    }
    this.store.approveBooking(id);
    this.render();
    this.showToast(`Tempahan ${id} telah DILULUSKAN!`, "success");
  }

  rejectBooking(id) {
    if (!this.authStore.isAdminVerified) {
      this.modalView.openAdminAuth();
      return;
    }
    if (confirm(`Adakah anda pasti mahu menolak / membatalkan tempahan ${id}?`)) {
      this.store.rejectBooking(id);
      this.render();
      this.showToast(`Tempahan ${id} telah DIBATALKAN.`, "success");
    }
  }

  cancelBooking(id) {
    this.rejectBooking(id);
  }

  showToast(message, type = "success") {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="width:18px;"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async handleSyncAllToGoogleSheet() {
    const btn = document.getElementById('btnSyncAllToSheet');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width:14px; height:14px;"></i><span>Menyelaras...</span>`;
      if (window.lucide) lucide.createIcons();
    }

    try {
      this.showToast("Menyelaras semua rekod slot ke Google Sheet secara pukal...", "info");
      const res = await this.store.syncAllToGoogleSheet();
      this.showToast(`Berjaya! Sebanyak ${res.count} rekod slot makmal telah dihantar ke Google Sheet.`, "success");
    } catch (err) {
      this.showToast(`Ralat penyelarasan: ${err.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if (window.lucide) lucide.createIcons();
      }
    }
  }
}

// --------------------------------------------------------------------------
// APPLICATION INITIALIZATION (GUARANTEED IMMEDIATE RENDER)
// --------------------------------------------------------------------------
function initApp() {
  if (!window.app) {
    window.app = new App();
    window.app.init();
  }
}

// Global callback for Google GSI HTML API (data-callback)
window.handleGoogleCredentialResponse = function (response) {
  if (window.app && window.app.modalView) {
    window.app.modalView.handleGoogleCredentialResponse(response);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
