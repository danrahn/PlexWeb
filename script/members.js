/// <summary>
/// Logic to display the list of registered users. Implements tableCommon
/// </summary>

/* exported populateFilter, getNewFilter, filterHtml, supportsSearch, tableIdentifier, tableUpdateFunc  */

window.addEventListener("load", function()
{
    Table.update();
});

/// <summary>
/// Unique identifier for this table. Used by tableCommon
/// </summary>
function tableIdentifier()
{
    return "members";
}

/// <summary>
/// The function to call that will update this table. Used by tableCommon
/// </summary>
function tableUpdateFunc()
{
    return getMembers;
}

/// <summary>
/// Get list of members from the server, based on the current filter
/// </summary>
/// <param name="searchValue">Optional search term to further filter results based on substring matching</param>
function getMembers(searchValue="")
{
    let parameters =
    {
        type : ProcessRequest.GetMembers,
        num : Table.getPerPage(),
        page : Table.getPage(),
        search : searchValue,
        filter : JSON.stringify(getFilter())
    };

    Table.displayInfoMessage("Loading...");
    let successFunc = function(response)
    {

        buildMembers(response.data);
        Table.setPageInfo(response.total);

        if (searchValue.length != 0)
        {
            $$(".searchBtn").click();
        }
    };

    let failureFunc = function()
    {
        Table.displayInfoMessage("Something went wrong :(");
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Builds the username span of the table entry,
/// adding different styles based on the user's level
/// </summary>
function getUsernameSpan(member)
{
    let user = buildNode("span", { class : "memberName" }, member.username);
    if (member.level >= 100)
    {
        user.classList.add("adminName");
    }
    else if (member.level == 0)
    {
        user.classList.add("newName");
    }

    return user;
}

/// <summary>
/// Builds a table entry for a single member
/// </summary>
function buildMember(member)
{
    let holder = Table.itemHolder();
    let title = buildNode("div", { class : "memberTitle" });
    title.appendChild(buildNode(
        "span",
        { id : "member_" + member.id, class : "memberExpand" },
        "+",
        {
            click : expandContractMember
        }));


    title.appendChild(getUsernameSpan(member));
    holder.appendChild(title);

    let list = buildNode("ul", { class : "memberDetails" });
    const li = (label, value) => buildNode("li", {}, label + ": " + value);
    let lastSeen = li("Last Seen", DateUtil.getDisplayDate(member.last_seen));
    Tooltip.setTooltip(lastSeen, DateUtil.getFullDate(member.last_seen));
    list.appendChild(lastSeen);

    if (member.name.trim().length > 0)
    {
        list.appendChild(li("Name", member.name));
    }

    if (member.email.length > 0)
    {
        list.appendChild(li("Email", member.email));
    }

    if (member.phone != 0)
    {
        let phone = "(" + member.phone.substring(0, 3) + ") " + member.phone.substring(3, 6) + "-" + member.phone.substring(6);
        list.appendChild(li("Phone", phone));
    }

    return holder.appendChildren(
        list.appendChildren(
            buildNode("li", {}, `ID: ${member.id}`),
            buildNode("li", {}, `Level: ${member.level}`)
        )
    );
}

/// <summary>
/// Build our member table from the server response
/// </summary>
function buildMembers(members)
{
    Table.clear();
    if (members.length == 0)
    {
        Table.displayInfoMessage("No members returned. That can't be right!");
        return;
    }

    members.forEach(function(member)
    {
        Table.addItem(buildMember(member));
    });
}

/// <summary>
/// Event handler to expand or contrast user details when they click on (+/-)
/// </summary>
function expandContractMember()
{
    if (this.innerHTML == "+")
    {
        this.innerHTML = "-";
        this.parentNode.parentNode.$$(".memberDetails").style.display = "block";
    }
    else
    {
        this.innerHTML = "+";
        this.parentNode.parentNode.$$(".memberDetails").style.display = "none";
    }
}

/// <summary>
/// Modifies the filter HTML to reflect the current filter settings
/// </summary>
function populateFilter()
{
    let filter = getFilter();
    $("#showNew").checked = filter.type.new;
    $("#showRegular").checked = filter.type.regular;
    $("#showAdmin").checked = filter.type.admin;
    $("#hasPII").value = filter.pii;
    $("#sortBy").value = filter.sort;
    $("#sortOrder").value = filter.order == "desc" ? "sortDesc" : "sortAsc";

    setSortOrderValues();
    $("#sortBy").addEventListener("change", setSortOrderValues);
}

/// <summary>
/// Returns the new filter definition based on the state of the filter HTML
/// </summary>
function getNewFilter()
{
    return {
        type :
        {
            new : $("#showNew").checked,
            regular : $("#showRegular").checked,
            admin : $("#showAdmin").checked
        },
        pii : $("#hasPII").value,
        sort : $("#sortBy").value,
        order : $("#sortOrder").value == "sortDesc" ? "desc" : "asc"
    };
}

/// <summary>
/// Handler that modifies the sort order strings based on the sort criteria
/// </summary>
function setSortOrderValues()
{
    let sortBy = $("#sortBy").value;
    if (sortBy == "level")
    {
        $("#sortDesc").text = "Highest to Lowest";
        $("#sortAsc").text = "Lowest to Highest";
    }
    else if (sortBy == "name")
    {
        $("#sortDesc").text = "A-Z";
        $("#sortAsc").text = "Z-A";
    }
    else if (sortBy == "seen")
    {
        $("#sortDesc").text = "Descending";
        $("#sortAsc").text = "Ascending";
    }
    else
    {
        $("#sortDesc").text = "Newest First";
        $("#sortAsc").text = "Oldest First";
    }
}

/// <summary>
/// Builds and returns the HTML for the filter dialog
/// </summary>
function filterHtml()
{
    let options = [];

    let checkboxes =
    {
        "New Members" : "showNew",
        Regulars : "showRegular",
        Admins : "showAdmin"
    };

    for (let [label, name] of Object.entries(checkboxes))
    {
        options.push(Table.Filter.buildCheckbox(label, name));
    }

    options.push(buildNode("hr"));

    options.push(Table.Filter.buildDropdown(
        "Has PII",
        {
            All : "all",
            Yes : "yes",
            No : "no"
        }));
    options.push(buildNode("hr"));

    options.push(Table.Filter.buildDropdown(
        "Sort By",
        {
            "Account Age" : "id",
            Name : "name",
            "Last Login" : "seen",
            Level : "level",
        }));

    options.push(Table.Filter.buildDropdown(
        "Sort Order",
        {
            "Newest First" : "sortDesc",
            "Oldest First" : "sortAsc"
        },
        true /*addId*/));
    options.push(buildNode("hr"));

    return Table.Filter.htmlCommon(options);
}

/// <summary>
/// Shorthand for the verbose Object's hasOwnProperty call
/// </summary>
function hasProp(item, property)
{
    return Object.prototype.hasOwnProperty.call(item, property);
}

/// <summary>
/// Retrieves the stored user filter (persists across page navigation, for better or worse)
/// </summary>
function getFilter()
{
    let filter = null;
    try
    {
        filter = JSON.parse(localStorage.getItem(Table.idCore() + "_filter"));
    }
    catch (e)
    {
        logError("Unable to parse stored filter, resetting");
    }

    if (filter === null ||
        !hasProp(filter, "type") ||
            !hasProp(filter.type, "new") ||
            !hasProp(filter.type, "regular") ||
            !hasProp(filter.type, "admin") ||
        !hasProp(filter, "pii") ||
        !hasProp(filter, "sort") ||
        !hasProp(filter, "order"))
    {
        if (filter !== null)
        {
            logError(filter, "Bad filter, resetting");
        }

        filter = defaultFilter();
        Table.Filter.set(filter, false);
    }

    logVerbose(filter, "Got Filter");
    return filter;
}

/// <summary>
/// Returns the default filter for the member table (i.e. nothing filtered)
/// </summary>
function defaultFilter()
{
    return {
        type :
        {
            new : true,
            regular : true,
            admin : true
        },
        pii : "all",
        sort : "id",
        order : "asc"
    };
}

/// <summary>
/// Returns whether we support table search. We do for members
/// </summary>
function supportsSearch()
{
    return true;
}
