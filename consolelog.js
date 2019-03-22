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
    ["#00CC00", "#AAA"],
    ["#B74BDB", "black"],
    ["blue", "black"],
    ["#E50", "black"],
    ["inherit", "#800"],
    ["inherit", "#800; font-size: 2em"]
];

let g_logLevel = parseInt(sessionStorage.getItem("loglevel"));
if (isNaN(g_logLevel)) {
    g_logLevel = LOG.Warn;
}

function setLogLevel(level) {
    sessionStorage.setItem("loglevel", level);
    g_logLevel = level;
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
            "color: " + g_levelColors[0][1]);
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
        output("%c[" + g_logStr[level] + "] " + "%c" + text, "color : " + g_levelColors[level][0], "color : " + g_levelColors[level][1]);
    }
}