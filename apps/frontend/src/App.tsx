// apps/frontend/src/App.tsx

import DragBoard from "./DragBoard";

// ── Leaflet default‑icon fix (must come before any React‑Leaflet import) ──
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// ── React & Leaflet imports ───────────────────────────────────────────────
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  FormEvent,
} from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import OsGridRef from "geodesy/osgridref.js";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";

// ── Types ───────────────────────────────────────────────────────────────────
interface CallOut {
  id: string;
  name: string;
  status: "active" | "completed";
  osGrid?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  assignedResources: string[];
}
interface Resource {
  id: string;
  name: string;
  category: "personnel" | "equipment" | "vehicles";
}

// ── Personnel color mapping ─────────────────────────────────────────────────
const personnelColorMap: Record<string, string> = {
  "Team Leader": "#7C3AED",
  Doctor: "#3182CE",
  "Cas Care": "#D53F8C",
  Paramedic: "#38A169",
  Responder: "#DD6B20",
  // …add your full list here, matching your palette
};

// ── Constants ───────────────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL!;
const socket = io(API_URL);

// ── Helper to force Leaflet to recalc size on load ─────────────────────────
function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function App() {
  // — Splitter state —
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = () => setDragging(true);
  const onMouseUp = () => setDragging(false);
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const { left, width } = containerRef.current.getBoundingClientRect();
      let newWidth = e.clientX - left;
      newWidth = Math.max(200, Math.min(newWidth, width - 200));
      setSidebarWidth(newWidth);
    },
    [dragging]
  );

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove]);

  // — Data & UI state —
  const [callOuts, setCallOuts] = useState<CallOut[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [osGrid, setOsGrid] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [collapsedNew, setCollapsedNew] = useState(false);
  const [collapsedActive, setCollapsedActive] = useState(false);

  // — Load call‑outs & socket listeners —
  useEffect(() => {
    fetch(`${API_URL}/callouts`)
      .then((r) => r.json())
      .then(setCallOuts)
      .catch(console.error);

    socket.on("callout:new", (c: CallOut) =>
      setCallOuts((curr) => [...curr, c])
    );
    socket.on("callout:update", (c: CallOut) =>
      setCallOuts((curr) => curr.map((x) => (x.id === c.id ? c : x)))
    );
    socket.on("callout:delete", ({ id }: { id: string }) =>
      setCallOuts((curr) => curr.filter((x) => x.id !== id))
    );

    return () => {
      socket.off("callout:new");
      socket.off("callout:update");
      socket.off("callout:delete");
    };
  }, []);

  // — Load resources & socket listeners —
  useEffect(() => {
    fetch(`${API_URL}/resources`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setResources)
      .catch(console.error);

    socket.on("resource:new", (r: Resource) =>
      setResources((curr) => [...curr, r])
    );
    socket.on("resource:update", (u: Resource) =>
      setResources((curr) => curr.map((x) => (x.id === u.id ? u : x)))
    );
    socket.on("resource:delete", ({ id }: { id: string }) =>
      setResources((curr) => curr.filter((x) => x.id !== id))
    );

    return () => {
      socket.off("resource:new");
      socket.off("resource:update");
      socket.off("resource:delete");
    };
  }, []);

  // — New Call‑Out submission —
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: Partial<CallOut> = {
      name,
      status: "active",
      assignedResources: [],
    };
    if (osGrid.trim()) {
      try {
        const grid = OsGridRef.parse(osGrid.trim());
        const ll = grid.toLatLon();
        payload.latitude = ll.lat;
        payload.longitude = ll.lon;
        payload.osGrid = osGrid.trim();
      } catch {
        return alert("Invalid OS Grid reference");
      }
    } else {
      const lat = parseFloat(latitude),
        lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) {
        return alert("Enter an OS Grid ref or valid lat/long.");
      }
      payload.latitude = lat;
      payload.longitude = lng;
    }

    try {
      const res = await fetch(`${API_URL}/callouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setOsGrid("");
      setLatitude("");
      setLongitude("");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create call out: ${err.message}`);
    }
  };

  // — Delete Call‑Out —
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this call out?")) return;
    const res = await fetch(`${API_URL}/callouts/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Failed to delete");
  };

  // — Assign / Unassign resources —
  const assign = async (rid: string) => {
    if (!selectedId) return;
    await fetch(`${API_URL}/callouts/${selectedId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: rid }),
    });
  };
  const unassign = async (rid: string) => {
    if (!selectedId) return;
    await fetch(`${API_URL}/callouts/${selectedId}/unassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: rid }),
    });
  };

  const canSubmit =
    name.trim() !== "" &&
    (osGrid.trim() !== "" ||
      (latitude.trim() !== "" && longitude.trim() !== ""));

  const selected = callOuts.find((c) => c.id === selectedId) || null;
  const assigned = selected?.assignedResources || [];
  const unassigned = resources.filter((r) => !assigned.includes(r.id));

  const App = () => (
    <div className="h-full">
      {/* any wrappers or headers */}
      <DragBoard />
    </div>
  );

  // — Render —
  return (
    <BrowserRouter>
      <div ref={containerRef} style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarWidth,
          padding: 16,
          background: "#f4f6f8",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        {/* New Call Out */}
        <div
          style={{
            marginBottom: 24,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: 16,
              borderBottom: "1px solid #eee",
            }}
          >
            <h2 style={{ flex: 1, margin: 0 }}>New Call Out</h2>
            <button
              onClick={() => setCollapsedNew((x) => !x)}
              style={{
                fontSize: 18,
                background: "none",
                border: "none",
                cursor: "pointer",
                transform: collapsedNew ? "rotate(-90deg)" : undefined,
              }}
            >
              ▶
            </button>
          </div>
          {!collapsedNew && (
            <form
              onSubmit={handleSubmit}
              style={{ display: "grid", gap: 12, padding: 16 }}
            >
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  width: "100%",
                  fontWeight: "bold",
                }}
              />
              <input
                type="text"
                placeholder="OS Grid Ref"
                value={osGrid}
                onChange={(e) => setOsGrid(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                }}
              />
              <input
                type="text"
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                }}
              />
              <input
                type="text"
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                }}
              />
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  padding: 10,
                  background: canSubmit ? "#007ACC" : "#aaa",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                Add Call Out
              </button>
            </form>
          )}
        </div>

        {/* Active Call Outs */}
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: 16,
              borderBottom: "1px solid #eee",
            }}
          >
            <h2 style={{ flex: 1, margin: 0 }}>Active Call Outs</h2>
            <button
              onClick={() => setCollapsedActive((x) => !x)}
              style={{
                fontSize: 18,
                background: "none",
                border: "none",
                cursor: "pointer",
                transform: collapsedActive ? "rotate(-90deg)" : undefined,
              }}
            >
              ▶
            </button>
          </div>
          {!collapsedActive && (
            <div style={{ padding: 16 }}>
              {callOuts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id);
                    setActiveTab("incidents");
                  }}
                  style={{
                    position: "relative",
                    marginBottom: 12,
                    padding: 12,
                    border:
                      selectedId === c.id
                        ? "2px solid #007ACC"
                        : "1px solid #ccc",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  <strong>{c.name}</strong>
                  <br />
                  <small>{new Date(c.createdAt).toLocaleString()}</small>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c.id);
                    }}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "none",
                      border: "none",
                      fontSize: "1.2em",
                      color: "#c00",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Splitter */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 8,
          cursor: "col-resize",
          background: "#888",
        }}
      />

      {/* Main & Tabs */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <nav style={{ display: "flex", borderBottom: "1px solid #ddd" }}>
          {[
            { key: "map", label: "Map" },
            { key: "incidents", label: "Call Outs" },
            { key: "resources", label: "Resources" },
            { key: "settings", label: "Settings" },
            { key: "admin", label: "Admin" },
          ].map((t) => (
            <div
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                fontWeight: activeTab === t.key ? "bold" : "normal",
                borderBottom:
                  activeTab === t.key
                    ? "3px solid #007ACC"
                    : "3px solid transparent",
              }}
            >
              {t.label}
            </div>
          ))}
        </nav>

        {/* Map */}
        {activeTab === "map" && (
          <div
            style={{ flex: 1, position: "relative", border: "1px solid #ddd" }}
          >
            <MapContainer
              center={[54.2586, -3.2145]}
              zoom={10}
              style={{ height: "100%", width: "100%" }}
            >
              <MapInvalidate />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {callOuts
                .filter((c) => c.latitude != null && c.longitude != null)
                .map((c) => (
                  <Marker key={c.id} position={[c.latitude!, c.longitude!]}>
                    <Popup>
                      <strong>{c.name}</strong>
                      <br />
                      {c.osGrid
                        ? `OS Grid: ${c.osGrid}`
                        : `Lat/Lng: ${c.latitude}, ${c.longitude}`}
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        )}

        {/* Call Outs & Assignment Pane */}
        {activeTab === "incidents" && (
          <div style={{ display: "flex", flex: 1 }}>
            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {callOuts.length === 0 ? (
                <p>No call outs.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {callOuts.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        marginBottom: 12,
                        padding: 12,
                        border:
                          selectedId === c.id
                            ? "2px solid #007ACC"
                            : "1px solid #ccc",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      <strong>{c.name}</strong>
                      <br />
                      <small>{new Date(c.createdAt).toLocaleString()}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Detail & Assignment */}
            {selected && (
              <aside
                style={{
                  width: 300,
                  padding: 16,
                  borderLeft: "1px solid #ddd",
                  boxSizing: "border-box",
                  overflowY: "auto",
                }}
              >
                <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
                <p>
                  <strong>Assigned Resources</strong>
                </p>
                {assigned.length === 0 ? (
                  <p>None</p>
                ) : (
                  assigned.map((rid) => {
                    const r = resources.find((x) => x.id === rid)!;
                    return (
                      <div
                        key={rid}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <span>{r.name}</span>
                        <button onClick={() => unassign(rid)}>–</button>
                      </div>
                    );
                  })
                )}
                <hr />
                <p>
                  <strong>Available Resources</strong>
                </p>
                {unassigned.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span>{r.name}</span>
                    <button onClick={() => assign(r.id)}>+</button>
                  </div>
                ))}
              </aside>
            )}
          </div>
        )}

        {/* Categorized Resources Tab */}
        {activeTab === "resources" && (
          <div style={{ padding: 16 }}>
            <h2>All Resources</h2>
            <DragBoard />
          </div>
        )}

        {activeTab === "settings" && (
          <div style={{ padding: 16 }}>Settings panel</div>
        )}
        {activeTab === "admin" && (
          <div style={{ padding: 16 }}>Admin panel</div>
        )}
      </main>
    </div>
  );
}
