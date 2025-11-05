// ==UserScript==
// @name           FallenSwordHelper Game Enhancements
// @namespace      terrasoft.gr
// @description    Comprehensive game enhancement features for Fallen Sword - Parser, Buffs, Resources, Equipment, Guild, Quests, Combat, Navigation, Market, and QoL
// @include        https://www.fallensword.com/*
// @include        https://guide.fallensword.com/*
// @include        https://fallensword.com/*
// @include        https://*.fallensword.com/*
// @version        1.0.0
// @grant          none
// @run-at         document-end
// ==/UserScript==

/**
 * FSH Game Enhancements Module
 * Provides comprehensive gameplay enhancements for Fallen Sword
 */

// ===================================================================
// 1. DATA PARSER - Extracts and processes game data
// ===================================================================
class FSHDataParser {
  constructor() {
    this.gameData = null;
    this.player = null;
    this.realm = null;
    this.updateInterval = 5000; // Update every 5 seconds
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

    // Parse inventory
    const invText = document.querySelector('#statbar-inventory')?.textContent;
    if (invText) {
      const match = invText.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        this.player.inventoryCurrent = parseInt(match[1]);
        this.player.inventoryMax = parseInt(match[2]);
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

  getGameData() {
    return this.gameData;
  }
}

// ===================================================================
// 2. BUFF MANAGEMENT SYSTEM
// ===================================================================
class FSHBuffManager {
  constructor(dataParser, settings) {
    this.dataParser = dataParser;
    this.settings = settings;
    this.buffs = [];
    this.warningThresholds = [300, 60]; // 5min, 1min in seconds
    this.notificationShown = new Set();
  }

  initialize() {
    this.parseBuffs();
    setInterval(() => this.checkBuffExpiration(), 1000);

    // Listen for data updates
    document.addEventListener('fsh:dataUpdate', () => this.parseBuffs());
  }

  parseBuffs() {
    const player = this.dataParser.getPlayer();
    if (player && player.buffs) {
      this.buffs = player.buffs.map(buff => ({
        ...buff,
        expiresAt: buff.expires * 1000, // Convert to milliseconds
        timeRemaining: buff.expires - Math.floor(Date.now() / 1000)
      }));
    }
  }

  checkBuffExpiration() {
    const now = Math.floor(Date.now() / 1000);

    this.buffs.forEach(buff => {
      const timeRemaining = buff.expires - now;
      buff.timeRemaining = timeRemaining;

      // Check warning thresholds
      this.warningThresholds.forEach(threshold => {
        if (timeRemaining <= threshold && timeRemaining > threshold - 2) {
          const key = `${buff.id}-${threshold}`;
          if (!this.notificationShown.has(key)) {
            this.showBuffWarning(buff, timeRemaining);
            this.notificationShown.add(key);
          }
        }
      });

      // Clear notification flag when buff expires
      if (timeRemaining <= 0) {
        this.warningThresholds.forEach(threshold => {
          this.notificationShown.delete(`${buff.id}-${threshold}`);
        });
      }
    });
  }

  showBuffWarning(buff, timeRemaining) {
    // Check if buff warnings are enabled in settings
    if (this.settings && !this.settings.get('enableBuffWarnings')) {
      return;
    }

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    this.showNotification(
      `Buff Expiring: ${buff.name}`,
      `${buff.name} (Lvl ${buff.level}) expires in ${timeText}`,
      'warning'
    );
  }

  showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 99999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 250px;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
      <div style="font-size: 12px;">${message}</div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  getActiveBuffs() {
    return this.buffs.filter(buff => buff.timeRemaining > 0);
  }

  getExpiringBuffs(threshold = 300) {
    return this.buffs.filter(buff =>
      buff.timeRemaining > 0 && buff.timeRemaining <= threshold
    );
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
      max-width: 300px;
      max-height: 400px;
      overflow-y: auto;
    `;

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 13px;">Active Buffs</div>
      <div id="fsh-buff-list"></div>
    `;

    document.body.appendChild(panel);

    // Update buff list every second
    setInterval(() => this.updateBuffPanel(), 1000);
  }

  updateBuffPanel() {
    const list = document.getElementById('fsh-buff-list');
    if (!list) return;

    const activeBuffs = this.getActiveBuffs();

    if (activeBuffs.length === 0) {
      list.innerHTML = '<div style="opacity: 0.6;">No active buffs</div>';
      return;
    }

    list.innerHTML = activeBuffs.map(buff => {
      const minutes = Math.floor(buff.timeRemaining / 60);
      const seconds = buff.timeRemaining % 60;
      const timeText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      const color = buff.timeRemaining < 60 ? '#ff4444' :
                    buff.timeRemaining < 300 ? '#ffaa00' : '#44ff44';

      return `
        <div style="margin-bottom: 8px; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 4px;">
          <div style="font-weight: bold;">${buff.name} (${buff.level})</div>
          <div style="color: ${color}; font-size: 10px;">${timeText}</div>
        </div>
      `;
    }).join('');
  }
}

// ===================================================================
// 3. RESOURCE TRACKING
// ===================================================================
class FSHResourceTracker {
  constructor(dataParser, settings) {
    this.dataParser = dataParser;
    this.settings = settings;
    this.history = {
      stamina: [],
      gold: [],
      xp: []
    };
    this.trackingInterval = 60000; // Track every minute
  }

  initialize() {
    this.startTracking();
    this.createResourcePanel();
  }

  startTracking() {
    setInterval(() => this.recordMetrics(), this.trackingInterval);
    this.recordMetrics(); // Initial record
  }

  recordMetrics() {
    const player = this.dataParser.getPlayer();
    if (!player) return;

    const timestamp = Date.now();

    if (player.stamina) {
      this.history.stamina.push({
        time: timestamp,
        current: player.stamina.current,
        max: player.stamina.max
      });
    }

    if (player.currentGold !== undefined) {
      this.history.gold.push({
        time: timestamp,
        amount: player.currentGold
      });
    }

    if (player.xp) {
      this.history.xp.push({
        time: timestamp,
        current: player.xp.current,
        next: player.xp.next
      });
    }

    // Keep only last hour of data
    const oneHourAgo = timestamp - 3600000;
    Object.keys(this.history).forEach(key => {
      this.history[key] = this.history[key].filter(entry => entry.time > oneHourAgo);
    });
  }

  calculateStaminaToFull() {
    const player = this.dataParser.getPlayer();
    if (!player || !player.stamina) return null;

    const staminaNeeded = player.stamina.max - player.stamina.current;
    const gainPerHour = player.staminaGain || 0;

    if (gainPerHour === 0) return { hours: Infinity, minutes: Infinity };

    const hoursToFull = staminaNeeded / gainPerHour;
    const hours = Math.floor(hoursToFull);
    const minutes = Math.floor((hoursToFull - hours) * 60);

    return { hours, minutes, totalMinutes: Math.floor(hoursToFull * 60) };
  }

  calculateGoldPerHour() {
    if (this.history.gold.length < 2) return 0;

    const recent = this.history.gold.slice(-10); // Last 10 entries
    const first = recent[0];
    const last = recent[recent.length - 1];

    const timeDiff = (last.time - first.time) / 3600000; // in hours
    const goldDiff = last.amount - first.amount;

    return timeDiff > 0 ? Math.round(goldDiff / timeDiff) : 0;
  }

  calculateXPPerHour() {
    if (this.history.xp.length < 2) return 0;

    const recent = this.history.xp.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const timeDiff = (last.time - first.time) / 3600000;
    const xpDiff = last.current - first.current;

    return timeDiff > 0 ? Math.round(xpDiff / timeDiff) : 0;
  }

  createResourcePanel() {
    const panel = document.createElement('div');
    panel.id = 'fsh-resource-panel';
    panel.style.cssText = `
      position: fixed;
      top: 100px;
      left: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9998;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      min-width: 200px;
    `;

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 13px;">Resource Tracker</div>
      <div id="fsh-resource-stats"></div>
    `;

    document.body.appendChild(panel);

    setInterval(() => this.updateResourcePanel(), 1000);
  }

  updateResourcePanel() {
    const stats = document.getElementById('fsh-resource-stats');
    if (!stats) return;

    const staminaInfo = this.calculateStaminaToFull();
    const goldPerHour = this.calculateGoldPerHour();
    const xpPerHour = this.calculateXPPerHour();

    let html = '<div style="line-height: 1.8;">';

    if (staminaInfo) {
      html += `<div><strong>Time to Full:</strong> ${staminaInfo.hours}h ${staminaInfo.minutes}m</div>`;
    }

    if (goldPerHour !== 0) {
      html += `<div><strong>Gold/Hour:</strong> ${goldPerHour.toLocaleString()}</div>`;
    }

    if (xpPerHour !== 0) {
      html += `<div><strong>XP/Hour:</strong> ${xpPerHour.toLocaleString()}</div>`;
    }

    html += '</div>';

    stats.innerHTML = html;
  }
}

// ===================================================================
// 4. EQUIPMENT ASSISTANT
// ===================================================================
class FSHEquipmentAssistant {
  constructor(dataParser, settings) {
    this.dataParser = dataParser;
    this.settings = settings;
    this.durabilityThreshold = 50; // Alert when below 50%
  }

  initialize() {
    this.monitorEquipment();
    setInterval(() => this.monitorEquipment(), 5000);
  }

  monitorEquipment() {
    const player = this.dataParser.getPlayer();
    if (!player || !player.equipment) return;

    player.equipment.forEach(item => {
      if (!item) return;

      const durabilityPercent = (item.current / item.max) * 100;

      if (durabilityPercent < this.durabilityThreshold && durabilityPercent > 0) {
        this.showLowDurabilityWarning(item, durabilityPercent);
      }
    });
  }

  showLowDurabilityWarning(item, percent) {
    // Store last warning time to avoid spam
    const storageKey = `fsh-durability-warning-${item.itemId}`;
    const lastWarning = localStorage.getItem(storageKey);
    const now = Date.now();

    // Only warn once every 5 minutes
    if (lastWarning && now - parseInt(lastWarning) < 300000) {
      return;
    }

    localStorage.setItem(storageKey, now.toString());

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 99999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 250px;
    `;

    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">Low Durability Warning</div>
      <div style="font-size: 12px;">${item.name}: ${Math.round(percent)}% (${item.current}/${item.max})</div>
      <button onclick="window.location='index.php?cmd=blacksmith'" style="margin-top: 10px; padding: 5px 10px; background: rgba(255,255,255,0.2); border: 1px solid white; color: white; cursor: pointer; border-radius: 3px;">
        Repair Now
      </button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 10000);
  }
}

// ===================================================================
// 5. GUILD HELPER - GvG, Guild Store, Scout Tower
// ===================================================================
class FSHGuildHelper {
  constructor(dataParser, settings) {
    this.dataParser = dataParser;
    this.settings = settings;
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
    this.loadConflictHistory();
    this.parseGuildData();
    this.enhanceGuildUI();
    this.enhanceGuildStore();

    // Only add Scout Tower button if enabled in settings
    if (this.settings && this.settings.get('showScoutTowerButton')) {
      this.addScoutTowerButton();
    }

    // Only track GvG if panel is enabled
    if (this.settings && this.settings.get('showGvGPanel')) {
      this.trackGvGConflicts();
    }

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
      // Keep last 100 conflicts
      if (this.conflictHistory.length > 100) {
        this.conflictHistory = this.conflictHistory.slice(-100);
      }
      localStorage.setItem('fsh_conflict_history', JSON.stringify(this.conflictHistory));
    } catch (error) {
      console.error('FSH: Could not save conflict history:', error);
    }
  }

