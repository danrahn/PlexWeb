(function() {
    let contentUpdater = null;
    let innerProgressTimers = {};

    // Easier way to remove DOM elements
    Element.prototype.remove = function() {
        this.parentElement.removeChild(this);
    }
    NodeList.prototype.remove = HTMLCollection.prototype.remove = function() {
        for(var i = this.length - 1; i >= 0; i--) {
             if(this[i] && this[i].parentElement) {
                this[i].parentElement.removeChild(this[i]);
             }
        }
    }

    /// <summary>
    /// On load, request the active streams (if it's running) and set up the suggestion form handlers
    /// </summary>
    window.addEventListener('load', function() {
        // Don't attempt to grab session information if we can't even connect to plex
        if (plexOk())
        {
            const url = 'get_status.php';
            const params = 'type=1'; // 1 == all sessions
            let http = new XMLHttpRequest();
            http.open('POST', url, true /*async*/);
            http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            http.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200)
                {
                    try
                    {
                        const response = JSON.parse(this.responseText);
                        console.log(response);
                        if (response['Error'])
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

                            let active = document.getElementById("activeNum");
                            active.innerHTML = "";
                            active.append(spanOpen);
                            active.append(requestLink);
                            active.append(spanClose);
                            return;
                        }
                        else
                        {
                            writeSessions(JSON.parse(this.responseText));
                            startUpdates();
                        }
                    }
                    catch (ex)
                    {
                        console.log(ex);
                        console.log(this.responseText);
                    }
                }
            };
            http.send(params);
        }
        else
        {
            document.querySelector("#activeNum").innerHTML = 0;
        }
        
        setupSuggestionForm();

    });

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
                    console.log("Error: " + this.responseText);
                }

                let streamAccess = document.getElementById("streamAccess");
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
        }

        http.send("type=pr&req_type=10&which=get");
    }

    function requestStreamAccess(element)
    {
        let http = new XMLHttpRequest();
        http.open('POST', 'process_request.php', true /*async*/);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

        http.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200)
            {
                let streamAccess = document.getElementById("streamAccess");
                let newString = this.responseText == '1' ? "Access Requested!" : "Request Already Pending";
                console.log("Response: " + this.responseText);
                if (this.responseText !== '1' && this.responseText !== '0')
                {
                    streamAccess.innerHTML = "error processing request";
                }
                else
                {
                    streamAccess.innerHTML = newString;
                }
            }
        }

        http.send("type=pr&req_type=10&which=req");
    }

    /// <summary>
    /// Build a mediainfo element for each session in the given sessions and append it to the DOM
    /// </summary>
    function writeSessions(activeSessions)
    {
        for (let i = 0; i < activeSessions.length; ++i)
        {
            document.querySelector('#mediaentries').appendChild(buildMediaInfo(activeSessions[i]));
        }

        document.querySelector("#activeNum").innerHTML = activeSessions.length;
    }

    /// <summary>
    /// Starts our timer to update sessions every 10 seconds
    /// </summary>
    function startUpdates()
    {
        contentUpdater = setInterval(function() {
            const url = 'get_status.php';
            const params = 'type=4';
            let http = new XMLHttpRequest();
            http.open('POST', url, true /*async*/);
            http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            http.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200)
                {
                    processUpdate(this.responseText);
                }
            };
            http.send(params);
        }, 10000);
    }

    /// <summary>
    /// Process our update response. Add/remove, reorder, switch between playing/paused
    /// </summary>
    function processUpdate(responseText)
    {
        try
        {
            let sessions = JSON.parse(responseText);
            logVerbose(sessions, true);
            document.querySelector("#activeNum").innerHTML = sessions.length;

            // moving existingSessions to an actual array makes it easier to .splice() below
            let existingSessions = document.querySelectorAll(".mediainfo");
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
                let id = sesh['id'];
                let item = document.querySelector("#id" + id);
                if (item)
                {
                    // The stream already exists - update the progress
                    item.querySelector(".time").innerHTML = msToHms(sesh['progress']) + "/" + msToHms(sesh['duration']);
                    item.querySelector('.progressHolder').setAttribute('progress', sesh['progress']);
                    item.querySelector('.progressHolder').setAttribute('tcprogress', 'transcode_progress' in sesh ? sesh['transcode_progress'] : 0);

                    item.querySelector(".ppbutton").className = "ppbutton fa fa-" + (sesh['paused'] ? "pause" : "play");
                    if (sesh['paused'])
                    {
                        // Transocde progress may still be updated, so do a one-off here
                        innerUpdate(id);
                    }
                    if (sesh['paused'] && innerProgressTimers[id])
                    {
                        clearInterval(innerProgressTimers[id]);
                        delete innerProgressTimers[id];
                    }
                    else if (!sesh['paused'] && !innerProgressTimers[id])
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
        catch (ex)
        {
            console.log(ex);
            console.log(responseText);
        }
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
                if (newSessions[j]['id'] === session.id.substring(2)) // substring to remove the 'id' that we add
                {
                    found = true;
                    break;
                }
            }

            if (!found)
            {
                // An existing session is no longer active, remove it
                console.log("Attempting to remove session# " + session.id);
                document.querySelector("#" + session.id).remove();
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
        if (a['paused'] != b['paused'])
        {
            return a['paused'] ? 1 : -1;
        }

        return (a['duration'] - a['progress']) - (b['duration'] - b['progress']);
    }

    /// <summary>
    /// Simulate playback for items that are marked as playing. We only get updates from the
    /// server every 10 seconds, so pretend like we're getting updates in the meantime
    /// </summary>
    function innerUpdate(sesh, addTime=true)
    {
        let element = document.querySelector("#id" + sesh);
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
            document.getElementById("tooltip").innerHTML = getHoverText(progressHolder);
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
            console.log("Attempting to add session# " + id);
            const url = 'get_status.php';
            const params = 'type=2&id=' + id;
            let http = new XMLHttpRequest();
            http.open('POST', url, true);
            http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            http.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200)
                {
                    try
                    {
                        const response = JSON.parse(this.responseText);
                        const currentSessions = document.querySelectorAll(".mediainfo");
                        if (currentSessions.length === 0)
                        {
                            // No active streams in our current session list. Add it
                            document.querySelector("#mediaentries").append(buildMediaInfo(response));
                        }
                        else
                        {
                            // If we have existing sessions, find its place in the list
                            for (let i = 0; i < currentSessions.length; ++i)
                            {
                                if (!response['paused'] && currentSessions[i].querySelector("i").className.indexOf("pause") != -1 ||
                                    (response['progress'] / response['duration']) * 100 < parseFloat(currentSessions[i].querySelector(".progress").style.width))
                                {
                                    // Found our position if this item is playing and the next is paused, or this item has less
                                    // time to completion.
                                    currentSessions[i].parentElement.insertBefore(buildMediaInfo(response), currentSessions[i]);
                                    break;
                                }
                                else if (i === currentSessions.length - 1)
                                {
                                    // This item belongs at the end of the list
                                    document.querySelector("#mediaentries").append(buildMediaInfo(response));
                                }
                            }
                        }
                    }
                    catch (ex)
                    {
                        console.log(ex);
                        console.log(this.responseText);
                    }
                }
                else if (this.readyState == 4 && this.status == 400)
                {
                    console.log(this.responseText);
                }
            };

            http.send(params);
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
        container.id = "id" + sesh['session_id'];
        container.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.4),rgba(0,0,0,0.4)), url(" + sesh['art_path'] + ")";

        const innerHolder = document.createElement("div");
        innerHolder.className = "innerHolder";

        // Album/poster thumb
        let thumbholder = document.createElement("div");
        thumbholder.className = "thumbholder";
        let img = document.createElement("img");
        img.src = sesh['thumb_path'];
        img.style.width = "100px";

        thumbholder.appendChild(img);


        // Details
        let details = document.createElement("div");
        details.className = "details";
        // link to imdb/audible
        let link = document.createElement("a");
        link.href = sesh['hyperlink'];
        link.target = '_blank';
        let icon = document.createElement('i');
        icon.className = "ppbutton fa fa-" + (sesh['paused'] ? "pause" : "play");
        icon.style.fontSize = "smaller";
        icon.style.color = "$AADDAA";
        let span = document.createElement('span');
        span.innerHTML = "  " + sesh['title'];

        link.appendChild(icon);
        link.appendChild(span);

        // Bulleted list
        let list = document.createElement("ul");
        list.appendChild(getListItem("Media type", sesh['media_type']));
        if (sesh['album']) // special handling for music
        {
            list.appendChild(getListItem("Album", sesh['album']));
        }
        const date = new Date(sesh['release_date']);
        const dateOpts = { year: 'numeric', month: 'long', day: 'numeric' };
        list.appendChild(getListItem("Release Date", date.toLocaleDateString("en-US", dateOpts)));
        list.appendChild(getListItem("Playback Device", sesh['playback_device']));
        if (sesh['user'])
        {
            list.appendChild(getListItem("User", sesh['user']));
        }

        if (sesh['video'])
        {
            list.appendChild(getListItem("Video", getVideoString(sesh['video'])));
        }
        list.appendChild(getListItem("Audio", getAudioString(sesh['audio'])));

        if (sesh['video'])
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
        progressHolder.setAttribute('progress', sesh['progress']);
        progressHolder.setAttribute('duration', sesh['duration']);

        progressHolder.addEventListener("mousemove", progressHover);
        progressHolder.addEventListener("mouseleave", function()
        {
            this.removeAttribute("hovered");
            document.querySelector("#tooltip").style.display = "none";
        });
        let progress = document.createElement("div");
        progress.className = "progress";
        const progressPercent = (sesh['progress'] / sesh['duration'] * 100)
        progress.style.width =  progressPercent + "%";
        let transcodeDiff = document.createElement("div");
        transcodeDiff.className = "tcdiff";
        let tcprogress = 'transcode_progress' in sesh ? sesh['transcode_progress'] : 0;

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
        time.innerHTML = msToHms(sesh['progress']) + "/" + msToHms(sesh['duration']);


        progressHolder.appendChild(progress);
        progressHolder.appendChild(transcodeDiff);
        progressHolder.appendChild(remaining);
        progressHolder.appendChild(time);

        innerHolder.append(thumbholder);
        innerHolder.append(details);
        container.append(innerHolder);
        container.append(progressHolder);

        // Event to simulate play progress. Updates only come in every 10 seconds, so pretend like we're updating every second
        if (!sesh['paused'])
        {
            innerProgressTimers[sesh['session_id']] = setInterval(innerUpdate, 1000, sesh['session_id']);
        }

        // Darken/lighten the background when entering/leaving the entry
        container.addEventListener("mouseenter", function(e) {
            style = e.target.style.backgroundImage;
            e.target.style.backgroundImage = "linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))," + style.substring(style.indexOf(" url("));
        });

        container.addEventListener("mouseleave", function(e) {
            style = e.target.style.backgroundImage;
            e.target.style.backgroundImage = "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4))," + style.substring(style.indexOf(" url("));
        });

        return container;
    }

    /// <summary>
    /// Returns a formatted list item in the form of "key: value"
    /// </summary>
    function getListItem(key, value)
    {
        let item = document.createElement("li");
        let title = document.createElement("strong");
        title.innerHTML = key + ": ";
        let span = document.createElement("span");
        span.innerHTML = value;
        item.appendChild(title);
        item.appendChild(span);
        return item;
    }

    /// <summary>
    /// Shows a tooltip when hovering over the transcode progress
    /// </summary>
    function progressHover(e)
    {
        this.setAttribute("hovered", true);
        const left = e.clientX + "px";
        const top = (e.clientY + 20) + "px";
        let tooltip = document.getElementById("tooltip");
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
        if (video['transcode'])
        {
            videoString = "Transcode - " + video['original'] + " &#8594; " + video['transcoded_codec'] + " " + video['transcoded_resolution'];
        }
        else
        {
            videoString = "Direct Play - " + video['original'];
        }

        return videoString += " (" + video['bitrate'] + " kbps)";
    }

    /// <summary>
    /// Retrieve the friendly string representing the given audio stream
    /// </summary>
    function getAudioString(audio)
    {
        let audioString = "";
        if (audio['transcode'])
        {
            audioString = "Transcode - " + audio['original'] + " &#8594; " + audio['transcoded_codec'] + " " + audio['transcoded_channels'];
        }
        else
        {
            audioString = "Direct Play - " + audio['original'];
        }

        if (parseInt(audio['bitrate']) === 0)
        {
            return audioString;
        }

        return audioString += " (" + audio['bitrate'] + " kbps)";
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

    /// <summary>
    /// Setup event handlers for the suggestion form
    /// </summary>
    function setupSuggestionForm()
    {
        var type = document.querySelector("select[name='type']");
        var name = document.querySelector("input[name='name']");
        var comment = document.querySelector("#comment");
        
        name.setAttribute("autocomplete", "off");
        comment.setAttribute("autocomplete", "off");
        
        document.getElementById("go").addEventListener("click", function() {
            // Infallible client-side validation
            logVerbose("Submitting Request");
            if (!type.value || !name.value) {
                var invalid = document.getElementById("invalid");
                if (!invalid) {
                    logError("oops, someone deleted #invalid!");
                    return;
                }
                invalid.style.display = "block";
                setTimeout(function() {
                    var invalid = document.getElementById("invalid");
                    if (!invalid) {
                        console.log("oops, someone deleted #invalid before timeout!");
                        return;
                    }
                    
                    invalid.style.display = "none";
                }, 3000);
                
                return;
            }
            
            http = new XMLHttpRequest();
            http.open("POST", "process_request.php", true /*async*/);
            http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            http.onreadystatechange = function() {
                if (this.readyState != 4 || this.status != 200) {
                    return;
                }

                try {
                    let response = JSON.parse(this.responseText);
                    logJson(response, LOG.Verbose);
                    let status = document.querySelector("#formStatus");
                    if (response["Error"]) {
                        logError(response["Error"]);
                        status.className = "formContainer statusFail";
                        status.innerHTML = "Error processing request: " + response["Error"];
                        Animation.queue({"opacity" : 1}, status, 500);
                        Animation.queueDelayed({"opacity" : 0}, status, 3000, 1000);
                        return;
                    }

                    // Clear out current values
                    document.querySelector("input[name='name'").value = "";
                    document.querySelector("#comment").value = "";
                    status.className = "formContainer statusSuccess";
                    status.innerHTML = "Request submitted!<br/><a href=view_requests.php>View Requests</a>";
                    Animation.queue({"opacity" : 1}, status, 500);
                    Animation.queueDelayed({"opacity" : 0}, status, 5000, 1000);
                } catch (ex) {
                    logError(ex, true);
                    logError(this.responseText);
                }
            }

            http.send(`&type=request&name=${name.value}&mediatype=${type.value}&comment=${comment.value}`);
            
        });
        
        var inputs = document.querySelectorAll("input, select");
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener("keyup", function(e) {
                if (e.keyCode === 13 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                    document.getElementById("go").click();
                }
            });
        }
        
        name.addEventListener("focusout", focusOutEvent);
        document.querySelector("input[type='button']").addEventListener("focusout", focusOutEvent);
        type.addEventListener("focusout", focusOutEvent);
        
        name.addEventListener("focus", focusInEvent);
        document.querySelector("input[type='button']").addEventListener("focus", focusInEvent);
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

    let inputTimer;
    /// <summary>
    /// After a delay in the user typing something into the suggestion box, search to see whether the item already exists
    /// </summary>
    function onSuggestionInput(e)
    {
        if (inputTimer)
        {
            clearTimeout(inputTimer);
        }

        inputTimer = setTimeout(searchSuggestion, 300);
    }

    function searchSuggestion()
    {
        let name = document.querySelector("input[name='name']");
        let type = document.querySelector("select[name='type']");
        let suggestion = name.value;
        if (!suggestion)
        {
            buildExistingItems({"length": 0});
            return;
        }

        let query = "&type=search&kind=" + type.value + "&query=" + name.value;
            
        http = new XMLHttpRequest();
        http.open("POST", "process_request.php", true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        http.onreadystatechange = function() {
            if (this.readyState != 4 || this.status != 200) {
                return;
            }

            try {
                let response = JSON.parse(this.responseText);
                logJson(response, LOG.Verbose);
                if (response.Error)
                {
                    throw "Unexpected error - printing response text";
                }

                buildExistingItems(response);
            } catch (ex) {
                logError(ex, true);
                logError(this.responseText);
            }
        }

        http.send(query);
    }

    function buildExistingItems(results)
    {
        if (results.length === 0)
        {
            document.querySelector("#suggestions").style.display = "none";
            return;
        }

        let existing = document.querySelector("#existingSuggestions");
        while (existing.children.length > 1)
        {
            existing.removeChild(existing.children[existing.children.length - 1]);
        }

        for (let i = 0; i < results.top.length; ++i)
        {
            const result = results.top[i];
            let div = document.createElement("div");
            div.style.height = "50px";
            div.className = "suggestionHolder";
            let img = document.createElement("img");
            img.src = result.thumb;
            img.className = "suggestionImg";
            let title = document.createElement("div");
            title.innerHTML = result.title + (result.year ? (" (" + result.year + ")") : "");
            title.className = "suggestionText";

            div.appendChild(img);
            div.appendChild(title);

            existing.appendChild(div);
        }

        if (results.length > results.top.length)
        {
            let div = document.createElement("div");
            div.className = "suggestionHolder";
            let title = document.createElement("div");
            title.innerHTML = "(" + (results.length - results.top.length) + " more)";
            title.style.textAlign = "center";
            title.className = "suggestionText";

            div.appendChild(title);

            existing.appendChild(div);
        }

        document.querySelector("#suggestions").style.display = "block";
        document.querySelector("#existingSuggestions").style.display = "block";
    }
})();