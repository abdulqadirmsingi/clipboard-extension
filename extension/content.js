// Function to get selected text with formatting
function getSelectedText() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return '';

    // Try to get HTML content if available
    const container = document.createElement('div');
    const range = selection.getRangeAt(0);
    container.appendChild(range.cloneContents());
    
    // Check if there's an image in the selection
    const images = container.getElementsByTagName('img');
    if (images.length > 0) {
        return {
            type: 'image',
            content: images[0].src,
            alt: images[0].alt || ''
        };
    }
    
    // Return text content
    return {
        type: 'text',
        content: container.innerHTML || selection.toString()
    };
}

// Function to handle copy event
function handleCopy(e) {
    const selectedContent = getSelectedText();
    
    if (selectedContent) {
        chrome.runtime.sendMessage({
            type: 'CLIPBOARD_COPY',
            content: selectedContent.content,
            contentType: selectedContent.type,
            source: window.location.href,
            title: document.title,
            alt: selectedContent.alt
        });
    }
}

// Listen for copy events
document.addEventListener('copy', handleCopy);

// Listen for keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Check for Ctrl+C (Windows) or Cmd+C (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        handleCopy(e);
    }
});

// Listen for context menu copy
document.addEventListener('contextmenu', (e) => {
    const selectedContent = getSelectedText();
    if (selectedContent) {
        // Store the selected content temporarily
        window._clipboardManagerSelectedContent = selectedContent;
        
        // Clean up after a short delay
        setTimeout(() => {
            delete window._clipboardManagerSelectedContent;
        }, 1000);
    }
});
