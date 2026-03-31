// Dashboard-friendly sunrise/sunset schedule for display on Wiren Board widgets.
(function () {
  var vdevName = "SunTimesDashboard";
  var cronExpr = "*/5 * * * *";
  var degToRad = Math.PI / 180;
  var radToDeg = 180 / Math.PI;

  var cells = {
    enabled: "enabled",
    latitude: "latitude",
    longitude: "longitude",
    timezoneOffsetHours: "timezoneOffsetHours",
    sunriseToday: "sunriseToday",
    sunsetToday: "sunsetToday",
    nextSunrise: "nextSunrise",
    nextSunset: "nextSunset",
    nextEventLabel: "nextEventLabel",
    nextEventIn: "nextEventIn",
    lastUpdated: "lastUpdated",
    lastError: "lastError"
  };

  function cellPath(name) {
    return vdevName + "/" + name;
  }

  function ensureTwoDigits(number) {
    var text = String(number);
    if (text.length < 2) {
      return "0" + text;
    }
    return text;
  }

  function getTimezoneOffsetMs() {
    return getConfiguredNumber(cellPath(cells.timezoneOffsetHours), 3) * 60 * 60 * 1000;
  }

  function shiftToConfiguredTimezone(dateObj) {
    if (!dateObj || !dateObj.getTime) return null;
    return new Date(dateObj.getTime() + getTimezoneOffsetMs());
  }

  function formatTime(dateObj) {
    var shiftedDate = shiftToConfiguredTimezone(dateObj);
    if (!shiftedDate) return "-";
    return ensureTwoDigits(shiftedDate.getUTCHours()) + ":" + ensureTwoDigits(shiftedDate.getUTCMinutes());
  }

  function formatDateTime(dateObj) {
    var shiftedDate = shiftToConfiguredTimezone(dateObj);
    if (!shiftedDate) return "-";
    return (
      String(shiftedDate.getUTCFullYear()) + "-" +
      ensureTwoDigits(shiftedDate.getUTCMonth() + 1) + "-" +
      ensureTwoDigits(shiftedDate.getUTCDate()) + " " +
      ensureTwoDigits(shiftedDate.getUTCHours()) + ":" +
      ensureTwoDigits(shiftedDate.getUTCMinutes())
    );
  }

  function minutesFromNow(targetDate, now) {
    if (!targetDate || !now) return "-";
    var delta = Math.round((targetDate.getTime() - now.getTime()) / 60000);
    var sign = delta >= 0 ? "+" : "-";
    var abs = Math.abs(delta);
    var hours = Math.floor(abs / 60);
    var minutes = abs % 60;
    return sign + String(hours) + "h " + ensureTwoDigits(minutes) + "m";
  }

  function toDateValue(value) {
    if (!value) return null;
    if (typeof value.getTime === "function") return value;
    if (typeof value === "number") return new Date(value);
    return new Date(value);
  }

  function getConfiguredNumber(valuePath, fallback) {
    var value = dev[valuePath];
    var num = Number(value);
    if (typeof num === "number" && isFinite(num)) {
      return num;
    }
    return fallback;
  }

  function getCoordinates() {
    return {
      latitude: getConfiguredNumber(cellPath(cells.latitude), 54.5293),
      longitude: getConfiguredNumber(cellPath(cells.longitude), 36.2754)
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

  function computeTimesForLocalDate(localDate) {
    var coords = getCoordinates();
    var sunrise = calcSunTime(localDate, coords.latitude, coords.longitude, true);
    var sunset = calcSunTime(localDate, coords.latitude, coords.longitude, false);

    if (!sunrise || !sunset) {
      dev[cellPath(cells.lastError)] = "Unable to compute sunrise/sunset";
      return null;
    }

    return {
      sunrise: sunrise,
      sunset: sunset
    };
  }

  function computeTimes(now) {
    return computeTimesForLocalDate(shiftToConfiguredTimezone(now));
  }

  function computeTomorrowTimes(now) {
    var tomorrow = shiftToConfiguredTimezone(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return computeTimesForLocalDate(tomorrow);
  }

  function updateDashboard() {
    var now = new Date();

    if (!dev[cellPath(cells.enabled)]) {
      return;
    }

    var timesToday = computeTimes(now);
    if (!timesToday || !timesToday.sunrise || !timesToday.sunset) {
      return;
    }

    var sunriseToday = toDateValue(timesToday.sunrise);
    var sunsetToday = toDateValue(timesToday.sunset);

    dev[cellPath(cells.sunriseToday)] = "Сегодня: " + formatTime(sunriseToday);
    dev[cellPath(cells.sunsetToday)] = "Сегодня: " + formatTime(sunsetToday);

    var timesTomorrow = computeTomorrowTimes(now);
    var sunriseTomorrow = timesTomorrow ? toDateValue(timesTomorrow.sunrise) : null;
    var sunsetTomorrow = timesTomorrow ? toDateValue(timesTomorrow.sunset) : null;

    var nextEvent = "—";
    var nextTime = null;

    if (now.getTime() < sunriseToday.getTime()) {
      nextEvent = "Восход";
      nextTime = sunriseToday;
    } else if (now.getTime() < sunsetToday.getTime()) {
      nextEvent = "Заход";
      nextTime = sunsetToday;
    } else if (sunriseTomorrow) {
      nextEvent = "Восход (завтра)";
      nextTime = sunriseTomorrow;
    }

    dev[cellPath(cells.nextSunrise)] = "Следующий: " + formatDateTime(
      now.getTime() < sunriseToday.getTime() ? sunriseToday : sunriseTomorrow
    );
    dev[cellPath(cells.nextSunset)] = "Следующий: " + formatDateTime(
      now.getTime() < sunsetToday.getTime() ? sunsetToday : sunsetTomorrow
    );
    dev[cellPath(cells.nextEventLabel)] = nextEvent;
    dev[cellPath(cells.nextEventIn)] = minutesFromNow(nextTime, now);
    dev[cellPath(cells.lastUpdated)] = formatDateTime(now);
    dev[cellPath(cells.lastError)] = "";
  }

  defineVirtualDevice(vdevName, {
    title: {
      en: "Sun Times",
      ru: "Солнечные события"
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
      sunriseToday: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Sunrise today", ru: "Восход сегодня" }
      },
      sunsetToday: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Sunset today", ru: "Закат сегодня" }
      },
      nextSunrise: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Next sunrise", ru: "Следующий восход" }
      },
      nextSunset: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Next sunset", ru: "Следующий закат" }
      },
      nextEventLabel: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Next event", ru: "Следующее событие" }
      },
      nextEventIn: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Remaining", ru: "Осталось" }
      },
      lastUpdated: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Updated", ru: "Обновлено" }
      },
      lastError: {
        type: "text",
        value: "",
        readonly: true,
        title: { en: "Error", ru: "Ошибка" }
      }
    }
  });

  defineRule("sun_times_dashboard_widget_update", {
    when: cron(cronExpr),
    then: function () {
      updateDashboard();
    }
  });

  defineRule("sun_times_dashboard_widget_recalc", {
    whenChanged: [
      cellPath(cells.enabled),
      cellPath(cells.latitude),
      cellPath(cells.longitude),
      cellPath(cells.timezoneOffsetHours)
    ],
    then: function () {
      updateDashboard();
    }
  });
})();
