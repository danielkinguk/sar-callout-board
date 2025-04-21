import React, { useEffect, useState, FormEvent } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet icon paths
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconUrl: markerIconUrl, iconRetinaUrl: markerRetinaUrl, shadowUrl: markerShadowUrl });

const API_URL = process.env.REACT_APP_API_URL!;
const socket = io(API_URL);

interface CallOut {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  latitude?: number;
  longitude?: number;
  osGrid?: string;
  createdAt: string;
}

type Tab = "map" | "incidents" | "resources" | "settings" | "admin";

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
  const [status, setStatus] = useState<"pending" | "active" | "completed">("pending");
  const [osGrid, setOsGrid] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [tab, setTab] = useState<Tab>("map");
  const [formOpen, setFormOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/callouts`)
      .then(res => res.json())
      .then(setCallOuts)
      .catch(console.error);

    socket.on("callout:new", (newC: CallOut) => setCallOuts(curr => [...curr, newC]));
    socket.on("callout:delete", ({ id }: { id: string }) => setCallOuts(curr => curr.filter(c => c.id !== id)));

    return () => {
      socket.off("callout:new");
      socket.off("callout:delete");
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: any = { title, status };

    if (osGrid) {
      payload.osGrid = osGrid.trim();
    } else {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) {
        return alert("Please enter valid latitude/longitude or an OS grid reference.");
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
      setTitle("");
      setStatus("pending");
      setOsGrid("");
      setLatitude("");
      setLongitude("");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create call out: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete call out "${name}"?`)) return;
    const res = await fetch(`${API_URL}/callouts/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Failed to delete call out");
  };

  const tabs = [
    { key: "map", label: "Incident Map" },
    { key: "incidents", label: "Incidents" },
    { key: "resources", label: "Resources" },
    { key: "settings", label: "Settings" },
    { key: "admin", label: "Admin" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: "28%", padding: 16, background: "#f4f6f8", borderRight: "1px solid #ddd", overflowY: 'auto' }}>
        <div style={{ background: "#fff", padding: 32, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ flex: 1, textAlign: 'left', fontSize: '1.1em', fontWeight: 'bold', color: '#333' }}>New Call Out</span>
            <button onClick={() => setFormOpen(open => !open)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#007ACC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style={{ transform: formOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M7 10l5 5 5-5H7z" />
                </svg>
              </div>
            </button>
          </div>
          {formOpen && (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, boxSizing: 'border-box' }}>
              <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={{ padding: '10px', borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
              <input type="text" placeholder="OS Grid Ref (e.g. SD258145)" value={osGrid} onChange={e => setOsGrid(e.target.value)} style={{ padding: '10px', borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
              <input type="text" placeholder="Latitude" value={latitude} onChange={e => setLatitude(e.target.value)} style={{ padding: '10px', borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
              <input type="text" placeholder="Longitude" value={longitude} onChange={e => setLongitude(e.target.value)} style={{ padding: '10px', borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
              <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ padding: '10px', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}>
                {['pending', 'active', 'completed'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <button type="submit" style={{ padding: '12px', background: '#007ACC', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>Add Call Out</button>
            </form>
          )}
        </div>
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ flex: 1, fontSize: '1.1em', fontWeight: 'bold', color: '#333' }}>Active Call Outs</span>
            <button onClick={() => setListOpen(open => !open)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#007ACC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style={{ transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M7 10l5 5 5-5H7z" />
                </svg>
              </div>
            </button>
          </div>
          {listOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {callOuts.length === 0 ? (
                <p>No call outs yet.</p>
              ) : (
                callOuts.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{c.title}</span>
                    <button onClick={() => handleDelete(c.id, c.title)} style={{ color: '#e53e3e', cursor: 'pointer', border: 'none', background: 'none' }}>
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #ccc", background: "#f7f7f7" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as Tab)} style={{ flex: 1, padding: 14, border: "none", borderBottom: tab === t.key ? "3px solid #007ACC" : "3px solid transparent", background: "transparent", cursor: "pointer", fontWeight: "bold", color: tab === t.key ? "#007ACC" : "#555" }}>{t.label}</button>
          ))}
        </div>
        <div style={{ flex: 1, position: "relative", border: '2px solid #ddd' }}>
          {tab === "map" && (
            <MapContainer center={[54.2586, -3.2145]} zoom={10} style={{ height: "100%", width: "100%" }}>
              <MapInvalidate />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {callOuts.map(c => (
                <Marker key={c.id} position={[c.latitude!, c.longitude!]}>  
                  <Popup><strong>{c.title}</strong><br/>Status: {c.status}</Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
          {tab === "incidents" && (<div style={{ padding: 24 }}><h3>Incidents</h3><p>List or detailed view here.</p></div>)}
          {tab === "resources" && (<div style={{ padding: 24 }}><h3>Resources</h3><p>Resources management here.</p></div>)}
          {tab === "settings" && (<div style={{ padding: 24 }}><h3>Settings</h3><p>Application settings here.</p></div>)}
          {tab === "admin" && (<div style={{ padding: 24 }}><h3>Admin</h3><p>Admin controls here.</p></div>)}
        </div>
      </div>
    </div>
  );
}
