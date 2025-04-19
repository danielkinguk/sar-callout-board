import { useEffect, useState } from "react";

function App() {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/hello`)
      .then((res) => res.json())
      .then((data) => setGreeting(data.message))
      .catch(console.error);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">SAR Call‑Out Board</h1>
      {greeting && (
        <p className="mt-4 text-lg text-blue-600">Backend says: {greeting}</p>
      )}
    </div>
  );
}

export default App;
