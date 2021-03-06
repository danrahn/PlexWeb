/// <summary>
/// Handles administrator password reset requests
/// </summary>

window.addEventListener("load", function()
{
    setupResetForm();
});

/// <summary>
/// Displays the result of a password reset request
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
/// Set up the password reset form handlers
/// </summary>
function setupResetForm()
{
    // Just let the backend deal with bad input. You're an admin, you should know what you're doing anyway
    $("#go").addEventListener("click", function()
    {
        let params =
        {
            type : ProcessRequest.PasswordResetAdmin,
            username : $("#username").value,
            email : $("#email").value
        };

        let successFunc = function()
        {
            showStatus("Reset link sent!", false);
        };

        let failureFunc = function(response)
        {
            showStatus("Error: " + response.Error);
        };

        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
    });
}
