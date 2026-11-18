const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

class ApiError extends Error {
  constructor(message, code = 'API_ERROR', status = 500, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return null;
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorCode = data?.error?.code || `HTTP_${response.status}`;
      const errorMessage = data?.error?.message || response.statusText || 'Request failed';
      const errorDetails = data?.error?.details || {};
      throw new ApiError(errorMessage, errorCode, response.status, errorDetails);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network or abort error
    throw new ApiError(
      error.message || 'Unable to connect to server. Please check your network connection.',
      'NETWORK_ERROR',
      0,
      {}
    );
  }
}

export const apiClient = {
  get: (endpoint, queryParams = {}, options = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(fullPath, { ...options, method: 'GET' });
  },

  post: (endpoint, body, options = {}) => {
    return request(endpoint, { ...options, method: 'POST', body });
  },

  patch: (endpoint, body, options = {}) => {
    return request(endpoint, { ...options, method: 'PATCH', body });
  },

  put: (endpoint, body, options = {}) => {
    return request(endpoint, { ...options, method: 'PUT', body });
  },

  delete: (endpoint, queryParams = {}, options = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(fullPath, { ...options, method: 'DELETE' });
  },
};

export { ApiError };

