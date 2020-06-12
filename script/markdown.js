/* exported markdownHelp */

/* eslint-disable max-lines-per-function */ // Will this ever get fixed? Probably not.
/* eslint-disable complexity */ // I should fix this. Whether I actually get around to it, who knows!
/* eslint-disable class-methods-use-this */ /* Inherited classes may use 'this', and making
                                               the base class method static breaks this */

// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */

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
    Table : 10,
    Url : 11,
    Image : 12,
    InlineCode : 13,
    Bold : 14,
    Underline : 15,
    Italic : 16,
    Strikethrough : 17,
    HtmlComment : 18
};

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
        case State.Table:
            return 'Table';
        default:
            return 'Unknown state: ' + state;
    }
};

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
        case State.Table:
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
};

const blockMarkdown = function(state)
{
    switch (state)
    {
        case State.Header:
        case State.BlockQuote:
        case State.CodeBlock:
            return true;
        default:
            return false;
    }
};

const isWhitespace = function(ch)
{
    return /\s/.test(ch);
};

/// [\w\d], without the underscore
const isAlphanumeric = function(ch)
{
    return /[a-zA-Z0-9]/.test(ch);
};

class Markdown
{
    constructor()
    {
        this.topRun = null;
        this._reset('', false);
    }

    _checkHr(index, addHr=true)
    {
        let sep = this.text[index];
        let linebreak = this._indexOrLast('\n', index);
        let line = this.text.substring(this.text.lastIndexOf('\n', index) + 1, linebreak).replace(/ /g, '');
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

    _trimInput(text)
    {
        let trim = 0;
        while (text[trim] == '\n')
        {
            ++trim;
        }

        text = text.substring(trim);

        // Everything's easier with spaces
        return text.replace(/\t/g, '    ');
    }

    _reset(text, inlineOnly, diffStart)
    {
        this.text = text;
        this.sameText = false;
        this._inlineOnly = inlineOnly;
        this._cachedParse = '';
        this._parseTime = 0;
        this._inParse = false;

        if (diffStart == 0 || this.topRun === null || parseInt(localStorage.getItem('mdCache')) == 0)
        {
            this.topRun = new Run(State.None, 0, null);
            this.topRun.end = this.text.length;
            this.currentRun = this.topRun;
            return 0;
        }

        let i = 0;
        for (; i < this.topRun.innerRuns.length; ++i)
        {
            if (this.topRun.innerRuns[i].end >= diffStart)
            {
                break;
            }
        }

        this.topRun.cached = '';
        if (i != this.topRun.innerRuns.length)
        {
            this.topRun.innerRuns.splice(i, this.topRun.innerRuns.length - i);
        }

        this.topRun.end = this.text.length;
        this.currentRun = this.topRun;
        return this.topRun.innerRuns.length == 0 ? 0 : this.topRun.innerRuns[this.topRun.innerRuns.length - 1].end;
    }

    /// <summary>
    /// Only try to reparse what we need to
    /// </summary>
    _checkCache(text)
    {
        let diff = 0;
        let max = Math.min(text.length, this.text.length);
        while (diff != max && text[diff] == this.text[diff++]);
        return diff;
    }

    parse(text, inlineOnly=false)
    {
        if (this._inParse)
        {
            log("Can't call parse when we're already parsing!", 0, 0, LOG.Critical);
            return '';
        }

        // Do some initial pruning, and get rid of carriage returns
        text = this._trimInput(text).replace(/\r/g, '');
        if (this._cachedParse.length != 0 &&
            this._inlineOnly == inlineOnly &&
            this.text == text)
        {
            logTmi('Identical content, returning cached content');
            this.sameText = true;
            return this._cachedParse;
        }

        let i = this._reset(text, inlineOnly, this._checkCache(text));
        this._inParse = true;

        let perfStart = window.performance.now();

        this._urls = {};
        for (; i < this.text.length; ++i)
        {
            while (i == this.currentRun.end)
            {
                logTmi('Resetting to parent: ' + (this.currentRun.parent === null ? '(null)' : stateToStr(this.currentRun.parent.state)));
                this.currentRun = this.currentRun.parent;
            }

            switch (this.text[i])
            {
                case '#':
                {
                    i = this._checkHeader(i);
                    break;
                }
                case '!':
                {
                    let imageEnd = this._checkImage(i);
                    if (imageEnd != -1)
                    {
                        // Nothing inside of an image is allowed
                        i = imageEnd - 1;
                    }

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

                    let url;
                    if (result.type == 0)
                    {
                        url = new Url(i, result.end, result.text, result.url, this.currentRun);
                    }
                    else if (result.type == 1)
                    {
                        url = new ExtendedUrl(i, result.end, result.text, result.url, this._urls, this.currentRun);
                    }
                    else
                    {
                        url = new ExtendedUrlTag(i, result.end, this.currentRun);
                        i = result.end - 1;
                    }

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
                }

                /* __fallthrough, bold/italic */
                case '_':
                {
                    // First, check for HR
                    if (this._checkHr(i))
                    {
                        i = this._indexOrLast('\n', i) - 1;
                        continue;
                    }

                    // Only returns true if we added a bold run, indicating that we should
                    // also increment i as to not be included in a subsequent check
                    if (this._checkBoldItalic(i))
                    {
                        ++i;
                    }

                    break;
                }
                case '~':
                {
                    if (this._isEscaped(i))
                    {
                        continue;
                    }

                    // Multiline code block if there are three of these in a row
                    let multilineBlockEnd = this._checkBacktickCodeBlock(i);
                    if (multilineBlockEnd != -1)
                    {
                        i = multilineBlockEnd - 1;
                        continue;
                    }

                }

                /*__fallthrough for strikethrough*/
                case '+':
                {
                    if (this._checkStrikeAndUnderline(i))
                    {
                        // Skip over the second ~/+, as it's part of
                        // the run we just created
                        ++i;
                    }
                    break;
                }
                case '>':
                {
                    this._checkBlockQuote(i);
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
                    // Potential code block, alternative to three backticks/tildes

                    let blockEnd = this._checkIndentCodeBlock(i);
                    if (blockEnd != -1)
                    {
                        i = blockEnd - 1;
                    }
                    break;
                }
                case '<':
                {
                    // Allow two things. Line breaks and comments
                    if (!this._isEscaped(i) && /<br ?\/?>/.test(this.text.substring(i, i + 5)))
                    {
                        let br = new Break(i, this.currentRun);
                        br.end = this.text.indexOf('>', i) + 1;
                        continue;
                    }

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

                    new HtmlComment(i, endComment, this.currentRun);
                    i = endComment - 1;
                    break;
                }
                case '|':
                {
                    // Tables
                    let tableEnd = this._checkTable(i);
                    if (tableEnd != -1)
                    {
                        i = tableEnd - 1;
                    }
                    break;
                }
                default:
                {
                    break;
                }
            }
        }


        logTmi(this.topRun, 'Parsing tree');
        this.markdownPresent = this.topRun.innerRuns.length != 0;
        let html = this.topRun.convert(this.text, this._inlineOnly).trim();
        this._cachedParse = html;
        this._inParse = false;
        let perfStop = window.performance.now();
        this._parseTime = perfStop - perfStart;
        if (this._inlineOnly)
        {
            logTmi(`Parsed inline markdown in ${perfStop - perfStart}ms`);
        }
        else
        {
            let str;
            if (parseInt(localStorage.getItem('mdCache')) == 0)
            {
                str = ' (Cache OFF)';
            }
            else
            {
                str = ' (Cache ON)';
            }

            logVerbose(`Parsed markdown in ${perfStop - perfStart}ms ${str}`);
        }
        return html;
    }

    _checkHeader(start)
    {
        // Headers need to be at the start of a line (or at least the first non-whitespace character)
        // Nested within a ListItem is still fine though, as long as they're at the beginning
        let newline = this.text.lastIndexOf('\n', start);

        let between = this.text.substring(newline + 1, start);
        if (between.replace(/ /g, '').length != 0 &&
            (this.currentRun.state != State.ListItem || !/^ *(\*|\d+\.) /.test(between)))
        {
            return start;
        }

        if (!stateAllowedInState(State.Header, this.currentRun, start))
        {
            return start;
        }

        let headingLevel = 1;
        while (start + 1 < this.text.length && this.text[start + 1] == '#')
        {
            ++headingLevel;
            ++start;
        }

        // h6 is the highest heading level possible,
        // and there must be a space after the header declaration
        if (headingLevel > 6 || start == this.text.length - 1 || this.text[start + 1] != ' ')
        {
            // Reset i and continue
            start -= (headingLevel - 1);
            return start;
        }

        let end = this.text.indexOf('\n', start);
        if (end == -1) { end = this.text.length; }
        let header = new Header(start - headingLevel + 1, end, headingLevel, this.text, this.currentRun);
        this.currentRun = header;
        logTmi(`Added header: start=${header.start}, end=${header.end}, level=${header.headerLevel}`);
        return start;
    }

    _checkImage(start)
    {
        if (this._isEscaped(start) || start == this.text.length - 1 || this.text[start + 1] != '[')
        {
            return -1;
        }

        let result = this._testUrl(start + 1);
        if (!result)
        {
            return -1;
        }

        if (this.currentRun.end < result.end)
        {
            return -1;
        }

        // Non-standard width/height syntax, since I explicitly don't want
        // to support direct HTML insertion.
        // ![AltText w=X,h=Y](url)
        let dimen = /[[ ]([wh])=(\d+%?)(?:,h=(\d+%?))?$/.exec(result.text);
        let width = '';
        let height = '';
        if (dimen !== null)
        {
            if (dimen[3])
            {
                width = dimen[2];
                height = dimen[3];
            }
            else if (dimen[1] == 'w')
            {
                width = dimen[2];
            }
            else
            {
                height = dimen[2];
            }
        }

        new Image(start, result.end, result.text, result.url, width, height, this.currentRun);
        return result.end;
    }

    _checkBoldItalic(start)
    {
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
        if (start != 0 && (isAlphanumeric(this.text[start - 1]) || this._isEscaped(start)))
        {
            return false;
        }

        let sep = this.text[start];

        // Man, I really need to compartmentalize this nasty processing loop

        // Also check that we aren't in any special regions of our current run
        let parentContextStartLength = this.currentRun.startContextLength();
        let parentContextEndLength = this.currentRun.endContextLength();
        if ((parentContextStartLength != 0 && start - this.currentRun.start < parentContextStartLength) ||
            (parentContextEndLength != 0 && this.currentRun.end - start <= parentContextEndLength))
        {
            return false;
        }

        let blockEnd = this.currentRun.end - this.currentRun.endContextLength();
        let separators = 1;
        let separatorIndex = start + 1;
        while (this.text[separatorIndex] == sep)
        {
            ++separators;
            ++separatorIndex;
        }

        // Next character in run must not be whitespace
        if (isWhitespace(this.text[separatorIndex]))
        {
            return false;
        }

        // Need to find a match for our separator.
        // Rules:
        //  An opening separator run must be preceeded by whitespace and end with non-whitespace
        // A closing separator run must be preceded by non-whitespace and end with whitespace
        let inline = false;
        let newline = false;
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

            if (this.text[separatorIndex] == '\n')
            {
                if (newline)
                {
                    // Double newline, inline element can't continue
                    return false;
                }

                newline = true;
                continue;
            }

            newline = false;

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

                    // Non-alphanumeric + separators + whitespace. This
                    // might actually be an end
                    potentialSeparators = 1;
                }
                else if (isWhitespace(this.text[separatorIndex - 1]))
                {
                    // Found an actual group of opening separators. Add it to our collection
                    foundMatch = true;
                    separators += potentialSeparators;
                    separatorIndex = psi;
                }
                else
                {
                    // Assume that separators surrounded by
                    // punctiation is closing. It's ambiguous
                    // and some choice has to be made
                    potentialSeparators = 1;
                }
            }

            if (!foundMatch)
            {
                // Non-whitespace, see if it's an end sequence
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
            return false;
        }

        let isBold = false;
        let bi;
        if (this.text[start + 1] == sep && this.text[separatorIndex - 2] == sep)
        {
            logTmi(`Adding bold run: start=${start}, end=${separatorIndex}`);
            bi = new Bold(start, separatorIndex, this.currentRun);
            isBold = true;
        }
        else
        {
            logTmi(`Adding italic run: start=${start}, end=${separatorIndex}`);
            bi = new Italic(start, separatorIndex, this.currentRun);
        }

        this.currentRun = bi;
        return isBold;
    }

