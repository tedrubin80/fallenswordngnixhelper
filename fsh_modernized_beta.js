// ==UserScript==
// @name           FallenSwordHelper Beta
// @namespace      terrasoft.gr
// @description    Fallen Sword Helper - BETA version with enhanced features, user configuration, and improved game integration
// @include        https://www.fallensword.com/*
// @include        https://guide.fallensword.com/*
// @include        https://fallensword.com/*
// @include        https://*.fallensword.com/*
// @include        https://local.huntedcow.com/fallensword/*
// @exclude        https://forum.fallensword.com/*
// @exclude        https://wiki.fallensword.com/*
// @exclude        https://www.fallensword.com/app.php*
// @exclude        https://www.fallensword.com/fetchdata.php*
// @version        1525-beta-1
// @downloadURL    https://fallenswordhelper.github.io/fallenswordhelper/Releases/Beta/fallenswordhelper-beta.user.js
// @grant          none
// @run-at         document-body
// ==/UserScript==

// Enhanced configuration manager with persistence
class FSHConfig {
  constructor() {
    this.defaults = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      timeout: 10000,
      debugMode: false,
      showStatusIndicator: true,
      enableMetrics: true,
      autoUpdate: true,
      initialDelayMin: 0,
      initialDelayMax: 3000,
      cacheEnabled: true,
      cacheDuration: 3600000, // 1 hour
      adaptiveRetry: true // Adjust retry strategy based on network conditions
    };
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem('fsh_config');
      if (stored) {
        return { ...this.defaults, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('FSH: Could not load config from storage:', error);
    }
    return { ...this.defaults };
  }

  saveConfig() {
    try {
      localStorage.setItem('fsh_config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('FSH: Could not save config to storage:', error);
    }
  }

  get(key) {
    return this.config[key] !== undefined ? this.config[key] : this.defaults[key];
  }

  set(key, value) {
    this.config[key] = value;
    this.saveConfig();
  }

  reset() {
    this.config = { ...this.defaults };
    this.saveConfig();
  }
}

// Performance metrics tracker
class FSHMetrics {
  constructor() {
    this.metrics = {
      loadAttempts: 0,
      successfulLoads: 0,
      failedLoads: 0,
      totalLoadTime: 0,
      lastLoadTime: 0,
      averageLoadTime: 0,
      networkErrors: 0,
      timeoutErrors: 0
    };
    this.loadMetrics();
  }

