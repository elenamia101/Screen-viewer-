const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on("connection", (socket) => {
  socket.on("join-room", (data) => {
    if (!data || typeof data.room !== "string") return;

    const room = data.room.trim();
    const role = data.role;

    if (!room || !["viewer", "source"].includes(role)) return;

    if (socket.data.room) {
      socket.leave(socket.data.room);
    }

    socket.data.room = room;
    socket.data.role = role;
    socket.join(room);

    socket.emit("joined-room");

    socket.to(room).emit("peer-joined", {
      role
    });
  });

  socket.on("signal", (message) => {
    if (!socket.data.room || !message) return;
    if (message.room !== socket.data.room) return;

    socket.to(socket.data.room).emit("signal", message);
  });

  socket.on("leave-room", () => {
    if (socket.data.room) {
      socket.to(socket.data.room).emit("peer-left");
      socket.leave(socket.data.room);
      socket.data.room = null;
      socket.data.role = null;
    }
  });

  socket.on("disconnect", () => {
    if (socket.data.room) {
      socket.to(socket.data.room).emit("peer-left");
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
