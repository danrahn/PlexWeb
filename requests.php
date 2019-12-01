<?php
session_start();
require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
verify_loggedin(TRUE /*redirect*/, "requests.php");

?>

<!DOCTYPE html>
<html lang=en-us>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="stylesheet" type="text/css" href="resource/requests.css">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <script src="resource/consolelog.js"></script>
    <script src="resource/queryStatus.js"></script>
    <script src="resource/min/animate.min.js"></script>
    <title>Plex Requests</title>
</head>
<body>
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <div class="tableHolder">
                <div id="tableHeader" class="tableHF">
                    <button class="previousPage" title="Previous Page"><img src="arrow.png" alt="Previous Page" /></button>
                    <div class="largeShow">
                        <span>Show:</span>
                        <button class="ppButton" value="25">25</button><button class="ppButton" value="50">50</button><button class="ppButton" value="100">100</button><button class="ppButton cap" value="0">All</button>
                    </div>
                    <div class="pageStatus">Page <input type="text" class="pageSelect" value="1" title="Select Page"> of <span class="pageCount">1</span></div>
                    <button class="nextPage" title="Next Page"><img src="arrow.png" alt="Next Page" /></button>
                    <img class="filterImg" src="filter.png" alt="Filter" title="Filter Results" />
                </div>
                <div id="tableEntries"></div>
                <div id="tableFooter" class="tableHF">
                    <button class="previousPage" title="Previous Page"><img src="arrow.png" alt="Previous Page" /></button>
                    <div class="largeShow">
                        <span>Show:</span>
                        <button class="ppButton" value="25">25</button><button class="ppButton" value="50">50</button><button class="ppButton" value="100">100</button><button class="ppButton cap" value="0">All</button>
                    </div>
                    <div class="pageStatus">Page <input type="text" class="pageSelect" value="1" title="Select Page"> of <span class="pageCount">1</span></div>
                    <button class="nextPage" title="Next Page"><img src="arrow.png" alt="Next Page" /></button>
                    <img class="filterImg" src="filter.png" alt="Filter" title="Filter Results" />
                </div>
            </div>
        </div>
    </div>
</body>
<script>
(function()
{
    var pages = 0;
    window.addEventListener("load", function()
    {
        setPage(0);
        setupPerPage();
        setupNavigation();
        setupFilter();
        getRequests();
        setupKeyboardNavigation();
        document.body.addEventListener("keyup", filterKeyHandler);
    });

    /// <summary>
    /// Ask the server for user requests dependent on the current page and filter
    /// </summary>
    function getRequests()
    {
        let parameters = { "type" : "requests", "num" : getPerPage(), "page" : getPage(), "filter" : JSON.stringify(getFilter()) };

        displayInfoMessage("Loading...");

        let successFunc = function(response)
        {
            logInfo(response, true);
            clearElement("tableEntries");
            buildRequests(response);
        };

        let failureFunc = function(response)
        {
            displayInfoMessage("Error loading requests. Please try again later. If this problem persists, contact the site administrator");
        }

        sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
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
        let entries = $("#tableEntries");
        let sortOrder = getFilter().sort;
        let now = new Date();
        for (let i = 0; i < requests.count; ++i)
        {
            const request = requests.entries[i];
            entries.appendChild(buildRequest(request, sortOrder));

<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) {?>
            // Only after we append the item to the DOM can we mess with our constructed combobox
            setStatusChangeHandlers(request);
<?php } else { ?>
<?php } ?>
        }

        setPageInfo(requests.total);
    }

    /// <summary>
    /// Build a single request node, which consists of the request poster, a link to the request,
    /// and a few useful bits of information
    /// </summary>
    function buildRequest(request, sortOrder)
    {
        let holder = document.createElement("div");
        holder.classList.add("requestHolder");

        let imgHolder = document.createElement("div");
        imgHolder.classList.add("imgHolder");

        let img = document.createElement("img");
        img.src = `poster/${request.p}`;

        imgHolder.appendChild(img);

        let textHolder = document.createElement("div");
        textHolder.classList.add("textHolder");

        let a = document.createElement("a");
        a.classList.add("requestTitle");
        a.href = `request.php?id=${request.rid}`;
        a.text = request.n;

        let tooltipDateOptions = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' };

        let requestDate = document.createElement("span");
        requestDate.title = new Date(request.rd).toLocaleDateString('en-US', tooltipDateOptions);
        requestDate.innerHTML = `Requested: ${getDisplayDate(new Date(request.rd))}`;

        let updateDate = document.createElement("span");
        updateDate.title = new Date(request.ad).toLocaleDateString('en-us', tooltipDateOptions);
        updateDate.innerHTML = `Last Update: ${getDisplayDate(new Date(request.ad))}`;

        let requester = document.createElement("span");
        requester.innerHTML = `Requested By: ${request.r}`;

        let status = document.createElement("span");
        let statusVal = parseInt(request.a);
        let statusText = statusVal == 0 ? "Pending" : (statusVal == 1 ? "Complete" : "Denied");

<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) {?>
        status.innerHTML = getStatusSelection(request.rid, statusVal);
<?php } else { ?>
        status.innerHTML = `Status: ${statusText}`;
<?php } ?>

        if (statusVal == 1 || statusVal == 2)
        {
            holder.classList.add(statusVal == 1 ? "requestComplete" : "requestDenied");
        }

        let comments = document.createElement("span");
        comments.innerHTML = `<a href="request.php?id=${request.rid}">${request.c} comment${request.c != 1 ? 's' : ''}</a>`;

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
        return holder;
    }

