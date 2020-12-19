/// <summary>
/// Home page of the website. Serves as a jumping off point for other actions,
/// as well as displaying currently active streams.
/// </summary>

/// <summary>
/// Main activity interval, checking for stream activity
/// </summary>
let contentUpdater = null;

/// <summary>
/// Intervals for individual streams that are currently playing.
/// Updates the steam progress every second, as our main updater
/// waits 10 seconds between updates.
/// </summary>
let innerProgressTimers = {};

// Easier way to remove DOM elements
Element.prototype.remove = function()
{
    this.parentElement.removeChild(this);
};

NodeList.prototype.remove = HTMLCollection.prototype.remove = function()
{
    for (let i = this.length - 1; i >= 0; i--)
    {
        if (this[i] && this[i].parentElement)
        {
            this[i].parentElement.removeChild(this[i]);
        }
    }
};

/// <summary>
/// Types of queries to get_status. Keep in sync with get_status.php's QueryType
/// </summary.
const QueryType =
{
    AllSessions : 1,
    SingleSession : 2,
    ActiveSessions : 3,
    Progress : 4,
    Status : 5
};

/// <summary>
/// On load, request the active streams (if it's running) and set up the suggestion form handlers
/// </summary>
window.addEventListener("load", function()
{
    // Don't attempt to grab session information if we can't even connect to plex
    if (document.body.getAttribute("plexok") == 1)
    {
        let parameters = { type : QueryType.AllSessions };
        let successFunc = function(response)
        {
            writeSessions(response);
            startUpdates();
        };

        sendHtmlJsonRequest("get_status.php", parameters, successFunc, getStatusFailure);
        getCapacity();
        window.addEventListener("resize", ensureStatHeight);
    }
    else
    {
        $("#activeNum").innerHTML = 0;
    }
});

/// <summary>
/// Ensures the height of the stats div is adjusted properly
/// after the browser window changes size
/// </summary>
function ensureStatHeight()
{
    let stats = $("#libStats");
    if (stats.style.opacity < 1)
    {
        return;
    }

    stats.style.height = "unset";
}

/// <summary>
/// Cache of chart information so we don't have to retrieve it again
/// when building larger/more detailed charts
/// </summary>
let g_chartCache = {};

/// <summary>
/// Make a request to the server to see how much disk space we have left
/// </summary>
function getCapacity()
{
    let successFunc = function(response)
    {
        if (response.total == 0)
        {
            return;
        }

        let space = getFriendlySpace(response);
        let setSpace = (ele, obj) =>
        {
            ele.innerHTML = obj.dec;
            Tooltip.setTooltip(ele, obj.bin);
        };

        setSpace($$("#spaceUsed span"), space.used);
        setSpace($$("#spaceTotal span"), space.total);
        setSpace($$("#spaceRemaining span"), space.free);

        g_chartCache.capacity =
        {
            radius : 70,
            points : [
                { value : response.free, label : "Free" },
                { value : response.total - response.free, label : "Used" }
            ],
            colors : response.free < response.total - response.free ? ["#2e832e", "#a33e3e"] : ["#a33e3e", "#2e832e"],
            title : "Plex Storage",
            noTitle : true
        };

        appendChart(g_chartCache.capacity, "spaceGraph", true /*isPie*/);
        getLibraryDetails();
    };

    sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.FreeSpace }, successFunc);
}

/// <summary>
/// Builds the library details section, indicating how many items are
/// in each library, what what their makeup is
/// </summary>
function getLibraryDetails()
{
    let successFunc = function(response)
    {
        addMovieStats(getStatSection("Movies", response));
        addTvStats(getStatSection("TV Shows", response));
        addMusicStats(getStatSection("Music", response));
        showStatsIcon();
    };

    sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.LibraryStats }, successFunc);
}

/// <summary>
/// Builds the stats section for movies
/// </summary>
function addMovieStats(movies)
{
    if (!movies)
    {
        return;
    }

    createStatSection("movie");
    let piePoints = [];
    let ul = buildNode("ul", { class : "innerStatList" });
    let resolutions = sortResolutions(movies.resolution);
    for (let resolution of resolutions)
    {
        let count = movies.resolution[resolution];
        piePoints.push({ value : parseInt(count), label : resolution });
        ul.appendChild(
            buildNode("li").appendChildren(
                buildNode("strong", {}, `${resolution}: `),
                buildNode("span", {}, count)
            ));
    }

    let list = $$("#movieStats ul");
    let noteText = "Duplicates of different resolutions mean that the<br> numbers below will not add up to this value";
    let movieCount = buildNode("span", {}, movies.Movies + "*");
    Tooltip.setTooltip(movieCount, noteText);
    list.appendChildren(
        buildNode("li").appendChildren(
            buildNode("strong", {}, "Total Movies: "),
            movieCount),
        buildNode("li").appendChild(ul)
    );

    g_chartCache.movies =
    {
        radius : 70,
        points : piePoints,
        labelOptions : { count : true },
        title : "Movie Resolutions",
        noTitle : true
    };

    appendChart(g_chartCache.movies, "movieGraph", true);
}

/// <summary>
/// Return an array of resolutions from highest to lowest resolution
/// </summary>
function sortResolutions(resolutions)
{
    /* eslint-disable quote-props */
    const possibleResolutions = {
        "4k" : 0,
        "1080p" : 1,
        "720p" : 2,
        "480p" : 3,
        "sd" : 4
    };
    /* eslint-enable quote-props */

    let sorted = Object.keys(resolutions);
    sorted.sort(function(left, right)
    {
        left = left.toLowerCase();
        right = right.toLowerCase();
        let leftRank = (left in possibleResolutions) ? possibleResolutions[left] : possibleResolutions;
        let rightRank = (right in possibleResolutions) ? possibleResolutions[right] : possibleResolutions;
        return leftRank - rightRank;
    });

    return sorted;
}

/// <summary>
/// Builds the stats section for TV shows
/// </summary>
function addTvStats(tv)
{
    if (!tv)
    {
        return;
    }

    createStatSection("tv");

    let barPoints = [];
    let ul = buildNode("ul", { class : "innerStatList" });
    for (let type of ["Shows", "Seasons", "Episodes"])
    {
        ul.appendChild(
            buildNode("li").appendChildren(
                buildNode("strong", {}, `${type}: `),
                buildNode("span", {}, tv[type])
            ));
    }
    for (let [rating, count] of Object.entries(tv.contentRating))
    {
        barPoints.push({ value : parseInt(count), label : rating });
    }

    let list = $$("#tvStats ul");
    list.appendChildren(
        buildNode("li").appendChildren(
            buildNode("strong", {}, "TV Shows")),
        buildNode("li").appendChild(ul)
    );

    g_chartCache.tv =
    {
        width : 140,
        height : 100,
        points : barPoints,
        title : "Content Rating",
        noTitle : true,
        sortFn : tvSort
    };

    appendChart(g_chartCache.tv, "tvGraph", false /*isPie*/);
}

