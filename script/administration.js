window.addEventListener("load", function()
{
    $("#imdbUpdate").addEventListener("click", tryUpdateImdbRatings);
    $("#banClient").addEventListener("click", banOverlay);
});

let imdbUpdate = 0;
function tryUpdateImdbRatings()
{
    Overlay.show(
        "This operation takes about two minutes to complete. Are you sure you want to continue?" +
        "<br /><br />" +
        "(Click outside this message to cancel)",
        "Yes",
        updateImdbRatings);
}

/// <summary>
/// Force an update of the IMDb ratings database
/// </summary>
function updateImdbRatings()
{
    Overlay.dismiss();
    imdbUpdate = 0;
    let interval = setInterval(function() { imdbUpdate += 5; Log.verbose(`Updating IMDb ratings... ${imdbUpdate} seconds`); }, 5000);
    Log.verbose("Starting IMDb rating update...");
    $("#imdbUpdateImg").src = Icons.get("loading");

    let successFunc = function(response)
    {
        clearInterval(interval);
        $("#imdbUpdateImg").src = Icons.get("up");
        Log.verbose(`IMDb rating update took ${response.update_time} seconds`);
    };

    let failureFunc = function()
    {
        clearInterval(interval);
        $("#imdbUpdateImg").src = Icons.get("up");
        Log.verbose(`Failed to update IMDb ratings :(`);
    };

    sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.UpdateImdbRatings }, successFunc, failureFunc);
}

/// <summary>
/// Display an overlay form to ban a specific IP from plexweb
/// </summary>
function banOverlay()
{
    Overlay.build(
        { dismissible : true },
        buildNode("div", { style : "width: 30vw; min-width: 300px; max-width: 400px" }).appendChildren(
            buildNode("span", {}, "Select the client to ban"),
            buildNode("div").appendChildren(
                buildNode("div", { class : "formInput" }).appendChildren(
                    buildNode("label", { for : "banIp" }, "IP Address:"),
                    buildNode("input", { type : "text", name : "banIp", id : "banIp", style : "float: right" })
                ),
                buildNode("div", { class : "formInput" }).appendChildren(
                    buildNode("label", { for : "banReason" }, "Reason"),
                    buildNode("input", { type : "text", name : "banReason", id : "banReason", style : "float: right" })
                )
            ),
            buildNode("div", { style : "width: 30vw; min-width: 300px; max-width: 400px; overflow: auto" }).appendChildren(
                buildNode("input", { type : "button", value : "Ban", style : "float: left; width: 100px" }, 0, { click : banClient }),
                buildNode("input", { type : "button", value : "Cancel", style : "float: right; width: 100px" }, 0, { click : Overlay.dismiss })
            )
        )
    );
}

/// <summary>
/// Actually ban the given client. No real validation is done,
/// so it's on the admin to ensure the IP is correct.
/// </summary>
function banClient()
{
    let successFunc = () => flashOverlay(true);
    let failureFunc = () => flashOverlay(false);

    sendHtmlJsonRequest(
        "administration.php",
        { type : "ban", ip : $("#banIp").value, reason : $("#banReason").value },
        successFunc,
        failureFunc);
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
