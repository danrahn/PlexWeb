/// <summary>
/// Builds a table of current requests. Implements tableCommon
/// </summary>

window.addEventListener("load", function()
{
    Table.setPage(0);
    Table.update();
});


/// <summary>
/// Ask the server for user requests dependent on the current page and filter
/// </summary>
function getRequests(searchValue="")
{
    posterMax = 0;
    let parameters =
    {
        type : ProcessRequest.GetRequests,
        num : Table.getPerPage(),
        page : Table.getPage(),
        search : searchValue,
        filter : JSON.stringify(Table.Filter.get())
    };

    Table.displayInfoMessage("Loading...");

    let successFunc = function(response)
    {
        Table.clear();
        buildRequests(response);
        if (searchValue.length != 0)
        {
            $$(".searchBtn").click();
        }
    };

    let failureFunc = function()
    {
        Table.displayInfoMessage("Error loading requests. Please try again later. If this problem persists, contact the site administrator");
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Returns whether the current session user is an admin. Easily bypassed
/// by modifying the DOM, but the backend is the source of truth and will block
/// any unauthorized actions.
/// </summary>
function isAdmin()
{
    return parseInt(document.body.getAttribute("isAdmin")) === 1;
}

/// <summary>
/// Take the server response and build our list of requests
/// </summary>
function buildRequests(requests)
{
    if (requests.count == 0)
    {
        Log.warn("No results, likely due to bad page index or filter");
        Table.displayInfoMessage("No requests found with the current filter");
        return;
    }

    Log.info(`Building ${requests.count} requests`);
    let sortOrder = Table.Filter.get().sort;
    document.body.setAttribute("mid", requests.machine_id);
    for (let i = 0; i < requests.count; ++i)
    {
        const request = requests.entries[i];
        Table.addItem(buildRequest(request, sortOrder));

        if (isAdmin())
        {
            // Only after we append the item to the DOM can we mess with our constructed combobox
            setStatusChangeHandlers(request);
        }
    }

    Table.setPageInfo(requests.total);
}

function px(dimen)
{
    return dimen + "px";
}

/// <summary>
/// Returns the poster for a given request. Also sets up
/// event listeners to attempt to re-download a poster
/// if we don't have it cached. If that fails, fallback
/// to a default poster
/// </summary>
function buildRequestPoster(request)
{
    let imgHolder = buildNode("div", { class : "imgHolder" });
    if (posterMax > 0)
    {
        imgHolder.style.width = px(posterMax);
    }

    let imgA = buildNode("a", { href : `request.php?id=${request.rid}` });

    // Sometimes a poster fails to load. If it does, let the server know
    // that it needs to be updated. This should really only happen when
    // manually clearing out the poster cache server-side.

    let img = buildNode(
        "img",
        {
            id : `poster${request.rid}`,
            src : request.p.startsWith("http") ? request.p : `poster${request.p}`,
            alt : "Media Poster",
            rid : request.rid
        },
        0,
        {
            error : onFailedPoster,
            load : onSuccessfulPoster
        });
    imgA.appendChild(img);
    return imgHolder.appendChildren(imgA);
}

let posterMax = 0;
function onSuccessfulPoster()
{
    let width = getComputedStyle(this).width;
    width = parseInt(width.substring(0, width.length - 2));
    if (width > posterMax)
    {
        posterMax = width;
        $(".imgHolder").forEach(function(poster) { poster.style.width = px(width); });
    }
}

/// <summary>
/// Returns the title element for a request, linked to it's specific request page
/// </summary>
function buildRequestTitle(request)
{
    let requestTitle = buildNode("a", { class : "tableEntryTitle", href : `request.php?id=${request.rid}` });
    requestTitle.appendChild(buildNode("span", {}, request.n));
    if (request.t >= 1 && request.t <= 3)
    {
        requestTitle.appendChild(buildNode("img", {
            class : "inlineIcon",
            src : Icons.getColor(request.t == 1 ? "movieicon" : request.t == 2 ? "tvicon" : "audiobookicon", "80A020"),
            alt : request.t == 1 ? "Movie" : "TV Show"
        }));
    }

    return requestTitle;
}

/// <summary>
/// Determines and displays the request status. If the current user
/// is an administrator, make the status a dropdown
/// </summary>
function buildRequestStatus(request, requestHolder)
{
    let status = buildNode("span");
    let statusVal = parseInt(request.a);
    let statusText = ["Pending", "Complete", "Denied", "In Progress", "Waiting", "Deleted"][statusVal];

    if (isAdmin())
    {
        getStatusSelection(status, request.rid, statusVal);
    }
    else
    {
        status.innerHTML = `Status: ${statusText}`;
    }

    if (statusVal != 0)
    {
        requestHolder.classList.add(["", "requestComplete", "requestDenied", "requestInProgress", "requestWaiting", "requestDeleted"][statusVal]);
    }

    return status;
}

/// <summary>
/// Builds and returns the main body of an individual request
/// </summary>
function buildRequestBody(request, sortOrder, requestHolder)
{
    let textHolder = buildNode("div", { class : "textHolder"/*, "style" : "max-width: calc(100% - 100px)"*/ });
    let requestTitle = buildRequestTitle(request);

    let requestDate = buildNode("span", {}, `Requested: ${DateUtil.getDisplayDate(request.rd)}`);
    Tooltip.setTooltip(requestDate, DateUtil.getFullDate(request.rd));

    let updateDate = buildNode("span", {}, `Last Update: ${DateUtil.getDisplayDate(request.ad)}`);
    Tooltip.setTooltip(updateDate, DateUtil.getFullDate(request.ad));

    let requester = buildNode("span", {}, `Requested By: ${request.r}`);

    let status = buildRequestStatus(request, requestHolder);

    let comments = buildNode("span");
    comments.appendChild(buildNode("a", { href : `request.php?id=${request.rid}` }, `${request.c} comment${request.c == 1 ? "" : "s"}`));
    if (parseInt(request.a) == 1 && request.pid != -1 && document.body.getAttribute("mid") != "")
    {
        comments.appendChild(buildNode("a", { href : "#", class : "plexLink", pid : request.pid }, "View on Plex", { click : navigateToPlex }));

    }

    textHolder.appendChild(requestTitle);
    if (sortOrder == "ud" || sortOrder == "ua")
    {
        textHolder.appendChildren(updateDate, requestDate);
    }
    else
    {
        textHolder.appendChildren(requestDate, updateDate);
    }

    return textHolder.appendChildren(requester, status, comments);
}

/// <summary>
/// Navigate to the Plex page for the specific request
/// </summary>
function navigateToPlex()
{
    let pid = parseInt(this.getAttribute("pid"));
    let mid = document.body.getAttribute("mid");
    let host = document.body.getAttribute("plex_host");
    let nav = document.body.getAttribute("plex_nav");
    window.open(
        `${host}/${nav}/server/${mid}/details?key=${encodeURIComponent("/library/metadata/" + pid)}`,
        "_blank",
        "noreferrer");
}

/// <summary>
/// Build a single request node, which consists of the request poster, a link to the request,
/// and a few useful bits of information
/// </summary>
function buildRequest(request, sortOrder)
{
    let holder = Table.itemHolder();

    let imgHolder = buildRequestPoster(request);
    let textHolder = buildRequestBody(request, sortOrder, holder);

    holder.appendChildren(imgHolder, textHolder);
    Log.tmi(holder, "Built Item", false);
    return holder;
}

/// <summary>
/// On the off chance a poster fails to load, try resetting it
/// server-side. This can happen if our poster cache was wiped
/// out and the poster has changed on TMDb
/// </summary>
function onFailedPoster()
{
    if (this.getAttribute("retried") == 1)
    {
        // We can get into a nasty loop if we continue
        // attempting to reload an image that truly doesn't exist
        Log.warn("We already failed, not trying again");
        return;
    }

    this.alt = "Refreshing Poster...";

    let parameters =
    {
        type : ProcessRequest.UpdatePoster,
        rid : this.getAttribute("rid")
    };

    let successFunc = function(response)
    {
        let img = $(`#poster${response.rid}`);
        if (img)
        {
            img.setAttribute("retried", 1);
            img.src = "poster" + response.poster;
            img.alt = "Media Poster";
        }
    };

    let failureFunc = function(response)
    {
        let img = $(`#poster${response.rid}`);
        if (img)
        {
            $(`#poster${response.rid}`).setAttribute("retried", 1);
        }
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Returns the HTML for a status combobox for request administration
/// </summary>
function getStatusSelection(statusHolder, rid, selected)
{
    statusHolder.appendChild(buildNode("label", { for : `status_${rid}` }, "Status: "));
    let select = buildNode("select", { name : `status_${rid}`, id : `status_${rid}`, class : "inlineCombo" });
    let mappings = [0, 4, 3, 1, 2, 5];
    ["Pending", "Waiting", "In Progress", "Complete", "Denied", "Deleted"].forEach(function(item, i)
    {
        if (i != 5 || selected == 5) // Only show 'Deleted' if the item itself is deleted, don't allow it from the dropdown
        {
            select.appendChild(buildNode("option", { value : mappings[i] }, item));
        }
    });

    statusHolder.appendChild(select);
    statusHolder.appendChild(buildNode("a",
        {
            href : "#",
            id : `statusChange_${rid}`,
            class : "statusChange statusHidden",
            orig : selected,
            rid : rid
        },
        "Update"));
}

/// <summary>
/// Setup handlers for changing request status
/// </summary>
function setStatusChangeHandlers(request)
{
    let select = $(`#status_${request.rid}`);
    let changeLink = $(`#statusChange_${request.rid}`);
    select.value = request.a;
    select.addEventListener("change", function()
    {
        let newVal = select.value;
        if (newVal != changeLink.getAttribute("orig"))
        {
            changeLink.classList.remove("statusHidden");
            changeLink.classList.add("statusVisible");
            this.classList.add("statusChanged");
        }
        else if (!changeLink.classList.contains("statusHidden"))
        {
            changeLink.classList.add("statusHidden");
            changeLink.classList.remove("statusVisible");
            this.classList.remove("statusChanged");
        }

        let changed = $(".statusVisible");
        let string = changed.length > 1 ? "Update All" : "Update";
        changed.forEach(function(e)
        {
            e.innerHTML = string;
        });
    });

    changeLink.addEventListener("click", updateStatus);
}

/// <summary>
/// Callback for when we successfully submitted a request status change event
/// </summary>
function updateStatusSuccess(response, request)
{
    request.ridList.forEach(function(rid)
    {
        Animation.queue({ backgroundColor : "rgb(63, 100, 69)" }, $(`#status_${rid}`), 500);
        Animation.queueDelayed({ backgroundColor : "transparent" }, $(`#status_${rid}`), 500, 500, true);
    });

    setTimeout(function()
    {
        Table.clear();
        Table.update();
    }, 2000);
}

/// <summary>
/// Update the status(es) of requests that have changed
/// </summary>
function updateStatus()
{
    let changed = $(".statusVisible");
    let data = [];
    let ridList = [];
    changed.forEach(function(e)
    {
        let rid = e.getAttribute("rid");
        data.push({
            id : rid,
            kind : "status",
            content : $(`#status_${rid}`).value
        });

        ridList.push(rid);
    });

    let params = {
        type : "req_update",
        data : data
    };

    let failureFunc = function(response, request)
    {
        request.ridList.forEach(function(rid)
        {
            Animation.queue({ backgroundColor : "rgb(100, 66, 69)" }, $(`#status_${rid}`), 500);
            Animation.queueDelayed({ backgroundColor : "transparent" }, $(`#status_${rid}`), 1000, 500, true);
        });
    };

    sendHtmlJsonRequest(
        "update_request.php",
        JSON.stringify(params),
        updateStatusSuccess,
        failureFunc,
        { ridList : ridList },
        true /*dataIsString*/);
}

/// <summary>
/// Modifies the filter HTML to reflect the current filter settings
/// </summary>
Table.Filter.populate = function()
{
    let filter = Table.Filter.get();
    $("#showPending").checked = filter.status.pending;
    $("#showComplete").checked = filter.status.complete;
    $("#showDeclined").checked = filter.status.declined;
    $("#showInProgress").checked = filter.status.inprogress;
    $("#showWaiting").checked = filter.status.waiting;
    $("#showDeleted").checked = isAdmin() && filter.status.deleted;
    $("#showMovies").checked = filter.type.movies;
    $("#showTV").checked = filter.type.tv;
    $("#showAudiobooks").checked = filter.type.audiobooks;
    $("#showOther").checked = filter.type.other;
    $("#sortBy").value = filter.sort;
    $("#sortOrder").value = filter.order == "desc" ? "sortDesc" : "sortAsc";

    if (isAdmin())
    {
        Table.Filter.populateUserFilter();
    }
    else
    {
        $("#showDeleted").parentNode.style.display = "none";
    }

    setSortOrderValues();
    $("#sortBy").addEventListener("change", setSortOrderValues);
};

/// <summary>
/// Returns the new filter definition based on the state of the filter HTML
/// </summary>
Table.Filter.getFromDialog = function()
{
    return {
        status :
        {
            pending : $("#showPending").checked,
            complete : $("#showComplete").checked,
            declined : $("#showDeclined").checked,
            inprogress : $("#showInProgress").checked,
            waiting : $("#showWaiting").checked,
            deleted : isAdmin() && $("#showDeleted").checked,
        },
        type :
        {
            movies : $("#showMovies").checked,
            tv : $("#showTV").checked,
            audiobooks : $("#showAudiobooks").checked,
            other : $("#showOther").checked,
        },
        sort : $("#sortBy").value,
        order : $("#sortOrder").value == "sortDesc" ? "desc" : "asc",
        user : isAdmin() ? $("#filterTo").value : "-1"
    };
};

/// <summary>
/// Adjusts the sort order text depending on the sort field
/// </summary>
function setSortOrderValues()
{
    if ($("#sortBy").value == "title")
    {
        $("#sortDesc").text = "A-Z";
        $("#sortAsc").text = "Z-A";
    }
    else
    {
        $("#sortDesc").text = "Newest First";
        $("#sortAsc").text = "Oldest First";
    }
}

/// <summary>
/// Adds checkbox options to the requests table filter
/// </summary>
function addFilterCheckboxes(options)
{
    let checkboxes =
    {
        "Show Pending" : "showPending",
        "Show Waiting" : "showWaiting",
        "Show In Progress" : "showInProgress",
        "Show Complete" : "showComplete",
        "Show Declined" : "showDeclined",
        "Show Deleted" : "showDeleted",
        "" : "",
        "Show Movies" : "showMovies",
        "Show TV" : "showTV",
        "Show Audiobooks" : "showAudiobooks",
        "Show Other" : "showOther"
    };

    for (let [label, name] of Object.entries(checkboxes))
    {
        options.push(Table.Filter.buildCheckbox(label, name));
    }
}

/// <summary>
/// HTML for the filter overlay/dialog. Should probably be part of the initial DOM
/// </summary>
Table.Filter.html = function()
{
    let options = [];

    // Statuses + request types
    addFilterCheckboxes(options);

    options.push(buildNode("hr"));

    options.push(Table.Filter.buildDropdown(
        "Sort By",
        {
            "Request Date" : "request",
            "Update Date" : "update",
            Title : "title"
        }));

    options.push(Table.Filter.buildDropdown(
        "Sort Order",
        {
            "Newest First" : "sortDesc",
            "Oldest First" : "sortAsc"
        },
        true /*addId*/));

    options.push(buildNode("hr"));

    if (isAdmin())
    {
        options.push(Table.Filter.buildDropdown(
            "Filter To",
            {
                All : -1
            }));
        options.push(buildNode("hr"));
    }

    return Table.Filter.htmlCommon(options);
};

/// <summary>
/// Returns whether we support table search. We do for requests
/// </summary>
Table.supportsSearch = function()
{
    return true;
};

/// <summary>
/// Unique identifier for this table
/// </summary>
Table.identifier = function()
{
    return "requests";
};

/// <summary>
/// Function to invoke when updating the table
/// </summary>
Table.updateFunc = function()
{
    return getRequests;
};

/// <summary>
/// Retrieves the stored user filter (persists across page navigation, for better or worse)
/// </summary>
Table.Filter.get = function()
{
    let filter = null;
    try
    {
        filter = JSON.parse(localStorage.getItem(Table.idCore() + "_filter"));
    }
    catch (e)
    {
        Log.error("Unable to parse stored filter");
    }

    if (filter === null ||
        !Object.prototype.hasOwnProperty.call(filter, "status") ||
            !Object.prototype.hasOwnProperty.call(filter.status, "pending") ||
            !Object.prototype.hasOwnProperty.call(filter.status, "complete") ||
            !Object.prototype.hasOwnProperty.call(filter.status, "declined") ||
            !Object.prototype.hasOwnProperty.call(filter.status, "inprogress") ||
            !Object.prototype.hasOwnProperty.call(filter.status, "waiting") ||
            !Object.prototype.hasOwnProperty.call(filter.status, "deleted") ||
        !Object.prototype.hasOwnProperty.call(filter, "type") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "movies") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "tv") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "audiobooks") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "other") ||
        !Object.prototype.hasOwnProperty.call(filter, "sort") ||
        !Object.prototype.hasOwnProperty.call(filter, "order") ||
        !Object.prototype.hasOwnProperty.call(filter, "user"))
    {
        if (filter === null)
        {
            Log.info("No filter found, creating default filter");
        }
        else
        {
            Log.error("Bad filter, resetting: ");
            Log.error(filter);
        }

        filter = Table.Filter.default();
        Table.Filter.set(filter, false);
    }

    Log.verbose(filter, "Got Filter");
    return filter;
};

/// <summary>
/// Returns the default filter for the requests table (i.e. nothing filtered)
/// </summary>
Table.Filter.default = function()
{
    let filter =
    {
        status :
        {
            pending : true,
            complete : true,
            declined : true,
            inprogress : true,
            waiting : true,
            deleted : false,
        },
        type :
        {
            movies : true,
            tv : true,
            audiobooks : true,
            other : true
        },
        sort : "request",
        order : "desc",
        user : -1
    };

    return filter;
};
