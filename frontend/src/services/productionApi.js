import { apiClient } from './apiClient';

export const productionApi = {
  list: async (params = {}) => {
    return apiClient.get('/production-orders', params);
  },

  getById: async (id) => {
    return apiClient.get(`/production-orders/${id}`);
  },

  create: async (data) => {
    return apiClient.post('/production-orders', data);
  },

  transition: async (id, data) => {
    return apiClient.post(`/production-orders/${id}/transitions`, data);
  },

  recordProgress: async (id, data) => {
    return apiClient.post(`/production-orders/${id}/progress`, data);
  },

  getHistory: async (id) => {
    return apiClient.get(`/production-orders/${id}/history`);
  },
};

