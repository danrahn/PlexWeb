window.addEventListener("load", function()
{
    $("#imdbUpdate").addEventListener("click", tryUpdateImdbRatings);
    $("#banClient").addEventListener("click", banOverlay);
    $("#updateStatus").addEventListener("click", updatePlexStatus);
});

let updateInterval = null;
function tryUpdateImdbRatings()
{
    if (updateInterval)
    {
        Overlay.show("An update is already in progress...", "OK", Overlay.dismiss);
        return;
    }

    Overlay.show(
        "This operation will trigger a download of over 1 million IMDb ratings. Are you sure you want to continue?" +
        "<br /><br />" +
        `<span id="imdbUpdateDate">Database was last updated: <img src=${Icons.get("loading")} height=12pt></span>` +
        "<br /><br />" +
        "(Click outside this message to cancel)",
        "Yes",
        updateImdbRatings);

    getLastUpdateDate();
}

/// <summary>
/// Force an update of the IMDb ratings database
/// </summary>
function updateImdbRatings()
{
    Log.verbose("Starting IMDb rating update...");

    let successFunc = function()
    {
        Log.verbose("Started IMDb update process");
        startImdbUpdateStatusQuery();
    };

    let failureFunc = function(response)
    {
        Log.verbose(`Failed to update IMDb ratings :(`);
        if (response.Error == "Refresh already in progress!" && !updateInterval)
        {
            startImdbUpdateStatusQuery();
        }
    };

    sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.UpdateImdbRatings }, successFunc, failureFunc);
}

function startImdbUpdateStatusQuery()
{
    let container = $("#overlayContainer");
    if (!container)
    {
        return;
    }

    container.removeChild($("#overlayMessage"));
    container.removeChild($("#overlayBtn"));

    imdbStatus();
    updateInterval = setInterval(imdbStatus, 1000);
}

/// <summary>
/// Retrieve the last known update date for the IMDb ratings database
/// </summary>
function getLastUpdateDate()
{
    let successFunc = function(response)
    {
        let span = $("#imdbUpdateDate");
        if (!span)
        {
            return;
        }

        switch (response.status)
        {
            case "Success":
                {
                    let updateDate = new Date(response.message.substring(0, response.message.indexOf(" - ")));
                    span.innerHTML = "Database was last updated: " +
                        DateUtil.getDisplayDate(updateDate);
                    Tooltip.setTooltip(span, DateUtil.getFullDate(updateDate));
                }
                break;
            case "Failure":
                span.innerHTML = "Database was last updated: Last update failed!";
                break;
            case "In Progress":
                span.innerHTML = "Database was last updated: We're updating now!";
                break;
            default:
                span.innerHTML = "Database was last updated: Unknown";
                break;
        }

    };

    let failureFunc = function()
    {
        let span = $("#imdbUpdateDate");
        if (span)
        {
            span.innerHTML = "Database was last updated: Unknown";
        }
    };

    sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.GetImdbUpdateStatus }, successFunc, failureFunc);
}

/// <summary>
/// Queries for the status of the IMDb ratings database update
/// </summary>
function imdbStatus()
{
    let successFunc = function(response)
    {
        if (!ensureImdbUpdateSpan())
        {
            return;
        }

        $("#imdbStatus").innerHTML = `Status: ${response.status}<br>Message: ${response.message}`;
        if (response.status == "Failed" || response.status == "Success")
        {
            $("#imdbUpdateTitle").style.display = "none";
            clearInterval(updateInterval);
            updateInterval = null;
        }
    };

    let failureFunc = function()
    {
        if (!ensureImdbUpdateSpan())
        {
            return;
        }

        $("#imdbStatus").innerHTML = `Failed to get updated status :(`;
        clearInterval(updateInterval);
        updateInterval = null;
    };

    sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.GetImdbUpdateStatus }, successFunc, failureFunc);
}

/// <summary>
/// If an overlay is showing, ensure that we have the correct IMDb update content
/// </summary>
function ensureImdbUpdateSpan()
{
    if (!$("#overlayContainer"))
    {
        clearInterval(updateInterval);
        updateInterval = null;
        return false;
    }

    if (!$("#imdbStatus"))
    {
        appendImdbUpdateSpan();
    }

    return true;
}

/// <summary>
/// Appends the IMDb update content to the current overlay
/// </summary>
function appendImdbUpdateSpan()
{
    $("#overlayContainer").appendChildren(
        buildNode("div", { id : "imdbUpdateTitle", class : "overlayDiv" }).appendChildren(
            buildNode("span", {}, "Updating IMDb ratings"),
            buildNode("img", { src : Icons.get("loading"), alt : "loading", height : "12pt" })
        ),
        buildNode("div", { id : "imdbStatus", class : "overlayDiv" }, "Status: Unknown"));
}

