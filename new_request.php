<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin(true, "new_request.php");
requireSSL();
?>


<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <script src="resource/consolelog.js"></script>
    <script src="resource/min/animate.min.js"></script>
    <script src="resource/queryStatus.js"></script>
    <title>New Plex Request</title>
    <style>
        form select {
            width: 50%;
        }

        .matchContinue {
            margin-top: 5px;
            width: 100%;
            clear: both;
            padding: 10px 0;
        }

        .visible {
            opacity: 1.0;
            -webkit-transition: height 0.25s, opacity 0.5s;
            transition: height 0.25s, opacity 0.5s;
        }

        .hidden {
            opacity: 0;
            height: 0;
        }

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

        .badLink {
            color: red !important;
        }
    </style>
</head>
<body>
<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="suggest" class="formContainer">
            <div class="formTitle">New Request</div>
            <form id="suggestForm" action="javascript:void(0);">
                <hr />
                <div class="formInput"><label for="type">Suggestion Type: </label><select name="type" id="type">
                    <option value="none"></option>
                    <option value="movie">Movie</option>
                    <option value="tv">TV Show</option>
                    <option value="audiobook">Audiobook</option>
                    <option value="music">Music</option>
                </select></div>
                <div class="formInput" id="nameHolder"><label for="name">Suggestion:</label><input type="text" name="name" id="name" maxlength=128></div>
                <div id="matchHolder">
                    <div id="matchContainer"></div>
                    <div id="imdbContainer" class="hidden">
                        <div class='formInput' id="external_holder"><hr /><label for='external_id'>--OR-- IMDb ID:</label><input type=text style="float: left; margin-left: 10px" id='external_id' placeholder='tt1234567'></div>
                        <div id="imdbResult"></div>
                    </div>
                </div>
                <div id="suggestions">
                    <div id="outsideSuggestions">
                        <h4>Matches</h4>
                    </div>
                    <div id="existingSuggestions">
                        <h4>Existing Items</h4>
                    </div>
                </div>
                <div class="formInput" id="submitHolder"><input type="button" value="Submit" id="go"></input></div>
            </form>
            <hr />
            <a href="user_settings.php">Change notification settings</a>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
    <div id="tooltip"></div>
