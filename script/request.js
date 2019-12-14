(function() {
window.addEventListener("load", function()
{
    if (!!$("#matchContainer"))
    {
        searchForMedia();
        $("#external_id").addEventListener("input", searchImdb);
    }
    else
    {
        if (document.body.getAttribute("isMediaRequest") == "1")
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
            let parameters = { "type" : "req_nav", "id" : parseInt(document.body.getAttribute("reqId")), "dir" : e.which === 37 ? "0" : "1" };
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
        let requestType = parseInt(document.body.getAttribute("requestType"));
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

        let parameters = { "type" : parseInt(document.body.getAttribute("requestType")), "query" : id, "imdb" : true };
        let successFunc = function(response)
        {
            logInfo(response);
            let type = parseInt(document.body.getAttribute("requestType"));
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
        let failureFunc = function()
        {
            $("#imdbResult").innerHTML = "Failed to retrieve media";
        };

        sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
    }

    function searchForMediaCore()
    {
        let parameters = { "type" : parseInt(document.body.getAttribute("requestType")), "query" : document.body.getAttribute("requestName") };
        let successFunc = function(response)
        {
            logInfo(response);
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
            let item = buildNode("div",
                {"className" : "searchResult", "tmdbid" : match.id},
                0,
                {"click" : clickSuggestion});
            let img;
            if (match.poster_path)
            {
                img = buildNode("img", {
                    "src" :
                    `https://image.tmdb.org/t/p/w92${match.poster_path}`,
                    "style" : "height: 70px"
                });
            }

            let div = buildNode("div");
            let release = match.release_date;
            if (release === null || release === undefined)
            {
                release = match.first_air_date;
            }

            let href = buildNode("a",
                {"href" : "#"},
                (match.title ? match.title : match.name) + (release.length > 4 ? (" (" + release.substring(0, 4) + ")") : ""),
                { "click" : goToImdb});

            div.appendChild(href);
            if (img) item.appendChild(img);
            item.appendChild(div);

            container.appendChild(item);
        }

        let button = buildNode("input", {
            "id" : `matchContinue_${holder}`,
            "class" : "matchContinue",
            "style" : "visibility: hidden; height: 0",
            "type" : "button",
            "value" : "Continue"
        },
        0,
        {"click" : chooseSelected});
        container.appendChild(button);
    }

    function goToImdb()
    {
        let parameters = { "type" : parseInt(document.body.getAttribute("requestType")), "query" : this.parentNode.parentNode.getAttribute("tmdbid"), "by_id" : "true" };
        let successFunc = function(respons, request)
        {
            logInfo(response);
            if (response.imdb_id)
            {
                window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank");
            }
            else
            {
                window.open("https://www.themoviedb.org/" + document.body.getAttribute("requestTypeStr") + "/" + request.tmdbid)
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

        let params = { "type" : "set_external_id", "req_id" : parseInt(document.body.getAttribute("reqId")), "id" : selectedSuggestion.getAttribute("tmdbid") };

        let successFunc = function(response)
        {
            logInfo(response);
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
        let parameters = { "type" : parseInt(document.body.getAttribute("requestType")), "query" : document.body.getAttribute("externalId"), "by_id" : "true" };
        let successFunc = function(response)
        {
            logInfo(response);
            buildPage(response);
        };
        let failureFunc = function()
        {
            $("#infoContainer").innerHTML = "Unable to query request information";
        };
        sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
    }

    function getNonMediaInfo()
    {
        let outerContainer = buildNode("div", {"id" : "innerInfoContainer"});
        let container = buildNode("div", {"id" : "mediaDetails"});
        container.appendChild(buildNode("div", {"id" : "mediaTitle"}, `Request: ${document.body.getAttribute("requestName")}`));
        outerContainer.appendChild(container);
        $("#infoContainer").innerHTML = "";
        $("#infoContainer").appendChild(outerContainer);
    }

    function buildPage(data)
    {
        let container = $("#infoContainer");
        container.innerHTML = "";

        let backdrop = buildNode("img", {
            "src" : `https://image.tmdb.org/t/p/original${data.backdrop_path}`,
            "id" : "mediaBackdrop"
        });

        let innerContainer = buildNode("div", {"id" : "innerInfoContainer"});

        let poster = buildNode("img", {"src" : `poster${data.poster_path}&large=1`, "id" : "mediaPoster"});
        let details = buildNode("div", {"id" : "mediaDetails"});

        let title = buildNode("div", {"id" : "mediaTitle"});
        let status = parseInt(document.body.getAttribute("requestStatus"));

        let statusSpan = buildNode("span",
            {"class" : `status${status}`},
            [
                "Pending",
                "Complete",
                "Denied",
                "In Progress",
                "Waiting"
            ][status]);

        if (parseInt(document.body.getAttribute("isAdmin")) == 1)
        {
            setupSpanDoubleClick(statusSpan);
        }

        title.innerHTML = (data.title || data.name) + " - ";
        title.appendChild(statusSpan);

        let release = data.release_date || data.first_air_date;
        let year = buildNode("div", {"id" : "mediaYear"}, release.length > 4 ? release.substring(0, 4)  : "Unknown Release Date");

        let imdb;
        if (data.imdb_id)
        {
            imdb = buildNode("div", {"id" : "mediaLink"});
            imdb.appendChild(buildNode("a", {
                "href" : `https://imdb.com/title/${data.imdb_id}`,
                "target" : "_blank"
            }, "IMDb"));
        }
        else if (data.id)
        {
            imdb = buildNode("div", {"id" : "mediaLink"});
            imdb.appendChild(buildNode("a", {
                "href" : `https://www.themoviedb.org/${document.body.getAttribute("requestTypeStr")}/${data.id}`,
                "target" : "_blank"
            }, "TMDb"));
        }

        let desc = buildNode("div", {"id" : "mediaOverview"}, data.overview);

        details.appendChild(title);
        details.appendChild(year);
        if (imdb) details.appendChild(imdb);
        details.appendChild(buildNode("hr"));
        details.appendChild(desc);

        innerContainer.appendChild(poster);
        innerContainer.appendChild(details);

        container.appendChild(backdrop);
        container.appendChild(innerContainer);
    }

    function setupSpanDoubleClick(statusSpan)
    {
        statusSpan.className += " statusSpan";
        statusSpan.addEventListener("dblclick", function() {
            let data = prompt("Data ((A)pproved (1), (D)enied (0), (P)ending, (I)n Progress, or (W)aiting):");
            let status = -1;
            let first = data.toLowerCase()[0];
            switch (first)
            {
                case 'a':
                case '1':
                    status = 1;
                    break;
                case 'd':
                case '0':
                    status = 2;
                    break;
                case 'p':
                    status = 0;
                    break;
                case 'i':
                    status = 3;
                    break;
                case 'w':
                    status = 4;
                    break;
                default:
                    alert("Invalid status: Must be '(A)pproved' (1), '(D)enied' (0), '(P)ending', '(I)n Progress', or '(W)aiting'");
                    break;
            }

            if (status != -1)
            {
                let params = {
                    "type" : "req_update",
                    "data" : [{ "id" : parseInt(document.body.getAttribute("reqId")), "kind" : "status", "content" : status}]
                }

                let successFunc = function() {
                    let span = $(".statusSpan")[0];
                    if (span)
                    {
                        span.className = "statusSpan status" + status;
                        span.innerHTML = ["Pending", "Approved", "Denied", "In Progress", "Waiting"][status];
                    }
                };

                let failureFunc = function() {
                    alert("Failed to update. See console for details");
                };

                sendHtmlJsonRequest("update_request.php", JSON.stringify(params), successFunc, failureFunc, null, true /*dataIsString*/);
            }
        });
    }

    function getComments()
    {
        params = { "type" : "get_comments", "req_id" : parseInt(document.body.getAttribute("reqId")) };
        let successFunc = function(response)
        {
            logInfo(response);
            buildComments(response);
        };
        let failureFunc = function()
        {
            $("#comments").innerHTML = response.Error;
        };
        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
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

        let params = { "type" : "add_comment", "req_id" : parseInt(document.body.getAttribute("reqId")), "content" : text };
        let successFunc = function()
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
            let holder = buildNode("div", {"class" : "commentHolder"});
            let info = buildNode("div", {"class" : "commentInfo"});
            let name = buildNode("span", {}, comment[0])

            let date = buildNode("span", {},
                new Date(comment[2]).toLocaleDateString("en-US",
                    options={
                        year: "2-digit",
                        month: "numeric",
                        day : "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric" 
                    })
                );

            let fixedupContent = comment[1].replace(/[&<>"\/]/g, function(s) {
                const entityMap = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': '&quot;',
                    "'": '&#39;',
                    "/": '&#x2F;'
                };

                return entityMap[s];
            });

            let markdownUrlRegex = /\[(.*?)\]\((.*?)\)/gm;
            fixedupContent = "<span>" + fixedupContent.replace(markdownUrlRegex, '<a href="$2" target="_blank">$1</a>') + "</span>";

            let content = buildNode("div", {"class" : "commentContent"}, fixedupContent);

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
    /// Helper method to create DOM elements.
    /// </summary>
    function buildNode(type, attrs, content, events)
    {
        let ele = document.createElement(type);
        if (attrs)
        {
            for (let [key, value] of Object.entries(attrs))
            {
                ele.setAttribute(key, value);
            }
        }

        if (events)
        {
            for (let [event, func] of Object.entries(events))
            {
                ele.addEventListener(event, func);
            }
        }

        if (content)
        {
            ele.innerHTML = content;
        }

        return ele;
    }

    /// <summary>
    /// Generic method to sent an async request that expects JSON in return
    /// </summary>
    function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams, dataIsString)
    {
        let http = new XMLHttpRequest();
        http.open("POST", url, true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        let queryString = dataIsString ? parameters : buildQuery(parameters);
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
                logVerbose(response, `${url}${queryString}`);
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
                logError(ex);
                logError(this.responseText);
            }
        };

        http.send(queryString);
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
})
})();