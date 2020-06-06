window.addEventListener("load", function()
{
    setPage(0);
    getRequests();
    $('#clearSearch').addEventListener('click', function()
    {
        $('.searchInput').forEach(function() { this.value = ''; });
        getRequests();
    });
});


/// <summary>
/// Ask the server for user requests dependent on the current page and filter
/// </summary>
function getRequests(searchValue='')
{
    let parameters =
    {
        "type" : ProcessRequest.GetRequests,
        "num" : getPerPage(),
        "page" : getPage(),
        "search" : searchValue,
        "filter" : JSON.stringify(getFilter())
    };

    displayInfoMessage("Loading...");
    let header = $('#requestSearch');
    if (searchValue.length == 0)
    {
        header.style.display = 'none';
    }
    else
    {
        header.style.display = 'block';
        $('#searchTerm').innerHTML = searchValue;
    }

    let successFunc = function(response)
    {
        clearTable();
        buildRequests(response);
        if (searchValue.length != 0)
        {
            $$('.searchBtn').click();
        }
    };

    let failureFunc = function()
    {
        displayInfoMessage("Error loading requests. Please try again later. If this problem persists, contact the site administrator");
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Returns whether the current session user is an admin. Easily bypassable
/// by modifying the DOM, but the backend is the source of truth and will block
/// any unauthorized actions.
/// </summary>
function isAdmin()
{
    return parseInt(document.body.getAttribute("isAdmin")) === 1 ;
}

/// <summary>
/// Take the server response and build our list of requests
/// </summary>
function buildRequests(requests)
{
    if (requests.count == 0)
    {
        logWarn("No results, likely due to bad page index or filter");
        displayInfoMessage("No requests found with the current filter");
        return;
    }

    logInfo(`Building ${requests.count} requests`);
    let sortOrder = getFilter().sort;
    for (let i = 0; i < requests.count; ++i)
    {
        const request = requests.entries[i];
        addTableItem(buildRequest(request, sortOrder));

        if (isAdmin())
        {
            // Only after we append the item to the DOM can we mess with our constructed combobox
            setStatusChangeHandlers(request);
        }
    }

    setPageInfo(requests.total);
}

/// <summary>
/// Build a single request node, which consists of the request poster, a link to the request,
/// and a few useful bits of information
/// </summary>
function buildRequest(request, sortOrder)
{
    let holder = tableItemHolder();

    let imgHolder = buildNode("div", {"class" : "imgHolder"});
    let imgA = buildNode("a", {"href" : `request.php?id=${request.rid}`});

    // Sometimes a poster fails to load. If it does, let the server know
    // that it needs to be updated. This should really only happen when
    // manually clearing out the poster cache server-side.

    let img = buildNode(
        "img",
        {
            'id' : `poster${request.rid}`,
            "src" : `poster${request.p}`,
            'alt' : 'Media Poster',
            'rid' : request.rid
        },
        0,
        {
            'error' : onFailedPoster
        });
    imgA.appendChild(img);
    imgHolder.appendChild(imgA);

    let textHolder = buildNode("div", {"class" : "textHolder"/*, "style" : "max-width: calc(100% - 100px)"*/});

    let a = buildNode("a", {"class" : "tableEntryTitle", "href" : `request.php?id=${request.rid}`});
    a.appendChild(buildNode("span", {}, request.n));
    if (request.t == 1 || request.t == 2)
    {
        a.appendChild(buildNode("img", {
            "class" : "inlineIcon",
            "src" : icons[`${request.t == 1 ? "movie" : "tv"}icon`.toUpperCase()],
            "alt" : request.t == 1 ? "Movie" : "TV Show"
        }));
    }

    let tooltipDateOptions = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' };

    let requestDate = buildNode("span", {}, `Requested: ${DateUtil.getDisplayDate(request.rd)}`);
    setTooltip(requestDate, DateUtil.getFullDate(request.rd));

    let updateDate = buildNode("span", {}, `Last Update: ${DateUtil.getDisplayDate(request.ad)}`);
    setTooltip(updateDate, DateUtil.getFullDate(request.ad));

    let requester = buildNode("span", {}, `Requested By: ${request.r}`);

    let status = buildNode("span");
    let statusVal = parseInt(request.a);
    let statusText = ["Pending", "Complete", "Denied", "In Progress", "Waiting"][statusVal];

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
        holder.classList.add(["", "requestComplete", "requestDenied", "requestInProgress", "requestWaiting"][statusVal]);
    }

    let comments = buildNode("span");
    comments.appendChild(buildNode("a",
        {"href" : `request.php?id=${request.rid}`},
        `${request.c} comment${request.c != 1 ? 's' : ''}`));

    textHolder.appendChild(a);
    if (sortOrder == "ud" || sortOrder == "ua")
    {
        textHolder.appendChild(updateDate);
        textHolder.appendChild(requestDate);
    }
    else
    {
        textHolder.appendChild(requestDate);
        textHolder.appendChild(updateDate);
    }

    textHolder.appendChild(requester);
    textHolder.appendChild(status);
    textHolder.appendChild(comments);

    holder.appendChild(imgHolder);
    holder.appendChild(textHolder);
    logTmi(holder, "Built Item", false);
    return holder;
}

/// <summary>
/// On the off chance a poster fails to load, try resetting it
/// server-side. This can happen if our poster cache was wiped
/// out and the poster has changed on TMDb
/// </summary>
function onFailedPoster(e)
{
    if (this.getAttribute('retried') == 1)
    {
        // We can get into a nasty loop if we continue
        // attempting to reload an image that truly doesn't exist
        logWarn('We already failed, not trying again');
        return;
    }

    this.alt = 'Refreshing Poster...';

    let parameters =
    {
        'type' : ProcessRequest.UpdatePoster,
        'rid' : this.getAttribute('rid')
    };

    let successFunc = function(response)
    {
        let img = $(`#poster${response.rid}`);
        if (img)
        {
            img.setAttribute('retried', 1);
            img.src = 'poster' + response.poster;
            img.alt = 'Media Poster';
        }
    }

    let failureFunc = function(response)
    {
        let img = $(`#poster${response.rid}`);
        if (img)
        {
            $(`#poster${response.rid}`).setAttribute('retried', 1);
        }
    }

    sendHtmlJsonRequest('process_request.php', parameters, successFunc);
}

/// <symmary>
/// Returns the HTML for a status combobox for request administration
/// </summary>
function getStatusSelection(statusHolder, rid, selected)
{
    statusHolder.appendChild(buildNode("label", {"for" : `status_${rid}`}, "Status: "));
    let select = buildNode("select", {"name" : `status_${rid}`, "id" : `status_${rid}`, "class" : "inlineCombo"});
    let mappings = [0, 4, 3, 1, 2];
    ["Pending", "Waiting", "In Progress", "Complete", "Denied"].forEach(function(item, i)
    {
        select.appendChild(buildNode("option", {"value" : mappings[i]}, item));
    });

    statusHolder.appendChild(select);
    statusHolder.appendChild(buildNode("a",
        {
            "href" : "#",
            "id" : `statusChange_${rid}`,
            "class" : "statusChange statusHidden",
            "orig" : selected,
            "rid" : rid
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
/// Update the status(es) of requests that have changed
/// </sumary>
function updateStatus()
{
    let changed = $(".statusVisible");
    let data = [];
    let ridList = [];
    changed.forEach(function(e)
    {
        let rid = e.getAttribute("rid");
        data.push({
            "id" : rid,
            "kind" : "status",
            "content" : $(`#status_${rid}`).value
        });

        ridList.push(rid);
    });

    let params = {
        "type" : "req_update",
        "data" : data
    }

    let successFunc = function(response, request)
    {
        request.ridList.forEach(function(rid)
        {
            Animation.queue({"backgroundColor": "rgb(63, 100, 69)"}, $(`#status_${rid}`), 500);
            Animation.queueDelayed({"backgroundColor": "transparent"}, $(`#status_${rid}`), 500, 500, true);
        });

        setTimeout(function()
        {
            clearTable();
            getRequests();
        }, 2000)
    }

    let failureFunc = function(response, request)
    {
        request.ridList.forEach(function(rid)
        {
            Animation.queue({"backgroundColor": "rgb(100, 66, 69)"}, $(`#status_${rid}`), 500);
            Animation.queueDelayed({"backgroundColor": "transparent"}, $(`#status_${rid}`), 1000, 500, true);
        });
    }

    sendHtmlJsonRequest(
        "update_request.php",
        JSON.stringify(params),
        successFunc,
        failureFunc,
        {"ridList" : ridList},
        true /*dataIsString*/);
}

function populateFilter()
{
    let filter = getFilter();
    $("#showPending").checked = filter.status.pending;
    $("#showComplete").checked = filter.status.complete;
    $("#showDeclined").checked = filter.status.declined;
    $("#showInProgress").checked = filter.status.inprogress;
    $("#showWaiting").checked = filter.status.waiting;
    $("#showMovies").checked = filter.type.movies;
    $("#showTV").checked = filter.type.tv;
    $("#showOther").checked = filter.type.other;
    $("#sortBy").value = filter.sort;
    $("#sortOrder").value = filter.order == 'desc' ? 'sortDesc' : 'sortAsc';

    if (isAdmin())
    {
        populateUserFilter();
    }

    setSortOrderValues();
    $("#sortBy").addEventListener("change", setSortOrderValues);
}

function getNewFilter()
{
    return {
        "status" :
        {
            "pending" : $("#showPending").checked,
            "complete" : $("#showComplete").checked,
            "declined" : $("#showDeclined").checked,
            "inprogress" : $("#showInProgress").checked,
            "waiting" : $("#showWaiting").checked
        },
        "type" :
        {
            "movies" : $("#showMovies").checked,
            "tv" : $("#showTV").checked,
            "other" : $("#showOther").checked,
        },
        "sort" : $("#sortBy").value,
        "order" : $("#sortOrder").value == 'sortDesc' ? 'desc' : 'asc',
        "user" : isAdmin() ? $("#filterTo").value : "-1"
    };
}

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
/// HTML for the filter overlay/dialog. Should probably be part of the initial DOM
/// </summary>
function filterHtml()
{
    let options = [];

    // Statuses + request types
    let checkboxes =
    {
        'Show Pending' : 'showPending',
        'Show Waiting' : 'showWaiting',
        'Show In Progress' : 'showInProgress',
        'Show Complete' : 'showComplete',
        'Show Declined' : 'showDeclined',
        '' : '',
        'Show Movies' : 'showMovies',
        'Show TV' : 'showTV',
        'Show Other' : 'showOther'
    };

    for (let [label, name] of Object.entries(checkboxes))
    {
        options.push(buildTableFilterCheckbox(label, name));
    }

    options.push(buildNode('hr'));

    options.push(buildTableFilterDropdown(
        'Sort By',
        {
            'Request Date' : 'request',
            'Update Date' : 'update',
            'Title' : 'title'
        }));

    options.push(buildTableFilterDropdown(
        'Sort Order',
        {
            'Newest First' : 'sortDesc',
            'Oldest First' : 'sortAsc'
        },
        true /*addId*/));

    options.push(buildNode("hr"));

    if (isAdmin())
    {
        options.push(buildTableFilterDropdown(
            'Filter To',
            {
                'All' : -1
            }));
        options.push(buildNode("hr"));
    }

    return filterHtmlCommon(options);
}

/// <summary>
/// Invoke a search for a specific request
/// </summary>
function tableSearch(value)
{
    getRequests(value);
}

/// <summary>
/// Unique identifier for this table
/// </summary>
function tableIdentifier()
{
    return 'requests';
}

/// <summary>
/// Function to invoke when updating the table
/// </summary>
function tableUpdateFunc()
{
    return getRequests;
}

/// <summary>
/// Retrieves the stored user filter (persists across page navigation, for better or worse)
/// </summary>
function getFilter()
{
    let filter = null;
    try
    {
        filter = JSON.parse(localStorage.getItem(tableIdCore() + '_filter'));
    }
    catch (e)
    {
        logError("Unable to parse stored filter");
    }

    if (filter == null ||
        !filter.hasOwnProperty("status") ||
            !filter.status.hasOwnProperty("pending") ||
            !filter.status.hasOwnProperty("complete") ||
            !filter.status.hasOwnProperty("declined") ||
            !filter.status.hasOwnProperty("inprogress") ||
            !filter.status.hasOwnProperty("waiting") ||
        !filter.hasOwnProperty("type") ||
            !filter.type.hasOwnProperty("movies") ||
            !filter.type.hasOwnProperty("tv") ||
            !filter.type.hasOwnProperty("other") ||
        !filter.hasOwnProperty("sort") ||
        !filter.hasOwnProperty("order") ||
        !filter.hasOwnProperty("user"))
    {
        if (filter != null)
        {
            logError("Bad filter, resetting: ");
            logError(filter);
        }
        else
        {
            logInfo("No filter found, creating default filter");
        }

        filter = defaultFilter();
        setFilter(filter, false);
    }

    logVerbose(filter, "Got Filter");
    return filter;
}

function defaultFilter()
{
    let filter =
    {
        "status" :
        {
            "pending" : true,
            "complete" : true,
            "declined" : true,
            "inprogress" : true,
            "waiting" : true
        },
        "type" :
        {
            "movies" : true,
            "tv" : true,
            "other" : true
        },
        "sort" : "request",
        "order" : "desc",
        "user" : -1
    };

    return filter;
}
