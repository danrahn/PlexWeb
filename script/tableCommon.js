/// <summary>
/// Common table implementation, including interfaces for custom sorting, filtering, and searching.
///
/// Users of this interface should implement the following:
/// 1. tableIdentifier() - Returns a string that identifies this table (required)
/// 2. tableUpdateFunc() - Returns a function to call when updating the table (required)
/// 3. tableSearch() - Invoked when the user initiates a search (optional)
/// 4. Filter - optional
///    a. filterHtml() - The filter dialog UI
///    b. populateFilter() - Populate the filter dialog with the current values
///    b. getNewFilter() - Returns the new filter based on the current state of the filter dialog
/// </summary>

/// <summary>
/// On load set up all the handlers we need
/// </summary>
window.addEventListener("load", function()
{
    setupPerPage();
    setupNavigation();
    setupTableSearch();
    setupFilter();
    setupKeyboardNavigation();
    document.body.addEventListener('keyup', tableFilterKeyHandler);
});

let tablePages = 0;

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
        // Don't do anything if we're in an input field
        let active = document.activeElement;
        let tag = active.tagName.toLowerCase();
        if (tag == "textarea" || (tag == "input" && active.type.toLowerCase() == "text"))
        {
            return;
        }

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
                case  70: // F
                    if ($$(".filterBtn"))
                    {
                        $$(".filterBtn").click();
                    }
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
                if (isNaN(page) || page <= 0 || page > tablePages)
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
            else if (e.keyCode == 27 /*esc*/)
            {
                this.value = '';
                this.parentNode.parentNode.$$('.searchBtn').click();
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

function setupFilter()
{
    if (typeof(filterHtml) == 'undefined')
    {
        $('.filterBtn').forEach(function(filter)
        {
            filter.style.display = 'none';
        });

        return;
    }

    $('.filterBtn').forEach(function(filter)
    {
        filter.addEventListener("click", launchFilter);
    });
}

/// <summary>
/// Launch the filter dialog and set up applicable event handlers
/// </summary>
function launchFilter()
{
    let overlay = buildNode(
        'div',
        { 'id' : 'filterOverlay', 'style' : 'opacity: 0' },
        filterHtml().outerHTML,
        {
            'click' : function(e)
            {
                // A click outside the main dialog will dismiss it
                if (e.target.id == 'filterOverlay')
                {
                    dismissFilterDialog();
                }
            }
        }
    );

    document.body.appendChild(overlay);

    // Somewhat hacky to do this here, but query selection doesn't
    // work until the item is actually added to the DOM
    let perPage = $('#showPerPage');
    if (perPage)
    {
        perPage.value = getPerPage();
    }

    populateFilter();
    $('#applyFilter').addEventListener('click', function()
    {
        setPage(0);
        let applyPerPage = !!$('#showPerPage');
        setFilter(getNewFilter(), !applyPerPage /*update*/)
        if (applyPerPage)
        {
            setPerPage($('#showPerPage').value, true /*update*/);
        }

        dismissFilterDialog();
    });
    $('#cancelFilter').addEventListener('click', dismissFilterDialog);
    $('#resetFilter').addEventListener('click', function()
    {
        setPage(0);
        setFilter(defaultFilter(), true);
        dismissFilterDialog();
    });

    Animation.queue({'opacity' : 1}, overlay, 250);

    // Set focus to the first input
    overlay.$$('input').focus();
}

/// <summary>
/// Wraps the given options in a common filter UI container
/// </summary>
function filterHtmlCommon(options)
{
    let container = buildNode('div', { 'id' : 'filterContainer' });
    container.appendChild(buildNode('h3', {}, 'Filter Options'));
    container.appendChild(buildNode('hr'));
    options.forEach(function(option)
    {
        container.appendChild(option);
    });

    // In mobile view we don't show 'per page' directly in the table
    // header to save space. Move it into the filter UI
    if (getComputedStyle($$('.nomobile')).display != 'inline')
    {
        container.appendChild(buildTableFilterDropdown(
            'Show Per Page',
            {
                '25' : '25',
                '50' : '50',
                '100' : '100',
                'All' : '0'
            }));

        container.appendChild(buildNode('hr'));
    }

    let buttonHolder = buildNode('div', {'class' : 'formInput'});
    let innerButtonHolder = buildNode('div', {'class' : 'filterButtons'});
    innerButtonHolder.appendChild(buildNode('input', {
        'type' : 'button',
        'value' : 'Cancel',
        'id' : 'cancelFilter',
        'style' : 'margin-right: 10px'
    }));
    innerButtonHolder.appendChild(buildNode('input', {
        'type' : 'button',
        'value' : 'Reset',
        'id' : 'resetFilter',
        'style' : 'margin-right: 10px'
    }));
    innerButtonHolder.appendChild(buildNode('input', {
        'type' : 'button',
        'value' : 'Apply',
        'id' : 'applyFilter'
    }));

    buttonHolder.appendChild(innerButtonHolder);
    container.appendChild(buttonHolder);

    return container;
}

/// <summary>
/// Returns a checkbox filter item with the given label and name
/// If the name is empty, return an hr instead
/// </summary>
function buildTableFilterCheckbox(label, name)
{
    if (name == '')
    {
        return buildNode('hr');
    }

    let div = buildNode(
        'div',
        { 'class' : 'formInput' },
        0,
        {
            'click' : function(e)
            {
                // If we clicked the filter itme but not directly on the label.checkbox, pretend we did
                if (e.target == this)
                {
                    this.$$('input').click();
                }
            }
        }
    );
    div.appendChild(buildNode('label', { 'for' : name }, label + ': '));
    div.appendChild(buildNode(
        'input',
        {
            'type' : 'checkbox',
            'name' : name,
            'id' : name
        })
    );

    return div;
}

/// <summary>
/// Builds a filter dropdown
/// </summary>
function buildTableFilterDropdown(title, options, addId=false)
{
    // Make the name the camelCase version of the title
    let name = title.split(' ');
    name = name.splice(0, 1)[0].toLowerCase() + name.join('');
    let container = buildNode('div', { 'class' : 'formInput' });
    container.appendChild(buildNode('label', { 'for' : name }, title + ': '));
    let select = buildNode('select', { 'name' : name, 'id' : name });
    for (let [label, value] of Object.entries(options))
    {
        let option = buildNode('option', { 'value' : value }, label);
        if (addId)
        {
            option.id = value;
        }

        select.appendChild(option);
    }

    container.appendChild(select);
    return container;
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
    if (page == tablePages - 1)
    {
        return;
    }

    setPage(page + 1, true);
}

/// <summary>
/// Returns the identifier for this table, or a 'shared' id
/// if no id has been provided
/// </summary>
function tableIdCore()
{
    if (typeof(tableIdentifier) == 'undefined')
    {
        return 'table_shared';
    }

    return 'table_' + tableIdentifier();
}

/// <summary>
/// Returns the user's current page
/// </summary>
function getPage()
{
    let page = parseInt(localStorage.getItem(tableIdCore() + '_page'));
    if (page == null || isNaN(page) || page < 0)
    {
        page = 0;
        setPage(page);
    }

    return page;
}

/// <summary>
/// Stores the current page for the user
/// </summary>
function setPage(page, update)
{
    localStorage.setItem(tableIdCore() + '_page', page);
    if (update)
    {
        clearElement("tableEntries");
        tableUpdateFunc()();
    }

    if (page == 0)
    {
        $('.previousPage').forEach(function(button)
        {
            button.classList.add('disabled');
            button.disabled = true;
        });
    }
    else
    {
        $('.previousPage').forEach(function(button)
        {
            button.classList.remove('disabled');
            button.disabled = false;
        });
    }

    if (page == tablePages - 1)
    {
        $('.nextPage').forEach(function(button)
        {
            button.classList.add('disabled');
            button.disabled = true;
        });
    }
    else
    {
        $('.nextPage').forEach(function(button)
        {
            button.classList.remove('disabled');
            button.disabled = false;
        });
    }
}

/// <summary>
/// Returns the number of items per page the user wants to see
/// </summary>
function getPerPage()
{
    let storage = tableIdCore() + '_perPage';
    let perPage = parseInt(localStorage.getItem(storage));
    if (perPage == null || isNaN(perPage) || perPage % 25 != 0 || perPage < 0)
    {
        localStorage.setItem(storage, 25);
        perPage = 25;
    }

    return perPage;
}

/// <summary>
/// Set the number of items to show per page
/// </summary>
function setPerPage(newPerPage, update)
{
    localStorage.setItem(tableIdCore() + '_perPage', newPerPage);
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
        tableUpdateFunc()();
    }
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
/// Sets up click handlers for per-page options
/// </summary>
function setupPerPage()
{
    if (typeof(getPerPage) == 'undefined')
    {
        $('.perPageHolder').forEach(function(holder)
        {
            holder.style.display = 'none';
        });

        return;
    }

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
function setFilter(filter, update)
{
    logVerbose(filter, "Setting filter to");
    localStorage.setItem(tableIdCore() + '_filter', JSON.stringify(filter));
    if (update)
    {
        clearElement("tableEntries");
        tableUpdateFunc()();
    }
}

/// <summary>
/// Update the "Page X of Y" strings in the table
/// </summary>
function setPageInfo(totalRequests)
{
    tablePages = getPerPage() == 0 ? 1 : Math.ceil(totalRequests / getPerPage())
    $(".pageSelect").forEach(function(e)
    {
        e.value = getPage() + 1;
    });

    $(".pageCount").forEach(function(e)
    {
        e.innerHTML = tablePages;
    });

    setPage(getPage(), false);
}

/// <summary>
/// Get a list of all the users to populate the admin-only filter option
/// </summary>
function populateUserFilter()
{
    let params = { "type" : ProcessRequest.GetAllMembers };
    let successFunc = function(response)
    {
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

let tableEntries = $('#tableEntries');
function addTableItem(element)
{
    tableEntries.appendChild(element);
}

function tableItemHolder()
{
    return buildNode('div', { 'class' : 'tableEntryHolder' });
}

function clearTable()
{
    clearElement('tableEntries');
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