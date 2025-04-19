import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Mission {
  id: string;
  title: string;
  status: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

const socket = io(process.env.REACT_APP_API_URL!);

function App() {
  const [missions, setMissions] = useState<Mission[]>([]);

  // Fetch existing missions once
  useEffect(() => {
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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/3 p-4 overflow-auto border-r">
        <h2 className="text-xl font-bold mb-4">Active Missions</h2>
        {missions.map((m) => (
          <div key={m.id} className="mb-3 p-2 border rounded">
            <h3 className="font-semibold">{m.title}</h3>
            <p className="text-sm">Status: {m.status}</p>
            <p className="text-xs text-gray-500">
              Created: {new Date(m.createdAt).toLocaleTimeString()}
            </p>
          </div>
        ))}
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

export default App;
