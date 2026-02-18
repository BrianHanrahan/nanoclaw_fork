#!/usr/bin/env python3
"""
Fitness Tracker Backend Server - Adaptive Edition
Data-driven: no fixed schedule, Frank updates the plan dynamically.
Uses only Python standard library (no external dependencies)
"""

import http.server
import socketserver
import json
import os
from urllib.parse import urlparse
from datetime import datetime, date, timedelta

PORT = 5050
DATA_FILE = '/workspace/group/fitness-data.json'

def init_data():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w') as f:
            json.dump({'sessions': {}, 'plan': None}, f, indent=2)

def load_data():
    init_data()
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    # Migrate old format (flat dict of dates) to new format
    if 'sessions' not in data:
        old_sessions = {k: v for k, v in data.items()}
        data = {'sessions': old_sessions, 'plan': None}
        save_data(data)
    return data

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def compute_stats(data):
    sessions = data.get('sessions', {})
    total = sum(1 for s in sessions.values() if s.get('completed', False))

    # Streak: count consecutive completed workout days going back from today
    streak = 0
    check = date.today()
    for _ in range(60):
        date_str = check.isoformat()
        session = sessions.get(date_str, {})
        if session.get('completed', False):
            streak += 1
        elif check < date.today():
            # Past day with no workout breaks the streak
            # (allow today to be incomplete without breaking)
            break
        check -= timedelta(days=1)

    return {'totalWorkouts': total, 'currentStreak': streak}

class FitnessTrackerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='/workspace/group/fitness-tracker', **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length).decode('utf-8')) if length else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/all':
            self.send_json(load_data())

        elif path == '/api/stats':
            self.send_json(compute_stats(load_data()))

        elif path.startswith('/api/session/'):
            date_key = path.split('/')[-1]
            data = load_data()
            self.send_json(data['sessions'].get(date_key, {}))

        elif path == '/api/plan':
            data = load_data()
            self.send_json(data.get('plan') or {})

        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/session/'):
            date_key = path.split('/')[-1]
            body = self.read_body()
            data = load_data()
            data['sessions'][date_key] = body
            save_data(data)
            self.send_json({'success': True})

        elif path == '/api/plan':
            # Frank POSTs the next planned workout here
            body = self.read_body()
            data = load_data()
            data['plan'] = body
            save_data(data)
            self.send_json({'success': True})

        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    init_data()

    import socket
    try:
        local_ip = socket.gethostbyname(socket.gethostname())
    except:
        local_ip = 'your-local-ip'

    with socketserver.TCPServer(("0.0.0.0", PORT), FitnessTrackerHandler) as httpd:
        print(f"\n{'='*50}")
        print("Brian's Fitness Tracker (Adaptive)")
        print(f"{'='*50}")
        print(f"  http://localhost:{PORT}")
        print(f"  http://{local_ip}:{PORT}")
        print(f"{'='*50}\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
