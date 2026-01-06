#!/bin/bash

# Setup script for Memento development environment
# Run this after installing Homebrew

set -e

echo "🍺 Setting up development environment..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew is not installed. Please install it first:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    echo "After installation, add Homebrew to your PATH:"
    echo "   echo 'eval \"\$(/opt/homebrew/bin/brew shellenv)\"' >> ~/.zshrc"
    echo "   source ~/.zshrc"
    exit 1
fi

echo "✅ Homebrew is installed"

# Update Homebrew
echo "📦 Updating Homebrew..."
brew update

# Install Node.js via nvm (Node Version Manager) for better version management
echo "📦 Installing nvm (Node Version Manager)..."
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    echo "✅ nvm installed"
else
    echo "✅ nvm already installed"
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install latest LTS Node.js
echo "📦 Installing Node.js (LTS)..."
nvm install --lts
nvm use --lts
nvm alias default lts/*

# Verify installations
echo ""
echo "🔍 Verifying installations..."
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install useful development tools
echo ""
echo "📦 Installing additional development tools..."

# Install useful CLI tools
brew install \
    gh \
    jq \
    tree \
    wget \
    curl

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Navigate to your project: cd /Users/iani/Documents/GitHub/memento"
echo "2. Install project dependencies: npm install"
echo "3. Start development server: npm run dev"
echo ""
echo "Note: If you open a new terminal, nvm will be available automatically."
echo "      If not, run: source ~/.zshrc"

