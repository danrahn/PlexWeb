/// <summary>
/// Handles building an individual request and associated comments
/// </summary>

/// <summary>
/// Add initial event listeners
/// </summary>
window.addEventListener("load", function()
{
    if ($("#matchContainer"))
    {
        searchForMedia();
        $("#external_id").addEventListener("input", searchImdb);
    }
    else
    {
        if (attr("isMediaRequest") == "1")
        {
            getMediaInfo();
        }
        else
        {
            getNonMediaInfo();
        }

        $("#newComment").addEventListener("focus", function() { this.className = "newCommentFocus"; });
        $("#newComment").addEventListener("blur", function() { this.className = ""; });
        $("#newComment").addEventListener("keydown", function(e)
        {
            if (e.ctrlKey && e.which === 13 /*enter*/)
            {
                addComment();
            }
        });

        setupMarkdown();
        setupMarkdownHelpers();

        $("#newCommentButton").addEventListener("click", addComment);
        addNavListener();
        getComments();

        checkForNotifications();
    }
});

/// <summary>
/// Returns an attribute on the document's body.
///
/// Really just shorthand for document.body.getAttribute
/// </summary>
function attr(prop)
{
    return document.body.getAttribute(prop);
}

/// <summary>
/// Get an attribute from the document's body as an integer
/// </summary>
function attrInt(prop)
{
    return parseInt(attr(prop));
}

/// <summary>
/// Returns whether the current user is an admin.
/// </summary>
function isAdmin()
{
    return attrInt("isAdmin");
}

/// <summary>
/// Returns the id associated with the current request
/// </summary>
function reqId()
{
    return attrInt("reqId");
}

/// <summary>
/// Add markdown related event listeners to the new comment textbox
/// </summary>
function setupMarkdown()
{
    let comment = $("#newComment");
    comment.addEventListener("change", parseMarkdown);
    comment.addEventListener("keyup", parseMarkdown);
    comment.addEventListener("keydown", shortcutListener);
    $("#mdhelp").addEventListener("click", showMarkdownHelp);
    MarkdownEditor.addTabHandler(comment);
    MarkdownEditor.addFormatHandler(comment);
}

/// <summary>
/// Add event listeners to markdown insert buttons
/// </summary>
function setupMarkdownHelpers()
{
    $("#addBold").addEventListener("click", mdDispatch);
    $("#addUnderline").addEventListener("click", mdDispatch);
    $("#addItalic").addEventListener("click", mdDispatch);
    $("#addStrikethrough").addEventListener("click", mdDispatch);
    $("#addLink").addEventListener("click", addLink);
    $("#addImage").addEventListener("click", addPhoto);
    $("#addTable").addEventListener("click", addTable);
    $("#showMdHelp").addEventListener("click", showMarkdownHelp);
}

/// <summary>
/// Dispatch a markdown format button click to the correct handler
/// </summary>
function mdDispatch()
{
    switch (this.id)
    {
        case "addBold":
            MarkdownEditor.addFormat($("#newComment"), "**");
            break;
        case "addUnderline":
            MarkdownEditor.addFormat($("#newComment"), "++");
            break;
        case "addItalic":
            MarkdownEditor.addFormat($("#newComment"), "_");
            break;
        case "addStrikethrough":
            MarkdownEditor.addFormat($("#newComment"), "~~");
            break;
        default:
            return;
    }

    parseMarkdown();
}

/// <summary>
/// When the comment box is focused, listens for keyboard shortcuts
/// to launch link/image/table dialogs
/// </summary>
function shortcutListener(e)
{
    if (!e.ctrlKey || e.altKey || e.shiftKey)
    {
        return;
    }

    switch (e.keyCode)
    {
        case KEY.K:
            addLink();
            break;
        case KEY.M:
            addPhoto();
            break;
        case KEY.L:
            addTable();
            break;
        default:
            return;
    }

    e.preventDefault();
}

/// <summary>
/// Parses input from the insert image dialog and returns the corresponding markdown string
/// </summary>
function processPhotoDimensions(link, text)
{
    let width = $("#insertWidth").value;
    let height = $("#insertHeight").value;
    let widthP = false;
    let heightP = false;
    if (width.endsWith("px"))
    {
        width = parseInt(width.substring(0, width.length - 2));
    }
    else if (width.endsWith("%"))
    {
        widthP = true;
        width = parseInt(width.substring(0, width.length - 1));
    }

    if (height.endsWith("px"))
    {
        height = parseInt(height.substring(0, height.length - 2));
    }
    else if (height.endsWith("%"))
    {
        heightP = true;
        height = parseInt(height.substring(0, height.length - 1));
    }

    logInfo(width);
    logInfo(height);

    let whString = text.length > 0 ? " " : "";
    if (width != 0 && !isNaN(width))
    {
        whString = `w=${width}${widthP ? "%" : ""}`;
    }

    if (height != 0 && !isNaN(height))
    {
        whString += `${whString.length > 1 ? "," : ""}h=${height}${heightP ? "%" : ""}`;
    }

    return `![${text}${whString}](${link})`;
}

/// <summary>
/// Insert a markdown hyperlink or image from dialog input
/// </summary>
function insertLinkInComment()
{
    let comment = $("#newComment");
    let link = $("#addLinkLink").value;
    let text = $("#addLinkText").value;
    let newText;
    if (this.getAttribute("isPhoto") == "1")
    {
        newText = processPhotoDimensions(link, text);
    }
    else
    {
        newText = `[${text}](${link})`;
    }

    comment.focus();
    if (document.queryCommandSupported("insertText"))
    {
        // This is deprecated, but it's the only way I've found to do it that supports undo.
        let start = comment.selectionStart;
        document.execCommand("insertText", false, newText);
        comment.setSelectionRange(start + newText.length, start + newText.length);
    }
    else
    {
        comment.setRangeText(newText, comment.selectionStart, comment.selectionEnd, "select");
    }

    overlayDismiss();
    parseMarkdown();
}

/// <summary>
/// Return an element containing Ok and Cancel buttons for a markdown insert dialog
/// </summary>
function getOkCancelButtons(okId, okFunc, okExtra)
{
    let okayButton = buildNode(
        "input",
        {
            type : "button",
            id : okId,
            value : "Insert",
            style : "width: 100px; margin-right: 10px; display: inline"
        },
        0,
        {
            click : okFunc
        }
    );

    if (okExtra)
    {
        for (let [key, value] of Object.entries(okExtra))
        {
            okayButton.setAttribute(key, value);
        }
    }

    let cancelButton = buildNode(
        "input",
        {
            type : "button",
            value : "Cancel",
            style : "width: 100px; display: inline"
        },
        0,
        {
            click : overlayDismiss
        }
    );

    let outerButtonContainer = buildNode("div", { class : "formInput", style : "text-align: center" });
    let buttonContainer = buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" });
    outerButtonContainer.appendChild(buttonContainer.appendChildren(okayButton, cancelButton));
    return outerButtonContainer;
}

