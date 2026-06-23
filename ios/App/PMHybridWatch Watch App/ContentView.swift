import SwiftUI
import WatchKit
import Combine

// ============================================================
// Lista — treino do dia (recebido do iPhone)
// ============================================================
struct WorkoutListView: View {
    @EnvironmentObject var connectivity: ConnectivityManager
    @State private var goActive = false
    @State private var requesting = false

    var body: some View {
        NavigationStack {
            Group {
                if let w = connectivity.todaysWorkout {
                    TodayCard(workout: w, goActive: $goActive)
                        .navigationTitle("Hoje")
                        .navigationDestination(isPresented: $goActive) {
                            ActiveWorkoutView(workout: w)
                        }
                } else {
                    EmptyTodayView(requesting: requesting) { reload() }
                        .navigationTitle("PM Hybrid")
                }
            }
        }
        .onAppear {
            // Pede o treino ao iPhone assim que abre (independe do timing do push).
            if connectivity.todaysWorkout == nil { reload() }
        }
        // iPhone pediu pra iniciar → abre o treino ativo automaticamente.
        .onChange(of: connectivity.startRequested) { _, newVal in
            if newVal && connectivity.todaysWorkout != nil {
                goActive = true
                connectivity.startRequested = false
            }
        }
    }

    private func reload() {
        requesting = true
        connectivity.requestWorkout()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { requesting = false }
    }
}

// Card do treino de hoje + botão grande de começar.
struct TodayCard: View {
    let workout: WatchWorkout
    @Binding var goActive: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(workout.name).font(.headline)
                    if !workout.dayLabel.isEmpty {
                        Text(workout.dayLabel).font(.caption2).foregroundStyle(.secondary)
                    }
                    Text("\(workout.exercises.count) exercícios").font(.caption2).foregroundStyle(.tertiary)
                }

                Button {
                    goActive = true
                } label: {
                    Label("Começar treino", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(.green)
                .controlSize(.large)

                // Prévia dos exercícios
                ForEach(workout.exercises.prefix(6)) { ex in
                    HStack {
                        Text(ex.name).font(.caption2).lineLimit(1)
                        Spacer()
                        Text("\(ex.sets)×\(ex.reps)").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

// Estado vazio com recarregar.
struct EmptyTodayView: View {
    let requesting: Bool
    var onReload: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: "dumbbell").font(.title2).foregroundStyle(.secondary)
                Text("Sem treino sincronizado").font(.headline).multilineTextAlignment(.center)
                Text("Abra o PM Hybrid no iPhone e toque em recarregar.")
                    .font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Button {
                    onReload()
                } label: {
                    if requesting {
                        ProgressView()
                    } else {
                        Label("Recarregar", systemImage: "arrow.clockwise").frame(maxWidth: .infinity)
                    }
                }
                .controlSize(.large)
            }
            .padding(.horizontal, 6)
            .padding(.top, 8)
        }
    }
}

// ============================================================
// Treino ativo — FC ao vivo, Digital Crown pra peso/reps, log de série
// ============================================================
struct ActiveWorkoutView: View {
    let workout: WatchWorkout
    @EnvironmentObject var manager: WorkoutManager
    @EnvironmentObject var connectivity: ConnectivityManager
    @State private var exerciseIdx = 0
    @State private var setIdx = 0
    @State private var resting = false
    @State private var weight: Double = 0
    @State private var reps: Int = 0

    var current: WatchExercise { workout.exercises[exerciseIdx] }

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "heart.fill").foregroundStyle(.red)
                Text("\(Int(manager.heartRate)) bpm").font(.title3.monospacedDigit())
                Spacer()
                Text(timeStr(manager.elapsedSec)).font(.caption.monospacedDigit())
            }
            .padding(.horizontal)

            Text(current.name).font(.headline)
            Text("Série \(setIdx + 1) de \(current.sets)  •  \(current.reps) reps")
                .font(.caption).foregroundStyle(.secondary)

            if resting {
                RestTimerView(seconds: current.restSec) {
                    resting = false
                    advance()
                }
            } else {
                VStack(spacing: 6) {
                    HStack {
                        Text("Peso").font(.caption)
                        Spacer()
                        Text("\(weight, specifier: "%.1f") kg").font(.title3.monospacedDigit())
                    }
                    .focusable(true)
                    .digitalCrownRotation($weight, from: 0, through: 300, by: 0.5, sensitivity: .medium)

                    HStack {
                        Text("Reps").font(.caption)
                        Spacer()
                        Text("\(reps)").font(.title3.monospacedDigit())
                    }
                    .focusable(true)
                    .digitalCrownRotation(
                        Binding(get: { Double(reps) }, set: { reps = Int($0) }),
                        from: 0, through: 50, by: 1, sensitivity: .medium
                    )

                    Button(action: completeSet) {
                        Label("Concluir série", systemImage: "checkmark.circle.fill")
                    }
                    .tint(.green)
                }
                .padding(.horizontal)
            }
        }
        .onAppear {
            manager.authorize { ok in if ok { manager.start() } }
            weight = current.suggestedWeightKg ?? 0
            connectivity.sendEvent("started")
        }
        .onDisappear {
            manager.end()
            connectivity.sendEvent("ended")
        }
    }

    private func completeSet() {
        let log = WatchSetLog(
            workoutId: workout.id,
            exerciseId: current.id,
            setIndex: setIdx,
            reps: reps,
            weightKg: weight,
            rpe: nil,
            completedAt: Date()
        )
        connectivity.sendSetLog(log)
        WKInterfaceDevice.current().play(.success)
        resting = true
    }

    private func advance() {
        if setIdx + 1 < current.sets {
            setIdx += 1
        } else if exerciseIdx + 1 < workout.exercises.count {
            exerciseIdx += 1
            setIdx = 0
            weight = workout.exercises[exerciseIdx].suggestedWeightKg ?? 0
        } else {
            manager.end()
        }
    }

    private func timeStr(_ s: Int) -> String {
        String(format: "%02d:%02d", s/60, s%60)
    }
}

// ============================================================
// Timer de descanso
// ============================================================
struct RestTimerView: View {
    let seconds: Int
    var onDone: () -> Void
    @State private var remaining: Int

    init(seconds: Int, onDone: @escaping () -> Void) {
        self.seconds = seconds
        self.onDone = onDone
        _remaining = State(initialValue: seconds)
    }

    // @State (não `let`): o ActiveWorkoutView re-renderiza a cada 1s (FC/tempo do
    // WorkoutManager) e recriaria o publisher antes dele completar 1s → nunca
    // disparava (descanso travado / treino não avançava). @State sobrevive aos
    // re-renders, então o timer conta certo.
    @State private var timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 8) {
            Text("Descanso").font(.caption).foregroundStyle(.secondary)
            Text("\(remaining)s")
                .font(.system(size: 48, weight: .bold, design: .rounded).monospacedDigit())
                .contentTransition(.numericText(countsDown: true))
            ProgressView(value: Double(seconds - remaining), total: Double(seconds))
                .tint(.white)
            Button("Pular") { onDone() }.buttonStyle(.bordered)
        }
        .padding()
        .onReceive(timer) { _ in
            guard remaining > 0 else { onDone(); return }
            remaining -= 1
            if remaining == 0 {
                WKInterfaceDevice.current().play(.notification)
            } else if remaining <= 3 {
                WKInterfaceDevice.current().play(.click)
            }
        }
    }
}
