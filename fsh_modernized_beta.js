// ==UserScript==
// @name           FallenSwordHelper Integrated
// @namespace      terrasoft.gr
// @description    Fallen Sword Helper - Integrated version with working GvG and Scout Tower features
// @include        https://www.fallensword.com/*
// @include        https://guide.fallensword.com/*
// @include        https://fallensword.com/*
// @include        https://*.fallensword.com/*
// @include        https://local.huntedcow.com/fallensword/*
// @exclude        https://forum.fallensword.com/*
// @exclude        https://wiki.fallensword.com/*
// @exclude        https://www.fallensword.com/app.php*
// @exclude        https://www.fallensword.com/fetchdata.php*
// @version        1525-integrated
// @downloadURL    https://fallenswordhelper.github.io/fallenswordhelper/Releases/Current/fallenswordhelper.user.js
// @grant          none
// @run-at         document-body
// ==/UserScript==

// Configuration manager with persistence
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
      cacheDuration: 3600000,
      adaptiveRetry: true,
      // Game enhancement toggles
      enableBuffManager: true,
      enableGuildHelper: true,
      enableQuestTracker: true,
      enableGvGTracker: true
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
}

// Data Parser - Extracts and processes game data
class FSHDataParser {
  constructor() {
    this.gameData = null;
    this.player = null;
    this.realm = null;
    this.updateInterval = 5000;
  }

  initialize() {
    this.parseGameData();
    setInterval(() => this.parseGameData(), this.updateInterval);
  }

  parseGameData() {
    try {
      // Parse initialGameData from global scope
      if (typeof initialGameData !== 'undefined') {
        this.gameData = initialGameData;
        this.player = this.gameData.player || {};
        this.realm = this.gameData.realm || {};
      }

      // Parse statbar data from DOM
      this.parseStatbar();

      // Trigger data update event
      this.triggerDataUpdate();
    } catch (error) {
      console.error('FSH: Error parsing game data:', error);
    }
  }

  parseStatbar() {
    if (!this.player) this.player = {};

    // Parse stamina
    const staminaText = document.querySelector('#statbar-stamina')?.textContent;
    if (staminaText) {
      const match = staminaText.match(/(\d+,?\d*)/);
      if (match) {
        this.player.currentStamina = parseInt(match[1].replace(/,/g, ''));
      }
    }

    // Parse gold
    const goldText = document.querySelector('#statbar-gold')?.textContent;
    if (goldText) {
      const match = goldText.match(/(\d+,?\d*)/);
      if (match) {
        this.player.currentGold = parseInt(match[1].replace(/,/g, ''));
      }
    }
  }

  triggerDataUpdate() {
    const event = new CustomEvent('fsh:dataUpdate', {
      detail: {
        player: this.player,
        realm: this.realm,
        gameData: this.gameData
      }
    });
    document.dispatchEvent(event);
  }

  getPlayer() {
    return this.player;
  }

  getRealm() {
    return this.realm;
  }
}

// Guild Helper - GvG, Guild Store, Scout Tower
class FSHGuildHelper {
  constructor(dataParser) {
    this.dataParser = dataParser;
    this.guildMembers = [];
    this.gvgData = {
      conflicts: [],
      territories: [],
      points: 0,
      rank: 0
    };
    this.conflictHistory = [];
  }

  initialize() {
    console.log('FSH: Initializing Guild Helper');
    this.loadConflictHistory();
    this.parseGuildData();
    this.createGvGPanel();
    
    // Periodic updates
    setInterval(() => this.parseGuildData(), 10000);
  }

