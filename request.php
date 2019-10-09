<?php
session_start();
require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
$req_id = (int)param_or_die("id");
verify_loggedin(TRUE /*redirect*/, "request.php?id=" . $req_id);

$details = get_details($req_id);

if ($_SESSION['level'] != 100 && !$details->is_author)
{
    error_and_exit(403, "You don't have access to this request!<br><br><a href='requests.php'>Take me back!</a>");
}

function get_details($req_id)
{
    global $db;
    $query = "SELECT username_id, external_id, request_type, request_name, satisfied FROM user_requests WHERE id=$req_id";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        error_and_exit(500);
    }

    if ($result->num_rows == 0)
    {
        error_and_exit(400, "Invalid request");
    }

    $row = $result->fetch_row();
    $details = new \stdClass();
    $details->is_author = $row[0] == $_SESSION['id'];
    $details->external_id = $row[1];
    $details->request_type = RequestType::get_type($row[2]);
    $details->request_name = $row[3];
    $details->status = $row[4];
    $details->is_media_request = RequestType::is_media_request($details->request_type);

    return $details;
}

?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="shortcut icon" href="favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <script src="resource/min/animate.min.js"></script>
    <script src="resource/consolelog.js"></script>
    <script src="resource/queryStatus.js"></script>
    <title>Plex Request</title>
    <style>
        .searchResult {
            border: 1px solid #2e2e2e;
            overflow: hidden;
            width: calc(100% - 2px);
            height: 70px;
            vertical-align: middle;
            background-color: rgba(0,0,0,0.1);
        }

        .searchResult:hover {
            background-color: rgba(0,0,0,0.2);
        }

        .selectedSuggestion {
            background-color: #2E5E3E;
        }
        .selectedSuggestion:hover {
            background-color: #1E4E2E;
        }

        .searchResult img {
            height: 100%;
            float: left;
            margin-right: 10px;
        }

        .searchResult div {
            width: auto;
            font-size: small;
            position: relative;
            top: 50%;
            -ms-transform: translateY(-50%);
            -webkit-transform: translateY(-50%);
            transform: translateY(-50%);
        }

        .matchContinue {
            margin-top: 5px;
            width: 100%;
            clear: both;
            height: 20px;
        }

        #infoContainer, #commentsHolder {
            width: 100%;
            color: #c1c1c1;
        }

        #mediaBackdrop {
            width: 100%;
            float: left;
            position: fixed;
            left: 0;
            top: 0;
            margin: 0;
            opacity: 0.5;
            -webkit-mask-image:-webkit-linear-gradient(top, rgba(0,0,0,1), rgba(0,0,0,1) 80%, rgba(0,0,0,0));
            mask-image: linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,1) 80%, rgba(0,0,0,0));
            z-index: -1;
        }

        #mediaPoster {
            border: 3px solid rgba(0,0,0,0.5);
            border-radius: 2px;
            z-index: 999;
        }

        .statusSpan {
            user-select: none;
        }

        .status0 {
            color: #C84;
        }

        .status1 {
            color: #4C4;
        }

        .status2 {
            color: #C44;
        }

        .commentHolder {
            background-color: rgba(0,0,0,0.3);
            margin-bottom: 10px;
            border: 2px solid #515151;
        }

        .commentHolder:hover {
            background-color: rgba(0,0,0,0.5);
        }

        .commentInfo {
            padding-top: 10px;
            padding-left: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #616161;
            width: calc(100% - 10px);
            text-align: left;
        }

        .commentInfo span {
            margin-right: 20px;
        }

        .commentContent {
            background-color: rgba(0,0,0,0.2);
            padding: 20px;
        }

        a, a:visited {
            color: #80A020;
        }
        a:hover {
            color: #608020;
        }

        @media (orientation: landscape), (min-width: 767px) {
            #innerInfoContainer {
                float: left;
                margin-left: 60px;
                margin-right: 60px;
                margin-top: 100px;
                padding: 20px;
                width: calc(100% - 160px);
                background-color: rgba(0,0,0,0.2);
                overflow: auto;
            }

            #mediaPoster {
                float: left;
                width: 250px;
            }

            #mediaDetails {
                float: left;
                padding: 10px 20px 10px 20px;
                width: calc(100% - 300px);
                height: auto;
            }

            #mediaDetails hr {
                border-color: rgba(200, 200, 200, 0.7);
                text-align: center;
                margin-top: 30px;
                margin-bottom: 30px;
            }

            #mediaTitle {
                font-size: 36pt;
                vertical-align: top;
                font-weight: bold;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
                margin-bottom: 20px;
            }

            #mediaYear {
                font-size: 20pt;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
            }

            #mediaLink {
                font-size: 18pt;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
            }

            #mediaOverview {
                font-size: 14pt;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
            }

            #commentsHolder {
                overflow: auto;
                float: left;
                padding: 20px;
                margin-left: 60px;
                margin-right: 60px;
                width: calc(100% - 160px);
                margin-top: 20px;
                background-color: rgba(0,0,0,0.2);
                height: auto;
            }

            #newComment {
                float: left;
                height: 50px;
                min-width: 400px;
                max-width: 100%;
                resize: both;
                margin-top: 30px;
                background-color: rgba(63, 66, 69, 0.7);
            }
        }

        @media all and (orientation: portrait) and (max-width: 767px) {
            #innerInfoContainer {
                width: 100%;
                text-align: center;
                margin-top: 100px;
            }

            #mediaPoster {
                max-width: 70%;
            }

            #mediaDetails {
                float: left;
                margin-left: 20px;
                margin-top: 10px;
                max-width: 90%;
            }

            #mediaDetails hr {
                border-color: rgba(200, 200, 200, 0.7);
                text-align: center;
                max-width: 90%;
            }

            #mediaTitle {
                font-size: 36pt;
                vertical-align: top;
                font-weight: bold;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
                margin-bottom: 20px;
            }

            #mediaYear {
                font-size: 20pt;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
                margin-bottom: 20px;
            }

            #mediaLink {
                font-size: 18pt;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
            }

            #mediaOverview {
                margin-top: 20px;
                font-size: 12pt;
                text-shadow: -1px 0 #313131, 0 1px #313131, 1px 0 #313131, 0 -1px #313131;
                margin-bottom: 20px;
            }

            #commentsHolder {
                overflow: auto;
                padding: 20px;
                margin-left: 10%;
                margin-right: 10%;
                margin-top: 30px;
                margin-bottom: 30px;
                width: calc(80% - 40px);
                margin-top: 20px;
                background-color: rgba(0,0,0,0.2);
                height: auto;
            }

            #newComment {
                float: left;
                height: 50px;
                width: 80%;
                resize: both;
                margin-top: 30px;
                background-color: rgba(63, 66, 69, 0.7);
            }

            .commentHolder {
                font-size: 10pt;
            }

            .commentInfo {
                font-size: smaller;
            }
        }
    </style>
