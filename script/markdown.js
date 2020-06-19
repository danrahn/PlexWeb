/*
Converts markdown to HTML. The goal is to create this without looking at any examples
online. That means that this will probably be hot garbage, but hopefully will work in
basic scenarios.
*/

/* exported markdownHelp */

/* eslint-disable class-methods-use-this */ /* Inherited classes may use 'this', and making
                                               the base class method static breaks this */

// Markdown files are the only ones that prefer single-quotes over double.
/* eslint quotes: ["error", "single", { "avoidEscape" : true, "allowTemplateLiterals" : true }] */

/// <summary>
/// Enum of available markdown elements
/// </summary>
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

/// <summary>
/// Maps a given State to its string representation. Used for logging only
/// </summary>
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

/// <summary>
/// Returns whether `state` is allowed given the `current` state
/// </summary>
/// <param name="index">The current parse location</param>
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

            return index < current.end - current.endContextLength();
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

/// <summary>
/// Returns true if the given state is a block element
/// </summary>
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

/// <summary>
/// Returns true if the given character is a whitespace character
/// </summary>
const isWhitespace = function(ch)
{
    return /\s/.test(ch);
};

/// <summary>
/// Returns true if the given character is alphanumeric.
/// That is, [\w], without the underscore
/// </summary>
const isAlphanumeric = function(ch)
{
    return /[a-zA-Z0-9]/.test(ch);
};

/// <summary>
/// The core parser
/// </summary>
class Markdown
{
    constructor()
    {
        this.topRun = null;
        this._reset('', false);
    }

    /// <summary>
    /// Takes the initial input text and does some initial trimming,
    /// including removing carriage returns if present (\r)
    /// </summary>
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

