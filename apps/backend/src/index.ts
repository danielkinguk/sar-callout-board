import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const app = express();

// Allow both HTTP + Socket.io from any origin
app.use(cors());
app.use(express.json());

// ① Must be before your routes so JSON bodies are parsed
app.use(express.json());

// In-memory storage
type Mission = {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  latitude: number;
  longitude: number;
  createdAt: string;
};
const missions: Mission[] = [];

// ② Your API routes
app.get("/missions", (_req, res) => {
  console.log("GET /missions");
  res.json(missions);
});

app.post("/missions", (req, res) => {
  console.log("POST /missions", req.body);
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
  io.emit("mission:new", m);
  res.status(201).json(m);
});

// ③ Catch‐all logger to see unhandled routes
app.use((req, res, next) => {
  console.log(`❓ ${req.method} ${req.url} — no handler`);
  res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡️ Backend listening on http://localhost:${PORT}`);
});