<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) {?> // Admin helper methods
    function getStatusSelection(rid, selected)
    {
        return `
<label for="status_${rid}">Status: </label><select name="status_${rid}" id="status_${rid}" class="inlineCombo">
    <option value="0">Pending</option>
    <option value="1">Complete</option>
    <option value="2">Denied</option>
</select>
<a href='#' id='statusChange_${rid}' class='statusChange statusHidden' orig='${selected}' rid='${rid}'>Update</a>
`
    }

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
            }
            else if (!changeLink.classList.contains("statusHidden"))
            {
                changeLink.classList.add("statusHidden");
            }
        });

        changeLink.addEventListener("click", function()
        {
            let params = {
                "type" : "req_update",
                "data" :
                [{
                    "id" : this.getAttribute("rid"),
                    "kind" : "status",
                    "content" : $(`#status_${this.getAttribute("rid")}`).value
                }]
            }

            let successFunc = function()
            {
                Animation.queue({"backgroundColor": "rgb(63, 100, 69)"}, $(`#status_${request.rid}`), 500);
                Animation.queueDelayed({"backgroundColor": "transparent"}, $(`#status_${request.rid}`), 500, 500, true);
                setTimeout(function()
                {
                    clearElement("tableEntries");
                    getRequests();
                }, 2000)
            }

            let failureFunc = function(response, request)
            {
                Animation.queue({"backgroundColor": "rgb(100, 66, 69)"}, $(`#status_${request.rid}`), 500);
                Animation.queueDelayed({"backgroundColor": "transparent"}, $(`#status_${request.rid}`), 1000, 500, true);
            }

            sendHtmlJsonRequest(
                "update_request.php",
                JSON.stringify(params),
                successFunc,
                failureFunc,
                {"rid" : this.getAttribute("rid")},
                true /*dataIsString*/);
        });
    }
