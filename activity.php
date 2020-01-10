<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin(TRUE /*redirect*/, "activities.php");
requireSSL();
?>

<!DOCTYPE html>
<html lang=en-us>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <title>Activity</title>

    <?php get_css("style", "nav", "table") ?>
    <style>
.newActivity {
    background-color: rgba(63, 100, 69, 0.3);
}
.newActivity:hover {
    background-color: rgba(63, 100, 69, 0.6);
}

    </style>
</head>
<body
    uid="<?= $_SESSION['id']; ?>"
    username="<?= $_SESSION['username']; ?>"
    admin="<?php echo ($_SESSION['level'] >= 100 ? 1 : 0); ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <?php include "includes/table.html" ?>
        </div>
    </div>
</body>
<script>
(function()
{
    window.addEventListener("load", function()
    {
        // For now, let people know this is still a work in progress, since it's "good enough"
        // but still needs some polish
        $("#currentPage").innerHTML = 'Activity (Work in Progress)';

        // For activities, reset the filter on page load
        setFilter(defaultFilter(), false /*update*/);

        setupPerPage();
        setupNavigation();
        getActivities();
        setupKeyboardNavigation();

        setupFilter();
    });

    function getActivities()
    {
        let parameters = { "type" : "activities", "num" : getPerPage(), "page" : getPage(), "filter" : JSON.stringify(getFilter()) };
        sendHtmlJsonRequest("process_request.php", parameters, buildActivities);
    }

    const Activity =
    {
        AddRequest : 1,
        AddComment : 2,
        StatusChange : 3
    }

    function buildActivities(activities, newActivities)
    {
        if (activities.count == 0)
        {
            logWarn("No results, likely due to bad page index or filter");
            displayInfoMessage("No requests found with the current filter");
            return;
        }

        logVerbose(activities);
        let entries = $("#tableEntries");

        for (let i = 0; i < activities.activities.length; ++i, --newActivities)
        {
            let activity = activities.activities[i];

            let holder = buildNode("div", {"class" : "tableEntryHolder"});
            if (newActivities > 0)
            {
                holder.classList.add("newActivity");
            }

            let imgHolder = buildNode("div", {"class" : "imgHolder"});
            let imgA = buildNode("a", {"href" : `request.php?id=${activity.rid}`});
            let img = buildNode("img", {"src" : `poster${activity.poster}`});

            if (activity.value == "ViewStream")
            {
                img.src = "poster/viewstream.png";
            }
            else if (!activity.poster)
            {
                img.src = "poster/moviedefault.png";
            }

            img.style.height = "80px";
            imgA.appendChild(img);
            imgHolder.appendChild(imgA);

            let textHolder = buildNode("div", {"class" : "textHolder"});
            let span = buildNode("span", {"class" : "tableEntryTitle"});

            let a = buildNode("a", {"href" : `request.php?id=${activity.rid}`});

            let name = activity.username == attrib("username") ? "You" : activity.username;
            let plainText;
            let linkText;

            switch (parseInt(activity.type))
            {
                case Activity.AddRequest:
                    if (activity.value == "ViewStream")
                    {
                        plainText = `${name} requested permission to `;
                        linkText = "view active streams";
                    }
                    else
                    {
                        plainText = `${name} added a request for `;
                        linkText = activity.value;
                    }

                    break;
                case Activity.AddComment:
                    plainText = `${name} added a comment to the request for `;
                    linkText = activity.value;
                    break;
                case Activity.StatusChange:
                    if (activity.username == attrib("username"))
                    {
                        plainText = `You changed the status of the request for ${activity.value} to `;
                        linkText = activity.status;
                    }
                    else
                    {
                        plainText = `The status of the request for ${activity.value} changed to `
                        linkText = activity.status;
                    }

                    break;
                default:
                    plainText = "Error getting activity details. ";
                    linkText = "Click here to view the request.";
                    logError(activity.type, "Unknown activity type");
                    break;
            }

            a.appendChild(buildNode("span", {}, linkText));
            span.appendChild(buildNode("span", {}, plainText));
            span.appendChild(a);
        
            let tooltipDateOptions = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' };
            let activityTime = buildNode("span",
                {"title" : new Date(activity.timestamp).toLocaleDateString('en-US', tooltipDateOptions)},
                getDisplayDate(new Date(activity.timestamp)));

            textHolder.appendChild(span);
            textHolder.appendChild(activityTime);

            holder.appendChild(imgHolder);
            holder.appendChild(textHolder);
            entries.appendChild(holder);
        }

        setPageInfo(activities.total);
    }

    /// <summary>
    /// Update the "Page X of Y" strings in the request table
    /// </summary>
    function setPageInfo(totalRequests)
    {
        pages = getPerPage() == 0 ? 1 : Math.ceil(totalRequests / getPerPage());
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
        $("#tableEntries").appendChild(buildNode("div", {"id" : "resultInfo"}, message));
    }

    function attrib(attribute)
    {
        return document.body.getAttribute(attribute);
    }

    /// <summary>
    /// Returns whether the current session user is an admin. Easily bypassable
    /// by modifying the DOM, but the backend is the source of truth and will block
    /// any unauthorized actions.
    /// </summary>
    function isAdmin()
    {
        return parseInt(attrib("admin")) === 1 ;
    }

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
            // For weeks do some extra approximation, as it's odd to see
            // "1 week ago" for something created 13 days ago
            let weeks = Math.floor((dayDiff + 3) / 7);
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
    /// Sets up the filter form and associated events.
    /// </summary>
    function setupFilter()
    {
        $(".filterBtn").forEach(function(imgElement)
        {
            imgElement.addEventListener("click", filterBtnClick);
        });
    }

    /// <summary>
    /// Launch the filter dialog and set up applicable event handlers
    /// </summary>
    function filterBtnClick()
    {
        let overlay = buildNode("div", {"id" : "filterOverlay"});
        overlay.id = "filterOverlay";
        overlay.appendChild(filterHtml());
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
        $("#showNew").checked = filter.type.new;
        $("#showComment").checked = filter.type.comment;
        $("#showStatus").checked = filter.type.status;
        $("#showMine").checked = filter.type.mine;
        $("#sortBy").value = filter.sort;
        $("#sortOrder").value = filter.order;

        if (isAdmin())
        {
            populateUserFilter();
        }

        // setSortOrderValues();
        // $("#sortBy").addEventListener("change", setSortOrderValues);

        $("#applyFilter").addEventListener("click", function()
        {
            setPage(0); // Go back to the start after applying a filter
            setFilter(
            {
                "type" :
                {
                    "new" : $("#showNew").checked,
                    "comment" : $("#showComment").checked,
                    "status" : $("#showStatus").checked,
                    "mine" : $("#showMine").checked
                },
                "sort" : $("#sortBy").value,
                "order" : $("#sortOrder").value,
                "user" : isAdmin() ? $("#filterTo").value : "-1"
            }, true /*update*/);

            dismissFilterDialog();
        });

        $("#cancelFilter").addEventListener("click", dismissFilterDialog);
        $("#resetFilter").addEventListener("click", function()
        {
            setPage(0); // Go back to the start after applying a filter
            setFilter(defaultFilter(), true);
            dismissFilterDialog();
        });

        Animation.queue({"opacity": 1}, overlay, 250);
        $("#showNew").focus();
    }


    /// <summary>
    /// Get a list of all the users to populate the admin-only filter option
    /// </summary>
    function populateUserFilter()
    {
        let params = { "type" : "members" };
        let successFunc = function(response)
        {
            response.sort(function(a, b)
            {
                return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
            });

            let select = $("#filterTo");
            response.forEach(function(user)
            {
                select.appendChild(buildNode("option", {"value" : user.id}, user.username));
            });

            select.value = getFilter().user;
        };

        let failureFunc = function()
        {
            Animation.queue({"backgroundColor": "rgb(100, 66, 69)"}, $("#filterTo"), 500);
            Animation.queueDelayed({"backgroundColor": "rgb(63, 66, 69"}, $("#filterTo"), 1000, 500, true);
        };

        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
    }

    /// <summary>
    /// HTML for the filter overlay/dialog. Should probably be part of the initial DOM
    /// </summary>
    function filterHtml()
    {
        let container = buildNode("div", {"id" : "filterContainer"});
        container.appendChild(buildNode("h3", {}, "Filter Options"));
        container.appendChild(buildNode("hr"));

        // Statuses + request types
        let labels = [
            "Show New Requests",
            "Show Comments",
            "Show Status Changes",
            "Show My Actions",
            ""];

        [
            "showNew",
            "showComment",
            "showStatus",
            "showMine",
            ""
        ].forEach(function(typ, index)
        {
            if (typ == "")
            {
                container.appendChild(buildNode("hr"));
                return;
            }

            let div = buildNode("div",
                {"class" : "formInput"},
                0,
                {
                    "click" : function(e)
                    {
                        // If we clicked the filter item, but not directly on the label/checkbox, pretend we did
                        if (e.target == this)
                        {
                            this.querySelector("input").click();
                        }
                    }
                });
            div.appendChild(buildNode("label", {"for" : typ}, labels[index] + ": "));
            div.appendChild(buildNode("input", {
                "type" : "checkbox",
                "name" : typ,
                "id" : typ
            }));
            container.appendChild(div);
        });

        let sortBy = buildNode("div", {"class" : "formInput"});
        sortBy.appendChild(buildNode("label", {"for" : "sortBy"}, "Sort By: "));
        let sortByFields = buildNode("select", {"name" : "sortBy", "id" : "sortBy"});
        labels = ["Date"];
        ["request"].forEach(function(category, index)
        {
            sortByFields.appendChild(buildNode("option", {"value": category}, labels[index]));
        });
        sortBy.appendChild(sortByFields);
        container.appendChild(sortBy);

        let sortOrder = buildNode("div", {"class" : "formInput"});
        sortOrder.appendChild(buildNode("label", {"for" : "sortOrder"}, "Sort  Order: "));
        let sortOrderFields = buildNode("select", {"name" : "sortOrder", "id" : "sortOrder"});
        sortOrderFields.appendChild(buildNode("option", {"value" : "desc", "id" : "sortDesc"}, "Newest First"));
        sortOrderFields.appendChild(buildNode("option", {"value" : "asc", "id" : "sortAsc"}, "Oldest First"));
        sortOrder.appendChild(sortOrderFields);
        container.appendChild(sortOrder);
        container.appendChild(buildNode("hr"));

        if (isAdmin())
        {
            let userSelect = buildNode("div", {"class" : "formInput"});
            userSelect.appendChild(buildNode("label", {"for" : "filterTo"}, "Filter To: "));
            let filterUser = buildNode("select", {"name" : "filterTo", "id" : "filterTo"});
            filterUser.appendChild(buildNode("option", {"value" : "-1"}, "All"));
            userSelect.appendChild(filterUser);
            container.appendChild(userSelect);
            container.appendChild(buildNode("hr"));
        }

        let buttonHolder = buildNode("div", {"class" : "formInput"});
        let innerButtonHolder = buildNode("div", {"class" : "filterButtons"});
        innerButtonHolder.appendChild(buildNode("input", {
            "type" : "button",
            "value" : "Cancel",
            "id" : "cancelFilter",
            "style" : "margin-right: 10px"
        }));
        innerButtonHolder.appendChild(buildNode("input", {
            "type" : "button",
            "value" : "Reset",
            "id" : "resetFilter",
            "style" : "margin-right: 10px"
        }));
        innerButtonHolder.appendChild(buildNode("input", {
            "type" : "button",
            "value" : "Apply",
            "id" : "applyFilter"
        }));

        buttonHolder.appendChild(innerButtonHolder);
        container.appendChild(buttonHolder);
        return container;
    }

    /// <summary>
    /// Retrieves the stored user filter (persists across page navigation, for better or worse)
    /// </summary>
    function getFilter()
    {
        let filter = null;
        try
        {
            filter = JSON.parse(localStorage.getItem("activityFilter"));
        }
        catch (e)
        {
            logError("Unable to parse stored filter");
        }

        if (filter == null ||
            !filter.hasOwnProperty("type") ||
                !filter.type.hasOwnProperty("new") ||
                !filter.type.hasOwnProperty("comment") ||
                !filter.type.hasOwnProperty("status") ||
                !filter.type.hasOwnProperty("mine") ||
            !filter.hasOwnProperty("sort") ||
            !filter.hasOwnProperty("order") ||
            !filter.hasOwnProperty("user"))
        {
            logError("Bad filter, resetting: ");
            logError(filter);
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
            "type" :
            {
                "new" : true,
                "comment" : true,
                "status" : true,
                "mine" : true
            },
            "sort" : "request",
            "order" : "desc",
            "user" : -1
        };

        return filter;
    }

    /// <summary>
    /// Sets the current filter. No validation, but some basic validation
    /// should exist when grabbing the filter from localStorage
    /// </summary>
    function setFilter(filter, update)
    {
        logVerbose(filter, "Setting filter to");
        localStorage.setItem("activityFilter", JSON.stringify(filter));
        if (update)
        {
            clearElement("tableEntries");
            getActivities();
        }
    }

    /// <summary>
    /// Returns the user's current page
    /// </summary>
    function getPage()
    {
        let page = parseInt(localStorage.getItem("activityPage"));
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
        localStorage.setItem("activityPage", page);
        if (update)
        {
            clearElement("tableEntries");
            getActivities();
        }
    }

    /// <summary>
    /// Returns the number of items per page the user wants to see
    /// </summary>
    function getPerPage()
    {
        let perPage = parseInt(localStorage.getItem("activityPerPage"));
        if (perPage == null || isNaN(perPage) || perPage % 25 != 0 || perPage < 0)
        {
            localStorage.setItem("activityPerPage", 25);
            perPage = 25;
        }

        return perPage;
    }

    /// <summary>
    /// Set the number of requests to show per page
    /// </summary>
    function setPerPage(newPerPage, update)
    {
        localStorage.setItem("activityPerPage", newPerPage);
        document.querySelectorAll(".perPageButton").forEach((btn) =>
        {
            btn.classList.remove("selected");
        });

        document.querySelectorAll(`.perPageButton[value="${newPerPage}"]`).forEach(function(e)
        {
            e.classList.add("selected");
        });

        if (update)
        {
            clearElement("tableEntries");
            getActivities();
        }
    }

    /// <summary>
    /// Sets up click handlers for per-page options
    /// </summary>
    function setupPerPage()
    {
        let perPage = getPerPage();

        document.querySelectorAll(".perPageButton").forEach((btn) =>
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
                        this.value = getPage() + 1;
                        this.select();
                        return;
                    }

                    setPage(page - 1, true);
                    this.select();
                }
            });

            input.addEventListener('focus', function()
            {
                this.select();
            });
        })
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

    function clearElement(id)
    {
        let element = $("#" + id);
        while (element.firstChild)
        {
            element.removeChild(element.firstChild);
        }
    }

    /// <summary>
    /// Helper method to create DOM elements.
    /// </summary>
    function buildNode(type, attrs, content, events)
    {
        let ele = document.createElement(type);
        if (attrs)
        {
            for (let [key, value] of Object.entries(attrs))
            {
                ele.setAttribute(key, value);
            }
        }

        if (events)
        {
            for (let [event, func] of Object.entries(events))
            {
                ele.addEventListener(event, func);
            }
        }

        if (content)
        {
            ele.innerHTML = content;
        }

        return ele;
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
    /// Generic method to sent an async request that expects JSON in return
    /// </summary>
    function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams, dataIsString)
    {
        let http = new XMLHttpRequest();
        http.open("POST", url, true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        const queryString = dataIsString ? parameters : buildQuery(parameters);
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
                logVerbose(response, `${url}${queryString}`);
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
                logError(ex);
                logError(this.responseText);
            }
        };

        http.send(queryString);
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
<?php get_js("consolelog", "animate", "queryStatus", "nav"); ?>
</html>