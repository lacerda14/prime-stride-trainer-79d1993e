// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LocalCapacitorGoogleAuth",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "LocalCapacitorGoogleAuth", targets: ["CapacitorGoogleAuth"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.0"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "8.0.0"),
    ],
    targets: [
        .target(
            name: "CapacitorGoogleAuth",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
            ],
            path: "Sources/CapacitorGoogleAuth"
        )
    ]
)
