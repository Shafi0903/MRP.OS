import React from 'react';
import { Search, Bell, Settings, LogOut, Activity } from 'lucide-react';

export function Header({ currentTab, onNavigate, user, onLogout }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Search Input (Matching Images 1 & 3) */}
      <div className="relative w-72 md:w-96">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search materials, products, orders, BOMs..."
          className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium placeholder-slate-400"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Progress Bar (Matching Image 1: Setup Progress) */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            System Ready
          </div>
          <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full w-[100%] rounded-full" />
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-600">100%</span>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1.5">
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            title="Interactive Swagger REST Docs"
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Activity className="w-4 h-4" />
          </a>

          <button
            type="button"
            title="Notifications"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600" />
          </button>
        </div>

        {/* User Profile Badge & Logout */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'PP'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-slate-800 leading-tight">{user?.name || 'Planner'}</div>
            <div className="text-[10px] text-slate-400 leading-tight">{user?.facility || 'Chakan Plant'}</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Logout / Switch User"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
