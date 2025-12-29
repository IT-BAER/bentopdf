#!/bin/bash

# PDF-Tools Installation Script for Debian/Ubuntu
# Downloads pre-built releases from GitHub - no build required!
#
# Usage:
#   ./install.sh              - Fresh install (latest release)
#   ./install.sh --update     - Update existing installation
#   ./install.sh --force      - Force reinstall/update
#   ./install.sh --version    - Show installed version
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
NC='\033[0m'

# Configuration
APP_NAME="pdf-tools"
APP_DIR="/opt/$APP_NAME"
APP_USER="pdftools"
APP_PORT="${PDF_TOOLS_PORT:-3000}"
GITHUB_REPO="IT-BAER/bentopdf"
GITHUB_API="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"

# Parse arguments
UPDATE_MODE=false
FORCE_MODE=false
VERSION_MODE=false

for arg in "$@"; do
    case $arg in
        --update|-u) UPDATE_MODE=true; shift ;;
        --force|-f) FORCE_MODE=true; shift ;;
        --version|-v) VERSION_MODE=true; shift ;;
        --help|-h)
            echo "PDF-Tools Installation Script (Pre-built Release)"
            echo ""
            echo "Usage:"
            echo "  sudo ./install.sh             Fresh install (latest release)"
            echo "  sudo ./install.sh --update    Update existing installation"
            echo "  sudo ./install.sh --force     Force reinstall/update"
            echo "  sudo ./install.sh --version   Show installed version"
            echo ""
            echo "Remote usage:"
            echo "  curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | sudo bash"
            echo "  curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | sudo bash -s -- --update"
            echo ""
            echo "Environment variables:"
            echo "  PDF_TOOLS_PORT=3000           Port to run the service on (default: 3000)"
            exit 0
            ;;
    esac
done

# Version check mode
if [ "$VERSION_MODE" = true ]; then
    if [ -f "$APP_DIR/version.txt" ]; then
        echo "Installed version: $(cat $APP_DIR/version.txt)"
    else
        echo "PDF-Tools not installed or version unknown"
    fi
    exit 0
fi

# Header
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
    echo "║         Downloads pre-built release - no build needed!     ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
fi

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Error: Cannot detect OS. This script supports Debian/Ubuntu only.${NC}"
    exit 1
fi

if [[ "$OS" != "debian" && "$OS" != "ubuntu" ]]; then
    echo -e "${RED}Error: This script only supports Debian and Ubuntu.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Detected OS: $OS${NC}"

# Function to get latest release info
get_latest_release() {
    curl -s "$GITHUB_API"
}

# Function to get current version
get_current_version() {
    if [ -f "$APP_DIR/version.txt" ]; then
        cat "$APP_DIR/version.txt"
    else
        echo "unknown"
    fi
}

# ============================================================================
# UPDATE MODE
# ============================================================================
if [ "$UPDATE_MODE" = true ]; then
    if [ ! -d "$APP_DIR" ]; then
        echo -e "${RED}Error: PDF-Tools is not installed at $APP_DIR${NC}"
        echo -e "${YELLOW}Run without --update flag for fresh installation.${NC}"
        exit 1
    fi

    CURRENT_VERSION=$(get_current_version)
    echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"

    echo -e "\n${BLUE}[1/3] Checking for updates...${NC}"
    RELEASE_INFO=$(get_latest_release)
    LATEST_VERSION=$(echo "$RELEASE_INFO" | grep -Po '"tag_name": "\K[^"]+')
    
    if [ -z "$LATEST_VERSION" ]; then
        echo -e "${RED}Error: Could not fetch latest release from GitHub${NC}"
        exit 1
    fi

    echo -e "Latest version: ${GREEN}$LATEST_VERSION${NC}"

    if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ] && [ "$FORCE_MODE" = false ]; then
        echo -e "${GREEN}✓ PDF-Tools is already up to date${NC}"
        exit 0
    fi

    # Stop service
    echo -e "\n${BLUE}[2/3] Stopping service...${NC}"
    if systemctl is-active --quiet ${APP_NAME} 2>/dev/null; then
        systemctl stop ${APP_NAME}
        echo -e "${GREEN}✓ Service stopped${NC}"
    fi

    # Backup user config from public folder (if exists) - this is the persistent location
    CONFIG_BACKUP=""
    if [ -f "$APP_DIR/public/config.js" ]; then
        CONFIG_BACKUP="$APP_DIR/public/config.js"
        echo -e "${GREEN}✓ User config found at $APP_DIR/public/config.js (will be preserved)${NC}"
    elif [ -f "$APP_DIR/dist/config.js" ]; then
        # Fallback: backup dist config if no public config exists
        CONFIG_BACKUP=$(mktemp)
        cp "$APP_DIR/dist/config.js" "$CONFIG_BACKUP"
        echo -e "${GREEN}✓ Backed up dist/config.js${NC}"
    fi

    # Download and extract
    echo -e "\n${BLUE}[3/3] Downloading $LATEST_VERSION...${NC}"
    DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep -Po '"browser_download_url": "\K[^"]+\.tar\.gz' | head -1)
    
    if [ -z "$DOWNLOAD_URL" ]; then
        echo -e "${RED}Error: Could not find release archive${NC}"
        exit 1
    fi

    # Download to temp and extract
    TEMP_DIR=$(mktemp -d)
    curl -sL "$DOWNLOAD_URL" | tar -xz -C "$TEMP_DIR"
    
    # Replace dist folder
    rm -rf "$APP_DIR/dist"
    mv "$TEMP_DIR" "$APP_DIR/dist"
    
    # Save version
    echo "$LATEST_VERSION" > "$APP_DIR/version.txt"

    # Restore config - prioritize user config from public folder
    if [ -f "$APP_DIR/public/config.js" ]; then
        # Copy user config from public to dist (where serve looks for it)
        cp "$APP_DIR/public/config.js" "$APP_DIR/dist/config.js"
        echo -e "${GREEN}✓ Applied user config from public/config.js${NC}"
    elif [ -n "$CONFIG_BACKUP" ] && [ -f "$CONFIG_BACKUP" ]; then
        # Restore from backup (legacy case)
        cp "$CONFIG_BACKUP" "$APP_DIR/dist/config.js"
        rm -f "$CONFIG_BACKUP"
        echo -e "${GREEN}✓ Restored config.js from backup${NC}"
    fi

    # Fix permissions
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"

    # Start service
    systemctl start ${APP_NAME}
    sleep 2

    if systemctl is-active --quiet ${APP_NAME}; then
        echo -e "\n${GREEN}"
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║              PDF-Tools Update Complete!                    ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        echo -e "Updated from ${YELLOW}$CURRENT_VERSION${NC} to ${GREEN}$LATEST_VERSION${NC}"
        echo -e "${GREEN}✓ Service is running on port ${APP_PORT}${NC}"
    else
        echo -e "\n${RED}Warning: Service may not have started correctly.${NC}"
        echo -e "${YELLOW}Check: sudo systemctl status ${APP_NAME}${NC}"
    fi

    exit 0
