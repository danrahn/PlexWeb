<?php
session_start();
require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
verify_loggedin(TRUE /*redirect*/);

function fill_request_table()
{
    print("<table id='requestTable'>");
    write_headers();
    write_rows();
}

function write_headers()
{
    $new_style = true;
    print("<tr>");
    print_th("Request Name");
    print_th("User");
    print_th("Request Type");
    print_th("Status");
    print_th("Request Date");
    if (!$new_style) print_th("Request Comment");
    print_th("Last Updated");
    if (!$new_style) print_th("Admin Comment");
    print("</tr>");
}

function write_rows()
{
    global $db;

    $new_style = true;

    $query = "";
    $id = (int)$_SESSION['id'];
    $level = (int)$_SESSION['level'];
    if ($level != 100)
    {
        // Only level 100 sees every request
        $query = "SELECT request_name, u.username AS username, request_type, satisfied, request_date, comment, satisfied_date, admin_comment, user_requests.id, u.id FROM user_requests INNER JOIN users u ON user_requests.username_id=u.id WHERE user_requests.username_id=$id ORDER BY request_date DESC";
    }
    else
    {
        $query = "SELECT request_name, u.username AS username, request_type, satisfied, request_date, comment, satisfied_date, admin_comment, user_requests.id, u.id FROM user_requests INNER JOIN users u ON user_requests.username_id=u.id ORDER BY request_date DESC";
    }

    $result = $db->query($query);
    if (!$result)
    {
        return;
    }

    while ($row = $result->fetch_row())
    {
        print("<tr>");

        $is_media_req = RequestType::is_media_request($row[2]);
        for ($i = 0; $i < 8; ++$i)
        {
            switch ($i)
            {
                case 0:
                    if (!$is_media_req)
                    {
                        print_td($row[$i]);
                    }
                    else
                    {
                        print_td("<a href='request.php?id=" . $row[8] . "'>" . $row[$i] . '</a>');
                    }
                    break;
                case 2:
                    $req_type = $row[$i];
                    print_td(RequestType::get_str($req_type));
                    break;
                case 3:
                    if ($level == 100)
                    {
                        // If the status is pending, let admins change it
                        print_status_options((int)$row[$i], $row[8], $is_media_req);
                    }
                    else
                    {
                        switch ((int)$row[$i])
                        {
                            case 0:
                                print_td("Pending");
                                break;
                            case 1:
                                print_td($is_media_req ? "Complete" : "Approved", "approved_request");
                                break;
                            default:
                                print_td("Denied", "denied_request");
                                break;
                        }
                    }
                    break;
                case 5:
                    if ($new_style)
                    {
                        break;
                    }
                    if ($row[9] == $_SESSION['id'])
                    {
                        print_input_td($row[4], $row[8], "usr_cm");
                    }
                    else
                    {
                        print_td($row[$i]);
                    }
                    break;
                case 6:
                    print_td($row[6] == $row[0] ? "N/A" : $row[6]);
                    break;
                case 7:
                    if ($new_style)
                    {
                        break;
                    }
                    else if ($level == 100)
                    {
                        print_input_td($row[7], $row[8], "adm_cm"); // Row 8 == request id
                        break;
                    }
                default:
                    print_td($row[$i]);
                    break;
            }
        }

        print("</tr>");
    }

    $result->close();
}

function print_th($h)
{
    print("<th>" . $h . "</th>");
}

function print_td($d, $class=NULL)
{
    print("<td");
    if ($class)
    {
        print(" class='$class'");
    }

    print(">" . $d . "</td>");
}

function print_input_td($d, $rid, $idstr)
{
    print("<td><textarea class='$idstr' id='" . $idstr . "_" . $rid . "' maxlength=1024 placeholder='Ctrl+Enter to submit'>" . htmlspecialchars($d, ENT_QUOTES) . "</textarea></td>");
}

