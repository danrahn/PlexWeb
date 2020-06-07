
window.addEventListener("load", function() {
    setupFormListeners();
});

const validEmailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const changedColor = new Color(200, 150, 80);
const successColor = new Color(100, 200, 80);
const defaultForegroundColor = new Color(192, 189, 186);

const g_forNotify = parseInt(document.body.getAttribute("fornotify")) == 1;
function setupFormListeners()
{
    setupEmailListeners();
    setupPhoneListeners();
    setupLabelListeners();
    setupPwListeners();

    let checkboxes = $("input[type=checkbox]");
    for (let i = 0; i < checkboxes.length; ++i) {
        checkboxes[i].addEventListener("keydown", function(e) {
            e = e || window.event;
            const key = e.which || e.keyCode;
            if (key === 13) {
                this.checked = !this.checked;
                if (initialValues[this.id] != this.checked) {
                    this.parentNode.children[0].style.color = changedColor.s();
                } else {
                    this.parentNode.children[0].style.color = null;
                }
            }
        });
    }

    setupSubmitButton();
    getCurrentValues();
}

let initialValues =
{
    firstname: "",
    lastname: "",
    email: "",
    emailalerts: false,
    phone: "",
    phonealerts: false,
    carrier: ""
};

function setVisible(ele, vis)
{
    ele.classList.remove(vis ? "hiddenInput" : "visibleInput");
    ele.classList.add(!vis ? "hiddenInput" : "visibleInput");
}

