// Определяем виртуальное устройство для управления розеткой
defineVirtualDevice("SmartSocketControl", {
    title: { 'en': 'Smart Socket Control', 'ru': 'Управление умной розеткой' },
    cells: {
        socket_state: {
            type: "switch",
            title: { 'en': 'Toggle Socket', 'ru': 'Вкл/Выкл розетку' },
            value: false
        },
        power_value: {
            type: "value",
            title: { 'en': 'Power Consumption', 'ru': 'Потребляемая мощность' },
            value: 0,
            units: "W"
        },
        voltage_value: {
            type: "value",
            title: { 'en': 'Voltage', 'ru': 'Напряжение' },
            value: 0,
            units: "V"
        },
        energy_value: {
            type: "value",
            title: { 'en': 'Energy Consumption', 'ru': 'Сумма потребленной энергии' },
            value: 0,
            units: "kWh"
        }
    }
});

// Подписка на изменения виртуального переключателя
defineRule({
    whenChanged: "SmartSocketControl/socket_state",
    then: function (newValue) {
        var command = JSON.stringify({ state: newValue ? "ON" : "OFF" });
        publish("zigbee2mqtt/0x70b3d52b6011db96/set", command);
        log("Команда отправлена: " + command);
    }
});

// Отслеживание MQTT сообщений и обновление состояния виртуального устройства
trackMqtt("zigbee2mqtt/0x70b3d52b6011db96", function (message) {
    log("MQTT сообщение получено: " + JSON.stringify(message));

    // Парсим значение JSON из сообщения
    var messageContent = JSON.parse(message.value);

    // Проверяем значение состояния
    if (messageContent.state === "ON") {
        dev["SmartSocketControl/socket_state"] = true;
        log("Переключатель установлен в состояние: Включено");
    } else if (messageContent.state === "OFF") {
        dev["SmartSocketControl/socket_state"] = false;
        log("Переключатель установлен в состояние: Выключено");
    }

    // Обновляем значение мощности
    if (messageContent.power !== undefined) {
        dev["SmartSocketControl/power_value"] = messageContent.power;
        log("Потребляемая мощность: " + messageContent.power + " Вт");
    }

    // Обновляем значение напряжения
    if (messageContent.voltage !== undefined) {
        dev["SmartSocketControl/voltage_value"] = messageContent.voltage;
        log("Напряжение: " + messageContent.voltage + " В");
    }

    // Обновляем сумму потребленной энергии
    if (messageContent.energy !== undefined) {
        dev["SmartSocketControl/energy_value"] = messageContent.energy;
        log("Сумма потребленной энергии: " + messageContent.energy + " кВт·ч");
    }
});
