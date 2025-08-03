import axios from 'axios'

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api', // Default backend URL
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

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
