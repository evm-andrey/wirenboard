// Файл: wb_thermostat_living_room.js

// Определяем виртуальное устройство для гостиной
defineVirtualDevice("WB_thermostat_living_room", {
    title: "Thermostat Living Room",
    cells: {
        current_heating_setpoint: { type: "range", min: 20, max: 30, value: 20 },
        local_temperature: { type: "value", value: 0, readonly: true },
        system_mode: { type: "switch", value: false },
        running_state: { type: "text", value: "", readonly: true }
    }
});

trackMqtt("zigbee2mqtt/Thermostat living room", function(message) {
    var data;
    try {
        data = JSON.parse(message.value);
    } catch (e) {
        log("Ошибка парсинга JSON: " + e);
        return;
    }
    if (data === null || typeof data !== "object") {
        log("Игнорируется не объект JSON термостата");
        return;
    }
    if (typeof data.local_temperature === "number" && isFinite(data.local_temperature)) {
        dev["WB_thermostat_living_room"]["local_temperature"] = data.local_temperature;
    }
    if (typeof data.running_state === "string") {
        dev["WB_thermostat_living_room"]["running_state"] = data.running_state;
    }
    if (typeof data.current_heating_setpoint === "number" && isFinite(data.current_heating_setpoint)) {
        dev["WB_thermostat_living_room"]["current_heating_setpoint"] = data.current_heating_setpoint;
    }
    if (typeof data.system_mode === "string") {
        dev["WB_thermostat_living_room"]["system_mode"] = (data.system_mode === "heat");
    }
});

defineRule("WB_thermostat_living_room_setpoint_changed", {
    whenChanged: "WB_thermostat_living_room/current_heating_setpoint",
    then: function(newValue, devName, cellName) {
        publish("zigbee2mqtt/Thermostat living room/set", 
                JSON.stringify({ current_heating_setpoint: newValue }), 
                2, false);
    }
});

defineRule("WB_thermostat_living_room_mode_changed", {
    whenChanged: "WB_thermostat_living_room/system_mode",
    then: function(newValue, devName, cellName) {
        var mode = newValue ? "heat" : "off";
        publish("zigbee2mqtt/Thermostat living room/set", 
                JSON.stringify({ system_mode: mode }), 
                2, false);
    }
});
