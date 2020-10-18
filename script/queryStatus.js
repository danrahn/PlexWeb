/// <summary>
/// Queries for active and paused streams, updating the title accordingly
/// NOTE: Relies on common.js
/// </summary>

let baseTitle = "";
let hasChanged = false;
let previous = { pl : 0, pa : 0 };

/// <summary>
/// Update the page title based on the stream activity
/// </summary>
function processQueryStatus(response)
{
    if (response.play == 0 && response.pause == 0)
    {
        // Only reset the title if we've previously changed it to avoid constant title updates
        if (hasChanged)
        {
            Log.verbose("No more active items, clearing status");
            hasChanged = false;
            $$("title").innerHTML = baseTitle;
        }

        previous.pl = previous.pa = 0;
        return;
    }

    if (response.play == previous.pl && response.pause == previous.pa)
    {
        return;
    }

    Log.verbose(response, "Status changed");
    previous.pl = response.play;
    previous.pa = response.pause;

    hasChanged = true;
    let prepend = "";

    if (response.play > 0)
    {
        prepend = `${response.play}&#9205; - `;
    }

    if (response.pause > 0)
    {
        prepend += `${response.pause}  &#10073;&#10073; - `;
    }

    $$("title").innerHTML = prepend + baseTitle;
}

/// <summary>
/// Query error handler. If we've detected that the user has
/// been logged out, cancel the timer
/// </summary>
function queryStatusError(response)
{
    if (response.Error && response.Error == "Not Authorized")
    {
        Log.verbose("Stopping queryStatus, user is not authorized");
        clearInterval(queryStatusTimer);
    }
}

/// <summary>
/// Request plex status from the server
/// </summary>
function queryStatus()
{
    sendHtmlJsonRequest("get_status.php", { type : 5 }, processQueryStatus, queryStatusError);
}

let queryStatusTimer;

/// <summary>
/// Initiates a 20 second interval to grab the current plex activity
/// </summary>
function startQuery()
{
    baseTitle = window.document.title;

    queryStatus();
    queryStatusTimer = setInterval(queryStatus, 20000);
}

window.addEventListener("load", startQuery);
