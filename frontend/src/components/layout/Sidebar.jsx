import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Box, 
  Truck, 
  GitFork, 
  Factory, 
  TrendingUp, 
  ShoppingCart, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  Cpu
} from 'lucide-react';

export function Sidebar({ currentTab, onNavigate }) {
  const [masterDataOpen, setMasterDataOpen] = useState(true);
  const [operationsOpen, setOperationsOpen] = useState(true);

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand Header (Matching XYRA ERP Image 1) */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-700 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-100">
              M
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-base tracking-tight block">
                MRP<span className="text-indigo-600">.OS</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block -mt-1">
                Discrete Manufacturing
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-6 text-xs">
          {/* Main Group */}
          <div>
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Intelligence
            </div>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Supply / Demand Dashboard</span>
            </button>
          </div>

          {/* Operations & MRP Planning (Collapsible) */}
          <div>
            <div 
              onClick={() => setOperationsOpen(!operationsOpen)}
              className="flex items-center justify-between px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 cursor-pointer hover:text-slate-600"
            >
              <span>Manufacturing & MRP</span>
              {operationsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>

            {operationsOpen && (
              <div className="space-y-1">
                {/* MRP Proposals */}
                <button
                  type="button"
                  onClick={() => onNavigate('mrp')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    currentTab === 'mrp'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span>MRP Netting & Runs</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </button>

                {/* Production Orders */}
                <button
                  type="button"
                  onClick={() => onNavigate('production')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    currentTab === 'production'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Factory className="w-4 h-4 text-purple-600" />
                    <span>Production Orders</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700">
                    Phase 5
                  </span>
                </button>

                {/* Procurement */}
                <button
                  type="button"
                  onClick={() => onNavigate('procurement')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    currentTab === 'procurement'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                    <span>Purchase Orders & GRN</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700">
                    Phase 7
                  </span>
                </button>

                {/* Bill of Materials */}
                <button
                  type="button"
                  onClick={() => onNavigate('bom')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    currentTab === 'bom'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GitFork className="w-4 h-4 text-blue-600" />
                    <span>Bill of Materials</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 font-bold">
                    Multi-level
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Master Data Group (Collapsible) */}
          <div>
            <div 
              onClick={() => setMasterDataOpen(!masterDataOpen)}
              className="flex items-center justify-between px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 cursor-pointer hover:text-slate-600"
            >
              <span>Master Data</span>
              {masterDataOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>

            {masterDataOpen && (
              <div className="space-y-1">
                {/* Materials */}
                <button
                  type="button"
                  onClick={() => onNavigate('materials')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    currentTab === 'materials'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span>Materials Master</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                    INR (₹)
                  </span>
                </button>

                {/* Products */}
                <button
                  type="button"
                  onClick={() => onNavigate('products')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    currentTab === 'products'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Box className="w-4 h-4 text-slate-500" />
                    <span>Products Master</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                    Finished
                  </span>
                </button>

                {/* Suppliers */}
                <button
                  type="button"
                  onClick={() => onNavigate('suppliers')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    currentTab === 'suppliers'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Truck className="w-4 h-4 text-slate-500" />
                    <span>Suppliers / Vendors</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                    Vendors
                  </span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Footer System Status Strip */}
      <div className="p-4 border-t border-slate-100">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="text-[11px] font-bold text-slate-800">MRP Engine Online</div>
              <div className="text-[10px] font-mono text-slate-400">Deterministic Netting</div>
            </div>
          </div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            title="Open Swagger API documentation"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
