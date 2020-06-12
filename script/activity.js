/* exported populateFilter, getNewFilter, filterHtml, tableSearch, tableIdentifier, tableUpdateFunc  */

window.addEventListener("load", function()
{
    // For activities, reset the filter on page load
    setFilter(defaultFilter(), false /*update*/);
    getActivities();
});

function getActivities(searchValue="")
{
    let parameters =
    {
        type : ProcessRequest.GetActivities,
        num : getPerPage(),
        page : getPage(),
        search : searchValue,
        filter : JSON.stringify(getFilter())
    };

    let successFunc = function(message)
    {
        clearTable();
        buildActivities(message);

        if (searchValue.length != 0)
        {
            $$(".searchBtn").click();
        }
    };

    let failureFunc = function()
    {
        displayInfoMessage("Error loading activities. Pleases try again later. If this problem persists, contact the site administrator");
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
};

function getTitleText(activity)
{

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
                plainText = `The status of the request for ${activity.value} changed to `;
                linkText = activity.status;
            }

            break;
        default:
            plainText = "Error getting activity details. ";
            linkText = "Click here to view the request.";
            logError(activity.type, "Unknown activity type");
            break;
    }

    return { plain : plainText, link : linkText };
}

function buildActivity(activity, newActivity)
{
    let holder = tableItemHolder();
    if (newActivity)
    {
        holder.classList.add("newActivity");
    }

    let imgHolder = buildNode("div", { class : "imgHolder" });
    let imgA = buildNode("a", { href : `request.php?id=${activity.rid}` });
    let img = buildNode("img", { src : `poster${activity.poster}`, alt : "Poster" });

    if (activity.value == "ViewStream")
    {
        img.src = "poster/viewstream.svg";
    }
    else if (!activity.poster)
    {
        img.src = "poster/moviedefault.svg";
    }

    img.style.height = "80px";
    imgA.appendChild(img);
    imgHolder.appendChild(imgA);

    let textHolder = buildNode("div", { class : "textHolder"/*, "style": "max-width: calc(100% - 70px"*/ });
    let span = buildNode("span", { class : "tableEntryTitle" });

    let requestLink = buildNode("a", { href : `request.php?id=${activity.rid}` });
    let titleText = getTitleText(activity);

    requestLink.appendChild(buildNode("span", {}, titleText.link));
    span.appendChild(buildNode("span", {}, titleText.plain));
    span.appendChild(requestLink);

    let activityTime = buildNode("span", {}, DateUtil.getDisplayDate(activity.timestamp));
    setTooltip(activityTime, DateUtil.getFullDate(activity.timestamp));

    textHolder.appendChild(span);
    textHolder.appendChild(activityTime);

    holder.appendChild(imgHolder);
    holder.appendChild(textHolder);
    return holder;
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

    for (let i = 0; i < activities.length; ++i)
    {
        addTableItem(buildActivity(activities[i], i < newActivities));
    }

    setPageInfo(total);
}

function attrib(attribute)
{
    return document.body.getAttribute(attribute);
}

/// <summary>
/// Returns whether the current session user is an admin. Easily bypassed
/// by modifying the DOM, but the backend is the source of truth and will block
/// any unauthorized actions.
/// </summary>
function isAdmin()
{
    return parseInt(attrib("admin")) === 1;
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
        "Show New Requests" : "showNew",
        "Show Comments" : "showComment",
        "Show Status Changes" : "showStatus",
        "Show My Actions" : "showMine"
    };

    for (let [label, name] of Object.entries(checkboxes))
    {
        options.push(buildTableFilterCheckbox(label, name));
    }

    options.push(buildTableFilterDropdown(
        "Sort By",
        {
            Date : "request"
        }));

    options.push(buildTableFilterDropdown(
        "Sort Order",
        {
            "Newest First" : "sortDesc",
            "Oldest First" : "sortAsc"
        },
        true /*addId*/));

    options.push(buildNode("hr"));

    if (isAdmin())
    {
        options.push(buildTableFilterDropdown(
            "Filter To",
            {
                All : -1
            }));

        options.push(buildNode("hr"));
    }

    return filterHtmlCommon(options);
}

function populateFilter()
{
    let filter = getFilter();
    $("#showNew").checked = filter.type.new;
    $("#showComment").checked = filter.type.comment;
    $("#showStatus").checked = filter.type.status;
    $("#showMine").checked = filter.type.mine;
    $("#sortBy").value = filter.sort;
    $("#sortOrder").value = filter.order == "desc" ? "sortDesc" : "sortAsc";

    if (isAdmin())
    {
        populateUserFilter();
    }
}

function getNewFilter()
{
    return {
        type :
        {
            new : $("#showNew").checked,
            comment : $("#showComment").checked,
            status : $("#showStatus").checked,
            mine : $("#showMine").checked
        },
        sort : $("#sortBy").value,
        order : $("#sortOrder").value == "sortDesc" ? "desc" : "asc",
        user : isAdmin() ? $("#filterTo").value : "-1"
    };
}

function tableIdentifier()
{
    return "activity";
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
        filter = JSON.parse(localStorage.getItem(tableIdCore() + "_filter"));
    }
    catch (exception)
    {
        logError("Unable to parse stored filter");
    }

    if (filter === null ||
        !Object.prototype.hasOwnProperty.call(filter, "type") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "new") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "comment") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "status") ||
            !Object.prototype.hasOwnProperty.call(filter.type, "mine") ||
        !Object.prototype.hasOwnProperty.call(filter, "sort") ||
        !Object.prototype.hasOwnProperty.call(filter, "order") ||
        !Object.prototype.hasOwnProperty.call(filter, "user"))
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
        type :
        {
            new : true,
            comment : true,
            status : true,
            mine : true
        },
        sort : "request",
        order : "desc",
        user : -1
    };

    return filter;
}
