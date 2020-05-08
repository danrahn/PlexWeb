/*
Converts markdown to HTML. The goal is to create this without looking at any examples
online. That means that this will probably be hot garbage, but hopefully will work in
basic scenarios.
*/

const State =
{
    None : 0,
    Div : 1,
    LineBreak : 2,
    Hr : 3,
    OrderedList : 4,
    UnorderedList : 5,
    ListItem : 6,
    Header : 7,
    CodeBlock : 8,
    BlockQuote : 9,
    Url : 10,
    Image : 11,
    InlineCode : 12,
    Bold : 13,
    Underline : 14,
    Italic : 15,
    Strikethrough : 16,
    HtmlComment : 17
}

const stateError = (state) => console.error('Unknown state: ' + state);

const stateToStr = function(state)
{
    switch (state)
    {
        case State.None:
            return 'None';
        case State.LineBreak:
            return 'LineBreak';
        case State.Div:
            return 'Div';
        case State.Header:
            return 'Header';
        case State.Url:
            return 'Url';
        case State.Image:
            return 'Image';
        case State.InlineCode:
            return 'InlineCode';
        case State.BlockQuote:
            return 'BlockQuote';
        case State.Bold:
            return 'Bold';
        case State.Underline:
            return 'Underline';
        case State.Italic:
            return 'Italic';
        case State.Strikethrough:
            return 'Strikethrough';
        case State.Hr:
            return 'HorizontalRule';
        case State.UnorderedList:
            return 'UnorderedList';
        case State.OrderedList:
            return 'OrderedList';
        case State.ListItem:
            return 'ListItem';
        case State.HtmlComment:
            return 'HTMLComment';
        default:
            return 'Unknown state: ' + state;
    }
}

const stateAllowedInState = function(state, current, index)
{
    switch (current.state)
    {
        case State.None:
        case State.Div:
            return true;
        case State.LineBreak:
        case State.Hr:
        case State.HtmlComment:
            return false;
        case State.Header:
        case State.Bold:
        case State.Underline:
        case State.Italic:
        case State.Strikethrough:
            return !blockMarkdown(state); // Only inline features allowed
        case State.Url:
            // Can still have inline stuff here. Though not in the url itself so be careful
            if (blockMarkdown(state))
            {
                return false;
            }

            return index < current.start + current.text.length + 1;
        case State.Image:
            return false;
        case State.InlineCode:
            return false; // Can't have anything inside of inline code blocks
        case State.BlockQuote:
        case State.ListItem:
            return true; // Anything can be quoted/in a list.
        case State.UnorderedList:
        case State.OrderedList:
            return state == State.ListItem; // Lists can only have listitems.
        default:
            stateError(state);
            return false;
    }
}

const blockMarkdown = function(state)
{
    switch (state)
    {
        case State.Header:
        case State.BlockQuote:
        case State.BacktickCodeBlock:
        case State.IndentCodeBlock:
            return true;
        default:
            return false;
    }
}

const inlineMarkdown = function(state)
{
    return !blockMarkdown(state);
}

const isWhitespace = function(ch)
{
    return /\s/.test(ch);
}

/// [\w\d], without the underscore
const isAlphanumeric = function(ch)
{
    return /[a-zA-Z0-9]/.test(ch);
}

class Markdown {
    constructor(text, inlineOnly=false)
    {
        let trim = 0;
        while (text[trim] == '\n')
        {
            ++trim;
        }
        text = text.substring(trim);

        // Everything's easier with spaces
        this.text = text.replace(/\t/g, '    ');
        this.currentRun = null;

        this._inlineOnly = inlineOnly;
    }

    _inAList(index)
    {
        // Loops backwards looking for the start of a list, then
        // use the list find routine to see if `index` is inside the list

        // Have some leeway here by allowing a top-level list to be indented a
        // bit (even though it shouln't be).
        let data = { 'inList' : false, 'listEnd' : -1 };
        // let spaces = '';
        let subText = this.text.substring(0, index);
        const regex = new RegExp(/\n( {0,2})(\*|\d+\.) /g);
        let matches = [[[-1, false]], [], []];
        let firstMatch = /^( {0,2})(\*|\d+\.) /.exec(subText);
        if (firstMatch != null)
        {
            matches[firstMatch[1].length].push([0, firstMatch[2] != '*']);
        }

        let lastMatch;
        while ((lastMatch = regex.exec(subText)) != null)
        {
            matches[lastMatch[1].length].push([lastMatch.index, lastMatch[2] != '*']);
        }

        // Start from outermost and work inwards
        for (let i = 0; i < 3; ++i)
        {
            lastMatch = matches[i][matches[i].length - 1];
            if (!lastMatch)
            {
                continue;
            }

            while (lastMatch[0] != -1 && this._checkHr(lastMatch[0] + 1, false /*addHr*/))
            {
                matches[i].pop();
                lastMatch = matches[i][matches[i].length - 1];
            }

            if (lastMatch[0] != -1)
            {
                data.listEnd = this._listEnd(lastMatch[0] + i + 1, Math.floor(i / 2), lastMatch[1] /*ordered*/);
                data.inList = data.listEnd > index;
                if (data.inList)
                {
                    return data;
                }
            }
        }

        return data;
    }

    /// <summary>
    /// This is pretty gross and breaks a lot of the encapsulation
    /// of the main loop. Should really look into something else here.
    /// </summary>
    _getNextDivEnd(start)
    {
        let index = start;

        // If we're currently in a list, skip to the end of it
        const isList = (state) => state == State.ListItem || state == State.OrderedList || state == State.UnorderedList
        if (isList(this.currentRun.state))
        {
            // Traverse up to find end
            let topList = this.currentRun;
            while (isList(topList.parent.state))
            {
                topList = topList.parent;
            }

            index = topList.end;
        }

        while (true)
        {
            let end = this.text.indexOf('\n\n', index);
            if (end == -1)
            {
                return this.text.length;
            }

            {
                let htmlComment = this.text.lastIndexOf('<!--', end);
                if (htmlComment != -1)
                {
                    htmlComment = this.text.indexOf('-->', htmlComment);
                    if (htmlComment > end)
                    {
                        index = htmlComment;
                        continue;
                    }
                }
            }

            let listData = this._inAList(end);
            if (listData.inList)
            {
                index = listData.listEnd;
                continue;
            }

            // Now make sure we're not in a code block, which requires
            // exactly three backticks on their own line, or prefixes of
            // at least 4 spaces preceded by two newlines

            // Look for prefixed spaces first

            let prevIndex = this.text.lastIndexOf('\n', end - 1);
            let prevLine = this.text.substring(prevIndex + 1, end + 1);
            let prevNew = 0;
            let maybeBlock = false;
            while (prevLine && prevLine.length > 0)
            {
                if (prevLine == '\n')
                {
                    ++prevNew;
                }
                else if (prevLine.startsWith('    '))
                {
                    maybeBlock = true;
                    prevNew = 0;
                }
                else
                {
                    break;
                }

                let prevOld = prevIndex;
                prevIndex = this.text.lastIndexOf('\n', prevIndex - 1);
                prevLine = this.text.substring(prevIndex + 1, prevOld + 1);
            }

            if (maybeBlock && (prevNew > 0 || (prevIndex == -1 && (this.text.startsWith('    ') || this.text.startsWith('\n')))))
            {
                // Previous lines indicate we might be in a code block. We know
                // we are if the next non-blank line is indented with 4+ spaces
                let offset = 1;
                while (offset + end < this.text.length && this.text[offset + end] == '\n')
                {
                    ++offset;
                }

                if (/    [^\n]/.test(this.text.substring(end + offset, end + offset + 5)))
                {
                    // We're definitely in a code block.
                    index = end + offset + 5;
                    continue;
                }
            }

            // If the first occurance of ``` is non-existant or beyond
            // our end bound, we're good to go. This will change once
            // (nested) lists come into play
            let searchFor = '```';
            if (start != 0)
            {
                searchFor = '\n' + searchFor;
            }

            let cb = this.text.indexOf(searchFor, start);
            if (cb == -1 || cb > end)
            {
                return end;
            }

            if (!/^\n?```[\S]*\n?$/.test(this.text.substring(cb, this._indexOrLast('\n', cb + 1))))
            {
                return end;
            }

            // Darn, we might be in a code block
            let inBlock = true;
            while (true)
            {
                cb = this.text.indexOf('\n```', cb + 1);
                if (cb == -1)
                {
                    break;
                }



                if (cb + 4 == this.text.length || this.text[cb + 4] == '\n')
                {
                    if (cb > end)
                    {
                        break;
                    }

                    inBlock = !inBlock;
                }
            }

            if (!inBlock)
            {
                return end;
            }

            index = end + 2;
        }
    }