</div>
</body>
<script>
(function() {
    let searchTimer;
    let selectedSuggest;
    let selectedSuggestion;
    window.addEventListener("load", function()
    {
        selectChanged();
        $("#type").addEventListener("change", selectChanged);
        $("#name").addEventListener("input", suggestionChanged);
        $("#external_id").addEventListener("input", searchImdb);
    });

    /// <summary>
    /// Update UI when request options change
    /// </summar>
    function selectChanged()
    {
        let value = $("#type").value;
        if (value == "none")
        {
            setVisibility("nameHolder", false);
            $("#matchHolder").style.display = "none";
            setVisibility("suggestions", false);
            setVisibility("submitHolder", false);
            return;
        }

        setVisibility("nameHolder", true);
        suggestionChanged();
    }

    /// <summary>
    /// Set/reset timers when the user updates the suggestion
    /// </summar>
    function suggestionChanged()
    {
        let suggestion = $("#name").value;
        clearTimeout(searchTimer);
        if (suggestion.length === 0)
        {
            setVisibility("suggestions", false);
            $("#matchHolder").style.display = "none";
            return;
        }

        $("#matchHolder").style.display = "block";
        searchTimer = setTimeout(searchItem, 250);
    }

    /// <summary>
    /// Search for the user's current request
    /// </summar>
    function searchItem()
    {
        let value = $("#type").value;
        if (value != "movie" && value != "tv")
        {
            // Only movies and tv shows supported for now
            setVisibility("imdbContainer", false);
            $("#matchContainer").innerHTML = "Sorry, audiobook/music requests are currently unavailable"
            return;
        }

        let params = { "type" : value == "movie" ? 1 : 2, "query" : $("#name").value };
        let successFunc = function(response)
        {
            logInfo(response, true);
            setVisibility("imdbContainer", true);
            if (response.results.length === 0)
            {
                document.getElementById("matchContainer").innerHTML = "No matches found. Please enter the IMDb id below";
                return;
            }

            buildItems(response.results, "matchContainer");
        }

        let failureFunc = function(/*response*/)
        {
            document.getElementById("matchContainer").innerHTML = "Error searching for matches";
        };

        sendHtmlJsonRequest("media_search.php", params, successFunc, failureFunc);
    }

    /// <summary>
    /// Search for an item based on a specific IMDb id
    /// </summar>
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

        let parameters = { "type" : $("#type").value == "movie" ? 1 : 2, "query" : id, "imdb" : true };
        let successFunc = function(response)
        {
            logInfo(response, true);
            let type = $("#type").value;
            switch (type)
            {
                case "movie":
                    if (response.movie_results.length === 0)
                    {
                        $("#imdbResult").innerHTML = "Movie not found";
                        return;
                    }
                    buildItems(response.movie_results, "imdbResult");
                    break;
                case "tv":
                    if (response.tv_results.length === 0)
                    {
                        $("#imdbResult").innerHTML = "TV Show not found";
                        return;
                    }
                    build_items(response.tv_results, "imdbResult");
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

    /// <summary>
    /// Build the list of search results
    /// </summar>
    function buildItems(matches, holder)
    {
        let container = $("#" + holder);
        container.innerHTML = "";
        container.appendChild(document.createElement("hr"));
        let max = Math.min(matches.length, 10);
        for (let i = 0; i < max; ++i)
        {
            let match = matches[i];
            let item = document.createElement("div");
            item.className = "searchResult";
            item.setAttribute("tmdbid", match.id);
            item.setAttribute("title", match.title ? match.title : match.name);
            item.setAttribute("poster", match.poster_path);

            let img = document.createElement("img");
            img.style.height = "70px";
            if (match.poster_path)
            {
                img.src = "https://image.tmdb.org/t/p/w92" + match.poster_path;
            }
            else
            {
                img.src = $("#type").value == "movie" ? "poster/moviedefault.png" : "poster/tvdefault.png";
            }

            let div = document.createElement("div");
            let release = match.release_date;
            if (!release)
            {
                release = match.first_air_date;
            }
            let span = document.createElement("span");
            span.innerHTML = (match.title ? match.title : match.name) + " ";
            let href = document.createElement("a");
            href.href = "#";
            href.addEventListener("click", goToImdb);
            href.innerHTML = `(${release ? release.substring(0, 4) : "IMDb"})`;
            div.appendChild(span);
            div.appendChild(href);

            if (img) item.appendChild(img);
            item.appendChild(div);

            item.addEventListener("click", clickSuggestion);

            container.appendChild(item);
        }

        let button = document.createElement("input");
        button.id = "matchContinue_" + holder;
        button.classList.add("matchContinue");
        button.classList.add("hidden");
        button.type = "button";
        button.value = "Submit Request";
        button.addEventListener("click", submitSelected);
        container.appendChild(button);
    }

    /// <summary>
    /// Go to IMDb (or TMDb) when the user clicks on a suggestion
    /// </summar>
    function goToImdb()
    {
        let value = $("#type").value;
        let parameters = { "type" : value == "movie" ? 1 : 2, "query" : this.parentNode.parentNode.getAttribute("tmdbid"), "by_id" : "true" };
        let successFunc = function(response, request)
        {
            logInfo(response, true);
            if (response.imdb_id)
            {
                window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank");
            }
            else
            {
                window.open("https://www.themoviedb.org/" + ($("#type").value == "movie" ? "movie" : "tv") + "/" + request.linkElement.parentNode.parentNode.getAttribute("tmdbid"));
                // request.linkElement.classList.add("badLink");
                // request.linkElement.innerHTML += " (no IMDb link)";
            }
        };
        sendHtmlJsonRequest("media_search.php", parameters, successFunc, null, { "linkElement" : this });
    }

    /// <summary>
    /// Handler for clicking on a specific search result
    /// </summar>
    function clickSuggestion(e)
    {
        if (e.target.tagName.toLowerCase() == "a")
        {
            return;
        }

        let enableButton = "matchContinue_" + this.parentNode.id;
        let disableButton = "matchContinue_" + (enableButton.charAt(14) == 'm' ? "imdbResult" : "matchContainer");
        logTmi("EnableButton: " + enableButton);
        logTmi("DisableButton: " + disableButton);
        if (selectedSuggestion && selectedSuggestion != this)
        {
            selectedSuggestion.className = "searchResult";
        }
        else if (selectedSuggestion == this)
        {
            this.className = "searchResult";
            setVisibility(enableButton, false);
            setVisibility(disableButton, false);
            selectedSuggestion = undefined;
            return;
        }

        selectedSuggestion = this;
        this.className += " selectedSuggestion";
        setVisibility(enableButton, true);
        setVisibility(disableButton, false);
        Animation.fireNow({ "backgroundColor" : new Color(63, 80, 69) }, $("#" + enableButton), 500);
        Animation.queue({ "backgroundColor" : new Color(63, 66, 69) }, $("#" + enableButton), 500, 500, true);
    }

    /// <summary>
    /// Submit the selected suggestion
    /// </summar>
    function submitSelected()
    {
        if (!selectedSuggestion)
        {
            let button = $("#matchContinue");
            let color = new Color(button.getComputedStyle.backgroundColor, 500);
            Animation.fireNow({"backgroundColor" : new Color(100, 66, 69)}, button);
            Animation.queue({"backgroundColor" : color}, button, 500, 500, true);
            return;
        }

        const tmdbid = selectedSuggestion.getAttribute("tmdbid");
        const title = selectedSuggestion.getAttribute("title");
        const poster = selectedSuggestion.getAttribute("poster");
        if (!tmdbid || !title)
        {
            logError("Required fields not set");
            return;
        }

        let parameters =
        {
            "type" : "request_new",
            "name" : title,
            "mediatype" : $("#type").value,
            "external_id" : tmdbid,
            "poster" : poster
        }

        let successFunc = function(response)
        {
            window.location.href = "https://danrahn.com/plexweb/request.php?id=" + response.req_id;
        }
        let failureFunc = function(response)
        {
            let buttons = $(".matchContinue");
            for (let i = 0; i < buttons.length; ++i)
            {
                buttons[i].value = "Something went wrong, please try again later";
                Animation.fireNow({"backgroundColor" : new Color(100, 66, 69)}, buttons[i], 500);
                Animation.queueDelayed({"backgroundColor" : new Color(63, 66, 69)}, buttons[i], 1000, 500, true);
                setTimeout(function(btn) { btn.value = "Submit Request"; }, 2500, buttons[i]);
            }
        }
        sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
    }

    function setVisibility(id, visible)
    {
        let element = document.getElementById(id);
        if (!element)
        {
            return;
        }

        element.classList.remove(visible ? "hidden" : "visible");
        element.classList.add(visible ? "visible" : "hidden");
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
    function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams)
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

        http.send(buildQuery(parameters));
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