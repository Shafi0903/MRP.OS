import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';

const INITIAL_FORM = {
  product_code: '',
  name: '',
  description: '',
  product_type: 'FINISHED',
  unit_of_measure: 'EA',
  lead_time_days: 0,
  is_active: true,
};

export function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  product = null,
  isLoading = false,
  serverError = null,
}) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        product_code: product.product_code || '',
        name: product.name || '',
        description: product.description || '',
        product_type: product.product_type || 'FINISHED',
        unit_of_measure: product.unit_of_measure || 'EA',
        lead_time_days: product.lead_time_days ?? 0,
        is_active: product.is_active ?? true,
      });
    } else {
      setFormData(INITIAL_FORM);
    }
    setErrors({});
  }, [product, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.product_code.trim()) {
      newErrors.product_code = 'Product code is required';
    } else if (formData.product_code.trim().length < 2) {
      newErrors.product_code = 'Product code must be at least 2 characters';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.unit_of_measure.trim()) {
      newErrors.unit_of_measure = 'Unit of measure is required';
    }

    if (isNaN(Number(formData.lead_time_days)) || Number(formData.lead_time_days) < 0) {
      newErrors.lead_time_days = 'Lead time must be non-negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...formData,
      product_code: formData.product_code.trim().toUpperCase(),
      name: formData.name.trim(),
      unit_of_measure: formData.unit_of_measure.trim().toUpperCase(),
      lead_time_days: parseInt(formData.lead_time_days, 10) || 0,
    };

    onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Edit Product: ${product.product_code}` : 'Create New Product'}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Product Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="product_code"
              value={formData.product_code}
              onChange={handleChange}
              placeholder="e.g. PRD-DESK-001"
              disabled={isLoading || !!product}
              className={`w-full px-3 py-2 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:bg-slate-100 ${
                errors.product_code ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.product_code && (
              <p className="mt-1 text-xs text-rose-600">{errors.product_code}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Standing Desk Assembly"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${
                errors.name ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Classification <span className="text-rose-500">*</span>
            </label>
            <select
              name="product_type"
              value={formData.product_type}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="FINISHED">FINISHED (Finished Goods)</option>
              <option value="SEMI_FINISHED">SEMI_FINISHED (Sub-Assembly)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Unit of Measure <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="unit_of_measure"
              value={formData.unit_of_measure}
              onChange={handleChange}
              placeholder="e.g. EA, SET"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                errors.unit_of_measure ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.unit_of_measure && (
              <p className="mt-1 text-xs text-rose-600">{errors.unit_of_measure}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Production Lead Time (Days)
            </label>
            <input
              type="number"
              min="0"
              max="3650"
              name="lead_time_days"
              value={formData.lead_time_days}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            name="description"
            rows="2"
            value={formData.description}
            onChange={handleChange}
            placeholder="Detailed specifications, model series, or assembly instructions..."
            disabled={isLoading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          ></textarea>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="prod_is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            disabled={isLoading}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />
          <label htmlFor="prod_is_active" className="text-sm font-medium text-slate-700 cursor-pointer">
            Active for Production Planning and BOM linking
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {product ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

