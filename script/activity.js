/// <summary>
/// Logic to display notification/activities relevant to the current user. Implements tableCommon
/// </summary>

/* eslint-disable class-methods-use-this */
class ActivityTable extends Table
{
    supportsSearch() { return true; }
    identifier() { return "activity"; }
    updateFunc() { return getActivities; }
}

let activityTable;
window.addEventListener("load", function()
{
    activityTable = new ActivityTable(new ActivityFilter());

    // For activities, reset the filter on page load
    activityTable.filter.set(activityTable.filter.default(), false /*update*/);
    activityTable.setPage(0);
    activityTable.update();
});

/// <summary>
/// Get activities from the server, based on the current filter
/// </summary>
/// <param name="searchValue">Optional search term to further filter results based on substring matching</param>
function getActivities(searchValue="")
{
    posterMax = 0;
    let parameters =
    {
        type : ProcessRequest.GetActivities,
        num : activityTable.getPerPage(),
        page : activityTable.getPage(),
        search : searchValue,
        filter : JSON.stringify(activityTable.filter.get())
    };

    let successFunc = function(message)
    {
        activityTable.clear();
        buildActivities(message);

        if (searchValue.length != 0)
        {
            $$(".searchBtn").click();
        }
    };

    let failureFunc = function()
    {
        activityTable.displayInfoMessage(
            "Error loading activities. Pleases try again later. If this problem persists, contact the site administrator");
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Types of activities that are shown
/// </summary>
const Activity =
{
    AddRequest : 1,
    AddComment : 2,
    StatusChange : 3
};

/// <summary>
/// Gets the title of an activity, including a link to the relevant request
/// </summary>
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
            if (activity.status == "Deleted")
            {
                plainText = `${name} deleted the request for ${activity.value}.`;
            }
            else if (activity.username == attrib("username"))
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
            Log.error(activity.type, "Unknown activity type");
            break;
    }

    return { plain : plainText, link : linkText };
}

let posterMax = 0;
function onPosterLoaded()
{
    let width = getComputedStyle(this).width;
    width = parseInt(width.substring(0, width.length - 2));
    if (width > posterMax)
    {
        posterMax = width;
        $(".imgHolder").forEach(function(poster) { poster.style.width = width + "px"; });
    }
}

/// <summary>
/// Creates an activity for the activity table
/// </summary>
/// <param name="newActivity">True if the user has not seen this request yet</param>
function buildActivity(activity, newActivity)
{
    let holder = activityTable.itemHolder();
    if (newActivity)
    {
        holder.classList.add("newActivity");
    }

    let imgHolder = buildNode("div", { class : "imgHolder" });
    if (posterMax != 0)
    {
        imgHolder.style.width = posterMax + "px";
    }
    let imgA = buildNode("a", { href : `request.php?id=${activity.rid}` });

    // For audiobooks, the poster is taken directly from audible
    // TODO: cache audiobook posters via get_image.php
    let img = buildNode(
        "img",
        { src : activity.poster.startsWith("http") ? activity.poster : `poster${activity.poster}`, alt : "Poster" },
        0,
        {
            load : onPosterLoaded
        });

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

    let titleText = getTitleText(activity);
    span.appendChild(buildNode("span", {}, titleText.plain));

    let requestLink;
    if (titleText.link)
    {
        requestLink = buildNode("a", { href : `request.php?id=${activity.rid}` });
        requestLink.appendChild(buildNode("span", {}, titleText.link));
        span.appendChild(requestLink);
    }

    let activityTime = buildNode("span", {}, DateUtil.getDisplayDate(activity.timestamp));
    Tooltip.setTooltip(activityTime, DateUtil.getFullDate(activity.timestamp));

    holder.appendChildren(imgHolder, textHolder.appendChildren(span, activityTime));
    return holder;
}

/// <summary>
/// Builds the table of activities from the server response
/// </summary>
function buildActivities(response)
{
    if (response.count == 0)
    {
        Log.warn("No results, likely due to bad page index or filter");
        activityTable.displayInfoMessage("No requests found with the current filter");
        return;
    }

    let activities = response.activities;
    let newActivities = response.new;
    let total = response.total;

    Log.verbose(response);

    for (let i = 0; i < activities.length; ++i)
    {
        activityTable.addItem(buildActivity(activities[i], i < newActivities));
    }

    activityTable.setPageInfo(total);
}

/// <summary>
/// Shorthand accessor for attributes that are inserted into the body via PHP
/// </summary>
function attrib(attribute)
{
    return document.body.getAttribute(attribute);
}
