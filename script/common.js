/// <summary>
/// common.js contains functions that are used by most, if not all, pages on this site
/// </summary>

/* exported $, $$, buildNode, buildNodeNS, sendHtmlJsonRequest, ProcessRequest, KEY */

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
    return _buildNode(ele, attrs, content, events);
}

/// <summary>
/// Helper method to create DOM elements with the given namespace.
/// </summary>
function buildNodeNS(ns, type, attrs, content, events)
{
    let ele = document.createElementNS(ns, type);
    return _buildNode(ele, attrs, content, events);
}

function _buildNode(ele, attrs, content, events)
{
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
        if (this.readyState != 4)
        {
            return;
        }

        if (this.status != 200)
        {
            let status = Math.floor(this.status / 100);
            if (failFunc && (status == 4 || status == 5 || status == 0))
            {
                failFunc({ Error : "HTTPError", value : this.status });
            }

            return;
        }

        try
        {
            let response = JSON.parse(this.responseText);
            Log.verbose(response, `${url}${sanitized}`);
            if (response.Error)
            {
                Log.error(response.Error, `Error querying ${url}${sanitized}`);
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
            Log.error(ex, "Exception");
            Log.error(ex.stack);
            Log.error(this.responseText, "Response Text");
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
    BACKSPACE : 8, TAB : 9, ENTER : 13,
    SHIFT : 16, CTRL  : 17, ALT   : 18, ESC  : 27, SPACE : 32,
    HOME  : 36, LEFT  : 37, UP    : 38, RIGHT : 39, DOWN  : 40,
    ZERO  : 48, ONE   : 49, TWO   : 50, THREE : 51, FOUR : 52,
    FIVE  : 53, SIX   : 54, SEVEN : 55, EIGHT : 56, NINE : 57,
    A : 65, B : 66, C : 67, D : 68, E : 69, F : 70, G : 71, H : 72,
    I : 73, J : 74, K : 75, L : 76, M : 77, N : 78, O : 79, P : 80,
    Q : 81, R : 82, S : 83, T : 84, U : 85, V : 86, W : 87, X : 88,
    Y : 89, Z : 90, PERIOD : 190, BACKTICK : 192, OPEN_BRACKET : 219,
    BACKSLASH : 220, CLOSE_BRACKET : 221
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
    SetExternalId : 17,
    GetSeasonDetails : 18,
    GeoIP : 19,
    AddComment : 20,
    DeleteComment : 21,
    EditComment : 22,
    GetComments : 23,
    GetActivities : 24,
    NewActivities : 25,
    LogError : 26,
    UpdatePoster : 27,
    CheckNotificationAlert : 28,
    DisableNotificationAlert : 29,
    MarkdownText : 30,
    FreeSpace : 31,
    LibraryStats : 32,
    SetInternalId : 33,
    GetInternalId : 34,
    ImdbRating : 35,
    UpdateImdbRatings : 36,
    GetImdbUpdateStatus : 37,
};

console.assert(!Log.logErrorId || Log.logErrorId == ProcessRequest.LogError, "Update Log.logErrorId!");
