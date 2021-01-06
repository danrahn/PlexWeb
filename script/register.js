/// <summary>
/// Handles registration process
/// </summary>

let hasUserChanged = true;
window.addEventListener("load", function()
{
    setupRegisterForm();
    setInterval(checkUsername, 1000);
});

/// <summary>
/// On successful username check, colors the username input
/// field red or green depending on whether it is available
/// </summary>
function onCheckUsernameResponse(response, request)
{
    let username = $$("input[name='username']");
    if (request.lastUsername !== username.value)
    {
        return;
    }

    // Username hasn't changed
    if (response.value == "1")
    {
        // It's available!
        username.style.backgroundColor = "rgb(63, 100, 69)";
        username.title = "Username available";
    }
    else
    {
        // It exists!
        username.style.backgroundColor = "rgb(100, 66, 69)";
        username.title = "Username already exists";
    }
}

/// <summary>
/// Send a request to determine if the username entered is available
/// </summary>
function checkUsername()
{
    let user = $$("input[name='username']");
    if (!user.value)
    {
        // No value, clear name
        if (user.focused)
        {
            user.style.backgroundColor = "rgb(63, 66, 69)";
        }

        hasUserChanged = false;
        return;
    }

    if (!hasUserChanged)
    {
        return;
    }

    let params =
    {
        type : ProcessRequest.CheckUsername,
        username : user.value
    };

    sendHtmlJsonRequest("process_request.php", params, onCheckUsernameResponse, undefined /*failureFunc*/, { lastUsername : user.value });

    hasUserChanged = false;
}

/// <summary>
/// Check if the given input element is empty, flashing
/// the background red if it is.
/// </summary>
function verifyField(element)
{
    if (!element.value)
    {
        flashField(element);
    }
}

/// <summary>
/// Flash the background of the given element
/// </summary>
function flashField(element)
{
    Animation.queue({ backgroundColor : new Color(140, 66, 69) }, element, 500);
    Animation.queueDelayed({ backgroundColor : new Color(100, 66, 69) }, element, 500, 500);
}

/// <summary>
/// Setup event handlers for the suggestion form
/// </summary>
function setupRegisterForm()
{
    $("#go").addEventListener("click", sendRegistration);

    let inputs = $("input, select");
    for (let i = 0; i < inputs.length; i++)
    {
        inputs[i].addEventListener("keyup", function(e)
        {
            if (e.keyCode === KEY.ENTER && !e.shiftKey && !e.ctrlKey && !e.altKey)
            {
                $("#go").click();
            }
        });
    }

    let user = $$("input[name='username']");
    let pass = $$("input[name='password']");
    let conf = $$("input[name='confirm']");

    user.addEventListener("focusout", focusOutEvent);
    pass.addEventListener("focusout", focusOutEvent);
    conf.addEventListener("focusout", focusOutEvent);
    $$("input[type='button']").addEventListener("focusout", focusOutEvent);

    user.addEventListener("focus", focusInEvent);
    pass.addEventListener("focus", focusInEvent);
    conf.addEventListener("focus", focusInEvent);
    $$("input[type='button']").addEventListener("focus", focusInEvent);

    user.addEventListener("keyup", userKeyup);
    pass.addEventListener("keyup", keyDownEvent);
    conf.addEventListener("keyup", keyDownEvent);

    user.focus();
}

/// <summary>
/// Register the given user
/// </summary>
function sendRegistration()
{
    let user = $$("input[name='username']");
    let pass = $$("input[name='password']");
    let conf = $$("input[name='confirm']");
    verifyField(user);
    verifyField(pass);
    verifyField(conf);
    if (pass.value != conf.value)
    {
        flashField(conf);
        return;
    }

    if (!user.value || !pass.value)
    {
        return;
    }

    let params =
    {
        type : ProcessRequest.Register,
        username : user.value,
        password : pass.value,
        confirm : conf.value
    };

    let successFunc = function()
    {
        let status = $("#formStatus");
        status.className = "formContainer statusSuccess";
        status.innerHTML = "Success! Redirecting you to the <a href='login.php'>login page</a>";
        Animation.queue({ opacity : 1 }, status, 500);
        setTimeout(function()
        {
            window.location = "login.php";
        }, 2000);
    };

    let failureFunc = function(response)
    {
        let status = $("#formStatus");
        status.className = "formContainer statusFail";
        status.innerHTML = response.Error;
        Animation.queue({ opacity : 1 }, status, 500);
        Animation.queueDelayed({ opacity : 0 }, status, 5000, 1000);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
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
/// Reset the username background when it changes
/// </summary>
function userKeyup()
{
    hasUserChanged = true;
    this.style.backgroundColor = "rgb(63, 66, 69)";
}

/// <summary>
/// Setup keydown handlers for password input.
/// Hide confirmation field when password field is empty,
/// and verify that the confirmation is the same as the password
/// </summary>
function keyDownEvent(e)
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

    if (pass.value.length == 0)
    {
        conf.parentNode.classList.remove("visibleInput");
        conf.parentNode.classList.add("hiddenInput");
    }
    else
    {
        conf.parentNode.style.display = "block";
        conf.parentNode.classList.remove("hiddenInput");
        conf.parentNode.classList.add("visibleInput");
    }

}
