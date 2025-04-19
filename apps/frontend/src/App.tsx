import { useEffect, useState, FormEvent } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const socket = io(process.env.REACT_APP_API_URL!);

interface Mission {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  latitude: number;
  longitude: number;
  createdAt: string;
}

export default function App() {
  const [missions, setMissions] = useState<Mission[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"pending" | "active" | "completed">(
    "pending"
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  useEffect(() => {
    // Load existing missions
    fetch(`${process.env.REACT_APP_API_URL}/missions`)
      .then((res) => res.json())
      .then(setMissions)
      .catch(console.error);

    // Subscribe to new missions
    socket.on("mission:new", (m: Mission) => {
      setMissions((curr) => [...curr, m]);
    });

    return () => {
      socket.off("mission:new");
    };
  }, []);

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!title || isNaN(lat) || isNaN(lng)) {
      return alert("Please fill in all fields with valid values.");
    }
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status, latitude: lat, longitude: lng }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Clear form; the socket listener will update the list
      setTitle("");
      setStatus("pending");
      setLatitude("");
      setLongitude("");
    } catch (err) {
      console.error(err);
      alert("Failed to create mission.");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/3 p-4 overflow-auto border-r">
        <h2 className="text-xl font-bold mb-4">New Mission</h2>
        <form onSubmit={handleSubmit} className="space-y-2 mb-6">
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="w-full p-2 border rounded"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded"
          >
            Add Mission
          </button>
        </form>

        <h2 className="text-xl font-bold mb-4">Active Missions</h2>
        {missions.length === 0 ? (
          <p>No missions yet.</p>
        ) : (
          missions.map((m) => (
            <div key={m.id} className="mb-3 p-2 border rounded">
              <h3 className="font-semibold">{m.title}</h3>
              <p className="text-sm">Status: {m.status}</p>
              <p className="text-xs text-gray-500">
                Created: {new Date(m.createdAt).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={[47.6062, -122.3321]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
        >
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