</head>
<body>
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <?php if (!$details->is_media_request) { ?>
            <div id="infoContainer">Getting info...</div>
            <div id="commentsHolder">
                <div style="margin-bottom: 10px">Comments:</div>
                <div id="comments">
                    
                </div>
                <textarea id="newComment" placeholder="Add comment..."></textarea>
                <input type="button" id="newCommentButton" value="Add Comment" style="float: left; clear: both; margin-top: 5px; padding: 10px" />
            </div>
        <?php } else if (!$details->external_id) { ?>
            <div class="formContainer" id="info">
                <div class="formTitle">The request for <?= $details->request_name ?> was made with an older version of this website. Please choose the correct item below</div>
                <form id="searchForm" style="overflow: auto">
                    <hr />
                    <div style="margin-bottom: 10px">Potential Matches</div>
                    <div id="matchContainer">Searching...</div>
                    <hr />
                    <div style="text-align: center">---- OR ----</div>
                    <hr />
                    <div class='formInput'><label for='external_id'>IMDb ID:</label><input type=text style="float: left; margin-left: 10px" id='external_id' placeholder='tt1234567'></div>
                    <div id="imdbResult"></div>
                </form>
            </div>
        <?php } else { ?>
            <div id="infoContainer">Getting info...</div>
            <div id="commentsHolder">
                <div style="margin-bottom: 10px">Comments:</div>
                <div id="comments">
                    
                </div>
                <textarea id="newComment" placeholder="Add comment..."></textarea>
                <input type="button" id="newCommentButton" value="Add Comment" style="float: left; clear: both; margin-top: 5px; padding: 10px" />
            </div>
        <?php } ?>
    </div>
