document.addEventListener('DOMContentLoaded', () => {
  const clipboardList = document.getElementById('clipboardList');
  const searchBar = document.getElementById('searchBar');
  const clearAllButton = document.getElementById('clear-all');
  const refreshButton = document.getElementById('refresh');
  const trackingToggle = document.getElementById('tracking-toggle');
  const statsElement = document.getElementById('stats');
  const copyFeedback = document.getElementById('copyFeedback');
  const modal = document.getElementById('textModal');
  const modalText = document.getElementById('modalText');
  const modalClose = document.getElementById('modalClose');

  let clipboardItems = [];
  let searchTimeout = null;

  // Load initial state
  chrome.storage.local.get(['trackingEnabled'], (result) => {
    trackingToggle.checked = result.trackingEnabled !== false;
  });

  // Toggle tracking
  trackingToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ trackingEnabled: enabled });
  });

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    return date.toLocaleString();
  };

  // Show copy feedback
  const showCopyFeedback = () => {
    copyFeedback.classList.add('show');
    setTimeout(() => {
      copyFeedback.classList.remove('show');
    }, 2000);
  };

  // Copy content to clipboard
  const copyToClipboard = async (content, contentType) => {
    try {
      if (contentType === 'image') {
        const response = await fetch(content);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
      } else {
        await navigator.clipboard.writeText(content);
      }
      showCopyFeedback();
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Update stats with search results
  const updateStats = (filteredCount = null) => {
    const total = clipboardItems.length;
    if (filteredCount !== null && filteredCount !== total) {
      statsElement.textContent = `${filteredCount} of ${total} item${total !== 1 ? 's' : ''} found`;
    } else {
      statsElement.textContent = `${total} item${total !== 1 ? 's' : ''} saved`;
    }
  };

  // Search function with scoring
  const searchItems = (query) => {
    if (!query.trim()) {
      return clipboardItems;
    }

    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return clipboardItems
      .map(item => {
        const content = item.content.toString().toLowerCase();
        const title = (item.title || '').toLowerCase();
        const source = (item.source || '').toLowerCase();
        const alt = (item.alt || '').toLowerCase();
        
        let score = 0;
        let matches = false;

        for (const term of searchTerms) {
          // Exact matches in content
          if (content.includes(term)) {
            score += 10;
            matches = true;
          }
          // Word boundary matches in content
          if (new RegExp(`\\b${term}\\b`).test(content)) {
            score += 5;
          }
          // Matches in title or alt text
          if (title.includes(term) || alt.includes(term)) {
            score += 3;
            matches = true;
          }
          // Matches in source URL
          if (source.includes(term)) {
            score += 2;
            matches = true;
          }
        }

        return {
          item,
          score,
          matches
        };
      })
      .filter(result => result.matches)
      .sort((a, b) => b.score - a.score)
      .map(result => result.item);
  };

  // Delete item
  const deleteItem = async (index) => {
    clipboardItems.splice(index, 1);
    await chrome.storage.local.set({ clipboardItems });
    renderClipboardItems(clipboardItems);
    updateStats();
  };

  // Load clipboard items
  const loadClipboardItems = async () => {
    const result = await chrome.storage.local.get(['clipboardItems']);
    clipboardItems = result.clipboardItems || [];
    renderClipboardItems(clipboardItems);
    updateStats();
  };

  // Render clipboard items
  const renderClipboardItems = (items) => {
    clipboardList.innerHTML = '';
    
    if (items.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      const searchTerm = searchBar.value.trim();
      emptyMessage.textContent = searchTerm 
        ? `No items found matching "${searchTerm}"`
        : 'No clipboard items yet. Copy some text to get started!';
      clipboardList.appendChild(emptyMessage);
      return;
    }

    items.forEach((item, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'clipboard-item';
      
      const contentElement = document.createElement('div');
      contentElement.className = 'item-content';

      if (item.contentType === 'image') {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'item-image-container';

        const img = document.createElement('img');
        img.className = 'item-image';
        img.src = item.content;
        img.alt = item.alt || 'Copied image';

        const overlay = document.createElement('div');
        overlay.className = 'item-image-overlay';
        overlay.textContent = 'Click to copy';

        imageContainer.appendChild(img);
        imageContainer.appendChild(overlay);
        contentElement.appendChild(imageContainer);
      } else {
        const textElement = document.createElement('div');
        textElement.className = 'item-text';
        textElement.textContent = item.content;
        contentElement.appendChild(textElement);
      }

      const timestampElement = document.createElement('div');
      timestampElement.className = 'item-timestamp';
      timestampElement.textContent = formatTimestamp(item.timestamp);
      contentElement.appendChild(timestampElement);

      const sourceElement = document.createElement('div');
      sourceElement.className = 'item-source';
      sourceElement.textContent = item.title || item.source || '';
      contentElement.appendChild(sourceElement);

      // Add action buttons
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      
      const viewButton = document.createElement('button');
      viewButton.className = 'action-button';
      viewButton.textContent = 'View';
      viewButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.contentType === 'image') {
          window.open(item.content, '_blank');
        } else {
          showTextModal(item.content, item.source, item.title);
        }
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'action-button delete-button';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(index);
      });
      
      actions.appendChild(viewButton);
      actions.appendChild(deleteButton);

      itemElement.appendChild(contentElement);
      itemElement.appendChild(actions);

      // Add click handler for copying
      itemElement.addEventListener('click', () => {
        copyToClipboard(item.content, item.contentType);
      });

      clipboardList.appendChild(itemElement);
    });
  };

  // Show text in modal
  const showTextModal = (content, source = '', title = '') => {
    let displayText = content;
    if (title || source) {
      displayText = `${title ? 'From: ' + title + '\n' : ''}${source ? 'URL: ' + source + '\n' : ''}\n${content}`;
    }
    modalText.textContent = displayText;
    modal.style.display = 'flex';
  };

  // Close modal
  modalClose.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Search functionality with debouncing
  searchBar.addEventListener('input', (e) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      const query = e.target.value;
      const filteredItems = searchItems(query);
      renderClipboardItems(filteredItems);
      updateStats(filteredItems.length);
    }, 300);
  });

  // Clear all items
  clearAllButton.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all clipboard items?')) {
      clipboardItems = [];
      await chrome.storage.local.set({ clipboardItems });
      renderClipboardItems(clipboardItems);
      updateStats();
    }
  });

  // Refresh list
  refreshButton.addEventListener('click', loadClipboardItems);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Close modal with Escape key
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
    }
    // Focus search bar with Ctrl/Cmd + F
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchBar.focus();
    }
  });

  // Initial load
  loadClipboardItems();
});
