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
    this.activeTab = 'schedule';
  }

  init() {
    this.bindEvents();
    this.render();
  }

  render() {
    this.headerView.render();
    this.calendarView.render();
    if (this.activeTab === 'admin') {
      this.tableView.render();
    }
    if (window.lucide) lucide.createIcons();
  }

  switchTab(tabName) {
    this.closeMobileSidebar();
    const schedPanel = document.getElementById('scheduleTabPanel');
    const adminPanel = document.getElementById('adminTabPanel');
    const btnSched = document.getElementById('tabBtnSchedule');
    const btnAdmin = document.getElementById('tabBtnAdmin');

    if (tabName === 'admin') {
      if (!this.authStore.isAdminVerified) {
        this.modalView.openAdminAuth();
        return;
      }
      this.activeTab = 'admin';
      if (schedPanel) {
        schedPanel.classList.remove('active');
        schedPanel.style.display = 'none';
      }
      if (adminPanel) {
        adminPanel.classList.add('active');
        adminPanel.style.display = 'flex';
      }
      if (btnSched) btnSched.classList.remove('active');
      if (btnAdmin) btnAdmin.classList.add('active');
      this.tableView.render();
    } else {
      this.activeTab = 'schedule';
      if (adminPanel) {
        adminPanel.classList.remove('active');
        adminPanel.style.display = 'none';
      }
      if (schedPanel) {
        schedPanel.classList.add('active');
        schedPanel.style.display = 'flex';
      }
      if (btnAdmin) btnAdmin.classList.remove('active');
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

    const tabAdmin = document.getElementById('tabBtnAdmin');
    if (tabAdmin) tabAdmin.addEventListener('click', () => this.switchTab('admin'));

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

    // Modal Events
    const btnCloseBookingModal = document.getElementById('btnCloseBookingModal');
    if (btnCloseBookingModal) btnCloseBookingModal.addEventListener('click', () => this.modalView.closeBooking());

    const btnCancelBooking = document.getElementById('btnCancelBooking');
    if (btnCancelBooking) btnCancelBooking.addEventListener('click', () => this.modalView.closeBooking());

    // Form
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) bookingForm.addEventListener('submit', (e) => this.modalView.handleBookingSubmit(e));

    const formDate = document.getElementById('formDate');
    if (formDate) formDate.addEventListener('change', () => this.modalView.checkConflict());

    const formSlot = document.getElementById('formSlot');
    if (formSlot) formSlot.addEventListener('change', () => this.modalView.checkConflict());

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

    // Slip Modal
    const btnCloseSlipModal = document.getElementById('btnCloseSlipModal');
    if (btnCloseSlipModal) btnCloseSlipModal.addEventListener('click', () => this.modalView.closeSlip());

    const btnCloseSlipBtn = document.getElementById('btnCloseSlipBtn');
    if (btnCloseSlipBtn) btnCloseSlipBtn.addEventListener('click', () => this.modalView.closeSlip());

    const btnPrintSlip = document.getElementById('btnPrintSlip');
    if (btnPrintSlip) btnPrintSlip.addEventListener('click', () => window.print());
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
    this.switchTab('schedule');
    this.render();
    this.showToast("Anda telah log keluar daripada Akaun Google DELIMa.", "success");
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
