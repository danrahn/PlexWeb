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
                    <button class="previousPage">&larr;</button>
                    <div class="largeShow">
                        <span>Show:</span>
                        <button class="ppButton" value="25">25</button><button class="ppButton" value="50">50</button><button class="ppButton" value="100">100</button><button class="ppButton cap" value="0">All</button>
                    </div>
                    <div class="pageStatus">Page <input type="text" class="pageSelect" value="1"> of <span class="pageCount">1</span></div>
                    <button class="nextPage">&rarr;</button>
                    <img class="filterImg" src="filter.png" alt="Filter" title="Filter Results" />
                </div>
                <div id="tableEntries"></div>
                <div id="tableFooter" class="tableHF">
                    <button class="previousPage">&larr;</button>
                    <div class="largeShow">
                        <span>Show:</span>
                        <button class="ppButton" value="25">25</button><button class="ppButton" value="50">50</button><button class="ppButton" value="100">100</button><button class="ppButton cap" value="0">All</button>
                    </div>
                    <div class="pageStatus">Page <input type="text" class="pageSelect" value="1"> of <span class="pageCount">1</span></div>
                    <button class="nextPage">&rarr;</button>
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
    });

    function getRequests()
    {
        let parameters = { "type" : "requests", "num" : getPerPage(), "page" : getPage(), "filter" : JSON.stringify(getFilter()) };

        let loading = document.createElement("div");
        loading.id = "resultInfo";
        loading.innerHTML = "Loading...";
        $("#tableEntries").appendChild(loading);

        let successFunc = function(response)
        {
            logInfo(response, true);
            clearElement("tableEntries");
            buildRequests(response);
        };

        let failureFunc = function(response)
        {
            $("#resultInfo").innerHTML = "Error loading requests. Please try again later. If this problem persists, contact the site administrator";
        }

        sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
    }

    function buildRequests(requests)
    {
        if (requests.count == 0)
        {
            let empty = document.createElement("div");
            empty.id = "resultInfo";
            empty.innerHTML = "No requests found with the current filter";
            $("#tableEntries").appendChild(empty);
            return;
        }

        let entries = $("#tableEntries");
        let sortOrder = getFilter().sort;
        let now = new Date();
        let tooltipDateOptions = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' };
        for (let i = 0; i < requests.count; ++i)
        {
            let request = requests.entries[i];

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

            let requestDate = document.createElement("span");
            requestDate.title = new Date(request.rd).toLocaleDateString('en-US', tooltipDateOptions);
            requestDate.innerHTML = `Requested: ${getDisplayDate(new Date(request.rd), now)}`;

            let updateDate = document.createElement("span");
            updateDate.title = new Date(request.ad).toLocaleDateString('en-us', tooltipDateOptions);
            updateDate.innerHTML = `Last Update: ${getDisplayDate(new Date(request.ad), now)}`;

            let requester = document.createElement("span");
            requester.innerHTML = `Requested By: ${request.r}`;

            let status = document.createElement("span");
            let statusVal = parseInt(request.a);
            let statusText = statusVal == 0 ? "Pending" : (statusVal == 1 ? "Complete" : "Denied");
            status.innerHTML = `Status: ${statusText}`;

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

            entries.appendChild(holder);
        }

        pages = getPerPage() == 0 ? 1 : Math.ceil(requests.total / getPerPage())
        $(".pageSelect").forEach(function(e)
        {
            e.value = getPage() + 1;
        });

        $(".pageCount").forEach(function(e)
        {
            e.innerHTML = pages;
        });


    }

    function getDisplayDate(date, now)
    {
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

    function setupFilter()
    {
        $(".filterImg").forEach(function(imgElement)
        {
            imgElement.addEventListener("click", function()
            {
                let overlay = document.createElement("div");
                overlay.id = "filterOverlay";
                let html = `
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
        <label for="sortOrder">Sort By: </label>
        <select name="sortBy" id="sortBy">
            <option value="rd">Request Date (newest first)</option>
            <option value="ra">Request Date (oldest first)</option>
            <option value="ud">Update Date (newest first)</option>
            <option value="ua">Update Date (oldest first)</option>
        </select>
    </div>
    <hr />
    <div class="formInput">
        <input type="button" value="Apply" id="applyFilter">
    </div>
</div>
`;
                overlay.innerHTML = html;
                overlay.style.opacity = "0";
                document.body.appendChild(overlay);
                document.body.addEventListener("keyup", function(e)
                {
                    let key = e.keyCode ? e.keyCode : e.which;
                    if (key == 27 /*esc*/)
                    {
                        let overlay = $("#filterOverlay");
                        if (overlay && overlay.style.opacity == "1")
                        {
                            Animation.queue({"opacity": 0}, overlay, 250, true);
                        }
                    }
                    else if (key == 13 /*enter*/ && e.ctrlKey)
                    {
                        let overlay = $("#filterOverlay");
                        if (overlay && overlay.style.opacity == "1")
                        {
                            $("#applyFilter").click();
                        }
                    }
                });

                overlay.addEventListener("click", function(e)
                {
                    let overlay = $("#filterOverlay");
                    if (e.target.id == "filterOverlay" && e.target.style.opacity == 1)
                    {
                        Animation.queue({"opacity": 0}, overlay, 250, true);
                    }
                });

                let filter = getFilter();
                $("#showPending").checked = filter.pending;
                $("#showComplete").checked = filter.complete;
                $("#showDeclined").checked = filter.declined;
                $("#sortBy").value = filter.sort;

                $("#applyFilter").addEventListener("click", function(e)
                {
                    setFilter(
                    {
                        "pending" : $("#showPending").checked,
                        "complete" : $("#showComplete").checked,
                        "declined" : $("#showDeclined").checked,
                        "sort" : $("#sortBy").value
                    }, true /*update*/);

                    let overlay = $("#filterOverlay");
                    if (overlay)
                    {
                        Animation.queue({"opacity": 0}, overlay, 250, true);
                    }
                });

                Animation.queue({"opacity": 1}, overlay, 250);
            });
        });
    }

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

    function previousPage()
    {
        let page = getPage();
        if (page <= 0)
        {
            return;
        }

        setPage(page - 1, true);
    }

    function nextPage()
    {
        let page = getPage();
        if (page == pages - 1)
        {
            return;
        }

        setPage(page + 1, true);
    }

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

    function setPage(page, update)
    {
        localStorage.setItem("page", page);
        if (update)
        {
            clearElement("tableEntries");
            getRequests();
        }
    }

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

        if (filter == null)
        {
            filter =
            {
                "pending" : true,
                "complete" : true,
                "declined" : true,
                "sort" : "rd"
            }

            setFilter(filter, false);
        }
        else if (!filter.hasOwnProperty("pending"))
        {
            filter.pending = true;
            setFilter(filter, false);
        }
        else if (!filter.hasOwnProperty("complete"))
        {
            filter.complete = true;
            setFilter(filter, false);
        }
        else if (!filter.hasOwnProperty("declined"))
        {
            filter.declined = true;
            setFilter(filter, false);
        }
        else if (!filter.hasOwnProperty("sort"))
        {
            filter.sort = "rd";
            setFilter(filter, false);
        }

        logVerbose(`Filter: ${JSON.stringify(filter)}`);
        return filter;
    }

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

    function $(selector)
    {
        if (selector.indexOf("#") === 0 && selector.indexOf(" ") === -1)
        {
            return document.querySelector(selector);
        }

        return document.querySelectorAll(selector);
    }

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
                        failFunc(response);
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
</script>
</html>