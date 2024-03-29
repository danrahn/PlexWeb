/// <summary>
/// Contains routines for creating new media requests
/// </summary>

// Timer that will send out external search requests on expiration
let searchTimer;

// Timer that will send out internal (plex) search requests on expiration
let internalSearchTimer;

// Global keeping track of the currently selected request suggestion
let selectedSuggestion;

window.addEventListener("load", function()
{
    selectChanged();
    $("#typeContainer").addEventListener("click", selectChanged);
    $("#name").addEventListener("input", suggestionChanged);
    $("#external_id").addEventListener("input", searchSpecificExternal);
});

/// <summary>
/// Helper to return the name of the suggestion type
/// </summary>
function getType()
{
    let ele = getTypeElement();
    if (!ele)
    {
        return "none";
    }

    return ele.id;
}

/// <summary>
/// Return the currently selected element
/// </summary>
function getTypeElement()
{
    return $$(".typeSelected");
}

/// <summary>
/// Shows or hides the element with the given id
/// </summary>
function setInputVisibility(id, vis)
{
    let ele = $(`#${id}`);
    ele.style.display = null;
    ele.classList.remove("hiddenInputStart");
    ele.classList.add(vis ? "visibleInput" : "hiddenInput");
    ele.classList.remove(vis ? "hiddenInput" : "visibleInput");
}

/// <summary>
/// Update UI when request options change
/// </summary>
function selectChanged(e)
{
    $(".typeOption").forEach((ele) => { ele.classList.remove("typeSelected"); });
    if (!e || !e.target.classList.contains("typeOption"))
    {
        setInputVisibility("nameHolder", false);
        $("#matchHolder").style.display = "none";
        $("#existingMatchHolder").style.display = "none";
        setVisibility("suggestions", false);
        return;
    }

    e.target.classList.add("typeSelected");
    setInputVisibility("nameHolder", true);
    suggestionChanged();
}

/// <summary>
/// Set/reset timers when the user updates the suggestion
/// </summary>
function suggestionChanged()
{
    let suggestion = $("#name").value;
    clearTimeout(searchTimer);
    clearTimeout(internalSearchTimer);
    if (suggestion.length === 0)
    {
        setVisibility("suggestions", false);
        $("#matchHolder").style.display = "none";
        $("#existingMatchHolder").style.display = "none";
        return;
    }

    $("#matchHolder").style.display = "block";
    searchTimer = setTimeout(searchItem, 250);

    internalSearchTimer = setTimeout(searchInternal, 250);
}

/// <summary>
/// Sets the label for the external id input
/// </summary>
function setExternalType(type)
{
    if (type == "audiobook")
    {
        $("#externallabel").innerHTML = "--OR-- Audible ID:";
        $("#external_id").placeholder = "B017V4IM1G";
    }
    else
    {
        $("#externallabel").innerHTML = "--OR-- IMDb ID:";
        $("#external_id").placeholder = "tt1234567";
    }
}

/// <summary>
/// Search for the user's current request
/// </summary>
function searchItem()
{
    let value = getType();
    if (value != "movie" && value != "tv" && value != "audiobook")
    {
        // Only movies and tv shows supported for now
        setVisibility("externalContainer", false);
        $("#matchContainer").innerHTML = "Sorry, music requests are currently unavailable";
        return;
    }

    let type = value == "movie" ? 1 : (value == "tv" ? 2 : 3);

    setExternalType(value);

    let params = { type : type, query : $("#name").value };
    let successFunc = function(response)
    {
        Log.info(response, "Search Results");
        setVisibility("externalContainer", true);
        if (response.results.length === 0)
        {
            $("#matchContainer").innerHTML = `No matches found. Please enter the ${value == "audiobook" ? "Audible" : "IMDb"} ID below`;
            return;
        }

        buildItems(response.results, "matchContainer");
    };

    let failureFunc = function(/*response*/)
    {
        $("#matchContainer").innerHTML = "Error searching for matches";
    };

    sendHtmlJsonRequest("media_search.php", params, successFunc, failureFunc);
}

