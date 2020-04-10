<?php

session_start();

require_once "includes/common.php";
requireSSL();
ieCheck();

if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === TRUE)
{
    header("location: index.php");
    exit;
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
            <div class="formTitle">Forgot your password? &nbsp; <span style="float: right; font-size: smaller">(<a href="login.php">No</a>)</span></div>
            <form id="loginForm">
                <hr />
                <div class="formInput"><label for="username">Username: </label><input type="text" name="username" id="username"></div>
                <div class="formInput"><input type="button" value="Continue" id="go"></input></div>
            </form>
            <hr />
            <div><a href="#" style="float:right;font-size:smaller" id="forgotUser">Forgot your username?</a></div>
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
        setupForgotForm();
    });

    function statusError(message)
    {
        let status = $("#formStatus");
        status.className = "formContainer statusFail";
        status.innerHTML = message;
        Animation.queue({"opacity" : 1}, status, 500);
        Animation.queueDelayed({"opacity" : 0}, status, 2000, 500);
    }

    function overlay(message, buttonText, buttonFunc)
    {
        buildOverlay(true /*dismissable*/,
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

    function setupForgotForm()
    {
        $("#go").addEventListener("click", function()
        {
            let username = $("#username").value;
            if (username.length == 0)
            {
                statusError("Username cannot be empty");
                return;
            }

            const parameters = { "type" : "forgot_password", "username" : username };
            let successFunc = function(response)
            {
                const fadeOut = () => Animation.queue({"opacity": 0}, $("#mainOverlay"), 250, true /*deleteAfterTransition*/);
                const navToLogin = () => window.location = "login.php";
                switch (response.Method)
                {
                    case -1:
                        statusError("Username does not exist. Would you like to <a href='register.php'>register</a>?");
                        break;
                    case 0:
                        overlay(
                            "No recovery options found! Please reach out to the administrator to get help recovering your account.",
                            "OK",
                            fadeOut);
                        break;
                    case 1:
                        overlay("A password reset link has been sent to your phone, and will be valid for 20 minutes.",
                            "OK",
                            navToLogin);
                        break;
                    case 2:
                        overlay("A password reset link has been sent to your email, and will be valid for 20 minutes.",
                            "OK",
                            navToLogin);
                        break;
                    case 3:
                        statusError("You have already requested a password reset recently. Please wait before requesting again.")
                        break;
                    case 4:
                        statusErorr("Something went wrong. Please try again later.");
                        break;
                    default:
                        statusError("Unknown response from server. Please try again later.");
                        break;
                }
            };

            sendHtmlJsonRequest("process_request.php", parameters, successFunc);
        });

        $("#forgotUser").addEventListener("click", function()
        {
            // From for phone# or email. If none, pop this
            buildOverlay(true /*dismissable*/,
                buildNode("div", {}, "Please reach out to the administrator to get help recovering your account."),
                buildNode(
                    "input",
                    {
                        "type" : "button",
                        "id" : "noRecovery",
                        "value" : "OK",
                        "style" : "width: 100px"
                    },
                    0,
                    {
                        "click" : () => Animation.queue({"opacity": 0}, $("#mainOverlay"), 250, true /*deleteAfterTransition*/)
                    }));
        })
    }

    // Copied from index.js. Should probably create a common js file...
    function buildOverlay(dismissable, ...children)
    {
        let overlay = buildNode("div",
            {
                "id" : "mainOverlay",
                "style" : "opacity: 0",
                "dismissable" : dismissable
            },
            0,
            {
                "click" : function(e)
                {
                    let overlay = $("#mainOverlay");
                    if (overlay &&
                        !!overlay.getAttribute("dismissable") &&
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
})();
</script>
</html>