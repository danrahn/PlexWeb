
window.addEventListener("load", function()
{
    setupForgotForm();
});

function statusError(message)
{
    let status = $("#formStatus");
    status.className = "formContainer statusFail";
    status.innerHTML = message;
    Animation.queue({ opacity : 1 }, status, 500);
    Animation.queueDelayed({ opacity : 0 }, status, 2000, 500);
}

function forgotCallback(response)
{
    const fadeOut = () => Animation.queue({ opacity : 0 }, $("#mainOverlay"), 250, true /*deleteAfterTransition*/);
    const navToLogin = () => { window.location = "login.php"; };
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
            statusError("You have already requested a password reset recently. Please wait before requesting again.");
            break;
        case 4:
            statusError("Something went wrong. Please try again later.");
            break;
        default:
            statusError("Unknown response from server. Please try again later.");
            break;
    }
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

        const parameters = { type : ProcessRequest.RequestPasswordReset, username : username };
        sendHtmlJsonRequest("process_request.php", parameters, forgotCallback);
    });

    $("#username").addEventListener("keydown", function(e)
    {
        if (e.keyCode == KEY.ENTER && !e.ctrlKey && !e.shiftKey && !e.altKey)
        {
            e.preventDefault();
            $("#go").click();
        }
    });

    $("#forgotUser").addEventListener("click", function()
    {
        // From for phone# or email. If none, pop this
        buildOverlay(true /*dismissible*/,
            buildNode("div", {}, "Please reach out to the administrator to get help recovering your account."),
            buildNode(
                "input",
                {
                    type : "button",
                    id : "noRecovery",
                    value : "OK",
                    style : "width: 100px"
                },
                0,
                {
                    click : () => Animation.queue({ opacity : 0 }, $("#mainOverlay"), 250, true /*deleteAfterTransition*/)
                }));
    });
}
