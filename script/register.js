(function() {
    let usernameCheckTimer;
    hasUserChanged = true;
    window.addEventListener('load', function() {
        setupRegisterForm();
        usernameCheckTimer = setInterval(function() {
            let user = document.querySelector("input[name='username']");
            if (!user.value)
            {
                // No value, clear name
                if (user.focused)
                {
                    user.style.backgroundColor = "rgb(63, 66, 69)";
                }
            }
            else if (hasUserChanged)
            {
                // New username to check
                lastUsername = user.value;
                let http = new XMLHttpRequest();
                http.open('POST', 'process_request.php', true /*async*/);
                http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                http.onreadystatechange = function() {
                    if (this.readyState == 4 && this.status == 200)
                    {
                        try
                        {
                            let response = JSON.parse(this.responseText);
                            logVerbose(response);
                            if (response.value != '0' && response.value != '1')
                            {
                                logError(response);
                                return;
                            }

                            username = document.querySelector("input[name='username']");
                            if (lastUsername === username.value)
                            {
                                // Username hasn't changed
                                if (response.value == '1')
                                {
                                    // It's available!
                                    username.style.backgroundColor = "rgb(63, 100, 69)";
                                }
                                else
                                {
                                    // It exists!
                                    username.style.backgroundColor = "rgb(100, 66, 69)";
                                }
                            }
                        }
                        catch (ex)
                        {
                            logError(ex);
                            logError(this.responseText);
                        }

                    }
                }
                http.send(buildQuery({"type" : "check_username", "username" : user.value}));
            }

            hasUserChanged = false;
        }, 1000);
    });

    function verifyField(element) {
        if (!element.value) {
            flashField(element);
        }
    }

    function flashField(element) {
        Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, element, 500);
        Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, element, 500, 500);
    }

    /// <summary>
    /// Setup event handlers for the suggestion form
    /// </summary>
    function setupRegisterForm()
    {
        document.getElementById("go").addEventListener("click", function() {
            let user = document.querySelector("input[name='username']");
            let pass = document.querySelector("input[name='password']");
            let conf = document.querySelector("input[name='confirm']");
            verifyField(user);
            verifyField(pass);
            verifyField(conf);
            if (pass.value != conf.value) {
                flashField(conf);
                return;
            }

            if (!user.value || !pass.value) {
                return;
            }

            var http = new XMLHttpRequest();
            http.open("POST", "process_request.php", true /*async*/);
            http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            http.onreadystatechange = function() {
                if (this.readyState != 4 || this.status != 200) {
                    return;
                }

                try {
                    let response = JSON.parse(this.responseText);
                    logInfo(response, "Registration response");
                    let status = document.getElementById("formStatus");
                    if (response["Error"]) {
                        status.className = "formContainer statusFail";
                        status.innerHTML = response["Error"];
                        Animation.queue({"opacity" : 1}, status, 500);
                        Animation.queueDelayed({"opacity" : 0}, status, 5000, 1000);
                        return;
                    }

                    status.className = "formContainer statusSuccess";
                    status.innerHTML = "Success! Redirecting you to the <a href='login.php'>login page</a>";
                    Animation.queue({"opacity" : 1}, status, 500);
                    setTimeout(function() {
                        window.location = "login.php";
                    }, 2000);
                } catch (ex) {
                    logError(ex);
                    logError(this.responseText);
                }
            };
            
            http.send(buildQuery({"type" : "register", "username" : user.value, "password" : pass.value, "confirm" : conf.value}));
            
        });
        
        var inputs = document.querySelectorAll("input, select");
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener("keyup", function(e) {
                if (e.keyCode === 13 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                    document.getElementById("go").click();
                }
            });
        }
        
        let user = document.querySelector("input[name='username']");
        let pass = document.querySelector("input[name='password']");
        let conf = document.querySelector("input[name='confirm']");

        user.addEventListener("focusout", focusOutEvent);
        pass.addEventListener("focusout", focusOutEvent);
        conf.addEventListener("focusout", focusOutEvent);
        document.querySelector("input[type='button']").addEventListener("focusout", focusOutEvent);
        
        user.addEventListener("focus", focusInEvent);
        pass.addEventListener("focus", focusInEvent);
        conf.addEventListener("focus", focusInEvent);
        document.querySelector("input[type='button']").addEventListener("focus", focusInEvent);

        user.addEventListener("keyup", userKeyup);
        pass.addEventListener("keyup", keyDownEvent);
        conf.addEventListener("keyup", keyDownEvent);

        user.focus();
    }

    /// <summary>
    /// Builds up a query string, ensuring the components are encoded properly
    /// </summary>
    function buildQuery(parameters)
    {
        let queryString = "";
        for (parameter in parameters)
        {
            queryString += `&${parameter}=${encodeURIComponent(parameters[parameter])}`;
        }

        return queryString;
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

    function userKeyup()
    {
        hasUserChanged = true;
        this.style.backgroundColor = "rgb(63, 66, 69)";
    }

    function keyDownEvent(e) {
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
})();
