import { apiClient } from './apiClient';

export const procurementApi = {
  listPOs: async (params = {}) => {
    return apiClient.get('/purchase-orders', params);
  },

  getPOById: async (id) => {
    return apiClient.get(`/purchase-orders/${id}`);
  },

  createPO: async (data) => {
    return apiClient.post('/purchase-orders', data);
  },

  createFromProposals: async (data) => {
    return apiClient.post('/purchase-orders/from-proposals', data);
  },

  transitionPO: async (id, data) => {
    return apiClient.post(`/purchase-orders/${id}/transitions`, data);
  },

  postReceipt: async (id, data) => {
    return apiClient.post(`/purchase-orders/${id}/receipts`, data);
  },

  getPOHistory: async (id) => {
    return apiClient.get(`/purchase-orders/${id}/history`);
  },

  listGoodsReceipts: async (params = {}) => {
    return apiClient.get('/goods-receipts', params);
  },
};

