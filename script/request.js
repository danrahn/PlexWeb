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

        $("#newComment").addEventListener("focus", function() { this.className = "newCommentFocus"; });
        $("#newComment").addEventListener("blur", function() { this.className = ""; });
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

function attr(prop)
{
    return document.body.getAttribute(prop);
}

function attrInt(prop)
{
    return parseInt(attr(prop));
}

function isAdmin()
{
    return attrInt("isAdmin");
}

function reqId()
{
    return attrInt("reqId");
}

function setupMarkdown()
{
    $("#newComment").addEventListener("change", parseMarkdown);
    $("#newComment").addEventListener("keyup", parseMarkdown);
    $("#mdhelp").addEventListener("click", showMarkdownHelp);
    MarkdownEditor.addTabHandler($("#newComment"));
}

function setupMarkdownHelpers()
{
    $("#addBold").addEventListener("click", mdDispatch);
    $("#addUnderline").addEventListener("click", mdDispatch);
    $("#addItalic").addEventListener("click", mdDispatch);
    $("#addStrikethrough").addEventListener("click", mdDispatch);
    $("#addLink").addEventListener("click", addLink);
    $("#addImage").addEventListener("click", addPhoto);
    $("#showMdHelp").addEventListener("click", showMarkdownHelp);
}

function mdDispatch()
{
    switch (this.id)
    {
        case "addBold":
            mdSurround("**");
            break;
        case "addUnderline":
            mdSurround("++");
            break;
        case "addItalic":
            mdSurround("_");
            break;
        case "addStrikethrough":
            mdSurround("~~");
            break;
        default:
            break;
    }
}

function processPhotoDimensions(link, text)
{
    let width = $("#insertWidth").value;
    let height = $("#insertHeight").value;
    let widthP = false;
    let heightP = false;
    if (width.endsWith("px"))
    {
        width = parseInt(width.substring(0, width.length - 2));
    }
    else if (width.endsWith("%"))
    {
        widthP = true;
        width = parseInt(width.substring(0, width.length - 1));
    }

    if (height.endsWith("px"))
    {
        height = parseInt(height.substring(0, height.length - 2));
    }
    else if (height.endsWith("%"))
    {
        heightP = true;
        height = parseInt(height.substring(0, height.length - 1));
    }

    logInfo(width);
    logInfo(height);

    let whString = text.length > 0 ? " " : "";
    if (width != 0 && !isNaN(width))
    {
        whString = `w=${width}${widthP ? "%" : ""}`;
    }

    if (height != 0 && !isNaN(height))
    {
        whString += `${whString.length > 1 ? "," : ""}h=${height}${heightP ? "%" : ""}`;
    }

    return `![${text}${whString}](${link})`;
}

function insertLinkInComment()
{
    let comment = $("#newComment");
    let link = $("#addLinkLink").value;
    let text = $("#addLinkText").value;
    let newText;
    if (this.getAttribute("isPhoto") == "1")
    {
        newText = processPhotoDimensions(link, text);
    }
    else
    {
        newText = `[${text}](${link})`;
    }

    comment.focus();
    if (document.queryCommandSupported("insertText"))
    {
        // This is deprecated, but it's the only way I've found to do it that supports undo.
        let start = comment.selectionStart;
        document.execCommand("insertText", false, newText);
        comment.setSelectionRange(start + newText.length, start + newText.length);
    }
    else
    {
        comment.setRangeText(newText, comment.selectionStart, comment.selectionEnd, "select");
    }

    overlayDismiss();
    parseMarkdown();
}

function getLinkOkCancelButtons(isPhoto)
{
    let okayButton = buildNode(
        "input",
        {
            type : "button",
            id : "addLinkOk",
            value : "Insert",
            style : "width: 100px; margin-right: 10px; display: inline",
            isPhoto : isPhoto ? 1 : 0
        },
        0,
        {
            click : insertLinkInComment
        });
    let cancelButton = buildNode(
        "input",
        {
            type : "button",
            value : "Cancel",
            style : "width: 100px; display: inline"
        },
        0,
        {
            click : overlayDismiss
        });

    let outerButtonContainer = buildNode("div", { class : "formInput", style : "text-align: center" });
    let buttonContainer = buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" });
    buttonContainer.appendChild(okayButton);
    buttonContainer.appendChild(cancelButton);
    outerButtonContainer.appendChild(buttonContainer);
    return outerButtonContainer;
}

