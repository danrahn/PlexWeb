<?php
session_start();

require_once "includes/config.php";
require_once "includes/common.php";
verify_loggedin(true);
requireSSL();

if ((int)$_SESSION['level'] < 100)
{
    error_and_exit(401);
}

?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="stylesheet" type="text/css" href="resource/request.css">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <script src="resource/min/animate.min.js"></script>
    <script src="resource/consolelog.js"></script>
    <title>Plex Status: Members</title>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="welcome">Loading Member List...</div>
        <div class="tableHolder">
        </div>
    </div>
</div>
</body>
<script>
(function() {
    window.addEventListener('load', function() {
        var http = new XMLHttpRequest();
        http.open('POST', 'process_request.php', true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.onreadystatechange = loadMemberList;
        http.send("&type=members");
    });

    function loadMemberList() {
        if (this.readyState != 4 || this.status != 200) {
            return;
        }

        try {
            let response = JSON.parse(this.responseText);
            if (response['Error']) {
                logError(response['Error']);
                document.getElementById("welcome").innerHTML = "Something went wrong :(";
                return;
            }

            document.getElementById("welcome").innerHTML = "Success!";
            logVerbose(response, true);
            buildTable(response);
        } catch (ex) {
            logError(ex);
            logError(this.responseText);
        }
    }

    function buildTable(users) {
        let table = document.createElement("table");
        table.id = "members";
        appendHeaders(table, "ID", "Username", "Level", "Last Seen");
        for (let i = 0; i < users.length; ++i) {
            appendData(table, users[i]);
        }

        document.querySelector(".tableHolder").appendChild(table);
    }

    function appendHeaders(table, ...values) {
        appendRow("th", table, ...values);
    }

    function appendData(table, user) {
        appendRow("td", table, user.id, user.username, user.level, user.last_seen);
    }

    function appendRow(type, table, ...values) {
        let row = document.createElement("tr");
        for (var i = 0; i < values.length; ++i) {
            row.appendChild(getTableCell(type, values[i]));
        }

        table.appendChild(row);
    }

    function getTableCell(type, value, className, id) {
        let th = document.createElement(type);
        if (className) {
            th.className = className;
        }

        if (id) {
            th.id = id;
        }

        th.innerHTML = value;
        return th;
    }
})();
</script>
</html>