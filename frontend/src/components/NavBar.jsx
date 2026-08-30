import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { LayoutDashboard, Upload, GitBranch, MessageSquare, Settings, Activity, GitCompare } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const navItems = [
  { to: "/", label: "DASHBOARD", icon: LayoutDashboard, exact: true },
  { to: "/index", label: "INDEX", icon: Upload },
  { to: "/tree", label: "TREE VIEW", icon: GitBranch },
  { to: "/query", label: "QUERY", icon: MessageSquare },
  { to: "/compare", label: "COMPARE", icon: GitCompare },
  { to: "/settings", label: "SETTINGS", icon: Settings },
];

export default function NavBar() {
  const [health, setHealth] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API}/health`, { timeout: 3000 });
        setHealth(res.data);
      } catch {
        setHealth(null);
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside
      data-testid="navbar"
      className="fixed left-0 top-0 h-screen w-60 bg-[#0F0F11] border-r border-[#27272A] flex flex-col z-40"
    >
      {/* Brand */}
      <div className="px-5 py-6 border-b border-[#27272A]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#8B5CF6] flex items-center justify-center text-white font-bold font-mono-ibm text-sm">
            M
          </div>
          <div>
            <h1 className="text-[#F4F4F5] text-sm font-bold tracking-tight font-mono-ibm">
              ConvoMemory
            </h1>
            <p className="text-[#71717A] text-[9px] tracking-[0.2em] uppercase font-mono-ibm">
              RAPTOR Memory Layer
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
              className={() =>
                `flex items-center gap-3 px-3 py-2.5 text-[11px] font-mono-ibm tracking-[0.1em] transition-colors duration-200 group ${
                  isActive
                    ? "text-[#8B5CF6] bg-[#18181B] border-l-2 border-[#8B5CF6]"
                    : "text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#18181B]"
                }`
              }
            >
              <Icon
                size={14}
                strokeWidth={isActive ? 2 : 1.5}
                className={isActive ? "text-[#8B5CF6]" : "text-[#3F3F46] group-hover:text-[#71717A]"}
              />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* Health indicator */}
      <div className="px-5 py-4 border-t border-[#27272A]">
        <div className="flex items-center gap-2" data-testid="health-indicator">
          <Activity size={12} strokeWidth={1.5} className={health ? "text-[#10B981]" : "text-[#71717A]"} />
          <span className="text-[9px] font-mono-ibm tracking-[0.15em] uppercase text-[#71717A]">
            {health
              ? health.raptor_ready
                ? "RAPTOR READY"
                : "INSTALLING..."
              : "BACKEND OFFLINE"}
          </span>
          <div className={`ml-auto w-1.5 h-1.5 rounded-full ${health?.raptor_ready ? "bg-[#10B981]" : health ? "bg-[#F59E0B]" : "bg-[#EF4444]"}`} />
        </div>
      </div>
    </aside>
  );
}
