<?php
session_start();
require_once "includes/common.php";
verify_loggedin(TRUE /*redirect*/);
requireSSL();
?>

<html>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=ISO-8859-1">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="shortcut icon" href="favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Web - User Information</title>
    <style>
#formError {
  background-color: rgb(100, 66, 69);
  color: #c1c1c1;
  border-radius: 5px;
  text-align: center;
  opacity: 0;
  width: 30%;
  max-width: 400px;
  margin-top: 20px;
}

input[type=checkbox] {
    appearance: none;
    -webkit-appearance: none;
    padding: 7px;
    display: inline-block;
    position: relative;
}

input[type=checkbox]:checked {
    background-color: rgb(192, 189, 186);
}

input[type=checkbox]:focus {
    outline: none;
    border: 1px solid rgb(255, 127, 0);
}
    </style>
    <script src="resource/consolelog.js"></script>
    <script src="resource/min/animate.min.js"></script>
</head>
<body>
<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="info" class="formContainer">
            <div id="formTitle">User Information and Settings</div>
            <form id="infoForm">
                <hr />
                <div class="formInput"><label for="firstname" id="firstnamelabel">First Name: </label><input type="text" name="firstname" id="firstname" maxlength=1280></div>
                <div class="formInput"><label for="lastname" id="lastnamelabel">Last Name: </label><input type="text" name="lastname" id="lastname" maxlength=128></div>
                <hr />
                <div class="formInput"><label for="emailalerts" id="emailalertslabel">Receive email alerts: </label><input type="checkbox" name="emailalerts" id="emailalerts"></div>
                <div class="formInput" style="display:none"><label for="email" id="emaillabel" maxlength=256>Email: </label><input type="text" name="email" id="email"></div>
                <hr />
                <div class="formInput"><label for="phonealerts" id="phonealertslabel">Receive text alerts: </label><input type="checkbox" name="phonealerts" id="phonealerts"></div>
                <div class="formInput" style="display:none"><label for="phone" id="phonelabel">Phone number: </label><input type="text" name="phone" id="phone"></div>
                <div class="formInput" style="display:none"><label for="carrier" id="carrierlabel">Phone carrier: </label>
                    <select name="carrier" id="carrier">
                        <option value="verizon">Verizon</option>
                        <option value="att">AT&T</option>
                        <option value="tmobile">T-Mobile</option>
                        <option value="sprint">Sprint</option>
                    </select>
                </div>
                <hr />
                <div class="formInput"><input type="button" value="update" id="go"></input></div>
            </form>
        </div>
        <div id="formError" class="formContainer">...</div>
    </div>
</div>
</body>
<script>
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
                logJson(response, LOG.Info);
                if (response["Error"]) {
                    logError(response["Error"]);
                    let error = document.getElementById("formError");
                    error.innerHTML = response["Error"];
                    Animation.queue({"opacity" : 1}, error, 500);
                    queuDelayedAnimation({"opacity" : 0}, error, 3000, 1000);
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

                logJson(initialValues, LOG.Verbose);
            } catch (ex) {
                logError(ex, true);
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
        let alert = document.querySelector("input[name=phonealerts");
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
            if (document.querySelector("input[name=phonealerts]").checked)
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
                        logJson(response, LOG.Info);
                        if (response["Error"]) {
                            logError(response["Error"]);
                            let error = document.getElementById("formError");
                            error.innerHTML = response["Error"];
                            Animation.queue({"opacity" : 1}, error, 500);
                            Animation.queueDelayed({"opacity" : 0}, error, 3000, 500);
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

                const firstName = getField("firstname");
                const lastName = getField("lastname");
                const emailStr = getField("email");
                const emailAlerts = getField("emailalerts", "checked");
                const phoneNum = getField("phone").replace(/[^\d]/g, "");
                const phoneAlerts = getField("phonealerts", "checked");
                const carrier = getField("carrier", "value", "select");
                http.send(`&type=set_usr_info&fn=${firstName}&ln=${lastName}&e=${emailStr}&ea=${emailAlerts}&p=${phoneNum}&pa=${phoneAlerts}&c=${carrier}`);
            }
        });
    }

    function getField(name, field="value", type="input") {
        return document.querySelector(type + "[name=" + name + "]")[field];
    }
})();
</script>
</html>