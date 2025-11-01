let pc, ws, localStream, sender, statsTimer;
let liteMode = false;
let currentProfile = 'normal', stableCounter = 0, poorCounter = 0;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' }
];

const TARGETS = {
  normal: { maxBitrate: 1200000, fps: 15, scale: 1.0, label: 'Normal' },
  lite:   { maxBitrate: 300000,  fps: 8,  scale: 1.5, label: 'Lite' },
  ultra:  { maxBitrate: 150000,  fps: 5,  scale: 2.0, label: 'Ultra Lite' }
};

const $ = id => document.getElementById(id);
const joinBtn = $('joinBtn'), roomInput = $('roomId'), joinState = $('joinState');
const shareBtn = $('shareBtn'), stopShareBtn = $('stopShareBtn'), hangupBtn = $('hangupBtn');
const liteOnBtn = $('liteOnBtn'), liteOffBtn = $('liteOffBtn');
const localVideo = $('localVideo'), remoteVideo = $('remoteVideo'), statsPre = $('stats');

joinBtn.onclick = () => joinRoom(roomInput.value.trim() || 'demo-room');
shareBtn.onclick = () => startShare();
stopShareBtn.onclick = () => stopShare();
hangupBtn.onclick = () => hangup();
liteOnBtn.onclick = () => { liteMode = true; applyProfile('lite'); };
liteOffBtn.onclick = () => { liteMode = false; applyProfile('normal'); };

async function joinRoom(roomId) {
  if (ws?.readyState === WebSocket.OPEN) return;
  const proto = (location.protocol === 'https:') ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', roomId }));
    joinState.textContent = `Joined "${roomId}"`; joinState.className = 'ok';
  };

  ws.onmessage = async (evt) => {
    const { type, payload } = JSON.parse(evt.data);
    if (type === 'peer-joined' && localStream) createAndSendOffer();
    if (type === 'offer') {
      await ensurePeer(); await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', payload: { sdp: pc.localDescription } }));
    }
    if (type === 'answer') await pc.setRemoteDescription(payload.sdp);
    if (type === 'ice') { try { await pc.addIceCandidate(payload); } catch {} }
    if (type === 'peer-left') remoteVideo.srcObject = null;
  };

  ws.onclose = () => { joinState.textContent = 'Disconnected'; joinState.className = 'warn'; };
}

async function ensurePeer() {
  if (pc) return pc;
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = e => { if (e.candidate) ws?.send(JSON.stringify({ type:'ice', payload:e.candidate })); };
  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
  return pc;
}

async function startShare() {
  localStream = await navigator.mediaDevices.getDisplayMedia({
    video: { width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:12, max:15}, cursor:'always' },
    audio: false
  });
  localVideo.srcObject = localStream;

  await ensurePeer();
  const track = localStream.getVideoTracks()[0];
  track.contentHint = 'text';
  sender = pc.addTrack(track, localStream);

  currentProfile = liteMode ? 'lite' : 'normal';
  await applyProfile(currentProfile);
  await createAndSendOffer();

  shareBtn.disabled = true; stopShareBtn.disabled = false; hangupBtn.disabled = false;
  liteOnBtn.disabled = false; liteOffBtn.disabled = false;
  startStatsLoop();
}

function stopShare() {
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (sender) { try { pc.removeTrack(sender);} catch{} sender = null; }
  localVideo.srcObject = null; stopStatsLoop();
  shareBtn.disabled = false; stopShareBtn.disabled = true;
}

async function hangup() {
  stopShare();
  if (pc) { pc.getSenders().forEach(s => { try { pc.removeTrack(s);} catch{} }); pc.close(); pc = null; }
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  remoteVideo.srcObject = null; hangupBtn.disabled = true; liteOnBtn.disabled = true; liteOffBtn.disabled = true;
  joinState.textContent = 'Not joined'; joinState.className = 'muted';
}

async function createAndSendOffer() {
  const offer = await pc.createOffer({ offerToReceiveVideo:true, offerToReceiveAudio:false });
  await pc.setLocalDescription(offer);
  ws?.send(JSON.stringify({ type:'offer', payload:{ sdp: pc.localDescription }}));
}

async function applyProfile(key) {
  if (!sender) return;
  const p = sender.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
  const prof = TARGETS[key] || TARGETS.normal;
  p.encodings[0].maxBitrate = prof.maxBitrate;
  p.encodings[0].scaleResolutionDownBy = prof.scale;
  p.degradationPreference = 'maintain-resolution';
  await sender.setParameters(p);

  const track = sender.track;
  if (track?.applyConstraints) { try { await track.applyConstraints({ frameRate: prof.fps }); } catch {} }
  currentProfile = key;
}

function startStatsLoop() {
  stopStatsLoop();
  statsTimer = setInterval(async () => {
    if (!pc) return;
    const stats = await pc.getStats();
    let out, rtt, loss = 0, kbps = 0;
    stats.forEach(r => {
      if (r.type === 'outbound-rtp' && r.kind === 'video' && !r.isRemote) out = r;
      if (r.type === 'candidate-pair' && r.nominated) rtt = r.currentRoundTripTime;
    });
    if (out) {
      const now = out.timestamp, bytes = out.bytesSent;
      sender._lastBytes ??= bytes; sender._lastTs ??= now;
      const dBytes = bytes - sender._lastBytes, dTime = (now - sender._lastTs)/1000;
      if (dTime > 0) kbps = Math.round(((dBytes*8)/dTime)/1000);
      sender._lastBytes = bytes; sender._lastTs = now;
      if (out.packetsSent && out.packetsLost !== undefined) loss = out.packetsLost / (out.packetsSent + 1e-9);
    }
    const target = TARGETS[currentProfile].maxBitrate/1000;
    const bad = kbps < target*0.7 || (rtt && rtt>0.4) || loss>0.05;
    if (bad) { poorCounter++; stableCounter = 0; } else { stableCounter++; poorCounter = 0; }
    if (poorCounter >= 3) {
      if (currentProfile==='normal') applyProfile(liteMode?'ultra':'lite');
      else if (currentProfile==='lite') applyProfile('ultra');
      poorCounter=0;
    }
    if (stableCounter >= 10) {
      if (currentProfile==='ultra') applyProfile(liteMode?'lite':'normal');
      else if (currentProfile==='lite' && !liteMode) applyProfile('normal');
      stableCounter=0;
    }
    statsPre.textContent =
`Profile: ${currentProfile.toUpperCase()} (${TARGETS[currentProfile].label})
Bitrate: ${kbps} kbps  |  Target ~ ${Math.round(TARGETS[currentProfile].maxBitrate/1000)} kbps
RTT: ${rtt ? (rtt*1000).toFixed(0)+' ms' : 'n/a'}  |  Loss: ${(loss*100).toFixed(1)}%
LiteShare Mode: ${liteMode ? 'ON' : 'OFF'}`;
  }, 1500);
}
function stopStatsLoop(){ if (statsTimer) clearInterval(statsTimer); statsTimer=null; }
