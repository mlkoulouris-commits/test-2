# VS Code Background Watermark Setup Guide

This guide explains how to set up and configure a background watermark in VS Code to help distinguish between different projects. A watermark can display your project name, logo, or any custom image in various areas of VS Code.

## Overview

A watermark provides a subtle visual indicator of which project you're working on. You can display text (like your project name), logos, or custom images in different areas of VS Code:
- Editor area
- Sidebar
- Bottom panel (terminal area)
- Fullscreen mode

## Prerequisites

1. **Install the Background Extension**
   - Open VS Code Extensions (`Cmd+Shift+X` or `Ctrl+Shift+X`)
   - Search for "background"
   - Install "Background" by shalldie (version 2.0.3 or later)

## Quick Start

### Step 1: Create Your Watermark Images

Create two SVG files - one for light themes and one for dark themes:

**Light Theme** (`.vscode/watermark-light.svg`) - Black text:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <text 
    x="50%" 
    y="50%" 
    font-family="Arial, sans-serif" 
    font-size="180" 
    font-weight="bold" 
    fill="#000000" 
    opacity="0.15" 
    text-anchor="middle" 
    dominant-baseline="middle"
    transform="rotate(0 600 400)">
    YOUR_PROJECT_NAME
  </text>
</svg>
```

**Dark Theme** (`.vscode/watermark-dark.svg`) - White text:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <text 
    x="50%" 
    y="50%" 
    font-family="Arial, sans-serif" 
    font-size="180" 
    font-weight="bold" 
    fill="#FFFFFF" 
    opacity="0.15" 
    text-anchor="middle" 
    dominant-baseline="middle"
    transform="rotate(0 600 400)">
    YOUR_PROJECT_NAME
  </text>
</svg>
```

Replace `YOUR_PROJECT_NAME` with your actual project name in both files.

### Step 2: Convert SVGs to Base64

Encode both SVG files to base64:

```bash
# Light theme version
cat .vscode/watermark-light.svg | base64 | tr -d '\n'

# Dark theme version
cat .vscode/watermark-dark.svg | base64 | tr -d '\n'
```

Copy both outputs.

### Step 3: Configure VS Code Settings

Add the following to your `.vscode/settings.json`. Choose the version that matches your current theme:

**For Light Themes:**
```json
{
  "background.enabled": true,
  "background.panel": {
    "useFront": true,
    "opacity": 0.15,
    "images": [
      "data:image/svg+xml;base64,LIGHT_THEME_BASE64_HERE"
    ]
  }
}
```

**For Dark Themes:**
```json
{
  "background.enabled": true,
  "background.panel": {
    "useFront": true,
    "opacity": 0.15,
    "images": [
      "data:image/svg+xml;base64,DARK_THEME_BASE64_HERE"
    ]
  }
}
```

**Tip**: You can keep both configurations commented in your settings and uncomment the one you need when switching themes.

### Step 4: Reload VS Code

Reload VS Code (`Cmd+Shift+P` → "Developer: Reload Window") to see your watermark.

## Configuration Options

### Available Sections

The Background extension supports four different sections:

- `background.sidebar` - Sidebar area
- `background.editor` - Main editor area
- `background.panel` - Bottom panel (terminal, output, etc.)
- `background.fullscreen` - Fullscreen mode

### Common Settings

- **`useFront`**: `true` displays the image as a watermark overlay, `false` places it behind content
- **`opacity`**: Controls visibility (0.0 = invisible, 1.0 = fully opaque)
- **`images`**: Array of image URLs or file paths
- **`interval`**: Time in seconds between image changes (0 = no rotation)
- **`random`**: `true` to randomize image order

### Style Options

You can customize the appearance with CSS-like styles:

```json
"style": {
  "background-position": "center",
  "background-size": "contain",
  "background-repeat": "no-repeat",
  "opacity": 0.15
}
```

## Customizing the Watermark

### Using Local SVG Files

1. Create or modify `.vscode/watermark-light.svg` and `.vscode/watermark-dark.svg`
2. Encode them to base64:
   ```bash
   # Light theme
   cat .vscode/watermark-light.svg | base64 | tr -d '\n'
   
   # Dark theme
   cat .vscode/watermark-dark.svg | base64 | tr -d '\n'
   ```
3. Update `settings.json` with the appropriate data URI:
   ```json
   "images": [
     "data:image/svg+xml;base64,YOUR_BASE64_STRING_HERE"
   ]
   ```
   
   **Note**: Use the light version base64 for light themes, dark version for dark themes.

### Using a Web Image

Simply use the image URL:

```json
"images": [
  "https://example.com/path/to/image.png"
]
```

### Adjusting Opacity

To make the watermark more or less visible, adjust the `opacity` value:

