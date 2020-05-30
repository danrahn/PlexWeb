/// <summary>
/// Common table implementation, including interfaces for custom sorting, filtering, and searching.
///
/// Users of this interface should implement the following:
/// 1. getPage() - Forward to getPageCommon with a unique identifier
/// 2. setPage(page, update) - Forward to setPageCommon(id, page, update (bool), updateFunc)
/// 3. getPerPage() - Forward to getPerPageCommon with the same unique identifier
/// 4. setPerPage(newPerPage, update) - Forward to setPerPageCommon(id, perPage, update, updateFunc)
/// 5. setFilter(filter, update) - Forward to setFilterCommon(id, filter, update, updateFunc)
/// </summary>

/// <summary>
/// On load set up all the handlers we need
/// </summary>
window.addEventListener("load", function()
{
    setupPerPage();
    setupNavigation();
    setupTableSearch();
    setupFilterCommon();
    setupKeyboardNavigation();
    document.body.addEventListener('keyup', tableFilterKeyHandler);
});


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
function tableFilterKeyHandler(e)
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

function setupTableSearch()
{
    // If the table does not have a search function,
    // don't show anything. Might mess up CSS
    if (typeof(tableSearch) == 'undefined')
    {
        $('.searchBtn').forEach(function(btn)
        {
            btn.style.display = 'none';
        });

        return;
    }

    $('.searchBtn').forEach(function(btn)
    {
        btn.addEventListener('click', searchBtnClick);
    });

    $('.searchGo').forEach(function(btn)
    {
        btn.addEventListener('click', startTableSearch);
    });

    $('.searchInput').forEach(function(input)
    {
        input.addEventListener('keydown', function(e)
        {
            if (e.keyCode == 13 /*enter*/)
            {
                this.parentNode.$$('.searchGo').click();
            }
        });
    });

    $('.searchInputClear').forEach(function(img)
    {
        img.addEventListener('click', function(e)
        {
            let search = this.parentNode.$$('.searchInput');
            if (search.value.length != 0)
            {
                this.parentNode.$$('.searchInput').value = '';
                this.parentNode.$$('.searchGo').click();
            }
            
            this.parentNode.parentNode.$$('.searchBtn').click();
        });
    })
}

function searchBtnClick(e)
{
    let show = !$$('.pageStatus').style.display || $$('.pageStatus').style.display != 'none';
    $('.pageStatus').forEach(function(ele)
    {
        ele.style.display = show ? 'none' : 'inline-block';
    });

    $('.searchInputHolder').forEach(function(ele)
    {
        ele.style.display = show ? 'inline-block' : 'none';
    });

    if (show)
    {
        this.parentNode.$$('.searchInput').focus();
    }
}

/// <summary>
/// Initiates a search. If the owner hasn't defined
/// a search function, warn the user.
/// </summary>
function startTableSearch(e)
{
    try
    {
        tableSearch(this.parentNode.$$('.searchInput').value);
    }
    catch (e)
    {
        overlay("This table doesn't have search enabled (yet)", "OK", overlayDismiss);
    }
}

function setupFilterCommon()
{
    if (typeof(setupFilter) == 'undefined')
    {
        $('.filterBtn').forEach(function(filter)
        {
            filter.style.display = 'none';
        });

        return;
    }

    setupFilter();
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
/// Set the number of items to show per page
/// </summary>
function setPerPageCommon(storage, newPerPage, update, updateFunc)
{
    localStorage.setItem(storage, newPerPage);
    $(".perPageButton").forEach((btn) =>
    {
        btn.classList.remove("selected");
    });

    $(`.perPageButton[value="${newPerPage}"]`).forEach(function(e)
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

    $(".perPageButton").forEach((btn) =>
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