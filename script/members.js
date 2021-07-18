/// <summary>
/// Logic to display the list of registered users.
/// </summary>

/* eslint-disable class-methods-use-this */

class MemberTable extends Table
{
    supportsSearch() { return true; }
    identifier() { return "members"; }
    updateFunc() { return getMembers; }
}

let memberTable;
window.addEventListener("load", function()
{
    memberTable = new MemberTable(new MemberFilter());
    memberTable.update();
});

/// <summary>
/// Get list of members from the server, based on the current filter
/// </summary>
/// <param name="searchValue">Optional search term to further filter results based on substring matching</param>
function getMembers(searchValue="")
{
    let parameters =
    {
        type : ProcessRequest.GetMembers,
        num : memberTable.getPerPage(),
        page : memberTable.getPage(),
        search : searchValue,
        filter : JSON.stringify(memberTable.filter.get())
    };

    memberTable.displayInfoMessage("Loading...");
    let successFunc = function(response)
    {
        buildMembers(response.data);
        memberTable.setPageInfo(response.total);

        if (searchValue.length != 0)
        {
            $$(".searchBtn").click();
        }
    };

    let failureFunc = function()
    {
        memberTable.displayInfoMessage("Something went wrong :(");
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
    let holder = memberTable.itemHolder();
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
    memberTable.clear();
    if (members.length == 0)
    {
        memberTable.displayInfoMessage("No members returned. That can't be right!");
        return;
    }

    members.forEach(function(member)
    {
        memberTable.addItem(buildMember(member));
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