  parseGuildData() {
    // Parse GvG conflict data from page
    this.parseGvGConflicts();

    // Parse guild member data
    this.parseGuildMembers();
  }

  parseGuildMembers() {
    const memberElements = document.querySelectorAll('#minibox-guild-members-list .player');

    this.guildMembers = Array.from(memberElements).map(element => {
      const nameElement = element.querySelector('.player-name');
      const name = nameElement?.textContent.trim();
      const playerId = nameElement?.href.match(/player_id=(\d+)/)?.[1];

      return {
        name,
        playerId,
        element
      };
    });
  }

  parseGvGConflicts() {
    // Parse conflict data from the guild conflict page
    if (!window.location.href.includes('cmd=guild') && !window.location.href.includes('cmd=conflict')) {
      return;
    }

    // Try to extract conflict information from DOM
    const conflictElements = document.querySelectorAll('.conflict-item, .gvg-conflict, [class*="conflict"]');

    this.gvgData.conflicts = Array.from(conflictElements).map(element => {
      const opponentName = element.querySelector('.opponent-name, .guild-name')?.textContent.trim();
      const pointsText = element.querySelector('.points, .score')?.textContent;
      const statusText = element.querySelector('.status')?.textContent;

      return {
        opponent: opponentName || 'Unknown',
        points: this.parsePoints(pointsText),
        status: statusText || 'Active',
        timestamp: Date.now()
      };
    }).filter(conflict => conflict.opponent !== 'Unknown');

    // Record new conflicts
    this.gvgData.conflicts.forEach(conflict => {
      if (!this.conflictHistory.find(c => c.opponent === conflict.opponent && c.timestamp === conflict.timestamp)) {
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

  trackGvGConflicts() {
    // Create GvG tracking panel
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
    `;

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; color: #ff6b6b;">
        ⚔️ GvG Tracker
      </div>
      <div id="fsh-gvg-stats" style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
        <div style="font-size: 10px; opacity: 0.7;">Loading conflict data...</div>
      </div>
      <div style="margin-top: 10px;">
        <button onclick="window.location='index.php?cmd=guild&subcmd=conflicts'" class="custombutton" style="width: 100%; margin-bottom: 5px;">
          View All Conflicts
        </button>
        <button onclick="window.location='index.php?cmd=guild&subcmd=advisor'" class="custombutton" style="width: 100%;">
          Guild Advisor
        </button>
      </div>
      <div id="fsh-conflict-history" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">Recent Conflicts</div>
        <div id="fsh-conflict-list" style="max-height: 200px; overflow-y: auto;"></div>
      </div>
    `;

    document.body.appendChild(panel);

    // Update GvG panel every 5 seconds
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

    // Update conflict history
    const recentConflicts = this.conflictHistory.slice(-10).reverse();
    if (recentConflicts.length > 0) {
      listDiv.innerHTML = recentConflicts.map(conflict => {
        const timeAgo = this.getTimeAgo(conflict.timestamp);
        return `
          <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; border-left: 3px solid #c41e3a;">
            <div style="font-weight: bold; color: #ff6b6b;">${conflict.opponent}</div>
            <div style="font-size: 10px; margin-top: 3px;">
              <span style="color: #ffd700;">Points: ${conflict.points}</span> •
              <span style="opacity: 0.7;">${timeAgo}</span>
            </div>
            <div style="font-size: 10px; margin-top: 2px; color: ${conflict.status === 'Won' ? '#44ff44' : conflict.status === 'Lost' ? '#ff4444' : '#ffaa00'};">
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

  enhanceGuildStore() {
    // Only enhance if we're on the guild store page
    if (!window.location.href.includes('cmd=guild') || !window.location.href.includes('subcmd=store')) {
      return;
    }

    // Add enhanced store controls
    this.addStoreFilters();
    this.addStoreSorting();
    this.addPriceHighlights();
  }

  addStoreFilters() {
    const storeContent = document.querySelector('.guild-store-content, #pCC');
    if (!storeContent) return;

    const filterPanel = document.createElement('div');
    filterPanel.id = 'fsh-store-filters';
    filterPanel.style.cssText = `
      background: rgba(0,0,0,0.7);
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 8px;
      border: 1px solid #444;
    `;

    filterPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #ffd700;">🛒 Store Filters</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 10px;">
        <button class="fsh-filter-btn custombutton" data-filter="all" style="font-size: 11px;">All Items</button>
        <button class="fsh-filter-btn custombutton" data-filter="weapon" style="font-size: 11px;">Weapons</button>
        <button class="fsh-filter-btn custombutton" data-filter="armor" style="font-size: 11px;">Armor</button>
        <button class="fsh-filter-btn custombutton" data-filter="potion" style="font-size: 11px;">Potions</button>
        <button class="fsh-filter-btn custombutton" data-filter="rune" style="font-size: 11px;">Runes</button>
        <button class="fsh-filter-btn custombutton" data-filter="affordable" style="font-size: 11px;">Affordable</button>
      </div>
      <div style="margin-top: 10px;">
        <label style="margin-right: 10px;">Sort by:</label>
        <select id="fsh-store-sort" class="customselect" style="padding: 5px;">
          <option value="default">Default</option>
          <option value="price-asc">Price (Low to High)</option>
          <option value="price-desc">Price (High to Low)</option>
          <option value="level-asc">Level (Low to High)</option>
          <option value="level-desc">Level (High to Low)</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>
      <div style="margin-top: 10px; font-size: 10px; opacity: 0.7;">
        💡 Tip: "Affordable" shows items you can buy with current gold
      </div>
    `;

    storeContent.insertBefore(filterPanel, storeContent.firstChild);

    // Add filter functionality
    document.querySelectorAll('.fsh-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        this.filterStoreItems(filter);
      });
    });

    // Add sort functionality
    document.getElementById('fsh-store-sort')?.addEventListener('change', (e) => {
      this.sortStoreItems(e.target.value);
    });
  }

  addStoreSorting() {
    // Store sorting logic is handled in addStoreFilters
  }

  filterStoreItems(filter) {
    const items = document.querySelectorAll('.guild-store-item, .item-row, [class*="store-item"]');
    const player = this.dataParser.getPlayer();
    const currentGold = player?.currentGold || 0;

    items.forEach(item => {
      let shouldShow = true;

      if (filter !== 'all') {
        const itemText = item.textContent.toLowerCase();
        const itemClasses = item.className.toLowerCase();

        if (filter === 'affordable') {
          const priceText = item.querySelector('.price, .cost, [class*="price"]')?.textContent;
          const price = this.parsePrice(priceText);
          shouldShow = price <= currentGold;
        } else {
          shouldShow = itemText.includes(filter) || itemClasses.includes(filter);
        }
      }

      item.style.display = shouldShow ? '' : 'none';
    });
  }

  sortStoreItems(sortBy) {
    const container = document.querySelector('.guild-store-content, #pCC');
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.guild-store-item, .item-row, [class*="store-item"]'));

    items.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return this.getItemPrice(a) - this.getItemPrice(b);
        case 'price-desc':
          return this.getItemPrice(b) - this.getItemPrice(a);
        case 'level-asc':
          return this.getItemLevel(a) - this.getItemLevel(b);
        case 'level-desc':
          return this.getItemLevel(b) - this.getItemLevel(a);
        case 'name':
          return this.getItemName(a).localeCompare(this.getItemName(b));
        default:
          return 0;
      }
    });

    // Re-append in sorted order
    items.forEach(item => container.appendChild(item));
  }

  getItemPrice(element) {
    const priceText = element.querySelector('.price, .cost, [class*="price"]')?.textContent;
    return this.parsePrice(priceText);
  }

  getItemLevel(element) {
    const levelText = element.querySelector('.level, [class*="level"]')?.textContent;
    const match = levelText?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  getItemName(element) {
    return element.querySelector('.item-name, .name, [class*="name"]')?.textContent.trim() || '';
  }

  parsePrice(text) {
    if (!text) return 0;
    const match = text.match(/(\d+,?\d*)/);
    return match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }

  addPriceHighlights() {
    const player = this.dataParser.getPlayer();
    const currentGold = player?.currentGold || 0;

    const items = document.querySelectorAll('.guild-store-item, .item-row, [class*="store-item"]');

    items.forEach(item => {
      const priceElement = item.querySelector('.price, .cost, [class*="price"]');
      if (!priceElement) return;

      const price = this.parsePrice(priceElement.textContent);

      if (price <= currentGold) {
        // Can afford - highlight green
        priceElement.style.cssText += 'color: #44ff44 !important; font-weight: bold;';
      } else {
        // Cannot afford - highlight red
        priceElement.style.cssText += 'color: #ff4444 !important;';
      }
    });
  }

  addScoutTowerButton() {
    // Add quick navigation to Scout Tower relic
    const navigationPanel = document.createElement('div');
    navigationPanel.id = 'fsh-scout-tower-btn';
    navigationPanel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 9999;
    `;

    navigationPanel.innerHTML = `
      <button onclick="window.location='index.php?cmd=guild&subcmd=scouttower'"
              class="custombutton"
              style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                     color: white;
                     padding: 10px 15px;
                     border: 2px solid #fff;
                     font-weight: bold;
                     box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
        🗼 Scout Tower
      </button>
    `;

    document.body.appendChild(navigationPanel);
  }

  enhanceGuildUI() {
    // Add quick links panel to guild interface
    const guildBox = document.querySelector('#minibox-guild');
    if (!guildBox) return;

    const quickLinksPanel = document.createElement('div');
    quickLinksPanel.style.cssText = 'margin: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;';

    quickLinksPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 11px;">Quick Links</div>
      <button onclick="window.location='index.php?cmd=guild&subcmd=store'" class="custombutton" style="width: 100%; margin-bottom: 5px; font-size: 10px;">
        Guild Store
      </button>
      <button onclick="window.location='index.php?cmd=guild&subcmd=conflicts'" class="custombutton" style="width: 100%; margin-bottom: 5px; font-size: 10px;">
        GvG Conflicts
      </button>
      <button onclick="window.location='index.php?cmd=guild&subcmd=scouttower'" class="custombutton" style="width: 100%; font-size: 10px;">
        Scout Tower
      </button>
    `;

    guildBox.querySelector('.minibox-content')?.appendChild(quickLinksPanel);
  }
}

// ===================================================================
// 6. QUEST & EVENT TRACKER
// ===================================================================
class FSHQuestTracker {
  constructor(dataParser, settings) {
    this.dataParser = dataParser;
    this.settings = settings;
    this.dailyQuest = null;
    this.globalEvent = null;
  }

  initialize() {
    this.parseDailyQuest();
    this.parseGlobalEvent();
    this.createTrackerPanel();
  }

  parseDailyQuest() {
    if (typeof dailyQuestCompleted !== 'undefined') {
      this.dailyQuest = {
        completed: dailyQuestCompleted,
        type: dailyQuestType,
        subtype: dailyQuestSubtype,
        current: dailyQuestCurrent,
        target: dailyQuestTarget
      };
    }
  }

  parseGlobalEvent() {
    const player = this.dataParser.getPlayer();
    if (player && player.event) {
      this.globalEvent = player.event;
    }
  }

  createTrackerPanel() {
    const panel = document.createElement('div');
    panel.id = 'fsh-quest-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9998;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      min-width: 250px;
    `;

    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 13px;">Quest Tracker</div>
      <div id="fsh-quest-info"></div>
    `;

    document.body.appendChild(panel);

    this.updateTrackerPanel();
    setInterval(() => this.updateTrackerPanel(), 1000);
  }

  updateTrackerPanel() {
    const info = document.getElementById('fsh-quest-info');
    if (!info) return;

    let html = '';

    if (this.dailyQuest) {
      const progress = this.dailyQuest.current / this.dailyQuest.target * 100;
      html += `
        <div style="margin-bottom: 15px;">
          <div style="font-weight: bold; margin-bottom: 5px;">Daily Quest</div>
          <div style="background: rgba(255,255,255,0.1); height: 20px; border-radius: 10px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${progress}%;"></div>
          </div>
          <div style="margin-top: 5px; font-size: 10px;">${this.dailyQuest.current} / ${this.dailyQuest.target}</div>
        </div>
      `;
    }

    if (this.globalEvent) {
      html += `
        <div>
          <div style="font-weight: bold; margin-bottom: 5px;">Global Event</div>
          <div style="font-size: 10px;">${this.globalEvent.name}</div>
          <div style="font-size: 10px; color: #44ff44;">Your Progress: ${this.globalEvent.qualify}</div>
        </div>
      `;
    }

    info.innerHTML = html || '<div style="opacity: 0.6;">No active quests</div>';
  }
}

// ===================================================================
// 7. COMBAT ENHANCEMENTS
// ===================================================================
class FSHCombatEnhancer {
  constructor(dataParser) {
    this.dataParser = dataParser;
    this.combatLog = [];
    this.stats = {
      wins: 0,
      losses: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      loot: []
    };
  }

  initialize() {
    this.loadStats();
    this.observeCombat();
  }

  loadStats() {
    try {
      const stored = localStorage.getItem('fsh_combat_stats');
      if (stored) {
        this.stats = JSON.parse(stored);
      }
    } catch (error) {
      console.error('FSH: Could not load combat stats:', error);
    }
  }

  saveStats() {
    try {
      localStorage.setItem('fsh_combat_stats', JSON.stringify(this.stats));
    } catch (error) {
      console.error('FSH: Could not save combat stats:', error);
    }
  }

  observeCombat() {
    // Watch for combat dialog
    const observer = new MutationObserver(() => {
      const combatDialog = document.getElementById('combatDialog');
      if (combatDialog && combatDialog.style.display !== 'none') {
        this.parseCombatResult(combatDialog);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  parseCombatResult(dialog) {
    // Parse combat outcome
    const resultElement = dialog.querySelector('.result h3');
    if (resultElement) {
      const resultText = resultElement.textContent;
      if (resultText.includes('Victory') || resultText.includes('Won')) {
        this.stats.wins++;
      } else if (resultText.includes('Defeat') || resultText.includes('Lost')) {
        this.stats.losses++;
      }
      this.saveStats();
    }
  }

  getWinRate() {
    const total = this.stats.wins + this.stats.losses;
    return total > 0 ? ((this.stats.wins / total) * 100).toFixed(2) : 0;
  }

  resetStats() {
    this.stats = {
      wins: 0,
      losses: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      loot: []
    };
    this.saveStats();
  }
}

// ===================================================================
// 8. NAVIGATION TOOLS
// ===================================================================
class FSHNavigator {
  constructor(dataParser) {
    this.dataParser = dataParser;
    this.bookmarks = [];
  }

  initialize() {
    this.loadBookmarks();
    this.addBookmarkButton();
  }

  loadBookmarks() {
    try {
      const stored = localStorage.getItem('fsh_bookmarks');
      if (stored) {
        this.bookmarks = JSON.parse(stored);
      }
    } catch (error) {
      console.error('FSH: Could not load bookmarks:', error);
    }
  }

  saveBookmarks() {
    try {
      localStorage.setItem('fsh_bookmarks', JSON.stringify(this.bookmarks));
    } catch (error) {
      console.error('FSH: Could not save bookmarks:', error);
    }
  }

  addBookmarkButton() {
    const worldName = document.getElementById('worldName');
    if (!worldName) return;

    const button = document.createElement('button');
    button.textContent = '★ Bookmark';
    button.className = 'awesome small blue';
    button.style.cssText = 'margin-left: 10px;';
    button.onclick = () => this.bookmarkCurrentLocation();

    worldName.appendChild(button);
  }

  bookmarkCurrentLocation() {
    const player = this.dataParser.getPlayer();
    const realm = this.dataParser.getRealm();

    if (!player || !realm) {
      alert('Could not get current location');
      return;
    }

    const name = prompt('Bookmark name:', realm.name || 'Location');
    if (!name) return;

    this.bookmarks.push({
      name,
      realmId: realm.id,
      x: player.location.x,
      y: player.location.y,
      timestamp: Date.now()
    });

    this.saveBookmarks();
    alert('Location bookmarked!');
  }
}

// ===================================================================
// 9. MARKET TOOLS
// ===================================================================
class FSHMarketAnalyzer {
  constructor(dataParser) {
    this.dataParser = dataParser;
    this.priceHistory = {};
  }

  initialize() {
    this.loadPriceHistory();
    this.observeAuctionHouse();
  }

  loadPriceHistory() {
    try {
      const stored = localStorage.getItem('fsh_price_history');
      if (stored) {
        this.priceHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('FSH: Could not load price history:', error);
    }
  }

  savePriceHistory() {
    try {
      localStorage.setItem('fsh_price_history', JSON.stringify(this.priceHistory));
    } catch (error) {
      console.error('FSH: Could not save price history:', error);
    }
  }

  observeAuctionHouse() {
    // Watch for auction house page
    if (window.location.href.includes('cmd=auctionhouse')) {
      this.enhanceAuctionHouse();
    }
  }

  enhanceAuctionHouse() {
    // Add price history indicators to auction items
    const itemElements = document.querySelectorAll('.auction-item');

    itemElements.forEach(element => {
      const itemId = element.dataset.itemId;
      const price = element.dataset.price;

      if (itemId && price) {
        this.recordPrice(itemId, parseInt(price));
        this.addPriceIndicator(element, itemId);
      }
    });
  }

  recordPrice(itemId, price) {
    if (!this.priceHistory[itemId]) {
      this.priceHistory[itemId] = [];
    }

    this.priceHistory[itemId].push({
      price,
      timestamp: Date.now()
    });

    // Keep only last 100 entries per item
    if (this.priceHistory[itemId].length > 100) {
      this.priceHistory[itemId].shift();
    }

    this.savePriceHistory();
  }

  addPriceIndicator(element, itemId) {
    const history = this.priceHistory[itemId];
    if (!history || history.length < 2) return;

    const avgPrice = history.reduce((sum, entry) => sum + entry.price, 0) / history.length;
    const currentPrice = history[history.length - 1].price;
    const percentDiff = ((currentPrice - avgPrice) / avgPrice * 100).toFixed(1);

    const indicator = document.createElement('span');
    indicator.style.cssText = `
      display: inline-block;
      margin-left: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
    `;

    if (percentDiff < -10) {
      indicator.style.background = '#44ff44';
      indicator.style.color = '#000';
      indicator.textContent = `DEAL! ${percentDiff}%`;
    } else if (percentDiff > 10) {
      indicator.style.background = '#ff4444';
      indicator.style.color = '#fff';
      indicator.textContent = `HIGH ${percentDiff}%`;
    } else {
      indicator.style.background = '#ffaa00';
      indicator.style.color = '#000';
      indicator.textContent = `AVG ${percentDiff}%`;
    }

    element.appendChild(indicator);
  }
}

// ===================================================================
// 10. QUALITY OF LIFE FEATURES
// ===================================================================
class FSHQoLFeatures {
  constructor(dataParser, settings) {
    this.dataParser = dataParser;
    this.settings = settings;
  }

  initialize() {
    if (this.settings && this.settings.get('autoRefreshActions')) {
      this.addAutoRefresh();
    }
    this.enhanceKeyboardShortcuts();

    if (this.settings && this.settings.get('showQuickActions')) {
      this.addQuickActions();
    }

    if (this.settings && this.settings.get('enableSoundNotifications')) {
      this.addSoundNotifications();
    }
  }

  addAutoRefresh() {
    // Auto-refresh action list button
    const actionList = document.getElementById('actionList');
    if (!actionList) return;

    const autoRefreshBtn = document.createElement('button');
    autoRefreshBtn.textContent = 'Auto-Refresh: OFF';
    autoRefreshBtn.className = 'custombutton';
    autoRefreshBtn.style.cssText = 'margin: 5px;';

    let autoRefresh = false;
    let interval;

    autoRefreshBtn.onclick = () => {
      autoRefresh = !autoRefresh;
      autoRefreshBtn.textContent = `Auto-Refresh: ${autoRefresh ? 'ON' : 'OFF'}`;

      if (autoRefresh) {
        interval = setInterval(() => {
          const refreshBtn = document.querySelector('.actionListHeaderButton.refresh');
          if (refreshBtn) refreshBtn.click();
        }, 30000); // Every 30 seconds
      } else {
        if (interval) clearInterval(interval);
      }
    };

    document.getElementById('actionContainerHeader')?.appendChild(autoRefreshBtn);
  }

  enhanceKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+R: Repair All
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        window.location = 'index.php?cmd=blacksmith&subcmd=repairall';
      }

      // Ctrl+B: Open Bank
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        window.location = 'index.php?cmd=bank';
      }

      // Ctrl+G: Guild Store
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        document.querySelector('.guild_openGuildStore')?.click();
      }
    });
  }

  addQuickActions() {
    const quickActionsPanel = document.createElement('div');
    quickActionsPanel.id = 'fsh-quick-actions';
    quickActionsPanel.style.cssText = `
      position: fixed;
      top: 200px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 10px;
      border-radius: 8px;
      z-index: 9998;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
    `;

    quickActionsPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 13px;">Quick Actions</div>
      <button onclick="window.location='index.php?cmd=blacksmith&subcmd=repairall'" class="custombutton" style="width: 100%; margin-bottom: 5px;">Repair All (Ctrl+R)</button>
      <button onclick="window.location='index.php?cmd=bank'" class="custombutton" style="width: 100%; margin-bottom: 5px;">Bank (Ctrl+B)</button>
      <button onclick="document.querySelector('.guild_openGuildStore')?.click()" class="custombutton" style="width: 100%;">Guild Store (Ctrl+G)</button>
    `;

    document.body.appendChild(quickActionsPanel);
  }

  addSoundNotifications() {
    // Create audio elements for notifications
    const sounds = {
      buffExpiring: this.createBeep(800, 0.3, 0.1),
      lowDurability: this.createBeep(400, 0.3, 0.2),
      inventoryFull: this.createBeep(600, 0.3, 0.15)
    };

    window.fshSounds = sounds;
  }

  createBeep(frequency, duration, volume) {
    return () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
      } catch (error) {
        console.error('FSH: Could not play sound:', error);
      }
    };
  }
}

// ===================================================================
// SETTINGS MANAGER - Manages user preferences for enhancements
// ===================================================================
class FSHSettings {
  constructor() {
    this.defaults = {
      showGvGPanel: true,
      showBuffPanel: true,
      showResourcePanel: true,
      showQuestPanel: true,
      showQuickActions: true,
      showScoutTowerButton: true,
      enableBuffWarnings: true,
      enableDurabilityWarnings: true,
      enableSoundNotifications: false,
      autoRefreshActions: false
    };
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem('fsh_enhancement_settings');
      if (stored) {
        return { ...this.defaults, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('FSH: Could not load settings:', error);
    }
    return { ...this.defaults };
  }

  saveSettings() {
    try {
      localStorage.setItem('fsh_enhancement_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('FSH: Could not save settings:', error);
    }
  }

  get(key) {
    return this.settings[key] !== undefined ? this.settings[key] : this.defaults[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  createSettingsPanel() {
    const panel = document.createElement('div');
    panel.id = 'fsh-settings-panel';
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(20, 20, 20, 0.98);
      color: white;
      padding: 25px;
      border-radius: 12px;
      border: 3px solid #667eea;
      z-index: 99999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      min-width: 450px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      display: none;
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 15px;">
        <h2 style="margin: 0; color: #667eea; font-size: 20px;">⚙️ FSH Enhancement Settings</h2>
        <button id="fsh-settings-close" style="background: #ff4444; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px;">✕</button>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #ffd700; margin: 0 0 12px 0; font-size: 16px; border-bottom: 1px solid #444; padding-bottom: 8px;">UI Panels</h3>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-showGvGPanel" ${this.get('showGvGPanel') ? 'checked' : ''}>
          <strong>GvG Tracker Panel</strong> - Show conflict tracking panel
        </label>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-showBuffPanel" ${this.get('showBuffPanel') ? 'checked' : ''}>
          <strong>Buff Panel</strong> - Show active buffs panel
        </label>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-showResourcePanel" ${this.get('showResourcePanel') ? 'checked' : ''}>
          <strong>Resource Tracker Panel</strong> - Show resource tracking panel
        </label>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-showQuestPanel" ${this.get('showQuestPanel') ? 'checked' : ''}>
          <strong>Quest Tracker Panel</strong> - Show quest tracking panel
        </label>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-showQuickActions" ${this.get('showQuickActions') ? 'checked' : ''}>
          <strong>Quick Actions Panel</strong> - Show quick actions panel
        </label>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-showScoutTowerButton" ${this.get('showScoutTowerButton') ? 'checked' : ''}>
          <strong>Scout Tower Button</strong> - Show Scout Tower quick button
        </label>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #ffd700; margin: 0 0 12px 0; font-size: 16px; border-bottom: 1px solid #444; padding-bottom: 8px;">Notifications</h3>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-enableBuffWarnings" ${this.get('enableBuffWarnings') ? 'checked' : ''}>
          <strong>Buff Expiration Warnings</strong> - Alert when buffs expire soon
        </label>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-enableDurabilityWarnings" ${this.get('enableDurabilityWarnings') ? 'checked' : ''}>
          <strong>Low Durability Warnings</strong> - Alert when equipment durability is low
        </label>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-enableSoundNotifications" ${this.get('enableSoundNotifications') ? 'checked' : ''}>
          <strong>Sound Notifications</strong> - Play sounds for alerts
        </label>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #ffd700; margin: 0 0 12px 0; font-size: 16px; border-bottom: 1px solid #444; padding-bottom: 8px;">Other Features</h3>
        <label style="display: block; margin-bottom: 10px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" id="setting-autoRefreshActions" ${this.get('autoRefreshActions') ? 'checked' : ''}>
          <strong>Auto-Refresh Actions</strong> - Automatically refresh action list
        </label>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 20px; border-top: 2px solid #444; padding-top: 20px;">
        <button id="fsh-settings-save" style="flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          💾 Save & Apply
        </button>
        <button id="fsh-settings-reset" style="flex: 1; background: #666; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          🔄 Reset to Defaults
        </button>
      </div>

      <div style="margin-top: 15px; text-align: center; font-size: 11px; color: #888;">
        Changes will take effect immediately. Refresh the page if needed.
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('fsh-settings-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    document.getElementById('fsh-settings-save').addEventListener('click', () => {
      this.saveSettingsFromPanel();
      panel.style.display = 'none';
      location.reload(); // Reload to apply changes
    });

    document.getElementById('fsh-settings-reset').addEventListener('click', () => {
      if (confirm('Reset all settings to defaults? This will reload the page.')) {
        this.settings = { ...this.defaults };
        this.saveSettings();
        location.reload();
      }
    });

    return panel;
  }

  saveSettingsFromPanel() {
    const settingKeys = [
      'showGvGPanel', 'showBuffPanel', 'showResourcePanel', 'showQuestPanel',
      'showQuickActions', 'showScoutTowerButton', 'enableBuffWarnings',
      'enableDurabilityWarnings', 'enableSoundNotifications', 'autoRefreshActions'
    ];

    settingKeys.forEach(key => {
      const checkbox = document.getElementById(`setting-${key}`);
      if (checkbox) {
        this.set(key, checkbox.checked);
      }
    });
  }

  showSettingsPanel() {
    let panel = document.getElementById('fsh-settings-panel');
    if (!panel) {
      panel = this.createSettingsPanel();
    }
    panel.style.display = 'block';
  }
}

// ===================================================================
// MAIN CONTROLLER - Initializes all enhancements
// ===================================================================
class FSHEnhancementController {
  constructor() {
    this.modules = {};
    this.enabled = true;
    this.settings = new FSHSettings();
  }

  async initialize() {
    if (!this.enabled) return;

    console.log('FSH: Initializing Game Enhancements...');

    // Add settings button
    this.addSettingsButton();

    // Initialize data parser first
    this.modules.dataParser = new FSHDataParser();
    this.modules.dataParser.initialize();

    // Wait a bit for initial data
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize all other modules
    this.modules.buffManager = new FSHBuffManager(this.modules.dataParser, this.settings);
    this.modules.buffManager.initialize();
    if (this.settings.get('showBuffPanel')) {
      this.modules.buffManager.createBuffPanel();
    }

    this.modules.resourceTracker = new FSHResourceTracker(this.modules.dataParser, this.settings);
    if (this.settings.get('showResourcePanel')) {
      this.modules.resourceTracker.initialize();
    }

    this.modules.equipmentAssistant = new FSHEquipmentAssistant(this.modules.dataParser, this.settings);
    if (this.settings.get('enableDurabilityWarnings')) {
      this.modules.equipmentAssistant.initialize();
    }

    this.modules.guildHelper = new FSHGuildHelper(this.modules.dataParser, this.settings);
    this.modules.guildHelper.initialize();

    this.modules.questTracker = new FSHQuestTracker(this.modules.dataParser, this.settings);
    if (this.settings.get('showQuestPanel')) {
      this.modules.questTracker.initialize();
    }

    this.modules.combatEnhancer = new FSHCombatEnhancer(this.modules.dataParser);
    this.modules.combatEnhancer.initialize();

    this.modules.navigator = new FSHNavigator(this.modules.dataParser);
    this.modules.navigator.initialize();

    this.modules.marketAnalyzer = new FSHMarketAnalyzer(this.modules.dataParser);
    this.modules.marketAnalyzer.initialize();

    this.modules.qolFeatures = new FSHQoLFeatures(this.modules.dataParser, this.settings);
    if (this.settings.get('showQuickActions') || this.settings.get('autoRefreshActions')) {
      this.modules.qolFeatures.initialize();
    }

    console.log('FSH: All enhancements initialized successfully!');

    // Make controller globally accessible for debugging
    window.FSHEnhancements = this;
  }

  addSettingsButton() {
    // Create settings button in top-right corner
    const settingsBtn = document.createElement('div');
    settingsBtn.id = 'fsh-settings-btn';
    settingsBtn.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 9999;
      cursor: pointer;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'FSH Enhancement Settings';

    settingsBtn.addEventListener('mouseover', () => {
      settingsBtn.style.transform = 'scale(1.1) rotate(90deg)';
      settingsBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
    });

    settingsBtn.addEventListener('mouseout', () => {
      settingsBtn.style.transform = 'scale(1) rotate(0deg)';
      settingsBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    });

    settingsBtn.addEventListener('click', () => {
      this.settings.showSettingsPanel();
    });

    document.body.appendChild(settingsBtn);
  }

  getModule(name) {
    return this.modules[name];
  }

  disable() {
    this.enabled = false;
    // Remove UI elements
    ['fsh-buff-panel', 'fsh-resource-panel', 'fsh-quest-panel', 'fsh-quick-actions'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  enable() {
    this.enabled = true;
    this.initialize();
  }
}

// ===================================================================
// AUTO-INITIALIZE
// ===================================================================
(function() {
  console.log('FSH Game Enhancements: Loading...');

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements);
  } else {
    initEnhancements();
  }

  function initEnhancements() {
    // Additional delay to ensure game has loaded
    setTimeout(() => {
      const controller = new FSHEnhancementController();
      controller.initialize();
    }, 2000);
  }
})();
