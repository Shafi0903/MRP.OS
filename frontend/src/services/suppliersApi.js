import { apiClient } from './apiClient';

export const suppliersApi = {
  list: (params = {}) => {
    return apiClient.get('/suppliers', params);
  },

  getById: (id) => {
    return apiClient.get(`/suppliers/${id}`);
  },

  create: (data) => {
    return apiClient.post('/suppliers', data);
  },

  update: (id, data) => {
    return apiClient.patch(`/suppliers/${id}`, data);
  },

  delete: (id, hardDelete = false) => {
    return apiClient.delete(`/suppliers/${id}`, { hard_delete: hardDelete });
  },
};

