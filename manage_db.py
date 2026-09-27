"""
SKPT Computer Lab - Database Helper & Manager Script
Memuatkan alat pengurusan pangkalan data SQLite.
"""

import sqlite3
import os
import json
import sys

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

DB_FILE = os.path.join(os.path.dirname(__file__), 'database.db')


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def show_summary():
    if not os.path.exists(DB_FILE):
        print("❌ Fail database.db belum wujud. Sila jalankan app.py terlebih dahulu.")
        return

    conn = get_db()
    cursor = conn.cursor()

    print("==================================================")
    print(" 📊 RINGKASAN PANGKALAN DATA (database.db)")
    print("==================================================")

    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM bookings")
    booking_count = cursor.fetchone()[0]

    print(f"👥 Jumlah Pengguna Berdaftar : {user_count}")
    print(f"📅 Jumlah Tempahan Makmal   : {booking_count}")
    print("-" * 50)

    print("\n[ 1. SENARAI PENGGUNA (users) ]")
    cursor.execute("SELECT email, name, role, phone FROM users")
    for u in cursor.fetchall():
        print(f" • {u['name']} ({u['email']}) - {u['role']}")

    print("\n[ 2. SENARAI TEMPAHAN (bookings) ]")
    cursor.execute("SELECT id, date, slot, applicant, subject, status FROM bookings ORDER BY date DESC")
    for b in cursor.fetchall():
        print(f" • [{b['id']}] {b['date']} | {b['slot']} | {b['applicant']} ({b['subject']}) -> STATUS: {b['status']}")

    print("==================================================")
    conn.close()

def export_json():
    if not os.path.exists(DB_FILE):
        print("❌ Fail database.db belum wujud.")
        return

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users")
    users = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM bookings")
    bookings = [dict(r) for r in cursor.fetchall()]

    data = {
        "users": users,
        "bookings": bookings
    }

    out_file = os.path.join(os.path.dirname(__file__), 'db_backup.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"✅ Eksport Berjaya! Fail disimpan di: {out_file}")
    conn.close()

def reset_db():
    confirm = input("⚠️ Adakah anda pasti mahu RESET pangkalan data? Semua tempahan akan dipadam (y/N): ")
    if confirm.lower() == 'y':
        if os.path.exists(DB_FILE):
            os.remove(DB_FILE)
            print("🗑️ Fail database.db telah dipadam. Jalankan app.py untuk bina semula pangkalan data asas.")
        else:
            print("Fail database.db tidak ditemui.")
    else:
        print("Operasi dibatalkan.")

def main():
    print("Alat Pengurusan Pangkalan Data SKPT")
    print("1. Lihat Ringkasan Data (Summary)")
    print("2. Eksport Data ke JSON Backup")
    print("3. Reset Database (Padam dan bina semula)")
    
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == 'summary':
            show_summary()
            return
        elif arg == 'export':
            export_json()
            return
        elif arg == 'reset':
            reset_db()
            return

    choice = input("\nPilih tindakan (1/2/3): ").strip()
    if choice == '1':
        show_summary()
    elif choice == '2':
        export_json()
    elif choice == '3':
        reset_db()
    else:
        show_summary()

if __name__ == '__main__':
    main()
