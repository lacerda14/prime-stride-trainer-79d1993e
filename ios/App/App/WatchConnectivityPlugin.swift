import Foundation
import Capacitor
import WatchConnectivity

// Ponte iPhone ⇄ Apple Watch (WatchConnectivity).
// - sendWorkout: envia o treino do dia pro relógio (entrega garantida).
// - startWorkout: pede pro relógio iniciar a sessão de treino (HealthKit).
// - recebe do relógio: setLog (séries) e eventos de início/fim de treino.
@objc(WatchConnectivityPlugin)
public class WatchConnectivityPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "WatchConnectivityPlugin"
    public let jsName = "WatchBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendWorkout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startWorkout", returnType: CAPPluginReturnPromise),
    ]

    private var wcSession: WCSession?
    // Último treino pendente (caso a sessão ainda não esteja ativa no boot).
    private var pendingWorkout: [String: Any]?

    public override func load() {
        guard WCSession.isSupported() else { return }
        wcSession = WCSession.default
        wcSession?.delegate = self
        wcSession?.activate()
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": WCSession.isSupported()])
    }

    // Recebe o treino do JS, serializa e envia ao relógio por TRÊS vias para
    // máxima confiabilidade: applicationContext (estado atual), transferUserInfo
    // (fila garantida) e sendMessage (imediato, se alcançável).
    @objc func sendWorkout(_ call: CAPPluginCall) {
        guard let workout = call.getObject("workout") else {
            call.reject("Parâmetro 'workout' obrigatório")
            return
        }
        pendingWorkout = workout
        let ok = flushWorkout()
        call.resolve(["sent": ok])
    }

    @discardableResult
    private func flushWorkout() -> Bool {
        guard let session = wcSession, session.activationState == .activated,
              let workout = pendingWorkout else { return false }
        guard let data = try? JSONSerialization.data(withJSONObject: workout, options: []) else { return false }
        let payload: [String: Any] = ["workout": data]
        // Estado mais recente (sobrescreve): entregue quando o relógio puder.
        try? session.updateApplicationContext(payload)
        // Fila garantida em background.
        session.transferUserInfo(payload)
        // Imediato se o app do relógio estiver em primeiro plano.
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
        return true
    }

    // Pede pro relógio iniciar a sessão de treino (HealthKit) agora.
    @objc func startWorkout(_ call: CAPPluginCall) {
        guard let session = wcSession, session.activationState == .activated else {
            call.reject("WCSession não está ativo"); return
        }
        let cmd: [String: Any] = ["command": "start"]
        if session.isReachable {
            session.sendMessage(cmd, replyHandler: nil, errorHandler: nil)
        }
        session.transferUserInfo(cmd)
        call.resolve(["sent": true])
    }

    // MARK: - WCSessionDelegate
    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Assim que ativa, despeja o treino pendente (resolve a corrida de boot).
        if activationState == .activated { flushWorkout() }
    }
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { session.activate() }

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        forwardFromWatch(message)
    }
    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        forwardFromWatch(userInfo)
    }
    public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        forwardFromWatch(applicationContext)
    }

    // Repassa eventos do relógio pro JS.
    private func forwardFromWatch(_ dict: [String: Any]) {
        if let data = dict["setLog"] as? Data,
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            notifyListeners("setLog", data: obj)
        }
        // Eventos de ciclo de vida do treino iniciados no relógio.
        if let event = dict["watchEvent"] as? String {
            notifyListeners("watchEvent", data: ["event": event])
        }
        // Relógio pediu o treino: reenvia o cache imediatamente e avisa o JS
        // (que reenvia a versão atual do treino do dia).
        if let cmd = dict["command"] as? String, cmd == "requestWorkout" {
            flushWorkout()
            notifyListeners("watchEvent", data: ["event": "requestWorkout"])
        }
    }
}
