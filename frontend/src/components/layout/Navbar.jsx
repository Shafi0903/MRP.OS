import React from 'react';
import { Layers, Activity } from 'lucide-react';

export function Navbar({ onNavigate, currentTab }) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div 
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 group-hover:bg-indigo-700 transition-colors">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-lg tracking-tight block">
              Antigravity <span className="text-indigo-600">MRP</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block -mt-1">
              Material Requirements Planning
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'dashboard'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => onNavigate('materials')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'materials'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Materials
          </button>

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 ml-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            Swagger Docs
          </a>
        </nav>
      </div>
    </header>
  );
}

