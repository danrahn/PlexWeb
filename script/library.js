/// <summary>
/// Displays information about libraries on the plex server. Implements tableCommon
/// </summary>

/* eslint-disable class-methods-use-this */

class LibraryTable extends Table
{
    supportsSearch() { return false; }
    identifier() { return "library"; }
    updateFunc() { return () => sendHtmlJsonRequest("administration.php", { type : "sections" }, buildSections); }
}

let libraryTable;
window.addEventListener("load", function()
{
    libraryTable = new LibraryTable();
    libraryTable.update();
});

/// <summary>
/// Build the table of sections returned by the server
/// </summary>
function buildSections(sections)
{
    let outerDiv = $("#tableEntries");
    sections.forEach(function(section)
    {
        outerDiv.appendChild(buildSection(section));
    });
}

/// <summary>
/// Build the table entry for a single plex library section
/// </summary>
function buildSection(section)
{
    Log.info(section);
    section.created = new Date(section.created * 1000);
    section.updated = new Date(section.updated * 1000);
    section.last_scanned = new Date(section.last_scanned * 1000);
    let div = libraryTable.itemHolder();
    let list = buildNode("ul");
    for (let [key, value] of Object.entries(section))
    {
        list.appendChild(listItem(key, value, value instanceof Date));
    }

    return div.appendChildren(list.appendChildren(getRefreshNode(section.key)));
}

/// <summary>
/// Creates a list of library properties
/// </summary>
function listItem(key, value, dateTooltip=false)
{
    let li = buildNode("li");
    li.appendChild(buildNode("strong", {}, `${titleCase(key)}: `));
    if (dateTooltip)
    {
        let liDate = buildNode("span", {}, DateUtil.getDisplayDate(value));
        Tooltip.setTooltip(liDate, DateUtil.getFullDate(value));
        li.appendChild(liDate);
    }
    else
    {
        li.appendChild(buildNode("span", {}, value));
    }

    return li;
}

/// <summary>
/// Title cases a string, treating underscores as spaces
/// </summary>
function titleCase(value)
{
    let words = value.split("_");
    let title = "";
    words.forEach(function(word)
    {
        title += word[0].toUpperCase() + word.substring(1).toLowerCase() + " ";
    });

    return title;
}

/// <summary>
/// Build a button that will refresh the plex library
/// </summary>
function getRefreshNode(key)
{
    let li = buildNode("li", {});
    let button = buildNode("input",
        { type : "button", value : "refresh", section : key, id : "section" + key },
        "Refresh",
        { click : refreshNode });
    li.appendChild(button);
    return li;
}

/// <summary>
/// Refreshes a plex library. Colors the button on success/failure
/// </summary>
function refreshNode()
{
    let key = this.getAttribute("section");
    let successFunc = function()
    {
        let btn = $("#section" + key);
        Animation.fireNow({ backgroundColor : new Color(63, 100, 69) }, btn, 500);
        Animation.queueDelayed({ backgroundColor : new Color(63, 66, 69) }, btn, 2000, 500, true);
    };

    let failureFunc = function()
    {
        let btn = $("#section" + key);
        Animation.fireNow({ backgroundColor : new Color(100, 66, 69) }, btn, 500);
        Animation.queueDelayed({ backgroundColor : new Color(63, 66, 69) }, btn, 2000, 500, true);
    };

    sendHtmlJsonRequest("administration.php", { type : "refresh", section : key }, successFunc, failureFunc);
}
