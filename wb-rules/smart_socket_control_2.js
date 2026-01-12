/*********************
 *  CONFIG
 *********************/
// Base Zigbee2MQTT topics for the specific device
var mqttDeviceTopic = "zigbee2mqtt/0x0c4314fffe52ac2d";
var mqttSetTopic    = mqttDeviceTopic + "/set";

/*********************
 *  VIRTUAL DEVICE
 *  - Separate command and actual state to avoid feedback loops.
 *  - Telemetry values (power, current, linkquality, last_seen) are read-only from MQTT.
 *********************/
defineVirtualDevice("SmartSocketControl2", {
  title: { "en": "Smart Socket Control 2", "ru": "Управление умной розеткой 2" },
  cells: {
    // User/automation writes here to request ON/OFF
    socket_cmd: {
      type:  "switch",
      title: { "en": "Toggle (command)", "ru": "Вкл/Выкл (команда)" },
      value: false
    },
    // Actual device state reflected from MQTT only
    socket_state: {
      type:  "switch",
      title: { "en": "Socket State (actual)", "ru": "Состояние розетки (факт)" },
      value: false,
      readonly: true
    },
    power_value: {
      type:  "value",
      title: { "en": "Power Consumption", "ru": "Потребляемая мощность" },
      value: 0,
      units: "W"
    },
    current_value: {
      type:  "value",
      title: { "en": "Current", "ru": "Ток" },
      value: 0,
      units: "A"
    },
    voltage_value: {
      type:  "value",
      title: { "en": "Voltage", "ru": "Напряжение" },
      value: 0,
      units: "V"
    },
    energy_value: {
      type:  "value",
      title: { "en": "Energy Consumption Total", "ru": "Сумма потреблённой энергии" },
      value: 0,
      units: "kWh"
    },
    linkquality_value: {
      type:  "value",
      title: { "en": "Link Quality", "ru": "Качество связи" },
      value: 0
    },
    last_seen_value: {
      type:  "text",
      title: { "en": "Last Seen", "ru": "Последний контакт" },
      value: ""
    }
  }
});

/*********************
 *  RULES: COMMAND → MQTT
 *  - Send MQTT command only if desired != actual to reduce traffic & avoid loops.
 *********************/
defineRule({
  whenChanged: "SmartSocketControl2/socket_cmd",
  then: function (newValue) {
    var desired = newValue ? "ON" : "OFF";
    var actual  = dev["SmartSocketControl2/socket_state"] ? "ON" : "OFF";

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
      if (dev["SmartSocketControl2/socket_state"] !== stateBool) {
        dev["SmartSocketControl2/socket_state"] = stateBool;
        log("Actual socket state updated from MQTT: " + payload.state);
      }
    }

    // Update telemetry if present
    if (typeof payload.power === "number") {
      dev["SmartSocketControl2/power_value"] = payload.power;
      log("Power: " + payload.power + " W");
    }
    if (typeof payload.current === "number") {
      dev["SmartSocketControl2/current_value"] = payload.current;
      log("Current: " + payload.current + " A");
    }
    if (typeof payload.voltage === "number") {
      dev["SmartSocketControl2/voltage_value"] = payload.voltage;
      log("Voltage: " + payload.voltage + " V");
    }
    if (typeof payload.energy === "number") {
      dev["SmartSocketControl2/energy_value"] = payload.energy;
      log("Energy total: " + payload.energy + " kWh");
    }
    if (typeof payload.linkquality === "number") {
      dev["SmartSocketControl2/linkquality_value"] = payload.linkquality;
      log("Link quality: " + payload.linkquality);
    }
    if (payload.last_seen !== undefined) {
      var lastSeenText = String(payload.last_seen);
      if (typeof payload.last_seen === "number") {
        // Zigbee2MQTT uses unix ms; show local time in YYYY-MM-DD HH:MM:SS.
        var d = new Date(payload.last_seen);
        var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
        lastSeenText = d.getFullYear() + "-" +
          pad2(d.getMonth() + 1) + "-" +
          pad2(d.getDate()) + " " +
          pad2(d.getHours()) + ":" +
          pad2(d.getMinutes()) + ":" +
          pad2(d.getSeconds());
      }
      dev["SmartSocketControl2/last_seen_value"] = lastSeenText;
      log("Last seen: " + lastSeenText);
    }
  } catch (e) {
    log("MQTT JSON parse error: " + e);
  }
});
