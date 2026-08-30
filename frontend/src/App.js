import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import NavBar from "@/components/NavBar";
import Dashboard from "@/pages/Dashboard";
import IndexPage from "@/pages/IndexPage";
import TreeView from "@/pages/TreeView";
import QueryPage from "@/pages/QueryPage";
import Settings from "@/pages/Settings";

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <div className="flex h-screen bg-[#050505]">
          <NavBar />
          <main className="flex-1 ml-60 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/index" element={<IndexPage />} />
              <Route path="/tree/:conversationId?" element={<TreeView />} />
              <Route path="/query/:conversationId?" element={<QueryPage />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
