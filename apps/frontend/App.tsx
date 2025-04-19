import { useEffect, useState } from "react";

interface Mission {
  id: string;
  title: string;
  status: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

function App() {
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    // Full 3001 URL here so CRA on 3000 proxies correctly
    fetch("https://<your-sandbox-id>-3001.sse.codesandbox.io/missions")
      .then((res) => res.json())
      .then(setMissions)
      .catch(console.error);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">SAR Call‑Out Board</h1>
      <div className="mt-6">
        {missions.length === 0 ? (
          <p>No missions yet.</p>
        ) : (
          missions.map((m) => (
            <div key={m.id} className="mb-4 p-3 border rounded">
              <h2 className="font-semibold">{m.title}</h2>
              <p>Status: {m.status}</p>
              <p className="text-sm text-gray-500">
                Created: {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
