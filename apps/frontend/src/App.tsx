import React, { useEffect, useState, FormEvent } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet icon paths
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerRetinaUrl,
  shadowUrl: markerShadowUrl,
});

const API_URL = process.env.REACT_APP_API_URL!;
const socket = io(API_URL);

interface CallOut {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  latitude: number;
  longitude: number;
  createdAt: string;
}

type Tab = "incidents" | "resources" | "settings" | "admin";

// Utility to fix map size on mount
function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 0);
  }, [map]);
  return null;
}

export default function App() {
  const [callOuts, setCallOuts] = useState<CallOut[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"pending" | "active" | "completed">(
    "pending"
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [tab, setTab] = useState<Tab>("incidents");
  const [formOpen, setFormOpen] = useState(true);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latitude),
      lng = parseFloat(longitude);
    if (!title || isNaN(lat) || isNaN(lng))
      return alert("Please fill in all fields.");
    try {
      const res = await fetch(`${API_URL}/callouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status, latitude: lat, longitude: lng }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
      setStatus("pending");
      setLatitude("");
      setLongitude("");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create call out: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete call out "${title}"?`)) return;
    const res = await fetch(`${API_URL}/callouts/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Failed to delete call out");
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        margin: 0,
        padding: 0,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Sidebar: Collapsible Form & List */}
      <div
        style={{
          width: "28%",
          padding: 16,
          background: "#f4f6f8",
          boxSizing: "border-box",
          borderRight: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        {/* Header with centered title and graphical toggle */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <span
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "1.25em",
              fontWeight: "bold",
              color: "#333",
            }}
          >
            New Call Out
          </span>
          <button
            onClick={() => setFormOpen((open) => !open)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#007ACC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="white"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  transform: formOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              >
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </div>
          </button>
        </div>
        {formOpen && (
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              marginBottom: 24,
            }}
          >
            <form
              onSubmit={handleSubmit}
              style={{ display: "grid", gridGap: 12 }}
            >
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
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
                style={{
                  padding: "12px",
                  background: "#007ACC",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Add Call Out
              </button>
            </form>
          </div>
        )}
        {/* Active Call Outs List */}
        <div
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Active Call Outs</h3>
          {callOuts.length === 0 ? (
            <p>No call outs yet.</p>
          ) : (
            callOuts.map((c) => (
              <div
                key={c.id}
                style={{
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{c.title}</span>
                <button
                  onClick={() => handleDelete(c.id, c.title)}
                  style={{
                    color: "#e53e3e",
                    cursor: "pointer",
                    border: "none",
                    background: "none",
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content with Tabs & Map */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Tabs Header */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #ccc",
            background: "#f7f7f7",
          }}
        >
          {[
            { key: "incidents", label: "Incidents" },
            { key: "resources", label: "Resources" },
            { key: "settings", label: "Settings" },
            { key: "admin", label: "Admin" },
          ].map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key as Tab)}
              style={{
                flex: 1,
                padding: "14px",
                border: "none",
                borderBottom:
                  tab === tabItem.key
                    ? "3px solid #007ACC"
                    : "3px solid transparent",
                background: "transparent",
                cursor: "pointer",
                fontWeight: tab === tabItem.key ? "bold" : "normal",
                color: tab === tabItem.key ? "#007ACC" : "#555",
              }}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        <div
          style={{ flex: 1, position: "relative", border: "2px solid #ddd" }}
        >
          {tab === "incidents" && (
            <MapContainer
              center={[54.2586, -3.2145]}
              zoom={10}
              style={{ height: "100%", width: "100%" }}
            >
              <MapInvalidate />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {callOuts.map((c) => (
                <Marker key={c.id} position={[c.latitude, c.longitude]}>
                  <Popup>
                    <strong>{c.title}</strong>
                    <br />
                    Status: {c.status}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
          {tab === "resources" && (
            <div style={{ padding: 24 }}>
              <h3>Resources</h3>
              <p>Placeholder for resources list or controls.</p>
            </div>
          )}
          {tab === "settings" && (
            <div style={{ padding: 24 }}>
              <h3>Settings</h3>
              <p>Placeholder for application settings.</p>
            </div>
          )}
          {tab === "admin" && (
            <div style={{ padding: 24 }}>
              <h3>Admin</h3>
              <p>Placeholder for admin controls.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
