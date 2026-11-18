import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Activity, 
  Database, 
  FileText, 
  TrendingUp, 
  ShoppingCart, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { materialsApi } from '../../services/materialsApi';

export function DashboardOverview({ onNavigate }) {
  const [health, setHealth] = useState({ status: 'checking', message: 'Checking API health...' });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const healthRes = await materialsApi.checkHealth();
        setHealth({ status: 'healthy', data: healthRes });
      } catch (err) {
        setHealth({ status: 'error', message: err.message });
      }

      try {
        const activeRes = await materialsApi.list({ is_active: true, page_size: 1 });
        const inactiveRes = await materialsApi.list({ is_active: false, page_size: 1 });
        setStats({
          active: activeRes.total,
          inactive: inactiveRes.total,
          total: activeRes.total + inactiveRes.total,
        });
      } catch (err) {
        console.error('Error loading materials summary:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/30 rounded-full text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Foundation Milestone
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-3">
              Material Requirements Planning System
            </h1>
            <p className="text-indigo-200 text-sm mt-2 leading-relaxed">
              Automated BOM explosion, time-phased netting, lot sizing, and procurement proposal management.
            </p>
          </div>

          {/* Backend Status Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 min-w-[220px]">
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-200 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-emerald-400" />
              API Service Health
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="text-base font-bold text-white capitalize">
                {health.status === 'healthy' ? 'System Online' : 'Service Disconnected'}
              </span>
            </div>
            {health.data && (
              <p className="text-xs text-indigo-200 mt-1">
                Environment: <span className="text-white font-mono">{health.data.environment}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Materials</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{loading ? '...' : stats.total}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active in MRP</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono">{loading ? '...' : stats.active}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactive / Archived</p>
            <p className="text-2xl font-bold text-slate-500 mt-1 font-mono">{loading ? '...' : stats.inactive}</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* System Roadmap Modules */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Architecture Modules Roadmap</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Active: Materials */}
          <div 
            onClick={() => onNavigate('materials')}
            className="group bg-white p-5 rounded-xl border-2 border-indigo-500 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                Active (Foundation)
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-3 group-hover:text-indigo-600 transition-colors">
              Material Management
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Live CRUD, UOM, lot sizing parameters, and unit costs stored in PostgreSQL/SQLite.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-indigo-600">
              Manage Materials <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Phase 3: Master Data (Products & Suppliers) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 opacity-80">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                Milestone 2
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mt-3">Products & Suppliers</h3>
            <p className="text-xs text-slate-500 mt-1">
              Finished goods, sub-assemblies, and approved vendor directories.
            </p>
          </div>

          {/* Phase 4: BOM & Inventory */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 opacity-80">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
                <Wrench className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                Milestone 3
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mt-3">BOM & Inventory Ledger</h3>
            <p className="text-xs text-slate-500 mt-1">
              Multi-level Bill of Materials with cycle checks and transactional stock balances.
            </p>
          </div>

          {/* Phase 5: Production Planning */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 opacity-80">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                Milestone 4
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mt-3">Production Orders</h3>
            <p className="text-xs text-slate-500 mt-1">
              Order scheduling, progress tracking, and firm demand input for MRP.
            </p>
          </div>

          {/* Phase 6: MRP Engine */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 opacity-80">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                Milestone 5
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mt-3">MRP Calculation Engine</h3>
            <p className="text-xs text-slate-500 mt-1">
              Time-phased gross/net netting, safety stock offsets, and proposal generation.
            </p>
          </div>

          {/* Phase 7: Procurement & Analytics */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 opacity-80">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                Milestone 6
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mt-3">Procurement & Analytics</h3>
            <p className="text-xs text-slate-500 mt-1">
              Proposal-to-PO conversion, atomic goods receipt, and operational reporting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