    /// <summary>
    /// Resets the parser. If caching is enabled, only resets
    /// the internal state starting at the first difference we found
    /// in the text.
    /// </summary>
    /// <returns>The index to start parsing at</returns>
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
            // Check one past the end, since we might be breaking into the middle
            // of a block element
            if (this.topRun.innerRuns[i].end + 1 >= diffStart)
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
        return diff - 1;
    }

    /// <summary>
    /// Core parse routine. Processes the given text, and returns its HTML representation
    /// </summary>
    /// <param name="inlineOnly">
    /// True to ignore block elements (code blocks, lists, etc)
    /// Currently only used when parsing the inner contents of a table.
    /// </param>
    /// <remarks>
    /// We should probably utilize recursion to process nested elements instead of
    /// having logic in various places to check the bounds of inner elements
    /// </remarks>
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

        let html = this._parseCore(i);

        this._inParse = false;
        return html;
    }

    /// <summary>
    /// Actually start parsing, starting from the given start index
    /// </summary>
    _parseCore(start)
    {
        let perfStart = window.performance.now();
        this._urls = {};

        // Here we go...
        for (let i = start; i < this.text.length; ++i)
        {
            while (i == this.currentRun.end)
            {
                logTmi('Resetting to parent: ' + (this.currentRun.parent === null ? '(null)' : stateToStr(this.currentRun.parent.state)));
                this.currentRun = this.currentRun.parent;
            }

            i = this._dispatch(i);
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

    /// <summary>
    /// Dispatches to the handler based on the character at the given index
    /// </summary>
    /// <returns>The new position to resume parsing</returns>
    /* eslint-disable complexity */ // Breaking up a switch is pointless
    _dispatch(index)
    {
        switch (this.text[index])
        {
            case '#':
                return this._checkHeader(index);
            case '!':
                return this._checkImage(index);
            case '[':
                return this._checkOpenBracket(index);
            case '`':
                return this._checkBacktick(index);
            case '-':
                return this._checkDash(index);
            case '*':
                return this._checkAsterisk(index);
            case '_':
                return this._checkUnderscore(index);
            case '~':
                return this._checkTilde(index);
            case '+':
                return this._checkPlus(index);
            case '>':
                this._checkBlockQuote(index);
                return index;
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
                this._checkList(index, true /*ordered*/);
                return index;
            case ' ':
                return this._checkSpace(index);
            case '<':
                return this._checkLessThan(index);
            case '|':
                return this._checkPipe(index);
            default:
                return index;
        }
    }
    /* eslint-enable complexity */

    /// <summary>
    /// Process a dash ('-') character, which might be part of a horizontal rule
    /// </summary>
    /// <returns>The updated position to resume parsing</returns>
    _checkDash(i)
    {
        if (this._checkHr(i))
        {
            return this._indexOrLast('\n', i) - 1;
        }

        return i;
    }

    /// <summary>
    /// Checks if we have a valid horizontal rule starting at the given index
    /// Must only be called when this.text[index] is a dash, underscore, or asterisk
    ///
    /// Rules:
    ///  Starting at `index`, there must be three or more markers on their own line. Whitespace is allowed
    ///
    /// </summary>
    /// <param name="addHr">If true, will add an Hr to the current runs if we found one</param>
    /// <returns>The position to resume parsing</returns>
    _checkHr(index, addHr=true)
    {
        let sep = this.text[index];
        let linebreak = this._indexOrLast('\n', index);
        let line = this.text.substring(this.text.lastIndexOf('\n', index) + 1, linebreak);
        if (!RegExp(`^( *${sep == '*' ? '\\*' : sep} *){3,}$`).test(line))
        {
            return false;
        }

        if (addHr)
        {
            new Hr(index, linebreak, this.currentRun);
        }

        return true;
    }

    /// <summary>
    /// Checks for a valid header element, adding it to the current runs if found
    ///
    /// Rules:
    ///  1. 1-6 '#'s followed by a space
    ///  2. Must be the start of a line, or the start of a block element (e.g. in list/blockquote/table)
    ///  3. Trailing '#' are stripped, unless escaped by a backslash
    /// </summary>
    /// <returns>The index to continue parsing at</returns>
    _checkHeader(start)
    {
        // Headers need to be at the start of a line (or at least the first non-whitespace character)
        // Nested within a ListItem is still fine though, as long as they're at the beginning
        let newline = this.text.lastIndexOf('\n', start);

        let between = this.text.substring(newline + 1, start);
        if (!RegExp('^' + this._nestRegex() + '$').test(between))
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
        let header = new Header(start - headingLevel + 1, end, headingLevel, this.currentRun);
        this.currentRun = header;
        logTmi(`Added header: start=${header.start}, end=${header.end}, level=${header.headerLevel}`);
        return start;
    }

    /// <summary>
    /// Returns the regex to match an "empty" line start for nested block elements
    /// </summary>
    _nestRegex()
    {
        let run = this.currentRun;
        let regex = '';
        while (run !== null)
        {
            switch (run.state)
            {
                case State.OrderedList:
                    regex = '(\\d+\\.)? *' + regex;
                    break;
                case State.UnorderedList:
                    regex = '(\\*)? *' + regex;
                    break;
                case State.BlockQuote:
                    regex = '> *' + regex;
                    break;
                default:
                    break;
            }

            run = run.parent;
        }

        return ' *' + regex;
    }

    /// <summary>
    /// Determines if we have a valid images starting at the given `start` index.
    /// Adds an Image to the Run list if found
    ///
    /// Rules:
    ///  Full form: ![AltText w=X,h=Y](url)
    ///    1. AltText - optional (but recommended)
    ///    2. w=X - optional - specify the width X. Units are in pixels, unless '%' is added,
    ///       in which case the width will be a percentage of the containing element
    ///    3. h=Y - optional - specify the height Y. Width rules apply.
    ///    4. If one dimension is omitted, it will scale accordingly. Specifying both will
    ///       enforce both dimensions, possibly resulting in distortion.
    ///    5. url - required - the link to the image
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkImage(start)
    {
        if (this._isEscaped(start) || start == this.text.length - 1 || this.text[start + 1] != '[')
        {
            return start;
        }

        let result = this._testUrl(start + 1);
        if (!result)
        {
            return start;
        }

        if (this.currentRun.end < result.end)
        {
            return start;
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
        return result.end - 1; // Nothing allowed inside of an image
    }

    /// <summary>
    /// Process an open bracket. This could be a regular URL or a definition
    /// for an reference URL
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkOpenBracket(i)
    {
        if (!stateAllowedInState(State.Url, this.currentRun, i))
        {
            return i;
        }

        if (this._isEscaped(i))
        {
            return i;
        }

        let result = this._testUrl(i);
        if (!result)
        {
            return i;
        }

        // Must be contained in its parent element
        if (this.currentRun.end < result.end)
        {
            return i;
        }

        let url;
        if (result.type == 0)
        {
            url = new Url(i, result.end, result.url, this.currentRun);
        }
        else if (result.type == 1)
        {
            url = new ReferenceUrl(i, result.end, result.url, this._urls, this.currentRun);
        }
        else
        {
            url = new ReferenceUrlDefinition(i, result.end, this.currentRun);
            i = result.end - 1;
        }

        this.currentRun = url;
        logTmi(`Added url: start=${url.start}, end=${url.end}, text=${url.text}, url=${url.url}`);
        return i;
    }

    /// <summary>
    /// Process a backtick character, which could be the start of an inline code section or a code block
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkBacktick(i)
    {
        if (this._isEscaped(i))
        {
            return i;
        }

        // Multiline code block if it's the start of a line and there are three of these
        let multilineBlockEnd = this._checkBacktickCodeBlock(i);
        if (multilineBlockEnd != -1)
        {
            if (multilineBlockEnd == -2)
            {
                // Valid start, invalid end. Just assume things are broken and
                // don't try parsing inline code snippets
                return i + 2;
            }

            i = multilineBlockEnd - 1;
            return i;
        }

        // Couldn't parse as a code block, so try an inline block.
        let inlineEnd = this._checkInlineCode(i);
        if (inlineEnd != -1)
        {
            i = inlineEnd - 1;
        }

        return i;
    }

    /// <summary>
    /// Process an asterisk, which could be part of a horizontal rule, the
    /// start of a listitem, or bold/italic formatting
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkAsterisk(i)
    {
        if (this._isEscaped(i))
        {
            return i;
        }

        if (this._checkHr(i))
        {
            return this._indexOrLast('\n', i) - 1;
        }

        // Unordered list. Returns true if we successfully parsed an unordered list item
        if (this._checkList(i, false /*ordered*/))
        {
            return i;
        }

        // Essentially a fallthrough, since asterisks and underscores
        // can both be used as bold/italic markers
        return this._checkUnderscore(i);
    }

    /// <summary>
    /// Process an underscore, which can be part of a horizontal rule or bold/italic formatting
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkUnderscore(i)
    {
        // First, check for HR
        if (this._checkHr(i))
        {
            return this._indexOrLast('\n', i) - 1;
        }

        // Only returns true if we added a bold run, indicating that we should
        // also increment i as to not be included in a subsequent check
        if (this._checkBoldItalic(i))
        {
            ++i;
        }

        return i;
    }

    /// <summary>
    /// Returns whether we're inside of our parent element's special context, e.g. the link portion of a URL
    /// </summary>
    _inSpecialContext(start)
    {
        let parentContextStartLength = this.currentRun.startContextLength();
        let parentContextEndLength = this.currentRun.endContextLength();
        return ((parentContextStartLength != 0 && start - this.currentRun.start < parentContextStartLength) ||
            (parentContextEndLength != 0 && this.currentRun.end - start <= parentContextEndLength));
    }

    /// <summary>
    /// Checks whether we have a valid bold or italic run, adding it to the
    /// Run list if we do.
    ///
    /// Rules:
    ///  1. Bold runs consist of text surrounded by sets of two asterisks or underscores
    ///     __This is bold___ - **This is also bold**
    ///  2. Italic runs consist of text surround by sets of single asterisks or underscores
    ///     _This is italic_ - *This is also italic*
    ///  3. Runs can be combined, and will be parsed inside-out
    ///     '__Hello, _World__' results in an underscore followed by italicized 'Hello, World'
    /// </summary>
    /// <returns>
    /// True if we found a Bold run, indicating that we should
    /// increment our parse index so as not to parse the next character
    /// as an italic run
    /// </returns>
    /// <remarks>
    /// Separators a tricky, as they can be nested, and can represent both
    /// bold (2 separators) and italics (1 separator). The exact format is
    /// determined by the ending separator.
    ///
    /// Another tricky thing. If separators are not matched (__A_), it should be
    /// rendered as _<i>A</i>. So if we've reached the end of our block and have
    /// too many separators, we need to drop a few of them from the format and
    /// add them to the text.
    /// </remarks>
    _checkBoldItalic(start)
    {
        return this._checkFormat(start, true /*allowSingle*/);
    }

    /// <summary>
    /// The core underlying format parser for bold, italic, underline, and strikethrough
    /// </summary>
    /// <returns>True if we added a format that uses a double identifier, false if single (i.e. italic)</returns>
    _checkFormat(start, allowSingle)
    {
        let sepInfo =
        {
            count : 0,
            index : 0,
            tentativeCount : 0,
            tentativeIndex : 0,
            separator : '',
            allowSingle : allowSingle
        };

        if (!this._formatPrecheck(start, sepInfo))
        {
            return false;
        }

        // Find a match for our separator.
        if (!this._findMatchingFormattingMarker(sepInfo))
        {
            return false;
        }

        return this._makeFormat(start, sepInfo);
    }

    /// <summary>
    /// Does some initial checks on the text surrounding the potential formatted block
    /// </summary>
    /// <returns>True if we might be starting a formatted block. False if we definitely aren't</returns>
    _formatPrecheck(start, sepInfo)
    {
        // A non-alphanumeric number should precede this.
        // Might want to tweak this a bit more by digging into surrounding/parent runs.
        if (start != 0 && (isAlphanumeric(this.text[start - 1]) || this._isEscaped(start)))
        {
            return false;
        }

        sepInfo.separator = this.text[start];
        if (this._inSpecialContext(start))
        {
            return false;
        }

        sepInfo.count = 1;
        sepInfo.index = start + 1;
        while (sepInfo.index < this.text.length && this.text[sepInfo.index] == sepInfo.separator)
        {
            ++sepInfo.count;
            ++sepInfo.index;
        }

        if (!sepInfo.allowSingle && (sepInfo.count % 2) == 1)
        {
            // Odd number of separators, not allowed if we don't allow single separators
            return false;
        }

        // Next character in run must not be whitespace
        if (isWhitespace(this.text[sepInfo.index]))
        {
            return false;
        }

        return true;
    }

    /// <summary>
    /// Add the format span to our current run.
    /// </summary>
    /// <param name="start">The start position of the run</param>
    /// <param name="sepInfo">The separator info, which contains (among other things) the marker and end index of the run</param>
    /// <returns>True if we added a format that uses a double identifier, false if single (i.e. italic)</returns>
    _makeFormat(start, sepInfo)
    {
        let format;
        let isSingle = false;
        switch (sepInfo.separator)
        {
            case '*':
            case '_':
                if (this.text[start + 1] == sepInfo.separator && this.text[sepInfo.index - 2] == sepInfo.separator)
                {
                    logTmi(`Adding bold run: start=${start}, end=${sepInfo.index}`);
                    format = new Bold(start, sepInfo.index, this.currentRun);
                    isSingle = true;
                }
                else
                {
                    logTmi(`Adding italic run: start=${start}, end=${sepInfo.index}`);
                    format = new Italic(start, sepInfo.index, this.currentRun);
                    isSingle = true;
                }
                break;
            case '+':
                logTmi(`Adding underline run: start=${start}, end=${sepInfo.index}`);
                format = new Underline(start, sepInfo.index, this.currentRun);
                break;
            case '~':
                logTmi(`Adding strikethrough run: start-${start}, end=${sepInfo.index}`);
                format = new Strikethrough(start, sepInfo.index, this.currentRun);
                break;
            default:
                logError(`How did we try to make a format with a '${sepInfo.separator}'?`);
                break;
        }

        this.currentRun = format;
        return !isSingle;
    }

    /// <summary>
    /// Finds a match for a start sequence of separators
    /// Rules:
    ///  An opening separator run must be preceded by whitespace and end with non-whitespace
    /// A closing separator run must be preceded by non-whitespace and end with whitespace
    /// </summary>
    _findMatchingFormattingMarker(sepInfo)
    {
        let loopInfo = { inline : false, newline : false };
        let blockEnd = this.currentRun.end - this.currentRun.endContextLength();
        for (; sepInfo.count != 0 && sepInfo.index < blockEnd; ++sepInfo.index)
        {
            let precheck = this._formatLoopPrecheck(loopInfo, sepInfo, blockEnd);
            if (precheck == -1)
            {
                // Double newline
                return false;
            }

            if (!precheck)
            {
                continue;
            }

            sepInfo.tentativeCount = 1;
            let foundMatch = false;
            if (!isAlphanumeric(this.text[sepInfo.index - 1]))
            {
                foundMatch = this._checkFormattingOpening(sepInfo, blockEnd);
                if (foundMatch == -1)
                {
                    continue;
                }
            }

            if (!foundMatch)
            {
                // Non-whitespace, see if it's an end sequence
                if (this._findFormattingEnd(sepInfo, blockEnd))
                {
                    return true;
                }

                continue;
            }
        }

        return sepInfo.count == 0;
    }

    /// <summary>
    /// Returns whether we should process the current index for our formatting marker
    /// We don't continue if we've detected that we're in an inline code block, the
    /// separator is escaped, or we come across a double newline
    /// </summary>
    /// <returns>
    ///  1 : we should continue
    ///  0 : we should move on to the next character
    /// -1 : we should stop processing
    /// </returns>
    _formatLoopPrecheck(loopInfo, sepInfo, blockEnd)
    {
        if (this.text[sepInfo.index] == '`' && !this._isEscaped(sepInfo.index))
        {
            loopInfo.inline = !loopInfo.inline;
        }

        if (this._isInline(loopInfo.inline, sepInfo.index, blockEnd))
        {
            return 0;
        }

        if (this.text[sepInfo.index] == '\n')
        {
            if (loopInfo.newline)
            {
                // Double newline, inline element can't continue
                loopInfo.newline = 2;
                return -1;
            }

            loopInfo.newline = true;
            return 0;
        }

        loopInfo.newline = false;

        if (this.text[sepInfo.index] != sepInfo.separator || this._isEscaped(sepInfo.index))
        {
            return 0;
        }

        return 1;
    }

    /// <summary>
    /// Checks to see if the marker at the current index is the start of a new formatting run
    /// </summary>
    /// <returns>
    /// True  : We found the start of a new, potentially nested, format run
    /// False : We did not find the start of a new run
    /// -1    : We found markers surrounded by whitespace and should not consider them when matching markers
    /// </returns>
    _checkFormattingOpening(sepInfo, blockEnd)
    {
        let foundMatch = false;
        sepInfo.tentativeIndex = sepInfo.index + sepInfo.tentativeCount;
        while (sepInfo.tentativeIndex < blockEnd && this.text[sepInfo.tentativeIndex] == sepInfo.separator)
        {
            ++sepInfo.tentativeCount;
            ++sepInfo.tentativeIndex;
        }

        if (sepInfo.tentativeIndex == blockEnd || isWhitespace(this.text[sepInfo.tentativeIndex]))
        {
            // BI doesn't have single sep check
            if ((!sepInfo.allowSingle && sepInfo.tentativeCount == 1) || isWhitespace(this.text[sepInfo.tentativeIndex - 1]))
            {
                sepInfo.index = sepInfo.tentativeIndex;
                return -1;
            }

            // Non alphanumeric + separators + whitespace. This might actually be an end
            sepInfo.tentativeCount = 1;
        }
        else if (isWhitespace(this.text[sepInfo.index - 1]))
        {
            // Found an actual group of opening separators. Add it to our collection
            // Note that these separators must be in pairs of two, so if we have an
            // odd number, round down (strike/underline only).
            foundMatch = true;
            sepInfo.index = sepInfo.tentativeIndex;
            sepInfo.count += sepInfo.tentativeCount - (sepInfo.allowSingle ? 0 : (sepInfo.tentativeCount % 2));
        }
        else
        {
            // Assume that separators surrounded by
            // punctuation is closing. It's ambiguous
            // and some choice has to be made
            sepInfo.tentativeCount = 1;
        }

        return foundMatch;
    }

    /// <summary>
    /// Checks whether the marker at the current index is closing a format run
    /// </summary>
    /// <returns>True if the marker does close a format run</returns>
    _findFormattingEnd(sepInfo, blockEnd)
    {
        // Non-whitespace, see if it's an end sequence
        sepInfo.tentativeIndex = sepInfo.index + sepInfo.tentativeCount;
        while (sepInfo.tentativeIndex < blockEnd && this.text[sepInfo.tentativeIndex] == sepInfo.separator)
        {
            ++sepInfo.tentativeCount;
            ++sepInfo.tentativeIndex;
        }

        if (sepInfo.tentativeIndex != blockEnd && isAlphanumeric(this.text[sepInfo.tentativeIndex]))
        {
            // Group of separators with alphanumeric on either end, skip over it
            sepInfo.index = sepInfo.tentativeIndex;
            return false;
        }

        if (sepInfo.tentativeCount > sepInfo.count)
        {
            sepInfo.index += sepInfo.count;
            sepInfo.count = 0;
            return true;
        }

        sepInfo.index += sepInfo.tentativeCount;
        sepInfo.count -= (sepInfo.tentativeCount - ((sepInfo.allowSingle ? 0 : sepInfo.tentativeCount % 2)));

        // If we're going to continue our loop, backtrack sepInfo.index because we'll
        // increment it as part of the loop definition.
        if (sepInfo.count != 0)
        {
            --sepInfo.index;
        }

        return sepInfo.count == 0;
    }

    /// <summary>
    /// Processes a tilde character, which could be the start of a code block or strikethrough formatting
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkTilde(i)
    {
        if (this._isEscaped(i))
        {
            return i;
        }

        // Multiline code block if there are three of these in a row
        let multilineBlockEnd = this._checkBacktickCodeBlock(i);
        if (multilineBlockEnd != -1)
        {
            if (multilineBlockEnd == -2)
            {
                return i;
            }

            return multilineBlockEnd - 1;
        }

        /* __fallthrough for strikethrough */
        return this._checkPlus(i);
    }

    /// <summary>
    /// Processes a plus character, which could be the start of underline formatting
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkPlus(i)
    {
        if (this._checkStrikeAndUnderline(i))
        {
            // Skip over the second ~/+, as it's part of
            // the run we just created
            ++i;
        }

        return i;
    }

    /// <summary>
    /// Checks whether we have a valid strikethrough or underline run, adding
    /// it to the Run list if we do.
    ///
    /// Rules:
    ///  1. Strikethrough runs are surrounded by 2 tildes
    ///     ~~This is strikethrough~~
    ///  2. Underline runs are surrounded by 2 plusses
    ///     ++This is underlined++
    /// </summary>
    /// <returns>
    /// True if we found a valid run. Like _checkBoldItalic, indicates to the caller
    /// that we should increment our parse index to skip over the second marker
    /// </returns>
    _checkStrikeAndUnderline(start)
    {
        return this._checkFormat(start, false /*allowSingle*/);
    }

    /// <summary>
    /// Process a space character, which could be the start of an indented code block
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkSpace(i)
    {
        let blockEnd = this._checkIndentCodeBlock(i);
        if (blockEnd != -1)
        {
            i = blockEnd - 1;
        }

        return i;
    }

    /// <summary>
    /// Process a less-than character, which could be part of an HTML tag that we want to keep track of
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkLessThan(i)
    {
        // Allow two things. Line breaks and comments
        if (!this._isEscaped(i) && /<br ?\/?>/.test(this.text.substring(i, i + 5)))
        {
            let br = new Break(i, this.currentRun);
            br.end = this.text.indexOf('>', i) + 1;
            return i;
        }

        if (!this.text.substring(i, i + 4) == '<!--')
        {
            return i;
        }

        let endComment = this.text.indexOf('-->', i);
        if (endComment == -1)
        {
            return i;
        }

        endComment += 3;

        new HtmlComment(i, endComment, this.currentRun);
        return endComment - 1;
    }

    /// <summary>
    /// Returns true if the current run state is a list, not counting
    /// elements that are themselves nested within a list
    /// </summary>
    _inListOrQuote()
    {
        return this.currentRun.state == State.ListItem ||
            this.currentRun.state == State.OrderedList ||
            this.currentRun.state == State.UnorderedList ||
            this.currentRun.state == State.BlockQuote;
    }

    /// <summary>
    /// Checks if we have a valid blockquote element, adding it the
    /// Run list if found.
    ///
    /// Rules:
    ///  * Line must start with a '>'
    ///      * If in a list, it can be preceded by the list item indicator.
    ///  * Can be continued on the next line without '>'
    ///  * Can be nested with additional '>', and can skip levels. The following is fine:
    ///      > Hello
    ///      >>> World
    /// </summary>
    _checkBlockQuote(start)
    {
        if (this._inlineOnly || this._isEscaped(start))
        {
            return;
        }

        let newNestLevel = this._parentBlockQuoteNestLevel() + 1;

        // Must be the beginning of the line, or nested in a list.
        // This will get more complicated once arbitrary nesting is supported
        let prevNewline = this.text.lastIndexOf('\n', start);
        let regex;

        regex = RegExp('^' + this._nestRegex() + '>$');
        if (!regex.test(this.text.substring(prevNewline + 1, start + 1).replace(/ /g, '')))
        {
            return;
        }

        let parentState = this.currentRun.state;
        if (newNestLevel > 1 && parentState != State.BlockQuote && parentState != State.ListItem)
        {
            logError('Something went wrong! ' +
                'Nested blockquotes should have a blockquote parent or be nested in a list, found ' + stateToStr(parentState));
            return;
        }

        if (parentState == State.BlockQuote && this.currentRun.nestLevel >= newNestLevel)
        {
            // Same or less nesting than parent, don't add another one
            return;
        }

        let end = this._blockQuoteEnd(start, newNestLevel);
        let blockquote = new BlockQuote(start, end, newNestLevel, this.currentRun);
        this.currentRun = blockquote;
    }

    /// <summary>
    /// Find where the blockquote ends.
    ///
    /// Some parsers allow things like
    ///
    ///    > Text
    ///    More text
    ///
    /// I don't feel like supporting that right now, so require the proper number of
    /// '>' on all lines.
    /// </summary>
    _blockQuoteEnd(start, nestLevel)
    {
        let lineEnd = this.text.indexOf('\n', start);
        let end = this.currentRun.end;
        while (lineEnd != -1 && lineEnd != this.text.length - 1)
        {
            let next = this.text[lineEnd + 1];
            if (next == '\n')
            {
                // Double line break, we're done.
                // Note that we might want to change this for listitems, which
                // allows additional newlines if the next non-blank line is indented
                // 2+ spaces.
                return lineEnd;
            }

            let nextNest = 0;
            let nextChar;
            let nextOffset = 1;
            while (lineEnd + nextOffset < end && /[> ]/.test((nextChar = this.text[lineEnd + nextOffset])))
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
                return lineEnd;
            }

            lineEnd = this.text.indexOf('\n', lineEnd + 1);
        }

        return end;
    }

    /// <summary>
    /// Checks whether we have a valid indented code block.
    ///
    /// Rules:
    /// 1. If not in a list, must have 4 spaces at the start of the line, and an empty line above
    /// 2. If in a list and on the same line as the start of a listitem,
    ///    must be indented 5 spaces from the bullet start ('* ' plus four spaces')
    /// 3. If in a list and _not_ on the same line as the start of a listitem, must be indented
    ///    4 spaces plus (2 * (nestLevel + 1))
    ///
    /// To account for nesting:
    ///   Go backwards in the tree, stopping as soon as we find a quote.
    ///   Take the quote's nest level to have a base regex of ^([^>]*>){nestLevel}
    ///   Along the way to the first quote, also build up the list regex, both for the
    ///   first line (which can contain multiple list indicators, e.g. '* > * 1.     Block')
    ///   and subsequent lines, which will be our base regex plus our list's nest level * 2 + 2
    /// </summary>
    /// <returns>The end index of the code block, or -1 if none was found</returns>
    _checkIndentCodeBlock(start)
    {
        if (!this._indentCodeBlockPrecheck(start))
        {
            return -1;
        }

        let lastNewline = this.text.lastIndexOf('\n', start);
        let codeBlockParams = this._getIndentCodeBlockPrefixData(lastNewline);

        let context = this.text.substring(lastNewline + 1, start + 1);
        if (!RegExp(codeBlockParams.firstLineRegex).test(context))
        {
            return -1;
        }

        let blankLineRegex = RegExp(`${codeBlockParams.quoteRegex} *\\n`);
        let nextLineString = `${codeBlockParams.quoteRegex} {${(codeBlockParams.listNestLevel + 1) * 2}}    `;
        let nextLineRegex = RegExp(nextLineString);

        let end = this._getIndentCodeBlockEnd(start, blankLineRegex, nextLineRegex);
        let blockStart = start - 3;

        // Hacky, but if we're in a list and have an indented code block, remove any preceding line
        // breaks, as this has enough padding on its own
        if (this.currentRun.state == State.ListItem)
        {
            let innerRuns = this.currentRun.innerRuns;
            if (innerRuns.length > 0 && innerRuns[innerRuns.length - 1].state == State.LineBreak)
            {
                this.currentRun.innerRuns.pop();
            }
        }

        new IndentCodeBlock(blockStart, end, nextLineString, this.currentRun);
        return end;
    }

    /// <summary>
    /// Do some preliminary checks to see if we might have a valid indented code block
    /// </summary>
    _indentCodeBlockPrecheck(start)
    {
        if (this._inlineOnly)
        {
            return false;
        }

        // Before using more complicated regex, just check to see if there are at least four spaces
        if (start < 3 ||
            this.text[start - 1] != ' ' ||
            this.text[start - 2] != ' ' ||
            this.text[start - 3] != ' ')
        {
            return false;
        }

        return true;
    }

    /// <summary>
    /// Return relevant nesting data for the current code block
    /// </summary>
    _getIndentCodeBlockPrefixData(lastNewline)
    {
        let params =
        {
            quoteNest : 0,
            listNestLevel : 0, // -1 ensures we don't add additional spaces in nextLineRegex
            firstLineRegex : '',
            quoteRegex : '^'
        };

        params.quoteNest = this._parentBlockQuoteNestLevel();
        if (params.quoteNest != 0)
        {
            params.quoteRegex = `^(?:[^>]*>){${params.quoteNest}}`;
        }

        params.listNestLevel = -1;
        this._buildIndentCodeBlockPrefixRegex(params, lastNewline);

        let doubleNest = params.listNestLevel != -1 && params.quoteNest != 0;

        // If we're nested in both lists and quotes, we need
        // to allow for some space between the quote and the start of the list
        params.firstLineRegex = params.quoteRegex + (doubleNest ? ' {1,3}' : '') + params.firstLineRegex + '    $';
        return params;
    }

    /// <summary>
    /// Build the prefix regex strings and set the list nest level
    /// for the code block currently being parsed
    /// </summary>
    _buildIndentCodeBlockPrefixRegex(params, lastNewline)
    {
        let run = this.currentRun;
        while (run !== null)
        {
            if (run.state == State.BlockQuote)
            {
                break;
            }

            if (run.state == State.ListItem)
            {
                if (params.listNestLevel == -1)
                {
                    params.listNestLevel = run.parent.nestLevel;
                }

                // If our last newline is beyond the start of this run, then
                // it won't be in our line and we should expect two spaces
                if (lastNewline > run.start)
                {
                    params.firstLineRegex = '  ' + params.firstLineRegex;
                }
                else
                {
                    params.firstLineRegex = `${run.parent.state == State.OrderedList ? '\\d+\\.' : '\\*'} {1,4}` + params.firstLineRegex;
                }
            }

            run = run.parent;
        }
    }

    /// <summary>
    /// Find and return the end of the indented code block
    /// </summary>
    /// <param name="blankLineRegex">The RegExp that defines what a "blank" line looks like for this code block</param>
    /// <param name="nextLineRegex">
    /// The RegExp that defines what prefix is necessary
    /// for a given line to belong to this code block
    /// </param>
    _getIndentCodeBlockEnd(start, blankLineRegex, nextLineRegex)
    {
        let newline = this._indexOrParentEnd('\n', start);
        let end = newline;
        let next = this._indexOrParentEnd('\n', newline + 1);
        let nextline = this.text.substring(newline + 1, next + 1);

        while (true)
        {
            if (nextline.length == 0)
            {
                return end;
            }

            while (blankLineRegex.test(nextline))
            {
                newline = next;
                next = this._indexOrParentEnd('\n', next + 1);
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    break;
                }
            }

            // If we're here, nextline actually has content
            if (!nextLineRegex.test(nextline))
            {
                return end;
            }

            end = next;
            newline = next;
            next = this._indexOrParentEnd('\n', next + 1);
            nextline = this.text.substring(newline + 1, next + 1);
        }
    }

    /// <summary>
    /// Process a pipe character, which could be the start of a table
    /// </summary>
    /// <returns>The position we should continue parsing from</returns>
    _checkPipe(i)
    {
        // Tables
        let tableEnd = this._checkTable(i);
        if (tableEnd != -1)
        {
            i = tableEnd - 1;
        }

        return i;
    }

    /// <summary>
    /// Checks whether we have a valid table at the given index, adding it to the
    /// Run list if found.
    ///
    /// Rules:
    ///  1. Table columns are separated by pipes: '| Column1 | Column2 | Column3 |'
    ///    * Pipes on the ends of the table are optional: 'Column1 | Column2 | Column3'
    ///  2. The first row will be the column headers
    ///  3. The second row _must_ be the column format definitions
    ///    * Three dashes are required per column. More are allowed, but not less
    ///    * Single colons before and/or after define alignment: ':---|:---:|---:'
    ///  4. Rows after the second are regular table rows
    ///    * Multiple pipes in a row can force a cell to be blank: '|| Column2 | Column3 |'
    ///    * Line breaks can be added with '<br>'
    ///    * Cells can contain any inline markdown elements
    /// </summary>
    /// <example>
    /// | Column1          | Column2   | Column3 |
    /// |:-----------------|:---------:|---:|
    /// Pipes at the start | and end | are optional
    /// | Left-Aligned | Centered | Right-Aligned |
    /// | Second row defines<br>the columns. | At least 3 dashes<br>are required | but more are allowed |
    /// || Multiple Pipes | for empty cells |
    /// | Add line breaks<br>with \<br>
    /// | ++Cells can be formatted++ | [with any inline elements](#) | ![Poster h=150](poster.jpg) |
    /// </example>
    /// <remarks>
    /// This class breaks from the single main parser model I have been using by spawning additional
    /// parsers for each cell of the table. It's probably a good pattern to follow for everything
    /// else as well:
    ///  1. Find the bounds of the entire table
    ///  2. Create a 2D array of cells containing start and end indexes
    ///  3. For each cell, invoke a new parser and store the result
    ///  4. When it's time to display, don't do any transformations
    ///     and directly display the contents we already converted
    /// </remarks>
    /// <returns>The end index of the table, or -1 if a valid table was not found</returns>
    _checkTable(start)
    {
        if (this._isEscaped(start))
        {
            return -1;
        }

        // First, check to see if we're actually in a table. Basic rules:
        // 1. Pipes are required to separate columns, but pipes on either end are optional
        // 2. Three dashes are necessary on the next line for each column. ':' determines alignment
        let bounds = this._getTableBounds(start);
        if (!bounds.valid)
        {
            return -1;
        }

        let headerRow = this.text.substring(bounds.tableStart, bounds.headerEnd);
        let defineLine = this.text.substring(bounds.headerEnd + 1, bounds.defineEnd);

        // The definition line _must_ be on its own, so we can be stricter about contents. Still
        // allow arbitrary spaces though, so collapse them to make parsing the definition easier
        let definition = defineLine.replace(/ /g, '');

        let quoteRegex;
        if (this.currentRun.state == State.BlockQuote)
        {
            quoteRegex = new RegExp(`^( *> *){${this.currentRun.nestLevel}}`);
            definition = definition.replace(quoteRegex, '');
        }

        let table = { header : [], rows : [], columnAlign : [], };
        if (!this._processTableAlignment(table, definition))
        {
            return -1;
        }

        // We have valid column definitions. Now back to the header
        this._addTableHeaders(table, headerRow);

        let end = this._getTableRows(table, bounds.defineEnd, bounds.blockEnd, quoteRegex);
        this._parseTableCells(table);

        new Table(bounds.tableStart, end, table, this.currentRun);
        logTmi(`Added Table: start=${bounds.tableStart}, end=${end}, $rows=${table.rows.length}, cols=${table.header.length}`);
        return end;
    }

    /// <summary>
    /// Returns an object containing the table bounds. If the table is invalid, bounds.valid will be false
    /// </summary>
    _getTableBounds(start)
    {
        let bounds = { valid : false };
        bounds.headerEnd = this.text.indexOf('\n', start);
        if (bounds.headerEnd == -1)
        {
            return bounds;
        }

        bounds.tableStart = this.text.lastIndexOf('\n', start) + 1;
        bounds.blockEnd = this.text.length;

        // Watch out for nests. We can be nested in either a listitem or blockquote. Maybe both
        if (this.currentRun.state == State.ListItem || this.currentRun.state == State.BlockQuote)
        {
            if (bounds.tableStart <= this.currentRun.start)
            {
                bounds.tableStart = this.currentRun.start + this.currentRun.startContextLength();
            }

            bounds.blockEnd = this.text.length;
        }

        bounds.defineEnd = this._indexOrLast('\n', bounds.headerEnd + 1);
        bounds.valid = bounds.defineEnd <= bounds.blockEnd;
        return bounds;
    }

    /// <summary>
    /// Fill out the alignment array of our table based on the given definition
    /// </summary>
    /// <returns>True if we have a valid definition row, false otherwise</returns>
    _processTableAlignment(table, definition)
    {
        let groups = this._splitAndTrimTableRow(definition);
        if (groups.length == 0)
        {
            return false;
        }

        let validCol = /^:?-{3,}:?$/;
        for (let i = 0; i < groups.length; ++i)
        {
            let col = groups[i];
            if (!validCol.test(col))
            {
                return false;
            }

            // -2 means we don't have specific alignment
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

        return true;
    }

    /// <summary>
    /// Parses each individual cell of the table
    /// </summary>
    _parseTableCells(table)
    {
        // Normal rows
        for (let row = 0; row < table.rows.length; ++row)
        {
            for (let col = 0; col < table.rows[row].length; ++col)
            {
                table.rows[row][col] = new Markdown().parse(table.rows[row][col], true /*inlineOnly*/);
            }
        }

        // Header row
        for (let col = 0; col < table.header.length; ++col)
        {
            table.header[col] = new Markdown().parse(table.header[col], true /*inlineOnly*/);
        }
    }

    /// <summary>
    /// Processes normal rows of the table until an invalid row is found
    /// </summary>
    /// <returns>The end index of the table</returns>
    _getTableRows(table, defineEnd, blockEnd, quoteRegex)
    {
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

            let split = this._splitAndTrimTableRow(nextline);
            if (split.length == 0)
            {
                break;
            }

            let row = [];
            for (let i= 0; i < table.columnAlign.length; ++i)
            {
                row.push(i >= split.length ? '' : split[i]);
            }

            table.rows.push(row);

            end = next;
            newline = next;
            next = this._indexOrLast('\n', newline + 1);
            nextline = this.text.substring(newline + 1, next);
        }

        return end;
    }

    /// <summary>
    /// Adds individual column headers to the table given the entire row
    /// </summary>
    _addTableHeaders(table, headerRow)
    {
        let headers = this._splitAndTrimTableRow(headerRow);

        for (let i = 0; i < table.columnAlign.length; ++i)
        {
            // Fill the front rows first and push empty strings to any rows we didn't find content for
            table.header.push(i >= headers.length ? '' : headers[i]);
        }
    }

    /// <summary>
    /// Takes a table row definition and breaks it into individual cells as an array
    /// </summary>
    _splitAndTrimTableRow(line)
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
            if (line[i] == '|' && !this._isEscaped(i))
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
        // we need some indication that we found some semblance
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
    }

    /// <summary>
    /// Check for a valid inline code block, adding it to the Run list if found.
    ///
    /// Rules:
    ///  Surround text with a matching number of backticks. More backticks allows
    ///  backticks themselves to be part of the code block:
    ///    ```I can escape two backticks (``) by surrounding with three```
    /// </summary>
    /// <returns>The end index of the code run, or -1 if no run was found</returns>
    _checkInlineCode(start)
    {
        // Note that we need to match the exact number of initial backticks.
        // This allows things like "```` Start a code block with ``` ````".
        if (!stateAllowedInState(State.InlineCode, this.currentRun, start))
        {
            return -1;
        }

        let findStr = '`'.repeat(this._getInlineCodeMarkers(start));
        if (start + (findStr.length * 2) - 1 >= this.text.length)
        {
            // Impossible for us to find a match. Need at least (2 * findStr) -1 beyond start
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

    /// </summary>
    /// Returns the number of consecutive backticks
    /// </summary>
    _getInlineCodeMarkers(start)
    {
        let backticks = 1;
        while (start + backticks < this.text.length && this.text[start + backticks] == '`')
        {
            ++backticks;
        }

        return backticks;
    }

    /// <summary>
    /// Checks for a valid code block. Despite the name, accepts both '`' and '~' as markers.
    ///
    /// Rules:
    ///  Start with exactly three backticks or tildes at the beginning of the line
    ///   * Starting markers can be followed by a language specification (currently unused) : '```cpp`
    ///   * If within a list, must be indented two spaces further than the current indentation level
    ///   * TODO: Support nesting within blockquotes
    ///  End with exactly three backticks or tildes on their own line
    /// </summary>
    /// <returns>
    /// The end index of the code block
    /// -1 if no code block was found
    /// -2 if we found a valid start to a code block, but couldn't find an end
    /// </returns>
    _checkBacktickCodeBlock(start)
    {
        let marker = this.text[start];
        let markers = marker.repeat(3);

        if (this._inlineOnly || start >= this.text.length - 3 || this.text[start + 1] != marker || this.text[start + 2] != marker)
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

        let nestRegex = this._nestRegex();
        while (nestRegex.endsWith(' *'))
        {
            nestRegex = nestRegex.substring(0, nestRegex.length - 2);
        }

        nestRegex += ' {0,1}'; // Allow only a single space gap
        let params = { minIndent : 0, language : '', markers : markers, newline : newline, regexStr : nestRegex };
        if (!this._validBacktickCodeBlockStart(start, params))
        {
            return -1;
        }

        return this._findBacktickCodeBlockEnd(start, params);
    }

    /// <summary>
    /// Returns whether we have a valid start to a code block starting at the given index
    /// </summary>
    _validBacktickCodeBlockStart(start, params)
    {
        let context = this.text.substring(this.text.lastIndexOf('\n', start) + 1, start);

        // If our direct parent is a list, find its indentation level; we need to be indented two more than that
        if (this.currentRun.state == State.ListItem)
        {
            let listStart = this.currentRun.parent.start;
            params.minIndent = this.text.substring(this.text.lastIndexOf('\n', listStart) + 1, listStart).length + 2;
            if (context.length < params.minIndent)
            {
                return false;
            }
        }

        if (!RegExp('^' + params.regexStr + '$').test(context))
        {
            return false;
        }

        let match = this.text.substring(start + 3, params.newline + 1).match(/^ *(\w*)\n/);
        if (!match)
        {
            return false;
        }

        params.language = match[1];
        return true;
    }

    /// <summary>
    /// Looks for the end of a backtick/tilde code block
    /// <summary>
    /// <returns>The end index of the code block, or -2 if we did not have a valid code block</returns>
    _findBacktickCodeBlockEnd(start, params)
    {
        let newline = params.newline;
        let next = this._indexOrParentEnd('\n', params.newline + 1);
        let nextline = this.text.substring(newline + 1, next + 1);

        // Each subsequent line must have at least minspaces before it, otherwise it's an invalid block
        let validLine = RegExp('^' + params.regexStr);
        let validEnd = RegExp('^' + params.regexStr + params.markers + '\\n?$');
        let blankLine = RegExp('^' + params.regexStr + '\\n$');

        while (true)
        {
            if (nextline.length == 0)
            {
                return -2;
            }

            while (blankLine.test(nextline))
            {
                newline = next;
                next = this._indexOrParentEnd('\n', next + 1);
                nextline = this.text.substring(newline + 1, next + 1);
                if (nextline.length == 0)
                {
                    return -2;
                }
            }

            if (!validLine.test(nextline))
            {
                return -2;
            }

            if (validEnd.test(nextline))
            {
                let indent = this.text.indexOf(params.markers, newline) - (newline + 1);
                if (indent < params.minIndent)
                {
                    return -2;
                }

                if (params.minIndent == 0 || indent <= params.minIndent + 3)
                {
                    return this._addBacktickCodeBlock(start, next, params.minIndent, params.language);
                }
            }

            // If we have a minimum indent, make sure we follow it
            if (params.minIndent != 0 && !RegExp('^' + params.regexStr + '$').test(nextline.substring(0, params.minIndent)))
            {
                return -2;
            }

            newline = next;
            next = this._indexOrParentEnd('\n', next + 1);
            nextline = this.text.substring(newline + 1, next + 1);
        }
    }

    /// <summary>
    /// We found a valid backtick/tilde code block, add it to the run list.
    /// </summary>
    /// <returns>The end index of the code block</returns>
    _addBacktickCodeBlock(start, end, minspaces, language)
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

        new BacktickCodeBlock(start, end, minspaces, this.text, language, this.currentRun);
        return end;
    }

    /// <summary>
    /// Checks for a valid list run, adding it to the Run list if found
    ///
    /// Rules:
    ///  1. General:
    ///    * To nest lists, add two spaces per nest level before adding the list marker
    ///      (like this comment's formatting)
    ///    * To continue a list item on a new line, the next line must be indented at the same level
    ///      as the parent listitem. To add an additional line break, the line must be indented two
    ///      additional spaces:
    ///
    ///        * This goes to      |  * This breaks out  |  * This continues
    ///        the next line       |                     |
    ///                            |  of the list        |    the list, with additional spacing
    ///
    ///  2. Unordered lists
    ///    * Line must start with an asterisk (or spaces followed by an asterisk if nested)
    ///  3. Ordered lists
    ///    * Line must start with a number followed by a period. The list will start counting from that number
    ///    * Subsequent list items will increase from the first item, regardless of the user supplied number
    /// </summary>
    _checkList(start, ordered)
    {
        if (!this._listPrecheck(start, ordered))
        {
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
            this._createList(start, nestLevel, ordered);
        }

        let liEnd = Math.min(this.currentRun.end, this._listEnd(start, nestLevel, ordered, false /*wholeList*/));
        let startContext = 2;
        if (ordered)
        {
            let liText = this.text.substring(start, liEnd);
            let match = liText.match(/^\d+\. /);
            if (match)
            {
                startContext = match[0].length;
            }
        }

        let li = new ListItem(start, liEnd, startContext, this.currentRun);
        this.currentRun = li;
        logTmi(`Added ListItem: start=${start}, end=${liEnd}, nestLevel=${nestLevel}`);
        return true;
    }

    /// <summary>
    /// Does some initial tests on our surroundings to see if we have the valid start to a list/list item
    /// </summary>
    _listPrecheck(start, ordered)
    {
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

        let regexString = this._nestRegex();
        if (!new RegExp(`^${regexString}$`).test(prefix))
        {
            // Something other than spaces/blockquotes precedes this.
            return false;
        }

        return true;
    }

    /// <summary>
    /// Finds the bounds and adds a list to the run list
    /// </summary>
    _createList(start, nestLevel, ordered)
    {
        let listEnd = this._listEnd(start, nestLevel, ordered, true /*wholeList*/);
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

    /// <summary>
    /// Helper method that returns the first occurrence of str in the
    /// current text, starting at `start`. If not found, returns the
    /// length of the text.
    /// </summary>
    _indexOrLast(str, start)
    {
        let i = this.text.indexOf(str, start);
        return i == -1 ? this.text.length : i;
    }

    /// <summary>
    /// Helper method that returns the first occurrence of str in the
    /// current text, starting at `start`. If not found, returns the
    /// end of the containing run.
    /// </summary>
    _indexOrParentEnd(str, start)
    {
        let i = this.text.indexOf(str, start);
        return i == -1 || i > this.currentRun.end ? this.currentRun.end : i;
    }

    /// <summary>
    /// Returns the nest level for the closest parent blockquote, or 0 if we are not in a blockquote
    /// </summary>
    _parentBlockQuoteNestLevel()
    {
        let parent = this.currentRun;
        while (parent !== null)
        {
            if (parent.state == State.BlockQuote)
            {
                return parent.nestLevel;
            }

            parent = parent.parent;
        }

        return 0;
    }

    /// <summary>
    /// Searches for and returns the end of a list or list item that starts at `start`
    ///
    /// TODO: Remove differences between quote-nested lists and "regular" ones to avoid
    /// the messy logic strewn throughout this method.
    /// </summary>
    // This is the last long function, and breaking it down really doesn't make much sense
    _listEnd(start, nestLevel, ordered, wholeList)
    {
        let quoteNest = this._parentBlockQuoteNestLevel();
        let params = {};
        params.inBlockQuote = quoteNest != 0;
        params.nestLevel = nestLevel;
        params.ordered = ordered;
        params.wholeList = wholeList;

        params.linePrefixRegex = '';
        if (params.inBlockQuote)
        {
            params.linePrefixRegex = `[^>]*( *> *){${quoteNest - 1}} *>`;
        }
        else
        {
            // If we're not nested in any blockquotes, we don't expect
            // any extra characters in front of us on newlines
            params.linePrefixRegex = '';
        }

        let parentEnd = this.currentRun.end;

        params.newline = this.text.indexOf('\n', start);
        if (params.newline == -1 || params.newline >= parentEnd)
        {
            return parentEnd;
        }

        params.end = params.newline;
        params.next = this._indexOrParentEnd('\n', params.newline + 1);
        params.nextline = this.text.substring(params.newline + 1, params.next + 1);
        params.emptyLineRegex = new RegExp(`^${params.linePrefixRegex}${params.inBlockQuote ? ' *\\n' : '\\n$'}`);

        while (true)
        {
            if (params.nextline.length == 0)
            {
                return params.end;
            }

            params.empty = 0;
            if (!this._checkListEndLineBreaks(params))
            {
                return params.end;
            }

            if (!this._checkNextListLine(params))
            {
                return params.end;
            }

            params.end = params.next;
            params.newline = params.next;
            params.next = this._indexOrParentEnd('\n', params.next + 1);
            params.nextline = this.text.substring(params.newline + 1, params.next + 1);
        }
    }

    /// <summary>
    /// Checks for newlines in a list. If there are too many line breaks, or
    /// we reach the end of our bounds, set params.end and return false. If
    /// we don't find the end of a list, return true.
    _checkListEndLineBreaks(params)
    {
        while (params.emptyLineRegex.test(params.nextline))
        {
            ++params.empty;
            if (params.empty == 2)
            {
                // Two blank lines kills the list
                params.end += (params.inBlockQuote ? 0 : 2);
                return false;
            }

            params.newline = params.next;
            params.next = this._indexOrParentEnd('\n', params.next + 1);
            params.nextline = this.text.substring(params.newline + 1, params.next + 1);
            if (params.nextline.length == 0)
            {
                // Just a bunch of newlines at the end without additional context
                params.end += (params.inBlockQuote ? 0 : 2);
                return false;
            }
        }

        return true;
    }

    _checkNextListLine(params)
    {
        if (params.inBlockQuote && RegExp('^' + params.linePrefixRegex + '>').test(params.nextline))
        {
            // New blockquote nest level, can't bleed into it. Blockquotes that are
            // nested inside of this listitem are okay though
            return false;
        }

        // If we're here, nextline actually has content
        if (params.empty == 1)
        {
            // If there is a line break within the list, the next list
            // item must be indented at 2 * nestLevel. If the next line is not
            // a listitem and a potential continuation of the current li, it must
            // be indented with (nestLevel + 1) * 2 spaces
            let minspaces = (params.nestLevel + 1) * 2;
            if (!RegExp(`^${params.linePrefixRegex} {${minspaces},}`).test(params.nextline))
            {
                let spacePrefix = `${params.linePrefixRegex} {${minspaces - 2},${minspaces - 1}}`;
                if (!params.wholeList || !RegExp(`^${spacePrefix}${params.ordered ? '\\d+\\.' : '\\*'} `).test(params.nextline))
                {
                    params.end += (params.inBlockQuote ? 0 : 2);
                    return false;
                }
            }
        }
        else if (params.wholeList)
        {
            // Not a double newline, if it's a new listitem, it must be indented
            // at least (nestLevel * 2) spaces. Otherwise, any level of indentation is fine
            if (RegExp(`^${params.linePrefixRegex} *(?:\\*|\\d+\\.) `).test(params.nextline))
            {
                // Also can't swap between ordered/unordered with the same nesting level
                let minspaces = params.nestLevel * 2;
                if (!RegExp(`^${params.linePrefixRegex} {${minspaces},}`).test(params.nextline) ||
                    RegExp(`^${params.linePrefixRegex} {${minspaces},${minspaces + 1}}${params.ordered ? '\\*' : '\\d+\\.'} `).test(params.nextline))
                {
                    params.end += (params.inBlockQuote ? 0 : 1);
                    return false;
                }
            }
        }
        else
        {
            // Not a double newline. To continue the list item we need
            // general content of any kind, or a new list item that's indented
            // (minspaces + 1) * 2
            let minspaces = (params.nestLevel + 1) * 2;
            if (RegExp(`^${params.linePrefixRegex} {0,${minspaces - 1}}(?:\\*|\\d+\\.) `).test(params.nextline))
            {
                params.end += (params.inBlockQuote ? 0 : 1);
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Returns whether the current run is or is nested in a Run of the given state
    /// </summary>
    _nestedIn(state)
    {
        let parent = this.currentRun;
        while (parent !== null)
        {
            if (parent.state == state)
            {
                return true;
            }

            parent = parent.parent;
        }

        return false;
    }

    /// <summary>
    /// Tests whether we have a valid URL format starting at `start`
    ///
    /// Format: [X](Y), where X is the display text and Y is the url
    /// Alternate format: [X][Y], where Y is later defined as:
    ///                      [Y]: link
    /// </summary>
    /// <returns>
    /// An object containing information about the bounds of the url, or false if no URL was found
    /// </return>
    _testUrl(start)
    {
        let end = this._indexOrLast('\n', start);
        if (end - start < 5)
        {
            return false;
        }

        let ret =
        {
            text : '',
            url : 0,
            end : 0,
            type : 0 // 0 == regular link, 1 == reference, 2 == reference definition
        };

        let urlParse =
        {
            start : start,
            end : end,
            markers : [']', '(', ')'],
            markerIndex : 0,
            toFind : function() { return this.markers[this.markerIndex]; },
            inline : false,
            ret : ret
        };

        return this._parseUrl(urlParse);
    }

    /// <summary>
    /// Loops through all the characters in the potential URL
    /// </summary>
    /// <returns>A URL return object if a URL was found, otherwise false</returns>
    _parseUrl(urlParse)
    {
        for (let i = urlParse.start; i < urlParse.end; ++i)
        {
            switch (this.text[i])
            {
                case '[':
                    i = this._parseUrlOpenBracket(urlParse, i);
                    break;
                case ']':
                    if (!this._parseUrlCloseBracket(urlParse, i))
                    {
                        // End of reference link
                        return urlParse.ret;
                    }

                    break;
                case '(':
                    if (!this._parseUrlOpenParen(urlParse, i))
                    {
                        return false;
                    }

                    break;
                case ')':
                    if (this._parseUrlCloseParen(urlParse, i))
                    {
                        return urlParse.ret;
                    }

                    break;
                case '`':
                    this._parseUrlBacktick(urlParse, i);
                    break;
                case ':':
                    if (!this._parseUrlColon(urlParse, i))
                    {
                        break;
                    }

                    return urlParse.ret.type == 2 ? urlParse.ret : false;
                default:
                    break;
            }
        }

        return false;
    }

    /// <summary>
    /// Processes an open bracket in a potential URL. It could be part
    /// of a nested URL or part of a reference URL definition
    /// </summary>
    /// <returns>
    /// The index to resume processing. Only different if we have
    // a nested link and want to skip to the end of it
    /// </returns>
    _parseUrlOpenBracket(urlParse, i)
    {
        if (i == urlParse.start || this._isEscaped(i))
        {
            return i;
        }

        if (urlParse.toFind() == '(' && this.text[i - 1] == ']')
        {
            // We might have a reference link ([X][Y])
            urlParse.markerIndex = 0;
            urlParse.ret.url = i + 1;
            urlParse.ret.type = 1;
            return i;
        }

        if (urlParse.toFind() != ']')
        {
            return i;
        }

        // Nested link? Continue our search at the end of the nested link
        let innerUrl = this._testUrl(i);
        if (innerUrl)
        {
            i = innerUrl.end - 1;
        }

        return i;
    }

    /// <summary>
    /// Processes a closing bracket of a URL, which could be the end of the display text of a URL, or the
    /// end of a reference URL
    /// </summary>
    /// <returns>True if we should continue parsing. False if we reached the end of our reference link</returns>
    _parseUrlCloseBracket(urlParse, i)
    {
        if (urlParse.toFind() != ']' || this._isInline(urlParse.inline, i, urlParse.end) || this._isEscaped(i))
        {
            return true;
        }

        if (urlParse.ret.type == 1)
        {
            // Reference link
            urlParse.ret.url = this.text.substring(urlParse.ret.url, i);
            urlParse.ret.end = i + 1;
            return false;
        }

        urlParse.ret.text = this.text.substring(urlParse.start, i);
        ++urlParse.markerIndex;
        return true;
    }

    /// <summary>
    /// Processes an opening paren of a URL, which must follow the closing bracket of the display text
    /// </summary>
    /// <returns>True if we should continue parsing, false if the URL is invalid</returns>
    _parseUrlOpenParen(urlParse, i)
    {
        if (urlParse.toFind() != '(' || this.text[i - 1] == '\\')
        {
            return true;
        }

        if (this.text[i - 1] != ']')
        {
            return false;
        }

        urlParse.ret.url = i + 1;
        ++urlParse.markerIndex;
        return true;
    }

    /// <summary>
    /// Processes a closing paren of a URL, which may be the end of our URL definition
    /// </summary>
    /// <returns>True if we have completed our URL definition. False to continue parsing</returns>
    _parseUrlCloseParen(urlParse, i)
    {
        if (urlParse.toFind() != ')' || this.text[i - 1] == '\\')
        {
            return false;
        }

        urlParse.ret.url = this.text.substring(urlParse.ret.url, i);
        urlParse.ret.end = i + 1;
        return true;
    }

    /// <summary>
    /// Process a backtick inside of our URL definition, which may flip the urlParse.inline switch
    /// </summary>
    _parseUrlBacktick(urlParse, i)
    {
        if (this._isEscaped(i))
        {
            return;
        }

        urlParse.inline = !urlParse.inline;
    }

    /// <summary>
    /// Processes a colon inside of a URL. Only valid if it's the definition for a reference link ([marker]: URL)
    /// </summary>
    /// <returns>
    /// False if we should continue parsing, true if we are done parsing. If we're done parsing,
    /// the validity of the URL definition is determined by whether urlParse.type is correctly set
    /// </returns>
    _parseUrlColon(urlParse, i)
    {
        if (urlParse.toFind() != '(' ||
            this.text[i - 1] != ']' ||
            this._isEscaped(i) ||
            i == this.text.length - 1 ||
            this.text[i + 1] != ' ')
        {
            return false;
        }

        let urlEnd = this._indexOrLast('\n', urlParse.start);
        if (urlEnd - (i + 2) < 1)
        {
            return true;
        }

        this._urls[urlParse.ret.text.substring(1)] = this.text.substring(i + 2, urlEnd);
        urlParse.ret.type = 2;
        urlParse.ret.end = urlEnd;
        return true;
    }

    /// <summary>
    /// Helper that determines if we're currently in an inline code block.
    /// If we are, we should ignore the current index when parsing.
    /// </summary>
    _isInline(inline, i, end)
    {
        if (!inline)
        {
            return false;
        }

        let endInline = this.text.indexOf('`', i);
        return endInline != -1 && endInline < end;
    }

    /// <summary>
    /// Returns whether the character at the given index is escaped
    /// with a backslash. Takes into account the possibility of the
    /// backslash itself being escaped.
    /// </summary>
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

/// <summary>
/// Enum of sides passed into Run.transform to let us
/// know what portion of the element we're processing
/// </summary>
let RunSide =
{
    Left : -1,
    Middle : 0,
    Right : 1,
    Full : 2
};

/// <summary>
/// Core Run class that contains the definition of a single span.
/// Only the top-level run should be a pure Run. Everything else
/// should create a class that extends a Run.
/// </summary>
class Run
{
    /// <param name="state">The type of run. See State enum</param>
    /// <param name="start">The start index of this run</params>
    /// <param name="end">The end index of this run</params>
    /// <param name="parent">
    /// The Run that holds this run. Should never be null
    /// outside of the top-level Run
    /// </params>
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

        // List of Runs that are contained inside of this Run
        this.innerRuns = [];

        // HTML representation of this Run, generated after the run is `convert`ed.
        this.cached = '';
    }

    /// <summary>
    /// Converts the given run to HTML
    /// </summary>
    /// <param name="initialText">The full input markdown text</param>
    /// <param name="inlineOnly">
    /// True if this run's parent only allows inline elements
    /// If true, prevents newline elements from being inserted
    /// </param>
    convert(initialText, inlineOnly)
    {
        if (this.cached.length != 0)
        {
            return this.cached;
        }

        if (!inlineOnly && this.shouldProcessNewlines())
        {
            this.parseNewlines(initialText);
        }

        // Even the setup for logging can get expensive when 'convert' is called hundreds/thousands
        // of times. Do some faster short-circuiting before setting anything up.
        const shouldLogTmi = g_logLevel < LOG.Verbose;
        let ident = shouldLogTmi ? ' '.repeat(this._nestLevel * 3) : ''; // Indent logging to indicate nest level
        if (shouldLogTmi)
        {
            logTmi(`${ident}Converting State.${stateToStr(this.state)} : ${this.start}-${this.end}. ${this.innerRuns.length} children.`);
        }

        this.cached = this.tag(false /*end*/);

        let startWithContext = this.start + this.startContextLength();
        let endWithContext = Math.max(startWithContext, this.end - this.endContextLength());
        if (this.innerRuns.length == 0)
        {
            this.cached += this.transform(initialText.substring(startWithContext, endWithContext), RunSide.Full);

            // Don't directly += this, because Headers do hacky things to this.cached when grabbing the end tag
            let endTag = this.tag(true /*end*/);
            this.cached += endTag;
            return this.cached;
        }

        if (startWithContext < this.innerRuns[0].start)
        {
            this.cached += this.transform(initialText.substring(startWithContext, this.innerRuns[0].start), RunSide.Left);
        }

        // Recurse through children
        this._convertChildren(initialText, inlineOnly);

        if (this.innerRuns[this.innerRuns.length - 1].end < endWithContext)
        {
            this.cached += this.transform(
                initialText.substring(this.innerRuns[this.innerRuns.length - 1].end, endWithContext),
                RunSide.Right,
                this.innerRuns[this.innerRuns.length - 1]);
        }

        // Don't directly += this, because Headers do hacky things to this.cached when grabbing the end tag
        let endTag = this.tag(true /*end*/);
        this.cached += endTag;
        return this.cached;
    }

    /// <summary>
    /// Iterate through and convert child runs to HTML
    /// </summary>
    _convertChildren(initialText, inlineOnly)
    {
        for (let i = 0; i < this.innerRuns.length; ++i)
        {
            this.cached += this.innerRuns[i].convert(initialText, inlineOnly);
            if (i != this.innerRuns.length - 1 && this.innerRuns[i].end < this.innerRuns[i + 1].start)
            {
                this.cached += this.transform(
                    initialText.substring(this.innerRuns[i].end, this.innerRuns[i + 1].start),
                    RunSide.Middle,
                    this.innerRuns[i]);
            }
        }
    }

    /// <summary>
    /// Returns how deeply nested we are from the top-level run
    /// </summary>
    _nestLevel()
    {
        let nest = 0;
        let parent = this.parent;
        while (parent !== null)
        {
            parent = parent.parent;
            ++nest;
        }

        return nest;
    }

    /// <summary>
    /// Total length of this run
    /// </summary>
    length() { return this.end - this.start; }

    /// <summary>
    /// Number of prefixed characters that shouldn't be included
    /// in the final text, as they are part of the formatting
    /// </summary>
    startContextLength() { return 0; }

    /// <summary>
    /// Number of postfixed characters that shouldn't be included
    /// in the final text, as they are part of the formatting.
    /// </summary>
    endContextLength() { return 0; }

    /// <summary>
    /// Returns the HTML tag for the current Run
    /// </summary>
    /// <param name="end">False if we want the opening tag, true if we want the closing tag</param>
    tag(/*end*/) { return ''; }

    /// <summary>
    /// Trims whitespace from the given text
    /// </summary>
    /// <param name="text">The text to trim</param>
    /// <param name="side">A value from the RunSide enum</param>
    trim(text, side)
    {
        switch (side)
        {
            case RunSide.Full:
                return text.trim();
            case RunSide.Left:
                return text.replace(/^\s+/gm, '');
            case RunSide.Right:
                return text.replace(/\s+$/gm, '');
            case RunSide.Middle:
                return text;
            default:
                logError('Unknown side: ' + side);
                return text;
        }
    }

    /// <summary>
    /// Checks for escaped characters and removes the
    /// backslash for the final text.
    /// </summary>
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
                // Lonesome backslash. Treat it as a normal backslash character
                newText += '\\';
            }
        }

        return newText;
    }

    /// <summary>
    /// Returns whether we should process newlines given our state
    ///
    /// Currently, we only process newlines in our top-level Run a nd
    /// within lists and blockquotes
    /// </summary>
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

    /// <summary>
    /// Returns whether we consider our state to be a block element
    /// </summary>
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

    /// <summary>
    /// Parses the Run looking for newlines, inserting
    /// divs and breaks into the run as necessary
    /// </summary>
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
            let parseResult = this._parseNewline(text, newline, end, doubles, previousRun, nextRun);
            cBreaks += parseResult.breaks;
            let offset = parseResult.newlineOffset;
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

    /// <summary>
    /// Parses a single run of newlines
    /// </summary>
    /// <returns>An object indicating the number of line breaks we added, and the new offset to parse from</returns>
    _parseNewline(text, newline, end, doubles, previousRun, nextRun)
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

        let parseResult = { breaks : 0, newlineOffset : offset };

        let atTop = newline == previousRun.end;
        let atBottom = nextRun !== null && newline + offset == nextRun.start;

        if (cNewlines > 1 && this.state == State.None)
        {
            if ((!atTop && !atBottom) || cNewlines > 2)
            {
                doubles.push([newline, newline + offset]);
                return parseResult;
            }
        }

        parseResult.breaks = this._addBreaks(newline, cNewlines, previousRun, nextRun, atTop, atBottom);
        return parseResult;
    }

    /// <summary>
    /// Add line breaks for a particular run of newlines
    /// </summary>
    /// <param name="newline">The start of this newline run</param>
    /// <param name="cNewlines">The number of newlines in this run</param>
    /// <param name="previousRun">The closest preceding run to newline. Potentially its own parent</param>
    /// <param name="nextRun">The run directly after newline</param>
    /// <param name="atTop">True if newline is immediately after our previousRun</param>
    /// <param name="atBottom">True if nextRun is immediately after our newline run</param>
    /// <returns>The number of line breaks added</returns>
    _addBreaks(newline, cNewlines, previousRun, nextRun, atTop, atBottom)
    {
        let cBreaks = 0;

        if (atTop)
        {
            // We're at the start of the block, only add a break under certain conditions
            if (this._shouldAddBreak(this.state, previousRun))
            {
                cBreaks += this._insertBreak(newline);
            }
        }
        else if (atBottom)
        {
            if (this._shouldAddBreak(this.state, nextRun))
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
                if (cNewlines > 2 || this._shouldAddBreak(this.state, previousRun))
                {
                    cBreaks += this._insertBreak(newline + 1);
                }
            }
            else if (atBottom)
            {
                if (cNewlines > 2 || this._shouldAddBreak(this.state, nextRun))
                {
                    cBreaks += this._insertBreak(newline + 1);
                }
            }
            else
            {
                cBreaks += this._insertBreak(newline + 1);
            }
        }

        return cBreaks;
    }

    /// <summary>
    /// Determines whether we should add a linebreak based on the current state
    /// and the state of whatever run is directly to the left/right of us
    /// </summary>
    _shouldAddBreak(state, compareRun)
    {
        return !compareRun.isBlockElement() ||
            (state == State.ListItem &&
                (compareRun.state == State.ListItem ||
                    compareRun.state == State.OrderedList ||
                    compareRun.state == State.UnorderedList));
    }

    /// <summary>
    /// Inserts a div into this Run
    /// </summary>
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

    /// <summary>
    /// Inserts a break in this run at the given index
    /// </summary>
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

    /// <summary>
    /// Transforms the given text into HTML compliant text.
    /// </summary>
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

        // Other classes might want to keep newlines around for extra
        // processing, but if we're in a plain Run, we don't want them
        if (this.state == State.None)
        {
            newText = newText.replace(/\n/g, '');
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

    /// <summary>
    /// Helper for runs that have basic <X> </X> tags
    /// </summary>
    static basicTag(tag, end)
    {
        return `<${end ? '/' : ''}${tag}>`;
    }
}

