import SwiftUI
import Foundation
import WatchConnectivity
import HealthKit
import Combine

// ============================================================
// App entry
// ============================================================
@main
struct PMHybridWatch_Watch_AppApp: App {
    @StateObject private var connectivity = ConnectivityManager()
    @StateObject private var workout = WorkoutManager()

    var body: some Scene {
        WindowGroup {
            WorkoutListView()
                .environmentObject(connectivity)
                .environmentObject(workout)
        }
    }
}

// ============================================================
// Models
// ============================================================
struct WatchExercise: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let sets: Int
    let reps: String       // "8-12", "AMRAP", etc
    let restSec: Int
    let suggestedWeightKg: Double?
}

struct WatchWorkout: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let dayLabel: String   // "Push A", "Pull B"
    let exercises: [WatchExercise]
}

struct WatchSetLog: Codable {
    let workoutId: String
    let exerciseId: String
    let setIndex: Int
    let reps: Int
    let weightKg: Double
    let rpe: Double?
    let completedAt: Date
}

// ============================================================
// WatchConnectivity — recebe treino do iPhone, envia logs de série
// ============================================================
final class ConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var todaysWorkout: WatchWorkout?
    // Vira true quando o iPhone pede pra iniciar o treino no relógio.
    @Published var startRequested = false
    private let session: WCSession = .default

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        session.delegate = self
        session.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        handle(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        handle(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        handle(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any]) {
        handle(userInfo)
    }

    private func handle(_ dict: [String: Any]) {
        if let data = dict["workout"] as? Data,
           let workout = try? JSONDecoder().decode(WatchWorkout.self, from: data) {
            DispatchQueue.main.async { self.todaysWorkout = workout }
        }
        if let cmd = dict["command"] as? String, cmd == "start" {
            DispatchQueue.main.async { self.startRequested = true }
        }
    }

    func sendSetLog(_ log: WatchSetLog) {
        guard let data = try? JSONEncoder().encode(log) else { return }
        let payload: [String: Any] = ["setLog": data]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        }
        session.transferUserInfo(payload)
    }

    // Avisa o iPhone que o treino começou/terminou no relógio.
    func sendEvent(_ event: String) {
        let payload: [String: Any] = ["watchEvent": event]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        }
        session.transferUserInfo(payload)
    }

    // Pede pro iPhone (re)enviar o treino do dia. Usado ao abrir o app no relógio
    // e no botão "Recarregar" — torna o relógio independente do timing do push.
    func requestWorkout() {
        guard session.activationState == .activated else { return }
        let payload: [String: Any] = ["command": "requestWorkout"]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        }
        session.transferUserInfo(payload)
    }
}

// ============================================================
// WorkoutManager — HKWorkoutSession + FC ao vivo
// ============================================================
final class WorkoutManager: NSObject, ObservableObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    @Published var heartRate: Double = 0
    @Published var activeCalories: Double = 0
    @Published var elapsedSec: Int = 0
    @Published var isActive = false

    let store = HKHealthStore()
    var session: HKWorkoutSession?
    var builder: HKLiveWorkoutBuilder?
    private var timer: Timer?
    private var startDate: Date?

    func authorize(completion: @escaping (Bool) -> Void) {
        let read: Set = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.workoutType()
        ]
        let write: Set<HKSampleType> = [HKObjectType.workoutType()]
        store.requestAuthorization(toShare: write, read: read) { ok, _ in
            DispatchQueue.main.async { completion(ok) }
        }
    }

    func start() {
        let cfg = HKWorkoutConfiguration()
        cfg.activityType = .traditionalStrengthTraining
        cfg.locationType = .indoor
        do {
            session = try HKWorkoutSession(healthStore: store, configuration: cfg)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: cfg)
            session?.delegate = self
            builder?.delegate = self
            let now = Date()
            startDate = now
            session?.startActivity(with: now)
            builder?.beginCollection(withStart: now) { _, _ in }
            isActive = true
            startTimer()
        } catch {
            print("HK start error: \(error)")
        }
    }

    func end() {
        session?.end()
        timer?.invalidate()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { _, _ in
                DispatchQueue.main.async { self?.isActive = false }
            }
        }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let s = self?.startDate else { return }
            DispatchQueue.main.async { self?.elapsedSec = Int(Date().timeIntervalSince(s)) }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let qType = type as? HKQuantityType,
                  let stats = workoutBuilder.statistics(for: qType) else { continue }
            switch qType.identifier {
            case HKQuantityTypeIdentifier.heartRate.rawValue:
                let unit = HKUnit.count().unitDivided(by: .minute())
                if let v = stats.mostRecentQuantity()?.doubleValue(for: unit) {
                    DispatchQueue.main.async { self.heartRate = v }
                }
            case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue:
                if let v = stats.sumQuantity()?.doubleValue(for: .kilocalorie()) {
                    DispatchQueue.main.async { self.activeCalories = v }
                }
            default: break
            }
        }
    }
}
