/* ==========================================================================
   LABBOOK - BOOKING MODEL
   ========================================================================== */

class Booking {
  constructor(data) {
    this.id = data.id || `LAB-2026-${Math.floor(100 + Math.random() * 900)}`;
    this.labId = data.labId || "LAB-1";
    this.date = data.date;
    this.slot = data.slot;
    this.applicant = data.applicant;
    this.role = data.role || "Guru / Tenaga Pengajar";
    this.subject = data.subject; // Kelas / Subjek
    this.pcCount = data.pcCount || 35;
    this.purpose = data.purpose || "Pelajaran & Amali";
    this.equipments = data.equipments || [];
    this.notes = data.notes || "";
    this.status = data.status || "Menunggu Kelulusan";
  }
}
