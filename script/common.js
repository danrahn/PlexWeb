/// <summary>
/// common.js contains functions that are used by most, if not all, pages on this site
/// </summary>

/* exported $, $$, buildNode, sendHtmlJsonRequest, ProcessRequest, KEY */

/// <summary>
/// Custom jQuery-like selector method.
/// If the selector starts with '#' and contains no spaces, return the
/// result of querySelector, otherwise return the result of querySelectorAll
/// </summary>
function $(selector, ele=document)
{
    if (selector.indexOf("#") === 0 && selector.indexOf(" ") === -1)
    {
        return $$(selector, ele);
    }

    return ele.querySelectorAll(selector);
}

/// <summary>
/// Like $, but forces a single element to be returned. i.e. querySelector
/// </summary>
function $$(selector, ele=document)
{
    return ele.querySelector(selector);
}

/// <summary>
/// $ operator scoped to a specific element
/// </summary>
Element.prototype.$ = function(selector)
{
    return $(selector, this);
};

/// <summary>
/// $$ operator scoped to a specific element
/// </summary>
Element.prototype.$$ = function(selector)
{
    return $$(selector, this);
};

/// <summary>
/// Helper to append multiple children to a single element at once
/// </summary>
/// <returns>The element to facilitate chained calls</returns>
Element.prototype.appendChildren = function(...elements)
{
    for (let element of elements)
    {
        if (element)
        {
            this.appendChild(element);
        }
    }

    return this;
};

/// <summary>
/// Helper method to create DOM elements.
/// </summary>
function buildNode(type, attrs, content, events)
{
    let ele = document.createElement(type);
    if (attrs)
    {
        for (let [key, value] of Object.entries(attrs))
        {
            ele.setAttribute(key, value);
        }
    }

    if (events)
    {
        for (let [event, func] of Object.entries(events))
        {
            ele.addEventListener(event, func);
        }
    }

    if (content)
    {
        ele.innerHTML = content;
    }

    return ele;
}

/// <summary>
/// Generic method to sent an async request that expects JSON in return
/// </summary>
function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams, dataIsString=false)
{
    let http = new XMLHttpRequest();
    http.open("POST", url, true /*async*/);
    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    const queryString = dataIsString ? parameters : buildQuery(parameters);
    attachExtraParams(additionalParams, http);

    // Will need to update this if we ever pass in sensitive information when dataIsString == true
    let sanitized = dataIsString ? queryString : sanitize(parameters);
    http.onreadystatechange = function()
    {
        if (this.readyState != 4 || this.status != 200)
        {
            return;
        }

        try
        {
            let response = JSON.parse(this.responseText);
            logVerbose(response, `${url}${sanitized}`);
            if (response.Error)
            {
                logError(response.Error, `Error querying ${url}${sanitized}`);
                if (failFunc)
                {
                    failFunc(response, this);
                }

                return;
            }

            successFunc(response, this);

        }
        catch (ex)
        {
            logError(ex, "Exception");
            logError(ex.stack);
            logError(this.responseText, "Response Text");
        }
    };

    http.send(queryString);
}

/// <summary>
/// Attaches additional parameters to our http request to be used
/// by success/failure callbacks.
/// </summary>
function attachExtraParams(extra, http)
{
    if (extra)
    {
        for (let param in extra)
        {
            if (!Object.prototype.hasOwnProperty.call(extra, param))
            {
                continue;
            }

            http[param] = extra[param];
        }
    }
}

/// <summary>
/// Builds up a query string, ensuring the components are encoded properly
/// </summary>
function buildQuery(parameters)
{
    let queryString = "";
    for (let parameter in parameters)
    {
        if (!Object.prototype.hasOwnProperty.call(parameters, parameter))
        {
            continue;
        }

        queryString += `&${parameter}=${encodeURIComponent(parameters[parameter])}`;
    }

    return queryString;
}

/// <summary>
/// Returns a sanitized version of the given parameters for logging
/// </summary>
function sanitize(parameters)
{
    let sanitized = {};
    for (let param in parameters)
    {
        if (param.indexOf("pass") != -1 || param == "confirm")
        {
            sanitized[param] = "********";
        }
        else
        {
            sanitized[param] = parameters[param];
        }
    }

    return buildQuery(sanitized);
}

/// <summary>
/// Table of keyboard keys and their associated IDs
/// </summary>
const KEY =
{
    /* eslint-disable key-spacing, no-multi-spaces, id-length */
    TAB   : 9,  SPACE : 32,
    ENTER : 13, SHIFT : 16, CTRL  : 17, ALT   : 18, ESC  : 27,
    LEFT  : 37, UP    : 38, RIGHT : 39, DOWN  : 40,
    ZERO  : 48, ONE   : 49, TWO   : 50, THREE : 51, FOUR : 52,
    FIVE  : 53, SIX   : 54, SEVEN : 55, EIGHT : 56, NINE : 57,
    A : 65, B : 66, C : 67, D : 68, E : 69, F : 70, G : 71, H : 72,
    I : 73, J : 74, K : 75, L : 76, M : 77, N : 78, O : 79, P : 80,
    Q : 81, R : 82, S : 83, T : 84, U : 85, V : 86, W : 87, X : 88,
    Y : 89, Z : 90, OPEN_BRACKET : 219, CLOSE_BRACKET : 221
    /* eslint-enable key-spacing, no-multi-spaces, id-length */
};

/// <summary>
/// List of all request types for process_request.php
/// Keep in sync with ProcessRequest process_request.php
/// </summary>
const ProcessRequest =
{
    Login : 1,
    Register : 2,
    UpdatePassword : 3,
    ResetPassword : 4,
    RequestPasswordReset : 5,
    PasswordResetAdmin : 6,
    CheckUsername : 7,
    NewRequest : 8,
    GetRequests : 9,
    NextRequest : 10,
    PermissionRequest : 11,
    SetUserInfo : 12,
    GetUserInfo : 13,
    GetMembers : 14,
    GetAllMembers : 15,
    SearchPlex : 16,
    SearchExternal : 17,
    SetExternalId : 18,
    GetSeasonDetails : 19,
    GeoIP : 20,
    AddComment : 21,
    DeleteComment : 22,
    EditComment : 23,
    GetComments : 24,
    GetActivities : 25,
    NewActivities : 26,
    LogError : 27,
    UpdatePoster : 28,
    CheckNotificationAlert : 29,
    DisableNotificationAlert : 30,
    MarkdownText : 31,
};

console.assert(!_logErrorId || _logErrorId == ProcessRequest.LogError, "Update _logErrorId!");
