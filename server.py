from flask import Flask, jsonify
from flask_cors import CORS
import random
import datetime

app = Flask(__name__)
# Enable CORS for all frontend requests
CORS(app)

history_db = []
alerts_db = []

def generate_sensor_data():
    now = datetime.datetime.now(datetime.timezone.utc)
    
    stress = round(180.0 + random.uniform(-30, 45), 1)
    vibration = round(2.0 + random.uniform(-0.6, 1.1), 2)
    tilt = round(0.15 + random.uniform(-0.05, 0.12), 2)
    
    status = "SAFE"
    health_score = random.randint(85, 98)
    
    if stress > 225 or vibration > 2.9:
        status = "CRITICAL"
        health_score = random.randint(30, 49)
    elif stress > 205 or vibration > 2.5:
        status = "WARNING"
        health_score = random.randint(55, 78)
        
    data = {
        "timestamp": now.isoformat(),
        "stress": stress,
        "vibration": vibration,
        "tilt": tilt,
        "health_score": health_score,
        "status": status
    }
    
    history_db.append(data)
    if len(history_db) > 50:
        history_db.pop(0)
        
    if status != "SAFE":
        alert_entry = {
            "timestamp": now.isoformat(),
            "type": "Critical Structural Stress" if status == "CRITICAL" else "Elevated Oscillation",
            "value": f"{stress} MPa / {vibration} Hz",
            "status": status
        }
        alerts_db.insert(0, alert_entry)
        if len(alerts_db) > 20:
            alerts_db.pop()
            
    return data

for _ in range(10):
    generate_sensor_data()

@app.route('/api/latest', methods=['GET'])
def get_latest():
    return jsonify(generate_sensor_data())

@app.route('/api/history', methods=['GET'])
def get_history():
    return jsonify(list(reversed(history_db)))

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    return jsonify(alerts_db)

if __name__ == '__main__':
    print("Starting Smart Bridge Monitoring Backend API on http://localhost:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=True)