/// <summary>
/// Order of TV content ratings in the US. Anything not listed here
/// will go to the end of the content rating chart
/// </summary>
const tvContentRatings = {
    "TV-Y" : 0,
    "TV-Y7" : 1,
    "TV-G" : 2,
    "TV-PG" : 3,
    "TV-14" : 4,
    "TV-MA" : 5
};

const tvContentRatingsMax = 6;

/// <summary>
/// Sorts TV content ratings by their "severity"
/// </summary>
function tvSort(left, right)
{
    let leftRank = (left.label in tvContentRatings) ? tvContentRatings[left.label] : tvContentRatingsMax;
    let rightRank = (right.label in tvContentRatings) ? tvContentRatings[right.label] : tvContentRatingsMax;
    return leftRank - rightRank;
}

/// <summary>
/// Builds the stats section for Music
/// </summary>
function addMusicStats(music)
{
    if (!music)
    {
        return;
    }

    createStatSection("music");

    let barPoints = [];
    let ul = buildNode("ul", { class : "innerStatList" });
    for (let type of ["Artists", "Albums", "Tracks"])
    {
        ul.appendChild(
            buildNode("li").appendChildren(
                buildNode("strong", {}, `${type}: `),
                buildNode("span", {}, music[type])
            ));
    }
    for (let [decade, count] of Object.entries(music.decades))
    {
        barPoints.push({ value : parseInt(count), label : decade });
    }

    let list = $$("#musicStats ul");
    list.appendChildren(
        buildNode("li").appendChildren(
            buildNode("strong", {}, "Music")),
        buildNode("li").appendChild(ul)
    );

    g_chartCache.music =
    {
        width : 140,
        height : 100,
        points : barPoints,
        title : "Decades",
        noTitle : true,
        sortFn : (left, right) => right.label - left.label
    };
    appendChart(g_chartCache.music, "musicGraph", false /*isPie*/);
}

/// <summary>
/// Builds and appends a chart with the given chart data, also including
/// an expansion icon to view a larger version of the chart
/// </summary>
function appendChart(chartData, holderId, isPie)
{
    let chart = isPie ? Chart.pie(chartData) : Chart.bar(chartData);
    chart.classList.add("statGraphSvg");
    let holder = $(`#${holderId}`);
    holder.style.width = (isPie ? chartData.radius * 2 : chartData.width) + "px";
    holder.style.height = (isPie ? chartData.radius * 2 : chartData.height) + "px";
    let expandIcon = buildNode(
        "img",
        { src : Icons.get("expand"), class : "statGraphExpand" },
        0,
        {
            click : function() { buildChartOverlay(chartData); },
            mouseover : function() { this.style.opacity = 1; },
            mouseout : function() { this.style.opacity = 0.7; }
        });
    Tooltip.setTooltip(expandIcon, "View Larger");

    holder.appendChildren(chart, expandIcon);
}

/// <summary>
/// Builds an overlay with a larger version of the chart, scaled to its original bounds
/// </summary>
function buildChartOverlay(chartData)
{
    let radiusSav = -1;
    let widthSav = -1;
    let heightSav = -1;
    if (chartData.radius)
    {
        radiusSav = chartData.radius;
        let newRadius = Math.min(radiusSav * 4, screen.width / 2 - 40);
        chartData.radius = Math.min(newRadius, screen.height / 2 - 200);
    }
    else
    {
        widthSav = chartData.width;
        heightSav = chartData.height;
        let maxWidthScale = (screen.width - 20) / widthSav;
        let maxHeightScale = (screen.height - 20) / heightSav;
        let scale = Math.min(maxWidthScale, maxHeightScale, 3);
        chartData.width = widthSav * scale;
        chartData.height = heightSav * scale;
    }

    let titleSav = !!chartData.noTitle;
    chartData.noTitle = false;
    Overlay.build({ dismissible : true, centered : true },
        buildNode("div").appendChildren(chartData.radius ? Chart.pie(chartData) : Chart.bar(chartData)),
        buildNode("input",
            {
                type : "button",
                id : "overlayBtn",
                value : "Close",
                style : "width: 100px"
            },
            0,
            {
                click : Overlay.dismiss
            }));
    chartData.noTitle = titleSav;

    if (chartData.radius)
    {
        chartData.radius = radiusSav;
    }
    else
    {
        chartData.width = widthSav;
        chartData.height = heightSav;
    }
}

/// <summary>
/// Adds a stats div for a library section
/// </summary>
function createStatSection(name)
{
    $("#libStats").appendChildren(
        buildNode("div", { id : `${name}Stats`, class : "statSection" }).appendChildren(
            buildNode("div", { class : "statList" }).appendChildren(buildNode("ul")),
            buildNode("div", { id : `${name}Graph`, class : "statGraph" })
        )
    );
}

/// <summary>
/// Searches for and returns the desired section of the plex library
/// <summary>
function getStatSection(title, sections)
{
    for (let section of sections)
    {
        if (section.title == title)
        {
            return section;
        }
    }

    return false;
}

/// <summary>
/// Shows the stats icon after we have successfully gathered all required data
/// </summary>
function showStatsIcon()
{
    let stats = buildNode(
        "img",
        {
            style : "width: 20px; cursor: pointer",
            src : Icons.getColor("stats", "2e832e"),
            id : "showStatsBtn"
        },
        0,
        {
            click : showHideStats,
            mouseover : function() { this.src = Icons.getColor("stats", "80A020"); },
            mouseout : function() { this.src = Icons.getColor("stats", "2e832e"); },
        }
    );
    Tooltip.setTooltip(stats, "Show Plex Stats", 250 /*delay*/, true /*static*/);
    $("#header").appendChildren(stats);
}

