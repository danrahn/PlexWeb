<?php

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin();
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
    <title>Administration</title>
    <?php get_css("style", "nav") ?>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="resetContainer">
            <div id="manual_reset" class="formContainer" style="width:50%;min-width:500px">
                <div class="formTitle">Manual User Password Reset</div>
                <form id="resetForm">
                    <div class="formInput"><label for="username">Username: </label><input type="text" name="username" id="username"></div>
                    <div class="formInput"><label for="email">Email: </label><input type="text" name="email" id="email"></div>
                    <div class="formInput"><input type="button" value="Go" id="go" style="float:right"></input></div>
                </form>
            </div>
            <div id="formStatus" class="formContainer"></div>
        </div>
    </div>
</div>
<?php get_js("consolelog", "animate", "querystatus"); ?>
</body>
<script>
(function()
{
    function onBoot()
    {
        setupResetForm();
    }

    function status(message, error)
    {
        let status = document.querySelector("#formStatus");
        status.className = "formContainer " + (error ? "statusFail" : "statusSuccess");
        status.innerHTML = message;
        Animation.queue({"opacity" : 1}, status, 500);
        Animation.queueDelayed({"opacity" : 0}, status, 2000, 500);
    }

    function setupResetForm()
    {
        // Just let the backend deal with bad input. You're an admin, you should know what you're doing anyway
        document.querySelector("#go").addEventListener("click", function()
        {
            let params = {
                "type" : "forgot_password_admin",
                "username" : document.querySelector("#username").value,
                "email" : document.querySelector("#email").value
            };

            let successFunc = function() {
                status("Reset link sent!", false);
            };

            let failureFunc = function(response) {
                status("Error: " + respone.Error);
            };

            sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
        });
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