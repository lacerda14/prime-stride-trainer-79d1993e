import Foundation
import Capacitor
import GoogleSignIn

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        print("[GoogleAuthPlugin] signIn chamado")
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                print("[GoogleAuthPlugin] ERRO: sem viewController")
                call.reject("No view controller")
                return
            }
            // Garante configuração mesmo se AppDelegate não rodou
            if GIDSignIn.sharedInstance.configuration == nil {
                if let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String {
                    GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
                    print("[GoogleAuthPlugin] Configuração criada: \(clientID.prefix(20))...")
                } else {
                    print("[GoogleAuthPlugin] ERRO: GIDClientID não encontrado no Info.plist")
                    call.reject("GIDClientID ausente no Info.plist")
                    return
                }
            }
            print("[GoogleAuthPlugin] Abrindo GIDSignIn...")
            GIDSignIn.sharedInstance.signIn(withPresenting: vc) { result, error in
                if let error = error {
                    print("[GoogleAuthPlugin] ERRO GIDSignIn: \(error.localizedDescription)")
                    call.reject(error.localizedDescription)
                    return
                }
                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    print("[GoogleAuthPlugin] ERRO: sem id_token no resultado")
                    call.reject("No id_token received")
                    return
                }
                print("[GoogleAuthPlugin] SUCESSO — idToken: \(idToken.prefix(30))...")
                call.resolve([
                    "authentication": [
                        "idToken": idToken,
                        "accessToken": user.accessToken.tokenString
                    ],
                    "email": user.profile?.email ?? "",
                    "name": user.profile?.name ?? "",
                    "givenName": user.profile?.givenName ?? "",
                    "familyName": user.profile?.familyName ?? "",
                    "id": user.userID ?? ""
                ])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signOut()
            call.resolve()
        }
    }

    @objc func refresh(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let user = GIDSignIn.sharedInstance.currentUser else {
                call.reject("No signed-in user")
                return
            }
            user.refreshTokensIfNeeded { refreshedUser, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let idToken = refreshedUser?.idToken?.tokenString else {
                    call.reject("No id_token after refresh")
                    return
                }
                call.resolve([
                    "authentication": [
                        "idToken": idToken,
                        "accessToken": refreshedUser?.accessToken.tokenString ?? ""
                    ]
                ])
            }
        }
    }
}
