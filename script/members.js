window.addEventListener('load', function()
{
    var http = new XMLHttpRequest();
    http.open('POST', 'process_request.php', true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.onreadystatechange = loadMemberList;
    http.send("&type=members");
});

function loadMemberList() {
    if (this.readyState != 4 || this.status != 200)
    {
        return;
    }

    try
    {
        let response = JSON.parse(this.responseText);
        if (response['Error'])
        {
            logError(response['Error'], `Error querying process_request.php?type=members`);
            document.getElementById("welcome").innerHTML = "Something went wrong :(";
            return;
        }

        document.getElementById("welcome").innerHTML = "Success!";
        logVerbose(response, "process_request.php?type=members");
        buildTable(response);
    } catch (ex)
    {
        logError(ex, "Exception");
        logError(this.responseText, "Exception Text");
    }
}

function buildTable(users)
{
    let table = document.createElement("table");
    table.id = "members";
    appendHeaders(table, "ID", "Username", "Level", "Last Seen");
    for (let i = 0; i < users.length; ++i)
    {
        appendData(table, users[i]);
    }

    document.querySelector(".tableHolder").appendChild(table);
}

function appendHeaders(table, ...values)
{
    appendRow("th", table, ...values);
}

function appendData(table, user)
{
    appendRow("td", table, user.id, user.username, user.level, user.last_seen);
}

function appendRow(type, table, ...values)
{
    let row = document.createElement("tr");
    for (var i = 0; i < values.length; ++i)
    {
        row.appendChild(getTableCell(type, values[i]));
    }

    table.appendChild(row);
}

function getTableCell(type, value, className, id)
{
    let th = document.createElement(type);
    if (className)
    {
        th.className = className;
    }

    if (id)
    {
        th.id = id;
    }

    th.innerHTML = value;
    return th;
}