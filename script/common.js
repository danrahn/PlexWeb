
/// <summary>
/// Custom jQuery-like selector method.
/// If the selector starts with '#' and contains no spaces, return the
/// result of querySelector, otherwise return the result of querySelectorAll
/// </summary>
function $(selector)
{
    if (selector.indexOf("#") === 0 && selector.indexOf(" ") === -1)
    {
        return document.querySelector(selector);
    }

    return document.querySelectorAll(selector);
}

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
    if (additionalParams)
    {
        for (let param in additionalParams)
        {
            if (!additionalParams.hasOwnProperty(param))
            {
                continue;
            }

            http[param] = additionalParams[param];
        }   
    }

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
                    failFunc(response);
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
/// Builds up a query string, ensuring the components are encoded properly
/// </summary>
function buildQuery(parameters)
{
    let queryString = "";
    for (let parameter in parameters)
    {
        if (!parameters.hasOwnProperty(parameter))
        {
            continue;
        }

        queryString += `&${parameter}=${encodeURIComponent(parameters[parameter])}`;
    }

    return queryString;
}

/// <summary>
/// Returns a sanitized version of the given parameters
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