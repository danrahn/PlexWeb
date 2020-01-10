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
    ["#00CC00", "#00AA00", "#AAA", "#888"],
    ["#c661e8", "#c661e8", "inherit", "inherit"],
    ["blue", "#88C", "inherit", "inherit"],
    ["E50", "#C40", "inherit", "inherit"],
    ["inherit", "inherit", "inherit", "inherit"],
    ["inherit; font-size: 2em", "inherit; font-size: 2em", "#800; font-size: 2em", "#C33; font-size: 2em"],
    ["#009900", "#006600", "#AAA", "#888"]
];

const g_traceColors = [
    ["#00CC00", "#00AA00", "#AAA", "#888"],
    ["#c661e8", "#c661e8", "inherit", "inherit"],
    ["#blue", "#88C", "inherit", "inherit"],
    ["#E50; background-color: #FFFBE5", "#C40; background-color: #332B00", "inherit; background-color: #FFFBE5", "#DFC185; background-color: #332B00"],
    ["red; background-color: #FEF0EF", "#D76868; background-color: #290000", "red; background-color: #FEF0EF", "#D76868; background-color: #290000"],
    ["red; font-size: 2em", "red; font-size: 2em", "#800; font-size: 2em", "#C33; font-size: 2em"],
    ["#009900", "#009900", "#AAA", "#888"]
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
    g_darkConsole = 0;
}

let g_traceLogging = parseInt(localStorage.getItem("logtrace"));
if (isNaN(g_traceLogging)) {
    g_traceLogging = 0;
}

/*testAll = function()
{
    const old = g_logLevel;
    setLogLevel(-1);
    logTmi("TMI!");
    setLogLevel(0);
    logVerbose("Verbose!");
    logInfo("Info!");
    logWarn("Warn!");
    logError("Error!");
    log("Crit!", undefined, LOG.Critical);
    setLogLevel(old);
}*/

function setLogLevel(level) {
    localStorage.setItem("loglevel", level);
    g_logLevel = level;
}

function setDarkConsole(dark) {
    localStorage.setItem("darkconsole", dark);
    g_darkConsole = dark;
}

function setTrace(trace) {
    localStorage.setItem("logtrace", trace);
    g_traceLogging = trace;
}

function logTmi(obj, description, freeze) {
    log(obj, description, freeze, LOG.Tmi);
}

function logVerbose(obj, description, freeze) {
    log(obj, description, freeze, LOG.Verbose);
}

function logInfo(obj, description, freeze) {
    log(obj, description, freeze, LOG.Info);
}

function logWarn(obj, description, freeze) {
    log(obj, description, freeze, LOG.Warn);
}

function logError(obj, description, freeze) {
    log(obj, description, freeze, LOG.Error);
}

function log(obj, description, freeze, level) {
    if (level < g_logLevel) {
        return;
    }

    const print = function(output, text, obj, level, colors)
    {
        textColor = `color: ${colors[level][2 + g_darkConsole]}`;
        titleColor = `color: ${colors[level][g_darkConsole]}`;
        output(text, textColor, titleColor, textColor, titleColor, textColor, obj);
    }

    let d = getTimestring();
    let colors = g_traceLogging ? g_traceColors : g_levelColors;
    let typ = (obj) => typeof(obj) == "string" ? "%s" : "%o";

    let curState = (obj) => typeof(obj) == "string" ? obj : freeze ? JSON.parse(JSON.stringify(obj)) : obj;
    if (g_logLevel === LOG.Extreme) {
        print(
            console.log,
            `%c[%cEXTREME%c][%c${d}%c] Called log with '${description ? description + ': ' : ''}${typ(obj)}, ${level}'`, curState(obj), 6, colors);
    }

    let output = g_traceLogging ? console.trace : level < LOG.Info ? console.log : level < LOG.Warn ? console.info : level < LOG.Error ? console.warn : console.error;
    print(output, `%c[%c${g_logStr[level]}%c][%c${d}%c] ${description ? description + ': ' : ''}${typ(obj)}`, curState(obj), level, colors);

    function getTimestring() {
        let z = function(n,x=2) {
            return ('00' + n).substr(-x);
        }

        let d = new Date();
        return `${d.getFullYear()}.${z(d.getMonth()+1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(d.getMilliseconds(),3)}`;
    };

    if (level > LOG.Warn)
    {
        // Don't worry about the result, just try to log the error
        freeze = true;
        let http = new XMLHttpRequest();
        http.open("POST", "process_request.php", true);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        http.send(`&type=log_err&error=${encodeURIComponent(curState(obj))}&stack=${encodeURIComponent(Error().stack)}`);
    }
}
