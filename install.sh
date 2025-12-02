#!/bin/bash

# PDF-Tools Installation Script for Debian/Ubuntu
# This script installs PDF-Tools and sets it up as a systemd service
# Usage:
#   ./install.sh          - Fresh install or reinstall
#   ./install.sh --update - Update existing installation
#
# Remote usage:
#   curl -fsSL https://raw.githubusercontent.com/IT-BAER/bentopdf/main/install.sh | sudo bash
#   curl -fsSL https://raw.githubusercontent.com/IT-BAER/bentopdf/main/install.sh | sudo bash -s -- --update

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="pdf-tools"
APP_DIR="/opt/$APP_NAME"
APP_USER="pdftools"
APP_PORT="${PDF_TOOLS_PORT:-3000}"
NODE_VERSION="20"
REPO_URL="https://github.com/IT-BAER/bentopdf.git"
RAW_URL="https://raw.githubusercontent.com/IT-BAER/bentopdf/main"

# Parse arguments
UPDATE_MODE=false
for arg in "$@"; do
    case $arg in
        --update|-u)
            UPDATE_MODE=true
            shift
            ;;
        --help|-h)
            echo "PDF-Tools Installation Script"
            echo ""
            echo "Usage (local):"
            echo "  sudo ./install.sh           Fresh install or reinstall"
            echo "  sudo ./install.sh --update  Update existing installation"
            echo "  sudo ./install.sh --help    Show this help message"
            echo ""
            echo "Usage (remote):"
            echo "  curl -fsSL $RAW_URL/install.sh | sudo bash"
            echo "  curl -fsSL $RAW_URL/install.sh | sudo bash -s -- --update"
            echo ""
            echo "Environment variables:"
            echo "  PDF_TOOLS_PORT=3000         Port to run the service on (default: 3000)"
            echo ""
            echo "Examples:"
            echo "  sudo ./install.sh"
            echo "  PDF_TOOLS_PORT=8080 sudo ./install.sh"
            echo "  sudo ./install.sh --update"
            echo "  curl -fsSL $RAW_URL/install.sh | sudo bash -s -- --update"
            exit 0
            ;;
    esac
done

if [ "$UPDATE_MODE" = true ]; then
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                 PDF-Tools Update Script                    ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
else
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║               PDF-Tools Installation Script                ║"
    echo "║         For Debian/Ubuntu (systemd service setup)          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
fi

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
   exit 1
fi

# For update mode, check if app is installed
if [ "$UPDATE_MODE" = true ]; then
    if [ ! -d "$APP_DIR" ]; then
        echo -e "${RED}Error: PDF-Tools is not installed at $APP_DIR${NC}"
        echo -e "${YELLOW}Run without --update flag to perform a fresh installation.${NC}"
        exit 1
    fi
    if [ ! -d "$APP_DIR/.git" ]; then
        echo -e "${RED}Error: $APP_DIR is not a git repository. Cannot update.${NC}"
        echo -e "${YELLOW}Please reinstall PDF-Tools for update capability.${NC}"
        exit 1
    fi
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}Error: Cannot detect OS. This script supports Debian/Ubuntu only.${NC}"
    exit 1
fi

if [[ "$OS" != "debian" && "$OS" != "ubuntu" ]]; then
    echo -e "${RED}Error: This script only supports Debian and Ubuntu.${NC}"
    echo -e "${YELLOW}Detected OS: $OS${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Detected OS: $OS $VERSION${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get current version
get_current_version() {
    if [ -f "$APP_DIR/package.json" ]; then
        grep '"version"' "$APP_DIR/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/'
    else
        echo "unknown"
    fi
}

