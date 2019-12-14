(function() {
    let searchTimer;
    let internalSearchTimer;
    let selectedSuggestion;
    window.addEventListener("load", function()
    {
        selectChanged();
        $("#type").addEventListener("change", selectChanged);
        $("#name").addEventListener("input", suggestionChanged);
        $("#external_id").addEventListener("input", searchSpecificExternal);
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
            $("#existingMatchHolder").style.display = "none";
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
        clearTimeout(internalSearchTimer);
        if (suggestion.length === 0)
        {
            setVisibility("suggestions", false);
            $("#matchHolder").style.display = "none";
            $("#existingMatchHolder").style.display = "none";
            return;
        }

        $("#matchHolder").style.display = "block";
        searchTimer = setTimeout(searchItem, 250);
        internalSearchTimer = setTimeout(searchInternal, 250);
    }

    function setExternalType(type)
    {
        if (type == "audiobook")
        {
            $("#externallabel").innerHTML = "--OR-- Audible ID:";
            $("#external_id").placeholder = "B017V4IM1G";
        }
        else
        {
            $("#externallabel").innerHTML = "--OR-- IMDb ID:";
            $("#external_id").placeholder = "tt1234567";
        }
    }

    /// <summary>
    /// Search for the user's current request
    /// </summar>
    function searchItem()
    {
        let value = $("#type").value;
        if (value != "movie" && value != "tv" && value != "audiobook")
        {
            // Only movies and tv shows supported for now
            setVisibility("externalContainer", false);
            $("#matchContainer").innerHTML = "Sorry, music requests are currently unavailable"
            return;
        }

        let type = value == "movie" ? 1 : (value == "tv" ? 2 : 3);

        setExternalType(value);

        let params = { "type" : type, "query" : $("#name").value };
        let successFunc = function(response)
        {
            logInfo(response, "Search Results");
            setVisibility("externalContainer", true);
            if (response.results.length === 0)
            {
                document.getElementById("matchContainer").innerHTML = `No matches found. Please enter the ${value == "audiobook" ? "Audible" : "IMDb"} ID below`;
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
    /// Search the plex server for the given query so users may know if the item already exists
    /// </summary>
    function searchInternal()
    {
        // For now only search for movies, since TV shows can have requests for different seasons
        let type = $("#type").value;
        if (type == "tv")
        {
            clearElement("existingMatchContainer");
            return;
        }

        let name = $("#name").value;
        let parameters =
        {
            "type" : "search",
            "kind" : type,
            "query" : name
        };

        let successFunc = function(response)
        {
            logInfo(response, "Internal Search");
            clearElement("existingMatchContainer");
            if (response.length > 0)
            {
                $("#existingMatchHolder").style.display = "block";
                buildItems(response.top, "existingMatchContainer");
            }
        };

        let failureFunc = function(response)
        {
            logError(response, "Failed to parse internal search");
        };

        logTmi(`Initiating internal search for ${name}`);
        sendHtmlJsonRequest("process_request.php", parameters, successFunc, failureFunc);
    }

    function validateId(id, isAudiobook)
    {
        if (isAudiobook)
        {
            if (id.length != 10)
            {
                $("#externalResult").innerHTML = id.length == 0 ? "" : "Incomplete Audible Id";
                return false;
            }

            return true;
        }

        if (id.length != 9 ||
            id.substring(0, 2) != "tt" ||
            parseInt(id.substring(2)) == NaN)
        {
            $("#externalResult").innerHTML = id.length == 0 ? "" : "Incomplete IMDb Id";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Search for an item based on a specific IMDb/Audible id
    /// </summar>
    function searchSpecificExternal()
    {
        let id = $("#external_id").value;
        const isAudiobook = $("#type").value == "audiobook";
        if (!validateId(id, isAudiobook))
        {
            return;
        }

        $("#externalResult").innerHTML = "Searching...";

        let value = $("#type").value;
        let type = value == "movie" ? 1 : (value == "tv" ? 2 : 3);
        let parameters = { "type" : type, "query" : id, "imdb" : type != 3, "audible" : type == 3 };
        let successFunc = function(response)
        {
            logInfo(response);
            let type = $("#type").value;
            switch (type)
            {
                case "movie":
                    if (response.movie_results.length === 0)
                    {
                        $("#externalResult").innerHTML = "Movie not found";
                        return;
                    }
                    buildItems(response.movie_results, "externalResult");
                    break;
                case "tv":
                    if (response.tv_results.length === 0)
                    {
                        $("#externalResult").innerHTML = "TV Show not found";
                        return;
                    }
                    buildItems(response.tv_results, "externalResult");
                    break;
                case "audiobook":
                    if (!response.valid)
                    {
                        $("#externalResult").innerHTML = "Audiobook not found";
                        return;
                    }
                    buildItems([response], "externalResult");
                    break;
                default:
                    $("#externalResult").innerHTML = "Sorry, something went wrong";
                    break;
            }
        };

        let failureFunc = function()
        {
            $("#externalResult").innerHTML = "Failed to retrieve media";
        };

        sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
    }

    /// <summary>
    /// Build the list of search results
    /// </summar>
    function buildItems(matches, holder)
    {
        const external = holder == "existingMatchContainer";
        logTmi(matches, `${holder} matches`);
        let container = $("#" + holder);
        container.innerHTML = "";
        container.appendChild(buildNode("hr"));

        container.appendChild(buildNode("p", {"style" : "margin-bottom: 5px"}, external ? "Existing Items:" : "Results:"));   

        let max = Math.min(matches.length, 10);
        for (let i = 0; i < max; ++i)
        {
            let match = matches[i];
            let item = buildNode("div", {
                "class" : "searchResult",
                "title" : match.title ? match.title : match.name,
                "poster" : match.poster_path ? match.poster_path : match.thumb
            },
            0,
            external ? {} : {
                "click" : clickSuggestion
            });

            if (match.ref)
            {
                item.setAttribute("ref", match.ref);
            }
            else
            {
                item.setAttribute(match.id ? "tmdbid" : "imdbid", match.id ? match.id : match.imdbid);
            }

            let img = buildNode("img", {
                "style" : "height : 70px",
                "src" : (match.poster_path ?
                    `https://image.tmdb.org/t/p/w92${match.poster_path}` :
                    (match.thumb ?
                        match.thumb :
                        `poster/${$("#type").value}default.png`
                    )
                )
            });

            let div = buildNode("div");
            div.appendChild(buildNode("span", {}, (match.title ? match.title : match.name) + " "));
            let release = match.release_date;
            if (!release)
            {
                release = match.year || match.first_air_date;
            }

            // match.ref is a hacky way to tell that we have an audiobook request
            const linkString = `(${match.ref ? "Audible" : (release ? release.substring(0, 4) : "IMDb")})`;

            div.appendChild(buildNode("a",
                {"href" : "#"},
                linkString,
                {
                    "click" : goToExternal
                }));

            item.appendChild(img);
            item.appendChild(div);

            container.appendChild(item);
        }

        let button = buildNode("input", {
            "type" : "button",
            "id" : `matchContinue_${holder}`,
            "class" : "matchContinue hidden",
            "value" : "Submit Request"
        },
        0,
        {
            "click" : submitSelected
        });

        container.appendChild(button);
    }

    /// <summary>
    /// Go to IMDb (or TMDb) when the user clicks on a suggestion
    /// </summar>
    function goToExternal()
    {
        let value = $("#type").value;
        let grandparent = this.parentNode.parentNode;
        const imdbid = grandparent.getAttribute("imdbid");
        if (imdbid)
        {
            logTmi("Clicked on an existing item");
            window.open(`https://www.imdb.com/title/${imdbid}`, "_blank");
            return;
        }

        const ref = grandparent.getAttribute("ref");
        if (ref)
        {
            window.open(ref, "_blank");
            return;
        }

        const tmdbid = grandparent.getAttribute("tmdbid");
        let parameters = { "type" : value == "movie" ? 1 : 2, "query" : tmdbid, "by_id" : "true" };
        let successFunc = function(response, request)
        {
            logInfo(response);
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
        let disableButton = "matchContinue_" + (enableButton.charAt(14) == 'm' ? "externalResult" : "matchContainer");
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
        if ($("#type").value == "audiobook")
        {
            alert("Sorry, audiobook requests aren't quite hooked up yet");
            return;
        }
        
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
        let failureFunc = function()
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

    function clearElement(id)
    {
        let element = $(`#${id}`);
        while (element.firstChild)
        {
            element.removeChild(element.firstChild);
        }
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
    function sendHtmlJsonRequest(url, parameters, successFunc, failFunc, additionalParams)
    {
        let http = new XMLHttpRequest();
        http.open("POST", url, true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        let queryString = buildQuery(parameters);
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
                logError(ex.stack);
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

        return queryString;
    }
})();