function buildMarkdownImageDimensionsInput()
{
    let width = buildNode(
        "input",
        {
            type : "text",
            id : "insertWidth",
            style : "width: 75px; display: inline",
            placeholder : "Width"
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });
    let span = buildNode("span", { style : "margin-left: 10px; margin-right: 10px" }, "by");
    let height = buildNode(
        "input",
        {
            type : "text",
            id : "insertHeight",
            style : "width: 75px; display: inline",
            placeholder : "Height"
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });

    let dimensions = buildNode("div", { class : "formInput", style : "text-align: center" });
    let dimenContainer = buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" });
    dimenContainer.appendChild(width);
    dimenContainer.appendChild(span);
    dimenContainer.appendChild(height);
    dimensions.appendChild(dimenContainer);
    return dimensions;
}

/// <summary>
/// Keyup handler for comment insert dialogs to commit on 'enter'
/// </summary>
function mdInsertKeyupHandler(e)
{
    if (e.keyCode == 13 && !e.ctrlKey && !e.shiftKey && !e.altKey)
    {
        e.stopPropagation();
        $("#addLinkOk").click();
    }
}

/// <summary>
/// Launches a dialog to insert an image or link into a comment
/// </summary>
function addLinkOrPhoto(isPhoto)
{
    let comment = $("#newComment");
    let initialText = comment.value.substring(comment.selectionStart, comment.selectionEnd);
    let title = buildNode("h4", {}, `Insert ${isPhoto ? "Image" : "Hyperlink"}`);
    let linkText = buildNode("div", {}, "URL:");
    let linkInput = buildNode(
        "input",
        {
            type : "text",
            id : "addLinkLink"
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });
    let displayText = buildNode("div", {}, isPhoto ? "Alt Text (optional):" : "Display Text");
    let displayInput = buildNode(
        "input",
        {
            type : "text",
            id : "addLinkText",
            value : initialText
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });

    let container = buildNode("div", { id : "mdInsertOverlay" });
    container.appendChild(title);
    container.appendChild(linkText);
    container.appendChild(linkInput);
    container.appendChild(displayText);
    container.appendChild(displayInput);
    if (isPhoto)
    {
        container.appendChild(buildNode("div", {}, "Width and Height (optional)"));
        container.appendChild(buildMarkdownImageDimensionsInput());
    }

    container.appendChild(getLinkOkCancelButtons(isPhoto));

    buildOverlay(true, container);
    $("#addLinkLink").focus();
}

function addPhoto()
{
    addLinkOrPhoto(true /*isPhoto*/);
}

function addLink()
{
    addLinkOrPhoto(false /*isPhoto*/);
}

/// <summary>
/// Surrounds the currently highlighted text with the specific pattern. If nothing is highlighted,
/// add a placeholder value and highlight that.
/// </summary>
function mdSurround(ch)
{
    let comment = $("#newComment");
    let start = comment.selectionStart;
    let end = comment.selectionEnd;
    comment.focus();
    let surround = (start == end) ? "Text" : comment.value.substring(comment.selectionStart, comment.selectionEnd);

    if (document.queryCommandSupported("insertText"))
    {
        // This is deprecated, but it's the only way I've found to do it that supports undo.
        document.execCommand("insertText", false, ch + surround + ch);
    }
    else
    {
        let newText = ch + surround + ch;
        comment.setRangeText(newText);
    }

    comment.setSelectionRange(start + ch.length, start + surround.length + ch.length);

    parseMarkdown();
}

