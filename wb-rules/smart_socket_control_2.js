/*********************
 *  CONFIG
 *********************/
var vdevName = "SmartSocketControl2";
var mqttDeviceTopic = "zigbee2mqtt/0x0c4314fffe52ac2d";
var mqttSetTopic = mqttDeviceTopic + "/set";
var mqttStateOn = "ON";
var mqttStateOff = "OFF";

var cells = {
  cmd: "socket_cmd",
  state: "socket_state",
  power: "power_value",
  current: "current_value",
  voltage: "voltage_value",
  energy: "energy_value",
  linkQuality: "linkquality_value",
  lastSeen: "last_seen_value"
};

var socketCmdPath = vdevName + "/" + cells.cmd;
var socketStatePath = vdevName + "/" + cells.state;

// Debounce merges fast toggles into one command (in ms).
var commandDebounceMs = 250;
// Cooldown blocks too-frequent MQTT writes even if state still changes (in ms).
var commandCooldownMs = 1200;
var lastCommandAt = 0;
var pendingCommandTimer = null;
var pendingCommandState = null;

function vdevPath(cell) {
  return vdevName + "/" + cell;
}

function toBooleanState(mqttState) {
  return mqttState === mqttStateOn || mqttState === true;
}

function normalizeState(rawState) {
  if (typeof rawState === "boolean") {
    return rawState;
  }
  if (typeof rawState === "number") {
    if (rawState === 1) {
      return true;
    }
    if (rawState === 0) {
      return false;
    }
  }
  if (typeof rawState !== "string") {
    return null;
  }

  var state = rawState.toUpperCase();
  if (state === mqttStateOn || state === "1" || state === "TRUE") {
    return true;
  }
  if (state === mqttStateOff || state === "0" || state === "FALSE") {
    return false;
  }
  return null;
}

function publishStateCommand(desiredState) {
  var actualState = toBooleanState(dev[socketStatePath]);
  if (desiredState === actualState) {
    log("No MQTT command sent: already in state " + (actualState ? mqttStateOn : mqttStateOff));
    return;
  }

  var now = Date.now();
  if (lastCommandAt > 0 && (now - lastCommandAt) < commandCooldownMs) {
    log("No MQTT command sent: cooldown " + commandCooldownMs + " ms");
    return;
  }

  var desired = desiredState ? mqttStateOn : mqttStateOff;
  var command = JSON.stringify({ state: desired });
  publish(mqttSetTopic, command, 1, false);
  lastCommandAt = now;
  log("MQTT command published to " + mqttSetTopic + ": " + command);
}

function debounceCommand(newState) {
  if (pendingCommandTimer !== null) {
    log("MQTT command pending, rescheduling for debounce");
  }
  pendingCommandState = newState;
  pendingCommandTimer = setTimeout(function () {
    pendingCommandTimer = null;
    publishStateCommand(pendingCommandState);
    pendingCommandState = null;
  }, commandDebounceMs);
}

function pad2(value) {
  return value < 10 ? "0" + value : String(value);
}

function formatDate(value) {
  if (typeof value === "number" && isFinite(value)) {
    var ms = value;
    if (ms < 1000000000000) {
      ms = ms * 1000;
    }
    var d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() + "-" +
        pad2(d.getMonth() + 1) + "-" +
        pad2(d.getDate()) + " " +
        pad2(d.getHours()) + ":" +
        pad2(d.getMinutes()) + ":" +
        pad2(d.getSeconds());
    }
  }

  return String(value);
}

function setIfChanged(cell, value) {
  if (dev[vdevPath(cell)] !== value) {
    dev[vdevPath(cell)] = value;
    return true;
  }
  return false;
}

function updateNumericCell(cell, payloadValue) {
  if (typeof payloadValue === "number" && isFinite(payloadValue)) {
    if (setIfChanged(cell, payloadValue)) {
      log(cell + " updated: " + payloadValue);
    }
  }
}

/*********************
 *  VIRTUAL DEVICE
 *  - Separate command and actual state to avoid feedback loops.
 *  - Telemetry values (power, current, linkquality, last_seen) are read-only from MQTT.
 *********************/

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
  whenChanged: socketCmdPath,
  then: function (newValue) {
    var desired = normalizeState(newValue);
    if (desired === null) {
      log("MQTT command skipped: invalid " + cells.cmd + " value " + JSON.stringify(newValue));
      return;
    }
    debounceCommand(desired);
  }
});

/*********************
 *  MQTT TRACKER: MQTT → STATE/TELEMETRY
 *  - Update only the actual state and telemetry.
 *  - Never write back to socket_cmd here.
 *********************/
trackMqtt(mqttDeviceTopic, function (message) {
  try {
    if (!message || typeof message.value !== "string") {
      log("MQTT message skipped: invalid message format");
      return;
    }

    var payload = JSON.parse(message.value);
    log("MQTT message received from " + mqttDeviceTopic + ": " + JSON.stringify(payload));

    // Update actual ON/OFF state (only if it really changed)
    var state = normalizeState(payload.state);
    if (state !== null) {
      if (setIfChanged(cells.state, state)) {
        log("Actual socket state updated from MQTT: " + payload.state);
      }
    }

    // Update telemetry if present
    updateNumericCell(cells.power, payload.power);
    updateNumericCell(cells.current, payload.current);
    updateNumericCell(cells.voltage, payload.voltage);
    updateNumericCell(cells.energy, payload.energy);
    updateNumericCell(cells.linkQuality, payload.linkquality);

    if (payload.last_seen !== undefined) {
      var lastSeen = formatDate(payload.last_seen);
      if (setIfChanged(cells.lastSeen, lastSeen)) {
        log("Last seen: " + lastSeen);
      }
    }
  } catch (e) {
    log("MQTT JSON parse error: " + e);
  }
});
