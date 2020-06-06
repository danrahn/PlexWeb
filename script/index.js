let contentUpdater = null;
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
}

/// <summary>
/// On load, request the active streams (if it's running) and set up the suggestion form handlers
/// </summary>
window.addEventListener('load', function()
{
    // Don't attempt to grab session information if we can't even connect to plex
    if (plexOk())
    {
        let parameters = { "type" : QueryType.AllSessions };
        let successFunc = function(response)
        {
            writeSessions(response);
            startUpdates();
        };

        sendHtmlJsonRequest("get_status.php", parameters, successFunc, getStatusFailure);
    }
    else
    {
        $("#activeNum").innerHTML = 0;
    }
});

/// <summary>
/// Function invoked when we fail to grab status information
/// due to permission issues
/// </summary>
function getStatusFailure()
{
    // User doesn't have access to active streams
    let requestLink = buildNode("a", {"href" : "#", "id" : "streamAccess"}, "No Access");
    getStreamAccessString();

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
        "type" : ProcessRequest.PermissionRequest,
        "req_type" : 10,
        "which" : "get"
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

    let failureFunc = function(/*response*/)
    {
        $("#streamAccess").innerHTML = "Error getting stream permissions";
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
    let textbox = buildNode("textarea", {"maxlength" : "1024"}, 0,
    {
        "keydown" : function(e)
        {
            if (e.keyCode == 13 && e.ctrlKey)
            {
                $("#requestButton").click();
            }
        }
    });

    let button = buildNode(
        "input",
        {
            "type" : "button",
            "id" : "requestButton",
            "value" : "Request"
        },
        0,
        {
            "click" : requestStreamAccess
        });

    buildOverlay(true /*dismissable*/, message, textbox, button);
}

/// <summary>
/// Updates the access string after the user requests access to stream information
/// </summary>
function requestStreamAccess()
{
    let parameters =
    {
        "type" : ProcessRequest.PermissionRequest,
        "req_type" : 10,
        "which" : "req",
        "msg" : $("#overlayContainer textarea")[0].value
    };

    let successFunc = function(response)
    {
        let overlay = $("#mainOverlay");
        if (overlay)
        {
            Animation.queue({"backgroundColor": "rgba(0,25,0,0.5)"}, overlay, 500);
            Animation.queueDelayed({"backgroundColor": "rgba(0,0,0,0.5)", "opacity": "0"}, overlay, 500, 500, true);
        }

        const alreadyPending = (response.value == '0');
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
    active.addEventListener("mouseout", dismissTooltip);
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

    $('title')[0].innerHTML = prepend + "Plex Status";
}

/// <summary>
/// Starts our timer to update sessions every 10 seconds
/// </summary>
function startUpdates()
{
    contentUpdater = setInterval(function()
    {
        let parameters = { "type" : QueryType.Progress };
        let successFunc = function(response) { processUpdate(response); };
        let failureFunc = function(response)
        {
            if (response.Error == "Not Authorized" && !$("#goToLogin"))
            {
                showRestartSessionOverlay();
            }
        };

        sendHtmlJsonRequest("get_status.php", parameters, successFunc, failureFunc);
    }, 10000);
}

/// <summary>
/// If we've detected that our session has expired ('Not Authorized' from get_status),
/// surface a non-dismissable overlay asking the user to log in again
/// </summary>
function showRestartSessionOverlay()
{
    let message = buildNode("div", {}, "Your session has expired, please log in again");
    let button = buildNode(
        "input",
        {
            "type" : "button",
            "id" : "goToLogin",
            "value" : "OK",
            "style" : "width: 100px"
        },
        0,
        {
            "click" : () => window.location = "login.php"
        });
    buildOverlay(false /*dismissable*/, message, button);
    $("#goToLogin").focus();
}

/// <summary>
/// Process our update response. Add/remove, reorder, switch between playing/paused
/// </summary>
function processUpdate(sessions)
{
    $("#activeNum").innerHTML = sessions.length;

    // moving existingSessions to an actual array makes it easier to .splice() below
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
            // The stream already exists - update the progress
            item.$$(".time").innerHTML = msToHms(sesh.progress) + "/" + msToHms(sesh.duration);
            item.$$('.progressHolder').setAttribute('progress', sesh.progress);
            item.$$('.progressHolder').setAttribute('tcprogress', 'transcode_progress' in sesh ? sesh.transcode_progress : 0);

            let ppbutton = item.$$(".ppbutton");

            if (sesh.paused)
            {
                // Transocde progress may still be updated, so do a one-off here
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
            if (newSessions[j].id === session.id.substring(2)) // substring to remove the 'id' that we add
            {
                found = true;
                break;
            }
        }

        if (!found)
        {
            // An existing session is no longer active, remove it
            logInfo("Attempting to remove session " + session.id);

            if ($("#" + session.id + " .progressHolder")[0].hasAttribute("hovered"))
            {
                // If this is the currently hovered item, make sure we remove the tooltip,
                // otherwise it won't go away until another progress bar is hovered
                $("#tooltip").style.display = "none";
            }

            $("#" + session.id).remove();
            existingSessions.splice(i /*index*/, 1 /*howmany*/);
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
    if (newOrder.length != existingSessions.length)
    {
        needsReorder = true;
    }
    else
    {
        for (let i = 0; i < existingSessions.length; ++i)
        {
            if (existingSessions[i] != newOrder[i])
            {
                needsReorder = true;
                break;
            }
        }
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
function sessionSort(a, b)
{
    if (a.paused != b.paused)
    {
        return a.paused ? 1 : -1;
    }

    return (a.duration - a.progress) - (b.duration - b.progress);
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
    let progressHolder = element.$$('.progressHolder');
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
    logTmi(`${sesh} - Progress: ${newProgress}; TC: ${tcprogress}; Remaining: ${100 - tcprogress}`);
    time.innerHTML = newTimeStr;
    progressHolder.setAttribute("progress", newMsProgress);

    if (progressHolder.hasAttribute('hovered'))
    {
        $("#tooltip").innerHTML = getHoverText(progressHolder);
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
        logInfo("Attempting to add session " + id);
        let parameters =
        {
            "type" : QueryType.SingleSession,
            "id" : id
        }
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

    showTooltip(e, `Total Bitrate: ${bitrate} kbps`);
}

/// <summary>
/// Updates the total bitrate of active streams
/// </summary>
function updateTotalBitrate()
{
    currentSessions = $(".mediainfo");
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
/// Returns a mediainfo element based on the given session
/// </summary>
function buildMediaInfo(sesh)
{        
    // Main container
    logVerbose(sesh, "Adding Session");
    const posterColors = sesh.art_colors;
    const makeDarker = posterColors.red + posterColors.green + posterColors.blue > 500;
    const opacity = makeDarker ? 0.6 : 0.4;
    let container = buildNode("div", {
        "class" : "mediainfo" + (makeDarker ? " darkerposter" : ""),
        "id" : `id${sesh.session_id}`,
        "style" : `background-image : linear-gradient(rgba(0,0,0,${opacity}),rgba(0,0,0,${opacity})), url(${sesh.art_path})`
    },
    0,
    {
        // Darken/lighten the background when entering/leaving the entry
        "mouseenter" : function(e)
        {
            let style = e.target.style.backgroundImage;
            let newOpacity = e.target.classList.contains("darkerposter") ? 0.8 : 0.6;
            const newStyle = `linear-gradient(rgba(0,0,0,${newOpacity}), rgba(0,0,0,${newOpacity})),${style.substring(style.indexOf(" url("))}`;
            e.target.style.backgroundImage = newStyle;
        },
        "mouseleave" : function(e)
        {
            let style = e.target.style.backgroundImage;
            let newOpacity = e.target.classList.contains("darkerposter") ? 0.6 : 0.4;
            const newStyle = `linear-gradient(rgba(0,0,0,${newOpacity}), rgba(0,0,0,${newOpacity})), ${style.substring(style.indexOf(" url("))}`;
            e.target.style.backgroundImage = newStyle;
        }
    });

    const innerHolder = buildNode("div", {"class" : "innerHolder"});

    // Album/poster thumb
    let thumbholder = buildNode("div", {"class" : "thumbholder"});

    let poster = buildNode("img", {
        "src" : sesh.thumb_path,
        "style" : "width: 100px",
        "alt" : "thumbnail"
    });

    // Clicking on the image will go to an external site (imdb/tmdb/audible)
    if (sesh.hyperlink)
    {
        let externalLink = buildNode(
            "a",
            {
                "href" : sesh.hyperlink,
                "target" : "_blank"
            },
            0,
            {
                'mouseenter' :  () => {},
                'mouseleave' :  () => {}
            });
        externalLink.appendChild(poster);
        thumbholder.appendChild(externalLink);
    }
    else
    {
        thumbholder.appendChild(poster);
    }


    // Details
    let details = buildNode("div", {"class" : "details"});

    // link to plex. If no link is available, try linking to the external source
    let plexLink;
    if (sesh.plex_key)
    {
        plexLink = `https://app.plex.tv/desktop#!/server/${sesh.machine_id}/details?key=${encodeURIComponent(sesh.plex_key)}`;
    }
    else
    {
        plexLink = sesh.hyperlink;
    }

    let link = buildNode("a", {"href" : plexLink, "target" : "_blank"});
    link.appendChild(buildNode("span",
        { "class" : `ppbutton  ${sesh.paused ? "pause" : "play"}` },
        sesh.paused ? "&#10073;&#10073;  " : "&#x25ba;  "));

    link.appendChild(buildNode("span", {}, `${sesh.title}`));

    let inlineIconSrc = '';
    switch (sesh.media_type)
    {
        case "TV Show":
            inlineIconSrc = icons.TVICON;
            break;
        case "Movie":
            inlineIconSrc = icons.MOVIEICON;
            break;
        case "Music":
            inlineIconSrc = icons.MUSICICON;
            break;
        case "Audiobook":
            inlineIconSrc = icons.AUDIOBOOKICON;
        default:
            break;
    }

    if (inlineIconSrc)
    {
        link.appendChild(buildNode("img", {
            "class" : "inlineIcon",
            "src" : inlineIconSrc,
            "alt" : sesh.media_type
        }));
    }

    // Bulleted list
    let list = buildNode("ul");
    if (!inlineIconSrc)
    {
        list.appendChild(getListItem("Media type", sesh.media_type));
    }

    if (sesh.album) // special handling for music
    {
        list.appendChild(getListItem("Album", sesh.album));
    }

    const date = new Date(sesh.release_date);
    const dateOpts = { year: 'numeric', month: 'long', day: 'numeric' };
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
        list.appendChild(getListItem("Video", getVideoString(sesh.video)));
    }

    list.appendChild(getListItem("Audio", getAudioString(sesh.audio)));

    if (sesh.video)
    {
        // If we have audio and video, also include the total bitrate
        let bitrate = (sesh.audio ? sesh.audio.bitrate : 0) + (sesh.video.bitrate);
        list.appendChild(getListItem("Total bitrate", bitrate + " kbps"));
    }

    details.appendChild(link);
    details.appendChild(list);


    // Progress indicator at the bottom of the container
    let tcprogress = 'transcode_progress' in sesh ? sesh.transcode_progress : 0;
    let progressHolder = buildNode("div", {
        "class" : "progressHolder",
        "progress" : sesh.progress,
        "duration" : sesh.duration,
        "tcprogress" : tcprogress
    },
    0,
    {
        "mousemove" : progressHover,
        "mouseleave" : function()
        {
            this.removeAttribute("hovered");
            dismissTooltip();
        }
    });

    const progressPercent = (sesh.progress / sesh.duration * 100);
    let progress = buildNode("div", {"class" : "progress", "style" : `width: ${progressPercent}%`});

    if (tcprogress < progressPercent)
    {
        tcprogress = progressPercent;
    }

    let transcodeDiff = buildNode("div", {"class" : "tcdiff", "style" : `width: ${tcprogress - progressPercent}%`});

    let remaining = buildNode("div", {"class" : "remaining", "style" : `width: ${(100 - tcprogress)}%`});

    let time = buildNode("div", {"class" : "time"}, `${msToHms(sesh.progress)}/${msToHms(sesh.duration)}`);

    progressHolder.appendChild(progress);
    progressHolder.appendChild(transcodeDiff);
    progressHolder.appendChild(remaining);
    progressHolder.appendChild(time);

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
    let item = buildNode("li", id ? {"id" : id} : {});
    item.appendChild(buildNode("strong", {}, `${key}: `));
    item.appendChild(buildNode("span", {}, value));
    return item;
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
        "type" : ProcessRequest.GeoIP,
        "ip" : ip
    };

    let successFunc = function(response, request)
    {
        const locString = ` (${response.city}, ${response.state})`;
        const ispInfo = getListItem("ISP", response.isp);
        let ipItem = $('#' + request.attachId);
        ipItem.innerHTML += locString;
        ipItem.parentNode.insertBefore(ispInfo, ipItem.nextSibling);
    };

    // Values that we'll append to our http object directly
    let attachedParameters = { "attachId" : id };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, undefined /*failFunc*/, attachedParameters);
}

/// <summary>
/// Shows a tooltip when hovering over the transcode progress
/// </summary>
function progressHover(e)
{
    this.setAttribute("hovered", true);
    showTooltip(e, getHoverText(this));
}

/// <summary>
/// Gets the hover text for the given element (must be of class progressHolder)
/// </summary>
function getHoverText(element)
{
    const progress = element.children[0].style.width;
    const tcprogress = parseFloat(element.getAttribute('tcprogress')).toFixed(2);
    let tcString = "";
    if (tcprogress > 0)
    {
        tcString = hoverFormat("Transcoded", tcprogress + "%");
        tcString += "<br />";
        tcString +=hoverFormat("Buffer", (tcprogress - parseFloat(progress)).toFixed(2) + "%");
    }
    else
    {
        tcString = "Direct Play";
    }

    return hoverFormat("Play Progress", parseFloat(progress).toFixed(2) + "%") + "<br />" + tcString;
}

function hoverFormat(title, data)
{
    return `<span>${title}: <span style='float:right; padding-left: 5px'>${data}</span></span>`;
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
        videoString = "Transcode - " + video.original + " &#8594; " + video.transcoded_codec + " " + video.transcoded_resolution;
    }
    else
    {
        videoString = "Direct Play - " + video.original;
    }

    return videoString += " (" + video.bitrate + " kbps)";
}

/// <summary>
/// Retrieve the friendly string representing the given audio stream
/// </summary>
function getAudioString(audio)
{
    let audioString = "";
    if (audio.transcode)
    {
        audioString = "Transcode - " + audio.original + " &#8594; " + audio.transcoded_codec + " " + audio.transcoded_channels;
    }
    else
    {
        audioString = "Direct Play - " + audio.original;
    }

    if (parseInt(audio.bitrate) === 0)
    {
        return audioString;
    }

    return audioString += " (" + audio.bitrate + " kbps)";
}

/// <summary>
/// Convert milliseconds to a user-friendly [h:]mm:ss
/// </summary>
function msToHms(ms)
{
    var seconds = ms / 1000;
    const hours = parseInt(seconds / 3600);
    const minutes = parseInt(seconds / 60) % 60;
    seconds = parseInt(seconds) % 60;
    let pad2 = (time) => time < 10 ? '0' + time : time;
    let time = pad2(minutes) + ":" + pad2(seconds);
    if (hours > 0)
    {
        time = hours + ":" + time;
    }

    return time;
}
