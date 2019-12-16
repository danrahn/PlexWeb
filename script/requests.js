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
            clearElement("tableEntries");
            buildRequests(response);
        };

        let failureFunc = function()
        {
            displayInfoMessage("Error loading requests. Please try again later. If this problem persists, contact the site administrator");
        }

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
        let entries = $("#tableEntries");
        let sortOrder = getFilter().sort;
        for (let i = 0; i < requests.count; ++i)
        {
            const request = requests.entries[i];
            entries.appendChild(buildRequest(request, sortOrder));

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
        let holder = buildNode("div", {"class" : "tableEntryHolder"});

        let imgHolder = buildNode("div", {"class" : "imgHolder"});
        let imgA = buildNode("a", {"href" : `request.php?id=${request.rid}`});
        let img = buildNode("img", {"src" : `poster/${request.p}`});
        imgA.appendChild(img);
        imgHolder.appendChild(imgA);

        let textHolder = buildNode("div", {"class" : "textHolder"});

        let a = buildNode("a", {"class" : "tableEntryTitle", "href" : `request.php?id=${request.rid}`});
        a.appendChild(buildNode("span", {}, request.n));
        if (request.t == 1 || request.t == 2)
        {
            a.appendChild(buildNode("img", {
                "class" : "inlineIcon",
                "src" : `icon/${request.t == 1 ? "movie" : "tv"}icon.png`,
                "alt" : request.t == 1 ? "Movie" : "TV Show"
            }));
        }

        let tooltipDateOptions = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' };

        let requestDate = buildNode("span",
            {"title" : new Date(request.rd).toLocaleDateString('en-US', tooltipDateOptions)},
            `Requested: ${getDisplayDate(new Date(request.rd))}`);

        let updateDate = buildNode("span",
            {"title" : new Date(request.ad).toLocaleDateString('en-US', tooltipDateOptions)},
            `Last Update: ${getDisplayDate(new Date(request.ad))}`);

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
        return holder;
    }

    /// <symmary>
    /// Returns the HTML for a status combobox for request administration
    /// </summary>
    function getStatusSelection(statusHolder, rid, selected)
    {
        statusHolder.appendChild(buildNode("label", {"for" : `status_${rid}`}, status));
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
                clearElement("tableEntries");
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
        $("#tableEntries").appendChild(buildNode("div", {"id" : "resultInfo"}, message));
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
        $("#showPending").checked = filter.status.pending;
        $("#showComplete").checked = filter.status.complete;
        $("#showDeclined").checked = filter.status.declined;
        $("#showInProgress").checked = filter.status.inprogress;
        $("#showWaiting").checked = filter.status.waiting;
        $("#showMovies").checked = filter.type.movies;
        $("#showTV").checked = filter.type.tv;
        $("#showOther").checked = filter.type.other;
        $("#sortBy").value = filter.sort;
        $("#sortOrder").value = filter.order;

        if (isAdmin())
        {
            populateUserFilter();
        }

        setSortOrderValues();
        $("#sortBy").addEventListener("change", setSortOrderValues);

        $("#applyFilter").addEventListener("click", function()
        {
            setPage(0); // Go back to the start after applying a filter
            setFilter(
            {
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
        $("#showPending").focus();
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
        let container = buildNode("div", {"id" : "filterContainer"});
        container.appendChild(buildNode("h3", {}, "Filter Options"));
        container.appendChild(buildNode("hr"));

        // Statuses + request types
        let labels = [
            "Show Pending",
            "Show Waiting",
            "Show In Progress",
            "Show Complete",
            "Show Declined",
            "",
            "Show Movies",
            "Show TV",
            "Show Other"];

        [
            "showPending",
            "showWaiting",
            "showInProgress",
            "showComplete",
            "showDeclined",
            "",
            "showMovies",
            "showTV",
            "showOther"
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
        labels = ["Request Date", "Update Date", "Title"];
        ["request", "update", "title"].forEach(function(category, index)
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
    /// Set the number of requests to show per page
    /// </summary>
    function setPerPage(newPerPage, update)
    {
        localStorage.setItem("perPage", newPerPage);
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

    /// <summary>
    /// Sets the current filter. No validation, but some basic validation
    /// should exist when grabbing the filter from localStorage
    /// </summary>
    function setFilter(filter, update)
    {
        logVerbose(filter, "Setting filter to");
        localStorage.setItem("filter", JSON.stringify(filter));
        if (update)
        {
            clearElement("tableEntries");
            getRequests();
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