    _checkHr(index, addHr=true)
    {
        let sep = this.text[index];
        if (index != 0 && this.text[index - 1] != '\n')
        {
            return false;
        }

        let linebreak = this.text.indexOf('\n', index);
        if (linebreak == -1) { linebreak = this.text.length; }
        let line = this.text.substring(index, linebreak).replace(/ /g, '');
        if (line.length < 3)
        {
            return false;
        }

        for (let i = 0; i < line.length; ++i)
        {
            if (line[i] != sep)
            {
                return false;
            }
        }

        if (addHr)
        {
            new Hr(index, linebreak, this.currentRun);
        }

        return true;
    }

    parse()
    {
        let perfStart = window.performance.now();
        let topRun = new Run(State.None, 0, null);
        topRun.end = this.text.length;
        this.currentRun = topRun;

        // Always wrap our first element in a div if we're not inline-only
        let i;
        if (!this._inlineOnly)
        {
            for (i = 0; i < this.text.length && this.text[i] == '\n'; ++i);
            let end = this._getNextDivEnd(i);
            let div = new Div(0, end, this.text, this.currentRun);
            this.currentRun = div;
        }

        for (i = 0; i < this.text.length; ++i)
        {
            while (i == this.currentRun.end)
            {
                logTmi("Resetting to parent: " + (this.currentRun.parent == null ? "(null)" : stateToStr(this.currentRun.parent.state)));
                this.currentRun = this.currentRun.parent;
            }

            switch (this.text[i])
            {
                case '\n':
                {
                    // Single \n is a <br>. If we're in a list item though, any number
                    // of newlines collapses into a single br
                    const innerRuns = this.currentRun.innerRuns;
                    let previousRun = innerRuns.length == 0 ? null : innerRuns[innerRuns.length - 1];
                    if (i == this.text.length - 1 || this.text[i + 1] != '\n')
                    {
                        // Don't add one if the previous element is already a block type
                        if (previousRun && (previousRun.end == i &&
                            (previousRun.state == State.Hr ||
                                previousRun.state == State.Header ||
                                previousRun.state == State.BlockQuote ||
                                previousRun.state == State.ListItem) ||
                                previousRun.state == State.UnorderedList ||
                                previousRun.state == State.OrderedList))
                        {
                            continue;
                        }

                        new Break(i, this.currentRun);
                        logTmi(`Added Line Break: start=${i}, end=${i}`);
                        continue;
                    }
                    // else if (this.currentRun.state == State.ListItem &&
                    //     i >= this.currentRun.start &&
                    //     i < this.currentRun.end)
                    else if (this._inAList(i).inList)
                    {
                        new Break(i, this.currentRun);

                        // Collapse newlines
                        let twoBreaks = false;
                        while (i + 1 < this.text.length && this.text[i + 1] == '\n')
                        {
                            twoBreaks = true;
                            ++i;
                        }

                        if (twoBreaks && this.currentRun.state == State.ListItem)
                        {
                            new Break(i, this.currentRun);
                        }
                        continue;
                    }

                    // Multiple newlines indicates a break in the text. These technically
                    // should probably be paragraphs (<p>), but there are nesting rules
                    // with paragraphs that I don't want to deal with. Use a div instead
                    // since it can just as easily be styled as a paragraph without all the
                    // rules attached.

                    // Multiple \n is a paragraph, but we have to check for items that shouln't go into
                    // paragraphs:
                    //  1. Headers (hX)
                    //  2. blockquotes (blockquote)
                    //  3. lists (ol/ul)
                    //       Look for '*' or '#.'
                    //       If found, continue until
                    //          three newlines are found (two empty lines)
                    //          OR two newlines
                    //              IF the next line does not follow the list pattern
                    //              AND is not indented at a greater level
                    //          OR a single newline
                    //              IF the next line is another "block" item
                    //              AND is indented less than three spaces
                    //  4. Code blocks (pre)
                    //  5. Tables (table)

                    let start = i;
                    while (i + 1 < this.text.length && this.text[i + 1] == '\n')
                    {
                        ++i;
                    }

                    // TODO: Watch out for nested items in lists, see (3) above
                    let end = this._getNextDivEnd(i);
                    let div = new Div(start, end, this.text, this.currentRun);
                    this.currentRun = div;
                    logTmi(`Added Div: start=${start}, end=${end}`);
                    break;
                }
                case '#':
                {
                    // Headers need to be at the start of a line (or at least the first non-whitespace character)
                    // Nested within a ListItem is still fine though, as long as they're at the beginning
                    let newline = this.text.lastIndexOf('\n', i);

                    let between = this.text.substring(newline + 1, i);
                    if (between.replace(/ /g, '').length != 0 &&
                        (this.currentRun.state != State.ListItem || !/^ *(\*|\d+\.) /.test(between)))
                    {
                        continue;
                    }

                    if (!stateAllowedInState(State.Header, this.currentRun, i))
                    {
                        continue;
                    }

                    let headingLevel = 1;
                    while (i + 1 < this.text.length && this.text[i + 1] == '#')
                    {
                        ++headingLevel;
                        ++i;
                    }

                    // h6 is the highest heading level possible,
                    // and there must be a space after the header declaration
                    if (headingLevel > 6 || i == this.text.length - 1 || this.text[i + 1] != ' ')
                    {
                        // Reset i and continue
                        i -= (headingLevel - 1);
                        continue;
                    }

                    let end = this.text.indexOf('\n', i);
                    if (end == -1) { end = this.text.length };
                    let header = new Header(i - headingLevel + 1, end, headingLevel, this.currentRun);
                    this.currentRun = header;
                    logTmi(`Added header: start=${header.start}, end=${header.end}, level=${header.headerLevel}`);
                    break;
                }
                case '!':
                {
                    if (this._isEscaped(i) || i == this.text.length - 1 || this.text[i + 1] != '[')
                    {
                        continue;
                    }

                    let result = this._testUrl(i + 1);
                    if (!result)
                    {
                        continue;
                    }

                    if (this.currentRun.end < result.end)
                    {
                        continue;
                    }

                    // Non-standard width/height syntax, since I explicitly don't want
                    // to support direct HTML insertion.
                    // ![AltText |w|h](url)
                    let dimen = / \|(\d+)(?:\|(\d+))?$/.exec(result.text);
                    let width = -1;
                    let height = -1;
                    if (dimen != null)
                    {
                        width = parseInt(dimen[1]);
                        if (dimen[2])
                        {
                            height = parseInt(dimen[2]);
                        }
                    }

                    let img = new Image(i, result.end, result.text, result.url, width, height, this.currentRun);

                    // Nothing inside of an image allowed
                    i = result.end - 1;
                    break;
                }
                case '[':
                {
                    if (!stateAllowedInState(State.Url, this.currentRun, i))
                    {
                        continue;
                    }

                    if (this._isEscaped(i))
                    {
                        continue;
                    }

                    let result = this._testUrl(i);
                    if (!result)
                    {
                        continue;
                    }

                    // Must be contained in its parent element
                    if (this.currentRun.end < result.end)
                    {
                        continue;
                    }

                    let url = new Url(i, result.end, result.text, result.url, this.currentRun);
                    this.currentRun = url;
                    logTmi(`Added url: start=${url.start}, end=${url.end}, text=${url.text}, url=${url.url}`);
                    break;
                }
                case '`':
                {
                    if (this._isEscaped(i))
                    {
                        continue;
                    }

                    // Multiline code block if it's the start of a line and there are three of these
                    let multilineBlockEnd = this._checkBacktickCodeBlock(i);
                    if (multilineBlockEnd != -1)
                    {
                        i = multilineBlockEnd - 1;
                        continue;
                    }

                    // Couldn't parse as a code block, so try an inline block.
                    let inlineEnd = this._checkInlineCode(i);
                    if (inlineEnd != -1)
                    {
                        i = inlineEnd - 1;
                    }
                    break;
                }
                case '-':
                {
                    if (this._checkHr(i))
                    {
                        i = this._indexOrLast('\n', i) - 1;
                    }
                    break;
                }
                case '*':
                {
                    if (this._isEscaped(i))
                    {
                        continue;
                    }

                    if (this._checkHr(i))
                    {
                        i = this._indexOrLast('\n', i) - 1;
                        continue;
                    }

                    // Unordered list. Returns true if we successfully parsed an unordered list item
                    if (this._checkList(i, false /*ordered*/))
                    {
                        break;
                    }
                    /* __fallthrough, bold/italic */
                }
                case '_':
                {
                    // First, check for HR
                    if (this._checkHr(i))
                    {
                        i = this._indexOrLast('\n', i) - 1;
                        continue;
                    }

                    // Separators a tricky, as they can be nested, and can represent both
                    // bold (2 separators) and italics (1 separator). The exact format is
                    // determined by the ending separator.
                    //
                    // Another tricky thing. If separators are not matched (__A_), it should be
                    // rendered as _<i>A</i>. So if we've reached the end of our block and have
                    // too many separators, we need to drop a few of them from the format and
                    // add them to the text.

                    // A non-alphanumeric number should precede this.
                    // Might want to tweak this a bit more by digging into surrounding/parent
                    // runs.
                    if (i != 0 && (isAlphanumeric(this.text[i - 1]) || this._isEscaped(i)))
                    {
                        continue;
                    }

                    let sep = this.text[i];

                    // Man, I really need to compartmentalize this nasty processing loop
                    if (sep == '_')
                    {
                        // TODO: Check for HR
                    }

                    // Also check that we aren't in any special regions of our current run
                    let parentContextStartLength = this.currentRun.startContextLength();
                    let parentContextEndLength = this.currentRun.endContextLength();
                    if ((parentContextStartLength != 0 && i - this.currentRun.start < parentContextStartLength) ||
                        (parentContextEndLength != 0 && this.currentRun.end - i <= parentContextEndLength))
                    {
                        continue;
                    }

                    let blockEnd = this.currentRun.end - this.currentRun.endContextLength();
                    let separators = 1;
                    let separatorIndex = i + 1;
                    while (this.text[separatorIndex] == sep)
                    {
                        ++separators;
                        ++separatorIndex;
                    }

                    // Next character in run must not be whitespace
                    if (isWhitespace(this.text[separatorIndex]))
                    {
                        continue;
                    }

                    // Need to find a match for our separator.
                    // Rules:
                    //  An opening separator run must be preceeded by whitespace and end with non-whitespace
                    // A closing separator run must be preceded by non-whitespace and end with whitespace
                    let inline = false;
                    for (; separators != 0 && separatorIndex < blockEnd; ++separatorIndex)
                    {
                        if (this.text[separatorIndex] == '`' && !this._isEscaped(separatorIndex))
                        {
                            inline = !inline;
                        }

                        if (this._isInline(inline, separatorIndex, blockEnd))
                        {
                            continue;
                        }

                        if (this.text[separatorIndex] != sep || this._isEscaped(separatorIndex))
                        {
                            continue;
                        }

                        // Check to see if it's the start of an opening or closing sequence
                        let potentialSeparators = 1;
                        let foundMatch = false;
                        if (!isAlphanumeric(this.text[separatorIndex - 1]))
                        {
                            // Opening?
                            let psi = separatorIndex + potentialSeparators;
                            while (psi < blockEnd && this.text[psi] == sep)
                            {
                                ++potentialSeparators;
                                ++psi;
                            }

                            if (psi == blockEnd || isWhitespace(this.text[psi]))
                            {
                                if (isWhitespace(this.text[separatorIndex - 1]))
                                {
                                    // Separators surrounded by whitespace, don't parse
                                    separatorIndex = psi;
                                    continue;
                                }

                                // non-alphanumeric + separators + whitespace. This
                                // might actually be an end
                                potentialSeparators = 1;
                            }
                            else
                            {
                                if (!isWhitespace(this.text[separatorIndex - 1]))
                                {
                                    // Assume that separators surrounded by
                                    // punctiation is closing. It's ambiguous
                                    // and some choice has to be made
                                    potentialSeparators = 1;
                                }
                                else
                                {
                                    // Found an actual group of opening separators. Add it to our collection
                                    foundMatch = true;
                                    separators += potentialSeparators;
                                    separatorIndex = psi;
                                }
                            }
                        }

                        if (!foundMatch)
                        {
                            // non-whitespace, see if it's an end sequence
                            let psi = separatorIndex + potentialSeparators;
                            while (psi < blockEnd && this.text[psi] == sep)
                            {
                                ++potentialSeparators;
                                ++psi;
                            }

                            if (psi != blockEnd && isAlphanumeric(this.text[psi]))
                            {
                                // Group of separators with alphanumeric on either end,
                                // skip over it
                                separatorIndex = psi;
                                continue;
                            }

                            if (potentialSeparators > separators)
                            {
                                separatorIndex += separators;
                                separators = 0;
                                break;
                            }
                            else
                            {
                                separatorIndex += potentialSeparators;
                                separators -= potentialSeparators;
                                if (separators == 0)
                                {
                                    break;
                                }
                            }
                        }
                    }

                    if (separators != 0)
                    {
                        // Didn't find a match, move to the next character
                        continue;
                    }

                    let bi;
                    if (this.text[i + 1] == sep && this.text[separatorIndex - 2] == sep)
                    {
                        logTmi(`Adding bold run: start=${i}, end=${separatorIndex}`);
                        bi = new Bold(i, separatorIndex, this.currentRun);

                        // Also need to skip the next separator, as we've included it in
                        // our match and we don't want to reprocess it.
                        ++i
                    }
                    else
                    {
                        logTmi(`Adding italic run: start=${i}, end=${separatorIndex}`);
                        bi = new Italic(i, separatorIndex, this.currentRun);
                    }

                    this.currentRun = bi;

                    break;
                }
                case '~':
                case '+':
                {
                    // Depending on what online visualizer I use, this does a multitude of things.
                    // Usuall two strikes through (~~A~~), but sometimes it only takes one (~A~).
                    // For others, one creates a subscript, and three creates a code block. Gah.
                    //
                    // For this parser, keep things simple for now. Two indicates a strikethrough.
                    // They can be nested (though you shouldn't need it...) just like '*' and '_'
                    //
                    // What can/should be shared with bold/italic? If nothing, it should at least
                    // be shared with underline (++A++) like bold is shared with italic.
                    if (i != 0 && (isAlphanumeric(this.text[i - 1]) || this.text[i - 1] == '\\'))
                    {
                        continue;
                    }

                    let sep = this.text[i];

                    // Need at least 4 additional characters to make a complete run
                    if (i >= this.text.length - 4 || this.text[i + 1] != sep)
                    {
                        continue;
                    }

                    let parentContextStartLength = this.currentRun.startContextLength();
                    let parentContextEndLength = this.currentRun.endContextLength();
                    if ((parentContextStartLength != 0 && i - this.currentRun.start < parentContextStartLength) ||
                        (parentContextEndLength != 0 && this.currentRun.end - i <= parentContextEndLength))
                    {
                        continue;
                    }

                    let blockEnd = this.currentRun.end - this.currentRun.endContextLength();
                    let separators = 2;
                    let separatorIndex = i + 2;
                    while (separatorIndex < this.text.length && this.text[separatorIndex] == sep)
                    {
                        ++separators;
                        ++separatorIndex;
                    }

                    if (separators % 2 == 1)
                    {
                        //  Odd number of separators, not allowed here
                        continue;
                    }

                    // Next character in run must not be whitespace
                    if (isWhitespace(this.text[separatorIndex]))
                    {
                        continue;
                    }

                    // Need to find a match for our separator.
                    // Keeping track of just inline code (and not block) is okay because we
                    // currently don't allow these annotations to span multiple lines. If that
                    // changes, this will have to change as well.
                    let inline = false;
                    for (; separators != 0 && separatorIndex < blockEnd; ++separatorIndex)
                    {
                        if (this.text[separatorIndex] == '`' && !this._isEscaped(separatorIndex))
                        {
                            inline = !inline;
                        }

                        if (this._isInline(inline, separatorIndex, blockEnd))
                        {
                            continue;
                        }

                        if (this.text[separatorIndex] != sep || this._isEscaped(separatorIndex))
                        {
                            continue;
                        }

                        // Check to see if it's the start of an opening or closing sequence
                        let potentialSeparators = 1;
                        let foundMatch = false;
                        if (!isAlphanumeric(this.text[separatorIndex - 1]))
                        {
                            // Opening? (psi == potentialSeparatorIndex)
                            let psi = separatorIndex + potentialSeparators;
                            while (psi < blockEnd && this.text[psi] == sep)
                            {
                                ++potentialSeparators;
                                ++psi;
                            }

                            if (psi == blockEnd || isWhitespace(this.text[psi]))
                            {
                                if (potentialSeparators == 1 || isWhitespace(this.text[separatorIndex - 1]))
                                {
                                    // Single separator or separators surrounded by whitespace, don't parse
                                    separatorIndex = psi;
                                    continue;
                                }

                                // non alphanumeric + separators + whitespace. This
                                // might actually be an end
                                potentialSeparators = 1;
                            }
                            else
                            {
                                if (!isWhitespace(this.text[separatorIndex - 1]))
                                {
                                    // Assume that separators surrounded by punctuation is
                                    // closing. It's ambiguous and some choise has to be made
                                    potentialSeparators = 1;
                                }
                                else
                                {
                                    // Found an actual group of opening separators. Add it to our collection
                                    // Note that these separators must be in pairs of two, so if we have an
                                    // odd number, round down.
                                    foundMatch = true;
                                    separators += potentialSeparators - (potentialSeparators % 2);
                                    separatorIndex = psi;
                                }
                            }
                        }

                        if (!foundMatch)
                        {
                            // non-whitespace, see if it's an end sequence
                            let psi = separatorIndex + potentialSeparators;
                            while (psi < blockEnd && this.text[psi] == sep)
                            {
                                ++potentialSeparators;
                                ++psi;
                            }

                            if (psi != blockEnd && isAlphanumeric(this.text[psi]))
                            {
                                // Group of separators with alphanumeric on either end,
                                // skip over it
                                separatorIndex = psi;
                                continue;
                            }

                            if (potentialSeparators > separators)
                            {
                                separatorIndex += separators;
                                separaators = 0;
                                break;
                            }
                            else
                            {
                                separatorIndex += potentialSeparators;
                                separators -= (potentialSeparators - (potentialSeparators % 2));
                                if (separators == 0)
                                {
                                    break;
                                }
                            }
                        }
                    }

                    if (separators != 0)
                    {
                        // Didn't find a match, move to the next character
                        continue;
                    }

                    let su;
                    if (sep == '+')
                    {
                        logTmi(`Adding underline run: start=${i}, end=${separatorIndex}`);
                        su = new Underline(i, separatorIndex, this.currentRun);
                    }
                    else
                    {
                        logTmi(`Adding strikethrough run: start-${i}, end=${separatorIndex}`);
                        su = new Strikethrough(i, separatorIndex, this.currentRun);
                    }

                    // Also need to skip the next separator, as we've included it in
                    //  our match and we don't want to reprocess it
                    ++i
                    this.currentRun = su;
                    break;
                }
                case '>':
                {
                    // Blockquote rules:
                    //  Starts with a '>'
                    //  Can be continued on the next line without '>'
                    //  Can be nested with additional '>', and can skip levels. The following is fine:
                    //      > Hello
                    //      >>> Hi
                    //  You can 'unindent' by leaving a blank quote line:
                    //      > Hello
                    //      >> There
                    //      >
                    //      > Hi
                    //
                    // Make things easier by not allowing whitespace at all

                    // First, it must not be escaped, and must be the first character of the line

                    if (this._inlineOnly || this._isEscaped(i))
                    {
                        continue;
                    }

                    let nestLevel = 1;
                    let offset = 1;
                    while (i - offset >= 0 && /[> ]/.test(this.text[i - offset]))
                    {
                        if (this.text[i - offset] == '>')
                        {
                            ++nestLevel;
                        }

                        ++offset;
                    }

                    // Must be the beginning of the line
                    let prevNewline = this.text.lastIndexOf('\n', i);
                    let regex;
                    if (this.currentRun.state != State.ListItem)
                    {
                        regex = new RegExp(`^>{${nestLevel}}$`);
                    }
                    else if (this.currentRun.parent.state == State.OrderedList)
                    {
                        regex = new RegExp(`^(\\d+\\.)?>{${nestLevel}}$`);
                    }
                    else
                    {
                        regex = new RegExp(`^(\\*)?>{${nestLevel}}$`);
                    }
                    if (!regex.test(this.text.substring(prevNewline + 1, i + 1).replace(/ /g, '')))
                    // if (i - nestLevel != -1 && this.text[i - nestLevel] != '\n')
                    {
                        continue;
                    }

                    let parentState = this.currentRun.state;
                    if (nestLevel > 1 && parentState != State.BlockQuote)
                    {
                        logError('Something went wrong! Nested blockquotes should have a blockquote parent, found ' + stateToStr(parentState));
                        continue;
                    }

                    if (parentState == State.BlockQuote && this.currentRun.nestLevel >= nestLevel)
                    {
                        // Same or less nesting than parent, don't add another one
                        continue;
                    }

                    // Now find where the blockquote ends.
                    // Exit conditions:
                    //  1. Double newline
                    //  2. Less indentation
                    //      2.a. Except when there are no indicators, as that means we should
                    //          continue with the current nest level

                    let lineEnd = this.text.indexOf('\n', i);
                    let end = this.text.length; // By default, the blockquote covers the rest of the text
                    while (lineEnd != -1 && lineEnd != this.text.length - 1)
                    {
                        let next = this.text[lineEnd + 1];
                        if (next == '\n')
                        {
                            // Double line break, we're done.
                            // Note that we might want to change this for listitems, which
                            // allows additional newlines if the next non-blank line is indented
                            // 2+ spaces.
                            end = lineEnd;
                            break;
                        }

                        let nextNest = 0;
                        let nextChar;
                        let nextOffset = 1;
                        while (lineEnd + nextOffset < this.text.length && /[> ]/.test((nextChar = this.text[lineEnd + nextOffset])))
                        {
                            if (nextChar == '>')
                            {
                                ++nextNest;
                            }

                            ++nextOffset;
                        }

                        if (nextNest < nestLevel)
                        {
                            // Less indentation, we're done.
                            end = lineEnd;
                            break;
                        }

                        lineEnd = this.text.indexOf('\n', lineEnd + 1);
                    }

                    let blockquote = new BlockQuote(i, end, nestLevel, this.currentRun);
                    this.currentRun = blockquote;

                    // One level lasts until 
                    break;
                }
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                {
                    this._checkList(i, true /*ordered*/);
                    break;
                }
                case ' ':
                {
                    // Potential code block, alternative to three backticks
                    if (this._inlineOnly)
                    {
                        continue;
                    }
                    // Rules:
                    // 1. If not in a list, must have 4 spaces at the start of the line, and an empty line above
                    // 2. If in a list and on the same line as the start of a listitem,
                    //    must be indented 5 spaces from the bullet start ('* ' plus four spaces')
                    // 3. If in a list and _not_ on the same line as the start of a listitem, must be indented
                    //    4 spaces plus (2 * (nestLevel + 1))
                    let minspaces = 4;
                    let firstIsList = false;
                    if (this.currentRun.state == State.ListItem)
                    {
                        let nestLevel = this.currentRun.parent.nestLevel;
                        minspaces += (nestLevel + 1) * 2;
                        let type = this.currentRun.parent.state;
                        let context = this.text.substring(this.text.lastIndexOf('\n', i) - 1, i + 1);
                        let liStartRegex = new RegExp(`^.?\\n? {${nestLevel * 2}} ?${type == State.OrderedList ? '\\d+\\.' : '\\*'}     `);
                        if (!liStartRegex.test(context))
                        {
                            // Not on the same line as the list item start, check if it's
                            // a valid continuation
                            if (!new RegExp(`^\\n?\\n? {${minspaces}}`).test(context))
                            {
                                continue;
                            }
                        }
                        else
                        {
                            firstIsList = true;
                        }

                    }
                    else
                    {
                        // Not in a list, just need 4+ spaces. substring is nice enough to adjust invalid bounds
                        // in the case where we ask for a substring starting at a negative index
                        if (!/^\n?\n?   $/.test(this.text.substring(i - 5, i)) || i == this.text.length - 1 || this.text[i + 1] == '\n')
                        {
                            continue;
                        }

                    }

                    // Find the end, i.e. the last line prefixed with 4+ spaces (excluding completely empty lines)
                    let newline = this.text.indexOf('\n', i);
                    let end;
                    if (newline == -1 || newline == this.text.length - 1)
                    {
                        end = this.text.length;
                    }
                    else
                    {
                        end = newline;
                        let next = this._indexOrLast('\n', newline + 1);
                        let nextline = this.text.substring(newline + 1, next + 1);
                        let regex = new RegExp(`^ {${minspaces}}`);

                        while (true)
                        {
                            if (nextline.length == 0)
                            {
                                break;
                            }

                            while (/^ *\n/.test(nextline))
                            {
                                newline = next;
                                next = this._indexOrLast('\n', next + 1);
                                nextline = this.text.substring(newline + 1, next + 1);
                                if (nextline.length == 0)
                                {
                                    break;
                                }
                            }

                            // If we're here, nextline actually has content
                            if (!regex.test(nextline))
                            {
                                break;
                            }

                            end = next;
                            newline = next;
                            next = this._indexOrLast('\n', next + 1);
                            nextline = this.text.substring(newline + 1, next + 1);
                        }
                    }

                    let start = i - (firstIsList ? 4 : minspaces) + 1;
                    let codeblock = new IndentCodeBlock(start, end, this.text, minspaces, firstIsList, this.currentRun)
                    i = end - 1;
                }
                case '<':
                {
                    if (!this.text.substring(i, i + 4) == '<!--')
                    {
                        continue;
                    }

                    let endComment = this.text.indexOf('-->', i);
                    if (endComment == -1)
                    {
                        continue;
                    }

                    endComment += 3;

                    let htmlComment = new HtmlComment(i, endComment, this.currentRun);
                    i = endComment - 1;
                    break;
                }
                case '|':
                {
                    // Tables

                    // Could break from what I have been doing and take a different approach:
                    // 1. Find the bounds of the entire table
                    // 2. Create a 2D array of cells containing start and end indexes
                    // 3. For each cell, invoke a new parser and store the result
                    // 4. When it's time to display, don't do any transformations
                    //    and directly display the contents we already converted

                    // Breaking inline spans will also be interesting, and only a problem because
                    // pipes at the ends of the table are optional.

                    if (this._isEscaped(i))
                    {
                        continue;
                    }



                    // First, check to see if we're actually in a table. Basic rules:
                    // 1. Pipes are required to separate columns, but ends are not required
                    // 2. Three dashes are necessary on the next line for each column. ':' determines alignment

                    let nextbreak = this.text.indexOf('\n', i);
                    if (nextbreak == -1)
                    {
                        // Need at least two lines
                        continue;
                    }

                    // Watch out for nests. We can be nested in either a listitem or blockquote
                    let thisLineStart = this.text.lastIndexOf('\n', i) + 1;
                    let blockEnd = this.text.length;
                    if (this.currentRun.state == State.ListItem || this.currentRun.state == State.BlockQuote)
                    {
                        if (thisLineStart <= this.currentRun.start)
                        {
                            thisLineStart = this.currentRun.start + this.currentRun.startContextLength();
                        }

                        blockEnd = this.currentRun.end;
                    }

                    let thisLine = this.text.substring(thisLineStart, nextbreak);

                    let defineEnd = this._indexOrLast('\n', nextbreak + 1);
                    if (defineEnd > blockEnd)
                    {
                        continue;
                    }

                    let defineLine = this.text.substring(nextbreak + 1, defineEnd);

                    // The definition line _must_ be on its own, so we can be stricter about contents. Still
                    // allow arbitrary spaces though, so collapse them to make parsing the definition easier
                    let definition = defineLine.replace(/ /g, '');

                    let quoteRegex;
                    if (this.currentRun.state == State.BlockQuote)
                    {
                        quoteRegex = new RegExp(`^( *> *){${this.currentRun.nestLevel}}`);
                        definition = definition.replace(quoteRegex, '');
                    }

                    if (definition.indexOf('|') == -1)
                    {
                        continue;
                    }

                    // First and last can be empty, but everyting else has to match
                    const splitAndTrim = function(line, self)
                    {
                        if (line.indexOf('|') == -1)
                        {
                            return [];
                        }

                        line = line.trim();
                        let arr = [];
                        let span = '';
                        for (let i = 0; i < line.length; ++i)
                        {
                            if (line[i] == '|' && !self._isEscaped(i))
                            {
                                arr.push(span);
                                span = '';
                                continue;
                            }

                            span += line[i];
                        }

                        if (span.length != 0)
                        {
                            arr.push(span);
                        }

                        if (arr.length == 1)
                        {
                            return arr;
                        }

                        if (arr[arr.length - 1].length == 0)
                        {
                            arr.pop();
                        }

                        if (arr[0].length == 0)
                        {
                            arr.splice(0, 1);
                        }

                        return arr;
                    }

                    let groups = splitAndTrim(definition, this);

                    let table =
                    {
                        "header" : [],
                        "rows" : [],
                        "columnAlign" : [],
                    };

                    let valid = true;
                    for (let j = 0; j < groups.length; ++j)
                    {
                        let col = groups[j];
                        if (!/^:?-{3,}:?$/.test(col))
                        {
                            valid = false;
                            break;
                        }

                        // -2 means don't have specific alignment
                        table.columnAlign.push(-2);

                        if (col.startsWith(':'))
                        {
                            table.columnAlign[j] = col.endsWith(':') ? 0 : -1;
                        }
                        else if (col.endsWith(':'))
                        {
                            table.columnAlign[j] = 1;
                        }
                    }

                    if (!valid)
                    {
                        continue;
                    }

                    // We have valid column definitions. Now back to the header
                    let headers = splitAndTrim(thisLine, this);

                    for (let j = 0; j < groups.length; ++j)
                    {
                        table.header.push(j >= headers.length ? '' : headers[j]);
                    }

                    // Now look for the rows
                    let newline = defineEnd;
                    let end = newline;
                    let next = this._indexOrLast('\n', newline + 1);
                    let nextline = this.text.substring(newline + 1, next);
                    while (true)
                    {
                        if (nextline.length == 0 || nextline == '\n' || next > blockEnd)
                        {
                            break;
                        }

                        if (this.currentRun.state == State.BlockQuote)
                        {
                            nextline = nextline.replace(quoteRegex, '');
                            if (nextline.startsWith('>'))
                            {
                                break;
                            }
                        }

                        let split = splitAndTrim(nextline, this);
                        if (split.length == 0)
                        {
                            break;
                        }
                        let row = [];
                        for (let j = 0; j < groups.length; ++j)
                        {
                            row.push(j >= split.length ? '' : split[j]);
                        }

                        table.rows.push(row);

                        end = next;
                        newline = next;
                        next = this._indexOrLast('\n', newline + 1);
                        nextline = this.text.substring(newline + 1, next);
                    }

                    // Run markdown on individual cells.
                    for (let row = 0; row < table.rows.length; ++row)
                    {
                        for (let col = 0; col < table.rows[row].length; ++col)
                        {
                            table.rows[row][col] =  new Markdown(table.rows[row][col], true /*inlineOnly*/).parse();
                        }
                    }

                    new Table(thisLineStart, end, table, this.currentRun);
                    logTmi(`Added Table: start=${thisLineStart}, end=${end}, $rows=${table.rows.length}, cols=${table.header.length}`);
                    i = end - 1;

                    break;
                }
                default:
                {
                    break;
                }
            }
        }

        logTmi(topRun, 'Parsing tree');
        let html = topRun.convert(this.text);
        let perfStop = window.performance.now();
        logVerbose(`Parsed markdown in ${perfStop - perfStart}ms`);
        return html;
    }