</body>
<script>
    (function() {
        if (!!$("#matchContainer"))
        {
            searchForMedia();
            $("#external_id").addEventListener("input", searchImdb);
        }
        else
        {
            if (<?php echo ($details->is_media_request ? "true" : "false")?>)
            {
                getMediaInfo();
            }
            else
            {
                getNonMediaInfo();
            }

            $("#newComment").addEventListener("focus", function() { this.className = "newCommentFocus"; });
            $("#newComment").addEventListener("blur", function() {  this.className = ""; });
            $("#newComment").addEventListener("keydown", function(e) {
                if (e.ctrlKey && e.which === 13) {
                    addComment();
                }
            });

            $("#newCommentButton").addEventListener("click", addComment);
            addNavListener();
            getComments();
        }

        let selectedSuggestion;

        function addNavListener()
        {
            document.body.addEventListener("keydown", function(e)
            {
                if (e.target.id && e.target.id.toLowerCase() == "newcomment")
                {
                    return;
                }

                if (!e.ctrlKey || (e.which !== 37 && e.which !== 39))
                {
                    return;
                }

                logVerbose("Searching for next id");
                let parameters = { "type" : "req_nav", "id" : <?= $req_id ?>, "dir" : e.which === 37 ? "0" : "1" };
                let successFunc = function(response)
                {
                    if (response.new_id == -1)
                    {
                        logInfo("No more requests in that direction!");
                        return;
                    }

                    window.location = "request.php?id=" + response.new_id;
                };

                sendHtmlJsonRequest("process_request.php", parameters, successFunc);

            });
        }

        function searchForMedia()
        {
            let requestType = <?= $details->request_type ?>;
            switch (requestType)
            {
                case 1:
                case 2:
                    searchForMediaCore();
                    break;
                default:
                    console.log("Other: " + requestType);
                    break;
            }
        }

        function searchImdb()
        {
            let id = $("#external_id").value;
            if (id.length != 9 || id.substring(0, 2) != "tt" || parseInt(id.substring(2)) == NaN)
            {
                if (id.length !== 0)
                {
                    $("#imdbResult").innerHTML = "Incomplete IMDb Id";
                }
                else
                {
                    $("#imdbResult").innerHTML = "";
                }

                return;
            }

            $("#imdbResult").innerHTML = "Searching...";

            let parameters = { "type" : <?= $details->request_type ?>, "query" : id, "imdb" : true };
            let successFunc = function(response)
            {
                logInfo(response, true);
                let type = <?= $details->request_type ?>;
                switch (type)
                {
                    case 1:
                        buildItems(response.movie_results, "imdbResult");
                        break;
                    case 2:
                        buildItems(response.tv_results, "imdbResult");
                        break;
                    default:
                        $("#imdbResult").innerHTML = "Sorry, something went wrong";
                        break;
                }
            };
            let failureFunc = function(response)
            {
                $("#imdbResult").innerHTML = "Failed to retrieve media";
            };

            sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
        }

        function searchForMediaCore()
        {
            let parameters = { "type" : <?= $details->request_type ?>, "query" : "<?= $details->request_name ?>" };
            let successFunc = function(response)
            {
                logInfo(response, true);
                if (response.results.length === 0)
                {
                    document.getElementById("matchContainer").innerHTML = "No matches found. Please enter the IMDb id below";
                    return;
                }
                buildItems(response.results, "matchContainer");
            };

            let failureFunc = function(/*response*/)
            {
                document.getElementById("matchContainer").innerHTML = "Error searching for matches";
            };

            sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
        }

        function buildItems(matches, holder)
        {
            let container = $("#" + holder);
            container.innerHTML = "";
            let max = Math.min(matches.length, 10);
            for (let i = 0; i < max; ++i)
            {
                let match = matches[i];
                let item = document.createElement("div");
                item.className = "searchResult";
                item.setAttribute("tmdbid", match.id);
                let img;
                if (match.poster_path)
                {
                    img = document.createElement("img");
                    img.src = "https://image.tmdb.org/t/p/w92" + match.poster_path;
                    img.style.height = "70px";
                }
                let div = document.createElement("div");
                let release = match.release_date;
                if (release === null || release === undefined)
                {
                    release = match.first_air_date;
                }
                let href = document.createElement("a");
                href.href = "#";
                href.addEventListener("click", goToImdb);
                href.innerHTML = (match.title ? match.title : match.name) + (release.length > 4 ? (" (" + release.substring(0, 4) + ")") : "");
                div.appendChild(href);

                if (img) item.appendChild(img);
                item.appendChild(div);

                item.addEventListener("click", clickSuggestion);

                container.appendChild(item);
            }

            let button = document.createElement("input");
            button.id = "matchContinue_" + holder;
            button.classList.add("matchContinue");
            button.style.visibility = "hidden";
            button.style.height = "0";
            button.type = "button";
            button.value = "Continue";
            button.addEventListener("click", chooseSelected);
            container.appendChild(button);
        }

        function goToImdb()
        {
            let parameters = { "type" : <?= $details->request_type ?>, "query" : this.parentNode.parentNode.getAttribute("tmdbid"), "by_id" : "true" };
            let successFunc = function(respons, request)
            {
                logInfo(response, true);
                if (response.imdb_id)
                {
                    window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank");
                }
                else
                {
                    window.open("https://www.themoviedb.org/" + <?php echo ($details->request_type == 1 ? "\"movie\"" : "\"tv\"") ?> + "/" + request.tmdbid)
                }
            };
            sendHtmlJsonRequest("media_search.php", parameters, successFunc, null, {"tmdbid" : this.parentNode.parentNode.getAttribute("tmdbid")});
        } 

        function clickSuggestion(e)
        {
            if (e.target.tagName.toLowerCase() == "a")
            {
                return;
            }

            let enableButton = "matchContinue_" + this.parentNode.id;
            let disableButton = "matchContinue_" + (enableButton.charAt(14) == 'm' ? "imdbResult" : "matchContainer");
            if (selectedSuggestion && selectedSuggestion != this)
            {
                selectedSuggestion.className = "searchResult";
            }
            else if (selectedSuggestion == this)
            {
                this.className = "searchResult";
                setVisibility(enableButton, false);
                setVisibility(disableButton, true);
                selectedSuggestion = undefined;
                return;
            }

            selectedSuggestion = this;
            this.className += " selectedSuggestion";
            setVisibility(enableButton, true);
            setVisibility(disableButton, false);
        }

        function setVisibility(id, visible)
        {
            let element = document.getElementById(id);
            if (!element)
            {
                return;
            }

            element.style.visibility = visible ? "visible" : "hidden";
            element.style.height = visible ? "auto" : "0";
        }

        function chooseSelected()
        {
            if (!selectedSuggestion)
            {
                let button = $("#matchContinue");
                let color = new Color(button.getComputedStyle.backgroundColor, 500);
                Animation.queue({"backgroundColor" : new Color(100, 66, 69)}, button);
                Animation.queueDelayedAnimation({"backgroundColor" : color}, button, 500, 500, true);
                return;
            }

            if (!selectedSuggestion.getAttribute("tmdbid"))
            {
                logError("No tmdb id found");
                return;
            }

            let params = { "type" : "set_external_id", "req_id" : <?= $req_id ?>, "id" : selectedSuggestion.getAttribute("tmdbid") };

            let successFunc = function(response)
            {
                logInfo(response, true);
                matches = $(".matchContinue");

                for (let i = 0; i < matches.length; ++i)
                {
                    matches[i].value = "Success! Redirecting...";
                }
                setTimeout(function() { window.location.reload(); }, 1000);
            };

            sendHtmlJsonRequest("process_request.php", params, successFunc);
        }

        function getMediaInfo()
        {
            let parameters = { "type" : <?= $details->request_type ?>, "query" : "<?= $details->external_id ?>", "by_id" : "true" };
            let successFunc = function(response)
            {
                logInfo(response, true);
                buildPage(response);
            };
            let failureFunc = function(response)
            {
                $("#infoContainer").innerHTML = "Unable to query request information";
            };
            sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
        }

        function getNonMediaInfo()
        {
            let outerContainer = document.createElement("div");
            outerContainer.id = "innerInfoContainer";
            let container = document.createElement("div");
            container.id = "mediaDetails";
            let div = document.createElement("div");
            div.id = "mediaTitle";
            div.innerHTML = "Request: <?= $details->request_name ?>";
            container.appendChild(div);
            outerContainer.appendChild(container);
            $("#infoContainer").innerHTML = "";
            $("#infoContainer").appendChild(outerContainer);
        }

        function buildPage(data)
        {
            let container = $("#infoContainer");
            container.innerHTML = "";

            let backdrop = document.createElement("img");
            backdrop.src = "https://image.tmdb.org/t/p/original" + data.backdrop_path;
            backdrop.id = "mediaBackdrop";

            let innerContainer = document.createElement("div");
            innerContainer.id = "innerInfoContainer";

            let poster = document.createElement("img");
            poster.src = "https://image.tmdb.org/t/p/w342" + data.poster_path;
            poster.id = "mediaPoster";

            let details = document.createElement("div");
            details.id = "mediaDetails";

            let title = document.createElement("div");
            let status = <?= $details->status ?>;
            let statusSpan = document.createElement("span");
            statusSpan.className = "status" + status;
            statusSpan.innerHTML = status == 0 ? "Pending" : status == 1 ? "Approved" : "Denied";
<?php if($_SESSION['level'] >= 100) { ?>
            setupSpanDoubleClick(statusSpan);
<?php } ?>
            title.innerHTML = (data.title || data.name) + " - ";
            title.appendChild(statusSpan);
            title.id = "mediaTitle";

            let year = document.createElement("div");
            let release = data.release_date || data.first_air_date;
            year.innerHTML = release.length > 4 ? release.substring(0, 4) : "Unknown Release Date";
            year.id = "mediaYear";

            let imdb;
            if (data.imdb_id)
            {
                imdb = document.createElement("div");
                imdb.innerHTML = "<a href='https://imdb.com/title/" + data.imdb_id + "' target='_blank'>IMDb</a>";
                imdb.id = "mediaLink";
            }
            else if (data.id)
            {
                imdb = document.createElement("div");
                imdb.innerHTML = "<a href='https://www.themoviedb.org/" + <?php echo ($details->request_type == 1 ? "\"movie\"" : "\"tv\"")?> + "/" + data.id + "' target='_blank'>TMDb</a>";
                imdb.id = "mediaLink";
            }

            let desc = document.createElement("div");
            desc.innerHTML = data.overview;
            desc.id = "mediaOverview";

            details.appendChild(title);
            details.appendChild(year);
            if (imdb) details.appendChild(imdb);
            details.appendChild(document.createElement("hr"));
            details.appendChild(desc);

            innerContainer.appendChild(poster);
            innerContainer.appendChild(details);

            container.appendChild(backdrop);
            container.appendChild(innerContainer);
        }

<?php if($_SESSION['level'] >= 100) { ?>
        function setupSpanDoubleClick(statusSpan)
        {
            statusSpan.className += " statusSpan";
            statusSpan.addEventListener("dblclick", function(e) {
                let data = prompt("Data ((A)pproved (1), (D)enied (0), or (P)ending):");
                let valid = false;
                let status = -1;
                let first = data.toLowerCase()[0];
                if (data == "1" || first == "a")
                {
                    status = 1;
                }
                else if (data == "0" || first == "d")
                {
                    status = 2;
                }
                else if (first == "p")
                {
                    status = 0;
                }
                else
                {
                    alert("Invalid status: Must be '(A)pproved' (1), '(D)enied' (0), or '(P)ending'");
                }

                if (status != -1)
                {
                    let params = {
                        "type" : "req_update",
                        "data" : [{ "id" : "<?= $req_id ?>", "kind" : "status", "content" : status}]
                    }

                    let successFunc = function() {
                        let span = $(".statusSpan")[0];
                        if (span)
                        {
                            span.className = "statusSpan status" + status;
                            span.innerHTML = status == 0 ? "Pending" : status == 1 ? "Approved" : "Denied";
                        }
                    };

                    let failureFunc = function() {
                        alert("Failed to update. See console for details");
                    };

                    sendHtmlJsonRequest("update_request.php", JSON.stringify(params), successFunc, failureFunc, null, true /*dataIsString*/);
                }
            });
        }
<?php } ?>

        function getComments()
        {
            params = { "type" : "get_comments", "req_id" : <?= $req_id ?> };
            let successFunc = function(response)
            {
                logInfo(response, true);
                buildComments(response);
            };
            let failureFunc = function(response)
            {
                $("#comments").innerHTML = response.Error;
            };
            sendHtmlJsonRequest("process_request.php", params, successFunc);
        }

        function addComment()
        {
            let comment = $("#newComment");
            let text = comment.value;
            if (text.length === 0)
            {
                logInfo("Not adding comment - no content!");
                return;
            }

            comment.value = "";

            logInfo("Adding comment: " + text);

            let params = { "type" : "add_comment", "req_id" : <?= $req_id ?>, "content" : text };
            let successFunc = function(response)
            {
                getComments();
            };
            let failureFunc = function(response, request)
            {
                let element = $("#newComment");
                element.value = request.textSav;
                Animation.fireNow({"backgroundColor" : new Color(100, 66, 69)}, element, 500);
                Animation.queueDelayed({"backgroundColor" : new Color(63, 66, 69)}, element, 1000, 500);
            }

            sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc, { "textSav" : text});
        }

        function buildComments(comments)
        {
            let container = $("#comments");
            container.innerHTML = "";

            for (let i = 0; i < comments.length; ++i)
            {
                let comment = comments[i];
                let holder = document.createElement("div");
                holder.classList.add("commentHolder");

                let info = document.createElement("div");
                info.classList.add("commentInfo");

                let name = document.createElement("span");
                name.innerHTML = comment[0];

                let date = document.createElement("span");
                date.innerHTML = new Date(comment[2]).toLocaleDateString("en-US", options={
                    year: "2-digit",
                    month: "numeric",
                    day : "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric" });

                let content = document.createElement("div");
                let fixedupContent = comment[1].replace(/[&<>"\/]/g, function(s) {
                    const entityMap = {
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': '&quot;',
                        // "'": '&#39;',
                        "/": '&#x2F;'
                    };

                    return entityMap[s];
                });

                let markdownUrlRegex = /(?:__|[*#])|\[(.*?)\]\((.*?)\)/gm;
                fixedupContent = "<span>" + fixedupContent.replace(markdownUrlRegex, '<a href="$2" target="_blank">$1</a>') + "</span>";

                content.innerHTML = fixedupContent;
                content.classList.add("commentContent");

                info.appendChild(name);
                info.appendChild(date);

                holder.appendChild(info);
                holder.appendChild(content);

                container.appendChild(holder);
            }
        }


        function $(selector)
        {
            if (selector.indexOf("#") === 0 && selector.indexOf(" ") === -1)
            {
                return document.querySelector(selector);
            }

            return document.querySelectorAll(selector);
        }

        /// <summary>
        /// Generic method to sent an async request that expects JSON in return
        /// </summary>
        function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams, dataIsString)
        {
            let http = new XMLHttpRequest();
            http.open("POST", url, true /*async*/);
            http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
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

            http.onreadystatechange = function()
            {
                if (this.readyState != 4 || this.status != 200)
                {
                    return;
                }

                try
                {
                    let response = JSON.parse(this.responseText);
                    logJson(response, LOG.Verbose);
                    if (response.Error)
                    {
                        logError(response.Error);
                        if (failFunc)
                        {
                            failFunc(response, this);
                        }

                        return;
                    }

                    successFunc(response, this);

                }
                catch (ex)
                {
                    logError(ex, true);
                    logError(this.responseText);
                }
            };

            http.send(dataIsString ? parameters : buildQuery(parameters));
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

            logVerbose("Built query: " + queryString);
            return queryString;
        }
    })();
</script>
</html>