- `0.05` - Very subtle (barely visible)
- `0.15` - Recommended (subtle but visible)
- `0.25` - More visible
- `0.5` - Quite visible
- `1.0` - Fully opaque

**Tip**: Start with `0.15` and adjust based on your preference and theme.

### Changing Location

To move the watermark to a different area, change the section:

```json
// For editor area
"background.editor": { ... }

// For sidebar
"background.sidebar": { ... }

// For bottom panel (terminal area)
"background.panel": { ... }
```

## Theme-Specific Watermarks

### Why Two Versions?

VS Code doesn't automatically switch watermarks based on theme, so it's recommended to create separate versions:

- **Light Theme Watermark**: Use black text (`fill="#000000"`) - visible on light backgrounds
- **Dark Theme Watermark**: Use white text (`fill="#FFFFFF"`) - visible on dark backgrounds

### Switching Between Themes

When you change VS Code themes, update your `settings.json`:

1. **Light Theme**: Use the base64 from `watermark-light.svg`
2. **Dark Theme**: Use the base64 from `watermark-dark.svg`

You can keep both configurations in your settings file (one commented out) for easy switching:

```json
{
  // Light theme version (currently active)
  "background.panel": {
    "useFront": true,
    "opacity": 0.15,
    "images": ["data:image/svg+xml;base64,LIGHT_BASE64"]
  }
  
  // Dark theme version (uncomment to use)
  // "background.panel": {
  //   "useFront": true,
  //   "opacity": 0.15,
  //   "images": ["data:image/svg+xml;base64,DARK_BASE64"]
  // }
}
```

## Editing the SVG Watermark

The watermark SVG files are located at:
- `.vscode/watermark-light.svg` (for light themes)
- `.vscode/watermark-dark.svg` (for dark themes)

You can customize:

- **Text**: Change the text content to your project name or any text
- **Font size**: Adjust `font-size` (default: 180, adjust based on text length)
- **Font family**: Change `font-family` to use different fonts
- **Rotation**: Change `rotate(0 600 400)` - first number is degrees (0 = straight, negative = counter-clockwise)
- **Opacity**: Change `opacity` value in the SVG (default: 0.15)
- **Color**: Change `fill` value:
  - `#000000` - Black (for light themes)
  - `#FFFFFF` - White (for dark themes)
  - Any hex color code

**Important**: After editing either SVG file, regenerate the base64 and update `settings.json` with the new base64 string.

## Troubleshooting

### Watermark Not Visible

1. **Reload VS Code**: `Cmd+Shift+P` → "Developer: Reload Window"
2. **Check Extension**: Ensure "Background" extension is installed and enabled
3. **Check Status Bar**: Look for the "Background" button in bottom-right status bar
4. **Verify Settings**: Ensure `background.enabled` is `true`

### Using File Paths Instead of Data URI

If you prefer using file paths instead of data URIs:

```json
"images": [
  "${workspaceFolder}/.vscode/watermark.svg"
]
```

Or with absolute path:

```json
"images": [
  "/absolute/path/to/watermark.svg"
]
```

Note: Data URIs are more reliable as they don't depend on file path resolution.

## Example Configurations

### Text Watermark in Bottom Panel (Recommended)

```json
{
  "background.enabled": true,
  "background.panel": {
    "useFront": true,
    "opacity": 0.15,
    "images": ["data:image/svg+xml;base64,YOUR_BASE64_HERE"]
  }
}
```

### Logo/Image in Editor

```json
{
  "background.enabled": true,
  "background.editor": {
    "useFront": false,
    "opacity": 0.1,
    "style": {
      "background-position": "bottom right",
      "background-size": "200px",
      "opacity": 0.1
    },
    "images": ["https://example.com/logo.png"]
  }
}
```

### Multiple Images with Rotation

```json
{
  "background.enabled": true,
  "background.panel": {
    "useFront": true,
    "opacity": 0.2,
    "images": [
      "data:image/svg+xml;base64,IMAGE1_BASE64",
      "data:image/svg+xml;base64,IMAGE2_BASE64"
    ],
    "interval": 30,
    "random": true
  }
}
```

## Quick Reference

- **Extension**: Background by shalldie
- **Recommended Location**: Bottom panel (`background.panel`)
- **Recommended Opacity**: 0.15
- **File Format**: SVG (best for text) or PNG/JPG (for images)
- **Encoding**: Base64 data URI (most reliable)
- **Theme Support**: Create separate versions for light (`watermark-light.svg`) and dark (`watermark-dark.svg`) themes
- **Light Theme**: Use black text (`fill="#000000"`)
- **Dark Theme**: Use white text (`fill="#FFFFFF"`)

## Resources

- [Background Extension GitHub](https://github.com/shalldie/vscode-background)
- [VS Code Settings Documentation](https://code.visualstudio.com/docs/getstarted/settings)