    _checkInlineCode(start)
    {
        // Note that we need to match the exact number of initial backticks
        // (before a newline, for now). This allows things like
        // "```` Start a code block with ``` ````".
        if (!stateAllowedInState(State.InlineCode, this.currentRun, start))
        {
            return -1;
        }

        let findStr = '`';
        let codeStart = start + 1;
        while (codeStart < this.text.length && this.text[codeStart] == '`')
        {
            findStr += '`';
            ++codeStart;
        }

        if (start + (findStr.length * 2) - 1 >= this.text.length)
        {
            // Impossible for us to find a match. Need at least (2 * findstr) -1 beyond start
            return -1;
        }

        // Require inline blocks to be on a single line. Not all parsers have this
        // restriction, but if someone is trying to inline a lot of code, they're
        // probably better off using a code block anyway.
        // Should probably revisit though. Multiline stuff can be useful in more general
        // cases. Instead of a single newline breaking this, a double newline will.
        let lineEnd = this._indexOrLast('\n', start);
        let end = this.text.indexOf(findStr, start + 1);

        if (end == -1)
        {
            return end;
        }

        end += findStr.length;

        if (end > lineEnd || end > this.currentRun.end)
        {
            return -1;
        }

        let inline = new InlineCodeRun(start, end, this.text, this.currentRun);
        this.currentRun = inline;
        logTmi(`Added inline code block: codeStart=${inline.codeStart}, end=${inline.end}`);

        // Can't add anything to an inline block, so increment the cursor
        return end;
    }