/// <summary>
/// Return element containing image width/height inputs
/// </summary>
function buildMarkdownImageDimensionsInput()
{
    let width = buildNode(
        "input",
        {
            type : "text",
            id : "insertWidth",
            style : "width: 75px; display: inline",
            placeholder : "Width"
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });
    let span = buildNode("span", { style : "margin-left: 10px; margin-right: 10px" }, "by");
    let height = buildNode(
        "input",
        {
            type : "text",
            id : "insertHeight",
            style : "width: 75px; display: inline",
            placeholder : "Height"
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });

    let dimensions = buildNode("div", { class : "formInput", style : "text-align: center" });
    let dimenContainer = buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" });
    dimenContainer.appendChildren(width, span, height);
    dimensions.appendChild(dimenContainer);
    return dimensions;
}

/// <summary>
/// Keyup handler for comment insert dialogs to commit on 'enter'
/// </summary>
function mdInsertKeyupHandler(e)
{
    if (e.keyCode == KEY.ENTER && !e.ctrlKey && !e.shiftKey && !e.altKey)
    {
        e.stopPropagation();
        $("#addLinkOk").click();
    }
}

/// <summary>
/// Launches a dialog to insert an image or link into a comment
/// </summary>
function addLinkOrPhoto(isPhoto)
{
    let comment = $("#newComment");
    let initialText = comment.value.substring(comment.selectionStart, comment.selectionEnd);
    let title = buildNode("h4", {}, `Insert ${isPhoto ? "Image" : "Hyperlink"}`);
    let linkText = buildNode("div", {}, "URL:");
    let linkInput = buildNode(
        "input",
        {
            type : "text",
            id : "addLinkLink"
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });
    let displayText = buildNode("div", {}, isPhoto ? "Alt Text (optional):" : "Display Text");
    let displayInput = buildNode(
        "input",
        {
            type : "text",
            id : "addLinkText",
            value : initialText
        },
        0,
        {
            keyup : mdInsertKeyupHandler
        });

    let container = buildNode("div", { id : "mdInsertOverlay" });
    container.appendChildren(title, linkText, linkInput, displayText, displayInput);
    if (isPhoto)
    {
        container.appendChildren(
            buildNode("div", {}, "Width and Height (optional)"),
            buildMarkdownImageDimensionsInput());
    }

    container.appendChild(getOkCancelButtons("addLinkOk", insertLinkInComment, { isPhoto : isPhoto ? 1 : 0 }));

    buildOverlay(true, container);
    $("#addLinkLink").focus();
}

/// <summary>
/// Initiate the insert image dialog
/// </summary>
function addPhoto()
{
    addLinkOrPhoto(true /*isPhoto*/);
}

/// <summary>
/// Initiate the insert link dialog
/// </summary>
function addLink()
{
    addLinkOrPhoto(false /*isPhoto*/);
}

/// <summary>
/// Initiate the insert table dialog
/// </summary>
function addTable()
{
    let container = buildNode("div", { id : "mdInsertOverlay" });
    let header = buildNode("h2", {}, "Insert Table");
    let resizeButtons = getBuildTableButtons();
    let table = defaultInsertTable();
    buildOverlay(true, container.appendChildren(header, resizeButtons, table, getOkCancelButtons("mdtInsert", insertMdTable)));
    table.$$("thead textarea").focus();

    // Force area calculation to get row widths in alignment
    setMdtWidthHeight(0, 0);
    setMdtWidthHeight(0, 1);
}

/// <summary>
/// Returns an initial 2x3 table to show when inserting a table in the UI
/// </summary>
function defaultInsertTable()
{
    let holder = buildNode("div", { id : "mdtHolder" });
    let table = buildNode("table", { id : "mdt" });
    let head = buildNode("thead");
    head.appendChild(newTableRow(2, "Column"));

    let body = buildNode("tbody");
    body.appendChildren(newTableRow(2, "Foo"), newTableRow(2, "Bar"));

    holder.appendChild(table.appendChildren(head, body));
    return holder;
}

/// <summary>
/// Returns a new table row (tr) with the given number of cells
/// </summary>
/// <params name="defaultText">
/// The initial value for the row. Will be combined with the cell number to make a unique value
/// </param>
function newTableRow(cells, defaultText)
{
    let row = buildNode("tr");
    for (let i = 0; i < cells; ++i)
    {
        row.appendChild(newTableCell(defaultText, i + 1));
    }

    return row;
}

/// <summary>
/// Creates a new table cell for inserting a table, including adding all necessary event listeners
/// </summary>
function newTableCell(defaultText, cell)
{
    let data = buildNode("td");
    let textarea = buildNode("textarea");
    if (defaultText)
    {
        textarea.value = defaultText + " " + cell;
        textarea.style.width = `calc(${textarea.value.length + "ch"} + 4px)`;
    }

    textarea.addEventListener("input", function()
    {
        setMdtWidthHeight(mdtRow(this), mdtCol(this));
    });

    textarea.addEventListener("keydown", handleMdTableTextareaKey);

    textarea.addEventListener("focus", function()
    {
        this.select();
    });

    data.appendChild(textarea);
    return data;
}

/// <summary>
/// Return a container of buttons to control the number of rows and columns in the table
/// </summary>
function getBuildTableButtons()
{
    let div = buildNode("div", { id : "mdtButtons" });
    let divLeft = buildNode("div", { id : "mdtRowButtons" });
    let divRight = buildNode("div", { id : "mdtColButtons" });
    let buttons =
    [
        { text : "+ Row", id : "mdtAddRow", func : addMdTableRow },
        { text : "- Row", id : "mdtRemoveRow", func : removeMdTableRow },
        { text : "+ Column", id : "mdtAddColumn", func : addMdTableColumn },
        { text : "- Column", id : "mdtRemoveColumn", func : removeMdTableColumn },
    ];

    let i = 0;
    let cur = divLeft;
    for (let button of buttons)
    {
        ++i;
        let node = buildNode(
            "input",
            { type : "button", value : button.text, id : button.id },
            0,
            {
                click : button.func
            });

        cur.appendChild(node);
        if (i == 2)
        {
            cur = divRight;
        }
    }

    return div.appendChildren(divLeft, divRight);
}

