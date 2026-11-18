import { apiClient } from './apiClient';

export const bomApi = {
  list: async (params = {}) => {
    return apiClient.get('/boms', params);
  },

  getById: async (id) => {
    return apiClient.get(`/boms/${id}`);
  },

  explode: async (id, quantity = 1.0) => {
    return apiClient.get(`/boms/${id}/explosion`, { quantity });
  },

  create: async (data) => {
    return apiClient.post('/boms', data);
  },
};

