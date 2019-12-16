
(function() {
    window.addEventListener("load", function() {
        setupFormListeners();
    });

    const validEmailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    const changedColor = new Color(200, 150, 80);
    const successColor = new Color(100, 200, 80);
    const defaultForegroundColor = new Color(192, 189, 186);
    function setupFormListeners() {
        setupEmailListeners();
        setupPhoneListeners();
        setupLabelListeners();
        setupPwListeners();

        let checkboxes = document.querySelectorAll("input[type=checkbox]");
        for (let i = 0; i < checkboxes.length; ++i) {
            checkboxes[i].addEventListener("keydown", function(e) {
                e = e || window.event;
                const key = e.which || e.keyCode;
                if (key === 13) {
                    this.checked = !this.checked;
                    if (initialValues[this.id] != this.checked) {
                        this.parentNode.children[0].style.color = changedColor.toString();
                    } else {
                        this.parentNode.children[0].style.color = null;
                    }
                }
            });
        }

        setupSubmitButton();
        getCurrentValues();
    }

    let initialValues = {
        firstname: "",
        lastname: "",
        email: "",
        emailalerts: false,
        phone: "",
        phonealerts: false,
        carrier: ""
    };

    function getCurrentValues() {
        // Basic client-side validation is okay, now send it to the server
        logVerbose("Grabbing current user info");
        let http = new XMLHttpRequest();
        http.open("POST", "process_request.php", true /*async*/);
        http.setRequestHeader("Content-type", 'application/x-www-form-urlencoded');
        http.onreadystatechange = function() {
            if (this.readyState != 4 || this.status != 200) {
                return;
            }

            try {
                let response = JSON.parse(this.responseText);
                logInfo(response, "User settings");
                if (response["Error"]) {
                    logError(response["Error"]);
                    let error = document.getElementById("formError");
                    error.innerHTML = response["Error"];
                    error.style.display = "block";
                    Animation.queue({"opacity" : 1}, error, 500);
                    Animation.queuDelayedAnimation({"opacity" : 0}, error, 3000, 1000);
                    Animation.queue({"display" : "none"}, error);
                    return;
                }

                // Assume all of our values are correct here
                document.querySelector("input[name=firstname]").value = initialValues.firstname = response["firstname"];
                document.querySelector("input[name=lastname]").value = initialValues.lastname = response["lastname"];
                document.querySelector("input[name=emailalerts]").checked = initialValues.emailalerts = response["emailalerts"] != "0";
                if (document.querySelector("input[name=emailalerts]").checked) {
                    document.querySelector("input[name=email]").parentNode.style.display = "block";
                }

                document.querySelector("input[name=email]").value = initialValues.email = response["email"];
                emailChangeListenerCore(document.querySelector("input[name=email]"));
                document.querySelector("input[name=phonealerts]").checked = initialValues.phonealerts = response["phonealerts"] != "0";
                let phone = response["phone"];
                if (phone != "0") {
                    document.querySelector("input[name=phone]").value = initialValues.phone = phone;
                    phoneListenerCore(document.querySelector("input[name=phone]"));
                    phoneFocusListenerCore(document.querySelector("input[name=phone]"));
                }

                document.querySelector("select[name=carrier]").value = initialValues.carrier = response["carrier"];
                if (document.querySelector("input[name=phonealerts]").checked) {
                    document.querySelector("select[name=carrier]").parentNode.style.display = "block";
                    document.querySelector("input[name=phone").parentNode.style.display = "block";
                }
            } catch (ex) {
                logError(ex);
                logError(this.responseText);
            }
        }

        http.send(`&type=get_usr_info`);
    }

    function setupEmailListeners() {
        let email = document.querySelector("input[name=email]");
        let alerts = document.querySelector("input[name=emailalerts]");
        if (alerts.checked) {
            email.parentNode.style.display = "block";
        }

        email.addEventListener("input", emailChangeListener);
        alerts.addEventListener("change", function() {
            logVerbose("Email alerts changed to " + this.checked);
            document.querySelector("input[name=email]").parentNode.style.display = this.checked ? "block" : "none";
        })
    }

    function emailChangeListener() {
        emailChangeListenerCore(this);
    }

    function emailChangeListenerCore(ele) {
        if (ele.value.match(validEmailRegex)) {
            logVerbose("valid email found");
            ele.style.backgroundColor = null;
        } else {
            logVerbose("Invalid email");
            ele.style.backgroundColor = ele.value ? "rgb(100, 66, 69)" : null;
        }
    }

    function setupPhoneListeners() {
        let phone = document.querySelector("input[name=phone]");
        let alerts = document.querySelector("input[name=phonealerts]");
        let digits = phone.value.replace(/[^\d]/g, "");

        // Needs to be 10 digits (11-digit international numbers don't seem to work)
        if (digits.length === 10) {
            logVerbose("Valid phone");
            alerts.parentNode.style.display = "block";
        }

        if (alerts.checked) {
            document.querySelector("select[name=carrier]").parentNode.style.display = "block";
            phone.parentNode.style.display = "block";
        }

        phone.addEventListener("input", phoneListener);

        phone.addEventListener("focusout", phoneFocusListener);

        alerts.addEventListener("change", function() {
            logVerbose("Phone alerts changed to " + this.checked);

            document.querySelector("select[name=carrier]").parentNode.style.display = this.checked ? "block" : "none";
            document.querySelector("input[name=phone]").parentNode.style.display = this.checked ? "block" : "none";
        });
    }

    function phoneListener() {
        phoneListenerCore(this);
    }

    function phoneListenerCore(ele) {
        let digit = ele.value ? ele.value.replace(/[^\d]/g, "") : "";
        if (digit.length !== 10) {
            logVerbose("Invalid phone");
            ele.style.backgroundColor = ele.value ? "rgb(100, 66, 69)" : null;
        } else {
            logVerbose("Valid phone");
            ele.style.backgroundColor = null;
        }
    }

    function phoneFocusListener() {
        phoneFocusListenerCore(this);
    }

    function phoneFocusListenerCore(ele) {
        let digit = ele.value.replace(/[^\d]/g, "");
        logVerbose("Phone focus changed, attempting to format");
        if (digit.length === 10) {
            ele.value = "(" + digit.substring(0, 3) + ") " + digit.substring(3, 6) + "-" + digit.substring(6);
        }
    }

    function setupLabelListeners() {
        let inputs = [
            document.querySelector("input[name=firstname]"),
            document.querySelector("input[name=lastname]"),
            document.querySelector("input[name=email]"),
            document.querySelector("input[name=emailalerts]"),
            document.querySelector("input[name=phone]"),
            document.querySelector("input[name=phonealerts]"),
            document.querySelector("select[name=carrier]")
        ];

        for (let i = 0; i < inputs.length; ++i) {
            inputs[i].addEventListener("input", function() {
                let val = this.id == "phone" ? this.value.replace(/[^\d]+/g, "") : this.type.toLowerCase() == "checkbox" ? this.checked : this.value;
                if (initialValues[this.id] != val) {
                    if (!this.getAttribute("changed") || this.getAttribute("changed") == "false") {
                        logVerbose(this.id + " different from original");
                    }
                    this.parentNode.children[0].style.color = changedColor.toString();
                    this.setAttribute("changed", true);
                } else {
                    if (this.getAttribute("changed")) {
                        logVerbose(this.id + " same as original");
                    }
                    this.parentNode.children[0].style.color = null;
                    this.setAttribute("changed", false);
                }
            });
        }
    }

    function setupSubmitButton() {
        let submit = document.getElementById("go");
        submit.addEventListener("click", function() {
            logInfo("Submitting user info changes");
            let valid = true;
            let phone = document.querySelector("input[name=phone]");
            let phonealerts = document.querySelector("input[name=phonealerts]").checked;
            let digits = phone.value.replace(/[^\d]/g, "");
            if (phonealerts)
            {
                if (digits.length !== 10) {
                    valid = false;
                    Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, phone, 500);
                    Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, phone, 500, 500);
                }
            }
            else if (digits.length !== 10)
            {
                // Blank out phone value if phonealerts are disabled and the current value is invalid
                phone.value = "";
            }


            let email = document.querySelector("input[name=email]");
            if (document.querySelector("input[name=emailalerts]").checked)
            {
                if (!email.value.match(validEmailRegex)) {
                    valid = false;
                    Animation.queue({"backgroundColor": new Color(140, 66, 69)}, email, 500);
                    Animation.queueDelayed({"backgroundColor": new Color(100, 66, 69)}, email, 500, 500);
                }
            }
            else if (!email.value.match(validEmailRegex))
            {
                email.value = "";
            }

            if (valid) {
                // Basic client-side validation is okay, now send it to the server
                let http = new XMLHttpRequest();
                http.open("POST", "process_request.php", true /*async*/);
                http.setRequestHeader("Content-type", 'application/x-www-form-urlencoded');
                http.onreadystatechange = function() {
                    if (this.readyState != 4 || this.status != 200) {
                        return;
                    }

                    try {
                        let response = JSON.parse(this.responseText);
                        logInfo(response, "Update user settings response");
                        if (response["Error"]) {
                            logError(response["Error"]);
                            let error = document.getElementById("formError");
                            error.innerHTML = response["Error"];
                            error.style.display = "block";
                            Animation.queue({"opacity" : 1}, error, 500);
                            Animation.queueDelayed({"opacity" : 0}, error, 3000, 500);
                            Animation.queue({"display" : "none"}, error);
                        } else {
                            let inputs = [
                                document.querySelector("input[name=firstname]"),
                                document.querySelector("input[name=lastname]"),
                                document.querySelector("input[name=email]"),
                                document.querySelector("input[name=emailalerts]"),
                                document.querySelector("input[name=phone]"),
                                document.querySelector("input[name=phonealerts]"),
                                document.querySelector("select[name=carrier]")
                            ];

                            inputs.forEach(function(element) {
                                if (element.getAttribute("changed") == "true") {
                                    Animation.queue({"color" : successColor}, element.parentNode.children[0], 500);
                                    Animation.queueDelayed({"color" : defaultForegroundColor}, element.parentNode.children[0], 500, 500, true /*deleteAfterTransition*/);
                                    element.setAttribute("changed", false);
                                    initialValues[element.id] = ((this.type && this.type.toLowerCase() == "checkbox") ? this.checked : this.value);
                                }
                            });
                        }
                    } catch (ex) {
                        logError(ex);
                        logError(this.responseText);
                    }
                }

                http.send(buildQuery(
                {
                    "type" : "set_usr_info",
                    "fn"   : getField("firstname"),
                    "ln"   : getField("lastname"),
                    "e"    : getField("email"),
                    "ea"   : getField("emailalerts", "checked"),
                    "p"    : getField("phone").replace(/[^\d]/g, ""),
                    "pa"   : getField("phonealerts", "checked"),
                    "c"    : getField("carrier", "value", "select")
                }));
            }
        });
    }

    function getField(name, field="value", type="input") {
        return document.querySelector(type + "[name=" + name + "]")[field];
    }

    function setupPwListeners() {
        document.querySelectorAll("#pwForm input").forEach(function(e) {
            e.addEventListener("keydown", function(e) {
                if (e.keyCode == 13 && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    document.querySelector("#pwGo").click();
                }
            });
        });

        document.querySelector("#newPassConf").addEventListener("input", function() {
            if (this.value && this.value != document.querySelector("#newPass").value) {
                this.style.backgroundColor = "rgb(100, 66, 69)";
            } else {
                this.style.backgroundColor = "";
            }
        });

        // If the field is red due to a blank entry upon submission, clear it out on the next input
        document.querySelector("#newPass").addEventListener("input", function() {
            this.style.backgroundColor = "";
        });
        document.querySelector("#oldPass").addEventListener("input", function() {
            this.style.backgroundColor = "";
        });

        document.querySelector("#pwGo").addEventListener("click", function() {
            submitPasswordChange();
        });
    }

    function submitPasswordChange() {
        let oldPass = document.querySelector("#oldPass");
        let newPass = document.querySelector("#newPass");
        let conf = document.querySelector("#newPassConf");

        if (!verifyFields(oldPass, newPass, conf)) {
            return;
        }

        if (newPass.value != conf.value) {
            flashField(conf);
            return;
        }

        var http = new XMLHttpRequest();
        http.open("POST", "process_request.php", true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.onreadystatechange = function() {
            if (this.readyState != 4 || this.status != 200) {
                return;
            }

            try {
                let response = JSON.parse(this.responseText);
                logInfo(response, "Password change response");
                let status = document.getElementById("formStatus");
                if (response["Error"]) {
                    status.className = "formContainer statusFail";
                    status.innerHTML = response["Error"];
                    Animation.queue({"opacity" : 1}, status, 500);
                    Animation.queueDelayed({"opacity" : 0}, status, 5000, 1000);
                    return;
                }

                status.className = "formContainer statusSuccess";
                status.innerHTML = "Password changed!";
                Animation.queue({"opacity" : 1}, status, 500);
                Animation.queueDelayed({"opacity" : 0}, status, 2000, 500);
            } catch (ex) {
                logError(ex);
                logError(this.responseText);
            }
        }

        http.send(buildQuery(
        {
            "type" : "update_pass",
            "old_pass" : oldPass.value,
            "new_pass" : newPass.value,
            "conf_pass" : conf.value
        }));
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

    function verifyFields(...fields) {
        ret = true;
        for (index in fields) {
            ret = ret & verifyField(fields[index]);
        }

        return ret;
    }

    function verifyField(field) {
        if (!field.value) {
            flashField(field);
        }

        return !!field.value;
    }

    function flashField(field) {
        Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, field, 500);
        Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, field, 500, 500);
    }
})();