/// <summary>
/// Search the plex server for the given query so users may know if the item already exists
/// </summary>
function searchInternal()
{
    // For now only search for movies, since TV shows can have requests for different seasons
    let type = getType();

    let name = $("#name").value;
    let parameters =
    {
        type : ProcessRequest.SearchPlex,
        kind : type,
        query : name
    };

    clearElement("existingMatchContainer");

    let successFunc = function(response)
    {
        Log.info(response, "Internal Search");
        clearElement("existingMatchContainer");
        if (response.length > 0)
        {
            $("#existingMatchHolder").style.display = "block";
            buildItems(response.top, "existingMatchContainer");
        }
        else
        {
            $("#existingMatchHolder").style.display = "none";
        }
    };

    let failureFunc = function(response)
    {
        Log.error(response, "Failed to parse internal search");
    };

    Log.tmi(`Initiating internal search for ${name}`);
    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Returns whether the given id is a valid external id
/// </summary>
function validateId(id, isAudiobook)
{
    if (isAudiobook)
    {
        if (id.length != 10)
        {
            $("#externalResult").innerHTML = id.length == 0 ? "" : "Incomplete Audible Id";
            return false;
        }

        return true;
    }

    if (id.length != 9 ||
        id.substring(0, 2) != "tt" ||
        isNaN(parseInt(id.substring(2))))
    {
        $("#externalResult").innerHTML = id.length == 0 ? "" : "Incomplete IMDb Id";
        return false;
    }

    return true;
}

/// <summary>
/// Build the list of external suggestions after a successful query
/// </summary>
function externalSearchSuccess(response)
{
    Log.info(response);
    let type = getType();
    switch (type)
    {
        case "movie":
            if (response.movie_results.length === 0)
            {
                $("#externalResult").innerHTML = "Movie not found";
                return;
            }

            buildItems(response.movie_results, "externalResult");
            break;
        case "tv":
            if (response.tv_results.length === 0)
            {
                $("#externalResult").innerHTML = "TV Show not found";
                return;
            }

            buildItems(response.tv_results, "externalResult");
            break;
        case "audiobook":
            if (!response.valid)
            {
                $("#externalResult").innerHTML = "Audiobook not found";
                return;
            }

            buildItems([response], "externalResult");
            break;
        default:
            $("#externalResult").innerHTML = "Sorry, something went wrong";
            break;
    }
}

/// <summary>
/// Search for an item based on a specific IMDb/Audible id
/// </summary>
function searchSpecificExternal()
{
    let id = $("#external_id").value;
    const isAudiobook = getType() == "audiobook";
    if (!validateId(id, isAudiobook))
    {
        return;
    }

    $("#externalResult").innerHTML = "Searching...";

    let value = getType();
    let type = value == "movie" ? 1 : (value == "tv" ? 2 : 3);
    let parameters = { type : type, query : id, imdb : type != 3, audible : type == 3 };

    let failureFunc = function()
    {
        $("#externalResult").innerHTML = "Failed to retrieve media";
    };

    sendHtmlJsonRequest("media_search.php", parameters, externalSearchSuccess, failureFunc);
}

/// <summary>
/// Build the season details link that kicks off the process of determining
/// what seasons of a show are available on Plex
/// </summary>
function buildSeasonDetailsHandler(match)
{
    let seasonHolder = buildNode("div", { class : "seasonDetailsHolder" });
    seasonHolder.appendChild(buildNode("a",
        { seasonpath : match.tvChildPath },
        "Click to load season details",
        {
            click : function()
            {
                this.innerHTML = "Loading...";
                let parameters =
                {
                    type : ProcessRequest.GetSeasonDetails,
                    path : this.getAttribute("seasonPath")
                };
                let successFunc = buildSeasonDetails;
                let failureFunc = function(response, request)
                {
                    let text = $(`a[seasonpath="${request.path}"]`)[0];
                    text.parentElement.appendChild(buildNode("span", {}, "Error getting season details"));
                    text.parentElement.removeChild(text);
                };

                sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc, parameters);
            }
        }
    ));

    return seasonHolder;
}

/// <summary>
/// Builds the request suggestion body, including the name
/// of the match, and an external link to the suggestion
function buildSuggestionBody(match)
{
    let div = buildNode("div", { class : "matchText" });
    let titleText = (match.title ? match.title : match.name) + " ";
    if (match.resolution)
    {
        titleText += `(${match.resolution}) - `;
    }

    div.appendChild(buildNode("span", {}, titleText));
    let release = match.release_date;
    if (!release)
    {
        release = match.year || match.first_air_date;
    }

    // match.ref is a hacky way to tell that we have an audiobook request
    const linkString = `(${match.ref ? "Audible" : (release ? release.substring(0, 4) : "IMDb")})`;

    div.appendChild(buildNode("a",
        { href : "#" },
        linkString,
        {
            click : goToExternal,
            auxclick : goToExternal
        }));

    // For TV shows, give the option to get information about what seasons are available
    if (match.tvChildPath)
    {
        div.appendChildren(buildNode("hr"), buildSeasonDetailsHandler(match));
    }

    return div;
}

