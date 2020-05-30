
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
        if (event.keyCode != 9 /*tab*/ || event.ctrlKey || event.altKey || event.getModifierState('CapsLock'))
        {
            return;
        }

        let comment = this;
        let start = comment.selectionStart;
        let startSav = start;
        let currentSelection = comment.value.substring(start, comment.selectionEnd);
        let hasSelection = currentSelection.length != 0;
        let lastNewline = comment.value.lastIndexOf('\n', start - 1);

        let prefixedSpaces = 0;
        for (let i = lastNewline + 1; i < comment.selectionEnd; ++i, ++prefixedSpaces)
        {
            if (comment.value[i] != ' ')
            {
                break;
            }
        }

        // Always select full lines just to make things easier. Ideally if we aren't selecting
        // multiple lines and are not at the beginning of the line (or at least at the first
        // non-whitespace character), we should do a replacement of the current selection instead
        if (start != lastNewline + 1)
        {
            currentSelection = comment.value.substring(lastNewline + 1, start) + currentSelection;
            start = lastNewline + 1;
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

        // insertText gives us undo support. If it's not available, we can still
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
        event.preventDefault();
    };

    this.addTabHandler = function(element)
    {
        element.addEventListener('keydown', captureTab);
    };
}();