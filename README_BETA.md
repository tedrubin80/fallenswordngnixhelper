# FallenSwordHelper - Beta Version

## Overview

This is the **BETA** version of FallenSwordHelper with enhanced features, improved performance, and better user experience for in-game usage.

## What's New in Beta

### 1. User Configuration Panel
- Click on the status indicator in-game to access settings
- Customize retry behavior, delays, and timeouts
- Enable/disable features based on your preferences
- All settings are saved automatically to localStorage

### 2. Smart Caching System
- Caches successfully loaded modules for faster subsequent loads
- Configurable cache duration (default: 1 hour)
- Reduces server load and improves performance
- Automatic cache invalidation when needed

### 3. Performance Metrics Tracking
- Monitors load attempts, success rates, and timing
- Tracks network errors and timeout errors
- View detailed statistics in the configuration panel
- Helps identify connection issues

### 4. Adaptive Retry Strategy
- Automatically adjusts retry delays based on network quality
- Learns from previous attempts to optimize loading
- Better handling of poor network conditions
- Reduces unnecessary server requests

### 5. Enhanced Status Indicator
- Visual feedback for loading status
- Color-coded indicators (info, success, error, warning)
- Click to access configuration panel
- Auto-hides after successful load

### 6. Debug Mode
- Verbose logging for troubleshooting
- Exposes configuration and metrics to console
- Helps identify issues during development

## Configuration Options

### Performance Settings
- **Debug Mode**: Enable detailed logging
- **Status Indicator**: Show/hide the status indicator
- **Performance Metrics**: Enable/disable metrics tracking
- **Smart Caching**: Enable/disable module caching
- **Adaptive Retry**: Use intelligent retry strategy

### Network Settings
- **Max Retries**: Number of retry attempts (1-10)
- **Base Delay**: Initial retry delay in milliseconds
- **Timeout**: Module load timeout in milliseconds

## Installation

1. Install a userscript manager (Tampermonkey, Greasemonkey, etc.)
2. Install the beta version: `fsh_modernized_beta.js`
3. Navigate to FallenSword game
4. Click on the status indicator to configure settings

## Usage

### First Time Setup
1. The script will load automatically when you visit FallenSword
2. Look for the purple status indicator in the top-right corner
3. Click it to access configuration options
4. Adjust settings to your preference

### Accessing Configuration
- Click on the status indicator at any time
- View performance metrics and statistics
- Adjust settings and save
- Reset to defaults if needed

### Debug Mode
Enable debug mode to:
- See detailed loading information in console
- Access configuration objects globally
- Troubleshoot loading issues
- Monitor performance metrics in real-time

## Performance Metrics

The beta version tracks:
- **Load Attempts**: Total number of load attempts
- **Success Rate**: Percentage of successful loads
- **Average Load Time**: Mean time to load module
- **Network Errors**: Count of network-related failures
- **Timeout Errors**: Count of timeout failures

## Differences from Standard Version

| Feature | Standard | Beta |
|---------|----------|------|
| Configuration Panel | ❌ | ✅ |
| Smart Caching | ❌ | ✅ |
| Performance Metrics | ❌ | ✅ |
| Adaptive Retry | ❌ | ✅ |
| Status Indicator | ❌ | ✅ |
| User Settings Persistence | ❌ | ✅ |
| Debug Mode | ❌ | ✅ |

## Troubleshooting

### Script Won't Load
1. Enable debug mode in settings
2. Check browser console for errors
3. Try resetting to default settings
4. Verify network connection
5. Check performance metrics for patterns

### Slow Loading
1. Check your network quality in metrics
2. Enable adaptive retry strategy
3. Increase timeout value
4. Reduce max retries if connection is stable

### Status Indicator Not Showing
1. Check if "Show Status Indicator" is enabled
2. Refresh the page
3. Check for conflicts with other scripts
4. Verify script is installed correctly

## Feedback and Issues

This is a BETA version for testing and improvement. Please report:
- Bugs and errors
- Performance issues
- Feature requests
- User experience feedback

## Future Improvements

Planned features:
- Auto-update checking
- More granular performance metrics
- Network quality visualization
- Custom themes for status indicator
- Export/import configuration
- Advanced caching strategies

## Technical Details

### Storage Usage
The beta version uses localStorage for:
- User configuration (persistent)
- Performance metrics (persistent)
- Module cache (temporary, with TTL)

### Network Optimization
- Exponential backoff with jitter
- Configurable retry strategy
- Smart caching to reduce requests
- Staggered initial loads to reduce server spikes

### Browser Compatibility
- Chrome/Chromium (recommended)
- Firefox
- Edge
- Opera
- Any browser supporting ES6+ and localStorage

## Version History

### 1525-beta-1
- Initial beta release
- Added configuration panel
- Implemented smart caching
- Added performance metrics
- Adaptive retry strategy
- Enhanced status indicator

---

**Note**: This is a BETA version. While extensively tested, it may contain bugs or unexpected behavior. Use alongside the standard version for comparison.
