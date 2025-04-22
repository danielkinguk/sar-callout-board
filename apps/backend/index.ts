// apps/backend/src/index.ts

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// ── Load initialResources from data/resources.json ────────────────────────
// (__dirname is .../apps/backend/src)
const resourcesFile = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "resources.json"
);
let initialResources: Resource[] = [];
try {
  const json = fs.readFileSync(resourcesFile, "utf8");
  initialResources = JSON.parse(json);
} catch (err) {
  console.error("⚠️  Could not load resources.json:", err);
}

// ── App + Socket.io setup ─────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ── In‑memory Call‑Outs storage ────────────────────────────────────────────
type Callout = {
  id: string;
  name: string;
  status: "pending" | "active" | "completed";
  osGrid?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  assignedResources: string[];
};
const callouts: Callout[] = [];

// GET all call‑outs
app.get("/callouts", (_req, res) => {
  console.log("GET /callouts");
  res.json(callouts);
});

// POST create call‑out
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
    assignedResources: [],
  };
  callouts.push(c);
  io.emit("callout:new", c);
  res.status(201).json(c);
});

// DELETE a call‑out
app.delete("/callouts/:id", (req, res) => {
  const { id } = req.params;
  const idx = callouts.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).send("Not found");
  callouts.splice(idx, 1);
  io.emit("callout:delete", { id });
  res.sendStatus(204);
});

// POST assign resource
app.post("/callouts/:id/assign", (req, res) => {
  const { id } = req.params;
  const { resourceId } = req.body;
  const c = callouts.find((c) => c.id === id);
  if (!c) return res.status(404).send("Not found");
  if (!c.assignedResources.includes(resourceId)) {
    c.assignedResources.push(resourceId);
    io.emit("callout:update", c);
  }
  res.json(c);
});

// POST unassign resource
app.post("/callouts/:id/unassign", (req, res) => {
  const { id } = req.params;
  const { resourceId } = req.body;
  const c = callouts.find((c) => c.id === id);
  if (!c) return res.status(404).send("Not found");
  c.assignedResources = c.assignedResources.filter((rid) => rid !== resourceId);
  io.emit("callout:update", c);
  res.json(c);
});

// Alias for “Incidents” tab
app.get("/incidents", (_req, res) => {
  console.log("GET /incidents");
  res.json(callouts);
});

// ── In‑memory Resources storage ─────────────────────────────────────────────
type Resource = {
  id: string;
  name: string;
  category: string;
};
const resources: Resource[] = initialResources;

// GET all resources
app.get("/resources", (_req, res) => {
  console.log("GET /resources");
  res.json(resources);
});

// POST create resource
app.post("/resources", (req, res) => {
  console.log("POST /resources", req.body);
  const { name, category } = req.body;
  if (!name || !category) return res.status(400).send("Missing fields");
  const r: Resource = { id: uuidv4(), name, category };
  resources.push(r);
  io.emit("resource:new", r);
  res.status(201).json(r);
});

// PATCH update resource
app.patch("/resources/:id", (req, res) => {
  const { id } = req.params;
  const { name, category } = req.body;
  const r = resources.find((x) => x.id === id);
  if (!r) return res.status(404).send("Not found");
  if (name) r.name = name;
  if (category) r.category = category;
  io.emit("resource:update", r);
  res.json(r);
});

// DELETE resource
app.delete("/resources/:id", (req, res) => {
  const { id } = req.params;
  const idx = resources.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).send("Not found");
  resources.splice(idx, 1);
  io.emit("resource:delete", { id });
  res.sendStatus(204);
});

// ── 404 Catch‑all & Logger ─────────────────────────────────────────────────
app.use((req, res) => {
  console.log(`❓ ${req.method} ${req.url} — no handler`);
  res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

// ── Start server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡️ Backend listening on http://localhost:${PORT}`);
});
