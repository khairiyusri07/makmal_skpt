/**
 * GOOGLE APPS SCRIPT FOR MAKMAL KOMPUTER SKPT
 * Menyimpan Data Tempahan (Tab: Tempahan) & Data Pengguna (Tab: Pengguna)
 * dengan Sokongan UserID Automatik.
 * 
 * CARA ATUR PROJEK GOOGLE SHEETS:
 * 1. Buka Google Sheets anda.
 * 2. Buat 2 Tab / Sheet di bahagian bawah:
 *    - Tab 1: "Tempahan" (Header: Kod Tempahan | UserID | Tarikh | Slot Masa | Pemohon | Peranan | Kelas / Subjek | Bilangan PC | Tujuan | Peralatan | Nota | Status | Tarikh Dicipta)
 *    - Tab 2: "Pengguna" (Header: UserID | Emel ID DELIMa | Nama Penuh | Peranan / Jawatan | No. Telefon | Mata Pelajaran | Log Masuk Terakhir | Penyedia Log Masuk)
 * 3. Di Google Sheets, tekan Extensions (Sambungan) > Apps Script.
 * 4. Padamkan semua kod asal dan tampal (paste) kod di bawah ini.
 * 5. Tekan "Deploy" (Laksana) > "New deployment" > Pilih Jenis "Web app".
 * 6. Set "Execute as": "Me", "Who has access": "Anyone" (Sesiapa sahaja).
 * 7. Tekan Deploy, luluskan kebenaran (Authorize Access), dan salin URL Web App yang terhasil.
 * 8. Tampal URL tersebut pada `GOOGLE_SHEET_API_URL` di dalam fail `js/config.js`.
 */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. DAPATKAN SENARAI PENGGUNA
  if (action === "GET_USERS") {
    var userSheet = ss.getSheetByName("Pengguna") || ss.getSheetByName("Users");
    if (!userSheet) {
      return responseJSON({ status: "success", users: [] });
    }
    var data = userSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return responseJSON({ status: "success", users: [] });
    }
    var users = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0] || row[1]) {
        users.push({
          userId: String(row[0] || ""),
          email: String(row[1] || ""),
          name: String(row[2] || ""),
          role: String(row[3] || "Guru"),
          phone: String(row[4] || ""),
          subject: String(row[5] || ""),
          loginTime: String(row[6] || ""),
          authProvider: String(row[7] || "")
        });
      }
    }
    return responseJSON({ status: "success", users: users });
  }

  // 2. DAPATKAN SENARAI TEMPAHAN (Default GET)
  var bookingSheet = ss.getSheetByName("Tempahan") || ss.getSheetByName("Bookings") || ss.getSheets()[0];
  var data = bookingSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return responseJSON({ status: "success", data: [] });
  }

  var bookings = [];

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    
    // Semak format lajur (Sama ada ada lajur UserID di indeks 1 atau tidak)
    var hasUserIdCol = (data[0][1] && String(data[0][1]).toLowerCase().includes("user"));
    var bId = row[0];
    var bUserId = hasUserIdCol ? row[1] : "";
    var bDate = hasUserIdCol ? row[2] : row[1];
    var bSlot = hasUserIdCol ? row[3] : row[2];
    var bApplicant = hasUserIdCol ? row[4] : row[3];
    var bRole = hasUserIdCol ? row[5] : row[4];
    var bSubject = hasUserIdCol ? row[6] : row[5];
    var bPcCount = hasUserIdCol ? row[7] : row[6];
    var bPurpose = hasUserIdCol ? row[8] : row[7];
    var bStatus = hasUserIdCol ? row[11] : (row[10] || row[8] || "Diluluskan");
    var bCreatedAt = hasUserIdCol ? row[12] : (row[11] || row[9] || new Date().toISOString());

    bookings.push({
      id: bId,
      userId: bUserId,
      date: bDate,
      slot: bSlot,
      applicant: bApplicant,
      role: bRole,
      subject: bSubject,
      pcCount: bPcCount,
      purpose: bPurpose,
      status: bStatus,
      createdAt: bCreatedAt
    });
  }

  return responseJSON({ status: "success", data: bookings });
}

