import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';

const INITIAL_FORM = {
  supplier_code: '',
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address_line: '',
  city: '',
  state_region: '',
  postal_code: '',
  country: 'India',
  payment_terms_days: 30,
  notes: '',
  is_active: true,
};

export function SupplierFormModal({
  isOpen,
  onClose,
  onSubmit,
  supplier = null,
  isLoading = false,
  serverError = null,
}) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (supplier) {
      setFormData({
        supplier_code: supplier.supplier_code || '',
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address_line: supplier.address_line || '',
        city: supplier.city || '',
        state_region: supplier.state_region || '',
        postal_code: supplier.postal_code || '',
        country: supplier.country || 'USA',
        payment_terms_days: supplier.payment_terms_days ?? 30,
        notes: supplier.notes || '',
        is_active: supplier.is_active ?? true,
      });
    } else {
      setFormData(INITIAL_FORM);
    }
    setErrors({});
  }, [supplier, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.supplier_code.trim()) {
      newErrors.supplier_code = 'Supplier code is required';
    } else if (formData.supplier_code.trim().length < 2) {
      newErrors.supplier_code = 'Code must be at least 2 characters';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Supplier name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (formData.email && !formData.email.includes('@')) {
      newErrors.email = 'Enter a valid email address';
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
      supplier_code: formData.supplier_code.trim().toUpperCase(),
      name: formData.name.trim(),
      email: formData.email ? formData.email.trim() : null,
      payment_terms_days: formData.payment_terms_days ? parseInt(formData.payment_terms_days, 10) : null,
    };

    onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? `Edit Supplier: ${supplier.supplier_code}` : 'Register New Vendor / Supplier'}
      maxWidth="max-w-2xl"
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
              Supplier Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="supplier_code"
              value={formData.supplier_code}
              onChange={handleChange}
              placeholder="e.g. SUP-STEEL-01"
              disabled={isLoading || !!supplier}
              className={`w-full px-3 py-2 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:bg-slate-100 ${
                errors.supplier_code ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.supplier_code && (
              <p className="mt-1 text-xs text-rose-600">{errors.supplier_code}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Supplier Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Apex Industrial Steel Corp"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${
                errors.name ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Contact Person
            </label>
            <input
              type="text"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              placeholder="e.g. Marcus Vance"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. orders@supplier.com"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                errors.email ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Phone Number
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 (555) 000-0000"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Payment Terms (Days)
            </label>
            <input
              type="number"
              min="0"
              max="365"
              name="payment_terms_days"
              value={formData.payment_terms_days}
              onChange={handleChange}
              placeholder="e.g. 30 (Net 30)"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Address / City / Country
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City (e.g. Mumbai, Pune)"
                disabled={isLoading}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                name="state_region"
                value={formData.state_region}
                onChange={handleChange}
                placeholder="State (e.g. Maharashtra)"
                disabled={isLoading}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Country (e.g. India)"
                disabled={isLoading}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Notes / Vendor Details
          </label>
          <textarea
            name="notes"
            rows="2"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Contract numbers, quality certification, special delivery notes..."
            disabled={isLoading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          ></textarea>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="sup_is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            disabled={isLoading}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />
          <label htmlFor="sup_is_active" className="text-sm font-medium text-slate-700 cursor-pointer">
            Approved Vendor (active for purchase orders & preferred supplier assignment)
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
            {supplier ? 'Save Changes' : 'Register Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

