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

const API_URL = process.env.REACT_APP_API_URL!;
const socket = io(API_URL);

interface CallOut {
  id: string;
  name: string;
  status: "pending" | "active" | "completed";
  latitude?: number;
  longitude?: number;
  osGrid?: string;
  createdAt: string;
}

// Helper to force Leaflet to recalc size on load
function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export default function App() {
  // ── Splitter state ─────────────────────────────────────────────────────────
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

  // ── Data & Form state ──────────────────────────────────────────────────────
  const [callOuts, setCallOuts] = useState<CallOut[]>([]);
  const [name, setName] = useState("");
  const [osGrid, setOsGrid] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [status, setStatus] = useState<CallOut["status"]>("pending");
  const [collapsedNew, setCollapsedNew] = useState(false);
  const [collapsedActive, setCollapsedActive] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "map" | "incidents" | "resources" | "settings" | "admin"
  >("map");

  // ── Load & Listen ─────────────────────────────────────────────────────────
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

    return () => {
      socket.off("callout:new");
      socket.off("callout:delete");
    };
  }, []);

  // ── Submit & Delete ────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: Partial<CallOut> = { name, status };

    if (osGrid.trim()) {
      payload.osGrid = osGrid.trim();
    } else {
      const lat = parseFloat(latitude),
        lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) {
        return alert(
          "Please enter an OS Grid ref or valid latitude & longitude."
        );
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
      // clear form; socket will add new entry
      setName("");
      setOsGrid("");
      setLatitude("");
      setLongitude("");
      setStatus("pending");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create call out: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this call out?")) return;
    const res = await fetch(`${API_URL}/callouts/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) alert("Failed to delete");
    // removal via socket
  };

  const canSubmit =
    name.trim() !== "" &&
    (osGrid.trim() !== "" ||
      (latitude.trim() !== "" && longitude.trim() !== ""));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ display: "flex", height: "100vh", overflow: "hidden" }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarWidth,
          padding: 24,
          boxSizing: "border-box",
          background: "#f4f6f8",
          overflowY: "auto",
        }}
      >
        {/* New Call Out Card */}
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
              onClick={() => setCollapsedNew((x) => !x)}
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
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{
                  padding: "10px",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  width: "100%",
                }}
              >
                {["pending", "active", "completed"].map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
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

        {/* Active Call Outs Card */}
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
            <button
              onClick={() => setCollapsedActive((x) => !x)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                transform: collapsedActive ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              ▶
            </button>
          </div>
          {!collapsedActive && (
            <div style={{ padding: 24, boxSizing: "border-box" }}>
              {callOuts.length === 0 ? (
                <p>No call outs.</p>
              ) : (
                callOuts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      marginBottom: 12,
                      padding: 12,
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      position: "relative",
                    }}
                  >
                    <strong>{c.name}</strong>
                    <p>Status: {c.status}</p>
                    <p style={{ fontSize: 12, color: "#666" }}>
                      {new Date(c.createdAt).toLocaleString()}
                    </p>
                    <button
                      onClick={() => handleDelete(c.id)}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "none",
                        border: "none",
                        fontSize: "1.5em",
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
          )}
        </div>
      </aside>

      {/* ── Draggable splitter ───────────────────────────────────────────── */}
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

      {/* ── Main & Tabs ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <nav
          style={{
            display: "flex",
            borderBottom: "1px solid #ddd",
            background: "#fff",
          }}
        >
          {[
            { key: "map", label: "Incident Map" },
            { key: "incidents", label: "Incidents" },
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
                        ? `OS Grid: ${c.osGrid}`
                        : `Lat/Lng: ${c.latitude}, ${c.longitude}`}
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        )}
        {activeTab === "incidents" && (
          <div style={{ padding: 24 }}>Incidents panel</div>
        )}
        {activeTab === "resources" && (
          <div style={{ padding: 24 }}>Resources panel</div>
        )}
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
