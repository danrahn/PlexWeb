<?php

session_start();

require_once "includes/common.php";
require_once "includes/config.php";
requireSSL();
ieCheck();

if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === TRUE)
{
    header("location: index.php");
    exit;
}

$token = try_get("token");
if (!$token)
{
    header("location: forgot.php");
    exit;
}

$valid = validate_request($token);

function validate_request($token)
{
    global $db;
    $query = "SELECT user_id, CONVERT_TZ(timestamp, @@session.time_zone, '+00:00') AS `utc_timestamp` FROM `password_reset` WHERE token='$token'";

    $result = $db->query($query);
    if (!$result || $result->num_rows != 1)
    {
        return -1;
    }

    $row = $result->fetch_assoc();
    $timestamp = new DateTime($row['utc_timestamp']);
    $now = new DateTime(date('Y-m-d H:i:s'));
    $diff = $now->getTimestamp() - $timestamp->getTimestamp();
    if ($diff < 0 || $diff > 20 * 60) // 20 minute timeout
    {
        return 0;
    }

    $id = $row['user_id'];
    $query = "SELECT `token` FROM `password_reset` WHERE `user_id`=$id ORDER BY `timestamp` DESC";
    if ($result && $result->fetch_row()[0] != $token)
    {
        return -2;
    }

    return 1;
}
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Reset Password</title>
    <?php get_css("style") ?>
    <style>
#mainOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0,0,0,0.6);
}

#overlayContainer {
    margin: auto;
    width: auto;
    height: auto;
    padding: 20px;
    background-color: rgba(0,0,0,0.3);
    color: rgb(196, 196, 196);
    margin-top: 25vh;
}

#overlayContainer div {
    padding-bottom: 20px;
    margin: auto;
    display: block;
    text-align: center;
}

#overlayContainer textarea {
    display: block;
    width: 50%;
    min-width: 200px;
    margin: auto;
    float: none;
    height: 50px;
}

#overlayContainer input {
    display: block;
    float: none;
    margin: auto;
    margin-top: 10px;
    padding: 10px;
}
    </style>
</head>
<body>

<div id="plexFrame">
    <div id="container">
        <div id="login" class="formContainer">
            <div class="formTitle">Password Reset<span style="float: right; font-size: smaller">(<a href="login.php">Login</a>)</span></div>
            <form id="loginForm">
                <hr />
                <div class="formInput"><label for="password">New Password: </label><input type="password" name="password" id="password"></div>
                <div class="formInput"><label for="confirm">Confirm Password: </label><input type="password" name="confirm" id="confirm"></div>
                <div class="formInput"><input type="button" value="Reset Password" id="go"></input></div>
            </form>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