function print_status_options($status, $rid, $is_media)
{
    $class = ($status === 1 ? "approved_request" : ($status === 2 ? "denied_request" : ""));
    print("<td class='$class'><select class='status' name='status_$rid' id='status_" . $rid . "'>");
    $options = ["Pending", $is_media ? "Complete" : "Approved", "Denied"];
    for ($i = 0; $i < 3; ++$i)
    {
        print("<option value='$i'");
        if ($i == $status)
        {
            print(" selected='selected'");
        }

        print(">$options[$i]</option>");
    }

    print("</select></td>");
}

?>

<!DOCTYPE html>
<html lang=en-us>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="stylesheet" type="text/css" href="resource/request.css">
    <link rel="shortcut icon" href="favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260" />
    <script src="resource/min/animate.min.js"></script>
    <script src="resource/consolelog.js"></script>
    <title>Plex Status: Requests</title>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div class="tableHolder">
            <?php fill_request_table() ?>
        </div>
    </div>
</div>
</body>
<script>
(function() {
    let initialValues = {};
    function updateAll()
    {
        logVerbose("Updating all items");
        let comments = document.querySelectorAll(".usr_cm, .adm_cm, .status");
        let newUpdateMethod = <?php if ($_SESSION['level'] < 100) { echo 'false'; } else { echo 'true'; } ?>;
        let data = { "type" : "req_update", "data" : [] };
        let attachedElements = [];
        let submittedValues = [];
        for (let i = 0; i < comments.length; ++i)
        {
            if (comments[i].getAttribute("modified") === "true")
            {
                if (newUpdateMethod)
                {
                    comments[i].setAttribute("modified", "false");
                    data.data.push({ "id" : comments[i].id.substring(7), "kind" : comments[i].className, "content" : comments[i].value });
                    attachedElements.push(comments[i]);
                    submittedValues.push(comments[i].value);
                }
                else
                {
                    updateRequest(comments[i], comments[i].id.substring(7), comments[i].className);
                }
            }
        }

        if (newUpdateMethod)
        {
            logInfo(data, true);
            batchUpdate(data, attachedElements, submittedValues);
        }
    }

    /// <summary>
    /// Update multiple items at once, sending a single batched notification instead of multiple separate ones
    /// </summary>
    function batchUpdate(data, elements, submittedValues)
    {
        let http = new XMLHttpRequest();
        http.open("POST", "update_request.php", true);
        http.setRequestHeader("Content-type", "application/json; charset=UTF-8");
        http.attachedElements = elements;
        http.submittedValues = submittedValues;
        http.onreadystatechange = function() {
            if (this.readyState != 4 || this.status != 200) {
                logVerbose(this.readyState + " - " + this.status);
                return;
            }

            let response;
            try {
                response = JSON.parse(this.responseText);
                if (response.Error) {
                    logError(response.Error);
                }
                logVerbose(response, true);
            } catch (ex) {
                logError(ex, true);
                logError(this.responseText);
                return;
            }

            if (!response.Success)
            {
                logVerbose("No success!");
                for (let i = 0; i < this.attachedElements.length; ++i)
                {
                    this.attachedElements[i].setAttribute("modified", "true");
                }
            }

            const bgColor = response.Success ? new Color(63, 100, 69) : new Color(100, 66, 69);
            for (let i = 0; i < this.attachedElements.length; ++i)
            {
                if (this.attachedElements[i].getAttribute("modified") === "true") {
                    continue;
                }

                Animation.queue({ "backgroundColor" : bgColor }, this.attachedElements[i], 500);
                if (response.Success) {
                    initialValues[this.attachedElements[i].id] = this.submittedValues[i];

                    const oldBg = new Color(63, 66, 69);
                    setTimeout(function(ele, oldBg) {
                        if (ele.getAttribute("modified") != "true") {
                            Animation.queue({"backgroundColor" : oldBg}, ele, 500);
                        }
                    }, 1000, this.attachedElements[i], oldBg);
                }
            }
        }

        http.send(JSON.stringify(data));
    }

    function updateRequest(element, reqId, requestType, field="value")
    {
        element.setAttribute("modified", "false");
        logInfo("Updating content for requestId " + reqId + " (" + requestType + ")");

        let http = new XMLHttpRequest();
        http.open("POST", "process_request.php", true /*async*/);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.attachedElement = element;
        http.submittedValue = element[field];
        http.onreadystatechange = function() {
            if (this.readyState != 4 || this.status != 200)
            {
                logVerbose(`ReadyState: ${this.readyState}; Status: ${this.status}`);
                return;
            }

            logVerbose("Updated content request!");
            logVerbose("Response: " + this.responseText);
            let response = null;
            try
            {
                response = JSON.parse(this.responseText);
                if (response.Error)
                {
                    logError(response.Error);
                }
            }
            catch (ex)
            {
                logError(ex, true);
                logError(this.responseText);
            }

            if (!response.Success)
            {
                // Reset the modified flag so we can retry
                this.attachedElement.setAttribute("modified", "true");
            }

            if (this.attachedElement.getAttribute("modified") === "true")
            {
                // Don't animate anything if we've already modified the string since sending the request
                return;
            }

            const bgColor = response.Success ? new Color(63, 100, 69) : new Color(100, 66, 69);
            Animation.queue({"backgroundColor" : bgColor }, this.attachedElement, 500);
            if (response.Success)
            {
                initialValues[this.attachedElement.id] = this.submittedValue;

                // Don't reset to our default background if we failed; keep it red
                const oldBg = new Color(63, 66, 69);
                setTimeout(function(ele, oldBg) {
                    if (ele.getAttribute("modified") !== "true")
                    {
                        // The user may have modified it in the on second since we started the timer
                        Animation.queue({"backgroundColor" : oldBg}, ele, 500);
                    }
                }, 1000, this.attachedElement, oldBg);
            }
        };

        http.send(
            "&type=req_update" +
            "&id=" + encodeURIComponent(reqId) +
            "&kind=" + encodeURIComponent(requestType) +
            "&content=" + encodeURIComponent(element[field])
        );
    }

    function setCommentListeners(className, requestType, field="value") {
        let comments = document.querySelectorAll(className);
        for (let i = 0; i < comments.length; ++i)
        {
            initialValues[comments[i].id] = comments[i][field];
            comments[i].setAttribute("modified", "false");
            comments[i].addEventListener("input", function(e) {
                let value = (this.tagName.toLowerCase() == "select" ? this.selectedIndex : this.value);
                logTmi("New value: " + value + " (Old value: " + initialValues[this.id] + ")");
                if (!this.getAttribute("modified") || this.getAttribute("modified") == "false") {
                    this.setAttribute("modified", "true");
                    Animation.queue({"backgroundColor" : new Color(100, 80, 69)}, this, 200);
                } else {
                    if (initialValues[this.id] == value) {
                        Animation.queue({"backgroundColor" : new Color(63, 66, 69)}, this, 200);
                        this.setAttribute("modified", false);
                    }
                }
            });
            comments[i].addEventListener("keyup", function(e) {

                e = e || window.event;
                const key = e.which || e.keyCode;
                if (key === 13 && e.ctrlKey) {
                    updateRequest(this, this.id.substring(7), requestType, field);
                }
            });
        }

        logVerbose(initialValues, true);
    }

    window.addEventListener("load", function() {
        setCommentListeners(".adm_cm", "adm_cm");
        setCommentListeners(".usr_cm", "usr_cm");
        setCommentListeners(".status", "status", "selectedIndex");
        if (document.querySelector(".usr_cm, .adm_cm")) {
            let updateButton = document.createElement("input");
            let updateDiv = document.createElement("div");
            updateDiv.style.textAlign = "center";
            updateDiv.style.width = "100%";
            updateButton.type = "button";
            updateButton.value = "Update All";
            updateButton.addEventListener("click", updateAll);
            updateButton.style.width = "100px";
            updateButton.style.margin = "10px auto 0 auto";
            updateButton.style.height = "50px";
            updateButton.style.float = "none";
            updateDiv.appendChild(updateButton);
            document.getElementById("container").appendChild(updateDiv);
        }

        let statuses = document.querySelectorAll(".status");
        for (let i = 0; i < statuses.length; ++i)
        {
            statuses[i].addEventListener("change", function()
            {
                this.parentNode.className = this.selectedIndex === 0 ? "" : this.selectedIndex === 1 ? "approved_request" : "denied_request";
            });
        }
    });
})();
</script>
</html>