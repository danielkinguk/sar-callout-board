import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.get("/hello", (_req, res) => {
  res.json({ message: "Hello, SAR!" });
});

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡️ Backend listening at http://localhost:${PORT}`);
});
