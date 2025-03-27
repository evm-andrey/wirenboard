// Файл: wb_thermostat_bedroom.js

// Определяем виртуальное устройство для спальни
defineVirtualDevice("WB_thermostat_bedroom", {
    title: "Thermostat Bedroom",
    cells: {
        // Ползунок для установки температуры (от 20 до 30°C)
        current_heating_setpoint: { type: "range", min: 20, max: 30, value: 20 },
        // Отображение текущей температуры (read-only)
        local_temperature: { type: "value", value: 0, readonly: true },
        // Переключатель режима (false = off, true = heat)
        system_mode: { type: "switch", value: false },
        // Отображение текущего состояния работы (read-only)
        running_state: { type: "text", value: "", readonly: true }
    }
});

// Подписка на обновления состояния термостата через MQTT
trackMqtt("zigbee2mqtt/Thermostat bedroom", function(message) {
    var data;
    try {
        data = JSON.parse(message.value);
    } catch (e) {
        log("Ошибка парсинга JSON: " + e);
        return;
    }
    if ("local_temperature" in data) {
        dev["WB_thermostat_bedroom"]["local_temperature"] = data.local_temperature;
    }
    if ("running_state" in data) {
        dev["WB_thermostat_bedroom"]["running_state"] = data.running_state;
    }
    if ("current_heating_setpoint" in data) {
        dev["WB_thermostat_bedroom"]["current_heating_setpoint"] = data.current_heating_setpoint;
    }
    if ("system_mode" in data) {
        dev["WB_thermostat_bedroom"]["system_mode"] = (data.system_mode === "heat");
    }
});

// Правило для изменения температуры (ползунок)
defineRule("WB_thermostat_bedroom_setpoint_changed", {
    whenChanged: "WB_thermostat_bedroom/current_heating_setpoint",
    then: function(newValue, devName, cellName) {
        publish("zigbee2mqtt/Thermostat bedroom/set", 
                JSON.stringify({ current_heating_setpoint: newValue }), 
                2, false);
    }
});

// Правило для изменения режима работы (переключатель)
defineRule("WB_thermostat_bedroom_mode_changed", {
    whenChanged: "WB_thermostat_bedroom/system_mode",
    then: function(newValue, devName, cellName) {
        var mode = newValue ? "heat" : "off";
        publish("zigbee2mqtt/Thermostat bedroom/set", 
                JSON.stringify({ system_mode: mode }), 
                2, false);
    }
});
