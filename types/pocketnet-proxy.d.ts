// Type declarations to fix module resolution issue
declare module 'pocketnet-proxy/src/kit.js' {
    // Re-export everything from the actual package
    const kit: any;
    export default kit;
  }
  
  // You might need these as well if there are other import issues
  declare module 'pocketnet-proxy/src/functions.js' {
    const functions: any;
    export default functions;
  }
  
  declare module 'pocketnet-proxy/src/proxy.js' {
    const proxy: any;
    export default proxy;
  }