import { apiClient } from './apiClient';

export const dashboardApi = {
  getSummary: () => {
    return apiClient.get('/dashboard/summary');
  },
};