let mdPreview = new Markdown();
function parseMarkdown()
{
    const text = $("#newComment").value;

    logTmi(`Parsing "${text}"`);
    let html = mdPreview.parse(text);
    $("#mdHolder").style.display = (text.length != 0 && mdPreview.markdownPresent) ? "block" : "none";

    // No need to redraw if the content is the same as our last result.
    if (!mdPreview.sameText)
    {
        $("#mdPreview").innerHTML = html;
    }
}

function showMarkdownHelp()
{
    markdownHelp(function(response)
    {
        overlay('<div class="mdHelp">' + response.data + "</div>", "Got It", overlayDismiss, true /*dismissable*/);
    });

}

let selectedSuggestion;

function addNavListener()
{
    document.body.addEventListener("keydown", function(e)
    {
        if (e.target.id && e.target.id.toLowerCase() == "newcomment")
        {
            return;
        }

        if (!e.ctrlKey || (e.which !== 37 && e.which !== 39))
        {
            return;
        }

        logVerbose("Searching for next id");
        let parameters = { type : ProcessRequest.NextRequest, id : reqId(), dir : e.which === 37 ? "0" : "1" };
        let successFunc = function(response)
        {
            if (response.new_id == -1)
            {
                logInfo("No more requests in that direction!");
                return;
            }

            window.location = "request.php?id=" + response.new_id;
        };

        sendHtmlJsonRequest("process_request.php", parameters, successFunc);

    });
}

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
        logInfo(response);
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