function doPost(e) {
  try {
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. TAMBAH / KEMASKINI REKOD PENGGUNA (Tab: Pengguna)
    if (data.action === "RECORD_USER_ACCOUNT") {
      var userSheet = ss.getSheetByName("Pengguna");
      if (!userSheet) {
        userSheet = ss.insertSheet("Pengguna");
        userSheet.appendRow([
          "UserID", "Emel ID DELIMa", "Nama Penuh", "Peranan / Jawatan",
          "No. Telefon", "Mata Pelajaran", "Log Masuk Terakhir", "Penyedia Log Masuk"
        ]);
        userSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e8f0fe");
      }

      var email = (data.email || "").toLowerCase().trim();
      var name = data.name || "";
      var role = data.role || "Guru";
      var phone = data.phone || "";
      var subject = data.subject || "";
      var loginTime = data.loginTime || new Date().toLocaleString('ms-MY');
      var authProvider = data.authProvider || "DELIMa / Google SSO";

      // Penjanaan UserID Automatik jika tiada
      var userId = data.userId || "";
      if (!userId) {
        var numMatch = email.match(/\d+/);
        if (numMatch) {
          userId = "USR-" + numMatch[0];
        } else {
          var cleanEmail = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          userId = "USR-" + cleanEmail;
        }
      }

      var allValues = userSheet.getDataRange().getValues();
      var rowIndex = -1;

      for (var i = 1; i < allValues.length; i++) {
        var sheetEmail = String(allValues[i][1] || allValues[i][0]).toLowerCase().trim();
        if (sheetEmail === email) {
          rowIndex = i + 1; // Row index 1-based
          break;
        }
      }

      if (rowIndex !== -1) {
        // Kemaskini pengguna sedia ada
        userSheet.getRange(rowIndex, 1).setValue(userId);
        userSheet.getRange(rowIndex, 3).setValue(name);
        userSheet.getRange(rowIndex, 4).setValue(role);
        if (phone) userSheet.getRange(rowIndex, 5).setValue(phone);
        if (subject) userSheet.getRange(rowIndex, 6).setValue(subject);
        userSheet.getRange(rowIndex, 7).setValue(loginTime);
        userSheet.getRange(rowIndex, 8).setValue(authProvider);
      } else {
        // Tambah pengguna baru
        userSheet.appendRow([userId, email, name, role, phone, subject, loginTime, authProvider]);
      }

      return responseJSON({ status: "success", userId: userId, message: "Rekod pengguna diselaraskan." });
    }

    // 2. TAMBAH TEMPAHAN BARU (Tab: Tempahan)
    if (data.action === "ADD" || data.booking) {
      var booking = data.booking || data;
      var bookingSheet = ss.getSheetByName("Tempahan") || ss.getSheetByName("Bookings") || ss.getSheets()[0];

      if (bookingSheet.getLastRow() === 0) {
        bookingSheet.appendRow([
          "Kod Tempahan", "UserID", "Tarikh", "Slot Masa", "Pemohon", "Peranan",
          "Kelas / Subjek", "Bilangan PC", "Tujuan", "Peralatan", "Nota", "Status", "Tarikh Dicipta"
        ]);
        bookingSheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#e8f0fe");
      }

      // Pastikan UserID ada untuk tempahan
      var bookingUserId = booking.userId || "";
      if (!bookingUserId && booking.applicant) {
        var numMatch = String(booking.applicant).match(/\d+/);
        if (numMatch) bookingUserId = "USR-" + numMatch[0];
      }

      bookingSheet.appendRow([
        booking.id || "",
        bookingUserId,
        booking.date || "",
        booking.slot || "",
        booking.applicant || "",
        booking.role || "Guru",
        booking.subject || "",
        booking.pcCount || 35,
        booking.purpose || "",
        JSON.stringify(booking.equipments || []),
        booking.notes || "",
        booking.status || "Menunggu Kelulusan",
        booking.createdAt || new Date().toISOString()
      ]);

      return responseJSON({ status: "success", message: "Tempahan ditambah." });
    }

    // 3. BATALKAN / KEMASKINI STATUS TEMPAHAN (Tab: Tempahan)
    if (data.action === "CANCEL" || data.action === "UPDATE_STATUS") {
      var bookingSheet = ss.getSheetByName("Tempahan") || ss.getSheetByName("Bookings") || ss.getSheets()[0];
      var targetId = data.id;
      var newStatus = data.status || "Dibatalkan";

      var rows = bookingSheet.getDataRange().getValues();
      var hasUserIdCol = (rows[0][1] && String(rows[0][1]).toLowerCase().includes("user"));
      var statusCol = hasUserIdCol ? 12 : 11;

      for (var j = 1; j < rows.length; j++) {
        if (String(rows[j][0]) === String(targetId)) {
          bookingSheet.getRange(j + 1, statusCol).setValue(newStatus);
          return responseJSON({ status: "success", message: "Status tempahan dikemaskini." });
        }
      }
      return responseJSON({ status: "error", message: "ID tempahan tidak dijumpai." });
    }

    return responseJSON({ status: "error", message: "Tindakan tidak sah." });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
