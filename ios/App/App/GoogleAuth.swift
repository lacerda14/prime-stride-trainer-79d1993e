import Foundation
import Capacitor
import GoogleSignIn

@objc(GoogleAuth)
public class GoogleAuth: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleAuth"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    private var additionalScopes: [String] = []
    private var forceAuthCode: Bool = false

    public override func load() {
        if let clientId = resolveClientId() {
            configure(clientId: clientId)
        }
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleOpenUrl(_:)),
            name: Notification.Name.capacitorOpenURL,
            object: nil
        )
    }

    @objc public func initialize(_ call: CAPPluginCall) {
        let clientId = call.getString("clientId") ?? resolveClientId()
        guard let clientId = clientId else {
            call.resolve()
            return
        }
        configure(clientId: clientId)
        if let scopes = call.getArray("scopes", String.self) {
            applyAdditionalScopes(scopes)
        }
        forceAuthCode = call.getBool("grantOfflineAccess") ?? forceAuthCode
        call.resolve()
    }

    @objc public func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let gid = GIDSignIn.sharedInstance

            if gid.hasPreviousSignIn() && !self.forceAuthCode {
                gid.restorePreviousSignIn { user, error in
                    if let error = error {
                        call.reject(error.localizedDescription)
                        return
                    }
                    guard let user = user else {
                        call.reject("No user returned")
                        return
                    }
                    self.resolveSignIn(call: call, user: user, serverAuthCode: nil)
                }
            } else {
                guard let vc = self.bridge?.viewController else {
                    call.reject("No view controller")
                    return
                }
                let hint = call.getString("hint")
                gid.signIn(withPresenting: vc, hint: hint, additionalScopes: self.additionalScopes) { result, error in
                    if let error = error {
                        call.reject(error.localizedDescription)
                        return
                    }
                    guard let user = result?.user else {
                        call.reject("No user returned")
                        return
                    }
                    self.resolveSignIn(call: call, user: user, serverAuthCode: result?.serverAuthCode)
                }
            }
        }
    }

    @objc public func refresh(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let user = GIDSignIn.sharedInstance.currentUser else {
                call.reject("User not logged in.")
                return
            }
            user.refreshTokensIfNeeded { updatedUser, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let updatedUser = updatedUser else {
                    call.reject("No user returned")
                    return
                }
                call.resolve([
                    "accessToken": updatedUser.accessToken.tokenString,
                    "idToken": updatedUser.idToken?.tokenString ?? NSNull(),
                    "refreshToken": NSNull(),
                ])
            }
        }
    }

    @objc public func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signOut()
        }
        call.resolve()
    }

    private func configure(clientId: String) {
        let serverClientId = getConfig().getString("serverClientId")
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId, serverClientID: serverClientId)
        forceAuthCode = getConfig().getBoolean("forceCodeForRefreshToken", false)
        if let scopes = getConfig().getArray("scopes") as? [String] {
            applyAdditionalScopes(scopes)
        }
    }

    private func applyAdditionalScopes(_ scopes: [String]) {
        let defaults = ["email", "profile", "openid"]
        additionalScopes = scopes.filter { !defaults.contains($0) }
    }

    private func resolveClientId() -> String? {
        if let id = getConfig().getString("iosClientId") { return id }
        if let id = getConfig().getString("clientId") { return id }
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let dict = NSDictionary(contentsOfFile: path) as? [String: Any],
           let id = dict["CLIENT_ID"] as? String { return id }
        return Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String
    }

    private func resolveSignIn(call: CAPPluginCall, user: GIDGoogleUser, serverAuthCode: String?) {
        var data: [String: Any] = [
            "authentication": [
                "accessToken": user.accessToken.tokenString,
                "idToken": user.idToken?.tokenString ?? NSNull(),
                "refreshToken": NSNull(),
            ],
            "serverAuthCode": serverAuthCode ?? NSNull(),
            "email": user.profile?.email ?? NSNull(),
            "familyName": user.profile?.familyName ?? NSNull(),
            "givenName": user.profile?.givenName ?? NSNull(),
            "id": user.userID ?? NSNull(),
            "name": user.profile?.name ?? NSNull(),
        ]
        if let url = user.profile?.imageURL(withDimension: 100)?.absoluteString {
            data["imageUrl"] = url
        }
        call.resolve(data)
    }

    @objc private func handleOpenUrl(_ notification: Notification) {
        guard let obj = notification.object as? [String: Any],
              let url = obj["url"] as? URL else { return }
        GIDSignIn.sharedInstance.handle(url)
    }
}
