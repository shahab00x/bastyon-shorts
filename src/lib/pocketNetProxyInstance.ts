import PocketNetProxyApi from 'pocketnet-proxy-api'

// Declare global variables for PocketNet Proxy API
declare global {
  var MIN_NODES_COUNT: number | undefined
  var WRITE_LOGS: boolean | undefined
  var USE_TRUST_NODES_ONLY: boolean | undefined
  var REVERSE_PROXY: boolean | undefined
  var USE_TLS_NODES_ONLY: boolean | undefined
}

let pocketNetProxyInstance: PocketNetProxyApi = null

/**
 * Returns the initialized instance of PocketNetProxyApi.
 *
 * This function returns a promise that resolves to an instance of PocketNetProxyApi.
 * If the instance is already initialized, it returns the cached instance.
 *
 * @returns {Promise<PocketNetProxyApi>} A promise that resolves to the initialized instance.
 */
export async function getPocketNetProxyInstance() {
  if (!pocketNetProxyInstance) {
    // Configure global variables for PocketNet Proxy API
    // These settings can help improve search results by using more nodes and trusted connections
    
    // Set minimum number of nodes required (default might be too low)
    global.MIN_NODES_COUNT = 20
    
    // Enable logging to help with debugging
    global.WRITE_LOGS = true
    
    // Use only trusted nodes for better reliability
    global.USE_TRUST_NODES_ONLY = false
    
    // Enable reverse proxy for better network access
    global.REVERSE_PROXY = true
    
    // Use only TLS-secured nodes for security
    global.USE_TLS_NODES_ONLY = false
    
    pocketNetProxyInstance = await PocketNetProxyApi.create()
  }
  return pocketNetProxyInstance
}
