import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Allow CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory storage for Call Outs
interface CallOut {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  latitude: number;
  longitude: number;
  createdAt: string;
}
const callOuts: CallOut[] = [];

// 1️⃣ GET all Call Outs
app.get("/callouts", (_req, res) => {
  console.log("GET /callouts");
  res.json(callOuts);
});

// 2️⃣ Create a new Call Out
app.post("/callouts", (req, res) => {
  console.log("POST /callouts", req.body);
  const { title, status, latitude, longitude } = req.body;
  const newCallOut: CallOut = {
    id: uuidv4(),
    title,
    status,
    latitude,
    longitude,
    createdAt: new Date().toISOString(),
  };
  callOuts.push(newCallOut);
  // Notify clients of new Call Out
  io.emit("callout:new", newCallOut);
  res.status(201).json(newCallOut);
});

// 3️⃣ Delete a Call Out
app.delete("/callouts/:id", (req, res) => {
  const { id } = req.params;
  const idx = callOuts.findIndex((c) => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Call Out not found" });
  }
  callOuts.splice(idx, 1);
  // Notify clients of deletion
  io.emit("callout:delete", { id });
  res.status(204).send();
});

// 4️⃣ (Optional) Health check at root
app.get("/", (_req, res) => {
  res.send("SAR Call‑Out API running");
});

// 5️⃣ Catch‑all logger for unhandled routes
app.use((req, res) => {
  console.log(`❓ ${req.method} ${req.url} — no handler`);
  res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡️ Backend listening on http://localhost:${PORT}`);
});