/// <summary>
/// Takes a list of byte sizes and returns an object containing
/// nicer sizes in decimal and binary form
/// </summary>
function getFriendlySpace(response)
{
    let decimal = ["KB", "MB", "GB", "TB"];
    let binary = ["KiB", "MiB", "GiB", "TiB"];
    let reduceCore = (value, base, arr) =>
    {
        let idx = -1;
        while (value >= base)
        {
            value /= base;
            ++idx;
        }

        return value.toFixed(2) + " " + (idx == -1 ? "" : arr[idx]);
    };

    let reduceSize = (value) => ({ dec : reduceCore(value, 1000, decimal), bin : reduceCore(value, 1024, binary) });

    let space =
    {
        total : reduceSize(response.total),
        free : reduceSize(response.free),
        used : reduceSize(response.total - response.free)
    };

    return space;
}

/// <summary>
/// Shows or hides the library stats table
/// </summary>
function showHideStats()
{
    let stats = $("#libStats");
    let hidden = stats.classList.contains("hideStats");
    stats.classList.add(hidden ? "showStats" : "hideStats");
    stats.classList.remove(hidden ? "hideStats" : "showStats");
    if (hidden)
    {
        Tooltip.setText($("#showStatsBtn"), "Hide Plex Stats");
        Animation.fireNow({ opacity : 1, height : $("#libStats").scrollHeight + "px" }, $("#libStats"), 250, false);
    }
    else
    {
        Tooltip.setText($("#showStatsBtn"), "Show Plex Stats");
        Animation.fireNow({ opacity : 0, height : "0px" }, $("#libStats"), 250, false);
    }
}

/// <summary>
/// Function invoked when we fail to grab status information
/// due to permission issues
/// </summary>
function getStatusFailure(response)
{
    let httpError = response.Error == "HTTPError";

    // User doesn't have access to active streams, or something went wrong when getting the stream status
    let requestText = httpError ? "Error getting activity" : "No Access";
    let requestLink = buildNode("a", { href : "#", id : "streamAccess" }, requestText);

    if (!httpError)
    {
        getStreamAccessString();
    }

    let active = $("#activeNum");
    active.innerHTML = "";
    active.append(buildNode("span", {}, "["));
    active.append(requestLink);
    active.append(buildNode("span", {}, "]"));
}

