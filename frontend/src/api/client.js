import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
})

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      try {
        const res = await axios.post('/auth/refresh', {}, { withCredentials: true })
        useAuthStore.getState().setAuth(useAuthStore.getState().user, res.data.access_token)
        err.config.headers.Authorization = `Bearer ${res.data.access_token}`
        return client(err.config)
      } catch {
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