# ============================================================================
# UPDATE MODE
# ============================================================================
if [ "$UPDATE_MODE" = true ]; then
    echo -e "${BLUE}Checking for updates...${NC}"
    
    cd "$APP_DIR"
    CURRENT_VERSION=$(get_current_version)
    echo -e "Current version: ${YELLOW}v$CURRENT_VERSION${NC}"
    
    # Fetch latest changes
    echo -e "\n${BLUE}[1/4] Fetching latest changes...${NC}"
    sudo -u "$APP_USER" git fetch origin main 2>/dev/null || git fetch origin main
    
    # Check if there are updates
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        echo -e "${GREEN}✓ PDF-Tools is already up to date (v$CURRENT_VERSION)${NC}"
        exit 0
    fi
    
    # Stop service before updating
    echo -e "\n${BLUE}[2/4] Stopping service...${NC}"
    if systemctl is-active --quiet ${APP_NAME} 2>/dev/null; then
        systemctl stop ${APP_NAME}
        echo -e "${GREEN}✓ Service stopped${NC}"
    fi
    
    # Pull latest changes
    echo -e "\n${BLUE}[3/4] Pulling latest changes...${NC}"
    
    # Backup user config if exists
    CONFIG_BACKUP=""
    if [ -f "$APP_DIR/dist/config.js" ]; then
        CONFIG_BACKUP=$(mktemp -t pdf-tools-config.XXXXXX)
        cp "$APP_DIR/dist/config.js" "$CONFIG_BACKUP"
        echo -e "${GREEN}✓ Backed up user config${NC}"
    fi
    
    # Reset local changes and clean untracked files to ensure a clean pull
    if [ -d "$APP_DIR/.git" ]; then
        git stash --quiet 2>/dev/null || true
        git clean -fd --quiet 2>/dev/null || true
        git reset --hard HEAD --quiet 2>/dev/null || true
    fi
    
    # Pull latest
    sudo -u "$APP_USER" git pull origin main 2>/dev/null || git pull origin main
    
    NEW_VERSION=$(get_current_version)
    echo -e "New version: ${GREEN}v$NEW_VERSION${NC}"
    
    # Rebuild
    echo -e "\n${BLUE}[4/4] Rebuilding application...${NC}"
    sudo -u "$APP_USER" npm install --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
    sudo -u "$APP_USER" npm run build 2>/dev/null || npm run build
    
    # Merge user config with new config options
    if [ -n "$CONFIG_BACKUP" ] && [ -f "$CONFIG_BACKUP" ]; then
        NEW_CONFIG="$APP_DIR/dist/config.js"
        MERGED_CONFIG=$(mktemp -t pdf-tools-merged.XXXXXX)
        
        # Extract user's customized values from backup (lines that don't start with // or /*)
        # and merge with new config to add any new options
        if [ -f "$NEW_CONFIG" ]; then
            # Use node to intelligently merge configs
            node -e "
const fs = require('fs');
const oldConfig = fs.readFileSync('$CONFIG_BACKUP', 'utf8');
const newConfig = fs.readFileSync('$NEW_CONFIG', 'utf8');

// Extract the config object from both files
const extractConfig = (content) => {
    const match = content.match(/window\.PDFTOOLS_CONFIG\s*=\s*(\{[\s\S]*?\});/);
    if (match) {
        try {
            // Use eval in a controlled way to parse the object
            return eval('(' + match[1] + ')');
        } catch (e) {
            return null;
        }
    }
    return null;
};

const oldObj = extractConfig(oldConfig);
const newObj = extractConfig(newConfig);

if (oldObj && newObj) {
    // Merge: keep user values, add new keys from new config
    const merged = { ...newObj, ...oldObj };
    
    // Build the merged config file with proper formatting
    let output = '/**\n * PDF-Tools Configuration File\n';
    output += ' * \n';
    output += ' * This file allows server administrators to customize the application.\n';
    output += ' * For instant changes (no rebuild): Edit /opt/pdf-tools/dist/config.js\n';
    output += ' * For permanent changes: Edit public/config.js and rebuild\n';
    output += ' */\n\n';
    output += 'window.PDFTOOLS_CONFIG = {\n';
    
    const entries = Object.entries(merged);
    entries.forEach(([key, value], index) => {
        const comma = index < entries.length - 1 ? ',' : '';
        if (typeof value === 'string') {
            output += '  ' + key + ': \"' + value + '\"' + comma + '\n';
        } else if (value === null) {
            output += '  ' + key + ': null' + comma + '\n';
        } else {
            output += '  ' + key + ': ' + value + comma + '\n';
        }
    });
    
    output += '};\n';
    
    fs.writeFileSync('$MERGED_CONFIG', output);
    console.log('merged');
} else {
    // Fallback: just use old config
    fs.copyFileSync('$CONFIG_BACKUP', '$MERGED_CONFIG');
    console.log('fallback');
}
" 2>/dev/null && MERGE_RESULT=$? || MERGE_RESULT=1
            
            if [ -f "$MERGED_CONFIG" ] && [ -s "$MERGED_CONFIG" ]; then
                cp "$MERGED_CONFIG" "$APP_DIR/dist/config.js"
                rm "$MERGED_CONFIG"
                rm "$CONFIG_BACKUP"
                echo -e "${GREEN}✓ Merged user config with new options${NC}"
            else
                # Fallback: restore old config as-is
                cp "$CONFIG_BACKUP" "$APP_DIR/dist/config.js"
                rm "$CONFIG_BACKUP"
                echo -e "${YELLOW}Note: Restored user config (new options may need to be added manually)${NC}"
            fi
        else
            # No new config, just restore old one
            cp "$CONFIG_BACKUP" "$APP_DIR/dist/config.js"
            rm "$CONFIG_BACKUP"
            echo -e "${GREEN}✓ Restored user config${NC}"
        fi
    fi
    
    # Fix permissions
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    
    # Start service
    systemctl start ${APP_NAME}
    
    # Wait a moment for the service to start
    sleep 2
    
    if systemctl is-active --quiet ${APP_NAME}; then
        echo -e "\n${GREEN}"
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║              PDF-Tools Update Complete!                    ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        echo -e "Updated from ${YELLOW}v$CURRENT_VERSION${NC} to ${GREEN}v$NEW_VERSION${NC}"
        echo -e "${GREEN}✓ Service is running on port ${APP_PORT}${NC}"
    else
        echo -e "\n${RED}Warning: Service may not have started correctly.${NC}"
        echo -e "${YELLOW}Check status with: sudo systemctl status ${APP_NAME}${NC}"
    fi
    
    exit 0
