// Rule for controlling lighting in the hallway
defineRule({
    whenChanged: "wb-mr6c_108/Input 4 Double Press Counter",
    then: function (newValue, devName, cellName) {
      log('Toggling wb-led_70/Channel 4 and wb-led_70/Channel 3');
      // Toggle the LEDs
      dev["wb-led_70/Channel 4"] = !dev["wb-led_70/Channel 4"];
      dev["wb-led_70/Channel 3"] = !dev["wb-led_70/Channel 3"];
    }
  });
  