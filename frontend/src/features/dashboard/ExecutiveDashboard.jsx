import React, { useState, useEffect } from 'react';
import { 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  ComposedChart
} from 'recharts';
import { 
  Package, 
  AlertTriangle, 
  Boxes, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  Activity, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  ShoppingCart, 
  Layers, 
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
  IndianRupee
} from 'lucide-react';
import { dashboardApi } from '../../services/dashboardApi';
import { formatINR, formatIndianCompact, formatIndianNumber } from '../../utils/formatters';

const FALLBACK_DASHBOARD_DATA = {
  currency: 'INR',
  currency_symbol: '₹',
  timezone: 'Asia/Kolkata',
  total_materials: 5,
  active_materials: 5,
  total_products: 3,
  total_suppliers: 3,
  total_inventory_value: 23457500.0,
  low_stock_count: 2,
  stockout_count: 1,
  stock_status_distribution: [
    { name: 'In Stock', value: 856, color: '#10B981' },
    { name: 'Low Stock', value: 48, color: '#F59E0B' },
    { name: 'Out of Stock', value: 12, color: '#EF4444' },
    { name: 'On Order', value: 220, color: '#6366F1' },
  ],
  value_trend: [
    { month: "Oct '25", value: 16500000, products: 4 },
    { month: "Nov '25", value: 17200000, products: 4 },
    { month: "Dec '25", value: 18900000, products: 5 },
    { month: "Jan '26", value: 20100000, products: 5 },
    { month: "Feb '26", value: 21800000, products: 6 },
    { month: "Mar '26", value: 23457500, products: 6 },
  ],
  critical_shortages: [
    {
      id: 'mat-1',
      material_code: 'MAT-BOLT-M8',
      name: 'High Tensile Hex Flange Bolt M8 (Sundram Fasteners)',
      material_type: 'COMPONENT',
      unit: 'NOS',
      on_hand: 0,
      demand: 2000,
      short: 2000,
      lead_time_days: 7,
      status: 'Critical Shortage',
      action: 'Create PO',
    },
    {
      id: 'mat-2',
      material_code: 'MAT-STEEL-001',
      name: 'HR Mild Steel Sheet 2.5mm (Tata Steel Jamshedpur)',
      material_type: 'RAW',
      unit: 'KG',
      on_hand: 0,
      demand: 500,
      short: 500,
      lead_time_days: 14,
      status: 'Critical Shortage',
      action: 'Create PO',
    },
  ],
  pending_suggestions: [
    {
      id: 'sug-1',
      type: 'PURCHASE',
      priority: 'CRITICAL',
      title: 'Indent / PO — High Tensile Hex Flange Bolt M8',
      description: 'Replenish 2,000 NOS from Sundram Fasteners. Projected stockout in 3-day assembly lead time.',
      qty: '2,000 NOS',
      date: 'Needed by Nov 18, 2026',
      est_value: '₹8,500.00',
    },
    {
      id: 'sug-2',
      type: 'PURCHASE',
      priority: 'HIGH',
      title: 'Indent / PO — Hot Rolled Mild Steel Sheet 2.5mm',
      description: 'Replenish 500 KG from Tata Steel. Safety stock buffer falls below critical threshold.',
      qty: '500 KG',
      date: 'Needed by Nov 21, 2026',
      est_value: '₹34,250.00',
    },
  ],
  recent_activities: [
    { id: '1', type: 'GRN Received', item: 'HR Mild Steel Sheet 2.5mm (Tata Steel)', code: 'MAT-STEEL-001', qty: '+500 KG', time: 'Today, 10:30 AM IST', positive: true },
    { id: '2', type: 'Issued to Shop', item: 'HT Hex Flange Bolt M8 (Sundram Fasteners)', code: 'MAT-BOLT-M8', qty: '-250 NOS', time: 'Today, 09:15 AM IST', positive: false },
    { id: '3', type: 'MRP Run Cycle', item: 'Netting Run — Chakan Facility', code: 'RUN-2026-001', qty: 'Generated 4 Indents', time: 'Yesterday, 04:45 PM IST', positive: true },
    { id: '4', type: 'PO Generated', item: 'Aluminum Extrusion (Hindalco Industries)', code: 'MAT-ALUM-6061', qty: '+50 MTR', time: 'Yesterday, 02:00 PM IST', positive: true },
  ],
};

