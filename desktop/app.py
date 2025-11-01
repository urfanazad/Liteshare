"""
PyQt desktop wrapper for the Python edition of LiteShare Mode. This
module starts the FastAPI server in a subprocess and displays the
client UI in a QWebEngineView. When the application exits, the
server is terminated automatically.
"""

import os
import sys
import time
import subprocess

from PyQt6.QtCore import QUrl
from PyQt6.QtWidgets import QApplication
from PyQt6.QtWebEngineWidgets import QWebEngineView

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000

def start_server():
    env = os.environ.copy()
    server_cmd = [
        sys.executable, "-m", "uvicorn",
        "server.main:app",
        "--host", SERVER_HOST,
        "--port", str(SERVER_PORT)
    ]
    return subprocess.Popen(server_cmd, cwd=os.path.dirname(os.path.dirname(__file__)))

def wait_for_server(timeout=12):
    import socket
    t0 = time.time()
    while time.time() - t0 < timeout:
        s = socket.socket()
        try:
            s.settimeout(0.5)
            s.connect((SERVER_HOST, SERVER_PORT))
            s.close()
            return True
        except Exception:
            time.sleep(0.2)
    return False

def main():
    proc = start_server()
    ok = wait_for_server(12)
    if not ok:
        print("Warning: server did not confirm in time; UI will still try to load.")

    app = QApplication(sys.argv)
    view = QWebEngineView()
    view.setWindowTitle("LiteShare Mode — Python Edition")
    view.resize(1200, 800)
    view.load(QUrl(f"http://{SERVER_HOST}:{SERVER_PORT}/"))
    view.show()

    exit_code = app.exec()
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        proc.kill()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