function getCurrentValues()
{
    // Basic client-side validation is okay, now send it to the server
    logVerbose("Grabbing current user info");

    let params =
    {
        "type" : ProcessRequest.GetUserInfo
    };

    let successFunc = function(response)
    {
        // Assume all of our values are correct here
        $$("input[name=firstname]").value = initialValues.firstname = response["firstname"];
        $$("input[name=lastname]").value = initialValues.lastname = response["lastname"];

        let email = $$("input[name=email]");
        let emailAlerts = $$("input[name=emailalerts]");
        email.value = initialValues.email = response["email"];
        emailAlerts.checked = initialValues.emailalerts = response["emailalerts"] != "0";
        if (initialValues.email.match(validEmailRegex))
        {
            setVisible(emailAlerts.parentNode, true);
            if (g_forNotify)
            {
                email.parentNode.classList.remove("forNotify");
                emailAlerts.parentNode.classList.add("forNotify");
            }
        }

        emailChangeListenerCore($$("input[name=email]"));
        let phone = response["phone"];
        let phoneInput = $$("input[name=phone]");
        if (phone != "0") {
            phoneInput.value = initialValues.phone = phone;
            phoneListenerCore(phoneInput);
            phoneFocusListenerCore(phoneInput);
        }

        $$("select[name=carrier]").value = initialValues.carrier = response["carrier"];

        let phoneAlerts = $$("input[name=phonealerts]");
        phoneAlerts.checked = initialValues.phonealerts = response["phonealerts"] != "0";
        logVerbose(initialValues.phone.replace(/[^\d]/g, "").length);
        if (initialValues.phone.replace(/[^\d]/g, "").length == 10)
        {
            setVisible(phoneAlerts.parentNode, true);
            if (g_forNotify)
            {
                phoneInput.parentNode.classList.remove("forNotify");
                phoneAlerts.parentNode.classList.add("forNotify");
            }
        }
    };

    let failureFunc = function(response)
    {
        logError(response["Error"]);
        let error = $("#formError");
        error.innerHTML = response["Error"];
        error.style.display = "block";
        Animation.queue({"opacity" : 1}, error, 500);
        Animation.queuDelayedAnimation({"opacity" : 0}, error, 3000, 1000);
        Animation.queue({"display" : "none"}, error);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
}

function setupEmailListeners()
{
    let email = $$("input[name=email]");
    let alerts = $$("input[name=emailalerts]");

    email.addEventListener("input", emailChangeListener);
    alerts.addEventListener("change", function()
    {
        logVerbose("Email alerts changed to " + this.checked);
    });

    if (g_forNotify)
    {
        email.parentNode.classList.add("forNotify");
    }
}

function emailChangeListener()
{
    emailChangeListenerCore(this);
}

function emailChangeListenerCore(ele)
{
    let email = $$("input[name=email");
    let emailAlerts = $$("input[name=emailalerts");
    if (ele.value.match(validEmailRegex))
    {
        logTmi("valid email found");
        ele.style.backgroundColor = null;
        setVisible($$("input[name=emailalerts]").parentNode, true);
        if (g_forNotify)
        {
            email.parentNode.classList.remove("forNotify");
            emailAlerts.parentNode.classList.add("forNotify");
        }
    }
    else
    {
        logTmi("Invalid email");
        if (ele.value.length == 0)
        {
            ele.style.backgroundColor = null;
        }
        else
        {
            ele.style.backgroundColor = ele.value ? "rgb(100, 66, 69)" : null;
        }

        setVisible(emailAlerts.parentNode, false);

        if (g_forNotify)
        {
            email.parentNode.classList.add("forNotify");
            emailAlerts.parentNode.classList.remove("forNotify");
        }
    }
}

function setupPhoneListeners()
{
    let phone = $$("input[name=phone]");
    let alerts = $$("input[name=phonealerts]");
    let digits = phone.value.replace(/[^\d]/g, "");

    // Needs to be 10 digits (11-digit international numbers don't seem to work)
    if (digits.length === 10)
    {
        logTmi("Valid phone");
    }

    phone.addEventListener("input", phoneListener);

    phone.addEventListener("focusout", phoneFocusListener);

    alerts.addEventListener("change", function()
    {
        logVerbose("Phone alerts changed to " + this.checked);
    });

    if (g_forNotify)
    {
        phone.parentNode.classList.add("forNotify");
    }
}

function phoneListener() {
    phoneListenerCore(this);
}

function phoneListenerCore(ele) {
    let digit = ele.value ? ele.value.replace(/[^\d]/g, "") : "";
    let alerts = $$("input[name=phonealerts]");
    let phone = $$("input[name=phone]");
    if (digit.length !== 10)
    {
        logTmi("Invalid phone");
        ele.style.backgroundColor = ele.value ? "rgb(100, 66, 69)" : null;
        setVisible(alerts.parentNode, false);
        if (g_forNotify)
        {
            phone.parentNode.classList.add("forNotify");
        }
    }
    else
    {
        logTmi("Valid phone");
        ele.style.backgroundColor = null;
        setVisible(alerts.parentNode, true);
        if (g_forNotify)
        {
            phone.parentNode.classList.remove("forNotify");
            alerts.parentNode.classList.add("forNotify");
        }
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
    let inputs =
    [
        $$("input[name=firstname]"),
        $$("input[name=lastname]"),
        $$("input[name=email]"),
        $$("input[name=emailalerts]"),
        $$("input[name=phone]"),
        $$("input[name=phonealerts]"),
        $$("select[name=carrier]")
    ];

    for (let i = 0; i < inputs.length; ++i)
    {
        inputs[i].addEventListener("input", function()
        {
            let isCheckbox = this.type.toLowerCase() == "checkbox";
            let val = this.id == "phone" ? this.value.replace(/[^\d]+/g, "") : this.type.toLowerCase() == "checkbox" ? this.checked : this.value;
            if (initialValues[this.id] != val)
            {
                if (!this.getAttribute("changed") || this.getAttribute("changed") == 0)
                {
                    logVerbose(this.id + " different from original");
                }

                this.parentNode.children[0].style.color = changedColor.s();
                this.setAttribute("changed", 1);
            }
            else
            {
                if (this.getAttribute("changed"))
                {
                    logVerbose(this.id + " same as original");
                }

                this.parentNode.children[0].style.color = null;
                this.setAttribute("changed", 0);
            }

            let clearNotify = () => { $(".forNotify").forEach(function(ele)
            {
                ele.classList.remove("forNotify");
            })};

            if (g_forNotify && isCheckbox)
            {
                if (val)
                {
                    clearNotify();
                    $("#go").classList.add("forNotify");
                    return;
                }

                anyCheck = false;
                $("input[type=checkbox]").forEach(function(element)
                {
                    if (element.checked)
                    {
                        anyCheck = true;
                    }
                });

                if (anyCheck)
                {
                    clearNotify();
                    $("#go").classList.add("forNotify");
                    return;
                }

                clearNotify();
                let email = $$("input[name=email]").parentNode;
                let emailAlerts = $$("input[name=emailalerts]").parentNode;
                let phone = $$("input[name=phone]").parentNode;
                let phoneAlerts = $$("input[name=phonealerts]").parentNode;
                if (emailAlerts.classList.contains("hiddenInput"))
                {
                    email.classList.add("forNotify");
                }
                else
                {
                    emailAlerts.classList.add("forNotify");
                }

                if (phoneAlerts.classList.contains("hiddenInput"))
                {
                    phone.classList.add("forNotify");
                }
                else
                {
                    phoneAlerts.classList.add("forNotify");
                }
            }
        });
    }
}

function setupSubmitButton()
{
    let submit = $("#go");
    submit.addEventListener("click", function()
    {
        logInfo("Submitting user info changes");
        let valid = true;
        let phone = $$("input[name=phone]");
        let phonealerts = $$("input[name=phonealerts]").checked;
        let digits = phone.value.replace(/[^\d]/g, "");
        if (phonealerts)
        {
            if (digits.length !== 10)
            {
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


        let email = $$("input[name=email]");
        if (email.value.length != 0 && !email.value.match(validEmailRegex))
        {
            valid = false;
            Animation.queue({"backgroundColor": new Color(140, 66, 69)}, email, 500);
            Animation.queueDelayed({"backgroundColor": new Color(100, 66, 69)}, email, 500, 500);
        }

        if (!valid)
        {
            return;
        }

        // Basic client-side validation is okay, now send it to the server
        let params =
        {
            "type" : ProcessRequest.SetUserInfo,
            "fn"   : getField("firstname"),
            "ln"   : getField("lastname"),
            "e"    : getField("email"),
            "ea"   : getField("emailalerts", "checked"),
            "p"    : getField("phone").replace(/[^\d]/g, ""),
            "pa"   : getField("phonealerts", "checked"),
            "c"    : getField("carrier", "value", "select")
        };

        let successFunc = function()
        {
            let inputs =
            [
                $$("input[name=firstname]"),
                $$("input[name=lastname]"),
                $$("input[name=email]"),
                $$("input[name=emailalerts]"),
                $$("input[name=phone]"),
                $$("input[name=phonealerts]"),
                $$("select[name=carrier]")
            ];

            inputs.forEach(function(element)
            {
                if (element.getAttribute("changed") == 1)
                {
                    Animation.queue({"color" : successColor}, element.parentNode.children[0], 500);
                    Animation.queueDelayed({"color" : defaultForegroundColor}, element.parentNode.children[0], 500, 500, true /*deleteAfterTransition*/);
                    element.setAttribute("changed", 0);
                    initialValues[element.id] = ((this.type && this.type.toLowerCase() == "checkbox") ? this.checked : this.value);
                }
            });
        };

        let failureFunc = function(response)
        {
            logError(response["Error"]);
            let error = $("#formError");
            error.innerHTML = response["Error"];
            error.style.display = "block";
            Animation.queue({"opacity" : 1}, error, 500);
            Animation.queueDelayed({"opacity" : 0}, error, 3000, 500);
            Animation.queue({"display" : "none"}, error);
        };

        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
    });
}

function getField(name, field="value", type="input")
{
    return $$(type + "[name=" + name + "]")[field];
}

function setupPwListeners()
{
    $("#pwForm input").forEach(function(e)
    {
        e.addEventListener("keydown", function(e)
        {
            if (e.keyCode == 13 && !e.ctrlKey && !e.shiftKey && !e.altKey)
            {
                $("#pwGo").click();
            }
        });
    });

    $("#newPassConf").addEventListener("input", function()
    {
        if (this.value && this.value != $("#newPass").value)
        {
            this.style.backgroundColor = "rgb(100, 66, 69)";
        }
        else
        {
            this.style.backgroundColor = "";
        }
    });

    // If the field is red due to a blank entry upon submission, clear it out on the next input
    $("#newPass").addEventListener("input", function()
    {
        this.style.backgroundColor = "";
    });
    $("#oldPass").addEventListener("input", function()
    {
        this.style.backgroundColor = "";
    });

    $("#pwGo").addEventListener("click", function()
    {
        submitPasswordChange();
    });
}

function submitPasswordChange()
{
    let oldPass = $("#oldPass");
    let newPass = $("#newPass");
    let conf = $("#newPassConf");

    if (!verifyFields(oldPass, newPass, conf))
    {
        return;
    }

    if (newPass.value != conf.value)
    {
        flashField(conf);
        return;
    }

    let params =
    {
        "type" : ProcessRequest.UpdatePassword,
        "old_pass" : oldPass.value,
        "new_pass" : newPass.value,
        "conf_pass" : conf.value
    };

    let successFunc = function()
    {
        let status = $("#formStatus");
        status.className = "formContainer statusSuccess";
        status.innerHTML = "Password changed!";
        Animation.queue({"opacity" : 1}, status, 500);
        Animation.queueDelayed({"opacity" : 0}, status, 2000, 500);
    };

    let failureFunc = function(response)
    {
        let status = $("#formStatus");
        status.className = "formContainer statusFail";
        status.innerHTML = response["Error"];
        Animation.queue({"opacity" : 1}, status, 500);
        Animation.queueDelayed({"opacity" : 0}, status, 5000, 1000);
    }

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
}

function verifyFields(...fields)
{
    ret = true;
    for (index in fields)
    {
        ret = ret & verifyField(fields[index]);
    }

    return ret;
}

function verifyField(field)
{
    if (!field.value)
    {
        flashField(field);
    }

    return !!field.value;
}

function flashField(field)
{
    Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, field, 500);
    Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, field, 500, 500);
}
