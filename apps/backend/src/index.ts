// apps/backend/src/index.ts

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

// load your resources seed
import resources from "../../../data/resources.json";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ── In‐memory Call‑Outs storage ─────────────────────────────────────────
type Callout = {
  id: string;
  name: string;
  status: "pending" | "active" | "completed";
  osGrid?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
};
const callouts: Callout[] = [];

// ── GET all Call‑Outs ───────────────────────────────────────────────────
app.get("/callouts", (_req, res) => {
  console.log("GET /callouts");
  res.json(callouts);
});

// ── CREATE a new Call‑Out ───────────────────────────────────────────────
app.post("/callouts", (req, res) => {
  console.log("POST /callouts", req.body);
  const { name, status, osGrid, latitude, longitude } = req.body;
  const c: Callout = {
    id: uuidv4(),
    name,
    status,
    osGrid,
    latitude,
    longitude,
    createdAt: new Date().toISOString(),
  };
  callouts.push(c);
  io.emit("callout:new", c);
  res.status(201).json(c);
});

// ── DELETE a Call‑Out ───────────────────────────────────────────────────
app.delete("/callouts/:id", (req, res) => {
  const { id } = req.params;
  const idx = callouts.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).send("Not found");
  callouts.splice(idx, 1);
  io.emit("callout:delete", { id });
  res.sendStatus(204);
});

// ── Alias for your “Call Outs” tab ───────────────────────────────────────
app.get("/incidents", (_req, res) => {
  console.log("GET /incidents");
  res.json(callouts);
});

// ── Expose your equipment & vehicles list ──────────────────────────────
app.get("/resources", (_req, res) => {
  console.log("GET /resources");
  res.json(resources);
});

// ── 404 catch‑all (must come last) ───────────────────────────────────────
app.use((req, res) => {
  console.log(`❓ ${req.method} ${req.url} — no handler`);
  res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

// ── Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡️ Backend listening on http://localhost:${PORT}`);
});
