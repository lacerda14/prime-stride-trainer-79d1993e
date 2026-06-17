import Foundation
import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readHeartRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readRestingHeartRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readWorkouts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeWorkout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readBodyMass", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDailyMetrics", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        let set: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
            HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .appleExerciseTime)!,
            HKObjectType.quantityType(forIdentifier: .bodyMass)!,
            HKObjectType.quantityType(forIdentifier: .stepCount)!,
            HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
            HKObjectType.workoutType(),
        ]
        return set
    }

    private var writeTypes: Set<HKSampleType> {
        return [
            HKObjectType.workoutType(),
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .bodyMass)!,
        ]
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit não disponível neste device")
            return
        }
        store.requestAuthorization(toShare: writeTypes, read: readTypes) { ok, err in
            if let err = err { call.reject(err.localizedDescription); return }
            call.resolve(["granted": ok])
        }
    }

    @objc func readHeartRate(_ call: CAPPluginCall) {
        let startISO = call.getString("start") ?? ""
        let endISO = call.getString("end") ?? ""
        let f = ISO8601DateFormatter()
        let start = f.date(from: startISO) ?? Date().addingTimeInterval(-3600)
        let end = f.date(from: endISO) ?? Date()
        let type = HKObjectType.quantityType(forIdentifier: .heartRate)!
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, err in
            if let err = err { call.reject(err.localizedDescription); return }
            let unit = HKUnit.count().unitDivided(by: .minute())
            let data = (samples as? [HKQuantitySample] ?? []).map { s -> [String: Any] in
                return [
                    "bpm": s.quantity.doubleValue(for: unit),
                    "date": ISO8601DateFormatter().string(from: s.startDate)
                ]
            }
            call.resolve(["samples": data])
        }
        store.execute(q)
    }

    @objc func readRestingHeartRate(_ call: CAPPluginCall) {
        let type = HKObjectType.quantityType(forIdentifier: .restingHeartRate)!
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, err in
            if let err = err { call.reject(err.localizedDescription); return }
            let unit = HKUnit.count().unitDivided(by: .minute())
            if let s = (samples as? [HKQuantitySample])?.first {
                call.resolve([
                    "bpm": s.quantity.doubleValue(for: unit),
                    "date": ISO8601DateFormatter().string(from: s.endDate)
                ])
            } else {
                call.resolve([:])
            }
        }
        store.execute(q)
    }

    @objc func readBodyMass(_ call: CAPPluginCall) {
        let type = HKObjectType.quantityType(forIdentifier: .bodyMass)!
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, err in
            if let err = err { call.reject(err.localizedDescription); return }
            if let s = (samples as? [HKQuantitySample])?.first {
                call.resolve([
                    "kg": s.quantity.doubleValue(for: .gramUnit(with: .kilo)),
                    "date": ISO8601DateFormatter().string(from: s.endDate)
                ])
            } else { call.resolve([:]) }
        }
        store.execute(q)
    }

    @objc func readWorkouts(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 20
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let q = HKSampleQuery(sampleType: .workoutType(), predicate: nil, limit: limit, sortDescriptors: [sort]) { _, samples, err in
            if let err = err { call.reject(err.localizedDescription); return }
            let data = (samples as? [HKWorkout] ?? []).map { w -> [String: Any] in
                [
                    "uuid": w.uuid.uuidString,
                    "activityType": w.workoutActivityType.rawValue,
                    "start": ISO8601DateFormatter().string(from: w.startDate),
                    "end": ISO8601DateFormatter().string(from: w.endDate),
                    "durationSec": w.duration,
                    "calories": w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
                ]
            }
            call.resolve(["workouts": data])
        }
        store.execute(q)
    }

    // Lê métricas diárias dos últimos N dias e devolve um array pronto pra enviar
    // ao ingest-healthkit-batch. Inclui dados que o Garmin Connect sincroniza com
    // o Apple Saúde (passos, FC, sono, treinos) — sem precisar da API do Garmin.
    @objc func readDailyMetrics(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.reject("HealthKit indisponível"); return }
        let days = max(1, min(call.getInt("days") ?? 7, 30))
        let cal = Calendar.current
        let startOfToday = cal.startOfDay(for: Date())
        guard let start = cal.date(byAdding: .day, value: -(days - 1), to: startOfToday) else {
            call.reject("intervalo inválido"); return
        }
        let anchor = startOfToday
        let interval = DateComponents(day: 1)

        let dayFmt = DateFormatter()
        dayFmt.calendar = cal
        dayFmt.locale = Locale(identifier: "en_US_POSIX")
        dayFmt.timeZone = cal.timeZone
        dayFmt.dateFormat = "yyyy-MM-dd"

        // Acumulador por dia.
        var byDay: [String: [String: Any]] = [:]
        func put(_ date: Date, _ key: String, _ value: Double) {
            let d = dayFmt.string(from: date)
            var row = byDay[d] ?? ["date": d]
            row[key] = value
            byDay[d] = row
        }

        let group = DispatchGroup()

        // Queries de estatística (soma/média) por dia.
        func statsQuery(_ id: HKQuantityTypeIdentifier, options: HKStatisticsOptions,
                        unit: HKUnit, key: String, transform: ((Double) -> Double)? = nil) {
            guard let type = HKObjectType.quantityType(forIdentifier: id) else { return }
            group.enter()
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
            let q = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: pred,
                                                options: options, anchorDate: anchor, intervalComponents: interval)
            q.initialResultsHandler = { _, results, _ in
                results?.enumerateStatistics(from: start, to: Date()) { stat, _ in
                    let qty = options.contains(.cumulativeSum) ? stat.sumQuantity() : stat.averageQuantity()
                    if let qty = qty {
                        var v = qty.doubleValue(for: unit)
                        if let t = transform { v = t(v) }
                        put(stat.startDate, key, v)
                    }
                }
                group.leave()
            }
            store.execute(q)
        }

        let bpm = HKUnit.count().unitDivided(by: .minute())
        statsQuery(.stepCount, options: .cumulativeSum, unit: .count(), key: "steps")
        statsQuery(.activeEnergyBurned, options: .cumulativeSum, unit: .kilocalorie(), key: "active_energy_kcal")
        statsQuery(.appleExerciseTime, options: .cumulativeSum, unit: .minute(), key: "exercise_minutes")
        statsQuery(.restingHeartRate, options: .discreteAverage, unit: bpm, key: "resting_hr")
        statsQuery(.heartRateVariabilitySDNN, options: .discreteAverage, unit: .secondUnit(with: .milli), key: "hrv_ms")

        // Sono: soma os minutos "asleep" por dia (bucket pelo dia em que o sono terminou).
        group.enter()
        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date(), options: [])
            let sq = HKSampleQuery(sampleType: sleepType, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var sleepByDay: [String: Double] = [:]
                let asleepValues: Set<Int> = {
                    if #available(iOS 16.0, *) {
                        return [
                            HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                            HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                            HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                            HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                        ]
                    } else {
                        return [HKCategoryValueSleepAnalysis.asleep.rawValue]
                    }
                }()
                for s in (samples as? [HKCategorySample] ?? []) {
                    guard asleepValues.contains(s.value) else { continue }
                    let d = dayFmt.string(from: s.endDate)
                    sleepByDay[d, default: 0] += s.endDate.timeIntervalSince(s.startDate) / 60.0
                }
                for (d, mins) in sleepByDay {
                    var row = byDay[d] ?? ["date": d]
                    row["sleep_duration_min"] = mins.rounded()
                    byDay[d] = row
                }
                group.leave()
            }
            store.execute(sq)
        } else {
            group.leave()
        }

        group.notify(queue: .main) {
            let metrics = byDay.values
                .sorted { (($0["date"] as? String) ?? "") < (($1["date"] as? String) ?? "") }
            call.resolve(["metrics": Array(metrics)])
        }
    }

    @objc func writeWorkout(_ call: CAPPluginCall) {
        guard
            let startISO = call.getString("start"),
            let endISO = call.getString("end")
        else { call.reject("start/end obrigatórios"); return }
        let f = ISO8601DateFormatter()
        guard let start = f.date(from: startISO), let end = f.date(from: endISO) else {
            call.reject("Datas inválidas"); return
        }
        let activityRaw = UInt(call.getInt("activityType") ?? 50) // 50 = traditionalStrengthTraining
        let activity = HKWorkoutActivityType(rawValue: activityRaw) ?? .traditionalStrengthTraining
        let calories = call.getDouble("calories") ?? 0

        let energy = HKQuantity(unit: .kilocalorie(), doubleValue: calories)
        let workout = HKWorkout(
            activityType: activity,
            start: start,
            end: end,
            duration: end.timeIntervalSince(start),
            totalEnergyBurned: calories > 0 ? energy : nil,
            totalDistance: nil,
            metadata: ["app": "PM Hybrid"]
        )
        store.save(workout) { ok, err in
            if let err = err { call.reject(err.localizedDescription); return }
            call.resolve(["saved": ok, "uuid": workout.uuid.uuidString])
        }
    }
}