/// <summary>
/// Builds a single item for the request suggestion list
/// </summary>
function buildItem(match, external)
{
    let item = buildNode("div",
        {
            class : "searchResult",
            title : match.title ? match.title : match.name,
            poster : match.poster_path ? match.poster_path : match.thumb ? match.thumb : `/${getType()}default.png`
        },
        0,
        external ? {} : {
            click : clickSuggestion
        });

    if (match.ref)
    {
        item.setAttribute("ref", match.ref);
        item.setAttribute("aid", match.id);
    }
    else
    {
        item.setAttribute(match.id ? "tmdbid" : "imdbid", match.id ? match.id : match.imdbid);
    }

    let img = buildNode("img", {
        style : "height : 70px",
        src : (match.poster_path ?
            `https://image.tmdb.org/t/p/w92${match.poster_path}` :
            (match.thumb ?
                match.thumb :
                `poster/${getType()}default.png`
            )
        )
    });

    return item.appendChildren(img, buildSuggestionBody(match));
}

/// <summary>
/// Build the list of search results
/// </summary>
function buildItems(matches, holder)
{
    const external = holder == "existingMatchContainer";
    Log.tmi(matches, `${holder} matches`);
    let container = $("#" + holder);
    container.innerHTML = "";
    container.appendChild(buildNode("hr"));

    container.appendChild(buildNode("p", { style : "margin-bottom: 5px" }, external ? "Existing Items:" : "Results:"));

    let max = Math.min(matches.length, 10);
    for (let i = 0; i < max; ++i)
    {
        container.appendChild(buildItem(matches[i], external));
    }

    let button = buildNode("input",
        {
            type : "button",
            id : `matchContinue_${holder}`,
            class : "matchContinue hidden",
            value : "Submit Request"
        },
        0,
        {
            click : submitSelected
        });

    container.appendChild(button);
}

/// <summary>
/// Return the 'complete, incomplete, missing' seasons string
/// </summary>
function buildSeasons(seasons)
{
    if (seasons.length == 0)
    {
        return "";
    }

    const getSequence = (start, end) => start + (start == end ? "" : "-" + end) + ", ";
    let seasonStr = "";
    let first = parseInt(seasons[0]);
    let prev = first;
    for (let iSeason = 1; iSeason < seasons.length; ++iSeason)
    {
        const season = seasons[iSeason];
        if (season != prev + 1)
        {
            seasonStr += getSequence(first, prev);
            first = season;
            prev = first;
            continue;
        }

        prev = season;
    }

    seasonStr += getSequence(first, prev);
    return seasonStr.substring(0, seasonStr.length - 2);
}

/// <summary>
/// Buckets the given seasons into complete, incomplete, and missing categories
/// </summary>
function populateSeasonSections(data, missing, complete, incomplete)
{
    let totalSeasons = data.totalSeasons;
    let seasons = data.seasons;
    let seasonIndex = 0;
    let currentSeason = 1;
    while (currentSeason <= totalSeasons)
    {
        if (currentSeason > seasons[seasons.length - 1].season)
        {
            Log.tmi(`Adding season(s) ${currentSeason}${currentSeason == totalSeasons ? "" : "-" + totalSeasons} to missing array`);

            /* eslint-disable-next-line no-loop-func, id-length */ // This particular usage is okay
            missing.push(...Array.from(Array(totalSeasons - currentSeason + 1), (_, index) => index + currentSeason));
            return;
        }

        while (currentSeason < seasons[seasonIndex].season)
        {
            Log.tmi(`Adding season ${currentSeason} to missing array`);
            missing.push(currentSeason);
            ++currentSeason;
        }

        if (seasons[seasonIndex].complete)
        {
            Log.tmi(`Adding season ${currentSeason} to complete array`);
            complete.push(currentSeason);
        }
        else
        {
            Log.tmi(`Adding season ${currentSeason} to incomplete array`);
            incomplete.push(currentSeason);
        }

        ++seasonIndex;
        ++currentSeason;
    }
}