    _checkBacktickCodeBlock(start)
    {
        if (this._inlineOnly || !/```/.test(this.text.substring(start - 2, start + 1)))
        {
            return -1;
        }

        // If start ever get around to it, text after the ticks indicates the language
        // (e.g. "```cpp" for C++). For now though, just ignore it.

        let newline = this.text.indexOf('\n', start);
        if (newline == -1 || newline == this.text.length - 1)
        {
            return -1;
        }

        let minspaces = 0;
        let firstIsList = false;
        if (this.currentRun.state == State.ListItem)
        {
            let nestLevel = this.currentRun.parent.nestLevel;
            minspaces = (nestLevel + 1) * 2;
            let type = this.currentRun.parent.state;
            let context = this.text.substring(this.text.lastIndexOf('\n', start), start + 2);
            let liStartRegex = new RegExp(`^\\n? {${nestLevel * 2}} ?${type == State.OrderedList ? '\\d+\\.' : '\\*'} \`\`\`\\w*\\n`);
            if (!liStartRegex.test(context))
            {
                // Not on the same line as the list item start, check if it's a valid continuation
                if (!new RegExp(`^\\n {${minspaces}}\`\`\`\\w*\\n`).test(context))
                {
                    return -1;
                }
            }
            else
            {
                firstIsList = true;
            }
        }
        else
        {
            // Not within a list item, needs to be three backticks at the very beginning of the line
            if (!/^\n?```[\S]*\n?$/.test(this.text.substring(start - 3, newline)))
            {
                return -1;
            }
        }

        let end = newline;
        let next = this._indexOrLast('\n', newline + 1);
        let nextline = this.text.substring(newline + 1, next + 1);

        // Each subsequent line must have at least minspaces before it, otherwise it's an invalid block
        let validLine = new RegExp(`^ {${minspaces}}`);
        let validEnd = new RegExp(`^ {${minspaces}}\`\`\`\\n?$`);
        while (true)
        {
            if (nextline.length == 0)
            {
                return -1;
            }

            while (/^ *\n$/.test(nextline))
            {
                newline = next;
                next = this._indexOrLast('\n', next + 1);
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    return -1;
                }
            }

            if (!validLine.test(nextline))
            {
                return -1;
            }

            if (validEnd.test(nextline))
            {
                let block = new BacktickCodeBlock(start - 2, next, minspaces, this.text, this.currentRun);
                return next;
            }

            end = next;
            newline = next;
            next = this._indexOrLast('\n', next + 1);
            nextline = this.text.substring(newline + 1, next + 1);
        }
    }

    _checkList(start, ordered)
    {
        // Check if we're starting a list. This will definitely get tricky when mixing nested levels of blockquotes
        // and additional lists
        if (this._inlineOnly || this._isEscaped(start) || start == this.text.length - 1)
        {
            return false;
        }

        if (ordered ? !/^\d+\. /.test(this.text.substring(start)) : this.text[start + 1] != ' ')
        {
            return false;
        }

        // Two spaces adds a nesting level
        let prevNewline = this.text.lastIndexOf('\n', start);
        let spaces = this.text.substring(prevNewline + 1, start);
        if (!/^ *$/.test(spaces))
        {
            // Something other than spaces precedes this.
            return false;
        }

        let nestLevel = Math.floor(spaces.length / 2);

        // First need to determine if this is a new list. If so, create the ol/ul
        if (this.currentRun.state != (ordered ? State.OrderedList : State.UnorderedList) || nestLevel > this.currentRun.nestLevel)
        {
            let listEnd = this._listEnd(start, nestLevel, ordered);
            let list;
            if (ordered)
            {
                list = new OrderedList(start, listEnd, nestLevel, this.text.substring(start).match(/\d+/)[0] /*listStart*/, this.currentRun);
                logTmi(`Adding Ordered List: start=${start}, end=${listEnd}, listStart=${list.listStart}, nestLevel=${nestLevel}`);
            }
            else
            {
                list = new UnorderedList(start, listEnd, nestLevel, this.currentRun);
                logTmi(`Adding Unordered List: start=${start}, end=${listEnd}, nestLevel=${nestLevel}`)
            }

            this.currentRun = list;
        }

        let liEnd = this._liEnd(start, nestLevel, ordered);
        let li = new ListItem(start, liEnd, this.currentRun);
        this.currentRun = li;
        logTmi(`Added ListItem: start=${start}, end=${liEnd}, nestLevel=${nestLevel}`);
        return true;
    }

    _indexOrLast(str, start)
    {
        let i = this.text.indexOf(str, start);
        return i == -1 ? this.text.length : i;
    }


    _liEnd(start, nestLevel)
    {
        // This is really just the ulEnd loop, but for a single li. Write this up then
        // look into sharing based on the slight differences.
        let newline = this.text.indexOf('\n', start);
        if (newline == -1 || newline == this.text.length - 1)
        {
            return this.text.length;
        }

        let end = newline;
        let next = this._indexOrLast('\n', newline + 1);
        let nextline = this.text.substring(newline + 1, next + 1);

        while (true)
        {
            if (nextline.length == 0)
            {
                return end;
            }

            // Double newline, find the next non-empty line
            let doubleNew = nextline == '\n';
            while (nextline == '\n')
            {
                newline = next;
                next = this._indexOrLast('\n', next + 1);
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    // Just a bunch of newlines at the end without additional context
                    return end;
                }
            }

            // If we're here, nextline actually has content
            if (doubleNew)
            {
                // If there is a line break within the list, the list item
                // only continues if there are (minspaces + 1) * 2 spaces before
                // the content.
                let minspaces = (nestLevel + 1) * 2;
                if (!RegExp(`^ {${minspaces},}`).test(nextline))
                {
                    return end;
                }
            }
            else
            {
                // Not a double newline. To continue the list item we need
                // general content of any kind, or a new list item that's indented
                // (minspaces + 1) * 2
                let minspaces = (nestLevel + 1) * 2;
                if (RegExp(`^ {0,${minspaces - 1}}(?:\\*|\\d+\\.) `).test(nextline))
                {
                    return end;
                }
            }

            end = next;
            newline = next;
            next = this._indexOrLast('\n', next + 1);
            nextline = this.text.substring(newline + 1, next + 1);
        }

        return end;
    }


