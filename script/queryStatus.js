/// <summary>
/// Queries for active and paused streams, updating the title accordingly
/// NOTE: Relies on common.js
/// </summary>

let baseTitle = "";
let hasChanged = false;
let previous = { pl : 0, pa : 0 };

function processQueryStatus(response)
{
    if (response.play == 0 && response.pause == 0)
    {
        // Only reset the title if we've previously changed it to avoid constant title updates
        if (hasChanged)
        {
            logVerbose("No more active items, clearing status");
            hasChanged = false;
            $$("title").innerHTML = baseTitle;
        }

        return;
    }

    if (response.play == previous.pl && response.pause == previous.pa)
    {
        return;
    }

    logVerbose(response, "Status changed");
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

function queryStatusError(response)
{
    if (response.Error && response.Error == "Not Authorized")
    {
        logVerbose("Stopping queryStatus, user is not authorized");
        clearInterval(queryStatusTimer);
    }
}

function queryStatus()
{
    sendHtmlJsonRequest("get_status.php", { type : 5 }, processQueryStatus, queryStatusError);
}

let queryStatusTimer;
function startQuery()
{
    baseTitle = window.document.title;

    queryStatus();
    queryStatusTimer = setInterval(queryStatus, 20000);
}

window.addEventListener("load", startQuery);
