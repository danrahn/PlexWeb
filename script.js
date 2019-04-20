(function() {
    let contentUpdater = null;
    let innerProgressTimers = {};

    // Easier way to remove DOM elements
    Element.prototype.remove = function() {
        this.parentElement.removeChild(this);
    };

    NodeList.prototype.remove = HTMLCollection.prototype.remove = function() {
        for(let i = this.length - 1; i >= 0; i--) {
             if(this[i] && this[i].parentElement) {
                this[i].parentElement.removeChild(this[i]);
             }
        }
    };

    /// <summary>
    /// On load, request the active streams (if it's running) and set up the suggestion form handlers
    /// </summary>
    window.addEventListener('load', function() {
        // Don't attempt to grab session information if we can't even connect to plex
        if (plexOk())
        {
            sendHtmlJsonRequest("get_status.php",
                {
                    "type" : "1"
                },
                function(response)
                {
                    writeSessions(response);
                    startUpdates();
                },
                getStatusFailure);
        }
        else
        {
            $("#activeNum").innerHTML = 0;
        }
        
        setupSuggestionForm();

    });

    /// <summary>
    /// Function invoked when we fail to grab status information
    /// due to permission issues
    /// </summary>
    function getStatusFailure()
    {
        // User doesn't have access to active streams
        let spanOpen = document.createElement('span');
        spanOpen.innerHTML = '[';

        let requestLink = document.createElement('a');
        requestLink.href = '#';
        requestLink.id = "streamAccess";
        requestLink.innerHTML = "No Access";
        getStreamAccessString();

        let spanClose = document.createElement('span');
        spanClose.innerHTML = ']';

        let active = $("#activeNum");
        active.innerHTML = "";
        active.append(spanOpen);
        active.append(requestLink);
        active.append(spanClose);
    }

    /// <summary>
    /// Sets the string if the user does not have authorization to view active streams
    /// 'Request Pending' if the user has requested access, 'Request Access' if access
    /// has not been requested.
    ///
    /// Doesn't use 'sendHtmlJsonRequest' because it's a "legacy" function that doesn't
    /// return JSON (yet*)
    /// </summary>
    function getStreamAccessString()
    {
        let http = new XMLHttpRequest();
        http.open('POST', 'process_request.php', true /*async*/);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

        http.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200)
            {
                const newString = this.responseText == '0' ? "Request Pending" : "Request Access";
                if (this.responseText !== '1' && this.responseText !== '0')
                {
                    logError(this.responseText);
                }

                let streamAccess = $("#streamAccess");
                streamAccess.innerHTML = newString;
                if (this.responseText != '0')
                {
                    // Need to request access
                    streamAccess.addEventListener("click", function() {
                        this.innerHTML = '...';
                        requestStreamAccess();
                    });
                }
            }
        };

        http.send("type=pr&req_type=10&which=get");
    }

    /// <summary>
    /// Updates the access string after the user requests access to stream information
    /// </summary>
    function requestStreamAccess(element)
    {
        let http = new XMLHttpRequest();
        http.open('POST', 'process_request.php', true /*async*/);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

        http.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200)
            {
                let streamAccess = $("#streamAccess");
                let newString = this.responseText == '1' ? "Access Requested!" : "Request Already Pending";
                logVerbose("Response: " + this.responseText);
                if (this.responseText !== '1' && this.responseText !== '0')
                {
                    streamAccess.innerHTML = "error processing request";
                }
                else
                {
                    streamAccess.innerHTML = newString;
                }
            }
        };

        http.send("type=pr&req_type=10&which=req");
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

        $("#activeNum").innerHTML = activeSessions.length;
    }

    /// <summary>
    /// Starts our timer to update sessions every 10 seconds
    /// </summary>
    function startUpdates()
    {
        contentUpdater = setInterval(function() {
            sendHtmlJsonRequest("get_status.php",
                {
                    "type" : "4"
                },
                function(response)
                {
                    processUpdate(response);
                });
        }, 10000);
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
                item.querySelector(".time").innerHTML = msToHms(sesh.progress) + "/" + msToHms(sesh.duration);
                item.querySelector('.progressHolder').setAttribute('progress', sesh.progress);
                item.querySelector('.progressHolder').setAttribute('tcprogress', 'transcode_progress' in sesh ? sesh.transcode_progress : 0);

                item.querySelector(".ppbutton").className = "ppbutton fa fa-" + (sesh.paused ? "pause" : "play");
                if (sesh.paused)
                {
                    // Transocde progress may still be updated, so do a one-off here
                    innerUpdate(id);
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
    }

    /// <summary>
    /// Remove existing sessions from the DOM if they're not in our new session list
    /// </summary.
    function trimSessions(newSessions, existingSessions)
    {
        // O(n^2), ugh
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
                logVerbose("Attempting to remove session# " + session.id);
                $("#" + session.id).remove();
                existingSessions.splice(i /*index*/, 1 /*howmany*/);
                --i;
            }
        }
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
        let progressHolder = element.querySelector('.progressHolder');
        let newMsProgress = parseInt(progressHolder.getAttribute("progress")) + addedTime;
        const msDuration = parseInt(progressHolder.getAttribute("duration"));
        let tcprogress = parseFloat(progressHolder.getAttribute("tcprogress"));
        if (newMsProgress > msDuration)
        {
            // Don't go over the end of the stream!
            newMsProgress = msDuration;
        }

        const newHms = msToHms(newMsProgress);
        let time = element.querySelector(".time");
        const newTimeStr = newHms + "/" + time.innerHTML.split("/")[1];

        const newProgress = (newMsProgress / msDuration) * 100;
        element.querySelector(".progress").style.width = newProgress + "%";
        if (tcprogress - newProgress < 0)
        {
            tcprogress = newProgress;
        }

        element.querySelector(".tcdiff").style.width = (tcprogress - newProgress) + "%";
        element.querySelector(".remaining").style.width = (100 - tcprogress) + "%";
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
            logVerbose("Attempting to add session# " + id);
            sendHtmlJsonRequest("get_status.php",
                {
                    "type" : 2,
                    "id" : id
                },
                function(response)
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
                        if (!response.paused && currentSessions[i].querySelector("i").className.indexOf("pause") != -1 ||
                            (response.progress / response.duration) * 100 < parseFloat(currentSessions[i].querySelector(".progress").style.width))
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
                });
        }
    }

    /// <summary>
    /// Returns a mediainfo element based on the given session
    /// </summary>
    function buildMediaInfo(sesh)
    {
        // Main container
        logVerbose("Adding Session");
        logVerbose(sesh, true);
        let container = document.createElement("div");
        container.className = "mediainfo";
        container.id = "id" + sesh.session_id;
        container.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.4),rgba(0,0,0,0.4)), url(" + sesh.art_path + ")";

        const innerHolder = document.createElement("div");
        innerHolder.className = "innerHolder";

        // Album/poster thumb
        let thumbholder = document.createElement("div");
        thumbholder.className = "thumbholder";
        let img = document.createElement("img");
        img.src = sesh.thumb_path;
        img.style.width = "100px";

        thumbholder.appendChild(img);


        // Details
        let details = document.createElement("div");
        details.className = "details";
        // link to imdb/audible
        let link = document.createElement("a");
        link.href = sesh.hyperlink;
        link.target = '_blank';
        let icon = document.createElement('i');
        icon.className = "ppbutton fa fa-" + (sesh.paused ? "pause" : "play");
        icon.style.fontSize = "smaller";
        icon.style.color = "$AADDAA";
        let span = document.createElement('span');
        span.innerHTML = "  " + sesh.title;

        link.appendChild(icon);
        link.appendChild(span);

        // Bulleted list
        let list = document.createElement("ul");
        list.appendChild(getListItem("Media type", sesh.media_type));
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
        let progressHolder = document.createElement("div");
        progressHolder.className = "progressHolder";
        progressHolder.setAttribute('progress', sesh.progress);
        progressHolder.setAttribute('duration', sesh.duration);

        progressHolder.addEventListener("mousemove", progressHover);
        progressHolder.addEventListener("mouseleave", function()
        {
            this.removeAttribute("hovered");
            $("#tooltip").style.display = "none";
        });
        let progress = document.createElement("div");
        progress.className = "progress";
        const progressPercent = (sesh.progress / sesh.duration * 100);
        progress.style.width =  progressPercent + "%";
        let transcodeDiff = document.createElement("div");
        transcodeDiff.className = "tcdiff";
        let tcprogress = 'transcode_progress' in sesh ? sesh.transcode_progress : 0;

        progressHolder.setAttribute('tcprogress', tcprogress);
        if (tcprogress < progressPercent)
        {
            tcprogress = progressPercent;
        }
        transcodeDiff.style.width = (tcprogress - progressPercent) + "%";
        let remaining = document.createElement("div");
        remaining.className = "remaining";
        remaining.style.width = (100 - tcprogress) + "%";
        let time = document.createElement("div");
        time.className = "time";
        time.innerHTML = msToHms(sesh.progress) + "/" + msToHms(sesh.duration);


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

        // Darken/lighten the background when entering/leaving the entry
        container.addEventListener("mouseenter", function(e) {
            let style = e.target.style.backgroundImage;
            e.target.style.backgroundImage = "linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))," + style.substring(style.indexOf(" url("));
        });

        container.addEventListener("mouseleave", function(e) {
            let style = e.target.style.backgroundImage;
            e.target.style.backgroundImage = "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4))," + style.substring(style.indexOf(" url("));
        });

        return container;
    }

    /// <summary>
    /// Returns a formatted list item in the form of "key: value"
    /// </summary>
    function getListItem(key, value, id)
    {
        let item = document.createElement("li");
        if (id)
        {
            item.id = id;
        }
        let title = document.createElement("strong");
        title.innerHTML = key + ": ";
        let span = document.createElement("span");
        span.innerHTML = value;
        item.appendChild(title);
        item.appendChild(span);
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
        sendHtmlJsonRequest("process_request.php",
            {
                "type" : "geoip",
                "ip" : ip
            },
            function(response, request)
            {
                const geoInfoString = `${response.city}, ${response.state} - ${response.isp}`;
                const geoInfo = getListItem("Location", geoInfoString);
                let ipItem = document.getElementById(request.attachId);
                ipItem.parentNode.insertBefore(geoInfo, ipItem.nextSibling);
            },
            undefined /*failFunc*/,
            { "attachId" : id });
    }

    /// <summary>
    /// Shows a tooltip when hovering over the transcode progress
    /// </summary>
    function progressHover(e)
    {
        this.setAttribute("hovered", true);
        const left = e.clientX + "px";
        const top = (e.clientY + 20) + "px";
        let tooltip = $("#tooltip");
        tooltip.style.left = left;
        tooltip.style.top = top;

        tooltip.innerHTML = getHoverText(this);
        tooltip.style.display = "inline";
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
        return `<span>${title}: <span style='float:right'>${data}</span></span>`;
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
        if (hours > 0)
        {
            return hours + ":" + (minutes < 10 ? ("0" + minutes) : minutes) + ":" + (seconds < 10 ? ("0" + seconds) : seconds);
        }
        else 
        {
            return (minutes < 10 ? ("0" + minutes) : minutes) + ":" + (seconds < 10 ? ("0" + seconds) : seconds);
        }
    }

    let inputTimer;
    /// <summary>
    /// Setup event handlers for the suggestion form
    /// </summary>
    function setupSuggestionForm()
    {
        var type = $("select[name='type']")[0];
        var name = $("input[name='name']")[0];
        var comment = $("#comment");
        
        name.setAttribute("autocomplete", "off");
        comment.setAttribute("autocomplete", "off");
        
        $("#go").addEventListener("click", function() {
            // Infallible client-side validation
            logVerbose("Submitting Request");
            if (!type.value || !name.value) {
                var invalid = $("#invalid");
                if (!invalid) {
                    logError("oops, someone deleted #invalid!");
                    return;
                }
                invalid.style.display = "block";
                setTimeout(function() {
                    var invalid = $("#invalid");
                    if (!invalid) {
                        logWarn("oops, someone deleted #invalid before timeout!");
                        return;
                    }
                    
                    invalid.style.display = "none";
                }, 3000);
                
                return;
            }
            
            sendHtmlJsonRequest("process_request.php",
                {
                    "type" : "request",
                    "name" : name.value,
                    "mediatype" : type.value,
                    "comment" : comment.value
                },
                function()
                {
                    // Clear out current values
                    let status = $("#formStatus");
                    $("input[name='name']")[0].value = "";
                    $("#comment").value = "";
                    status.className = "formContainer statusSuccess";
                    status.innerHTML = "Request submitted!<br/><a href=view_requests.php>View Requests</a>";
                    Animation.queue({"opacity" : 1}, status, 500);
                    Animation.queueDelayed({"opacity" : 0}, status, 5000, 1000);
                },
                function(response)
                {
                    logError(response.Error);
                    status.className = "formContainer statusFail";
                    status.innerHTML = "Error processing request: " + response.Error;
                    Animation.queue({"opacity" : 1}, status, 500);
                    Animation.queueDelayed({"opacity" : 0}, status, 3000, 1000);
                });
        });
        
        var inputs = $("input, select");
        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].name == "name")
            {
                // If "enter" is pressed here, immediately do a search instead of submitting the suggestion
                inputs[i].addEventListener("keyup", function(e) {
                    if (e.keyCode === 13 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                        e.preventDefault();
                        if (inputTimer)
                        {
                            clearTimeout(inputTimer);
                        }

                        searchSuggestion();
                    }
                });

                continue;
            }

            inputs[i].addEventListener("keyup", function(e) {
                if (e.keyCode === 13 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                    $("#go").click();
                }
            });
        }
        
        name.addEventListener("focusout", focusOutEvent);
        $("input[type='button']")[0].addEventListener("focusout", focusOutEvent);
        type.addEventListener("focusout", focusOutEvent);
        
        name.addEventListener("focus", focusInEvent);
        $("input[type='button']")[0].addEventListener("focus", focusInEvent);
        type.addEventListener("focus", focusInEvent);

        name.addEventListener("input", onSuggestionInput);
        type.addEventListener("change", onSuggestionInput);
    }

    /// <summary>
    /// If a suggestion form box is required and is empty when it loses
    /// focus, change the background color to indicate the error
    /// </summary>
    function focusOutEvent() {
        if (!this.value) {
            this.style.backgroundColor = "rgb(100, 66, 69)";
            return;
        }
    }
    
    /// <summary>
    /// When a suggestion input is selected, highlight the border and clear
    /// any background formatting
    /// </summary>
    function focusInEvent() {
        this.style.backgroundColor = "rgb(63, 66, 69)";
    }

    /// <summary>
    /// After a delay in the user typing something into the suggestion box, search to see whether the item already exists
    /// </summary>
    function onSuggestionInput(e)
    {
        if (inputTimer)
        {
            clearTimeout(inputTimer);
        }

        inputTimer = setTimeout(searchSuggestion, 1000);
    }

    /// <summary>
    /// Search the plex database for the given suggestion, returning the most
    /// relevant results and subsequently triggering an external IMDb search
    /// </summary>
    function searchSuggestion()
    {
        let name = $("input[name='name']")[0];
        let type = $("select[name='type']")[0];
        let suggestion = name.value.replace("&", "%26");
        if (!suggestion)
        {
            buildItems("existingSuggestions", {"length": 0});
            buildItems("outsideSuggestions", {"length": 0});
            return;
        }
            
        sendHtmlJsonRequest("process_request.php",
            {
                "type" : "search",
                "kind" : type.value,
                "query" : suggestion
            },
            function(response)
            {
                buildItems("existingSuggestions", response);
                searchExternal();
            },
            function(response)
            {
                logError(response.Error);
                searchExternal();
            });
    }

    /// <summary>
    /// Trigger an external query that will grab IMDb results based on the current suggestion
    /// </summary>
    function searchExternal()
    {
        let name = $("input[name='name']")[0];
        let type = $("select[name='type']")[0];

        if (type.value != "movie" && type.value != "tv")
        {
            // Only search for movies and tv shows for now (imdb)
            return;
        }
            
        sendHtmlJsonRequest("process_request.php",
            {
                "type" : "search_external",
                "kind" : type.value,
                "query" : name.value
            },
            function(response)
            {
                buildItems("outsideSuggestions", response);
            },
            function()
            {
                throw "Unexpected error - printing response text";
            });
    }

    /// <summary>
    /// Build a list of either internal (plex) or external (imdb) suggestions
    /// </summary>
    function buildItems(id, results)
    {
        const external = id == "outsideSuggestions";
        id = "#" + id;

        let suggestions = $(id);
        while (suggestions.children.length > 1)
        {
            suggestions.removeChild(suggestions.children[suggestions.children.length - 1]);
        }

        if (results.length === 0)
        {
            suggestions.style.display = "none";
            if ($("#existingSuggestions").style.display == "none" &&
                $("#outsideSuggestions").style.display == "none")
            {
                $("#suggestions").style.display = "none";
            }
            return;
        }

        logVerbose("Done removing items for " + id);

        let len = results.top.length;

        for (let i = 0; i < results.top.length; ++i)
        {
            const result = results.top[i];

            if (external)
            {
                // Check if we have an existing item that matches this. If we do, skip it
                let existing = $("#existingSuggestions div[title='" +
                    result.title.replace("'", "") + "'][year='" + result.year + "']")[0];
                if (existing)
                {
                    --len;
                    continue;
                }
            }

            let div = document.createElement("div");
            div.className = "suggestionHolder";
            div.setAttribute("title", result.title.replace("'", ""));
            div.setAttribute("realtitle", result.title);
            div.setAttribute("year", result.year);
            let img = document.createElement("img");
            img.src = result.thumb;
            img.className = "suggestionImg";
            let title = document.createElement("div");
            const text = result.title + (result.year ? (" (" + result.year + ")") : "");

            if (external)
            {
                title.innerHTML = "<a href='https://imdb.com/title/" + result.id + "'>" + text + "</a>";
                div.style.cursor = "pointer";
                div.addEventListener("click", function(e) {
                    $("input[name='name']")[0].value = this.getAttribute("realtitle");
                    searchSuggestion();
                });
            }
            else
            {
                title.innerHTML = text;
            }

            title.className = "suggestionText";

            div.appendChild(img);
            div.appendChild(title);

            suggestions.appendChild(div);
        }

        if (external && len == 0)
        {
            $("#outsideSuggestions").style.display = "none";
        }

        if (results.length > results.top.length && !external)
        {
            let div = document.createElement("div");
            div.className = "suggestionHolder";
            let title = document.createElement("div");
            title.innerHTML = "(" + (results.length - results.top.length) + " more)";
            title.style.textAlign = "center";
            title.className = "suggestionText";

            div.appendChild(title);

            suggestions.appendChild(div);
        }

        if (len != 0)
        {
            suggestions.appendChild(document.createElement("hr"));
        }

        $("#suggestions").style.display = "block";
        suggestions.style.display = "block";
    }

    /// <summary>
    /// Custom jQuery-like selector method.
    /// If the selector starts with '#' and contains no spaces, return the
    /// result of querySelector, otherwise return the result of querySelectorAll
    /// </summary>
    function $(selector)
    {
        if (selector.indexOf("#") === 0 && selector.indexOf(" ") === -1)
        {
            return document.querySelector(selector);
        }

        return document.querySelectorAll(selector);
    }

    /// <summary>
    /// Generic method to sent an async request that expects JSON in return
    /// </summary>
    function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams)
    {
        let http = new XMLHttpRequest();
        http.open("POST", url, true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        if (additionalParams)
        {
            for (let param in additionalParams)
            {
                if (!additionalParams.hasOwnProperty(param))
                {
                    continue;
                }

                http[param] = additionalParams[param];
            }   
        }

        http.onreadystatechange = function() {
            if (this.readyState != 4 || this.status != 200) {
                return;
            }

            try {
                let response = JSON.parse(this.responseText);
                logJson(response, LOG.Verbose);
                if (response.Error) {
                    if (failFunc)
                    {
                        failFunc(response);
                    }
                    else
                    {
                        logError(response.Error);
                    }

                    return;
                }

                successFunc(response, this);

            } catch (ex) {
                logError(ex, true);
                logError(this.responseText);
            }
        };

        http.send(buildQuery(parameters));
    }

    /// <summary>
    /// Builds up a query string, ensuring the components are encoded properly
    /// </summary>
    function buildQuery(parameters)
    {
        let queryString = "";
        for (let parameter in parameters)
        {
            if (!parameters.hasOwnProperty(parameter))
            {
                continue;
            }

            queryString += `&${parameter}=${encodeURIComponent(parameters[parameter])}`;
        }

        return queryString;
    }
})();