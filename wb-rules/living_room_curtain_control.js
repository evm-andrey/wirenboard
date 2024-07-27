// Define a virtual device for curtain control
defineVirtualDevice('LivingRoomCurtainControl', {
    title: { 'en': 'Living Room Curtain Control', 'ru': 'Управление шторами в гостиной' },
    cells: {
        toggle_button: {
            type: 'pushbutton',
            title: { 'en': 'Toggle Curtain', 'ru': 'Открыть/Закрыть шторы' }
        },
        curtain_position: {
            type: 'value',
            readonly: true,
            value: 1, // Default value (can be 1 for 'closed' and 2 for 'open')
            title: { 'en': 'Curtain Position', 'ru': 'Положение штор' },
            enum: {
                1: { 'en': 'Closed', 'ru': 'Закрыты' },
                2: { 'en': 'Open', 'ru': 'Открыты' }
            }
        }
    }
});

// Variable to track the curtain state
var isCurtainOpen = false;

// Rule to toggle the curtain state
defineRule({
    whenChanged: 'LivingRoomCurtainControl/toggle_button',
    then: function(newValue, devName, cellName) {
        if (isCurtainOpen) {
            log("Curtain is closing");
            publish("zigbee2mqtt/Living Room Curtain/set", '{"position": 100}', function (error) {
                if (error) {
                    log("Failed to publish close command: " + error);
                } else {
                    log("Successfully published close command");
                }
            });
        } else {
            log("Curtain is opening");
            publish("zigbee2mqtt/Living Room Curtain/set", '{"position": 20}', function (error) {
                if (error) {
                    log("Failed to publish open command: " + error);
                } else {
                    log("Successfully published open command");
                }
            });
        }
        isCurtainOpen = !isCurtainOpen;

        // Update the virtual device state
        dev["LivingRoomCurtainControl/curtain_position"] = isCurtainOpen ? 2 : 1;
    }
});

// Set initial state
dev["LivingRoomCurtainControl/curtain_position"] = isCurtainOpen ? 2 : 1;