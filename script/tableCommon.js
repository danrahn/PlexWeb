/// <summary>
/// Clear out the current contents of the request table and replace it
/// with a single informational message
/// </summary>
function displayInfoMessage(message)
{
    clearElement("tableEntries");
    $("#tableEntries").appendChild(buildNode("div", {"id" : "resultInfo"}, message));
}

/// <summary>
/// Handle keystrokes 
/// </summary>
function filterKeyHandler(e)
{
    let key = e.keyCode ? e.keyCode : e.which;
    if (key == 27 /*esc*/)
    {
        dismissFilterDialog();
    }
    else if (key == 13 /*enter*/ && e.ctrlKey)
    {
        let overlay = $("#filterOverlay");
        if (overlay && overlay.style.opacity == "1")
        {
            $("#applyFilter").click();
        }
    }
}

/// <summary>
/// Set up click handlers for previous/next buttons
/// </summary>
function setupNavigation()
{
    $(".previousPage").forEach(function(e)
    {
        e.addEventListener("click", previousPage);
    });

    $(".nextPage").forEach(function(e)
    {
        e.addEventListener("click", nextPage);
    });
}

/// <summary>
/// Set up general keyboard navigation, and the handler for
/// when the user goes to a specific page via the input dialog
///
/// SHIFT + LEFT_ARROW - Previous Page
/// SHIFT + RIGHT_ARROW - Next Page
/// </summary>
function setupKeyboardNavigation()
{
    document.addEventListener('keyup', function(e)
    {
        let key = e.keyCode ? e.keyCode : e.which;
        if (e.shiftKey && !e.altKey && !e.ctrlKey)
        {
            switch (key)
            {
                default:
                    break;
                case 37: // LEFT
                    previousPage();
                    break;
                case 39: // RIGHT
                    nextPage();
                    break;
            }
        }
    });

    $('.pageSelect').forEach(function(input)
    {
        input.addEventListener('keyup', function(e)
        {
            let key = e.keyCode ? e.keyCode : e.which;
            if (key == 13 /*enter*/)
            {
                let page = parseInt(this.value);
                if (isNaN(page) || page <= 0 || page > pages)
                {
                    this.value = getPage() + 1;
                    this.select();
                    return;
                }

                setPage(page - 1, true);
                this.select();
            }
        });

        input.addEventListener('focus', function()
        {
            this.select();
        });
    })
}

/// <summary>
/// Navigate to the previous page if we're not on the first page
/// </summary>
function previousPage()
{
    let page = getPage();
    if (page <= 0)
    {
        return;
    }

    setPage(page - 1, true);
}

/// <summary>
/// Navigate to the next page if we're not on the last page
/// </summary>
function nextPage()
{
    let page = getPage();
    if (page == pages - 1)
    {
        return;
    }

    setPage(page + 1, true);
}

function getPageCommon(storage)
{
    let page = parseInt(localStorage.getItem(storage));
    if (page == null || isNaN(page) || page < 0)
    {
        page = 0;
        setPage(page);
    }

    return page;
}

function setPageCommon(storage, page, update, updateFunc)
{
    localStorage.setItem(storage, page);
    if (update)
    {
        clearElement("tableEntries");
        updateFunc();
    }
}

function getPerPageCommon(storage)
{
    let perPage = parseInt(localStorage.getItem(storage));
    if (perPage == null || isNaN(perPage) || perPage % 25 != 0 || perPage < 0)
    {
        localStorage.setItem(storage, 25);
        perPage = 25;
    }

    return perPage;
}

/// <summary>
/// Dismisses the filter overlay with an animation if it's present
/// </summary>
function dismissFilterDialog()
{
    let overlay = $("#filterOverlay");
    if (overlay && overlay.style.opacity == "1")
    {
        Animation.queue({"opacity": 0}, overlay, 250, true);
    }
}

