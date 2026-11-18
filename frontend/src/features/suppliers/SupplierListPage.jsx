import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Power, 
  RefreshCw, 
  AlertCircle,
  Truck,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { suppliersApi } from '../../services/suppliersApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SupplierFormModal } from './SupplierFormModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export function SupplierListPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [pages, setPages] = useState(1);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
    isLoading: false,
  });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        is_active: statusFilter === '' ? undefined : statusFilter === 'true',
      };
      const res = await suppliersApi.list(params);
      setSuppliers(Array.isArray(res?.items) ? res.items : []);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError(err.message || 'Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        await suppliersApi.update(editingSupplier.id, formData);
        showNotification(`Supplier ${formData.supplier_code} updated successfully.`);
      } else {
        await suppliersApi.create(formData);
        showNotification(`Supplier ${formData.supplier_code} created successfully.`);
      }
      setFormModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      setFormError(err.message || 'An error occurred while saving the supplier.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = (supplier) => {
    const nextStatus = !supplier.is_active;
    const actionWord = nextStatus ? 'activate' : 'deactivate';

    setConfirmDialog({
      isOpen: true,
      title: `${nextStatus ? 'Activate' : 'Deactivate'} Supplier`,
      message: `Are you sure you want to ${actionWord} '${supplier.supplier_code}'?`,
      confirmText: nextStatus ? 'Activate' : 'Deactivate',
      isDestructive: !nextStatus,
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await suppliersApi.update(supplier.id, { is_active: nextStatus });
          showNotification(`Supplier '${supplier.supplier_code}' ${nextStatus ? 'activated' : 'deactivated'}.`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchSuppliers();
        } catch (err) {
          showNotification(err.message || `Failed to ${actionWord} supplier`, 'error');
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm transition-all transform animate-bounce ${
            notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Approved vendors, payment terms, contact details, and procurement links for MRP purchase suggestions.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by code, supplier name, contact, email..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>

          <button
            type="button"
            onClick={fetchSuppliers}
            title="Refresh"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading supplier records...</p>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-500 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Failed to load suppliers</h3>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-indigo-50 text-indigo-600 mb-4">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No suppliers registered</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Add your approved vendors to link materials and convert MRP proposals into Purchase Orders.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add First Supplier
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-center">Payment Terms</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {suppliers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {item.supplier_code}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{item.name}</div>
                      {item.notes && (
                        <div className="text-xs text-slate-400 truncate max-w-xs">{item.notes}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {item.contact_person && (
                        <div className="font-medium text-slate-700 text-xs">{item.contact_person}</div>
                      )}
                      {item.email && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {item.email}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {[item.city, item.state_region, item.country].filter(Boolean).join(', ') || 'N/A'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono text-slate-700">
                        {item.payment_terms_days ? `Net ${item.payment_terms_days}d` : 'Standard'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <StatusBadge isActive={item.is_active} activeText="Approved" inactiveText="Suspended" />
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Supplier"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          title={item.is_active ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            item.is_active
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-medium text-slate-700">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium text-slate-700">{Math.min(page * pageSize, total)}</span> of{' '}
              <span className="font-medium text-slate-700">{total}</span> suppliers
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors font-medium text-slate-700"
              >
                Previous
              </button>
              <span className="px-2">Page {page} of {pages || 1}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors font-medium text-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <SupplierFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        supplier={editingSupplier}
        isLoading={formLoading}
        serverError={formError}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDestructive={confirmDialog.isDestructive}
        isLoading={confirmDialog.isLoading}
      />
    </div>
  );
}

