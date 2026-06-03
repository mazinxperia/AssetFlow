import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('auth_token') || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('auth_token');
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth APIs
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  me: () => api.get('/api/auth/me'),
  changePassword: (oldPassword, newPassword) => 
    api.post('/api/auth/change-password', { oldPassword, newPassword }),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/api/auth/reset-password', { token, newPassword }),
};

// Users APIs
export const usersAPI = {
  getAll: () => api.get('/api/users'),
  getById: (id) => api.get(`/api/users/${id}`),
  getPreferences: () => api.get('/api/users/me/preferences'),
  updatePreferences: (data) => api.put('/api/users/me/preferences', data),
  create: (data) => api.post('/api/users', data),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`),
  resetPassword: (id, newPassword) => api.post(`/api/users/${id}/reset-password`, { newPassword }),
};

// Employees APIs
export const employeesAPI = {
  getAll: () => api.get('/api/employees'),
  getById: (id) => api.get(`/api/employees/${id}`),
  create: (data) => api.post('/api/employees', data),
  update: (id, data) => api.put(`/api/employees/${id}`, data),
  delete: (id) => api.delete(`/api/employees/${id}`),
  getAssignedAssets: (id) => api.get(`/api/employees/${id}/assets`),
  export: (sendEmail = false) => api.post('/api/employees/export', { sendEmail }, {
    responseType: sendEmail ? 'json' : 'blob'
  }),
};

// Asset Types APIs
export const assetTypesAPI = {
  getAll: () => api.get('/api/asset-types'),
  getById: (id) => api.get(`/api/asset-types/${id}`),
  create: (data) => api.post('/api/asset-types', data),
  update: (id, data) => api.put(`/api/asset-types/${id}`, data),
  delete: (id) => api.delete(`/api/asset-types/${id}`),
};

// Asset Fields APIs
export const assetFieldsAPI = {
  getByTypeId: (typeId) => api.get(`/api/asset-types/${typeId}/fields`),
  create: (typeId, data) => api.post(`/api/asset-types/${typeId}/fields`, data),
  update: (typeId, fieldId, data) => api.put(`/api/asset-types/${typeId}/fields/${fieldId}`, data),
  delete: (typeId, fieldId) => api.delete(`/api/asset-types/${typeId}/fields/${fieldId}`),
};

// Assets APIs
export const assetsAPI = {
  getAll: (params) => api.get('/api/assets', { params }),
  getById: (id) => api.get(`/api/assets/${id}`),
  create: (data) => api.post('/api/assets', data),
  update: (id, data) => api.put(`/api/assets/${id}`, data),
  delete: (id) => api.delete(`/api/assets/${id}`),
  dispose: (id, data = {}) => api.post(`/api/assets/${id}/dispose`, data),
  restore: (id) => api.post(`/api/assets/${id}/restore`),
  duplicate: (id) => api.post(`/api/assets/${id}/duplicate`),
  getInventory: () => api.get('/api/assets', { params: { inventoryOnly: true } }),
  getDisposed: () => api.get('/api/assets', { params: { disposedOnly: true } }),
  uploadImage: (formData) => api.post('/api/assets/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  export: (sendEmail = false) => api.post('/api/assets/export', { sendEmail }, {
    responseType: sendEmail ? 'json' : 'blob'
  }),
};

// Inventory APIs
export const inventoryAPI = {
  export: (sendEmail = false) => api.post('/api/inventory/export', { sendEmail }, {
    responseType: sendEmail ? 'json' : 'blob'
  }),
};

// Transfers APIs
export const transfersAPI = {
  getAll: () => api.get('/api/transfers'),
  getById: (id) => api.get(`/api/transfers/${id}`),
  create: (data) => api.post('/api/transfers', data),
  addManualHistory: (data) => api.post('/api/transfers/manual', data),
  getByAssetId: (assetId) => api.get(`/api/transfers/asset/${assetId}`),
  getByEmployeeId: (employeeId) => api.get(`/api/transfers/employee/${employeeId}`),
  delete: (id) => api.delete(`/api/transfers/${id}`),
};

// Files APIs
export const filesAPI = {
  upload: (formData) => api.post('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getUrl: (fileId) => `${API_BASE_URL}/api/files/${fileId}`,
};

// Music APIs
export const musicAPI = {
  getConfig: () => api.get('/api/music/config'),
  getStreamUrl: (trackId) => `${API_BASE_URL}/api/music/${trackId}/stream`,
};

// Vehicle Fleet APIs
export const vehiclesAPI = {
  getAll: () => api.get('/api/vehicles'),
  getById: (id) => api.get(`/api/vehicles/${id}`),
  create: (data) => api.post('/api/vehicles', data),
  update: (id, data) => api.put(`/api/vehicles/${id}`, data),
  delete: (id) => api.delete(`/api/vehicles/${id}`),
  getFields: () => api.get('/api/vehicle-fields'),
  uploadFile: (formData) => api.post('/api/vehicles/files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getFileUrl: (fileId) => `${API_BASE_URL}/api/vehicles/files/${fileId}`,
};

// Settings APIs
export const settingsAPI = {
  getBranding: () => api.get('/api/settings/branding'),
  updateBranding: (data) => api.put('/api/settings/branding', data),
  getAppSettings: () => api.get('/api/settings/app'),
  updateAppSettings: (data) => api.put('/api/settings/app', data),
  getMusic: () => api.get('/api/settings/music'),
  updateMusic: (data) => api.put('/api/settings/music', data),
  uploadMusicTrack: (formData) => api.post('/api/settings/music/tracks', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  renameMusicTrack: (id, data) => api.put(`/api/settings/music/tracks/${id}`, data),
  deleteMusicTrack: (id) => api.delete(`/api/settings/music/tracks/${id}`),
  getVehicleFields: () => api.get('/api/settings/vehicle-fields'),
  updateVehicleFields: (fields) => api.put('/api/settings/vehicle-fields', fields),
  getEmployeeFields: () => api.get('/api/settings/employee-fields'),
  updateEmployeeFields: (data) => api.put('/api/settings/employee-fields', data),
  getSMTP: () => api.get('/api/settings/smtp'),
  updateSMTP: (data) => api.put('/api/settings/smtp', data),
  testSMTP: () => api.post('/api/settings/smtp/test'),
  getMonday: () => api.get('/api/settings/monday'),
  updateMonday: (data) => api.put('/api/settings/monday', data),
  testMonday: () => api.post('/api/settings/monday/test'),
  createMondayStructure: () => api.post('/api/settings/monday/create-structure'),
  syncMonday: () => api.post('/api/settings/monday/sync'),
  getDatabaseStatus: () => api.get('/api/settings/database-status'),
  testDatabaseConnection: () => api.post('/api/settings/database-status/test'),
  getAssetFieldVisibility: () => api.get('/api/settings/asset-field-visibility'),
  updateAssetFieldVisibility: (typeId, fields) => api.put(`/api/settings/asset-field-visibility/${typeId}`, fields),
  getEmployeeFieldVisibility: () => api.get('/api/settings/employee-field-visibility'),
  updateEmployeeFieldVisibility: (fields) => api.put('/api/settings/employee-field-visibility', fields),
  getDashboardFields: () => api.get('/api/settings/dashboard-fields'),
  updateDashboardFields: (data) => api.put('/api/settings/dashboard-fields', data),
  getHikvision: () => api.get('/api/settings/hikvision'),
  updateHikvision: (data) => api.put('/api/settings/hikvision', data),
  testHikvision: () => api.post('/api/settings/hikvision/test'),
  syncHikvision: () => api.post('/api/settings/hikvision/sync'),
  getDateTime: () => api.get('/api/settings/datetime'),
  updateDateTime: (data) => api.put('/api/settings/datetime', data),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/api/dashboard/stats'),
  getPreview: (type) => api.get('/api/dashboard/preview', { params: { type } }),
};

// Search API
export const searchAPI = {
  search: (query) => api.get('/api/search', { params: { q: query } }),
};

// Subscriptions APIs
export const subscriptionsAPI = {
  getAll: () => api.get('/api/subscriptions'),
  getById: (id) => api.get(`/api/subscriptions/${id}`),
  create: (data) => api.post('/api/subscriptions', data),
  update: (id, data) => api.put(`/api/subscriptions/${id}`, data),
  renew: (id) => api.post(`/api/subscriptions/${id}/renew`),
  delete: (id) => api.delete(`/api/subscriptions/${id}`),
  fetchLogo: (url) => api.post('/api/subscriptions/fetch-logo', { url }),
};

// Clear Data APIs
export const clearAPI = {
  getStorageStats: () => api.get('/api/clear/storage-stats'),
  clearEmployees: () => api.delete('/api/clear/employees'),
  clearAssets: () => api.delete('/api/clear/assets'),
  clearTransfers: () => api.delete('/api/clear/transfers'),
  clearBrandingImages: () => api.delete('/api/clear/branding-images'),
  clearAll: () => api.delete('/api/clear/all'),
  clearSubscriptions: () => api.delete('/api/clear/subscriptions'),
};

// Backup & Restore APIs
export const backupAPI = {
  create: (categories) => api.post('/api/backup/create', { categories }, { responseType: 'blob' }),
  restore: (data) => api.post('/api/backup/restore', data),
};
