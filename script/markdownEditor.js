/* exported MarkdownEditor */

/* eslint-disable max-lines-per-function */

// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */
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
        if (event.keyCode != KEY.TAB || event.ctrlKey || event.altKey || event.getModifierState('CapsLock'))
        {
            return;
        }

        event.preventDefault();
        let comment = this;
        let start = comment.selectionStart;
        let startSav = start;
        let currentSelection = comment.value.substring(start, comment.selectionEnd);
        let hasSelection = currentSelection.length != 0;
        let lineStart = comment.value.lastIndexOf('\n', start - 1) + 1;

        if (!hasSelection && !event.shiftKey)
        {
            // In the case of no selection and a regular tab, indent from the cursor position
            let add = 4 - ((start - lineStart) % 4);
            if (document.queryCommandSupported('insertText'))
            {
                document.execCommand('insertText', false, ' '.repeat(add));
            }
            else
            {
                comment.value = comment.value.substring(0, start) + ' '.repeat(add) + comment.value.substring(comment.selectionEnd);
            }

            comment.selectionStart = start + add;
            comment.selectionEnd = start + add;
            return;
        }

        let prefixedSpaces = 0;
        for (let i = lineStart; i < comment.selectionEnd; ++i, ++prefixedSpaces)
        {
            if (comment.value[i] != ' ')
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

        let spaces = '    ';
        if (prefixedSpaces % 4 != 0)
        {
            spaces = ' '.repeat(event.shiftKey ? prefixedSpaces % 4 : 4 - (prefixedSpaces % 4));
        }

        let newText;
        if (event.shiftKey)
        {
            newText = currentSelection.replace(spaces, '').replace(new RegExp(`\n {0,${spaces.length}}`, 'g'), '\n');
        }
        else
        {
            newText = spaces + currentSelection.replace(/\n/g, '\n' + spaces);
        }

        // We get undo support with insertText. If it's not available, we can still
        // insert the spaces, but undo will break.
        if (document.queryCommandSupported('insertText'))
        {
            document.execCommand('insertText', false, newText);
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
        if (!e.ctrlKey || e.altKey || e.shiftKey)
        {
            return;
        }

        switch (e.keyCode)
        {
            case KEY.B:
                addMarkdownFormat('**', this);
                break;
            case KEY.U:
                addMarkdownFormat('++', this);
                break;
            case KEY.S:
                addMarkdownFormat('~~', this);
                break;
            case KEY.I:
                addMarkdownFormat('_', this);
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
    let addMarkdownFormat = function(ch, comment)
    {
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

        comment.setSelectionRange(start + ch.length, start + surround.length + ch.length);
    };

    /// <summary>
    /// Adds the tab handler to the given text input
    /// </summary>
    this.addTabHandler = function(element)
    {
        element.addEventListener('keydown', captureTab);
    };

    /// <summary>
    /// Adds a format handler to the given text input
    /// </summary>
    this.addFormatHandler = function(element)
    {
        element.addEventListener('keydown', formatHandler);
    };

    /// <summary>
    /// Adds the given formatting to the given textarea element
    /// </summary>
    this.addFormat = (element, ch) => addMarkdownFormat(ch, element);
}();
