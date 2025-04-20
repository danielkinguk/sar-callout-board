import React, { useEffect, useState, FormEvent } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Fix default marker icons
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

interface Mission {
  id: string;
  title: string;
  status: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

// Utility to invalidate map size after render
function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 0);
  }, [map]);
  return null;
}

export default function App() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"pending" | "active" | "completed">(
    "pending"
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/missions`)
      .then((r) => r.json())
      .then(setMissions)
      .catch(console.error);

    socket.on("mission:new", (m: Mission) => {
      setMissions((curr) => [...curr, m]);
    });
    socket.on("mission:delete", ({ id }: { id: string }) => {
      setMissions((curr) => curr.filter((m) => m.id !== id));
    });

    return () => {
      socket.off("mission:new");
      socket.off("mission:delete");
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!title || isNaN(lat) || isNaN(lng)) {
      return alert("Please fill in all fields.");
    }
    try {
      const res = await fetch(`${API_URL}/missions`, {
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
      alert(`Failed to create mission: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const res = await fetch(`${API_URL}/missions/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Failed to delete mission");
    // removal via socket
  };

  return (
    <div style={{ display: "flex", height: "100vh", margin: 0, padding: 0 }}>
      {/* Sidebar */}
      <div
        style={{
          width: "30%",
          padding: 16,
          overflowY: "auto",
          borderRight: "1px solid #ddd",
        }}
      >
        <h2>New Mission</h2>
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <input
            type="text"
            placeholder="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />
          <input
            type="text"
            placeholder="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />
          <button type="submit" style={{ padding: "8px 16px" }}>
            Add Mission
          </button>
        </form>

        <h2>Active Missions</h2>
        {missions.length === 0 ? (
          <p>No missions yet.</p>
        ) : (
          missions.map((m) => (
            <div
              key={m.id}
              style={{
                marginBottom: 12,
                padding: 12,
                border: "1px solid #ccc",
                borderRadius: 4,
              }}
            >
              <strong>{m.title}</strong>
              <p>Status: {m.status}</p>
              <p style={{ fontSize: 12, color: "#666" }}>
                Created: {new Date(m.createdAt).toLocaleTimeString()}
              </p>
              <button
                onClick={() => handleDelete(m.id, m.title)}
                style={{
                  marginTop: 8,
                  padding: "4px 8px",
                  background: "#e53e3e",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={[54.2586, -3.2145]}
          zoom={12}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: "100%",
          }}
        >
          <MapInvalidate />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {missions.map((m) => (
            <Marker key={m.id} position={[m.latitude, m.longitude]}>
              <Popup>
                <strong>{m.title}</strong>
                <br />
                Status: {m.status}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
