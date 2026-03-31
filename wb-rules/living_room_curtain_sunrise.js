// Open Living Room curtain at calculated sunrise
(function () {
  var vdevName = "LivingRoomSunriseCurtain";
  var mqttDeviceTopic = "zigbee2mqtt/Living Room Curtain";
  var mqttSetTopic = mqttDeviceTopic + "/set";
  var curtainPositionStatePath = "LivingRoomCurtainControl/curtain_position";
  var desiredOpenPosition = 25;
  var cronExpr = "* * * * *";
  var degToRad = Math.PI / 180;
  var radToDeg = 180 / Math.PI;

  var cells = {
    enabled: "enabled",
    latitude: "latitude",
    longitude: "longitude",
    timezoneOffsetHours: "timezoneOffsetHours",
    offsetMinutes: "offsetMinutes",
    lastOpenedDate: "lastOpenedDate",
    lastActionLog: "lastActionLog",
    lastError: "lastError"
  };

  function cellPath(name) {
    return vdevName + "/" + name;
  }

  function getTimezoneOffsetMs() {
    return getConfiguredNumber(cells.timezoneOffsetHours, 3) * 60 * 60 * 1000;
  }

  function shiftToConfiguredTimezone(dateObj) {
    if (!dateObj || !dateObj.getTime) return null;
    return new Date(dateObj.getTime() + getTimezoneOffsetMs());
  }

  function getDateKey(dateValue) {
    var localDate = shiftToConfiguredTimezone(dateValue);
    var y = localDate.getUTCFullYear();
    var m = String(localDate.getUTCMonth() + 1);
    var d = String(localDate.getUTCDate());

    if (m.length < 2) m = "0" + m;
    if (d.length < 2) d = "0" + d;

    return y + "-" + m + "-" + d;
  }

  function isFiniteNumber(value) {
    return (typeof value === "number" && isFinite(value));
  }

  function clampPosition(value) {
    if (!isFiniteNumber(value)) return null;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
  }

  function getConfiguredNumber(cellName, fallback) {
    var value = dev[cellPath(cellName)];
    var numberValue = Number(value);
    if (isFiniteNumber(numberValue)) return numberValue;
    return fallback;
  }

  function getLatitudeLongitude() {
    return {
      latitude: getConfiguredNumber(cells.latitude, 54.5293),
      longitude: getConfiguredNumber(cells.longitude, 36.2754)
    };
  }

  function normalizeDegrees(value) {
    while (value < 0) {
      value += 360;
    }
    while (value >= 360) {
      value -= 360;
    }
    return value;
  }

  function dayOfYear(dateObj) {
    var start = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
    var diff = dateObj.getTime() - start.getTime();
    return Math.floor(diff / 86400000) + 1;
  }

  function buildUtcDate(dateObj, utcHourValue) {
    if (utcHourValue === null) return null;

    var wholeHours = Math.floor(utcHourValue);
    var wholeMinutes = Math.floor((utcHourValue - wholeHours) * 60);
    var wholeSeconds = Math.round((((utcHourValue - wholeHours) * 60) - wholeMinutes) * 60);

    if (wholeSeconds >= 60) {
      wholeSeconds -= 60;
      wholeMinutes += 1;
    }
    if (wholeMinutes >= 60) {
      wholeMinutes -= 60;
      wholeHours += 1;
    }

    return new Date(Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      wholeHours,
      wholeMinutes,
      wholeSeconds,
      0
    ));
  }

  function calcSunTime(dateObj, latitude, longitude, isSunrise) {
    var zenith = 90.8333;
    var n = dayOfYear(dateObj);
    var lngHour = longitude / 15;
    var t = n + ((isSunrise ? 6 : 18) - lngHour) / 24;
    var M = (0.9856 * t) - 3.289;
    var L = M + (1.916 * Math.sin(M * degToRad)) + (0.020 * Math.sin(2 * M * degToRad)) + 282.634;
    var RA = normalizeDegrees(Math.atan(0.91764 * Math.tan(L * degToRad)) * radToDeg);
    var Lquadrant = Math.floor(L / 90) * 90;
    var RAquadrant = Math.floor(RA / 90) * 90;
    var sinDec;
    var cosDec;
    var cosH;
    var H;
    var T;
    var UT;

    L = normalizeDegrees(L);
    RA = normalizeDegrees(RA + (Lquadrant - RAquadrant)) / 15;

    sinDec = 0.39782 * Math.sin(L * degToRad);
    cosDec = Math.cos(Math.asin(sinDec));

    cosH = (
      Math.cos(zenith * degToRad) -
      (sinDec * Math.sin(latitude * degToRad))
    ) / (cosDec * Math.cos(latitude * degToRad));

    if (cosH > 1 || cosH < -1) {
      return null;
    }

    H = isSunrise
      ? 360 - (Math.acos(cosH) * radToDeg)
      : Math.acos(cosH) * radToDeg;

    H = H / 15;
    T = H + RA - (0.06571 * t) - 6.622;
    UT = normalizeDegrees((T - lngHour) * 15) / 15;

    return buildUtcDate(dateObj, UT);
  }

  function getCurrentSunriseTime(now) {
    var coords = getLatitudeLongitude();
    var localNow = shiftToConfiguredTimezone(now);
    var sunrise = calcSunTime(localNow, coords.latitude, coords.longitude, true);
    if (!sunrise) {
      dev[cellPath(cells.lastError)] = "Unable to compute sunrise";
      return null;
    }
    dev[cellPath(cells.lastError)] = "";
    return sunrise;
  }

  function isAlreadyOpenedToday(now) {
    var lastOpenedDate = dev[cellPath(cells.lastOpenedDate)];
    return (typeof lastOpenedDate === "string" && lastOpenedDate === getDateKey(now));
  }

  function isAlreadyOpenEnough() {
    var currentPos = dev[curtainPositionStatePath];
    if (!isFiniteNumber(currentPos)) return false;
    return currentPos >= (desiredOpenPosition - 1);
  }

  function publishOpenCommand(targetPosition) {
    var safePosition = clampPosition(targetPosition);
    if (safePosition === null) return;

    var payload = {
      position: safePosition
    };

    var payloadText = JSON.stringify(payload);
    try {
      publish(mqttSetTopic, payloadText, 1, false);
      log("INFO: living room curtain open by sunrise command published: {}", payloadText);
    } catch (e) {
      log("ERROR: publish curtain command failed: {}", e);
      dev[cellPath(cells.lastError)] = "publish failed: " + e;
    }
  }

  defineVirtualDevice(vdevName, {
    title: {
      en: "Living Room Curtain Sunrise",
      ru: "Расписание рассвета для штор в гостиной"
    },
    titleReadable: true,
    cells: {
      enabled: {
        type: "switch",
        value: true,
        title: { en: "Enabled", ru: "Включить" }
      },
      latitude: {
        type: "value",
        value: 54.5293,
        title: { en: "Latitude", ru: "Широта" }
      },
      longitude: {
        type: "value",
        value: 36.2754,
        title: { en: "Longitude", ru: "Долгота" }
      },
      timezoneOffsetHours: {
        type: "value",
        value: 3,
        title: { en: "Timezone offset", ru: "Смещение часового пояса" }
      },
      offsetMinutes: {
        type: "value",
        value: 0,
        title: { en: "Sunrise offset (minutes)", ru: "Смещение от рассвета (минуты)" }
      },
      lastOpenedDate: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Last opened date", ru: "Последнее открытие" }
      },
      lastActionLog: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Last action", ru: "Последнее действие" }
      },
      lastError: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Error", ru: "Ошибка" }
      }
    }
  });

  dev[cellPath(cells.lastError)] = "";

  defineRule("living_room_sunrise_curtain", {
    when: cron(cronExpr),
    then: function () {
      if (!dev[cellPath(cells.enabled)]) {
        return;
      }

      var now = new Date();
      var sunrise = getCurrentSunriseTime(now);
      if (!sunrise) {
        return;
      }

      var offsetMinutes = getConfiguredNumber(cells.offsetMinutes, 0);
      if (!isFiniteNumber(offsetMinutes)) {
        offsetMinutes = 0;
      }
      var offsetAtMs = offsetMinutes * 60 * 1000;
      sunrise = new Date(sunrise.getTime() + offsetAtMs);

      var diffMs = now.getTime() - sunrise.getTime();
      if (Math.abs(diffMs) > 60 * 1000) {
        return;
      }

      if (isAlreadyOpenEnough()) {
        dev[cellPath(cells.lastActionLog)] = "Skipped at " + now.toISOString() + ", already open";
        return;
      }

      if (isAlreadyOpenedToday(now)) {
        dev[cellPath(cells.lastActionLog)] = "Skipped at " + now.toISOString() + ", already opened today";
        return;
      }

      publishOpenCommand(desiredOpenPosition);
      dev[cellPath(cells.lastOpenedDate)] = getDateKey(now);
      dev[cellPath(cells.lastActionLog)] = "Opened at " + now.toISOString();
    }
  });
})();
