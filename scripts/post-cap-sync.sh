#!/bin/bash
# Run after `npx cap sync ios` to restore GoogleSignIn-iOS dependency
PKG="ios/App/CapApp-SPM/Package.swift"

# Add GoogleSignIn to dependencies if missing
if ! grep -q "GoogleSignIn-iOS" "$PKG"; then
  sed -i '' 's|.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git".*,|&\n        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "8.0.0"),|' "$PKG"
  sed -i '' 's|.product(name: "Cordova", package: "capacitor-swift-pm"),|&\n                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),|' "$PKG"
  echo "GoogleSignIn-iOS restored in Package.swift"
else
  echo "GoogleSignIn-iOS already present"
fi
