import { apiClient } from './apiClient';

export const materialsApi = {
  list: (params = {}) => {
    return apiClient.get('/materials', params);
  },

  getById: (id) => {
    return apiClient.get(`/materials/${id}`);
  },

  create: (data) => {
    return apiClient.post('/materials', data);
  },

  update: (id, data) => {
    return apiClient.patch(`/materials/${id}`, data);
  },

  delete: (id, hardDelete = false) => {
    return apiClient.delete(`/materials/${id}`, { hard_delete: hardDelete });
  },

  checkHealth: async () => {
    const rootUrl = import.meta.env.VITE_API_ROOT || '';
    const response = await fetch(`${rootUrl}/api/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },
};

