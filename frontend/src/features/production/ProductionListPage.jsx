import React, { useState, useEffect } from 'react';
import {
  Factory,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Play,
  CheckCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  RefreshCw,
  X,
  Layers,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { productionApi } from '../../services/productionApi';
import { productsApi } from '../../services/productsApi';

export function ProductionListPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notice, setNotice] = useState(null);

  // New Order Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [productId, setProductId] = useState('');
  const [plannedQty, setPlannedQty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Progress Modal
  const [progressModalOrder, setProgressModalOrder] = useState(null);
  const [completedQtyInput, setCompletedQtyInput] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ords, prods] = await Promise.all([
        productionApi.list(statusFilter ? { status: statusFilter } : {}),
        productsApi.list({ limit: 100 }),
      ]);
      setOrders(Array.isArray(ords) ? ords : []);
      setProducts(Array.isArray(prods?.items) ? prods.items : (Array.isArray(prods) ? prods : []));
    } catch (err) {
      console.error("Failed to load production orders", err);
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleTransition = async (order, toStatus, reason = null) => {
    try {
      await productionApi.transition(order.id, {
        to_status: toStatus,
        reason: reason,
        version: order.version,
      });
      setNotice(`Order ${order.order_code} transitioned to ${toStatus}`);
      setTimeout(() => setNotice(null), 3000);
      loadData();
    } catch (err) {
      alert(err.message || 'Transition failed');
    }
  };

  const handleRecordProgress = async (e) => {
    e.preventDefault();
    if (!progressModalOrder) return;
    try {
      await productionApi.recordProgress(progressModalOrder.id, {
        completed_quantity: completedQtyInput,
        version: progressModalOrder.version,
      });
      setProgressModalOrder(null);
      setNotice(`Progress recorded for ${progressModalOrder.order_code}`);
      setTimeout(() => setNotice(null), 3000);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to record progress');
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!productId || !plannedQty || !dueDate) {
      setFormError('Please select a product, planned quantity, and due date.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await productionApi.create({
        product_id: productId,
        planned_quantity: plannedQty,
        due_date: dueDate,
        priority: priority,
        notes: notes,
      });
      setShowCreateModal(false);
      setProductId('');
      setPlannedQty('');
      setDueDate('');
      setNotes('');
      setNotice(`Production order ${res.order_code} created successfully.`);
      setTimeout(() => setNotice(null), 3000);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = (Array.isArray(orders) ? orders : []).filter((o) =>
    (o.order_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.product_code || '').toLowerCase().includes(search.toLowerCase())
  );

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
            Production Planning & Orders
            <span className="text-xs font-mono font-medium px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-100">
              Phase 5
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manufacturing job orders, shop-floor dispatch, BOM allocation, and milestone progress tracking.
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs font-bold shadow-md shadow-indigo-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Production Order</span>
          </button>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order code (PRD-2026-...), SKU, or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['', 'DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {st || 'All Statuses'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Order Code</th>
                <th className="py-3 px-4">Product / Assembly</th>
                <th className="py-3 px-4">BOM Revision</th>
                <th className="py-3 px-4">Planned Qty</th>
                <th className="py-3 px-4">Completed Qty</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading production orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400 font-sans">
                    No production orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((ord) => {
                  const progressPct = Math.min(100, Math.round((parseFloat(ord.completed_quantity) / parseFloat(ord.planned_quantity)) * 100));
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-indigo-700">
                        {ord.order_code}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-slate-900">{ord.product_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{ord.product_code}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {ord.bom_revision ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 font-bold">
                            {ord.bom_revision}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {parseFloat(ord.planned_quantity).toFixed(0)} {ord.unit_of_measure}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{parseFloat(ord.completed_quantity).toFixed(0)}</span>
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">{progressPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-sans text-[11px]">
                        {ord.due_date}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ord.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                          ord.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {ord.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          ord.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                          ord.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                          ord.status === 'RELEASED' ? 'bg-indigo-100 text-indigo-800' :
                          ord.status === 'PLANNED' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          {ord.status === 'DRAFT' && (
                            <button
                              onClick={() => handleTransition(ord, 'PLANNED')}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs"
                            >
                              Plan
                            </button>
                          )}
                          {ord.status === 'PLANNED' && (
                            <button
                              onClick={() => handleTransition(ord, 'RELEASED')}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs shadow-sm"
                            >
                              Release
                            </button>
                          )}
                          {ord.status === 'RELEASED' && (
                            <button
                              onClick={() => handleTransition(ord, 'IN_PROGRESS')}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-sm"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              Start
                            </button>
                          )}
                          {ord.status === 'IN_PROGRESS' && (
                            <>
                              <button
                                onClick={() => {
                                  setProgressModalOrder(ord);
                                  setCompletedQtyInput(ord.completed_quantity);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs"
                              >
                                Progress
                              </button>
                              {parseFloat(ord.completed_quantity) > 0 && (
                                <button
                                  onClick={() => handleTransition(ord, 'COMPLETED')}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-sm"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  Complete
                                </button>
                              )}
                            </>
                          )}
                          {ord.status === 'COMPLETED' && (
                            <span className="text-emerald-600 font-semibold text-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Done
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="font-extrabold text-slate-900 text-base">New Production Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product to Manufacture *</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_code}) [{p.unit_of_measure}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Planned Quantity *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="e.g. 50"
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Production Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Customer Batch Delivery, Assembly Line 2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Recording Modal */}
      {progressModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="font-extrabold text-slate-900 text-base">Record Completed Quantity</h3>
              <button onClick={() => setProgressModalOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordProgress} className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Order <strong>{progressModalOrder.order_code}</strong> for <strong>{progressModalOrder.product_name}</strong> (Target: {progressModalOrder.planned_quantity} {progressModalOrder.unit_of_measure}).
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cumulative Finished Units</label>
                <input
                  type="number"
                  step="1"
                  min={progressModalOrder.completed_quantity}
                  max={progressModalOrder.planned_quantity}
                  value={completedQtyInput}
                  onChange={(e) => setCompletedQtyInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProgressModalOrder(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                >
                  Save Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

