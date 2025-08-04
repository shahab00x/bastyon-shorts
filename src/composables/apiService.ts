import axios from 'axios'

// Use environment variable for API base URL, fallback to localhost in development
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api')

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add credentials for CORS requests
  withCredentials: true,
})

// Add a request interceptor to handle errors
apiClient.interceptors.response.use(
  response => response,
  (error) => {
    console.error('API Error:', error.response || error.message)
    return Promise.reject(error)
  },
)

// API Service for interacting with our backend
export class ApiService {
  /**
   * Fetch node information from the backend
   */
  public static async getNodeInfo(): Promise<any> {
    try {
      const response = await apiClient.get('/nodeinfo')
      return response.data
    }
    catch (error) {
      console.error('Error fetching node info:', error)
      throw error
    }
  }

  /**
   * Search for content using the backend API
   * @param keyword - Search keyword
   * @param type - Type of content to search for (default: 'content')
   * @param pageStart - Starting page number (default: 0)
   * @param pageSize - Number of results per page (default: 50)
   */
  public static async search(
    keyword: string,
    type: string = 'content',
    pageStart: number = 0,
    pageSize: number = 50,
  ): Promise<any> {
    try {
      const params = { keyword, type, pageStart, pageSize }
      const response = await apiClient.get('/search', { params })
      return response.data
    }
    catch (error) {
      console.error('Error performing search:', error)
      throw error
    }
  }

  /**
   * Health check endpoint
   */
  public static async healthCheck(): Promise<any> {
    try {
      const response = await apiClient.get('/health')
      return response.data
    }
    catch (error) {
      console.error('Error performing health check:', error)
      throw error
    }
  }
}
