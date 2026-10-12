const socket = io();

const video = document.getElementById("remoteVideo");
const statusText = document.getElementById("status");
const roomInput = document.getElementById("roomCode");

const viewBtn = document.getElementById("viewBtn");
const shareBtn = document.getElementById("shareBtn");
const disconnectBtn = document.getElementById("disconnectBtn");

let peer = null;
let currentRoom = "";
let currentRole = "";
let localStream = null;
let pendingCandidates = [];

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

function setStatus(message) {
  statusText.textContent = message;
}

function createPeer() {
  if (peer) {
    peer.close();
  }

  pendingCandidates = [];
  peer = new RTCPeerConnection(config);

  peer.onicecandidate = (event) => {
    if (event.candidate && currentRoom) {
      socket.emit("signal", {
        room: currentRoom,
        candidate: event.candidate
      });
    }
  };

  peer.onconnectionstatechange = () => {
    if (!peer) return;

    if (peer.connectionState === "connected") {
      setStatus("Connected successfully.");
    } else if (peer.connectionState === "failed") {
      setStatus(
        "Connection failed. Try again or use another network."
      );
    } else if (peer.connectionState === "disconnected") {
      setStatus("Connection interrupted.");
    }
  };

  peer.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      video.srcObject = event.streams[0];
      video.play().catch(() => {});
      setStatus("Receiving the other phone's screen.");
    }
  };

  return peer;
}

function joinRoom(role) {
  const room = roomInput.value.trim();

  if (!room) {
    setStatus("Enter a room code first.");
    return false;
  }

  currentRoom = room;
  currentRole = role;

  socket.emit("join-room", {
    room: currentRoom,
    role: currentRole
  });

  return true;
}

async function startViewing() {
  if (!joinRoom("viewer")) return;

  video.srcObject = null;
  createPeer();

  setStatus(
    "Waiting for the sharing phone to join with the same room code."
  );
}

async function startSharing() {
  if (!navigator.mediaDevices ||
      !navigator.mediaDevices.getDisplayMedia) {
    setStatus(
      "This browser does not support website screen sharing. " +
      "Try a supported Android browser."
    );
    return;
  }

  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    if (!joinRoom("source")) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      return;
    }

    createPeer();

    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });

    localStream.getVideoTracks()[0].onended = () => {
      disconnect();
    };

    setStatus(
      "Screen sharing started. Waiting for the viewer to connect."
    );
  } catch (error) {
    setStatus(
      "Screen sharing cancelled or unavailable: " + error.message
    );
  }
}

socket.on("joined-room", () => {
  if (currentRole === "viewer") {
    setStatus("Room joined. Waiting for the sharing phone.");
  } else if (currentRole === "source") {
    setStatus("Room joined. Waiting for the viewer.");
  }
});

socket.on("peer-joined", async (data) => {
  if (!peer || !data) return;

  if (currentRole === "source" && data.role === "viewer") {
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("signal", {
        room: currentRoom,
        description: peer.localDescription
      });

      setStatus("Connecting to viewer...");
    } catch (error) {
      setStatus("Could not start connection: " + error.message);
    }
  }
});

socket.on("signal", async (message) => {
  if (!peer || !message || message.room !== currentRoom) return;

  try {
    if (message.description) {
      await peer.setRemoteDescription(message.description);

      while (pendingCandidates.length) {
        const candidate = pendingCandidates.shift();
        await peer.addIceCandidate(candidate);
      }

      if (message.description.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("signal", {
          room: currentRoom,
          description: peer.localDescription
        });

        setStatus("Answer sent. Connecting...");
      }
    }

    if (message.candidate) {
      if (peer.remoteDescription) {
        await peer.addIceCandidate(message.candidate);
      } else {
        pendingCandidates.push(message.candidate);
      }
    }
  } catch (error) {
    setStatus("Connection error: " + error.message);
  }
});

socket.on("peer-left", () => {
  setStatus("The other phone disconnected.");
  video.srcObject = null;
});

function disconnect() {
  socket.emit("leave-room");

  if (peer) {
    peer.close();
    peer = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  pendingCandidates = [];
  currentRoom = "";
  currentRole = "";
  video.srcObject = null;

  setStatus("Disconnected.");
}

viewBtn.addEventListener("click", startViewing);
shareBtn.addEventListener("click", startSharing);
disconnectBtn.addEventListener("click", disconnect);