    _checkStrikeAndUnderline(start)
    {
        // Depending on what online visualizer I use, this does a multitude of things.
        // Usuall two strikes through (~~A~~), but sometimes it only takes one (~A~).
        // For others, one creates a subscript, and three creates a code block. Gah.
        //
        // For this parser, keep things simple for now. Two indicates a strikethrough.
        // They can be nested (though you shouldn't need it...) just like '*' and '_'
        //
        // What can/should be shared with bold/italic? Loops are __very__ similar, but it
        // gets tricky because '*' and '_' can be both bold _and_ italic
        if (start != 0 && (isAlphanumeric(this.text[start - 1]) || this._isEscaped(start)))
        {
            return false;
        }

        let sep = this.text[start];

        // Need at least 4 additional characters to make a complete run
        if (start >= this.text.length - 4 || this.text[start + 1] != sep)
        {
            return false;
        }

        let parentContextStartLength = this.currentRun.startContextLength();
        let parentContextEndLength = this.currentRun.endContextLength();
        if ((parentContextStartLength != 0 && start - this.currentRun.start < parentContextStartLength) ||
            (parentContextEndLength != 0 && this.currentRun.end - start <= parentContextEndLength))
        {
            return false;
        }

        let blockEnd = this.currentRun.end - this.currentRun.endContextLength();
        let separators = 2;
        let separatorIndex = start + 2;
        while (separatorIndex < this.text.length && this.text[separatorIndex] == sep)
        {
            ++separators;
            ++separatorIndex;
        }

        if (separators % 2 == 1)
        {
            //  Odd number of separators, not allowed here
            return false;
        }

        // Next character in run must not be whitespace
        if (isWhitespace(this.text[separatorIndex]))
        {
            return false;
        }

        // Need to find a match for our separator.
        // Keeping track of just inline code (and not block) is okay because we
        // currently don't allow these annotations to span multiple lines. If that
        // changes, this will have to change as well.
        let inline = false;
        let newline = false;
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

            if (this.text[separatorIndex] == '\n')
            {
                if (newline)
                {
                    // Double newline, inline element can't continue
                    return false;
                }

                newline = true;
                continue;
            }

            newline = false;

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

                    // Non alphanumeric + separators + whitespace. This
                    // might actually be an end
                    potentialSeparators = 1;
                }
                else if (isWhitespace(this.text[separatorIndex - 1]))
                {
                    // Found an actual group of opening separators. Add it to our collection
                    // Note that these separators must be in pairs of two, so if we have an
                    // odd number, round down.
                    foundMatch = true;
                    separators += potentialSeparators - (potentialSeparators % 2);
                    separatorIndex = psi;
                }
                else
                {
                    // Assume that separators surrounded by punctuation is
                    // closing. It's ambiguous and some choise has to be made
                    potentialSeparators = 1;
                }
            }

            if (!foundMatch)
            {
                // Non-whitespace, see if it's an end sequence
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
            // Didn't find a match
            return false;
        }

        let su;
        if (sep == '+')
        {
            logTmi(`Adding underline run: start=${start}, end=${separatorIndex}`);
            su = new Underline(start, separatorIndex, this.currentRun);
        }
        else
        {
            logTmi(`Adding strikethrough run: start-${start}, end=${separatorIndex}`);
            su = new Strikethrough(start, separatorIndex, this.currentRun);
        }

        this.currentRun = su;
        return true;
    }

    _isInListType()
    {
        return this.currentRun.state == State.ListItem ||
            this.currentRun.state == State.OrderedList ||
            this.currentRun.state == State.UnorderedList;
    }

    _checkBlockQuote(start)
    {
        // Blockquote rules:
        //  Starts with a '>'
        //  Can be continued on the next line without '>'
        //  Can be nested with additional '>', and can skip levels. The following is fine:
        //      > Hello
        //      >>> Hi

        if (this._inlineOnly || this._isEscaped(start))
        {
            return;
        }

        let nestLevel = 1;
        let offset = 1;
        while (start - offset >= 0 && /[> ]/.test(this.text[start - offset]))
        {
            if (this.text[start - offset] == '>')
            {
                ++nestLevel;
            }

            ++offset;
        }

        // Must be the beginning of the line, or nested in a list.
        // This will get more complicated once arbitrary nesting is supported
        let prevNewline = this.text.lastIndexOf('\n', start);
        let regex;
        if (this._isInListType())
        {
            // Determine if our highest level parent is a blockquote or a list
            let regexStr = '>';
            let runCur = this.currentRun.state == State.ListItem ? this.currentRun.parent : this.currentRun;
            let lastState = runCur.state;
            while (runCur !== null &&
                (lastState == State.BlockQuote || lastState == State.UnorderedList || lastState == State.OrderedList))
            {
                switch (lastState)
                {
                    case State.OrderedList:
                        regexStr = ' *(\\d+\\.)? *' + regexStr;
                        break;
                    case State.UnorderedList:
                        regexStr = ' *(\\*)? *' + regexStr;
                        break;
                    case State.BlockQuote:
                        regexStr = ' *> *' + regexStr;
                        break;
                    default:
                        break;
                }

                runCur = runCur.parent;
                if (runCur !== null)
                {
                    lastState = runCur.state;
                }
            }

            regex = new RegExp(regexStr);
        }
        else
        {
            regex = new RegExp(`^>{${nestLevel}}$`);
        }

        if (!regex.test(this.text.substring(prevNewline + 1, start + 1).replace(/ /g, '')))
        {
            return;
        }

        let parentState = this.currentRun.state;
        if (nestLevel > 1 && parentState != State.BlockQuote)
        {
            logError('Something went wrong! Nested blockquotes should have a blockquote parent, found ' + stateToStr(parentState));
            return;
        }

        if (parentState == State.BlockQuote && this.currentRun.nestLevel >= nestLevel)
        {
            // Same or less nesting than parent, don't add another one
            return;
        }

        // Now find where the blockquote ends.
        // Some parsers allow things like
        //
        //    > Text
        //    More text
        //
        // I don't feel like supporting that right now, so require the proper number of
        // '>' on all lines.

        let lineEnd = this.text.indexOf('\n', start);
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

        let blockquote = new BlockQuote(start, end, nestLevel, this.currentRun);
        this.currentRun = blockquote;
    }

    _checkIndentCodeBlock(start)
    {
        if (this._inlineOnly)
        {
            return -1;
        }
        // Rules:
        // 1. If not in a list, must have 4 spaces at the start of the line, and an empty line above
        // 2. If in a list and on the same line as the start of a listitem,
        //    must be indented 5 spaces from the bullet start ('* ' plus four spaces')
        // 3. If in a list and _not_ on the same line as the start of a listitem, must be indented
        //    4 spaces plus (2 * (nestLevel + 1))


        // Before using more complicated regex, just check to see if there are at least four spaces
        if (start < 3 ||
            this.text[start - 1] != ' ' ||
            this.text[start - 2] != ' ' ||
            this.text[start - 3] != ' ')
        {
            return -1;
        }

        let minspaces = 4;
        let firstIsList = false;
        if (this.currentRun.state == State.ListItem)
        {
            let nestLevel = this.currentRun.parent.nestLevel;
            minspaces += (nestLevel + 1) * 2;
            let type = this.currentRun.parent.state;
            let context = this.text.substring(this.text.lastIndexOf('\n', start) - 1, start + 1);
            let liStartRegex = new RegExp(`^.?\\n? {${nestLevel * 2}} ?${type == State.OrderedList ? '\\d+\\.' : '\\*'}     `);
            if (liStartRegex.test(context))
            {
                firstIsList = true;
            }
            else
            {
                // Not on the same line as the list item start, check if it's
                // a valid continuation
                if (!new RegExp(`^\\n?\\n? {${minspaces}}`).test(context))
                {
                    return -1;
                }
            }

        }
        // Not in a list, just need 4+ spaces. substring is nice enough to adjust invalid bounds
        // in the case where we ask for a substring starting at a negative index
        else if (!/^\n?\n? {3}$/.test(this.text.substring(start - 5, start)) || start == this.text.length - 1 || this.text[start + 1] == '\n')
        {
            return -1;
        }

        // Find the end, i.e. the last line prefixed with 4+ spaces (excluding completely empty lines)
        let newline = this.text.indexOf('\n', start);
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

        let blockStart = start - (firstIsList ? 4 : minspaces) + 1;

        // Somewhat hacky, but if we're in a list and have an indented code block, remove any preceding line
        // breaks, as this has enough padding on its own
        if (this.currentRun.state == State.ListItem)
        {
            let innerRuns = this.currentRun.innerRuns;
            if (innerRuns.length > 0 && innerRuns[innerRuns.length - 1].state == State.LineBreak)
            {
                this.currentRun.innerRuns.pop();
            }
        }

        new IndentCodeBlock(blockStart, end, this.text, minspaces, firstIsList, this.currentRun);
        logTmi(`Added Indent Code Block: start=${blockStart}, end=${end}, minspaces=${minspaces}`);
        return end;
    }

    _checkTable(start)
    {
        // Break from what I have been doing and take a different approach:
        // 1. Find the bounds of the entire table
        // 2. Create a 2D array of cells containing start and end indexes
        // 3. For each cell, invoke a new parser and store the result
        // 4. When it's time to display, don't do any transformations
        //    and directly display the contents we already converted

        if (this._isEscaped(start))
        {
            return -1;
        }

        // First, check to see if we're actually in a table. Basic rules:
        // 1. Pipes are required to separate columns, but pipes on either end are optional
        // 2. Three dashes are necessary on the next line for each column. ':' determines alignment

        let nextbreak = this.text.indexOf('\n', start);
        if (nextbreak == -1)
        {
            // Need at least two lines
            return -1;
        }

        // Watch out for nests. We can be nested in either a listitem or blockquote. Maybe both
        let thisLineStart = this.text.lastIndexOf('\n', start) + 1;
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
            return -1;
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

            // Don't trim away everything in the list if it's empty,
            // we need some indication that we found some semblence
            // of a table row.
            if (arr.length > 1 && arr[arr.length - 1].length == 0)
            {
                arr.pop();
            }

            if (arr.length > 1 && arr[0].length == 0)
            {
                arr.splice(0, 1);
            }

            return arr;
        };

        let groups = splitAndTrim(definition, this);
        if (groups.length == 0)
        {
            return -1; // No columns defined
        }

        let table =
        {
            header : [],
            rows : [],
            columnAlign : [],
        };

        let valid = true;
        for (let i = 0; i < groups.length; ++i)
        {
            let col = groups[i];
            if (!/^:?-{3,}:?$/.test(col))
            {
                valid = false;
                break;
            }

            // -2 means don't have specific alignment
            table.columnAlign.push(-2);

            if (col.startsWith(':'))
            {
                table.columnAlign[i] = col.endsWith(':') ? 0 : -1;
            }
            else if (col.endsWith(':'))
            {
                table.columnAlign[i] = 1;
            }
        }

        if (!valid)
        {
            return -1;
        }

        // We have valid column definitions. Now back to the header
        let headers = splitAndTrim(thisLine, this);

        for (let i = 0; i < groups.length; ++i)
        {
            // Fill the front rows first and push empty strings to any rows we didn't find content for
            table.header.push(i >= headers.length ? '' : headers[i]);
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
            for (let i= 0; i < groups.length; ++i)
            {
                row.push(i >= split.length ? '' : split[i]);
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
                table.rows[row][col] = new Markdown().parse(table.rows[row][col], true /*inlineOnly*/);
            }
        }

        new Table(thisLineStart, end, table, this.currentRun);
        logTmi(`Added Table: start=${thisLineStart}, end=${end}, $rows=${table.rows.length}, cols=${table.header.length}`);
        return end;
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

        let lineEnd = this._indexOrLast('\n\n', start);
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

        // To distinguish from potential multiline backtick blocks, ensure
        // that if we do have newlines, there is some content before the end
        if (/\n *$/.test(this.text.substring(start, end - findStr.length)))
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
        let marker = this.text[start];
        let markers = marker.repeat(3);

        // Why am I checking backwards? Doesn't it make more sense to trigger this after I see the first one?
        if (this._inlineOnly || !new RegExp(markers).test(this.text.substring(start - 2, start + 1)))
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
        let language;
        if (this.currentRun.state == State.ListItem)
        {
            let nestLevel = this.currentRun.parent.nestLevel;
            minspaces = (nestLevel + 1) * 2;
            let type = this.currentRun.parent.state;
            let context = this.text.substring(this.text.lastIndexOf('\n', start), newline + 1);
            let liStartRegex = new RegExp(`^\\n? {${nestLevel * 2}} ?${type == State.OrderedList ? '\\d+\\.' : '\\*'} {1,3}${markers} *\\S*\\n`);
            if (!liStartRegex.test(context))
            {
                // Not on the same line as the list item start, check if it's a valid continuation
                let match = context.match(new RegExp(`^\\n {${minspaces},${minspaces + 3}}${markers} *(\\S*)\\n`));
                if (!match)
                {
                    return -1;
                }

                language = match[1];
            }
        }
        else
        {
            // Not within a list item, needs to be three backticks at the very beginning of the line
            let match = this.text.substring(start - 3, newline + 1).match(new RegExp(`^\\n?${markers} *(\\S*)\\n?$`));
            if (!match)
            {
                return -1;
            }

            language = match[1];
        }

        let next = this._indexOrLast('\n', newline + 1);
        let nextline = this.text.substring(newline + 1, next + 1);

        // Each subsequent line must have at least minspaces before it, otherwise it's an invalid block
        let validLine = new RegExp(`^ {${minspaces}}`);
        let validEnd = new RegExp(`^ {${minspaces},${minspaces + 3}}${markers}\\n?$`);
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
                // Somewhat hacky, but if we're in a list and have an indented code block, remove any preceding line
                // breaks, as this has enough padding on its own
                if (this.currentRun.state == State.ListItem)
                {
                    let innerRuns = this.currentRun.innerRuns;
                    if (innerRuns.length > 0 && innerRuns[innerRuns.length - 1].state == State.LineBreak)
                    {
                        this.currentRun.innerRuns.pop();
                    }
                }

                new BacktickCodeBlock(start - 2, next, minspaces, this.text, language, this.currentRun);
                return next;
            }

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
        let prefix = this.text.substring(prevNewline + 1, start);
        let regexString = '^ *$';
        let curRun = this.currentRun;
        let quoteNests = 0;
        while (curRun !== null)
        {
            if (curRun.state == State.BlockQuote)
            {
                ++quoteNests;
            }

            curRun = curRun.parent;
        }
        if (quoteNests != 0)
        {
            regexString = `( *> *){${quoteNests}}$`;
        }

        if (!new RegExp(regexString).test(prefix))
        {
            // Something other than spaces/blockquotes precedes this.
            return false;
        }

        let nestLevel = 0;
        while (start - nestLevel > 0 && this.text[start - nestLevel - 1] == ' ')
        {
            ++nestLevel;
        }

        nestLevel = Math.floor(nestLevel / 2);

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
                logTmi(`Adding Unordered List: start=${start}, end=${listEnd}, nestLevel=${nestLevel}`);
            }

            this.currentRun = list;
        }

        let liEnd = Math.min(this.currentRun.end, this._liEnd(start, nestLevel, ordered));
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


    _liEndBlockQuote(start, nestLevel)
    {
        // Special handling for lists within blockquotes. Cand probably be
        // combined, but this makes it easier
        let blockRegexPrefix = `^.*( *> *){${this.currentRun.parent.nestLevel - 1}} *>`;
        let blockRegexNewline = new RegExp(blockRegexPrefix + ' *\\n');
        let parentEnd = this.currentRun.end;

        let newline = this.text.indexOf('\n', start);
        if (newline == -1 || newline == this.text.length - 1)
        {
            return parentEnd;
        }

        let end = newline;
        let next = this.text.indexOf('\n', newline + 1);
        if (next == -1) { next = parentEnd; }
        let nextline = this.text.substring(newline + 1, next + 1);

        while (true)
        {
            if (nextline.length == 0)
            {
                return end;
            }

            let cEmpty = 0;
            while (blockRegexNewline.test(nextline))
            {
                ++cEmpty;
                if (cEmpty == 2)
                {
                    // Two 'blank' lines kills the list
                    return end;
                }

                newline = next;
                next = this.text.indexOf('\n', next + 1);
                if (next == -1) { next = parentEnd; }
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    return end;
                }
            }

            if (cEmpty == 1)
            {
                let minspaces = (nestLevel + 1) * 2;
                if (!RegExp(blockRegexNewline + ` {${minspaces},}`).test(nextline))
                {
                    return end;
                }
            }
            else
            {
                let minspaces = (nestLevel + 1) * 2;
                if (RegExp(blockRegexPrefix + `  {0,${minspaces - 1}}(?:\\*|\\d+\\.) `).test(nextline))
                {
                    return end;
                }
            }

            end = next;
            newline = next;
            next = this.text.indexOf('\n', next + 1);
            if (next == -1) { next = parentEnd; }
            if (newline > next)
            {
                return parentEnd;
            }
            nextline = this.text.substring(newline + 1, next + 1);
        }
    }


    _liEnd(start, nestLevel)
    {
        if (this.currentRun.parent.state == State.BlockQuote)
        {
            return this._liEndBlockQuote(start, nestLevel);
        }

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

            let cEmpty = 0;
            while (nextline == '\n')
            {
                ++cEmpty;
                if (cEmpty == 2)
                {
                    return end + 2;
                }

                newline = next;
                next = this._indexOrLast('\n', next + 1);
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    // Just a bunch of newlines at the end without additional context
                    return end + 2;
                }
            }

            // If we're here, nextline actually has content
            if (cEmpty == 1)
            {
                // If there is a line break within the list, the list item
                // only continues if there are (minspaces + 1) * 2 spaces before
                // the content.
                let minspaces = (nestLevel + 1) * 2;
                if (!RegExp(`^ {${minspaces},}`).test(nextline))
                {
                    return end + 2;
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
                    return end + 1;
                }
            }

            end = next;
            newline = next;
            next = this._indexOrLast('\n', next + 1);
            nextline = this.text.substring(newline + 1, next + 1);
        }
    }


    _listEndBlockQuote(start, nestLevel, ordered)
    {
        // Special handling for lists within blockquotes. Cand probably be
        // combined, but this makes it easier
        let blockRegexPrefix = `^.*( *> *){${this.currentRun.nestLevel - 1}} *>`;
        let blockRegexNewline = new RegExp(blockRegexPrefix + ' *\\n');
        let parentEnd = this.currentRun.end;

        let newline = this.text.indexOf('\n', start);
        if (newline == -1 || newline >= parentEnd)
        {
            return parentEnd;
        }

        let end = newline;
        let next = this.text.indexOf('\n', newline + 1);
        if (next == -1) { next = parentEnd; }
        let nextline = this.text.substring(newline + 1, next + 1);
        while (true)
        {
            if (nextline.length == 0 || next + 1)
            {
                return end;
            }

            let cEmpty = 0;
            while (blockRegexNewline.test(nextline))
            {
                ++cEmpty;
                if (cEmpty == 2)
                {
                    // Two 'blank' lines kills the list
                    return end;
                }

                newline = next;
                next = this.text.indexOf('\n', next + 1);
                if (next == -1) { next = parentEnd; }
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    return end;
                }
            }

            if (cEmpty == 1)
            {
                let minspaces = (nestLevel + 1) * 2;
                if (!new RegExp(blockRegexPrefix + `  {${minspaces},}`).test(nextline))
                {
                    if (!RegExp(blockRegexPrefix + `  {${minspaces - 2},${minspaces - 1}}${ordered ? '\\d+\\.' : '\\*'} `).test(nextline))
                    {
                        return end;
                    }
                }
            }
            else if (RegExp(blockRegexPrefix + '  *(?:\\*|\\d+\\.) ').test(nextline))
            {
                // Also can't swap between ordered/unoredred with the same nesting level
                let minspaces = nestLevel * 2;
                if (!RegExp(blockRegexPrefix + `  {${minspaces},}`).test(nextline) ||
                    RegExp(blockRegexPrefix + `  {${minspaces},${minspaces + 1}}${ordered ? '\\*' : '\\d+\\.'} `).test(nextline))
                {
                    return end + 1;
                }
            }

            end = next;
            newline = next;
            next = this.text.indexOf('\n', next + 1);
            if (next == -1) { next = parentEnd; }
            if (newline > next || newline > parentEnd)
            {
                return parentEnd;
            }
            nextline = this.text.substring(newline + 1, next + 1);
        }
    }


    _listEnd(start, nestLevel, ordered)
    {
        if (this.currentRun.state == State.BlockQuote)
        {
            return this._listEndBlockQuote(start, nestLevel, ordered);
        }

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

            let cEmpty = 0;
            while (nextline == '\n')
            {
                ++cEmpty;
                if (cEmpty == 2)
                {
                    // Two blank lines kills the list
                    return end + 2;
                }

                newline = next;
                next = this.text.indexOf('\n', next + 1);
                if (next == -1) { next = this.text.length; }
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    // Just a bunch of newlines at the end without additional context
                    return end + 2;
                }
            }

            // If we're here, nextline actually has content
            if (cEmpty == 1)
            {
                // If there is a line break within the list, the next list
                // item must be indented at 2 * nestLevel. If the next line is not
                // a listitem and a potential continuation of the current li, it must
                // be indented with (nestLevel + 1) * 2 spaces
                let minspaces = (nestLevel + 1) * 2;
                if (!RegExp(`^ {${minspaces},}`).test(nextline))
                {
                    if (!RegExp(`^ {${minspaces - 2},${minspaces - 1}}${ordered ? '\\d+\\.' : '\\*'} `).test(nextline))
                    {
                        return end + 2;
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
                        return end + 1;
                    }
                }
            }

            end = next;
            newline = next;
            next = this.text.indexOf('\n', next + 1);
            if (next == -1) { next = this.text.length; }
            nextline = this.text.substring(newline + 1, next + 1);
        }
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
            end : 0,
            type : 0 // 0 == regular link. 1 == "footer" syntax
        };

        for (let i = start; i < end; ++i)
        {
            switch (this.text[i])
            {
                case '[':
                {
                    if (i == start || this._isEscaped(i))
                    {
                        break;
                    }

                    if (toFind[idx] == '(' && this.text[i - 1] == ']')
                    {
                        idx = 0;
                        ret.url = i + 1;
                        ret.type = 1;
                        break;
                    }

                    if (toFind[idx] != ']')
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
                }
                case ']':
                    if (toFind[idx] != ']' || this._isInline(inline, i, end) || this._isEscaped(i))
                    {
                        break;
                    }

                    if (ret.type == 1)
                    {
                        ret.url = this.text.substring(ret.url, i);
                        ret.end = i + 1;
                        return ret;
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
                    if (this._isEscaped(i))
                    {
                        break;
                    }

                    inline = !inline;
                    break;
                case ':':
                {
                    if (toFind[idx] != '(' ||
                        this.text[i - 1] != ']' ||
                        this._isEscaped(i) ||
                        i == this.text.length - 1 ||
                        this.text[i + 1] != ' ')
                    {
                        break;
                    }

                    let urlEnd = this._indexOrLast('\n', start);
                    if (urlEnd - (i + 2) < 1)
                    {
                        return false;
                    }

                    this._urls[ret.text.substring(1)] = this.text.substring(i + 2, urlEnd);
                    ret.type = 2;
                    ret.end = urlEnd;
                    return ret;
                }
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
        if (parent !== null)
        {
            parent.innerRuns.push(this);
        }
        this.innerRuns = [];
        this.cached = '';
    }

    // Conversion process:
    //  create start tag
    //    if first child start is not this start, add from initialText
    //  convert() children
    //  create end tag
    convert(initialText, inlineOnly=false)
    {
        if (this.cached.length != 0)
        {
            return this.cached;
        }

        let ident = '';
        let par = this.parent;
        while (par !== null)
        {
            par = par.parent;
            ident += '   ';
        }

        if (!inlineOnly && this.shouldProcessNewlines())
        {
            this.parseNewlines(initialText);
        }

        logTmi(`${ident}Converting State.${stateToStr(this.state)} : ${this.start}-${this.end}. ${this.innerRuns.length} children.`);
        let newText = this.tag(false /*end*/);

        let startWithContext = this.start + this.startContextLength();
        let endWithContext = this.end - this.endContextLength();
        if (this.innerRuns.length == 0)
        {
            newText += this.transform(initialText.substring(startWithContext, endWithContext), 0);
            logTmi(`${ident}Returning '${newText + this.tag(true)}'`);
            this.cached = newText + this.tag(true /*end*/);
            return this.cached;
        }


        if (startWithContext < this.innerRuns[0].start)
        {
            newText += this.transform(initialText.substring(startWithContext, this.innerRuns[0].start), -1);
        }

        for (let i = 0; i < this.innerRuns.length; ++i)
        {
            newText += this.innerRuns[i].convert(initialText, inlineOnly);
            if (i != this.innerRuns.length - 1 && this.innerRuns[i].end < this.innerRuns[i + 1].start)
            {
                newText += this.transform(initialText.substring(this.innerRuns[i].end, this.innerRuns[i + 1].start), -2);
            }
        }

        if (this.innerRuns[this.innerRuns.length - 1].end < endWithContext)
        {
            newText += this.transform(initialText.substring(this.innerRuns[this.innerRuns.length - 1].end, endWithContext), 1);
        }

        this.cached = newText + this.tag(true /*end*/);
        return this.cached;
    }

    length() { return this.end - this.start; }

    startContextLength() { return 0; }
    endContextLength() { return 0; }

    tag(/*end*/) { return ''; }

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
                // Lonesome backslack. Treat it as a normal backslash character
                newText += '\\';
            }
        }

        return newText;
    }

    shouldProcessNewlines()
    {
        switch (this.state)
        {
            case State.None:
            case State.ListItem:
            case State.BlockQuote:
                return true;

            case State.LineBreak:
            case State.Div: // This indicates we've already processed this block
            case State.Header:
            case State.Url:
            case State.Image:
            case State.InlineCode:
            case State.Bold:
            case State.Underline:
            case State.Italic:
            case State.Strikethrough:
            case State.UnorderedList: // Taken care of by individual ListItems
            case State.OrderedList:   // Taken care of by individual ListItems
            case State.Hr:
            case State.HtmlComment:
            case State.Table:
            case State.CodeBlock:
                return false;
            default:
                logWarn('Unknown state: ' + this.state);
                return false;
        }
    }

    isBlockElement()
    {
        switch (this.state)
        {
            case State.OrderedList:
            case State.UnorderedList:
            case State.ListItem:
            case State.Table:
            case State.BlockQuote:
            case State.CodeBlock:
            case State.Header:
            case State.Hr:
            case State.HtmlComment:
                return true;
            default:
                return false;
        }
    }


    parseNewlines(text)
    {
        // Go until we find a block element
        let start = this.start;
        let end = this.end;
        let previousRun = this;
        for (let iRun = 0; iRun < this.innerRuns.length; ++iRun)
        {
            let run = this.innerRuns[iRun];

            if (!run.isBlockElement())
            {
                continue;
            }

            end = run.start;

            if (start == end)
            {
                previousRun = run;
                start = run.end;
                continue;
            }

            iRun += this._parseNewlinesCore(text, start, end, previousRun, run);
            start = run.end;
            previousRun = run;
        }

        // One final parse to get the trailing content
        if (start < this.end)
        {
            let nextRun = null;
            if (this.parent !== null)
            {
                let iNext = this.parent.innerRuns.indexOf(this) + 1;
                if (iNext == this.parent.innerRuns.length)
                {
                    nextRun = this.parent;
                }
                else
                {
                    nextRun = this.parent.innerRuns[iNext];
                }
            }
            this._parseNewlinesCore(text, start, this.end, previousRun, nextRun);
        }
    }

    /// <summary>
    /// Core routine to add breaks and divs to this element
    /// </summary>
    _parseNewlinesCore(text, start, end, previousRun, nextRun)
    {
        // Look for breaks first, then worry about divs
        let newline = text.indexOf('\n', start);
        let doubles = [];
        let cBreaks = 0;
        while (newline != -1 && newline < end)
        {
            // Also allow for arbitrary spaces here
            let cNewlines = 1;
            let offset = 1;
            while (newline + offset < end)
            {
                let next = text[newline + offset];
                if (next == '\n')
                {
                    ++cNewlines;
                }
                else if (next == ' ')
                {/* Empty */
                }
                else
                {
                    break;
                }

                ++offset;
            }

            let atTop = newline == previousRun.end;
            let atBottom = nextRun !== null && newline + offset == nextRun.start;

            if (cNewlines > 1 && this.state == State.None)
            {
                if ((!atTop && !atBottom) || cNewlines > 2)
                {
                    doubles.push([newline, newline + offset]);
                    newline = text.indexOf('\n', newline + offset);
                    continue;
                }
            }

            const shouldAdd = (state, comp) => !comp.isBlockElement() ||
                    (state == State.ListItem &&
                        (comp.state == State.ListItem ||
                            comp.state == State.OrderedList ||
                            comp.state == State.UnorderedList));

            if (atTop)
            {
                // We're at the start of the block, only add a break under certain conditions
                if (shouldAdd(this.state, previousRun))
                {
                    cBreaks += this._insertBreak(newline);
                }
            }
            else if (atBottom)
            {
                if (shouldAdd(this.state, nextRun))
                {
                    cBreaks += this._insertBreak(newline);
                }
            }
            else
            {
                cBreaks += this._insertBreak(newline);
            }

            // Second break (or first, depending on the state above)
            if (cNewlines > 1)
            {
                if (atTop)
                {
                    if (cNewlines > 2 || shouldAdd(this.state, previousRun))
                    {
                        cBreaks += this._insertBreak(newline + 1);
                    }
                }
                else if (atBottom)
                {
                    if (cNewlines > 2 || shouldAdd(this.state, nextRun))
                    {
                        cBreaks += this._insertBreak(newline + 1);
                    }
                }
                else
                {
                    cBreaks += this._insertBreak(newline + 1);
                }
            }

            newline = text.indexOf('\n', newline + offset);
        }

        // Only add divs for top-level content
        let divDiff = 0;
        if (this.state == State.None)
        {
            // Need at least one encompassing div, except for special cases where the div
            // doesn't actually encompass an entire line.
            if (end == text.length || text[end] == '\n')
            {
                divDiff += this._insertDiv(start, doubles.length == 0 ? end : doubles[0][1], text);
            }

            for (let idiv = 0; idiv < doubles.length - 1; ++idiv)
            {
                divDiff += this._insertDiv(doubles[idiv][1], doubles[idiv + 1][1], text);
            }

            if (doubles.length != 0)
            {
                let lastEnd = doubles[doubles.length - 1][1];
                if (lastEnd < end - 1 || (end == text.length && lastEnd == end - 1))
                {
                    divDiff += this._insertDiv(doubles[doubles.length - 1][1], end, text);
                }
            }
        }

        return cBreaks + divDiff;
    }

    _insertDiv(start, end, text)
    {
        if (this.innerRuns.length == 0 || end < this.innerRuns[0].start)
        {
            let div = new Div(start, end, text, null /*parent*/);
            this.innerRuns.splice(0, 0, div);
            return 1;
        }

        // First, find the child to insert this div before, i.e.
        // first child whose start is greater than the div start
        let insert = this.innerRuns.length;
        for (let i = 0; i < this.innerRuns.length; ++i)
        {
            if (this.innerRuns[i].start >= start)
            {
                insert = i;
                break;
            }
        }

        // Now find the number of child elements to wrap in the div
        let splice = 0;
        for (let i = insert; i < this.innerRuns.length; ++i)
        {
            if (this.innerRuns[i].end <= end)
            {
                ++splice;
            }
        }

        let div = new Div(start, end, text, null /*parent*/);
        div.innerRuns = this.innerRuns.splice(insert, splice, div);
        div.parent = this;
        return 1 - splice;
    }

    _insertBreak(index)
    {
        if (this.innerRuns.length == 0 || this.innerRuns[0].start >= index)
        {
            this.innerRuns.splice(0, 0, new Break(index));
            return 1;
        }

        if (index >= this.innerRuns[this.innerRuns.length - 1].end)
        {
            this.innerRuns.push(new Break(index));
            return 1;
        }

        for (let i = 1; i < this.innerRuns.length; ++i)
        {
            if (this.innerRuns[i].start >= index)
            {
                if (index < this.innerRuns[i - 1].end)
                {
                    // Some inline elements can extend multiple lines. If we're
                    // in the middle of one, don't add it and let the inline
                    // element do it itself.
                    if (this.innerRuns[i - 1].isBlockElement())
                    {
                        logWarn('Only inline elements should be hitting this');
                    }

                    return 0;
                }

                this.innerRuns.splice(i, 0, new Break(index));
                return 1;
            }
        }

        return 0;
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
            newText = this.escapeChars(newText, '\\*`_+~<>');
        }

        // All items should have htmlentities replaced
        return newText.replace(/[&<>"'/]/g, function(ch)
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
        super(State.LineBreak, start, start + 1, parent);
    }

    tag(end) { return end ? '' : '<br />'; }
    transform(/*newText*/) { return ''; }
}

