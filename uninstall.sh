#!/bin/bash

# PDF-Tools Uninstallation Script for Debian/Ubuntu
# This script removes PDF-Tools and its systemd service

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

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              PDF-Tools Uninstallation Script               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
   exit 1
fi

echo -e "${YELLOW}This will remove PDF-Tools from your system.${NC}"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Uninstallation cancelled.${NC}"
    exit 0
fi

# Step 1: Stop and disable systemd service
echo -e "\n${BLUE}[1/4] Stopping and disabling service...${NC}"
if systemctl is-active --quiet ${APP_NAME} 2>/dev/null; then
    systemctl stop ${APP_NAME}
    echo -e "${GREEN}✓ Service stopped${NC}"
fi

if systemctl is-enabled --quiet ${APP_NAME} 2>/dev/null; then
    systemctl disable ${APP_NAME}
    echo -e "${GREEN}✓ Service disabled${NC}"
fi

# Step 2: Remove systemd service file
echo -e "\n${BLUE}[2/4] Removing service file...${NC}"
if [ -f /etc/systemd/system/${APP_NAME}.service ]; then
    rm /etc/systemd/system/${APP_NAME}.service
    systemctl daemon-reload
    echo -e "${GREEN}✓ Service file removed${NC}"
else
    echo -e "${YELLOW}Service file not found (already removed?)${NC}"
fi

# Step 3: Remove application directory
echo -e "\n${BLUE}[3/4] Removing application files...${NC}"
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
    echo -e "${GREEN}✓ Application directory removed${NC}"
else
    echo -e "${YELLOW}Application directory not found${NC}"
fi

# Step 4: Remove application user
echo -e "\n${BLUE}[4/4] Removing application user...${NC}"
if id "$APP_USER" &>/dev/null; then
    userdel "$APP_USER" 2>/dev/null || true
    echo -e "${GREEN}✓ User '$APP_USER' removed${NC}"
else
    echo -e "${YELLOW}User '$APP_USER' not found${NC}"
fi

echo -e "\n${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           PDF-Tools Uninstallation Complete!               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}Note:${NC} Node.js and npm were not removed."
echo "To remove them manually: sudo apt-get remove nodejs npm"
echo ""
echo -e "${BLUE}Note:${NC} The 'serve' package was not removed."
echo "To remove it manually: sudo npm uninstall -g serve"
