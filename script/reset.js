/// <summary>
/// Contains a form to reset a user's password, assuming a valid reset token has been provided
/// </summary>

window.addEventListener("load", function()
{
    setupResetForm();
});

/// <summary>
/// Returns the valid state of this request
///
/// Possible values:
///  1: Valid request
///  0: Request token expired
/// -1: Token not found
/// -2: Newer token available
/// </summary>
function valid()
{
    return parseInt(document.body.getAttribute("valid"));
}

/// <summary>
/// Return the password reset token
/// </summary>
function token()
{
    return document.body.getAttribute("token");
}

/// <summary>
/// Show a status message below the reset form
/// </summary>
function showStatus(message, error)
{
    let status = $("#formStatus");
    status.className = "formContainer " + (error ? "statusFail" : "statusSuccess");
    status.innerHTML = message;
    Animation.queue({ opacity : 1 }, status, 500);
    Animation.queueDelayed({ opacity : 0 }, status, 2000, 500);
}

/// <summary>
/// Show an error message when the reset request fails
/// </summary>
function statusError(message)
{
    showStatus(message, true);
}

/// <summary>
/// Do initial validation to ensure we have a valid password reset request
/// On failure, navigate to the home page (which will redirect to the login page)
/// </summary>
function preValidate()
{
    const goToIndex = () => { window.location = "index.php"; };
    switch (valid())
    {
        case -2:
            Overlay.show(
                "This token has been superseded by a newer reset token. Please use the new token or request another reset.",
                "Go Back",
                goToIndex,
                false);
            break;
        case -1:
            Overlay.show(
                "Invalid reset token",
                "Go Back",
                goToIndex,
                false);
            break;
        case 0:
            Overlay.show(
                "Reset token has expired",
                "Go Back",
                goToIndex,
                false);
            break;
        case 1:
            break;
        default:
            Overlay.show(
                "Something went wrong. Please try again later.",
                "Go Back",
                goToIndex,
                false);
            break;
    }
}

/// <summary>
/// Add the necessary event listeners to the reset form
/// </summary>
function setupResetForm()
{
    preValidate();

    let pass = $$("input[name='password']");
    let conf = $$("input[name='confirm']");
    if (valid() != 1)
    {
        pass.disabled = true;
        conf.disabled = true;
        return;
    }

    pass.addEventListener("focusout", focusOutEvent);
    conf.addEventListener("focusout", focusOutEvent);
    $$("input[type='button']").addEventListener("focusout", focusOutEvent);

    pass.addEventListener("focus", focusInEvent);
    conf.addEventListener("focus", focusInEvent);
    $$("input[type='button']").addEventListener("focus", focusInEvent);

    pass.addEventListener("keyup", keyUpEvent);
    conf.addEventListener("keyup", keyUpEvent);

    $("#go").addEventListener("click", resetPassword);
}

/// <summary>
/// Initiate a password reset
/// </summary>
function resetPassword()
{
    let pass = $("#password").value;
    let conf = $("#confirm").value;
    if (pass != conf)
    {
        statusError("Passwords do not match.");
        return;
    }

    const parameters = { type : ProcessRequest.ResetPassword, token : token(), password : pass, confirm : conf };
    let failureFunc = function(response)
    {
        statusError(response.Error);
    };

    let successFunc = function()
    {
        showStatus("Password changed! Redirecting...");
        setTimeout(() => { window.location = "login.php"; }, 1000);
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// If a suggestion form box is required and is empty when it loses
/// focus, change the background color to indicate the error
/// </summary>
function focusOutEvent()
{
    if (!this.value)
    {
        this.style.backgroundColor = "rgb(100, 66, 69)";
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

/// <summary>
/// Keyup listener for password inputs. Styles the confirmation
/// background depending on whether it equals the first password input
/// </summary>
function keyUpEvent(e)
{
    let key = e.which || e.keyCode;
    let pass = $$("input[name='password']");
    let conf = $$("input[name='confirm']");
    if (key !== KEY.ENTER)
    {
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
