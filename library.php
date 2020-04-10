<?php

session_start();


require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin();
$admin_page = TRUE;
if ($_SESSION['level'] < 100)
{
    error_and_exit(403);
}
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Library Management</title>
    <?php get_css("style", "nav", "table") ?>
    <style>
#sections {
    margin-top: 50px;
    color: #c1c1c1;
}

input[type=button] {
    float: none;
}
    </style>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <?php include "includes/table.html" ?>
    </div>
</div>
<?php get_js("consolelog", "animate", "querystatus", "tableCommon"); ?>
</body>
<script>
(function()
{
    function onBoot()
    {
        sendHtmlJsonRequest("administration.php", { "type" : "sections" }, buildSections);
    }

    function buildSections(sections)
    {
        let outerDiv = document.querySelector("#tableEntries");
        sections.forEach(function(section)
        {
            logInfo(section);
            section.created = new Date(section.created * 1000);
            section.updated = new Date(section.updated * 1000);
            section.last_scanned = new Date(section.last_scanned * 1000);
            let div = buildNode("div", {"class" : "sectionInfo tableEntryHolder"});
            let list = buildNode("ul");
            for (let [key, value] of Object.entries(section))
            {
                list.appendChild(buildNode("li", {}, `${key}: ${value}`));
            }

            list.appendChild(getRefreshNode(section['key']));

            div.appendChild(list);
            outerDiv.appendChild(div);
        });
    }

    function getRefreshNode(key)
    {
        let li = buildNode("li", {});
        let button = buildNode('input',
            {'type' : 'button', 'value' : 'refresh', 'section' : key, 'id' : 'section' + key },
            'Refresh', {'click' : refreshNode});
        li.appendChild(button);
        return li;
    }

    function refreshNode(e)
    {
        let key = this.getAttribute('section')
        let successFunc = function()
        {
            btn = document.getElementById('section' + key);
            Animation.fireNow({"backgroundColor" : new Color(63, 100, 69)}, btn, 500);
            Animation.queueDelayed({"backgroundColor" : new Color(63, 66, 69)}, btn, 2000, 500, true);
        };

        let failureFunc = function()
        {
            btn = document.getElementById('section' + key);
            Animation.fireNow({"backgroundColor" : new Color(100, 66, 69)}, btn, 500);
            Animation.queueDelayed({"backgroundColor" : new Color(63, 66, 69)}, btn, 2000, 500, true);
        };

        sendHtmlJsonRequest("administration.php", { "type" : "refresh", "section" : key}, successFunc, failureFunc);
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
    /// Generic method to sent an async request that expects JSON in return
    /// </summary>
    function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams)
    {
        let http = new XMLHttpRequest();
        http.open("POST", url, true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        let queryString = buildQuery(parameters);
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
                    logError(response.Error, `Error querying ${url}${queryString}`);
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
                logError(ex, "Exception");
                logError(ex.stack);
                logError(this.responseText, "Response Text");
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

    onBoot();
})();
</script>
</html>