/// <summary>
/// Determine how long ago a date is from the current time.
/// Returns a string of the form "X [time units] ago"
/// </summary>
function getDisplayDate(date)
{
    let now = new Date();
    let dateDiff = Math.abs(now - date);
    let minuteDiff = dateDiff / (1000 * 60);
    if (minuteDiff < 60)
    {
        let minutes = Math.floor(minuteDiff);
        return `${minutes} minute${minutes == 1 ? "" : "s"} ago`;
    }
    
    let hourDiff = minuteDiff / 60;
    if (hourDiff < 24)
    {
        let hours = Math.floor(hourDiff);
        return `${hours} hour${hours == 1 ? "" : "s"} ago`;
    }

    let dayDiff = hourDiff / 24;
    if (dayDiff < 7)
    {
        let days = Math.floor(dayDiff);
        return `${days} day${days == 1 ? "" : "s"} ago`;
    }

    if (dayDiff <= 28)
    {
        // For weeks do some extra approximation, as it's odd to see
        // "1 week ago" for something created 13 days ago
        let weeks = Math.floor((dayDiff + 3) / 7);
        return `${weeks} week${weeks == 1 ? '' : 's'} ago`;
    }

    if (dayDiff < 365)
    {
        let months = (now.getMonth() + (now.getFullYear() != date.getFullYear() ? 12 : 0)) - date.getMonth();
        return `${months == 0 ? 1 : months} month${months == 1 ? '' : 's'} ago`;
    }

    let yearDiff = now.getFullYear() - date.getFullYear();
    return `${yearDiff == 0 ? 1 : yearDiff} year${yearDiff == 1 ? '' : 's'}`;
}

/// <summary>
/// Set the number of items to show per page
/// </summary>
function setPerPageCommon(storage, newPerPage, update, updateFunc)
{
    localStorage.setItem(storage, newPerPage);
    document.querySelectorAll(".perPageButton").forEach((btn) =>
    {
        btn.classList.remove("selected");
    });

    document.querySelectorAll(`.perPageButton[value="${newPerPage}"]`).forEach(function(e)
    {
        e.classList.add("selected");
    });

    if (update)
    {
        clearElement("tableEntries");
        updateFunc();
    }
}

/// <summary>
/// Sets up click handlers for per-page options
/// </summary>
function setupPerPage()
{
    let perPage = getPerPage();

    document.querySelectorAll(".perPageButton").forEach((btn) =>
    {
        btn.addEventListener("click", function()
        {
            let newPerPage = parseInt(this.value);
            if (newPerPage == null || isNaN(newPerPage) || newPerPage % 25 != 0 || newPerPage < 0)
            {
                newPerPage = 25;
            }

            setPerPage(newPerPage, true);
        });
    });

    setPerPage(perPage, false);
}

/// <summary>
/// Sets the current filter. No validation, but some basic validation
/// should exist when grabbing the filter from localStorage
/// </summary>
function setFilterCommon(storage, filter, update, updateFunc)
{
    logVerbose(filter, "Setting filter to");
    localStorage.setItem(storage, JSON.stringify(filter));
    if (update)
    {
        clearElement("tableEntries");
        updateFunc();
    }
}

/// <summary>
/// Update the "Page X of Y" strings in the table
/// </summary>
function setPageInfo(totalRequests)
{
    pages = getPerPage() == 0 ? 1 : Math.ceil(totalRequests / getPerPage())
    $(".pageSelect").forEach(function(e)
    {
        e.value = getPage() + 1;
    });

    $(".pageCount").forEach(function(e)
    {
        e.innerHTML = pages;
    });
}

/// <summary>
/// Get a list of all the users to populate the admin-only filter option
/// </summary>
function populateUserFilter()
{
    let params = { "type" : "members" };
    let successFunc = function(response)
    {
        response.sort(function(a, b)
        {
            return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
        });

        let select = $("#filterTo");
        response.forEach(function(user)
        {
            select.appendChild(buildNode("option", {"value" : user.id}, user.username));
        });

        select.value = getFilter().user;
    };

    let failureFunc = function()
    {
        Animation.queue({"backgroundColor": "rgb(100, 66, 69)"}, $("#filterTo"), 500);
        Animation.queueDelayed({"backgroundColor": "rgb(63, 66, 69"}, $("#filterTo"), 1000, 500, true);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
}

/// <summary>
/// Clears all contents of the element with the given id
/// </summary>
function clearElement(id)
{
    let element = $("#" + id);
    while (element.firstChild)
    {
        element.removeChild(element.firstChild);
    }
}