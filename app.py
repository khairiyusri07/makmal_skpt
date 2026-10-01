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
            userId TEXT,
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
            userId TEXT,
            name TEXT,
            password TEXT,
            role TEXT,
            phone TEXT,
            subject TEXT,
            registeredAt TEXT
        )
    ''')
    
    # Migration to add userId & userEmail column if missing in existing DB
    try:
        cursor.execute("ALTER TABLE bookings ADD COLUMN userId TEXT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE bookings ADD COLUMN userEmail TEXT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN userId TEXT")
    except Exception:
        pass

    # Seed initial users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        initial_users = [
            ("g-83920192@moe-dl.edu.my", "USR-83920192", "Cikgu Ahmad Razali", "password123", "Guru", "", "Sains", datetime.datetime.now().isoformat()),
            ("g-10293847@moe-dl.edu.my", "USR-10293847", "Cikgu Siti Nurhaliza", "password123", "Guru", "", "Matematik", datetime.datetime.now().isoformat()),
            ("penyelaras@moe-dl.edu.my", "USR-PENYELARAS", "Penyelaras Makmal", "password123", "Penyelaras Makmal Komputer", "0123456789", "ICT", datetime.datetime.now().isoformat())
        ]
        cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)", initial_users)
        
    # Seed initial bookings if empty
    cursor.execute("SELECT COUNT(*) FROM bookings")
    if cursor.fetchone()[0] == 0:
        today = datetime.date.today()
        # Create dates for current week matching Sunday start
        days_since_sunday = (today.weekday() + 1) % 7
        sunday = today - datetime.timedelta(days=days_since_sunday)
        monday = sunday + datetime.timedelta(days=1)
        tuesday = sunday + datetime.timedelta(days=2)
        wednesday = sunday + datetime.timedelta(days=3)
        
        sample_bookings = [
            (
                "TB-1001", "LAB-1", monday.strftime("%Y-%m-%d"),
                "08:00 - 08:30", "Cikgu Ahmad Razali", "Guru / Tenaga Pengajar",
                "RBT Tahun 5 - Coding Scratch", 35, "Pelajaran & Amali", "[]", "Perlu projektor",
                "Diluluskan", datetime.datetime.now().isoformat()
            ),
            (
                "TB-1002", "LAB-1", tuesday.strftime("%Y-%m-%d"),
                "10:00 - 10:30", "Cikgu Siti Nurhaliza", "Guru / Tenaga Pengajar",
                "Matematik - Kuiz Digital Kahoot", 35, "Pelajaran & Amali", "[]", "",
                "Diluluskan", datetime.datetime.now().isoformat()
            ),
            (
                "TB-1003", "LAB-1", wednesday.strftime("%Y-%m-%d"),
                "11:00 - 11:30", "Cikgu Ahmad Razali", "Guru / Tenaga Pengajar",
                "Sains - Latihan Interaktif DELIMa", 35, "Pelajaran & Amali", "[]", "",
                "Menunggu Kelulusan", datetime.datetime.now().isoformat()
            )
        ]
        cursor.executemany("""
            INSERT INTO bookings (id, labId, date, slot, applicant, role, subject, pcCount, purpose, equipments, notes, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_bookings)

    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

# Disable HTTP Caching for all requests (Auto Clear Cache on page load)
@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

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

    role = data.get('role', 'Guru / Tenaga Pengajar')
    is_admin = bool(data.get('isAdmin', False)) or any(k in str(role).lower() for k in ['admin', 'penyelaras', 'pentadbir', 'ict']) or 'Jadual Rasmi' in str(applicant)

    conn = get_db()
    cursor = conn.cursor()

    if not is_admin:
        # 1. Semakan tempahan bagi pengguna biasa: Hari semasa dan hari seterusnya sahaja
        tz_my = datetime.timezone(datetime.timedelta(hours=8))
        today_my = datetime.datetime.now(tz_my).date()
        tomorrow_my = today_my + datetime.timedelta(days=1)

        try:
            booking_date = datetime.date.fromisoformat(date)
        except Exception:
            conn.close()
            return jsonify({"status": "error", "message": "Format tarikh tidak sah."}), 400

        if booking_date < today_my:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "Tempahan slot makmal tidak dibenarkan bagi tarikh yang telah berlalu."
            }), 400

        if booking_date > tomorrow_my:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "Tempahan disekat! Guru biasa hanya dibenarkan menempah bagi hari semasa dan hari seterusnya sahaja. Tarikh selain itu dikhaskan untuk Penyelaras ICT."
            }), 400

        user_id = (data.get('userId') or '').strip()
        user_email = (data.get('userEmail') or '').strip()

        # 2. Semakan had maksimum 2 slot pada hari yang ditempah (HANYA pengguna biasa)
        cursor.execute("""
            SELECT COUNT(*) FROM bookings 
            WHERE date = ? 
              AND status != 'Dibatalkan'
              AND (
                  (? != '' AND userId = ?)
                  OR (? != '' AND userEmail = ?)
                  OR (? != '' AND applicant = ?)
              )
        """, (date, user_id, user_id, user_email, user_email, applicant, applicant))
        user_booking_count = cursor.fetchone()[0]

        if user_booking_count >= 2:
            conn.close()
            return jsonify({
                "status": "error",
                "message": f"Had tempahan tercapai! Pengguna telah menempah {user_booking_count} slot pada tarikh {date}. Maksimum 2 slot sehari sahaja dibenarkan bagi setiap pengguna."
            }), 400

    # 3. Check for conflict
    cursor.execute("""
        SELECT * FROM bookings 
        WHERE date = ? AND slot = ? AND status != 'Dibatalkan'
    """, (date, slot))
    existing = cursor.fetchone()

    if existing:
        target_id = data.get('id')
        if existing['id'] == target_id:
            pass # Kemaskini rekod sedia ada
        elif is_admin and (data.get('overwrite') or (target_id and str(target_id).startswith('JDL-'))):
            cursor.execute("UPDATE bookings SET status = 'Dibatalkan' WHERE id = ?", (existing['id'],))
        else:
            conn.close()
            return jsonify({
                "status": "error",
                "message": f"Slot {slot} pada tarikh {date} telah pun ditempah oleh {existing['applicant']} ({existing['subject']})."
            }), 409


    booking_id = data.get('id') or f"TB-{int(datetime.datetime.now().timestamp() * 1000) % 100000}"
    user_id = data.get('userId') or ''
    user_email = data.get('userEmail') or ''
    lab_id = data.get('labId', 'LAB-1')
    role = data.get('role', 'Guru / Tenaga Pengajar')
    pc_count = data.get('pcCount', 35)
    purpose = data.get('purpose', 'Pelajaran & Amali')
    equipments = json.dumps(data.get('equipments', []))
    notes = data.get('notes', '')
    status = data.get('status', 'Menunggu Kelulusan')
    created_at = data.get('createdAt') or datetime.datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO bookings (id, userId, userEmail, labId, date, slot, applicant, role, subject, pcCount, purpose, equipments, notes, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (booking_id, user_id, user_email, lab_id, date, slot, applicant, role, subject, pc_count, purpose, equipments, notes, status, created_at))

    conn.commit()
    conn.close()

    new_booking = {
        "id": booking_id,
        "userId": user_id,
        "userEmail": user_email,
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

# PUT & PATCH /api/bookings/<id>
@app.route('/api/bookings/<booking_id>', methods=['PUT', 'PATCH'])
def update_booking(booking_id):
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()

    clean_id = (booking_id or '').strip()
    cursor.execute("SELECT * FROM bookings WHERE LOWER(TRIM(id)) = LOWER(?)", (clean_id,))
    booking = cursor.fetchone()

    # Jika tidak dijumpai mengikut ID, cuba cari mengikut Tarikh & Slot
    if not booking and data.get('date') and data.get('slot'):
        cursor.execute("SELECT * FROM bookings WHERE date = ? AND slot = ?", (data['date'], data['slot']))
        booking = cursor.fetchone()

    if not booking:
        conn.close()
        return jsonify({"status": "error", "message": "Tempahan tidak ditemui untuk dikemaskini."}), 404

    target_id = booking['id']
    status = data.get('status', booking['status'])
    subject = data.get('subject', booking['subject'])
    applicant = data.get('applicant', booking['applicant'])

    # Kemaskini pada rekod sedia ada (UPDATE)
    cursor.execute("""
        UPDATE bookings 
        SET status = ?, subject = ?, applicant = ?
        WHERE id = ?
    """, (status, subject, applicant, target_id))

    conn.commit()

    cursor.execute("SELECT * FROM bookings WHERE id = ?", (target_id,))
    updated = dict(cursor.fetchone())
    conn.close()

    return jsonify({"status": "success", "data": updated})

# DELETE /api/bookings/<id>
@app.route('/api/bookings/<booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    data = request.json if (request.is_json and request.json) else {}
    conn = get_db()
    cursor = conn.cursor()
    clean_id = (booking_id or '').strip()

    # 1. Kemaskini status rekod sedia ada kepada 'Dibatalkan' mengikut ID
    cursor.execute("UPDATE bookings SET status = 'Dibatalkan' WHERE LOWER(TRIM(id)) = LOWER(?)", (clean_id,))

    # 2. Jika ID tidak sepadan, cuba kemaskini mengikut Tarikh & Slot jika dibekalkan
    if cursor.rowcount == 0 and data.get('date') and data.get('slot'):
        cursor.execute("UPDATE bookings SET status = 'Dibatalkan' WHERE date = ? AND slot = ?", (data['date'], data['slot']))

    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"Tempahan {booking_id} telah berjaya dikemaskini kepada 'Dibatalkan' pada rekod sedia ada."})

# GET /api/users
@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT email, name, role, phone, subject, registeredAt FROM users")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"status": "success", "data": rows})

# PUT /api/users/<email>
@app.route('/api/users/<email>', methods=['PUT'])
def update_user(email):
    data = request.json or {}
    clean_email = email.strip().lower()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (clean_email,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({"status": "error", "message": "Pengguna tidak ditemui."}), 404

    name = data.get('name', user['name'])
    role = data.get('role', user['role'])
    phone = data.get('phone', user['phone'])
    subject = data.get('subject', user['subject'])

    cursor.execute("""
        UPDATE users
        SET name = ?, role = ?, phone = ?, subject = ?
        WHERE LOWER(email) = ?
    """, (name, role, phone, subject, clean_email))

    if data.get('password') and len(str(data.get('password')).strip()) >= 4:
        cursor.execute("UPDATE users SET password = ? WHERE LOWER(email) = ?", (data['password'].strip(), clean_email))

    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Akaun pengguna berjaya dikemaskini."})

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
