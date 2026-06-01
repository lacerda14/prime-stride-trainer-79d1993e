# Smartwatch Integration Layer (placeholder)

This directory is the decoupled integration layer for wearables.
No implementation yet — only the contract.

Planned providers:
- Apple Watch (HealthKit)
- Garmin (Connect IQ / OAuth)
- Coros
- Polar
- Samsung Watch (Samsung Health)

Each provider should implement a common adapter:

```ts
interface WearableAdapter {
  id: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  syncHeartRate(sessionId: string): Promise<HRSample[]>;
  syncRun(sessionId: string): Promise<RunMetrics>;
}
```

When implementing, keep provider-specific code in `providers/<name>.ts`
behind the `WearableAdapter` interface so the UI never depends on a vendor.
