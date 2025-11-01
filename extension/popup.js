let pc, ws, localStream, sender;

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const $ = id => document.getElementById(id);
const joinBtn = $('joinBtn'), roomInput = $('roomId'), joinState = $('joinState');
const shareBtn = $('shareBtn'), stopShareBtn = $('stopShareBtn'), hangupBtn = $('hangupBtn');

joinBtn.onclick = () => joinRoom(roomInput.value.trim() || 'demo-room');
shareBtn.onclick = () => startShare();
stopShareBtn.onclick = () => stopShare();
hangupBtn.onclick = () => hangup();

async function joinRoom(roomId) {
  if (ws?.readyState === WebSocket.OPEN) return;

  const vercelAppName = prompt("Please enter your Vercel app name (e.g., 'liteshare-xyz'):");
  if (!vercelAppName) {
    joinState.textContent = 'Vercel app name is required.';
    return;
  }

  const token = prompt("Please enter your LiteShare token:");
  if (!token) {
    joinState.textContent = 'Token is required.';
    return;
  }

  const serverUrl = `wss://${vercelAppName}.vercel.app/api/ws?token=${token}`;
  ws = new WebSocket(serverUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', roomId }));
    joinState.textContent = `Joined "${roomId}"`;
  };

  ws.onmessage = async (evt) => {
    const { type, payload } = JSON.parse(evt.data);
    if (type === 'peer-joined' && localStream) createAndSendOffer();
    if (type === 'offer') {
      await ensurePeer();
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', payload: { sdp: pc.localDescription } }));
    }
    if (type === 'answer') await pc.setRemoteDescription(payload.sdp);
    if (type === 'ice') { try { await pc.addIceCandidate(payload); } catch {} }
  };

  ws.onclose = () => { joinState.textContent = 'Disconnected'; };
}

async function ensurePeer() {
  if (pc) return pc;
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = e => {
    if (e.candidate) ws?.send(JSON.stringify({ type: 'ice', payload: e.candidate }));
  };
  return pc;
}

async function startShare() {
  localStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

  await ensurePeer();
  const track = localStream.getVideoTracks()[0];
  sender = pc.addTrack(track, localStream);

  await createAndSendOffer();

  shareBtn.disabled = true;
  stopShareBtn.disabled = false;
  hangupBtn.disabled = false;
}

function stopShare() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (sender) {
    try { pc.removeTrack(sender); } catch (e) {}
    sender = null;
  }
  shareBtn.disabled = false;
  stopShareBtn.disabled = true;
}

async function hangup() {
  stopShare();
  if (pc) {
    pc.close();
    pc = null;
  }
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  hangupBtn.disabled = true;
  joinState.textContent = 'Not joined';
}

async function createAndSendOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws?.send(JSON.stringify({ type: 'offer', payload: { sdp: pc.localDescription } }));
}
