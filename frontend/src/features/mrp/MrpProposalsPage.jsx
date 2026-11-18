import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShoppingCart,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
  CheckCheck
} from 'lucide-react';
import { mrpApi } from '../../services/mrpApi';
import { procurementApi } from '../../services/procurementApi';
import { formatINR } from '../../utils/formatters';

export function MrpProposalsPage({ onNavigate }) {
  const [runs, setRuns] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningMrp, setRunningMrp] = useState(false);
  const [notice, setNotice] = useState(null);
  const [selectedProps, setSelectedProps] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [runsData, propsData] = await Promise.all([
        mrpApi.listRuns({ limit: 10 }),
        mrpApi.listProposals({ limit: 100 }),
      ]);
      setRuns(Array.isArray(runsData) ? runsData : []);
      setProposals(Array.isArray(propsData) ? propsData : []);
    } catch (err) {
      console.error("Failed to load MRP data", err);
      setRuns([]);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTriggerMrp = async () => {
    try {
      setRunningMrp(true);
      const res = await mrpApi.triggerRun({
        planning_horizon_periods: 12,
        period_type: "WEEKLY",
      });
      setNotice(`MRP Run ${res.run_code} completed: ${res.proposals_count} replenishment proposals generated.`);
      setTimeout(() => setNotice(null), 4000);
      loadData();
    } catch (err) {
      alert(err.message || 'MRP calculation run failed');
    } finally {
      setRunningMrp(false);
    }
  };

  const handleConvertProposalToPO = async (proposal) => {
    if (!proposal.preferred_supplier_id) {
      alert("Material does not have a preferred supplier set. Please edit the material first.");
      return;
    }

    try {
      const res = await procurementApi.createFromProposals({
        supplier_id: proposal.preferred_supplier_id,
        lines: [
          {
            proposal_id: proposal.id,
            unit_price: proposal.standard_cost || 0,
          }
        ],
      });
      setNotice(`Proposal converted to Draft PO ${res.po_number}!`);
      setTimeout(() => setNotice(null), 3500);
      loadData();
      onNavigate('procurement');
    } catch (err) {
      alert(err.message || 'Conversion to PO failed');
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg text-xs font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            MRP Calculation Engine & Netting Radar
            <span className="text-xs font-mono font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
              Deterministic Engine
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Time-phased multi-level BOM explosion, scheduled receipt netting, safety buffer checks, and planned order generation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="p-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleTriggerMrp}
            disabled={runningMrp}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 text-xs font-bold shadow-md shadow-indigo-100 disabled:opacity-50 transition-all"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${runningMrp ? 'animate-spin' : ''}`} />
            <span>{runningMrp ? 'Executing Netting Engine...' : 'Run MRP Netting'}</span>
          </button>
        </div>
      </div>

      {/* Latest Runs Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Array.isArray(runs) ? runs : []).slice(0, 3).map((r) => (
          <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-mono font-bold text-xs text-slate-900">{r.run_code}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-sans">
                Horizon: {r.planning_horizon_periods} {r.period_type.toLowerCase()} periods from {r.planning_start_date}
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black font-mono text-indigo-700">{r.proposals_count}</span>
              <span className="text-[10px] text-slate-400 block -mt-1">Proposals</span>
            </div>
          </div>
        ))}
      </div>

      {/* Proposals Section (Matching ianaiERP Image 3) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
              Pending Replenishment Proposals ({(Array.isArray(proposals) ? proposals : []).filter(p => p.status === 'OPEN' || p.status === 'PAST_DUE').length} Actionable)
            </h3>
            <p className="text-[11px] text-slate-400">
              MRP engine recommendations ready for 1-click purchase order conversion.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Item Code & Name</th>
                <th className="py-3 px-4">Preferred Vendor</th>
                <th className="py-3 px-4 text-right">Proposed Qty</th>
                <th className="py-3 px-4 text-right">Est. Unit Price (₹)</th>
                <th className="py-3 px-4 text-right">Total Est. Cost (₹)</th>
                <th className="py-3 px-4">Release Date</th>
                <th className="py-3 px-4">Needed By</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading replenishment proposals...
                  </td>
                </tr>
              ) : proposals.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400 font-sans">
                    No proposals currently pending. Trigger an MRP run to analyze requirements.
                  </td>
                </tr>
              ) : (
                proposals.map((prop) => (
                  <tr key={prop.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-bold text-slate-900">{prop.material_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{prop.material_code}</div>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-semibold text-slate-800">{prop.preferred_supplier_name || 'No Vendor Assigned'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      {parseFloat(prop.quantity).toFixed(0)} {prop.unit_of_measure}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600">
                      {formatINR(prop.standard_cost || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-indigo-700">
                      {formatINR(prop.total_cost || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-sans text-[11px]">
                      {prop.release_date}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-sans text-[11px]">
                      {prop.receipt_date}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        prop.status === 'CONVERTED' ? 'bg-slate-100 text-slate-600' :
                        prop.status === 'PAST_DUE' ? 'bg-red-100 text-red-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {prop.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      {prop.status === 'OPEN' ? (
                        <button
                          type="button"
                          onClick={() => handleConvertProposalToPO(prop)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs shadow-sm mx-auto transition-colors"
                        >
                          <span>Convert to PO</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : prop.status === 'PAST_DUE' ? (
                        <button
                          type="button"
                          onClick={() => handleConvertProposalToPO(prop)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 font-bold text-xs shadow-sm mx-auto transition-colors"
                        >
                          <span>Expedite PO</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs flex items-center justify-center gap-1 font-semibold">
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                          Converted
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

