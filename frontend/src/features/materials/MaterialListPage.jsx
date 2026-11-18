import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Power, 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  PackageCheck,
  Layers
} from 'lucide-react';
import { materialsApi } from '../../services/materialsApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MaterialFormModal } from './MaterialFormModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatINR } from '../../utils/formatters';

export function MaterialListPage() {
  const [materials, setMaterials] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [pages, setPages] = useState(1);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Confirmation dialog state
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

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        is_active: statusFilter === '' ? undefined : statusFilter === 'true',
        material_type: typeFilter || undefined,
      };
      const res = await materialsApi.list(params);
      setMaterials(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError(err.message || 'Failed to load materials.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingMaterial(null);
    setFormError(null);
    setFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (material) => {
    setEditingMaterial(material);
    setFormError(null);
    setFormModalOpen(true);
  };

  // Handle Form Submit
  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setFormError(null);
    try {
      if (editingMaterial) {
        await materialsApi.update(editingMaterial.id, formData);
        showNotification(`Material ${formData.material_code} updated successfully.`);
      } else {
        await materialsApi.create(formData);
        showNotification(`Material ${formData.material_code} created successfully.`);
      }
      setFormModalOpen(false);
      fetchMaterials();
    } catch (err) {
      setFormError(err.message || 'An error occurred while saving the material.');
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = (material) => {
    const nextStatus = !material.is_active;
    const actionWord = nextStatus ? 'activate' : 'deactivate';

    setConfirmDialog({
      isOpen: true,
      title: `${nextStatus ? 'Activate' : 'Deactivate'} Material`,
      message: `Are you sure you want to ${actionWord} '${material.material_code}'? ${
        !nextStatus ? 'It will not be available for new planned production orders.' : ''
      }`,
      confirmText: nextStatus ? 'Activate' : 'Deactivate',
      isDestructive: !nextStatus,
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await materialsApi.update(material.id, { is_active: nextStatus });
          showNotification(`Material '${material.material_code}' ${nextStatus ? 'activated' : 'deactivated'}.`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchMaterials();
        } catch (err) {
          showNotification(err.message || `Failed to ${actionWord} material`, 'error');
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm transition-all transform animate-bounce ${
            notification.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Material Master</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain raw materials, parts, components, and procurement attributes for MRP calculations.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Material
        </button>
      </div>

      {/* Filter and Search Bar */}
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
            placeholder="Search by code, name, description..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
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

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="">All Types</option>
            <option value="RAW">RAW</option>
            <option value="COMPONENT">COMPONENT</option>
            <option value="PACKAGING">PACKAGING</option>
            <option value="CONSUMABLE">CONSUMABLE</option>
            <option value="SUBASSEMBLY">SUBASSEMBLY</option>
          </select>

          <button
            type="button"
            onClick={fetchMaterials}
            title="Refresh"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading materials database...</p>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-500 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Failed to load materials</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchMaterials}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : materials.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-indigo-50 text-indigo-600 mb-4">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No materials found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {search || statusFilter || typeFilter
                ? 'Try adjusting your filters or search keywords.'
                : 'Get started by creating your first material record.'}
            </p>
            {!search && !statusFilter && !typeFilter && (
              <button
                onClick={handleOpenCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add First Material
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Name & Category</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">UOM</th>
                  <th className="py-3 px-4">Procurement</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Lead Time</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {materials.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Code */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {item.material_code}
                    </td>

                    {/* Name & Category */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-slate-400 truncate max-w-xs">{item.description}</div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700">
                        {item.material_type}
                      </span>
                    </td>

                    {/* UOM */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {item.unit}
                    </td>

                    {/* Procurement */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`text-xs font-medium ${
                        item.procurement_type === 'BUY' ? 'text-blue-600' : 'text-purple-600'
                      }`}>
                        {item.procurement_type}
                      </span>
                    </td>

                    {/* Unit Cost */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 whitespace-nowrap font-medium">
                      {formatINR(item.unit_cost)}
                    </td>

                    {/* Lead Time */}
                    <td className="py-3.5 px-4 text-right text-slate-600 whitespace-nowrap">
                      {item.lead_time_days}d
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <StatusBadge isActive={item.is_active} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Material"
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
              <span className="font-medium text-slate-700">
                {Math.min(page * pageSize, total)}
              </span>{' '}
              of <span className="font-medium text-slate-700">{total}</span> materials
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-slate-700"
              >
                Previous
              </button>
              <span className="px-2">
                Page {page} of {pages || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <MaterialFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        material={editingMaterial}
        isLoading={formLoading}
        serverError={formError}
      />

      {/* Confirmation Dialog */}
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

