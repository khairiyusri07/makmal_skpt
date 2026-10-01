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

  generateUserId(email) {
    if (!email) return `USR-${Math.floor(1000 + Math.random() * 9000)}`;
    const numMatch = email.match(/\d+/);
    if (numMatch && numMatch[0]) {
      return `USR-${numMatch[0]}`;
    }
    const cleanStr = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `USR-${cleanStr}`;
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
    if (!this.registeredUsers || this.registeredUsers.length === 0) {
      this.registeredUsers = [
        { userId: "USR-83920192", name: "Cikgu Ahmad Razali", email: "g-83920192@moe-dl.edu.my", password: "password123", role: "Guru" },
        { userId: "USR-10293847", name: "Cikgu Siti Nurhaliza", email: "g-10293847@moe-dl.edu.my", password: "password123", role: "Guru" }
      ];
      this.saveRegisteredUsers();
    }
    let updated = false;
    this.registeredUsers.forEach(u => {
      if (!u.userId) {
        u.userId = this.generateUserId(u.email);
        updated = true;
      }
    });
    this.fetchUsersFromSheet();
    this.fetchUsersFromBackend();
  }

  async fetchUsersFromBackend() {
    try {
      const apiUrl = (typeof getBackendApiUrl === 'function') ? getBackendApiUrl('/users') : `${PYTHON_API_URL}/users`;
      let res = await fetch(apiUrl);
      if (!res.ok && !apiUrl.startsWith('http')) {
        res = await fetch('http://localhost:5000/api/users');
      }
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 'success' && Array.isArray(json.data)) {
          let updated = false;
          json.data.forEach(u => {
            const cleanEmail = (u.email || '').trim().toLowerCase();
            if (cleanEmail) {
              const idx = this.registeredUsers.findIndex(existing => existing.email === cleanEmail);
              if (idx === -1) {
                this.registeredUsers.push({
                  userId: u.userId || this.generateUserId(cleanEmail),
                  name: u.name,
                  email: cleanEmail,
                  role: u.role || 'Guru',
                  phone: u.phone || '',
                  subject: u.subject || '',
                  registeredAt: u.registeredAt || new Date().toISOString()
                });
                updated = true;
              } else {
                if (u.name) this.registeredUsers[idx].name = u.name;
                if (u.role) this.registeredUsers[idx].role = u.role;
                if (u.phone) this.registeredUsers[idx].phone = u.phone;
                if (u.subject) this.registeredUsers[idx].subject = u.subject;
                updated = true;
              }
            }
          });
          if (updated) this.saveRegisteredUsers();
        }
      }
    } catch (e) { }
  }

  async fetchUsersFromSheet() {
    if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.includes("YOUR_SCRIPT_ID")) return;
    try {
      const res = await fetch(`${GOOGLE_SHEET_API_URL}?action=GET_USERS`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 'success' && Array.isArray(json.users)) {
          let updated = false;
          json.users.forEach(u => {
            const cleanEmail = (u.email || '').trim().toLowerCase();
            if (cleanEmail) {
              const idx = this.registeredUsers.findIndex(existing => existing.email === cleanEmail);
              if (idx === -1) {
                this.registeredUsers.push({
                  userId: u.userId || this.generateUserId(cleanEmail),
                  name: u.name,
                  email: cleanEmail,
                  role: u.role || 'Guru',
                  phone: u.phone || '',
                  subject: u.subject || '',
                  registeredAt: u.loginTime || new Date().toISOString()
                });
                updated = true;
              } else if (!this.registeredUsers[idx].userId && u.userId) {
                this.registeredUsers[idx].userId = u.userId;
                updated = true;
              }
            }
          });
          if (updated) this.saveRegisteredUsers();
        }
      }
    } catch (e) { }
  }

  saveRegisteredUsers() {
    localStorage.setItem('labbook_registered_users', JSON.stringify(this.registeredUsers));
  }

  loadSession() {
    const saved = localStorage.getItem('labbook_delima_user_session');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        if (this.currentUser && !this.currentUser.userId && this.currentUser.email) {
          this.currentUser.userId = this.generateUserId(this.currentUser.email);
        }
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

  registerUser(name, email, password, role = "Guru") {
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
      userId: this.generateUserId(cleanEmail),
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
      userId: user.userId || this.generateUserId(user.email),
      name: user.name,
      email: user.email,
      role: user.role || "Guru",
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
        userId: this.generateUserId(cleanEmail),
        name: formattedName,
        email: cleanEmail,
        password: "google_sso",
        role: "Guru",
        registeredAt: new Date().toISOString()
      };
      this.registeredUsers.push(user);
      this.saveRegisteredUsers();
    }

    this.currentUser = {
      userId: user.userId || this.generateUserId(user.email),
      name: user.name,
      email: user.email,
      picture: picture || '',
      role: user.role || "Guru",
      authProvider: "Google OAuth 2.0",
      loginTime: new Date().toISOString()
    };

    this.saveSession();
    this.syncAccountToSheet(this.currentUser);
    return this.currentUser;
  }

  async syncAccountToSheet(user) {
    // Sync to Python Flask backend
    try {
      if (typeof PYTHON_API_URL !== 'undefined') {
        fetch(`${PYTHON_API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.userId || this.generateUserId(user.email),
            email: user.email,
            name: user.name,
            password: user.password || 'google_sso'
          })
        }).catch(err => { });
      }
    } catch (err) { }

    if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.includes("YOUR_SCRIPT_ID")) return;
    try {
      const payload = JSON.stringify({
        action: "RECORD_USER_ACCOUNT",
        userId: user.userId || this.generateUserId(user.email),
        email: user.email,
        name: user.name,
        role: user.role || "Guru",
        phone: user.phone || "",
        subject: user.subject || "",
        loginTime: new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
        authProvider: user.authProvider || "DELIMa / Google SSO"
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

  updateUserByAdmin(userId, data) {
    if (!this.isLabCoordinator()) {
      throw new Error("Akses dinafikan! Hanya Penyelaras ICT sahaja yang dibenarkan mengemas kini akaun pengguna.");
    }
    const cleanName = (data.name || '').trim();
    if (!cleanName) throw new Error("Nama Penuh pengguna tidak boleh dibiarkan kosong.");

    const user = this.registeredUsers.find(u => u.userId === userId || (data.email && u.email === data.email));
    if (!user) throw new Error("Akaun pengguna tidak dijumpai.");

    user.name = cleanName;
    if (data.role) user.role = data.role;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.subject !== undefined) user.subject = data.subject;
    if (data.password && data.password.trim().length >= 4) {
      user.password = data.password.trim();
    }

    this.saveRegisteredUsers();

    if (this.currentUser && (this.currentUser.email === user.email || this.currentUser.userId === user.userId)) {
      this.currentUser.name = user.name;
      this.currentUser.role = user.role;
      this.currentUser.phone = user.phone;
      this.currentUser.subject = user.subject;
      this.saveSession();
    }

    this.syncAccountToSheet(user);
    return user;
  }

  logout() {
    this.currentUser = null;
    this.isAdminVerified = false;
    this.saveSession();
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  isLabCoordinator() {
    if (this.isAdminVerified) return true;
    if (!this.currentUser) return false;
    const role = (this.currentUser.role || '').toLowerCase();
    return role.includes('penyelaras') || role.includes('admin') || role.includes('pentadbir') || role.includes('ict');
  }

  verifyAdminPin(pin) {
    if (pin === "1234") {
      this.isAdminVerified = true;
      return true;
    }
    return false;
  }
}