/// <summary>
/// Keydown key listener for markdown table textareas
///
/// Commits the table on Ctrl+Enter
/// Navigates to the beginning/end of a row or top/bottom of a column on Left/Right/Up/Down
/// </summary>
function handleMdTableTextareaKey(e)
{
    if (e.ctrlKey && e.keyCode == KEY.ENTER)
    {
        $("#mdtInsert").click();
        return;
    }

    if (e.altKey || e.ShiftKey)
    {
        return;
    }

    const noSelection = (cell) => cell.selectionStart == cell.selectionEnd;
    const atTop = (cell) => noSelection(cell) && cell.value.lastIndexOf("\n", cell.selectionStart) == -1;
    const atBottom = (cell) => noSelection(cell) && cell.value.indexOf("\n", cell.selectionStart) == -1;
    const atLeft = (cell) => noSelection(cell) && cell.selectionStart == 0 || cell.value[cell.selectionStart - 1] == "\n";
    const atRight = (cell) => noSelection(cell) && cell.selectionStart == cell.value.length || cell.value[cell.selectionStart + 1] == "\n";
    switch (e.keyCode)
    {
        case KEY.RIGHT:
            if (atRight(this))
            {
                selectMdTableTextarea(mdtRow(this), e.ctrlKey ? $$("#mdt thead tr").children.length - 1 : mdtCol(this) + 1, false);
            }
            break;
        case KEY.LEFT:
            if (atLeft(this))
            {
                selectMdTableTextarea(mdtRow(this), e.ctrlKey ? 0 : mdtCol(this) - 1, true);
            }
            break;
        case KEY.DOWN:
            if (atBottom(this))
            {
                selectMdTableTextarea(e.ctrlKey ? $$("#mdt tbody").children.length : mdtRow(this) + 1, mdtCol(this), false);
            }
            break;
        case KEY.UP:
            if (atTop(this))
            {
                selectMdTableTextarea(e.ctrlKey ? 0 : mdtRow(this) - 1, mdtCol(this), true);
            }
            break;
        default:
            break;
    }
}

/// <summary>
/// Helper function to determine the row of the given cell
/// </summary>
/// <remarks>
/// Could we add row/col properties to the textareas  directly to avoid
/// this potentially costly iteration?
/// </remarks>
function mdtRow(cell)
{
    // textarea -> td -> tr -> t(body|head)
    if (cell.parentNode.parentNode.parentNode.tagName.toLowerCase() == "thead")
    {
        return 0;
    }

    return _childIndex(cell.parentNode.parentNode) + 1;
}

/// <summary>
/// Helper function to determine the column of the given cell
/// </summary>
function mdtCol(cell)
{
    return _childIndex(cell.parentNode);
}

/// <summary>
/// Finds the largest width and height for all cells
/// in the same row/column as the given cell, and sets
/// the width/height of the cells accordingly, ensuring
/// a consistent display
/// </summary>
/// <remarks>
/// Efficiency might be improved via a read/write switch
/// If we're writing, we just changed the given cell
/// If we're reading, we don't need to set any cells other than the one given
/// </remarks>
function setMdtWidthHeight(iRow, iCol)
{
    let maxRows = $$("#mdt tbody").children.length;
    let maxWidth = 0;
    for (let rowIndex = 0; rowIndex <= maxRows; ++rowIndex)
    {
        let row = rowIndex == 0 ? $$("#mdt thead tr") : $$("#mdt tbody").children[rowIndex - 1];
        let maxHeight = 1;
        for (let colIndex = 0; colIndex < row.children.length; ++colIndex)
        {
            if (rowIndex != iRow && colIndex != iCol)
            {
                continue;
            }

            let cell = row.children[colIndex].children[0];
            let lines = cell.value.split("\n");
            maxHeight = Math.max(maxHeight, lines.length);
            if (colIndex == iCol)
            {
                maxWidth = Math.max(maxWidth, lines.reduce((acc, cur) => cur.length > acc ? cur.length : acc, 0));
            }
        }

        if (rowIndex == iRow)
        {
            for (let j = 0; j < row.children.length; ++j)
            {
                row.children[j].children[0].style.height = (maxHeight * 1.2) + "em";
            }
        }
    }

    for (let rowIndex = 0; rowIndex <= maxRows; ++rowIndex)
    {
        let row = rowIndex == 0 ? $$("#mdt thead tr") : $$("#mdt tbody").children[rowIndex - 1];
        row.children[iCol].children[0].style.width = `calc(${maxWidth + "ch"} + 4px)`;
    }
}

/// <summary>
/// Moves focus to the cell at the given row and column
/// </summary>
/// <param name="toTop">If true, sets the cursor to the beginning of the text, otherwise the end</param>
function selectMdTableTextarea(iRow, iCol, toTop)
{
    let rows = $$("#mdt tbody").children;
    if (iRow < 0 || iRow > rows.length)
    {
        return;
    }

    let row = iRow == 0 ? $$("#mdt thead tr") : rows[iRow - 1];

    if (iCol < 0 || iCol >= row.children.length)
    {
        return;
    }

    let cell = row.children[iCol].$$("textarea");
    cell.focus();
    if (toTop)
    {
        cell.setSelectionRange(0, 0);
    }
    else
    {
        cell.setSelectionRange(cell.value.length, cell.value.length);
    }
}

/// <summary>
/// Returns the index of the given element within its parent's child list
/// </summary>
function _childIndex(element)
{
    let children = element.parentNode.children;
    for (let i = 0; i < children.length; ++i)
    {
        if (children[i] == element)
        {
            return i;
        }
    }

    return -1;
}

/// <summary>
/// Adds a row to the table in the insert table dialog
/// </summary>
function addMdTableRow()
{
    let body = $$("#mdt tbody");
    let columns = $$("#mdt thead tr").children.length;
    let newRow = body.children.length + 1;
    body.appendChild(newTableRow(columns));
    $("#mdtRemoveRow").disabled = false;

    for (let column = 0; column < columns; ++column)
    {
        setMdtWidthHeight(newRow, column);
    }
}

/// <summary>
/// Removes a row to the table in the insert table dialog (as long as there is at least one row left)
/// </summary>
function removeMdTableRow()
{
    let rows = $$("#mdt tbody");
    let length = rows.children.length;
    if (length == 0)
    {
        logWarn("How are we removing a row when we don't have any?");
        return;
    }

    rows.removeChild(rows.children[rows.children.length - 1]);
    if (length == 1)
    {
        $("#mdtRemoveRow").disabled = true;
    }
}

