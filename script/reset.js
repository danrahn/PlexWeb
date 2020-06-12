window.addEventListener("load", function()
{
    setupResetForm();
});

function valid()
{
    return parseInt(document.body.getAttribute("valid"));
}

function token()
{
    return document.body.getAttribute("token");
}

function showStatus(message, error)
{
    let status = $("#formStatus");
    status.className = "formContainer " + (error ? "statusFail" : "statusSuccess");
    status.innerHTML = message;
    Animation.queue({ opacity : 1 }, status, 500);
    Animation.queueDelayed({ opacity : 0 }, status, 2000, 500);
}

function statusError(message)
{
    showStatus(message, true);
}

function preValidate()
{
    const goToIndex = () => { window.location = "index.php"; };
    switch (valid())
    {
        case -2:
            overlay(
                "This token has been superseded by a newer reset token. Please use the new token or request another reset.",
                "Go Back",
                goToIndex,
                false);
            break;
        case -1:
            overlay(
                "Invalid reset token",
                "Go Back",
                goToIndex,
                false);
            break;
        case 0:
            overlay(
                "Reset token has expired",
                "Go Back",
                goToIndex,
                false);
            break;
        case 1:
            break;
        default:
            overlay(
                "Something went wrong. Please try again later.",
                "Go Back",
                goToIndex,
                false);
            break;
    }
}

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