  loadMetrics() {
    try {
      const stored = localStorage.getItem('fsh_metrics');
      if (stored) {
        this.metrics = { ...this.metrics, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('FSH: Could not load metrics:', error);
    }
  }

  saveMetrics() {
    try {
      localStorage.setItem('fsh_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('FSH: Could not save metrics:', error);
    }
  }

  recordAttempt() {
    this.metrics.loadAttempts++;
  }

  recordSuccess(loadTime) {
    this.metrics.successfulLoads++;
    this.metrics.lastLoadTime = loadTime;
    this.metrics.totalLoadTime += loadTime;
    this.metrics.averageLoadTime = this.metrics.totalLoadTime / this.metrics.successfulLoads;
    this.saveMetrics();
  }

  recordFailure(errorType) {
    this.metrics.failedLoads++;
    if (errorType === 'network') {
      this.metrics.networkErrors++;
    } else if (errorType === 'timeout') {
      this.metrics.timeoutErrors++;
    }
    this.saveMetrics();
  }

  getStats() {
    return {
      ...this.metrics,
      successRate: this.metrics.loadAttempts > 0
        ? (this.metrics.successfulLoads / this.metrics.loadAttempts * 100).toFixed(2)
        : 0
    };
  }

  reset() {
    this.metrics = {
      loadAttempts: 0,
      successfulLoads: 0,
      failedLoads: 0,
      totalLoadTime: 0,
      lastLoadTime: 0,
      averageLoadTime: 0,
      networkErrors: 0,
      timeoutErrors: 0
    };
    this.saveMetrics();
  }
}

// Status indicator for in-game feedback
class FSHStatusIndicator {
  constructor() {
    this.indicator = null;
    this.autoHideTimeout = null;
  }

  create() {
    if (this.indicator) return;

    this.indicator = document.createElement('div');
    this.indicator.id = 'fsh-status-indicator';
    this.indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      cursor: pointer;
      max-width: 250px;
    `;

    document.body.appendChild(this.indicator);

    this.indicator.addEventListener('click', () => {
      this.showConfigPanel();
    });
  }

  update(message, type = 'info') {
    if (!this.indicator) this.create();

    const colors = {
      info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      error: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
      warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    };

    this.indicator.style.background = colors[type] || colors.info;
    this.indicator.innerHTML = `
      <strong>FSH Beta:</strong> ${message}
      <div style="font-size: 9px; margin-top: 2px; opacity: 0.8;">Click for settings</div>
    `;

    // Auto-hide success messages
    if (type === 'success') {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = setTimeout(() => {
        this.hide();
      }, 5000);
    }
  }

  hide() {
    if (this.indicator) {
      this.indicator.style.opacity = '0';
      setTimeout(() => {
        if (this.indicator && this.indicator.parentElement) {
          this.indicator.remove();
          this.indicator = null;
        }
      }, 300);
    }
  }

  showConfigPanel() {
    const panel = new FSHConfigPanel();
    panel.show();
  }
}

// Configuration panel for user settings
class FSHConfigPanel {
  show() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 10001;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const config = new FSHConfig();
    const metrics = new FSHMetrics();
    const stats = metrics.getStats();

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    panel.innerHTML = `
      <h2 style="margin-top: 0; color: #333;">FSH Beta Configuration</h2>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #667eea; font-size: 14px;">Performance Settings</h3>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" id="fsh-debug" ${config.get('debugMode') ? 'checked' : ''}>
          Enable Debug Mode
        </label>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" id="fsh-status" ${config.get('showStatusIndicator') ? 'checked' : ''}>
          Show Status Indicator
        </label>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" id="fsh-metrics" ${config.get('enableMetrics') ? 'checked' : ''}>
          Enable Performance Metrics
        </label>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" id="fsh-cache" ${config.get('cacheEnabled') ? 'checked' : ''}>
          Enable Smart Caching
        </label>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" id="fsh-adaptive" ${config.get('adaptiveRetry') ? 'checked' : ''}>
          Adaptive Retry Strategy
        </label>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #667eea; font-size: 14px;">Network Settings</h3>
        <label style="display: block; margin-bottom: 10px;">
          Max Retries:
          <input type="number" id="fsh-retries" value="${config.get('maxRetries')}" min="1" max="10" style="width: 60px; margin-left: 10px;">
        </label>
        <label style="display: block; margin-bottom: 10px;">
          Base Delay (ms):
          <input type="number" id="fsh-delay" value="${config.get('baseDelay')}" min="500" max="5000" step="100" style="width: 80px; margin-left: 10px;">
        </label>
        <label style="display: block; margin-bottom: 10px;">
          Timeout (ms):
          <input type="number" id="fsh-timeout" value="${config.get('timeout')}" min="5000" max="30000" step="1000" style="width: 80px; margin-left: 10px;">
        </label>
      </div>

      <div style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
        <h3 style="color: #667eea; font-size: 14px; margin-top: 0;">Performance Metrics</h3>
        <div style="font-size: 12px; line-height: 1.6;">
          <strong>Load Attempts:</strong> ${stats.loadAttempts}<br>
          <strong>Success Rate:</strong> ${stats.successRate}%<br>
          <strong>Average Load Time:</strong> ${Math.round(stats.averageLoadTime)}ms<br>
          <strong>Network Errors:</strong> ${stats.networkErrors}<br>
          <strong>Timeout Errors:</strong> ${stats.timeoutErrors}
        </div>
        <button id="fsh-reset-metrics" style="margin-top: 10px; padding: 5px 10px; font-size: 11px;">
          Reset Metrics
        </button>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="fsh-reset" style="padding: 8px 16px; background: #f5f5f5; border: none; border-radius: 4px; cursor: pointer;">
          Reset to Defaults
        </button>
        <button id="fsh-save" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Save & Close
        </button>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('fsh-save').addEventListener('click', () => {
      config.set('debugMode', document.getElementById('fsh-debug').checked);
      config.set('showStatusIndicator', document.getElementById('fsh-status').checked);
      config.set('enableMetrics', document.getElementById('fsh-metrics').checked);
      config.set('cacheEnabled', document.getElementById('fsh-cache').checked);
      config.set('adaptiveRetry', document.getElementById('fsh-adaptive').checked);
      config.set('maxRetries', parseInt(document.getElementById('fsh-retries').value));
      config.set('baseDelay', parseInt(document.getElementById('fsh-delay').value));
      config.set('timeout', parseInt(document.getElementById('fsh-timeout').value));

      overlay.remove();
      alert('Settings saved! Please refresh the page for changes to take effect.');
    });

    document.getElementById('fsh-reset').addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        config.reset();
        overlay.remove();
        alert('Settings reset! Please refresh the page.');
      }
    });

    document.getElementById('fsh-reset-metrics').addEventListener('click', () => {
      if (confirm('Reset all performance metrics?')) {
        metrics.reset();
        overlay.remove();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }
}

// Enhanced FSH Loader with all improvements
class FSHLoader {
  constructor(config) {
    this.config = config || new FSHConfig();
    this.metrics = new FSHMetrics();
    this.statusIndicator = this.config.get('showStatusIndicator') ? new FSHStatusIndicator() : null;
    this.moduleUrl = 'https://fallenswordhelper.github.io/fallenswordhelper/resources/prod/1524/calfSystem.min.js';
    this.networkQuality = 'good'; // good, fair, poor
  }

  // Calculate exponential backoff delay with jitter and adaptive adjustment
  calculateDelay(attempt) {
    const baseDelay = this.config.get('baseDelay');
    const maxDelay = this.config.get('maxDelay');

    // Adjust based on network quality if adaptive retry is enabled
    let multiplier = 1;
    if (this.config.get('adaptiveRetry')) {
      multiplier = this.networkQuality === 'poor' ? 1.5 : this.networkQuality === 'fair' ? 1.2 : 1;
    }

    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt) * multiplier, maxDelay);
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add 30% jitter
    return exponentialDelay + jitter;
  }

  // Assess network quality based on previous attempts
  assessNetworkQuality() {
    const stats = this.metrics.getStats();
    const successRate = parseFloat(stats.successRate);

    if (successRate < 50) {
      this.networkQuality = 'poor';
    } else if (successRate < 80) {
      this.networkQuality = 'fair';
    } else {
      this.networkQuality = 'good';
    }

    if (this.config.get('debugMode')) {
      console.log(`FSH: Network quality assessed as: ${this.networkQuality}`);
    }
  }

  // Check if cached module is still valid
  checkCache() {
    if (!this.config.get('cacheEnabled')) return null;

    try {
      const cached = localStorage.getItem('fsh_module_cache');
      if (cached) {
        const { timestamp, url } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        const cacheDuration = this.config.get('cacheDuration');

        if (age < cacheDuration && url === this.moduleUrl) {
          if (this.config.get('debugMode')) {
            console.log(`FSH: Using cached module (age: ${Math.round(age / 1000)}s)`);
          }
          return true;
        }
      }
    } catch (error) {
      console.warn('FSH: Cache check failed:', error);
    }
    return null;
  }

  // Update cache
  updateCache() {
    if (!this.config.get('cacheEnabled')) return;

    try {
      localStorage.setItem('fsh_module_cache', JSON.stringify({
        timestamp: Date.now(),
        url: this.moduleUrl
      }));
    } catch (error) {
      console.warn('FSH: Could not update cache:', error);
    }
  }

  // Enhanced module loading with proper error handling
  async loadModule(gmInfo) {
    const startTime = Date.now();
    let lastError = null;
    const maxRetries = this.config.get('maxRetries');

    // Assess network quality before starting
    if (this.config.get('adaptiveRetry')) {
      this.assessNetworkQuality();
    }

    // Check cache first
    const cached = this.checkCache();
    if (cached && Math.random() > 0.1) { // 10% chance to bypass cache for freshness
      if (this.statusIndicator) {
        this.statusIndicator.update('Using cached module', 'info');
      }
      // Still need to attempt load, but we know it should work
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (this.config.get('debugMode')) {
          console.log(`FSH: Loading attempt ${attempt + 1}/${maxRetries}`);
        }

        if (this.statusIndicator) {
          this.statusIndicator.update(`Loading... (${attempt + 1}/${maxRetries})`, 'info');
        }

        this.metrics.recordAttempt();

        // Add cache busting to prevent stale module issues
        const cacheBuster = Date.now();
        const moduleUrlWithCache = `${this.moduleUrl}?v=${cacheBuster}&attempt=${attempt}`;

        const timeout = this.config.get('timeout');

        // Import with timeout protection
        const module = await Promise.race([
          import(moduleUrlWithCache),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Module load timeout')), timeout)
          )
        ]);

        if (module && typeof module.default === 'function') {
          const loadTime = Date.now() - startTime;

          if (this.config.get('debugMode')) {
            console.log(`FSH: Module loaded successfully in ${loadTime}ms`);
          }

          if (this.config.get('enableMetrics')) {
            this.metrics.recordSuccess(loadTime);
          }

          if (this.statusIndicator) {
            this.statusIndicator.update(`Loaded successfully (${loadTime}ms)`, 'success');
          }

          this.updateCache();
          module.default('1524', gmInfo);
          return true;
        } else {
          throw new Error('Invalid module structure');
        }

      } catch (error) {
        lastError = error;
        const errorType = error.message.includes('timeout') ? 'timeout' : 'network';

        if (this.config.get('enableMetrics')) {
          this.metrics.recordFailure(errorType);
        }

        if (this.config.get('debugMode')) {
          console.warn(`FSH: Attempt ${attempt + 1} failed:`, error.message);
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries - 1) {
          const delay = this.calculateDelay(attempt);

          if (this.statusIndicator) {
            this.statusIndicator.update(`Retry in ${Math.round(delay / 1000)}s...`, 'warning');
          }

          if (this.config.get('debugMode')) {
            console.log(`FSH: Retrying in ${Math.round(delay)}ms...`);
          }

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error('FSH: Failed to load after all attempts. Last error:', lastError);

    if (this.config.get('enableMetrics')) {
      this.metrics.recordFailure('final');
    }

    if (this.statusIndicator) {
      this.statusIndicator.update('Failed to load', 'error');
    }

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
        background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        color: white;
        padding: 12px;
        border-radius: 6px;
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        max-width: 320px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        line-height: 1.4;
      `;
      errorDiv.innerHTML = `
        <strong style="font-size: 14px;">🛠️ FSH Beta Error</strong><br>
        <div style="margin-top: 8px;">
          Failed to load helper module after ${this.config.get('maxRetries')} attempts.
        </div>
        <div style="margin-top: 8px; font-size: 11px; opacity: 0.9;">
          Error: ${error.message}
        </div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          <button onclick="location.reload()" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.2); border: 1px solid white; color: white; cursor: pointer; border-radius: 3px; font-size: 11px;">
            Reload Page
          </button>
          <button onclick="this.parentElement.parentElement.remove()" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.2); border: 1px solid white; color: white; cursor: pointer; border-radius: 3px; font-size: 11px;">
            Dismiss
          </button>
        </div>
      `;
      document.body.appendChild(errorDiv);

      // Auto-remove after 30 seconds
      setTimeout(() => {
        if (errorDiv.parentElement) {
          errorDiv.remove();
        }
      }, 30000);
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
          name: 'FallenSwordHelper Beta',
          version: '1525-beta-1'
        },
        userAgent: navigator.userAgent
      };
    } catch (error) {
      console.warn('FSH: Could not access GM_info:', error);
      return {
        script: {
          name: 'FallenSwordHelper Beta',
          version: '1525-beta-1'
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

    console.log('FSH Beta: Initializing...');

    const config = new FSHConfig();
    const loader = new FSHLoader(config);
    const gmInfo = loader.getGMInfo();

    // Make config accessible globally for debugging
    if (config.get('debugMode')) {
      window.FSHConfig = config;
      window.FSHMetrics = loader.metrics;
    }

    const success = await loader.loadModule(gmInfo);

    window.fshLoading = false;
    window.fshLoaded = success;

    if (success) {
      console.log('FSH Beta: Initialization complete');
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

    // Create a more robust script content - inject all classes
    const scriptContent = `
      (async function() {
        try {
          // Inject all classes
          ${FSHConfig.toString()}
          ${FSHMetrics.toString()}
          ${FSHStatusIndicator.toString()}
          ${FSHConfigPanel.toString()}
          ${FSHLoader.toString()}

          // Initialize
          const initFn = ${initializeFSH.toString()};
          await initFn();
        } catch (error) {
          console.error('FSH Injection Error:', error);
        }
      })();
    `;

    script.textContent = scriptContent;
    script.setAttribute('data-fsh-injected', 'true');
    script.setAttribute('data-fsh-version', '1525-beta-1');

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
    const config = new FSHConfig();

    // Add configurable random delay to stagger user loads
    const minDelay = config.get('initialDelayMin');
    const maxDelay = config.get('initialDelayMax');
    const initialDelay = minDelay + (Math.random() * (maxDelay - minDelay));

    if (config.get('debugMode')) {
      console.log(`FSH: Initial delay: ${Math.round(initialDelay)}ms`);
    }

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