/// <summary>
/// Run definition for a linebreak - <br>
/// </summary>
class Break extends Run
{
    constructor(start, parent)
    {
        super(State.LineBreak, start, start + 1, parent);
    }

    tag(end) { return end ? '' : '<br />'; }

    // Override parent transform and return an empty string, as a break has no content
    transform(/*newText*/) { return ''; }
}

/// <summary>
/// Horizontal Rule - <hr>
/// </summary>
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

/// <summary>
/// Div - <div>Content</div>
/// </summary>
class Div extends Run
{
    constructor(start, end, text, parent)
    {
        super(State.Div, start, end, parent);
        this.text = text.substring(start, end);
    }

    /// <summary>
    /// Div tag adds the mdDiv class
    /// </summary>
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

/// <summary>
/// Header - <h1-6>Content</h1-6>
/// </summary>
class Header extends Run
{
    /// <param name="headerLevel">The type of header, 1-6</param>
    /// <param name="text">Full markdown text, used to set the header element's id</param>
    constructor(start, end, headerLevel, parent)
    {
        super(State.Header, start, end, parent);
        this.headerLevel = headerLevel;
    }

    startContextLength()
    {
        return this.headerLevel + 1;
    }

    /// <summary>
    /// Header opening tag includes the id
    /// </summary>
    tag(end)
    {
        if (end)
        {
            let endTag = `</h${this.headerLevel}>`;

            // Get __real__ hacky and inefficient in order to find the proper id for this element
            let div = document.createElement('div');
            div.innerHTML = this.cached + endTag;
            let id = div.innerText.toLowerCase().replace(/ /g, '-').replace(/[^-_a-zA-Z0-9]/g, '').replace(/^-+/, '').replace(/-+$/, '');
            if (/^\d/.test(id))
            {
                // Id's can't start with a number. Prefix with an underscore
                id = '_' + id;
            }

            this.cached = this.cached.replace('__ID__', id);
            return endTag;
        }

        return `<h${this.headerLevel} id="__ID__">`;
    }

