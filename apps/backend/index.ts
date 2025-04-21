import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Allow both HTTP + Socket.io from any origin
app.use(cors());
app.use(express.json());

// In-memory storage
type CallOut = {
  id: string;
  name: string;
  status: "pending" | "active" | "completed";
  latitude?: number;
  longitude?: number;
  osGrid?: string;
  createdAt: string;
};
const callOuts: CallOut[] = [];

// GET /callouts
app.get("/callouts", (_req, res) => {
  console.log("GET /callouts");
  res.json(callOuts);
});

// POST /callouts
app.post("/callouts", (req, res) => {
  console.log("POST /callouts", req.body);
  const { name, latitude, longitude, osGrid } = req.body;
  const newCallOut: CallOut = {
    id: uuidv4(),
    name,
    status: "active", // always default to active
    latitude,
    longitude,
    osGrid,
    createdAt: new Date().toISOString(),
  };
  callOuts.push(newCallOut);
  io.emit("callout:new", newCallOut);
  res.status(201).json(newCallOut);
});

// DELETE /callouts/:id
app.delete("/callouts/:id", (req, res) => {
  const { id } = req.params;
  console.log("DELETE /callouts/" + id);
  const index = callOuts.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).send(`No call out with id ${id}`);
  }
  callOuts.splice(index, 1);
  io.emit("callout:delete", { id });
  res.sendStatus(204);
});

// Catch-all logger to see unhandled routes
app.use((req, res) => {
  console.log(`❓ ${req.method} ${req.url} — no handler`);
  res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡️ Backend listening on http://localhost:${PORT}`);
});
