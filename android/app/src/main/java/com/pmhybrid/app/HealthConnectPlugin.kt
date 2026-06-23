package com.pmhybrid.app

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

// Plugin Health Connect do Android. Registrado como "HealthKit" pra reaproveitar
// o mesmo JS (healthkit.ts) do iOS: isAvailable / requestAuthorization /
// readDailyMetrics. Lê o que o Garmin Connect (e outros) sincronizam no Health
// Connect e devolve no mesmo formato que o ingest-healthkit-batch espera.
@CapacitorPlugin(name = "HealthKit")
class HealthConnectPlugin : Plugin() {

    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    private fun clientOrNull(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE)
            HealthConnectClient.getOrCreate(context) else null

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ok = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
        call.resolve(JSObject().put("available", ok))
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        val client = clientOrNull()
        if (client == null) { call.resolve(JSObject().put("granted", false)); return }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(permissions)) {
                    call.resolve(JSObject().put("granted", true))
                } else {
                    val contract = PermissionController.createRequestPermissionResultContract()
                    val intent = contract.createIntent(context, permissions)
                    startActivityForResult(call, intent, "permCallback")
                }
            } catch (e: Exception) {
                call.resolve(JSObject().put("granted", false))
            }
        }
    }

    @ActivityCallback
    private fun permCallback(call: PluginCall, result: ActivityResult) {
        val client = clientOrNull()
        if (client == null) { call.resolve(JSObject().put("granted", false)); return }
        CoroutineScope(Dispatchers.Main).launch {
            val granted = try {
                client.permissionController.getGrantedPermissions().containsAll(permissions)
            } catch (e: Exception) { false }
            call.resolve(JSObject().put("granted", granted))
        }
    }

    @PluginMethod
    fun readDailyMetrics(call: PluginCall) {
        val client = clientOrNull()
        if (client == null) { call.reject("Health Connect indisponível"); return }
        val days = (call.getInt("days") ?: 7).coerceIn(1, 30)
        val zone = ZoneId.systemDefault()
        val endDate = LocalDate.now(zone)
        val startDate = endDate.minusDays((days - 1).toLong())
        val filter = TimeRangeFilter.between(startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay())

        CoroutineScope(Dispatchers.IO).launch {
            val byDay = HashMap<String, JSObject>()
            fun row(d: String): JSObject = byDay.getOrPut(d) { JSObject().put("date", d) }

            // Passos + energia ativa (agregados por dia).
            try {
                val agg = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL, ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                        timeRangeFilter = filter,
                        timeRangeSlicer = Period.ofDays(1)
                    )
                )
                for (g in agg) {
                    val d = g.startTime.toLocalDate().toString()
                    g.result[StepsRecord.COUNT_TOTAL]?.let { row(d).put("steps", it.toDouble()) }
                    g.result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let {
                        row(d).put("active_energy_kcal", it.inKilocalories)
                    }
                }
            } catch (e: Exception) { /* sem permissão / sem dados */ }

            // FC de repouso (média/dia).
            try {
                val recs = client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter)).records
                val sum = HashMap<String, Pair<Double, Int>>()
                for (r in recs) {
                    val d = r.time.atZone(zone).toLocalDate().toString()
                    val cur = sum.getOrDefault(d, 0.0 to 0)
                    sum[d] = (cur.first + r.beatsPerMinute) to (cur.second + 1)
                }
                for ((d, p) in sum) if (p.second > 0) row(d).put("resting_hr", p.first / p.second)
            } catch (e: Exception) {}

            // HRV (RMSSD, média/dia) → aproxima hrv_ms.
            try {
                val recs = client.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, filter)).records
                val sum = HashMap<String, Pair<Double, Int>>()
                for (r in recs) {
                    val d = r.time.atZone(zone).toLocalDate().toString()
                    val cur = sum.getOrDefault(d, 0.0 to 0)
                    sum[d] = (cur.first + r.heartRateVariabilityMillis) to (cur.second + 1)
                }
                for ((d, p) in sum) if (p.second > 0) row(d).put("hrv_ms", p.first / p.second)
            } catch (e: Exception) {}

            // Sono (min/dia, bucket pelo dia em que terminou).
            try {
                val recs = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter)).records
                val sum = HashMap<String, Double>()
                for (r in recs) {
                    val d = r.endTime.atZone(zone).toLocalDate().toString()
                    sum[d] = sum.getOrDefault(d, 0.0) + (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
                }
                for ((d, m) in sum) row(d).put("sleep_duration_min", Math.round(m).toDouble())
            } catch (e: Exception) {}

            // Minutos de exercício (soma das sessões/dia).
            try {
                val recs = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter)).records
                val sum = HashMap<String, Double>()
                for (r in recs) {
                    val d = r.endTime.atZone(zone).toLocalDate().toString()
                    sum[d] = sum.getOrDefault(d, 0.0) + (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
                }
                for ((d, m) in sum) row(d).put("exercise_minutes", Math.round(m).toDouble())
            } catch (e: Exception) {}

            val arr = JSArray()
            byDay.toSortedMap().values.forEach { arr.put(it) }
            call.resolve(JSObject().put("metrics", arr))
        }
    }
}