  loadConflictHistory() {
    try {
      const stored = localStorage.getItem('fsh_conflict_history');
      if (stored) {
        this.conflictHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('FSH: Could not load conflict history:', error);
    }
  }

  saveConflictHistory() {
    try {
      if (this.conflictHistory.length > 100) {
        this.conflictHistory = this.conflictHistory.slice(-100);
      }
      localStorage.setItem('fsh_conflict_history', JSON.stringify(this.conflictHistory));
    } catch (error) {
      console.error('FSH: Could not save conflict history:', error);
    }
  }

  parseGuildData() {
    // Parse guild members from minibox
    const memberElements = document.querySelectorAll('#minibox-guild-members-list .player, .guild-member-link');
    this.guildMembers = Array.from(memberElements).map(element => {
      const name = element.textContent.trim();
      return { name, element };
    });

    // Parse GvG conflicts if on relevant page
    if (window.location.href.includes('cmd=guild') || window.location.href.includes('conflict')) {
      this.parseGvGConflicts();
    }
  }

  parseGvGConflicts() {
    const conflictElements = document.querySelectorAll('.conflict-item, .gvg-conflict, [class*="conflict"]');
    
    this.gvgData.conflicts = Array.from(conflictElements).map(element => {
      const opponentName = element.querySelector('.opponent-name, .guild-name')?.textContent?.trim();
      const pointsText = element.querySelector('.points, .score')?.textContent;
      const statusText = element.querySelector('.status')?.textContent;

      return {
        opponent: opponentName || 'Unknown',
        points: this.parsePoints(pointsText),
        status: statusText || 'Active',
        timestamp: Date.now()
      };
    }).filter(conflict => conflict.opponent !== 'Unknown');

    // Add to history
    this.gvgData.conflicts.forEach(conflict => {
      if (!this.conflictHistory.find(c => 
        c.opponent === conflict.opponent && 
        Math.abs(c.timestamp - conflict.timestamp) < 60000 // Within 1 minute
      )) {
        this.conflictHistory.push({...conflict});
        this.saveConflictHistory();
      }
    });
  }

  parsePoints(text) {
    if (!text) return 0;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  createGvGPanel() {
    // Remove existing panel if present
    const existingPanel = document.getElementById('fsh-gvg-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    console.log('FSH: Creating GvG tracking panel');
    const panel = document.createElement('div');
    panel.id = 'fsh-gvg-panel';
    panel.style.cssText = `
      position: fixed;
      top: 300px;
      left: 20px;
      background: rgba(20, 20, 20, 0.95);
      color: white;
      padding: 15px;
      border-radius: 8px;
      border: 2px solid #c41e3a;
      z-index: 9998;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      min-width: 280px;
      max-width: 350px;
      max-height: 400px;
      overflow-y: auto;
      display: block;
    `;

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; color: #ff6b6b;">
        ⚔️ GvG Tracker
      </div>
      <div id="fsh-gvg-stats" style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
        <div style="font-size: 10px; opacity: 0.7;">Loading conflict data...</div>
      </div>
      <div style="margin-top: 10px;">
        <button id="fsh-scout-tower-btn" style="width: 100%; margin-bottom: 5px; padding: 8px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
          🗼 Scout Tower
        </button>
        <button id="fsh-view-conflicts-btn" style="width: 100%; margin-bottom: 5px; padding: 8px; background: #c41e3a; color: white; border: none; border-radius: 4px; cursor: pointer;">
          View All Conflicts
        </button>
        <button id="fsh-guild-advisor-btn" style="width: 100%; padding: 8px; background: #764ba2; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Guild Advisor
        </button>
      </div>
      <div id="fsh-conflict-history" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">Recent Conflicts</div>
        <div id="fsh-conflict-list" style="max-height: 200px; overflow-y: auto;"></div>
      </div>
    `;

    document.body.appendChild(panel);

    // Add event listeners for buttons
    document.getElementById('fsh-scout-tower-btn')?.addEventListener('click', () => {
      console.log('FSH: Navigating to Scout Tower');
      window.location.href = 'index.php?cmd=guild&subcmd=scouttower';
    });

    document.getElementById('fsh-view-conflicts-btn')?.addEventListener('click', () => {
      window.location.href = 'index.php?cmd=guild&subcmd=conflicts';
    });

    document.getElementById('fsh-guild-advisor-btn')?.addEventListener('click', () => {
      window.location.href = 'index.php?cmd=guild&subcmd=advisor';
    });

    console.log('FSH: GvG panel created with buttons');

    // Start updating the panel
    setInterval(() => this.updateGvGPanel(), 5000);
    this.updateGvGPanel();
  }

  updateGvGPanel() {
    const statsDiv = document.getElementById('fsh-gvg-stats');
    const listDiv = document.getElementById('fsh-conflict-list');

    if (!statsDiv || !listDiv) return;

    // Update stats
    if (this.gvgData.conflicts.length > 0) {
      const totalPoints = this.gvgData.conflicts.reduce((sum, c) => sum + c.points, 0);
      statsDiv.innerHTML = `
        <div style="margin-bottom: 5px;"><strong>Active Conflicts:</strong> ${this.gvgData.conflicts.length}</div>
        <div><strong>Total Points:</strong> ${totalPoints}</div>
      `;
    } else {
      statsDiv.innerHTML = `<div style="font-size: 10px; opacity: 0.7;">No active conflicts detected</div>`;
    }

    // Update history list
    const recentConflicts = this.conflictHistory.slice(-10).reverse();
    if (recentConflicts.length > 0) {
      listDiv.innerHTML = recentConflicts.map(conflict => {
        const timeAgo = this.getTimeAgo(conflict.timestamp);
        const statusColor = conflict.status === 'Won' ? '#44ff44' : 
                           conflict.status === 'Lost' ? '#ff4444' : '#ffaa00';
        
        return `
          <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; border-left: 3px solid #c41e3a;">
            <div style="font-weight: bold; color: #ff6b6b;">${conflict.opponent}</div>
            <div style="font-size: 10px; margin-top: 3px;">
              <span style="color: #ffd700;">Points: ${conflict.points}</span> •
              <span style="opacity: 0.7;">${timeAgo}</span>
            </div>
            <div style="font-size: 10px; margin-top: 2px; color: ${statusColor};">
              ${conflict.status}
            </div>
          </div>
        `;
      }).join('');
    } else {
      listDiv.innerHTML = `<div style="font-size: 10px; opacity: 0.6;">No recent conflicts</div>`;
    }
  }

  getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

// Buff Management System
class FSHBuffManager {
  constructor(dataParser) {
    this.dataParser = dataParser;
    this.buffs = [];
  }

  initialize() {
    this.createBuffPanel();
    this.parseBuffs();
    document.addEventListener('fsh:dataUpdate', () => this.parseBuffs());
  }

  parseBuffs() {
    const player = this.dataParser.getPlayer();
    if (player && player.buffs) {
      this.buffs = player.buffs;
    }
  }

  createBuffPanel() {
    const panel = document.createElement('div');
    panel.id = 'fsh-buff-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9998;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      min-width: 200px;
      display: block;
    `;

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 13px;">Active Buffs</div>
      <div id="fsh-buff-list">No buffs active</div>
    `;

    document.body.appendChild(panel);
  }
}

// Quest Tracker Panel
class FSHQuestTracker {
  constructor(dataParser) {
    this.dataParser = dataParser;
  }

  initialize() {
    this.createQuestPanel();
  }

  createQuestPanel() {
    const panel = document.createElement('div');
    panel.id = 'fsh-quest-panel';
    panel.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9998;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      min-width: 200px;
      display: block;
    `;

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 13px;">📜 Quest Tracker</div>
      <div>Quest tracking coming soon...</div>
    `;

    document.body.appendChild(panel);
  }
}

// Status Indicator with Menu
class FSHStatusIndicator {
  constructor(controller) {
    this.controller = controller;
    this.indicator = null;
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
      cursor: pointer;
      max-width: 250px;
    `;

    // Add green indicator dot
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
    this.update('FSH Integrated Loaded', 'success');
  }

  createMenu() {
    // Remove existing menu if present
    const existingMenu = document.getElementById('fsh-helper-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    console.log('FSH: Creating enhanced menu');
    
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
      min-width: 250px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      display: none;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow: hidden;
      max-height: 80vh;
      overflow-y: auto;
    `;

    const menuItems = [
      { label: '⚙️ Configuration', action: () => this.showConfigPanel() },
      { separator: true },
      { label: '🛡️ Toggle Buff Panel', action: () => this.togglePanel('fsh-buff-panel') },
      { label: '⚔️ Toggle GvG Tracker', action: () => this.toggleGvGPanel() },
      { label: '📜 Toggle Quest Panel', action: () => this.togglePanel('fsh-quest-panel') },
      { separator: true },
      { label: '🗼 Scout Tower', action: () => this.goToScoutTower() },
      { label: '🛒 Guild Store', action: () => this.goToGuildStore() },
      { label: '⚔️ Guild Conflicts', action: () => this.goToGuildConflicts() },
      { label: '👥 Guild Advisor', action: () => this.goToGuildAdvisor() },
      { separator: true },
      { label: '👁️ Toggle All Overlays', action: () => this.toggleAllOverlays() },
      { separator: true },
      { label: '🔧 Debug Mode', action: () => this.toggleDebugMode() },
      { label: '📊 View Metrics', action: () => this.viewMetrics() },
      { label: '🐛 Report Issue', action: () => this.reportIssue() }
    ];

    menuItems.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: #e0e0e0; margin: 5px 0;';
        this.menu.appendChild(separator);
        return;
      }

      const menuItem = document.createElement('div');
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
        console.log('FSH: Menu action:', item.label);
        item.action();
        this.closeMenu();
      });

      this.menu.appendChild(menuItem);
    });

    document.body.appendChild(this.menu);
    console.log('FSH: Menu created successfully');

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.menuOpen && !this.menu.contains(e.target) && !this.indicator.contains(e.target)) {
        this.closeMenu();
      }
    });
  }

  toggleGvGPanel() {
    console.log('FSH: Toggling GvG panel');
    const panel = document.getElementById('fsh-gvg-panel');
    if (panel) {
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        console.log('FSH: GvG panel shown');
      } else {
        panel.style.display = 'none';
        console.log('FSH: GvG panel hidden');
      }
    } else {
      console.log('FSH: GvG panel not found, creating it');
      if (this.controller && this.controller.modules.guildHelper) {
        this.controller.modules.guildHelper.createGvGPanel();
      }
    }
  }

  goToScoutTower() {
    console.log('FSH: Navigating to Scout Tower');
    window.location.href = 'index.php?cmd=guild&subcmd=scouttower';
  }

  goToGuildStore() {
    console.log('FSH: Navigating to Guild Store');
    window.location.href = 'index.php?cmd=guild&subcmd=store';
  }

  goToGuildConflicts() {
    console.log('FSH: Navigating to Guild Conflicts');
    window.location.href = 'index.php?cmd=guild&subcmd=conflicts';
  }

  goToGuildAdvisor() {
    console.log('FSH: Navigating to Guild Advisor');
    window.location.href = 'index.php?cmd=guild&subcmd=advisor';
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
    console.log('FSH: Menu opened');
  }

  closeMenu() {
    if (!this.menu) return;
    this.menu.style.display = 'none';
    this.menuOpen = false;
  }

  togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      console.log(`FSH: Toggled panel ${panelId}`);
    } else {
      console.warn(`FSH: Panel ${panelId} not found`);
    }
  }

  toggleAllOverlays() {
    const panelIds = ['fsh-buff-panel', 'fsh-quest-panel', 'fsh-gvg-panel'];
    this.overlaysVisible = !this.overlaysVisible;

    panelIds.forEach(panelId => {
      const panel = document.getElementById(panelId);
      if (panel) {
        panel.style.display = this.overlaysVisible ? 'block' : 'none';
      }
    });

    this.update(`Overlays ${this.overlaysVisible ? 'shown' : 'hidden'}`, 'success');
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
      <strong>FSH:</strong> ${message}
      <div style="font-size: 9px; margin-top: 2px; opacity: 0.8;">Click for Helper Menu</div>
    `;
  }

  showConfigPanel() {
    alert('Configuration panel - implementing full UI coming soon!');
  }

  toggleDebugMode() {
    const config = new FSHConfig();
    const currentMode = config.get('debugMode');
    config.set('debugMode', !currentMode);
    alert(`Debug mode is now ${!currentMode ? 'ENABLED' : 'DISABLED'}`);
    console.log(`FSH: Debug mode set to ${!currentMode}`);
  }

  viewMetrics() {
    const metrics = new FSHMetrics();
    const stats = metrics.getStats();
    alert(`FSH Metrics:\n\nLoad Attempts: ${stats.loadAttempts}\nSuccess Rate: ${stats.successRate}%\nAverage Load Time: ${Math.round(stats.averageLoadTime)}ms`);
  }

  reportIssue() {
    window.open('https://github.com/tedrubin80/fallenswordngnixhelper/issues/new', '_blank');
  }
}

// Main Enhancement Controller
class FSHEnhancementController {
  constructor() {
    this.modules = {};
    this.config = new FSHConfig();
    this.enabled = true;
  }

  async initialize() {
    if (!this.enabled) return;

    console.log('FSH: Initializing Integrated Enhancements...');

    // Initialize data parser first
    this.modules.dataParser = new FSHDataParser();
    this.modules.dataParser.initialize();

    // Create status indicator
    this.statusIndicator = new FSHStatusIndicator(this);
    this.statusIndicator.create();

    // Wait for initial data
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize modules based on config
    if (this.config.get('enableBuffManager')) {
      console.log('FSH: Initializing Buff Manager');
      this.modules.buffManager = new FSHBuffManager(this.modules.dataParser);
      this.modules.buffManager.initialize();
    }

    if (this.config.get('enableGuildHelper')) {
      console.log('FSH: Initializing Guild Helper');
      this.modules.guildHelper = new FSHGuildHelper(this.modules.dataParser);
      this.modules.guildHelper.initialize();
    }

    if (this.config.get('enableQuestTracker')) {
      console.log('FSH: Initializing Quest Tracker');
      this.modules.questTracker = new FSHQuestTracker(this.modules.dataParser);
      this.modules.questTracker.initialize();
    }

    console.log('FSH: All enhancements initialized successfully');
    window.FSHController = this; // Make accessible for debugging
  }
}

// Enhanced FSH Loader
class FSHLoader {
  constructor(config) {
    this.config = config || new FSHConfig();
    this.metrics = new FSHMetrics();
    this.moduleUrl = 'https://fallenswordhelper.github.io/fallenswordhelper/resources/prod/1524/calfSystem.min.js';
    this.enhancementController = null;
  }

  calculateDelay(attempt) {
    const baseDelay = this.config.get('baseDelay');
    const maxDelay = this.config.get('maxDelay');
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return exponentialDelay + jitter;
  }

  async loadModule(gmInfo) {
    const startTime = Date.now();
    let lastError = null;
    const maxRetries = this.config.get('maxRetries');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (this.config.get('debugMode')) {
          console.log(`FSH: Loading attempt ${attempt + 1}/${maxRetries}`);
        }

        this.metrics.recordAttempt();

        // Add cache busting
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

          this.metrics.recordSuccess(loadTime);
          
          // Initialize the original FSH
          module.default('1524', gmInfo);
          
          // Initialize our enhancements
          console.log('FSH: Initializing custom enhancements');
          this.enhancementController = new FSHEnhancementController();
          await this.enhancementController.initialize();
          
          return true;
        } else {
          throw new Error('Invalid module structure');
        }

      } catch (error) {
        lastError = error;
        const errorType = error.message.includes('timeout') ? 'timeout' : 'network';
        this.metrics.recordFailure(errorType);

        if (this.config.get('debugMode')) {
          console.warn(`FSH: Attempt ${attempt + 1} failed:`, error.message);
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries - 1) {
          const delay = this.calculateDelay(attempt);
          if (this.config.get('debugMode')) {
            console.log(`FSH: Retrying in ${Math.round(delay)}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error('FSH: Failed to load after all attempts. Last error:', lastError);
    
    // Try to initialize enhancements anyway
    console.log('FSH: Attempting to initialize enhancements without base module');
    this.enhancementController = new FSHEnhancementController();
    await this.enhancementController.initialize();
    
    return false;
  }

  getGMInfo() {
    try {
      return typeof GM_info !== 'undefined' ? GM_info : {
        script: {
          name: 'FallenSwordHelper Integrated',
          version: '1525-integrated'
        },
        userAgent: navigator.userAgent
      };
    } catch (error) {
      console.warn('FSH: Could not access GM_info:', error);
      return {
        script: {
          name: 'FallenSwordHelper Integrated',
          version: '1525-integrated'
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

    console.log('FSH Integrated: Initializing...');

    const config = new FSHConfig();
    const loader = new FSHLoader(config);
    const gmInfo = loader.getGMInfo();

    // Make config accessible globally for debugging
    if (config.get('debugMode')) {
      window.FSHConfig = config;
      window.FSHLoader = loader;
    }

    const success = await loader.loadModule(gmInfo);

    window.fshLoading = false;
    window.fshLoaded = true;

    if (success) {
      console.log('FSH Integrated: Full initialization complete');
    } else {
      console.log('FSH Integrated: Enhancements initialized (base module failed)');
    }

  } catch (error) {
    window.fshLoading = false;
    console.error('FSH: Critical initialization error:', error);
  }
}

// Script injection
function injectScript() {
  try {
    const script = document.createElement('script');
    
    // Inject all classes and functions
    const scriptContent = `
      (async function() {
        try {
          // Inject all classes
          ${FSHConfig.toString()}
          ${FSHMetrics.toString()}
          ${FSHDataParser.toString()}
          ${FSHGuildHelper.toString()}
          ${FSHBuffManager.toString()}
          ${FSHQuestTracker.toString()}
          ${FSHStatusIndicator.toString()}
          ${FSHEnhancementController.toString()}
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
    script.setAttribute('data-fsh-version', '1525-integrated');

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

// Wait for page readiness
function waitForPageReady() {
  return new Promise(resolve => {
    if (document.readyState === 'complete' ||
        (document.readyState === 'interactive' && document.body)) {
      resolve();
      return;
    }

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

// Main execution
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
