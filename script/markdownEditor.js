/* exported MarkdownEditor */

/* eslint-disable max-lines-per-function */

let MarkdownEditor = new function()
{
    /// <summary>
    /// Captures tab keypresses and convert them into text insertion. This will break general tab navigation,
    /// but with a markdown editor it's much more likely that the user wants to indent and not move focus to
    /// the next element on the page.
    /// </summary>
    let captureTab = function(event)
    {
        // It will probably just cause more confusion for people, but we can break out of the textarea if caps lock is on.
        if (event.keyCode != KEY.TAB || event.ctrlKey || event.altKey || event.getModifierState("CapsLock"))
        {
            return;
        }

        event.preventDefault();
        let comment = this;
        let start = comment.selectionStart;
        let startSav = start;
        let currentSelection = comment.value.substring(start, comment.selectionEnd);
        let hasSelection = currentSelection.length != 0;
        let lineStart = comment.value.lastIndexOf("\n", start - 1) + 1;

        if (!hasSelection && !event.shiftKey)
        {
            // In the case of no selection and a regular tab, indent from the cursor position
            let add = 4 - ((start - lineStart) % 4);
            if (document.queryCommandSupported("insertText"))
            {
                document.execCommand("insertText", false, " ".repeat(add));
            }
            else
            {
                comment.value = comment.value.substring(0, start) + " ".repeat(add) + comment.value.substring(comment.selectionEnd);
            }

            comment.selectionStart = start + add;
            comment.selectionEnd = start + add;
            return;
        }

        let prefixedSpaces = 0;
        for (let i = lineStart; i < comment.selectionEnd; ++i, ++prefixedSpaces)
        {
            if (comment.value[i] != " ")
            {
                break;
            }
        }

        // Always select full lines just to make things easier. Ideally if we aren't selecting
        // multiple lines and are not at the beginning of the line (or at least at the first
        // non-whitespace character), we should do a replacement of the current selection instead
        if (start != lineStart)
        {
            currentSelection = comment.value.substring(lineStart, start) + currentSelection;
            start = lineStart;
            comment.selectionStart = start;
        }

        let spaces = "    ";
        if (prefixedSpaces % 4 != 0)
        {
            spaces = " ".repeat(event.shiftKey ? prefixedSpaces % 4 : 4 - (prefixedSpaces % 4));
        }

        let newText;
        if (event.shiftKey)
        {
            newText = currentSelection.replace(spaces, "").replace(new RegExp(`\n {0,${spaces.length}}`, "g"), "\n");
        }
        else
        {
            newText = spaces + currentSelection.replace(/\n/g, "\n" + spaces);
        }

        // We get undo support with insertText. If it's not available, we can still
        // insert the spaces, but undo will break.
        if (document.queryCommandSupported("insertText"))
        {
            document.execCommand("insertText", false, newText);
        }
        else
        {
            comment.value = comment.value.substring(0, start) + newText + comment.value.substring(comment.selectionEnd);
        }

        let spaceLen = event.shiftKey ? -spaces.length : spaces.length;
        comment.selectionStart = hasSelection ? start : startSav + spaceLen;
        comment.selectionEnd = hasSelection ? start + newText.length : comment.selectionStart;
    };

    /// <summary>
    /// Listens for keyboard shortcuts that insert markdown formatting
    /// </summary>
    let formatHandler = function(e)
    {
        if (!e.ctrlKey || e.altKey)
        {
            return;
        }

        if (e.shiftKey)
        {
            switch (e.keyCode)
            {
                case KEY.SIX:
                    addMarkdownFormat(this, "^(", ")");
                    break;
                case KEY.BACKTICK:
                    addMarkdownFormat(this, "~(", ")");
                    break;
                default:
                    return;
            }
        }

        switch (e.keyCode)
        {
            case KEY.B:
                addMarkdownFormat(this, "**");
                break;
            case KEY.U:
                addMarkdownFormat(this, "++");
                break;
            case KEY.S:
                addMarkdownFormat(this, "~~");
                break;
            case KEY.I:
                addMarkdownFormat(this, "_");
                break;
            case KEY.K:
                addLinkOrPhoto(this, false /*isPhoto*/);
                break;
            case KEY.M:
                addLinkOrPhoto(this, true /*isPhoto*/);
                break;
            case KEY.L:
                addTable(this);
                break;
            default:
                return;
        }

        e.preventDefault();
    };

    /// <summary>
    /// Surrounds the currently highlighted text with the specific pattern. If nothing is highlighted,
    /// add a placeholder value and highlight that.
    /// </summary>
    let addMarkdownFormat = function(comment, chStart, chEnd)
    {
        if (!chEnd)
        {
            chEnd = chStart;
        }

        let start = comment.selectionStart;
        let end = comment.selectionEnd;
        comment.focus();
        let surround = (start == end) ? "Text" : comment.value.substring(comment.selectionStart, comment.selectionEnd);

        if (document.queryCommandSupported("insertText"))
        {
            // This is deprecated, but it's the only way I've found to do it that supports undo.
            document.execCommand("insertText", false, chStart + surround + chEnd);
        }
        else
        {
            let newText = chStart + surround + chEnd;
            comment.setRangeText(newText);
        }

        comment.setSelectionRange(start + chStart.length, start + surround.length + chStart.length);
    };

    /// <summary>
    /// Adds the tab handler to the given text input
    /// </summary>
    this.addTabHandler = function(element)
    {
        element.addEventListener("keydown", captureTab);
    };

    /// <summary>
    /// Adds a format handler to the given text input
    /// </summary>
    this.addFormatHandler = function(element)
    {
        element.addEventListener("keydown", formatHandler);
    };

    /// <summary>
    /// Adds the given formatting to the given textarea element
    /// </summary>
    this.addFormat = function(element, chStart, chEnd)
    {
        addMarkdownFormat(element, chStart, chEnd);
    };

    /// <summary>
    /// Returns a markdown editor toolbar associated with the given textarea
    /// </summary>
    this.getToolbar = function(textarea)
    {
        return buildNode("div", { class : "mdToolbar", targetTextarea : textarea.id }).appendChildren(
            toolbarButton("addBold", "B", "Bold (Ctrl +B)"),
            toolbarButton("addUnderline", "U", "Underline (Ctrl + U)"),
            toolbarButton("addItalic", "I", "Italic (Ctrl + I)"),
            toolbarButton("addStrikethrough", "S", "Strikethrough (Ctrl + S)"),
            toolbarButton("addSuperscript", "X<sup>2</sup>", "Superscript (Ctrl + Shift + ^)", true /*realButton*/),
            toolbarButton("addSubscript", "X<sub>2</sub>", "Subscript (Ctrl + Shift + ~)", true /*realButton*/),
            toolbarButton("addLink", `<img src="${Icons.get("mdlink")}" alt="Insert Link" />`, "Insert Link (Ctrl + K)", true /*realButton*/),
            toolbarButton("addImage", `<img src="${Icons.get("mdimage")}" alt="Insert Image" />`, "Insert Image (Ctrl + M)", true /*realButton*/),
            toolbarButton("addTable", `<img src="${Icons.get("mdtable")}" alt="Insert Table" />`, "Insert Table (Ctrl + L)", true /*realButton*/),
            toolbarButton("showMdHelp", "?", "Help"),
        );
    };

    /// <summary>
    /// Creates and returns a button for the markdown toolbar
    /// </summary>
    /// <param name="realButton">True if we want a <button>, not an <input type="button">
    let toolbarButton = function(cssClass, value, title, realButton)
    {
        if (realButton)
        {
            return buildNode(
                "button",
                { class : "mdButton " + cssClass, title : title, mdAction : cssClass },
                value,
                { click : mdToolbarDispatch }
            );
        }

        return buildNode(
            "input",
            { type : "button", class : "mdButton " + cssClass, value : value, title : title, mdAction : cssClass },
            0,
            { click : mdToolbarDispatch }
        );
    };

    /// <summary>
    /// Handles toolbar button clicks, dispatching each button click to the correct function
    /// </summary>
    let mdToolbarDispatch = function()
    {
        let target = $("#" + this.parentNode.getAttribute("targetTextarea"));

        switch (this.getAttribute("mdAction"))
        {
            case "addBold":
                MarkdownEditor.addFormat(target, "**");
                break;
            case "addUnderline":
                MarkdownEditor.addFormat(target, "++");
                break;
            case "addItalic":
                MarkdownEditor.addFormat(target, "_");
                break;
            case "addStrikethrough":
                MarkdownEditor.addFormat(target, "~~");
                break;
            case "addSuperscript":
                MarkdownEditor.addFormat(target, "^(", ")");
                break;
            case "addSubscript":
                MarkdownEditor.addFormat(target, "~(", ")");
                break;
            case "addLink":
                addLinkOrPhoto(target, false /*isPhoto*/);
                return;
            case "addImage":
                addLinkOrPhoto(target, true /*isPhoto*/);
                return;
            case "addTable":
                addTable(target);
                return;
            case "showMdHelp":
                MarkdownHelp.getHelp(function(response)
                {
                    overlay('<div class="mdHelp">' + response.data + "</div>", "Got It", overlayDismiss, true /*dismissible*/);
                });
                return;
            default:
                logWarn(this, "Unknown toolbar button");
                return;
        }

        target.dispatchEvent(new Event("change"));
    };

    /// <summary>
    /// Launches a dialog to insert an image or link into a comment
    /// </summary>
    let addLinkOrPhoto = function(comment, isPhoto)
    {
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

        container.appendChild(getOkCancelButtons("addLinkOk", insertLinkInComment, comment, { isPhoto : isPhoto ? 1 : 0 }));

        buildOverlay(true, container);
        $("#addLinkLink").focus();
    };

    /// <summary>
    /// Keyup handler for comment insert dialogs to commit on 'enter'
    /// </summary>
    let mdInsertKeyupHandler = function(e)
    {
        if (e.keyCode == KEY.ENTER && !e.ctrlKey && !e.shiftKey && !e.altKey)
        {
            e.stopPropagation();
            $("#addLinkOk").click();
        }
    };

    /// <summary>
    /// Return element containing image width/height inputs
    /// </summary>
    let buildMarkdownImageDimensionsInput = function()
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
    };

    /// <summary>
    /// Return an element containing Ok and Cancel buttons for a markdown insert dialog
    /// </summary>
    let getOkCancelButtons = function(id, okFunc, comment, okExtra)
    {
        let okayButton = buildNode(
            "input",
            {
                type : "button",
                id : id,
                value : "Insert",
                style : "width: 100px; margin-right: 10px; display: inline",
                targetTextarea : comment.id
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
    };

    /// <summary>
    /// Insert a markdown hyperlink or image from dialog input
    /// </summary>
    let insertLinkInComment = function()
    {
        let comment = $("#" + this.getAttribute("targetTextarea"));
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
        comment.dispatchEvent(new Event("change"));
    };

    /// <summary>
    /// Parses input from the insert image dialog and returns the corresponding markdown string
    /// </summary>
    let processPhotoDimensions = function(link, text)
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
    };

    /// <summary>
    /// Initiate the insert table dialog
    /// </summary>
    let addTable = function(comment)
    {
        let container = buildNode("div", { id : "mdInsertOverlay" });
        let header = buildNode("h2", {}, "Insert Table");
        let resizeButtons = getBuildTableButtons();
        let table = defaultInsertTable();
        buildOverlay(true, container.appendChildren(header, resizeButtons, table, getOkCancelButtons("mdtInsert", insertMdTable, comment)));
        table.$$("thead textarea").focus();

        // Force area calculation to get row widths in alignment
        setMdtWidthHeight(0, 0);
        setMdtWidthHeight(0, 1);
    };


    /// <summary>
    /// Returns an initial 2x3 table to show when inserting a table in the UI
    /// </summary>
    let defaultInsertTable = function()
    {
        let holder = buildNode("div", { id : "mdtHolder" });
        let table = buildNode("table", { id : "mdt" });
        let head = buildNode("thead");
        head.appendChild(newTableRow(2, "Column"));

        let body = buildNode("tbody");
        body.appendChildren(newTableRow(2, "Foo"), newTableRow(2, "Bar"));

        holder.appendChild(table.appendChildren(head, body));
        return holder;
    };


    /// <summary>
    /// Returns a new table row (tr) with the given number of cells
    /// </summary>
    /// <params name="defaultText">
    /// The initial value for the row. Will be combined with the cell number to make a unique value
    /// </param>
    let newTableRow = function(cells, defaultText)
    {
        let row = buildNode("tr");
        for (let i = 0; i < cells; ++i)
        {
            row.appendChild(newTableCell(defaultText, i + 1));
        }

        return row;
    };

    /// <summary>
    /// Creates a new table cell for inserting a table, including adding all necessary event listeners
    /// </summary>
    let newTableCell = function(defaultText, cell)
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
    };

    /// <summary>
    /// Return a container of buttons to control the number of rows and columns in the table
    /// </summary>
    let getBuildTableButtons = function()
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
    };


    /// <summary>
    /// Keydown key listener for markdown table textareas
    ///
    /// Commits the table on Ctrl+Enter
    /// Navigates to the beginning/end of a row or top/bottom of a column on Left/Right/Up/Down
    /// </summary>
    let handleMdTableTextareaKey = function(e)
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
    };

    /// <summary>
    /// Helper function to determine the row of the given cell
    /// </summary>
    /// <remarks>
    /// Could we add row/col properties to the textareas  directly to avoid
    /// this potentially costly iteration?
    /// </remarks>
    let mdtRow = function(cell)
    {
        // textarea -> td -> tr -> t(body|head)
        if (cell.parentNode.parentNode.parentNode.tagName.toLowerCase() == "thead")
        {
            return 0;
        }

        return _childIndex(cell.parentNode.parentNode) + 1;
    };

    /// <summary>
    /// Helper function to determine the column of the given cell
    /// </summary>
    let mdtCol = function(cell)
    {
        return _childIndex(cell.parentNode);
    };

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
    let setMdtWidthHeight = function(iRow, iCol)
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
    };

    /// <summary>
    /// Moves focus to the cell at the given row and column
    /// </summary>
    /// <param name="toTop">If true, sets the cursor to the beginning of the text, otherwise the end</param>
    let selectMdTableTextarea = function(iRow, iCol, toTop)
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
    };

    /// <summary>
    /// Returns the index of the given element within its parent's child list
    /// </summary>
    let _childIndex = function(element)
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
    };

    /// <summary>
    /// Adds a row to the table in the insert table dialog
    /// </summary>
    let addMdTableRow = function()
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
    };

    /// <summary>
    /// Removes a row to the table in the insert table dialog (as long as there is at least one row left)
    /// </summary>
    let removeMdTableRow = function()
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
    };

    /// <summary>
    /// Adds a column to the table in the insert table dialog
    /// </summary>
    let addMdTableColumn = function()
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
    };

    /// <summary>
    /// Removes a column to the table in the insert table dialog
    /// </summary>
    let removeMdTableColumn = function()
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
    };

    /// <summary>
    /// Parse the dialog table and insert the markdown equivalent into the comment box
    /// </summary>
    let insertMdTable = function()
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

        let comment = $("#" + this.getAttribute("targetTextarea"));
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
        comment.dispatchEvent(new Event("change"));
    };

    /// <summary>
    /// Cleans up and returns a table cell's contents to ensure it doesn't escape its bounds
    /// </summary>
    const fixupTableCell = function(text)
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
    };

    // See Markdown::_inlineEnd
    let _inlineEnd = function(index, text)
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
    };
}();
