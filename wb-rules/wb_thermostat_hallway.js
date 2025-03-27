// Файл: wb_thermostat_hallway.js

// Определяем виртуальное устройство для коридора
defineVirtualDevice("WB_thermostat_hallway", {
    title: "Thermostat Hallway",
    cells: {
        current_heating_setpoint: { type: "range", min: 20, max: 30, value: 20 },
        local_temperature: { type: "value", value: 0, readonly: true },
        system_mode: { type: "switch", value: false },
        running_state: { type: "text", value: "", readonly: true }
    }
});

trackMqtt("zigbee2mqtt/Thermostat hallway", function(message) {
    var data;
    try {
        data = JSON.parse(message.value);
    } catch (e) {
        log("Ошибка парсинга JSON: " + e);
        return;
    }
    if ("local_temperature" in data) {
        dev["WB_thermostat_hallway"]["local_temperature"] = data.local_temperature;
    }
    if ("running_state" in data) {
        dev["WB_thermostat_hallway"]["running_state"] = data.running_state;
    }
    if ("current_heating_setpoint" in data) {
        dev["WB_thermostat_hallway"]["current_heating_setpoint"] = data.current_heating_setpoint;
    }
    if ("system_mode" in data) {
        dev["WB_thermostat_hallway"]["system_mode"] = (data.system_mode === "heat");
    }
});

defineRule("WB_thermostat_hallway_setpoint_changed", {
    whenChanged: "WB_thermostat_hallway/current_heating_setpoint",
    then: function(newValue, devName, cellName) {
        publish("zigbee2mqtt/Thermostat hallway/set", 
                JSON.stringify({ current_heating_setpoint: newValue }), 
                2, false);
    }
});

defineRule("WB_thermostat_hallway_mode_changed", {
    whenChanged: "WB_thermostat_hallway/system_mode",
    then: function(newValue, devName, cellName) {
        var mode = newValue ? "heat" : "off";
        publish("zigbee2mqtt/Thermostat hallway/set", 
                JSON.stringify({ system_mode: mode }), 
                2, false);
    }
});
