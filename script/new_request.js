let searchTimer;
let internalSearchTimer;
let selectedSuggestion;
window.addEventListener("load", function()
{
    selectChanged();
    $("#type").addEventListener("change", selectChanged);
    $("#name").addEventListener("input", suggestionChanged);
    $("#external_id").addEventListener("input", searchSpecificExternal);
});

function setInputVisibility(id, vis)
{
    let ele = $(`#${id}`);
    ele.style.display = null;
    ele.classList.remove("hiddenInputStart");
    ele.classList.add(!vis ? "hiddenInput" : "visibleInput");
    ele.classList.remove(vis ? "hiddenInput" : "visibleInput");
}

/// <summary>
/// Update UI when request options change
/// </summar>
function selectChanged()
{
    let value = $("#type").value;
    if (value == "none")
    {
        setInputVisibility("nameHolder", false);
        $("#matchHolder").style.display = "none";
        $("#existingMatchHolder").style.display = "none";
        setVisibility("suggestions", false);
        setVisibility("submitHolder", false);
        return;
    }

    setInputVisibility("nameHolder", true);
    suggestionChanged();
}

/// <summary>
/// Set/reset timers when the user updates the suggestion
/// </summar>
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
/// </summar>
function searchItem()
{
    let value = $("#type").value;
    if (value != "movie" && value != "tv" && value != "audiobook")
    {
        // Only movies and tv shows supported for now
        setVisibility("externalContainer", false);
        $("#matchContainer").innerHTML = "Sorry, music requests are currently unavailable"
        return;
    }

    let type = value == "movie" ? 1 : (value == "tv" ? 2 : 3);

    setExternalType(value);

    let params = { "type" : type, "query" : $("#name").value };
    let successFunc = function(response)
    {
        logInfo(response, "Search Results");
        setVisibility("externalContainer", true);
        if (response.results.length === 0)
        {
            $("#matchContainer").innerHTML = `No matches found. Please enter the ${value == "audiobook" ? "Audible" : "IMDb"} ID below`;
            return;
        }

        buildItems(response.results, "matchContainer");
    }

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
    let type = $("#type").value;

    let name = $("#name").value;
    let parameters =
    {
        "type" : ProcessRequest.SearchPlex,
        "kind" : type,
        "query" : name
    };

    clearElement("existingMatchContainer");

    let successFunc = function(response)
    {
        logInfo(response, "Internal Search");
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
        logError(response, "Failed to parse internal search");
    };

    logTmi(`Initiating internal search for ${name}`);
    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

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
        parseInt(id.substring(2)) == NaN)
    {
        $("#externalResult").innerHTML = id.length == 0 ? "" : "Incomplete IMDb Id";
        return false;
    }

    return true;
}

