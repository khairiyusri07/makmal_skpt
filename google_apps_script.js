/**
 * GOOGLE APPS SCRIPT FOR MAKMAL KOMPUTER SKPT
 * Menyimpan Data Tempahan (Tab: Tempahan) & Data Pengguna (Tab: Pengguna)
 * dengan Sokongan UserID Automatik & Robust In-Place Row Status Update.
 */

function getOrCreateSheet(ss, targetName) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim().toLowerCase();
    if (name === targetName.toLowerCase()) {
      return sheets[i];
    }
  }
  var newSheet = ss.insertSheet(targetName);
  return newSheet;
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. DAPATKAN SENARAI PENGGUNA (GET_USERS)
  if (action === "GET_USERS") {
    var userSheet = getOrCreateSheet(ss, "Pengguna");
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
          email: String(row[1] || row[0] || ""),
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
  var bookingSheet = getOrCreateSheet(ss, "Tempahan");
  var data = bookingSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return responseJSON({ status: "success", data: [] });
  }

  var bookings = [];
  var hasUserIdCol = (data[0][1] && String(data[0][1]).toLowerCase().includes("user"));

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    
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
      var userSheet = getOrCreateSheet(ss, "Pengguna");
      
      if (userSheet.getLastRow() === 0) {
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

      var userId = data.userId || "";
      if (!userId && email) {
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
        var rowCell0 = String(allValues[i][0] || "").toLowerCase().trim();
        var rowCell1 = String(allValues[i][1] || "").toLowerCase().trim();
        if ((email && (rowCell0 === email || rowCell1 === email)) || (userId && rowCell0 === userId.toLowerCase())) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex !== -1) {
        userSheet.getRange(rowIndex, 1).setValue(userId);
        userSheet.getRange(rowIndex, 2).setValue(email);
        userSheet.getRange(rowIndex, 3).setValue(name);
        userSheet.getRange(rowIndex, 4).setValue(role);
        if (phone) userSheet.getRange(rowIndex, 5).setValue(phone);
        if (subject) userSheet.getRange(rowIndex, 6).setValue(subject);
        userSheet.getRange(rowIndex, 7).setValue(loginTime);
        userSheet.getRange(rowIndex, 8).setValue(authProvider);
      } else {
        userSheet.appendRow([userId, email, name, role, phone, subject, loginTime, authProvider]);
      }

      return responseJSON({ status: "success", userId: userId, message: "Rekod pengguna diselaraskan." });
    }

    // 2. KEMASKINI ATAU TAMBAH TEMPAHAN (Tab: Tempahan)
    if (data.action === "ADD" || data.booking || data.action === "UPDATE_STATUS" || data.action === "CANCEL") {
      var booking = data.booking || {};
      var targetId = String(data.id || booking.id || "").trim();
      var newStatus = data.status || booking.status || "";

      var bookingSheet = getOrCreateSheet(ss, "Tempahan");

      if (bookingSheet.getLastRow() === 0) {
        bookingSheet.appendRow([
          "Kod Tempahan", "UserID", "Tarikh", "Slot Masa", "Pemohon", "Peranan",
          "Kelas / Subjek", "Bilangan PC", "Tujuan", "Peralatan", "Nota", "Status", "Tarikh Dicipta"
        ]);
        bookingSheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#e8f0fe");
      }

      var rows = bookingSheet.getDataRange().getValues();
      var hasUserIdCol = (rows[0][1] && String(rows[0][1]).toLowerCase().includes("user"));
      var statusCol = hasUserIdCol ? 12 : 11; // Lajur Status (1-based index)

      var existingRowIndex = -1;
      if (targetId) {
        for (var j = 1; j < rows.length; j++) {
          if (String(rows[j][0]).trim().toLowerCase() === targetId.toLowerCase()) {
            existingRowIndex = j + 1; // 1-based index
            break;
          }
        }
      }

      // JIKA BARIS SEDIA ADA DIJUMPAI: Kemaskini status pada baris asal (JANGAN tambah baris baru!)
      if (existingRowIndex !== -1) {
        if (newStatus) {
          bookingSheet.getRange(existingRowIndex, statusCol).setValue(newStatus);
        }
        return responseJSON({ status: "success", message: "Status tempahan " + targetId + " dikemaskini pada baris " + existingRowIndex });
      }

      // JIKA BARIS BELUM ADA (Tempahan Baru): Tambah baris baru
      var bookingUserId = booking.userId || "";
      if (!bookingUserId && booking.applicant) {
        var numMatch = String(booking.applicant).match(/\d+/);
        if (numMatch) bookingUserId = "USR-" + numMatch[0];
      }

      bookingSheet.appendRow([
        targetId || booking.id || "",
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
        booking.status || newStatus || "Menunggu Kelulusan",
        booking.createdAt || new Date().toISOString()
      ]);

      return responseJSON({ status: "success", message: "Tempahan baru ditambah." });
    }

    return responseJSON({ status: "error", message: "Tindakan melebihkan had." });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function testRecordUser() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, "Pengguna");
  sheet.appendRow(["USR-83920192", "g-83920192@moe-dl.edu.my", "Cikgu Ahmad Razali", "Guru", "0123456789", "Sains", new Date().toLocaleString('ms-MY'), "DELIMa SSO"]);
  Logger.log("Ujian Rekod Pengguna Berjaya!");
}
