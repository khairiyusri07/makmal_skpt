import os
import sqlite3
import json
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.')
CORS(app)

DB_FILE = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Table Bookings
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            labId TEXT,
            date TEXT,
            slot TEXT,
            applicant TEXT,
            role TEXT,
            subject TEXT,
            pcCount INTEGER,
            purpose TEXT,
            equipments TEXT,
            notes TEXT,
            status TEXT,
            createdAt TEXT
        )
    ''')
    
    # Table Users
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT,
            password TEXT,
            role TEXT,
            phone TEXT,
            subject TEXT,
            registeredAt TEXT
        )
    ''')
    
    # Seed initial users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        initial_users = [
            ("g-83920192@moe-dl.edu.my", "Cikgu Ahmad Razali", "password123", "Guru", "", "Sains", datetime.datetime.now().isoformat()),
            ("g-10293847@moe-dl.edu.my", "Cikgu Siti Nurhaliza", "password123", "Guru", "", "Matematik", datetime.datetime.now().isoformat()),
            ("penyelaras@moe-dl.edu.my", "Penyelaras Makmal", "password123", "Penyelaras Makmal Komputer", "0123456789", "ICT", datetime.datetime.now().isoformat())
        ]
        cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)", initial_users)
        
    # Seed initial bookings if empty
    cursor.execute("SELECT COUNT(*) FROM bookings")
    if cursor.fetchone()[0] == 0:
        today = datetime.date.today()
        # Create dates for current week
        monday = today - datetime.timedelta(days=today.weekday())
        
        sample_bookings = [
            (
                "TB-1001", "LAB-1", (monday + datetime.timedelta(days=0)).strftime("%Y-%m-%d"),
                "08:00 - 08:30", "Cikgu Ahmad Razali", "Guru / Tenaga Pengajar",
                "RBT Tahun 5 - Coding Scratch", 35, "Pelajaran & Amali", "[]", "Perlu projektor",
                "Diluluskan", datetime.datetime.now().isoformat()
            ),
            (
                "TB-1002", "LAB-1", (monday + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
                "10:00 - 10:30", "Cikgu Siti Nurhaliza", "Guru / Tenaga Pengajar",
                "Matematik - Kuiz Digital Kahoot", 35, "Pelajaran & Amali", "[]", "",
                "Diluluskan", datetime.datetime.now().isoformat()
            ),
            (
                "TB-1003", "LAB-1", (monday + datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
                "11:00 - 11:30", "Cikgu Ahmad Razali", "Guru / Tenaga Pengajar",
                "Sains - Latihan Interaktif DELIMa", 35, "Pelajaran & Amali", "[]", "",
                "Menunggu Kelulusan", datetime.datetime.now().isoformat()
            )
        ]
        cursor.executemany("INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", sample_bookings)

    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

# Serve Frontend Pages & Assets
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join('.', path)):
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')

# API Endpoints
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "app": "Tempahan Makmal Komputer SKPT",
        "engine": "Python Flask Web Application",
        "timestamp": datetime.datetime.now().isoformat()
    })

# GET /api/bookings
@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings ORDER BY date DESC, slot ASC")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for row in rows:
        item = dict(row)
        if item.get('equipments'):
            try:
                item['equipments'] = json.loads(item['equipments'])
            except Exception:
                item['equipments'] = []
        else:
            item['equipments'] = []
        result.append(item)

    return jsonify({"status": "success", "data": result})

