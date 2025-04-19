import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

type Mission = {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  latitude: number;
  longitude: number;
  createdAt: string;
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

const missions: Mission[] = [];

// 1️⃣ Fetch all missions
app.get("/missions", (_req, res) => {
  res.json(missions);
});

// 2️⃣ Create a new mission
app.post("/missions", (req, res) => {
  const { title, status, latitude, longitude } = req.body;
  const m: Mission = {
    id: uuidv4(),
    title,
    status,
    latitude,
    longitude,
    createdAt: new Date().toISOString(),
  };
  missions.push(m);

  // Broadcast to all connected clients
  io.emit("mission:new", m);

  res.status(201).json(m);
});

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡️ Backend listening on http://localhost:${PORT}`);
});
