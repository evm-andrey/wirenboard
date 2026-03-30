/*********************
 * CONFIG
 *********************/
var vdevName = "KitchenCurtainControl";
var mqttDeviceTopic = "zigbee2mqtt/Kitchen Curtains";
var mqttSetTopic = mqttDeviceTopic + "/set";

var cells = {
  toggle: "toggle_button",
  position: "curtain_position",
  preset25: "preset_25",
  preset50: "preset_50",
  preset75: "preset_75",
  preset100: "preset_100"
};

var presetPositions = {
  p25: 25,
  p50: 50,
  p75: 75,
  p100: 100
};

var remoteInputCell = "wb-mr6c_115/Input 3 Double Press Counter";
var commandCooldownMs = 1200;
var lastCommandAt = 0;

/*********************
 * HELPERS
 *********************/
function cellPath(cellName) {
  return vdevName + "/" + cellName;
}

function setIfChanged(cellName, value) {
  var path = cellPath(cellName);
  if (dev[path] !== value) {
    dev[path] = value;
    return true;
  }
  return false;
}

function toFiniteNumber(value) {
  if (typeof value === "number" && isFinite(value)) {
    return value;
  }
  var numeric = parseInt(value, 10);
  if (isFinite(numeric)) {
    return numeric;
  }
  return null;
}

function clampPosition(value) {
  var position = parseInt(value, 10);
  if (!isFinite(position)) {
    return null;
  }
  if (position < 0) {
    return 0;
  }
  if (position > 100) {
    return 100;
  }
  return position;
}

function isMostlyOpen(positionPercent) {
  return positionPercent <= 50;
}

function publishCurtainPosition(targetPercent) {
  var target = clampPosition(targetPercent);
  if (target === null) {
    log("MQTT command skipped: invalid curtain position");
    return;
  }

  if (toFiniteNumber(dev[cellPath(cells.position)]) === target) {
    log("No MQTT command sent: curtain already at " + target + "%");
    return;
  }

  var now = Date.now();
  if (lastCommandAt > 0 && (now - lastCommandAt) < commandCooldownMs) {
    log("No MQTT command sent: cooldown " + commandCooldownMs + " ms");
    return;
  }

  var payload = JSON.stringify({ position: target });
  // publish(topic, payload, qos, retain)
  publish(mqttSetTopic, payload, 1, false);
  lastCommandAt = now;

  // Optimistic update for UI responsiveness.
  setIfChanged(cells.position, target);
  log("MQTT curtain command published to " + mqttSetTopic + ": " + payload);
}

function toggleCurtain() {
  var current = toFiniteNumber(dev[cellPath(cells.position)]);
  if (current === null) {
    current = presetPositions.p100;
  }
  publishCurtainPosition(isMostlyOpen(current) ? presetPositions.p100 : presetPositions.p25);
}

function handleStatePayload(payload) {
  if (!payload) {
    return;
  }

  var nextState = null;
  if (typeof payload.position === "number" || typeof payload.position === "string") {
    nextState = clampPosition(payload.position);
  }

  if (nextState === null && typeof payload.state === "string") {
    var normalized = payload.state.toUpperCase();
    if (normalized === "OPEN" || normalized === "OPENING") {
      nextState = presetPositions.p25;
    } else if (normalized === "CLOSED" || normalized === "CLOSING") {
      nextState = presetPositions.p100;
    }
  }

  if (nextState !== null && setIfChanged(cells.position, nextState)) {
    log("Curtain actual state updated from MQTT: " + nextState + "%");
  }
}

/*********************
 * VIRTUAL DEVICE
 *********************/
defineVirtualDevice(vdevName, {
  title: { "en": "Kitchen Curtain Control", "ru": "Управление шторами на кухне" },
  cells: {
    toggle_button: {
      type: "pushbutton",
      title: { "en": "Toggle Curtain", "ru": "Открыть/Закрыть шторы" }
    },
    curtain_position: {
      type: "value",
      readonly: true,
      value: presetPositions.p100,
      title: { "en": "Curtain Position (%)", "ru": "Положение штор (%)" },
      units: "%"
    },
    preset_25: {
      type: "pushbutton",
      title: { "en": "Preset 25%", "ru": "Положение 25%" }
    },
    preset_50: {
      type: "pushbutton",
      title: { "en": "Preset 50%", "ru": "Положение 50%" }
    },
    preset_75: {
      type: "pushbutton",
      title: { "en": "Preset 75%", "ru": "Положение 75%" }
    },
    preset_100: {
      type: "pushbutton",
      title: { "en": "Preset 100%", "ru": "Положение 100%" }
    }
  }
});

/*********************
 * COMMAND RULES
 *********************/
defineRule({
  name: "KitchenCurtainControl/toggle_local",
  whenChanged: cellPath(cells.toggle),
  then: function () {
    toggleCurtain();
  }
});

defineRule({
  name: "KitchenCurtainControl/toggle_remote",
  whenChanged: remoteInputCell,
  then: function () {
    log("Toggle from remote input");
    toggleCurtain();
  }
});

defineRule({
  name: "KitchenCurtainControl/preset_25",
  whenChanged: cellPath(cells.preset25),
  then: function () {
    publishCurtainPosition(presetPositions.p25);
  }
});

defineRule({
  name: "KitchenCurtainControl/preset_50",
  whenChanged: cellPath(cells.preset50),
  then: function () {
    publishCurtainPosition(presetPositions.p50);
  }
});

defineRule({
  name: "KitchenCurtainControl/preset_75",
  whenChanged: cellPath(cells.preset75),
  then: function () {
    publishCurtainPosition(presetPositions.p75);
  }
});

defineRule({
  name: "KitchenCurtainControl/preset_100",
  whenChanged: cellPath(cells.preset100),
  then: function () {
    publishCurtainPosition(presetPositions.p100);
  }
});

/*********************
 * MQTT TRACKER: UPDATE ONLY THE FACT
 *********************/
trackMqtt(mqttDeviceTopic, function (message) {
  try {
    if (!message || typeof message.value !== "string") {
      log("MQTT message skipped: invalid message format");
      return;
    }

    var payload = JSON.parse(message.value);
    handleStatePayload(payload);
  } catch (e) {
    log("MQTT JSON parse error: " + e);
  }
});