/// <summary>
/// Adds a column to the table in the insert table dialog
/// </summary>
function addMdTableColumn()
{
    $("#mdt tr").forEach(function(row)
    {
        row.appendChild(newTableCell());
    });

    $("#mdtRemoveColumn").disabled = false;

    let newColumn = $$("#mdt thead tr").children.length - 1;
    let rows = $$("#mdt tbody").children.length;
    for (let row = 0; row <= rows; ++row)
    {
        setMdtWidthHeight(row, newColumn);
    }
}

/// <summary>
/// Removes a column to the table in the insert table dialog
/// </summary>
function removeMdTableColumn()
{
    let length = $$("#mdt thead tr").children.length;
    if (length == 1)
    {
        logWarn("How are we removing a column when we only have one left?");
        return;
    }

    $("#mdt tr").forEach(function(row)
    {
        row.removeChild(row.children[row.children.length - 1]);
    });

    if (length == 2)
    {
        $("#mdtRemoveColumn").disabled = true;
    }
}

/// <summary>
/// Parse the dialog table and insert the markdown equivalent into the comment box
/// </summary>
function insertMdTable()
{
    let header = $("#mdt thead textarea");
    let headerText = "";
    let definitionText = "";
    header.forEach(function(cell)
    {
        headerText += " | " + fixupTableCell(cell.value);
        definitionText += " | ---";
    });

    let tableText = headerText.substring(1) + " |\n";
    tableText += definitionText.substring(1) + " |\n";

    let rows = $$("#mdt tbody").children;
    for (let row of rows)
    {
        let cells = row.$("textarea");
        let rowText = "";
        cells.forEach(function(cell)
        {
            rowText += " | " + fixupTableCell(cell.value);
        });

        tableText += rowText.substring(1) + " |\n";
    }

    let comment = $("#newComment");
    comment.focus();
    if (document.queryCommandSupported("insertText"))
    {
        // This is deprecated, but it's the only way I've found that supports undo
        let start = comment.selectionStart;
        if (start != 0 && comment.value[start - 1] != "\n")
        {
            tableText = "\n" + tableText;
        }
        document.execCommand("insertText", false, tableText);
        comment.setSelectionRange(start + tableText.length, start + tableText.length);
    }
    else
    {
        comment.setRangeText(tableText, comment.selectionStart, comment.selectionEnd, "select");
    }

    overlayDismiss();
    parseMarkdown();
}

/// <summary>
/// Cleans up and returns a table cell's contents to ensure it doesn't escape its bounds
/// </summary>
function fixupTableCell(text)
{
    const isEscaped = (index) =>
    {
        let bs = 0;
        while (index - bs > 0 && text[index - 1 - bs] == "\\")
        {
            ++bs;
        }

        return bs % 2 == 1;
    };

    let finalText = "";
    let fixInline = 0;
    for (let i = 0; i < text.length; ++i)
    {
        if (text[i] == "`" && !isEscaped(i))
        {
            let end = _inlineEnd(i, text);
            if (end < 0)
            {
                fixInline = -end;
                end = text.length;
            }

            while (i < end)
            {
                finalText += text[i] == "\n" ? " " : text[i++];
            }

            --i;
            continue;
        }

        if (text[i] == "|" && !isEscaped(i))
        {
            finalText += "\\";
        }

        finalText += text[i];
    }

    if (fixInline)
    {
        // Close out the inline block for the user
        finalText += (finalText.endsWith("`") ? " " : "") + "`".repeat(fixInline);
    }

    return finalText.replace(/\n/g, "<br>");
}

// See Markdown::_inlineEnd
function _inlineEnd(index, text)
{
    let inline = 1;
    while (index + inline < text.length && text[index + inline] == "`")
    {
        ++inline;
    }

    let doubleNewline = text.indexOf("\n\n", index);
    let endInline = text.indexOf("`".repeat(inline), index + inline);
    if (endInline == -1 || (doubleNewline != -1 && endInline > doubleNewline))
    {
        return -inline;
    }

    return endInline + inline;
}

// Global markdown object so we can cache parsed markdown
let mdPreview = new Markdown();

/// <summary>
/// Parse the user's new comment text. If any markdown elements
/// are (not) present, show (hide) the preview window.
/// </summary>
function parseMarkdown()
{
    const text = $("#newComment").value;

    logTmi(`Parsing "${text}"`);
    let html = mdPreview.parse(text);
    $("#mdHolder").style.display = (text.length != 0 && mdPreview.markdownPresent) ? "block" : "none";

    // No need to redraw if the content is the same as our last result.
    if (!mdPreview.sameText)
    {
        $("#mdPreview").innerHTML = html;
    }
}

/// <summary>
/// Show an overlay containing the markdown help article
/// </summary>
function showMarkdownHelp()
{
    MarkdownHelp.getHelp(function(response)
    {
        overlay('<div class="mdHelp">' + response.data + "</div>", "Got It", overlayDismiss, true /*dismissible*/);
    });

}

let selectedSuggestion;

