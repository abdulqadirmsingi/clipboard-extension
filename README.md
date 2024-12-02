# Clipboard Manager Extension

A modern browser extension that helps you manage your clipboard history with a clean, minimal interface.

## Features

- Automatically saves text copied to clipboard
- Clean black & white interface
- Search through clipboard history
- One-click copy of saved items
- Enable/disable clipboard tracking
- Clear individual or all clipboard items

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `extension` folder

## Usage

1. Click the extension icon in your browser toolbar to open the popup
2. Copy text normally - it will be automatically saved
3. Use the search bar to find specific items
4. Click any item to copy it back to your clipboard
5. Use the toggle switch to enable/disable clipboard tracking
6. Click "Clear All" to remove all saved items

## Development

### Extension Structure
- `manifest.json`: Extension configuration
- `popup.html`: Main UI
- `popup.js`: UI interactions
- `background.js`: Clipboard monitoring

### Backend Setup (Coming Soon)
- Node.js server for cross-device sync
- PostgreSQL database for storage
- RESTful API endpoints

## Security

- All clipboard data is stored locally in your browser
- No data is sent to external servers (in current version)
- You can clear your clipboard history at any time

## Contributing

Feel free to submit issues and pull requests.

## License

MIT
