import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  Factory,
  Cpu,
  Layers,
  CheckCircle2
} from 'lucide-react';

export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('planner.chakan@tatamotors-mrp.in');
  const [password, setPassword] = useState('mrp2026secure');
  const [role, setRole] = useState('Production Planner (Chakan Plant)');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin({
      name: role.split('(')[0].trim(),
      email: email,
      role: role,
      facility: 'Pune Chakan Plant',
    });
  };

  const handleQuickLogin = (selectedRole, defaultEmail) => {
    setEmail(defaultEmail);
    setRole(selectedRole);
    onLogin({
      name: selectedRole.split('(')[0].trim(),
      email: defaultEmail,
      role: selectedRole,
      facility: 'Pune Chakan Plant',
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-8 shadow-2xl relative z-10 text-white">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/30">
            M
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              MRP<span className="text-indigo-400">.OS</span> Enterprise
            </h1>
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              B.Tech Academic Session 2026–2027
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-100">Sign In to Planning Console</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Discrete Manufacturing Material Requirements Planning & Procurement Portal.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Email ID</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="planner@facility.mrp.in"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Operational Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Production Planner (Chakan Plant)">Production Planner (Chakan Plant)</option>
              <option value="Materials & Inventory Head">Materials & Inventory Head</option>
              <option value="Procurement Executive (Purchase)">Procurement Executive (Purchase)</option>
              <option value="Plant Operations Director">Plant Operations Director (Admin)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all"
          >
            <span>Access ERP Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Logins for Viva Examiners */}
        <div className="mt-6 pt-5 border-t border-slate-700/60">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Academic Viva / Quick Role Switcher</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('Production Planner (Chakan Plant)', 'planner.chakan@tatamotors-mrp.in')}
              className="p-2 bg-slate-900/80 hover:bg-slate-700/60 border border-slate-700 rounded-xl text-left transition-colors"
            >
              <div className="text-[11px] font-bold text-indigo-300">Planner</div>
              <div className="text-[9px] text-slate-400 truncate">BOM & Production</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('Procurement Executive (Purchase)', 'purchase.lead@tatasteel-mrp.in')}
              className="p-2 bg-slate-900/80 hover:bg-slate-700/60 border border-slate-700 rounded-xl text-left transition-colors"
            >
              <div className="text-[11px] font-bold text-emerald-300">Procurement</div>
              <div className="text-[9px] text-slate-400 truncate">POs & Vendor GRN</div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer System Strip */}
      <div className="mt-6 text-center text-xs text-slate-500">
        <p>Discrete Manufacturing MRP System &bull; Built with FastAPI, SQLite/PostgreSQL, React & Tailwind CSS</p>
      </div>
    </div>
  );
}

