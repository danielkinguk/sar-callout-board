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
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: '30%', padding: 16, overflow: 'auto', borderRight: '1px solid #ddd' }}>
        {/* …your New Mission form and list here… */}
      </div>
  
      {/* Map */}
      <div style={{ flex: 1 }}>
        <MapContainer
          center={[47.6062, -122.3321]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {missions.map(m => (
            <Marker key={m.id} position={[m.latitude, m.longitude]}>
              <Popup>
                <strong>{m.title}</strong><br/>
                Status: {m.status}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
  