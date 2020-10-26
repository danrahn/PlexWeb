window.addEventListener("load", setupRemote);

let clientId = Date.now().toString(16);
function setupRemote()
{
    setupButton("seekBack", back);
    setupButton("play", play);
    setupButton("pause", pause);
    setupButton("seekForward", forward);
    setupButton("navBack", navBack);
    setupButton("navUp", up);
    setupButton("plexNavHome", goHome);
    setupButton("navLeft", left);
    setupButton("navSelect", go);
    setupButton("navRight", right);
    setupButton("navDown", down);

    setupPlayerList();
    setupShortcuts();
}

let setupButton = (id, func) => $(`#${id}`).addEventListener("click", func);

let play = function() { playback(this, "play"); };
let pause = function() { playback(this, "pause"); };
let forward = function() { playback(this, "stepForward"); };
let back = function() { playback(this, "stepBack"); };
let up = function() { nav(this, "moveUp"); };
let down = function() { nav(this, "moveDown"); };
let left = function() { nav(this, "moveLeft"); };
let right = function() { nav(this, "moveRight"); };
let navBack = function() { nav(this, "back"); };
let goHome = function() { nav(this, "home"); };
let go = function() { nav(this, "select"); };

let playback = (element, command) => player(element, "playback", command);
let nav = (element, command) => player(element, "navigation", command);

let commandIds = {};
let globalPlayers = {};

/// <summary>
/// Sends the remote control request
/// </summary>
function player(element, endpoint, command)
{
    let device = $("#devices").value;
    if (device == 0 || !globalPlayers[device])
    {
        flash(element, "50,25,0");
        Log.warn(`Invalid device: ${device}`);
        return;
    }

    if (!(device in commandIds))
    {
        commandIds[device] = 1;
    }

    let successFunc = function(response, request)
    {
        if (response["Bad curl response"])
        {
            Log.warn(`Unable to run ${endpoint} command ${command}`);
        }

        if (response.needed_init)
        {
            flash($(`#${request.buttonClicked}`), "50,50,0");
            commandIds[device] = 3;
        }
        else
        {
            flash($(`#${request.buttonClicked}`), "0,50,0");
            ++commandIds[device];
        }
    };

    let failureFunc = function(_response, request)
    {
        flash($(`#${request.buttonClicked}`), "50,0,0");
        ++commandIds[device];
    };

    let params =
    {
        id : device,
        ip : globalPlayers[device].ip,
        endpoint : endpoint,
        command : command,
        command_id : commandIds[device],
        client_id : clientId
    };

    sendHtmlJsonRequest("remote.php", params, successFunc, failureFunc, { buttonClicked : element.id });
}

/// <summary>
/// Do initial setup for populating the players list
/// </summary>
function setupPlayerList()
{
    $("#type").addEventListener("change", retrievePlayers);
    $("#devices").addEventListener("change", changeDeviceTitle);
    retrievePlayers();
    changeDeviceTitle();
}

/// <summary>
/// When the selected device changes, set the tooltip to be the IP address of the given player
/// </summary>
function changeDeviceTitle()
{
    let devices = $("#devices");
    let device = devices.value;
    if (!globalPlayers[device])
    {
        devices.title = "No players found";
        return;
    }

    devices.title = globalPlayers[device].ip;
}

/// <summary>
/// Retrieve relevant players based on the player type selected
/// </summary>
function retrievePlayers()
{
    let successFunc = function(response)
    {
        globalPlayers = response;
        buildPlayerList();
    };

    let failureFunc = function()
    {
        globalPlayers = {};
        buildPlayerList();
    };

    sendHtmlJsonRequest("remote.php", { type : $("#type").value }, successFunc, failureFunc);
}

/// <summary>
/// Takes the list of available players and populates the dropdown
/// </summary>
function buildPlayerList()
{
    let devices = $("#devices");
    if (globalPlayers.length == 0)
    {
        devices.innerHTML = "";
        devices.appendChild(buildNode("option", { value : 0 }, "No players found"));
        return;
    }

    devices.innerHTML = "";
    let keys = Object.keys(globalPlayers);
    for (let i = 0; i < keys.length; ++i)
    {
        let device = globalPlayers[keys[i]];
        let name = device.device + (device.user ? (" - " + device.user) : "");
        devices.appendChild(buildNode("option", { value : keys[i] }, name));
    }

    changeDeviceTitle();
}

function setupShortcuts()
{
    window.addEventListener("keyup", parseShortcut);
}

/// <summary>
/// Basic keyboard shortcuts for the remote control
/// </summary>
function parseShortcut(e)
{
    if (document.activeElement.tagName.toLowerCase() == "select")
    {
        return;
    }

    let key = e.which || e.keyCode;
    switch (key)
    {
        case KEY.LEFT:
            $(e.ctrlKey ? "#seekBack" : "#navLeft").click();
            break;
        case KEY.RIGHT:
            $(e.ctrlKey ? "#seekForward" : "#navRight").click();
            break;
        case KEY.UP:
            $("#navUp").click();
            break;
        case KEY.DOWN:
            $("#navDown").click();
            break;
        case KEY.ENTER:
            $("#navSelect").click();
            break;
        case KEY.HOME:
            $("#navPlexHome").click();
            break;
        case KEY.PERIOD:
            if (key.shiftKey) // '>', which is kind of like a play button
            {
                $("#play").click();
            }
            break;
        case KEY.BACKSLASH:
            if (key.shiftKey) // '|', pipe, which is kind of like a pause button
            {
                $("#pause").click();
            }
            break;
        case KEY.BACKSPACE:
            if (key.shiftKey)
            {
                $("#navBack").click();
            }
            break;
        default:
            break;
    }
}

/// <summary>
/// Briefly flash the given element the given color, indicating the
/// success of the remote operation
/// </summary>
function flash(element, color)
{
    Animation.fireNow({ backgroundColor : `rgba(${color},0.5)` }, element, 200);
    Animation.queue({ backgroundColor : "rgba(0,0,0,0.5)" }, element, 200, true);
}
