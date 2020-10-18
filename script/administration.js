window.addEventListener("load", function()
{
    $("#imdbUpdate").addEventListener("click", tryUpdateImdbRatings);
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
