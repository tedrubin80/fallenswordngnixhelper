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
// @version        1525-beta-3
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

// Error reporter for collecting and submitting bug reports
class FSHErrorReporter {
  constructor(config, metrics) {
    this.config = config;
    this.metrics = metrics;
    this.errors = this.loadErrors();
    this.maxStoredErrors = 10;

    // Install HTTP interceptors to capture 500 errors
    this.installHttpInterceptors();
  }

  loadErrors() {
    try {
      const stored = localStorage.getItem('fsh_errors');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('FSH: Could not load error history:', error);
    }
    return [];
  }

  saveErrors() {
    try {
      // Keep only the most recent errors
      const toSave = this.errors.slice(-this.maxStoredErrors);
      localStorage.setItem('fsh_errors', JSON.stringify(toSave));
    } catch (error) {
      console.warn('FSH: Could not save error history:', error);
    }
  }

  recordError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context: context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorType: context.errorType || 'unknown'
    };

    this.errors.push(errorRecord);
    this.saveErrors();

    if (this.config.get('debugMode')) {
      console.log('FSH: Error recorded:', errorRecord);
    }
  }

  // Record HTTP error with full response details
  recordHttpError(response, requestUrl, method = 'GET', requestBody = null) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: `HTTP ${response.status} Error: ${response.statusText || 'Server Error'}`,
      errorType: 'http_500',
      url: window.location.href,
      userAgent: navigator.userAgent,
      httpDetails: {
        status: response.status,
        statusText: response.statusText,
        requestUrl: requestUrl,
        method: method,
        requestBody: requestBody,
        responseHeaders: {},
        responseBody: null
      }
    };

    // Capture response headers
    if (response.headers) {
      if (typeof response.headers.forEach === 'function') {
        // Fetch API Headers
        response.headers.forEach((value, key) => {
          errorRecord.httpDetails.responseHeaders[key] = value;
        });
      } else if (typeof response.getAllResponseHeaders === 'function') {
        // XMLHttpRequest
        const headersString = response.getAllResponseHeaders();
        headersString.split('\r\n').forEach(line => {
          const parts = line.split(': ');
          if (parts.length === 2) {
            errorRecord.httpDetails.responseHeaders[parts[0]] = parts[1];
          }
        });
      }
    }

    // Try to capture response body
    const captureBody = async () => {
      try {
        if (response.text && typeof response.text === 'function') {
          // For fetch Response, clone first to avoid consuming the body
          const clonedResponse = response.clone ? response.clone() : response;
          const text = await clonedResponse.text();
          errorRecord.httpDetails.responseBody = text.substring(0, 10000); // Limit to 10KB
        } else if (response.responseText) {
          // For XMLHttpRequest
          errorRecord.httpDetails.responseBody = response.responseText.substring(0, 10000);
        }
      } catch (error) {
        errorRecord.httpDetails.responseBody = `[Could not capture response body: ${error.message}]`;
      } finally {
        this.errors.push(errorRecord);
        this.saveErrors();

        if (this.config.get('debugMode')) {
          console.error('FSH: HTTP 500 Error recorded:', errorRecord);
        }

        // Show notification for HTTP 500 errors
        this.showHttp500Notification(errorRecord);
      }
    };

    captureBody();
  }

  // Show notification when HTTP 500 error is captured
  showHttp500Notification(errorRecord) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001;
      max-width: 400px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      cursor: pointer;
      transition: transform 0.2s;
    `;

    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; font-size: 14px;">⚠️ Server Error Detected</div>
      <div style="opacity: 0.9; margin-bottom: 10px;">
        Nginx 500 error captured from:<br/>
        <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px; font-size: 11px; word-break: break-all;">
          ${errorRecord.httpDetails.requestUrl}
        </code>
      </div>
      <div style="font-size: 11px; opacity: 0.8; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 8px; margin-top: 8px;">
        Click to view details and report to developers
      </div>
    `;

    notification.addEventListener('mouseenter', () => {
      notification.style.transform = 'scale(1.02)';
    });

    notification.addEventListener('mouseleave', () => {
      notification.style.transform = 'scale(1)';
    });

    notification.addEventListener('click', () => {
      notification.remove();
      this.showReportDialog(new Error(errorRecord.message), { httpError: errorRecord });
    });

    document.body.appendChild(notification);

    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(450px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, 15000);
  }

  // Install HTTP interceptors to capture 500 errors
  installHttpInterceptors() {
    const self = this;

    // Intercept fetch API
    if (typeof window.fetch !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);

        // Check for 500 status code
        if (response.status >= 500 && response.status < 600) {
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;
          const method = args[1]?.method || 'GET';
          const body = args[1]?.body || null;

          self.recordHttpError(response, url, method, body);
        }

        return response;
      };
    }

    // Intercept XMLHttpRequest
    if (typeof XMLHttpRequest !== 'undefined') {
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._fsh_method = method;
        this._fsh_url = url;
        return originalOpen.apply(this, [method, url, ...rest]);
      };

      XMLHttpRequest.prototype.send = function(body) {
        this._fsh_requestBody = body;

        this.addEventListener('load', function() {
          if (this.status >= 500 && this.status < 600) {
            self.recordHttpError(this, this._fsh_url, this._fsh_method, this._fsh_requestBody);
          }
        });

        return originalSend.apply(this, arguments);
      };
    }

    if (this.config.get('debugMode')) {
      console.log('FSH: HTTP interceptors installed for 500 error detection');
    }
  }

  getSystemInfo() {
    const stats = this.metrics.getStats();
    return {
      version: '1525-beta-3',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      config: {
        maxRetries: this.config.get('maxRetries'),
        baseDelay: this.config.get('baseDelay'),
        timeout: this.config.get('timeout'),
        debugMode: this.config.get('debugMode'),
        cacheEnabled: this.config.get('cacheEnabled'),
        adaptiveRetry: this.config.get('adaptiveRetry')
      },
      metrics: stats,
      recentErrors: this.errors.slice(-5) // Last 5 errors
    };
  }

  generateReport(additionalInfo = '') {
    const systemInfo = this.getSystemInfo();

    let report = `# FSH Beta Error Report\n\n`;
    report += `**Generated:** ${systemInfo.timestamp}\n`;
    report += `**Version:** ${systemInfo.version} (with Nginx 500 error capture)\n\n`;

    report += `## System Information\n`;
    report += `- **Browser:** ${systemInfo.userAgent}\n`;
    report += `- **Language:** ${systemInfo.language}\n`;
    report += `- **Screen:** ${systemInfo.screenResolution}\n`;
    report += `- **Viewport:** ${systemInfo.viewport}\n`;
    report += `- **Online:** ${systemInfo.onLine}\n`;
    report += `- **URL:** ${systemInfo.url}\n\n`;

    report += `## Configuration\n`;
    report += `- **Max Retries:** ${systemInfo.config.maxRetries}\n`;
    report += `- **Base Delay:** ${systemInfo.config.baseDelay}ms\n`;
    report += `- **Timeout:** ${systemInfo.config.timeout}ms\n`;
    report += `- **Debug Mode:** ${systemInfo.config.debugMode}\n`;
    report += `- **Cache Enabled:** ${systemInfo.config.cacheEnabled}\n`;
    report += `- **Adaptive Retry:** ${systemInfo.config.adaptiveRetry}\n\n`;

    report += `## Performance Metrics\n`;
    report += `- **Load Attempts:** ${systemInfo.metrics.loadAttempts}\n`;
    report += `- **Success Rate:** ${systemInfo.metrics.successRate}%\n`;
    report += `- **Average Load Time:** ${Math.round(systemInfo.metrics.averageLoadTime)}ms\n`;
    report += `- **Network Errors:** ${systemInfo.metrics.networkErrors}\n`;
    report += `- **Timeout Errors:** ${systemInfo.metrics.timeoutErrors}\n\n`;

    // Separate HTTP 500 errors from other errors
    const http500Errors = systemInfo.recentErrors.filter(err => err.errorType === 'http_500');
    const otherErrors = systemInfo.recentErrors.filter(err => err.errorType !== 'http_500');

    // Show HTTP 500 errors prominently
    if (http500Errors.length > 0) {
      report += `## 🚨 Nginx 500 Errors (Server Errors)\n\n`;
      report += `**${http500Errors.length} server error(s) detected**\n\n`;
      http500Errors.forEach((err, index) => {
        report += `\n### HTTP 500 Error ${index + 1}\n`;
        report += `- **Time:** ${err.timestamp}\n`;
        report += `- **Status:** ${err.httpDetails.status} ${err.httpDetails.statusText}\n`;
        report += `- **Request URL:** ${err.httpDetails.requestUrl}\n`;
        report += `- **Method:** ${err.httpDetails.method}\n`;
        report += `- **Page URL:** ${err.url}\n`;

        if (err.httpDetails.requestBody) {
          report += `- **Request Body:** ${err.httpDetails.requestBody}\n`;
        }

        if (err.httpDetails.responseHeaders && Object.keys(err.httpDetails.responseHeaders).length > 0) {
          report += `\n**Response Headers:**\n\`\`\`\n`;
          Object.entries(err.httpDetails.responseHeaders).forEach(([key, value]) => {
            report += `${key}: ${value}\n`;
          });
          report += `\`\`\`\n`;
        }

        if (err.httpDetails.responseBody) {
          report += `\n**Response Body (First 10KB):**\n\`\`\`\n${err.httpDetails.responseBody}\n\`\`\`\n`;
        }
      });
      report += `\n`;
    }

    // Show other errors
    if (otherErrors.length > 0) {
      report += `## Other Recent Errors\n`;
      otherErrors.forEach((err, index) => {
        report += `\n### Error ${index + 1}\n`;
        report += `- **Time:** ${err.timestamp}\n`;
        report += `- **Type:** ${err.errorType || 'unknown'}\n`;
        report += `- **Message:** ${err.message}\n`;
        if (err.context && Object.keys(err.context).length > 0) {
          report += `- **Context:** ${JSON.stringify(err.context)}\n`;
        }
        if (err.stack) {
          report += `\n**Stack Trace:**\n\`\`\`\n${err.stack}\n\`\`\`\n`;
        }
      });
      report += `\n`;
    }

    if (additionalInfo) {
      report += `## Additional Information\n${additionalInfo}\n\n`;
    }

    report += `---\n`;
    report += `*This report was automatically generated by FSH Beta Error Reporter*`;

    return report;
  }

  copyToClipboard(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (error) {
      console.error('FSH: Could not copy to clipboard:', error);
      return false;
    }
  }

  showReportDialog(error = null, context = {}) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10002;
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      padding: 10px;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      width: 500px;
      max-width: 90vw;
      max-height: calc(100vh - 20px);
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin-top: 50px;
    `;

    if (error) {
      this.recordError(error, context);
    }

    dialog.innerHTML = `
      <h2 style="margin-top: 0; color: #eb3349;">Report an Issue</h2>
      <p style="color: #666; font-size: 13px; line-height: 1.5;">
        Help us improve FSH Beta by reporting this issue. The report includes system information,
        configuration, and recent errors. No personal data is collected.
      </p>

      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold; font-size: 13px;">
          Describe what happened (optional):
        </label>
        <textarea id="fsh-error-description" placeholder="What were you doing when the error occurred?"
          style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 12px; resize: vertical;"></textarea>
      </div>

      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold; font-size: 13px;">
          Expected behavior (optional):
        </label>
        <textarea id="fsh-error-expected" placeholder="What did you expect to happen?"
          style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 12px; resize: vertical;"></textarea>
      </div>

      <div id="fsh-report-status" style="margin: 10px 0; padding: 8px; border-radius: 4px; display: none; font-size: 12px;"></div>

      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button id="fsh-report-cancel" style="padding: 8px 16px; background: #f5f5f5; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
          Cancel
        </button>
        <button id="fsh-report-copy" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
          📋 Copy Report
        </button>
        <button id="fsh-report-github" style="padding: 8px 16px; background: #24292e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
          🐙 Open GitHub Issue
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const showStatus = (message, type = 'info') => {
      const statusDiv = document.getElementById('fsh-report-status');
      const colors = {
        success: '#d4edda',
        error: '#f8d7da',
        info: '#d1ecf1'
      };
      statusDiv.style.display = 'block';
      statusDiv.style.background = colors[type] || colors.info;
      statusDiv.style.color = '#333';
      statusDiv.textContent = message;
    };

    // Cancel button
    document.getElementById('fsh-report-cancel').addEventListener('click', () => {
      overlay.remove();
    });

    // Copy report button
    document.getElementById('fsh-report-copy').addEventListener('click', () => {
      const description = document.getElementById('fsh-error-description').value;
      const expected = document.getElementById('fsh-error-expected').value;

      let additionalInfo = '';
      if (description) additionalInfo += `**What happened:** ${description}\n\n`;
      if (expected) additionalInfo += `**Expected behavior:** ${expected}\n\n`;

      const report = this.generateReport(additionalInfo);

      if (this.copyToClipboard(report)) {
        showStatus('✓ Report copied to clipboard!', 'success');
        setTimeout(() => overlay.remove(), 2000);
      } else {
        showStatus('✗ Could not copy to clipboard. Please select and copy manually.', 'error');
      }
    });

    // GitHub issue button
    document.getElementById('fsh-report-github').addEventListener('click', () => {
      const description = document.getElementById('fsh-error-description').value;
      const expected = document.getElementById('fsh-error-expected').value;

      let additionalInfo = '';
      if (description) additionalInfo += `**What happened:** ${description}\n\n`;
      if (expected) additionalInfo += `**Expected behavior:** ${expected}\n\n`;

      const report = this.generateReport(additionalInfo);

      // Create GitHub issue URL
      const title = error ? `Bug: ${error.message}` : 'Bug Report from FSH Beta';
      const body = encodeURIComponent(report);
      const url = `https://github.com/tedrubin80/fallenswordngnixhelper/issues/new?title=${encodeURIComponent(title)}&body=${body}`;

      window.open(url, '_blank');
      showStatus('✓ Opening GitHub issue page...', 'success');
      setTimeout(() => overlay.remove(), 1500);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  clearHistory() {
    this.errors = [];
    this.saveErrors();
  }
}

// Status indicator for in-game feedback
class FSHStatusIndicator {
  constructor() {
    this.indicator = null;
    this.autoHideTimeout = null;
    this.menu = null;
    this.menuOpen = false;
    this.overlaysVisible = true;
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
      position: relative;
    `;

    // Add green indicator dot to show menu availability
    const menuIndicator = document.createElement('div');
    menuIndicator.style.cssText = `
      position: absolute;
      top: -3px;
      right: -3px;
      width: 10px;
      height: 10px;
      background: #44ff44;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 5px rgba(68, 255, 68, 0.5);
      animation: pulse 2s infinite;
    `;
    this.indicator.appendChild(menuIndicator);

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.indicator);

    this.indicator.addEventListener('click', () => {
      this.toggleMenu();
    });

    this.createMenu();
  }

  createMenu() {
    this.menu = document.createElement('div');
    this.menu.id = 'fsh-helper-menu';
    this.menu.style.cssText = `
      position: fixed;
      top: 45px;
      right: 10px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      z-index: 10001;
      min-width: 220px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      display: none;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow: hidden;
    `;

    const menuItems = [
      { label: '⚙️ Configuration', action: () => this.showConfigPanel() },
      { label: '🛡️ Toggle Buff Panel', action: () => this.togglePanel('fsh-buff-panel') },
      { label: '📊 Toggle Resource Panel', action: () => this.togglePanel('fsh-resource-panel') },
      { label: '⚔️ Toggle Quest Panel', action: () => this.togglePanel('fsh-quest-panel') },
      { label: '🏰 Toggle Guild Quick Actions', action: () => this.togglePanel('fsh-quick-actions') },
      { label: '⚔️ Toggle GvG Tracker', action: () => this.togglePanel('fsh-gvg-panel') },
      { label: '🗼 Toggle Scout Tower Button', action: () => this.togglePanel('fsh-scout-tower-btn') },
      { separator: true },
      { label: `👁️ ${this.overlaysVisible ? 'Hide' : 'Show'} All Overlays`, action: () => this.toggleAllOverlays(), id: 'toggle-overlays' },
      { separator: true },
      { label: '🐛 Report Issue', action: () => this.reportIssue() }
    ];

    menuItems.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.style.cssText = `
          height: 1px;
          background: #e0e0e0;
          margin: 5px 0;
        `;
        this.menu.appendChild(separator);
        return;
      }

      const menuItem = document.createElement('div');
      if (item.id) menuItem.id = item.id;
      menuItem.style.cssText = `
        padding: 10px 15px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 12px;
        color: #333;
      `;
      menuItem.textContent = item.label;

      menuItem.addEventListener('mouseover', () => {
        menuItem.style.background = '#f5f5f5';
      });
      menuItem.addEventListener('mouseout', () => {
        menuItem.style.background = 'transparent';
      });
      menuItem.addEventListener('click', () => {
        item.action();
        this.closeMenu();
      });

      this.menu.appendChild(menuItem);
    });

    document.body.appendChild(this.menu);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.menuOpen && !this.menu.contains(e.target) && !this.indicator.contains(e.target)) {
        this.closeMenu();
      }
    });
  }

  toggleMenu() {
    if (this.menuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    if (!this.menu) return;
    this.menu.style.display = 'block';
    this.menuOpen = true;
  }

  closeMenu() {
    if (!this.menu) return;
    this.menu.style.display = 'none';
    this.menuOpen = false;
  }

  togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    } else {
      console.warn(`FSH: Panel ${panelId} not found. It may not be initialized yet.`);
      alert(`Panel not found. This feature may not be available on this page.`);
    }
  }

  toggleAllOverlays() {
    // Toggle all FSH panels
    const panelIds = ['fsh-buff-panel', 'fsh-resource-panel', 'fsh-quest-panel', 'fsh-quick-actions', 'fsh-gvg-panel', 'fsh-scout-tower-btn'];

    this.overlaysVisible = !this.overlaysVisible;

    panelIds.forEach(panelId => {
      const panel = document.getElementById(panelId);
      if (panel) {
        panel.style.display = this.overlaysVisible ? 'block' : 'none';
      }
    });

    // Update menu item text
    const toggleButton = document.getElementById('toggle-overlays');
    if (toggleButton) {
      toggleButton.textContent = `👁️ ${this.overlaysVisible ? 'Hide' : 'Show'} All Overlays`;
    }

    // Show feedback
    this.update(
      `Overlays ${this.overlaysVisible ? 'shown' : 'hidden'}`,
      'success'
    );
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
      <div style="font-size: 9px; margin-top: 2px; opacity: 0.8;">Click for Helper Menu</div>
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

  reportIssue() {
    const config = new FSHConfig();
    const metrics = new FSHMetrics();
    const errorReporter = new FSHErrorReporter(config, metrics);
    errorReporter.showReportDialog();
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
      background: rgba(0,0,0,0.5);
      z-index: 10001;
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      padding: 10px;
    `;

    const config = new FSHConfig();
    const metrics = new FSHMetrics();
    const stats = metrics.getStats();

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      width: 500px;
      max-width: 90vw;
      max-height: calc(100vh - 20px);
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin-top: 50px;
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

      <div style="margin-bottom: 20px; padding: 10px; background: #fff3cd; border-radius: 4px; border: 1px solid #ffc107;">
        <h3 style="color: #856404; font-size: 14px; margin-top: 0;">Error Reporting</h3>
        <div style="font-size: 12px; line-height: 1.6; color: #856404; margin-bottom: 10px;">
          Encountered an issue? Help us improve FSH Beta by reporting errors.
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="fsh-report-error" style="padding: 6px 12px; font-size: 11px; background: #eb3349; color: white; border: none; border-radius: 4px; cursor: pointer;">
            🐛 Report Issue
          </button>
          <button id="fsh-clear-errors" style="padding: 6px 12px; font-size: 11px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Clear Error History
          </button>
        </div>
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

    // Error reporting buttons
    document.getElementById('fsh-report-error').addEventListener('click', () => {
      const errorReporter = new FSHErrorReporter(config, metrics);
      overlay.remove();
      errorReporter.showReportDialog();
    });

    document.getElementById('fsh-clear-errors').addEventListener('click', () => {
      if (confirm('Clear all stored error history?')) {
        const errorReporter = new FSHErrorReporter(config, metrics);
        errorReporter.clearHistory();
        alert('Error history cleared.');
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
    this.errorReporter = new FSHErrorReporter(this.config, this.metrics);
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

    // Record the error for reporting
    this.errorReporter.recordError(lastError, {
      attemptsMade: maxRetries,
      totalTime: Date.now() - startTime,
      moduleUrl: this.moduleUrl,
      networkQuality: this.networkQuality
    });

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
        <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
          <button id="fsh-error-report-btn" style="flex: 1 1 100%; padding: 6px; background: rgba(255,255,255,0.3); border: 1px solid white; color: white; cursor: pointer; border-radius: 3px; font-size: 11px; font-weight: bold;">
            🐛 Report This Error
          </button>
          <button onclick="location.reload()" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.2); border: 1px solid white; color: white; cursor: pointer; border-radius: 3px; font-size: 11px;">
            Reload Page
          </button>
          <button onclick="this.parentElement.parentElement.remove()" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.2); border: 1px solid white; color: white; cursor: pointer; border-radius: 3px; font-size: 11px;">
            Dismiss
          </button>
        </div>
      `;
      document.body.appendChild(errorDiv);

      // Add event listener for report button
      const reportBtn = document.getElementById('fsh-error-report-btn');
      if (reportBtn) {
        reportBtn.addEventListener('click', () => {
          errorDiv.remove();
          this.errorReporter.showReportDialog(error, {
            source: 'module_load_failure',
            attemptsMade: this.config.get('maxRetries')
          });
        });
      }

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
          version: '1525-beta-3'
        },
        userAgent: navigator.userAgent
      };
    } catch (error) {
      console.warn('FSH: Could not access GM_info:', error);
      return {
        script: {
          name: 'FallenSwordHelper Beta',
          version: '1525-beta-3'
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
          ${FSHErrorReporter.toString()}
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
    script.setAttribute('data-fsh-version', '1525-beta-3');

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
