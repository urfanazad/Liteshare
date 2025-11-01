"""
FastAPI based signalling server and static file host for the Python
edition of LiteShare Mode. This server exposes a WebSocket endpoint
for peer signalling and serves the WebRTC client under `/`.
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

APP_DIR = Path(__file__).parent
PUBLIC_DIR = APP_DIR / "public"

app = FastAPI(title="LiteShare Mode (Python)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RoomHub:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def join(self, room_id: str, ws: WebSocket):
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(ws)

    def leave(self, room_id: str, ws: WebSocket):
        if room_id in self.rooms and ws in self.rooms[room_id]:
            self.rooms[room_id].remove(ws)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast(self, room_id: str, msg: dict, sender: WebSocket):
        if room_id not in self.rooms:
            return
        data = json.dumps(msg)
        for peer in list(self.rooms[room_id]):
            if peer is sender:
                continue
            try:
                await peer.send_text(data)
            except RuntimeError:
                pass

hub = RoomHub()

app.mount("/static", StaticFiles(directory=str(PUBLIC_DIR)), name="static")

@app.get("/")
async def index():
    return HTMLResponse((PUBLIC_DIR / "index.html").read_text(encoding="utf-8"))

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    room_id = None
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            mtype = msg.get("type")
            payload = msg.get("payload")
            rid = msg.get("roomId")

            if mtype == "join" and rid:
                room_id = rid
                await hub.join(room_id, ws)
                await hub.broadcast(room_id, {"type": "peer-joined"}, sender=ws)

            elif room_id:
                if mtype in ("offer", "answer", "ice"):
                    await hub.broadcast(room_id, {"type": mtype, "payload": payload}, sender=ws)

    except WebSocketDisconnect:
        pass
    finally:
        if room_id:
            hub.leave(room_id, ws)
            try:
                asyncio.create_task(hub.broadcast(room_id, {"type": "peer-left"}, sender=ws))
            except RuntimeError:
                pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host="127.0.0.1", port=8000, reload=False)
