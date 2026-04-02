export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Allow browser to set boundary for multipart formData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        window.location.href = '/login';
    }
  }

  return response;
};
