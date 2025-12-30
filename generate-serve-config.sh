#!/bin/bash
#
# Generate serve.json from config.js settings
# Run this after changing allowedFrameOrigins in config.js
#
# Usage: ./generate-serve-config.sh [path-to-dist]
#
# Example: ./generate-serve-config.sh /opt/pdf-tools/dist
#

set -e

# Default to current directory or provided path
DIST_DIR="${1:-.}"

# Check if config.js exists
if [ ! -f "$DIST_DIR/config.js" ]; then
    echo "Error: config.js not found in $DIST_DIR"
    exit 1
fi

# Extract allowedFrameOrigins from config.js using Node.js
FRAME_ORIGINS=$(node -e "
  const fs = require('fs');
  const configContent = fs.readFileSync('$DIST_DIR/config.js', 'utf8');
  
  // Extract the config object
  const match = configContent.match(/allowedFrameOrigins:\s*\[(.*?)\]/s);
  if (!match) {
    console.log('');
    process.exit(0);
  }
  
  // Parse the array
  const arrayContent = match[1].trim();
  if (!arrayContent) {
    console.log('');
    process.exit(0);
  }
  
  // Extract quoted strings
  const origins = arrayContent.match(/['\"]([^'\"]+)['\"]/g);
  if (!origins) {
    console.log('');
    process.exit(0);
  }
  
  // Clean up and output
  const cleaned = origins.map(o => o.replace(/['\"]|/g, '')).join(' ');
  console.log(cleaned);
" 2>/dev/null || echo "")

# Determine frame-ancestors value
if [ -z "$FRAME_ORIGINS" ]; then
    FRAME_POLICY="frame-ancestors 'self'"
else
    FRAME_POLICY="frame-ancestors 'self' $FRAME_ORIGINS"
fi

echo "Frame policy: $FRAME_POLICY"

# Generate serve.json
cat > "$DIST_DIR/serve.json" << EOF
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/en/:path", "destination": "/:path.html" },
    { "source": "/de/:path", "destination": "/:path.html" },
    { "source": "/zh/:path", "destination": "/:path.html" },
    { "source": "/vi/:path", "destination": "/:path.html" },
    { "source": "/en", "destination": "/index.html" },
    { "source": "/de", "destination": "/index.html" },
    { "source": "/zh", "destination": "/index.html" },
    { "source": "/vi", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "config.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, no-cache, must-revalidate"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    },
    {
      "source": "**/*",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        },
        {
          "key": "Content-Security-Policy",
          "value": "$FRAME_POLICY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
EOF

echo "Generated $DIST_DIR/serve.json successfully"
echo ""
echo "To apply changes, restart your service:"
echo "  sudo systemctl restart pdf-tools"
