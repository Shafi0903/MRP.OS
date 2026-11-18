import { apiClient } from './apiClient';

export const mrpApi = {
  triggerRun: async (data = {}) => {
    return apiClient.post('/mrp/runs', data);
  },

  listRuns: async (params = {}) => {
    return apiClient.get('/mrp/runs', params);
  },

  getRunById: async (id) => {
    return apiClient.get(`/mrp/runs/${id}`);
  },

  listProposals: async (params = {}) => {
    return apiClient.get('/mrp/proposals', params);
  },
};

