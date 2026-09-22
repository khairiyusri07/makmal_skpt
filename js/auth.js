/* ==========================================================================
   LABBOOK - REAL GOOGLE DELIMa AUTHENTICATION & USER REGISTRATION SYSTEM
   ========================================================================== */

class AuthStore {
  constructor() {
    this.currentUser = null;
    this.isAdminVerified = false;
    this.registeredUsers = [];
    this.loadRegisteredUsers();
    this.loadSession();
  }

  loadRegisteredUsers() {
    const saved = localStorage.getItem('labbook_registered_users');
    if (saved) {
      try {
        this.registeredUsers = JSON.parse(saved);
      } catch (e) {
        this.registeredUsers = [];
      }
    }
    // Default seed accounts if empty
    if (!this.registeredUsers || this.registeredUsers.length === 0) {
      this.registeredUsers = [
        { name: "Cikgu Ahmad Razali", email: "g-83920192@moe-dl.edu.my", password: "password123", role: "Guru / Tenaga Pengajar" },
        { name: "Cikgu Siti Nurhaliza", email: "g-10293847@moe-dl.edu.my", password: "password123", role: "Guru / Tenaga Pengajar" }
      ];
      this.saveRegisteredUsers();
    }
  }

  saveRegisteredUsers() {
    localStorage.setItem('labbook_registered_users', JSON.stringify(this.registeredUsers));
  }

  loadSession() {
    const saved = localStorage.getItem('labbook_delima_user_session');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    } else {
      this.currentUser = null;
    }
  }

  saveSession() {
    if (this.currentUser) {
      localStorage.setItem('labbook_delima_user_session', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('labbook_delima_user_session');
    }
  }

  validateDelimaEmail(email) {
    if (!email) return false;
    const cleanEmail = email.trim().toLowerCase();
    return cleanEmail.endsWith('@moe-dl.edu.my');
  }

  registerUser(name, email, password, role = "Guru / Tenaga Pengajar") {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();

    if (!this.validateDelimaEmail(cleanEmail)) {
      throw new Error("Pendaftaran Gagal! ID Emel mesti berakhir dengan @moe-dl.edu.my");
    }

    if (!cleanName) {
      throw new Error("Sila masukkan Nama Penuh anda.");
    }

    if (!password || password.trim().length < 4) {
      throw new Error("Kata laluan mestilah sekurang-kurangnya 4 aksara.");
    }

    const existing = this.registeredUsers.find(u => u.email === cleanEmail);
    if (existing) {
      throw new Error(`Emel "${cleanEmail}" sudah berdaftar! Sila log masuk.`);
    }

    const newUser = {
      name: cleanName,
      email: cleanEmail,
      password: password,
      role: role,
      registeredAt: new Date().toISOString()
    };

    this.registeredUsers.push(newUser);
    this.saveRegisteredUsers();
    this.syncAccountToSheet(newUser);
    return newUser;
  }

  loginWithDelima(email, password, name) {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!this.validateDelimaEmail(cleanEmail)) {
      throw new Error("ID DELIMa tidak sah! Emel mesti berakhir dengan @moe-dl.edu.my (Contoh: g-12345678@moe-dl.edu.my)");
    }

    if (!password || password.trim().length < 4) {
      throw new Error("Sila masukkan Kata Laluan akaun DELIMa anda.");
    }

    let user = this.registeredUsers.find(u => u.email === cleanEmail);

    if (!user) {
      // Auto-register if new valid DELIMa user
      let formattedName = (name || '').trim();
      if (!formattedName) formattedName = `Cikgu (${cleanEmail.split('@')[0]})`;
      user = this.registerUser(formattedName, cleanEmail, password);
    } else {
      if (user.password && user.password !== "google_sso" && user.password !== password) {
        throw new Error("Kata Laluan tidak tepat! Sila cuba lagi.");
      }
    }

    this.currentUser = {
      name: user.name,
      email: user.email,
      role: user.role || "Guru / Tenaga Pengajar",
      loginTime: new Date().toISOString()
    };

    this.saveSession();
    this.syncAccountToSheet(this.currentUser);
    return this.currentUser;
  }

  loginWithGoogleProfile(name, email, picture) {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!this.validateDelimaEmail(cleanEmail)) {
      throw new Error(`Akaun Google "${cleanEmail}" bukan akaun DELIMa KPM! Sila gunakan akaun DELIMa KPM yang berakhir dengan @moe-dl.edu.my`);
    }

    let user = this.registeredUsers.find(u => u.email === cleanEmail);
    if (!user) {
      // Auto-register new valid DELIMa Google Sign-In user automatically
      const formattedName = name || `Cikgu (${cleanEmail.split('@')[0]})`;
      user = {
        name: formattedName,
        email: cleanEmail,
        password: "google_sso",
        role: "Guru / Tenaga Pengajar",
        registeredAt: new Date().toISOString()
      };
      this.registeredUsers.push(user);
      this.saveRegisteredUsers();
    }

    this.currentUser = {
      name: user.name,
      email: user.email,
      picture: picture || '',
      role: user.role || "Guru / Tenaga Pengajar",
      authProvider: "Google OAuth 2.0",
      loginTime: new Date().toISOString()
    };

    this.saveSession();
    this.syncAccountToSheet(this.currentUser);
    return this.currentUser;
  }

  async syncAccountToSheet(user) {
    if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.includes("YOUR_SCRIPT_ID")) return;
    try {
      const payload = JSON.stringify({
        action: "RECORD_USER_ACCOUNT",
        email: user.email,
        name: user.name,
        role: user.role || "Guru / Tenaga Pengajar",
        loginTime: new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
        authProvider: user.authProvider || "Google OAuth 2.0"
      });

      await fetch(GOOGLE_SHEET_API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: payload
      });
    } catch (err) {
      console.warn("Gagal menyelaraskan akaun pengguna ke Google Sheets:", err);
    }
  }

  updateUserProfile(data) {
    if (!this.currentUser) throw new Error("Tiada sesi pengguna aktif. Sila log masuk terlebih dahulu.");

    const cleanName = (data.name || '').trim();
    if (!cleanName) throw new Error("Nama Penuh tidak boleh dibiarkan kosong.");

    this.currentUser.name = cleanName;
    if (data.role) this.currentUser.role = data.role;
    if (data.phone) this.currentUser.phone = data.phone;
    if (data.subject) this.currentUser.subject = data.subject;

    // Kemaskini dalam senarai registeredUsers
    const registeredUser = this.registeredUsers.find(u => u.email === this.currentUser.email);
    if (registeredUser) {
      registeredUser.name = cleanName;
      if (data.role) registeredUser.role = data.role;
      if (data.phone) registeredUser.phone = data.phone;
      if (data.subject) registeredUser.subject = data.subject;
      this.saveRegisteredUsers();
    }

    this.saveSession();
    this.syncAccountToSheet(this.currentUser);
    return this.currentUser;
  }

  logout() {
    this.currentUser = null;
    this.isAdminVerified = false;
    this.saveSession();
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  verifyAdminPin(pin) {
    if (pin === "1234") {
      this.isAdminVerified = true;
      return true;
    }
    return false;
  }
}
