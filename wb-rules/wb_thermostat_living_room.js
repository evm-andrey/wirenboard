// Existing command IDs preserved; telemetry updates readonly actual channels first.
(function () {
  var id = "WB_thermostat_living_room";
  var base = "zigbee2mqtt/Thermostat living room";
  var nativeId = "Thermostat_living_room";
  var cells = { setpoint: "current_heating_setpoint", mode: "system_mode",
    setpointCmd: "heating_setpoint_cmd", modeCmd: "system_mode_cmd",
    setpointState: "heating_setpoint_state", modeState: "system_mode_state",
    temperature: "local_temperature", running: "running_state" };
  var actual = { setpoint: null, mode: null };
  var pending = {};
  function path(cell) { return id + "/" + cell; }
  function finite(value) { return typeof value === "number" && isFinite(value); }
  function update(cell, value) { if (dev[path(cell)] !== value) { dev[path(cell)] = value; } }
  function setpointTelemetry(value) {
    if (!finite(value)) { return; }
    actual.setpoint = value;
    update(cells.setpointState, value);
    // Command cells retain requested values; telemetry never writes into them.
  }
  function modeTelemetry(value) {
    if (value !== "heat" && value !== "off") { return; }
    actual.mode = value === "heat";
    update(cells.modeState, actual.mode);
    // Actual mode is separate from both command aliases.
  }
  function command(field, value) {
    if (field === "setpoint") {
      if (!finite(value) || value < 20 || value > 30) { log(id + " rejected setpoint command"); return; }
    } else if (typeof value !== "boolean") { log(id + " rejected mode command"); return; }
    if (actual[field] === null) { log(id + " command skipped: no actual " + field); return; }
    if (actual[field] === value) { return; }
    var now = Date.now(); var prev = pending[field];
    if (prev && prev.value === value && now - prev.at < 500) { return; }
    var payload = {};
    payload[field === "setpoint" ? "current_heating_setpoint" : "system_mode"] = field === "mode" ? (value ? "heat" : "off") : value;
    publish(base + "/set", JSON.stringify(payload), 2, false);
    pending[field] = { value: value, at: now };
    log(id + " command published: " + JSON.stringify(payload));
  }
  defineVirtualDevice(id, { title: "Thermostat Living Room", cells: {
    current_heating_setpoint: { type: "range", min: 20, max: 30, value: 20, title: "Уставка (команда, совместимость)" },
    heating_setpoint_cmd: { type: "range", min: 20, max: 30, value: 20, title: "Задать температуру" },
    heating_setpoint_state: { type: "value", value: 0, readonly: true, title: "Фактическая уставка", units: "°C" },
    system_mode: { type: "switch", value: false, title: "Отопление (команда, совместимость)" },
    system_mode_cmd: { type: "switch", value: false, title: "Включить отопление" },
    system_mode_state: { type: "switch", value: false, readonly: true, title: "Фактический режим отопления" },
    local_temperature: { type: "value", value: 0, readonly: true },
    running_state: { type: "text", value: "", readonly: true }
  } });
  function commandRule(cell, field) {
    defineRule(id + "_" + cell + "_command", { whenChanged: path(cell), then: function (value) { command(field, value); } });
    // Explicit /on retries also work when the command cell already has this value.
    trackMqtt("/devices/" + id + "/controls/" + cell + "/on", function (message) {
      if (message.retained) { log(id + " retained command ignored"); return; }
      var value = message.value;
      if (field === "mode") {
        if (value !== "1" && value !== "0") { log(id + " invalid mode payload"); return; }
        value = value === "1";
      } else {
        if (typeof value !== "string" || value.trim() === "") { return; }
        value = Number(value);
      }
      command(field, value);
    });
  }
  commandRule(cells.setpoint, "setpoint"); commandRule(cells.setpointCmd, "setpoint");
  commandRule(cells.mode, "mode"); commandRule(cells.modeCmd, "mode");
  trackMqtt(base, function (message) {
    var data;
    try { data = JSON.parse(message.value); }
    catch (e) { log(id + " telemetry JSON error: " + e); return; }
    if (!data || typeof data !== "object" || Array.isArray(data)) { return; }
    setpointTelemetry(data.current_heating_setpoint); modeTelemetry(data.system_mode);
    if (finite(data.local_temperature)) { update(cells.temperature, data.local_temperature); }
    if (typeof data.running_state === "string") { update(cells.running, data.running_state); }
  });
  // Seed actual states immediately from the existing Zigbee driver's retained controls.
  function nativeTrack(cell, callback) {
    trackMqtt("/devices/" + nativeId + "/controls/" + cell, function (message) { callback(message.value); });
  }
  nativeTrack("current_heating_setpoint", function (v) { if (typeof v === "string" && v.trim() !== "") { setpointTelemetry(Number(v)); } });
  nativeTrack("system_mode", modeTelemetry);
  nativeTrack("local_temperature", function (v) { if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v))) { update(cells.temperature, Number(v)); } });
  nativeTrack("running_state", function (v) { if (typeof v === "string") { update(cells.running, v); } });
})();