    _listEnd(start, nestLevel, ordered)
    {
        let newline = this.text.indexOf('\n', start);
        if (newline == -1 || newline == this.text.length - 1)
        {
            return this.text.length;
        }

        let end = newline;
        let next = this.text.indexOf('\n', newline + 1);

        // Note that substring handles the case where 'end' is outside the bounds of the string,
        // so setting this to this.text.length is fine
        if (next == -1) { next = this.text.length; }
        let nextline = this.text.substring(newline + 1, next + 1);
        while (true)
        {
            if (nextline.length == 0)
            {
                return end;
            }
            
            // Double newline, find the next non-newline line
            let doubleNew = nextline == '\n';
            while (nextline == '\n')
            {
                newline = next;
                next = this.text.indexOf('\n', next + 1);
                if (next == -1) { next = this.text.length; }
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    // Just a bunch of newlines at the end without additional context
                    return end;
                }
            }

            // If we're here, nextline actually has content
            if (doubleNew)
            {
                // If there is a line break within the list, the next list
                // item must be indented at 2 * nestLevel. If the next line is not
                // a listitem and a potential continuation of the current li, it must
                // be indented with (nestLevel + 1) * 2 spaces
                let minspaces = (nestLevel + 1) * 2;
                if (!RegExp(`^ {${minspaces},}`).test(nextline))
                {
                    if (!RegExp(`^ {${minspaces - 2},${minspaces - 1}}${ordered ? '\\d+\\.' : '\\*' } `).test(nextline))
                    {
                        return end;
                    }
                }
            }
            else
            {
                // Not a double newline, if it's a new listitem, it must be indented
                // at least (nestLevel * 2) spaces. Otherwise, any level of indentation is fine
                if (/^ *(?:\*|\d+\.) /.test(nextline))
                {
                    // Also can't swap between ordered/unoredred with the same nesting level
                    let minspaces = nestLevel * 2;
                    if (!RegExp(`^ {${minspaces},}`).test(nextline) ||
                        RegExp(`^ {${minspaces},${minspaces + 1}}${ordered ? '\\*' : '\\d+\\.'} `).test(nextline))
                    {
                        return end;
                    }
                }
            }

            end = next;
            newline = next;
            next = this.text.indexOf('\n', next + 1);
            if (next == -1) { next = this.text.length; }
            nextline = this.text.substring(newline + 1, next + 1);
            continue;
        }

