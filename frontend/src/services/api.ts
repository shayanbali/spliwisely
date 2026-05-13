import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'http://192.168.1.232:8000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await SecureStore.getItemAsync('refresh_token');
      if (refresh) {
        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
        await SecureStore.setItemAsync('access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
