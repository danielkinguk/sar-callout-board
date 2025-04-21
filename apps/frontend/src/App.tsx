import React, { useEffect, useState, FormEvent } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet default icon fix
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerIcon2xPng from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIcon2xPng,
  shadowUrl: markerShadowPng,
});

const API_URL = process.env.REACT_APP_API_URL!;
const socket = io(API_URL);

type CallOut = {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  latitude?: number;
  longitude?: number;
  osGrid?: string;
  createdAt: string;
};

type Tab = "map" | "incidents" | "resources" | "settings" | "admin";

function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export default function App() {
  const [callOuts, setCallOuts] = useState<CallOut[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<CallOut["status"]>("pending");
  const [osGrid, setOsGrid] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [tab, setTab] = useState<Tab>("map");
  const [formOpen, setFormOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);

  // Determine if form can submit
  const canSubmit = Boolean(
    title.trim() &&
      (osGrid.trim().length > 0 ||
        (lat.trim().length > 0 && lng.trim().length > 0))
  );

  // Load existing and listen for updates
  useEffect(() => {
    fetch(`${API_URL}/callouts`)
      .then((r) => r.json())
      .then(setCallOuts)
      .catch(console.error);

    socket.on("callout:new", (c: CallOut) => {
      setCallOuts((prev) => [...prev, c]);
    });
    socket.on("callout:delete", ({ id }: { id: string }) => {
      setCallOuts((prev) => prev.filter((c) => c.id !== id));
    });

    return () => {
      socket.off("callout:new");
      socket.off("callout:delete");
    };
  }, []);

  // Handle submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const payload: any = { title: title.trim(), status };
    if (osGrid.trim()) payload.osGrid = osGrid.trim();
    else {
      payload.latitude = parseFloat(lat);
      payload.longitude = parseFloat(lng);
    }

    try {
      const res = await fetch(`${API_URL}/callouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      // clear form; socket listener adds to state
      setTitle("");
      setStatus("pending");
      setOsGrid("");
      setLat("");
      setLng("");
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`${API_URL}/callouts/${id}`, { method: "DELETE" });
    if (!res.ok) alert(`Delete failed: ${await res.text()}`);
  };

  const tabs = [
    { key: "map", label: "Incident Map" },
    { key: "incidents", label: "Incidents" },
    { key: "resources", label: "Resources" },
    { key: "settings", label: "Settings" },
    { key: "admin", label: "Admin" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "300px",
          padding: 16,
          background: "#f0f0f0",
          overflowY: "auto",
        }}
      >
        <section style={{ marginBottom: 24 }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2>New Call Out</h2>
            <button onClick={() => setFormOpen((o) => !o)}>
              {formOpen ? "–" : "+"}
            </button>
          </header>
          {formOpen && (
            <form
              onSubmit={handleSubmit}
              style={{ display: "grid", gap: 8, marginTop: 8 }}
            >
              <input
                type="text"
                placeholder="Name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: 8, fontWeight: "bold" }}
              />
              <input
                type="text"
                placeholder="OS Grid Ref"
                value={osGrid}
                onChange={(e) => setOsGrid(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
              <input
                type="text"
                placeholder="Latitude"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
              <input
                type="text"
                placeholder="Longitude"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{ padding: 8 }}
              >
                Add Call Out
              </button>
            </form>
          )}
        </section>
        <section>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2>Active Call Outs</h2>
            <button onClick={() => setListOpen((o) => !o)}>
              {listOpen ? "–" : "+"}
            </button>
          </header>
          {listOpen && (
            <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {callOuts.length === 0 && <li>No call outs.</li>}
              {callOuts.map((c) => (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  {c.title}
                  <button
                    onClick={() => handleDelete(c.id, c.title)}
                    style={{ fontSize: "1.5em", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      {/* Main Tab & Map Container */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <nav style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              style={{
                flex: 1,
                padding: 12,
                border: "none",
                borderBottom:
                  tab === t.key ? "3px solid #007ACC" : "3px solid transparent",
                background: "none",
                cursor: "pointer",
                fontWeight: tab === t.key ? "bold" : "normal",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, position: "relative" }}>
          {tab === "map" && (
            <MapContainer
              center={[54.2586, -3.2145]}
              zoom={10}
              style={{ height: "100%" }}
            >
              <MapInvalidate />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {callOuts
                .filter(
                  (o) => o.latitude !== undefined && o.longitude !== undefined
                )
                .map((o) => (
                  <Marker key={o.id} position={[o.latitude!, o.longitude!]}>
                    <Popup>
                      <strong>{o.title}</strong>
                      <br />
                      Status: {o.status}
                      {o.osGrid && (
                        <>
                          <br />
                          OS Grid: {o.osGrid}
                        </>
                      )}
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          )}

          {/* Placeholder panels */}
          {tab !== "map" && (
            <div style={{ padding: 16 }}>
              <h3>{tabs.find((t) => t.key === tab)!.label}</h3>
              <p>Content for {tab}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