/// <summary>
/// Search for an item based on a specific IMDb/Audible id
/// </summar>
function searchSpecificExternal()
{
    let id = $("#external_id").value;
    const isAudiobook = $("#type").value == "audiobook";
    if (!validateId(id, isAudiobook))
    {
        return;
    }

    $("#externalResult").innerHTML = "Searching...";

    let value = $("#type").value;
    let type = value == "movie" ? 1 : (value == "tv" ? 2 : 3);
    let parameters = { "type" : type, "query" : id, "imdb" : type != 3, "audible" : type == 3 };
    let successFunc = function(response)
    {
        logInfo(response);
        let type = $("#type").value;
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
    };

    let failureFunc = function()
    {
        $("#externalResult").innerHTML = "Failed to retrieve media";
    };

    sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Build the list of search results
/// </summar>
function buildItems(matches, holder)
{
    const external = holder == "existingMatchContainer";
    logTmi(matches, `${holder} matches`);
    let container = $("#" + holder);
    container.innerHTML = "";
    container.appendChild(buildNode("hr"));

    container.appendChild(buildNode("p", {"style" : "margin-bottom: 5px"}, external ? "Existing Items:" : "Results:"));

    let max = Math.min(matches.length, 10);
    for (let i = 0; i < max; ++i)
    {
        let match = matches[i];

        let item = buildNode("div", {
            "class" : "searchResult",
            "title" : match.title ? match.title : match.name,
            "poster" : match.poster_path ? match.poster_path : match.thumb ? match.thumb : `/${$("#type").value}default.png`
        },
        0,
        external ? {} : {
            "click" : clickSuggestion
        });

        if (match.ref)
        {
            item.setAttribute("ref", match.ref);
        }
        else
        {
            item.setAttribute(match.id ? "tmdbid" : "imdbid", match.id ? match.id : match.imdbid);
        }

        let img = buildNode("img", {
            "style" : "height : 70px",
            "src" : (match.poster_path ?
                `https://image.tmdb.org/t/p/w92${match.poster_path}` :
                (match.thumb ?
                    match.thumb :
                    `poster/${$("#type").value}default.png`
                )
            )
        });

        let div = buildNode("div", { "class" : "matchText" });
        let titleText = (match.title ? match.title : match.name) + ' ';
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
            {"href" : "#"},
            linkString,
            {
                "click" : goToExternal
            }));

        // For TV shows, give the option to get information about what seasons are available
        if (match.tvChildPath)
        {
            div.appendChild(buildNode('hr'));
            let seasonHolder = buildNode('div', { 'class' : "seasonDetailsHolder" });
            seasonHolder.appendChild(buildNode('a', { "seasonpath" : match.tvChildPath}, "Click to load season details",
                {
                    "click" : function()
                    {
                        this.innerHTML = 'Loading...';
                        let parameters =
                        {
                            "type" : ProcessRequest.GetSeasonDetails,
                            "path" : this.getAttribute("seasonPath")
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

            div.appendChild(seasonHolder);
        }

        item.appendChild(img);
        item.appendChild(div);

        container.appendChild(item);
    }

    let button = buildNode("input", {
        "type" : "button",
        "id" : `matchContinue_${holder}`,
        "class" : "matchContinue hidden",
        "value" : "Submit Request"
    },
    0,
    {
        "click" : submitSelected
    });

    container.appendChild(button);
}

function buildSeasonDetails(response, request)
{
    logTmi("Building season details");

    let complete = [];
    let incomplete = [];
    let missing = [];
    let totalSeasons = response.totalSeasons;
    let seasonIndex = 0;
    for (let i = 1; i <= totalSeasons; ++i)
    {
        if (i > response.seasons[response.seasons.length - 1].season)
        {
            logTmi(`Adding season ${i} to missing array`);
            missing.push(i);
            continue;
        }

        while (i < response.seasons[seasonIndex].season)
        {
            logTmi(`Adding season ${i} to missing array`);
            missing.push(i);
            ++i;
        }

        if (response.seasons[seasonIndex].complete)
        {
            logTmi(`Adding season ${i} to complete array`);
            complete.push(i);
            ++seasonIndex;
        }
        else
        {
            logTmi(`Adding season ${i} to incomplete array`);
            incomplete.push(i);
            ++seasonIndex;
        }
    }

    logTmi(complete, 'Complete');
    logTmi(incomplete, 'Incomplete');
    logTmi(missing, 'Missing');

    const buildSeasons = function(seasons)
    {
        if (seasons.length == 0)
        {
            return '';
        }

        const getSequence = (start, end) => start + (start == end ? '' : '-' + end) + ', ';
        let seasonStr = '';
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
    };

    let seasonString = '';
    if (complete.length != 0)
    {
        seasonString += 'Complete: ' + buildSeasons(complete) + ' &mdash; ';
    }
    if (incomplete.length != 0)
    {
        seasonString += 'Incomplete: ' + buildSeasons(incomplete) + ' &mdash; ';
    }
    if (missing.length != 0)
    {
        seasonString += 'Missing: ' + buildSeasons(missing) + ' &mdash; ';
    }

    seasonString = seasonString.substring(0, seasonString.length - 9);
    let oldText = $(`a[seasonpath="${request.path}"]`)[0];
    let attachTo = oldText.parentNode;
    attachTo.removeChild(oldText);
    attachTo.appendChild(buildNode('span', {}, seasonString));
}

/// <summary>
/// Go to IMDb (or TMDb) when the user clicks on a suggestion
/// </summar>
function goToExternal()
{
    let value = $("#type").value;
    let grandparent = this.parentNode.parentNode;
    const imdbid = grandparent.getAttribute("imdbid");
    if (imdbid)
    {
        logTmi("Clicked on an existing item");
        window.open(`https://www.imdb.com/title/${imdbid}`, "_blank");
        return;
    }

    const ref = grandparent.getAttribute("ref");
    if (ref)
    {
        window.open(ref, "_blank");
        return;
    }

    const tmdbid = grandparent.getAttribute("tmdbid");
    let parameters = { "type" : value == "movie" ? 1 : 2, "query" : tmdbid, "by_id" : "true" };
    let successFunc = function(response, request)
    {
        logInfo(response);
        if (response.imdb_id)
        {
            window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank");
        }
        else
        {
            window.open("https://www.themoviedb.org/" + ($("#type").value == "movie" ? "movie" : "tv") + "/" + request.linkElement.parentNode.parentNode.getAttribute("tmdbid"));
            // request.linkElement.classList.add("badLink");
            // request.linkElement.innerHTML += " (no IMDb link)";
        }
    };
    sendHtmlJsonRequest("media_search.php", parameters, successFunc, null, { "linkElement" : this });
}

/// <summary>
/// Handler for clicking on a specific search result
/// </summar>
function clickSuggestion(e)
{
    if (e.target.tagName.toLowerCase() == "a")
    {
        return;
    }

    let enableButton = "matchContinue_" + this.parentNode.id;
    let disableButton = "matchContinue_" + (enableButton.charAt(14) == 'm' ? "externalResult" : "matchContainer");
    logTmi("EnableButton: " + enableButton);
    logTmi("DisableButton: " + disableButton);
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
    Animation.fireNow({ "backgroundColor" : new Color(63, 80, 69) }, $("#" + enableButton), 500);
    Animation.queue({ "backgroundColor" : new Color(63, 66, 69) }, $("#" + enableButton), 500, 500, true);
}

/// <summary>
/// Submit the selected suggestion
/// </summar>
function submitSelected()
{
    if ($("#type").value == "audiobook")
    {
        alert("Sorry, audiobook requests aren't quite hooked up yet");
        return;
    }
    
    if (!selectedSuggestion)
    {
        let button = $("#matchContinue");
        let color = new Color(button.getComputedStyle.backgroundColor, 500);
        Animation.fireNow({"backgroundColor" : new Color(100, 66, 69)}, button);
        Animation.queue({"backgroundColor" : color}, button, 500, 500, true);
        return;
    }

    const tmdbid = selectedSuggestion.getAttribute("tmdbid");
    const title = selectedSuggestion.getAttribute("title");
    let poster = selectedSuggestion.getAttribute("poster");
    if (!tmdbid || !title)
    {
        logError("Required fields not set");
        return;
    }

    let parameters =
    {
        "type" : ProcessRequest.NewRequest,
        "name" : title,
        "mediatype" : $("#type").value,
        "external_id" : tmdbid,
        "poster" : poster
    }

    let successFunc = function(response)
    {
        if (!response.exists)
        {
            window.location.href = `https://danrahn.com/plex/request.php?id=${response.req_id}&new=1`;
            return;
        }

        // The user has already made a request for this item. Ask them to add
        // a comment to the existing request instead
        let status = [ "Pending", "Complete", "Denied", "In Progress", "Waiting" ][response.status]
        let secondaryText = 'Would you like to add a comment to the existing request?';
        let message = buildNode(
            'div',
            {},
            `You have already made a request for '${response.name}', and its status is '${status}'.<br><br>${secondaryText}`)
        let button1 = buildNode(
            "input",
            {
                "type" : "button",
                "id" : "overlayOK",
                "value" : "Go to Request",
                "style" : "width: 120px; margin-right: 10px; display: inline",
                "rid" : response.rid
            },
            0,
            {
                "click" : goToRequest
            });

        let button2 = buildNode(
            "input",
            {
                "type" : "button",
                "id" : "overlayCancel",
                "value" : "Cancel",
                "style" : "width: 120px; display: inline",
            },
            0,
            {
                "click" : overlayDismiss
            });

        let outerButtonContainer = buildNode('div', { 'class' : 'formInput', 'style' : 'text-align: center' });
        let buttonContainer = buildNode('div', { "style" : "float: right; overflow: auto; width: 100%; margin: auto" } );
        buttonContainer.appendChild(button1);
        buttonContainer.appendChild(button2);
        outerButtonContainer.appendChild(buttonContainer);

        buildOverlay(true /*dismissable*/, message, outerButtonContainer);
    };

    let failureFunc = function()
    {
        let buttons = $(".matchContinue");
        for (let i = 0; i < buttons.length; ++i)
        {
            buttons[i].value = "Something went wrong, please try again later";
            Animation.fireNow({"backgroundColor" : new Color(100, 66, 69)}, buttons[i], 500);
            Animation.queueDelayed({"backgroundColor" : new Color(63, 66, 69)}, buttons[i], 1000, 500, true);
            setTimeout(function(btn) { btn.value = "Submit Request"; }, 2500, buttons[i]);
        }
    }
    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
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

function setVisibility(id, visible)
{
    let element = $('#' + id);
    if (!element)
    {
        return;
    }

    element.classList.remove(visible ? "hidden" : "visible");
    element.classList.add(visible ? "visible" : "hidden");
}

function clearElement(id)
{
    let element = $(`#${id}`);
    while (element.firstChild)
    {
        element.removeChild(element.firstChild);
    }
}
