import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  BarChart2, 
  Sparkles,
  GitFork,
  ChevronRight,
  Eye,
  RefreshCw,
  X,
  Layers,
  Clock
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { bomApi } from '../../services/bomApi';

export function BomStructureView({ onNavigate }) {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(null);
  const [selectedBom, setSelectedBom] = useState(null);
  const [explosionItems, setExplosionItems] = useState([]);
  const [explosionLoading, setExplosionLoading] = useState(false);
  const [explosionQty, setExplosionQty] = useState(1);

  const loadBoms = async () => {
    try {
      setLoading(true);
      const res = await bomApi.list();
      setBoms(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to load BOMs", err);
      setBoms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoms();
  }, []);

  const handleOpenExplosion = async (bom, qty = 1) => {
    try {
      setSelectedBom(bom);
      setExplosionQty(qty);
      setExplosionLoading(true);
      const items = await bomApi.explode(bom.id, qty);
      setExplosionItems(items);
    } catch (err) {
      console.error("Failed to explode BOM", err);
    } finally {
      setExplosionLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "BOM Number,Product Code,Assembly Name,Revision,Approx Cost (INR),Status\n"
      + boms.map(e => `${e.bom_code},${e.product_code || ''},"${e.product_name || ''}",${e.revision},${e.approximate_cost || 0},${e.is_active ? 'Active' : 'Inactive'}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bills_of_materials_inr.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotice("BOM catalog exported to CSV format (INR).");
    setTimeout(() => setNotice(null), 3000);
  };

  const filtered = (Array.isArray(boms) ? boms : []).filter((b) => 
    (b.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.bom_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.product_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg text-xs font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Sub-Header Tabs (Matching Image 2 - MRPEasy style) */}
      <div className="flex items-center gap-6 border-b border-slate-200 pb-3 text-xs font-medium text-slate-500 overflow-x-auto">
        <button onClick={() => onNavigate('dashboard')} className="hover:text-slate-900 transition-colors whitespace-nowrap">
          Production Schedule
        </button>
        <button onClick={() => onNavigate('dashboard')} className="hover:text-slate-900 transition-colors whitespace-nowrap">
          Master Planning (MPS)
        </button>
        <span className="text-indigo-600 font-bold border-b-2 border-indigo-600 pb-3 -mb-3 whitespace-nowrap flex items-center gap-1.5">
          <GitFork className="w-3.5 h-3.5" />
          Bill of Materials (BOM) ({boms.length})
        </span>
        <button onClick={() => onNavigate('materials')} className="hover:text-slate-900 transition-colors whitespace-nowrap">
          Workstations & Lines
        </button>
        <button onClick={() => onNavigate('dashboard')} className="hover:text-slate-900 transition-colors whitespace-nowrap">
          Shop Statistics
        </button>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Bill of Materials (BOM)
            <span className="text-xs font-mono font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
              Multi-Level Hierarchy
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Indian standard discrete assemblies, subassembly indentation, and rolled-up standard costs in INR (₹).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadBoms}
            className="p-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold"
            title="Refresh BOM list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search Filter Strip */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search BOM code, assembly name, or product SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing {filtered.length} assemblies
        </div>
      </div>

      {/* BOM Table (Matching MRPEasy Image 2) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold tracking-wider uppercase text-[10px]">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">BOM Number</th>
                <th className="py-3 px-4">Assembly / Product Name</th>
                <th className="py-3 px-4">Product Code</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Revision</th>
                <th className="py-3 px-4">Components</th>
                <th className="py-3 px-4 text-right">Approx Cost (INR ₹)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading Bill of Materials...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    No Bill of Materials matching criteria found.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                    onClick={() => handleOpenExplosion(item, 1)}
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-indigo-600 hover:underline">
                        {item.bom_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.product_name || 'Assembly'}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.description || 'Standard Production Routing'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                      {item.product_code || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.product_type === 'FINISHED' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.product_type || 'ASSEMBLY'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-600 font-bold">
                        {item.revision}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {item.items?.length || 0} line items
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      {formatINR(item.approximate_cost || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenExplosion(item, 1);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Explode</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Level Explosion Slide-Over / Modal */}
      {selectedBom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <GitFork className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Multi-Level BOM Explosion — {selectedBom.bom_code}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedBom.product_name} ({selectedBom.product_code}) • {selectedBom.revision}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-600">Batch Demand:</span>
                  <input
                    type="number"
                    min="1"
                    value={explosionQty}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      handleOpenExplosion(selectedBom, val);
                    }}
                    className="w-16 text-center font-mono font-bold text-xs border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-mono text-slate-400">units</span>
                </div>

                <button
                  onClick={() => setSelectedBom(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {explosionLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Calculating indented BOM explosion & lead-time rollups...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Level</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Component / Subassembly</th>
                          <th className="py-2.5 px-3 text-right">Qty / Unit</th>
                          <th className="py-2.5 px-3 text-right">Effective Qty</th>
                          <th className="py-2.5 px-3 text-right">Lead Time</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Extended Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {explosionItems.map((item, idx) => (
                          <tr key={idx} className={item.item_type === 'SUBASSEMBLY' ? 'bg-indigo-50/20 font-bold' : ''}>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                item.level === 1 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800 ml-3'
                              }`}>
                                L{item.level}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                item.item_type === 'SUBASSEMBLY' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.item_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <div className="font-semibold text-slate-900">{item.item_name}</div>
                              <div className="text-[10px] font-mono text-slate-400">{item.item_code}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {parseFloat(item.quantity_per_parent).toFixed(2)} {item.unit_of_measure}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                              {parseFloat(item.effective_quantity).toFixed(2)} {item.unit_of_measure}
                              {parseFloat(item.scrap_factor) > 0 && (
                                <span className="block text-[9px] text-amber-600 font-normal">
                                  +{(parseFloat(item.scrap_factor) * 100).toFixed(0)}% scrap
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {item.lead_time_days}d
                              <span className="block text-[9px] text-slate-400">
                                cum: {item.cumulative_lead_time_days}d
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {formatINR(item.unit_cost)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatINR(item.extended_cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Banner */}
                  <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>Max Cumulative Lead Time: <strong>{Math.max(...explosionItems.map(i => i.cumulative_lead_time_days), 0)} Days</strong></span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-[10px]">Total Production Cost for {explosionQty} Units:</span>
                      <span className="font-extrabold text-indigo-700 text-base font-mono">
                        {formatINR(explosionItems.reduce((acc, i) => acc + parseFloat(i.extended_cost || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
