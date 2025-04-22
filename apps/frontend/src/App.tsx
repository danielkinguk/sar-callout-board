// apps/frontend/src/App.tsx

// ── Leaflet default‑icon fix (must be before any React‑Leaflet import) ──
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// ── React & app imports ───────────────────────────────────────────────────
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

// ── Constants & Types ──────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL!;
const socket = io(API_URL);

interface CallOut {
  id: string;
  name: string;
  status: "pending" | "active" | "completed";
  osGrid?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  assignedResources?: string[];
}

interface Resource {
  id: string;
  name: string;
  category: string;
}

// ── Helper: force Leaflet to recalc size on load ──────────────────────────
function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  // —— Splitter state ————————————————————————————————————————————————
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // —— Data & Form state —————————————————————————————————————————————
  const [callOuts, setCallOuts] = useState<CallOut[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [osGrid, setOsGrid] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [collapsedNew, setCollapsedNew] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "map" | "incidents" | "resources" | "settings" | "admin"
  >("map");

  // —— Load call‑outs & real‑time listeners —————————————————————————————
  useEffect(() => {
    fetch(`${API_URL}/callouts`)
      .then((r) => r.json())
      .then(setCallOuts)
      .catch(console.error);

    socket.on("callout:new", (c: CallOut) =>
      setCallOuts((curr) => [...curr, c])
    );
    socket.on("callout:delete", ({ id }: { id: string }) =>
      setCallOuts((curr) => curr.filter((c) => c.id !== id))
    );
    socket.on("callout:update", (updated: CallOut) =>
      setCallOuts((curr) =>
        curr.map((c) => (c.id === updated.id ? updated : c))
      )
    );

    return () => {
      socket.off("callout:new");
      socket.off("callout:delete");
      socket.off("callout:update");
    };
  }, []);

  // —— Load resources once (needed in detail pane) —────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/resources`)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then(setResources)
      .catch(console.error);
  }, []);

  // —— New Call‑Out form submit —————————————————————————————————————
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: Partial<CallOut> = { name, status: "active" };

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
        return alert("Please enter an OS Grid ref or valid lat/long.");
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

  // —— Delete a Call‑Out ————————————————————————————————————————————
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this call out?")) return;
    const res = await fetch(`${API_URL}/callouts/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Failed to delete");
  };

  // —— Assign / Unassign resources —————————————————————————————————
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

  // —— Form validation —————————————————————————————————————————————
  const canSubmit =
    name.trim() !== "" &&
    (osGrid.trim() !== "" ||
      (latitude.trim() !== "" && longitude.trim() !== ""));

  // —— Derived for selected Call‑Out ———————————————————————————————
  const selected = callOuts.find((c) => c.id === selectedId);
  const assigned = selected?.assignedResources || [];
  const unassigned = resources.filter((r) => !assigned.includes(r.id));

  // —— Render —————————————————————————————————————————————————————————
  return (
    <div
      ref={containerRef}
      style={{ display: "flex", height: "100vh", overflow: "hidden" }}
    >
      {/* Sidebar: New + Active Call Outs */}
      <aside
        style={{
          width: sidebarWidth,
          padding: 24,
          background: "#f4f6f8",
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        {/* New Call Out Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px 24px",
              borderBottom: "1px solid #eee",
            }}
          >
            <h2 style={{ flex: 1, margin: 0 }}>New Call Out</h2>
            <button
              onClick={() => setCollapsedNew((v) => !v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                transform: collapsedNew ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              ▶
            </button>
          </div>
          {!collapsedNew && (
            <form
              onSubmit={handleSubmit}
              style={{
                display: "grid",
                gap: 16,
                padding: 24,
                boxSizing: "border-box",
              }}
            >
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  padding: "10px",
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
                  padding: "10px",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  width: "100%",
                }}
              />
              <input
                type="text"
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  width: "100%",
                }}
              />
              <input
                type="text"
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  width: "100%",
                }}
              />
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  padding: "12px",
                  background: canSubmit ? "#007ACC" : "#aaa",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                }}
              >
                Add Call Out
              </button>
            </form>
          )}
        </div>

        {/* Active Call Outs List with Delete & Jump to Detail */}
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
              padding: "16px 24px",
              borderBottom: "1px solid #eee",
            }}
          >
            <h2 style={{ flex: 1, margin: 0 }}>Active Call Outs</h2>
          </div>
          <div style={{ padding: 24 }}>
            {callOuts.length === 0 ? (
              <p>No call outs.</p>
            ) : (
              callOuts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveTab("incidents");
                    setSelectedId(c.id);
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
                  <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
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
                      lineHeight: 1,
                      color: "#c00",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Splitter */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 8,
          cursor: "col-resize",
          background: "#888",
          height: "100%",
          zIndex: 10,
        }}
      />

      {/* Main & Tabs */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <nav
          style={{
            display: "flex",
            borderBottom: "1px solid #ddd",
            background: "#fff",
          }}
        >
          {[
            { key: "map", label: "Call Out Map" },
            { key: "incidents", label: "Call Outs" },
            { key: "resources", label: "Resources" },
            { key: "settings", label: "Settings" },
            { key: "admin", label: "Admin" },
          ].map((tab) => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: "16px 24px",
                cursor: "pointer",
                fontWeight: activeTab === tab.key ? "bold" : ("normal" as any),
                borderBottom:
                  activeTab === tab.key
                    ? "3px solid #007ACC"
                    : "3px solid transparent",
              }}
            >
              {tab.label}
            </div>
          ))}
        </nav>

        {/* Incident Map */}
        {activeTab === "map" && (
          <div
            style={{
              flex: 1,
              position: "relative",
              border: "1px solid #ddd",
            }}
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
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {callOuts.length === 0 ? (
                <p>No call outs found.</p>
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

            {/* Detail & Assignment Pane */}
            {selected && (
              <aside
                style={{
                  width: 300,
                  padding: 24,
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
                    const r = resources.find((r) => r.id === rid)!;
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
                {unassigned.length === 0 ? (
                  <p>None left</p>
                ) : (
                  unassigned.map((r) => (
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
                  ))
                )}
              </aside>
            )}
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === "resources" && (
          <div style={{ padding: 24 }}>
            <h2>All Resources</h2>
            {resources.length === 0 ? (
              <p>No resources available.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {resources.map((r) => (
                  <li key={r.id} style={{ marginBottom: 8 }}>
                    <strong>{r.name}</strong>
                    <span style={{ marginLeft: 8, color: "#666" }}>
                      ({r.category})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Settings & Admin Tabs */}
        {activeTab === "settings" && (
          <div style={{ padding: 24 }}>Settings panel</div>
        )}
        {activeTab === "admin" && (
          <div style={{ padding: 24 }}>Admin panel</div>
        )}
      </main>
    </div>
  );
}
