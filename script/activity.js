
window.addEventListener("load", function()
{
    // For activities, reset the filter on page load
    setFilter(defaultFilter(), false /*update*/);
    getActivities();
});

function getActivities(searchValue='')
{
    let parameters =
    {
        "type" : "activities",
        "num" : getPerPage(),
        "page" : getPage(),
        "search" : searchValue,
        "filter" : JSON.stringify(getFilter())
    };

    let successFunc = function(message)
    {
        clearElement("tableEntries");
        buildActivities(message);

        if (searchValue.length != 0)
        {
            $$('.searchBtn').click();
        }
    }

    let failureFunc = function()
    {
        displayInfoMessage("Error loading activities. Pleases trya again later. If this problem persists, contact the site administrator");
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

function tableSearch(value)
{
    getActivities(value);
}

const Activity =
{
    AddRequest : 1,
    AddComment : 2,
    StatusChange : 3
}

function buildActivities(response)
{
    if (response.count == 0)
    {
        logWarn("No results, likely due to bad page index or filter");
        displayInfoMessage("No requests found with the current filter");
        return;
    }

    let activities = response.activities;
    let newActivities = response.new;
    let total = response.total;

    logVerbose(response);
    let entries = $("#tableEntries");

    for (let i = 0; i < activities.length; ++i, --newActivities)
    {
        let activity = activities[i];

        let holder = buildNode("div", {"class" : "tableEntryHolder"});
        if (newActivities > 0)
        {
            holder.classList.add("newActivity");
        }

        let imgHolder = buildNode("div", {"class" : "imgHolder"});
        let imgA = buildNode("a", {"href" : `request.php?id=${activity.rid}`});
        let img = buildNode("img", {"src" : `poster${activity.poster}`, "alt" : "Poster"});

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

        let textHolder = buildNode("div", {"class" : "textHolder"/*, "style": "max-width: calc(100% - 70px"*/});
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
            {"tt" : new Date(activity.timestamp).toLocaleDateString('en-US', tooltipDateOptions)},
            DateUtil.getDisplayDate(new Date(activity.timestamp)),
            {
                'mousemove' : function(e) { showTooltip(e, this.getAttribute('tt')); },
                'mouseout' : dismissTooltip
            });

        textHolder.appendChild(span);
        textHolder.appendChild(activityTime);

        holder.appendChild(imgHolder);
        holder.appendChild(textHolder);
        entries.appendChild(holder);
    }

    setPageInfo(total);
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
/// Launch the filter dialog and set up applicable event handlers
/// </summary>
function launchFilter()
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
                        this.$$("input").click();
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

function tableIdentifier()
{
    return 'activity';
}

function tableUpdateFunc()
{
    return getActivities;
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