class Hr extends Run
{
    constructor(start, end, parent)
    {
        super(State.Hr, start, end, parent);
    }

    tag(end) { return end ? '' : '<hr />'; }


    // Indicators can have a variable number of characters, but we never want to actually print anything
    transform(/*newText,*/ /*side*/) { return ''; }
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
            return '</div>';
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
    constructor(start, end, headerLevel, text, parent)
    {
        super(State.Header, start, end, parent);
        this.headerLevel = headerLevel;
        this.id = text.substring(start, end).trim().toLowerCase();
        this.id = this.id.replace(/ /g, '-').replace(/[^-_a-zA-Z0-9]/g, '').replace(/^-+/, '').replace(/-+$/, '');
    }

    startContextLength()
    {
        return this.headerLevel + 1;
    }

    tag(end)
    {
        if (end)
        {
            return `</h${this.headerLevel}>`;
        }

        return `<h${this.headerLevel} id="${this.id}">`;
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

    transform(newText, /*side*/)
    {
        // Look for 'newline + >' and remove them.
        let transformed = '';
        if (newText[0] != '\n')
        {
            // Always want to start with a newline
            newText = '\n' + newText;
        }

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

    transform(/*newText,*/ /*side*/)
    {
        // Nothing is allowed inside of lists other than
        // list items, so return an empty string. This
        // also helps remove pesky blockquote artifacts
        return '';
    }
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

    transform(/*newText,*/ /*side*/)
    {
        // Nothing is allowed inside of lists other than
        // list items, so return an empty string. This
        // also helps remove pesky blockquote artifacts
        return '';
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

    transform(newText, /*side*/)
    {
        // Need to go up our chain to see how many `>` to look for and remove
        let cBlock = 0;
        let parent = this.parent;
        while (parent !== null)
        {
            if (parent.state == State.BlockQuote)
            {
                ++cBlock;
            }

            parent = parent.parent;
        }

        let lines = newText.split('\n');
        for (let i = 1; i < lines.length; ++i)
        {
            let line = lines[i];
            let found = 0;
            let j = 0;
            while (j < line.length && found != cBlock)
            {
                if (line[j] == '>')
                {
                    ++found;
                }

                ++j;
            }

            lines[i] = line.substring(j);
        }

        return lines.join('\n');
    }
}

class Url extends Run
{
    constructor(start, end, text, url, parent)
    {
        super(State.Url, start, end, parent);
        this.text = text;
        this.url = url;

        // Links within the document should be all lowercase for consistency
        if (this.url.startsWith('#'))
        {
            this.url = this.url.toLowerCase();
        }
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

    transform(newText, /*side*/)
    {
        return super.transform(this.escapeChars(newText, '[]'));
    }
}

class ExtendedUrl extends Url
{
    constructor(start, end, text, url, urls, parent)
    {
        super(start, end, text, url, parent);
        this.urls = urls;
        this.urlLink = url;
        this.converted = false;
    }

    _convertUrl()
    {
        if (this.converted)
        {
            return;
        }

        if (this.url in this.urls)
        {
            this.url = this.urls[this.url];
        }
        else
        {
            logError('Could not find link match for ' + this.url);
            return;
        }

        this.converted = true;
    }


    endContextLength()
    {
        return this.urlLink.length + 3;
    }

    tag(end)
    {
        this._convertUrl();
        return super.tag(end);
    }
}

class ExtendedUrlTag extends Run
{
    constructor(start, end, parent)
    {
        super(State.HtmlComment, start, end, parent);
    }

    tag(end) { return end ? ' -->' : '<!-- '; }

    transform(newText, /*side*/)
    {
        return newText;
    }
}

class Image extends Run
{
    constructor(start, end, altText, url, width, height, parent)
    {
        super(State.Image, start, end, parent);
        this.altText = altText.substring(1);
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

        let base = `<img src="${encodeURI(this.url)}" alt="${super.transform(this.altText)}"`;

        let widthP = false;
        if (this.width.endsWith('px'))
        {
            this.width = parseInt(this.width.substring(0, this.width.length - 2));
        }
        else if (this.width.endsWith('%'))
        {
            this.width = parseInt(this.width.substring(0, this.width.length - 1));
            widthP = true;
        }
        else
        {
            this.width = parseInt(this.width);
        }

        if (!isNaN(this.width))
        {
            base += ` width="${this.width}${widthP ? '%' : 'px'}"`;
        }

        let heightP = false;
        if (this.height.endsWith('px'))
        {
            this.height = parseInt(this.height.substring(0, this.height.length - 2));
        }
        else if (this.height.endsWith('%'))
        {
            this.height = parseInt(this.height.substring(0, this.height.length - 1));
            heightP = true;
        }
        else
        {
            this.height = parseInt(this.height);
        }

        if (!isNaN(this.height))
        {
            base += ` height="${this.height}${heightP ? '%' : 'px'}"`;
        }

        return base + '>';
    }

    // Inline tag, no actual content
    transform(/*newText,*/ /*side*/)
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
        return `<span class="codeLineNumber">${line}</span>`;
    }
}

class BacktickCodeBlock extends CodeBlock
{
    constructor(start, end, indent, text, language, parent)
    {
        super(start, end, text, indent, true /*backtick*/, parent);
        this.language = language;
    }

    startContextLength() { return this.text.indexOf('\n') + 1; }
    endContextLength() { return this.text.length - this.text.lastIndexOf('\n'); }

    transform(newText, /*side*/)
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
        if (this.firstIsList)
        {
            return 4;
        }

        return this.indent;
    }

    endContextLength() { return 0; }

    transform(newText, /*side*/)
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

    transform(/*newText,*/ /*side*/)
    {
        const wrap = (text, wrapper) => `<${wrapper}>${text}</${wrapper}>`;
        const td = function(text, align)
        {
            if (align == -2)
            {
                return `<td>${text}</td>`;
            }

            return '<td align="' + (align == -1 ? 'left' : align == 0 ? 'center' : 'right') + `">${text}</td>`;
        };

        // Ignore the text and use our table to build this up
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
        while (this.text[this._backticks] == '`')
        {
            ++this._backticks;
        }
    }

    startContextLength() { return this._backticks; }
    endContextLength() { return this._backticks; }

    tag(end) { return Run.basicTag('code', end); }
}

class InlineFormat extends Run
{
    // (Constructor same as parent)

    transform(newText, /*side*/)
    {
        return super.transform(newText).replace(/\n/g, '<br>');
    }
}

class Bold extends InlineFormat
{
    constructor(start, end, parent)
    {
        super(State.Bold, start, end, parent);
    }

    startContextLength() { return 2; }
    endContextLength() { return 2; }

    tag(end) { return Run.basicTag('strong', end); }
}

class Italic extends InlineFormat
{
    constructor(start, end, parent)
    {
        super(State.Italic, start, end, parent);
    }

    startContextLength() { return 1; }
    endContextLength() { return 1; }

    tag(end) { return Run.basicTag('em', end); }
}

class Underline extends InlineFormat
{
    constructor(start, end, parent)
    {
        super(State.Underline, start, end, parent);
    }

    startContextLength() { return 2; }
    endContextLength() { return 2; }

    tag(end) { return Run.basicTag('ins', end); }
}

class Strikethrough extends InlineFormat
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

    tag(/*end*/) { return ''; }

    transform(newText, /*side*/)
    {
        // Leave exactly as-is, we want it to be parsed as an HTML comment
        return newText;
    }
}


let _helpMarkdown = new Markdown();
let _mdHelpHTML = '';
function markdownHelp(callback, raw=false)
{
    if (_mdHelpHTML.length != 0)
    {
        callback({ data : raw ? _helpMarkdown.text : _mdHelpHTML });
        return;
    }

    let successFunc = function(response, request)
    {
        _mdHelpHTML = _helpMarkdown.parse(response.data);
        callback({ data : request.raw ? _helpMarkdown.text : `<div class="md">${_mdHelpHTML}</div>` });
    };

    sendHtmlJsonRequest('process_request.php', { type : ProcessRequest.MarkdownText }, successFunc, undefined, { raw : raw });
}
