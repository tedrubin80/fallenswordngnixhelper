// ==UserScript==
// @name           FallenSwordHelper
// @namespace      terrasoft.gr
// @description    Fallen Sword Helper - Modernized version with improved error handling and server-friendly practices
// @include        https://www.fallensword.com/*
// @include        https://guide.fallensword.com/*
// @include        https://fallensword.com/*
// @include        https://*.fallensword.com/*
// @include        https://local.huntedcow.com/fallensword/*
// @exclude        https://forum.fallensword.com/*
// @exclude        https://wiki.fallensword.com/*
// @exclude        https://www.fallensword.com/app.php*
// @exclude        https://www.fallensword.com/fetchdata.php*
// @version        1525
// @downloadURL    https://fallenswordhelper.github.io/fallenswordhelper/Releases/Current/fallenswordhelper.user.js
// @grant          none
// @run-at         document-body
// ==/UserScript==

// Enhanced error handling and retry mechanism
class FSHLoader {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000;
    this.maxDelay = 8000;
    this.moduleUrl = 'https://fallenswordhelper.github.io/fallenswordhelper/resources/prod/1524/calfSystem.min.js';
  }

  // Calculate exponential backoff delay with jitter
  calculateDelay(attempt) {
    const exponentialDelay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add 30% jitter
    return exponentialDelay + jitter;
  }

  // Enhanced module loading with proper error handling
  async loadModule(gmInfo) {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`FSH: Loading attempt ${attempt + 1}/${this.maxRetries}`);
        
        // Add cache busting to prevent stale module issues
        const cacheBuster = Date.now();
        const moduleUrlWithCache = `${this.moduleUrl}?v=${cacheBuster}&attempt=${attempt}`;
        
        // Import with timeout protection
        const module = await Promise.race([
          import(moduleUrlWithCache),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Module load timeout')), 10000)
          )
        ]);

        if (module && typeof module.default === 'function') {
          console.log('FSH: Module loaded successfully');
          module.default('1524', gmInfo);
          return true;
        } else {
          throw new Error('Invalid module structure');
        }
        
      } catch (error) {
        lastError = error;
        console.warn(`FSH: Attempt ${attempt + 1} failed:`, error.message);
        
        // Don't wait after the last attempt
        if (attempt < this.maxRetries - 1) {
          const delay = this.calculateDelay(attempt);
          console.log(`FSH: Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error('FSH: Failed to load after all attempts. Last error:', lastError);
    this.showUserError(lastError);
    return false;
  }

  // User-friendly error notification
  showUserError(error) {
    try {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 9999;
        font-family: Arial, sans-serif;
        font-size: 12px;
        max-width: 300px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      `;
      errorDiv.innerHTML = `
        <strong>FallenSwordHelper Error</strong><br>
        Failed to load helper module.<br>
        <small>Check console for details.</small>
        <button onclick="this.parentElement.remove()" style="float: right; margin-left: 10px; background: none; border: 1px solid white; color: white; cursor: pointer;">×</button>
      `;
      document.body.appendChild(errorDiv);
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (errorDiv.parentElement) {
          errorDiv.remove();
        }
      }, 10000);
    } catch (e) {
      // Silently fail if we can't show the error
      console.error('FSH: Could not display error notification:', e);
    }
  }

  // Safe GM_info access with fallback
  getGMInfo() {
    try {
      return typeof GM_info !== 'undefined' ? GM_info : {
        script: {
          name: 'FallenSwordHelper',
          version: '1525'
        },
        userAgent: navigator.userAgent
      };
    } catch (error) {
      console.warn('FSH: Could not access GM_info:', error);
      return {
        script: {
          name: 'FallenSwordHelper',
          version: '1525'
        },
        userAgent: navigator.userAgent
      };
    }
  }
}

// Main initialization function
async function initializeFSH() {
  try {
    // Check if we're on a valid page
    if (!document.body) {
      console.warn('FSH: Document body not available, waiting...');
      await new Promise(resolve => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve);
        } else {
          resolve();
        }
      });
    }

    // Prevent multiple instances
    if (window.fshLoading || window.fshLoaded) {
      console.log('FSH: Already loading or loaded, skipping...');
      return;
    }
    window.fshLoading = true;

    console.log('FSH: Initializing...');
    
    const loader = new FSHLoader();
    const gmInfo = loader.getGMInfo();
    
    const success = await loader.loadModule(gmInfo);
    
    window.fshLoading = false;
    window.fshLoaded = success;
    
    if (success) {
      console.log('FSH: Initialization complete');
    }
    
  } catch (error) {
    window.fshLoading = false;
    console.error('FSH: Critical initialization error:', error);
  }
}

// Enhanced script injection with better error handling
function injectScript() {
  try {
    const script = document.createElement('script');
    
    // Create a more robust script content
    const scriptContent = `
      (async function() {
        try {
          const initFn = ${initializeFSH.toString()};
          const loaderClass = ${FSHLoader.toString()};
          window.FSHLoader = loaderClass;
          await initFn();
        } catch (error) {
          console.error('FSH Injection Error:', error);
        }
      })();
    `;
    
    script.textContent = scriptContent;
    script.setAttribute('data-fsh-injected', 'true');
    
    // Add error handling for script injection
    script.onerror = function(error) {
      console.error('FSH: Script injection failed:', error);
    };
    
    document.body.appendChild(script);
    
    // Clean up script element after execution
    setTimeout(() => {
      if (script.parentElement) {
        script.remove();
      }
    }, 100);
    
  } catch (error) {
    console.error('FSH: Could not inject script:', error);
  }
}

// Wait for page readiness with multiple fallbacks
function waitForPageReady() {
  return new Promise(resolve => {
    // If page is already ready
    if (document.readyState === 'complete' || 
        (document.readyState === 'interactive' && document.body)) {
      resolve();
      return;
    }

    // Wait for DOMContentLoaded
    const onReady = () => {
      document.removeEventListener('DOMContentLoaded', onReady);
      window.removeEventListener('load', onReady);
      resolve();
    };

    document.addEventListener('DOMContentLoaded', onReady);
    window.addEventListener('load', onReady);

    // Fallback timeout
    setTimeout(resolve, 5000);
  });
}

// Main execution with staggered loading to reduce server load
(async function main() {
  try {
    // Add random delay to stagger user loads (0-3 seconds)
    const initialDelay = Math.random() * 3000;
    console.log(`FSH: Initial delay: ${Math.round(initialDelay)}ms`);
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    
    // Wait for page to be ready
    await waitForPageReady();
    
    // Additional small delay to ensure page stability
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Inject and execute
    injectScript();
    
  } catch (error) {
    console.error('FSH: Main execution error:', error);
  }
})();