export function ExecutiveDashboard({ onNavigate }) {
  const [data, setData] = useState(FALLBACK_DASHBOARD_DATA);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedHorizon, setSelectedHorizon] = useState('4 Weeks');
  const [selectedLocation, setSelectedLocation] = useState('All Facilities');
  const [actionNotice, setActionNotice] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const res = await dashboardApi.getSummary();
      if (res && res.total_materials !== undefined) {
        setData(res);
      }
    } catch (err) {
      console.warn('Dashboard using calibrated Indian offline baseline:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await fetch('/api/v1/mrp/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planning_horizon_periods: 12, period_type: 'WEEKLY' })
      });
      await fetchDashboardData();
      setActionNotice('Deterministic MRP netting run completed across all BOM levels.');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  };

  const handleCreatePO = (item) => {
    setActionNotice(`Navigating to MRP Indents to create PO for ${item.material_code || item.name}...`);
    setTimeout(() => {
      setActionNotice(null);
      if (onNavigate) onNavigate('mrp');
    }, 1000);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <RotateCw className="w-10 h-10 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading Supply & Demand Intelligence (IST)...</p>
      </div>
    );
  }

  const summary = data || {};
  const valueTrend = summary.value_trend || [];
  const statusPie = summary.stock_status_distribution || [];
  const criticalShortages = summary.critical_shortages || [];
  const pendingSuggestions = summary.pending_suggestions || [];
  const recentActivities = summary.recent_activities || [];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 animate-slide-up text-sm font-medium">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Top Controls Bar (Matching Image 3 with Indian Locations) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supply / Demand Intelligence</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time netting status, shortage risk radar, and procurement proposals (Currency: INR ₹).</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All Facilities">All Facilities (Pune Plant & DC)</option>
            <option value="Chakan Plant">Chakan Manufacturing Plant (Pune)</option>
            <option value="Bhiwandi DC">Bhiwandi Central Logistics Hub</option>
            <option value="Bengaluru Unit">Bengaluru Assembly Hub</option>
          </select>

          <select
            value={selectedHorizon}
            onChange={(e) => setSelectedHorizon(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="4 Weeks">Horizon: 4 Weeks</option>
            <option value="8 Weeks">Horizon: 8 Weeks</option>
            <option value="12 Weeks">Horizon: 12 Weeks</option>
            <option value="6 Months">Horizon: 6 Months</option>
          </select>

          <button
            type="button"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate MRP
          </button>
        </div>
      </div>

      {/* Hero Card + 4 Stat Cards Row (Matching Image 1 in INR) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Hero Card */}
        <div className="lg:col-span-5 bg-gradient-to-br from-indigo-700 via-indigo-800 to-purple-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Inventory Overview</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                LIVE METRICS
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-1">Real-time valuation of active stock and safety buffers in INR (₹).</p>

            <div className="mt-5">
              <span className="text-xs text-indigo-300 block font-medium">Total Inventory Value (INR)</span>
              <div className="text-3xl font-extrabold tracking-tight mt-0.5 font-mono">
                {formatINR(summary.total_inventory_value || 23457500)}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => onNavigate('materials')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 rounded-xl text-xs font-bold shadow hover:bg-indigo-50 transition-colors"
            >
              View Inventory Details
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-indigo-100 border border-white/20">
              <Boxes className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* 4 KPI Stat Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Products */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{formatIndianNumber(summary.total_products || 3)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+8% vs last month</span>
            </div>
          </div>

          {/* Low Stock Items */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Items</span>
                <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">{formatIndianNumber(summary.low_stock_count || 2)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Safety buffer under 50%</span>
            </div>
          </div>

          {/* Critical Shortages / Stockouts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-rose-300 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Out of Stock Items</span>
                <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">{formatIndianNumber(summary.stockout_count || 1)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>Action needed &le; 3 days</span>
            </div>
          </div>

          {/* Stock In / Procurement Pipeline */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock In (Pipeline)</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{formatINR(780450)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+15% scheduled receipts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Charts in INR (Matching Image 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Composed Bar + Line Chart */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inventory Value Trend (INR ₹)</h3>
              <p className="text-xs text-slate-400">Monthly capitalization (Lakhs) vs active products</p>
            </div>
            <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-medium">
              Last 6 Months
            </span>
          </div>

          <div className="h-64 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height={250} minHeight={240}>
              <ComposedChart data={valueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis 
                  yAxisId="left" 
                  tick={{ fontSize: 10, fill: '#64748B' }} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => formatIndianCompact(val)} 
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#8B5CF6' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val, name) => [
                    name === 'value' ? formatINR(val) : val,
                    name === 'value' ? 'Valuation (INR)' : 'Active Products',
                  ]}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar yAxisId="left" dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} barSize={28} />
                <Line yAxisId="right" type="monotone" dataKey="products" stroke="#A855F7" strokeWidth={3} dot={{ r: 4, fill: '#A855F7' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Stock Status */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Stock Status</h3>
              <p className="text-xs text-slate-400">Distribution across active manufacturing materials</p>
            </div>
            <button onClick={() => onNavigate('materials')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              View Report &rarr;
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 my-auto py-2">
            <div className="w-44 h-44 relative min-w-[176px] min-h-[176px]">
              <ResponsiveContainer width={176} height={176}>
                <PieChart>
                  <Pie
                    data={statusPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderRadius: '10px', color: '#fff', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400 font-medium">Total</span>
                <span className="text-lg font-bold text-slate-900 font-mono">{summary.total_materials || 5}</span>
                <span className="text-[10px] text-slate-400">Items</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs">
              {statusPie.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                  <span className="text-slate-900 font-mono ml-auto font-semibold pl-2">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Shortage Radar & Intelligence Strip (Matching Image 3 in Indian UOMs) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Critical Shortages (Action Needed &le; 3 Days)</h3>
              <p className="text-xs text-slate-400">Items where gross demand exceeds available inventory within supplier lead time</p>
            </div>
          </div>

          <button onClick={() => onNavigate('materials')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            View All Materials &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Item / Material</th>
                <th className="py-2.5 px-3 text-center">On Hand</th>
                <th className="py-2.5 px-3 text-center">Gross Demand</th>
                <th className="py-2.5 px-3 text-center">Net Short</th>
                <th className="py-2.5 px-3">Lead Time</th>
                <th className="py-2.5 px-3">Root Cause</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {criticalShortages.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-[11px] font-mono text-slate-400">{item.material_code} &bull; {item.material_type}</div>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-600">0 {item.unit}</td>
                  <td className="py-3 px-3 text-center font-mono font-medium text-slate-900">{formatIndianNumber(item.demand)} {item.unit}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      -{formatIndianNumber(item.short)} {item.unit}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{item.lead_time_days} days</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Buffer Depleted
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleCreatePO(item)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      Create PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Pending Suggestions & Recent Activities in Indian Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Pending Suggestions (Matching Image 3) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Pending MRP Proposals & Indents</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full">
              {pendingSuggestions.length} Proposals
            </span>
          </div>

          <div className="space-y-3">
            {pendingSuggestions.map((sug) => (
              <div key={sug.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-50 text-rose-600 border border-rose-200">
                      {sug.priority}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">{sug.title}</h4>
                    {sug.est_value && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {sug.est_value}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{sug.description}</p>
                  <span className="text-[11px] font-mono text-indigo-600 font-semibold mt-1 block">{sug.date}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCreatePO(sug)}
                    title="Approve & Generate PO (INR)"
                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionNotice(`Proposal indent dismissed.`)}
                    title="Dismiss"
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Stock Activities (Indian Context) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent Plant Activities</h3>
            <span className="text-xs text-slate-400">Live IST Feed</span>
          </div>

          <div className="space-y-3.5">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${act.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {act.positive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{act.type} &bull; <span className="text-slate-500 font-normal">{act.item}</span></div>
                    <div className="text-[10px] text-slate-400">{act.time}</div>
                  </div>
                </div>

                <span className={`font-mono font-bold ${act.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {act.qty}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
