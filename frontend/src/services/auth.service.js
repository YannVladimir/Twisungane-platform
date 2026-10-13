import axios from 'axios'
import api from './api.js'

const API_URL = '/api/v1/auth'

const login = async (email, password) => {
  // withCredentials so the browser stores the HttpOnly jwt cookie from the response
  const response = await axios.post(`${API_URL}/login`, { email, password }, { withCredentials: true })
  // Store only non-sensitive user metadata (no token — it's in the cookie)
  localStorage.setItem('user', JSON.stringify(response.data))
  return response.data
}

const logout = async () => {
  try {
    await api.post(`${API_URL}/logout`)
  } catch {
    // Clear client state even if the server call fails
  }
  localStorage.removeItem('user')
}

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

const updatePreferences = async (prefs) => {
  const response = await api.patch('/api/v1/me/preferences', prefs)
  return response.data
}

const authService = {
  login,
  logout,
  getCurrentUser,
  updatePreferences,
}

export default authService