<?php get_js("consolelog", "animate"); ?>
</body>
<script>
(function() {
    window.addEventListener('load', function()
    {
        setupResetForm();
    });

    function valid()
    {
        return <?= $valid ?>;
    }

    function token()
    {
        return "<?= $token ?>";
    }

    function status(message, error)
    {
        let status = $("#formStatus");
        status.className = "formContainer " + (error ? "statusFail" : "statusSuccess");
        status.innerHTML = message;
        Animation.queue({"opacity" : 1}, status, 500);
        Animation.queueDelayed({"opacity" : 0}, status, 2000, 500);
    }

    function statusError(message)
    {
        status(message, true);
    }

    function overlay(message, buttonText, buttonFunc, dismissable=true)
    {
        buildOverlay(dismissable,
            buildNode("div", {}, message),
            buildNode(
                "input",
                {
                    "type" : "button",
                    "id" : "overlayBtn",
                    "value" : buttonText,
                    "style" : "width: 100px"
                },
                0,
                {
                    "click" : buttonFunc
                }
            )
        );
    }

    function setupResetForm()
    {
        switch (valid())
        {
            case -2:
                overlay(
                    "This token been superseded by a newer reset token. Please use the new token or request another reset.",
                    "Go Back",
                    () => window.location = "index.php",
                    false);
            case -1:
                overlay(
                    "Invalid reset token",
                    "Go Back",
                    () => window.location = "index.php",
                    false);
                break;
            case 0:
                overlay(
                    "Reset token has expired",
                    "Go Back",
                    () => window.location = "index.php",
                    false);
                break;
            case 1:
                break;
            default:
                overlay(
                    "Something went wrong. Please try again later.",
                    "Go Back",
                    () => window.location = "index.php",
                    false);
                break;
        }

        let pass = document.querySelector("input[name='password']");
        let conf = document.querySelector("input[name='confirm']");
        if (valid() != 1)
        {
            pass.disabled = true;
            conf.disabled = true;
            return;
        }

        pass.addEventListener("focusout", focusOutEvent);
        conf.addEventListener("focusout", focusOutEvent);
        document.querySelector("input[type='button']").addEventListener("focusout", focusOutEvent);

        pass.addEventListener("focus", focusInEvent);
        conf.addEventListener("focus", focusInEvent);
        document.querySelector("input[type='button']").addEventListener("focus", focusInEvent);

        pass.addEventListener("keyup", keyUpEvent);
        conf.addEventListener("keyup", keyUpEvent);

        $("#go").addEventListener("click", resetPassword);
    }

    function resetPassword()
    {
        let pass = $("#password").value;
        let conf = $("#confirm").value;
        if (pass != conf)
        {
            statusError("Passwords do not match.");
            return;
        }

        const parameters = { "type" : "reset_password", "token" : token(), "password" : pass, "confirm" : conf };
        let failureFunc = function(response)
        {
            statusError(response.Error);
        };

        let successFunc = function(response)
        {
            status("Password changed! Redirecting...");
            setTimeout(() => window.location = "login.php", 1000);
        };

        sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
    }

    // Copied from index.js. Should probably create a common js file...
    function buildOverlay(dismissable, ...children)
    {
        let overlay = buildNode("div",
            {
                "id" : "mainOverlay",
                "style" : "opacity: 0",
                "dismissable" : dismissable ? 1 : 0
            },
            0,
            {
                "click" : function(e)
                {
                    let overlay = $("#mainOverlay");
                    if (overlay &&
                        !!parseInt(overlay.getAttribute("dismissable")) &&
                        e.target.id == "mainOverlay" &&
                        e.target.style.opacity == 1)
                    {
                        Animation.queue({"opacity": 0}, overlay, 250, true /*deleteAfterTransition*/);
                    }
                }
            });

        let container = buildNode("div", {"id" : "overlayContainer"});
        children.forEach(function(element)
        {
            container.appendChild(element);
        });

        overlay.appendChild(container);
        document.body.appendChild(overlay);
        Animation.queue({"opacity" : 1}, overlay, 250);
    }

    /// <summary>
    /// If a suggestion form box is required and is empty when it loses
    /// focus, change the background color to indicate the error
    /// </summary>
    function focusOutEvent()
    {
        if (!this.value) {
            this.style.backgroundColor = "rgb(100, 66, 69)";
            return;
        }
    }

    /// <summary>
    /// When a suggestion input is selected, highlight the border and clear
    /// any background formatting
    /// </summary>
    function focusInEvent()
    {
        this.style.backgroundColor = "rgb(63, 66, 69)";
    }

    function keyUpEvent(e) {
        let key = e.which || e.keyCode;
        var pass = document.querySelector("input[name='password']");
        var conf = document.querySelector("input[name='confirm']");
        if (key !== 13) {
            if (conf.value && pass.value !== conf.value)
            {
                conf.style.backgroundColor = "rgb(100, 66, 69)";
            }
            else
            {
                conf.style.backgroundColor = "rgb(63, 66, 69)";
            }
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

        let sanitized = sanitize(parameters);

        http.onreadystatechange = function()
        {
            if (this.readyState != 4 || this.status != 200)
            {
                return;
            }

            try
            {
                let response = JSON.parse(this.responseText);
                logVerbose(response, `${url}${sanitized}`);
                if (response.Error)
                {
                    logError(response.Error, `Error querying ${url}${sanitized}`);
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

    function sanitize(parameters)
    {
        let sanitized = {};
        for (let param in parameters)
        {
            if (param == "password" || param == "confirm")
            {
                sanitized[param] = "********";
            }
            else
            {
                sanitized[param] = parameters[param];
            }
        }

        return buildQuery(sanitized);
    }
})();
</script>
</html>