// Rule for controlling lighting in the bathroom
defineRule({
    whenChanged: "wb-mr6c_130/Input 5 Double Press Counter",
    then: function (newValue, devName, cellName) {
      log('Toggle wb-mr6c_111/K1');
      // Toggle the relay state
      dev["wb-mr6c_111/K1"] = !dev["wb-mr6c_111/K1"];
    }
  });
  