    /// <summary>
    /// Strips trailing '#' before calling the core transform routine
    /// </summary>
    transform(newText, side)
    {
        newText = this.trim(newText, side);
        let i = newText.length - 1;

        const isEscaped = function(text, index)
        {
            let bs = 0;
            while (index - bs > 0 && text[index - 1 - bs] == '\\')
            {
                ++bs;
            }

            return bs % 2 == 1;
        };

        while (i >= 0 && newText[i] == '#')
        {
            if (isEscaped(newText, i))
            {
                break;
            }

            --i;
        }

        return super.transform(this.escapeChars(this.trim(newText.substring(0, i + 1), side), '#'));
    }
}

/// <summary>
/// BlockQuote - <blockquote>Content</blockquote>
/// </summary>
class BlockQuote extends Run
{
    /// <param name="nestLevel">
    /// The nest level for the blockquote, i.e. how many prefixed '>' there are
    /// </param>
    constructor(start, end, nestLevel, parent)
    {
        super(State.BlockQuote, start, end, parent);
        this.nestLevel = nestLevel;
    }

    startContextLength() { return 1; }
    endContextLength() { return 0; }

    tag(end) { return Run.basicTag('blockquote', end); }

    /// <summary>
    /// Remove the necessary number of quote indicators ('>')
    /// before handing it over to the core transform routine
    /// </summary>
    transform(newText, side, previousRun)
    {
        // Look for 'newline + >' and remove them.
        let transformed = '';
        if (newText[0] != '\n')
        {
            // Always want to start with a newline
            newText = '\n' + newText;
        }

        let trimSpaces =
            side == RunSide.Full ||
            side == RunSide.Left ||
            (previousRun && (previousRun.isBlockElement() || previousRun.state == State.LineBreak));

        for (let i = 0; i < newText.length; ++i)
        {
            if (newText[i] != '\n')
            {
                transformed += newText[i];
                continue;
            }

            let lastQuote = i;
            while (i + 1 < newText.length && /[> ]/.test(newText[i + 1]))
            {
                ++i;

                if (newText[i] == '>')
                {
                    lastQuote = i;
                }
            }

            if (!trimSpaces)
            {
                i = lastQuote;
            }
        }

        return super.transform(transformed);
    }
}

/// <summary>
/// Unordered lists - <ul>listitems</ul>
/// </summary>
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

