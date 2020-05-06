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
    InlineCode : 11,
    Bold : 12,
    Underline : 13,
    Italic : 14,
    Strikethrough : 15


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
    constructor(text)
    {
        let trim = 0;
        while (text[trim] == '\n')
        {
            ++trim;
        }
        this.text = text.substring(trim);
        this.currentRun = null;
    }

    _inAList(index)
    {
        // Loops backwards looking for the start of a list, then
        // use the list find routine to see if `index` is inside the list

        // Have some leeway here by allowing a top-level list to be indented a
        // bit (even though it shouln't be).
        let data = { 'inList' : false, 'listEnd' : -1 };
        let spaces = '';
        let subText = this.text.substring(0, index);
        for (let i = 0; i < 3; ++i)
        {
            const regex = new RegExp(`\n${spaces}(\\*|\\d+\\.) `, 'g');
            let matches = [[-1, false]];
            let lastMatch;
            while ((lastMatch = regex.exec(subText)) != null)
            {
                matches.push([lastMatch.index, lastMatch[1] != '*']);
            }

            let prevList = matches[matches.length - 1][0];
            while (prevList != -1 && this._checkHr(prevList + 1, false /*addHr*/))
            {
                matches.pop();
                prevList = matches[matches.length - 1][0];
            }

            if (prevList != -1)
            {
                data.listEnd = this._listEnd(prevList + spaces.length + 1, Math.floor(spaces.length / 2), matches[matches.length - 1][1] /*ordered*/);
                data.inList = data.listEnd > index;
                return data;
            }

            // No newline needed if it's the start of the text
            // if (prevList == -1 && this.text.startsWith(`${spaces}* `) && !this._checkHr(0 /*addHr*/))
            if (prevList == -1 && new RegExp(`^${spaces}(\\*|\\d+\\.) `).test(this.text) && !this._checkHr(0 /*addHr*/))
            {
                data.listEnd = this._listEnd(spaces.length, Math.floor(spaces.length / 2), !this.text.startsWith(`${spaces}* `) /*ordered*/);
                data.inList = data.listEnd > index;
                return data;
            }

            spaces += ' ';
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

            if (maybeBlock && (prevNew > 1 || (prevIndex == -1 && (this.text.startsWith('    ') || this.text.startsWith('\n')))))
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

            if (start + 4 != this.text.length)
            {
                searchFor += '\n';
            }

            let cb = this.text.indexOf(searchFor, start);
            if (cb == -1 || cb > end)
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

        // Always wrap our first element in a div
        let i;
        for (i = 0; i < this.text.length && this.text[i] == '\n'; ++i);
        let end = this._getNextDivEnd(i);
        let div = new Div(0, end, this.text, this.currentRun);
        this.currentRun = div;

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

                    // Couldn't parse as a code block, so try an inline block. Note that we need to match
                    // the exact number of initial backticks (before a newline, for now). This allows things like
                    // "```` Start a code block with ``` ````".
                    if (!stateAllowedInState(State.InlineCode, this.currentRun, i))
                    {
                        continue;
                    }

                    let findStr = '`';
                    let start = i + 1;
                    while (start < this.text.length && this.text[start] == '`')
                    {
                        findStr += '`';
                        ++start;
                    }

                    if (i + (findStr.length * 2) - 1 >= this.text.length)
                    {
                        // Impossible for us to find a match. Need at least (2 * findstr) -1 beyond i
                        continue;
                    }

                    // Require inline blocks to be on a single line. Not all parsers have this
                    // restriction, but if someone is trying to inline a lot of code, they're
                    // probably better off using a code block anyway.
                    // Should probably revisit though. Multiline stuff can be useful in more general
                    // cases. Instead of a single newline breaking this, a double newline will.
                    let lineEnd = this.text.indexOf('\n', i);
                    if (lineEnd == -1) { lineEnd = this.text.length; }
                    let end = this.text.indexOf(findStr, i + 1);

                    if (end == -1)
                    {
                        continue;
                    }

                    end += findStr.length;

                    if (end > lineEnd || end > this.currentRun.end)
                    {
                        continue;
                    }

                    let inline = new InlineCodeRun(i, end, this.text, this.currentRun);
                    this.currentRun = inline;

                    // Can't add anything to an inline block, so increment the cursor
                    i = end - 1;
                    logTmi(`Added inline code block: start=${inline.start}, end=${inline.end}`);
                    break;
                }
                case '-':
                {
                    if (this._checkHr(i))
                    {
                        i = this.text.indexOf('\n', i) - 1;
                        if (i == -2)
                        {
                            i = this.text.length;
                        }
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
                        i = this.text.indexOf('\n', i) - 1;
                        if (i == -2)
                        {
                            i = this.text.length - 1;
                        }

                        continue;
                    }

                    // Unordered list. Returns true if we successfully parsed an unordered list item
                    if (this._checkUl(i))
                    {
                        break;
                    }

                    if (this.text.substring(this.text.lastIndexOf('\n') + 1, i).length == 0 &&
                        i != this.text.length &&
                        isWhitespace(this.text[i + 1]))
                    {
                        // Unordered lists. NYI
                        break;
                    }
                    /* __fallthrough, bold/italic */
                }
                case '_':
                {
                    // First, check for HR
                    if (this._checkHr(i))
                    {
                        i = this.text.indexOf('\n', i) - 1;
                        if (i == -2)
                        {
                            i = this.text.length - 1;
                        }

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

                    if (this._isEscaped(i))
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
                    if (this._isEscaped(i) || i == this.text.length - 1 || !/\d+\. /.test(this.text.substring(i)))
                    {
                        continue;
                    }

                    // Two spaces adds a nesting level
                    let prevNewline = this.text.lastIndexOf('\n', i);
                    let spaces = this.text.substring(prevNewline + 1, i);
                    if (!/^ *$/.test(spaces))
                    {
                        // Something other than spaces precedes this
                        continue;
                    }

                    let nestLevel = Math.floor(spaces.length / 2);

                    // First need to determine if this is a new list. If so, create the <ol>
                    if (this.currentRun.state != State.OrderedList || nestLevel > this.currentRun.nestLevel)
                    {
                        // Need bounds for the entire list
                        let end = this._listEnd(i, nestLevel, true /*ordered*/);
                        let ol = new OrderedList(i, end, nestLevel, this.text.substring(i).match(/\d+/)[0], this.currentRun);
                        this.currentRun = ol;
                        logTmi(`Adding Ordered List: start=${i}, end=${end}, listStart=${ol.listStart}, nestLevel=${nestLevel}`);
                    }

                    let liEnd = this._liEnd(i, nestLevel, true /*ordered*/);
                    let li = new ListItem(i, liEnd, this.currentRun);
                    this.currentRun = li;
                    logTmi(`Adding ListItem: start=${i}, end=${liEnd}, nestLevel=${nestLevel}`);
                }
                case ' ':
                {
                    // Potential code block, alternative to three backticks

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
                default:
                {
                    break;
                }
            }
        }

        logVerbose(topRun, 'Parsing tree');
        let html = topRun.convert(this.text);
        let perfStop = window.performance.now();
        logVerbose(`Parsed markdown in ${perfStop - perfStart}ms`);
        return html;
    }

    _checkBacktickCodeBlock(start)
    {
        if (!/```/.test(this.text.substring(start - 2, start + 1)))
        {
            return -1;
        }

        // If start ever get around to it, text after the ticks indicates the language
        // (e.g. "```cpp" for C++). For now though, just ignore it.

        let minspaces = 0;
        let firstIsList = false;
        if (this.currentRun.state == State.ListItem)
        {
            let nestLevel = this.currentRun.parent.nestLevel;
            minspaces = (nestLevel + 1) * 2;
            let type = this.currentRun.parent.state;
            let context = this.text.substring(this.text.lastIndexOf('\n', start), start + 2);
            let liStartRegex = new RegExp(`^\\n? {${nestLevel * 2}} ?${type == State.OrderedList ? '\\d+\\.' : '\\*'} \`\`\`\n`);
            if (!liStartRegex.test(context))
            {
                // Not on the same line as the list item start, check if it's a valid continuation
                if (!new RegExp(`^\\n {${minspaces}}\`\`\``).test(context))
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
            if (!/^\n?```\n?$/.test(this.text.substring(start - 3, start + 2)))
            {
                return -1;
            }
        }

        // Each subsequent line must have at least minspaces before it, otherwise it's an invalid block
        let newline = this.text.indexOf('\n', start);
        if (newline == -1 || newline == this.text.length - 1)
        {
            return -1;
        }

        let end = newline;
        let next = this._indexOrLast('\n', newline + 1);
        let nextline = this.text.substring(newline + 1, next + 1);
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

    _checkUl(start)
    {
        // Unordered lists. Interaction with other elements will be especially tricky, but this
        // only deals with the list structure itself.

        if (this._isEscaped(start) || start == this.text.length - 1 || this.text[start + 1] != ' ')
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

        // First need to determine if this is a new list. If so, create the <ul>
        if (this.currentRun.state != State.UnorderedList || nestLevel > this.currentRun.nestLevel)
        {
            // Need bounds for entire list. There are several rules that can trip us up.
            // 1. If the next non-blank line is indented by two spaces, it's still part of the list, no matter
            //    how many newlines there are.
            //    This also adjusts for nesting. Second-level lists can have items indented by four spaces to continue

            let end = this._listEnd(start, nestLevel, false /*ordered*/);
            let ul = new UnorderedList(start, end, nestLevel, this.currentRun);
            this.currentRun = ul;
            logTmi(`Adding Unordered List: start=${start}, end=${end}, nestLevel=${nestLevel}`);
        }

        let liEnd = this._liEnd(start, nestLevel, false /*ordered*/);
        let li = new ListItem(start, liEnd, this.currentRun);
        this.currentRun = li;
        logTmi(`Adding ListItem: start=${start}, end=${liEnd}, nestLevel=${nestLevel}`);
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
        let end = this.text.indexOf('\n', start);
        end = end == -1 ? this.text.length : end;
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
                    if (i == start || toFind[idx] != ']')
                    {
                        break;
                    }

                    // Nested link? If so, we only want the innermost nested layer
                    // TODO: Check for ! (images)
                    if (!this._isEscaped(i) && this._testUrl(i))
                    {
                        return false;
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
    constructor(state, start, parent=null)
    {
        this.state = state;
        this.start = start;
        this.end = 0;
        this.parent = parent;
        if (parent != null)
        {
            parent.innerRuns.push(this);
        }
        this.innerRuns = [];
        this.length = function() { return this.end - this.start; }

        // Conversion process:
        //  create start tag
        //    if first child start is not this start, add from initialText
        //  convert() children
        //  create end tag
        this.convert = function(initialText)
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


        this.startContextLength = function() { return 0; }
        this.endContextLength = function() { return 0; }

        this.tag = () => '';

        /// <summary>
        /// Trims the given text, where side is one of the following:
        ///  1. -2 : Don't trim
        ///  2. -1 : Trim left only
        ///  3.  0 : Trim both sides
        ///  4.  1 : Trim right only
        /// </summary>
        this.trim = function(text, side)
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

        this.wrapInDiv = function()
        {
            return this.parent == null || this.parent.state == State.None;
        };

        this.escapeChars = function(text, chars)
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
}

class Break extends Run
{
    constructor(start, parent)
    {
        super(State.LineBreak, start, parent);
        this.end = start;
        this.tag = (end) => end ? '' : '<br />';
        this.wrapInDiv = () => false;
    }
}

class Hr extends Run
{
    constructor(start, end, parent)
    {
        super(State.Hr, start, parent);
        this.end = end;

        this.tag = (end) => end ? '' : '<hr />';
    }


    // Indicators can have a variable number of characters, but we never want to actually print anything
    transform(newText, side) { return ''; }
}

class Div extends Run
{
    constructor(start, end, text, parent)
    {
        super(State.Div, start, parent);
        this.end = end;
        this.text = text.substring(start, end);
        this.tag = function(end)
        {
            if (end)
            {
                return "</div>";
            }

            return '<div class="mdDiv">';
        }

        this.startContextLength = function()
        {
            let newlines = 0;
            while (this.text[newlines] == '\n')
            {
                ++newlines;
            }

            return newlines;
        }

        this.endContextLength = function()
        {
            let newlines = 0;
            while (this.text[this.text.length - newlines - 1] == '\n')
            {
                --newlines;
            }

            return -newlines;
        }
    }

    transform(newText, side)
    {
        return super.transform(this.trim(newText, side));
    }
}

class Header extends Run
{
    constructor(start, end, headerLevel, parent=null)
    {
        super(State.Header, start, parent);
        this.end = end;
        this.headerLevel = headerLevel;

        this.startContextLength = function() { return this.headerLevel + 1; }

        this.tag = function(end)
        {
            return `<${end ? '/' : ''}h${this.headerLevel}>`;
        }

        this.wrapInDiv = () => false;
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
        super(State.BlockQuote, start, parent);
        this.end = end;
        this.nestLevel = nestLevel;

        this.startContextLength = () => 1;
        this.endContextLength = () => 0;

        this.tag = (end) => `<${end ? '/' : ''}blockquote>`;
    }

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
        super(State.UnorderedList, start, parent);
        this.end = end;
        this.nestLevel = nestLevel;

        this.startContextLength = () => 0;
        this.endContextLength = () => 0;

        this.tag = (end) => `<${end ? '/' : ''}ul>`;
    }
}

class OrderedList extends Run
{
    constructor(start, end, nestLevel, listStart, parent)
    {
        super(State.OrderedList, start, parent);
        this.end = end;
        this.nestLevel = nestLevel;
        this.listStart = listStart;

        this.startContextLength = () => 0;
        this.endContextLength = () => 0;

        this.tag = function(end)
        {
            if (end)
            {
                return '</ol>';
            }

            return `<ol start='${this.listStart}'>`;
        }
    }
}

class ListItem extends Run
{
    constructor(start, end, parent)
    {
        super(State.ListItem, start, parent);
        this.end = end;

        this.startContextLength = () => 2;
        this.endContextLength = () => 0;

        this.tag = (end) => `<${end ? '/' : ''}li>`;
    }
}

class Url extends Run
{
    constructor(start, end, text, url, parent)
    {
        super(State.Url, start, parent);
        this.end = end;
        this.text = text;
        this.url = url;

        this.startContextLength = function() { return 1; }

        // The url should be stripped here, so subtract its length and ']()'
        this.endContextLength = function() { return this.url.length + 3; }

        this.tag = function(end)
        {
            if (end)
            {
                return '</a>';
            }

            return `<a href="${encodeURI(this.url)}">`;
        }
    }

    transform(newText, side)
    {
        return super.transform(this.escapeChars(newText, '[]'));
    }
}

class CodeBlock extends Run
{
    constructor(start, end, text, indent, backtick, parent)
    {
        super(State.CodeBlock, start, parent);
        this.end = end;
        this.text = text.substring(start, end);
        this.indent = indent;
        this.backtick = backtick;

        this.tag = (end) => `<${end ? '/' : ''}pre>`;
    }

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

        this.startContextLength = function() { return this.text.indexOf('\n') + 1; }
        this.endContextLength = () => 4;
    }

    transform(newText, side)
    {
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

        this.startContextLength = function()
        {
            if (firstIsList)
            {
                return 4;
            }

            return indent;
        }

        this.endContextLength = () => 0;
    }

    transform(newText, side)
    {
        this.buildCodeBlock(this.text, function(line, i)
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

class InlineCodeRun extends Run
{
    constructor(start, end, text, parent)
    {
        super(State.InlineCode, start, parent);
        this.end = end;
        this.text = text.substring(start, end);
        this._backticks = 0;
        while(this.text[this._backticks] == '`')
        {
            ++this._backticks;
        }

        this.startContextLength = function() { return this._backticks; }
        this.endContextLength = function() { return this._backticks; }

        this.tag = (end) => `<${end ? '/' : ''}code>`;
    }
}

class Bold extends Run
{
    constructor(start, end, parent)
    {
        super(State.Bold, start, parent);
        this.end = end;

        this.startContextLength = () => 2;
        this.endContextLength = () => 2;

        this.tag = function(end)
        {
            return `<${end ? '/' : ''}strong>`;
        }
    }
}

class Italic extends Run
{
    constructor(start, end, parent)
    {
        super (State.Italic, start, parent);
        this.end = end;

        this.startContextLength = () => 1;
        this.endContextLength = () => 1;

        this.tag = function(end)
        {
            return `<${end ? '/' : ''}em>`;
        }
    }
}

class Underline extends Run
{
    constructor(start, end, parent)
    {
        super(State.Underline, start, parent);
        this.end = end;

        this.startContextLength = () => 2;
        this.endContextLength = () => 2;

        this.tag = function(end)
        {
            if (end)
            {
                return '</ins>';
            }

            return '<ins>';
        }
    }
}

class Strikethrough extends Run
{
    constructor(start, end, parent)
    {
        super(State.Strikethrough, start, parent);
        this.end = end;

        this.startContextLength = () => 2;
        this.endContextLength = () => 2;

        this.tag = function(end)
        {
            if (end)
            {
                return '</s>';
            }

            return '<s>';
        }
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
