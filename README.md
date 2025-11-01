# LiteShare Mode (Python Edition)

**LiteShare Mode** is a lightweight, adaptive screen-sharing system built with **FastAPI**, **WebRTC**, and **PyQt6**.  
It introduces a “Safe Mode for Screen Sharing,” automatically reducing resolution, frame rate, and bandwidth usage to maintain smooth collaboration even on poor internet connections.

---

## 🚀 Features
- 🔗 **Peer-to-peer WebRTC** connections with adaptive bitrate control  
- 🧠 **Lite Mode** toggle for low-bandwidth environments  
- ⚙️ **FastAPI WebSocket** signaling server  
- 💻 **PyQt Desktop Wrapper** for plug-and-play use  
- 📊 **Live network stats:** bitrate, packet loss, latency, and active profile

---

## 🧩 Project Structure
```
liteshare_py/
│
├── requirements.txt         # Python dependencies
│
├── server/
│   ├── main.py              # FastAPI server with WebSocket signaling
│   └── public/
│       ├── index.html       # WebRTC client interface
│       └── app.js           # Client logic (adaptive bitrate control)
│
└── desktop/
    └── app.py               # PyQt desktop wrapper
```

---

## ⚙️ Installation

### 1️⃣ Create and activate a virtual environment
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate
```

### 2️⃣ Install dependencies
```bash
pip install -r requirements.txt
```

---

## ▶️ Running the App

### Option 1: Desktop Mode (recommended)
This starts the FastAPI server and opens the UI in a PyQt WebView window.

```bash
python desktop/app.py
```

> 💡 The desktop app automatically launches the signaling server and connects the UI.

### Option 2: Server Mode (for browser testing)
Run only the FastAPI signaling server and open it manually in a browser.

```bash
python server/main.py
```
Then visit:  
**http://127.0.0.1:8000**

---

## 🌐 Usage Guide

1. Open the LiteShare window (or two browser tabs).  
2. Enter a **Room ID** (same on both peers).  
3. Click **Join**.  
4. On one side, click **Start Screen Share**.  
5. The other peer will automatically receive the shared screen.  
6. Toggle **Enable Lite Mode** for bandwidth optimization.

---

## 🧠 How It Works
- The app uses **WebRTC** for direct peer-to-peer streaming.  
- **FastAPI WebSocket** handles signaling (offer, answer, ICE).  
- The front-end JS dynamically applies bandwidth and resolution changes using `RTCRtpSender.setParameters()`.  
- **Lite Mode** caps bitrate (~300 kbps), lowers FPS (8 fps), and scales down resolution for smooth operation on 3G networks.

---

## 🧰 Build into Executable (optional)
You can package LiteShare into a standalone desktop app.

```bash
pip install pyinstaller
pyinstaller --noconfirm --noconsole --add-data "server/public:server/public" desktop/app.py
```

This will create a `dist/app` folder containing your executable.

---

## 🪶 License
MIT License © 2025 LiteShare Labs
