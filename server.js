const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on("connection", (socket) => {
  socket.on("join-room", (room) => {
    if (typeof room !== "string" || !room.trim()) return;

    socket.join(room);
    socket.data.room = room;
    socket.emit("joined-room");
    socket.to(room).emit("peer-joined");
  });

  socket.on("signal", (message) => {
    if (!socket.data.room || !message) return;
    if (message.room !== socket.data.room) return;

    socket.to(socket.data.room).emit("signal", message);
  });

  socket.on("leave-room", (room) => {
    if (socket.data.room === room) {
      socket.leave(room);
      socket.data.room = null;
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
