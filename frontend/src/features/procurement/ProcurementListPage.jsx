import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Send,
  PackageCheck,
  Sparkles,
  RefreshCw,
  X,
  Layers,
  ArrowRight,
  AlertCircle,
  FileText
} from 'lucide-react';
import { procurementApi } from '../../services/procurementApi';
import { suppliersApi } from '../../services/suppliersApi';
import { materialsApi } from '../../services/materialsApi';
import { formatINR } from '../../utils/formatters';

export function ProcurementListPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notice, setNotice] = useState(null);

  // Goods Receipt Modal
  const [receiveModalPO, setReceiveModalPO] = useState(null);
  const [receiptLines, setReceiptLines] = useState({});
  const [deliveryRef, setDeliveryRef] = useState('');
  const [receiving, setReceiving] = useState(false);

  // PO Detail Modal
  const [detailPO, setDetailPO] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pos, sups, mats] = await Promise.all([
        procurementApi.listPOs(statusFilter ? { status: statusFilter } : {}),
        suppliersApi.list({ limit: 100 }),
        materialsApi.list({ limit: 100 }),
      ]);
      setOrders(Array.isArray(pos) ? pos : []);
      setSuppliers(Array.isArray(sups?.items) ? sups.items : (Array.isArray(sups) ? sups : []));
      setMaterials(Array.isArray(mats?.items) ? mats.items : (Array.isArray(mats) ? mats : []));
    } catch (err) {
      console.error("Failed to load POs", err);
      setOrders([]);
      setSuppliers([]);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleTransition = async (po, toStatus, reason = null) => {
    try {
      await procurementApi.transitionPO(po.id, {
        to_status: toStatus,
        reason: reason,
        version: po.version,
      });
      setNotice(`Purchase Order ${po.po_number} transitioned to ${toStatus}`);
      setTimeout(() => setNotice(null), 3000);
      loadData();
    } catch (err) {
      alert(err.message || 'Transition failed');
    }
  };

  const openReceiveModal = (po) => {
    setReceiveModalPO(po);
    const initial = {};
    po.items?.forEach((item) => {
      initial[item.id] = item.open_quantity;
    });
    setReceiptLines(initial);
    setDeliveryRef(`DN-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handlePostReceipt = async (e) => {
    e.preventDefault();
    if (!receiveModalPO) return;

    const linesPayload = Object.entries(receiptLines)
      .filter(([_, qty]) => parseFloat(qty) > 0)
      .map(([itemId, qty]) => ({
        purchase_order_item_id: itemId,
        received_quantity: qty,
      }));

    if (linesPayload.length === 0) {
      alert('Please enter a received quantity greater than 0.');
      return;
    }

    try {
      setReceiving(true);
      const res = await procurementApi.postReceipt(receiveModalPO.id, {
        delivery_reference: deliveryRef,
        lines: linesPayload,
      });
      setReceiveModalPO(null);
      setNotice(`Goods Receipt ${res.receipt_number} posted! Inventory ledger balance updated.`);
      setTimeout(() => setNotice(null), 4000);
      loadData();
    } catch (err) {
      alert(err.message || 'Goods receipt posting failed');
    } finally {
      setReceiving(false);
    }
  };

  const filtered = (Array.isArray(orders) ? orders : []).filter((o) =>
    (o.po_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.supplier_name || '').toLowerCase().includes(search.toLowerCase())
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
            Purchase Orders & Procurement
            <span className="text-xs font-mono font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              Phase 7
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supplier purchase orders in INR (₹), conversion from MRP netting proposals, and atomic Goods Receipt (GRN) posting.
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
        </div>
      </div>

      {/* Filters Strip */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO number (PUR-2026-...) or vendor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {st || 'All POs'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor / Supplier</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Lines</th>
                <th className="py-3 px-4 text-right">Total Amount (₹)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Lifecycle & Goods Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-sans">
                    No purchase orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-indigo-700">
                      <button
                        onClick={() => setDetailPO(po)}
                        className="hover:underline text-left"
                      >
                        {po.po_number}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-bold text-slate-900">{po.supplier_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{po.payment_terms || 'Net 30'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-sans text-[11px]">
                      {po.order_date}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {po.items?.length || 0} line items
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      {formatINR(po.total_amount)}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        po.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' :
                        po.status === 'PARTIALLY_RECEIVED' ? 'bg-amber-100 text-amber-800' :
                        po.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                        po.status === 'APPROVED' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5">
                        {po.status === 'DRAFT' && (
                          <button
                            onClick={() => handleTransition(po, 'SUBMITTED')}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs"
                          >
                            Submit
                          </button>
                        )}
                        {po.status === 'SUBMITTED' && (
                          <button
                            onClick={() => handleTransition(po, 'APPROVED')}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs"
                          >
                            Approve
                          </button>
                        )}
                        {po.status === 'APPROVED' && (
                          <button
                            onClick={() => handleTransition(po, 'SENT')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs shadow-sm"
                          >
                            <Send className="w-3 h-3" />
                            Send to Vendor
                          </button>
                        )}
                        {(po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (
                          <button
                            onClick={() => openReceiveModal(po)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-sm"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            Receive Goods
                          </button>
                        )}
                        {po.status === 'RECEIVED' && (
                          <span className="text-emerald-600 font-semibold text-xs flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Fully In Stock
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goods Receipt (GRN) Posting Modal */}
      {receiveModalPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-600" />
                  Goods Receipt Note (GRN) — {receiveModalPO.po_number}
                </h3>
                <p className="text-xs text-slate-500">
                  Vendor: {receiveModalPO.supplier_name} • Posts stock directly to Inventory Ledger.
                </p>
              </div>
              <button onClick={() => setReceiveModalPO(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostReceipt} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Reference / Challan Number</label>
                <input
                  type="text"
                  value={deliveryRef}
                  onChange={(e) => setDeliveryRef(e.target.value)}
                  placeholder="e.g. DN-1182, CHN-902"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Line Items to Receive</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Item Code & Name</th>
                        <th className="py-2 px-3 text-right">Ordered</th>
                        <th className="py-2 px-3 text-right">Open Qty</th>
                        <th className="py-2 px-3 text-right">Receiving Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {receiveModalPO.items?.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-sans">
                            <div className="font-semibold text-slate-900">{item.material_name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.material_code}</div>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {parseFloat(item.ordered_quantity).toFixed(0)} {item.unit_of_measure}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-amber-600">
                            {parseFloat(item.open_quantity).toFixed(0)} {item.unit_of_measure}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={item.open_quantity}
                              value={receiptLines[item.id] || ''}
                              onChange={(e) => setReceiptLines({ ...receiptLines, [item.id]: e.target.value })}
                              className="w-24 text-right px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReceiveModalPO(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-100"
                >
                  {receiving ? 'Posting GRN...' : 'Confirm Goods Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Detail Slide-Over */}
      {detailPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Purchase Order {detailPO.po_number}</h3>
                <p className="text-xs text-slate-500">{detailPO.supplier_name} • Order Date: {detailPO.order_date}</p>
              </div>
              <button onClick={() => setDetailPO(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">STATUS</span>
                  <span className="font-bold text-slate-800">{detailPO.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PAYMENT TERMS</span>
                  <span className="font-bold text-slate-800">{detailPO.payment_terms || 'Net 30'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">TOTAL VALUE</span>
                  <span className="font-bold text-indigo-700 text-sm">{formatINR(detailPO.total_amount)}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Line Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3 text-right">Ordered</th>
                        <th className="py-2 px-3 text-right">Received</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {detailPO.items?.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-sans">
                            <div className="font-semibold text-slate-900">{item.material_name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.material_code}</div>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700">
                            {parseFloat(item.ordered_quantity).toFixed(0)} {item.unit_of_measure}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">
                            {parseFloat(item.received_quantity).toFixed(0)} {item.unit_of_measure}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {formatINR(item.unit_price)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatINR(item.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailPO(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

