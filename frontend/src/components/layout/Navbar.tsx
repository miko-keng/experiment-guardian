import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, PlusCircle, LayoutDashboard, Settings as SettingsIcon, AlertCircle, CheckCircle2, Radio, MessageCircle } from "lucide-react";
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2 text-indigo-600 font-bold text-xl tracking-tight">
              <ShieldCheck className="w-7 h-7 text-indigo-600" />
              <span>Experiment Guardian</span>
            </Link>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-medium border border-indigo-200">
              Research Integrity Gate
            </span>
          </div>

          <nav className="flex items-center space-x-1 sm:space-x-4">
            <Link
              to="/"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/") ? "bg-cyan-50 text-cyan-800" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Alexa+ Lab</span>
            </Link>

            <Link
              to="/experiments"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/experiments") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Experiments</span>
            </Link>

            <Link
              to="/new"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/new") ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Audit</span>
            </Link>

            <Link
              to="/bee"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/bee") ? "bg-amber-100 text-amber-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Bee Import</span>
            </Link>

            <Link
              to="/settings"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive("/settings") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </Link>

            <div className="border-l border-slate-200 pl-4 py-1 flex items-center space-x-2">
              {health?.status === "ok" ? (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200" title={`Model: ${health.modelId} (${health.region})`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium">System Ready</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
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