    /// <summary>
    /// Nothing is allowed inside of lists other than
    /// list items, so return an empty string. This
    /// also helps remove pesky blockquote artifacts
    /// </summary>
    transform(/*newText,*/ /*side*/)
    {
        return '';
    }
}

/// <summary>
/// Ordered list - <ol>listitems</ul>
/// </summary>
class OrderedList extends Run
{
    /// <param name="listStart">The number to start counting for this list</param>
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

        if (this.listStart == 1)
        {
            // start="X" is unnecessary when the list starts with 1
            return '<ol>';
        }

        return `<ol start="${this.listStart}">`;
    }

    /// <summary>
    /// Nothing is allowed inside of lists other than
    /// list items, so return an empty string. This
    /// also helps remove pesky blockquote artifacts
    /// </summary>
    transform(/*newText,*/ /*side*/)
    {
        return '';
    }
}

/// <summary>
/// List items - <li>Content</li>
/// </summary>
class ListItem extends Run
{
    constructor(start, end, startContext, parent)
    {
        super(State.ListItem, start, end, parent);
        this.startContext = startContext;
    }

    startContextLength() { return this.startContext; }
    endContextLength() { return 0; }

    tag(end) { return Run.basicTag('li', end); }

    /// <summary>
    /// Bypass the core transform method and parse it ourselves.
    /// We need to go up our parent chain looking for blockquotes
    /// so we can remove the correct number of blockquote markers ('>')
    /// </summary>
    transform(newText, side, previousRun)
    {
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

        // Even if we're in the middle or end of our run we still want to trim leading whitespace if
        // our previous run is a block element.
        let trimBeginning = previousRun && (previousRun.isBlockElement() || previousRun.state == State.LineBreak);

        let lines = newText.split('\n');

        // If we're parsing the beginning of the list item, we can skip
        // the first line as the starting '>'s are not included
        for (let i = ((side == RunSide.Left || side == RunSide.Full) ? 1 : 0); i < lines.length; ++i)
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

            let trimSide = trimBeginning ? side == RunSide.Right ? RunSide.Full : RunSide.Left : side;
            lines[i] = this.trim(line.substring(j), trimSide);

            // Remove empty lines to avoid excess newlines when joining
            if (lines[i].length == 0)
            {
                lines.splice(i, 1);
                --i;
            }
        }

