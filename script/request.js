/// <summary>
/// Handles building an individual request and associated comments
/// </summary>

/// <todo>
/// Caching mechanism for data (save for 30 days, one week?)
/// Separate table, request_metadata for all the fields
/// - Title (should be part of regular request info)
/// - Release date (should conform to one format)
/// - Description
/// - Anything else that we happen to want to add
/// - Separate columns for each, which will help if we ever want additional filtering options
/// </todo>

/// <summary>
/// Add initial event listeners
/// </summary>
window.addEventListener("load", function()
{
    if ($("#matchContainer"))
    {
        searchForMedia();
        $("#external_id").addEventListener("input", searchImdb);
    }
    else
    {
        if (attr("isMediaRequest") == "1")
        {
            getMediaInfo();
        }
        else
        {
            getNonMediaInfo();
        }

        $("#newComment").addEventListener("keydown", function(e)
        {
            if (e.ctrlKey && e.which === 13 /*enter*/)
            {
                addComment();
            }
        });

        setupMarkdown();
        setupMarkdownHelpers();

        $("#newCommentButton").addEventListener("click", addComment);
        addNavListener();
        getComments();

        checkForNotifications();
    }
});

/// <summary>
/// Returns an attribute on the document's body.
///
/// Really just shorthand for document.body.getAttribute
/// </summary>
function attr(prop)
{
    return document.body.getAttribute(prop);
}

/// <summary>
/// Get an attribute from the document's body as an integer
/// </summary>
function attrInt(prop)
{
    return parseInt(attr(prop));
}

/// <summary>
/// Returns whether the current user is an admin.
/// </summary>
function isAdmin()
{
    return attrInt("isAdmin");
}

/// <summary>
/// Returns whether this request belongs to the current user
/// </summary>
function isAuthor()
{
    return attrInt("isAuthor");
}

/// <summary>
/// Returns the id associated with the current request
/// </summary>
function reqId()
{
    return attrInt("reqId");
}

/// <summary>
/// Add markdown related event listeners to the new comment textbox
/// </summary>
function setupMarkdown()
{
    let comment = $("#newComment");
    comment.addEventListener("change", parseMarkdown);
    comment.addEventListener("keyup", parseMarkdown);
    MarkdownEditor.addTabHandler(comment);
    MarkdownEditor.addAutoCompleteHandler(comment);
    MarkdownEditor.addFormatHandler(comment);
}

/// <summary>
/// Add event listeners to markdown insert buttons
/// </summary>
function setupMarkdownHelpers()
{
    $("#newCommentHolder").insertBefore(MarkdownEditor.getToolbar($("#newComment")) ,$("#newComment"));
}

// Global markdown object so we can cache parsed markdown
let mdPreview = new Markdown();

/// <summary>
/// Parse the user's new comment text. If any markdown elements
/// are (not) present, show (hide) the preview window.
/// </summary>
function parseMarkdown()
{
    const text = $("#newComment").value;

    Log.tmi(`Parsing "${text}"`);
    let html = mdPreview.parse(text);
    $("#mdHolder").style.display = (text.length != 0 && mdPreview.markdownPresent) ? "block" : "none";

    // No need to redraw if the content is the same as our last result.
    if (!mdPreview.sameText)
    {
        $("#mdPreview").innerHTML = html;
    }
}

let selectedSuggestion;

/// <summary>
/// Add request keyboard listener to navigate between requests
/// on Ctrl+Left/Ctrl+Right
/// </summary>
function addNavListener()
{
    document.body.addEventListener("keydown", function(e)
    {
        let tag = e.target.tagName.toLowerCase();
        if (tag == "textarea" || (tag == "input" && e.target.type == "text"))
        {
            return;
        }

        if (!e.ctrlKey || (e.which !== KEY.LEFT && e.which !== KEY.RIGHT))
        {
            return;
        }

        Log.verbose("Searching for next id");
        let parameters = { type : ProcessRequest.NextRequest, id : reqId(), dir : e.which === KEY.LEFT ? "0" : "1" };
        let successFunc = function(response)
        {
            if (response.new_id == -1)
            {
                Log.info("No more requests in that direction!");
                return;
            }

            window.location = "request.php?id=" + response.new_id;
        };

        sendHtmlJsonRequest("process_request.php", parameters, successFunc);

    });
}

/// <summary>
/// For legacy movie/tv requests that do not yet have an external id,
/// initiate an external search to try and find a match
/// </summary>
function searchForMedia()
{
    let requestType = attrInt("requestType");
    switch (requestType)
    {
        case 1:
        case 2:
            searchForMediaCore();
            break;
        default:
            console.log("Other: " + requestType);
            break;
    }
}

