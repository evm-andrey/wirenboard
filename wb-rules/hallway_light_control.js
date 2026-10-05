// Count increments are button events; initial values and resets are not.
(function () {
  var counter = 'wb-mr6c_108/Input 4 Double Press Counter';
  var lights = ['wb-led_70/Channel 4', 'wb-led_70/Channel 3'];
  var previous = null;
  function valid(v) { return typeof v === "number" && isFinite(v) && v >= 0 && Math.floor(v) === v; }
  setTimeout(function () { var value = dev[counter]; if (valid(value)) { previous = value; } }, 1000);
  defineRule('hallway_light_control', {
    whenChanged: counter,
    then: function (value) {
      if (!valid(value)) { log("Double press ignored: invalid counter"); return; }
      if (previous === null || value <= previous) { previous = value; return; }
      previous = value;
      for (var i = 0; i < lights.length; i++) {
        var actual = dev[lights[i]];
        if (typeof actual !== "boolean") { log("Double press skipped: unknown " + lights[i]); continue; }
        dev[lights[i]] = !actual;
        log("Double press toggled " + lights[i]);
      }
    }
  });
})();