fi

# ============================================================================
# FRESH INSTALLATION
# ============================================================================

# Step 1: Update system packages
echo -e "\n${BLUE}[1/7] Updating system packages...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

# Step 2: Install dependencies
echo -e "\n${BLUE}[2/7] Installing dependencies...${NC}"
apt-get install -y -qq curl git build-essential

# Step 3: Install Node.js
echo -e "\n${BLUE}[3/7] Installing Node.js v${NODE_VERSION}...${NC}"
if command_exists node; then
    CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE_VERSION" -ge "$NODE_VERSION" ]; then
        echo -e "${GREEN}✓ Node.js $(node -v) is already installed${NC}"
    else
        echo -e "${YELLOW}Upgrading Node.js from v$CURRENT_NODE_VERSION to v$NODE_VERSION...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y -qq nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
fi
echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"
echo -e "${GREEN}✓ npm $(npm -v) installed${NC}"

# Step 4: Create application user
echo -e "\n${BLUE}[4/7] Creating application user...${NC}"
if id "$APP_USER" &>/dev/null; then
    echo -e "${GREEN}✓ User '$APP_USER' already exists${NC}"
else
    useradd --system --shell /bin/false --home-dir "$APP_DIR" "$APP_USER"
    echo -e "${GREEN}✓ User '$APP_USER' created${NC}"
fi

# Step 5: Clone/Update repository and build
echo -e "\n${BLUE}[5/7] Setting up PDF-Tools...${NC}"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}Directory $APP_DIR exists. Updating...${NC}"
    cd "$APP_DIR"
    
    # Check if it's a git repo
    if [ -d ".git" ]; then
        sudo -u "$APP_USER" git pull origin main 2>/dev/null || git pull origin main
    fi
else
    # Clone from GitHub
    git clone "$REPO_URL" "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

cd "$APP_DIR"

# Install dependencies and build
echo -e "${BLUE}Installing npm dependencies...${NC}"
sudo -u "$APP_USER" npm install --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

echo -e "${BLUE}Building application...${NC}"
sudo -u "$APP_USER" npm run build 2>/dev/null || npm run build

# Fix permissions
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo -e "${GREEN}✓ PDF-Tools built successfully${NC}"

# Step 6: Install serve globally for static file serving
echo -e "\n${BLUE}[6/7] Installing serve for static file hosting...${NC}"
npm install -g serve
echo -e "${GREEN}✓ serve installed globally${NC}"

# Step 7: Create systemd service
echo -e "\n${BLUE}[7/7] Creating systemd service...${NC}"

SERVE_PATH=$(which serve)
if [ -z "$SERVE_PATH" ] || [ ! -x "$SERVE_PATH" ]; then
    echo -e "${RED}Error: serve binary not found or not executable. Please ensure npm install completed successfully.${NC}"
    exit 1
fi

cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=PDF-Tools - Privacy-first PDF toolkit
Documentation=https://github.com/IT-BAER/bentopdf
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/dist
ExecStart=$SERVE_PATH . -l $APP_PORT
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$APP_NAME
Environment=NODE_ENV=production

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable ${APP_NAME}.service
systemctl start ${APP_NAME}.service

echo -e "${GREEN}✓ Systemd service created and started${NC}"

# Wait a moment for the service to start
sleep 2

# Check service status
if systemctl is-active --quiet ${APP_NAME}; then
    echo -e "\n${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║            PDF-Tools Installation Complete!                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${GREEN}✓ PDF-Tools is running on port ${APP_PORT}${NC}"
    echo -e "${GREEN}✓ Access it at: http://localhost:${APP_PORT}${NC}"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "  sudo systemctl status ${APP_NAME}    # Check status"
    echo "  sudo systemctl restart ${APP_NAME}   # Restart service"
    echo "  sudo systemctl stop ${APP_NAME}      # Stop service"
    echo "  sudo systemctl start ${APP_NAME}     # Start service"
    echo "  sudo journalctl -u ${APP_NAME} -f    # View logs"
    echo ""
    echo -e "${BLUE}Installation directory:${NC} $APP_DIR"
    echo -e "${BLUE}Service file:${NC} /etc/systemd/system/${APP_NAME}.service"
    echo ""
    echo -e "${YELLOW}To change the port, edit the service file and restart:${NC}"
    echo "  sudo nano /etc/systemd/system/${APP_NAME}.service"
    echo "  sudo systemctl daemon-reload && sudo systemctl restart ${APP_NAME}"
else
    echo -e "\n${RED}Warning: Service may not have started correctly.${NC}"
    echo -e "${YELLOW}Check status with: sudo systemctl status ${APP_NAME}${NC}"
    echo -e "${YELLOW}Check logs with: sudo journalctl -u ${APP_NAME} -f${NC}"
fi
