// Runtime API disable configuration
// This file can be used to disable API calls without environment variables
// Set window.__BShortsDisableApi = true to disable all API calls

// Check if we should disable API calls
(function() {
  // Check URL parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const disableParam = urlParams.get('disableApi') || urlParams.get('disable_api');
  
  if (disableParam && (disableParam.toLowerCase() === 'true' || disableParam === '1')) {
    window.__BShortsDisableApi = true;
    console.log('API calls disabled via URL parameter');
    return;
  }
  
  // Check for a global flag
  if (window.__VITE_DISABLE_API === true) {
    window.__BShortsDisableApi = true;
    console.log('API calls disabled via global flag');
    return;
  }
  
  // Check localStorage
  try {
    const stored = localStorage.getItem('bshorts:disableApi');
    if (stored && (stored.toLowerCase() === 'true' || stored === '1')) {
      window.__BShortsDisableApi = true;
      console.log('API calls disabled via localStorage');
      return;
    }
  } catch (e) {}
  
  // Default to false
  window.__BShortsDisableApi = false;
})();
