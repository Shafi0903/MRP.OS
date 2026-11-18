import { apiClient } from './apiClient';

export const productsApi = {
  list: (params = {}) => {
    return apiClient.get('/products', params);
  },

  getById: (id) => {
    return apiClient.get(`/products/${id}`);
  },

  create: (data) => {
    return apiClient.post('/products', data);
  },

  update: (id, data) => {
    return apiClient.patch(`/products/${id}`, data);
  },

  delete: (id, hardDelete = false) => {
    return apiClient.delete(`/products/${id}`, { hard_delete: hardDelete });
  },
};

