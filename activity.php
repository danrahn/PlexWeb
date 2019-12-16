<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin(TRUE /*redirect*/, "activities.php");
requireSSL();

update_last_seen();

/// <summary>
/// Update the 'last seen' activities time so we can correctly show the number of new activities for a user
/// </summary>
function update_last_seen()
{
    global $db;
    $uid = $_SESSION['id'];
    $query = "INSERT INTO `activity_status`
        (`user_id`, `last_viewed`) VALUES ($uid, NOW())
        ON DUPLICATE KEY UPDATE `last_viewed`=NOW()";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        error_and_exit(500, db_error());
    }
}
?>

<!DOCTYPE html>
<html lang=en-us>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <title>Activities</title>

    <?php get_css("style", "nav", "request") ?>
    <style>
.tableHolder {
    margin-top: 70px;
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
            <div class="tableHolder">
            </div>
        </div>
    </div>
</body>
<script>
(function()
{
    window.addEventListener("load", function()
    {
        logVerbose("Getting Activities");
        var http = new XMLHttpRequest();
        http.open('POST', 'process_request.php', true /*async*/);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.onreadystatechange = loadActivities;
        http.send('&type=activities');
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
            buildActivities(response.activities);
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

    function buildActivities(activities)
    {
        logVerbose(activities);
        let table = buildNode("table", {"id" : "activities"});
        appendHeaders(table);
        for (let i = 0; i < activities.length; ++i)
        {
            let activity = activities[i];
            logVerbose(`Activity UID: ${activity.uid}; Attrib UID: ${attrib("uid")}`);
            let name = activity.username == attrib("username") ? "You" : activity.username;
            let str;
            switch (parseInt(activity.type))
            {
                case Activity.AddRequest:
                    if (activity.value == "ViewStream")
                    {
                        str = `${name} requested permission to view active streams`;
                    }
                    else
                    {
                        str = `${name} added a request for ${activity.value}`;
                    }

                    appendRow("td", table, str, requestLink(activity.rid, activity.timestamp));
                    break;
                case Activity.AddComment:
                    str = `${name} added a comment on the request for ${activity.value}`;
                    appendRow("td", table, str, requestLink(activity.rid, activity.timestamp));
                    break;
                case Activity.StatusChange:
                    str = `${name} changed the status of the request for ${activity.value} to ${activity.status}`;
                    appendRow("td", table, str, requestLink(activity.rid, activity.timestamp));
                default:
                    logError(activity.type, "Unknown activity type");
            }
        }

        document.querySelector(".tableHolder").appendChild(table);
    }

    function requestLink(rid, text)
    {
        return buildNode("a", {"href" : `request.php?id=${rid}`}, text).outerHTML;
    }

    function attrib(attrib)
    {
        return document.body.getAttribute(attrib);
    }

    function appendHeaders(table)
    {
        appendRow("th", table, "Activity", "Timestamp");
    }

    function appendRow(type, table, ...values)
    {
        let row = buildNode("tr");
        values.forEach(function(value)
        {
            row.appendChild(buildNode(type, {}, value));
        });

        table.appendChild(row);
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

})();
</script>
<?php get_js("consolelog", "animate", "nav"); ?>
</html>