# POST /api/bookings
@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.json or {}
    date = data.get('date')
    slot = data.get('slot')
    applicant = data.get('applicant', 'Guru')
    subject = data.get('subject', 'Tempahan Makmal')

    if not date or not slot:
        return jsonify({"status": "error", "message": "Tarikh dan Slot Masa diperlukan."}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Check for conflict
    cursor.execute("""
        SELECT * FROM bookings 
        WHERE date = ? AND slot = ? AND status != 'Dibatalkan'
    """, (date, slot))
    existing = cursor.fetchone()

    if existing:
        conn.close()
        return jsonify({
            "status": "error",
            "message": f"Slot {slot} pada tarikh {date} telah pun ditempah oleh {existing['applicant']} ({existing['subject']})."
        }), 409

    booking_id = data.get('id') or f"TB-{int(datetime.datetime.now().timestamp() * 1000) % 100000}"
    lab_id = data.get('labId', 'LAB-1')
    role = data.get('role', 'Guru / Tenaga Pengajar')
    pc_count = data.get('pcCount', 35)
    purpose = data.get('purpose', 'Pelajaran & Amali')
    equipments = json.dumps(data.get('equipments', []))
    notes = data.get('notes', '')
    status = data.get('status', 'Menunggu Kelulusan')
    created_at = data.get('createdAt') or datetime.datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO bookings (id, labId, date, slot, applicant, role, subject, pcCount, purpose, equipments, notes, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (booking_id, lab_id, date, slot, applicant, role, subject, pc_count, purpose, equipments, notes, status, created_at))

    conn.commit()
    conn.close()

    new_booking = {
        "id": booking_id,
        "labId": lab_id,
        "date": date,
        "slot": slot,
        "applicant": applicant,
        "role": role,
        "subject": subject,
        "pcCount": pc_count,
        "purpose": purpose,
        "equipments": data.get('equipments', []),
        "notes": notes,
        "status": status,
        "createdAt": created_at
    }

    return jsonify({"status": "success", "data": new_booking}), 201

# PUT /api/bookings/<id>
@app.route('/api/bookings/<booking_id>', methods=['PUT'])
def update_booking(booking_id):
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    booking = cursor.fetchone()
    if not booking:
        conn.close()
        return jsonify({"status": "error", "message": "Tempahan tidak ditemui."}), 404

    status = data.get('status', booking['status'])
    subject = data.get('subject', booking['subject'])
    applicant = data.get('applicant', booking['applicant'])

    cursor.execute("""
        UPDATE bookings 
        SET status = ?, subject = ?, applicant = ?
        WHERE id = ?
    """, (status, subject, applicant, booking_id))

    conn.commit()

    cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    updated = dict(cursor.fetchone())
    conn.close()

    return jsonify({"status": "success", "data": updated})

# DELETE /api/bookings/<id>
@app.route('/api/bookings/<booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE bookings SET status = 'Dibatalkan' WHERE id = ?", (booking_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"Tempahan {booking_id} telah dibatalkan."})

# GET /api/users
@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT email, name, role, phone, subject, registeredAt FROM users")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"status": "success", "data": rows})

# POST /api/auth/login
@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    name = (data.get('name') or '').strip()

    if not email.endswith('@moe-dl.edu.my'):
        return jsonify({"status": "error", "message": "ID emel mesti berakhir dengan @moe-dl.edu.my"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,))
    user = cursor.fetchone()

    if not user:
        # Auto-register new DELIMa account
        formatted_name = name if name else f"Cikgu ({email.split('@')[0]})"
        user_role = "Guru"
        registered_at = datetime.datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO users (email, name, password, role, phone, subject, registeredAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (email, formatted_name, password or "google_sso", user_role, "", "", registered_at))
        conn.commit()
        user_data = {
            "email": email,
            "name": formatted_name,
            "role": user_role,
            "loginTime": datetime.datetime.now().isoformat()
        }
    else:
        user_dict = dict(user)
        user_data = {
            "email": user_dict['email'],
            "name": user_dict['name'],
            "role": user_dict['role'],
            "phone": user_dict.get('phone', ''),
            "subject": user_dict.get('subject', ''),
            "loginTime": datetime.datetime.now().isoformat()
        }

    conn.close()
    return jsonify({"status": "success", "data": user_data})

# POST /api/auth/admin-verify
@app.route('/api/auth/admin-verify', methods=['POST'])
def admin_verify():
    data = request.json or {}
    pin = str(data.get('pin', ''))
    if pin == '1234':
        return jsonify({"status": "success", "verified": True})
    return jsonify({"status": "error", "message": "Kod PIN Admin tidak sah."}), 401

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"============================================================")
    print(f"  SKPT Computer Lab Booking - Python Web App (Flask Backend)")
    print(f"  Running locally at: http://localhost:{port}")
    print(f"============================================================")
    app.run(host='0.0.0.0', port=port, debug=True)