fi

# ============================================================================
# FRESH INSTALLATION
# ============================================================================

# Step 1: Install dependencies
echo -e "\n${BLUE}[1/5] Installing dependencies...${NC}"
apt-get update -qq
apt-get install -y -qq curl

# Step 2: Install Node.js (for serve)
echo -e "\n${BLUE}[2/5] Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"

# Step 3: Install serve
echo -e "\n${BLUE}[3/5] Installing serve...${NC}"
npm install -g serve
echo -e "${GREEN}✓ serve installed${NC}"

# Step 4: Create user and download release
echo -e "\n${BLUE}[4/5] Downloading latest release...${NC}"

# Create user
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /bin/false --home-dir "$APP_DIR" "$APP_USER"
    echo -e "${GREEN}✓ User '$APP_USER' created${NC}"
fi

# Get latest release
RELEASE_INFO=$(get_latest_release)
LATEST_VERSION=$(echo "$RELEASE_INFO" | grep -Po '"tag_name": "\K[^"]+')
DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep -Po '"browser_download_url": "\K[^"]+\.tar\.gz' | head -1)

if [ -z "$DOWNLOAD_URL" ]; then
    echo -e "${RED}Error: Could not find release archive${NC}"
    exit 1
fi

echo -e "Downloading ${GREEN}$LATEST_VERSION${NC}..."

# Create directories
mkdir -p "$APP_DIR/dist"
mkdir -p "$APP_DIR/public"

# Download and extract
curl -sL "$DOWNLOAD_URL" | tar -xz -C "$APP_DIR/dist"

# Create default public/config.js for user customizations
if [ ! -f "$APP_DIR/public/config.js" ]; then
    cp "$APP_DIR/dist/config.js" "$APP_DIR/public/config.js"
    echo -e "${GREEN}✓ Created public/config.js for customizations${NC}"
fi

# Save version
echo "$LATEST_VERSION" > "$APP_DIR/version.txt"

# Fix permissions
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
echo -e "${GREEN}✓ Downloaded and extracted${NC}"

# Step 5: Create systemd service
echo -e "\n${BLUE}[5/5] Creating systemd service...${NC}"

SERVE_PATH=$(which serve)

cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=PDF-Tools - Privacy-first PDF toolkit
Documentation=https://github.com/${GITHUB_REPO}
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

systemctl daemon-reload
systemctl enable ${APP_NAME}.service
systemctl start ${APP_NAME}.service

echo -e "${GREEN}✓ Service created and started${NC}"

# Wait and check
sleep 2

if systemctl is-active --quiet ${APP_NAME}; then
    echo -e "\n${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║            PDF-Tools Installation Complete!                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${GREEN}✓ PDF-Tools $LATEST_VERSION running on port ${APP_PORT}${NC}"
    echo -e "${GREEN}✓ Access at: http://localhost:${APP_PORT}${NC}"
    echo ""
    echo -e "${BLUE}Customization:${NC}"
    echo "  Edit: $APP_DIR/public/config.js"
    echo "  Then: sudo systemctl restart ${APP_NAME}"
    echo ""
    echo -e "${BLUE}Commands:${NC}"
    echo "  sudo systemctl status ${APP_NAME}     # Check status"
    echo "  sudo systemctl restart ${APP_NAME}    # Restart"
    echo "  sudo journalctl -u ${APP_NAME} -f     # View logs"
    echo ""
    echo -e "${BLUE}Update:${NC}"
    echo "  curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | sudo bash -s -- --update"
else
    echo -e "\n${RED}Warning: Service may not have started correctly.${NC}"
    echo -e "${YELLOW}Check: sudo systemctl status ${APP_NAME}${NC}"
fi
