import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GoogleAuth())
        bridge?.registerPluginInstance(HealthKitPlugin())
        bridge?.registerPluginInstance(WatchConnectivityPlugin())
    }
}
