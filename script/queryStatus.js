let baseTitle = "";
let hasChanged = false;
let previous = { 'p' : 0, 's' : 0 };
function queryStatus()
{
    let http = new XMLHttpRequest();
    http.open("POST", "get_status.php", true /*async*/);
    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    http.onreadystatechange = function()
    {
        if (this.readyState != 4 || this.status != 200)
        {
            return;
        }

        try
        {
            let response = JSON.parse(this.responseText);
            logTmi(response);
            if (response.play == 0 && response.pause == 0)
            {
                // Only reset the title if we've previously changed it to avoid constant title updates
                if (hasChanged)
                {
                    logVerbose('No more active items, clearing status');
                    hasChanged = false;
                    $$('title').innerHTML = baseTitle;
                }
                return;
            }

            if (response.play == previous.p && response.pause == previous.s)
            {
                return;
            }

            logVerbose(response, 'Status changed');
            previous.p = response.play;
            previous.s = response.pause;

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

            $$('title').innerHTML = prepend + baseTitle;
        }
        catch (ex)
        {
            logError(ex);
            logError(this.responseText);
        }
    };

    http.send("&type=5");
}

function startQuery()
{
    baseTitle = window.document.title;

    queryStatus();
    setInterval(function() { queryStatus(); }, 20000);
}

window.addEventListener("load", startQuery);
