import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, Settings as SettingsIcon, AlertCircle, CheckCircle2, Radio, MessageCircle } from "lucide-react";
import { getHealth } from "../../api/experiments";
import { HealthResponse } from "../../types/index";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-[#24212d] border-b border-[#4a4455] sticky top-0 z-30 text-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between min-h-16 items-center gap-3 flex-wrap py-2">
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2 text-white font-bold text-lg tracking-tight">
              <ShieldCheck className="w-7 h-7 text-violet-300" />
              <span>Experiment Guardian</span>
            </Link>
            <span className="bg-[#3b3546] text-slate-200 text-xs px-2.5 py-0.5 rounded-md font-medium border border-[#5b5365] hidden lg:inline-flex">
              ML review workspace
            </span>
          </div>

          <nav className="flex items-center space-x-1 sm:space-x-4">
            <Link
              to="/experiments"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/experiments") || isActive("/") ? "bg-[#514766] text-white" : "text-slate-300 hover:text-white hover:bg-[#393341]"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Experiments</span>
            </Link>

            <Link
              to="/lab"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/lab") ? "bg-[#514766] text-white" : "text-slate-300 hover:text-white hover:bg-[#393341]"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Alexa+ Lab</span>
            </Link>

            <Link
              to="/bee"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/bee") ? "bg-[#514766] text-white" : "text-slate-300 hover:text-white hover:bg-[#393341]"
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Bee Import</span>
            </Link>

            <Link
              to="/settings"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/settings") ? "bg-[#514766] text-white" : "text-slate-300 hover:text-white hover:bg-[#393341]"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </Link>

            <div className="border-l border-[#5b5365] pl-4 py-1 flex items-center space-x-2 hidden md:flex">
              {health?.status === "ok" ? (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-200 bg-emerald-900/40 px-2.5 py-1 rounded-md border border-emerald-700" title={`Model: ${health.modelId} (${health.region})`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="font-medium">System Ready</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-xs text-amber-200 bg-amber-900/40 px-2.5 py-1 rounded-md border border-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span className="font-medium">Backend Offline</span>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};