<?php } ?>

    /// <summary>
    /// Determine how long ago a date is from the current time.
    /// Returns a string of the form "X [time units] ago"
    /// </summary>
    function getDisplayDate(date)
    {
        let now = new Date();
        let dateDiff = Math.abs(now - date);
        let minuteDiff = dateDiff / (1000 * 60);
        if (minuteDiff < 60)
        {
            let minutes = Math.floor(minuteDiff);
            return `${minutes} minute${minutes == 1 ? "" : "s"} ago`;
        }
        
        let hourDiff = minuteDiff / 60;
        if (hourDiff < 24)
        {
            let hours = Math.floor(hourDiff);
            return `${hours} hour${hours == 1 ? "" : "s"} ago`;
        }

        let dayDiff = hourDiff / 24;
        if (dayDiff < 7)
        {
            let days = Math.floor(dayDiff);
            return `${days} day${days == 1 ? "" : "s"} ago`;
        }

        if (dayDiff <= 28)
        {
            let weeks = Math.floor(dayDiff / 7);
            return `${weeks} week${weeks == 1 ? '' : 's'} ago`;
        }

        if (dayDiff < 365)
        {
            let months = (now.getMonth() + (now.getFullYear() != date.getFullYear() ? 12 : 0)) - date.getMonth();
            return `${months == 0 ? 1 : months} month${months == 1 ? '' : 's'} ago`;
        }

        let yearDiff = now.getFullYear() - date.getFullYear();
        return `${yearDiff == 0 ? 1 : yearDiff} year${yearDiff == 1 ? '' : 's'}`;
    }

    /// <summary>
    /// Update the "Page X of Y" strings in the request table
    /// </summary>
    function setPageInfo(totalRequests)
    {
        pages = getPerPage() == 0 ? 1 : Math.ceil(totalRequests / getPerPage())
        $(".pageSelect").forEach(function(e)
        {
            e.value = getPage() + 1;
        });

        $(".pageCount").forEach(function(e)
        {
            e.innerHTML = pages;
        });
    }

    /// <summary>
    /// Clear out the current contents of the request table and replace it
    /// with a single informational message
    /// </summary>
    function displayInfoMessage(message)
    {
        clearElement("tableEntries");
        let info = document.createElement("div");
        info.id = "resultInfo";
        info.innerHTML = message;
        $("#tableEntries").appendChild(info);
    }

    /// <summary>
    /// Sets up the filter form and associated events.
    /// </summary>
    function setupFilter()
    {
        $(".filterImg").forEach(function(imgElement)
        {
            imgElement.addEventListener("click", filterImgClick);
        });
    }

    /// <summary>
    /// Launch the filter dialog and set up applicable event handlers
    /// </summary>
    function filterImgClick()
    {
        let overlay = document.createElement("div");
        overlay.id = "filterOverlay";
        overlay.innerHTML = filterHtml();
        overlay.style.opacity = "0";
        document.body.appendChild(overlay);

        overlay.addEventListener("click", function(e)
        {
            // A click outside the main dialog will dismiss it
            if (e.target.id == "filterOverlay")
            {
                dismissFilterDialog();
            }
        });

        let filter = getFilter();
        $("#showPending").checked = filter.status.pending;
        $("#showComplete").checked = filter.status.complete;
        $("#showDeclined").checked = filter.status.declined;
        $("#showMovies").checked = filter.type.movies;
        $("#showTV").checked = filter.type.tv;
        $("#showOther").checked = filter.type.other;
        $("#sortBy").value = filter.sort;
        $("#sortOrder").value = filter.order;

        setSortOrderValues();
        $("#sortBy").addEventListener("change", setSortOrderValues);

        $("#applyFilter").addEventListener("click", function(e)
        {
            setFilter(
            {
                "status" :
                {
                    "pending" : $("#showPending").checked,
                    "complete" : $("#showComplete").checked,
                    "declined" : $("#showDeclined").checked
                },
                "type" :
                {
                    "movies" : $("#showMovies").checked,
                    "tv" : $("#showTV").checked,
                    "other" : $("#showOther").checked,
                },
                "sort" : $("#sortBy").value,
                "order" : $("#sortOrder").value
            }, true /*update*/);

            dismissFilterDialog();
        });

        $("#cancelFilter").addEventListener("click", dismissFilterDialog);
        $("#resetFilter").addEventListener("click", function()
        {
            setFilter(defaultFilter(), true);
            dismissFilterDialog();
        });

        Animation.queue({"opacity": 1}, overlay, 250);
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
    /// Handle keystrokes 
    /// </summary>
    function filterKeyHandler(e)
    {
        let key = e.keyCode ? e.keyCode : e.which;
        if (key == 27 /*esc*/)
        {
            dismissFilterDialog();
        }
        else if (key == 13 /*enter*/ && e.ctrlKey)
        {
            let overlay = $("#filterOverlay");
            if (overlay && overlay.style.opacity == "1")
            {
                $("#applyFilter").click();
            }
        }
    }

    /// <summary>
    /// HTML for the filter overlay/dialog. Should probably be part of the initial DOM
    /// </summary>
    function filterHtml()
    {
        return `
<div id="filterContainer">
    <h3>Filter Options</h3>
    <hr />
    <div class="formInput">
        <label for="showPending">Show Pending: </label><input type="checkbox" name="showPending" id="showPending">
    </div>
    <div class="formInput">
        <label for="showComplete">Show Complete: </label><input type="checkbox" name="showComplete" id="showComplete">
    </div>
    <div class="formInput">
        <label for="showDeclined">Show Declined: </label><input type="checkbox" name="showDeclined" id="showDeclined">
    </div>
    <hr />
    <div class="formInput">
        <label for="showMovies">Show Movies: </label><input type="checkbox" name="showMovies" id="showMovies">
    </div>
    <div class="formInput">
        <label for="showTV">Show TV: </label><input type="checkbox" name="showTV" id="showTV">
    </div>
    <div class="formInput">
        <label for="showOther">Show Other: </label><input type="checkbox" name="showOther" id="showOther">
    </div>
    <hr />
    <div class="formInput">
        <label for="sortBy">Sort By: </label>
        <select name="sortBy" id="sortBy">
            <option value="request">Request Date</option>
            <option value="update">Update Date</option>
            <option value="title">Title</option>
        </select>
    </div>
    <div class="formInput">
        <label for="sortOrder">Sort By: </label>
        <select name="sortOrder" id="sortOrder">
            <option value="desc" id="sortDesc">Newest First</option>
            <option value="asc" id="sortAsc">Oldest First</option>
        </select>
    </div>
    <hr />
    <div class="formInput">
        <input type="button" value="Apply" id="applyFilter">
        <input type="button" value="Reset" id="resetFilter" style="margin-right: 10px">
        <input type="button" value="Cancel" id="cancelFilter" style="margin-right: 10px">
    </div>
</div>
`
    }

    /// <summary>
    /// Dismisses the filter overlay with an animation if it's present
    /// </summary>
    function dismissFilterDialog()
    {
        let overlay = $("#filterOverlay");
        if (overlay && overlay.style.opacity == "1")
        {
            Animation.queue({"opacity": 0}, overlay, 250, true);
        }
    }

    /// <summary>
    /// Returns the number of items per page the user wants to see
    /// </summary>
    function getPerPage()
    {
        let perPage = parseInt(localStorage.getItem("perPage"));
        if (perPage == null || isNaN(perPage) || perPage % 25 != 0 || perPage < 0)
        {
            localStorage.setItem("perPage", 25);
            perPage = 25;
        }

        return perPage;
    }

    /// <summary>
    /// Sets up click handlers for per-page options
    /// </summary>
    function setupPerPage()
    {
        let perPage = getPerPage();

        document.querySelectorAll(".ppButton").forEach((btn) =>
        {
            btn.addEventListener("click", function()
            {
                let newPerPage = parseInt(this.value);
                if (newPerPage == null || isNaN(newPerPage) || newPerPage % 25 != 0 || newPerPage < 0)
                {
                    newPerPage = 25;
                }

                setPerPage(newPerPage, true);
            });
        });

        setPerPage(perPage, false);
    }

    /// <summary>
    /// Set the number of requests to show per page
    /// </summary>
    function setPerPage(newPerPage, update)
    {
        localStorage.setItem("perPage", newPerPage);
        document.querySelectorAll(".ppButton").forEach((btn) =>
        {
            btn.classList.remove("selected");
        });

        document.querySelectorAll(`.ppButton[value="${newPerPage}"]`).forEach(function(e)
        {
            e.classList.add("selected");
        });

        if (update)
        {
            clearElement("tableEntries");
            getRequests();
        }
    }

    /// <summary>
    /// Set up click handlers for previous/next buttons
    /// </summary>
    function setupNavigation()
    {
        $(".previousPage").forEach(function(e)
        {
            e.addEventListener("click", previousPage);
        });

        $(".nextPage").forEach(function(e)
        {
            e.addEventListener("click", nextPage);
        });
    }

    /// <summary>
    /// Navigate to the previous page if we're not on the first page
    /// </summary>
    function previousPage()
    {
        let page = getPage();
        if (page <= 0)
        {
            return;
        }

        setPage(page - 1, true);
    }

    /// <summary>
    /// Navigate to the next page if we're not on the last page
    /// </summary>
    function nextPage()
    {
        let page = getPage();
        if (page == pages - 1)
        {
            return;
        }

        setPage(page + 1, true);
    }

    /// <summary>
    /// Set up general keyboard navigation, and the handler for
    /// when the user goes to a specific page via the input dialog
    ///
    /// SHIFT + LEFT_ARROW - Previous Page
    /// SHIFT + RIGHT_ARROW - Next Page
    /// </summary>
    function setupKeyboardNavigation()
    {
        document.addEventListener('keyup', function(e)
        {
            let key = e.keyCode ? e.keyCode : e.which;
            if (e.shiftKey && !e.altKey && !e.ctrlKey)
            {
                switch (key)
                {
                    default:
                        break;
                    case 37: // LEFT
                        previousPage();
                        break;
                    case 39: // RIGHT
                        nextPage();
                        break;
                }
            }
        });

        $('.pageSelect').forEach(function(input)
        {
            input.addEventListener('keyup', function(e)
            {
                let key = e.keyCode ? e.keyCode : e.which;
                if (key == 13 /*enter*/)
                {
                    let page = parseInt(this.value);
                    if (isNaN(page) || page <= 0 || page > pages)
                    {
                        return;
                    }

                    setPage(page - 1, true);
                }
            });
        })
    }

    /// <summary>
    /// Returns the user's current page
    /// </summary>
    function getPage()
    {
        let page = parseInt(localStorage.getItem("page"));
        if (page == null || isNaN(page) || page < 0)
        {
            page = 0;
            setPage(page);
        }

        return page;
    }

    /// <summary>
    /// Sets the current page (0-based)
    /// </summary>
    function setPage(page, update)
    {
        localStorage.setItem("page", page);
        if (update)
        {
            clearElement("tableEntries");
            getRequests();
        }
    }

    /// <summary>
    /// Retrieves the stored user filter (persists across page navigation, for better or worse)
    /// </summary>
    function getFilter()
    {
        let filter = null;
        try
        {
            filter = JSON.parse(localStorage.getItem("filter"));
        }
        catch (e)
        {
            logError("Unable to parse stored filter");
        }

        if (filter == null ||
            !filter.hasOwnProperty("status") ||
            !filter.hasOwnProperty("type") ||
            !filter.hasOwnProperty("sort") ||
            !filter.hasOwnProperty("order"))
        {
            filter = defaultFilter();
            setFilter(filter, false);
        }

        logVerbose(`Got Filter: ${JSON.stringify(filter)}`);
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
                "declined" : true
            },
            "type" :
            {
                "movies" : true,
                "tv" : true,
                "other" : true
            },
            "sort" : "request",
            "order" : "desc"
        };

        return filter;
    }

    /// <summary>
    /// Sets the current filter. No validation, but some basic validation
    /// should exist when grabbing the filter from localStorage
    /// </summary>
    function setFilter(filter, update)
    {
        logVerbose(`Setting filter to ${JSON.stringify(filter)}`);
        localStorage.setItem("filter", JSON.stringify(filter));
        if (update)
        {
            clearElement("tableEntries");
            getRequests();
        }
    }

    /// <summary>
    /// Extremely basic version of a shorthand query selector
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
    /// Clears all contents of the element with the given id
    /// </summary>
    function clearElement(id)
    {
        let element = $("#" + id);
        while (element.firstChild)
        {
            element.removeChild(element.firstChild);
        }
    }

    /// <summary>
    /// Generic method to sent an async request that expects JSON in return
    /// </summary>
    function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams, dataIsString)
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

        http.onreadystatechange = function()
        {
            if (this.readyState != 4 || this.status != 200)
            {
                return;
            }

            try
            {
                let response = JSON.parse(this.responseText);
                logJson(response, LOG.Verbose);
                if (response.Error)
                {
                    logError(response.Error);
                    if (failFunc)
                    {
                        failFunc(response, this);
                    }

                    return;
                }

                successFunc(response, this);

            }
            catch (ex)
            {
                logError(ex, true);
                logError(this.responseText);
            }
        };

        http.send(dataIsString ? parameters : buildQuery(parameters));
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
</script>
</html>