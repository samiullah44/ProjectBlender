#!/bin/bash

# Configuration
DOCS_DIR="/home/ubuntu/render/docs"
FRONTEND_DIR="/home/ubuntu/render/frontend"
LOG_DIR="/home/ubuntu/render/logs"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

# Ensure log directory exists
mkdir -p $LOG_DIR

echo "------------------------------------------" | tee -a "$LOG_DIR/deploy-docs.log"
echo "🚀 Starting Automated Docs Deployment: $DATE" | tee -a "$LOG_DIR/deploy-docs.log"
echo "------------------------------------------" | tee -a "$LOG_DIR/deploy-docs.log"

# Navigate to docs directory
cd $DOCS_DIR || { echo "❌ Error: Could not find $DOCS_DIR"; exit 1; }

# Install dependencies and build
echo "📦 Installing docs dependencies..." | tee -a "$LOG_DIR/deploy-docs.log"
npm install >> "$LOG_DIR/deploy-docs.log" 2>&1

echo "🏗️  Building Docusaurus static site..." | tee -a "$LOG_DIR/deploy-docs.log"
npm run build >> "$LOG_DIR/deploy-docs.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Docs Build Successful!" | tee -a "$LOG_DIR/deploy-docs.log"
    
    # Reload Nginx to ensure everything is fresh (though not strictly necessary for static files)
    # sudo systemctl reload nginx
    
    echo "✨ Deployment Complete! Live at https://www.renderonnodes.com/docs" | tee -a "$LOG_DIR/deploy-docs.log"
else
    echo "❌ Error: Building Docusaurus failed. Check $LOG_DIR/deploy-docs.log" | tee -a "$LOG_DIR/deploy-docs.log"
    exit 1
fi