        return end;
    }

    _testUrl(start)
    {
        let end = this._indexOrLast('\n', start);
        if (end - start < 5)
        {
            return false;
        }

        let inline = false;
        let toFind = [']', '(', ')'];
        let idx = 0;
        let ret = 
        {
            text : '',
            url : 0,
            end : 0
        }

        for (let i = start; i < end; ++i)
        {
            switch (this.text[i])
            {
                case '[':
                    if (i == start || toFind[idx] != ']' || this._isEscaped(i))
                    {
                        break;
                    }

                    // Nested link? Continue our search at the end of the nested link
                    let innerUrl = this._testUrl(i);
                    if (innerUrl)
                    {
                        i = innerUrl.end - 1;
                    }
                    break;
                case ']':
                    if (toFind[idx] != ']' || this._isInline(inline, i, end) || (i > start && this.text[i - 1] == '\\'))
                    {
                        break;
                    }

                    ret.text = this.text.substring(start, i);

                    ++idx;
                    break;
                case '(':
                    if (toFind[idx] != '(' || this.text[i - 1] == '\\')
                    {
                        break;
                    }

                    if (this.text[i - 1] != ']')
                    {
                        return false;
                    }

                    ret.url = i + 1;

                    ++idx;
                    break;
                case ')':
                    if (toFind[idx] != ')' || this.text[i - 1] == '\\')
                    {
                        break;
                    }

                    ret.url = this.text.substring(ret.url, i);
                    ret.end = i + 1;
                    return ret;
                case '`':
                    if (i == start || this.text[i - 1] == '\\')
                    {
                        break;
                    }

                    inline = !inline;
                default:
                    break;
            }
        }

        return false;
    }

    _isInline(inline, i, end)
    {
        if (!inline)
        {
            return false;
        }

        let endInline = this.text.indexOf('`', i);
        return endInline != -1 && endInline < end;
    }

    _isEscaped(index)
    {
        let bs = 0;
        while (index - bs > 0 && this.text[index - 1 - bs] == '\\')
        {
            ++bs;
        }

        return bs % 2 == 1;
    }
}

class Run
{
    constructor(state, start, end, parent=null)
    {
        this.state = state;
        this.start = start;
        this.end = end;
        this.parent = parent;
        if (parent != null)
        {
            parent.innerRuns.push(this);
        }
        this.innerRuns = [];
    }

