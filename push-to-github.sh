#!/bin/bash
# Push to GitHub script

echo "To push this to GitHub, run these commands:"
echo ""
echo "1. Create a new repo on GitHub: https://github.com/new"
echo "   Name it: agentic-practice-mgmt"
echo "   Make it public or private"
echo ""
echo "2. Then run:"
echo "   cd /home/digitalrebel/.openclaw/workspace/agentic-practice-mgmt"
echo "   git remote add origin https://github.com/YOUR_USERNAME/agentic-practice-mgmt.git"
echo "   git push -u origin main"
echo ""
echo "Or use GitHub CLI:"
echo "   gh repo create agentic-practice-mgmt --public --source=. --push"