        return super.transform(lines.join('\n'));
    }
}

/// <summary>
/// Text urls - <a href="url">Display Text</a>
/// </summary>
class Url extends Run
{
    constructor(start, end, url, parent)
    {
        super(State.Url, start, end, parent);
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

    /// <summary>
    /// Call our parent transform method after first un-escaping some
    // additional characters ('[]')
    /// </summary>
    transform(newText, /*side*/)
    {
        return super.transform(this.escapeChars(newText, '[]'));
    }
}

/// <summary>
/// Alternate text urls - <a href="url">Display text</a>
/// Handles urls defined via '[displayText][identifier]', where
/// identifier is defined elsewhere via '[identifier]: url'
/// </summary>
class ReferenceUrl extends Url
{
    /// <param name="urls">The dictionary mapping url identifiers with their urls</param>
    constructor(start, end, url, urls, parent)
    {
        super(start, end, url, parent);
        this.urls = urls;
        this.urlLink = url;
        this.converted = false;
    }

    /// <summary>
    /// Called once the full markdown text has been parsed and
    /// replaces the url identifier with the actual url
    /// </summary>
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

/// <summary>
/// Handles the reference link definition '[identifier]: url'.
/// Keeps the text around, but surrounds it in an HTML comment
/// so it isn't displayed.
/// </summary>
class ReferenceUrlDefinition extends Run
{
    constructor(start, end, parent)
    {
        super(State.HtmlComment, start, end, parent);
    }