    // Conversion process:
    //  create start tag
    //    if first child start is not this start, add from initialText
    //  convert() children
    //  create end tag
    convert(initialText)
    {
        let ident = '';
        let par = this.parent;
        while (par != null)
        {
            par = par.parent;
            ident += '   ';
        }

        logTmi(`${ident}Converting State.${stateToStr(this.state)} : ${this.start}-${this.end}. ${this.innerRuns.length} children.`);
        let newText = this.tag(false /*end*/);

        let startWithContext = this.start + this.startContextLength();
        let endWithContext = this.end - this.endContextLength();
        if (this.innerRuns.length == 0)
        {
            newText += this.transform(initialText.substring(startWithContext, endWithContext), 0);
            logTmi(`${ident}Returning '${newText + this.tag(true)}'`);
            return newText + this.tag(true /*end*/);
        }


        if (startWithContext < this.innerRuns[0].start)
        {
            newText += this.transform(initialText.substring(startWithContext, this.innerRuns[0].start), -1);
            logTmi(`${ident}Built: '${newText}'`);
        }

        for (let i = 0; i < this.innerRuns.length; ++i)
        {
            newText += this.innerRuns[i].convert(initialText, newText);
            logTmi(`${ident}Built: '${newText}'`);
            if (i != this.innerRuns.length - 1 && this.innerRuns[i].end < this.innerRuns[i + 1].start)
            {
                newText += this.transform(initialText.substring(this.innerRuns[i].end, this.innerRuns[i + 1].start), -2);
                logTmi(`${ident}Built: '${newText}'`);
            }
        }

        if (this.innerRuns[this.innerRuns.length - 1].end < endWithContext)
        {
            newText += this.transform(initialText.substring(this.innerRuns[this.innerRuns.length - 1].end, endWithContext), 1);
            logTmi(`${ident}Built: '${newText}'`);
        }

        logTmi(`${ident}Built: '${newText + this.tag(true)}'`);
        return newText + this.tag(true /*end*/);
    }

    length() { return this.end - this.start; }

    startContextLength() { return 0; }
    endContextLength() { return 0; }

    tag(end) { return ''; }

    /// <summary>
    /// Trims the given text, where side is one of the following:
    ///  1. -2 : Don't trim
    ///  2. -1 : Trim left only
    ///  3.  0 : Trim both sides
    ///  4.  1 : Trim right only
    /// </summary>
    trim(text, side)
    {
        switch (side)
        {
            case 0:
                return text.trim();
            case -1:
                return text.replace(/^\s+/gm, '');
            case 1:
                return text.replace(/\s+$/gm, '');
            default:
                return text;
        }
    }

    escapeChars(text, chars)
    {
        if (text.indexOf('\\') == -1)
        {
            return text;
        }

        let newText = '';
        for (let i = 0; i < text.length; ++i)
        {
            if (i == text.length - 1)
            {
                // The last character can't be an escape, so just append it
                // and let the loop exit on its own
                newText += text[i];
                continue;
            }

            if (text[i] != '\\')
            {
                newText += text[i];
                continue;
            }

            if (text[i + 1] == '\\' || chars.indexOf(text[i + 1]) != -1)
            {
                ++i;
                newText += text[i];
                continue;
            }
            else
            {
                // lonesome backslack. Treat it as a normal backslash character
                newText += '\\';
            }
        }

        return newText;
    }


    transform(newText)
    {
        // First, detect escaped characters and remove the escape, unless
        // we're in code, in which case we display everything as-is.
        // "\*" becomes "*", "\_" becomes "_", etc.

        // Display inline and block code blocks as-is, but everything else should
        // strip escapes - 
        if (this.state != State.InlineCode && this.state != State.CodeBlock)
        {
            newText = this.escapeChars(newText, '\\*`_+~>');
        }

        // All items should have htmlentities replaced
        return newText.replace(/[&<>"'\/]/g, function(ch)
        {
            const entityMap =
            {
                '&' : '&amp;',
                '<' : '&lt;',
                '>' : '&gt;',
                '"' : '&quot;',
                "'" : '&#39;',
                '/' : '&#x2f;'
            };

            return entityMap[ch];
        });
    }

    static basicTag(tag, end)
    {
        return `<${end ? '/' : ''}${tag}>`;
    }
}

class Break extends Run
{
    constructor(start, parent)
    {
        super(State.LineBreak, start, start, parent);
    }

    tag(end) { return end ? '' : '<br />'; }
}

class Hr extends Run
{
    constructor(start, end, parent)
    {
        super(State.Hr, start, end, parent);
    }

    tag(end) { return end ? '' : '<hr />'; }


    // Indicators can have a variable number of characters, but we never want to actually print anything
    transform(newText, side) { return ''; }
}

class Div extends Run
{
    constructor(start, end, text, parent)
    {
        super(State.Div, start, end, parent);
        this.text = text.substring(start, end);
    }

    tag(end)
    {
        if (end)
        {
            return "</div>";
        }

        return '<div class="mdDiv">';
    }

    startContextLength()
    {
        let newlines = 0;
        while (this.text[newlines] == '\n')
        {
            ++newlines;
        }

        return newlines;
    }

    endContextLength()
    {
        let newlines = 0;
        while (this.text[this.text.length - newlines - 1] == '\n')
        {
            --newlines;
        }

        return -newlines;
    }

    transform(newText, side)
    {
        return super.transform(this.trim(newText, side));
    }
}

class Header extends Run
{
    constructor(start, end, headerLevel, parent)
    {
        super(State.Header, start, end, parent);
        this.headerLevel = headerLevel;
    }

    startContextLength()
    {
        return this.headerLevel + 1;
    }

    tag(end)
    {
        return `<${end ? '/' : ''}h${this.headerLevel}>`;
    }


    // Trailing # are removed (and strip it while we're at it)
    transform(newText, side)
    {
        newText = this.trim(newText, side);
        let i = newText.length - 1;
        while (i >= 0 && newText[i] == '#')
        {
            if (i != 0 && newText[i - 1] == '\\')
            {
                break;
            }

            --i;
        }

        return super.transform(this.trim(newText.substring(0, i + 1), side));
    }
}

class BlockQuote extends Run
{
    constructor(start, end, nestLevel, parent)
    {
        super(State.BlockQuote, start, end, parent);
        this.nestLevel = nestLevel;
    }

    startContextLength() { return 1; }
    endContextLength() { return 0; }

    tag(end) { return Run.basicTag('blockquote', end); }

    transform(newText, side)
    {
        // Look for 'newline + >' and remove them.
        let transformed = '';
        for (let i = 0; i < newText.length; ++i)
        {
            if (newText[i] != '\n')
            {
                transformed += newText[i];
                continue;
            }

            while (i + 1 < newText.length && /[> ]/.test(newText[i + 1]))
            {
                ++i;
            }
        }

        return super.transform(transformed);
    }
}

class UnorderedList extends Run
{
    constructor(start, end, nestLevel, parent)
    {
        super(State.UnorderedList, start, end, parent);
        this.nestLevel = nestLevel;
    }

    startContextLength() { return 0; }
    endContextLength() { return 0; }

    tag(end) { return Run.basicTag('ul', end); }
}

class OrderedList extends Run
{
    constructor(start, end, nestLevel, listStart, parent)
    {
        super(State.OrderedList, start, end, parent);
        this.nestLevel = nestLevel;
        this.listStart = listStart;
    }

    startContextLength() { return 0; }
    endContextLength() { return 0; }

    tag(end)
    {
        if (end)
        {
            return '</ol>';
        }

        return `<ol start='${this.listStart}'>`;
    }
}

class ListItem extends Run
{
    constructor(start, end, parent)
    {
        super(State.ListItem, start, end, parent);
    }

    startContextLength() { return 2; }
    endContextLength() { return 0; }

    tag(end) { return Run.basicTag('li', end); }
}

class Url extends Run
{
    constructor(start, end, text, url, parent)
    {
        super(State.Url, start, end, parent);
        this.text = text;
        this.url = url;
    }

    startContextLength() { return 1; }

    // The url should be stripped here, so subtract its length and ']()'
    endContextLength() { return this.url.length + 3; }

    tag(end)
    {
        if (end)
        {
            return '</a>';
        }

        return `<a href="${encodeURI(this.url)}">`;
    }

    transform(newText, side)
    {
        return super.transform(this.escapeChars(newText, '[]'));
    }
}

class Image extends Run
{
    constructor(start, end, altText, url, width, height, parent)
    {
        super(State.Image, start, end, parent);
        this.altText = altText;
        this.url = url;
        this.width = width;
        this.height = height;
    }

    // Nothing can be inside of images. The entire content is either
    // the alt-text or url, neither of which can be styled
    startContextLength() { return 0; }
    endContextLength() { return this.end - this.start; }


    tag(end)
    {
        if (end)
        {
            return '';
        }

        let base = `<img src="${encodeURI(this.url)}" altText=${super.transform(this.altText)}`;
        if (this.width != -1)
        {
            base += ` width="${this.width}px"`;
        }

        if (this.height != -1)
        {
            base += ` height="${this.height}px"`;
        }

        return base + '>';
    }

    // Inline tag, no actual content
    transform(newText, side)
    {
        return '';
    }
}

class CodeBlock extends Run
{
    constructor(start, end, text, indent, backtick, parent)
    {
        super(State.CodeBlock, start, end, parent);
        this.text = text.substring(start, end);
        this.indent = indent;
        this.backtick = backtick;
    }

    tag(end) { return Run.basicTag('pre', end); }

    buildCodeBlock(text, fn)
    {
        this.finalText = '';
        let lines = text.split('\n');
        this.pad = lines.length.toString().length;
        lines.forEach(fn, this);
    }

