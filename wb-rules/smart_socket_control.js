/*********************
 *  SCHEDULE *
 *********************/
// Turn OFF every day at 20:00
defineRule({
  when: cron("0 0 20 * *"),
  then: function () {
    // Change only the COMMAND switch; actual state will be updated from MQTT
    requestSocketState(false);
    log("Schedule: command sent to turn socket OFF at 20:00");
  }
});

// Turn ON every day at 05:00
defineRule({
  when: cron("0 0 5 * *"),
  then: function () {
    // Change only the COMMAND switch; actual state will be updated from MQTT
    requestSocketState(true);
    log("Schedule: command sent to turn socket ON at 05:00");
  }
});

/*********************
 *  CONFIG
 *********************/
// Base Zigbee2MQTT topics for the specific device
var mqttDeviceTopic = "zigbee2mqtt/0x70b3d52b6011db96";
var mqttSetTopic    = mqttDeviceTopic + "/set";

/*********************
 *  VIRTUAL DEVICE
 *  - Separate command and actual state to avoid feedback loops.
 *  - Telemetry values (power, voltage, energy) are read-only from MQTT.
 *********************/
defineVirtualDevice("SmartSocketControl", {
  title: { 'en': 'Smart Socket Control', 'ru': 'Управление умной розеткой' },
  cells: {
    // User/automation writes here to request ON/OFF
    socket_cmd: {
      type:  "switch",
      title: { 'en': 'Toggle (command)', 'ru': 'Вкл/Выкл (команда)' },
      value: false
    },
    // Actual device state reflected from MQTT only
    socket_state: {
      type:  "switch",
      title: { 'en': 'Socket State (actual)', 'ru': 'Состояние розетки (факт)' },
      value: false,
      readonly: true
    },
    power_value: {
      readonly: true,
      type:  "value",
      title: { 'en': 'Power Consumption', 'ru': 'Потребляемая мощность' },
      value: 0,
      units: "W"
    },
    voltage_value: {
      readonly: true,
      type:  "value",
      title: { 'en': 'Voltage', 'ru': 'Напряжение' },
      value: 0,
      units: "V"
    },
    energy_value: {
      readonly: true,
      type:  "value",
      title: { 'en': 'Energy Consumption Total', 'ru': 'Сумма потреблённой энергии' },
      value: 0,
      units: "kWh"
    }
  }
});

/*********************
 *  RULES: COMMAND → MQTT
 *  - Send MQTT command only if desired != actual to reduce traffic & avoid loops.
 *********************/
var lastSocketCommand = null;
var lastSocketCommandAt = 0;
function requestSocketState(newValue) {
  if (typeof newValue !== "boolean") { log("Socket rejected invalid command"); return; }
  if (dev["SmartSocketControl/socket_cmd"] !== newValue) { dev["SmartSocketControl/socket_cmd"] = newValue; }
  var actual = dev["SmartSocketControl/socket_state"];
  if (typeof actual !== "boolean") { log("Socket command skipped: unknown actual state"); return; }
  if (actual === newValue) { return; }
  var now = Date.now();
  if (lastSocketCommand === newValue && now - lastSocketCommandAt < 500) { return; }
  publish(mqttSetTopic, JSON.stringify({ state: newValue ? "ON" : "OFF" }), 1, false);
  lastSocketCommand = newValue; lastSocketCommandAt = now;
  log("Socket requested " + (newValue ? "ON" : "OFF"));
}
defineRule("smart_socket_command", {
  whenChanged: "SmartSocketControl/socket_cmd",
  then: requestSocketState
});
trackMqtt("/devices/SmartSocketControl/controls/socket_cmd/on", function (message) {
  if (message.retained) { return; }
  if (message.value === "1" || message.value === "0") { requestSocketState(message.value === "1"); }
});

/*********************
 *  MQTT TRACKER: MQTT → STATE/TELEMETRY
 *  - Update only the actual state and telemetry.
 *  - Never write back to socket_cmd here.
 *********************/
trackMqtt(mqttDeviceTopic, function (message) {
  try {
    var payload = JSON.parse(message.value);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) { return; }
    log("MQTT message received from " + mqttDeviceTopic + ": " + JSON.stringify(payload));

    // Update actual ON/OFF state (only if it really changed)
    if (payload.state === "ON" || payload.state === "OFF") {
      var stateBool = (payload.state === "ON");
      if (dev["SmartSocketControl/socket_state"] !== stateBool) {
        dev["SmartSocketControl/socket_state"] = stateBool;
        log("Actual socket state updated from MQTT: " + payload.state);
      }
    }

    // Update telemetry if present
    if (typeof payload.power === "number" && isFinite(payload.power)) {
      dev["SmartSocketControl/power_value"] = payload.power;
      log("Power: " + payload.power + " W");
    }
    if (typeof payload.voltage === "number" && isFinite(payload.voltage)) {
      dev["SmartSocketControl/voltage_value"] = payload.voltage;
      log("Voltage: " + payload.voltage + " V");
    }
    if (typeof payload.energy === "number" && isFinite(payload.energy)) {
      dev["SmartSocketControl/energy_value"] = payload.energy;
      log("Energy total: " + payload.energy + " kWh");
    }
  } catch (e) {
    log("MQTT JSON parse error: " + e);
  }
});
