window.addEventListener('load', function()
{
    setupLoginForm();
});

/// <summary>
/// Setup event handlers for the suggestion form
/// </summary>
function setupLoginForm()
{
    document.getElementById("go").addEventListener("click", function()
    {
        let user = document.querySelector("input[name='username']");
        let pass = document.querySelector("input[name='password']");

        // Infallible client-side validation
        if (!user.value)
        {
            Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, user, 500);
            Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, user, 500, 500);
        }

        if (!pass.value)
        {
            Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, pass, 500);
            Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, pass, 500, 500);
        }

        if (!user.value || !pass.value) {
            return;
        }

        let params =
        {
            "type" : "login",
            "username" : user.value,
            "password" : pass.value
        };

        let successFunc = function()
        {
            if (window.location.href.indexOf("?") > 0)
            {
                let goto = window.location.href.substring(window.location.href.indexOf("return=") + 7);
                goto = decodeURIComponent(goto);
                window.location = goto;
                return;
            }

            window.location = "index.php";
        };

        let failureFunc = function(response)
        {
            let status = document.getElementById("formStatus");
            status.className = "formContainer statusFail";
            status.innerHTML = response["Error"];
            Animation.fireNow({"opacity" : 1}, status, 500);
            Animation.queueDelayed({"opacity" : 0}, status, 5000, 1000);
        };

        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
        
    });
    
    var inputs = document.querySelectorAll("input, select");
    for (var i = 0; i < inputs.length; i++)
    {
        inputs[i].addEventListener("keyup", function(e)
        {
            if (e.keyCode === 13 && !e.shiftKey && !e.ctrlKey && !e.altKey)
            {
                document.getElementById("go").click();
            }
        });
    }
    
    let user = document.querySelector("input[name='username']");
    let pass = document.querySelector("input[name='password']");

    user.addEventListener("focusout", focusOutEvent);
    pass.addEventListener("focusout", focusOutEvent);
    document.querySelector("input[type='button']").addEventListener("focusout", focusOutEvent);
    
    user.addEventListener("focus", focusInEvent);
    pass.addEventListener("focus", focusInEvent);
    document.querySelector("input[type='button']").addEventListener("focus", focusInEvent);

    user.focus();
}

/// <summary>
/// If a suggestion form box is required and is empty when it loses
/// focus, change the background color to indicate the error
/// </summary>
function focusOutEvent()
{
    if (!this.value)
    {
        this.className = "badInput";
        return;
    }
    else
    {
        this.className = "";
    }
}

/// <summary>
/// When a suggestion input is selected, highlight the border and clear
/// any background formatting
/// </summary>
function focusInEvent()
{
    this.className = "";
}