    lineNumber(line, pad)
    {
        line = line.toString();
        line += ' '.repeat(pad - line.length);
        return `<span class='codeLineNumber'>${line}</span>`;
    }
}

class BacktickCodeBlock extends CodeBlock
{
    constructor(start, end, indent, text, parent)
    {
        super(start, end, text, indent, true /*backtick*/, parent);
    }

    startContextLength() { return this.text.indexOf('\n') + 1; }
    endContextLength() { return 4; }

    transform(newText, side)
    {
        newText = super.transform(newText);
        this.buildCodeBlock(newText, function(line, i)
        {
            this.finalText += this.lineNumber(i + 1, this.pad) + line.substring(this.indent) + '\n';
        });

        return this.finalText;
    }
}

class IndentCodeBlock extends CodeBlock
{
    constructor(start, end, text, indent, firstIsList, parent)
    {
        super(start, end, text, indent, false /*backtick*/, parent);
        this.firstIsList = firstIsList;
    }

    startContextLength()
    {
        if (this.firstInList)
        {
            return 4;
        }

        return this.indent;
    }

    endContextLength() { return 0; }

    transform(newText, side)
    {
        newText = super.transform(this.text);
        this.buildCodeBlock(newText, function(line, i)
        {
            const lineNumber = this.lineNumber(i + 1, this.pad);
            if (i == 0 && this.firstIsList)
            {
                this.finalText += lineNumber + line.substring(4) + '\n';
            }
            else
            {
                this.finalText += lineNumber + line.substring(this.indent) + '\n';
            }
        });

        return this.finalText;
    }
}

class Table extends Run
{
    constructor(start, end, table, parent)
    {
        super(State.Table, start, end, parent);
        this.table = table;
    }

    startContextLength() { return 0; }
    endContextLength() { return 0; }

    tag(end) { return Run.basicTag('table', end); }

    transform(newText, side)
    {
        const wrap = (text, wrapper) => `<${wrapper}>${text}</${wrapper}>`;
        const td = function(text, align)
        {
            if (align == -2)
            {
                return `<td>${text}</td>`;
            }

            return '<td align="' + (align == -1 ? 'left' : align == 0 ? 'center' : 'right') + `">${text}</td>`;
        }
        // Ignore the text and use our table to build this up
        let text = '';
        let header = '';
        for (let i = 0; i < this.table.header.length; ++i)
        {
            header += td(this.table.header[i], this.table.columnAlign[i]);
        }

        header = wrap(wrap(header, 'tr'), 'thead');

        let body = '';
        for (let row = 0; row < this.table.rows.length; ++row)
        {
            let rowText = '';
            for (let col = 0; col < this.table.rows[row].length; ++col)
            {
                rowText += td(this.table.rows[row][col], this.table.columnAlign[col]);
            }

            body += wrap(rowText, 'tr');
        }

        body = wrap(body, 'tbody');
        return header + body;
    }
}

class InlineCodeRun extends Run
{
    constructor(start, end, text, parent)
    {
        super(State.InlineCode, start, end, parent);
        this.text = text.substring(start, end);
        this._backticks = 0;
        while(this.text[this._backticks] == '`')
        {
            ++this._backticks;
        }
    }

    startContextLength() { return this._backticks; }
    endContextLength() { return this._backticks; }

    tag(end) { return Run.basicTag('code', end); }
}

class Bold extends Run
{
    constructor(start, end, parent)
    {
        super(State.Bold, start, end, parent);
    }

    startContextLength() { return 2; }
    endContextLength() { return 2; }

    tag(end) { return Run.basicTag('strong', end); }
}

class Italic extends Run
{
    constructor(start, end, parent)
    {
        super (State.Italic, start, end, parent);
    }

    startContextLength() { return 1; }
    endContextLength() { return 1; }

    tag(end) { return Run.basicTag('em', end); }
}

class Underline extends Run
{
    constructor(start, end, parent)
    {
        super(State.Underline, start, end, parent);
    }

    startContextLength() { return 2; }
    endContextLength() { return 2; }

    tag(end) { return Run.basicTag('ins', end); }
}

class Strikethrough extends Run
{
    constructor(start, end, parent)
    {
        super(State.Strikethrough, start, end, parent);
    }

    startContextLength() { return 2; }
    endContextLength() { return 2; }

    tag(end) { return Run.basicTag('s', end); }
}

class HtmlComment extends Run
{
    constructor(start, end, parent)
    {
        super(State.HtmlComment, start, end, parent);
    }

    tag(end) { return ''; }

    transform(newText, side)
    {
        // Leave exactly as-is, we want it to be parsed as an HTML comment
        return newText;
    }
}



const testMarkdown = function(testStr='')
{
    // let testStr = "Hello, world\n## [## `Header`2`](https://google.com)\n#Bad header\n# Header 1";
    if (testStr.length == 0)
    {
        testStr = "Hello, __There, how__ __are_ you_?";
    }

    logInfo(`testing: '${testStr}'`);
    return new Markdown(testStr).parse();
}

const testSuite = function()
{
    // Simple tests for non-nested scenarios
    testHeaders();
    testUrl();
    testInline();
    testBold();
    testItalic();

    testMixed();
}

const testHeaders = function()
{
    logInfo('Testing Basic Header Functionality');
    let testStrings =
    [
        { input : '# Header 1', expected : '<div class="mdDiv"><h1>Header 1</h1></div>' },
        { input : '## Header 2', expected : '<div class="mdDiv"><h2>Header 2</h2></div>' },
        { input : '### Header 3', expected : '<div class="mdDiv"><h3>Header 3</h3></div>' },
        { input : '#### Header 4', expected : '<div class="mdDiv"><h4>Header 4</h4></div>' },
        { input : '##### Header 5', expected : '<div class="mdDiv"><h5>Header 5</h5></div>' },
        { input : '###### Header 6', expected : '<div class="mdDiv"><h6>Header 6</h6></div>' },
        { input : '####### Header 7', expected : '<div class="mdDiv">####### Header 7</div>' },
        { input : '##Header 2', expected : '<div class="mdDiv">##Header 2</div>' },
        { input : '  ## Header 2', expected : '<div class="mdDiv"><h2>Header 2</h2></div>' },
        { input : '##   Header 2', expected : '<div class="mdDiv"><h2>Header 2</h2></div>' },
        { input : '  ##   Header 2', expected : '<div class="mdDiv"><h2>Header 2</h2></div>' },
        { input : ' ## Header 2 ###  ', expected : '<div class="mdDiv"><h2>Header 2</h2></div>' }
    ];

    testCore(testStrings);
}

const testUrl = function()
{
    logInfo('Testing Basic Url Functionality');
    let testStrings =
    [
        {
            input : '[Link](danrahn.com)',
            expected : '<div class="mdDiv"><a href="danrahn.com">Link</a></div>'
        },
        {
            input : '[Add some text here](https://danrahn.com)',
            expected : '<div class="mdDiv"><a href="https://danrahn.com">Add some text here</a></div>'
        },
        {
            input : '[https://backwards.com](Uh oh!)',
            expected : '<div class="mdDiv"><a href="Uh%20oh!">https:&#x2f;&#x2f;backwards.com</a></div>'
        },
        {
            input : '[Link[](danrahn.com)',
            expected : '<div class="mdDiv">[Link<a href="danrahn.com"></a></div>'
        },
        {
            input : '[Link[Link](danrahn.com)](danrahn.com)',
            expected : '<div class="mdDiv">[Link<a href="danrahn.com">Link</a>](danrahn.com)</div>'
        }
    ];

    testCore(testStrings);
}

const testInline = function()
{
    logInfo('Testing Basic Inline Functionality');
}

const testBold = function()
{
    logInfo('Testing Basic Bold Functionality');
}

const testItalic = function()
{
    logInfo('Testing Basic Italic Functionality');
}

const testMixed = function()
{
    logInfo('Testing Mixed Functionality');
    let testStrings =
    [
        {
            input : '# ___Header_ [`1`](link)__',
            expected : '<div class="mdDiv"><h1><strong><em>Header</em> <a href="link"><code>1</code></a></strong></h1></div>'
        },
        {
            input : '# ___Header__ [`1`](link)_',
            expected : '<div class="mdDiv"><h1><em><strong>Header</strong> <a href="link"><code>1</code></a></em></h1></div>'
        },
        {
            input : '**_Hello_**',
            expected : '<div class="mdDiv"><strong><em>Hello</em></strong></div>'
        },
        {
            input : '**_Hello**_',
            expected : '<div class="mdDiv"><strong>_Hello</strong>_</div>'
        }
    ];

    testCore(testStrings);
}

const testCore = function(testStrings)
{
    testStrings.forEach(function(str)
    {
        let result = new Markdown(str.input).parse();
        if (result == str.expected)
        {
            logInfo(`    Passed! [${str.input}] => [${str.expected}]`);
        }
        else
        {
            logWarn(`    FAIL! Input: [${str.input}]\n\tExpected: [${str.expected}]\n\tActual: [${result}]`);
        }
    });
}
