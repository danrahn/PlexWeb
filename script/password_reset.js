
window.addEventListener("load", function()
{
    setupResetForm();
});

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
            status("Error: " + response.Error);
        };

        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
    });
}
