
window.addEventListener("load", function()
{
    setupResetForm();
});

function status(message, error)
{
    let status = $("#formStatus");
    status.className = "formContainer " + (error ? "statusFail" : "statusSuccess");
    status.innerHTML = message;
    Animation.queue({"opacity" : 1}, status, 500);
    Animation.queueDelayed({"opacity" : 0}, status, 2000, 500);
}

function setupResetForm()
{
    // Just let the backend deal with bad input. You're an admin, you should know what you're doing anyway
    $("#go").addEventListener("click", function()
    {
        let params = {
            "type" : "forgot_password_admin",
            "username" : $("#username").value,
            "email" : $("#email").value
        };

        let successFunc = function() {
            status("Reset link sent!", false);
        };

        let failureFunc = function(response) {
            status("Error: " + response.Error);
        };

        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
    });
}