/// <summary>
/// Display an overlay form to ban a specific IP from plexweb
/// </summary>
function banOverlay()
{
    Overlay.build(
        { dismissible : true },
        buildNode("div", { class : "overlayDiv adminOverlayHolder" }).appendChildren(
            buildNode("span", {}, "Select the client to ban"),
            buildNode("div").appendChildren(
                buildNode("div", { class : "formInput" }).appendChildren(
                    buildNode("label", { for : "banIp" }, "IP Address:"),
                    buildNode("input", { type : "text", name : "banIp", id : "banIp" })
                ),
                buildNode("div", { class : "formInput" }).appendChildren(
                    buildNode("label", { for : "banReason" }, "Reason"),
                    buildNode("input", { type : "text", name : "banReason", id : "banReason" })
                )
            ),
            buildNode("div").appendChildren(
                getOverlayButton("Cancel", Overlay.dismiss, "", "float: left;"),
                getOverlayButton("Ban", banClient, "", "float: right;")
            )
        )
    );
}

function flashSuccess() { flashOverlay(true); }
function flashFailure() { flashOverlay(false); }

/// <summary>
/// Actually ban the given client. No real validation is done,
/// so it's on the admin to ensure the IP is correct.
/// </summary>
function banClient()
{
    sendHtmlJsonRequest(
        "administration.php",
        { type : "ban", ip : $("#banIp").value, reason : $("#banReason").value },
        flashSuccess,
        flashFailure);
}

function flashOverlay(success)
{
    let overlay = $("#mainOverlay");
    if (overlay)
    {
        const overlayColor = success ? "rgba(0,25,0,0.5)" : "rgba(25,0,0,0.5)";
        Animation.queue({ backgroundColor : overlayColor }, overlay, 500);
        Animation.queueDelayed({ backgroundColor : "rgba(0,0,0,0.5)", opacity : "0" }, overlay, 500, 500, true);
    }
}

/// <summary>
/// Get the current custom status, if any, and pass it into the overlay launcher
/// </summary>
function updatePlexStatus()
{
    sendHtmlJsonRequest(
        "administration.php",
        {
            type : "status",
            action : "get"
        },
        launchStatusOverlay);
}

/// <summary>
/// Show the Plex status overlay pre-filled with the current custom status, if any.
/// </summary>
function launchStatusOverlay(response)
{
    if (response.severity == -1)
    {
        response.severity = 0;
    }

    const severities = ["Normal", "Warning", "Error"];
    let select = buildNode("select", { id : "statusSeverity" });
    for (let i = 0; i < severities.length; ++i)
    {
        let option = buildNode("option", { value : i }, severities[i]);
        if (i == response.severity)
        {
            option.selected = "selected";
        }

        select.appendChild(option);
    }

    Overlay.build(
        { dismissible : true },
        buildNode("div", { class : "overlayDiv adminOverlayHolder" }).appendChildren(
            buildNode("span", {}, "Update Plex Server Status"),
            buildNode("div").appendChildren(
                buildNode("div", { class : "formInput" }).appendChildren(
                    buildNode("label", { for : "statusMessage" }, "Status:"),
                    buildNode("input",
                        {
                            type : "text",
                            name : "statusMessage",
                            id : "statusMessage",
                            value : response.status,
                            maxlength : 512
                        })
                ),
                buildNode("div", { class : "formInput" }).appendChildren(
                    buildNode("label", { for : "statusSeverity" }, "Severity:"),
                    select
                ),
            ),
            buildNode("div").appendChildren(
                getOverlayButton("Cancel", Overlay.dismiss),
                getOverlayButton("Clear Status", clearStatus, "middleAdminButton"),
                getOverlayButton("Set", setStatus)
            )
        )
    );
}

/// <summary>
/// Return a button to be used in an overlay with the given text value, callback function,
/// and optional additional classes/style.
/// </summary>
function getOverlayButton(value, callback, buttonClass="", style="")
{
    return buildNode(
        "input",
        { type : "button", value : value, class : "overlayInlineButton smallAdminButton " + buttonClass, style : style },
        0,
        { click : callback }
    );
}

/// <summary>
/// Clear any currently set custom status.
/// </summary>
function clearStatus()
{
    sendHtmlJsonRequest(
        "administration.php",
        {
            type : "status",
            action : "clear",
        },
        flashSuccess,
        flashFailure
    );
}

/// <summary>
/// Set the custom status text based on the current overlay values.
/// </summary>
function setStatus()
{
    sendHtmlJsonRequest(
        "administration.php",
        {
            type : "status",
            action : "set",
            status : $("#statusMessage").value,
            severity : $("#statusSeverity").value
        },
        flashSuccess,
        flashFailure
    );
}