/// <summary>
/// Shows what seasons for a given show are complete, incomplete, or missing on Plex
/// </summary>
function buildSeasonDetails(response, request)
{
    Log.tmi("Building season details");

    let complete = [];
    let incomplete = [];
    let missing = [];
    populateSeasonSections(response, missing, complete, incomplete);

    Log.tmi(complete, "Complete");
    Log.tmi(incomplete, "Incomplete");
    Log.tmi(missing, "Missing");

    let seasonString = "";
    if (complete.length != 0)
    {
        seasonString += "Complete: " + buildSeasons(complete) + " &mdash; ";
    }

    if (incomplete.length != 0)
    {
        seasonString += "Incomplete: " + buildSeasons(incomplete) + " &mdash; ";
    }

    if (missing.length != 0)
    {
        seasonString += "Missing: " + buildSeasons(missing) + " &mdash; ";
    }

    seasonString = seasonString.substring(0, seasonString.length - 9);
    let oldText = $(`a[seasonpath="${request.path}"]`)[0];
    let attachTo = oldText.parentNode;
    attachTo.removeChild(oldText);
    attachTo.appendChild(buildNode("span", {}, seasonString));
}

/// <summary>
/// Go to IMDb (or TMDb) when the user clicks on a suggestion
/// </summary>
function goToExternal(e)
{
    // Prevent middle mouse button click default behavior
    if (e.which == 2 || e.button == 4)
    {
        e.preventDefault();
    }

    let value = getType();
    let grandparent = this.parentNode.parentNode;
    const imdbid = grandparent.getAttribute("imdbid");
    const tmdbid = grandparent.getAttribute("tmdbid");
    if (imdbid)
    {
        if (parseInt(imdbid) == -1)
        {
            // We previously tried to find an imdbid, but came up empty. Use the tmdbid
            window.open("https://www.themoviedb.org/" + (getType() == "movie" ? "movie" : "tv") + "/" + tmdbid, "_blank", "noreferrer");
        }

        Log.tmi("Clicked on an existing item");
        window.open(`https://www.imdb.com/title/${imdbid}`, "_blank", "noreferrer");
        return;
    }

    // Audiobooks use a different schema, setting 'ref' opposed to tmdbid/imdbid
    const ref = grandparent.getAttribute("ref");
    if (ref)
    {
        window.open(ref, "_blank", "noreferrer");
        return;
    }

    let parameters = { type : value == "movie" ? 1 : 2, query : tmdbid, by_id : "true" };
    let successFunc = function(response, request)
    {
        Log.info(response);
        let match = request.linkElement.parentNode.parentNode;
        if (response.imdb_id)
        {
            match.setAttribute("imdbid", response.imdb_id);
            window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank", "noreferrer");
        }
        else
        {
            // Tell future requests that we didn't find anything
            match.setAttribute("imdbid", "-1");
            let extId = match.getAttribute("tmdbid");
            window.open("https://www.themoviedb.org/" + (getType() == "movie" ? "movie" : "tv") + "/" + extId, "_blank", "noreferrer");
        }
    };
    sendHtmlJsonRequest("media_search.php", parameters, successFunc, null, { linkElement : this });
}

/// <summary>
/// Handler for clicking on a specific search result
/// </summary>
function clickSuggestion(e)
{
    if (e.target.tagName.toLowerCase() == "a")
    {
        return;
    }

    let enableButton = "matchContinue_" + this.parentNode.id;
    let disableButton = "matchContinue_" + (enableButton.charAt(14) == "m" ? "externalResult" : "matchContainer");
    Log.tmi("EnableButton: " + enableButton);
    Log.tmi("DisableButton: " + disableButton);
    if (selectedSuggestion && selectedSuggestion != this)
    {
        selectedSuggestion.className = "searchResult";
    }
    else if (selectedSuggestion == this)
    {
        this.className = "searchResult";
        setVisibility(enableButton, false);
        setVisibility(disableButton, false);
        selectedSuggestion = undefined;
        return;
    }

    selectedSuggestion = this;
    this.className += " selectedSuggestion";
    setVisibility(enableButton, true);
    setVisibility(disableButton, false);
    Animation.fireNow({ backgroundColor : new Color(63, 80, 69) }, $("#" + enableButton), 500);
    Animation.queue({ backgroundColor : new Color(63, 66, 69) }, $("#" + enableButton), 500, 500, true);
}