/// <summary>
/// Search imdb for a legacy request that does not yet have an external id set
/// </summary>
function searchImdb()
{
    let id = $("#external_id").value;
    if (id.length != 9 || id.substring(0, 2) != "tt" || isNaN(parseInt(id.substring(2))))
    {
        if (id.length == 0)
        {
            $("#imdbResult").innerHTML = "";
        }
        else
        {
            $("#imdbResult").innerHTML = "Incomplete IMDb Id";
        }

        return;
    }

    $("#imdbResult").innerHTML = "Searching...";

    let parameters = { type : attrInt("requestType"), query : id, imdb : true };
    let successFunc = function(response)
    {
        Log.info(response);
        let type = attrInt("requestType");
        switch (type)
        {
            case 1:
                buildItems(response.movie_results, "imdbResult");
                break;
            case 2:
                buildItems(response.tv_results, "imdbResult");
                break;
            default:
                $("#imdbResult").innerHTML = "Sorry, something went wrong";
                break;
        }
    };
    let failureFunc = function()
    {
        $("#imdbResult").innerHTML = "Failed to retrieve media";
    };

    sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Search for a legacy request and show potential matches to the user
/// </summary>
function searchForMediaCore()
{
    let parameters = { type : attrInt("requestType"), query : attr("requestName") };
    let successFunc = function(response)
    {
        Log.info(response);
        if (response.results.length === 0)
        {
            $("#matchContainer").innerHTML = "No matches found. Please enter the IMDb id below";
            return;
        }

        buildItems(response.results, "matchContainer");
    };

    let failureFunc = function(/*response*/)
    {
        $("#matchContainer").innerHTML = "Error searching for matches";
    };

    sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Builds a suggested match for a legacy request
/// </summary>
function buildLegacyMatch(match)
{
    let item = buildNode("div",
        {
            class : "searchResult",
            title : match.title ? match.title : match.name,
            tmdbid : match.id
        },
        0,
        { click : clickSuggestion });

    if (match.thumb)
    {
        item.setAttribute("pid", match.thumb.substring(match.thumb.indexOf("metadata") + 9, match.thumb.indexOf("/thumb")));
    }

    let type = attrInt("requestType");
    if (type != 2) { type = 1; }
    let img = buildNode("img", {
        src : (match.poster_path ?
            `https://image.tmdb.org/t/p/w92${match.poster_path}` :
            (match.thumb ?
                match.thumb :
                `poster/${type == 1 ? "movie" : "tv"}default.png`
            )
        ),
        style : "height: 70px"
    });

    let div = buildNode("div", { class : "matchText" });
    let release = match.release_date;
    if (release === null || release === undefined)
    {
        release = match.first_air_date;
        if (!release)
        {
            release = "";
        }
    }

    let titleText = (match.title ? match.title : match.name) + " ";
    div.appendChild(buildNode("span", {}, titleText));
    let href = buildNode("a",
        { href : "#" },
        (release.length > 4 ? (" (" + release.substring(0, 4) + ")") : ""),
        { click : goToImdb });

    div.appendChild(href);
    return item.appendChildren(img, div);
}

/// <summary>
/// Builds potential request matches for legacy requests that don't
/// have a backing external ID. Largely copied from new_request's similar method
/// </summary>
function buildItems(matches, holder)
{
    let container = $("#" + holder);
    container.innerHTML = "";
    let max = Math.min(matches.length, 10);
    for (let i = 0; i < max; ++i)
    {
        container.appendChild(buildLegacyMatch(matches[i]));
    }

    let button = buildNode(
        "input",
        {
            id : `matchContinue_${holder}`,
            class : "matchContinue",
            style : "visibility: hidden; height: 0",
            type : "button",
            value : "Continue"
        },
        0,
        { click : chooseSelected });
    container.appendChild(button);
}

/// <summary>
/// Navigate to IMDb (falling back to themoviedb) when a legacy request link is clicked
/// </summary>
function goToImdb()
{
    let parameters = { type : attrInt("requestType"), query : this.parentNode.parentNode.getAttribute("tmdbid"), by_id : "true" };
    let successFunc = function(response, request)
    {
        Log.info(response);
        if (response.imdb_id)
        {
            window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank", "noreferrer");
        }
        else
        {
            window.open("https://www.themoviedb.org/" + attrInt("requestTypeStr") + "/" + request.tmdbid, "_blank", "noreferrer");
        }
    };
    sendHtmlJsonRequest("media_search.php", parameters, successFunc, null, { tmdbid : this.parentNode.parentNode.getAttribute("tmdbid") });
}

/// <summary>
/// Process a click on a potential match for a legacy request
/// </summary>
function clickSuggestion(e)
{
    if (e.target.tagName.toLowerCase() == "a")
    {
        return;
    }

    let enableButton = "matchContinue_" + this.parentNode.id;
    let disableButton = "matchContinue_" + (enableButton.charAt(14) == "m" ? "imdbResult" : "matchContainer");
    if (selectedSuggestion && selectedSuggestion != this)
    {
        selectedSuggestion.className = "searchResult";
    }
    else if (selectedSuggestion == this)
    {
        this.className = "searchResult";
        setVisibility(enableButton, false);
        setVisibility(disableButton, true);
        selectedSuggestion = undefined;
        return;
    }

    selectedSuggestion = this;
    this.className += " selectedSuggestion";
    setVisibility(enableButton, true);
    setVisibility(disableButton, false);
}

/// <summary>
/// Show or hide the element with the given id
/// </summary>
function setVisibility(id, visible)
{
    let element = $(`#${id}`);
    if (!element)
    {
        return;
    }

    element.style.visibility = visible ? "visible" : "hidden";
    element.style.height = visible ? "auto" : "0";
}

/// <summary>
/// Match a legacy request with the selected item
/// </summary>
function chooseSelected()
{
    if (!selectedSuggestion)
    {
        let button = $$(".matchContinue");
        let color = new Color(button.getComputedStyle.backgroundColor);
        Animation.queue({ backgroundColor : new Color(100, 66, 69) }, button, 500);
        Animation.queueDelayed({ backgroundColor : color }, button, 500, 500, true);
        return;
    }

    if (!selectedSuggestion.getAttribute("tmdbid"))
    {
        Log.error("No tmdb id found");
        return;
    }

    if (this.id == "matchContinue_completeRequestMatches")
    {
        setInternalId();
    }
    else
    {
        setExternalId();
    }
}

/// <summary>
/// Sets the internal id of the completed request based on the admin's selection
/// </summary>
function setInternalId()
{
    let params =
    {
        type : ProcessRequest.SetInternalId,
        req_id : reqId(),
        id : selectedSuggestion.getAttribute("pid")
    };

    let successFunc = function()
    {
        Animation.queue({ backgroundColor : "rgb(63, 100, 69)" }, $$(".matchContinue"), 250);
        Animation.queueDelayed({ backgroundColor : "rgb(63, 66, 69)" }, $$(".matchContinue"), 500, 250, true);

        setTimeout(function() { window.location.reload(); }, 1000);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc);
}

/// <summary>
/// Sets the external id for a legacy request that does not have one yet
/// </summary>
function setExternalId()
{
    let params = { type : ProcessRequest.SetExternalId, req_id : reqId(), id : selectedSuggestion.getAttribute("tmdbid") };

    let successFunc = function(response)
    {
        Log.info(response);
        let matches = $(".matchContinue");

        for (let i = 0; i < matches.length; ++i)
        {
            matches[i].value = "Success! Redirecting...";
        }

        setTimeout(function() { window.location.reload(); }, 1000);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc);
}

/// <summary>
/// Initiate a request for information on the current request
/// </summary>
function getMediaInfo()
{
    let parameters = { type : attrInt("requestType"), query : attr("externalId"), by_id : "true" };
    let successFunc = function(response)
    {
        Log.info(response);
        buildPage(response);
        getInternalId();
    };
    let failureFunc = function()
    {
        $("#loadingInfo").innerHTML = "Unable to query request information";
    };
    sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Attempts to retrieve the internal id for a completed request
///
/// If one is not found and the current user is an admin, prompt them to select a match
/// </summary>
function getInternalId()
{
    if (attrInt("requestStatus") != 1)
    {
        return;
    }

    let params =
    {
        type : ProcessRequest.GetInternalId,
        req_id : attrInt("reqId")
    };

    let successFunc = function(response)
    {
        if (response.internal_id == -1)
        {
            if (isAdmin())
            {
                searchForCompleteMatch();
            }
            return;
        }

        let hyperlink = `${attr("plex_host")}/${attr("plex_nav")}/server/${response.machine_id}/details?`;
        hyperlink += `key=${encodeURIComponent("/library/metadata/" + response.internal_id)}`;
        $("#mediaDetails").insertBefore(
            buildNode("div", { class : "mediaLink", id : "internalId" }).appendChildren(
                buildNode("a", { href : hyperlink, target : "_blank", rel : "noreferrer" }, "View on Plex")
            ),
            $$("#mediaDetails hr")
        );
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc);
}

/// <summary>
/// Searches Plex for a match, displaying all of them in an overlay
/// </summary>
function searchForCompleteMatch()
{
    let overlayNode = buildNode("div", { class : "formContainer" }).appendChildren(
        // eslint-disable-next-line no-script-url
        buildNode("form", { id : "searchForm", style : "overflow: auto", action : "javascript:void(0)" }).appendChildren(
            buildNode("div", { style : "margin-bottom: 10px" }, "Select the Matching Request"),
            buildNode("hr"),
            buildNode("div", { id : "completeRequestMatches" }, "Searching...")
        )
    );
    Overlay.build({ dismissible : true, centered : false }, overlayNode);
    searchPlex();
}

// Keep in sync with .statusX css
const statusColors = ["C84", "4C4", "C44", "CC4", "44C", "840"];

/// <summary>
/// Return the status string based on the state of the request.
/// If the current user is an admin, setup event listeners that enable
/// changing the current status
/// </summary>
function getStatusSpan(status)
{
    let statusSpan = buildNode("span",
        { class : `status${status} statusSpan` },
        ["Pending", "Complete", "Denied", "In Progress", "Waiting", "Deleted"][status]);

    let containerSpan = buildNode("span");
    containerSpan.appendChild(statusSpan);
    if (isAdmin())
    {
        containerSpan.appendChild(
            buildNode(
                "img",
                {
                    src : Icons.getColor("edit", statusColors[status]),
                    alt : "Edit status",
                    id : "statusEdit",
                    class : "statusTitleIcon",
                    title : "Edit request status"
                },
                0,
                {
                    click : showStatusChangeOverlay
                }
            )
        );
    }

    if (isAuthor() && status != 1 && status != 5) // Can't delete completed requests (or already deleted ones)
    {
        containerSpan.appendChild(
            buildNode(
                "img",
                {
                    src : Icons.getColor("delete", statusColors[2]),
                    alt : "Delete Request",
                    id : "deleteRequest",
                    class : "statusTitleIcon",
                    title : "Delete this request"
                },
                0,
                {
                    click : confirmDeleteRequest
                }
            )
        );
    }

    return containerSpan;
}

/// <summary>
/// Build the request page for non-media requests (e.g. ViewStream requests)
/// </summary>
function getNonMediaInfo()
{
    let outerContainer = buildNode("div", { id : "innerInfoContainer" }).appendChildren(
        buildNode("div", { id : "mediaDetails" }).appendChildren(
            buildNode("div", { id : "mediaTitle" }, `Request: ${attr("requestName")} - `).appendChildren(
                getStatusSpan(attrInt("requestStatus"))
            )
        )
    );

    $("#loadingInfo").parentElement.removeChild($("#loadingInfo"));
    $("#infoContainer").appendChild(outerContainer);
}

/// <summary>
/// Return an image element containing the poster for the given request,
/// falling back to a default poster if a real one does not exist
/// </summary>
function buildRequestPoster(request)
{
    let posterPath = request.poster_path;
    if (!posterPath)
    {
        switch (attrInt("requestType"))
        {
            case 1:
                posterPath = "/moviedefault.svg";
                break;
            case 2:
                posterPath = "/tvdefault.svg";
                break;
            default:
                posterPath = "/viewstream.svg";
                break;
        }
    }

    return buildNode(
        "img",
        {
            src : posterPath.startsWith("http") ? posterPath : `poster${posterPath}&large=1`,
            id : "mediaPoster",
            alt : "Media Poster"
        });
}

/// <summary>
/// Return the node containing a link to an external site (imdb/themoviedb) for the given request
/// </summary>
function buildRequestExternalLink(request)
{
    let imdb;
    if (request.imdb_id)
    {
        imdb = buildNode("div", { class : "mediaLink hasRating", id : "imdbLink", title : "View on IMDb" });
        imdb.appendChild(
            externalLink(`https://imdb.com/title/${request.imdb_id}`, "").appendChildren(
                buildNode(
                    "img",
                    {
                        src : Icons.get("imdb"),
                        alt : "IMDb"
                    }
                ),
                buildNode("span", { id : "imdbRating" }, "...")
            )
        );

        let failureFunc = () =>
        {
            $("#imdbRating").parentElement.removeChild($("#imdbRating"));
            $("#imdbLink").classList.remove("hasRating");
        };

        sendHtmlJsonRequest(
            "process_request.php",
            { type : ProcessRequest.ImdbRating, tt : request.imdb_id },
            function(response) { $("#imdbRating").innerHTML = response.rating; },
            failureFunc);
    }
    else if (request.id)
    {
        imdb = buildNode("div", { class : "mediaLink" });
        imdb.appendChild(externalLink(`https://www.themoviedb.org/${attr("requestTypeStr")}/${request.id}`, "TMDb"));
    }
    else if (request.audible)
    {
        imdb = buildNode("div", { class : "mediaLink" });
        imdb.appendChild(externalLink(`https://audible.com/pd/${attr("externalId")}?ipRedirectOverride=true`, "Audible"));
    }

    return imdb;
}

/// <summary>
/// Returns a link element that will open an external site in a new window/tab
/// </summary>
function externalLink(url, text)
{
    return buildNode(
        "a",
        {
            href : url,
            target : "_blank",
            rel : "noreferrer"
        },
        text
    );
}

/// <summary>
/// Build and display all the request details
/// </summary>
function buildPage(data)
{
    $("#loadingInfo").parentElement.removeChild($("#loadingInfo"));
    let container = $("#infoContainer");
    container.innerHTML = "";

    let backdrop;
    if (data.backdrop_path)
    {
        backdrop = buildNode("img", {
            src : `https://image.tmdb.org/t/p/original${data.backdrop_path}`,
            id : "mediaBackdrop",
            alt : "Media Backdrop"
        });
    }

    let innerContainer = buildNode("div", { id : "innerInfoContainer" });

    let poster = buildRequestPoster(data);
    let details = buildNode("div", { id : "mediaDetails" });

    let title = buildNode("div", { id : "mediaTitle" });
    let status = attrInt("requestStatus");

    title.innerHTML = (data.title || data.name) + " - ";
    title.appendChild(getStatusSpan(status));

    let release = data.release_date || data.first_air_date;
    let year = buildNode("div", { id : "mediaYear" }, (release && release.length) > 4 ? release.substring(0, 4) : "Unknown Release Date");

    let imdb = buildRequestExternalLink(data);

    let desc = buildNode("div", { id : "mediaOverview" }, data.overview);

    details.appendChildren(title, year, imdb ? imdb : 0, buildNode("hr"), desc);

    innerContainer.appendChildren(poster, details);

    if (backdrop)
    {
        container.appendChild(backdrop);
    }

    container.appendChild(innerContainer);
}

/// <summary>
/// Prompt the administrator for the new request status
/// </summary>
function showStatusChangeOverlay()
{
    let select = buildNode("select", { name : "newStatus", id : "newStatus", class : "inlineCombo" });
    let mappings = [0, 4, 3, 1, 2];
    let selected = attrInt("requestStatus");
    ["Pending", "Waiting", "In Progress", "Complete", "Denied"].forEach(function(item, i)
    {
        let option = buildNode("option", { value : mappings[i] }, item);
        if (mappings[i] == selected)
        {
            option.selected = true;
        }

        select.appendChild(option);
    });

    Overlay.build(
        { dismissible : true, centered : false },
        buildNode("div", { id : "changeStatus", class : "overlayDiv" }).appendChildren(
            buildNode("div", {}, "Update request status"),
            select,
            buildNode("input", { type : "button", value : "Change", class : "overlayInput overlayButton" }, 0, { click : changeStatus })
        )
    );
}

/// <summary>
/// Changes the status of the current request
/// </summary>
function changeStatus()
{
    let status = $("#newStatus").value;
    if (status == attrInt("requestStatus"))
    {
        return;
    }

    let params = {
        type : "req_update",
        data : [{ id : reqId(), kind : "status", content : status }]
    };

    let successFunc = function()
    {
        let span = $(".statusSpan")[0];
        if (span)
        {
            span.className = "statusSpan status" + status;
            span.innerHTML = ["Pending", "Complete", "Denied", "In Progress", "Waiting", "Deleted"][status];
            $("#statusEdit").src = Icons.getColor("edit", statusColors[status]);
        }

        Overlay.dismiss();
        if (status == 1)
        {
            // SearchForCompleteMatch launches an overlay, so we have to wait
            // for the last one to be dismissed first
            setTimeout(searchForCompleteMatch, 300);
        }

        document.body.setAttribute("requestStatus", $("#newStatus").value);
    };

    let failureFunc = function()
    {
        alert("Failed to update. See console for details");
        Overlay.dismiss();
    };

    sendHtmlJsonRequest("update_request.php", JSON.stringify(params), successFunc, failureFunc, null, true /*dataIsString*/);
}

/// <summary>
/// Prompts the user to delete the request
/// </summary>
function confirmDeleteRequest()
{
    let okayButton = buildNode(
        "input",
        {
            type : "button",
            id : "confirmDeleteButton",
            class : "overlayInlineButton rightButton",
            value : "Delete",
        },
        0,
        { click : deleteRequest }
    );

    let cancelButton = buildNode(
        "input",
        {
            type : "button",
            class : "overlayInlineButton",
            value : "Cancel",
        },
        0,
        { click : Overlay.dismiss }
    );

    let outerButtonContainer = buildNode("div", { class : "formInput", style : "text-align: center" });
    let buttonContainer = buildNode("div", { style : "width: 100%; margin: auto" });
    outerButtonContainer.appendChild(buttonContainer.appendChildren(okayButton, cancelButton));

    Overlay.build(
        { dismissible : true, centered : false },
        buildNode("div", { class : "overlayDiv" }).appendChildren(
            buildNode("div", {}, "Are you sure you want to delete this request?"),
            outerButtonContainer
        )
    );
}

/// <summary>
/// Deletes this request
/// </summary>
function deleteRequest()
{
    let parameters =
    {
        type : ProcessRequest.DeleteRequest,
        rid : reqId()
    };

    let successFunc = function()
    {
        if ($("#mainOverlay"))
        {
            let deleteBtn = $("#confirmDeleteButton");
            if (deleteBtn)
            {
                Animation.fireNow({ backgroundColor : "rgb(51, 99, 57)" }, deleteBtn, 500);
            }
        }

        setTimeout(() => { window.location = "requests.php"; }, 1000);
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, deleteRequestFailed);
}

/// <summary>
/// Adjusts the overlay message when we fail to delete a request
/// </summary>
function deleteRequestFailed()
{
    let message = "Sorry, something went wrong and we could not delete this request. Please try again later.";
    let mainOverlay = $("#mainOverlay");
    if (mainOverlay)
    {
        let container = $("#overlayContainer");
        while (container.firstChild)
        {
            container.removeChild(container.firstChild);
        }

        container.appendChildren(
            buildNode("div", { id : "overlayMessage", class : "overlayDiv" }, message),
            buildNode(
                "input",
                {
                    type : "button",
                    id : "overlayBtn",
                    class : "overlayInput overlayButton",
                    value : "OK",
                    style : "width: 100px"
                },
                0,
                {
                    click : Overlay.dismiss
                }
            )
        );
    }
    else
    {
        Overlay.show(message, "OK", Overlay.dismiss);
    }
}

/// <summary>
/// Search plex for the current request title
/// </summary>
function searchPlex()
{
    let query = attr("requestName");
    if ($("#customSearchText"))
    {
        query = $("#customSearchText").value;
    }

    let parameters =
    {
        type : ProcessRequest.SearchPlex,
        kind : attr("requestTypeStr"),
        query : query
    };

    let successFunc = function(response)
    {
        if (response.length === 0)
        {
            if ($("#customSearchText"))
            {
                $("#completeRequestMatches").innerHTML = "No matches found.";
            }
            else
            {
                $("#completeRequestMatches").innerHTML = "No matches found. Maybe try a custom search instead.";
                buildCustomSearch();
            }
            return;
        }

        buildItems(response.top, "completeRequestMatches");
    };

    let failureFunc = function()
    {
        $("#completeRequestMatches").innerHTML = "Error searching for matches";
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

let internalSearchTimer;

/// <summary>
/// If no internal matches are found, let the admin search directly
/// </summary>
function buildCustomSearch()
{
    $("#searchForm").appendChild(buildNode(
        "input",
        { type : "text", id : "customSearchText", placeholder : "Custom search..." },
        attr("requestName"),
        { input : customSearchChanged }
    ));
}

/// <summary>
/// Triggered when the search input changes - initiates a search after 250ms of subsequent inactivity
/// </summary>
function customSearchChanged()
{
    let suggestion = $("#customSearchText").value;
    clearTimeout(internalSearchTimer);
    if (suggestion.length === 0)
    {
        $("#completeRequestMatches").style.display = "none";
        return;
    }

    $("#completeRequestMatches").style.display = "block";
    internalSearchTimer = setTimeout(searchPlex, 250);
}

/// <summary>
/// Ask the server for the comments associated with this request
/// </summary>
function getComments()
{
    let params = { type : ProcessRequest.GetComments, req_id : reqId() };
    let successFunc = function(response)
    {
        Log.info(response, "Comments");
        buildComments(response);
    };
    let failureFunc = function(response)
    {
        $("#comments").innerHTML = response.Error;
    };
    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
}

/// <summary>
/// If the user doesn't have notifications enabled, ask them if they want
/// to get updates. Popups are annoying though, so add a persistent "Don't
/// show this again" option.
/// </summary>
function checkForNotifications()
{
    if (attrInt("newrequest") != 1)
    {
        return;
    }

    let parameters = { type : ProcessRequest.CheckNotificationAlert };
    let successFunc = function(response)
    {
        if (response.should_check)
        {
            promptForNotifications();
        }
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc);
}

/// <summary>
/// Returns 'Yes' and 'No' buttons for the 'enable notifications' overlay
/// </summary>
function getYesNoOverlayButtons()
{
    let yesButton = buildNode(
        "input",
        {
            type : "button",
            value : "Yes",
            class : "thinOverlayButton rightButton",
        },
        0,
        {
            click : function()
            {
                checkDontAskAgain(true /*redirect*/);
            }
        });

    let noButton = buildNode(
        "input",
        {
            type : "button",
            value : "No",
            class : "thinOverlayButton",
        },
        0,
        {
            click : function()
            {
                checkDontAskAgain(false /*redirect*/);
            }
        });

    return { yes : yesButton, no : noButton };
}

/// <summary>
/// Prompts the user to enable notifications
/// </summary>
function promptForNotifications()
{
    let promptHolder = buildNode("div", { style : "background-color: rgba(0,0,0,0.5); overflow: auto", class : "overlayDiv" }); // Darker background
    let title = buildNode("h4", { style : "margin-top: 10px;" }, "Enable Notifications");
    let prompt = buildNode("div", {}, "Thanks for your request! Do you want to get notifications when the status of your requests are changed?");
    let checkHolder = buildNode("div", { class : "formInput" });
    let check = buildNode("input",
        {
            type : "checkbox",
            name : "noalerts",
            id : "noalerts",
            style : "float: none; display: inline-block; margin-right: 10px;"
        });

    let checkLabel = buildNode(
        "label",
        {
            for : "noalerts",
            id : "noalertsLabel",
            style : "float: none"
        },
        "Don't ask again");

    checkHolder.appendChildren(check, checkLabel);

    let buttons = getYesNoOverlayButtons();
    let outerButtonContainer = buildNode("div", { class : "formInput", style : "text-align: center" });
    let buttonContainer = buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" });
    outerButtonContainer.appendChildren(buttonContainer.appendChildren(buttons.yes, buttons.no));

    promptHolder.appendChildren(title, prompt, checkHolder, outerButtonContainer);
    Overlay.build({ dismissible : true, centered : false }, promptHolder);
}

/// <summary>
/// Checks whether the user has asked to not see the notification prompt again
/// Will redirect to user_settings if 'redirect' is true, otherwise dismisses the overlay
/// </summary>
function checkDontAskAgain(redirect)
{
    if (!$("#noalerts").checked)
    {
        if (redirect)
        {
            window.location = "user_settings.php?fornotify=1";
        }
        else
        {
            Overlay.dismiss();
        }

        return;
    }

    let parameters = { type : ProcessRequest.DisableNotificationAlert };
    let attached = { redirectToSettings : redirect };
    let responseFunc = function(response, request)
    {
        if (request.redirectToSettings)
        {
            window.location = "user_settings.php?fornotify=1";
        }
        else
        {
            Overlay.dismiss();
        }
    };

    sendHtmlJsonRequest("process_request.php", parameters, responseFunc, responseFunc, attached);
}

/// <summary>
/// Takes the given CSS file and inlines styles into the given text
/// </summary>
function inlineCSS(css, text)
{
    let cssElements = parseCss(css);

    for (let selector in cssElements)
    {
        if (!Object.prototype.hasOwnProperty.call(cssElements, selector))
        {
            continue;
        }

        let eleStyle = cssElements[selector];

        if (selector.startsWith("."))
        {
            // We have a class. Make the generally unsafe assumption
            // that classes are standalone from anything else
            text = text.replace(new RegExp(`class="${selector.substring(1)}`, "g"), `style="${eleStyle}" class="${selector.substring(1)}`);
        }
        else if (selector.indexOf(":") > -1)
        {
            // Pseudo element. Do nothing for now
        }
        else
        {
            // Some elements have additional properties
            if (selector == "a")
            {
                text = text.replace(/<a href/g, '<a style="' + eleStyle + '" href');
            }
            else if (selector == "img")
            {
                text = text.replace(/<img src/g, '<img style="' + eleStyle + '" src');
            }
            else
            {
                text = text.replace(new RegExp(`<${selector}>`, "g"), `<${selector} style="${eleStyle}">`);
            }
        }

    }

    return `<div style="${cssElements.base}">${text}</div>`;
}

/// <summary>
/// Adds a style definition to an element in our style dictionary
/// </summary>
function addStyle(ele, eleStyle, style)
{
    if (!style[ele])
    {
        style[ele] = "";
    }

    Log.verbose(`Adding style for ${ele}: ${eleStyle}`);
    style[ele] += eleStyle;
}

/// <summary>
/// Returns a dictionary mapping selectors to styles
/// for the given css.
/// </summary>
function parseCss(css)
{
    let style = {};

    // Many shortcuts are taken based on what we expect the CSS structure to be.
    // This is by no means a generalized CSS parser

    // Assume the first element is the base .md element
    if (!css.startsWith(".md {"))
    {
        Log.log("Unexpected start to Markdown CSS. Email notifications will be styled incorrectly.", 0, 0, Log.Level.Critical);
        return style;
    }

    let start = css.match(/^\.md \{([^}]*)\}/m)[1];
    style.base = start.trim().replace(/\n */g, " ");

    let regex = /\n\.md ([^{]+) ?\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(css)) !== null)
    {
        let elements = match[1];
        let eleStyle = match[2].trim().replace(/\n */g, " ");
        if (elements.indexOf(" .md ") == -1)
        {
            addStyle(elements.trim(), eleStyle, style);
        }
        else
        {
            elements = elements.split(", .md");
            for (let ele in elements)
            {
                if (!Object.prototype.hasOwnProperty.call(elements, ele))
                {
                    continue;
                }

                addStyle(elements[ele].trim(), eleStyle, style);
            }
        }
    }

    return style;
}

/// <summary>
/// For markdown content, we do a lot of extra work to style the text correctly.
/// For the best results, it's probably better to inline all the relevant CSS for
/// each individual element. However, that has its own challenges, namely creating
/// simplified CSS and HTML parsers to correctly inject everything. A prototype version
/// is implemented, but is currently unused. Gmail and Outlook are correctly handling
/// style sheets embedded directly in the email, and that's good enough for me for now.
/// </summary>
async function inlineCssIfNeeded(initialText)
{
    const preParse = false;
    let mdText = mdPreview.parse(initialText);
    if (!preParse)
    {
        return mdText;
    }

    let css = await fetch("style/markdown.css").then(response => response.text().then(text => text));
    return inlineCSS(css, mdText);

}

/// <summary>
/// Add a comment to the review
/// </summary>
async function addComment()
{
    let comment = $("#newComment");
    let text = comment.value;
    if (text.length === 0)
    {
        Log.info("Not adding comment - no content!");
        return;
    }

    comment.value = "";
    Log.info("Adding comment: " + text);

    let params = { type : ProcessRequest.AddComment, req_id : reqId(), content : text };

    if (mdPreview.markdownPresent)
    {
        params.md = await inlineCssIfNeeded(text);
    }

    let successFunc = function()
    {
        $("#mdHolder").style.display = "none";
        getComments();
    };

    let failureFunc = function(response, request)
    {
        let element = $("#newComment");
        element.value = request.textSav;
        Animation.fireNow({ backgroundColor : new Color(100, 66, 69) }, element, 500);
        Animation.queueDelayed({ backgroundColor : new Color(63, 66, 69) }, element, 1000, 500);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc, { textSav : text });
}

/// <summary>
/// Contains a map of comment ids to the raw markdown text for the comment
/// Used for editing comments so we don't have to ping the server again to initiate an edit
/// </summary>
let commentCache = {};

/// <summary>
/// Build current comments and associated buttons/controls
/// </summary>
function buildComments(comments)
{
    commentCache = {};
    let container = $("#comments");
    container.innerHTML = "";

    if (comments.length == 0)
    {
        container.appendChild(buildNode("div", { id : "noComments", class : "commentHolder" }, "Nothing here yet. Add a new comment below."));
        return;
    }

    for (let i = 0; i < comments.length; ++i)
    {
        let comment = comments[i];
        let holder = buildNode("div", { id : "holder" + comment.id, class : "commentHolder" });
        let info = buildNode("div", { class : "commentInfo" });
        let name = buildNode("span", { class : "commentAuthor" }, comment.user);

        let dateObj = new Date(comment.time);
        let editTitle = "";
        if (comment.last_edit)
        {
            editTitle = "<br>Edited " + DateUtil.getFullDate(comment.last_edit);
        }

        let date = buildNode("span", {}, DateUtil.getDisplayDate(dateObj) + (editTitle ? "*" : ""));
        Tooltip.setTooltip(date, DateUtil.getFullDate(dateObj) + editTitle);

        commentCache[comment.id] = comment.content;

        // Try the new markdown parser
        let fixedupContent = new Markdown().parse(comment.content);

        let content = buildNode("div", { class : "commentContent md" }, fixedupContent);

        info.appendChildren(name, date);

        holder.appendChildren(info, content);

        if (parseInt(comment.editable) == 1)
        {
            let editTools = buildNode("div", { class : "commentEdit", commentId : comment.id });
            holder.appendChild(editTools.appendChildren(
                commentAction("Edit", editComment),
                commentAction("Delete", confirmDeleteComment)
            ));
        }

        container.appendChild(holder);
    }
}

/// <summary>
/// Launches the comment edit UI.
/// </summary>
function editComment()
{
    let commentId = this.parentNode.getAttribute("commentId");
    if ($(`#editor${commentId}`))
    {
        // We're already editing
        return;
    }

    let raw = commentCache[commentId];
    if (!raw)
    {
        Overlay.show("Something went wrong. Please try again later.", "OK", Overlay.dismiss);
    }

    let holder = $(`#holder${commentId}`);

    let buttonHolder = buildNode("div", { style : "float: left; padding: 3px" });
    let okay = commentAction("Save", submitCommentEdit);
    let cancel = commentAction("Cancel", function() { dismissEdit(this.getAttribute("commentId")); });
    okay.setAttribute("commentId", commentId);
    cancel.setAttribute("commentId", commentId);
    buttonHolder.appendChildren(okay, cancel);
    holder.insertBefore(buildNode(
        "hr",
        {
            style : "clear: both; margin: 0; height: 5px; border: none; border-bottom: 1px solid #616161"
        }), holder.children[1]);
    holder.insertBefore(buttonHolder, holder.children[1]);

    let editorHolder = buildNode("div");
    let editor = buildNode(
        "textarea",
        { id : "editor" + commentId, class : "commentEditor editComment", placeholder : "Edit comment..." },
        raw,
        {
            change : parseEditMarkdown,
            keyup : parseEditMarkdown
        });

    editorHolder.appendChildren(MarkdownEditor.getToolbar(editor), editor);
    MarkdownEditor.addTabHandler(editor);
    MarkdownEditor.addAutoCompleteHandler(editor);
    MarkdownEditor.addFormatHandler(editor);
    holder.insertBefore(editorHolder, holder.children[1]);

    editor.style.height = Math.min((editor.scrollHeight + 20), 350) + "px";
    editor.focus();
}

// Cached markdown object for editing comments
let mdEdit = new Markdown();

// ID of the last comment we parsed
let editCur = "";

/// <summary>
/// Parses edited comment content and updates the
/// preview accordingly
/// </summary>
function parseEditMarkdown()
{
    let sameEdit = true;
    if (this.id != editCur)
    {
        editCur = this.id;
        sameEdit = false;
    }

    let html = mdEdit.parse(this.value);
    if (!sameEdit || !mdEdit.sameText)
    {
        this.parentNode.parentNode.$$(".commentContent").innerHTML = html;
    }
}

/// <summary>
/// Dismiss the comment edit controls and replaces the comment content
/// with our latest cached value.
/// </summary>
function dismissEdit(id)
{
    let parent = $(`#holder${id}`);
    parent.removeChild(parent.children[1]); // textarea
    parent.removeChild(parent.children[1]); // Buttons
    parent.removeChild(parent.children[1]); // hr
    parent.$$(".commentContent").innerHTML = new Markdown().parse(commentCache[id]);
}

/// <summary>
/// Submit the edited comment, as long as it's different than our cached value
/// </summary>
function submitCommentEdit()
{
    let commentId = this.getAttribute("commentId");
    let content = $(`#editor${commentId}`).value;
    if (content == commentCache[commentId])
    {
        dismissEdit(commentId);
        return;
    }

    let params = { type : ProcessRequest.EditComment, id : commentId, content : content };
    let successFunc = function(response, request)
    {
        commentCache[request.commentId] = $(`#editor${request.commentId}`).value;
        dismissEdit(request.commentId);
    };

    let failureFunc = function(response, request)
    {
        Overlay.show(response.Error, "OK", Overlay.dismiss);
        dismissEdit(request.commentId);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc, { commentId : commentId });
}

/// <summary>
/// Ask the user if they're sure they want to delete their comment before actually doing it
/// </summary>
function confirmDeleteComment(e)
{
    // Make sure we're not already in a confirm situation
    if (e.target.classList.contains("deleteConfirm") || e.target.classList.contains("deleteCancel"))
    {
        return;
    }

    const commentId = this.parentNode.getAttribute("commentId");
    this.removeChild(this.childNodes[this.childNodes.length - 1]);

    let confirmHolder = buildNode("span");
    let confirm = buildNode("span", {}, "Are you sure? ");
    let confirmYes = buildNode("span",
        { id : "confirmDelete" + commentId, class : "deleteConfirm", commentId : commentId },
        "Yes",
        { click : deleteComment });

    let confirmMiddle = buildNode("span",{},"&nbsp;/&nbsp;");
    let confirmCancel = buildNode("span", { class : "deleteCancel", commentId : commentId }, "Cancel", { click : cancelDelete });

    confirmHolder.appendChildren(confirm, confirmYes, confirmMiddle, confirmCancel);
    this.appendChild(confirmHolder);
}

/// <summary>
/// The user canceled the delete operation, remove the 'Are you sure' text
/// </summary>
function cancelDelete()
{
    let grandparent = this.parentNode.parentNode;
    grandparent.removeChild(grandparent.children[grandparent.children.length - 1]);
    grandparent.appendChild(buildNode("span", {}, "Delete"));
}

/// <summary>
/// Deletes the specified comment from the request after the
/// user has confirmed that they do in fact want to delete the comment
/// </summary>
function deleteComment()
{
    const commentId = this.getAttribute("commentId");
    Log.verbose("Deleting comment " + commentId);

    let params = { type : ProcessRequest.DeleteComment, comment_id : commentId };
    let successFunc = function(response, request)
    {
        let ele = $(`#confirmDelete${request.commentId}`);
        Animation.queue({ color : new Color(63, 100, 69) }, ele, 250);
        Animation.queueDelayed({ color : new Color(63, 66, 69) }, ele, 500, 250);
        setTimeout(getComments, 1250);
    };

    let failureFunc = function(response)
    {
        Overlay.show(response.Error, "Okay", Overlay.dismiss, true /*dismissible*/);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc, { commentId : commentId });
}

/// <summary>
/// Returns a comment action "button" with the icon an text based on the given
/// action string, executing the given function callback when clicked
/// </summary>
function commentAction(action, fn)
{
    let holder = buildNode("div", { class : "commentAction" }, 0, { click : fn });
    let actionString = action + " Comment";

    // Thanks to css.gg for the 'pen' and 'trash' svg icons
    let img = buildNode("img", { src : actionToIcon(action), title : actionString, alt : actionString });
    let text = buildNode("span", {}, action);
    return holder.appendChildren(img, text);
}

/// <summary>
/// Maps an action string to its icon
/// </summary>
function actionToIcon(action)
{
    switch (action.toLowerCase())
    {
        case "edit":
            return Icons.getColor("edit", "929292");
        case "delete":
            return Icons.getColor("delete", "929292");
        case "save":
            return Icons.getColor("save", "929292");
        case "cancel":
            return Icons.getColor("cancel", "929292");
        default:
            return "";
    }
}
