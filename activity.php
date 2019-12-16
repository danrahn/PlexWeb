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

        logVerbose("Getting Activities");
        var http = new XMLHttpRequest();
        http.open('POST', 'process_request.php', true /*async*/);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.onreadystatechange = loadActivities;
        http.send('&type=activities&num=0&page=0&filter=""');
    });

    function loadActivities()
    {
        logVerbose(`loadActivities: readyState=${this.readyState}; status=${this.status}`);
        if (this.readyState != 4 || this.status != 200)
        {
            return;
        }

        try
        {
            let response = JSON.parse(this.responseText);
            if (response['Error'])
            {
                logError(response['Error'], "Error getting activities");
                return;
            }

            logVerbose(response, "process_request?type=activities");
            buildActivities(response.activities, response.new);
        }
        catch (ex)
        {
            logError(ex, "Exception");
            logError(ex.stack);
            logError(this.responseText, "response");
        }
    }

    const Activity =
    {
        AddRequest : 1,
        AddComment : 2,
        StatusChange : 3
    }

    function buildActivities(activities, newActivities)
    {
        logVerbose(activities);
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
    }

    function attrib(attribute)
    {
        return document.body.getAttribute(attribute);
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

})();
</script>
<?php get_js("consolelog", "animate", "queryStatus", "nav"); ?>
</html>