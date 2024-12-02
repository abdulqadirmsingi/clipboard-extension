// Maximum number of items to store
const MAX_ITEMS = 50;

// Function to add new clipboard item
async function addClipboardItem(content, contentType, source = '', title = '', alt = '') {
    try {
        if (!content || (typeof content === 'string' && content.trim() === '')) return;

        const result = await chrome.storage.local.get(['clipboardItems', 'trackingEnabled']);
        
        // Check if tracking is enabled
        if (result.trackingEnabled === false) {
            return;
        }

        let items = result.clipboardItems || [];
        
        // Don't add if it's the same as the most recent item
        if (items.length > 0 && items[0].content === content) {
            return;
        }

        // Remove duplicates
        items = items.filter(item => item.content !== content);

        // Add new item at the beginning
        items.unshift({
            content,
            contentType,
            source,
            title,
            alt,
            timestamp: Date.now(),
            favorite: false
        });

        // Keep only the latest MAX_ITEMS
        if (items.length > MAX_ITEMS) {
            items = items.slice(0, MAX_ITEMS);
        }

        // Save updated items
        await chrome.storage.local.set({ clipboardItems: items });
    } catch (error) {
        console.error('Error adding clipboard item:', error);
    }
}

// Set up initial state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        trackingEnabled: true,
        clipboardItems: [],
        settings: {
            maxItems: MAX_ITEMS,
            autoDeleteDays: 30,
            showNotifications: true
        }
    });
});

// Function to show notification
async function showNotification(content, contentType, alt) {
    try {
        const settings = await chrome.storage.local.get(['settings']);
        if (settings.settings?.showNotifications) {
            const message = contentType === 'image' 
                ? `Image copied: ${alt || 'No description'}`
                : content.substring(0, 50) + (content.length > 50 ? '...' : '');

            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.svg',
                title: `${contentType === 'image' ? 'Image' : 'Text'} Copied`,
                message
            });
        }
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLIPBOARD_COPY') {
        addClipboardItem(
            message.content,
            message.contentType,
            message.source,
            message.title,
            message.alt
        );
        showNotification(message.content, message.contentType, message.alt);
    }
});

// Function to check if URL is injectable
function isInjectableUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

// Function to inject content script into active tab
async function injectContentScript(tabId) {
    try {
        // Get tab info
        const tab = await chrome.tabs.get(tabId);
        
        // Only inject if URL is http or https
        if (tab.url && isInjectableUrl(tab.url)) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            } catch (err) {
                // If script is already injected, this error is expected
                if (!err.message.includes('The content script has already been injected')) {
                    console.error('Error injecting content script:', err);
                }
            }
        }
    } catch (error) {
        // Tab might not be accessible
        console.error('Error accessing tab:', error);
    }
}

// Inject content script when a new tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await injectContentScript(activeInfo.tabId);
});

// Inject content script when a tab is updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        await injectContentScript(tabId);
    }
});

// Auto-cleanup old items
async function cleanupOldItems() {
    try {
        const { clipboardItems, settings } = await chrome.storage.local.get(['clipboardItems', 'settings']);
        if (!clipboardItems || !settings?.autoDeleteDays) return;

        const cutoffTime = Date.now() - (settings.autoDeleteDays * 24 * 60 * 60 * 1000);
        const newItems = clipboardItems.filter(item => 
            item.timestamp > cutoffTime || item.favorite
        );

        if (newItems.length !== clipboardItems.length) {
            await chrome.storage.local.set({ clipboardItems: newItems });
        }
    } catch (error) {
        console.error('Error cleaning up old items:', error);
    }
}

// Run cleanup daily
setInterval(cleanupOldItems, 24 * 60 * 60 * 1000);
cleanupOldItems(); // Run initial cleanup