function searchForMediaCore()
{
    let parameters = { type : attrInt("requestType"), query : attr("requestName") };
    let successFunc = function(response)
    {
        logInfo(response);
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
    item.appendChild(img);
    item.appendChild(div);

    return item;
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

function goToImdb()
{
    let parameters = { type : attrInt("requestType"), query : this.parentNode.parentNode.getAttribute("tmdbid"), by_id : "true" };
    let successFunc = function(response, request)
    {
        logInfo(response);
        if (response.imdb_id)
        {
            window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank");
        }
        else
        {
            window.open("https://www.themoviedb.org/" + attrInt("requestTypeStr") + "/" + request.tmdbid);
        }
    };
    sendHtmlJsonRequest("media_search.php", parameters, successFunc, null, { tmdbid : this.parentNode.parentNode.getAttribute("tmdbid") });
}

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

function setVisibility(id, visible)
{
    let element = document.getElementById("#" + id);
    if (!element)
    {
        return;
    }

    element.style.visibility = visible ? "visible" : "hidden";
    element.style.height = visible ? "auto" : "0";
}

function chooseSelected()
{
    if (!selectedSuggestion)
    {
        let button = $("#matchContinue");
        let color = new Color(button.getComputedStyle.backgroundColor);
        Animation.queue({ backgroundColor : new Color(100, 66, 69) }, button, 500);
        Animation.queueDelayed({ backgroundColor : color }, button, 500, 500, true);
        return;
    }

    if (!selectedSuggestion.getAttribute("tmdbid"))
    {
        logError("No tmdb id found");
        return;
    }

    let params = { type : ProcessRequest.SetExternalId, req_id : reqId(), id : selectedSuggestion.getAttribute("tmdbid") };

    let successFunc = function(response)
    {
        logInfo(response);
        let matches = $(".matchContinue");

        for (let i = 0; i < matches.length; ++i)
        {
            matches[i].value = "Success! Redirecting...";
        }
        setTimeout(function() { window.location.reload(); }, 1000);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc);
}

function getMediaInfo()
{
    let parameters = { type : attrInt("requestType"), query : attr("externalId"), by_id : "true" };
    let successFunc = function(response)
    {
        logInfo(response);
        buildPage(response);
    };
    let failureFunc = function()
    {
        $("#infoContainer").innerHTML = "Unable to query request information";
    };
    sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
}

function getStatusSpan(status)
{
    let statusSpan = buildNode("span",
        { class : `status${status}` },
        [
            "Pending",
            "Complete",
            "Denied",
            "In Progress",
            "Waiting"
        ][status]);

    if (isAdmin())
    {
        setupSpanDoubleClick(statusSpan);
    }

    return statusSpan;
}

function getNonMediaInfo()
{
    let outerContainer = buildNode("div", { id : "innerInfoContainer" });
    let container = buildNode("div", { id : "mediaDetails" });

    let title = buildNode("div", { id : "mediaTitle" }, `Request: ${attr("requestName")} - `);
    let status = attrInt("requestStatus");
    title.appendChild(getStatusSpan(status));
    container.appendChild(title);

    outerContainer.appendChild(container);
    $("#infoContainer").innerHTML = "";
    $("#infoContainer").appendChild(outerContainer);
}

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

    return buildNode("img", { src : `poster${posterPath}&large=1`, id : "mediaPoster" });
}

function buildRequestExternalLink(request)
{
    let imdb;
    if (request.imdb_id)
    {
        imdb = buildNode("div", { id : "mediaLink" });
        imdb.appendChild(buildNode("a", {
            href : `https://imdb.com/title/${request.imdb_id}`,
            target : "_blank"
        }, "IMDb"));
    }
    else if (request.id)
    {
        imdb = buildNode("div", { id : "mediaLink" });
        imdb.appendChild(buildNode("a", {
            href : `https://www.themoviedb.org/${attr("requestTypeStr")}/${request.id}`,
            target : "_blank"
        }, "TMDb"));
    }

    return imdb;
}

function buildPage(data)
{
    let container = $("#infoContainer");
    container.innerHTML = "";

    let backdrop;
    if (data.backdrop_path)
    {
        backdrop = buildNode("img", {
            src : `https://image.tmdb.org/t/p/original${data.backdrop_path}`,
            id : "mediaBackdrop"
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
    let year = buildNode("div", { id : "mediaYear" }, release.length > 4 ? release.substring(0, 4) : "Unknown Release Date");

    let imdb = buildRequestExternalLink(data);

    let desc = buildNode("div", { id : "mediaOverview" }, data.overview);

    details.appendChild(title);
    details.appendChild(year);
    if (imdb) details.appendChild(imdb);
    details.appendChild(buildNode("hr"));
    details.appendChild(desc);

    innerContainer.appendChild(poster);
    innerContainer.appendChild(details);

    if (backdrop)
    {
        container.appendChild(backdrop);
    }

    container.appendChild(innerContainer);
}

function getNewStatusType(input)
{
    let status = -1;
    let first = input.toLowerCase()[0];
    switch (first)
    {
        case "a":
        case "1":
            status = 1;
            break;
        case "d":
        case "0":
            status = 2;
            break;
        case "p":
            status = 0;
            break;
        case "i":
            status = 3;
            break;
        case "w":
            status = 4;
            break;
        default:
            alert("Invalid status: Must be '(A)pproved' (1), '(D)enied' (0), '(P)ending', '(I)n Progress', or '(W)aiting'");
            break;
    }

    return status;
}

function onStatusDoubleClick()
{
    let status = getNewStatusType(prompt("Data ((A)pproved (1), (D)enied (0), (P)ending, (I)n Progress, or (W)aiting):"));
    if (status == -1)
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
            span.innerHTML = ["Pending", "Approved", "Denied", "In Progress", "Waiting"][status];
        }
    };

    let failureFunc = function()
    {
        alert("Failed to update. See console for details");
    };

    sendHtmlJsonRequest("update_request.php", JSON.stringify(params), successFunc, failureFunc, null, true /*dataIsString*/);
}

function setupSpanDoubleClick(statusSpan)
{
    statusSpan.className += " statusSpan";
    statusSpan.addEventListener("dblclick", onStatusDoubleClick);
}

function getComments()
{
    let params = { type : ProcessRequest.GetComments, req_id : reqId() };
    let successFunc = function(response)
    {
        logInfo(response);
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

function getYesNoOverlayButtons()
{
    let yesButton = buildNode(
        "input",
        {
            type : "button",
            value : "Yes",
            style : "width: 100px; margin-right: 10px; display: inline"
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
            style : "width: 100px; margin-right: 10px; display: inline"
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
    let title = buildNode("h4", {}, "Enable Notifications");
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

    checkHolder.appendChild(check);
    checkHolder.appendChild(checkLabel);

    let buttons = getYesNoOverlayButtons();
    let outerButtonContainer = buildNode("div", { class : "formInput", style : "text-align: center" });
    let buttonContainer = buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" });
    buttonContainer.appendChild(buttons.yes);
    buttonContainer.appendChild(buttons.no);
    outerButtonContainer.appendChild(buttonContainer);

    buildOverlay(true, title, prompt, checkHolder, outerButtonContainer);
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
            overlayDismiss();
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
            overlayDismiss();
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

    logVerbose(`Adding style for ${ele}: ${eleStyle}`);
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
        log("Unexpected start to Markdown CSS. Email notifications will be styled incorrectly.", 0, 0, LOG.Critical);
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

async function addComment()
{
    let comment = $("#newComment");
    let text = comment.value;
    if (text.length === 0)
    {
        logInfo("Not adding comment - no content!");
        return;
    }

    comment.value = "";
    logInfo("Adding comment: " + text);

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

let commentCache = {};
function buildComments(comments)
{
    commentCache = {};
    let container = $("#comments");
    container.innerHTML = "";

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
        setTooltip(date, DateUtil.getFullDate(dateObj) + editTitle);

        commentCache[comment.id] = comment.content;

        // Try the new markdown parser
        let fixedupContent = new Markdown().parse(comment.content);

        let content = buildNode("div", { class : "commentContent md" }, fixedupContent);

        info.appendChild(name);
        info.appendChild(date);

        holder.appendChild(info);
        holder.appendChild(content);

        if (parseInt(comment.editable) == 1)
        {
            let editTools = buildNode("div", { class : "commentEdit", commentId : comment.id });

            editTools.appendChild(commentAction("Edit", editComment));
            editTools.appendChild(commentAction("Delete", confirmDeleteComment));
            holder.appendChild(editTools);
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
        overlay("Something went wrong. Please try again later.", "OK", overlayDismiss);
    }

    let holder = $(`#holder${commentId}`);

    let buttonHolder = buildNode("div", { style : "float: left; padding: 3px" });
    let okay = commentAction("Save", submitCommentEdit);
    let cancel = commentAction("Cancel", function() { dismissEdit(this.getAttribute("commentId")); });
    okay.setAttribute("commentId", commentId);
    cancel.setAttribute("commentId", commentId);
    buttonHolder.appendChild(okay);
    buttonHolder.appendChild(cancel);
    holder.insertBefore(buildNode(
        "hr",
        {
            style : "clear: both; margin: 0; height: 5px; border: none; border-bottom: 1px solid #616161"
        }), holder.children[1]);
    holder.insertBefore(buttonHolder, holder.children[1]);

    let editor = buildNode(
        "textarea",
        { id : "editor" + commentId, class : "commentEditor", placeholder : "Edit comment..." },
        raw,
        {
            change : parseEditMarkdown,
            keyup : parseEditMarkdown
        });

    MarkdownEditor.addTabHandler(editor);
    holder.insertBefore(editor, holder.children[1]);

    editor.style.height = Math.min((editor.scrollHeight + 20), 350) + "px";
    editor.focus();
}

let mdEdit = new Markdown();
let editCur = "";
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
        this.parentNode.$$(".commentContent").innerHTML = html;
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
        overlay(response.Error, "OK", overlayDismiss);
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

    confirmHolder.appendChild(confirm);
    confirmHolder.appendChild(confirmYes);
    confirmHolder.appendChild(confirmMiddle);
    confirmHolder.appendChild(confirmCancel);
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
    logVerbose("Deleting comment " + commentId);

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
        overlay(response.Error, "Okay", overlayDismiss, true /*dismissable*/);
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
    let img = buildNode("img", { src : icons[action.toUpperCase()], title : actionString, alt : actionString });
    let text = buildNode("span", {}, action);
    holder.appendChild(img);
    holder.appendChild(text);
    return holder;
}