/// <summary>
/// Sets the string if the user does not have authorization to view active streams
/// 'Request Pending' if the user has requested access, 'Request Access' if access
/// has not been requested.
/// </summary>
function getStreamAccessString()
{
    let parameters =
    {
        type : ProcessRequest.PermissionRequest,
        req_type : 10,
        which : "get"
    };

    let successFunc = function(response)
    {
        const canRequest = response.value == "Request Access";
        let streamAccess = $("#streamAccess");
        streamAccess.innerHTML = response.value;
        if (response.id)
        {
            streamAccess.href = "request.php?id=" + response.id;
        }

        if (canRequest)
        {
            // Need to request access
            streamAccess.addEventListener("click", showStreamAccessOverlay);
        }

        if (response.value == "Request Denied")
        {
            streamAccess.innerHTML = "<a href='requests.php'>Request Denied</a>";
        }
    };

    let failureFunc = function(response)
    {
        if (response.Error == "Not Authorized" && !$("#goToLogin"))
        {
            showRestartSessionOverlay();
        }
        else
        {
            $("#streamAccess").innerHTML = "Error getting stream permissions";
        }
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// When the user requests access to view active streams, surface an overlay asking them to
/// add a comment about who they are before submitting the request
/// </summary>
function showStreamAccessOverlay()
{
    let message = buildNode("div", {}, "Add a message for the admins to let them know who you are (optional)");
    let textbox = buildNode("textarea",
        { maxlength : "1024" },
        0,
        {
            keydown : function(e)
            {
                if (e.keyCode == KEY.ENTER && e.ctrlKey)
                {
                    $("#requestButton").click();
                }
            }
        });

    let button = buildNode(
        "input",
        {
            type : "button",
            id : "requestButton",
            value : "Request"
        },
        0,
        {
            click : requestStreamAccess
        });

    Overlay.build({ dismissible : true, centered : false }, message, textbox, button);
}

/// <summary>
/// Updates the access string after the user requests access to stream information
/// </summary>
function requestStreamAccess()
{
    let parameters =
    {
        type : ProcessRequest.PermissionRequest,
        req_type : 10,
        which : "req",
        msg : $("#overlayContainer textarea")[0].value
    };

    let successFunc = function(response)
    {
        let overlay = $("#mainOverlay");
        if (overlay)
        {
            Animation.queue({ backgroundColor : "rgba(0,25,0,0.5)" }, overlay, 500);
            Animation.queueDelayed({ backgroundColor : "rgba(0,0,0,0.5)", opacity : "0" }, overlay, 500, 500, true);
        }

        const alreadyPending = (response.value == "0");
        $("#streamAccess").innerHTML = alreadyPending ? "Request Already Pending" : "Access Requested!";
    };

    let failureFunc = function(/*response*/)
    {
        if ($("#mainOverlay")) document.body.removeChild($("#mainOverlay"));
        $("#streamAccess").innerHTML = "Error processing request";
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Build a mediainfo element for each session in the given sessions and append it to the DOM
/// </summary>
function writeSessions(activeSessions)
{
    for (let i = 0; i < activeSessions.length; ++i)
    {
        $("#mediaentries").appendChild(buildMediaInfo(activeSessions[i]));
    }

    writeTitle(activeSessions);

    $("#activeNum").innerHTML = activeSessions.length;
    updateTotalBitrate();
    let active = $("#activeText");
    active.addEventListener("mousemove", showTotalBitrateTooltip);
    active.addEventListener("mouseout", Tooltip.dismiss);
}

/// <summary>
/// Write the number of active streams to the titlebar
/// </summary>
function writeTitle(streams)
{
    let playing = 0;
    let paused = 0;

    for (let i = 0; i < streams.length; ++i)
    {
        if (streams[i].paused)
        {
            ++paused;
        }
        else
        {
            ++playing;
        }
    }


    let prepend = "";
    if (playing > 0)
    {
        prepend = `${playing}&#9205; - `;
    }

    if (paused > 0)
    {
        prepend += `${paused} &#10073;&#10073; - `;
    }

    $("title")[0].innerHTML = prepend + "Plex Status";
}

let requestInProgress = false;
/// <summary>
/// Starts our timer to update sessions every 10 seconds
/// </summary>
function startUpdates()
{
    contentUpdater = setInterval(function()
    {
        // If we have a request already in progress, wait for it to return.
        // Slow connections can cause two or more responses that both say
        // "add this session", and if the timing is right we add multiple
        // entries for the same session
        if (requestInProgress)
        {
            return;
        }

        requestInProgress = true;
        let parameters = { type : QueryType.Progress };
        let successFunc = function(response)
        {
            processUpdate(response);
            requestInProgress = false;
        };

        let failureFunc = function(response)
        {
            if (response.Error == "Not Authorized" && !$("#goToLogin"))
            {
                clearInterval(contentUpdater);
                showRestartSessionOverlay();
            }
            requestInProgress = false;
        };

        sendHtmlJsonRequest("get_status.php", parameters, successFunc, failureFunc);
    }, 10000);
}

/// <summary>
/// If we've detected that our session has expired ('Not Authorized' from get_status),
/// surface a non-dismissible overlay asking the user to log in again
/// </summary>
function showRestartSessionOverlay()
{
    let message = buildNode("div", {}, "Your session has expired, please log in again");
    let button = buildNode(
        "input",
        {
            type : "button",
            id : "goToLogin",
            value : "OK",
            style : "width: 100px"
        },
        0,
        {
            click : () => { window.location = "login.php"; }
        });
    Overlay.build({ dismissible : false, centered : false }, message, button);
    $("#goToLogin").focus();
}

/// <summary>
/// Updates the progress of the current stream and adjusts the play/pause icon as necessary
/// </summary>
function updateSessionProgress(item, sesh, id)
{
    // The stream already exists - update the progress
    item.$$(".time").innerHTML = msToHms(sesh.progress) + "/" + msToHms(sesh.duration);
    item.$$(".progressHolder").setAttribute("progress", sesh.progress);
    item.$$(".progressHolder").setAttribute("tcprogress", "transcode_progress" in sesh ? sesh.transcode_progress : 0);

    let ppbutton = item.$$(".ppbutton");

    if (sesh.paused)
    {
        // Transcode progress may still be updated, so do a one-off here
        innerUpdate(id);
        ppbutton.classList.remove("play");
        ppbutton.classList.add("pause");
        ppbutton.innerHTML = "&#10073;&#10073;  ";
    }
    else
    {
        ppbutton.classList.remove("pause");
        ppbutton.classList.add("play");
        ppbutton.innerHTML = "&#x25ba;  ";
    }

    if (sesh.paused && innerProgressTimers[id])
    {
        clearInterval(innerProgressTimers[id]);
        delete innerProgressTimers[id];
    }
    else if (!sesh.paused && !innerProgressTimers[id])
    {
        // Create a new timer to simulate progress while we wait for an actual update
        innerProgressTimers[id] = setInterval(innerUpdate, 1000, id);
    }
}

/// <summary>
/// Process our update response. Add/remove, reorder, switch between playing/paused
/// </summary>
function processUpdate(sessions)
{
    $("#activeNum").innerHTML = sessions.length;

    // Moving existingSessions to an actual array makes it easier to .splice() below
    let existingSessions = $(".mediainfo");
    let existingArray = [];
    for (let i = 0; i < existingSessions.length; ++i)
    {
        existingArray.push(existingSessions[i]);
    }

    existingSessions = existingArray;

    // The new order our elements should be in
    let newOrder = [];

    // Any new session ids that we need to retrieve stream information for
    let newIds = [];

    // Sort our sessions so we can later reorder them in the list if necessary
    sessions = sessions.sort(sessionSort);

    for (let i = 0; i < sessions.length; ++i)
    {
        let sesh = sessions[i];
        let id = sesh.id;
        let item = $("#id" + id);
        if (item)
        {
            updateSessionProgress(item, sesh, id);
            newOrder.push(item);
        }
        else
        {
            // Add it to our pending queue (with another ajax request)
            newIds.push(id);
        }
    }

    trimSessions(sessions, existingSessions);
    reorderSessions(newOrder, existingSessions);
    addNewSessions(newIds);
    writeTitle(sessions);
}

/// <summary>
/// Remove existing sessions from the DOM if they're not in our new session list
/// </summary.
function trimSessions(newSessions, existingSessions)
{
    // O(n^2), but if I have enough streams to point where this matters, I have other problems
    for (let i = 0; i < existingSessions.length; ++i)
    {
        let session = existingSessions[i];
        let found = false;
        for (let j = 0; j < newSessions.length; ++j)
        {
            if (newSessions[j].id === session.id.substring(2)) // Substring to remove the 'id' that we add
            {
                found = true;
                break;
            }
        }

        if (!found)
        {
            // An existing session is no longer active, remove it
            Log.info("Attempting to remove session " + session.id);

            if ($("#" + session.id + " .progressHolder")[0].hasAttribute("hovered"))
            {
                // If this is the currently hovered item, make sure we remove the tooltip,
                // otherwise it won't go away until another progress bar is hovered
                Tooltip.dismiss();
            }

            $("#" + session.id).remove();
            existingSessions.splice(i /*index*/, 1 /*howMany*/);
            --i;
        }
    }

    updateTotalBitrate();
}

/// <summary>
/// Reorder sessions in the active list if necessary
/// </summary>
function reorderSessions(newOrder, existingSessions)
{
    let needsReorder = false;
    if (newOrder.length == existingSessions.length)
    {
        // Same number of requests, but we still have to match up each one
        for (let i = 0; i < existingSessions.length; ++i)
        {
            if (existingSessions[i] != newOrder[i])
            {
                needsReorder = true;
                break;
            }
        }
    }
    else
    {
        needsReorder = true;
    }

    if (needsReorder)
    {
        for (let i = newOrder.length - 1; i >= 0; --i)
        {
            newOrder[i].parentElement.insertBefore(newOrder[i], newOrder[i].parentElement.firstChild);
        }
    }
}

/// <summary>
/// Sort function for sessions. Playing items are always before paused ones. Order by time remaining from there
/// </summary>
function sessionSort(sessionA, sessionB)
{
    if (sessionA.paused != sessionB.paused)
    {
        return sessionA.paused ? 1 : -1;
    }

    return (sessionA.duration - sessionA.progress) - (sessionB.duration - sessionB.progress);
}

/// <summary>
/// Simulate playback for items that are marked as playing. We only get updates from the
/// server every 10 seconds, so pretend like we're getting updates in the meantime
/// </summary>
function innerUpdate(sesh, addTime=true)
{
    let element = $("#id" + sesh);
    if (!element)
    {
        // We've lost our element! remove it from the active timers
        clearInterval(innerProgressTimers[sesh]);
        delete innerProgressTimers[sesh];
        return;
    }

    const addedTime = addTime ? 1000 : 0;
    let progressHolder = element.$$(".progressHolder");
    let newMsProgress = parseInt(progressHolder.getAttribute("progress")) + addedTime;
    const msDuration = parseInt(progressHolder.getAttribute("duration"));
    let tcprogress = parseFloat(progressHolder.getAttribute("tcprogress"));
    if (newMsProgress > msDuration)
    {
        // Don't go over the end of the stream!
        newMsProgress = msDuration;
    }

    const newHms = msToHms(newMsProgress);
    let time = element.$$(".time");
    const newTimeStr = newHms + "/" + time.innerHTML.split("/")[1];

    const newProgress = (newMsProgress / msDuration) * 100;
    element.$$(".progress").style.width = newProgress + "%";
    if (tcprogress - newProgress < 0)
    {
        tcprogress = newProgress;
    }

    element.$$(".tcdiff").style.width = (tcprogress - newProgress) + "%";
    element.$$(".remaining").style.width = (100 - tcprogress) + "%";
    Log.tmi(`${sesh} - Progress: ${newProgress}; TC: ${tcprogress}; Remaining: ${100 - tcprogress}`);
    time.innerHTML = newTimeStr;
    progressHolder.setAttribute("progress", newMsProgress);

    // Only update the tooltip if it's actually active
    if (progressHolder.hasAttribute("hovered") && Tooltip.active())
    {
        progressHoverTooltip(progressHolder, null /*event*/);
    }
}

/// <summary>
/// Retrieve the stream information for the given ids and add them to the DOM in the correct position
/// </summary>
function addNewSessions(newIds)
{
    for (let i = 0; i < newIds.length; ++i)
    {
        const id = newIds[i];
        Log.info("Attempting to add session " + id);
        let parameters =
        {
            type : QueryType.SingleSession,
            id : id
        };
        sendHtmlJsonRequest("get_status.php", parameters, addSession);
    }
}

/// <summary>
/// When hovering over the number of active streams, snow a tooltip
/// indicating the total bitrate of all playing items
/// </summary>
function showTotalBitrateTooltip(e)
{
    let bitrate = $("#active").getAttribute("bitrate");
    if (bitrate == 0)
    {
        return;
    }

    Tooltip.showTooltip(e, `Total Bitrate: ${bitrate} kbps`);
}

/// <summary>
/// Updates the total bitrate of active streams
/// </summary>
function updateTotalBitrate()
{
    const currentSessions = $(".mediainfo");
    if (currentSessions.length == 0)
    {
        $("#active").setAttribute("bitrate", 0);
    }

    let totalBitrate = 0;
    currentSessions.forEach(function(session)
    {
        let lis = session.$("li");
        totalBitrate += parseInt(lis[lis.length - 1].$$("span").innerHTML.match(/(\d+) kbps/)[0]);
    });

    $("#active").setAttribute("bitrate", totalBitrate);
}

/// <summary>
/// Callback method that creates a new session from the given response
/// </summary>
function addSession(response)
{
    const currentSessions = $(".mediainfo");
    if (currentSessions.length === 0)
    {
        // No active streams in our current session list. Add it
        $("#mediaentries").append(buildMediaInfo(response));
        return;
    }

    // If we have existing sessions, find its place in the list
    for (let i = 0; i < currentSessions.length; ++i)
    {
        if ((!response.paused && currentSessions[i].$$(".ppbutton").classList.contains("pause")) ||
            (response.progress / response.duration) * 100 < parseFloat(currentSessions[i].$$(".progress").style.width))
        {
            // Found our position if this item is playing and the next is paused, or this item has less
            // time to completion.
            currentSessions[i].parentElement.insertBefore(buildMediaInfo(response), currentSessions[i]);
            break;
        }
        else if (i === currentSessions.length - 1)
        {
            // This item belongs at the end of the list
            $("#mediaentries").append(buildMediaInfo(response));
        }
    }

    updateTotalBitrate();
}

/// <summary>
/// Returns a container for an active stream entry
/// </summary>
function getContainerNode(sesh)
{
    const posterColors = sesh.art_colors;
    const makeDarker = posterColors.red + posterColors.green + posterColors.blue > 500;
    const opacity = makeDarker ? 0.6 : 0.4;
    return buildNode("div",
        {
            class : "mediainfo" + (makeDarker ? " darkerposter" : ""),
            id : `id${sesh.session_id}`,
            style : `background-image : linear-gradient(rgba(0,0,0,${opacity}),rgba(0,0,0,${opacity})), url(${sesh.art_path})`
        },
        0,
        {
            // Darken/lighten the background when entering/leaving the entry
            mouseenter : function(e)
            {
                let style = e.target.style.backgroundImage;
                let newOpacity = e.target.classList.contains("darkerposter") ? 0.8 : 0.6;
                const newStyle = `linear-gradient(rgba(0,0,0,${newOpacity}), rgba(0,0,0,${newOpacity})),${style.substring(style.indexOf(" url("))}`;
                e.target.style.backgroundImage = newStyle;
            },
            mouseleave : function(e)
            {
                let style = e.target.style.backgroundImage;
                let newOpacity = e.target.classList.contains("darkerposter") ? 0.6 : 0.4;
                const newStyle = `linear-gradient(rgba(0,0,0,${newOpacity}), rgba(0,0,0,${newOpacity})), ${style.substring(style.indexOf(" url("))}`;
                e.target.style.backgroundImage = newStyle;
            }
        });
}

/// <summary>
/// Returns the path to the icon to display in the active stream's
/// title, or an empty string if no relevant icon is found
/// </summary>
function getInlineIconForTitle(mediaType, hover)
{
    let color = hover ? "40a040" : "50c050";
    switch (mediaType)
    {
        case "TV Show":
            return Icons.getColor("tvicon", color);
        case "Movie":
            return Icons.getColor("movieicon", color);
        case "Music":
            return Icons.getColor("musicicon", color);
        case "Audiobook":
            return Icons.getColor("audiobookicon", color);
        default:
            return "";
    }
}

/// <summary>
/// Return the browser tooltip for the active stream title,
/// which will take the user to an external site
/// </summary>
function getExternalLinkTitle(hyperlink)
{
    hyperlink = hyperlink.toLowerCase();
    if (hyperlink.indexOf(document.body.getAttribute("plex_host")) != -1)
    {
        return "View on Plex";
    }

    if (hyperlink.indexOf("imdb") != -1)
    {
        return "View on IMDb";
    }

    if (hyperlink.indexOf("themoviedb") != -1)
    {
        return "View on The Movie Database";
    }

    if (hyperlink.indexOf("tvdb") != -1)
    {
        return "View on TVDb";
    }

    if (hyperlink.indexOf("audible") != -1)
    {
        return "View on Audible";
    }

    return "";
}

/// <summary>
/// Creates the title for an active stream. The title will be a link
/// that either navigates to plex or some other external website.
/// Common stream types (movie/tv/music/audiobook) also adds an icon
/// indicating the stream type
/// </summary>
function buildActiveStreamTitle(sesh)
{
    // Link to plex. If no link is available, try linking to the external source
    const attr = (attribute) => document.body.getAttribute(attribute);
    let hyperlink;
    if (sesh.plex_key)
    {
        hyperlink = `${attr("plex_host")}/${attr("plex_nav")}/server/${sesh.machine_id}/details?key=${encodeURIComponent(sesh.plex_key)}`;
    }
    else
    {
        hyperlink = sesh.hyperlink;
    }

    let link = buildNode("a", { href : hyperlink, target : "_blank", rel : "noreferrer", title : getExternalLinkTitle(hyperlink) });
    link.appendChild(buildNode("span",
        { class : `ppbutton  ${sesh.paused ? "pause" : "play"}` },
        sesh.paused ? "&#10073;&#10073;  " : "&#x25ba;  "));

    link.appendChild(buildNode("span", {}, `${sesh.title}`));

    let inlineIconSrc = getInlineIconForTitle(sesh.media_type, false /*hover*/);

    if (inlineIconSrc)
    {
        link.appendChild(buildNode("img", {
            class : "inlineIcon",
            src : inlineIconSrc,
            alt : sesh.media_type
        }));

        link.addEventListener("mouseover", function() { inlineHover(this, true /*hovered*/); });
        link.addEventListener("mouseout", function() { inlineHover(this, false /*hovered*/); });
    }

    return link;
}

/// <summary>
/// Sets the svg icon source for the given link
/// i.e. changes the color based on the hover state
/// </summary>
function inlineHover(link, hovered)
{
    let icon = link.$$("img");
    icon.src = getInlineIconForTitle(icon.getAttribute("alt"), hovered);
}

/// <summary>
/// Map of streams to all their parts
/// There should only be multiple parts if there are multiple versions of a particular stream
/// </summary>
let allParts = {};

/// <summary>
/// Builds the bottom progress bar of an active stream.
/// Direct plays show only the current progress.
/// Transcodes have an additional bar indicating transcode progress
/// </summary>
function buildActivityProgress(sesh)
{
    let tcprogress = "transcode_progress" in sesh ? sesh.transcode_progress : 0;
    let progressHolder = buildNode("div",
        {
            class : "progressHolder",
            progress : sesh.progress,
            duration : sesh.duration,
            tcprogress : tcprogress,
            part_id : sesh.session_id
        },
        0,
        {
            mousemove : progressHover,
            mouseleave : function()
            {
                this.removeAttribute("hovered");
                Tooltip.dismiss();
            }
        });

    // The poor man's locking - have a flag for whether the part is locked
    allParts[sesh.session_id] = { parts : sesh.parts, locked : false };

    const progressPercent = (sesh.progress / sesh.duration * 100);
    let progress = buildNode("div", { class : "progress", style : `width: ${progressPercent}%` });

    if (tcprogress < progressPercent)
    {
        tcprogress = progressPercent;
    }

    let transcodeDiff = buildNode("div", { class : "tcdiff", style : `width: ${tcprogress - progressPercent}%` });

    let remaining = buildNode("div", { class : "remaining", style : `width: ${(100 - tcprogress)}%` });

    let time = buildNode("div", { class : "time" }, `${msToHms(sesh.progress)}/${msToHms(sesh.duration)}`);

    return progressHolder.appendChildren(progress, transcodeDiff, remaining, time);
}

/// <summary>
/// Builds a list of the details of a given stream, including
/// release date and audio/video quality information. Administrators
/// get more details, like the user watching, IP address, and playback device
/// </summary>
function buildActiveStreamDetailsList(sesh, title)
{
    let list = buildNode("ul");
    if (!title.$$("img"))
    {
        list.appendChild(getListItem("Media type", sesh.media_type));
    }

    if (sesh.album) // Special handling for music
    {
        list.appendChild(getListItem("Album", sesh.album));
    }

    const date = new Date(sesh.release_date);
    const dateOpts = { year : "numeric", month : "long", day : "numeric" };
    list.appendChild(getListItem("Release Date", date.toLocaleDateString("en-US", dateOpts)));
    list.appendChild(getListItem("Playback Device", sesh.playback_device));

    if (sesh.user)
    {
        list.appendChild(getListItem("User", sesh.user));
    }

    if (sesh.ip)
    {
        let ipId = sesh.session_id + "_ip";
        if (sesh.ip.toLowerCase().startsWith("::ffff:"))
        {
            sesh.ip = sesh.ip.substring(7);
        }

        list.appendChild(getListItem("IP", sesh.ip, ipId));
        getIPInfo(sesh.ip, ipId);
    }

    if (sesh.video)
    {
        list.appendChildren(getListItem("Video", getVideoString(sesh.video)));
    }

    list.appendChild(getListItem("Audio", getAudioString(sesh.audio)));
    if (sesh.subtitle)
    {
        list.appendChild(getListItem("Subtitle", `${sesh.subtitle.language} - ${sesh.subtitle.extended_title}`));
    }

    if (sesh.video)
    {
        // If we have audio and video, also include the total bitrate
        let bitrate = (sesh.audio ? sesh.audio.bitrate : 0) + (sesh.video.bitrate);
        list.appendChild(getListItem("Total bitrate", bitrate + " kbps"));
    }

    return list;
}

/// <summary>
/// Builds the main content for a given active stream
/// </summary>
function buildActiveStreamDetails(sesh)
{
    let details = buildNode("div", { class : "details" });
    let title = buildActiveStreamTitle(sesh);
    return details.appendChildren(title, buildActiveStreamDetailsList(sesh, title));
}

/// <summary>
/// Builds the poster element for an active stream. Clicking
/// the poster will navigate to an external site (e.g. imdb)
/// </summary>
function buildActiveStreamPoster(sesh)
{
    let poster = buildNode(
        "img",
        {
            src : sesh.thumb_path,
            style : "width: 100px",
            alt : "thumbnail"
        });

    if (!sesh.hyperlink)
    {
        return poster;
    }

    let rating;
    if (sesh.imdb_rating)
    {
        rating = buildNode("div", { class : "mediaLink imdbLink", title : "View on IMDb" });
        rating.appendChildren(
            buildNode(
                "img",
                {
                    src : Icons.get("imdb"),
                    alt : "IMDb"
                }
            ),
            buildNode("span", { id : "imdbRating" }, sesh.imdb_rating)
        );
    }

    let externalLink = buildNode(
        "a",
        {
            href : sesh.hyperlink,
            target : "_blank",
            rel : "noreferrer",
            title : getExternalLinkTitle(sesh.hyperlink)
        },
        0,
        {
            mouseenter : () => {},
            mouseleave : () => {}
        });

    if (rating)
    {
        return externalLink.appendChildren(poster, rating);
    }

    return externalLink.appendChildren(poster);
}

/// <summary>
/// Returns a mediainfo element based on the given session
/// </summary>
function buildMediaInfo(sesh)
{
    // Main container
    Log.verbose(sesh, "Adding Session");
    let container = getContainerNode(sesh);

    const innerHolder = buildNode("div", { class : "innerHolder" });

    // Album/poster thumb
    let thumbholder = buildNode("div", { class : "thumbholder" });

    // Clicking on the image will go to an external site (imdb/tmdb/audible)
    thumbholder.appendChild(buildActiveStreamPoster(sesh));

    // Details
    let details = buildActiveStreamDetails(sesh);

    // Progress indicator at the bottom of the container
    let progressHolder = buildActivityProgress(sesh);

    innerHolder.append(thumbholder);
    innerHolder.append(details);
    container.append(innerHolder);
    container.append(progressHolder);

    // Event to simulate play progress. Updates only come in every 10 seconds, so pretend like we're updating every second
    if (!sesh.paused)
    {
        innerProgressTimers[sesh.session_id] = setInterval(innerUpdate, 1000, sesh.session_id);
    }

    return container;
}

/// <summary>
/// Returns a formatted list item in the form of "key: value"
/// </summary>
function getListItem(key, value, id)
{
    return buildNode("li", id ? { id : id } : {}).appendChildren(
        buildNode("strong", {}, `${key}: `),
        buildNode("span", {}, value)
    );
}

/// <summary>
/// Grab the geo information for the given ip, adding it as list item after the
/// IP address entry in the media info. It probably isn't super necessary to
/// have this as a separate API call, but making any calls to external API's
/// async to the main get_status call will make things a bit more responsive.
/// </summary>
/// <param name="id">The geo information will be inserted after this id</param>
function getIPInfo(ip, id)
{
    let parameters =
    {
        type : ProcessRequest.GeoIP,
        ip : ip
    };

    let successFunc = function(response, request)
    {
        const locString = ` (${response.city}, ${response.state})`;
        const ispInfo = getListItem("ISP", response.isp);
        let ipItem = $("#" + request.attachId);
        ipItem.innerHTML += locString;
        ipItem.parentNode.insertBefore(ispInfo, ipItem.nextSibling);
    };

    // Values that we'll append to our http object directly
    let attachedParameters = { attachId : id };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, undefined /*failFunc*/, attachedParameters);
}

/// <summary>
/// Shows a tooltip when hovering over the transcode progress
/// </summary>
function progressHover(e)
{
    this.setAttribute("hovered", true);
    progressHoverTooltip(this, e);
}

/// <summary>
/// Updates the progress hover tooltip contents, or, if the tooltip is not
/// active, creates and shows the progress hover tooltip
/// </summary>
function progressHoverTooltip(element, event)
{
    let sentinel = $("#ttRemaining");
    if (!Tooltip.active() || !sentinel)
    {
        Tooltip.showTooltip(event, getHoverText(element));
        return;
    }

    const msRemaining = parseInt(element.getAttribute("duration")) - parseInt(element.getAttribute("progress"));
    const progress = element.children[0].style.width;
    let tooltip = $("#tooltip");

    $("#ttRemaining").innerHTML = msToHms(msRemaining);
    $("#ttProgress").innerHTML = parseFloat(progress).toFixed(2) + "%";

    updateTranscodeTooltip(tooltip, progress, element);

    if (element.parentElement.id in noPreviewThumbs)
    {
        let thumbHolder = $("#previewThumbnailHolder");
        if (thumbHolder)
        {
            thumbHolder.style.display = "none";
        }
    }
    else
    {
        addPreviewThumbnail(element, tooltip);
    }

    if (event && Tooltip.active())
    {
        Tooltip.updatePosition(event.clientX, event.clientY);
    }
}

function updateTranscodeTooltip(tooltip, progress, element)
{
    const tcprogress = parseFloat(element.getAttribute("tcprogress")).toFixed(2);
    let ttTranscode = $("#ttTranscode");

    // The most dynamic part of this tooltip is based on whether the stream is a direct play or a transcode.
    // The following accounts for any switches between the two
    if (tcprogress > 0 && ttTranscode) // Still a transcode
    {
        ttTranscode.innerHTML = tcprogress + "%";
        $("#ttBuffer").innerHTML = (tcprogress - parseFloat(progress)).toFixed(2) + "%";
    }
    else if (tcprogress > 0 && !ttTranscode) // Was direct, now transcode
    {
        $("#ttDirect").remove();
        tooltip.children[tooltip.children.length - 1].remove();
        tooltip.appendChildren(
            hoverFormat("Transcoded", tcprogress + "%", "ttTranscode"),
            buildNode("br"),
            hoverFormat("Buffer", (tcprogress - parseFloat(progress)).toFixed(2) + "%", "ttBuffer"),
            buildNode("br")
        );
    }
    else if (tcprogress <= 0 && ttTranscode) // Was transcode, now direct
    {
        $("#ttTranscode").parentElement.remove();
        $("#ttBuffer").parentElement.remove();
        tooltip.children[tooltip.children.length - 1].remove();
        tooltip.children[tooltip.children.length - 1].remove();
        tooltip.appendChildren(buildNode("span", {}, "Direct Play", "ttDirect"), buildNode("br"));
    }
    // Only other case is that we're still a direct stream, in which case there's nothing to do
}

/// <summary>
/// Adds or update the live preview thumbnail for the given stream
/// <summary>
function addPreviewThumbnail(holder, attach)
{
    let partId = holder.getAttribute("part_id");
    let parts = allParts[partId];
    if (!parts || !parts.parts || parts.parts.length == 0)
    {
        return;
    }

    parts = parts.parts;

    // Let's try the first part
    let part = parts[0];
    let partProgress = holder.getAttribute("progress");
    let partPath = encodeURIComponent(`/library/parts/${part}/indexes/sd/${partProgress}`);
    let previewThumbPath = `preview_thumbnail.php?path=${partPath}`;
    let previewImage = attach.$("#previewThumbnail");
    if (previewImage)
    {
        // Only update the source if it's actually different from the original
        if (previewImage.src.indexOf(previewThumbPath) == -1)
        {
            Log.tmi(`Getting new thumb path. Was ${previewImage.src}. Now ${previewThumbPath}`);
            previewImage.src = previewThumbPath;
        }
    }
    else
    {
        // First retrieval of the live preview thumbnail. Attach the image element to the tooltip
        attach.appendChild(
            buildNode(
                "span",
                { id : "previewThumbnailHolder" }
            ).appendChildren(buildNode(
                "img",
                {
                    id : "previewThumbnail",
                    src : previewThumbPath,
                    height : "100px",
                    parentId : holder.parentElement.id,
                    partId : partId,
                    progress : partProgress
                },
                0,
                {
                    load : thumbnailSuccess,
                    error : thumbnailError
                })
            )
        );
    }
}

/// <summary>
/// On a successful thumbnail load, unlock the parts dictionary
/// </summary>
function thumbnailSuccess()
{
    let id = this.getAttribute("partId");
    if (allParts[id])
    {
        allParts[id].locked = false;
    }
}

/// <summary>
/// Handler for when we fail to load a part thumbnail.
/// If a stream only has a single part, do not attempt to load any more thumbnail for the
/// remainder of the session. However, if there are multiple parts, check to see if the other
/// parts have thumbnails before giving up
/// </summary>
function thumbnailError()
{
    let id = this.getAttribute("partId");
    Log.verbose("Looking for additional parts for " + id);
    let parts = allParts[id];
    if (parts && parts.locked)
    {
        Log.verbose("Parts are locked, don't do anything!");
        return;
    }

    if (parts && parts.parts.length > 1)
    {
        parts.locked = true;
        parts = parts.parts;
        Log.verbose(`Unable to find thumbnail for part ${parts[0]}, switching to ${parts[1]}`);
        parts.shift();
        let newPart = parts[0];
        let progress = this.getAttribute("progress");
        let newPath = encodeURIComponent(`/library/parts/${newPart}/indexes/sd/${progress}`);
        this.src = `preview_thumbnail.php?path=${newPath}`;
        return;
    }

    parts.locked = false;
    this.parentNode.style.display = "none";
    let parentId = this.getAttribute("parentId");
    if (!(parentId in noPreviewThumbs))
    {
        Log.verbose("No thumbnails found. Adding " + parentId + " to ignore list");
        noPreviewThumbs[this.getAttribute("parentId")] = true;
    }
}

/// <summary>
/// Set of stream IDs that don't have live preview thumbnails
/// </summary>
let noPreviewThumbs = {};

/// <summary>
/// Gets the hover text for the given element (must be of class progressHolder)
/// </summary>
function getHoverText(element)
{
    let tcString = buildNode("div");
    const msRemaining = parseInt(element.getAttribute("duration")) - parseInt(element.getAttribute("progress"));
    tcString.appendChildren(hoverFormat("Remaining", msToHms(msRemaining), "ttRemaining"), buildNode("br"));

    const progress = element.children[0].style.width;
    const tcprogress = parseFloat(element.getAttribute("tcprogress")).toFixed(2);
    tcString.appendChildren(
        hoverFormat("Play Progress", parseFloat(progress).toFixed(2) + "%", "ttProgress"),
        buildNode("br"));

    if (tcprogress > 0)
    {
        tcString.appendChildren(
            hoverFormat("Transcoded", tcprogress + "%", "ttTranscode"),
            buildNode("br"),
            hoverFormat("Buffer", (tcprogress - parseFloat(progress)).toFixed(2) + "%", "ttBuffer"),
            buildNode("br")
        );
    }
    else
    {
        tcString.appendChildren(buildNode("span", { id : "ttDirect" }, "Direct Play"), buildNode("br"));
    }

    if (!(element.parentElement.id in noPreviewThumbs))
    {
        addPreviewThumbnail(element, tcString);
    }

    return tcString;
}

/// <summary>
/// Returns a formatted line for a stream progress tooltip
/// </summary>
function hoverFormat(title, data, id)
{
    return buildNode("span", {}, `${title}: `).appendChildren(buildNode("span", { id : id, class : "tooltipProgress" }, data));
}

/// <summary>
/// Retrieve the friendly string representing the given video stream.
/// - For direct play, return the original stream
///  - For transcoded streams, return both the original and what we're transcoding it into
/// </summary>
function getVideoString(video)
{
    let videoString = "";
    if (video.transcode)
    {
        let hw = video.hw_transcode ? " HW" : "";
        videoString = `${video.original} &#8594;${hw} ${video.transcoded_codec} ${video.transcoded_resolution}`;
    }
    else
    {
        videoString = "Direct Play: " + video.original;
    }

    return `${videoString} (${video.bitrate} kbps)`;
}

/// <summary>
/// Retrieve the friendly string representing the given audio stream
/// </summary>
function getAudioString(audio)
{
    let audioString = "";
    if (audio.transcode)
    {
        audioString = `${audio.original} &#8594; ${audio.transcoded_codec} ${audio.transcoded_channels}`;
    }
    else
    {
        audioString = `Direct Play: ${audio.original}`;
    }

    if (parseInt(audio.bitrate) === 0)
    {
        return audioString;
    }

    return `${audioString} (${audio.bitrate} kbps)`;
}

/// <summary>
/// Convert milliseconds to a user-friendly [h:]mm:ss
/// </summary>
function msToHms(ms)
{
    let seconds = ms / 1000;
    const hours = parseInt(seconds / 3600);
    const minutes = parseInt(seconds / 60) % 60;
    seconds = parseInt(seconds) % 60;
    let pad2 = (time) => time < 10 ? "0" + time : time;
    let time = pad2(minutes) + ":" + pad2(seconds);
    if (hours > 0)
    {
        time = hours + ":" + time;
    }

    return time;
}
