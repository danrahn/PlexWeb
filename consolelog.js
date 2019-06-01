const LOG = {
    Extreme: -1,
    Tmi: 0,
    Verbose: 1,
    Info: 2,
    Warn: 3,
    Error: 4,
    Critical: 5
};

const g_logStr = ["TMI", "VERBOSE", "INFO", "WARN", "ERROR", "CRITICAL"];
const g_levelColors = [
    ["#00CC00", "#AAA", "#666"],
    ["#B74BDB", "inherit", "inherit"],
    ["#88C", "inherit", "inherit"],
    ["#E50", "inherit", "inherit"],
    ["inherit", "inherit", "inherit"],
    ["inherit", "#800; font-size: 2em", "#C33; font-size: 2em"]
];

let g_logLevel = parseInt(sessionStorage.getItem("loglevel"));
if (isNaN(g_logLevel)) {
    g_logLevel = LOG.Info;
}

let g_darkConsole = parseInt(sessionStorage.getItem("darkconsole"));
if (isNaN(g_darkConsole)) {
    logInfo("Welcome to the console!");
    logInfo("For best debugging results, set whether you're using a light or dark themed console via setDarkConsole(isDark), ");
    logInfo("where isDark is 1 (true) or 0 (false)");
    g_darkConsole = false;
}

function setLogLevel(level) {
    sessionStorage.setItem("loglevel", level);
    g_logLevel = level;
}

function setDarkConsole(dark) {
    sessionStorage.setItem("darkconsole", dark);
    g_darkConsole = dark;
}

function logTmi(text, isObject = false) {
    log(text, LOG.Tmi, isObject);
}

function logVerbose(text, isObject = false) {
    log(text, LOG.Verbose, isObject);
}

function logInfo(text, isObject = false) {
    log(text, LOG.Info, isObject);
}

function logWarn(text, isObject = false) {
    log(text, LOG.Warn, isObject);
}

function logError(text, isObject = false) {
    log(text, LOG.Error, isObject);
}

function logJson(object, level) {
    log(JSON.stringify(object), level);
}

function log(text, level, isObject = false) {
    if (level < g_logLevel) {
        return;
    }

    if (g_logLevel === LOG.Extreme) {
        console.log("%c[TMI] " + "%cCalled log with (" + text + ", " + level + ", " + isObject + ")",
            "color: " + g_levelColors[0][0],
            "color: " + g_levelColors[0][g_darkConsole ? 2 : 1]);
    }

    let output;
    if (level < LOG.Warn) {
        output = console.log;
    } else if (level < LOG.Error) {
        output = console.warn;
    } else {
        output = console.error;
    }

    if (isObject) {
        // If we want to output an object directly (dict, array, element), don't format it
        output("%c[" + g_logStr[level] + "]", "color : " + g_levelColors[level][0]);
        output(text);
    } else {
        output("%c[" + g_logStr[level] + "] " + "%c" + text, "color : " + g_levelColors[level][0], "color : " + g_levelColors[level][g_darkConsole ? 2 : 1]);
    }
}