    tag(end) { return end ? ' -->' : '<!-- '; }

    /// <summary>
    /// No transformation necessary, return without modification
    /// </summary>
    transform(newText, /*side*/)
    {
        return newText;
    }
}

/// <summary>
/// Images - <img src="url" alt="altText" width="x(%|px)" height="y(%|px)">
/// </summary>
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

    /// <summary>
    /// Inline tag, so return nothing on `end`. Otherwise, build the inline
    /// element by including the url, optional dimensions, and alt text.
    /// </summary>
    tag(end)
    {
        if (end)
        {
            return '';
        }

        let base = `<img src="${encodeURI(this.url)}" alt="${super.transform(this.altText)}"`;

        let widthP = this._parseDimension(true /*width*/);
        if (!isNaN(this.width))
        {
            base += ` width="${this.width}${widthP ? '%' : 'px'}"`;
        }

        let heightP = this._parseDimension(false /*width*/);
        if (!isNaN(this.height))
        {
            base += ` height="${this.height}${heightP ? '%' : 'px'}"`;
        }

        return base + '>';
    }

    /// <summary>
    /// Parses the string width/height and converts it to an integer
    /// </summary>
    /// <returns>true if the dimension is given in percentage, false if pixels</returns>
    _parseDimension(width)
    {
        let dimen = width ? this.width : this.height;
        let percentage = false;
        if (dimen.endsWith('px'))
        {
            dimen = parseInt(dimen.substring(0, dimen.length - 2));
        }
        else if (dimen.endsWith('%'))
        {
            dimen = parseInt(dimen.substring(0, dimen.length - 1));
            percentage = true;
        }
        else
        {
            dimen = parseInt(dimen);
        }

        if (width)
        {
            this.width = dimen;
        }
        else
        {
            this.height = dimen;
        }

        return percentage;
    }

