import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Power, 
  RefreshCw, 
  AlertCircle,
  Box,
  Layers,
  ArrowRight
} from 'lucide-react';
import { productsApi } from '../../services/productsApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProductFormModal } from './ProductFormModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export function ProductListPage() {
  const [products, setProducts] = useState([]);
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
  const [editingProduct, setEditingProduct] = useState(null);
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

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        is_active: statusFilter === '' ? undefined : statusFilter === 'true',
        product_type: typeFilter || undefined,
      };
      const res = await productsApi.list(params);
      setProducts(Array.isArray(res?.items) ? res.items : []);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setFormError(null);
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, formData);
        showNotification(`Product ${formData.product_code} updated successfully.`);
      } else {
        await productsApi.create(formData);
        showNotification(`Product ${formData.product_code} created successfully.`);
      }
      setFormModalOpen(false);
      fetchProducts();
    } catch (err) {
      setFormError(err.message || 'An error occurred while saving the product.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = (product) => {
    const nextStatus = !product.is_active;
    const actionWord = nextStatus ? 'activate' : 'deactivate';

    setConfirmDialog({
      isOpen: true,
      title: `${nextStatus ? 'Activate' : 'Deactivate'} Product`,
      message: `Are you sure you want to ${actionWord} '${product.product_code}'?`,
      confirmText: nextStatus ? 'Activate' : 'Deactivate',
      isDestructive: !nextStatus,
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await productsApi.update(product.id, { is_active: nextStatus });
          showNotification(`Product '${product.product_code}' ${nextStatus ? 'activated' : 'deactivated'}.`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchProducts();
        } catch (err) {
          showNotification(err.message || `Failed to ${actionWord} product`, 'error');
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Master</h1>
          <p className="text-sm text-slate-500 mt-1">
            Finished goods and semi-finished sub-assemblies planned through Bills of Materials (BOM).
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Filter / Search Bar */}
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
            placeholder="Search by code, product name, description..."
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

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="">All Types</option>
            <option value="FINISHED">Finished Goods</option>
            <option value="SEMI_FINISHED">Semi-Finished</option>
          </select>

          <button
            type="button"
            onClick={fetchProducts}
            title="Refresh"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading products...</p>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-500 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Failed to load products</h3>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-indigo-50 text-indigo-600 mb-4">
              <Box className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No products found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Get started by adding your first finished good or sub-assembly.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Product Code</th>
                  <th className="py-3 px-4">Name & Description</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">UOM</th>
                  <th className="py-3 px-4 text-right">Lead Time</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {products.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {item.product_code}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-slate-400 truncate max-w-xs">{item.description}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        item.product_type === 'FINISHED' 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {item.product_type === 'FINISHED' ? 'Finished Good' : 'Semi-Finished'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {item.unit_of_measure}
                    </td>

                    <td className="py-3.5 px-4 text-right text-slate-600 whitespace-nowrap">
                      {item.lead_time_days} days
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <StatusBadge isActive={item.is_active} />
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Product"
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
              <span className="font-medium text-slate-700">{total}</span> products
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

      <ProductFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        product={editingProduct}
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

