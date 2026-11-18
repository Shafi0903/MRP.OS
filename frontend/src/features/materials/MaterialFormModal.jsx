import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { suppliersApi } from '../../services/suppliersApi';

const INITIAL_FORM = {
  material_code: '',
  name: '',
  description: '',
  category: 'General',
  material_type: 'RAW',
  unit: 'EA',
  procurement_type: 'BUY',
  unit_cost: '0.0000',
  lead_time_days: 0,
  safety_stock: '0.0000',
  minimum_order_qty: '0.0000',
  lot_size: 'LOT_FOR_LOT',
  fixed_lot_size: '',
  preferred_supplier_id: '',
  is_active: true,
};

export function MaterialFormModal({
  isOpen,
  onClose,
  onSubmit,
  material = null,
  isLoading = false,
  serverError = null,
}) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      suppliersApi.list({ is_active: true, page_size: 100 })
        .then((res) => setSuppliers(res.items || []))
        .catch(() => setSuppliers([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (material) {
      setFormData({
        material_code: material.material_code || '',
        name: material.name || '',
        description: material.description || '',
        category: material.category || 'General',
        material_type: material.material_type || 'RAW',
        unit: material.unit || 'EA',
        procurement_type: material.procurement_type || 'BUY',
        unit_cost: material.unit_cost?.toString() || '0.0000',
        lead_time_days: material.lead_time_days ?? 0,
        safety_stock: material.safety_stock?.toString() || '0.0000',
        minimum_order_qty: material.minimum_order_qty?.toString() || '0.0000',
        lot_size: material.lot_size || 'LOT_FOR_LOT',
        fixed_lot_size: material.fixed_lot_size?.toString() || '',
        preferred_supplier_id: material.preferred_supplier_id || '',
        is_active: material.is_active ?? true,
      });
    } else {
      setFormData(INITIAL_FORM);
    }
    setErrors({});
  }, [material, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.material_code.trim()) {
      newErrors.material_code = 'Material code is required';
    } else if (formData.material_code.trim().length < 2) {
      newErrors.material_code = 'Material code must be at least 2 characters';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Material name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Unit is required';
    }

    if (isNaN(Number(formData.unit_cost)) || Number(formData.unit_cost) < 0) {
      newErrors.unit_cost = 'Unit cost must be a non-negative number';
    }

    if (isNaN(Number(formData.lead_time_days)) || Number(formData.lead_time_days) < 0) {
      newErrors.lead_time_days = 'Lead time must be non-negative';
    }

    if (formData.lot_size === 'FIXED') {
      if (!formData.fixed_lot_size || isNaN(Number(formData.fixed_lot_size)) || Number(formData.fixed_lot_size) <= 0) {
        newErrors.fixed_lot_size = 'Fixed lot size must be greater than 0';
      }
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
      material_code: formData.material_code.trim().toUpperCase(),
      name: formData.name.trim(),
      unit: formData.unit.trim().toUpperCase(),
      unit_cost: formData.unit_cost || '0.0000',
      lead_time_days: parseInt(formData.lead_time_days, 10) || 0,
      safety_stock: formData.safety_stock || '0.0000',
      minimum_order_qty: formData.minimum_order_qty || '0.0000',
      fixed_lot_size: formData.lot_size === 'FIXED' && formData.fixed_lot_size ? formData.fixed_lot_size : null,
      preferred_supplier_id: formData.preferred_supplier_id || null,
    };

    onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={material ? `Edit Material: ${material.material_code}` : 'Add New Material'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Material Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Material Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="material_code"
              value={formData.material_code}
              onChange={handleChange}
              placeholder="e.g. MAT-STEEL-001"
              disabled={isLoading || !!material}
              className={`w-full px-3 py-2 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:bg-slate-100 ${
                errors.material_code ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.material_code && (
              <p className="mt-1 text-xs text-rose-600">{errors.material_code}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Mild Steel Sheet 2mm"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${
                errors.name ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
          </div>

          {/* Material Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Material Type <span className="text-rose-500">*</span>
            </label>
            <select
              name="material_type"
              value={formData.material_type}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="RAW">RAW (Raw Material)</option>
              <option value="COMPONENT">COMPONENT (Purchased Part)</option>
              <option value="PACKAGING">PACKAGING (Boxes, Wraps)</option>
              <option value="CONSUMABLE">CONSUMABLE</option>
              <option value="SUBASSEMBLY">SUBASSEMBLY</option>
            </select>
          </div>

          {/* Unit of Measure */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Unit of Measure <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              placeholder="e.g. KG, NOS, MTR, LTR"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                errors.unit ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.unit && <p className="mt-1 text-xs text-rose-600">{errors.unit}</p>}
          </div>

          {/* Procurement Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Procurement Type
            </label>
            <select
              name="procurement_type"
              value={formData.procurement_type}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="BUY">BUY (External Purchase)</option>
              <option value="MAKE">MAKE (Internal Production)</option>
              <option value="BOTH">BOTH (Purchased or Made)</option>
            </select>
          </div>

          {/* Preferred Supplier */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Preferred Vendor / Supplier
            </label>
            <select
              name="preferred_supplier_id"
              value={formData.preferred_supplier_id}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="">-- No Supplier Assigned --</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.supplier_code} - {sup.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Cost */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Unit Cost (₹ INR)
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              name="unit_cost"
              value={formData.unit_cost}
              onChange={handleChange}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                errors.unit_cost ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.unit_cost && <p className="mt-1 text-xs text-rose-600">{errors.unit_cost}</p>}
          </div>

          {/* Lead Time Days */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Lead Time (Days)
            </label>
            <input
              type="number"
              min="0"
              name="lead_time_days"
              value={formData.lead_time_days}
              onChange={handleChange}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                errors.lead_time_days ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.lead_time_days && (
              <p className="mt-1 text-xs text-rose-600">{errors.lead_time_days}</p>
            )}
          </div>

          {/* Safety Stock */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Safety Stock
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              name="safety_stock"
              value={formData.safety_stock}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Minimum Order Qty */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Min Order Qty (MOQ)
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              name="minimum_order_qty"
              value={formData.minimum_order_qty}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Lot Size Policy */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Lot Sizing Policy
            </label>
            <select
              name="lot_size"
              value={formData.lot_size}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="LOT_FOR_LOT">Lot-for-Lot (Exact Need)</option>
              <option value="FIXED">Fixed Order Multiple</option>
              <option value="PERIOD">Period Lot Sizing</option>
            </select>
          </div>
        </div>

        {/* Conditional Fixed Lot Size */}
        {formData.lot_size === 'FIXED' && (
          <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
            <label className="block text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1">
              Fixed Lot Size Multiple <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              name="fixed_lot_size"
              value={formData.fixed_lot_size}
              onChange={handleChange}
              placeholder="e.g. 50.0000"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white ${
                errors.fixed_lot_size ? 'border-rose-300 bg-rose-50' : 'border-slate-300'
              }`}
            />
            {errors.fixed_lot_size && (
              <p className="mt-1 text-xs text-rose-600">{errors.fixed_lot_size}</p>
            )}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            name="description"
            rows="2"
            value={formData.description}
            onChange={handleChange}
            placeholder="Specifications, supplier notes, or usage details..."
            disabled={isLoading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          ></textarea>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            disabled={isLoading}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-slate-700 cursor-pointer">
            Active in production planning & MRP
          </label>
        </div>

        {/* Action Buttons */}
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
            {material ? 'Save Changes' : 'Create Material'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

