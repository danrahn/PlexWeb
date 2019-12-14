/// <summary>
/// All possible log levels, from most to least verbose
/// </summary>
const LOG = {
    Extreme: -1, // Log everytime something is logged
    Tmi: 0,
    Verbose: 1,
    Info: 2,
    Warn: 3,
    Error: 4,
    Critical: 5
};

const g_logStr = ["TMI", "VERBOSE", "INFO", "WARN", "ERROR", "CRITICAL"];
const g_levelColors = [
    ["#00CC00", "#AAA", "#888"],
    ["#c661e8", "inherit", "inherit"],
    ["#88C", "inherit", "inherit"],
    ["#E50", "inherit", "inherit"],
    ["inherit", "inherit", "inherit"],
    ["inherit; font-size: 2em", "#800; font-size: 2em", "#C33; font-size: 2em"],
    ["#009900", "#AAA", "#888"]
];

let g_logLevel = parseInt(localStorage.getItem("loglevel"));
if (isNaN(g_logLevel)) {
    g_logLevel = LOG.Info;
}

let g_darkConsole = parseInt(localStorage.getItem("darkconsole"));
if (isNaN(g_darkConsole)) {
    logInfo("Welcome to the console!");
    logInfo("For best debugging results, set whether you're using a light or dark themed console via setDarkConsole(isDark), ");
    logInfo("where isDark is 1 (true) or 0 (false)");
    g_darkConsole = false;
}

function setLogLevel(level) {
    localStorage.setItem("loglevel", level);
    g_logLevel = level;
}

function setDarkConsole(dark) {
    localStorage.setItem("darkconsole", dark);
    g_darkConsole = dark;
}

function logTmi(obj, description) {
    log(obj, description, LOG.Tmi);
}

function logVerbose(obj, description) {
    log(obj, description, LOG.Verbose);
}

function logInfo(obj, description) {
    log(obj, description, LOG.Info);
}

function logWarn(obj, description) {
    log(obj, description, LOG.Warn);
}

function logError(obj, description) {
    log(obj, description, LOG.Error);
}

function log(obj, description, level) {
    if (level < g_logLevel) {
        return;
    }

    const print = function(output, text, obj, level)
    {
        textColor = `color: ${g_levelColors[level][g_darkConsole ? 2 : 1]}`;
        titleColor = `color: ${g_levelColors[level][0]}`;
        output(text, textColor, titleColor, textColor, titleColor, textColor, obj);
    }

    let d = getTimestring();
    let typ = (obj) => typeof(obj) == "string" ? "%s" : "%o";
    let curState = (obj) => typeof(obj) == "string" ? obj : JSON.parse(JSON.stringify(obj));
    if (g_logLevel === LOG.Extreme) {
        print(
            console.log,
            `%c[%cEXTREME%c][%c${d}%c] Called log with '${description ? description + ': ' : ''}${typ(obj)}, ${level}'`, curState(obj), 6);
    }

    let output = level < LOG.Info ? console.log : level < LOG.Warn ? console.info : level < LOG.Error ? console.warn : console.error;
    print(output, `%c[%c${g_logStr[level]}%c][%c${d}%c] ${description ? description + ': ' : ''}${typ(obj)}`, curState(obj), level);

    function getTimestring() {
        let z = function(n,x=2) {
            return ('00' + n).substr(-x);
        }

        let d = new Date();
        return `${d.getFullYear()}.${z(d.getMonth()+1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(d.getMilliseconds(),3)}`;
    }
}