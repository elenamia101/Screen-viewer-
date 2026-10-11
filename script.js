const socket = io();

const video = document.getElementById(“remoteVideo”);
const statusText = document.getElementById(“status”);
const roomInput = document.getElementById(“roomCode”);

let peer = null;
let currentRoom = “”;

const config = {
iceServers: [
{ urls: “stun:stun.l.google.com:19302” }
]
};

function setStatus(message) {
statusText.textContent = message;
}

function createPeer() {
peer = new RTCPeerConnection(config);

peer.ontrack = (event) => {
video.srcObject = event.streams[0];
setStatus(“Receiving screen…”);
};

peer.onicecandidate = (event) => {
if (event.candidate) {
socket.emit(“signal”, {
room: currentRoom,
data: {
type: “candidate”,
candidate: event.candidate
}
});
}
};
}

document.getElementById(“connectBtn”).onclick = () => {
currentRoom = roomInput.value.trim();

if (!currentRoom) {
setStatus(“Enter a connection code first.”);
return;
}

socket.emit(“join-room”, currentRoom);
setStatus(“Joining room…”);
};

socket.on(“joined-room”, () => {
setStatus(“Joined room. Waiting for the other phone…”);
});

socket.on(“peer-joined”, () => {
setStatus(“Other phone joined. Waiting for screen sharing…”);
});

socket.on(“signal”, async (message) => {
try {
if (!peer) createPeer();

const data = message.data;
if (data.type === "offer") {
  await peer.setRemoteDescription(data.offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("signal", {
    room: currentRoom,
    data: {
      type: "answer",
      answer: peer.localDescription
    }
  });
}
if (data.type === "answer") {
  await peer.setRemoteDescription(data.answer);
}
if (data.type === "candidate") {
  await peer.addIceCandidate(data.candidate);
}

} catch (error) {
console.error(error);
setStatus(“Connection error.”);
}
});

document.getElementById(“disconnectBtn”).onclick = () => {
if (peer) {
peer.close();
peer = null;
}

video.srcObject = null;

if (currentRoom) {
socket.emit(“leave-room”, currentRoom);
}

currentRoom = “”;
setStatus(“Disconnected.”);
};
