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

        setupMarkdown();
        setupMarkdownHelpers();

        $("#newCommentButton").addEventListener("click", addComment);
        addNavListener();
        getComments();
    }

    function isAdmin()
    {
        return parseInt(document.body.getAttribute("isAdmin")) == 1;
    }

    function setupMarkdown()
    {
        $('#newComment').addEventListener('change', parseMarkdown);
        $('#newComment').addEventListener('keyup', parseMarkdown);
        $('#mdhelp').addEventListener('click', showMarkdownHelp);
        $('#newComment').addEventListener('keydown', captureTab);
    }

    function setupMarkdownHelpers()
    {
        $('#addBold').addEventListener('click', mdDispatch);
        $('#addUnderline').addEventListener('click', mdDispatch);
        $('#addItalic').addEventListener('click', mdDispatch);
        $('#addStrikethrough').addEventListener('click', mdDispatch);
        $('#addLink').addEventListener('click', addLink);
        $('#addImage').addEventListener('click', addPhoto);
    }

    function mdDispatch()
    {
        switch (this.id)
        {
            case 'addBold':
                mdSurround('**');
                break;
            case 'addUnderline':
                mdSurround('++');
                break;
            case 'addItalic':
                mdSurround('_');
                break;
            case 'addStrikethrough':
                mdSurround('~~');
                break;
            default:
                break;
        }
    }

    function getLinkOkCancelButtons(isPhoto)
    {
        let okayButton = buildNode(
            'input',
            {
                'type' : 'button',
                'id' : 'addLinkOk',
                'value' : 'Insert',
                'style' : 'width: 100px; margin-right: 10px; display: inline',
                'isPhoto' : isPhoto ? 1 : 0
            },
            0,
            {
                'click' : function()
                {
                    let comment = $('#newComment');
                    let link = $('#addLinkLink').value;
                    let text = $('#addLinkText').value;
                    let newText;
                    if (this.getAttribute('isPhoto') == '1')
                    {
                        let width = $('#insertWidth').value;
                        let height = $('#insertHeight').value;
                        let widthP = false;
                        let heightP = false;
                        if (width.endsWith('px'))
                        {
                            width = parseInt(width.substring(0, width.length - 2));
                        }
                        else if (width.endsWith('%'))
                        {
                            widthP = true;
                            width = parseInt(width.substring(0, width.length - 1));
                        }

                        if (height.endsWith('px'))
                        {
                            height = parseInt(height.substring(0, height.length - 2));
                        }
                        else if (height.endsWith('%'))
                        {
                            heightP = true;
                            height = parseInt(height.substring(0, height.length - 1));
                        }

                        logInfo(width);
                        logInfo(height);

                        let whString = text.length > 0 ? ' ' : '';
                        if (width != 0 && !isNaN(width))
                        {
                            whString = `w=${width}${widthP ? '%' : ''}`;
                        }

                        if (height != 0 && !isNaN(height))
                        {
                            whString += `${whString.length > 1 ? ',' : ''}h=${height}${heightP ? '%' : ''}`;
                        }

                        newText = `![${text}${whString}](${link})`;
                    }
                    else
                    {
                        newText = `[${text}](${link})`;
                    }

                    comment.focus();
                    if (document.queryCommandSupported('insertText'))
                    {
                        // This is deprecated, but it's the only way I've found to do it that supports undo.
                        let start = comment.selectionStart;
                        document.execCommand('insertText', false, newText);
                        comment.setSelectionRange(start + newText.length, start + newText.length);
                    }
                    else
                    {
                        comment.setRangeText(newText, comment.selectionStart, comment.selectionEnd, 'select');
                    }

                    overlayDismiss();
                    parseMarkdown();
                }
            });
        let cancelButton = buildNode(
            'input',
            {
                'type' : 'button',
                'value' : 'Cancel',
                'style' : 'width: 100px; display: inline'
            },
            0,
            {
                'click' : overlayDismiss
            });

        let outerButtonContainer = buildNode('div', { 'class' : 'formInput', 'style' : 'text-align: center' });
        let buttonContainer = buildNode('div', { "style" : "float: right; overflow: auto; width: 100%; margin: auto" } );
        buttonContainer.appendChild(okayButton);
        buttonContainer.appendChild(cancelButton);
        outerButtonContainer.appendChild(buttonContainer);
        return outerButtonContainer;
    }

    function addLinkOrPhoto(isPhoto)
    {
        const keyUpHandler = function(e)
        {
            if (e.keyCode == 13 && !e.ctrlKey && !e.shiftKey && !e.altKey)
            {
                e.stopPropagation();
                $('#addLinkOk').click();
            }
        };

        let comment = $('#newComment');
        let initialText = comment.value.substring(comment.selectionStart, comment.selectionEnd);
        let title = buildNode('h4', {}, `Insert ${isPhoto ? 'Image' : 'Hyperlink'}`);
        let linkText = buildNode('div', {}, 'URL:');
        let linkInput = buildNode(
            'input',
            {
                'type' : 'text',
                'id' : 'addLinkLink',

            },
            0,
            {
                'keyup' : keyUpHandler
            });
        let displayText = buildNode('div', {}, isPhoto ? 'Alt Text (optional):' : 'Display Text');
        let displayInput = buildNode(
            'input',
            {
                'type' : 'text',
                'id' : 'addLinkText',
                'value' : initialText
            },
            0,
            {
                'keyup' : keyUpHandler
            });

        let dimenText;
        let dimensions;
        if (isPhoto)
        {
            dimenText = buildNode('div', {}, 'Width and Height (optional)');
            let width = buildNode(
                'input',
                {
                    'type' : 'text',
                    'id' : 'insertWidth',
                    'style' : 'width: 75px; display: inline',
                    'placeholder' : 'Width (px or %)'
                },
                0,
                {
                    'keyup' : keyUpHandler
                });
            let span = buildNode('span', { 'style' : 'margin-left: 10px; margin-right: 10px' }, 'by');
            let height = buildNode(
                'input',
                {
                    'type' : 'text',
                    'id' : 'insertHeight',
                    'style' : 'width: 75px; display: inline',
                    'placeholder' : 'Height (px or %)'
                },
                0,
                {
                    'keyup' : keyUpHandler
                });

            dimensions = buildNode('div', { 'class' : 'formInput', 'style' : 'text-align: center' });
            let dimenContainer = buildNode('div', { "style" : "float: right; overflow: auto; width: 100%; margin: auto" } );
            dimenContainer.appendChild(width);
            dimenContainer.appendChild(span);
            dimenContainer.appendChild(height);
            dimensions.appendChild(dimenContainer);
        }

        let container = buildNode('div', { 'id' : 'mdInsertOverlay'});
        container.appendChild(title);
        container.appendChild(linkText);
        container.appendChild(linkInput);
        container.appendChild(displayText);
        container.appendChild(displayInput);
        if (isPhoto)
        {
            container.appendChild(dimenText);
            container.appendChild(dimensions);
        }

        container.appendChild(getLinkOkCancelButtons(isPhoto));

        buildOverlay(true, container);
        $('#addLinkLink').focus();
    }

    function addPhoto()
    {
        addLinkOrPhoto(true /*isPhoto*/);
    }

    function addLink()
    {
        addLinkOrPhoto(false /*isPhoto*/);
    }

    /// <summary>
    /// Surrounds the currently highlighted text with the specific pattern. If nothing is highlighted,
    /// add a placeholder value and highlight that.
    /// </summary>
    function mdSurround(ch)
    {
        let comment = $('#newComment');
        let start = comment.selectionStart;
        let end = comment.selectionEnd;
        comment.focus();
        let surround = (start == end) ? 'Text' : comment.value.substring(comment.selectionStart, comment.selectionEnd);

        if (document.queryCommandSupported('insertText'))
        {
            // This is deprecated, but it's the only way I've found to do it that supports undo.
            document.execCommand('insertText', false, ch + surround + ch);
        }
        else
        {
            let newText = ch + surround + ch;
            comment.setRangeText(newText);
        }

        comment.setSelectionRange(start + ch.length, start + surround.length + ch.length)

        parseMarkdown();
    }

    let mdPreview = new Markdown();
    function parseMarkdown()
    {
        const text = $('#newComment').value;

        logTmi(`Parsing "${text}"`);
        let html = mdPreview.parse(text);
        $('#mdHolder').style.display = (text.length != 0 && mdPreview.markdownPresent) ? "block" : "none";

        // No need to redraw if the content is the same as our last result.
        if (!mdPreview.sameText)
        {
            $('#mdPreview').innerHTML = html;
        }
    }

    function showMarkdownHelp()
    {
        overlay('<div class="mdHelp">' + markdownHelp() + '</div>', 'Got It', overlayDismiss, true /*dismissable*/);
    }

    /// <summary>
    /// When in the 'new comment' box, capture tab keypresses and convert them
    /// into text insertion. This will break general tab navigation, but with
    /// a markdown editor it's much more likely that the user wants to indent
    /// and not move focus to the next element on the page.
    /// </summary>
    function captureTab(e)
    {
        // It will probably just cause more confusion for people, but we can break out of the textarea if caps lock is on.
        if (e.keyCode != 9 /*tab*/ || e.ctrlKey || e.shiftKey || e.altKey || e.getModifierState('CapsLock'))
        {
            return;
        }

        let comment = $('#newComment');
        let start = comment.selectionStart;
        let lastNewline = comment.value.lastIndexOf('\n', start);
        let spaces = ' '.repeat(4 - (start - (lastNewline + 1)) % 4);

        // insertText gives us undo support. If it's not available, we can still
        // insert the spaces, but undo will break.
        if (document.queryCommandSupported('insertText'))
        {
            document.execCommand('insertText', false, spaces);
        }
        else
        {
            comment.value = comment.value.substring(0, start) + spaces + comment.value.substring(start);
            comment.selectionStart = start + spaces.length;
            comment.selectionEnd = comment.selectionStart;
        }

        e.preventDefault();
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
                {
                    "class" : "searchResult",
                    "title" : match.title ? match.title : match.name,
                    "tmdbid" : match.id
                },
                0,
                { "click" : clickSuggestion });

            let type = parseInt(document.body.getAttribute("requestType"));
            if (type != 2) { type = 1; }
            let img = buildNode("img", {
                "src" : (match.poster_path ? 
                `https://image.tmdb.org/t/p/w92${match.poster_path}` :
                    (match.thumb ?
                        match.thumb :
                        `poster/${type == 1 ? 'movie' : 'tv'}default.png`
                    )
                ),
                "style" : "height: 70px"
            });

            let div = buildNode("div", { "class" : "matchText" });
            let release = match.release_date;
            if (release === null || release === undefined)
            {
                release = match.first_air_date;
            }

            let titleText = (match.title ? match.title : match.name) + ' ';
            div.appendChild(buildNode('span', {}, titleText));
            let href = buildNode("a",
                {"href" : "#"},
                (release.length > 4 ? (" (" + release.substring(0, 4) + ")") : ""),
                { "click" : goToImdb});

            div.appendChild(href);
            item.appendChild(img);
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
        let successFunc = function(response, request)
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

    function getStatusSpan(status)
    {
        let statusSpan = buildNode("span",
            {"class" : `status${status}`},
            [
                "Pending",
                "Complete",
                "Denied",
                "In Progress",
                "Waiting"
            ][status]);

        if (isAdmin())
        {
            setupSpanDoubleClick(statusSpan);
        }

        return statusSpan;
    }

    function getNonMediaInfo()
    {
        let outerContainer = buildNode("div", {"id" : "innerInfoContainer"});
        let container = buildNode("div", {"id" : "mediaDetails"});

        let title = buildNode("div", { "id" : "mediaTitle" }, `Request: ${document.body.getAttribute("requestName")} - `);
        let status = parseInt(document.body.getAttribute("requestStatus"));
        title.appendChild(getStatusSpan(status));
        container.appendChild(title);

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

        title.innerHTML = (data.title || data.name) + " - ";
        title.appendChild(getStatusSpan(status));

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
            $('#mdHolder').style.display = "none";
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

            // Try the new markdown parser
            let fixedupContent = new Markdown().parse(comment[1]);

            let content = buildNode("div", {"class" : "commentContent md"}, fixedupContent);

            info.appendChild(name);
            info.appendChild(date);

            holder.appendChild(info);
            holder.appendChild(content);

            container.appendChild(holder);
        }
    }
});
