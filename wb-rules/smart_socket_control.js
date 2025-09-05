/*********************
 *  SCHEDULE *
 *********************/
// Turn OFF every day at 20:00
defineRule({
  when: cron("0 0 20 * *"),
  then: function () {
    // Change only the COMMAND switch; actual state will be updated from MQTT
    dev["SmartSocketControl/socket_cmd"] = false;
    log("Schedule: command sent to turn socket OFF at 20:00");
  }
});

// Turn ON every day at 05:00
defineRule({
  when: cron("0 0 5 * *"),
  then: function () {
    // Change only the COMMAND switch; actual state will be updated from MQTT
    dev["SmartSocketControl/socket_cmd"] = true;
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
      type:  "value",
      title: { 'en': 'Power Consumption', 'ru': 'Потребляемая мощность' },
      value: 0,
      units: "W"
    },
    voltage_value: {
      type:  "value",
      title: { 'en': 'Voltage', 'ru': 'Напряжение' },
      value: 0,
      units: "V"
    },
    energy_value: {
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
defineRule({
  whenChanged: "SmartSocketControl/socket_cmd",
  then: function (newValue) {
    var desired = newValue ? "ON" : "OFF";
    var actual  = dev["SmartSocketControl/socket_state"] ? "ON" : "OFF";

    if (desired === actual) {
      log("No MQTT command sent: actual state is already " + actual);
      return;
    }

    var command = JSON.stringify({ state: desired });
    // publish(topic, payload, [qos], [retain])
    publish(mqttSetTopic, command);
    log("MQTT command published to " + mqttSetTopic + ": " + command);
  }
});

/*********************
 *  MQTT TRACKER: MQTT → STATE/TELEMETRY
 *  - Update only the actual state and telemetry.
 *  - Never write back to socket_cmd here.
 *********************/
trackMqtt(mqttDeviceTopic, function (message) {
  try {
    var payload = JSON.parse(message.value);
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
    if (typeof payload.power === "number") {
      dev["SmartSocketControl/power_value"] = payload.power;
      log("Power: " + payload.power + " W");
    }
    if (typeof payload.voltage === "number") {
      dev["SmartSocketControl/voltage_value"] = payload.voltage;
      log("Voltage: " + payload.voltage + " V");
    }
    if (typeof payload.energy === "number") {
      dev["SmartSocketControl/energy_value"] = payload.energy;
      log("Energy total: " + payload.energy + " kWh");
    }
  } catch (e) {
    log("MQTT JSON parse error: " + e);
  }
});