/// <summary>
/// Add request keyboard listener to navigate between requests
/// on Ctrl+Left/Ctrl+Right
/// </summary>
function addNavListener()
{
    document.body.addEventListener("keydown", function(e)
    {
        let tag = e.target.tagName.toLowerCase();
        if (tag == "textarea" || (tag == "input" && e.target.type == "text"))
        {
            return;
        }

        if (!e.ctrlKey || (e.which !== KEY.LEFT && e.which !== KEY.RIGHT))
        {
            return;
        }

        logVerbose("Searching for next id");
        let parameters = { type : ProcessRequest.NextRequest, id : reqId(), dir : e.which === KEY.LEFT ? "0" : "1" };
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

/// <summary>
/// For legacy movie/tv requests that do not yet have an external id,
/// initiate an external search to try and find a match
/// </summary>
function searchForMedia()
{
    let requestType = attrInt("requestType");
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

/// <summary>
/// Search imdb for a legacy request that does not yet have an external id set
/// </summary>
function searchImdb()
{
    let id = $("#external_id").value;
    if (id.length != 9 || id.substring(0, 2) != "tt" || isNaN(parseInt(id.substring(2))))
    {
        if (id.length == 0)
        {
            $("#imdbResult").innerHTML = "";
        }
        else
        {
            $("#imdbResult").innerHTML = "Incomplete IMDb Id";
        }

        return;
    }

    $("#imdbResult").innerHTML = "Searching...";

    let parameters = { type : attrInt("requestType"), query : id, imdb : true };
    let successFunc = function(response)
    {
        logInfo(response);
        let type = attrInt("requestType");
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

/// <summary>
/// Search for a legacy request and show potential matches to the user
/// </summary>
function searchForMediaCore()
{
    let parameters = { type : attrInt("requestType"), query : attr("requestName") };
    let successFunc = function(response)
    {
        logInfo(response);
        if (response.results.length === 0)
        {
            $("#matchContainer").innerHTML = "No matches found. Please enter the IMDb id below";
            return;
        }

        buildItems(response.results, "matchContainer");
    };

    let failureFunc = function(/*response*/)
    {
        $("#matchContainer").innerHTML = "Error searching for matches";
    };

    sendHtmlJsonRequest("media_search.php", parameters, successFunc, failureFunc);
}

/// <summary>
/// Builds a suggested match for a legacy request
/// </summary>
function buildLegacyMatch(match)
{
    let item = buildNode("div",
        {
            class : "searchResult",
            title : match.title ? match.title : match.name,
            tmdbid : match.id
        },
        0,
        { click : clickSuggestion });

    let type = attrInt("requestType");
    if (type != 2) { type = 1; }
    let img = buildNode("img", {
        src : (match.poster_path ?
            `https://image.tmdb.org/t/p/w92${match.poster_path}` :
            (match.thumb ?
                match.thumb :
                `poster/${type == 1 ? "movie" : "tv"}default.png`
            )
        ),
        style : "height: 70px"
    });

    let div = buildNode("div", { class : "matchText" });
    let release = match.release_date;
    if (release === null || release === undefined)
    {
        release = match.first_air_date;
        if (!release)
        {
            release = "";
        }
    }

    let titleText = (match.title ? match.title : match.name) + " ";
    div.appendChild(buildNode("span", {}, titleText));
    let href = buildNode("a",
        { href : "#" },
        (release.length > 4 ? (" (" + release.substring(0, 4) + ")") : ""),
        { click : goToImdb });

    div.appendChild(href);
    return item.appendChildren(img, div);
}

/// <summary>
/// Builds potential request matches for legacy requests that don't
/// have a backing external ID. Largely copied from new_request's similar method
/// </summary>
function buildItems(matches, holder)
{
    let container = $("#" + holder);
    container.innerHTML = "";
    let max = Math.min(matches.length, 10);
    for (let i = 0; i < max; ++i)
    {
        container.appendChild(buildLegacyMatch(matches[i]));
    }

    let button = buildNode(
        "input",
        {
            id : `matchContinue_${holder}`,
            class : "matchContinue",
            style : "visibility: hidden; height: 0",
            type : "button",
            value : "Continue"
        },
        0,
        { click : chooseSelected });
    container.appendChild(button);
}

/// <summary>
/// Navigate to IMDb (falling back to themoviedb) when a legacy request link is clicked
/// </summary>
function goToImdb()
{
    let parameters = { type : attrInt("requestType"), query : this.parentNode.parentNode.getAttribute("tmdbid"), by_id : "true" };
    let successFunc = function(response, request)
    {
        logInfo(response);
        if (response.imdb_id)
        {
            window.open("https://www.imdb.com/title/" + response.imdb_id, "_blank");
        }
        else
        {
            window.open("https://www.themoviedb.org/" + attrInt("requestTypeStr") + "/" + request.tmdbid);
        }
    };
    sendHtmlJsonRequest("media_search.php", parameters, successFunc, null, { tmdbid : this.parentNode.parentNode.getAttribute("tmdbid") });
}

/// <summary>
/// Process a click on a potential match for a legacy request
/// </summary>
function clickSuggestion(e)
{
    if (e.target.tagName.toLowerCase() == "a")
    {
        return;
    }

    let enableButton = "matchContinue_" + this.parentNode.id;
    let disableButton = "matchContinue_" + (enableButton.charAt(14) == "m" ? "imdbResult" : "matchContainer");
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

/// <summary>
/// Show or hide the element with the given id
/// </summary>
function setVisibility(id, visible)
{
    let element = $(`#${id}`);
    if (!element)
    {
        return;
    }

    element.style.visibility = visible ? "visible" : "hidden";
    element.style.height = visible ? "auto" : "0";
}

/// <summary>
/// Match a legacy request with the selected item
/// </summary>
function chooseSelected()
{
    if (!selectedSuggestion)
    {
        let button = $("#matchContinue");
        let color = new Color(button.getComputedStyle.backgroundColor);
        Animation.queue({ backgroundColor : new Color(100, 66, 69) }, button, 500);
        Animation.queueDelayed({ backgroundColor : color }, button, 500, 500, true);
        return;
    }

    if (!selectedSuggestion.getAttribute("tmdbid"))
    {
        logError("No tmdb id found");
        return;
    }

    let params = { type : ProcessRequest.SetExternalId, req_id : reqId(), id : selectedSuggestion.getAttribute("tmdbid") };

    let successFunc = function(response)
    {
        logInfo(response);
        let matches = $(".matchContinue");

        for (let i = 0; i < matches.length; ++i)
        {
            matches[i].value = "Success! Redirecting...";
        }

        setTimeout(function() { window.location.reload(); }, 1000);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc);
}

/// <summary>
/// Initiate a request for information on the current request
/// </summary>
function getMediaInfo()
{
    let parameters = { type : attrInt("requestType"), query : attr("externalId"), by_id : "true" };
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

/// <summary>
/// Return the status string based on the state of the request.
/// If the current user is an admin, setup event listeners that enable
/// changing the current status
/// </summary>
function getStatusSpan(status)
{
    let statusSpan = buildNode("span",
        { class : `status${status}` },
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

/// <summary>
/// Build the request page for non-media requests (e.g. ViewStream requests)
/// </summary>
function getNonMediaInfo()
{
    let outerContainer = buildNode("div", { id : "innerInfoContainer" }).appendChildren(
        buildNode("div", { id : "mediaDetails" }).appendChildren(
            buildNode("div", { id : "mediaTitle" }, `Request: ${attr("requestName")} - `).appendChildren(
                getStatusSpan(attrInt("requestStatus"))
            )
        )
    );

    $("#infoContainer").innerHTML = "";
    $("#infoContainer").appendChild(outerContainer);
}

/// <summary>
/// Return an image element containing the poster for the given request,
/// falling back to a default poster if a real one does not exist
/// </summary>
function buildRequestPoster(request)
{
    let posterPath = request.poster_path;
    if (!posterPath)
    {
        switch (attrInt("requestType"))
        {
            case 1:
                posterPath = "/moviedefault.svg";
                break;
            case 2:
                posterPath = "/tvdefault.svg";
                break;
            default:
                posterPath = "/viewstream.svg";
                break;
        }
    }

    return buildNode("img", { src : `poster${posterPath}&large=1`, id : "mediaPoster" });
}

/// <summary>
/// Return the node containing a link to an external site (imdb/themoviedb) for the given request
/// </summary>
function buildRequestExternalLink(request)
{
    let imdb;
    if (request.imdb_id)
    {
        imdb = buildNode("div", { id : "mediaLink" });
        imdb.appendChild(buildNode("a", {
            href : `https://imdb.com/title/${request.imdb_id}`,
            target : "_blank"
        }, "IMDb"));
    }
    else if (request.id)
    {
        imdb = buildNode("div", { id : "mediaLink" });
        imdb.appendChild(buildNode("a", {
            href : `https://www.themoviedb.org/${attr("requestTypeStr")}/${request.id}`,
            target : "_blank"
        }, "TMDb"));
    }

    return imdb;
}

/// <summary>
/// Build and display all the request details
/// </summary>
function buildPage(data)
{
    let container = $("#infoContainer");
    container.innerHTML = "";

    let backdrop;
    if (data.backdrop_path)
    {
        backdrop = buildNode("img", {
            src : `https://image.tmdb.org/t/p/original${data.backdrop_path}`,
            id : "mediaBackdrop"
        });
    }

    let innerContainer = buildNode("div", { id : "innerInfoContainer" });

    let poster = buildRequestPoster(data);
    let details = buildNode("div", { id : "mediaDetails" });

    let title = buildNode("div", { id : "mediaTitle" });
    let status = attrInt("requestStatus");

    title.innerHTML = (data.title || data.name) + " - ";
    title.appendChild(getStatusSpan(status));

    let release = data.release_date || data.first_air_date;
    let year = buildNode("div", { id : "mediaYear" }, release.length > 4 ? release.substring(0, 4) : "Unknown Release Date");

    let imdb = buildRequestExternalLink(data);

    let desc = buildNode("div", { id : "mediaOverview" }, data.overview);

    details.appendChildren(title, year, imdb ? imdb : 0, buildNode("hr"), desc);

    innerContainer.appendChildren(poster, details);

    if (backdrop)
    {
        container.appendChild(backdrop);
    }

    container.appendChild(innerContainer);
}

/// <summary>
/// Process admin input to change the status of a request
/// </summary>
function getNewStatusType(input)
{
    if (!input)
    {
        // Either escape or no input. Don't do anything
        return -1;
    }

    let status = -1;
    let first = input.toLowerCase()[0];
    switch (first)
    {
        case "a":
        case "1":
            status = 1;
            break;
        case "d":
        case "0":
            status = 2;
            break;
        case "p":
            status = 0;
            break;
        case "i":
            status = 3;
            break;
        case "w":
            status = 4;
            break;
        default:
            alert("Invalid status: Must be '(A)pproved' (1), '(D)enied' (0), '(P)ending', '(I)n Progress', or '(W)aiting'");
            break;
    }

    return status;
}

/// <summary>
/// Prompt the administrator for the new request status when double-clicking the current status
/// </summary>
function onStatusDoubleClick()
{
    let status = getNewStatusType(prompt("Data ((A)pproved (1), (D)enied (0), (P)ending, (I)n Progress, or (W)aiting):"));
    if (status == -1)
    {
        return;
    }

    let params = {
        type : "req_update",
        data : [{ id : reqId(), kind : "status", content : status }]
    };

    let successFunc = function()
    {
        let span = $(".statusSpan")[0];
        if (span)
        {
            span.className = "statusSpan status" + status;
            span.innerHTML = ["Pending", "Approved", "Denied", "In Progress", "Waiting"][status];
        }
    };

    let failureFunc = function()
    {
        alert("Failed to update. See console for details");
    };

    sendHtmlJsonRequest("update_request.php", JSON.stringify(params), successFunc, failureFunc, null, true /*dataIsString*/);
}

/// <summary>
/// Setup double-click listener on the request status for admins
/// </summary>
function setupSpanDoubleClick(statusSpan)
{
    statusSpan.className += " statusSpan";
    statusSpan.addEventListener("dblclick", onStatusDoubleClick);
}

/// <summary>
/// Ask the server for the comments associated with this request
/// </summary>
function getComments()
{
    let params = { type : ProcessRequest.GetComments, req_id : reqId() };
    let successFunc = function(response)
    {
        logInfo(response);
        buildComments(response);
    };
    let failureFunc = function(response)
    {
        $("#comments").innerHTML = response.Error;
    };
    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
}

/// <summary>
/// If the user doesn't have notifications enabled, ask them if they want
/// to get updates. Popups are annoying though, so add a persistent "Don't
/// show this again" option.
/// </summary>
function checkForNotifications()
{
    if (attrInt("newrequest") != 1)
    {
        return;
    }

    let parameters = { type : ProcessRequest.CheckNotificationAlert };
    let successFunc = function(response)
    {
        if (response.should_check)
        {
            promptForNotifications();
        }
    };

    sendHtmlJsonRequest("process_request.php", parameters, successFunc);
}

/// <summary>
/// Returns 'Yes' and 'No' buttons for the 'enable notifications' overlay
/// </summary>
function getYesNoOverlayButtons()
{
    let yesButton = buildNode(
        "input",
        {
            type : "button",
            value : "Yes",
            style : "width: 100px; margin-right: 10px; display: inline"
        },
        0,
        {
            click : function()
            {
                checkDontAskAgain(true /*redirect*/);
            }
        });

    let noButton = buildNode(
        "input",
        {
            type : "button",
            value : "No",
            style : "width: 100px; margin-right: 10px; display: inline"
        },
        0,
        {
            click : function()
            {
                checkDontAskAgain(false /*redirect*/);
            }
        });

    return { yes : yesButton, no : noButton };
}

/// <summary>
/// Prompts the user to enable notifications
/// </summary>
function promptForNotifications()
{
    let title = buildNode("h4", {}, "Enable Notifications");
    let prompt = buildNode("div", {}, "Thanks for your request! Do you want to get notifications when the status of your requests are changed?");
    let checkHolder = buildNode("div", { class : "formInput" });
    let check = buildNode("input",
        {
            type : "checkbox",
            name : "noalerts",
            id : "noalerts",
            style : "float: none; display: inline-block; margin-right: 10px;"
        });

    let checkLabel = buildNode(
        "label",
        {
            for : "noalerts",
            id : "noalertsLabel",
            style : "float: none"
        },
        "Don't ask again");

    checkHolder.appendChildren(check, checkLabel);

    let buttons = getYesNoOverlayButtons();
    let outerButtonContainer = buildNode("div", { class : "formInput", style : "text-align: center" });
    let buttonContainer = buildNode("div", { style : "float: right; overflow: auto; width: 100%; margin: auto" });
    outerButtonContainer.appendChildren(buttonContainer.appendChildren(buttons.yes, buttons.no));

    buildOverlay(true, title, prompt, checkHolder, outerButtonContainer);
}

/// <summary>
/// Checks whether the user has asked to not see the notification prompt again
/// Will redirect to user_settings if 'redirect' is true, otherwise dismisses the overlay
/// </summary>
function checkDontAskAgain(redirect)
{
    if (!$("#noalerts").checked)
    {
        if (redirect)
        {
            window.location = "user_settings.php?fornotify=1";
        }
        else
        {
            overlayDismiss();
        }

        return;
    }

    let parameters = { type : ProcessRequest.DisableNotificationAlert };
    let attached = { redirectToSettings : redirect };
    let responseFunc = function(response, request)
    {
        if (request.redirectToSettings)
        {
            window.location = "user_settings.php?fornotify=1";
        }
        else
        {
            overlayDismiss();
        }
    };

    sendHtmlJsonRequest("process_request.php", parameters, responseFunc, responseFunc, attached);
}

/// <summary>
/// Takes the given CSS file and inlines styles into the given text
/// </summary>
function inlineCSS(css, text)
{
    let cssElements = parseCss(css);

    for (let selector in cssElements)
    {
        if (!Object.prototype.hasOwnProperty.call(cssElements, selector))
        {
            continue;
        }

        let eleStyle = cssElements[selector];

        if (selector.startsWith("."))
        {
            // We have a class. Make the generally unsafe assumption
            // that classes are standalone from anything else
            text = text.replace(new RegExp(`class="${selector.substring(1)}`, "g"), `style="${eleStyle}" class="${selector.substring(1)}`);
        }
        else if (selector.indexOf(":") > -1)
        {
            // Pseudo element. Do nothing for now
        }
        else
        {
            // Some elements have additional properties
            if (selector == "a")
            {
                text = text.replace(/<a href/g, '<a style="' + eleStyle + '" href');
            }
            else if (selector == "img")
            {
                text = text.replace(/<img src/g, '<img style="' + eleStyle + '" src');
            }
            else
            {
                text = text.replace(new RegExp(`<${selector}>`, "g"), `<${selector} style="${eleStyle}">`);
            }
        }

    }

    return `<div style="${cssElements.base}">${text}</div>`;
}

/// <summary>
/// Adds a style definition to an element in our style dictionary
/// </summary>
function addStyle(ele, eleStyle, style)
{
    if (!style[ele])
    {
        style[ele] = "";
    }

    logVerbose(`Adding style for ${ele}: ${eleStyle}`);
    style[ele] += eleStyle;
}

/// <summary>
/// Returns a dictionary mapping selectors to styles
/// for the given css.
/// </summary>
function parseCss(css)
{
    let style = {};

    // Many shortcuts are taken based on what we expect the CSS structure to be.
    // This is by no means a generalized CSS parser

    // Assume the first element is the base .md element
    if (!css.startsWith(".md {"))
    {
        log("Unexpected start to Markdown CSS. Email notifications will be styled incorrectly.", 0, 0, LOG.Critical);
        return style;
    }

    let start = css.match(/^\.md \{([^}]*)\}/m)[1];
    style.base = start.trim().replace(/\n */g, " ");

    let regex = /\n\.md ([^{]+) ?\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(css)) !== null)
    {
        let elements = match[1];
        let eleStyle = match[2].trim().replace(/\n */g, " ");
        if (elements.indexOf(" .md ") == -1)
        {
            addStyle(elements.trim(), eleStyle, style);
        }
        else
        {
            elements = elements.split(", .md");
            for (let ele in elements)
            {
                if (!Object.prototype.hasOwnProperty.call(elements, ele))
                {
                    continue;
                }

                addStyle(elements[ele].trim(), eleStyle, style);
            }
        }
    }

    return style;
}

/// <summary>
/// For markdown content, we do a lot of extra work to style the text correctly.
/// For the best results, it's probably better to inline all the relevant CSS for
/// each individual element. However, that has its own challenges, namely creating
/// simplified CSS and HTML parsers to correctly inject everything. A prototype version
/// is implemented, but is currently unused. Gmail and Outlook are correctly handling
/// style sheets embedded directly in the email, and that's good enough for me for now.
/// </summary>
async function inlineCssIfNeeded(initialText)
{
    const preParse = false;
    let mdText = mdPreview.parse(initialText);
    if (!preParse)
    {
        return mdText;
    }

    let css = await fetch("style/markdown.css").then(response => response.text().then(text => text));
    return inlineCSS(css, mdText);

}

/// <summary>
/// Add a comment to the review
/// </summary>
async function addComment()
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

    let params = { type : ProcessRequest.AddComment, req_id : reqId(), content : text };

    if (mdPreview.markdownPresent)
    {
        params.md = await inlineCssIfNeeded(text);
    }

    let successFunc = function()
    {
        $("#mdHolder").style.display = "none";
        getComments();
    };

    let failureFunc = function(response, request)
    {
        let element = $("#newComment");
        element.value = request.textSav;
        Animation.fireNow({ backgroundColor : new Color(100, 66, 69) }, element, 500);
        Animation.queueDelayed({ backgroundColor : new Color(63, 66, 69) }, element, 1000, 500);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc, { textSav : text });
}

/// <summary>
/// Contains a map of comment ids to the raw markdown text for the comment
/// Used for editing comments so we don't have to ping the server again to initiate an edit
/// </summary>
let commentCache = {};

/// <summary>
/// Build current comments and associated buttons/controls
/// </summary>
function buildComments(comments)
{
    commentCache = {};
    let container = $("#comments");
    container.innerHTML = "";

    for (let i = 0; i < comments.length; ++i)
    {
        let comment = comments[i];
        let holder = buildNode("div", { id : "holder" + comment.id, class : "commentHolder" });
        let info = buildNode("div", { class : "commentInfo" });
        let name = buildNode("span", { class : "commentAuthor" }, comment.user);

        let dateObj = new Date(comment.time);
        let editTitle = "";
        if (comment.last_edit)
        {
            editTitle = "<br>Edited " + DateUtil.getFullDate(comment.last_edit);
        }

        let date = buildNode("span", {}, DateUtil.getDisplayDate(dateObj) + (editTitle ? "*" : ""));
        setTooltip(date, DateUtil.getFullDate(dateObj) + editTitle);

        commentCache[comment.id] = comment.content;

        // Try the new markdown parser
        let fixedupContent = new Markdown().parse(comment.content);

        let content = buildNode("div", { class : "commentContent md" }, fixedupContent);

        info.appendChildren(name, date);

        holder.appendChildren(info, content);

        if (parseInt(comment.editable) == 1)
        {
            let editTools = buildNode("div", { class : "commentEdit", commentId : comment.id });
            holder.appendChild(editTools.appendChildren(
                commentAction("Edit", editComment),
                commentAction("Delete", confirmDeleteComment)
            ));
        }

        container.appendChild(holder);
    }
}

/// <summary>
/// Launches the comment edit UI.
/// </summary>
function editComment()
{
    let commentId = this.parentNode.getAttribute("commentId");
    if ($(`#editor${commentId}`))
    {
        // We're already editing
        return;
    }

    let raw = commentCache[commentId];
    if (!raw)
    {
        overlay("Something went wrong. Please try again later.", "OK", overlayDismiss);
    }

    let holder = $(`#holder${commentId}`);

    let buttonHolder = buildNode("div", { style : "float: left; padding: 3px" });
    let okay = commentAction("Save", submitCommentEdit);
    let cancel = commentAction("Cancel", function() { dismissEdit(this.getAttribute("commentId")); });
    okay.setAttribute("commentId", commentId);
    cancel.setAttribute("commentId", commentId);
    buttonHolder.appendChildren(okay, cancel);
    holder.insertBefore(buildNode(
        "hr",
        {
            style : "clear: both; margin: 0; height: 5px; border: none; border-bottom: 1px solid #616161"
        }), holder.children[1]);
    holder.insertBefore(buttonHolder, holder.children[1]);

    let editor = buildNode(
        "textarea",
        { id : "editor" + commentId, class : "commentEditor", placeholder : "Edit comment..." },
        raw,
        {
            change : parseEditMarkdown,
            keyup : parseEditMarkdown
        });

    MarkdownEditor.addTabHandler(editor);
    MarkdownEditor.addFormatHandler(editor);
    holder.insertBefore(editor, holder.children[1]);

    editor.style.height = Math.min((editor.scrollHeight + 20), 350) + "px";
    editor.focus();
}

// Cached markdown object for editing comments
let mdEdit = new Markdown();

// ID of the last comment we parsed
let editCur = "";

/// <summary>
/// Parses edited comment content and updates the
/// preview accordingly
/// </summary>
function parseEditMarkdown()
{
    let sameEdit = true;
    if (this.id != editCur)
    {
        editCur = this.id;
        sameEdit = false;
    }

    let html = mdEdit.parse(this.value);
    if (!sameEdit || !mdEdit.sameText)
    {
        this.parentNode.$$(".commentContent").innerHTML = html;
    }
}

/// <summary>
/// Dismiss the comment edit controls and replaces the comment content
/// with our latest cached value.
/// </summary>
function dismissEdit(id)
{
    let parent = $(`#holder${id}`);
    parent.removeChild(parent.children[1]); // textarea
    parent.removeChild(parent.children[1]); // Buttons
    parent.removeChild(parent.children[1]); // hr
    parent.$$(".commentContent").innerHTML = new Markdown().parse(commentCache[id]);
}

/// <summary>
/// Submit the edited comment, as long as it's different than our cached value
/// </summary>
function submitCommentEdit()
{
    let commentId = this.getAttribute("commentId");
    let content = $(`#editor${commentId}`).value;
    if (content == commentCache[commentId])
    {
        dismissEdit(commentId);
        return;
    }

    let params = { type : ProcessRequest.EditComment, id : commentId, content : content };
    let successFunc = function(response, request)
    {
        commentCache[request.commentId] = $(`#editor${request.commentId}`).value;
        dismissEdit(request.commentId);
    };

    let failureFunc = function(response, request)
    {
        overlay(response.Error, "OK", overlayDismiss);
        dismissEdit(request.commentId);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc, { commentId : commentId });
}

/// <summary>
/// Ask the user if they're sure they want to delete their comment before actually doing it
/// </summary>
function confirmDeleteComment(e)
{
    // Make sure we're not already in a confirm situation
    if (e.target.classList.contains("deleteConfirm") || e.target.classList.contains("deleteCancel"))
    {
        return;
    }

    const commentId = this.parentNode.getAttribute("commentId");
    this.removeChild(this.childNodes[this.childNodes.length - 1]);

    let confirmHolder = buildNode("span");
    let confirm = buildNode("span", {}, "Are you sure? ");
    let confirmYes = buildNode("span",
        { id : "confirmDelete" + commentId, class : "deleteConfirm", commentId : commentId },
        "Yes",
        { click : deleteComment });

    let confirmMiddle = buildNode("span",{},"&nbsp;/&nbsp;");
    let confirmCancel = buildNode("span", { class : "deleteCancel", commentId : commentId }, "Cancel", { click : cancelDelete });

    confirmHolder.appendChildren(confirm, confirmYes, confirmMiddle, confirmCancel);
    this.appendChild(confirmHolder);
}

/// <summary>
/// The user canceled the delete operation, remove the 'Are you sure' text
/// </summary>
function cancelDelete()
{
    let grandparent = this.parentNode.parentNode;
    grandparent.removeChild(grandparent.children[grandparent.children.length - 1]);
    grandparent.appendChild(buildNode("span", {}, "Delete"));
}

/// <summary>
/// Deletes the specified comment from the request after the
/// user has confirmed that they do in fact want to delete the comment
/// </summary>
function deleteComment()
{
    const commentId = this.getAttribute("commentId");
    logVerbose("Deleting comment " + commentId);

    let params = { type : ProcessRequest.DeleteComment, comment_id : commentId };
    let successFunc = function(response, request)
    {
        let ele = $(`#confirmDelete${request.commentId}`);
        Animation.queue({ color : new Color(63, 100, 69) }, ele, 250);
        Animation.queueDelayed({ color : new Color(63, 66, 69) }, ele, 500, 250);
        setTimeout(getComments, 1250);
    };

    let failureFunc = function(response)
    {
        overlay(response.Error, "Okay", overlayDismiss, true /*dismissible*/);
    };

    sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc, { commentId : commentId });
}

/// <summary>
/// Returns a comment action "button" with the icon an text based on the given
/// action string, executing the given function callback when clicked
/// </summary>
function commentAction(action, fn)
{
    let holder = buildNode("div", { class : "commentAction" }, 0, { click : fn });
    let actionString = action + " Comment";

    // Thanks to css.gg for the 'pen' and 'trash' svg icons
    let img = buildNode("img", { src : icons[action.toUpperCase()], title : actionString, alt : actionString });
    let text = buildNode("span", {}, action);
    return holder.appendChildren(img, text);
}