/// <summary>
/// Displays an overlay telling the user that they already created a request
/// for the given item, asking them if they would like to add a comment to
/// their existing request.
/// </summary>
function showAlreadyExistsAlert(response)
{
    let status = ["Pending", "Complete", "Denied", "In Progress", "Waiting"][response.status];
    let secondaryText = "Would you like to add a comment to the existing request?";
    let message = buildNode(
        "div",
        { class : "overlayDiv" },
        `You have already made a request for '${response.name}', and its status is '${status}'.<br><br>${secondaryText}`);
    let button1 = buildNode(
        "input",
        {
            type : "button",
            value : "Go to Request",
            class : "existingRequestButton rightButton",
            rid : response.rid
        },
        0,
        {
            click : goToRequest
        });

    let button2 = buildNode(
        "input",
        {
            type : "button",
            id : "overlayCancel",
            value : "Cancel",
            class : "existingRequestButton",
        },
        0,
        {
            click : Overlay.dismiss
        });

    let outerButtonContainer = buildNode("div", { class : "formInput", style : "text-align: center" }).appendChildren(
        buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" }).appendChildren(
            button1,
            button2
        )
    );

    Overlay.build({ dismissible : true, centered : false }, message, outerButtonContainer);
}

/// <summary>
/// Callback when we successfully submit a new request. Either the new request was created,
/// or it already exists and we show the user an alert telling them they can't submit multiple
/// requests for the same item.
/// </summary>
function onSubmitRequestSucceeded(response)
{
    if (!response.exists)
    {
        window.location.href = `request.php?id=${response.req_id}&new=1`;
        return;
    }

    showAlreadyExistsAlert(response);
}

/// <summary>
/// Submit the selected suggestion
/// </summary>
function submitSelected()
{
    const reqType = getType();
    if (!selectedSuggestion)
    {
        let button = $("#matchContinue");
        let color = new Color(button.getComputedStyle.backgroundColor, 500);
        Animation.fireNow({ backgroundColor : new Color(100, 66, 69) }, button);
        Animation.queue({ backgroundColor : color }, button, 500, 500, true);
        return;
    }

    let externalId = selectedSuggestion.getAttribute("tmdbid");
    const title = selectedSuggestion.getAttribute("title");
    let poster = selectedSuggestion.getAttribute("poster");
    if (!externalId && reqType == "audiobook")
    {
        externalId = selectedSuggestion.getAttribute("aid");
    }

    if (!externalId || !title)
    {
        Log.error("Required fields not set");
        return;
    }

    let parameters =
    {
        type : ProcessRequest.NewRequest,
        name : title,
        mediatype : reqType,
        external_id : externalId,
        poster : poster
    };

    let failureFunc = function()
    {
        let buttons = $(".matchContinue");
        for (let i = 0; i < buttons.length; ++i)
        {
            buttons[i].value = "Something went wrong, please try again later";
            Animation.fireNow({ backgroundColor : new Color(100, 66, 69) }, buttons[i], 500);
            Animation.queueDelayed({ backgroundColor : new Color(63, 66, 69) }, buttons[i], 1000, 500, true);
            setTimeout(function(btn) { btn.value = "Submit Request"; }, 2500, buttons[i]);
        }
    };

    sendHtmlJsonRequest("process_request.php", parameters, onSubmitRequestSucceeded, failureFunc);
}

/// <summary>
/// Callback for if the request already exists and
/// the user chooses to navigate to it.
/// </summary>
function goToRequest()
{
    let rid = this.getAttribute("rid");
    window.location = "request.php?id=" + rid;
}

/// <summary>
/// Shows or hides the element with the given id
/// </summary>
function setVisibility(id, visible)
{
    let element = $("#" + id);
    if (!element)
    {
        return;
    }

    element.classList.remove(visible ? "hidden" : "visible");
    element.classList.add(visible ? "visible" : "hidden");
}

/// <summary>
/// Removes all child elements of the element with the given id
/// </summary>
function clearElement(id)
{
    let element = $(`#${id}`);
    while (element.firstChild)
    {
        element.removeChild(element.firstChild);
    }
}