    // Inline tag, no actual content
    transform(/*newText,*/ /*side*/)
    {
        return '';
    }
}

/// <summary>
/// Core code block definition for shared functionality between
/// indented and backtick/tilde blocks - <pre>Content</pre>
/// </summary>
class CodeBlock extends Run
{
    constructor(start, end, parent)
    {
        super(State.CodeBlock, start, end, parent);
    }

    tag(end) { return Run.basicTag('pre', end); }

    /// <summary>
    /// Returns a span containing the current code block line number
    /// </summary>
    lineNumber(line, pad)
    {
        line = line.toString();
        line += ' '.repeat(pad - line.length);
        return `<span class="codeLineNumber">${line}</span>`;
    }
}

/// <summary>
/// Code block logic specific to backtick/tilde blocks
/// </summary>
class BacktickCodeBlock extends CodeBlock
{
    constructor(start, end, indent, text, language, parent)
    {
        super(start, end, parent);
        this.indent = indent;
        this.text = text.substring(start, end);
        this.language = language;
        this.quoteLevel = 0;
        let run = this.parent;
        while (run !== null)
        {
            if (run.state == State.BlockQuote)
            {
                ++this.quoteLevel;
            }

            run = run.parent;
        }
    }

    startContextLength() { return this.text.indexOf('\n') + 1; }
    endContextLength() { return this.text.length - this.text.lastIndexOf('\n'); }

    /// <summary>
    /// Forwards to buildCodeBlock to correctly format each line and strip the necessary prefixed spaces
    /// </summary>
    transform(newText, /*side*/)
    {
        newText = super.transform(newText);
        this._buildCodeBlock(newText, function(line, i)
        {
            let trimmedLine = this._getTrimmedLine(line);
            this.finalText += this.lineNumber(i + 1, this.pad) + trimmedLine + '\n';
        });

        return this.finalText;
    }

    /// <summary>
    /// Splits the code block into individual lines and
    /// applies the given function to each line
    /// </summary>
    _buildCodeBlock(text, fn)
    {
        this.finalText = '';
        let lines = text.split('\n');
        this.pad = lines.length.toString().length;
        lines.forEach(fn, this);
    }

    /// <summary>
    /// Returns the given line with all prefixed nest-related characters removed
    /// </summary>
    _getTrimmedLine(line)
    {
        if (this.indent != 0)
        {
            // We're nested in a list and should use this.indent to determine how much
            // to trim. However, we've replaced all '>' with '&gt;' already (since we don't
            // want to escape our added line number span), so we need to adjust our substring
            // start to account for additional characters
            return line.substring(this.indent + (this.quoteLevel * 3));
        }

        if (this.quoteLevel == 0)
        {
            // We're not nested inside of anything. Use the raw line
            return line;
        }

        // We're nested inside of a blockquote. Trim up to our block level
        let left = this.quoteLevel;
        let trim = 0;
        for (; trim < line.length; ++trim)
        {
            // At this point we've already translated '>' to '&gt;'
            if (line[trim] == '&' && line.substring(trim + 1, trim + 4) == 'gt;' && --left == 0)
            {
                trim += 4;
                break;
            }
        }

        if (left == 0)
        {
            return line.substring(trim);
        }

        logError("We're in a block quote, but didn't find the right number of markers");
        return line;
    }
}

/// <summary>
/// Code block logic specific to indented blocks
/// </summary>
class IndentCodeBlock extends CodeBlock
{
    constructor(start, end, nextLineRegex, parent)
    {
        super(start, end, parent);
        this.nextLineRegex = nextLineRegex;
    }

    startContextLength() { return 4; }
    endContextLength() { return 0; }

    /// <summary>
    /// Format each line and strip the necessary prefixed spaces/quote markers
    /// </summary>
    transform(newText, /*side*/)
    {
        let finalText = '';
        let lines = newText.split('\n');
        this.pad = lines.length.toString().length;
        let matchRegex = RegExp(this.nextLineRegex + '(.*)');
        for (let i = 0; i < lines.length; ++i)
        {
            const lineNumber = this.lineNumber(i + 1, this.pad);
            let line = lines[i];
            if (i == 0)
            {
                // First line is not indented at all
                finalText += lineNumber + super.transform(line) + '\n';
            }
            else
            {
                let match = line.match(matchRegex);
                if (match)
                {
                    finalText += lineNumber + super.transform(match[1]) + '\n';
                }
                else
                {
                    logWarn('Error parsing indent code block line: ' + line);
                    finalText += line + '\n';
                }
            }
        }

        return finalText;
    }
}

/// <summary>
/// Holds the definition for a table
///
/// <table>
///   <thead>
///     <tr>
///       <td align="XYZ">ColHeader</td>
///       ...
///     </tr>
///   </thead>
///   <tbody>
///     <tr>
///       <td align="XYZ">Cell</td>
///       ...
///     </tr>
///     ...
///   </tbody>
/// </table>
/// </summary>
class Table extends Run
{
    /// <param name="table">
    /// Table object:
    ///  header - array of column headers
    ///  columnAlign - alignment info for each column
    ///  rows - array of rows, where each row is an array of cells
    /// </param>
    constructor(start, end, table, parent)
    {
        super(State.Table, start, end, parent);
        this.table = table;
    }

    startContextLength() { return 0; }
    endContextLength() { return 0; }

    tag(end) { return Run.basicTag('table', end); }

    /// <summary>
    /// Builds and returns the <table> content from this.table
    /// </summary>
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

/// <summary>
/// Inline code run - <code>content</code>
/// </summary>
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

    /// <summary>
    /// Transform the inline code snippet by removing a leading or trailing space
    /// iff it's next to a backtick
    transform(newText)
    {
        if (newText.length > 1)
        {
            if (newText[0] == ' ' && newText[1] == '`')
            {
                newText = newText.substring(1);
            }

            if (newText[newText.length - 1] == ' ' && newText[newText.length - 2] == '`')
            {
                newText = newText.substring(0, newText.length - 1);
            }
        }

        return super.transform(newText);
    }
}

/// <summary>
/// Base class for inline formatting (bold/italic/etc)
/// </summary>
class InlineFormat extends Run
{
    // (Constructor same as parent)

    transform(newText, /*side*/)
    {
        return super.transform(newText).replace(/\n/g, '<br>');
    }
}

/// <summary>
/// Bold - <strong>Content</strong>
/// </summary>
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

/// <summary>
/// Italic - <em>Content</em>
/// </summary>
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

/// <summary>
/// Underline - <ins>Content</ins>
/// </summary>
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

/// <summary>
/// Strikethrough - <s>Content</s>
/// </summary>
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

/// <summary>
/// HTML comment - <!-- Content -->
/// Exists more for tracking than an actual markdown element
/// </summary>
class HtmlComment extends Run
{
    constructor(start, end, parent)
    {
        super(State.HtmlComment, start, end, parent);
    }

    tag(/*end*/) { return ''; }

    /// <summary>
    /// Technically no harm in removing (returning ''), but no harm
    /// in keeping it around either.
    /// </summary>
    transform(newText, /*side*/)
    {
        // Leave exactly as-is, we want it to be parsed as an HTML comment
        return newText;
    }
}


// Cache markdown help document so we don't ping the server every time
let _helpMarkdown = new Markdown();
let _mdHelpHTML = '';

/// <summary>
/// Passes the markdown help text to the given callback
/// </summary>
/// <param name="callback">Function to call once we have the markdown text</param>
/// <param name="raw">
/// If true, passes the raw markdown text to the callback.
/// If false, passes the converted HTML to the callback.
/// </param>
function markdownHelp(callback, raw=false)
{
    if (_mdHelpHTML.length != 0)
    {
        callback({ data : raw ? _helpMarkdown.text : _mdHelpHTML });
        return;
    }

    let successFunc = function(response, request)
    {
        _mdHelpHTML = `<div class="md">${_helpMarkdown.parse(response.data)}</div>`;
        callback({ data : request.raw ? _helpMarkdown.text : _mdHelpHTML });
    };

    sendHtmlJsonRequest('process_request.php', { type : ProcessRequest.MarkdownText }, successFunc, undefined, { raw : raw });
}
